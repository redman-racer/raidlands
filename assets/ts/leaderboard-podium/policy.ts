export type Leader = Record<string, unknown>;

export const LEADERBOARD_PODIUM_THEMES: Record<string, string[]> = {
  kills: ["ak47.glb", "reactive-target.glb", "ammo.glb"],
  kdr: ["trophy.glb", "reactive-target.glb", "ak47.glb"],
  playtime: ["sleeping-bag.glb", "campfire.glb", "digital-clock.glb"],
  rp: ["scrap.glb", "loot-crate.glb", "trophy.glb"],
  npc_kills: ["scientist.glb", "ak47.glb", "loot-crate.glb"],
  deaths_by_npc: ["scientist.glb", "skull.glb", "sleeping-bag.glb"],
  deaths: ["skull.glb", "sleeping-bag.glb", "ak47.glb"],
  "total-won": ["scrap.glb", "loot-crate.glb", "trophy.glb"],
};

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
  return [number(row.kills), "kills"];
}
