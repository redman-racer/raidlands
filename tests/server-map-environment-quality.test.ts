import { describe, expect, it } from "vitest";
import {
  defaultEnvironmentQuality,
  parseEnvironmentQuality,
  preferredEnvironmentQuality,
  resolveEnvironmentQuality,
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
});
