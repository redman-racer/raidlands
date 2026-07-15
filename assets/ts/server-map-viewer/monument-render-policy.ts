import { monumentPrefabId } from "./monument-model-registry";

export type MonumentRenderClass = "landmark-map" | "surface-entrance" | "shared-detail";

const LANDMARK_MAP_MODELS = new Set([
  "airfield_1", "apartments_complex_1", "bandit_town", "compound",
  "excavator_1", "ferry_terminal_1", "harbor_1", "harbor_2", "jungle_ziggurat_a", "junkyard_1",
  "launch_site_1", "military_tunnel_1", "nuclear_missile_silo", "oilrig_1", "oilrig_2",
  "powerplant_1", "radtown_1", "radtown_small_3", "satellite_dish", "sphere_tank", "trainyard_1",
  "water_treatment_plant_1",
]);

export function monumentRenderClass(prefab: string): MonumentRenderClass {
  const id = monumentPrefabId(prefab);
  if (id.startsWith("cave_") || id.startsWith("entrance_bunker_")) return "surface-entrance";
  // Abandoned Military Base needs the same proximity promotion used by barns:
  // keep its compact proxy at map distance, then reveal the authored compound
  // and animation-ready MLRS as the camera approaches.
  if (id.startsWith("desert_military_base_")) return "shared-detail";
  if (LANDMARK_MAP_MODELS.has(id)) return "landmark-map";
  return "shared-detail";
}

export function monumentUsesMapProxyInAuto(prefab: string): boolean {
  return monumentRenderClass(prefab) !== "shared-detail";
}
