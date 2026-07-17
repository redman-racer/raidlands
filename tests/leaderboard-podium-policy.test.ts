import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_PRESETS, LEADERBOARD_PODIUM_THEMES,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "../assets/ts/leaderboard-podium/policy";

describe("leaderboard podium policy", () => {
  it("maps every existing metric to installed RustRelay props", () => {
    for (const files of Object.values(LEADERBOARD_PODIUM_THEMES)) {
      expect(files).toHaveLength(2);
      for (const file of files) {
        expect(existsSync(resolve(__dirname, "../assets/media/models/leaderboard", file))).toBe(true);
      }
    }
  });

  it("maps every curated mannequin layer and weapon to an installed RustRelay model", () => {
    for (const file of Object.values(LEADERBOARD_PODIUM_ASSETS)) {
      expect(existsSync(resolve(__dirname, "../assets/media/models/leaderboard", file))).toBe(true);
    }
    for (const assets of Object.values(LEADERBOARD_PODIUM_PRESETS)) {
      expect(assets.length).toBeGreaterThan(0);
      assets.forEach((asset) => expect(LEADERBOARD_PODIUM_ASSETS[asset]).toBeTruthy());
    }
  });

  it("uses resolved appearances and safe deterministic fallbacks", () => {
    expect(podiumWearables({ appearance: { wearables: [{ asset: "hazmat" }, { asset: "missing" }] } })).toEqual(["hazmat"]);
    expect(podiumWearables({}, 0)).toEqual(LEADERBOARD_PODIUM_PRESETS.survivor);
    expect(podiumWeapon({ appearance: { weapon: { asset: "ak47" } } })).toBe("ak47");
    expect(podiumWeapon({ appearance: { weapon: { asset: "missing" } } })).toBe("");
  });

  it("formats player, raid, bot, and RP game podium values", () => {
    expect(leaderboardPodiumMetricValue({ kdr: 2 }, "players", "kdr")).toEqual(["2.00", "K/D"]);
    expect(leaderboardPodiumMetricValue({ playtime_seconds: 5025 }, "players", "playtime")).toEqual(["1h 23m", "played"]);
    expect(leaderboardPodiumMetricValue({ raid_damage: 125000 }, "raids", "raid_damage")).toEqual(["125,000", "damage"]);
    expect(leaderboardPodiumMetricValue({ tcs_destroyed: 12 }, "raids", "tcs_destroyed")).toEqual(["12", "TCs broken"]);
    expect(leaderboardPodiumMetricValue({ deaths: 1200 }, "bots", "deaths")).toEqual(["1,200", "deaths"]);
    expect(leaderboardPodiumMetricValue({ total_rp_won: 3200 }, "rp-games", "total-won")).toEqual(["3,200", "RP won"]);
  });
});
