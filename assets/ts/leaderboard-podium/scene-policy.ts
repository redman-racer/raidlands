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
  ENV_TRUSS_L: { position: [-4.1, 5.35, -7.25], rotation: [0, -8, 90], zone: "rear" },
  ENV_TRUSS_R: { position: [4.1, 5.35, -7.25], rotation: [0, 8, 90], zone: "rear" },
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
