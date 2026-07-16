import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileSourceBundle,
  evaluateCompiledTrack,
  quaternionDot,
  threeQuaternionToUnity,
  threeVectorToUnity,
  unityEulerQuaternion,
  unityQuaternionToThree,
  unityVectorToThree,
  validateSourceBundle,
  type EditorSourceBundle,
  type RuntimeVisualProfileFile,
  type VehiclePreviewMetadataFile,
} from "../assets/ts/airstrike-animation-editor/index";

const fixtureRoot = resolve("tests/fixtures/airstrike-animations");
const metadataPath = resolve("assets/airstrike-animation-editor/vehicle-preview.json");

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("airstrike animation golden fixtures", () => {
  it("keeps vehicle preview metadata pointed at browser-loadable local assets", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);

    for (const [vehicle, preview] of Object.entries(metadata.vehicles)) {
      expect(preview.modelUrl, vehicle).not.toContain(".prefab");
      expect(preview.modelUrl, vehicle).toMatch(/\.(gltf|glb)(?:$|\?)/);

      const localPath = preview.modelUrl.startsWith("/assets/")
        ? resolve(preview.modelUrl.slice(1))
        : preview.modelUrl.startsWith("assets/")
          ? resolve(preview.modelUrl)
          : null;

      expect(localPath, vehicle).not.toBeNull();
      await expect(access(localPath!)).resolves.toBeUndefined();
    }
  });

  it("recompiles every expected canonical bundle byte-for-byte", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const directories = (await readdir(fixtureRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toHaveLength(14);

    for (const directory of directories) {
      const path = join(fixtureRoot, directory);
      const source = await json<EditorSourceBundle>(join(path, "source.json"));
      const expectedRuntime = await json<RuntimeVisualProfileFile>(join(path, "expected.runtime.json"));
      const expectedCanonical = await readFile(join(path, "expected.canonical.json"), "utf8");
      const manifest = await json<{ canonicalSha256: string; canonicalBytes: number; sourceHashes: Record<string, string> }>(
        join(path, "manifest.json"),
      );
      const result = compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata });

      expect(result.bundle, directory).toEqual(expectedRuntime);
      expect(result.canonicalJson, directory).toBe(expectedCanonical);
      expect(result.sha256, directory).toBe(manifest.canonicalSha256);
      expect(result.sourceHashes, directory).toEqual(manifest.sourceHashes);
      expect(new TextEncoder().encode(result.canonicalJson), directory).toHaveLength(manifest.canonicalBytes);
      expect(result.canonicalJson, directory).not.toContain("PublishedSha256");

      const profile = Object.values(result.bundle.Profiles)[0]!;
      const frames = profile.CompiledTrack.Frames;
      expect(frames[0]!.Time, directory).toBe(0);
      expect(frames[frames.length - 1]!.Time, directory).toBe(profile.DurationSeconds);
      for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index]!;
        expect(Object.values(frame).every(Number.isFinite), `${directory} frame ${index}`).toBe(true);
        const norm = Math.hypot(frame.Qx, frame.Qy, frame.Qz, frame.Qw);
        expect(norm, `${directory} frame ${index} quaternion`).toBeCloseTo(1, 5);
        if (index > 0) {
          expect(frame.Time, `${directory} frame ${index} time`).toBeGreaterThan(frames[index - 1]!.Time);
          expect(
            frame.Qx * frames[index - 1]!.Qx +
              frame.Qy * frames[index - 1]!.Qy +
              frame.Qz * frames[index - 1]!.Qz +
              frame.Qw * frames[index - 1]!.Qw,
            `${directory} frame ${index} sign`,
          ).toBeGreaterThanOrEqual(-0.000002);
        }
      }
      for (const event of profile.CompiledReleaseEvents ?? []) {
        expect(event.Count, `${directory} release ${event.Index}`).toBe(1);
      }
    }
  });

  it("preserves straight constant speed and stop-at-waypoint easing", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const straightSource = await json<EditorSourceBundle>(join(fixtureRoot, "straight-constant-speed", "source.json"));
    const straight = Object.values(compileSourceBundle(straightSource, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
    expect(evaluateCompiledTrack(straight.CompiledTrack, 1).Z).toBeCloseTo(-50, 6);
    expect(evaluateCompiledTrack(straight.CompiledTrack, 2).Z).toBeCloseTo(0, 6);
    expect(evaluateCompiledTrack(straight.CompiledTrack, 3).Z).toBeCloseTo(50, 6);

    const stopSource = await json<EditorSourceBundle>(join(fixtureRoot, "stop-at-waypoints-true", "source.json"));
    const flowSource = await json<EditorSourceBundle>(join(fixtureRoot, "stop-at-waypoints-false", "source.json"));
    const stopped = Object.values(compileSourceBundle(stopSource, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
    const flowing = Object.values(compileSourceBundle(flowSource, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
    expect(evaluateCompiledTrack(stopped.CompiledTrack, 0.5).X).not.toBeCloseTo(
      evaluateCompiledTrack(flowing.CompiledTrack, 0.5).X,
      4,
    );
  });

  it("keeps path direction out of full manual rotation", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const source = await json<EditorSourceBundle>(join(fixtureRoot, "straight-constant-speed", "source.json"));
    const sourceProfile = source.Profiles.straight_constant_speed!;
    sourceProfile.RotationMode = "authored_orientation";
    sourceProfile.Waypoints[0]!.Z = 100;
    sourceProfile.Waypoints[1]!.Z = -100;

    const profile = Object.values(
      compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles,
    )[0]!;
    for (const frame of profile.CompiledTrack.Frames) {
      expect(frame.Qx).toBeCloseTo(0, 6);
      expect(frame.Qy).toBeCloseTo(0, 6);
      expect(frame.Qz).toBeCloseTo(0, 6);
      expect(frame.Qw).toBeCloseTo(1, 6);
    }
  });

  it("retains 360/540 authored turns through quaternion sign continuity", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    for (const directory of ["barrel-roll-360", "barrel-roll-540"]) {
      const source = await json<EditorSourceBundle>(join(fixtureRoot, directory, "source.json"));
      const profile = Object.values(compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
      const frames = profile.CompiledTrack.Frames;
      const first = frames[0]!;
      const last = frames[frames.length - 1]!;
      const endpointDot = first.Qx * last.Qx + first.Qy * last.Qy + first.Qz * last.Qz + first.Qw * last.Qw;
      expect(endpointDot, directory).toBeLessThan(0.1);
      for (let index = 1; index < frames.length; index += 1) {
        const previous = frames[index - 1]!;
        const current = frames[index]!;
        expect(
          previous.Qx * current.Qx + previous.Qy * current.Qy + previous.Qz * current.Qz + previous.Qw * current.Qw,
          `${directory} frame ${index}`,
        ).toBeGreaterThan(0.99);
      }
    }
  });

  it("materializes manual, repeated, grouped, remainder, and alternating-hardpoint releases", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const compileFixture = async (directory: string) => {
      const source = await json<EditorSourceBundle>(join(fixtureRoot, directory, "source.json"));
      return Object.values(compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
    };
    const manual = await compileFixture("manual-release-schedule");
    expect(manual.CompiledReleaseEvents?.map((event) => event.Time)).toEqual([1, 1, 2.5]);
    expect(manual.PayloadEvents.map((event) => event.Count)).toEqual([2, 1]);

    const repeated = await compileFixture("repeated-release-schedule");
    expect(repeated.CompiledReleaseEvents?.map((event) => event.Time)).toEqual([1, 1, 1.5, 1.5, 2, 2]);

    const grouped = await compileFixture("grouped-repeated-schedule");
    expect(grouped.CompiledReleaseEvents).toHaveLength(17);
    expect(grouped.CompiledReleaseEvents?.slice(0, 8).map((event) => event.Time)).toEqual([2, 2, 2.2, 2.2, 2.4, 2.4, 2.6, 2.6]);
    expect(grouped.CompiledReleaseEvents?.slice(8).map((event) => event.Time)).toEqual([6, 6, 6, 6.15, 6.15, 6.15, 6.3, 6.3, 6.3]);
    expect(grouped.CompiledReleaseEvents?.every((event) => event.Payload === "bradley_longbarrel_burst")).toBe(true);

    const remainder = await compileFixture("non-even-repeated-total");
    expect(remainder.CompiledReleaseEvents).toHaveLength(10);
    expect(remainder.CompiledReleaseEvents?.filter((event) => event.Time === 2.5)).toHaveLength(1);

    const alternating = await compileFixture("alternating-hardpoints");
    expect(alternating.CompiledReleaseEvents?.map((event) => event.CarrierOffsetX)).toEqual([-2.4, 2.3, -2.4, 2.3]);
    expect(alternating.CompiledReleaseEvents?.every((event) => event.Count === 1)).toBe(true);
  });

  it("uses explicit Unity/Three reflection helpers and Unity Euler order", () => {
    const value = { x: 3, y: 4, z: 5 };
    expect(threeVectorToUnity(unityVectorToThree(value))).toEqual(value);
    const rotation = unityEulerQuaternion(20, 35, 70);
    const roundTrip = threeQuaternionToUnity(unityQuaternionToThree(rotation));
    expect(Math.abs(quaternionDot(rotation, roundTrip))).toBeCloseTo(1, 10);

    const zThenXThenY = unityEulerQuaternion(90, 90, 0);
    expect(zThenXThenY.w).toBeCloseTo(0.5, 10);
    expect(zThenXThenY.x).toBeCloseTo(0.5, 10);
    expect(zThenXThenY.y).toBeCloseTo(0.5, 10);
    expect(zThenXThenY.z).toBeCloseTo(-0.5, 10);
  });

  it("returns precise validation paths", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const source = await json<EditorSourceBundle>(join(fixtureRoot, "straight-constant-speed", "source.json"));
    source.Profiles.straight_constant_speed!.Waypoints[1]!.Time = Number.NaN;
    const issues = validateSourceBundle(source, metadata);
    expect(issues.map((issue) => issue.path)).toContain("Profiles.straight_constant_speed.Waypoints[1].Time");
  });
});
