import type { EnvironmentQuality } from "./environment-quality";

export type MonumentMode = "auto" | "primitives" | "detailed";
export type MonumentLodTier = "fallback" | "map" | "mid" | "close";

export type MonumentQualityPolicy = {
  requested: MonumentMode;
  resolved: "primitives" | "map" | "detailed";
  activeCloseLimit: number;
  activeMidLimit: number;
  activeMapLimit: number;
  closeCacheLimit: number;
  midCacheLimit: number;
  mapToMidPixels: number;
  midToClosePixels: number;
  hysteresis: number;
  triangleBudget: number;
  drawCallBudget: number;
  decodeConcurrency: number;
  shadows: boolean;
};

export type MonumentLodThresholds = { mapToMidPixels: number; midToClosePixels: number; hysteresis: number };
export type MonumentResourceUsage = { triangles: number; drawCalls: number };

export function parseMonumentMode(value: unknown, fallback: MonumentMode = "auto"): MonumentMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return "auto";
  if (normalized === "false" || normalized === "simple" || normalized === "map") return "primitives";
  return normalized === "auto" || normalized === "primitives" || normalized === "detailed"
    ? normalized
    : fallback;
}

export function resolveMonumentQuality(
  mode: MonumentMode,
  quality: EnvironmentQuality,
  thresholds: MonumentLodThresholds = { mapToMidPixels: 48, midToClosePixels: 220, hysteresis: 0.2 },
): MonumentQualityPolicy {
  const closeLimits: Record<EnvironmentQuality, number> = { low: 1, medium: 1, high: 2, ultra: 3 };
  const midLimits: Record<EnvironmentQuality, number> = { low: 4, medium: 9, high: 16, ultra: 24 };
  const mapLimits: Record<EnvironmentQuality, number> = { low: 12, medium: 48, high: 72, ultra: 96 };
  const triangleBudgets: Record<EnvironmentQuality, number> = { low: 3_000_000, medium: 4_000_000, high: 5_000_000, ultra: 6_000_000 };
  const drawCallBudgets: Record<EnvironmentQuality, number> = { low: 2_500, medium: 3_000, high: 3_500, ultra: 4_000 };
  const mapOnlyAutomatic = mode === "auto" && quality === "low";
  const activeCloseLimit = mode === "primitives" || mapOnlyAutomatic ? 0 : closeLimits[quality];
  const activeMidLimit = mode === "primitives" || mapOnlyAutomatic ? 0 : midLimits[quality];
  return {
    requested: mode,
    resolved: activeCloseLimit > 0 || activeMidLimit > 0
      ? "detailed"
      : (mapOnlyAutomatic ? "primitives" : "map"),
    activeCloseLimit,
    activeMidLimit,
    activeMapLimit: mapOnlyAutomatic ? 0 : mapLimits[quality],
    closeCacheLimit: Math.max(0, activeCloseLimit + 1),
    midCacheLimit: Math.max(0, activeMidLimit + 2),
    mapToMidPixels: thresholds.mapToMidPixels,
    midToClosePixels: thresholds.midToClosePixels,
    hysteresis: thresholds.hysteresis,
    triangleBudget: triangleBudgets[quality],
    drawCallBudget: drawCallBudgets[quality],
    decodeConcurrency: quality === "ultra" ? 2 : 1,
    shadows: quality === "high" || quality === "ultra",
  };
}

export function projectedMonumentDiameter(radius: number, distance: number, verticalFovDegrees: number, viewportHeight: number): number {
  const safeDistance = Math.max(0.001, distance);
  const safeRadius = Math.max(0.001, radius);
  const fovRadians = Math.max(0.01, verticalFovDegrees * Math.PI / 180);
  const focalLength = Math.max(1, viewportHeight) / (2 * Math.tan(fovRadians / 2));
  return 2 * safeRadius * focalLength / safeDistance;
}

export function desiredMonumentTier(
  projectedDiameter: number,
  current: MonumentLodTier,
  policy: MonumentQualityPolicy,
  focused = false,
): Exclude<MonumentLodTier, "fallback"> {
  if (policy.requested === "primitives") return "map";
  if (focused) return "close";
  const lowerFactor = 1 - policy.hysteresis;
  const mapToMid = current === "mid" || current === "close" ? policy.mapToMidPixels * lowerFactor : policy.mapToMidPixels;
  const midToClose = current === "close" ? policy.midToClosePixels * lowerFactor : policy.midToClosePixels;
  if (projectedDiameter >= midToClose) return "close";
  if (projectedDiameter >= mapToMid) return "mid";
  return "map";
}

export function prioritizeMonuments<T extends { distance: number; projectedDiameter?: number; focused?: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(Boolean(b.focused)) - Number(Boolean(a.focused))
    || (b.projectedDiameter || 0) - (a.projectedDiameter || 0)
    || a.distance - b.distance);
}

export function visibleMonumentTier(
  desired: MonumentLodTier,
  loaded: ReadonlySet<Exclude<MonumentLodTier, "fallback">>,
): MonumentLodTier {
  if (desired === "close" && loaded.has("close")) return "close";
  if ((desired === "close" || desired === "mid") && loaded.has("mid")) return "mid";
  if (desired !== "fallback" && loaded.has("map")) return "map";
  return "fallback";
}

export function monumentCacheEvictionKeys(
  entries: Array<{ key: string; active: number; lastUsed: number }>,
  tier: Exclude<MonumentLodTier, "fallback">,
  limit: number,
): string[] {
  const tierEntries = entries.filter((entry) => entry.key.startsWith(`${tier}:`));
  const removable = tierEntries.filter((entry) => entry.active === 0).sort((a, b) => a.lastUsed - b.lastUsed);
  return removable.slice(0, Math.max(0, tierEntries.length - limit)).map((entry) => entry.key);
}

export function monumentTierFitsBudget(
  active: MonumentResourceUsage,
  currentTier: MonumentResourceUsage,
  nextTier: MonumentResourceUsage,
  policy: Pick<MonumentQualityPolicy, "triangleBudget" | "drawCallBudget">,
): boolean {
  return active.triangles + Math.max(0, nextTier.triangles - currentTier.triangles) <= policy.triangleBudget
    && active.drawCalls + Math.max(0, nextTier.drawCalls - currentTier.drawCalls) <= policy.drawCallBudget;
}
