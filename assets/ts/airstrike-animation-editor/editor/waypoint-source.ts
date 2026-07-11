import type { Vector3 } from "three";
import { evaluateSourcePose } from "../math";
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

function nextWaypointId(waypoints: SourceWaypoint[]): string {
  const used = new Set(waypoints.map((waypoint) => waypoint.Id));
  for (let index = waypoints.length + 1; index < 10000; index += 1) {
    const id = `wp_${String(index).padStart(3, "0")}`;
    if (!used.has(id)) {
      return id;
    }
  }
  return `wp_${Date.now()}`;
}

function sortWaypoints(profile: EditorSourceProfile): void {
  profile.Waypoints.sort((left, right) => left.Time - right.Time);
  profile.DurationSeconds = Math.max(profile.DurationSeconds, profile.Waypoints[profile.Waypoints.length - 1]?.Time ?? 0);
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
    sortWaypoints(next);
  }
  return next;
}

export function addWaypointAtTime(
  profile: EditorSourceProfile,
  time: number,
): { profile: EditorSourceProfile; waypointId: string } {
  const next = cloneProfile(profile);
  const waypointTime = Math.min(Math.max(0, Number.isFinite(time) ? time : 0), Math.max(0, next.DurationSeconds));
  const pose = evaluateSourcePose(next, waypointTime);
  const waypoint: SourceWaypoint = {
    Id: nextWaypointId(next.Waypoints),
    Time: roundEditorNumber(waypointTime, 3),
    X: roundEditorNumber(pose.position.x, 3),
    Y: roundEditorNumber(pose.position.y, 3),
    Z: roundEditorNumber(pose.position.z, 3),
    RotationX: roundEditorNumber(pose.euler.x, 3),
    RotationY: roundEditorNumber(pose.euler.y, 3),
    RotationZ: roundEditorNumber(pose.euler.z, 3),
  };
  next.Waypoints.push(waypoint);
  sortWaypoints(next);
  return { profile: next, waypointId: waypoint.Id };
}

export function duplicateWaypoint(
  profile: EditorSourceProfile,
  waypointId: string,
): { profile: EditorSourceProfile; waypointId: string } {
  const next = cloneProfile(profile);
  const source = findWaypoint(next, waypointId);
  if (!source) {
    return { profile: next, waypointId: "" };
  }
  const duplicate: SourceWaypoint = {
    ...source,
    Id: nextWaypointId(next.Waypoints),
    Time: roundEditorNumber(Math.min(next.DurationSeconds, source.Time + 0.1), 3),
  };
  next.Waypoints.push(duplicate);
  sortWaypoints(next);
  return { profile: next, waypointId: duplicate.Id };
}

export function deleteWaypoint(profile: EditorSourceProfile, waypointId: string): EditorSourceProfile {
  const next = cloneProfile(profile);
  if (next.Waypoints.length <= 2) {
    return next;
  }
  next.Waypoints = next.Waypoints.filter((waypoint) => waypoint.Id !== waypointId);
  sortWaypoints(next);
  return next;
}
