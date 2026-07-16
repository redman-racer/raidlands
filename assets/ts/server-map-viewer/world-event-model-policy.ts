/**
 * Decides whether a world-event vehicle can use its full Rust GLB in the map
 * viewer. These assets share the terrain renderer's limited GPU budget.
 */
export function mapVehicleUsesDetailedModel(vehicle: string): boolean {
  // Cargo Ship is a complete explorable entity, not a map-scale asset. Its
  // dimensioned proxy is both safer and clearer at the viewer's camera range.
  return vehicle.trim().toLowerCase() !== "cargo_ship";
}
