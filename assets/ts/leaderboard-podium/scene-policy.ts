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

export function clampArenaRotation(yaw: number, pitch: number): { yaw: number; pitch: number } {
  return {
    yaw: MathUtils.clamp(yaw, MathUtils.degToRad(-18), MathUtils.degToRad(18)),
    pitch: MathUtils.clamp(pitch, MathUtils.degToRad(-3), MathUtils.degToRad(10)),
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
};

const THEME_SOCKETS: ThemeSocket[] = [
  { position: [-6.25, 0.02, -3.25], rotation: [0, 22, 0] },
  { position: [-5.35, 0.08, -2.35], rotation: [0, -18, -8] },
  { position: [-3.25, 0.02, -3.2], rotation: [0, 15, 0] },
  { position: [-2.35, 0.08, -2.55], rotation: [0, -12, 0] },
  { position: [-1.55, 0.04, -3.45], rotation: [0, 18, 0] },
  { position: [-0.9, 0.08, -2.35], rotation: [0, -15, -5] },
  { position: [0, 0.03, -3.55], rotation: [0, 0, 0] },
  { position: [0.95, 0.08, -2.38], rotation: [0, 14, 5] },
  { position: [1.65, 0.03, -3.42], rotation: [0, -18, 0] },
  { position: [2.45, 0.06, -2.62], rotation: [0, 12, 0] },
  { position: [3.3, 0.02, -3.25], rotation: [0, -16, 0] },
  { position: [4.8, 0.08, -2.38], rotation: [0, 18, 8] },
  { position: [5.8, 0.02, -3.22], rotation: [0, -22, 0] },
  { position: [-6.75, 0.0, -4.35], rotation: [0, 28, 0] },
  { position: [6.8, 0.0, -4.4], rotation: [0, -28, 0] },
];

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
  if (theme.placements.length) return theme.placements;
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
        zone: "Theme",
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
