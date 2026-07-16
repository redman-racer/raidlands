import type { TerrainPointPayload } from "./power-line-policy";
import { CatmullRomCurve3, Vector3 } from "three";

export type RoadKind = "main" | "side" | "trail";

export type RoadPayload = {
  name: string;
  kind: RoadKind;
  width: number;
  points: TerrainPointPayload[];
};

export function sampleSmoothRoadCenterline(points: Vector3[], maximumSegmentLength: number): Vector3[] {
  if (points.length < 2) return points.map((point) => point.clone());

  const safeSegmentLength = Math.max(0.1, maximumSegmentLength);
  if (points.length === 2) {
    const divisions = Math.max(1, Math.ceil(points[0]!.distanceTo(points[1]!) / safeSegmentLength));
    return Array.from({ length: divisions + 1 }, (_, index) => (
      points[0]!.clone().lerp(points[1]!, index / divisions)
    ));
  }

  // Centripetal Catmull-Rom follows unevenly spaced Rust path nodes without the
  // loops and sharp overshoot that a uniform spline can introduce at corners.
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  const divisions = Math.max(1, Math.ceil(curve.getLength() / safeSegmentLength));
  return curve.getSpacedPoints(divisions);
}

function normalizeRoadKind(value: unknown): RoadKind {
  switch (String(value || "").trim().toLowerCase()) {
    case "main": return "main";
    case "trail": return "trail";
    default: return "side";
  }
}

export function roadKindForWidth(width: number): RoadKind {
  if (width >= 9) return "main";
  if (width <= 5.5) return "trail";
  return "side";
}

export function normalizeRoads(value: unknown, worldSize: number): RoadPayload[] {
  if (!Array.isArray(value)) return [];
  const half = worldSize / 2;
  let totalPoints = 0;

  return value.slice(0, 96).map((entry, index): RoadPayload | null => {
    const road = entry && typeof entry === "object" ? entry as Partial<RoadPayload> : {};
    const points = (Array.isArray(road.points) ? road.points : []).slice(0, 192).map((point): TerrainPointPayload | null => {
      const candidate = point && typeof point === "object" ? point as Partial<TerrainPointPayload> : {};
      const x = Number(candidate.x); const y = Number(candidate.y); const z = Number(candidate.z);
      if (totalPoints >= 4096 || ![x, y, z].every(Number.isFinite) || Math.abs(x) > half * 1.2 || Math.abs(z) > half * 1.2) return null;
      totalPoints++;
      return { x, y, z };
    }).filter((point): point is TerrainPointPayload => point !== null);

    if (points.length < 2) return null;
    const authoredKind = normalizeRoadKind(road.kind);
    const fallbackWidth = authoredKind === "main" ? 14 : authoredKind === "trail" ? 3.5 : 8;
    const suppliedWidth = Number(road.width);
    const hasSuppliedWidth = Number.isFinite(suppliedWidth) && suppliedWidth > 0;
    const width = Math.max(2.5, Math.min(38, hasSuppliedWidth ? suppliedWidth : fallbackWidth));
    // Some deployed terrain payloads flatten every category to "side". Rust's
    // authored widths remain distinct, so prefer them whenever they are present.
    const kind = hasSuppliedWidth ? roadKindForWidth(width) : authoredKind;

    return {
      name: String(road.name || `${kind}-road-${index + 1}`).slice(0, 80),
      kind,
      width,
      points,
    };
  }).filter((road): road is RoadPayload => road !== null);
}
