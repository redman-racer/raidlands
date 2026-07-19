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
  anchorPoint, ARENA_IDLE_ORBIT_AMPLITUDE, ARENA_IDLE_ORBIT_CYCLE_MS, ARENA_IDLE_ORBIT_RESUME_DELAY_MS,
  arenaPlacementTransform, ArenaManifest, clampArenaRotation, FORWARD_MOUND_VISIBILITY,
  generatedThemePlacements, idleArenaYawTarget, isBarbedWirePlacement, isJunkyardGroundScatterAllowed, JUNKYARD_ATMOSPHERE, JUNKYARD_GANTRY_LAYOUT, JUNKYARD_GROUND,
  JUNKYARD_PODIUM_CENTERS_X,
  JUNKYARD_GROUND_RELIEF, JUNKYARD_GROUND_SURFACE_SHADE,
  JunkyardFogQualityState, junkyardFallbackFogLayers, junkyardFogVerticalProfile, junkyardGroundedPlacementY,
  junkyardGroundHeight, junkyardGroundScatter, junkyardGroundSurfaceShade,
  junkyardPodiumFogInfluence, junkyardSearchlightTarget, junkyardSmokeParticleCount, junkyardSmokeSample,
  nextJunkyardFogQuality, normalizationScale, orbitCameraPosition, podiumCategoryTitle, podiumGroundMaterialState, podiumThemeFor,
  PROFILE_PODIUM_GROUND, PROFILE_PODIUM_GROUND_RELIEF, profilePodiumGroundHeight,
  shouldLiftForwardMoundVisibility, shouldRenderArenaPlacement, showcaseThemeSockets,
} from "../assets/ts/leaderboard-podium/scene-policy";

function anchoredRoot(anchors: Record<string, [number, number, number]>): Group {
  const root = new Group();
  Object.entries(anchors).forEach(([name, position]) => {
    const bone = new Object3D(); bone.name = name; bone.position.set(...position); root.add(bone);
  });
  return root;
}

describe("leaderboard podium policy", () => {
  it("identifies only the scene's alpha-cutout barbed-wire placements", () => {
    expect(isBarbedWirePlacement("L_BARBEDWIRE")).toBe(true);
    expect(isBarbedWirePlacement("C_BARBED_TOP")).toBe(true);
    expect(isBarbedWirePlacement("R_BARBED_BEND")).toBe(true);
    expect(isBarbedWirePlacement("ENV_BACKWALL")).toBe(false);
  });

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
    expect(centerRifle.position[0]).toBeGreaterThan(0.3);
    expect(centerRifle.position[0]).toBeLessThan(0.6);
    expect(centerRifle.position[1]).toBeCloseTo(1.24);
    expect(leftRocket.position[0]).toBeCloseTo(-0.5);
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
    expect(result.standingHeight).toBeCloseTo(0.63 * pedestalConfigForRank(1).verticalScale, 3);
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
    expect(pedestalConfigForRank(3).verticalScale).toBeCloseTo(1.03);
  });

  it("selects one profile pedestal or the full leaderboard trio", () => {
    expect(pedestalRanksForLayout("single")).toEqual([1]);
    expect(pedestalRanksForLayout("trio")).toEqual([1, 2, 3]);
    expect(pedestalRanksForLayout("unexpected")).toEqual([1, 2, 3]);
  });

  it("keeps profile characters grounded while allowing drag-to-spin beside pose editing", () => {
    const source = readFileSync(resolve(__dirname, "../assets/ts/leaderboard-podium/app.ts"), "utf8");
    expect(source).toContain("this.standingHeights[rank], anchor?.position[2]");
    expect(source).toContain("this.targetCharacterYaw += deltaX * .012");
    expect(source).toContain('this.host.dataset.interactionMode !== "pose"');
    expect(source).toContain("if (!this.singleLayout) this.characterRoot.children.forEach");
    expect(source).not.toContain("void this.completePresentation(board, metric, leaders, sceneLeaders, generation)");
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

  it("adds a delayed reduced-motion-aware idle orbit around the selected view", () => {
    const interaction = 1_000;
    expect(idleArenaYawTarget(interaction + ARENA_IDLE_ORBIT_RESUME_DELAY_MS, interaction, false)).toBe(0);
    expect(idleArenaYawTarget(interaction + ARENA_IDLE_ORBIT_RESUME_DELAY_MS + ARENA_IDLE_ORBIT_CYCLE_MS / 4, interaction, false))
      .toBeCloseTo(ARENA_IDLE_ORBIT_AMPLITUDE, 6);
    expect(idleArenaYawTarget(interaction + 60_000, interaction, true)).toBe(0);
  });

  it("keeps every mound but halves deterministic backdrop detail on mobile", () => {
    expect(shouldRenderArenaPlacement("BG_MOUND_01", true)).toBe(true);
    expect(shouldRenderArenaPlacement("BG_DETAIL_01", true)).toBe(true);
    expect(shouldRenderArenaPlacement("BG_DETAIL_02", true)).toBe(false);
    expect(shouldRenderArenaPlacement("BG_DETAIL_18", false)).toBe(true);
  });

  it("lifts visibility only for the six forward side mounds", () => {
    expect(shouldLiftForwardMoundVisibility("BG_MOUND_11")).toBe(false);
    expect(shouldLiftForwardMoundVisibility("BG_MOUND_12")).toBe(true);
    expect(shouldLiftForwardMoundVisibility("BG_MOUND_17")).toBe(true);
    expect(shouldLiftForwardMoundVisibility("BG_MOUND_18")).toBe(false);
    expect(shouldLiftForwardMoundVisibility("BG_DETAIL_12")).toBe(false);
    expect(FORWARD_MOUND_VISIBILITY.colorMultiplier).toBeGreaterThan(1);
    expect(FORWARD_MOUND_VISIBILITY.emissiveIntensity).toBeGreaterThan(.5);
    expect(FORWARD_MOUND_VISIBILITY.horizontalScale).toBeGreaterThan(1);
    expect(FORWARD_MOUND_VISIBILITY.verticalScale).toBeGreaterThan(1);
  });

  it("covers the junkyard shell with deterministic bounded relief that stays flat beneath authored content", () => {
    expect(JUNKYARD_GROUND.width).toBe(56);
    expect(JUNKYARD_GROUND.depth).toBe(52);
    expect(JUNKYARD_GROUND.centerZ).toBe(-13.5);
    expect(JUNKYARD_GROUND.centerZ + JUNKYARD_GROUND.depth / 2).toBe(12.5);
    expect(JUNKYARD_GROUND.centerZ - JUNKYARD_GROUND.depth / 2).toBe(-39.5);
    expect(junkyardGroundHeight(0, 0)).toBeCloseTo(JUNKYARD_GROUND.baseY, 6);
    expect(junkyardGroundHeight(-2.55, 0)).toBeCloseTo(JUNKYARD_GROUND.baseY, 6);
    expect(junkyardGroundHeight(2.55, 0)).toBeCloseTo(JUNKYARD_GROUND.baseY, 6);
    expect(junkyardGroundHeight(-5.35, -1.2)).toBeCloseTo(JUNKYARD_GROUND.baseY, 6);
    expect(junkyardGroundHeight(0, JUNKYARD_GROUND.centerZ - JUNKYARD_GROUND.depth / 2)).toBeCloseTo(JUNKYARD_GROUND.baseY, 6);
    const relief = junkyardGroundHeight(12, -5) - JUNKYARD_GROUND.baseY;
    expect(Math.abs(relief)).toBeGreaterThan(.001);
    const samples = Array.from({ length: 29 * 27 }, (_, index) => {
      const column = index % 29; const row = Math.floor(index / 29);
      return junkyardGroundHeight(-28 + column * 2, -39.5 + row * 2) - JUNKYARD_GROUND.baseY;
    });
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(JUNKYARD_GROUND_RELIEF.min - 1e-8);
    expect(Math.max(...samples)).toBeLessThanOrEqual(JUNKYARD_GROUND_RELIEF.max + 1e-8);
    expect(junkyardGroundHeight(12, -5)).toBe(junkyardGroundHeight(12, -5));
    const transition = Array.from({ length: 21 }, (_, index) => junkyardGroundHeight(0, index * .1));
    const transitionSteps = transition.slice(1).map((height, index) => Math.abs(height - transition[index]));
    expect(Math.max(...transitionSteps)).toBeLessThan(.025);
    expect(Math.abs(junkyardGroundHeight(10, -23) - JUNKYARD_GROUND.baseY)).toBeGreaterThan(.15);
    expect(Math.abs(junkyardGroundHeight(12, -25) - JUNKYARD_GROUND.baseY)).toBeGreaterThan(.3);
    expect(junkyardGroundedPlacementY(.03, 10, -23)).toBeCloseTo(.03 + junkyardGroundHeight(10, -23) - JUNKYARD_GROUND.baseY, 6);
    expect(junkyardGroundedPlacementY(.03, -5.35, -1.2)).toBeCloseTo(.03, 6);
    expect(junkyardGroundedPlacementY(1.2, 10, -23)).toBe(1.2);
  });

  it("reuses bounded procedural relief around the profile podium metal apron", () => {
    expect(PROFILE_PODIUM_GROUND.width).toBe(16);
    expect(PROFILE_PODIUM_GROUND.depth).toBe(9);
    expect(profilePodiumGroundHeight(-8, PROFILE_PODIUM_GROUND.centerZ)).toBeCloseTo(PROFILE_PODIUM_GROUND.baseY, 6);
    expect(profilePodiumGroundHeight(8, PROFILE_PODIUM_GROUND.centerZ)).toBeCloseTo(PROFILE_PODIUM_GROUND.baseY, 6);
    const samples = Array.from({ length: 17 * 10 }, (_, index) => {
      const column = index % 17; const row = Math.floor(index / 17);
      return profilePodiumGroundHeight(-8 + column, -6.3 + row) - PROFILE_PODIUM_GROUND.baseY;
    });
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(PROFILE_PODIUM_GROUND_RELIEF.min - 1e-8);
    expect(Math.max(...samples)).toBeLessThanOrEqual(PROFILE_PODIUM_GROUND_RELIEF.max + 1e-8);
    expect(samples.some((sample) => Math.abs(sample) > .01)).toBe(true);
  });

  it("adds deterministic macro surface breakup across level arena ground", () => {
    const samples = Array.from({ length: 29 * 27 }, (_, index) => {
      const column = index % 29; const row = Math.floor(index / 29);
      return junkyardGroundSurfaceShade(-28 + column * 2, -39.5 + row * 2);
    });
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(JUNKYARD_GROUND_SURFACE_SHADE.min - 1e-8);
    expect(Math.max(...samples)).toBeLessThanOrEqual(JUNKYARD_GROUND_SURFACE_SHADE.max + 1e-8);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(.15);
    expect(junkyardGroundSurfaceShade(0, 0)).toBe(junkyardGroundSurfaceShade(0, 0));
    expect(junkyardGroundSurfaceShade(0, 3.2)).not.toBeCloseTo(junkyardGroundSurfaceShade(-6.2, 4.65), 3);
  });

  it("reports PBR, fallback-texture, and fallback-material ground states", () => {
    expect(podiumGroundMaterialState(true, true)).toBe("pbr");
    expect(podiumGroundMaterialState(false, true)).toBe("fallback-texture");
    expect(podiumGroundMaterialState(false, false)).toBe("fallback-material");
  });

  it("scatters deterministic mobile-aware debris outside podium and theme exclusions", () => {
    const desktop = junkyardGroundScatter(false); const mobile = junkyardGroundScatter(true);
    expect(desktop).toEqual(junkyardGroundScatter(false));
    expect(desktop).toHaveLength(72); expect(mobile).toHaveLength(36);
    expect(desktop.filter((placement) => placement.kind === "pebble")).toHaveLength(48);
    expect(desktop.filter((placement) => placement.kind === "metal")).toHaveLength(24);
    desktop.forEach((placement) => {
      expect(isJunkyardGroundScatterAllowed(placement.position[0], placement.position[2])).toBe(true);
      expect(placement.position[1]).toBeGreaterThan(junkyardGroundHeight(placement.position[0], placement.position[2]));
    });
    expect(isJunkyardGroundScatterAllowed(0, 0)).toBe(false);
    expect(isJunkyardGroundScatterAllowed(10.2, 9)).toBe(false);
  });

  it("advects and recycles smoke while freezing a stable reduced-motion composition", () => {
    expect(junkyardSmokeParticleCount(false)).toBe(36);
    expect(junkyardSmokeParticleCount(true)).toBe(20);
    const first = junkyardSmokeSample(4, 1, false, false); const later = junkyardSmokeSample(4, 6, false, false);
    expect(later.position).not.toEqual(first.position);
    expect(first.opacity).toBeGreaterThanOrEqual(0); expect(first.opacity).toBeLessThanOrEqual(.2);
    Array.from({ length: 5 }, (_, index) => junkyardSmokeSample(index, 0, false, true)).forEach((sample) => {
      expect(Math.abs(sample.position[0])).toBeLessThanOrEqual(11);
      expect(sample.position[1]).toBeGreaterThanOrEqual(.08); expect(sample.position[1]).toBeLessThanOrEqual(.22);
      expect(sample.position[2]).toBeGreaterThanOrEqual(-1.5); expect(sample.position[2]).toBeLessThanOrEqual(4);
    });
    expect(junkyardSmokeSample(4, 2, false, true)).toEqual(junkyardSmokeSample(4, 100, false, true));
  });

  it("uses hysteresis when adapting volumetric fog quality", () => {
    let quality: JunkyardFogQualityState = { mode: "volumetric", lowSamples: 0, highSamples: 0 };
    quality = nextJunkyardFogQuality(quality, 32, true); quality = nextJunkyardFogQuality(quality, 34, true);
    expect(quality.mode).toBe("volumetric");
    quality = nextJunkyardFogQuality(quality, 35, true); expect(quality.mode).toBe("fallback");
    for (let sample = 0; sample < 7; sample += 1) quality = nextJunkyardFogQuality(quality, 54, true);
    expect(quality.mode).toBe("fallback");
    quality = nextJunkyardFogQuality(quality, 54, true); expect(quality.mode).toBe("volumetric");
    expect(nextJunkyardFogQuality(quality, 60, false).mode).toBe("fallback");
  });

  it("balances a thinner global haze with an ankle-high volumetric bank", () => {
    expect(JUNKYARD_ATMOSPHERE.sceneFogDensity).toBe(.048);
    expect(JUNKYARD_ATMOSPHERE.volumetricDensity).toBe(1.05);
    expect(JUNKYARD_ATMOSPHERE.volumetricOpacityCeiling).toBe(.42);
    expect(junkyardFogVerticalProfile(.2)).toBeCloseTo(1, 6);
    expect(junkyardFogVerticalProfile(.65)).toBeCloseTo(1, 6);
    expect(junkyardFogVerticalProfile(1.25)).toBeGreaterThan(0);
    expect(junkyardFogVerticalProfile(1.25)).toBeLessThan(.22);
    expect(junkyardFogVerticalProfile(2.2)).toBe(0);
    expect(junkyardFogVerticalProfile(2.4)).toBe(0);
  });

  it("boosts volumetric density locally around all three podiums", () => {
    expect(junkyardPodiumFogInfluence(-2.55, 0)).toBe(1);
    expect(junkyardPodiumFogInfluence(0, 0)).toBe(1);
    expect(junkyardPodiumFogInfluence(2.55, 0)).toBe(1);
    expect(junkyardPodiumFogInfluence(0, 2.2)).toBeGreaterThan(0);
    expect(junkyardPodiumFogInfluence(0, 3.2)).toBe(0);
    expect(junkyardPodiumFogInfluence(9, 0)).toBe(0);
  });

  it("keeps fallback smoke strongest at ground level without a heavy upper veil", () => {
    expect(junkyardFallbackFogLayers(false).map((layer) => layer.opacity)).toEqual([.21, .09, .025]);
    expect(junkyardFallbackFogLayers(true).map((layer) => layer.opacity)).toEqual([.18, .07]);
    expect(junkyardFallbackFogLayers(false)[0].y).toBeLessThan(junkyardFallbackFogLayers(false)[1].y);
  });

  it("keeps warm searchlight scans on the rear junkyard and freezes them for reduced motion", () => {
    const samples = Array.from({ length: 121 }, (_, second) => junkyardSearchlightTarget(-1, second, false, .35));
    expect(new Set(samples.map((sample) => sample[0].toFixed(3))).size).toBeGreaterThan(80);
    samples.forEach(([x, y, z]) => {
      expect(x).toBeGreaterThan(-12); expect(x).toBeLessThan(1.5);
      expect(y).toBeGreaterThan(.9); expect(y).toBeLessThan(2.2);
      expect(z).toBeLessThan(-12); expect(z).toBeGreaterThan(-16.5);
    });
    expect(junkyardSearchlightTarget(1, 0, true, 2.55)).toEqual([5.25, 1.55, -14.4]);
    expect(junkyardSearchlightTarget(1, 500, true, 2.55)).toEqual([5.25, 1.55, -14.4]);
  });

  it("ships the local CC0 PBR ground maps", () => {
    for (const name of ["albedo", "normal", "arm"]) {
      const file = readFileSync(resolve(__dirname, `../assets/media/textures/leaderboard-junkyard-dirt-${name}.webp`));
      expect(file.byteLength).toBeGreaterThan(100_000);
      expect(file.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(file.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
    expect(readFileSync(resolve(__dirname, "../assets/media/textures/README.md"), "utf8")).toMatch(/Poly Haven.*CC0/s);
  });

  it("authors a U-shaped arena with an open foreground", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json"), "utf8")) as ArenaManifest;
    const transformed = manifest.basePlacements.map(arenaPlacementTransform);
    expect(transformed.filter((placement) => placement.zone === "rear").length).toBeGreaterThan(10);
    expect(transformed.filter((placement) => placement.zone === "left-wing").length).toBeGreaterThan(8);
    expect(transformed.filter((placement) => placement.zone === "right-wing").length).toBeGreaterThan(8);
    const foreground = transformed.filter((placement) => placement.zone === "foreground");
    expect(foreground).toHaveLength(0);
  });

  it("joins and grounds the freestanding overhead gantry", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json"), "utf8")) as ArenaManifest;
    const trusses = ["ENV_TRUSS_L", "ENV_TRUSS_C", "ENV_TRUSS_R"].map((id) => {
      const placement = manifest.basePlacements.find((candidate) => candidate.id === id);
      expect(placement).toBeDefined();
      return arenaPlacementTransform(placement!);
    });
    const layout = JUNKYARD_GANTRY_LAYOUT;
    expect(trusses.map((truss) => truss.position[0])).toEqual([...layout.trussCentersX]);
    for (let index = 1; index < trusses.length; index += 1) {
      const previousEnd = trusses[index - 1].position[0] + layout.trussSpan / 2;
      const nextStart = trusses[index].position[0] - layout.trussSpan / 2;
      expect(previousEnd).toBeCloseTo(nextStart, 6);
    }
    expect(trusses.map((truss) => truss.position[1])).toEqual(layout.trussCentersX.map(() => layout.trussCenterY));
    expect(trusses.map((truss) => truss.position[2])).toEqual(layout.trussCentersX.map(() => layout.trussCenterZ));
    expect([
      trusses[0].position[0] - layout.trussSpan / 2,
      trusses[2].position[0] + layout.trussSpan / 2,
    ]).toEqual([...layout.supportXs]);
    layout.supportXs.forEach((x) => {
      expect(Math.abs(x)).toBeGreaterThan(Math.max(...JUNKYARD_PODIUM_CENTERS_X.map(Math.abs)));
      expect(junkyardGroundHeight(x, layout.trussCenterZ)).toBeLessThan(layout.supportTopY);
    });
    expect(layout.trussCenterZ).toBeLessThan(-3);
  });

  it("authors a continuous U-shaped junkyard backdrop outside the podium and camera envelope", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json"), "utf8")) as ArenaManifest;
    const mounds = manifest.basePlacements.filter((placement) => placement.id.startsWith("BG_MOUND_"));
    const details = manifest.basePlacements.filter((placement) => placement.id.startsWith("BG_DETAIL_"));
    expect(mounds).toHaveLength(17);
    expect(mounds.filter((placement) => placement.position[2] < -16)).toHaveLength(5);
    expect(mounds.filter((placement) => placement.position[0] < -17)).toHaveLength(6);
    expect(mounds.filter((placement) => placement.position[0] > 17)).toHaveLength(6);
    const forwardMounds = mounds.filter((placement) => Number(placement.id.slice("BG_MOUND_".length)) >= 12);
    expect(forwardMounds).toHaveLength(6);
    expect(forwardMounds.every((placement) => Math.abs(placement.position[0]) >= 20 && placement.position[2] >= .5)).toBe(true);
    expect(forwardMounds.every((placement) => shouldRenderArenaPlacement(placement.id, true))).toBe(true);
    expect(forwardMounds.map((placement) => placement.position)).toEqual([
      [-24.5, -.23, .5], [-23, -.23, 5], [-20, -.2, 9.5],
      [24.5, -.23, .5], [23, -.23, 5], [20, -.2, 9.5],
    ]);
    expect(forwardMounds.map((placement) => placement.rotation[1])).toEqual([102, 108, 116, -102, -108, -116]);
    for (let index = 0; index < 3; index += 1) {
      const left = forwardMounds[index]; const right = forwardMounds[index + 3];
      expect(right.position).toEqual([-left.position[0], left.position[1], left.position[2]]);
      expect(right.rotation).toEqual([left.rotation[0], -left.rotation[1], left.rotation[2]]);
      expect(right.scale).toEqual(left.scale);
    }
    expect(details).toHaveLength(18);
    expect(details.filter((placement) => /compact_car|pickuptruck/.test(placement.localPath))).toHaveLength(12);
    expect(details.filter((placement) => /junkyard_stack/.test(placement.localPath))).toHaveLength(6);
    expect(details.filter((placement) => shouldRenderArenaPlacement(placement.id, true))).toHaveLength(9);
    expect(details.filter((placement) => Math.abs(placement.position[0]) > 17).every((placement) => placement.position[2] <= -4.5)).toBe(true);

    const sourceSearchlight = manifest.basePlacements.find((placement) => placement.id === "FIX_SEARCH_L");
    const sourceSearchlightRight = manifest.basePlacements.find((placement) => placement.id === "FIX_SEARCH_R");
    expect(sourceSearchlight).toBeDefined();
    expect(sourceSearchlightRight).toBeDefined();
    const searchlight = arenaPlacementTransform(sourceSearchlight!);
    const searchlightRight = arenaPlacementTransform(sourceSearchlightRight!);
    const base = new Vector3(0, 3.25, 11.7); const target = new Vector3(0, 1.42, -.35);
    let minimumClearance = Number.POSITIVE_INFINITY;
    let minimumMoundClearance = Number.POSITIVE_INFINITY;
    for (let degrees = -75; degrees <= 75; degrees += 1) {
      const camera = orbitCameraPosition(base, target, degrees * Math.PI / 180, 0);
      minimumClearance = Math.min(minimumClearance, camera.distanceTo(new Vector3(...searchlight.position)));
      minimumClearance = Math.min(minimumClearance, camera.distanceTo(new Vector3(...searchlightRight.position)));
      forwardMounds.forEach((placement) => {
        minimumMoundClearance = Math.min(minimumMoundClearance, camera.distanceTo(new Vector3(...placement.position)));
      });
    }
    expect(searchlight.position).toEqual([-20.5, 4.65, -7]);
    expect(searchlightRight.position).toEqual([20.5, 4.72, -7]);
    expect(minimumClearance).toBeGreaterThan(13);
    expect(minimumMoundClearance).toBeGreaterThan(10.5);
  });

  it("vendors the complete pinned scene with valid hashes and deterministic theme sockets", () => {
    const manifestPath = resolve(__dirname, "../assets/data/leaderboard-scene-manifest.json");
    const manifestText = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText) as ArenaManifest;
    expect(manifestText).not.toMatch(/https?:\/\//i);
    expect(manifest.revision).toBe("494242bdeae941e3389b34a819c514aae2cf39f8");
    expect(manifest.assets).toHaveLength(79);
    expect(manifest.basePlacements).toHaveLength(117);
    expect(manifest.characterAnchors).toHaveLength(3);
    expect(Object.keys(manifest.themes)).toHaveLength(6);
    const mostKills = generatedThemePlacements("most-kills", manifest.themes["most-kills"]);
    expect(mostKills).toHaveLength(6);
    expect(mostKills.filter((placement) => placement.position[0] < 0)).toHaveLength(3);
    expect(mostKills.filter((placement) => placement.position[0] > 0)).toHaveLength(3);
    mostKills.forEach((placement) => {
      expect(placement.position[1]).toBe(0);
      expect(placement.position[2]).toBeLessThanOrEqual(-3.1);
      expect(placement.position[2]).toBeGreaterThanOrEqual(-3.74);
      expect(placement.anchor).toBe("Object center");
      expect(placement.role).toMatch(/grounded|floor/i);
    });
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
