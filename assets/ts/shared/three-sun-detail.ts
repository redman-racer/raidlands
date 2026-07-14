export type RaidlandsSunDetail = "low" | "medium" | "max";

export type RaidlandsSunProfile = {
  detail: RaidlandsSunDetail;
  shaderLevel: 0 | 1 | 2;
  useAtmosphericDisc: boolean;
  useCinematicOptics: boolean;
  lightingResponse: number;
};

const SUN_PROFILES: Record<RaidlandsSunDetail, RaidlandsSunProfile> = {
  low: {
    detail: "low",
    shaderLevel: 0,
    useAtmosphericDisc: false,
    useCinematicOptics: false,
    lightingResponse: 0,
  },
  medium: {
    detail: "medium",
    shaderLevel: 1,
    useAtmosphericDisc: true,
    useCinematicOptics: false,
    lightingResponse: 0.55,
  },
  max: {
    detail: "max",
    shaderLevel: 2,
    useAtmosphericDisc: true,
    useCinematicOptics: true,
    lightingResponse: 1,
  },
};

export function parseRaidlandsSunDetail(
  value: unknown,
  fallback: RaidlandsSunDetail = "low",
): RaidlandsSunDetail {
  return value === "low" || value === "medium" || value === "max" ? value : fallback;
}

export function raidlandsSunProfile(detail: RaidlandsSunDetail): RaidlandsSunProfile {
  return SUN_PROFILES[detail];
}
