export type MonumentPrimitiveDescriptor = {
  name?: string;
  prefab?: string;
  kind?: string;
};

export type MonumentPrimitiveKind =
  | "airfield"
  | "sphere-tank"
  | "satellite-dish"
  | "lighthouse"
  | "power-plant"
  | "substation"
  | "train-yard"
  | "military-tunnels"
  | "bunker"
  | "gas-station"
  | "supermarket"
  | "warehouse"
  | "quarry"
  | "generic";

const CANONICAL_PRIMITIVE_SIZES: Record<string, number> = {
  compound: 122,
  launch_site_1: 326,
  water_treatment_plant_1: 268,
  excavator_1: 180,
  harbor_1: 185,
  harbor_2: 185,
  junkyard_1: 132,
  bandit_town: 100,
  oilrig_1: 82,
  oilrig_2: 64,
};

export function monumentPrimitiveSearchKey(monument: MonumentPrimitiveDescriptor): string {
  return `${monument.kind || ""} ${monument.name || ""} ${monument.prefab || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
}

export function monumentPrimitiveKind(monument: MonumentPrimitiveDescriptor): MonumentPrimitiveKind {
  const key = monumentPrimitiveSearchKey(monument);

  if (key.includes("airfield")) return "airfield";
  if (key.includes("sphere")) return "sphere-tank";
  if (key.includes("satellite")) return "satellite-dish";
  if (key.includes("lighthouse")) return "lighthouse";
  if (key.includes("powerplant") || key.includes("power_plant")) return "power-plant";
  if (key.includes("substation") || key.includes("sub_station")) return "substation";
  if (key.includes("trainyard") || key.includes("train_yard")) return "train-yard";
  if (key.includes("entrance_bunker") || key.includes("train_tunnel")) return "bunker";
  if (key.includes("military") && key.includes("tunnel")) return "military-tunnels";
  if (key.includes("bunker") || key.includes("tunnel")) return "bunker";
  if (key.includes("gas_station") || key.includes("gasstation") || key.includes("oxum")) return "gas-station";
  if (key.includes("supermarket") || key.includes("market")) return "supermarket";
  if (key.includes("warehouse")) return "warehouse";
  if ((key.includes("quarry") || key.includes("mining")) && !key.includes("mining_outpost") && !key.includes("miningoutpost")) return "quarry";

  return "generic";
}

export function monumentPrimitiveSize(monument: MonumentPrimitiveDescriptor, radius: number): number {
  const id = String(monument.prefab || "").trim().replace(/\\/g, "/").split("/").pop()?.replace(/\.(?:prefab|glb)$/i, "").toLowerCase() || "";
  return CANONICAL_PRIMITIVE_SIZES[id] ?? Math.max(24, Math.min(180, radius));
}
