import {
  DEFAULT_PAYLOAD_EVENT,
  EDITOR_SOURCE_SCHEMA_VERSION,
  type EditorSourceBundle,
  type EditorSourceProfile,
  type LegacyVisualProfileFile,
  type PayloadEventFields,
  type RuntimePayloadEvent,
  type SourcePayloadEvent,
} from "./types";
import { inferWaypointSpeeds } from "./editor/speed-normalization";
import { PROFILE_KEY_PATTERN } from "./validation";

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function integerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function payloadFields(value: Partial<RuntimePayloadEvent> | undefined): PayloadEventFields {
  const source = value ?? {};
  return {
    Payload: typeof source.Payload === "string" ? source.Payload.trim().toLowerCase() : DEFAULT_PAYLOAD_EVENT.Payload,
    AmmoSequence: Array.isArray(source.AmmoSequence) ? [...source.AmmoSequence] : [],
    Count: Math.max(1, integerOr(source.Count, DEFAULT_PAYLOAD_EVENT.Count)),
    CarrierOffsetX: finiteOr(source.CarrierOffsetX, DEFAULT_PAYLOAD_EVENT.CarrierOffsetX),
    CarrierOffsetY: finiteOr(source.CarrierOffsetY, DEFAULT_PAYLOAD_EVENT.CarrierOffsetY),
    CarrierOffsetZ: finiteOr(source.CarrierOffsetZ, DEFAULT_PAYLOAD_EVENT.CarrierOffsetZ),
    TargetOffsetX: finiteOr(source.TargetOffsetX, DEFAULT_PAYLOAD_EVENT.TargetOffsetX),
    TargetOffsetY: finiteOr(source.TargetOffsetY, DEFAULT_PAYLOAD_EVENT.TargetOffsetY),
    TargetOffsetZ: finiteOr(source.TargetOffsetZ, DEFAULT_PAYLOAD_EVENT.TargetOffsetZ),
    SpreadRadius: finiteOr(source.SpreadRadius, DEFAULT_PAYLOAD_EVENT.SpreadRadius),
    TargetingMode: source.TargetingMode === "advanced" ? "advanced" : "simple",
    AccuracyPercent: Math.min(100, Math.max(0, finiteOr(source.AccuracyPercent, DEFAULT_PAYLOAD_EVENT.AccuracyPercent))),
    LaunchSpeed: finiteOr(source.LaunchSpeed, DEFAULT_PAYLOAD_EVENT.LaunchSpeed),
    FuseSeconds: finiteOr(source.FuseSeconds, DEFAULT_PAYLOAD_EVENT.FuseSeconds),
    DamageScale: finiteOr(source.DamageScale, DEFAULT_PAYLOAD_EVENT.DamageScale),
    VehicleDamageScale: finiteOr(source.VehicleDamageScale, DEFAULT_PAYLOAD_EVENT.VehicleDamageScale),
    SplashRadius: finiteOr(source.SplashRadius, DEFAULT_PAYLOAD_EVENT.SplashRadius),
    ImpactRadius: finiteOr(source.ImpactRadius, DEFAULT_PAYLOAD_EVENT.ImpactRadius),
    MaxTrackingSeconds: finiteOr(source.MaxTrackingSeconds, DEFAULT_PAYLOAD_EVENT.MaxTrackingSeconds),
    MaxTrackingDistance: finiteOr(source.MaxTrackingDistance, DEFAULT_PAYLOAD_EVENT.MaxTrackingDistance),
    DamageScales:
      source.DamageScales && typeof source.DamageScales === "object" && !Array.isArray(source.DamageScales)
        ? Object.fromEntries(
            Object.entries(source.DamageScales).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
          )
        : {},
  };
}

function displayNameFromKey(key: string): string {
  return key
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function importProfile(key: string, legacy: Partial<EditorSourceProfile & { PayloadReleaseMode: string; MaxPayloadCount: number; PayloadReleaseIntervalSeconds: number; ReleaseTemplate: RuntimePayloadEvent; PayloadEvents: RuntimePayloadEvent[] }>): EditorSourceProfile {
  const duration = finiteOr(legacy.DurationSeconds, 8);
  const legacyEvents = Array.isArray(legacy.PayloadEvents) ? legacy.PayloadEvents : [];
  const events: SourcePayloadEvent[] = legacyEvents
    .map((event, index) => ({
      Id: `event_${String(index + 1).padStart(3, "0")}`,
      Time: finiteOr(event?.Time, 0),
      ...payloadFields(event),
    }))
    .sort((left, right) => left.Time - right.Time);
  const configuredFirst = finiteOr(legacy.FirstPayloadDelaySeconds, 3.5);
  const firstPayloadDelay = events.length > 0 ? events[0]!.Time : configuredFirst;
  const maximumUnits = Math.max(0, integerOr(legacy.MaxPayloadCount, 0));
  const template = payloadFields(legacy.ReleaseTemplate);
  const generated = String(legacy.PayloadReleaseMode ?? "manual").toLowerCase() === "generated";
  return inferWaypointSpeeds({
    EditorSourceSchemaVersion: EDITOR_SOURCE_SCHEMA_VERSION,
    ProfileKey: key,
    DisplayName: displayNameFromKey(key),
    Vehicle: typeof legacy.Vehicle === "string" ? legacy.Vehicle.trim().toLowerCase() : "f15",
    DurationSeconds: duration,
    FirstPayloadDelaySeconds: generated
      ? finiteOr(legacy.ReleaseTemplate?.Time, 0) > 0
        ? finiteOr(legacy.ReleaseTemplate?.Time, configuredFirst)
        : configuredFirst
      : firstPayloadDelay,
    RotationSmoothTimeSeconds: finiteOr(legacy.RotationSmoothTimeSeconds, 0.12),
    StopAtWaypoints: legacy.StopAtWaypoints !== false,
    MinimumTerrainClearance: finiteOr(legacy.MinimumTerrainClearance, legacy.Vehicle === "drone" ? 12 : 55),
    PositionInterpolation: "time_hermite",
    RotationMode: "follow_path_plus_offset",
    Waypoints: (Array.isArray(legacy.Waypoints) ? legacy.Waypoints : []).map((waypoint, index) => ({
      Id: `waypoint_${String(index + 1).padStart(3, "0")}`,
      Time: finiteOr(waypoint?.Time, index === 0 ? 0 : duration),
      X: finiteOr(waypoint?.X, 0),
      Y: finiteOr(waypoint?.Y, 0),
      Z: finiteOr(waypoint?.Z, 0),
      RotationX: finiteOr(waypoint?.RotationX, 0),
      RotationY: finiteOr(waypoint?.RotationY, 0),
      RotationZ: finiteOr(waypoint?.RotationZ, 0),
    })),
    ReleaseSource: generated
      ? {
          Mode: "repeated",
          StartTime:
            finiteOr(legacy.ReleaseTemplate?.Time, 0) > 0
              ? finiteOr(legacy.ReleaseTemplate?.Time, configuredFirst)
              : configuredFirst,
          IntervalSeconds: finiteOr(legacy.PayloadReleaseIntervalSeconds, 0.5),
          UnitsPerRelease: template.Count,
          MaximumUnits: maximumUnits,
          Template: template,
          HardpointSequence: [],
          ...(maximumUnits === 0 ? { LegacyDynamic: true } : {}),
        }
      : {
          Mode: "manual",
          Events: events,
          MaximumUnits: maximumUnits,
          FallbackIntervalSeconds: finiteOr(legacy.PayloadReleaseIntervalSeconds, 0.5),
          Template: template,
          ...(events.length === 0 ? { LegacyDynamic: true } : {}),
        },
    EditorMetadata: {
      Notes: "Imported from Rust VisualProfiles schema 1.",
      Tags: ["server-import"],
      VehiclePreviewOverrides: {},
    },
  });
}

export function importSchema1Runtime(value: LegacyVisualProfileFile): EditorSourceBundle {
  if (!value || typeof value !== "object" || !value.Profiles || typeof value.Profiles !== "object") {
    throw new TypeError("Schema-1 VisualProfiles file must contain a Profiles object.");
  }
  const profiles: Record<string, EditorSourceProfile> = {};
  for (const key of Object.keys(value.Profiles).sort()) {
    if (!PROFILE_KEY_PATTERN.test(key)) {
      throw new TypeError(`Schema-1 profile key '${key}' is not safe.`);
    }
    const profile = value.Profiles[key];
    if (!profile || typeof profile !== "object") {
      throw new TypeError(`Schema-1 profile '${key}' must be an object.`);
    }
    profiles[key] = importProfile(key, profile as never);
  }
  return {
    EditorSourceSchemaVersion: EDITOR_SOURCE_SCHEMA_VERSION,
    AllowDangerousPayloadPreview: value.AllowDangerousPayloadPreview === true,
    Profiles: profiles,
  };
}
