import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_PRESETS, LEADERBOARD_PODIUM_THEMES,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "../assets/ts/leaderboard-podium/policy";
import { Box3, Group, Object3D, Vector3 } from "three";
import {
  MANNEQUIN_ANCHORS, normalizeWearableOrigin, podiumCharacterYaw, podiumWeaponLayout,
} from "../assets/ts/leaderboard-podium/layout";
import {
  buildIndustrialPedestal, pedestalConfigForRank, pedestalRanksForLayout,
} from "../assets/ts/leaderboard-podium/pedestal";
import {
  anchorPoint, arenaPlacementTransform, ArenaManifest, clampArenaRotation, generatedThemePlacements,
  normalizationScale, orbitCameraPosition, podiumCategoryTitle, podiumThemeFor, showcaseThemeSockets,
} from "../assets/ts/leaderboard-podium/scene-policy";

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

  it("builds the specified industrial pedestal hierarchy and bounds", () => {
    const result = buildIndustrialPedestal(pedestalConfigForRank(1, 48));
    result.root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(result.root); const size = bounds.getSize(new Vector3());
    expect(result.root.name).toBe("PedestalRootRank1");
    expect(size.x).toBeCloseTo(2.46, 1);
    expect(result.standingHeight).toBeCloseTo(0.63, 3);
    expect(result.root.getObjectByName("BottomFootplate")).toBeTruthy();
    expect(result.root.getObjectByName("MainDrum")).toBeTruthy();
    expect(result.root.getObjectByName("UpperRim")).toBeTruthy();
    expect(result.root.getObjectByName("TopDeck")).toBeTruthy();
    expect(result.root.getObjectByName("CharacterAnchor")?.position.y).toBeCloseTo(0.63, 3);
  });

  it("places a readable rank plate on positive Z and applies rank variants", () => {
    ([1, 2, 3] as const).forEach((rank) => {
      const config = pedestalConfigForRank(rank, 8);
      const result = buildIndustrialPedestal(config);
      expect(config.segments).toBe(32);
      expect(result.root.getObjectByName("RankPlate")?.position.z).toBeGreaterThan(1);
      expect(result.root.getObjectByName(`RankNumeral${rank}`)).toBeTruthy();
      expect(result.standingHeight).toBeCloseTo(0.63 * config.verticalScale, 4);
    });
    expect(pedestalConfigForRank(1).horizontalScale).toBe(1);
    expect(pedestalConfigForRank(2).horizontalScale).toBeCloseTo(0.84);
    expect(pedestalConfigForRank(3).verticalScale).toBeCloseTo(0.69);
  });

  it("selects one profile pedestal or the full leaderboard trio", () => {
    expect(pedestalRanksForLayout("single")).toEqual([1]);
    expect(pedestalRanksForLayout("trio")).toEqual([1, 2, 3]);
    expect(pedestalRanksForLayout("unexpected")).toEqual([1, 2, 3]);
  });

  it("maps live leaderboard views to the approved arena themes and titles", () => {
    expect(podiumThemeFor("players", "kills")).toBe("most-kills");
    expect(podiumThemeFor("players", "rp")).toBe("most-rp");
    expect(podiumThemeFor("players", "npc_kills")).toBe("npc-hunter");
    expect(podiumThemeFor("raids", "c4_used")).toBe("raid-damage");
    expect(podiumThemeFor("players", "playtime")).toBe("neutral");
    expect(podiumCategoryTitle("raids", "tcs_destroyed")).toBe("MOST TCS DESTROYED");
  });

  it("normalizes placement bounds, anchors ground contact, and clamps responsive drag rotation", () => {
    const bounds = new Box3(new Vector3(-1, 0, -.5), new Vector3(1, 2, .5));
    expect(normalizationScale(bounds, { normalizeMode: "AABB bottom-center", targetExtent: 4 })).toBeCloseTo(2);
    expect(normalizationScale(bounds, { normalizeMode: "Native-meters preferred", targetExtent: 4 })).toBe(1);
    expect(anchorPoint(bounds, "Bottom-center").toArray()).toEqual([0, 0, 0]);
    const clamped = clampArenaRotation(Math.PI, -Math.PI);
    const mobile = clampArenaRotation(-Math.PI, Math.PI, 60);
    expect(clamped.yaw).toBeCloseTo(75 * Math.PI / 180);
    expect(clamped.pitch).toBeCloseTo(-3 * Math.PI / 180);
    expect(mobile.yaw).toBeCloseTo(-60 * Math.PI / 180);
    expect(mobile.pitch).toBeCloseTo(10 * Math.PI / 180);
  });

  it("orbits the camera around a stable target without changing its radius", () => {
    const base = new Vector3(0, 3.25, 11.7); const target = new Vector3(0, 1.42, -.35);
    const right = orbitCameraPosition(base, target, Math.PI / 3, 0);
    const left = orbitCameraPosition(base, target, -Math.PI / 3, 0);
    expect(right.x).toBeGreaterThan(9);
    expect(left.x).toBeLessThan(-9);
    expect(right.distanceTo(target)).toBeCloseTo(base.distanceTo(target), 5);
    expect(left.distanceTo(target)).toBeCloseTo(base.distanceTo(target), 5);
  });

  it("authors a U-shaped arena with protected foreground edges", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json"), "utf8")) as ArenaManifest;
    const transformed = manifest.basePlacements.map(arenaPlacementTransform);
    expect(transformed.filter((placement) => placement.zone === "rear").length).toBeGreaterThan(10);
    expect(transformed.filter((placement) => placement.zone === "left-wing").length).toBeGreaterThan(8);
    expect(transformed.filter((placement) => placement.zone === "right-wing").length).toBeGreaterThan(8);
    const foreground = transformed.filter((placement) => placement.zone === "foreground");
    expect(foreground.length).toBeGreaterThanOrEqual(4);
    foreground.forEach((placement) => expect(Math.abs(placement.position[0])).toBeGreaterThanOrEqual(5.8));
  });

  it("vendors the complete pinned scene with valid hashes and deterministic theme sockets", () => {
    const manifestPath = resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json");
    const manifestText = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText) as ArenaManifest;
    expect(manifestText).not.toMatch(/https?:\/\//i);
    expect(manifest.revision).toBe("494242bdeae941e3389b34a819c514aae2cf39f8");
    expect(manifest.assets).toHaveLength(76);
    expect(manifest.basePlacements).toHaveLength(81);
    expect(manifest.characterAnchors).toHaveLength(3);
    expect(Object.keys(manifest.themes)).toHaveLength(6);
    for (const asset of manifest.assets) {
      expect(asset.sourcePath.startsWith("assets/")).toBe(true);
      expect(asset.localPath.includes("../")).toBe(false);
      const local = resolve(__dirname, "../assets/media/models/leaderboard-scene", asset.localPath);
      const bytes = readFileSync(local);
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    }
    const rp = generatedThemePlacements("most-rp", manifest.themes["most-rp"]);
    const sockets = showcaseThemeSockets();
    expect(sockets).toHaveLength(15);
    expect(sockets.filter((socket) => socket.zone === "podium")).toHaveLength(6);
    expect(sockets.filter((socket) => /wing$/.test(socket.zone))).toHaveLength(6);
    expect(sockets.filter((socket) => socket.zone === "foreground")).toHaveLength(3);
    sockets.filter((socket) => socket.zone === "foreground").forEach((socket) => expect(Math.abs(socket.position[0])).toBeGreaterThanOrEqual(5.8));
    expect(rp.length).toBeGreaterThan(8);
    expect(rp.length).toBeLessThanOrEqual(15);
    rp.filter((placement) => /weapon|rifle|launcher|gun/i.test(`${placement.role} ${placement.localPath}`))
      .forEach((placement) => expect(placement.position[1]).toBeLessThanOrEqual(.04));
    expect(generatedThemePlacements("most-rp", manifest.themes["most-rp"])).toEqual(rp);
  });

  it("ships a generated local WebP fallback poster", () => {
    const poster = readFileSync(resolve(__dirname, "../assets/media/leaderboard-podium-poster.webp"));
    expect(poster.byteLength).toBeGreaterThan(20_000);
    expect(poster.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(poster.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});
