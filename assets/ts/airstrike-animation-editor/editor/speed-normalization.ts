import type { EditorSourceProfile, SourceWaypoint } from "../types";
import { roundEditorNumber } from "./waypoint-source";

export const DEFAULT_TARGET_SPEED_METERS_PER_SECOND = 90;
export const MILES_PER_HOUR_PER_METER_PER_SECOND = 2.2369362920544;

function cloneProfile(profile: EditorSourceProfile): EditorSourceProfile {
  return JSON.parse(JSON.stringify(profile)) as EditorSourceProfile;
}

function positiveSpeed(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function waypointDistance(left: SourceWaypoint, right: SourceWaypoint): number {
  return Math.hypot(right.X - left.X, right.Y - left.Y, right.Z - left.Z);
}

function firstReleaseTime(profile: EditorSourceProfile): number {
  const release = profile.ReleaseSource;
  if (release.Mode === "manual" && release.Events.length > 0) {
    return Math.min(...release.Events.map((event) => event.Time));
  }
  if (release.Mode === "repeated") {
    return release.StartTime;
  }
  return Math.min(profile.DurationSeconds, Math.max(0, profile.FirstPayloadDelaySeconds));
}

export function metersPerSecondToMilesPerHour(value: number): number {
  return value * MILES_PER_HOUR_PER_METER_PER_SECOND;
}

export function formatMilesPerHour(value: number): string {
  return Number.isFinite(value) ? metersPerSecondToMilesPerHour(value).toFixed(1) : "";
}

export function normalizeWaypointTimes(profile: EditorSourceProfile): EditorSourceProfile {
  const next = cloneProfile(profile);
  const globalSpeed = positiveSpeed(
    next.EditorMetadata.GlobalTargetSpeedMetersPerSecond,
    DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
  );
  let elapsed = 0;

  for (let index = 0; index < next.Waypoints.length; index += 1) {
    const waypoint = next.Waypoints[index]!;
    waypoint.TargetSpeedMetersPerSecond = positiveSpeed(waypoint.TargetSpeedMetersPerSecond, globalSpeed);
    waypoint.Time = index === 0 ? 0 : waypoint.Time;
    if (index === 0) {
      continue;
    }

    const previous = next.Waypoints[index - 1]!;
    const previousSpeed = positiveSpeed(previous.TargetSpeedMetersPerSecond, globalSpeed);
    const currentSpeed = positiveSpeed(waypoint.TargetSpeedMetersPerSecond, globalSpeed);
    const averageSpeed = Math.max(0.1, (previousSpeed + currentSpeed) * 0.5);
    elapsed += waypointDistance(previous, waypoint) / averageSpeed;
    waypoint.Time = roundEditorNumber(elapsed, 3);
  }

  next.DurationSeconds = roundEditorNumber(next.Waypoints[next.Waypoints.length - 1]?.Time ?? next.DurationSeconds, 3);
  next.FirstPayloadDelaySeconds = roundEditorNumber(firstReleaseTime(next), 3);
  return next;
}

export function setGlobalTargetSpeed(profile: EditorSourceProfile, speedMetersPerSecond: number): EditorSourceProfile {
  const next = cloneProfile(profile);
  const speed = positiveSpeed(speedMetersPerSecond, DEFAULT_TARGET_SPEED_METERS_PER_SECOND);
  next.EditorMetadata.GlobalTargetSpeedMetersPerSecond = roundEditorNumber(speed, 3);
  for (const waypoint of next.Waypoints) {
    waypoint.TargetSpeedMetersPerSecond = next.EditorMetadata.GlobalTargetSpeedMetersPerSecond;
  }
  return normalizeWaypointTimes(next);
}

export function setWaypointTargetSpeed(
  profile: EditorSourceProfile,
  waypointId: string,
  speedMetersPerSecond: number,
): EditorSourceProfile {
  const next = cloneProfile(profile);
  const speed = positiveSpeed(speedMetersPerSecond, DEFAULT_TARGET_SPEED_METERS_PER_SECOND);
  const waypoint = next.Waypoints.find((entry) => entry.Id === waypointId);
  if (waypoint) {
    waypoint.TargetSpeedMetersPerSecond = roundEditorNumber(speed, 3);
  }
  return normalizeWaypointTimes(next);
}
