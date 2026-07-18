import { describe, expect, it } from "vitest";
import {
  treeDecodeConcurrency,
  treeInstanceLimit,
  treePlacementDistance,
  treeQualityLimits,
  treeRequestIsStale,
} from "../assets/ts/server-map-viewer/tree-model-controller";

describe("tree model runtime policy", () => {
  it("keeps tree decoding serial so nearby assets do not arrive in a burst", () => {
    expect(treeDecodeConcurrency("low")).toBe(1);
    expect(treeDecodeConcurrency("medium")).toBe(1);
    expect(treeDecodeConcurrency("high")).toBe(1);
    expect(treeDecodeConcurrency("ultra")).toBe(1);
  });

  it("uses map-only tree LOD at low quality", () => {
    expect(treeQualityLimits("low")).toEqual({ mid: 0, close: 0 });
    expect(treeInstanceLimit("low")).toBe(240);
    expect(treeInstanceLimit("medium")).toBe(1450);
    expect(treeInstanceLimit("high")).toBe(treeInstanceLimit("medium"));
    expect(treeInstanceLimit("ultra")).toBe(treeInstanceLimit("medium"));
    expect(treeQualityLimits("medium")).toMatchObject({ mid: 220, close: 24 });
  });

  it("calculates distance numerically without allocating Three.js vectors", () => {
    expect(treePlacementDistance({ x: 3, y: 4, z: 12 }, { x: 0, y: 0, z: 0 })).toBe(13);
  });

  it("cancels stale detail requests while preserving map work across detail changes", () => {
    expect(treeRequestIsStale("mid", 1, 2, 4, 4)).toBe(true);
    expect(treeRequestIsStale("close", 1, 2, 4, 4)).toBe(true);
    expect(treeRequestIsStale("map", 1, 2, 4, 4)).toBe(false);
    expect(treeRequestIsStale("map", 1, 1, 3, 4)).toBe(true);
  });
});
