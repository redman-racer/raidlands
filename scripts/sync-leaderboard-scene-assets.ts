import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

type SourcePlacement = Record<string, unknown> & {
  Instance_ID: string;
  Enabled: boolean;
  Zone: string;
  Parent_Node: string;
  Role: string;
  Full_Path: string;
};

type ThemeRow = Record<string, unknown> & {
  Category: string;
  Kit_ID: string;
  Slot: string;
  Asset_Name: string;
  Full_Path: string;
  Quantity: number;
  Suggested_Zone: string;
  Placement_Rule: string;
  Active_In_Current_Scene: boolean;
};

type SceneSource = {
  schema_version: string;
  repository: { commit_sha: string; full_name: string };
  camera: Record<string, unknown>;
  scene_nodes: Array<Record<string, unknown>>;
  asset_placements: SourcePlacement[];
  lights: Array<Record<string, unknown>>;
  atmosphere_and_post: Array<Record<string, unknown>>;
  theme_swap_kits: ThemeRow[];
};

const workspace = path.resolve(import.meta.dirname, "..");
const sourceFile = path.join(workspace, "docs", "raidlands_3d_leaderboard_scene_map.json");
const rustRelayRepository = path.resolve(process.env.RUSTRELAY_REPOSITORY || path.join(workspace, "..", "RustRelay.Assets"));
const outputRoot = path.join(workspace, "assets", "media", "models", "leaderboard-scene");
const manifestFile = path.join(workspace, "assets", "data", "leaderboard-scene-manifest.json");
const checkOnly = process.argv.includes("--check");

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === "true";
}

function sourceRelativePath(fullPath: string): string {
  const normalized = fullPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/") || normalized.includes("../") || !normalized.endsWith(".glb")) {
    throw new Error(`Unsafe RustRelay asset path: ${fullPath}`);
  }
  return normalized.slice("assets/".length);
}

function compactPlacement(row: SourcePlacement) {
  return {
    id: String(row.Instance_ID),
    enabled: bool(row.Enabled),
    zone: String(row.Zone || ""),
    parent: String(row.Parent_Node || "SCENE_ROOT"),
    role: String(row.Role || ""),
    sourcePath: String(row.Full_Path),
    localPath: sourceRelativePath(String(row.Full_Path)),
    position: [number(row.Pos_X_m), number(row.Pos_Y_m), number(row.Pos_Z_m)],
    rotation: [number(row.Rot_X_deg), number(row.Rot_Y_deg), number(row.Rot_Z_deg)],
    scale: [number(row.Scale_X, 1), number(row.Scale_Y, 1), number(row.Scale_Z, 1)],
    normalizeMode: String(row.Normalize_Mode || "AABB bottom-center; preserve aspect"),
    targetExtent: number(row.Target_Extent_m, 1),
    anchor: String(row.Anchor || "Bottom-center"),
    castShadow: bool(row.Cast_Shadow),
    receiveShadow: bool(row.Receive_Shadow),
    lodClass: String(row.LOD_Class || "Secondary"),
    occlusionPriority: String(row.Occlusion_Priority || "Medium"),
    renderOrder: number(row.Render_Order),
  };
}

function themeKey(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const source = JSON.parse(await readFile(sourceFile, "utf8")) as SceneSource;
  const expectedRevision = source.repository.commit_sha;
  const actualRevision = execFileSync("git", ["-C", rustRelayRepository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actualRevision !== expectedRevision) {
    throw new Error(`RustRelay.Assets is at ${actualRevision}; expected ${expectedRevision}.`);
  }

  const allPaths = [...source.asset_placements.map((row) => row.Full_Path), ...source.theme_swap_kits.map((row) => row.Full_Path)];
  const uniquePaths = [...new Set(allPaths.map(String))].sort((left, right) => left.localeCompare(right));
  const assets = await Promise.all(uniquePaths.map(async (sourcePath) => {
    const localPath = sourceRelativePath(sourcePath);
    const input = path.join(rustRelayRepository, "assets", ...localPath.split("/"));
    const bytes = await readFile(input);
    return { sourcePath, localPath, bytes: bytes.byteLength, sha256: sha256(bytes), input };
  }));

  const activeThemePaths = new Set(source.theme_swap_kits.filter((row) => bool(row.Active_In_Current_Scene)).map((row) => row.Full_Path));
  const characterRows = source.asset_placements.filter((row) => row.Zone === "Characters");
  const baseRows = source.asset_placements.filter((row) => row.Zone !== "Characters" && !activeThemePaths.has(row.Full_Path));
  const mostKillsRows = source.asset_placements.filter((row) => row.Zone !== "Characters" && activeThemePaths.has(row.Full_Path));
  const themes: Record<string, { label: string; activeInSourceScene: boolean; placements: ReturnType<typeof compactPlacement>[]; assets: Array<Record<string, unknown>> }> = {};
  for (const row of source.theme_swap_kits) {
    const key = themeKey(row.Category);
    themes[key] ||= { label: row.Category, activeInSourceScene: false, placements: [], assets: [] };
    themes[key].activeInSourceScene ||= bool(row.Active_In_Current_Scene);
    themes[key].assets.push({
      kitId: row.Kit_ID,
      slot: row.Slot,
      name: row.Asset_Name,
      sourcePath: row.Full_Path,
      localPath: sourceRelativePath(row.Full_Path),
      quantity: number(row.Quantity, 1),
      suggestedZone: row.Suggested_Zone,
      placementRule: row.Placement_Rule,
    });
  }
  if (themes["most-kills"]) themes["most-kills"].placements = mostKillsRows.map(compactPlacement);

  const manifest = {
    version: 1,
    schemaVersion: source.schema_version,
    repository: source.repository.full_name,
    revision: expectedRevision,
    generatedFrom: "docs/raidlands_3d_leaderboard_scene_map.json",
    modelBase: "media/models/leaderboard-scene/",
    camera: source.camera,
    sceneNodes: source.scene_nodes,
    characterAnchors: characterRows.map(compactPlacement),
    basePlacements: baseRows.map(compactPlacement),
    lights: source.lights,
    atmosphereAndPost: source.atmosphere_and_post,
    themes,
    assets: assets.map(({ sourcePath, localPath, bytes, sha256: hash }) => ({ sourcePath, localPath, bytes, sha256: hash })),
  };
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  if (assets.length !== 79) throw new Error(`Expected 79 unique scene assets; found ${assets.length}.`);
  if (source.asset_placements.length !== 125 || characterRows.length !== 3 || baseRows.length + mostKillsRows.length !== 122) {
    throw new Error("Scene-map placement counts do not match the approved plan.");
  }

  if (checkOnly) {
    const existing = await readFile(manifestFile, "utf8");
    if (existing !== serialized) throw new Error("Leaderboard scene manifest is stale. Run npm run leaderboard:assets.");
    await Promise.all(assets.map(async (asset) => {
      const output = path.join(outputRoot, ...asset.localPath.split("/"));
      const outputBytes = await readFile(output);
      if (outputBytes.byteLength !== asset.bytes || sha256(outputBytes) !== asset.sha256) {
        throw new Error(`Vendored leaderboard asset is stale: ${asset.localPath}`);
      }
    }));
    process.stdout.write(`Verified ${assets.length} pinned leaderboard scene assets at ${expectedRevision}.\n`);
    return;
  }

  await Promise.all(assets.map(async (asset) => {
    const output = path.join(outputRoot, ...asset.localPath.split("/"));
    await mkdir(path.dirname(output), { recursive: true });
    let matches = false;
    try {
      const info = await stat(output);
      if (info.size === asset.bytes) matches = sha256(await readFile(output)) === asset.sha256;
    } catch { /* Copy missing outputs below. */ }
    if (!matches) await copyFile(asset.input, output);
  }));
  await mkdir(path.dirname(manifestFile), { recursive: true });
  await writeFile(manifestFile, serialized, "utf8");
  process.stdout.write(`Synchronized ${assets.length} pinned leaderboard scene assets (${source.asset_placements.length} placements).\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
