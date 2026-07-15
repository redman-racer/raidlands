import { describe, expect, it } from "vitest";
import { monumentLoadDistance, monumentUnloadDistance, parseMonumentMode, prioritizeMonuments, resolveMonumentQuality } from "../assets/ts/server-map-viewer/monument-quality-policy";

describe("monument quality policy", () => {
  it("migrates the legacy boolean setting", () => {
    expect(parseMonumentMode("true")).toBe("auto");
    expect(parseMonumentMode("false")).toBe("primitives");
    expect(parseMonumentMode("simple")).toBe("primitives");
    expect(parseMonumentMode("map")).toBe("primitives");
  });

  it("enforces map LOD on low and applies preset budgets", () => {
    expect(resolveMonumentQuality("detailed", "low").activeDetailLimit).toBe(0);
    expect(resolveMonumentQuality("auto", "medium").activeDetailLimit).toBe(1);
    expect(resolveMonumentQuality("auto", "high").activeDetailLimit).toBe(2);
    expect(resolveMonumentQuality("auto", "ultra").activeDetailLimit).toBe(3);
    expect(resolveMonumentQuality("primitives", "ultra").activeDetailLimit).toBe(0);
    expect(resolveMonumentQuality("auto", "low").activeMapLimit).toBeGreaterThanOrEqual(96);
  });

  it("uses hysteresis and focused-first prioritization", () => {
    const policy = resolveMonumentQuality("auto", "high");
    expect(monumentUnloadDistance(100, policy)).toBeGreaterThan(monumentLoadDistance(100, policy));
    expect(prioritizeMonuments([{ distance: 10 }, { distance: 100, focused: true }])[0]?.focused).toBe(true);
  });
});
