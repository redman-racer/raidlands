export type RaidlandsCloudDetail = "low" | "medium" | "max";

export type RaidlandsCloudProfile = {
  detail: RaidlandsCloudDetail;
  viewSamples: number;
  lightSamples: number;
  shadowOctaves: number;
  useVolumetricClouds: boolean;
  useSpriteClouds: boolean;
};

const CLOUD_PROFILES: Record<RaidlandsCloudDetail, RaidlandsCloudProfile> = {
  low: {
    detail: "low",
    viewSamples: 0,
    lightSamples: 0,
    shadowOctaves: 0,
    useVolumetricClouds: false,
    useSpriteClouds: true,
  },
  medium: {
    detail: "medium",
    viewSamples: 32,
    lightSamples: 2,
    shadowOctaves: 2,
    useVolumetricClouds: true,
    useSpriteClouds: false,
  },
  max: {
    detail: "max",
    viewSamples: 56,
    lightSamples: 4,
    shadowOctaves: 4,
    useVolumetricClouds: true,
    useSpriteClouds: false,
  },
};

export function parseRaidlandsCloudDetail(
  value: unknown,
  fallback: RaidlandsCloudDetail = "low",
): RaidlandsCloudDetail {
  return value === "low" || value === "medium" || value === "max" ? value : fallback;
}

export function raidlandsCloudProfile(detail: RaidlandsCloudDetail): RaidlandsCloudProfile {
  return CLOUD_PROFILES[detail];
}

export function normalizeRaidlandsCloudCoverage(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(1, Math.max(0, numeric));
}

export function raidlandsCloudCoverageThreshold(coverage: unknown): number {
  const normalized = normalizeRaidlandsCloudCoverage(coverage);
  return 0.82 + (0.27 - 0.82) * Math.sqrt(normalized);
}
