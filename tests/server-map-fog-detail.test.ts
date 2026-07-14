import { describe, expect, it } from "vitest";
import {
  fogRayMarchSamples,
  lowDetailFogNearVisibility,
  parseFogDetail,
  resolveFogDetail,
} from "../assets/ts/server-map-viewer/fog-detail";

const full = { depthTexture: true, floatTexture: true, highPrecisionFragment: true, webgl2: true };

describe("server map fog quality", () => {
  it("defaults invalid and missing values to max", () => {
    expect(parseFogDetail(undefined)).toBe("max");
    expect(parseFogDetail("unknown")).toBe("max");
    expect(parseFogDetail(" MEDIUM ")).toBe("medium");
  });

  it("falls back only according to GPU capabilities", () => {
    expect(resolveFogDetail("max", full)).toBe("max");
    expect(resolveFogDetail("max", { ...full, webgl2: false })).toBe("medium");
    expect(resolveFogDetail("max", { ...full, floatTexture: false })).toBe("low");
    expect(resolveFogDetail("medium", full)).toBe("medium");
    expect(resolveFogDetail("low", full)).toBe("low");
  });

  it("uses distinct bounded ray-march budgets", () => {
    expect(fogRayMarchSamples("low")).toBe(0);
    expect(fogRayMarchSamples("medium")).toBe(24);
    expect(fogRayMarchSamples("max")).toBe(44);
  });

  it("keeps light fog nearby and attenuates only dense fog in a small core", () => {
    expect(lowDetailFogNearVisibility(0.35, 0)).toBe(1);
    expect(lowDetailFogNearVisibility(0.6, 0)).toBe(1);
    expect(lowDetailFogNearVisibility(1, 0)).toBeCloseTo(0.28);
    expect(lowDetailFogNearVisibility(1, 0.1)).toBe(1);
  });
});
