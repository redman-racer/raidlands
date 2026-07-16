import { describe, expect, it } from "vitest";
import {
  compileSourceBundle,
  type EditorSourceBundle,
  type EditorSourceProfile,
  type PayloadEventFields,
  type VehiclePreviewMetadataFile,
} from "../assets/ts/airstrike-animation-editor/index";
import {
  addRepeatedReleaseGroup,
  getReleasePreviewEvents,
  getRepeatedReleaseGroups,
  updateManualReleaseTime,
  updateRepeatedGroupField,
} from "../assets/ts/airstrike-animation-editor/editor/release-source";
import {
  metersPerSecondToMilesPerHour,
  normalizeWaypointTimes,
  setGlobalTargetSpeed,
  setWaypointTargetSpeed,
} from "../assets/ts/airstrike-animation-editor/editor/speed-normalization";

const payload = (overrides: Partial<PayloadEventFields> = {}): PayloadEventFields => ({
  Payload: "hv_rocket",
  Count: 1,
  CarrierOffsetX: 0,
  CarrierOffsetY: 0,
  CarrierOffsetZ: 0,
  TargetOffsetX: 0,
  TargetOffsetY: 0,
  TargetOffsetZ: 0,
  SpreadRadius: -1,
  LaunchSpeed: -1,
  FuseSeconds: -1,
  DamageScale: 1,
  VehicleDamageScale: -1,
  SplashRadius: -1,
  ImpactRadius: -1,
  MaxTrackingSeconds: -1,
  MaxTrackingDistance: -1,
  DamageScales: {},
  ...overrides,
});

const metadata = (leftX = -3.1): VehiclePreviewMetadataFile => ({
  schemaVersion: 1,
  vehicles: {
    f15: {
      vehicle: "f15",
      modelUrl: "",
      scale: 1,
      positionCorrection: { x: 0, y: 0, z: 0 },
      rotationCorrection: { x: 0, y: 0, z: 0 },
      bounds: { x: 13, y: 5.5, z: 19.5 },
      proxy: "plane",
      hardpoints: [
        { id: "left_rocket", x: leftX, y: -0.7, z: 0.8 },
        { id: "right_rocket", x: 3.1, y: -0.7, z: 0.8 },
      ],
    },
  },
});

function profileFixture(overrides: Partial<EditorSourceProfile> = {}): EditorSourceProfile {
  return {
    EditorSourceSchemaVersion: 1,
    ProfileKey: "authoring_test",
    DisplayName: "Authoring Test",
    Vehicle: "f15",
    DurationSeconds: 10,
    FirstPayloadDelaySeconds: 2,
    RotationSmoothTimeSeconds: 0.12,
    StopAtWaypoints: false,
    MinimumTerrainClearance: 55,
    PositionInterpolation: "time_hermite",
    RotationMode: "follow_path_plus_offset",
    Waypoints: [
      { Id: "wp_001", Time: 0, X: 0, Y: 0, Z: 0, RotationX: 0, RotationY: 0, RotationZ: 0 },
      { Id: "wp_002", Time: 5, X: 0, Y: 0, Z: 100, RotationX: 0, RotationY: 0, RotationZ: 0 },
      { Id: "wp_003", Time: 10, X: 0, Y: 0, Z: 220, RotationX: 0, RotationY: 0, RotationZ: 0 },
    ],
    ReleaseSource: {
      Mode: "manual",
      Events: [{ ...payload(), Id: "release_001", Time: 2 }],
      LegacyDynamic: false,
      Template: payload(),
    },
    EditorMetadata: {
      Notes: "",
      Tags: [],
      VehiclePreviewOverrides: {},
      GlobalTargetSpeedMetersPerSecond: 10,
    },
    ...overrides,
  };
}

function bundle(profile: EditorSourceProfile): EditorSourceBundle {
  return {
    EditorSourceSchemaVersion: 1,
    AllowDangerousPayloadPreview: false,
    Profiles: { [profile.ProfileKey]: profile },
  };
}

describe("airstrike authoring speed normalization", () => {
  it("normalizes waypoint times using blended endpoint speeds", () => {
    const normalized = normalizeWaypointTimes({
      ...profileFixture(),
      Waypoints: [
        { Id: "wp_001", Time: 0, X: 0, Y: 0, Z: 0, RotationX: 0, RotationY: 0, RotationZ: 0, TargetSpeedMetersPerSecond: 10 },
        { Id: "wp_002", Time: 5, X: 0, Y: 0, Z: 100, RotationX: 0, RotationY: 0, RotationZ: 0, TargetSpeedMetersPerSecond: 30 },
        { Id: "wp_003", Time: 10, X: 0, Y: 0, Z: 220, RotationX: 0, RotationY: 0, RotationZ: 0, TargetSpeedMetersPerSecond: 20 },
      ],
    });

    expect(normalized.Waypoints.map((waypoint) => waypoint.Time)).toEqual([0, 5, 9.8]);
    expect(normalized.DurationSeconds).toBe(9.8);
    expect(normalized.FirstPayloadDelaySeconds).toBe(2);
  });

  it("resets all speeds from global speed and immediately renormalizes waypoint overrides", () => {
    const global = setGlobalTargetSpeed(profileFixture(), 20);
    expect(global.Waypoints.map((waypoint) => waypoint.TargetSpeedMetersPerSecond)).toEqual([20, 20, 20]);
    expect(global.Waypoints.map((waypoint) => waypoint.Time)).toEqual([0, 5, 11]);

    const overridden = setWaypointTargetSpeed(global, "wp_002", 10);
    expect(overridden.Waypoints.map((waypoint) => waypoint.Time)).toEqual([0, 6.667, 14.667]);
  });

  it("converts meters per second to read-only mph display values", () => {
    expect(metersPerSecondToMilesPerHour(10)).toBeCloseTo(22.3693629, 6);
  });
});

describe("airstrike authoring release sources", () => {
  it("materializes manual HardpointId into runtime carrier offsets and source hashes", () => {
    const source = profileFixture({
      ReleaseSource: {
        Mode: "manual",
        Events: [{ ...payload({ CarrierOffsetX: 0.4 }), Id: "release_001", Time: 2, HardpointId: "left_rocket" }],
        LegacyDynamic: false,
        Template: payload(),
      },
    });

    const first = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata(-3.1) });
    const second = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata(-1.1) });
    const firstProfile = first.bundle.Profiles.authoring_test!;
    const secondProfile = second.bundle.Profiles.authoring_test!;

    expect(firstProfile.CompiledReleaseEvents?.[0]?.CarrierOffsetX).toBe(-2.7);
    expect(firstProfile.PayloadEvents[0]?.CarrierOffsetX).toBe(-2.7);
    expect(secondProfile.CompiledReleaseEvents?.[0]?.CarrierOffsetX).toBe(-0.7);
    expect(first.sourceHashes.authoring_test).not.toBe(second.sourceHashes.authoring_test);
  });

  it("keeps repeated hardpoint preview parity with compiled release events", () => {
    const source = profileFixture({
      FirstPayloadDelaySeconds: 1,
      ReleaseSource: {
        Mode: "repeated",
        StartTime: 1,
        IntervalSeconds: 0.5,
        UnitsPerRelease: 2,
        MaximumUnits: 4,
        Template: payload({ Count: 2, CarrierOffsetX: 0.1 }),
        HardpointSequence: ["left_rocket", "right_rocket"],
      },
    });
    const preview = getReleasePreviewEvents(source, metadata());
    const compiled = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata() }).bundle.Profiles
      .authoring_test!.CompiledReleaseEvents!;

    expect(preview.map((event) => event.fields.CarrierOffsetX)).toEqual(compiled.map((event) => event.CarrierOffsetX));
    expect(preview.map((event) => event.time)).toEqual(compiled.map((event) => event.Time));
  });

  it("adds independently editable automatic groups without overwriting earlier group edits", () => {
    const source = profileFixture({
      FirstPayloadDelaySeconds: 1,
      ReleaseSource: {
        Mode: "repeated",
        StartTime: 1,
        IntervalSeconds: 0.25,
        UnitsPerRelease: 2,
        MaximumUnits: 4,
        Template: payload({ Payload: "bradley_longbarrel_burst", Count: 2 }),
        HardpointSequence: [],
      },
    });
    const firstGroupId = getRepeatedReleaseGroups(source)[0]!.Id;
    const edited = updateRepeatedGroupField(source, firstGroupId, "IntervalSeconds", 0.15);
    const added = addRepeatedReleaseGroup(edited, firstGroupId);
    const groups = getRepeatedReleaseGroups(added.profile);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.IntervalSeconds).toBe(0.15);
    expect(groups[1]!.IntervalSeconds).toBe(0.15);
    expect(groups[1]!.StartTime).toBeGreaterThan(groups[0]!.StartTime);
    expect(added.profile.FirstPayloadDelaySeconds).toBe(1);
  });

  it("updates release-marker source times and keeps first payload delay synced", () => {
    const source = profileFixture({
      FirstPayloadDelaySeconds: 1,
      ReleaseSource: {
        Mode: "manual",
        Events: [
          { ...payload(), Id: "release_001", Time: 1 },
          { ...payload(), Id: "release_002", Time: 3 },
        ],
        LegacyDynamic: false,
        Template: payload(),
      },
    });

    const updated = updateManualReleaseTime(source, "release_002", 0.5);
    expect(updated.ReleaseSource.Mode).toBe("manual");
    expect(updated.ReleaseSource.Mode === "manual" ? updated.ReleaseSource.Events.map((event) => event.Id) : []).toEqual([
      "release_002",
      "release_001",
    ]);
    expect(updated.FirstPayloadDelaySeconds).toBe(0.5);
  });
});
