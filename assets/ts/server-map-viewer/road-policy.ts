import type { TerrainPointPayload } from "./power-line-policy";

export type RoadKind = "main" | "side" | "trail";

export type RoadPayload = {
  name: string;
  kind: RoadKind;
  width: number;
  points: TerrainPointPayload[];
};

function normalizeRoadKind(value: unknown): RoadKind {
  switch (String(value || "").trim().toLowerCase()) {
    case "main": return "main";
    case "trail": return "trail";
    default: return "side";
  }
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
    const kind = normalizeRoadKind(road.kind);
    const fallbackWidth = kind === "main" ? 14 : kind === "trail" ? 3.5 : 8;

    return {
      name: String(road.name || `${kind}-road-${index + 1}`).slice(0, 80),
      kind,
      width: Math.max(2.5, Math.min(38, Number(road.width) || fallbackWidth)),
      points,
    };
  }).filter((road): road is RoadPayload => road !== null);
}
