import { describe, expect, it } from "vitest";
import {
  desiredMonumentTier,
  monumentCacheEvictionKeys,
  monumentMapTierEligible,
  monumentTierFitsBudget,
  parseMonumentMode,
  prioritizeMonuments,
  projectedMonumentDiameter,
  resolveMonumentQuality,
  visibleMonumentTier,
} from "../assets/ts/server-map-viewer/monument-quality-policy";

describe("monument quality policy", () => {
  it("migrates existing local-storage values", () => {
    expect(parseMonumentMode("true")).toBe("auto");
    expect(parseMonumentMode("false")).toBe("primitives");
    expect(parseMonumentMode("simple")).toBe("primitives");
    expect(parseMonumentMode("map")).toBe("primitives");
    expect(parseMonumentMode("detailed")).toBe("detailed");
  });

  it("applies the requested tier caps and total resource budgets", () => {
    expect(resolveMonumentQuality("auto", "low")).toMatchObject({ resolved: "primitives", activeCloseLimit: 0, activeMidLimit: 0, activeMapLimit: 0, triangleBudget: 3_000_000, drawCallBudget: 2_500 });
    expect(resolveMonumentQuality("detailed", "low")).toMatchObject({ resolved: "detailed", activeCloseLimit: 1, activeMidLimit: 4, activeMapLimit: 8 });
    expect(resolveMonumentQuality("auto", "medium")).toMatchObject({ activeCloseLimit: 1, activeMidLimit: 9, activeMapLimit: 12, triangleBudget: 4_000_000, drawCallBudget: 3_000 });
    expect(resolveMonumentQuality("auto", "high")).toMatchObject({ activeCloseLimit: 2, activeMidLimit: 16, activeMapLimit: 20, triangleBudget: 5_000_000, drawCallBudget: 3_500 });
    expect(resolveMonumentQuality("auto", "ultra")).toMatchObject({ activeCloseLimit: 3, activeMidLimit: 24, activeMapLimit: 28, triangleBudget: 6_000_000, drawCallBudget: 4_000 });
    expect(resolveMonumentQuality("primitives", "ultra")).toMatchObject({ resolved: "map", activeCloseLimit: 0, activeMidLimit: 0, activeMapLimit: 28 });
  });

  it("keeps far monuments on primitives until they occupy enough screen space", () => {
    const policy = resolveMonumentQuality("auto", "high");
    expect(monumentMapTierEligible(15, false, policy)).toBe(false);
    expect(monumentMapTierEligible(16, false, policy)).toBe(true);
    expect(monumentMapTierEligible(1, true, policy)).toBe(true);
  });

  it("selects by projected screen diameter and focuses Close", () => {
    const policy = resolveMonumentQuality("auto", "high");
    expect(desiredMonumentTier(47, "map", policy)).toBe("map");
    expect(desiredMonumentTier(48, "map", policy)).toBe("mid");
    expect(desiredMonumentTier(219, "mid", policy)).toBe("mid");
    expect(desiredMonumentTier(220, "mid", policy)).toBe("close");
    expect(desiredMonumentTier(1, "map", policy, true)).toBe("close");
    expect(projectedMonumentDiameter(50, 500, 60, 1000)).toBeCloseTo(173.205, 2);
  });

  it("uses 20 percent hysteresis for demotion", () => {
    const policy = resolveMonumentQuality("auto", "high");
    expect(desiredMonumentTier(39, "mid", policy)).toBe("mid");
    expect(desiredMonumentTier(38, "mid", policy)).toBe("map");
    expect(desiredMonumentTier(190, "close", policy)).toBe("close");
    expect(desiredMonumentTier(175, "close", policy)).toBe("mid");
  });

  it("prioritizes focus, then projected size, then distance", () => {
    const ranked = prioritizeMonuments([
      { id: "near", distance: 10, projectedDiameter: 40 },
      { id: "large", distance: 100, projectedDiameter: 200 },
      { id: "focus", distance: 500, projectedDiameter: 10, focused: true },
    ]);
    expect(ranked.map((entry) => entry.id)).toEqual(["focus", "large", "near"]);
  });

  it("keeps the best loaded lower tier after a close decode failure", () => {
    expect(visibleMonumentTier("close", new Set(["map", "mid"]))).toBe("mid");
    expect(visibleMonumentTier("mid", new Set(["map"]))).toBe("map");
    expect(visibleMonumentTier("map", new Set())).toBe("fallback");
  });

  it("rejects an oversized tier before it can consume the scene budget", () => {
    const policy = resolveMonumentQuality("auto", "ultra");
    expect(monumentTierFitsBudget(
      { triangles: 5_900_000, drawCalls: 3_950 },
      { triangles: 20_000, drawCalls: 8 },
      { triangles: 300_000, drawCalls: 90 },
      policy,
    )).toBe(false);
    expect(monumentTierFitsBudget(
      { triangles: 5_000_000, drawCalls: 3_700 },
      { triangles: 20_000, drawCalls: 8 },
      { triangles: 120_000, drawCalls: 40 },
      policy,
    )).toBe(true);
  });

  it("evicts only inactive least-recently-used entries above the cache cap", () => {
    expect(monumentCacheEvictionKeys([
      { key: "close:a", active: 0, lastUsed: 1 },
      { key: "close:b", active: 1, lastUsed: 0 },
      { key: "close:c", active: 0, lastUsed: 2 },
      { key: "mid:d", active: 0, lastUsed: 0 },
    ], "close", 2)).toEqual(["close:a"]);
  });
});
