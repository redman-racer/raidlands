import { describe, expect, it } from "vitest";
import {
  cameraHeightAboveTerrain,
  clampMapCoordinate,
  clampMapCoordinateToBounds,
  parseCameraPreferences,
  resolveCameraBounds,
  shouldResumeAutomaticCamera,
  transitionNeedsSafeWaypoint,
} from "../assets/ts/server-map-viewer/camera-policy";

describe("server map camera policy", () => {
  it("parses stored preferences defensively", () => {
    expect(parseCameraPreferences('{"mode":"action","manualStyle":"fly","browserFill":true,"terrainFingerprint":"wipe-1"}'))
      .toEqual({ mode: "action", manualStyle: "fly", browserFill: false, terrainFingerprint: "wipe-1" });
    expect(parseCameraPreferences("broken").mode).toBe("director");
    expect(parseCameraPreferences('{"mode":"unknown"}').mode).toBe("director");
  });

  it("clamps flight to map bounds and above terrain", () => {
    expect(clampMapCoordinate(2600, 4500, 20)).toBe(2230);
    expect(clampMapCoordinate(-2600, 4500, 20)).toBe(-2230);
    expect(cameraHeightAboveTerrain(90, 100, 12)).toBe(112);
  });

  it("extends camera bounds to real offshore monuments without accepting remote junk", () => {
    const bounds = resolveCameraBounds(3500, [
      { x: 2062.429, z: -777.818, radius: 50 },
      { x: 99000, z: 0, radius: 50 },
    ]);

    expect(bounds).toEqual({ minX: -1750, maxX: 2304.929, minZ: -1750, maxZ: 1750 });
    expect(clampMapCoordinateToBounds(2600, bounds.minX, bounds.maxX, 2)).toBe(2302.929);
    expect(clampMapCoordinateToBounds(-2600, bounds.minX, bounds.maxX, 2)).toBe(-1748);
  });

  it("resumes automatic modes only after the pause deadline", () => {
    expect(shouldResumeAutomaticCamera(7999, 8000)).toBe(false);
    expect(shouldResumeAutomaticCamera(8000, 8000)).toBe(true);
  });

  it("detects terrain-crossing camera transitions", () => {
    const ridge = (x: number) => Math.abs(x) < 10 ? 100 : 0;
    expect(transitionNeedsSafeWaypoint({ x: -100, y: 50, z: 0 }, { x: 100, y: 50, z: 0 }, ridge, 12)).toBe(true);
    expect(transitionNeedsSafeWaypoint({ x: -100, y: 150, z: 0 }, { x: 100, y: 150, z: 0 }, ridge, 12)).toBe(false);
  });
});
