import { describe, expect, it } from "vitest";
import {
  compileSourceBundle,
  validateSourceBundle,
  type EditorSourceBundle,
  type EditorSourceProfile,
  type PayloadEventFields,
  type VehiclePreviewMetadataFile,
} from "../assets/ts/airstrike-animation-editor/index";
import {
  addRepeatedReleaseGroup,
  duplicateManualRelease,
  effectiveAccuracyRadius,
  getReleasePreviewEvents,
  getRepeatedReleaseGroups,
  normalizeProfilePayloadTargeting,
  updateManualPayloadField,
  updateManualReleaseTime,
  updateReleaseMode,
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
  TargetingMode: overrides.TargetingMode ?? "simple",
  AccuracyPercent: overrides.AccuracyPercent ?? 75,
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
    EditorSourceSchemaVersion: profile.EditorSourceSchemaVersion,
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
  it("calculates simple targeting miss-radius boundaries", () => {
    expect(effectiveAccuracyRadius({ SpreadRadius: 20, AccuracyPercent: 0 })).toBe(20);
    expect(effectiveAccuracyRadius({ SpreadRadius: 20, AccuracyPercent: 75 })).toBe(5);
    expect(effectiveAccuracyRadius({ SpreadRadius: 20, AccuracyPercent: 100 })).toBe(0);
    expect(effectiveAccuracyRadius({ SpreadRadius: -1, AccuracyPercent: 75 })).toBeNull();
  });

  it("normalizes legacy targeting defaults and clamps accuracy", () => {
    const legacy = profileFixture();
    const event = payload({ TargetOffsetX: 18, SpreadRadius: 20 }) as PayloadEventFields & {
      TargetingMode?: unknown;
      AccuracyPercent?: unknown;
    };
    Reflect.deleteProperty(event, "TargetingMode");
    Reflect.deleteProperty(event, "AccuracyPercent");
    if (legacy.ReleaseSource.Mode === "manual") {
      legacy.ReleaseSource.Events = [{ ...event, Id: "legacy", Time: 1 }] as never;
    }

    const normalized = normalizeProfilePayloadTargeting(legacy);
    const normalizedEvent = normalized.ReleaseSource.Mode === "manual" ? normalized.ReleaseSource.Events[0]! : undefined;
    expect(normalizedEvent).toMatchObject({ TargetingMode: "simple", AccuracyPercent: 75, TargetOffsetX: 18, SpreadRadius: 20 });

    const clamped = updateManualPayloadField(normalized, "legacy", "AccuracyPercent", 140);
    expect(clamped.ReleaseSource.Mode === "manual" ? clamped.ReleaseSource.Events[0]!.AccuracyPercent : -1).toBe(100);
    const runtime = compileSourceBundle(bundle(clamped), { publishedRevision: 1 }).bundle.Profiles.authoring_test!;
    expect(runtime.PayloadEvents[0]).toMatchObject({ TargetingMode: "simple", AccuracyPercent: 100, TargetOffsetX: 18, SpreadRadius: 20 });
  });

  it("preserves dormant targeting values through mode switches, duplication, and release conversion", () => {
    const initial = profileFixture({
      ReleaseSource: {
        Mode: "manual",
        Events: [{
          ...payload({ TargetingMode: "advanced", AccuracyPercent: 42, TargetOffsetX: 9, TargetOffsetY: 3, TargetOffsetZ: -4, SpreadRadius: 16 }),
          Id: "aimed",
          Time: 1,
        }],
        LegacyDynamic: false,
      },
    });
    const simple = updateManualPayloadField(initial, "aimed", "TargetingMode", "simple");
    const duplicated = duplicateManualRelease(simple, "aimed").profile;
    const repeated = updateReleaseMode(duplicated, "repeated");
    const template = getRepeatedReleaseGroups(repeated)[0]!.Template;
    expect(template).toMatchObject({
      TargetingMode: "simple",
      AccuracyPercent: 42,
      TargetOffsetX: 9,
      TargetOffsetY: 3,
      TargetOffsetZ: -4,
      SpreadRadius: 16,
    });
  });

  it("includes targeting changes in the semantic source hash", () => {
    const baseline = profileFixture({
      FirstPayloadDelaySeconds: 1,
      ReleaseSource: {
        Mode: "manual",
        Events: [{ ...payload(), Id: "aimed", Time: 1 }],
        LegacyDynamic: false,
      },
    });
    const accuracy = updateManualPayloadField(baseline, "aimed", "AccuracyPercent", 60);
    const advanced = updateManualPayloadField(baseline, "aimed", "TargetingMode", "advanced");
    const originalHash = compileSourceBundle(bundle(baseline), { publishedRevision: 1 }).sourceHashes.authoring_test;
    expect(compileSourceBundle(bundle(accuracy), { publishedRevision: 1 }).sourceHashes.authoring_test).not.toBe(originalHash);
    expect(compileSourceBundle(bundle(advanced), { publishedRevision: 1 }).sourceHashes.authoring_test).not.toBe(originalHash);
  });

  it("compiles mixed manual and intra-burst schedules without expanding them", () => {
    const source = profileFixture({
      EditorSourceSchemaVersion: 2,
      FirstPayloadDelaySeconds: 1,
      ReleaseSource: {
        Mode: "mixed",
        Events: [{ ...payload({ Payload: "patrol_heli_rocket" }), Id: "manual_rocket", Time: 1 }],
        Groups: [{
          Id: "gun_burst",
          Name: "Gun burst",
          StartTime: 1,
          IntervalSeconds: 0.2,
          UnitsPerRelease: 3,
          UnitIntervalSeconds: 0.05,
          MaximumUnits: 5,
          Template: payload({ Payload: "patrol_heli_gun", Count: 99 }),
          HardpointSequence: [],
        }],
      },
    });

    expect(validateSourceBundle(bundle(source), metadata())).toEqual([]);
    const runtime = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata() }).bundle.Profiles.authoring_test!;
    expect(runtime.PayloadReleaseMode).toBe("mixed");
    expect(runtime.PayloadEvents).toHaveLength(1);
    expect(runtime.GeneratedReleaseGroups).toMatchObject([{
      UnitIntervalSeconds: 0.05,
      UnitsPerRelease: 3,
      MaximumUnits: 5,
      Template: { Payload: "patrol_heli_gun", Count: 1 },
    }]);
    expect(runtime.CompiledReleaseEvents).toBeUndefined();
    expect(getReleasePreviewEvents(source, metadata()).map((event) => event.time)).toEqual([1, 1, 1.05, 1.1, 1.2, 1.25]);
  });

  it("rejects overlapping bursts and combined schedules above 2,000 units", () => {
    const source = profileFixture({
      EditorSourceSchemaVersion: 2,
      ReleaseSource: {
        Mode: "mixed",
        Events: [{ ...payload({ Count: 2 }), Id: "manual", Time: 2 }],
        Groups: [{
          Id: "overlap",
          Name: "Overlap",
          StartTime: 2,
          IntervalSeconds: 0.3,
          UnitsPerRelease: 3,
          UnitIntervalSeconds: 0.11,
          MaximumUnits: 1999,
          Template: payload({ Payload: "patrol_heli_gun" }),
          HardpointSequence: [],
        }],
      },
    });
    const issues = validateSourceBundle(bundle(source), metadata());
    expect(issues.map((issue) => issue.code)).toContain("burst_overlap");
    expect(issues.map((issue) => issue.code)).toContain("compiled_unit_count");
  });

  it("validates and compiles multi-burst strafing schedules above 200 release units", () => {
    const source = profileFixture({
      DurationSeconds: 70,
      FirstPayloadDelaySeconds: 1,
      Waypoints: [
        { Id: "wp_001", Time: 0, X: 0, Y: 0, Z: 0, RotationX: 0, RotationY: 0, RotationZ: 0 },
        { Id: "wp_002", Time: 35, X: 0, Y: 0, Z: 100, RotationX: 0, RotationY: 0, RotationZ: 0 },
        { Id: "wp_003", Time: 70, X: 0, Y: 0, Z: 220, RotationX: 0, RotationY: 0, RotationZ: 0 },
      ],
      ReleaseSource: {
        Mode: "repeated",
        Groups: [
          {
            Id: "automatic_001",
            Name: "Automatic group 1",
            StartTime: 1,
            IntervalSeconds: 0.3,
            UnitsPerRelease: 10,
            MaximumUnits: 120,
            Template: payload({ Payload: "bradley_longbarrel_burst", Count: 10 }),
            HardpointSequence: [],
          },
          {
            Id: "automatic_002",
            Name: "Automatic group 2",
            StartTime: 20,
            IntervalSeconds: 0.3,
            UnitsPerRelease: 10,
            MaximumUnits: 120,
            Template: payload({ Payload: "bradley_longbarrel_burst", Count: 10 }),
            HardpointSequence: [],
          },
          {
            Id: "automatic_003",
            Name: "Automatic group 3",
            StartTime: 40,
            IntervalSeconds: 0.3,
            UnitsPerRelease: 10,
            MaximumUnits: 86,
            Template: payload({ Payload: "bradley_longbarrel_burst", Count: 10 }),
            HardpointSequence: [],
          },
        ],
      },
    });

    expect(validateSourceBundle(bundle(source), metadata())).toEqual([]);
    const runtime = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata() }).bundle.Profiles
      .authoring_test!;
    expect(runtime.GeneratedReleaseGroups).toHaveLength(3);
    expect(runtime.GeneratedReleaseGroups?.reduce((total, group) => total + group.MaximumUnits, 0)).toBe(326);
    expect(runtime.CompiledReleaseEvents).toBeUndefined();
  });

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

    expect(firstProfile.PayloadEvents[0]?.CarrierOffsetX).toBe(-2.7);
    expect(secondProfile.PayloadEvents[0]?.CarrierOffsetX).toBe(-0.7);
    expect(firstProfile.CompiledReleaseEvents).toBeUndefined();
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
    const group = compileSourceBundle(bundle(source), { publishedRevision: 1, vehicleMetadata: metadata() }).bundle.Profiles
      .authoring_test!.GeneratedReleaseGroups![0]!;
    const compactOffsets = Array.from({ length: group.MaximumUnits }, (_, index) => {
      const hardpoint = group.HardpointOffsets?.[index % (group.HardpointOffsets.length || 1)];
      return group.Template.CarrierOffsetX + (hardpoint?.X ?? 0);
    });
    const compactTimes = Array.from({ length: group.MaximumUnits }, (_, index) =>
      group.StartTime + Math.floor(index / group.UnitsPerRelease) * group.IntervalSeconds + (index % group.UnitsPerRelease) * group.UnitIntervalSeconds,
    );

    expect(preview.map((event) => event.fields.CarrierOffsetX)).toEqual(compactOffsets);
    expect(preview.map((event) => event.time)).toEqual(compactTimes);
  });

  it("previews every unit in a valid large multi-group gun schedule", () => {
    const groups = [12, 34, 54].map((startTime, index) => ({
      Id: `gun_${index + 1}`,
      Name: `Gun run ${index + 1}`,
      StartTime: startTime,
      IntervalSeconds: 0.23,
      UnitIntervalSeconds: 0.007,
      UnitsPerRelease: 30,
      MaximumUnits: 600,
      Template: payload({ Payload: "bradley_coax_gun" }),
      HardpointSequence: [],
    }));
    const source = profileFixture({
      EditorSourceSchemaVersion: 2,
      DurationSeconds: 80,
      FirstPayloadDelaySeconds: 12,
      Waypoints: [
        { Id: "wp_001", Time: 0, X: 0, Y: 50, Z: -100, RotationX: 0, RotationY: 0, RotationZ: 0 },
        { Id: "wp_002", Time: 80, X: 0, Y: 50, Z: 100, RotationX: 0, RotationY: 0, RotationZ: 0 },
      ],
      ReleaseSource: { Mode: "repeated", Groups: groups },
    });

    const preview = getReleasePreviewEvents(source, metadata());

    expect(validateSourceBundle(bundle(source), metadata())).toEqual([]);
    expect(preview).toHaveLength(1_800);
    expect(preview.some((event) => event.id === "gun_3_600")).toBe(true);
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
