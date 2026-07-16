import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { getBounds } from "@gltf-transform/functions";
import { TREE_LOD_RECIPES, TREE_LOD_RECIPE_VERSION, TREE_LOD_SOURCE, type TreeLodTier } from "./tree-lod-recipes";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "assets/media/models/trees-lod");
const rustRelayRoot = resolve(process.env.RUSTRELAY_ASSETS_ROOT || resolve(root, "..", "RustRelay.Assets", "assets"));
const cli = resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js");
const checkOnly = process.argv.includes("--check");
const onlyRecipe = process.argv.find((value) => value.startsWith("--only="))?.slice(7);

const TIER_SETTINGS: Record<TreeLodTier, { ratio: number; error: number; textureSize: number }> = {
  map: { ratio: 0.14, error: 0.035, textureSize: 128 },
  mid: { ratio: 0.42, error: 0.012, textureSize: 256 },
  close: { ratio: 0.88, error: 0.003, textureSize: 512 },
};

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function io(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder,
    "draco3d.encoder": encoder,
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
}

async function stats(reader: NodeIO, path: string) {
  const document = await reader.read(path);
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${path}: no scene`);
  let triangles = 0;
  let drawCalls = 0;
  scene.traverse((node) => {
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      drawCalls += 1;
      triangles += Math.floor((primitive.getIndices()?.getCount() || primitive.getAttribute("POSITION")?.getCount() || 0) / 3);
    }
  });
  const bounds = getBounds(scene);
  return { triangles, drawCalls, bounds: { min: bounds.min, max: bounds.max } };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const reader = await io();
  const entries = [];

  for (const recipe of TREE_LOD_RECIPES) {
    if (onlyRecipe && recipe.id !== onlyRecipe) continue;
    const sourcePath = resolve(rustRelayRoot, recipe.source);
    if (!existsSync(sourcePath)) throw new Error(`${recipe.id}: missing RustRelay source ${recipe.source}`);
    const tiers = {} as Record<TreeLodTier, unknown>;

    for (const tier of ["map", "mid", "close"] as TreeLodTier[]) {
      const settings = TIER_SETTINGS[tier];
      const file = `${recipe.id}-${tier}.glb`;
      const outputPath = resolve(outputDir, file);
      if (!checkOnly) {
        rmSync(outputPath, { force: true });
        const result = spawnSync(process.execPath, [
          cli, "optimize", sourcePath, outputPath,
          "--compress", "draco",
          "--simplify", "true",
          "--simplify-ratio", String(settings.ratio),
          "--simplify-error", String(settings.error),
          "--simplify-lock-border", tier === "close" ? "true" : "false",
          "--texture-compress", "webp",
          "--texture-size", String(settings.textureSize),
          "--palette", "false",
          "--instance", "false",
        ], { cwd: root, encoding: "utf8" });
        if (result.status !== 0) throw new Error(`${recipe.id} ${tier}: ${result.stderr || result.stdout}`);
      }
      if (!existsSync(outputPath)) throw new Error(`${recipe.id}: missing generated ${tier} asset`);
      tiers[tier] = {
        file,
        url: `media/models/trees-lod/${file}`,
        bytes: statSync(outputPath).size,
        sha256: sha256(outputPath),
        ...(await stats(reader, outputPath)),
      };
    }

    entries.push({
      ...recipe,
      sourceSha256: sha256(sourcePath),
      sourceBytes: statSync(sourcePath).size,
      tiers,
    });
  }

  const manifestPath = resolve(outputDir, "manifest.json");
  const manifest = {
    version: 1,
    recipeVersion: TREE_LOD_RECIPE_VERSION,
    sourceRepository: TREE_LOD_SOURCE,
    thresholds: { mapToMidDistance: 650, midToCloseDistance: 180, hysteresis: 0.18 },
    entries,
  };
  if (checkOnly) {
    if (!existsSync(manifestPath)) throw new Error("Tree LOD manifest is missing.");
    const current = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (JSON.stringify(current) !== JSON.stringify(manifest)) throw new Error("Tree LOD manifest or generated assets are stale.");
  } else {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`${checkOnly ? "Validated" : "Generated"} ${entries.length} tree families.`);
}

await main();
