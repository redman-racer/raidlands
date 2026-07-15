export type TerrainPointPayload = { x: number; y: number; z: number };
export type PowerLinePayload = { name: string; points: TerrainPointPayload[] };

export function normalizePowerLines(value: unknown, worldSize: number): PowerLinePayload[] {
  if (!Array.isArray(value)) return [];
  const half = worldSize / 2;
  let totalPoints = 0;
  return value.slice(0, 32).map((entry, index): PowerLinePayload | null => {
    const line = entry && typeof entry === "object" ? entry as Partial<PowerLinePayload> : {};
    const points = (Array.isArray(line.points) ? line.points : []).slice(0, 128).map((point): TerrainPointPayload | null => {
      const candidate = point && typeof point === "object" ? point as Partial<TerrainPointPayload> : {};
      const x = Number(candidate.x); const y = Number(candidate.y); const z = Number(candidate.z);
      if (totalPoints >= 512 || ![x, y, z].every(Number.isFinite) || Math.abs(x) > half * 1.2 || Math.abs(z) > half * 1.2) return null;
      totalPoints++;
      return { x, y, z };
    }).filter((point): point is TerrainPointPayload => point !== null);
    return points.length >= 2 ? { name: String(line.name || `powerline-${index + 1}`).slice(0, 80), points } : null;
  }).filter((line): line is PowerLinePayload => line !== null);
}
