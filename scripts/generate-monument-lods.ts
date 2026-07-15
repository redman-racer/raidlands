import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "assets/media/models/monuments");
const outputDir = resolve(root, "assets/media/models/monuments-map");
const manifestPath = resolve(outputDir, "manifest.json");
const checkOnly = process.argv.includes("--check");
const maxBytes = 250 * 1024;

type Stats = { triangles: number; textureBytes: number; bounds: { min: number[]; max: number[] } };

async function io(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder,
    "meshopt.decoder": MeshoptDecoder,
  });
}

async function stats(path: string, reader: NodeIO): Promise<Stats> {
  const document = await reader.read(path);
  let triangles = 0;
  let textureBytes = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    const position = primitive.getAttribute("POSITION");
    triangles += Math.floor((indices?.getCount() ?? position?.getCount() ?? 0) / 3);
    const pMin = position?.getMin([]) ?? [];
    const pMax = position?.getMax([]) ?? [];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, Number(pMin[i] ?? Infinity));
      max[i] = Math.max(max[i]!, Number(pMax[i] ?? -Infinity));
    }
  }
  for (const texture of document.getRoot().listTextures()) textureBytes += texture.getImage()?.byteLength ?? 0;
  return { triangles, textureBytes, bounds: { min: min.map((v) => Number.isFinite(v) ? v : 0), max: max.map((v) => Number.isFinite(v) ? v : 0) } };
}

async function main(): Promise<void> {
  const files = readdirSync(sourceDir).filter((name) => name.endsWith(".glb")).sort();
  if (checkOnly && !existsSync(manifestPath)) throw new Error("Map LOD manifest is missing. Run npm run monuments:lod.");
  if (!checkOnly) mkdirSync(outputDir, { recursive: true });
  const reader = await io();
  const entries = [];
  for (const name of files) {
    const source = resolve(sourceDir, name);
    const output = resolve(outputDir, name);
    if (!checkOnly) {
      const result = spawnSync(process.execPath, [resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js"), "optimize", source, output,
        "--compress", "draco", "--texture-compress", "webp", "--texture-size", "256", "--simplify", "true",
        "--simplify-ratio", "0.02", "--simplify-error", "0.01", "--flatten", "true", "--join", "true", "--palette", "true"],
      { cwd: root, encoding: "utf8" });
      if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout}`);
    }
    if (!existsSync(output)) throw new Error(`${name}: generated map LOD is missing`);
    const sourceStats = await stats(source, reader);
    const outputStats = await stats(output, reader);
    const bytes = statSync(output).size;
    entries.push({
      id: basename(name, ".glb"), detail: `../monuments/${name}`, map: name,
      sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"),
      sourceBytes: statSync(source).size, outputBytes: bytes,
      sourceTriangles: sourceStats.triangles, triangles: outputStats.triangles,
      textureBytes: outputStats.textureBytes, bounds: outputStats.bounds,
      overBudget: bytes > maxBytes,
    });
  }
  const manifest = { version: 1, generatedBy: "gltf-transform@4.3.0", targets: { ratio: 0.02, textureSize: 256, maxBytes }, entries };
  if (checkOnly) {
    const installed = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (JSON.stringify(installed) !== JSON.stringify(manifest)) throw new Error("Map LOD manifest or assets are stale. Run npm run monuments:lod.");
  } else {
    for (const stale of readdirSync(outputDir).filter((name) => name.endsWith(".glb") && !files.includes(name))) rmSync(resolve(outputDir, stale));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const overBudget = entries.filter((entry) => entry.overBudget);
  console.log(`${checkOnly ? "Validated" : "Generated"} ${entries.length} map LODs; ${overBudget.length} exceed ${maxBytes} bytes.`);
  if (overBudget.length) console.warn(overBudget.map((entry) => `${entry.id}: ${entry.outputBytes} bytes`).join("\n"));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
