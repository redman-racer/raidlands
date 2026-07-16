import { describe, expect, it } from "vitest";
import {
  cameraYForTerrainSightline,
  directorShotTiming,
  selectDirectorShot,
  updateDirectorFpsState,
  type DirectorFpsState,
  type DirectorShotInput,
} from "../assets/ts/server-map-viewer/camera-director-policy";

const baseInput = (overrides: Partial<DirectorShotInput> = {}): DirectorShotInput => ({
  mode: "director",
  worldSize: 3500,
  waterLevel: 0,
  environment: {
    sunDirection: { x: 0.9, y: 0.04, z: 0.2 },
    fogIntensity: 0.1,
    rainIntensity: 0,
    cloudCoverage: 0.25,
  },
  features: [
    { id: "ridge-west", kind: "ridge", position: { x: -450, y: 260, z: 80 }, radius: 260, prominence: 1.1 },
    { id: "launch-site", kind: "monument", position: { x: 620, y: 90, z: -240 }, radius: 180, prominence: 0.8 },
  ],
  actions: [],
  performanceTier: "healthy",
  recentShotIds: [],
  shotSequence: 0,
  lastHeroSequence: -100,
  ...overrides,
});

describe("server map cinematic camera director", () => {
  it("uses slow holds and progressively calmer low-FPS timing", () => {
    expect(directorShotTiming("healthy", 0)).toEqual({ transitionMs: 3400, holdMs: 13500, motionScale: 1 });
    expect(directorShotTiming("constrained", 0).motionScale).toBeLessThan(1);
    expect(directorShotTiming("low", 0)).toEqual({ transitionMs: 6000, holdMs: 21000, motionScale: 0.12 });
  });

  it("smooths FPS with hysteresis instead of oscillating at a threshold", () => {
    let state: DirectorFpsState = { smoothedFps: 60, tier: "healthy" };
    for (let index = 0; index < 40; index += 1) state = updateDirectorFpsState(state, 25);
    expect(state.tier).toBe("constrained");
    for (let index = 0; index < 40; index += 1) state = updateDirectorFpsState(state, 50);
    expect(state.tier).toBe("low");
    for (let index = 0; index < 40; index += 1) state = updateDirectorFpsState(state, 30);
    expect(state.tier).toBe("constrained");
  });

  it("keeps generated scenic positions inside the current playable world", () => {
    const shot = selectDirectorShot(baseInput());
    expect(Math.abs(shot.position.x)).toBeLessThanOrEqual(3500 * 0.47);
    expect(Math.abs(shot.position.z)).toBeLessThanOrEqual(3500 * 0.47);
    expect(shot.kind).toBe("scenic");
  });

  it("retargets toward action without abandoning the scenic anchor", () => {
    const action = {
      id: "event:airstrike-1",
      kind: "event" as const,
      position: { x: 1200, y: 80, z: 900 },
      radius: 220,
      weight: 8,
      updatedAt: 1000,
    };
    const scenic = selectDirectorShot(baseInput({ mode: "director" }));
    const directed = selectDirectorShot(baseInput({ mode: "director", actions: [action] }));
    const actionMode = selectDirectorShot(baseInput({ mode: "action", actions: [action] }));
    expect(directed.kind).toBe("action");
    expect(actionMode.kind).toBe("action");
    expect(distance(directed.target, action.position)).toBeLessThan(distance(scenic.target, action.position));
    expect(distance(directed.position, scenic.position)).toBeLessThan(3500 * 0.3);
  });

  it("keeps Cinematic mode scenic even when action is available", () => {
    const shot = selectDirectorShot(baseInput({
      mode: "cinematic",
      actions: [{ id: "players", kind: "overlay", position: { x: 900, y: 30, z: 900 }, radius: 300, weight: 9, updatedAt: 1000 }],
    }));
    expect(shot.kind).toBe("scenic");
    expect(shot.subjectId).toBeUndefined();
  });

  it("limits route-follow hero shots to cadence and performance gates", () => {
    const route = Array.from({ length: 8 }, (_, index) => ({ x: index * 100, y: 180, z: index * 45 }));
    const action = {
      id: "patrol-heli",
      kind: "vehicle" as const,
      position: route[route.length - 1]!,
      radius: 150,
      weight: 7,
      updatedAt: 1000,
      vehicle: "attack_heli",
      destroyed: true,
      route,
    };
    const hero = selectDirectorShot(baseInput({ actions: [action], shotSequence: 5, lastHeroSequence: 0 }));
    expect(hero.kind).toBe("hero");
    expect(hero.heroRoute!.length).toBeLessThan(route.length);
    expect(selectDirectorShot(baseInput({ actions: [action], shotSequence: 4, lastHeroSequence: 0 })).kind).toBe("action");
    expect(selectDirectorShot(baseInput({ actions: [action], shotSequence: 5, lastHeroSequence: 0, performanceTier: "low" })).kind).toBe("action");
  });

  it("penalizes a recently used composition", () => {
    const first = selectDirectorShot(baseInput());
    const next = selectDirectorShot(baseInput({ recentShotIds: [first.id] }));
    expect(next.id).not.toBe(first.id);
  });

  it("raises a camera enough to retain line of sight over a ridge", () => {
    const requested = cameraYForTerrainSightline(80, { x: -100, z: 0 }, { x: 100, y: 20, z: 0 }, (x) => Math.abs(x) < 20 ? 120 : 0, 12, 20);
    expect(requested).toBeGreaterThan(200);
  });
});

function distance(left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
