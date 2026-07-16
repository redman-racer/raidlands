import { describe, expect, it } from "vitest";
import { buildTerrainVegetation, type TerrainVegetationInput } from "../assets/ts/server-map-viewer/vegetation-policy";

function terrain(resolution = 17): TerrainVegetationInput {
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
    input.colors!.fill("#2f6f86");
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

  it("assigns deterministic biome-specific tree families", () => {
    const arid = terrain();
    arid.surfaceColors = Array.from({ length: arid.resolution * arid.resolution }, () => "#c0a070");
    const aridPlacements = buildTerrainVegetation(arid, 80);
    expect(aridPlacements.length).toBeGreaterThan(0);
    expect(new Set(aridPlacements.map((placement) => placement.biome))).toEqual(new Set(["arid"]));

    const arctic = terrain();
    arctic.surfaceColors = Array.from({ length: arctic.resolution * arctic.resolution }, () => "#dce8e8");
    const arcticPlacements = buildTerrainVegetation(arctic, 80);
    expect(arcticPlacements.length).toBeGreaterThan(0);
    expect(new Set(arcticPlacements.map((placement) => placement.biome))).toEqual(new Set(["arctic"]));
  });

  it("keeps deserts sparse and does not mistake lush jungle for swamp", () => {
    const arid = terrain(33);
    arid.surfaceColors = Array.from({ length: arid.resolution * arid.resolution }, () => "#c0a070");
    const jungle = terrain(33);
    jungle.surfaceColors = Array.from({ length: jungle.resolution * jungle.resolution }, () => "#426b2d");
    const aridPlacements = buildTerrainVegetation(arid, 300);
    const junglePlacements = buildTerrainVegetation(jungle, 300);

    expect(aridPlacements.length).toBeLessThan(junglePlacements.length / 4);
    expect(junglePlacements.some((placement) => placement.biome === "jungle")).toBe(true);
    expect(junglePlacements.some((placement) => placement.biome === "swamp")).toBe(false);
  });
});
