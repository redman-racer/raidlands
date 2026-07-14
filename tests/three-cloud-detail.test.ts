import { describe, expect, it } from "vitest";
import {
  normalizeRaidlandsCloudCoverage,
  parseRaidlandsCloudDetail,
  raidlandsCloudCoverageThreshold,
  raidlandsCloudProfile,
} from "../assets/ts/shared/three-cloud-detail";

describe("Raidlands cloud detail profiles", () => {
  it("parses supported values and uses the caller-selected fallback", () => {
    expect(parseRaidlandsCloudDetail("low", "max")).toBe("low");
    expect(parseRaidlandsCloudDetail("medium", "max")).toBe("medium");
    expect(parseRaidlandsCloudDetail("max", "low")).toBe("max");
    expect(parseRaidlandsCloudDetail("ultra", "max")).toBe("max");
    expect(parseRaidlandsCloudDetail(undefined, "low")).toBe("low");
  });

  it("keeps the legacy sprites exclusive to low detail", () => {
    expect(raidlandsCloudProfile("low")).toMatchObject({
      viewSamples: 0,
      lightSamples: 0,
      shadowOctaves: 0,
      useVolumetricClouds: false,
      useSpriteClouds: true,
    });
    expect(raidlandsCloudProfile("medium")).toMatchObject({
      viewSamples: 32,
      lightSamples: 2,
      shadowOctaves: 2,
      useVolumetricClouds: true,
      useSpriteClouds: false,
    });
    expect(raidlandsCloudProfile("max")).toMatchObject({
      viewSamples: 56,
      lightSamples: 4,
      shadowOctaves: 4,
      useVolumetricClouds: true,
      useSpriteClouds: false,
    });
  });
});

describe("Raidlands literal cloud coverage mapping", () => {
  it.each([
    [0, 0],
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
    [1, 1],
  ])("preserves %s as a sky fraction", (input, expected) => {
    expect(normalizeRaidlandsCloudCoverage(input)).toBe(expected);
  });

  it("clamps invalid and out-of-range weather values without adding coverage", () => {
    expect(normalizeRaidlandsCloudCoverage(null)).toBe(0);
    expect(normalizeRaidlandsCloudCoverage(undefined)).toBe(0);
    expect(normalizeRaidlandsCloudCoverage(Number.NaN)).toBe(0);
    expect(normalizeRaidlandsCloudCoverage(-0.4)).toBe(0);
    expect(normalizeRaidlandsCloudCoverage(1.4)).toBe(1);
  });

  it("lowers only the density threshold as coverage increases", () => {
    const thresholds = [0, 0.25, 0.5, 0.75, 1].map(raidlandsCloudCoverageThreshold);
    expect(thresholds).toEqual([...thresholds].sort((left, right) => right - left));
    expect(thresholds[0]).toBeCloseTo(0.82);
    expect(thresholds[4]).toBeCloseTo(0.27);
  });
});
