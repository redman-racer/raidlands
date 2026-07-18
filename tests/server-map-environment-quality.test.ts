import { describe, expect, it } from "vitest";
import {
  adaptiveEnvironmentQuality,
  adaptivePerformanceTiming,
  defaultEnvironmentQuality,
  parseEnvironmentQuality,
  preferredEnvironmentQuality,
  resolveEnvironmentQuality,
  stepAdaptivePerformanceTier,
} from "../assets/ts/server-map-viewer/environment-quality";
import type { FogCapabilities } from "../assets/ts/server-map-viewer/fog-detail";

const ultraCapabilities: FogCapabilities = {
  webgl2: true,
  depthTexture: true,
  floatTexture: true,
  highPrecisionFragment: true,
};

describe("server map environment quality", () => {
  it("defaults unknown values to ultra", () => {
    expect(parseEnvironmentQuality(undefined)).toBe("ultra");
    expect(parseEnvironmentQuality("unknown")).toBe("ultra");
    expect(parseEnvironmentQuality(" HIGH ")).toBe("high");
  });

  it("keeps ultra on a fully capable renderer", () => {
    expect(resolveEnvironmentQuality("ultra", ultraCapabilities)).toMatchObject({
      requested: "ultra",
      resolved: "ultra",
      cloudDetail: "max",
      fogDetail: "max",
      stableAntialiasing: true,
      bloom: true,
    });
  });

  it("retains aerial fog progressively longer at higher detail levels", () => {
    const ultra = resolveEnvironmentQuality("ultra", ultraCapabilities);
    const high = resolveEnvironmentQuality("high", ultraCapabilities);
    const medium = resolveEnvironmentQuality("medium", ultraCapabilities);
    const low = resolveEnvironmentQuality("low", ultraCapabilities);

    expect(ultra.fogAltitudeDensityFloor).toBeGreaterThanOrEqual(0.95);
    expect(low.fogAltitudeFadeEnd).toBeLessThan(medium.fogAltitudeFadeEnd);
    expect(medium.fogAltitudeFadeEnd).toBeLessThan(high.fogAltitudeFadeEnd);
    expect(high.fogAltitudeFadeEnd).toBeLessThan(ultra.fogAltitudeFadeEnd);
    expect(low.fogAltitudeDensityFloor).toBeLessThan(medium.fogAltitudeDensityFloor);
    expect(medium.fogAltitudeDensityFloor).toBeLessThan(high.fogAltitudeDensityFloor);
    expect(high.fogAltitudeDensityFloor).toBeLessThan(ultra.fogAltitudeDensityFloor);
    expect(low.pixelRatioCap).toBe(1);
    expect(low.composerPixelRatioCap).toBe(0.75);
  });

  it("degrades effects while preserving the requested quality", () => {
    expect(resolveEnvironmentQuality("ultra", {
      ...ultraCapabilities,
      webgl2: false,
    })).toMatchObject({
      requested: "ultra",
      resolved: "high",
      stableAntialiasing: true,
    });

    expect(resolveEnvironmentQuality("ultra", {
      webgl2: false,
      depthTexture: false,
      floatTexture: false,
      highPrecisionFragment: false,
    })).toMatchObject({
      requested: "ultra",
      resolved: "low",
      cloudDetail: "low",
      fogDetail: "low",
    });
  });

  it("defaults first-time phones to medium and other devices to ultra", () => {
    expect(defaultEnvironmentQuality(true, 390)).toBe("medium");
    expect(defaultEnvironmentQuality(false, 390)).toBe("ultra");
    expect(defaultEnvironmentQuality(true, 1024)).toBe("ultra");
  });

  it("prefers a saved detail level over device and markup defaults", () => {
    expect(preferredEnvironmentQuality("low", "ultra", false, 1440)).toBe("low");
    expect(preferredEnvironmentQuality(null, "ultra", true, 390)).toBe("medium");
    expect(preferredEnvironmentQuality(null, "high", false, 1440)).toBe("high");
  });

  it("keeps requested quality as a ceiling while adapting to measured FPS", () => {
    expect(adaptiveEnvironmentQuality("ultra", "healthy")).toBe("ultra");
    expect(adaptiveEnvironmentQuality("ultra", "constrained")).toBe("medium");
    expect(adaptiveEnvironmentQuality("ultra", "low")).toBe("low");
    expect(adaptiveEnvironmentQuality("high", "constrained")).toBe("medium");
    expect(adaptiveEnvironmentQuality("high", "low")).toBe("low");
    expect(adaptiveEnvironmentQuality("low", "healthy")).toBe("low");
  });

  it("moves progressively toward measured performance in either direction", () => {
    expect(stepAdaptivePerformanceTier("low", "healthy")).toBe("constrained");
    expect(stepAdaptivePerformanceTier("constrained", "healthy")).toBe("healthy");
    expect(stepAdaptivePerformanceTier("healthy", "constrained")).toBe("constrained");
    expect(stepAdaptivePerformanceTier("healthy", "low")).toBe("constrained");
    expect(stepAdaptivePerformanceTier("constrained", "low")).toBe("low");
  });

  it("requires stable FPS and a dwell window before changing detail again", () => {
    expect(adaptivePerformanceTiming("healthy", "constrained", 15)).toEqual({ stableForMs: 10_000, minimumDwellMs: 10_000 });
    expect(adaptivePerformanceTiming("healthy", "low", 8)).toEqual({ stableForMs: 1_500, minimumDwellMs: 1_500 });
    expect(adaptivePerformanceTiming("low", "healthy", 40)).toEqual({ stableForMs: 12_000, minimumDwellMs: 14_000 });
  });
});
