import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  sourceWaypointToThreePosition,
  sourceWaypointToThreeQuaternion,
  threeQuaternionToUnityValue,
  unityQuaternionValueToThreeQuaternion,
} from "../assets/ts/airstrike-animation-editor/editor/coordinates";
import {
  addWaypointAtTime,
  deleteWaypoint,
  duplicateWaypoint,
  updateWaypointField,
  updateWaypointPositionFromThree,
} from "../assets/ts/airstrike-animation-editor/editor/waypoint-source";
import { quaternionDot, unityEulerQuaternion } from "../assets/ts/airstrike-animation-editor/index";
import type { EditorSourceProfile } from "../assets/ts/airstrike-animation-editor/index";

function profileFixture(): EditorSourceProfile {
  return {
    EditorSourceSchemaVersion: 1,
    ProfileKey: "test_profile",
    DisplayName: "Test Profile",
    Vehicle: "f15",
    DurationSeconds: 4,
    FirstPayloadDelaySeconds: 2,
    RotationSmoothTimeSeconds: 0.12,
    StopAtWaypoints: false,
    MinimumTerrainClearance: 55,
    PositionInterpolation: "time_hermite",
    RotationMode: "follow_path_plus_offset",
    Waypoints: [
      { Id: "wp_001", Time: 0, X: 1, Y: 2, Z: -10, RotationX: 0, RotationY: 0, RotationZ: 0 },
      { Id: "wp_002", Time: 2, X: 3, Y: 4, Z: 20, RotationX: 5, RotationY: 10, RotationZ: 15 },
      { Id: "wp_003", Time: 4, X: 5, Y: 6, Z: 30, RotationX: 0, RotationY: 0, RotationZ: 0 },
    ],
    ReleaseSource: {
      Mode: "manual",
      Events: [],
      LegacyDynamic: true,
    },
    EditorMetadata: {
      Notes: "",
      Tags: [],
      VehiclePreviewOverrides: {},
    },
  };
}

describe("airstrike editor viewport coordinate helpers", () => {
  it("reflects Unity target-relative Z into Three.js render space", () => {
    const waypoint = profileFixture().Waypoints[0]!;
    expect(sourceWaypointToThreePosition(waypoint)).toEqual(new Vector3(1, 2, 10));
  });

  it("round-trips Unity-authored waypoint rotations through Three.js quaternions", () => {
    const waypoint = profileFixture().Waypoints[1]!;
    const three = sourceWaypointToThreeQuaternion(waypoint);
    const unity = threeQuaternionToUnityValue(new Quaternion(three.x, three.y, three.z, three.w));
    const expected = unityEulerQuaternion(waypoint.RotationX, waypoint.RotationY, waypoint.RotationZ);
    expect(Math.abs(quaternionDot(unity, expected))).toBeCloseTo(1, 10);

    const roundTrip = threeQuaternionToUnityValue(unityQuaternionValueToThreeQuaternion(expected));
    expect(Math.abs(quaternionDot(roundTrip, expected))).toBeCloseTo(1, 10);
  });
});

describe("airstrike editor waypoint source updates", () => {
  it("writes TransformControls positions back into Unity source coordinates", () => {
    const source = profileFixture();
    const updated = updateWaypointPositionFromThree(source, "wp_002", new Vector3(-12.3456, 78.9012, -44.4444));

    expect(updated).not.toBe(source);
    expect(updated.Waypoints[1]).toMatchObject({
      Id: "wp_002",
      X: -12.346,
      Y: 78.901,
      Z: 44.444,
    });
    expect(source.Waypoints[1]).toMatchObject({ X: 3, Y: 4, Z: 20 });
  });

  it("updates numeric waypoint fields and keeps time-ordered waypoint source", () => {
    const source = profileFixture();
    const moved = updateWaypointField(source, "wp_003", "Time", 1);
    const rotated = updateWaypointField(moved, "wp_003", "RotationZ", 37.25);

    expect(rotated.Waypoints.map((waypoint) => waypoint.Id)).toEqual(["wp_001", "wp_003", "wp_002"]);
    expect(rotated.Waypoints[1]).toMatchObject({ Id: "wp_003", Time: 1, RotationZ: 37.25 });
  });

  it("adds, duplicates, and deletes waypoints while preserving route constraints", () => {
    const source = profileFixture();
    const added = addWaypointAtTime(source, 1);
    expect(added.profile.Waypoints.map((waypoint) => waypoint.Id)).toContain(added.waypointId);
    expect(added.profile.Waypoints.find((waypoint) => waypoint.Id === added.waypointId)).toMatchObject({
      Time: 1,
      X: expect.any(Number),
      RotationZ: expect.any(Number),
    });

    const duplicated = duplicateWaypoint(added.profile, added.waypointId);
    expect(duplicated.waypointId).not.toBe(added.waypointId);
    expect(duplicated.profile.Waypoints).toHaveLength(5);

    const deleted = deleteWaypoint(duplicated.profile, duplicated.waypointId);
    expect(deleted.Waypoints).toHaveLength(4);

    const minimum = deleteWaypoint(
      { ...source, Waypoints: source.Waypoints.slice(0, 2) },
      source.Waypoints[0]!.Id,
    );
    expect(minimum.Waypoints).toHaveLength(2);
  });
});
