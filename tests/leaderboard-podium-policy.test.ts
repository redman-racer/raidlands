import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_PRESETS, LEADERBOARD_PODIUM_THEMES,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "../assets/ts/leaderboard-podium/policy";
import { Group, Object3D, Vector3 } from "three";
import {
  MANNEQUIN_ANCHORS, normalizeWearableOrigin, podiumCharacterYaw, podiumWeaponLayout,
} from "../assets/ts/leaderboard-podium/layout";

function anchoredRoot(anchors: Record<string, [number, number, number]>): Group {
  const root = new Group();
  Object.entries(anchors).forEach(([name, position]) => {
    const bone = new Object3D(); bone.name = name; bone.position.set(...position); root.add(bone);
  });
  return root;
}

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

  it("normalizes translated and differently scaled wearables to one mannequin origin", () => {
    const pants = anchoredRoot({ pelvis: [0, 0.936, -0.015], l_toe: [0.1880345, 0.0059, 0.0117] });
    const pantsResult = normalizeWearableOrigin(pants);
    expect(pantsResult.scale).toBeCloseTo(1, 3);
    const pelvis = pants.getObjectByName("pelvis")!.getWorldPosition(new Vector3());
    expect(pelvis.x).toBeCloseTo(MANNEQUIN_ANCHORS.pelvis[0], 4);
    expect(pelvis.y).toBeCloseTo(MANNEQUIN_ANCHORS.pelvis[1], 4);
    expect(pelvis.z).toBeCloseTo(MANNEQUIN_ANCHORS.pelvis[2], 4);

    const ninja = anchoredRoot({ pelvis: [0, 0.003283832, -0.0003834376], head: [0, 0.009581, -0.000531] });
    const ninjaResult = normalizeWearableOrigin(ninja);
    expect(ninjaResult.scale).toBeCloseTo(100, 0);
    const head = ninja.getObjectByName("head")!.getWorldPosition(new Vector3());
    expect(head.y).toBeCloseTo(MANNEQUIN_ANCHORS.head[1], 3);
  });

  it("faces characters toward the camera and floats weapons beside them", () => {
    expect(podiumCharacterYaw(0)).toBe(0);
    expect(Math.abs(podiumCharacterYaw(1))).toBeLessThan(Math.PI / 2);
    const centerRifle = podiumWeaponLayout("ak47", 0);
    const leftRocket = podiumWeaponLayout("rocket-launcher", 1);
    expect(centerRifle.position[0]).toBeGreaterThan(0.8);
    expect(leftRocket.position[0]).toBeLessThan(-0.8);
    expect(leftRocket.rotation[1]).toBe(Math.PI / 2);
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
