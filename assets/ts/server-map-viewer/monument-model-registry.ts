import manifestJson from "../../media/models/monuments-map/manifest.json";

export type MonumentModelManifestEntry = {
  id: string;
  detail: string;
  map: string;
  mapKind: "authored-hlod" | "generated-proxy";
  sourceNodes: string[];
  sourceSha256: string;
  outputSha256: string;
  sourceBytes: number;
  outputBytes: number;
  sourceTriangles: number;
  sourceDrawCalls: number;
  triangles: number;
  drawCalls: number;
  triangleRatio: number;
  overTriangleTarget: boolean;
  textureBytes: number;
  sourceBounds: { min: number[]; max: number[] };
  bounds: { min: number[]; max: number[] };
  overBudget: boolean;
};

const RUSTRELAY_MONUMENT_PREFABS = new Set([
  "airfield_1",
  "apartments_complex_1",
  "arctic_research_base_a",
  "bandit_town",
  "cave_large_hard",
  "cave_large_medium",
  "cave_large_sewers_hard",
  "cave_medium_easy",
  "cave_medium_hard",
  "cave_medium_medium",
  "cave_small_easy",
  "cave_small_hard",
  "cave_small_medium",
  "compound",
  "desert_military_base_a",
  "desert_military_base_b",
  "desert_military_base_c",
  "desert_military_base_d",
  "entrance_bunker_a",
  "entrance_bunker_b",
  "entrance_bunker_c",
  "entrance_bunker_d",
  "excavator_1",
  "ferry_terminal_1",
  "fishing_village_a",
  "fishing_village_b",
  "fishing_village_c",
  "gas_station_1",
  "harbor_1",
  "harbor_2",
  "ice_lake_1",
  "ice_lake_2",
  "ice_lake_3",
  "ice_lake_4",
  "jungle_ruins_a",
  "jungle_ruins_b",
  "jungle_ruins_c",
  "jungle_ruins_d",
  "jungle_ruins_e",
  "jungle_ziggurat_a",
  "junkyard_1",
  "launch_site_1",
  "lighthouse",
  "military_tunnel_1",
  "mining_quarry_a",
  "mining_quarry_b",
  "mining_quarry_c",
  "nuclear_missile_silo",
  "oilrig_1",
  "oilrig_2",
  "power_sub_big_1",
  "power_sub_big_2",
  "power_sub_small_1",
  "power_sub_small_2",
  "powerplant_1",
  "radtown_1",
  "radtown_small_3",
  "satellite_dish",
  "sphere_tank",
  "stables_a",
  "stables_b",
  "supermarket_1",
  "swamp_a",
  "swamp_b",
  "swamp_c",
  "trainyard_1",
  "ue_jungle_swamp_a",
  "underwater_lab_a",
  "underwater_lab_b",
  "underwater_lab_c",
  "underwater_lab_d",
  "warehouse",
  "water_treatment_plant_1",
  "water_well_a",
  "water_well_b",
  "water_well_c",
  "water_well_d",
  "water_well_e",
]);

const manifest = manifestJson as { version: number; targets: { maxBytes: number }; entries: MonumentModelManifestEntry[] };
const manifestById = new Map(manifest.entries.map((entry) => [entry.id, entry]));

export function monumentPrefabId(prefab: string): string {
  const normalized = prefab.trim().replace(/\\/g, "/").split("/").pop() || "";
  return normalized.replace(/\.prefab$/i, "").replace(/\.glb$/i, "").toLowerCase();
}

export function monumentModelAssetName(prefab: string): string | null {
  const id = monumentPrefabId(prefab);
  return RUSTRELAY_MONUMENT_PREFABS.has(id) ? `${id}.glb` : null;
}

export function monumentModelMetadata(prefab: string): MonumentModelManifestEntry | null {
  return manifestById.get(monumentPrefabId(prefab)) || null;
}

export function monumentModelManifestVersion(): number {
  return manifest.version;
}

export function monumentModelBudgetBytes(): number {
  return manifest.targets.maxBytes;
}

export function monumentModelCount(): number {
  return RUSTRELAY_MONUMENT_PREFABS.size;
}

export function monumentModelAssetNames(): string[] {
  return Array.from(RUSTRELAY_MONUMENT_PREFABS, (id) => `${id}.glb`).sort();
}
