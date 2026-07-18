import { Box3, MathUtils, Vector3 } from "three";

export type ArenaPlacement = {
  id: string;
  enabled: boolean;
  zone: string;
  parent: string;
  role: string;
  sourcePath: string;
  localPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  normalizeMode: string;
  targetExtent: number;
  anchor: string;
  castShadow: boolean;
  receiveShadow: boolean;
  lodClass: string;
  occlusionPriority: string;
  renderOrder: number;
};

const BARBED_WIRE_PLACEMENT_IDS = new Set(["L_BARBEDWIRE", "C_BARBED_TOP", "R_BARBED_BEND"]);

export function isBarbedWirePlacement(id: string): boolean {
  return BARBED_WIRE_PLACEMENT_IDS.has(id);
}

export type ArenaThemeAsset = {
  kitId: string;
  slot: string;
  name: string;
  sourcePath: string;
  localPath: string;
  quantity: number;
  suggestedZone: string;
  placementRule: string;
};

export type ArenaTheme = {
  label: string;
  activeInSourceScene: boolean;
  placements: ArenaPlacement[];
  assets: ArenaThemeAsset[];
};

export type ArenaManifest = {
  version: number;
  schemaVersion: string;
  repository: string;
  revision: string;
  modelBase: string;
  camera: Record<string, unknown>;
  sceneNodes: Array<Record<string, unknown>>;
  characterAnchors: ArenaPlacement[];
  basePlacements: ArenaPlacement[];
  lights: Array<Record<string, unknown>>;
  atmosphereAndPost: Array<Record<string, unknown>>;
  themes: Record<string, ArenaTheme>;
  assets: Array<{ sourcePath: string; localPath: string; bytes: number; sha256: string }>;
};

export type PodiumThemeKey = "most-kills" | "most-rp" | "npc-hunter" | "raid-damage" | "neutral";
export type ArenaShowcaseZone = "rear" | "left-wing" | "right-wing" | "podium" | "foreground";

export type ArenaPlacementTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  zone: ArenaShowcaseZone;
};

export const ARENA_IDLE_ORBIT_AMPLITUDE = MathUtils.degToRad(8);
export const ARENA_IDLE_ORBIT_CYCLE_MS = 28_000;
export const ARENA_IDLE_ORBIT_RESUME_DELAY_MS = 8_000;
export const FORWARD_MOUND_VISIBILITY = {
  horizontalScale: 1.43,
  verticalScale: 1.25,
  colorMultiplier: 1.4,
  emissive: 0x3a1b0c,
  emissiveIntensity: .75,
} as const;

export const JUNKYARD_GROUND = {
  width: 56,
  depth: 52,
  centerZ: -13.5,
  baseY: -.16,
  widthSegments: 112,
  depthSegments: 104,
  repeatX: 14,
  repeatY: 13,
} as const;

export const PROFILE_PODIUM_GROUND = {
  width: 16,
  depth: 9,
  centerZ: -1.8,
  baseY: -.23,
  widthSegments: 64,
  depthSegments: 36,
  repeatX: 4,
  repeatY: 3,
} as const;

export const JUNKYARD_GROUND_RELIEF = {
  min: -.38,
  max: .58,
} as const;

export const JUNKYARD_GROUND_SURFACE_SHADE = {
  min: .78,
  max: 1.16,
} as const;

export const PROFILE_PODIUM_GROUND_RELIEF = {
  min: -.12,
  max: .2,
} as const;

export type PodiumGroundMaterialState = "pbr" | "fallback-texture" | "fallback-material";

export function podiumGroundMaterialState(preferredAlbedoLoaded: boolean, anyAlbedoLoaded: boolean): PodiumGroundMaterialState {
  if (preferredAlbedoLoaded) return "pbr";
  return anyAlbedoLoaded ? "fallback-texture" : "fallback-material";
}

export const JUNKYARD_SEARCHLIGHTS = [
  { side: -1 as const, origin: [-20.5, 4.65, -7] as [number, number, number], phase: .35 },
  { side: 1 as const, origin: [20.5, 4.72, -7] as [number, number, number], phase: 2.55 },
] as const;

export const JUNKYARD_PODIUM_CENTERS_X = [-2.55, 0, 2.55] as const;

export const JUNKYARD_GANTRY_LAYOUT = {
  trussSpan: 6,
  trussCenterY: 5.35,
  trussCenterZ: -7.25,
  trussCentersX: [-6, 0, 6] as const,
  supportXs: [-9, 9] as const,
  supportTopY: 5.35,
  supportWidth: .34,
  supportDepth: .46,
  braceInset: .9,
  braceBottomY: 3.82,
  braceTopY: 4.78,
  braceThickness: .22,
} as const;

export const JUNKYARD_ATMOSPHERE = {
  sceneFogDensity: .048,
  volumetricDensity: 1.05,
  volumetricOpacityCeiling: .42,
  fullBankHeight: .65,
  bankFadeHeight: 1.25,
  wispStartHeight: 1.05,
  wispFadeHeight: 2.2,
  wispStrength: .22,
  podiumInnerRadius: 1.4,
  podiumOuterRadius: 3,
} as const;

export type JunkyardFallbackFogLayer = {
  y: number;
  opacity: number;
  repeat: [number, number];
  speed: [number, number];
  offset: [number, number];
};

export function junkyardFallbackFogLayers(mobile: boolean): JunkyardFallbackFogLayer[] {
  return mobile
    ? [
        { y: .07, opacity: .18, repeat: [2.4, 1.5], speed: [.006, .0025], offset: [.1, .35] },
        { y: .4, opacity: .07, repeat: [2.8, 1.7], speed: [-.0035, .0018], offset: [.65, .05] },
      ]
    : [
        { y: .07, opacity: .21, repeat: [2.45, 1.55], speed: [.006, .0025], offset: [.1, .35] },
        { y: .42, opacity: .09, repeat: [2.85, 1.75], speed: [-.0035, .0018], offset: [.65, .05] },
        { y: 1.02, opacity: .025, repeat: [3.2, 1.9], speed: [.0025, -.0014], offset: [.35, .72] },
      ];
}

export function junkyardFogVerticalProfile(height: number): number {
  const groundEntry = MathUtils.smoothstep(height, -.12, .08);
  const mainBank = 1 - MathUtils.smoothstep(height, JUNKYARD_ATMOSPHERE.fullBankHeight, JUNKYARD_ATMOSPHERE.bankFadeHeight);
  const wisps = (1 - MathUtils.smoothstep(height, JUNKYARD_ATMOSPHERE.wispStartHeight, JUNKYARD_ATMOSPHERE.wispFadeHeight))
    * JUNKYARD_ATMOSPHERE.wispStrength;
  return groundEntry * Math.max(mainBank, wisps);
}

export function junkyardPodiumFogInfluence(x: number, z: number): number {
  const distance = Math.min(...JUNKYARD_PODIUM_CENTERS_X.map((centerX) => Math.hypot(x - centerX, z)));
  return 1 - MathUtils.smoothstep(distance, JUNKYARD_ATMOSPHERE.podiumInnerRadius, JUNKYARD_ATMOSPHERE.podiumOuterRadius);
}

export type JunkyardScatterPlacement = {
  kind: "pebble" | "metal";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type JunkyardSmokeSample = {
  position: [number, number, number];
  scale: [number, number];
  opacity: number;
  rotation: number;
};

const PODIUM_EXCLUSIONS = [
  { x: 0, z: 0, radius: 1.72 },
  { x: -2.55, z: 0, radius: 1.52 },
  { x: 2.55, z: 0, radius: 1.52 },
] as const;

function seededUnit(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function podiumClearance(x: number, z: number): number {
  return Math.min(...PODIUM_EXCLUSIONS.map((zone) => Math.hypot(x - zone.x, z - zone.z) - zone.radius));
}

function smoothUnit(value: number): number {
  return value * value * (3 - 2 * value);
}

function terrainNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x); const z0 = Math.floor(z);
  const tx = smoothUnit(x - x0); const tz = smoothUnit(z - z0);
  const sample = (sampleX: number, sampleZ: number): number => (
    seededUnit(seed + Math.imul(sampleX, 0x1f123bb5) + Math.imul(sampleZ, 0x5f356495)) * 2 - 1
  );
  const top = MathUtils.lerp(sample(x0, z0), sample(x0 + 1, z0), tx);
  const bottom = MathUtils.lerp(sample(x0, z0 + 1), sample(x0 + 1, z0 + 1), tx);
  return MathUtils.lerp(top, bottom, tz);
}

function ellipseInfluence(x: number, z: number, centerX: number, centerZ: number, radiusX: number, radiusZ: number): number {
  const distance = Math.hypot((x - centerX) / radiusX, (z - centerZ) / radiusZ);
  const fade = 1 - MathUtils.smoothstep(distance, .12, 1);
  return fade * fade;
}

function groundBoundaryInfluence(
  x: number,
  z: number,
  ground: { readonly width: number; readonly depth: number; readonly centerZ: number },
): number {
  const edgeDistance = Math.min(ground.width / 2 - Math.abs(x), ground.depth / 2 - Math.abs(z - ground.centerZ));
  return MathUtils.smoothstep(edgeDistance, .65, 2.25);
}

function sharedGroundRelief(x: number, z: number, seed: number): number {
  return terrainNoise(x * .095, z * .095, seed) * .19
    + terrainNoise(x * .24, z * .24, seed + 0x2a71) * .14
    + terrainNoise(x * .52, z * .52, seed + 0x51ed) * .09
    + Math.sin(x * .52 + z * .17) * .075
    + Math.sin(z * .65 - x * .14) * .065;
}

function themeSocketClearance(x: number, z: number): number {
  return Math.min(...THEME_SOCKETS.map((socket) => Math.hypot(x - socket.position[0], z - socket.position[2]) - .82));
}

export function junkyardGroundHeight(x: number, z: number): number {
  const broadFeatures = ellipseInfluence(x, z, -10.8, 1.8, 6.8, 4.8) * .38
    + ellipseInfluence(x, z, 10.2, -.8, 6.4, 4.8) * .34
    + ellipseInfluence(x, z, 0, 7.1, 14, 2.7) * .27
    - ellipseInfluence(x, z, 0, 3.7, 9.5, 2.6) * .2
    - ellipseInfluence(x, z, -6.4, 5.2, 1.2, 7.2) * .09
    - ellipseInfluence(x, z, 6.2, 4.5, 1.3, 6.8) * .085
    + ellipseInfluence(x, z, -9, -12, 10.5, 7.2) * .3
    - ellipseInfluence(x, z, 1.5, -17, 8.5, 6.5) * .22
    + ellipseInfluence(x, z, 10, -23, 10.5, 8.5) * .35
    + ellipseInfluence(x, z, -5, -31, 12, 7.5) * .29;
  const unclampedRelief = sharedGroundRelief(x, z, 0x6a09e667) + broadFeatures;
  const aggregateRelief = terrainNoise(x * 1.28, z * 1.28, 0x510e527f) * .022
    + terrainNoise(x * 2.55, z * 2.55, 0x9b05688c) * .008;
  const aggregateMask = MathUtils.smoothstep(podiumClearance(x, z), 0, .38);
  // Keep the pedestal contact discs level, but let relief recover quickly outside
  // their bases so the three safety zones do not merge into one broad flat shelf.
  const podiumMask = MathUtils.smoothstep(podiumClearance(x, z), 0, 1.35);
  const socketMask = MathUtils.smoothstep(themeSocketClearance(x, z), 0, 1.8);
  const boundaryMask = groundBoundaryInfluence(x, z, JUNKYARD_GROUND);
  const relief = MathUtils.clamp(unclampedRelief, JUNKYARD_GROUND_RELIEF.min, JUNKYARD_GROUND_RELIEF.max);
  const shapedRelief = MathUtils.clamp(
    relief * podiumMask + aggregateRelief * aggregateMask,
    JUNKYARD_GROUND_RELIEF.min,
    JUNKYARD_GROUND_RELIEF.max,
  );
  return JUNKYARD_GROUND.baseY + shapedRelief * socketMask * boundaryMask;
}

export function junkyardGroundSurfaceShade(x: number, z: number): number {
  const macroVariation = terrainNoise(x * .14, z * .14, 0x3c6ef372) * .115
    + terrainNoise(x * .43, z * .43, 0xa54ff53a) * .052;
  const foregroundBreakup = -ellipseInfluence(x, z, -1.2, 3.15, 4.2, 1.55) * .13
    - ellipseInfluence(x, z, 4.5, 5.15, 3.1, 1.35) * .09
    + ellipseInfluence(x, z, -6.2, 4.65, 3.2, 1.8) * .075
    + ellipseInfluence(x, z, 7.6, 1.4, 3.4, 2.2) * .055;
  return MathUtils.clamp(
    1 + macroVariation + foregroundBreakup,
    JUNKYARD_GROUND_SURFACE_SHADE.min,
    JUNKYARD_GROUND_SURFACE_SHADE.max,
  );
}

export function junkyardGroundedPlacementY(authoredY: number, x: number, z: number): number {
  if (authoredY > .08) return authoredY;
  return authoredY + junkyardGroundHeight(x, z) - JUNKYARD_GROUND.baseY;
}

export function profilePodiumGroundHeight(x: number, z: number): number {
  const broadFeatures = ellipseInfluence(x, z, -5.8, -.2, 3.1, 2.8) * .11
    + ellipseInfluence(x, z, 5.6, -3.1, 3.2, 2.5) * .1
    - ellipseInfluence(x, z, 0, 1.7, 4.8, 1.8) * .055;
  const unclampedRelief = sharedGroundRelief(x, z, 0xbb67ae85) * .62 + broadFeatures;
  const boundaryMask = groundBoundaryInfluence(x, z, PROFILE_PODIUM_GROUND);
  const relief = MathUtils.clamp(unclampedRelief, PROFILE_PODIUM_GROUND_RELIEF.min, PROFILE_PODIUM_GROUND_RELIEF.max);
  return PROFILE_PODIUM_GROUND.baseY + relief * boundaryMask;
}

export function isJunkyardGroundScatterAllowed(x: number, z: number): boolean {
  if (Math.abs(x) > JUNKYARD_GROUND.width / 2 - 1 || z < JUNKYARD_GROUND.centerZ - JUNKYARD_GROUND.depth / 2 + 1
    || z > JUNKYARD_GROUND.centerZ + JUNKYARD_GROUND.depth / 2 - 1) return false;
  if (podiumClearance(x, z) < .85) return false;
  if (Math.abs(x) < 7.5 && z > 5.8) return false;
  return !THEME_SOCKETS.some((socket) => Math.hypot(x - socket.position[0], z - socket.position[2]) < .72);
}

export function junkyardGroundScatter(mobile: boolean, seed = 0x71d17): JunkyardScatterPlacement[] {
  const targets = mobile ? { pebble: 24, metal: 12 } : { pebble: 48, metal: 24 };
  const placements: JunkyardScatterPlacement[] = [];
  let candidate = 0;
  for (const kind of ["pebble", "metal"] as const) {
    let accepted = 0;
    while (accepted < targets[kind] && candidate < 10_000) {
      const base = seed + candidate * 19 + (kind === "metal" ? 7919 : 0); candidate += 1;
      const x = (seededUnit(base) - .5) * (JUNKYARD_GROUND.width - 3);
      const z = -3.5 + (seededUnit(base + 1) - .5) * 29;
      if (!isJunkyardGroundScatterAllowed(x, z)) continue;
      const size = kind === "pebble" ? .055 + seededUnit(base + 2) * .12 : .07 + seededUnit(base + 2) * .16;
      const height = kind === "pebble" ? size * .58 : size * .12;
      placements.push({
        kind,
        position: [x, junkyardGroundHeight(x, z) + height * .48, z],
        rotation: [seededUnit(base + 3) * Math.PI, seededUnit(base + 4) * Math.PI * 2, seededUnit(base + 5) * Math.PI],
        scale: kind === "pebble"
          ? [size * (.8 + seededUnit(base + 6) * .5), height, size]
          : [size * (1.2 + seededUnit(base + 6)), height, size * (.45 + seededUnit(base + 7) * .6)],
      });
      accepted += 1;
    }
  }
  return placements;
}

export function junkyardSmokeParticleCount(mobile: boolean): number {
  return mobile ? 20 : 36;
}

export function junkyardSmokeSample(index: number, timeSeconds: number, mobile: boolean, reducedMotion: boolean): JunkyardSmokeSample {
  const count = junkyardSmokeParticleCount(mobile);
  const normalizedIndex = ((index % count) + count) % count;
  const layer = normalizedIndex % 10 < 5 ? 0 : normalizedIndex % 10 < 8 ? 1 : 2;
  const lifetime = 12 + seededUnit(normalizedIndex * 101 + 7) * 10;
  const ageOffset = seededUnit(normalizedIndex * 101 + 8) * lifetime;
  const elapsed = Math.max(0, timeSeconds) + ageOffset;
  const cycle = reducedMotion ? 0 : Math.floor(elapsed / lifetime);
  const progress = reducedMotion ? .42 : (elapsed % lifetime) / lifetime;
  const seed = normalizedIndex * 811 + cycle * 3571 + layer * 97;
  const direction = seededUnit(seed + 6) > .5 ? 1 : -1;
  const originX = (seededUnit(seed) - .5) * (layer === 2 ? 34 : layer === 1 ? 25 : 22);
  const originY = layer === 2 ? 1.3 + seededUnit(seed + 1) * 1.15 : layer === 1 ? .72 + seededUnit(seed + 1) * .72 : .08 + seededUnit(seed + 1) * .14;
  const originZ = layer === 2 ? -15.8 + seededUnit(seed + 2) * 6.2 : layer === 1 ? -6.5 + seededUnit(seed + 2) * 6.2 : -1.5 + seededUnit(seed + 2) * 5.5;
  const travel = reducedMotion ? 0 : progress * lifetime;
  const drift = direction * (.14 + seededUnit(seed + 3) * .24);
  const width = (layer === 2 ? 5.2 : layer === 1 ? 3.8 : 3.2) * (.8 + seededUnit(seed + 4) * .65);
  const height = (layer === 0 ? 1.35 : 2.2) * (.82 + seededUnit(seed + 5) * .4);
  const fadeIn = MathUtils.smoothstep(progress, 0, .16);
  const fadeOut = 1 - MathUtils.smoothstep(progress, .7, 1);
  const baseOpacity = layer === 2 ? .14 : layer === 1 ? .19 : .2;
  return {
    position: [
      originX + drift * travel + Math.sin(timeSeconds * .23 + seed) * (reducedMotion ? 0 : .18),
      originY + travel * (layer === 0 ? .045 : .052),
      originZ + Math.sin(timeSeconds * .17 + seed * .3) * (reducedMotion ? 0 : .42),
    ],
    scale: [width * (1 + progress * .28), height * (1 + progress * .18)],
    opacity: baseOpacity * (reducedMotion ? .62 : fadeIn * fadeOut),
    rotation: reducedMotion ? (seededUnit(seed + 7) - .5) * .18 : Math.sin(timeSeconds * .08 + seed) * .18,
  };
}

export function junkyardSearchlightTarget(side: -1 | 1, timeSeconds: number, reducedMotion: boolean, phase = 0): [number, number, number] {
  if (reducedMotion) return [side * 5.25, 1.55, -14.4];
  const primary = Math.sin(timeSeconds * .31 + phase);
  const secondary = Math.sin(timeSeconds * .17 + phase * 1.7);
  return [
    side * (5.5 + primary * 4.9 + secondary * 1.45),
    1.55 + Math.sin(timeSeconds * .23 + phase * .8) * .62,
    -14.25 + Math.sin(timeSeconds * .19 + phase * 1.3) * 2.15,
  ];
}

export type JunkyardFogQualityState = { mode: "volumetric" | "fallback"; lowSamples: number; highSamples: number };

export function nextJunkyardFogQuality(
  state: JunkyardFogQualityState,
  framesPerSecond: number,
  volumetricCapable: boolean,
): JunkyardFogQualityState {
  if (!volumetricCapable) return { mode: "fallback", lowSamples: 0, highSamples: 0 };
  if (state.mode === "volumetric") {
    const lowSamples = framesPerSecond < 36 ? state.lowSamples + 1 : 0;
    return lowSamples >= 3 ? { mode: "fallback", lowSamples: 0, highSamples: 0 } : { mode: state.mode, lowSamples, highSamples: 0 };
  }
  const highSamples = framesPerSecond > 50 ? state.highSamples + 1 : 0;
  return highSamples >= 8 ? { mode: "volumetric", lowSamples: 0, highSamples: 0 } : { mode: state.mode, lowSamples: 0, highSamples };
}

const RAID_METRICS = new Set([
  "raid_damage", "rockets_used", "c4_used", "satchels_used", "explosive_ammo_used", "tcs_destroyed",
]);

export function podiumThemeFor(board: string, metric: string): PodiumThemeKey {
  if (board === "raids" || RAID_METRICS.has(metric)) return "raid-damage";
  if (board === "rp-games" || metric === "rp" || metric === "total-won") return "most-rp";
  if (metric === "npc_kills" || metric === "deaths_by_npc") return "npc-hunter";
  if (metric === "playtime" || metric === "deaths") return "neutral";
  return "most-kills";
}

export function podiumCategoryTitle(board: string, metric: string): string {
  const theme = podiumThemeFor(board, metric);
  if (theme === "most-rp") return "MOST RP";
  if (theme === "npc-hunter") return metric === "deaths_by_npc" ? "FALLEN TO NPCS" : "NPC HUNTER";
  if (theme === "raid-damage") {
    const labels: Record<string, string> = {
      rockets_used: "MOST ROCKETS", c4_used: "MOST C4", satchels_used: "MOST SATCHELS",
      explosive_ammo_used: "MOST EXPLOSIVE AMMO", tcs_destroyed: "MOST TCS DESTROYED",
    };
    return labels[metric] || "RAID DAMAGE";
  }
  if (metric === "playtime") return "MOST PLAYTIME";
  if (metric === "deaths") return "MOST DEATHS";
  if (metric === "kdr") return "BEST K/D";
  return "MOST KILLS";
}

export function clampArenaRotation(yaw: number, pitch: number, yawLimitDegrees = 75): { yaw: number; pitch: number } {
  const yawLimit = MathUtils.degToRad(Math.max(0, yawLimitDegrees));
  return {
    yaw: MathUtils.clamp(yaw, -yawLimit, yawLimit),
    pitch: MathUtils.clamp(pitch, MathUtils.degToRad(-3), MathUtils.degToRad(10)),
  };
}

export function idleArenaYawTarget(nowMs: number, lastInteractionMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const activeFor = nowMs - lastInteractionMs - ARENA_IDLE_ORBIT_RESUME_DELAY_MS;
  if (activeFor <= 0) return 0;
  return Math.sin((activeFor / ARENA_IDLE_ORBIT_CYCLE_MS) * Math.PI * 2) * ARENA_IDLE_ORBIT_AMPLITUDE;
}

export function shouldRenderArenaPlacement(id: string, mobile: boolean): boolean {
  if (!mobile || !id.startsWith("BG_DETAIL_")) return true;
  const ordinal = Number(id.match(/(\d+)$/)?.[1] || 0);
  return ordinal > 0 && ordinal % 2 === 1;
}

export function shouldLiftForwardMoundVisibility(id: string): boolean {
  return /^BG_MOUND_(?:1[2-7])$/.test(id);
}

export function orbitCameraPosition(base: Vector3, target: Vector3, yaw: number, pitch: number): Vector3 {
  const offset = base.clone().sub(target);
  const radius = Math.max(offset.length(), 0.00001);
  const baseYaw = Math.atan2(offset.x, offset.z);
  const basePitch = Math.asin(MathUtils.clamp(offset.y / radius, -1, 1));
  const elevation = MathUtils.clamp(basePitch + pitch, MathUtils.degToRad(4), MathUtils.degToRad(42));
  const horizontal = Math.cos(elevation) * radius;
  return target.clone().add(new Vector3(
    Math.sin(baseYaw + yaw) * horizontal,
    Math.sin(elevation) * radius,
    Math.cos(baseYaw + yaw) * horizontal,
  ));
}

const SHOWCASE_LAYOUT: Record<string, Partial<ArenaPlacementTransform> & { zone: ArenaShowcaseZone }> = {
  ENV_BACKWALL_01: { position: [-4.8, 2.65, -10], zone: "rear" },
  ENV_BACKWALL_02: { position: [0, 2.65, -10.2], zone: "rear" },
  ENV_BACKWALL_03: { position: [4.8, 2.65, -10], zone: "rear" },
  ENV_SIDEWALL_L: { position: [-9.35, 2.45, -4.9], rotation: [0, 48, 0], zone: "left-wing" },
  ENV_SIDEWALL_R: { position: [9.35, 2.45, -4.9], rotation: [0, -48, 0], zone: "right-wing" },
  ENV_TRUSS_L: { position: [JUNKYARD_GANTRY_LAYOUT.trussCentersX[0], JUNKYARD_GANTRY_LAYOUT.trussCenterY, JUNKYARD_GANTRY_LAYOUT.trussCenterZ], rotation: [0, 0, 90], zone: "rear" },
  ENV_TRUSS_C: { position: [JUNKYARD_GANTRY_LAYOUT.trussCentersX[1], JUNKYARD_GANTRY_LAYOUT.trussCenterY, JUNKYARD_GANTRY_LAYOUT.trussCenterZ], rotation: [0, 0, 90], zone: "rear" },
  ENV_TRUSS_R: { position: [JUNKYARD_GANTRY_LAYOUT.trussCentersX[2], JUNKYARD_GANTRY_LAYOUT.trussCenterY, JUNKYARD_GANTRY_LAYOUT.trussCenterZ], rotation: [0, 0, 90], zone: "rear" },
  L_JUNK_A: { position: [-6.55, -.15, -7.78], rotation: [3, 44, -11], zone: "rear" },
  L_JUNK_B: { position: [-23, 0, -12], rotation: [0, 82, 0], zone: "left-wing" },
  C_JUNK_C: { position: [22, 0, -7], rotation: [0, -78, 0], zone: "right-wing" },
  C_JUNK_D: { position: [-22, 0, -7], rotation: [0, 78, 0], zone: "left-wing" },
  R_JUNK_E: { position: [6.1, -.18, -7.58], rotation: [-3, -42, 13], zone: "rear" },
  R_JUNK_F: { position: [23, 0, -12], rotation: [0, -82, 0], zone: "right-wing" },
  C_SKIP: { position: [.2, -.08, -8.65], rotation: [0, -2, 0], zone: "rear" },
  C_COVER_PANEL: { position: [.1, .18, -9.15], rotation: [0, -5, -7], zone: "rear" },
  L_BARRICADE_WOOD: { position: [-20.5, .02, -6.5], rotation: [0, 78, -5], zone: "left-wing" },
  L_BARBEDWIRE: { position: [-5.05, 1.05, -9.35], rotation: [0, 98, -3], zone: "rear" },
  C_BARBED_TOP: { position: [0, 3.1, -9.5], rotation: [0, 90, 2], zone: "rear" },
  R_BARBED_BEND: { position: [6.25, 1.05, -8.9], rotation: [0, -20, 0], zone: "rear" },
  L_SHELF_01: { position: [-18.5, 0, -9.5], rotation: [0, 78, 0], zone: "left-wing" },
  L_WORKBENCH_01: { position: [-20, 0, -5], rotation: [0, 82, 0], zone: "left-wing" },
  L_TURRET_50CAL: { position: [-21, .52, -5.5], rotation: [0, 78, 0], zone: "left-wing" },
  L_CRATE_A: { position: [-12, 0, -5.5], rotation: [0, 42, 0], zone: "left-wing" },
  L_CRATE_B: { position: [-12.6, .54, -5.9], rotation: [0, 28, 2], zone: "left-wing" },
  L_CRATE_C: { position: [-5.55, 0, -.75], rotation: [0, -18, 0], zone: "podium" },
  L_BARREL_RAD: { position: [-13, 0, -6.8], rotation: [0, 38, 0], zone: "left-wing" },
  L_BARREL_DENTED: { position: [-12.2, 0, -6.3], rotation: [0, -18, 4], zone: "left-wing" },
  L_WEAPON_THOMPSON: { position: [-5.25, .02, -1.2], rotation: [0, 14, -68], zone: "podium" },
  C_WEAPON_L96: { position: [-1.65, .02, -1.55], rotation: [0, -8, -66], zone: "podium" },
  C_WEAPON_M39: { position: [1.65, .02, -1.55], rotation: [0, 8, 66], zone: "podium" },
  C_MINIGUN: { position: [2.15, .02, -1.8], rotation: [0, -18, 10], zone: "podium" },
  R_SHELF_01: { position: [18.5, 0, -9.5], rotation: [0, -78, 0], zone: "right-wing" },
  R_ROCKET_LAUNCHER: { position: [5.25, .02, -1.2], rotation: [0, -14, 68], zone: "podium" },
  R_MISSILE_POD: { position: [12, .8, -6.5], rotation: [0, -52, 6], zone: "right-wing" },
  R_ATTACKHELI_TURRET: { position: [21, .63, -5.5], rotation: [0, -78, 0], zone: "right-wing" },
  R_HELI_GUN: { position: [13, .02, -6.8], rotation: [8, -72, 18], zone: "right-wing" },
  R_HELI_COCKPIT: { position: [21, -.05, -8], rotation: [0, -82, -5], zone: "right-wing" },
  R_HELI_TAIL: { position: [23, .1, -12], rotation: [5, 78, -12], zone: "right-wing" },
  R_HELI_DOOR: { position: [20.5, .18, -6.5], rotation: [0, -82, 77], zone: "right-wing" },
  R_RUSTY_CAR: { position: [12.8, -.18, -9], rotation: [4, -67, -9], zone: "right-wing" },
  R_CRATE_A: { position: [12, 0, -5.5], rotation: [0, -42, 0], zone: "right-wing" },
  R_CRATE_B: { position: [12.6, .52, -5.9], rotation: [0, -28, 1], zone: "right-wing" },
  R_BARREL_RED: { position: [5.55, 0, -.65], rotation: [0, 18, 0], zone: "podium" },
  R_BARREL_YELLOW: { position: [12.2, 0, -6.3], rotation: [0, 18, 0], zone: "right-wing" },
  R_JERRYCAN_BLACK: { position: [5.45, .02, -.9], rotation: [0, -20, 0], zone: "podium" },
  R_JERRYCAN_YELLOW: { position: [5.72, .02, -.82], rotation: [0, 22, 0], zone: "podium" },
  FG_WHEEL_L: { position: [-13, .16, -4.8], rotation: [90, 22, 18], zone: "left-wing" },
  FG_WHEEL_R: { position: [13, .15, -4.8], rotation: [90, -22, -22], zone: "right-wing" },
  FIX_SEARCH_L: { position: [-20.5, 4.65, -7], rotation: [12, 78, 0], zone: "left-wing" },
  FIX_SEARCH_R: { position: [20.5, 4.72, -7], rotation: [13, -78, 0], zone: "right-wing" },
  FIX_CEILING_L: { position: [-2.65, 5, -6.25], zone: "rear" },
  FIX_CEILING_R: { position: [2.65, 5.02, -6.25], zone: "rear" },
  FIX_BARREL_LIGHT: { position: [-13.2, 0, -7.2], rotation: [0, 62, 0], zone: "left-wing" },
  FIX_LIGHTPOST_R: { position: [13.2, 0, -7.2], rotation: [0, -48, 0], zone: "right-wing" },
  FIX_FOG_L: { position: [-13, .02, -6.6], rotation: [0, 68, 0], zone: "left-wing" },
  FIX_FOG_C: { position: [0, .02, -5.3], zone: "rear" },
  FIX_FOG_R: { position: [13, .02, -6.6], rotation: [0, -68, 0], zone: "right-wing" },
};

export function arenaPlacementTransform(placement: Pick<ArenaPlacement, "id" | "position" | "rotation">): ArenaPlacementTransform {
  const authored = SHOWCASE_LAYOUT[placement.id];
  return {
    position: authored?.position || placement.position,
    rotation: authored?.rotation || placement.rotation,
    zone: authored?.zone || (placement.position[2] < -3.5 ? "rear" : placement.position[0] < 0 ? "left-wing" : "right-wing"),
  };
}

export function normalizationScale(bounds: Box3, placement: Pick<ArenaPlacement, "normalizeMode" | "targetExtent">): number {
  if (/native-meters preferred/i.test(placement.normalizeMode)) return 1;
  const size = bounds.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z, 0.00001);
  return Math.max(0.00001, placement.targetExtent) / extent;
}

export function anchorPoint(bounds: Box3, anchor: string): Vector3 {
  const center = bounds.getCenter(new Vector3());
  if (/bottom|feet|ground/i.test(anchor)) return new Vector3(center.x, bounds.min.y, center.z);
  return center;
}

type ThemeSocket = {
  position: [number, number, number];
  rotation: [number, number, number];
  zone: Extract<ArenaShowcaseZone, "podium" | "left-wing" | "right-wing" | "foreground">;
};

const THEME_SOCKETS: ThemeSocket[] = [
  { position: [-5.35, .03, -1.2], rotation: [0, 22, -8], zone: "podium" },
  { position: [-8, .03, -4.8], rotation: [0, 48, 0], zone: "left-wing" },
  { position: [-3.15, .03, -1.45], rotation: [0, -18, 6], zone: "podium" },
  { position: [8, .03, -4.8], rotation: [0, -48, 0], zone: "right-wing" },
  { position: [-1.35, .03, -1.65], rotation: [0, 14, -4], zone: "podium" },
  { position: [-8, .03, 4.75], rotation: [0, 68, -4], zone: "left-wing" },
  { position: [1.35, .03, -1.65], rotation: [0, -14, 4], zone: "podium" },
  { position: [8, .03, 4.75], rotation: [0, -68, 4], zone: "right-wing" },
  { position: [3.15, .03, -1.45], rotation: [0, 18, -6], zone: "podium" },
  { position: [-9.2, .03, 6.8], rotation: [0, 72, 0], zone: "left-wing" },
  { position: [5.35, .03, -1.2], rotation: [0, -22, 8], zone: "podium" },
  { position: [9.2, .03, 6.8], rotation: [0, -72, 0], zone: "right-wing" },
  { position: [-10.2, .03, 9], rotation: [0, 78, -5], zone: "foreground" },
  { position: [10.2, .03, 9], rotation: [0, -78, 5], zone: "foreground" },
  { position: [-12, .03, 10.5], rotation: [0, 82, 0], zone: "foreground" },
];

export function showcaseThemeSockets(): ReadonlyArray<ThemeSocket> {
  return THEME_SOCKETS;
}

function themeExtent(asset: ArenaThemeAsset): number {
  const name = `${asset.name} ${asset.localPath}`.toLowerCase();
  if (/mannequin/.test(name)) return 1.82;
  if (/car|pickup|helicopter/.test(name)) return 3.2;
  if (/junkyard|cover|barricade|rubble|conc_pile/.test(name)) return 2.05;
  if (/rocket_mlrs|launcher|lr300|ak47|mp5|spas|hmlmg/.test(name)) return 1.15;
  if (/barrel|cargo/.test(name)) return 0.92;
  if (/wheel/.test(name)) return 0.74;
  if (/toolbox/.test(name)) return 0.58;
  return 1;
}

export function generatedThemePlacements(themeKey: string, theme: ArenaTheme): ArenaPlacement[] {
  if (themeKey === "most-kills" && theme.placements.length) {
    return theme.placements.map((placement) => ({ ...placement }));
  }
  const placements: ArenaPlacement[] = [];
  let socketIndex = 0;
  for (const asset of theme.assets) {
    const count = Math.min(Math.max(1, Math.round(asset.quantity)), 4);
    for (let index = 0; index < count && socketIndex < THEME_SOCKETS.length; index += 1) {
      const socket = THEME_SOCKETS[socketIndex++];
      const weapon = /weapon|rifle|rocket|launcher|lr300|ak47|mp5|spas|hmlmg/i.test(`${asset.slot} ${asset.localPath}`);
      placements.push({
        id: `THEME_${themeKey}_${asset.kitId}_${index + 1}`,
        enabled: true,
        zone: `Theme ${socket.zone}`,
        parent: "THEME",
        role: asset.slot,
        sourcePath: asset.sourcePath,
        localPath: asset.localPath,
        position: socket.position,
        rotation: weapon ? [socket.rotation[0], socket.rotation[1], index % 2 ? 62 : -58] : socket.rotation,
        scale: [1, 1, 1],
        normalizeMode: "AABB bottom-center; preserve aspect",
        targetExtent: themeExtent(asset),
        anchor: weapon ? "Object center" : "Bottom-center",
        castShadow: true,
        receiveShadow: true,
        lodClass: socketIndex < 11 ? "Primary" : "Secondary",
        occlusionPriority: socketIndex < 11 ? "High" : "Medium",
        renderOrder: 0,
      });
    }
  }
  return placements;
}
