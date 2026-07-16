import { describe, expect, it } from "vitest";
import { sampleTerrainSurfaceHeight } from "../assets/ts/server-map-viewer/terrain-height-policy";

describe("server map terrain height sampling", () => {
  const terrain = {
    resolution: 2,
    worldSize: 100,
    // Source columns are mirrored when displayed by the viewer.
    heights: [10, 20, 40, 80],
  };

  it("uses the viewer terrain mesh's reflected triangle topology", () => {
    expect(sampleTerrainSurfaceHeight(terrain, -50, 50)).toBe(20);
    expect(sampleTerrainSurfaceHeight(terrain, 25, 25)).toBeCloseTo(27.5);
    expect(sampleTerrainSurfaceHeight(terrain, 25, -25)).toBeCloseTo(42.5);
  });

  it("clamps an overlay sample to the terrain edge", () => {
    expect(sampleTerrainSurfaceHeight(terrain, 500, 500)).toBe(10);
  });
});
