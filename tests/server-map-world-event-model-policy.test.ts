import { describe, expect, it } from "vitest";
import { mapVehicleUsesDetailedModel } from "../assets/ts/server-map-viewer/world-event-model-policy";

describe("world-event map model policy", () => {
  it("uses the Cargo Ship model only when a dedicated map LOD exists", () => {
    expect(mapVehicleUsesDetailedModel("cargo_ship")).toBe(false);
    expect(mapVehicleUsesDetailedModel("CARGO_SHIP", "/assets/media/models/world-events/cargo_ship_map.glb")).toBe(true);
  });

  it("continues to load detailed assets for the other supported vehicles", () => {
    expect(mapVehicleUsesDetailedModel("cargo_plane")).toBe(true);
    expect(mapVehicleUsesDetailedModel("bradley")).toBe(true);
  });
});
