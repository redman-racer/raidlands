import { describe, expect, it } from "vitest";
import { normalizeRoads } from "../assets/ts/server-map-viewer/road-policy";

describe("server map roads", () => {
  it("keeps the Rust-authored road category, width, and terrain path", () => {
    expect(normalizeRoads([{ name: "ring", kind: "main", width: 15, points: [
      { x: -200, y: 12, z: 30 }, { x: 0, y: 18, z: 30 }, { x: 200, y: 14, z: 30 },
    ] }], 1000)).toEqual([{ name: "ring", kind: "main", width: 15, points: [
      { x: -200, y: 12, z: 30 }, { x: 0, y: 18, z: 30 }, { x: 200, y: 14, z: 30 },
    ] }]);
  });

  it("uses bounded category defaults and rejects out-of-world paths", () => {
    expect(normalizeRoads([{ kind: "trail", points: [
      { x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
    ] }], 1000)).toMatchObject([{ kind: "trail", width: 3.5 }]);
    expect(normalizeRoads([{ points: [{ x: 9999, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] }], 1000)).toEqual([]);
  });
});
