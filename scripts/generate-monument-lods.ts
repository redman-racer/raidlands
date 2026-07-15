import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Document, NodeIO, type Material, type Node, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { copyToDocument, flatten, getBounds, join, normals, prune, simplify, simplifyPrimitive, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "assets/media/models/monuments");
const outputDir = resolve(root, "assets/media/models/monuments-map");
const manifestPath = resolve(outputDir, "manifest.json");
const checkOnly = process.argv.includes("--check");
const manifestOnly = process.argv.includes("--manifest-only");
const onlyAsset = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length) || "";
const maxBytes = 250 * 1024;

const MAP_PALETTE = [
  [0.11, 0.13, 0.13], [0.24, 0.27, 0.27], [0.39, 0.42, 0.4], [0.58, 0.58, 0.53],
  [0.73, 0.7, 0.61], [0.42, 0.27, 0.18], [0.56, 0.26, 0.14], [0.66, 0.4, 0.18],
  [0.17, 0.26, 0.16], [0.28, 0.39, 0.24], [0.17, 0.3, 0.39], [0.28, 0.44, 0.52],
  [0.48, 0.16, 0.12], [0.73, 0.55, 0.16], [0.78, 0.79, 0.75], [0.91, 0.89, 0.8],
] as const;

const MAP_INVISIBLE_NAME = /(?:grass|bush|fern|foliage|twig|debris|cardboard|loot|barrel|box|chair|desk|computer|telephone|poster|pallet|vehicle|sedan|truck|van|helicopter|forklift|road_cone|sandbag|fence|lamp|spotlight|fluorescent|switch|door_handle|powerline_pole)/i;

// Launch Site is a compound prefab containing complete interiors and exteriors.
// Generic whole-scene simplification favored its broad interior floors and
// collapsed thin wall shells. At map distance the exterior silhouette is the
// useful representation, so retain the authored shell assemblies explicitly.
const LAUNCH_SITE_MAP_SHELL = /(?:rocket_factory_(?:exterior|silo|scaffolding|crane_beams|crane_arm|helipad|support_beam|tower_frame)|rocket_(?:boosters_stage|payload)|space_center_(?:office_bld|roof_module)|warehouse_launch_site|watch_tower|range_core_exterior|pipeline_bespoke_launchsite|floodlights_A)/i;

type Bounds = { min: number[]; max: number[] };
type Stats = { triangles: number; drawCalls: number; textureBytes: number; bounds: Bounds };

async function io(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder, "draco3d.encoder": encoder,
    "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder,
  });
}

function documentStats(document: Document): Stats {
  const documentRoot = document.getRoot();
  const bounds = getBounds(documentRoot.getDefaultScene() || documentRoot.listScenes()[0]!);
  let triangleCount = 0;
  for (const mesh of documentRoot.listMeshes()) for (const primitive of mesh.listPrimitives()) {
    triangleCount += Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3);
  }
  return {
    triangles: triangleCount,
    drawCalls: documentRoot.listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0),
    textureBytes: documentRoot.listTextures().reduce((sum, texture) => sum + (texture.getImage()?.byteLength ?? 0), 0),
    bounds: { min: Array.from(bounds.min), max: Array.from(bounds.max) },
  };
}

function hlodNodes(document: Document): Node[] {
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh() && (
    /(?:^|[_\-.])hlod(?:[_\-.]|$)/i.test(node.getName())
    || /(?:^|[_\-.])hlod(?:[_\-.]|$)/i.test(node.getMesh()!.getName())
  ));
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.listChildren().includes(node)));
}

function extractHlod(source: Document, nodes: Node[]): Document {
  const target = new Document();
  const scene = target.createScene("monument-map-hlod");
  const copied = copyToDocument(target, source, nodes);
  for (const sourceNode of nodes) {
    const node = copied.get(sourceNode) as Node;
    node.setMatrix(sourceNode.getWorldMatrix());
    scene.addChild(node);
  }
  target.getRoot().setDefaultScene(scene);
  return target;
}

function nearestPalette(color: number[]): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  MAP_PALETTE.forEach((candidate, index) => {
    const next = candidate.reduce((sum, channel, channelIndex) => sum + (channel - (color[channelIndex] ?? 0.5)) ** 2, 0);
    if (next < distance) { distance = next; best = index; }
  });
  return best;
}

async function textureAverage(texture: Texture, cache: Map<Texture, Promise<number[]>>): Promise<number[]> {
  const cached = cache.get(texture);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const image = texture.getImage();
      if (!image) return [0.5, 0.5, 0.5];
      const sample = await sharp(image).resize(1, 1, { fit: "fill" }).removeAlpha().raw().toBuffer();
      return [0, 1, 2].map((index) => (sample[index] ?? 128) / 255);
    } catch {
      return [0.5, 0.5, 0.5];
    }
  })();
  cache.set(texture, promise);
  return promise;
}

async function materialColor(material: Material, textureCache: Map<Texture, Promise<number[]>>): Promise<number[]> {
  const factor = material.getBaseColorFactor();
  const texture = material.getBaseColorTexture();
  const average = texture ? await textureAverage(texture, textureCache) : [1, 1, 1];
  return [0, 1, 2].map((index) => average[index]! * factor[index]!);
}

async function generateGeometryProxy(source: Document, id: string, sourceStats: Stats): Promise<Document> {
  const target = new Document();
  const sourceScene = source.getRoot().getDefaultScene() || source.getRoot().listScenes()[0]!;
  const copied = copyToDocument(target, source, [sourceScene]);
  const scene = copied.get(sourceScene)!;
  target.getRoot().setDefaultScene(scene);

  const bounds = getBounds(scene);
  const footprint = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const minimumExtent = Math.max(1.25, footprint * 0.012);
  for (const node of target.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const nodeBounds = getBounds(node);
    const extent = Math.max(...[0, 1, 2].map((axis) => nodeBounds.max[axis]! - nodeBounds.min[axis]!));
    const name = `${node.getName()} ${node.getMesh()!.getName()}`;
    if (id === "launch_site_1") {
      if (!LAUNCH_SITE_MAP_SHELL.test(name)) node.setMesh(null);
      continue;
    }
    const invisibleDecoration = MAP_INVISIBLE_NAME.test(name) || (id !== "junkyard_1" && /junk/i.test(name));
    if (extent < minimumExtent || invisibleDecoration) node.setMesh(null);
  }

  const paletteMaterials = MAP_PALETTE.map((color, index) => target.createMaterial(`map-palette-${index}`).setBaseColorFactor([...color, 1]));
  const textureCache = new Map<Texture, Promise<number[]>>();
  const materialMap = new Map<Material, Material>();
  for (const material of target.getRoot().listMaterials()) {
    materialMap.set(material, paletteMaterials[nearestPalette(await materialColor(material, textureCache))]!);
  }
  for (const mesh of target.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const material = primitive.getMaterial();
    if (material) primitive.setMaterial(materialMap.get(material)!);
    for (const semantic of primitive.listSemantics()) if (semantic !== "POSITION") primitive.setAttribute(semantic, null);
    for (const morphTarget of primitive.listTargets()) primitive.removeTarget(morphTarget);
  }

  if (id === "launch_site_1") {
    await target.transform(weld({ overwrite: true }), prune());
    for (const mesh of target.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
      simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio: 0.04, error: 0.02, lockBorder: false });
    }
    await target.transform(normals({ overwrite: true }), flatten(), join({ keepNamed: false }), prune());
    return target;
  }

  await target.transform(flatten(), join({ keepNamed: false }), weld({ overwrite: true }), prune());
  const joinedStats = documentStats(target);
  const targetTriangles = Math.max(4000, Math.min(30000, Math.round(sourceStats.triangles * 0.012)));
  await target.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTriangles / Math.max(1, joinedStats.triangles)), error: 0.05 }),
    normals({ overwrite: true }),
    prune(),
  );
  return target;
}

function optimizeStagedAsset(stagedPath: string, outputPath: string, textured: boolean): void {
  const args = [resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js"), "optimize", stagedPath, outputPath,
    "--compress", "draco", "--simplify", "false", "--flatten", "true", "--join", "true", "--palette", "false"];
  if (textured) args.push("--texture-compress", "webp", "--texture-size", "256");
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

async function main(): Promise<void> {
  const files = readdirSync(sourceDir).filter((name) => name.endsWith(".glb")).sort();
  if (checkOnly && !existsSync(manifestPath)) throw new Error("Monument map manifest is missing. Run npm run monuments:lod.");
  mkdirSync(outputDir, { recursive: true });
  const reader = await io();
  const entries = [];
  for (const name of files) {
    const sourcePath = resolve(sourceDir, name);
    const sourceDocument = await reader.read(sourcePath);
    const sourceStats = documentStats(sourceDocument);
    const candidates = hlodNodes(sourceDocument);
    const id = basename(name, ".glb");
    const mapKind = candidates.length ? "authored-hlod" : "generated-proxy";
    const outputPath = resolve(outputDir, name);
    if (!checkOnly && !manifestOnly && (!onlyAsset || onlyAsset === id)) {
      const stagedPath = resolve(outputDir, `.${id}.staged.glb`);
      const mapDocument = candidates.length
        ? extractHlod(sourceDocument, candidates)
        : await generateGeometryProxy(sourceDocument, id, sourceStats);
      await reader.write(stagedPath, mapDocument);
      optimizeStagedAsset(stagedPath, outputPath, candidates.length > 0);
      rmSync(stagedPath, { force: true });
    }
    if (!existsSync(outputPath)) throw new Error(`${name}: map proxy is missing`);
    const outputStats = documentStats(await reader.read(outputPath));
    const outputBytes = statSync(outputPath).size;
    const sourceNodes = candidates.length
      ? candidates.map((node) => node.getName())
      : id === "launch_site_1"
        ? Array.from(new Set(sourceDocument.getRoot().listNodes().filter((node) => {
          const mesh = node.getMesh();
          return mesh && LAUNCH_SITE_MAP_SHELL.test(`${node.getName()} ${mesh.getName()}`);
        }).map((node) => node.getMesh()!.getName() || node.getName()).filter(Boolean))).sort()
        : [];
    entries.push({
      id, detail: `../monuments/${name}`, map: name, mapKind,
      sourceNodes,
      sourceSha256: createHash("sha256").update(readFileSync(sourcePath)).digest("hex"),
      outputSha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex"),
      sourceBytes: statSync(sourcePath).size, outputBytes,
      sourceTriangles: sourceStats.triangles, sourceDrawCalls: sourceStats.drawCalls,
      sourceBounds: sourceStats.bounds,
      triangles: outputStats.triangles, drawCalls: outputStats.drawCalls,
      triangleRatio: Number((outputStats.triangles / Math.max(1, sourceStats.triangles)).toFixed(6)),
      overTriangleTarget: outputStats.triangles / Math.max(1, sourceStats.triangles) > 0.03,
      textureBytes: outputStats.textureBytes, bounds: outputStats.bounds,
      overBudget: outputBytes > maxBytes,
    });
  }
  const manifest = { version: 5, generatedBy: "gltf-transform@4.3.0", targets: { textureSize: 256, maxBytes }, entries };
  if (checkOnly) {
    const installed = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (JSON.stringify(installed) !== JSON.stringify(manifest)) throw new Error("Monument map manifest or assets are stale. Run npm run monuments:lod.");
  } else {
    const expected = new Set(entries.map((entry) => entry.map));
    for (const stale of readdirSync(outputDir).filter((name) => name.endsWith(".glb") && !expected.has(name))) rmSync(resolve(outputDir, stale));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const overBudget = entries.filter((entry) => entry.overBudget);
  const overTriangleTarget = entries.filter((entry) => entry.overTriangleTarget);
  const authoredCount = entries.filter((entry) => entry.mapKind === "authored-hlod").length;
  console.log(`${checkOnly ? "Validated" : "Generated"} ${entries.length} actual-geometry map proxies (${authoredCount} authored HLOD, ${entries.length - authoredCount} generated); ${overBudget.length} exceed ${maxBytes} bytes and ${overTriangleTarget.length} exceed the 3% triangle target.`);
  if (overBudget.length) console.warn(overBudget.map((entry) => `${entry.id}: ${entry.outputBytes} bytes`).join("\n"));
  if (overTriangleTarget.length) console.warn(overTriangleTarget.map((entry) => `${entry.id}: ${(entry.triangleRatio * 100).toFixed(2)}% of source triangles`).join("\n"));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
