import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { MONUMENT_LOD_RECIPES, RUSTRELAY_SOURCE } from "./monument-lod-recipes";

const root = resolve(import.meta.dirname, "..");
const assetsRoot = resolve(process.env.RUSTRELAY_ASSETS_ROOT || resolve(root, "..", "RustRelay.Assets", "assets"));
const repositoryRoot = resolve(assetsRoot, "..");
const outputPath = resolve(root, "data/rustrelay-asset-catalog.json");
const checkOnly = process.argv.includes("--check");

function listGlbs(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listGlbs(path) : entry.isFile() && entry.name.toLowerCase().endsWith(".glb") ? [path] : [];
  });
}

if (!existsSync(assetsRoot)) throw new Error(`RustRelay assets root is unavailable: ${assetsRoot}`);
const revisionResult = spawnSync("git", ["-C", repositoryRoot, "rev-parse", "--short=7", "HEAD"], { encoding: "utf8" });
if (revisionResult.status !== 0) throw new Error(revisionResult.stderr || "Unable to read the RustRelay revision.");
const revision = revisionResult.stdout.trim();
if (revision !== RUSTRELAY_SOURCE.revision) {
  throw new Error(`RustRelay is at ${revision}; recipes are approved against ${RUSTRELAY_SOURCE.revision}. Re-audit before updating the catalog.`);
}

const assets = listGlbs(assetsRoot).map((path) => ({
  path: relative(assetsRoot, path).replace(/\\/g, "/"),
  basename: basename(path, ".glb").toLowerCase(),
  bytes: statSync(path).size,
})).sort((a, b) => a.path.localeCompare(b.path));
const byBasename = new Map<string, number>();
for (const asset of assets) byBasename.set(asset.basename, (byBasename.get(asset.basename) || 0) + 1);
const referenced = new Set(MONUMENT_LOD_RECIPES.flatMap((recipe) => [
  recipe.layoutSource,
  ...(recipe.composites || []).map((composite) => composite.rustRelayPath),
]));
const missingReferences = [...referenced].filter((path) => !assets.some((asset) => asset.path.toLowerCase() === path.toLowerCase()));
if (missingReferences.length) throw new Error(`Missing recipe sources:\n${missingReferences.join("\n")}`);

const catalog = {
  version: 1,
  repository: RUSTRELAY_SOURCE.repository,
  revision,
  assetCount: assets.length,
  referencedAssetCount: referenced.size,
  duplicateBasenames: [...byBasename.entries()].filter(([, count]) => count > 1).length,
  assets: assets.map((asset) => ({ ...asset, ambiguousBasename: (byBasename.get(asset.basename) || 0) > 1 })),
};
const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== serialized) throw new Error("RustRelay asset catalog is stale. Run npm run monuments:catalog.");
} else {
  writeFileSync(outputPath, serialized);
}
console.log(`${checkOnly ? "Validated" : "Indexed"} ${assets.length} RustRelay GLBs at ${revision}; ${referenced.size} are directly referenced by monument recipes.`);
