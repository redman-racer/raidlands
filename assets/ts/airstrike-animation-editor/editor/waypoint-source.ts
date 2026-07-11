import type { Vector3 } from "three";
import { threeVectorToUnityPosition } from "./coordinates";
import type { EditorSourceProfile, SourceWaypoint } from "../types";

export const WAYPOINT_FIELDS = ["Time", "X", "Y", "Z", "RotationX", "RotationY", "RotationZ"] as const;
export type EditableWaypointField = (typeof WAYPOINT_FIELDS)[number];

function cloneProfile(profile: EditorSourceProfile): EditorSourceProfile {
  return JSON.parse(JSON.stringify(profile)) as EditorSourceProfile;
}

export function roundEditorNumber(value: number, precision = 3): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function findWaypoint(profile: EditorSourceProfile, waypointId: string): SourceWaypoint | undefined {
  return profile.Waypoints.find((waypoint) => waypoint.Id === waypointId);
}

export function firstWaypointId(profile: EditorSourceProfile): string {
  return profile.Waypoints[0]?.Id ?? "";
}

export function updateWaypointPositionFromThree(
  profile: EditorSourceProfile,
  waypointId: string,
  position: Vector3,
  precision = 3,
): EditorSourceProfile {
  const next = cloneProfile(profile);
  const waypoint = findWaypoint(next, waypointId);
  if (!waypoint) {
    return next;
  }
  const unity = threeVectorToUnityPosition(position);
  waypoint.X = roundEditorNumber(unity.x, precision);
  waypoint.Y = roundEditorNumber(unity.y, precision);
  waypoint.Z = roundEditorNumber(unity.z, precision);
  return next;
}

export function updateWaypointField(
  profile: EditorSourceProfile,
  waypointId: string,
  field: EditableWaypointField,
  value: number,
): EditorSourceProfile {
  const next = cloneProfile(profile);
  const waypoint = findWaypoint(next, waypointId);
  if (!waypoint) {
    return next;
  }
  waypoint[field] = roundEditorNumber(value, field === "Time" ? 3 : 3);
  if (field === "Time") {
    next.Waypoints.sort((left, right) => left.Time - right.Time);
  }
  return next;
}
