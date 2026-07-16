import { describe, expect, it } from "vitest";
import { buildTerrainVegetation } from "../assets/ts/server-map-viewer/vegetation-policy";

function terrain(resolution = 17) {
  return {
    resolution,
    worldSize: 1200,
    seed: 1247720238,
    waterLevel: 0,
    minHeight: 8,
    maxHeight: 14,
    heights: Array.from({ length: resolution * resolution }, () => 10),
    colors: Array.from({ length: resolution * resolution }, () => "#586d49"),
  };
}

describe("server map terrain vegetation policy", () => {
  it("is deterministic for the published wipe seed", () => {
    const input = terrain();
    expect(buildTerrainVegetation(input, 80)).toEqual(buildTerrainVegetation(input, 80));
  });

  it("does not place a canopy on water or blue terrain", () => {
    const input = terrain();
    input.heights.fill(-4);
    input.colors.fill("#2f6f86");
    expect(buildTerrainVegetation(input, 80)).toEqual([]);
  });

  it("keeps tree clusters outside published monument footprints", () => {
    const input = terrain();
    const placements = buildTerrainVegetation({
      ...input,
      monuments: [{ x: 0, z: 0, radius: 180 }],
    }, 80);

    expect(placements.length).toBeGreaterThan(0);
    placements.forEach((placement) => {
      expect(Math.hypot(placement.x, placement.z)).toBeGreaterThanOrEqual(270);
    });
  });
});
