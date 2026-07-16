import { describe, expect, it } from "vitest";
import { mapVehicleUsesDetailedModel } from "../assets/ts/server-map-viewer/world-event-model-policy";

describe("world-event map model policy", () => {
  it("keeps the Cargo Ship on its lightweight map proxy", () => {
    expect(mapVehicleUsesDetailedModel("cargo_ship")).toBe(false);
    expect(mapVehicleUsesDetailedModel("CARGO_SHIP")).toBe(false);
  });

  it("continues to load detailed assets for the other supported vehicles", () => {
    expect(mapVehicleUsesDetailedModel("cargo_plane")).toBe(true);
    expect(mapVehicleUsesDetailedModel("bradley")).toBe(true);
  });
});
