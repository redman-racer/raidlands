/**
 * Decides whether a world-event vehicle can use a GLB in the map viewer.
 * Complete explorable entities require a dedicated map LOD.
 */
export function mapVehicleUsesDetailedModel(vehicle: string, mapModelUrl?: string): boolean {
  if (vehicle.trim().toLowerCase() !== "cargo_ship") return true;
  return String(mapModelUrl || "").trim() !== "";
}
