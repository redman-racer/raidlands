import type { EnvironmentQuality } from "./environment-quality";

export type MonumentMode = "auto" | "map" | "detailed";

export type MonumentQualityPolicy = {
  requested: MonumentMode;
  resolved: "map" | "detailed";
  activeDetailLimit: number;
  activeMapLimit: number;
  detailCacheLimit: number;
  loadDistanceMultiplier: number;
  unloadDistanceMultiplier: number;
  minimumLoadDistance: number;
  decodeConcurrency: number;
  shadows: boolean;
};

export function parseMonumentMode(value: unknown, fallback: MonumentMode = "auto"): MonumentMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return "auto";
  if (normalized === "false" || normalized === "simple") return "map";
  return normalized === "auto" || normalized === "map" || normalized === "detailed"
    ? normalized
    : fallback;
}

export function resolveMonumentQuality(mode: MonumentMode, quality: EnvironmentQuality): MonumentQualityPolicy {
  const limits: Record<EnvironmentQuality, number> = { low: 0, medium: 1, high: 2, ultra: 3 };
  const activeDetailLimit = mode === "map" || quality === "low" ? 0 : limits[quality];
  return {
    requested: mode,
    resolved: activeDetailLimit > 0 ? "detailed" : "map",
    activeDetailLimit,
    activeMapLimit: ({ low: 12, medium: 18, high: 24, ultra: 32 } as Record<EnvironmentQuality, number>)[quality],
    detailCacheLimit: Math.max(0, activeDetailLimit + 1),
    loadDistanceMultiplier: 5.5,
    unloadDistanceMultiplier: 7.25,
    minimumLoadDistance: 425,
    decodeConcurrency: quality === "ultra" ? 2 : 1,
    shadows: quality === "high" || quality === "ultra",
  };
}

export function monumentLoadDistance(radius: number, policy: MonumentQualityPolicy): number {
  return Math.max(policy.minimumLoadDistance, Math.min(280, Math.max(24, radius)) * policy.loadDistanceMultiplier);
}

export function monumentUnloadDistance(radius: number, policy: MonumentQualityPolicy): number {
  return Math.max(monumentLoadDistance(radius, policy) + 100, Math.min(280, Math.max(24, radius)) * policy.unloadDistanceMultiplier);
}

export function prioritizeMonuments<T extends { distance: number; focused?: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(Boolean(b.focused)) - Number(Boolean(a.focused)) || a.distance - b.distance);
}
