import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  extrapolateRaidlandsSunDirection,
  raidlandsSunMotionBetween,
} from "../assets/ts/shared/three-sun-motion";

describe("Raidlands live sun motion", () => {
  it("continues along the measured Rust trajectory between snapshots", () => {
    const first = new Vector3(1, 0, 0);
    const second = new Vector3(Math.cos(0.1), Math.sin(0.1), 0);
    const motion = raidlandsSunMotionBetween(first, 1_000, second, 11_000);
    const continued = extrapolateRaidlandsSunDirection(second, motion, 5_000);

    expect(continued.x).toBeCloseTo(Math.cos(0.15), 5);
    expect(continued.y).toBeCloseTo(Math.sin(0.15), 5);
  });

  it("does not invent motion from duplicate or invalid samples", () => {
    const direction = new Vector3(0.2, 0.9, 0.3).normalize();
    expect(raidlandsSunMotionBetween(direction, 1_000, direction, 31_000)).toBeNull();
    expect(raidlandsSunMotionBetween(direction, 31_000, new Vector3(0.3, 0.8, 0.4).normalize(), 31_000)).toBeNull();
    expect(extrapolateRaidlandsSunDirection(direction, null, 30_000).angleTo(direction)).toBeCloseTo(0);
  });

  it("caps extrapolation when fresh Rust samples stop arriving", () => {
    const first = new Vector3(1, 0, 0);
    const second = new Vector3(Math.cos(0.1), Math.sin(0.1), 0);
    const motion = raidlandsSunMotionBetween(first, 1_000, second, 11_000);
    const capped = extrapolateRaidlandsSunDirection(second, motion, 120_000, 45_000);

    expect(capped.x).toBeCloseTo(Math.cos(0.55), 5);
    expect(capped.y).toBeCloseTo(Math.sin(0.55), 5);
  });
});
