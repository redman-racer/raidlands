export type PodiumWearable = { asset?: string; skin_id?: string };
export type PodiumWeapon = { asset?: string; shortname?: string; skin_id?: string; label?: string; source?: string } | null;
export type PodiumBoneRotation = { x?: number; y?: number; z?: number };
export type PodiumPose = { key?: string; label?: string; bones?: Record<string, PodiumBoneRotation> };
export type PodiumAppearance = {
  preset?: string;
  label?: string;
  source?: string;
  wearables?: PodiumWearable[];
  weapon?: PodiumWeapon;
  pose?: PodiumPose;
};
export type Leader = Record<string, unknown> & { appearance?: PodiumAppearance };

export const LEADERBOARD_PODIUM_ASSETS: Record<string, string> = {
  "body-head": "body-head.glb",
  "body-torso": "body-torso.glb",
  "body-legs": "body-legs.glb",
  "body-hands": "body-hands.glb",
  "body-feet": "body-feet.glb",
  hoodie: "hoodie.glb",
  pants: "pants.glb",
  boots: "boots.glb",
  "tactical-gloves": "tactical-gloves.glb",
  "roadsign-kilt": "roadsign-kilt.glb",
  "metal-chestplate": "metal-chestplate.glb",
  "metal-facemask": "metal-facemask.glb",
  hazmat: "hazmat.glb",
  "arctic-hazmat": "arctic-hazmat.glb",
  "ninja-suit": "ninja-suit.glb",
  "heavy-scientist": "heavy-scientist.glb",
  ak47: "ak47.glb",
  thompson: "thompson.glb",
  sar: "sar.glb",
  sap: "sap.glb",
  "rocket-launcher": "rocket-launcher.glb",
};

export const LEADERBOARD_PODIUM_PRESETS: Record<string, string[]> = {
  "fully-heavy": [
    "body-head", "body-torso", "body-legs", "body-hands", "body-feet",
    "hoodie", "pants", "boots", "tactical-gloves", "roadsign-kilt", "metal-chestplate", "metal-facemask",
  ],
  survivor: ["body-head", "body-torso", "body-legs", "body-hands", "body-feet", "hoodie", "pants", "boots"],
  hazmat: ["hazmat"],
  arctic: ["arctic-hazmat"],
  ninja: ["ninja-suit"],
  heavy: ["heavy-scientist"],
};

export const LEADERBOARD_PODIUM_THEMES: Record<string, string[]> = {
  kills: ["ammo.glb", "reactive-target.glb"],
  kdr: ["trophy.glb", "ammo.glb"],
  playtime: ["campfire.glb", "digital-clock.glb"],
  rp: ["scrap.glb", "loot-crate.glb"],
  npc_kills: ["scientist.glb", "ak47.glb"],
  deaths_by_npc: ["scientist.glb", "skull.glb"],
  deaths: ["skull.glb", "sleeping-bag.glb"],
  "total-won": ["scrap.glb", "trophy.glb"],
  raid_damage: ["rocket-launcher.glb", "ammo.glb"],
  rockets_used: ["rocket-launcher.glb", "ammo.glb"],
  c4_used: ["rocket-launcher.glb", "loot-crate.glb"],
  satchels_used: ["rocket-launcher.glb", "loot-crate.glb"],
  explosive_ammo_used: ["ammo.glb", "reactive-target.glb"],
  tcs_destroyed: ["rocket-launcher.glb", "reactive-target.glb"],
  airstrike_kills: ["rocket-launcher.glb", "ammo.glb"],
  vehicle_kills: ["rocket-launcher.glb", "reactive-target.glb"],
};

export function podiumWearables(leader: Leader, fallbackIndex = 0): string[] {
  const supplied = Array.isArray(leader.appearance?.wearables)
    ? leader.appearance!.wearables!.map((item) => String(item?.asset || "")).filter((key) => Boolean(LEADERBOARD_PODIUM_ASSETS[key]))
    : [];
  if (supplied.length) return [...new Set(supplied)];
  return LEADERBOARD_PODIUM_PRESETS["fully-heavy"];
}

export function podiumWeapon(leader: Leader): string {
  const asset = String(leader.appearance?.weapon?.asset || "");
  return LEADERBOARD_PODIUM_ASSETS[asset] ? asset : "";
}

function number(value: unknown): string {
  return Math.max(0, Number(value) || 0).toLocaleString("en-US");
}

function duration(value: unknown): string {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours.toLocaleString("en-US")}h ${minutes}m` : `${minutes}m`;
}

export function leaderboardPodiumMetricValue(row: Leader, board: string, metric: string): [string, string] {
  if (board === "rp-games") return [number(row.total_rp_won), "RP won"];
  if (metric === "kdr") return [(Number(row.kdr) || 0).toFixed(2), "K/D"];
  if (metric === "playtime") return [duration(row.playtime_seconds), "played"];
  if (metric === "rp") return [number(row.reward_points), "RP"];
  if (metric === "npc_kills") return [number(row.npc_kills), "NPC kills"];
  if (metric === "deaths_by_npc") return [number(row.deaths_by_npc), "NPC deaths"];
  if (metric === "deaths") return [number(row.deaths), "deaths"];
  if (metric === "raid_damage") return [number(row.raid_damage), "damage"];
  if (metric === "rockets_used") return [number(row.rockets_used), "rockets"];
  if (metric === "c4_used") return [number(row.c4_used), "C4"];
  if (metric === "satchels_used") return [number(row.satchels_used), "satchels"];
  if (metric === "explosive_ammo_used") return [number(row.explosive_ammo_used), "explosive rounds"];
  if (metric === "tcs_destroyed") return [number(row.tcs_destroyed), "TCs broken"];
  return [number(row.kills), "kills"];
}
