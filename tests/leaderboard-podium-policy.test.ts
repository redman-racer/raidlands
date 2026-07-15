import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEADERBOARD_PODIUM_THEMES, leaderboardPodiumMetricValue } from "../assets/ts/leaderboard-podium/policy";

describe("leaderboard podium policy", () => {
  it("maps every existing metric to installed RustRelay props", () => {
    expect(Object.keys(LEADERBOARD_PODIUM_THEMES).sort()).toEqual([
      "deaths", "deaths_by_npc", "kdr", "kills", "npc_kills", "playtime", "rp", "total-won",
    ]);

    for (const files of Object.values(LEADERBOARD_PODIUM_THEMES)) {
      expect(files).toHaveLength(3);
      for (const file of files) {
        expect(existsSync(resolve(__dirname, "../assets/media/models/leaderboard", file))).toBe(true);
      }
    }
  });

  it("formats player, bot, and RP game podium values", () => {
    expect(leaderboardPodiumMetricValue({ kdr: 2 }, "players", "kdr")).toEqual(["2.00", "K/D"]);
    expect(leaderboardPodiumMetricValue({ playtime_seconds: 5025 }, "players", "playtime")).toEqual(["1h 23m", "played"]);
    expect(leaderboardPodiumMetricValue({ deaths: 1200 }, "bots", "deaths")).toEqual(["1,200", "deaths"]);
    expect(leaderboardPodiumMetricValue({ total_rp_won: 3200 }, "rp-games", "total-won")).toEqual(["3,200", "RP won"]);
  });
});
