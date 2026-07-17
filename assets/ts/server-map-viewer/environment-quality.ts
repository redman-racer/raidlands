import type { FogCapabilities, FogDetail } from "./fog-detail";
import type { RaidlandsCloudDetail } from "../shared/three-cloud-detail";
import type { RaidlandsSunDetail } from "../shared/three-sun-detail";

export type EnvironmentQuality = "ultra" | "high" | "medium" | "low";
export type ViewerPerformanceTier = "healthy" | "constrained" | "low";

export type EnvironmentQualityProfile = {
  requested: EnvironmentQuality;
  resolved: EnvironmentQuality;
  cloudDetail: RaidlandsCloudDetail;
  sunDetail: RaidlandsSunDetail;
  fogDetail: FogDetail;
  fogAltitudeFadeStart: number;
  fogAltitudeFadeEnd: number;
  fogAltitudeDensityFloor: number;
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

/**
 * Caps a user's requested detail only while measured frame rate is struggling.
 * Ultra is an explicit visual-fidelity lock: the bounded loaders and caches
 * still protect the page, but adaptive FPS handling must not silently replace
 * authored trees, monuments, or weather with a lower detail tier.
 */
export function adaptiveEnvironmentQuality(
  quality: EnvironmentQuality,
  performanceTier: ViewerPerformanceTier,
): EnvironmentQuality {
  if (quality === "ultra") return "ultra";
  const cap: EnvironmentQuality = performanceTier === "healthy"
    ? "ultra"
    : performanceTier === "constrained"
      ? "medium"
      : "low";
  return QUALITY_ORDER[Math.min(QUALITY_ORDER.indexOf(quality), QUALITY_ORDER.indexOf(cap))] || "low";
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
    fogAltitudeFadeStart: 0.55,
    fogAltitudeFadeEnd: 1.2,
    fogAltitudeDensityFloor: 0.98,
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
    fogAltitudeFadeStart: 0.38,
    fogAltitudeFadeEnd: 0.9,
    fogAltitudeDensityFloor: 0.78,
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
    fogAltitudeFadeStart: 0.2,
    fogAltitudeFadeEnd: 0.65,
    fogAltitudeDensityFloor: 0.6,
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
    fogAltitudeFadeStart: 0.08,
    fogAltitudeFadeEnd: 0.42,
    fogAltitudeDensityFloor: 0.42,
    pixelRatioCap: 1,
    composerPixelRatioCap: 0.75,
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
