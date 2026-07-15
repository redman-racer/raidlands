import type { FogCapabilities, FogDetail } from "./fog-detail";
import type { RaidlandsCloudDetail } from "../shared/three-cloud-detail";
import type { RaidlandsSunDetail } from "../shared/three-sun-detail";

export type EnvironmentQuality = "ultra" | "high" | "medium" | "low";

export type EnvironmentQualityProfile = {
  requested: EnvironmentQuality;
  resolved: EnvironmentQuality;
  cloudDetail: RaidlandsCloudDetail;
  sunDetail: RaidlandsSunDetail;
  fogDetail: FogDetail;
  pixelRatioCap: number;
  composerPixelRatioCap: number;
  ambientOcclusionRadius: number;
  cloudSliceCount: number;
  stableAntialiasing: boolean;
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  rainDetail: number;
  waterDetail: number;
};

const QUALITY_ORDER: EnvironmentQuality[] = ["low", "medium", "high", "ultra"];

export function parseEnvironmentQuality(value: unknown, fallback: EnvironmentQuality = "ultra"): EnvironmentQuality {
  const normalized = String(value ?? "").trim().toLowerCase();
  return QUALITY_ORDER.includes(normalized as EnvironmentQuality) ? normalized as EnvironmentQuality : fallback;
}

export function defaultEnvironmentQuality(coarsePointer: boolean, viewportWidth: number): EnvironmentQuality {
  return coarsePointer && viewportWidth <= 768 ? "medium" : "ultra";
}

export function preferredEnvironmentQuality(
  stored: unknown,
  markup: unknown,
  coarsePointer: boolean,
  viewportWidth: number,
): EnvironmentQuality {
  const normalizedStored = String(stored ?? "").trim().toLowerCase();
  if (QUALITY_ORDER.includes(normalizedStored as EnvironmentQuality)) {
    return normalizedStored as EnvironmentQuality;
  }
  const deviceDefault = defaultEnvironmentQuality(coarsePointer, viewportWidth);
  return deviceDefault === "medium" ? deviceDefault : parseEnvironmentQuality(markup, "ultra");
}

export function resolveEnvironmentQuality(
  requested: EnvironmentQuality,
  capabilities: FogCapabilities,
): EnvironmentQualityProfile {
  const supported: EnvironmentQuality = capabilities.webgl2 && capabilities.highPrecisionFragment && capabilities.depthTexture && capabilities.floatTexture
    ? "ultra"
    : capabilities.depthTexture && capabilities.floatTexture
      ? "high"
      : capabilities.highPrecisionFragment
        ? "medium"
        : "low";
  const resolved = QUALITY_ORDER[Math.min(QUALITY_ORDER.indexOf(requested), QUALITY_ORDER.indexOf(supported))] || "low";
  const requestedProfile = profiles[resolved];
  return { requested, resolved, ...requestedProfile };
}

const profiles: Record<EnvironmentQuality, Omit<EnvironmentQualityProfile, "requested" | "resolved">> = {
  ultra: {
    cloudDetail: "max",
    sunDetail: "max",
    fogDetail: "max",
    pixelRatioCap: 2,
    composerPixelRatioCap: 1.75,
    ambientOcclusionRadius: 8.5,
    cloudSliceCount: 12,
    stableAntialiasing: true,
    bloom: true,
    bloomStrength: 0.19,
    bloomRadius: 0.28,
    bloomThreshold: 0.86,
    rainDetail: 1,
    waterDetail: 1,
  },
  high: {
    cloudDetail: "max",
    sunDetail: "max",
    fogDetail: "max",
    pixelRatioCap: 1.75,
    composerPixelRatioCap: 1.5,
    ambientOcclusionRadius: 7,
    cloudSliceCount: 9,
    stableAntialiasing: true,
    bloom: true,
    bloomStrength: 0.12,
    bloomRadius: 0.2,
    bloomThreshold: 0.9,
    rainDetail: 0.78,
    waterDetail: 0.82,
  },
  medium: {
    cloudDetail: "medium",
    sunDetail: "medium",
    fogDetail: "medium",
    pixelRatioCap: 1.5,
    composerPixelRatioCap: 1.25,
    ambientOcclusionRadius: 5.5,
    cloudSliceCount: 6,
    stableAntialiasing: false,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    rainDetail: 0.56,
    waterDetail: 0.62,
  },
  low: {
    cloudDetail: "low",
    sunDetail: "low",
    fogDetail: "low",
    pixelRatioCap: 1.25,
    composerPixelRatioCap: 1,
    ambientOcclusionRadius: 4,
    cloudSliceCount: 0,
    stableAntialiasing: false,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    rainDetail: 0.34,
    waterDetail: 0.38,
  },
};
