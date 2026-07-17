import { mkdirSync, rmSync, renameSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Document, NodeIO, type Mesh, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { copyToDocument, dedup, flatten, join, normals, prune, simplifyPrimitive, unpartition, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = resolve(import.meta.dirname, "..");
const modelDir = resolve(root, "assets/media/models/world-events");
const sourcePath = resolve(modelDir, "cargo_ship.glb");
const outputPath = resolve(modelDir, "cargo_ship_map.glb");
const stagedPath = resolve(modelDir, ".cargo_ship_map.staged.glb");
const optimizedPath = resolve(modelDir, ".cargo_ship_map.optimized.glb");
const cliPath = resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js");

// The source is the complete explorable entity. Only silhouette-defining
// exterior parts belong in a whole-map scene.
const EXTERIOR_MESHES = new Set([
  "cargo_ship_hull_LOD0",
  "cargo_ship_deck_LOD0",
  "cargo_ship_deck_railings_LOD0",
  "cargo_ship_mast_LOD0",
  "cargo_ship_anchor_conveyor_LOD0",
  "cargo_ship_crew_building_LOD0",
  "cargo_ship_crew_building_d_LOD0",
  "cargo_ship_crew_building_w_LOD0",
  "cargo_ship_antena_LOD0",
  "cargo_ship_smoke_stack_LOD0",
  "cargp_ship_fin_LOD0",
  "cargo_ship_turbine_LOD0",
  "cargo_ship_lifeboat_arm_LOD0",
]);

async function createIo(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder,
    "draco3d.encoder": encoder,
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
}

function triangleCount(document: Document): number {
  return document.getRoot().listMeshes().reduce((total, mesh) => total + mesh.listPrimitives().reduce((meshTotal, primitive) => {
    const elements = primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0;
    return meshTotal + (primitive.getMode() === 4 ? Math.floor(elements / 3) : 0);
  }, 0), 0);
}

function drawCallCount(document: Document): number {
  return document.getRoot().listMeshes().reduce((total, mesh) => total + mesh.listPrimitives().length, 0);
}

function selectExteriorNodes(source: Document): Node[] {
  return source.getRoot().listNodes().filter((node) => {
    const meshName = node.getMesh()?.getName() || "";
    return Boolean(node.getMesh() && EXTERIOR_MESHES.has(meshName));
  });
}

function copyExterior(source: Document, selected: Node[]): Document {
  const target = new Document();
  const scene = target.createScene("cargo-ship-map-lod");
  const sourceMeshes = Array.from(new Set(selected.map((node) => node.getMesh()).filter((mesh): mesh is Mesh => Boolean(mesh))));
  const copied = copyToDocument(target, source, sourceMeshes);

  for (const sourceNode of selected) {
    const sourceMesh = sourceNode.getMesh();
    const mesh = sourceMesh ? copied.get(sourceMesh) as Mesh | undefined : undefined;
    if (!mesh) continue;
    scene.addChild(target.createNode(sourceNode.getName() || sourceMesh?.getName() || "cargo-ship-exterior")
      .setMesh(mesh)
      .setMatrix(sourceNode.getWorldMatrix()));
  }
  target.getRoot().setDefaultScene(scene);
  return target;
}

function stripSecondaryMaterialChannels(document: Document): void {
  for (const material of document.getRoot().listMaterials()) {
    material
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null)
      .setMetallicRoughnessTexture(null)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.92)
      .setEmissiveFactor([0, 0, 0]);
  }
}

async function simplifyExterior(document: Document, targetTriangles = 20_000): Promise<void> {
  await document.transform(weld({ overwrite: true }), prune());
  const ratio = Math.min(1, targetTriangles / Math.max(1, triangleCount(document)));
  if (ratio < 0.995) {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) continue;
        const triangles = Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3);
        if (triangles < 24) continue;
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: Math.max(ratio, Math.min(1, 12 / Math.max(1, triangles))),
          error: 0.012,
          lockBorder: true,
        });
      }
    }
  }
  await document.transform(normals({ overwrite: true }), dedup(), flatten(), join({ keepNamed: false }), prune(), unpartition());
}

async function main(): Promise<void> {
  mkdirSync(modelDir, { recursive: true });
  const reader = await createIo();
  const source = await reader.read(sourcePath);
  const selected = selectExteriorNodes(source);
  if (selected.length !== EXTERIOR_MESHES.size) {
    const found = new Set(selected.map((node) => node.getMesh()?.getName() || ""));
    const missing = [...EXTERIOR_MESHES].filter((name) => !found.has(name));
    throw new Error(`Cargo Ship source changed; missing exterior meshes: ${missing.join(", ")}`);
  }

  const document = copyExterior(source, selected);
  stripSecondaryMaterialChannels(document);
  await simplifyExterior(document);
  rmSync(stagedPath, { force: true });
  rmSync(optimizedPath, { force: true });
  await reader.write(stagedPath, document);

  const result = spawnSync(process.execPath, [
    cliPath,
    "optimize",
    stagedPath,
    optimizedPath,
    "--compress", "draco",
    "--simplify", "false",
    "--flatten", "true",
    "--join", "true",
    "--palette", "false",
    "--texture-compress", "webp",
    "--texture-size", "256",
  ], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);

  rmSync(outputPath, { force: true });
  renameSync(optimizedPath, outputPath);
  rmSync(stagedPath, { force: true });

  const output = await reader.read(outputPath);
  const stats = {
    file: "cargo_ship_map.glb",
    bytes: statSync(outputPath).size,
    triangles: triangleCount(output),
    drawCalls: drawCallCount(output),
    sourceExteriorMeshes: selected.length,
  };
  if (stats.triangles > 30_000 || stats.drawCalls > 32 || stats.bytes > 1_000_000) {
    throw new Error(`Cargo Ship map LOD exceeds its render budget: ${JSON.stringify(stats)}`);
  }
  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

await main();
