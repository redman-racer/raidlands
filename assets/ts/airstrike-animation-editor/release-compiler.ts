import { quantizeCanonicalNumber } from "./canonical-json";
import {
  DEFAULT_PAYLOAD_EVENT,
  type EditorSourceProfile,
  type PayloadEventFields,
  type RuntimePayloadEvent,
  type SourcePayloadEvent,
  type VehicleHardpointMetadata,
  type VehiclePreviewMetadataFile,
} from "./types";
import { clonePayloadFields } from "./validation";
import { hasGroupedRepeatedReleases, repeatedReleaseGroups } from "./repeated-release";

function orderedManualEvents(profile: EditorSourceProfile) {
  return profile.ReleaseSource.Mode === "manual"
    ? profile.ReleaseSource.Events.map((event, sourceIndex) => ({ event, sourceIndex })).sort(
        (left, right) => left.event.Time - right.event.Time || left.sourceIndex - right.sourceIndex,
      )
    : [];
}

function runtimeEvent(fields: PayloadEventFields, time: number, index: number): RuntimePayloadEvent {
  return {
    Time: quantizeCanonicalNumber(time),
    Payload: fields.Payload,
    Index: index,
    Count: fields.Count,
    CarrierOffsetX: quantizeCanonicalNumber(fields.CarrierOffsetX),
    CarrierOffsetY: quantizeCanonicalNumber(fields.CarrierOffsetY),
    CarrierOffsetZ: quantizeCanonicalNumber(fields.CarrierOffsetZ),
    TargetOffsetX: quantizeCanonicalNumber(fields.TargetOffsetX),
    TargetOffsetY: quantizeCanonicalNumber(fields.TargetOffsetY),
    TargetOffsetZ: quantizeCanonicalNumber(fields.TargetOffsetZ),
    SpreadRadius: quantizeCanonicalNumber(fields.SpreadRadius),
    LaunchSpeed: quantizeCanonicalNumber(fields.LaunchSpeed),
    FuseSeconds: quantizeCanonicalNumber(fields.FuseSeconds),
    DamageScale: quantizeCanonicalNumber(fields.DamageScale),
    VehicleDamageScale: quantizeCanonicalNumber(fields.VehicleDamageScale),
    SplashRadius: quantizeCanonicalNumber(fields.SplashRadius),
    ImpactRadius: quantizeCanonicalNumber(fields.ImpactRadius),
    MaxTrackingSeconds: quantizeCanonicalNumber(fields.MaxTrackingSeconds),
    MaxTrackingDistance: quantizeCanonicalNumber(fields.MaxTrackingDistance),
    DamageScales: Object.fromEntries(
      Object.entries(fields.DamageScales)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => [key, quantizeCanonicalNumber(value)]),
    ),
  };
}

function resolveHardpoints(
  profile: EditorSourceProfile,
  metadata?: VehiclePreviewMetadataFile,
): Map<string, VehicleHardpointMetadata> {
  const resolved = new Map<string, VehicleHardpointMetadata>();
  for (const hardpoint of metadata?.vehicles?.[profile.Vehicle]?.hardpoints ?? []) {
    resolved.set(hardpoint.id, { ...hardpoint });
  }
  for (const override of profile.EditorMetadata.VehiclePreviewOverrides.Hardpoints ?? []) {
    resolved.set(override.Id, { id: override.Id, x: override.X, y: override.Y, z: override.Z });
  }
  return resolved;
}

function hardpointProjection(hardpoints: Map<string, VehicleHardpointMetadata>, ids: Iterable<string>): Record<string, { X: number; Y: number; Z: number }> {
  const projected: Record<string, { X: number; Y: number; Z: number }> = {};
  for (const id of ids) {
    const hardpoint = hardpoints.get(id);
    if (hardpoint) {
      projected[id] = { X: hardpoint.x, Y: hardpoint.y, Z: hardpoint.z };
    }
  }
  return projected;
}

function applyHardpoint<T extends PayloadEventFields>(
  fields: T,
  hardpoints: Map<string, VehicleHardpointMetadata>,
  hardpointId?: string,
): T {
  const hardpoint = hardpointId ? hardpoints.get(hardpointId) : undefined;
  if (!hardpoint) {
    return { ...fields, DamageScales: { ...fields.DamageScales } };
  }
  return {
    ...fields,
    CarrierOffsetX: fields.CarrierOffsetX + hardpoint.x,
    CarrierOffsetY: fields.CarrierOffsetY + hardpoint.y,
    CarrierOffsetZ: fields.CarrierOffsetZ + hardpoint.z,
    DamageScales: { ...fields.DamageScales },
  };
}

function manualHardpointId(event: SourcePayloadEvent): string | undefined {
  return typeof event.HardpointId === "string" && event.HardpointId.trim() !== "" ? event.HardpointId.trim() : undefined;
}

export interface ReleaseCompilationResult {
  legacyMode: "manual" | "generated";
  legacyMaximumUnits: number;
  legacyIntervalSeconds: number;
  legacyTemplate: RuntimePayloadEvent;
  legacyEvents: RuntimePayloadEvent[];
  compiledEvents?: RuntimePayloadEvent[];
  resolvedHardpointOffsets: Record<string, { X: number; Y: number; Z: number }>;
}

export function compileReleaseSchedule(
  profile: EditorSourceProfile,
  metadata?: VehiclePreviewMetadataFile,
): ReleaseCompilationResult {
  const release = profile.ReleaseSource;
  if (release.Mode === "manual") {
    const ordered = orderedManualEvents(profile);
    const hardpoints = resolveHardpoints(profile, metadata);
    const resolvedHardpointOffsets = hardpointProjection(
      hardpoints,
      ordered.map(({ event }) => manualHardpointId(event)).filter((id): id is string => Boolean(id)),
    );
    const legacyTemplateFields = clonePayloadFields(release.Template ?? DEFAULT_PAYLOAD_EVENT);
    const legacyEvents = ordered.map(({ event }, index) =>
      runtimeEvent(applyHardpoint(event, hardpoints, manualHardpointId(event)), event.Time, index + 1),
    );
    if (release.LegacyDynamic === true && release.Events.length === 0) {
      return {
        legacyMode: "manual",
        legacyMaximumUnits: release.MaximumUnits ?? 0,
        legacyIntervalSeconds: release.FallbackIntervalSeconds ?? 0.5,
        legacyTemplate: runtimeEvent(legacyTemplateFields, 0, 0),
        legacyEvents,
        resolvedHardpointOffsets,
      };
    }

    const cap = release.MaximumUnits && release.MaximumUnits > 0 ? release.MaximumUnits : Number.POSITIVE_INFINITY;
    const compiledEvents: RuntimePayloadEvent[] = [];
    let sequence = 1;
    for (const { event } of ordered) {
      for (let unit = 0; unit < event.Count && compiledEvents.length < cap; unit += 1) {
        compiledEvents.push(
          runtimeEvent({ ...applyHardpoint(event, hardpoints, manualHardpointId(event)), Count: 1 }, event.Time, sequence),
        );
        sequence += 1;
      }
    }
    return {
      legacyMode: "manual",
      legacyMaximumUnits: release.MaximumUnits ?? compiledEvents.length,
      legacyIntervalSeconds: release.FallbackIntervalSeconds ?? 0.5,
      legacyTemplate: runtimeEvent(legacyTemplateFields, 0, 0),
      legacyEvents,
      compiledEvents,
      resolvedHardpointOffsets,
    };
  }

  const groups = repeatedReleaseGroups(release);
  const primaryGroup = [...groups].sort((left, right) => left.StartTime - right.StartTime || left.Id.localeCompare(right.Id))[0]!;
  const template = clonePayloadFields(primaryGroup.Template);
  template.Count = primaryGroup.UnitsPerRelease;
  const hardpoints = resolveHardpoints(profile, metadata);
  const resolvedHardpointOffsets = hardpointProjection(hardpoints, groups.flatMap((group) => group.HardpointSequence));
  const grouped = hasGroupedRepeatedReleases(release);
  if (!grouped && release.LegacyDynamic === true && primaryGroup.MaximumUnits === 0) {
    return {
      legacyMode: "generated",
      legacyMaximumUnits: 0,
      legacyIntervalSeconds: primaryGroup.IntervalSeconds,
      legacyTemplate: runtimeEvent(template, primaryGroup.StartTime, 0),
      legacyEvents: [],
      resolvedHardpointOffsets,
    };
  }

  const generated: Array<{ fields: PayloadEventFields; time: number; groupIndex: number; unitIndex: number }> = [];
  groups.forEach((automaticGroup, groupIndex) => {
    let released = 0;
    let releaseIndex = 0;
    while (released < automaticGroup.MaximumUnits) {
      const time = automaticGroup.StartTime + releaseIndex * automaticGroup.IntervalSeconds;
      if (time > profile.DurationSeconds + 1e-9) {
        break;
      }
      const unitsThisRelease = Math.min(automaticGroup.UnitsPerRelease, automaticGroup.MaximumUnits - released);
      for (let unit = 0; unit < unitsThisRelease; unit += 1) {
        const fields = clonePayloadFields(automaticGroup.Template);
        fields.Count = 1;
        if (automaticGroup.HardpointSequence.length > 0) {
          const hardpointId = automaticGroup.HardpointSequence[released % automaticGroup.HardpointSequence.length]!;
          const hardpoint = hardpoints.get(hardpointId);
          if (hardpoint) {
            fields.CarrierOffsetX += hardpoint.x;
            fields.CarrierOffsetY += hardpoint.y;
            fields.CarrierOffsetZ += hardpoint.z;
          }
        }
        generated.push({ fields, time, groupIndex, unitIndex: released });
        released += 1;
      }
      releaseIndex += 1;
    }
  });
  generated.sort((left, right) => left.time - right.time || left.groupIndex - right.groupIndex || left.unitIndex - right.unitIndex);
  const compiledEvents = generated.map((event, index) => runtimeEvent(event.fields, event.time, index + 1));

  return {
    legacyMode: "generated",
    legacyMaximumUnits: groups.reduce((sum, group) => sum + group.MaximumUnits, 0),
    legacyIntervalSeconds: primaryGroup.IntervalSeconds,
    legacyTemplate: runtimeEvent(template, primaryGroup.StartTime, 0),
    legacyEvents: [],
    compiledEvents,
    resolvedHardpointOffsets,
  };
}
