import { describe, expect, it } from "vitest";
import {
  parseEnvironmentQuality,
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
      temporalAccumulation: true,
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
      temporalAccumulation: false,
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
});
