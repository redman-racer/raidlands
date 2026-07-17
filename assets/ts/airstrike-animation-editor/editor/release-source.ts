import { compileReleaseSchedule } from "../release-compiler";
import {
  DEFAULT_PAYLOAD_EVENT,
  type EditorSourceProfile,
  type PayloadEventFields,
  type RepeatedReleaseGroup,
  type SourcePayloadEvent,
  type VehicleHardpointMetadata,
  type VehiclePreviewMetadataFile,
} from "../types";
import { PAYLOAD_CATALOG } from "../payload-catalog";
import type { PayloadCatalogEntry } from "../types";
import {
  cloneRepeatedReleaseGroup,
  firstRepeatedReleaseTime,
  repeatedReleaseGroups,
} from "../repeated-release";
import { roundEditorNumber } from "./waypoint-source";

export const PAYLOAD_COMMON_FIELDS = [
  "Payload",
  "Count",
  "CarrierOffsetX",
  "CarrierOffsetY",
  "CarrierOffsetZ",
  "TargetOffsetX",
  "TargetOffsetY",
  "TargetOffsetZ",
] as const satisfies readonly (keyof PayloadEventFields)[];

export const PAYLOAD_ADVANCED_FIELDS = [
  "SpreadRadius",
  "LaunchSpeed",
  "FuseSeconds",
  "DamageScale",
  "VehicleDamageScale",
  "SplashRadius",
  "ImpactRadius",
  "MaxTrackingSeconds",
  "MaxTrackingDistance",
  "DamageScales",
] as const satisfies readonly (keyof PayloadEventFields)[];

export type PayloadField = (typeof PAYLOAD_COMMON_FIELDS)[number] | (typeof PAYLOAD_ADVANCED_FIELDS)[number];

export interface ReleasePreviewEvent {
  id: string;
  time: number;
  index: number;
  mode: "manual" | "repeated";
  editable: boolean;
  fields: PayloadEventFields;
  sourceId?: string;
  hardpointId?: string;
}

function cloneProfile(profile: EditorSourceProfile): EditorSourceProfile {
  return JSON.parse(JSON.stringify(profile)) as EditorSourceProfile;
}

function clonePayloadFields(fields: PayloadEventFields): PayloadEventFields {
  return {
    Payload: fields.Payload,
    Count: fields.Count,
    CarrierOffsetX: fields.CarrierOffsetX,
    CarrierOffsetY: fields.CarrierOffsetY,
    CarrierOffsetZ: fields.CarrierOffsetZ,
    TargetOffsetX: fields.TargetOffsetX,
    TargetOffsetY: fields.TargetOffsetY,
    TargetOffsetZ: fields.TargetOffsetZ,
    SpreadRadius: fields.SpreadRadius,
    LaunchSpeed: fields.LaunchSpeed,
    FuseSeconds: fields.FuseSeconds,
    DamageScale: fields.DamageScale,
    VehicleDamageScale: fields.VehicleDamageScale,
    SplashRadius: fields.SplashRadius,
    ImpactRadius: fields.ImpactRadius,
    MaxTrackingSeconds: fields.MaxTrackingSeconds,
    MaxTrackingDistance: fields.MaxTrackingDistance,
    DamageScales: { ...fields.DamageScales },
  };
}

function cloneEvent(event: SourcePayloadEvent): SourcePayloadEvent {
  return {
    ...clonePayloadFields(event),
    Id: event.Id,
    Time: event.Time,
    ...(event.HardpointId ? { HardpointId: event.HardpointId } : {}),
  };
}

function nextReleaseId(events: SourcePayloadEvent[]): string {
  const existing = new Set(events.map((event) => event.Id));
  for (let index = events.length + 1; index < events.length + 1000; index += 1) {
    const id = `release_${String(index).padStart(3, "0")}`;
    if (!existing.has(id)) {
      return id;
    }
  }
  return `release_${Date.now()}`;
}

function nextRepeatedGroupId(groups: RepeatedReleaseGroup[]): string {
  const existing = new Set(groups.map((group) => group.Id));
  for (let index = 1; index < groups.length + 1000; index += 1) {
    const id = `automatic_${String(index).padStart(3, "0")}`;
    if (!existing.has(id)) {
      return id;
    }
  }
  return `automatic_${Date.now()}`;
}

function materializeRepeatedGroups(profile: EditorSourceProfile): RepeatedReleaseGroup[] {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return [];
  }
  const release = profile.ReleaseSource;
  const groups = repeatedReleaseGroups(release).map(cloneRepeatedReleaseGroup);
  release.Groups = groups;
  delete release.StartTime;
  delete release.IntervalSeconds;
  delete release.UnitsPerRelease;
  delete release.MaximumUnits;
  delete release.Template;
  delete release.HardpointSequence;
  delete release.LegacyDynamic;
  return groups;
}

function repeatedGroupEndTime(group: RepeatedReleaseGroup): number {
  const releases = Math.max(1, Math.ceil(group.MaximumUnits / Math.max(1, group.UnitsPerRelease)));
  return group.StartTime + (releases - 1) * group.IntervalSeconds;
}

function firstReleaseTime(profile: EditorSourceProfile): number {
  const release = profile.ReleaseSource;
  if (release.Mode === "manual" && release.Events.length > 0) {
    return Math.min(...release.Events.map((event) => event.Time));
  }
  if (release.Mode === "repeated") {
    return firstRepeatedReleaseTime(release);
  }
  return Math.min(profile.DurationSeconds, Math.max(0, profile.FirstPayloadDelaySeconds));
}

function syncFirstPayloadDelay(profile: EditorSourceProfile): void {
  profile.FirstPayloadDelaySeconds = roundEditorNumber(firstReleaseTime(profile), 3);
}

function sortManualEvents(events: SourcePayloadEvent[]): void {
  events.sort((left, right) => left.Time - right.Time || left.Id.localeCompare(right.Id));
}

export function availableHardpoints(
  profile: EditorSourceProfile,
  metadata?: VehiclePreviewMetadataFile | null,
): VehicleHardpointMetadata[] {
  const hardpoints = new Map<string, VehicleHardpointMetadata>();
  for (const hardpoint of metadata?.vehicles?.[profile.Vehicle]?.hardpoints ?? []) {
    hardpoints.set(hardpoint.id, { ...hardpoint });
  }
  for (const override of profile.EditorMetadata.VehiclePreviewOverrides.Hardpoints ?? []) {
    hardpoints.set(override.Id, { id: override.Id, x: override.X, y: override.Y, z: override.Z });
  }
  return [...hardpoints.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function materializePayloadHardpoint(
  fields: PayloadEventFields,
  hardpointId: string | undefined,
  profile: EditorSourceProfile,
  metadata?: VehiclePreviewMetadataFile | null,
): PayloadEventFields {
  const hardpoint = hardpointId ? availableHardpoints(profile, metadata).find((entry) => entry.id === hardpointId) : undefined;
  const next = clonePayloadFields(fields);
  if (!hardpoint) {
    return next;
  }
  next.CarrierOffsetX += hardpoint.x;
  next.CarrierOffsetY += hardpoint.y;
  next.CarrierOffsetZ += hardpoint.z;
  return next;
}

export function getReleasePreviewEvents(
  profile: EditorSourceProfile,
  metadata?: VehiclePreviewMetadataFile | null,
): ReleasePreviewEvent[] {
  const release = profile.ReleaseSource;
  if (release.Mode === "manual") {
    return release.Events.map((event, index) => ({
      id: event.Id,
      time: event.Time,
      index: index + 1,
      mode: "manual",
      editable: true,
      sourceId: event.Id,
      hardpointId: event.HardpointId,
      fields: materializePayloadHardpoint(event, event.HardpointId, profile, metadata),
    }));
  }

  const schedule = compileReleaseSchedule(profile, metadata ?? undefined);
  return (schedule.compiledEvents ?? []).map((event) => ({
    id: `generated_${event.Index}`,
    time: event.Time,
    index: event.Index,
    mode: "repeated",
    editable: false,
    fields: event,
  }));
}

export function updateReleaseMode(profile: EditorSourceProfile, mode: "manual" | "repeated"): EditorSourceProfile {
  if (profile.ReleaseSource.Mode === mode) {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (mode === "manual") {
    const repeatedGroup = release.Mode === "repeated" ? repeatedReleaseGroups(release)[0] : undefined;
    const template = repeatedGroup ? clonePayloadFields(repeatedGroup.Template) : clonePayloadFields(DEFAULT_PAYLOAD_EVENT);
    next.ReleaseSource = {
      Mode: "manual",
      Events: [
        {
          ...template,
          Id: "release_001",
          Time: roundEditorNumber(repeatedGroup?.StartTime ?? next.FirstPayloadDelaySeconds, 3),
          Count: Math.max(1, repeatedGroup?.UnitsPerRelease ?? template.Count),
        },
      ],
      LegacyDynamic: false,
      FallbackIntervalSeconds: repeatedGroup?.IntervalSeconds ?? 0.5,
      Template: template,
    };
  } else {
    const events = release.Mode === "manual" ? release.Events : [];
    const template = clonePayloadFields(events[0] ?? release.Template ?? DEFAULT_PAYLOAD_EVENT);
    const totalUnits = events.reduce((sum, event) => sum + Math.max(1, event.Count), 0);
    const group: RepeatedReleaseGroup = {
      Id: "automatic_001",
      Name: "Automatic group 1",
      StartTime: roundEditorNumber(events[0]?.Time ?? next.FirstPayloadDelaySeconds, 3),
      IntervalSeconds: release.Mode === "manual" ? release.FallbackIntervalSeconds ?? 0.5 : 0.5,
      UnitsPerRelease: Math.max(1, template.Count),
      MaximumUnits: Math.max(1, totalUnits || template.Count || 1),
      Template: template,
      HardpointSequence: [],
    };
    next.ReleaseSource = {
      Mode: "repeated",
      Groups: [group],
    };
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function addManualRelease(profile: EditorSourceProfile, time: number): { profile: EditorSourceProfile; releaseId: string } {
  const next = profile.ReleaseSource.Mode === "manual" ? cloneProfile(profile) : updateReleaseMode(profile, "manual");
  const release = next.ReleaseSource;
  if (release.Mode !== "manual") {
    return { profile: next, releaseId: "" };
  }
  const template = clonePayloadFields(release.Template ?? release.Events[0] ?? DEFAULT_PAYLOAD_EVENT);
  const event: SourcePayloadEvent = {
    ...template,
    Id: nextReleaseId(release.Events),
    Time: roundEditorNumber(Math.min(next.DurationSeconds, Math.max(0, time)), 3),
  };
  release.Events.push(event);
  release.LegacyDynamic = false;
  sortManualEvents(release.Events);
  syncFirstPayloadDelay(next);
  return { profile: next, releaseId: event.Id };
}

export function duplicateManualRelease(profile: EditorSourceProfile, releaseId: string): { profile: EditorSourceProfile; releaseId: string } {
  if (profile.ReleaseSource.Mode !== "manual") {
    return { profile: cloneProfile(profile), releaseId: "" };
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (release.Mode !== "manual") {
    return { profile: next, releaseId: "" };
  }
  const source = release.Events.find((event) => event.Id === releaseId) ?? release.Events[0];
  if (!source) {
    return addManualRelease(next, next.FirstPayloadDelaySeconds);
  }
  const copy = cloneEvent(source);
  copy.Id = nextReleaseId(release.Events);
  copy.Time = roundEditorNumber(Math.min(next.DurationSeconds, copy.Time + 0.1), 3);
  release.Events.push(copy);
  sortManualEvents(release.Events);
  syncFirstPayloadDelay(next);
  return { profile: next, releaseId: copy.Id };
}

export function deleteManualRelease(profile: EditorSourceProfile, releaseId: string): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "manual") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (release.Mode === "manual") {
    release.Events = release.Events.filter((event) => event.Id !== releaseId);
    release.LegacyDynamic = release.Events.length === 0;
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function updateManualReleaseTime(profile: EditorSourceProfile, releaseId: string, time: number): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "manual") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (release.Mode === "manual") {
    const event = release.Events.find((entry) => entry.Id === releaseId);
    if (event) {
      event.Time = roundEditorNumber(Math.min(next.DurationSeconds, Math.max(0, time)), 3);
      sortManualEvents(release.Events);
    }
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function updateManualReleaseHardpoint(profile: EditorSourceProfile, releaseId: string, hardpointId: string): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "manual") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (release.Mode === "manual") {
    const event = release.Events.find((entry) => entry.Id === releaseId);
    if (event) {
      if (hardpointId) {
        event.HardpointId = hardpointId;
      } else {
        delete event.HardpointId;
      }
    }
  }
  return next;
}

export function updateManualPayloadField(
  profile: EditorSourceProfile,
  releaseId: string,
  field: keyof PayloadEventFields,
  value: string | number | Record<string, number>,
): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "manual") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const release = next.ReleaseSource;
  if (release.Mode === "manual") {
    const event = release.Events.find((entry) => entry.Id === releaseId);
    if (event) {
      assignPayloadField(event, field, value);
    }
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function updateRepeatedField(
  profile: EditorSourceProfile,
  field: "StartTime" | "IntervalSeconds" | "UnitsPerRelease" | "MaximumUnits",
  value: number,
): EditorSourceProfile {
  const groupId = profile.ReleaseSource.Mode === "repeated" ? repeatedReleaseGroups(profile.ReleaseSource)[0]?.Id ?? "" : "";
  return updateRepeatedGroupField(profile, groupId, field, value);
}

export function updateRepeatedHardpointSequence(profile: EditorSourceProfile, sequence: string[]): EditorSourceProfile {
  const groupId = profile.ReleaseSource.Mode === "repeated" ? repeatedReleaseGroups(profile.ReleaseSource)[0]?.Id ?? "" : "";
  return updateRepeatedGroupHardpointSequence(profile, groupId, sequence);
}

export function updateRepeatedTemplateField(
  profile: EditorSourceProfile,
  field: keyof PayloadEventFields,
  value: string | number | Record<string, number>,
): EditorSourceProfile {
  const groupId = profile.ReleaseSource.Mode === "repeated" ? repeatedReleaseGroups(profile.ReleaseSource)[0]?.Id ?? "" : "";
  return updateRepeatedGroupTemplateField(profile, groupId, field, value);
}

export function getRepeatedReleaseGroups(profile: EditorSourceProfile): RepeatedReleaseGroup[] {
  return profile.ReleaseSource.Mode === "repeated" ? repeatedReleaseGroups(profile.ReleaseSource) : [];
}

export function addRepeatedReleaseGroup(
  profile: EditorSourceProfile,
  sourceGroupId = "",
): { profile: EditorSourceProfile; groupId: string } {
  if (profile.ReleaseSource.Mode !== "repeated") {
    const converted = updateReleaseMode(profile, "repeated");
    const first = converted.ReleaseSource.Mode === "repeated" ? repeatedReleaseGroups(converted.ReleaseSource)[0] : undefined;
    return { profile: converted, groupId: first?.Id ?? "" };
  }
  const next = cloneProfile(profile);
  const groups = materializeRepeatedGroups(next);
  const source = groups.find((group) => group.Id === sourceGroupId) ?? groups[groups.length - 1];
  if (!source) {
    return { profile: next, groupId: "" };
  }
  const group = cloneRepeatedReleaseGroup(source);
  group.Id = nextRepeatedGroupId(groups);
  group.Name = `Automatic group ${groups.length + 1}`;
  group.StartTime = roundEditorNumber(
    Math.min(next.DurationSeconds, repeatedGroupEndTime(source) + Math.max(0.25, source.IntervalSeconds)),
    3,
  );
  groups.push(group);
  syncFirstPayloadDelay(next);
  return { profile: next, groupId: group.Id };
}

export function duplicateRepeatedReleaseGroup(
  profile: EditorSourceProfile,
  groupId: string,
): { profile: EditorSourceProfile; groupId: string } {
  return addRepeatedReleaseGroup(profile, groupId);
}

export function deleteRepeatedReleaseGroup(profile: EditorSourceProfile, groupId: string): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const groups = materializeRepeatedGroups(next);
  if (groups.length > 1 && next.ReleaseSource.Mode === "repeated") {
    next.ReleaseSource.Groups = groups.filter((group) => group.Id !== groupId);
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function updateRepeatedGroupName(profile: EditorSourceProfile, groupId: string, name: string): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const group = materializeRepeatedGroups(next).find((entry) => entry.Id === groupId);
  if (group) {
    group.Name = name.trim() || group.Id;
  }
  return next;
}

export function updateRepeatedGroupField(
  profile: EditorSourceProfile,
  groupId: string,
  field: "StartTime" | "IntervalSeconds" | "UnitsPerRelease" | "MaximumUnits",
  value: number,
): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const group = materializeRepeatedGroups(next).find((entry) => entry.Id === groupId);
  if (group) {
    const rounded = field === "UnitsPerRelease" || field === "MaximumUnits" ? Math.max(0, Math.round(value)) : roundEditorNumber(value, 3);
    group[field] = field === "UnitsPerRelease" ? Math.max(1, rounded) : rounded;
    if (field === "UnitsPerRelease") {
      group.Template.Count = group.UnitsPerRelease;
    }
  }
  syncFirstPayloadDelay(next);
  return next;
}

export function updateRepeatedGroupHardpointSequence(
  profile: EditorSourceProfile,
  groupId: string,
  sequence: string[],
): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const group = materializeRepeatedGroups(next).find((entry) => entry.Id === groupId);
  if (group) {
    group.HardpointSequence = sequence.map((entry) => entry.trim()).filter(Boolean);
  }
  return next;
}

export function updateRepeatedGroupTemplateField(
  profile: EditorSourceProfile,
  groupId: string,
  field: keyof PayloadEventFields,
  value: string | number | Record<string, number>,
): EditorSourceProfile {
  if (profile.ReleaseSource.Mode !== "repeated") {
    return cloneProfile(profile);
  }
  const next = cloneProfile(profile);
  const group = materializeRepeatedGroups(next).find((entry) => entry.Id === groupId);
  if (group) {
    assignPayloadField(group.Template, field, value);
    if (field === "Count") {
      group.UnitsPerRelease = Math.max(1, Math.round(group.Template.Count));
    }
  }
  return next;
}

export function payloadOptions(): readonly PayloadCatalogEntry[] {
  return PAYLOAD_CATALOG;
}

function assignPayloadField(
  target: PayloadEventFields,
  field: keyof PayloadEventFields,
  value: string | number | Record<string, number>,
): void {
  if (field === "Payload") {
    target.Payload = String(value);
    return;
  }
  if (field === "DamageScales") {
    target.DamageScales = typeof value === "object" && value !== null && !Array.isArray(value) ? { ...value } : {};
    return;
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numberValue)) {
    target[field] = field === "Count" ? Math.max(1, Math.round(numberValue)) : roundEditorNumber(numberValue, 3);
  }
}
