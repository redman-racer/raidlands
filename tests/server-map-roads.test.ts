import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { normalizeRoads, roadKindForWidth, roadRibbonUvs, sampleSmoothRoadCenterline } from "../assets/ts/server-map-viewer/road-policy";

describe("server map roads", () => {
  it("ships the paved and dirt road surface textures", () => {
    for (const name of ["road-asphalt.webp", "road-dirt.webp"]) {
      const path = resolve("assets/media/textures", name);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100_000);
    }
  });

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

  it("uses surviving road widths when category metadata is wrong", () => {
    expect(roadKindForWidth(10)).toBe("main");
    expect(roadKindForWidth(8)).toBe("side");
    expect(roadKindForWidth(3.5)).toBe("trail");

    const points = [{ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }];
    expect(normalizeRoads([
      { kind: "side", width: 10, points },
      { kind: "main", width: 3.5, points },
    ], 1000)).toMatchObject([
      { kind: "main", width: 10 },
      { kind: "trail", width: 3.5 },
    ]);
  });

  it("samples authored corners as a smooth, distance-bounded curve", () => {
    const points = [
      new Vector3(-20, 0, 0),
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 10),
      new Vector3(10, 0, 30),
    ];
    const sampled = sampleSmoothRoadCenterline(points, 3);

    expect(sampled[0]!.distanceTo(points[0]!)).toBeLessThan(0.0001);
    expect(sampled[sampled.length - 1]!.distanceTo(points[points.length - 1]!)).toBeLessThan(0.0001);
    expect(sampled.length).toBeGreaterThan(points.length);
    expect(Math.max(...sampled.slice(1).map((point, index) => point.distanceTo(sampled[index]!)))).toBeLessThanOrEqual(3.1);

    const authoredCorner = sampled.reduce((best, point) => (
      point.distanceToSquared(points[1]!) < best.distanceToSquared(points[1]!) ? point : best
    ));
    const cornerIndex = sampled.indexOf(authoredCorner);
    const incoming = authoredCorner.clone().sub(sampled[cornerIndex - 1]!).normalize();
    const outgoing = sampled[cornerIndex + 1]!.clone().sub(authoredCorner).normalize();
    expect(incoming.dot(outgoing)).toBeGreaterThan(0.8);
  });

  it("maps road texture coordinates in world units along the centerline", () => {
    const uvs = roadRibbonUvs([
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 6),
      new Vector3(8, 0, 6),
    ], 12, 2, 12);

    expect(uvs).toEqual([
      0, 0, 0.5, 0, 1, 0,
      0, 0.5, 0.5, 0.5, 1, 0.5,
      0, 14 / 12, 0.5, 14 / 12, 1, 14 / 12,
    ]);
  });
});
