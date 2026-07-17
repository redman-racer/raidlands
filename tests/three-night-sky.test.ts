import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { raidlandsCelestialAngleFromSunDirection } from "../assets/ts/shared/three-night-sky";

function rustSunDirection(angle: number): Vector3 {
  return new Vector3(
    -Math.cos(angle) * 0.42,
    Math.sin(angle),
    Math.sin(angle) * 0.58,
  ).normalize();
}

describe("Raidlands celestial sky motion", () => {
  it.each([
    ["sunrise", 0],
    ["noon", Math.PI / 2],
    ["sunset", Math.PI],
    ["midnight", -Math.PI / 2],
  ])("keeps the star sphere synchronized at %s", (_label, angle) => {
    expect(raidlandsCelestialAngleFromSunDirection(rustSunDirection(angle))).toBeCloseTo(angle, 6);
  });

  it("is unaffected by the length of the supplied direction", () => {
    const direction = rustSunDirection(Math.PI * 0.72);
    expect(raidlandsCelestialAngleFromSunDirection(direction.multiplyScalar(14))).toBeCloseTo(Math.PI * 0.72, 6);
  });
});
