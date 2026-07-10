import { describe, expect, it } from "vitest";
import {
  compileSourceBundle,
  importSchema1Runtime,
  type LegacyVisualProfileFile,
} from "../assets/ts/airstrike-animation-editor/index";

const legacyTemplate = {
  Time: 0,
  Payload: "",
  Index: 0,
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
};

describe("schema-1 VisualProfiles import", () => {
  it("preserves legacy dynamic first-payload timing and omits compiled releases", () => {
    const legacy: LegacyVisualProfileFile = {
      SchemaVersion: 1,
      AllowDangerousPayloadPreview: false,
      Profiles: {
        jet_mlrs_run: {
          Vehicle: "f15",
          DurationSeconds: 8,
          FirstPayloadDelaySeconds: 3.5,
          RotationSmoothTimeSeconds: 0.12,
          StopAtWaypoints: true,
          MinimumTerrainClearance: 55,
          PayloadReleaseMode: "manual",
          MaxPayloadCount: 0,
          PayloadReleaseIntervalSeconds: 0.5,
          ReleaseTemplate: legacyTemplate,
          Waypoints: [
            { Time: 0, X: 0, Y: 145, Z: -460, RotationX: 0, RotationY: 0, RotationZ: 0 },
            { Time: 8, X: 0, Y: 155, Z: 520, RotationX: 0, RotationY: 0, RotationZ: 540 },
          ],
          PayloadEvents: [],
          CompiledTrack: undefined as never,
        },
      },
    };
    const source = importSchema1Runtime(legacy);
    const imported = source.Profiles.jet_mlrs_run!;
    expect(imported.FirstPayloadDelaySeconds).toBe(3.5);
    expect(imported.Waypoints[1]!.RotationZ).toBe(540);
    expect(imported.ReleaseSource).toMatchObject({ Mode: "manual", LegacyDynamic: true, Events: [] });

    const compiled = compileSourceBundle(source, { publishedRevision: 1 });
    const runtime = compiled.bundle.Profiles.jet_mlrs_run!;
    expect(runtime.FirstPayloadDelaySeconds).toBe(3.5);
    expect(runtime.Waypoints[1]!.RotationZ).toBe(540);
    expect("CompiledReleaseEvents" in runtime).toBe(false);
    expect(runtime.PayloadReleaseMode).toBe("manual");
    expect(runtime.MaxPayloadCount).toBe(0);
  });

  it("generates deterministic stable IDs and profile ordering", () => {
    const legacy: LegacyVisualProfileFile = {
      SchemaVersion: 1,
      Profiles: {
        z_profile: {
          Vehicle: "drone",
          DurationSeconds: 2,
          FirstPayloadDelaySeconds: 1,
          RotationSmoothTimeSeconds: 0.12,
          StopAtWaypoints: false,
          MinimumTerrainClearance: 12,
          PayloadReleaseMode: "manual",
          MaxPayloadCount: 1,
          PayloadReleaseIntervalSeconds: 0.5,
          ReleaseTemplate: legacyTemplate,
          Waypoints: [
            { Time: 0, X: 0, Y: 20, Z: -10, RotationX: 0, RotationY: 0, RotationZ: 0 },
            { Time: 2, X: 0, Y: 20, Z: 10, RotationX: 0, RotationY: 0, RotationZ: 0 },
          ],
          PayloadEvents: [{ ...legacyTemplate, Time: 1, Payload: "smoke", Index: 4, Count: 1 }],
          CompiledTrack: undefined as never,
        },
      },
    };
    const first = importSchema1Runtime(legacy);
    const second = importSchema1Runtime(legacy);
    expect(first).toEqual(second);
    expect(first.Profiles.z_profile!.Waypoints.map((waypoint) => waypoint.Id)).toEqual(["waypoint_001", "waypoint_002"]);
    expect(first.Profiles.z_profile!.ReleaseSource).toMatchObject({
      Mode: "manual",
      Events: [{ Id: "event_001", Time: 1, Payload: "smoke" }],
    });
  });

  it("keeps editor-only labels and stable IDs out of the runtime source hash", () => {
    const legacy: LegacyVisualProfileFile = {
      SchemaVersion: 1,
      Profiles: {
        hash_profile: {
          Vehicle: "f15",
          DurationSeconds: 2,
          FirstPayloadDelaySeconds: 1,
          RotationSmoothTimeSeconds: 0.12,
          StopAtWaypoints: false,
          MinimumTerrainClearance: 55,
          PayloadReleaseMode: "manual",
          MaxPayloadCount: 0,
          PayloadReleaseIntervalSeconds: 0.5,
          ReleaseTemplate: legacyTemplate,
          Waypoints: [
            { Time: 0, X: 0, Y: 50, Z: -20, RotationX: 0, RotationY: 0, RotationZ: 0 },
            { Time: 2, X: 0, Y: 50, Z: 20, RotationX: 0, RotationY: 0, RotationZ: 0 },
          ],
          PayloadEvents: [],
          CompiledTrack: undefined as never,
        },
      },
    };
    const source = importSchema1Runtime(legacy);
    const original = compileSourceBundle(source, { publishedRevision: 1 });
    source.Profiles.hash_profile!.DisplayName = "Changed label";
    source.Profiles.hash_profile!.EditorMetadata.Notes = "Changed note";
    source.Profiles.hash_profile!.Waypoints[0]!.Id = "renamed_waypoint";
    const editorOnlyChange = compileSourceBundle(source, { publishedRevision: 1 });
    expect(editorOnlyChange.sourceHashes).toEqual(original.sourceHashes);
    expect(editorOnlyChange.sha256).toBe(original.sha256);

    source.Profiles.hash_profile!.Waypoints[0]!.X = 1;
    const semanticChange = compileSourceBundle(source, { publishedRevision: 1 });
    expect(semanticChange.sourceHashes.hash_profile).not.toBe(original.sourceHashes.hash_profile);
    expect(semanticChange.sha256).not.toBe(original.sha256);
  });
});
