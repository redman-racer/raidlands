import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Document, NodeIO, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { copyToDocument, getBounds } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "assets/media/models/monuments");
const outputDir = resolve(root, "assets/media/models/monuments-map");
const manifestPath = resolve(outputDir, "manifest.json");
const checkOnly = process.argv.includes("--check");
const maxBytes = 250 * 1024;

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
  const root = document.getRoot();
  const bounds = getBounds(root.getDefaultScene() || root.listScenes()[0]!);
  let triangleCount = 0;
  for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
    triangleCount += Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3);
  }
  return {
    triangles: triangleCount,
    drawCalls: root.listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0),
    textureBytes: root.listTextures().reduce((sum, texture) => sum + (texture.getImage()?.byteLength ?? 0), 0),
    bounds: { min: Array.from(bounds.min), max: Array.from(bounds.max) },
  };
}

function hlodNodes(document: Document): Node[] {
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh() && (
    /(?:^|[_\-.])hlod(?:[_\-.]|$)/i.test(node.getName())
    || /(?:^|[_\-.])hlod(?:[_\-.]|$)/i.test(node.getMesh()!.getName())
  ));
  // Some exports contain a named HLOD parent and its mesh child. Keep only the
  // highest HLOD roots so copyToDocument carries each descendant exactly once.
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

async function main(): Promise<void> {
  const files = readdirSync(sourceDir).filter((name) => name.endsWith(".glb")).sort();
  if (checkOnly && !existsSync(manifestPath)) throw new Error("HLOD manifest is missing. Run npm run monuments:lod.");
  mkdirSync(outputDir, { recursive: true });
  const reader = await io();
  const entries = [];
  for (const name of files) {
    const sourcePath = resolve(sourceDir, name);
    const sourceDocument = await reader.read(sourcePath);
    const sourceStats = documentStats(sourceDocument);
    const candidates = hlodNodes(sourceDocument);
    const id = basename(name, ".glb");
    let outputBytes = 0;
    let outputStats: Stats | null = null;
    let map: string | null = null;
    let sourceNodes: string[] = [];
    if (candidates.length) {
      map = name;
      sourceNodes = candidates.map((node) => node.getName());
      const outputPath = resolve(outputDir, name);
      if (!checkOnly) {
        const extractedPath = resolve(outputDir, `.${id}.extracted.glb`);
        await reader.write(extractedPath, extractHlod(sourceDocument, candidates));
        const result = spawnSync(process.execPath, [resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js"), "optimize", extractedPath, outputPath,
          "--compress", "draco", "--texture-compress", "webp", "--texture-size", "256", "--simplify", "false",
          "--flatten", "true", "--join", "true", "--palette", "false"], { cwd: root, encoding: "utf8" });
        rmSync(extractedPath, { force: true });
        if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout}`);
      }
      if (!existsSync(outputPath)) throw new Error(`${name}: extracted HLOD is missing`);
      outputBytes = statSync(outputPath).size;
      outputStats = documentStats(await reader.read(outputPath));
    }
    entries.push({
      id, detail: `../monuments/${name}`, map, mapKind: map ? "authored-hlod" : "procedural",
      sourceNodes, sourceSha256: createHash("sha256").update(readFileSync(sourcePath)).digest("hex"),
      sourceBytes: statSync(sourcePath).size, outputBytes,
      sourceTriangles: sourceStats.triangles, sourceDrawCalls: sourceStats.drawCalls,
      triangles: outputStats?.triangles ?? 0, drawCalls: outputStats?.drawCalls ?? 0,
      triangleRatio: outputStats ? Number((outputStats.triangles / Math.max(1, sourceStats.triangles)).toFixed(6)) : 0,
      overTriangleTarget: Boolean(outputStats && outputStats.triangles / Math.max(1, sourceStats.triangles) > 0.03),
      textureBytes: outputStats?.textureBytes ?? 0, bounds: outputStats?.bounds ?? sourceStats.bounds,
      overBudget: outputBytes > maxBytes,
    });
  }
  const manifest = { version: 3, generatedBy: "gltf-transform@4.3.0", targets: { textureSize: 256, maxBytes }, entries };
  if (checkOnly) {
    const installed = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (JSON.stringify(installed) !== JSON.stringify(manifest)) throw new Error("HLOD manifest or assets are stale. Run npm run monuments:lod.");
  } else {
    const expected = new Set(entries.flatMap((entry) => entry.map ? [entry.map] : []));
    for (const stale of readdirSync(outputDir).filter((name) => name.endsWith(".glb") && !expected.has(name))) rmSync(resolve(outputDir, stale));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const generated = entries.filter((entry) => entry.map);
  const overBudget = generated.filter((entry) => entry.overBudget);
  const overTriangleTarget = generated.filter((entry) => entry.overTriangleTarget);
  console.log(`${checkOnly ? "Validated" : "Generated"} ${generated.length} authored HLOD proxies; ${overBudget.length} exceed ${maxBytes} bytes and ${overTriangleTarget.length} exceed the 3% triangle target.`);
  if (overBudget.length) console.warn(overBudget.map((entry) => `${entry.id}: ${entry.outputBytes} bytes`).join("\n"));
  if (overTriangleTarget.length) console.warn(overTriangleTarget.map((entry) => `${entry.id}: ${(entry.triangleRatio * 100).toFixed(2)}% of source triangles`).join("\n"));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
