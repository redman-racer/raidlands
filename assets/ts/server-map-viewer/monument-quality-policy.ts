import type { EnvironmentQuality } from "./environment-quality";

export type MonumentMode = "auto" | "primitives" | "detailed";

export type MonumentQualityPolicy = {
  requested: MonumentMode;
  resolved: "primitives" | "detailed";
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
  if (normalized === "false" || normalized === "simple" || normalized === "map") return "primitives";
  return normalized === "auto" || normalized === "primitives" || normalized === "detailed"
    ? normalized
    : fallback;
}

export function resolveMonumentQuality(mode: MonumentMode, quality: EnvironmentQuality): MonumentQualityPolicy {
  // Auto keeps one close monument detailed even on Low. This preserves the
  // visible LOD transition while bounding decode/GPU cost to a single asset.
  // Explicit Map LOD mode remains the zero-detail performance escape hatch.
  const limits: Record<EnvironmentQuality, number> = { low: 1, medium: 1, high: 2, ultra: 3 };
  const activeDetailLimit = mode === "primitives" ? 0 : limits[quality];
  return {
    requested: mode,
    resolved: activeDetailLimit > 0 ? "detailed" : "primitives",
    activeDetailLimit,
    // Website terrain ingestion is capped at 96 monument instances. Keeping
    // this above that cap makes actual-geometry map proxies the normal map
    // representation, rather than allowing distant procedural stand-ins.
    activeMapLimit: 128,
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
