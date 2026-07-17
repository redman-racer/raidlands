import { access, readFile, readdir, stat } from "node:fs/promises";
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

      if (preview.mapModelUrl) {
        expect(preview.mapModelUrl, vehicle).toMatch(/\.glb(?:$|\?)/);
        const mapLocalPath = preview.mapModelUrl.startsWith("/assets/")
          ? resolve(preview.mapModelUrl.slice(1))
          : preview.mapModelUrl.startsWith("assets/")
            ? resolve(preview.mapModelUrl)
            : null;
        expect(mapLocalPath, vehicle).not.toBeNull();
        await expect(access(mapLocalPath!)).resolves.toBeUndefined();
        expect((await stat(mapLocalPath!)).size, vehicle).toBeLessThanOrEqual(1_000_000);
      }
    }

    expect(metadata.vehicles.cargo_ship?.mapModelUrl).toContain("cargo_ship_map.glb");
    expect(metadata.vehicles.cargo_ship?.mapRotationCorrection?.y).toBe(180);
  });

  it("recompiles every expected canonical bundle byte-for-byte", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const directories = (await readdir(fixtureRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toHaveLength(15);

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
      expect(profile.CompiledReleaseEvents, directory).toBeUndefined();
      for (const group of profile.GeneratedReleaseGroups ?? []) {
        expect(group.Template.Count, `${directory} generated template`).toBe(1);
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

  it("keeps manual events granular and repeated schedules compact", async () => {
    const metadata = await json<VehiclePreviewMetadataFile>(metadataPath);
    const compileFixture = async (directory: string) => {
      const source = await json<EditorSourceBundle>(join(fixtureRoot, directory, "source.json"));
      return Object.values(compileSourceBundle(source, { publishedRevision: 1, vehicleMetadata: metadata }).bundle.Profiles)[0]!;
    };
    const manual = await compileFixture("manual-release-schedule");
    expect(manual.CompiledReleaseEvents).toBeUndefined();
    expect(manual.PayloadEvents.map((event) => event.Time)).toEqual([1, 2.5]);
    expect(manual.PayloadEvents.map((event) => event.Count)).toEqual([2, 1]);

    const repeated = await compileFixture("repeated-release-schedule");
    expect(repeated.GeneratedReleaseGroups).toMatchObject([
      { StartTime: 1, IntervalSeconds: 0.5, UnitIntervalSeconds: 0, UnitsPerRelease: 2, MaximumUnits: 6 },
    ]);

    const grouped = await compileFixture("grouped-repeated-schedule");
    expect(grouped.GeneratedReleaseGroups).toHaveLength(2);
    expect(grouped.GeneratedReleaseGroups?.map((group) => group.MaximumUnits)).toEqual([8, 9]);
    expect(grouped.GeneratedReleaseGroups?.map((group) => group.IntervalSeconds)).toEqual([0.2, 0.15]);
    expect(grouped.GeneratedReleaseGroups?.every((group) => group.Template.Payload === "bradley_longbarrel_burst")).toBe(true);

    const remainder = await compileFixture("non-even-repeated-total");
    expect(remainder.GeneratedReleaseGroups).toMatchObject([{ UnitsPerRelease: 3, MaximumUnits: 10 }]);

    const alternating = await compileFixture("alternating-hardpoints");
    const alternatingGroup = alternating.GeneratedReleaseGroups?.[0]!;
    const alternatingOffsets = alternatingGroup.HardpointOffsets?.map((offset) => alternatingGroup.Template.CarrierOffsetX + offset.X) ?? [];
    expect(alternatingOffsets[0]).toBeCloseTo(-2.4, 10);
    expect(alternatingOffsets[1]).toBeCloseTo(2.3, 10);
    expect(alternatingGroup.Template.Count).toBe(1);
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
