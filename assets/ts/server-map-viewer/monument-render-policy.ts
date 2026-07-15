import { monumentPrefabId } from "./monument-model-registry";

export type MonumentRenderClass = "landmark-map" | "surface-entrance" | "shared-detail";

const LANDMARK_MAP_MODELS = new Set([
  "airfield_1", "apartments_complex_1", "bandit_town", "compound", "desert_military_base_a",
  "desert_military_base_b", "desert_military_base_c", "desert_military_base_d",
  "excavator_1", "ferry_terminal_1", "harbor_1", "harbor_2", "jungle_ziggurat_a", "junkyard_1",
  "launch_site_1", "military_tunnel_1", "nuclear_missile_silo", "oilrig_1", "oilrig_2",
  "powerplant_1", "radtown_1", "radtown_small_3", "satellite_dish", "sphere_tank", "trainyard_1",
  "water_treatment_plant_1",
]);

export function monumentRenderClass(prefab: string): MonumentRenderClass {
  const id = monumentPrefabId(prefab);
  if (id.startsWith("cave_") || id.startsWith("entrance_bunker_")) return "surface-entrance";
  if (LANDMARK_MAP_MODELS.has(id)) return "landmark-map";
  return "shared-detail";
}

export function monumentUsesMapProxyInAuto(prefab: string): boolean {
  return monumentRenderClass(prefab) !== "shared-detail";
}
