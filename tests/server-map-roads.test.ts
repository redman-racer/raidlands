import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { normalizeRoads, sampleSmoothRoadCenterline } from "../assets/ts/server-map-viewer/road-policy";

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
});
