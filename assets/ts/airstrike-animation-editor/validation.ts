import {
  EDITOR_SOURCE_SCHEMA_VERSION,
  SourceValidationError,
  SUPPORTED_AMMO_TYPES,
  SUPPORTED_AUDIO_CUES,
  SUPPORTED_PAYLOADS,
  SUPPORTED_VEHICLES,
  type EditorSourceBundle,
  type EditorSourceProfile,
  type PayloadEventFields,
  type ValidationIssue,
  type VehiclePreviewMetadataFile,
} from "./types";

export const PROFILE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const DICTIONARY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_DURATION_SECONDS = 120;
const MAX_WAYPOINTS = 256;
const MAX_MANUAL_EVENTS = 80;
const MAX_COMPILED_RELEASE_UNITS = 2000;
const MAX_REPEATED_GROUPS = 40;
const MAX_AUDIO_EVENTS = 160;
const MAX_AUDIO_GROUPS = 40;
const MAX_AUDIO_CUES_PER_GROUP = 160;

function addIssue(issues: ValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFinite(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  minimum?: number,
  maximum?: number,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, path, "finite_number", "Must be a finite number.");
    return false;
  }
  if (minimum !== undefined && value < minimum) {
    addIssue(issues, path, "minimum", `Must be at least ${minimum}.`);
  }
  if (maximum !== undefined && value > maximum) {
    addIssue(issues, path, "maximum", `Must be at most ${maximum}.`);
  }
  return true;
}

function validateInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  minimum: number,
  maximum: number,
): value is number {
  if (!validateFinite(value, path, issues, minimum, maximum)) {
    return false;
  }
  if (!Number.isInteger(value)) {
    addIssue(issues, path, "integer", "Must be an integer.");
  }
  return true;
}

function validatePayloadFields(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  allowEmptyPayload: boolean,
): void {
  if (!isRecord(value)) {
    addIssue(issues, path, "object", "Must be an object.");
    return;
  }
  const payload = value.Payload;
  if (typeof payload !== "string" || (!allowEmptyPayload && !SUPPORTED_PAYLOADS.includes(payload as never))) {
    addIssue(issues, `${path}.Payload`, "supported_payload", "Must be a supported payload identifier.");
  } else if (payload !== "" && !SUPPORTED_PAYLOADS.includes(payload as never)) {
    addIssue(issues, `${path}.Payload`, "supported_payload", "Must be empty or a supported payload identifier.");
  }
  if (value.AmmoSequence !== undefined) {
    if (!Array.isArray(value.AmmoSequence) || value.AmmoSequence.length > 32) {
      addIssue(issues, `${path}.AmmoSequence`, "ammo_sequence", "Must be an array of at most 32 ammo identifiers.");
    } else {
      value.AmmoSequence.forEach((ammo, index) => {
        if (typeof ammo !== "string" || !SUPPORTED_AMMO_TYPES.includes(ammo as never)) {
          addIssue(issues, `${path}.AmmoSequence[${index}]`, "supported_ammo", "Must be a supported ammo identifier.");
        }
      });
    }
  }
  validateInteger(value.Count, `${path}.Count`, issues, 1, MAX_COMPILED_RELEASE_UNITS);
  validateFinite(value.CarrierOffsetX, `${path}.CarrierOffsetX`, issues, -250, 250);
  validateFinite(value.CarrierOffsetY, `${path}.CarrierOffsetY`, issues, -250, 250);
  validateFinite(value.CarrierOffsetZ, `${path}.CarrierOffsetZ`, issues, -250, 250);
  validateFinite(value.TargetOffsetX, `${path}.TargetOffsetX`, issues, -500, 500);
  validateFinite(value.TargetOffsetY, `${path}.TargetOffsetY`, issues, -500, 500);
  validateFinite(value.TargetOffsetZ, `${path}.TargetOffsetZ`, issues, -500, 500);
  validateFinite(value.SpreadRadius, `${path}.SpreadRadius`, issues, -1, 250);
  if (value.TargetingMode !== undefined && value.TargetingMode !== "simple" && value.TargetingMode !== "advanced") {
    addIssue(issues, `${path}.TargetingMode`, "targeting_mode", "Must be simple or advanced.");
  }
  if (value.AccuracyPercent !== undefined) {
    validateFinite(value.AccuracyPercent, `${path}.AccuracyPercent`, issues);
  }
  validateFinite(value.LaunchSpeed, `${path}.LaunchSpeed`, issues, -1, 350);
  validateFinite(value.FuseSeconds, `${path}.FuseSeconds`, issues, -1, 120);
  validateFinite(value.DamageScale, `${path}.DamageScale`, issues, 0, 10);
  validateFinite(value.VehicleDamageScale, `${path}.VehicleDamageScale`, issues, -1, 10);
  validateFinite(value.SplashRadius, `${path}.SplashRadius`, issues, -1, 100);
  validateFinite(value.ImpactRadius, `${path}.ImpactRadius`, issues, -1, 100);
  validateFinite(value.MaxTrackingSeconds, `${path}.MaxTrackingSeconds`, issues, -1, 120);
  validateFinite(value.MaxTrackingDistance, `${path}.MaxTrackingDistance`, issues, -1, 2500);
  if (!isRecord(value.DamageScales)) {
    addIssue(issues, `${path}.DamageScales`, "object", "Must be an object.");
  } else {
    for (const [key, scale] of Object.entries(value.DamageScales)) {
      if (!DICTIONARY_KEY_PATTERN.test(key)) {
        addIssue(issues, `${path}.DamageScales.${key}`, "safe_key", "Damage-scale key is not safe.");
      }
      validateFinite(scale, `${path}.DamageScales.${key}`, issues, 0, 10);
    }
  }
}

function validateProfile(
  profile: unknown,
  mapKey: string,
  path: string,
  issues: ValidationIssue[],
  metadata?: VehiclePreviewMetadataFile,
): void {
  if (!isRecord(profile)) {
    addIssue(issues, path, "object", "Must be an object.");
    return;
  }
  if (profile.EditorSourceSchemaVersion !== 1 && profile.EditorSourceSchemaVersion !== EDITOR_SOURCE_SCHEMA_VERSION) {
    addIssue(issues, `${path}.EditorSourceSchemaVersion`, "schema_version", "Must be editor source schema version 1 or 2.");
  }
  if (typeof profile.ProfileKey !== "string" || !PROFILE_KEY_PATTERN.test(profile.ProfileKey)) {
    addIssue(issues, `${path}.ProfileKey`, "safe_profile_key", "Must match ^[a-z0-9][a-z0-9._-]{0,99}$.");
  } else if (profile.ProfileKey !== mapKey) {
    addIssue(issues, `${path}.ProfileKey`, "profile_key_mismatch", `Must equal containing profile key '${mapKey}'.`);
  }
  if (typeof profile.DisplayName !== "string" || profile.DisplayName.trim() === "" || profile.DisplayName.length > 160) {
    addIssue(issues, `${path}.DisplayName`, "display_name", "Must be a non-empty string of at most 160 characters.");
  }
  if (typeof profile.Vehicle !== "string" || !SUPPORTED_VEHICLES.includes(profile.Vehicle as never)) {
    addIssue(issues, `${path}.Vehicle`, "supported_vehicle", "Must be a supported vehicle identifier.");
  }
  validateFinite(profile.DurationSeconds, `${path}.DurationSeconds`, issues, 0.5, MAX_DURATION_SECONDS);
  validateFinite(profile.FirstPayloadDelaySeconds, `${path}.FirstPayloadDelaySeconds`, issues, 0, MAX_DURATION_SECONDS);
  validateFinite(profile.RotationSmoothTimeSeconds, `${path}.RotationSmoothTimeSeconds`, issues, 0.02, 2);
  validateFinite(profile.MinimumTerrainClearance, `${path}.MinimumTerrainClearance`, issues, 0, 250);
  if (typeof profile.StopAtWaypoints !== "boolean") {
    addIssue(issues, `${path}.StopAtWaypoints`, "boolean", "Must be boolean.");
  }
  if (profile.PositionInterpolation !== "time_hermite") {
    addIssue(issues, `${path}.PositionInterpolation`, "interpolation", "Only time_hermite is currently supported.");
  }
  if (profile.RotationMode !== "follow_path_plus_offset" && profile.RotationMode !== "authored_orientation") {
    addIssue(
      issues,
      `${path}.RotationMode`,
      "rotation_mode",
      "Must be follow_path_plus_offset or authored_orientation.",
    );
  }

  if (!Array.isArray(profile.Waypoints)) {
    addIssue(issues, `${path}.Waypoints`, "array", "Must be an array.");
  } else {
    if (profile.Waypoints.length < 2 || profile.Waypoints.length > MAX_WAYPOINTS) {
      addIssue(issues, `${path}.Waypoints`, "waypoint_count", `Must contain between 2 and ${MAX_WAYPOINTS} waypoints.`);
    }
    const ids = new Set<string>();
    let previousTime = -Infinity;
    for (const [index, waypoint] of profile.Waypoints.entries()) {
      const waypointPath = `${path}.Waypoints[${index}]`;
      if (!isRecord(waypoint)) {
        addIssue(issues, waypointPath, "object", "Must be an object.");
        continue;
      }
      if (typeof waypoint.Id !== "string" || !STABLE_ID_PATTERN.test(waypoint.Id)) {
        addIssue(issues, `${waypointPath}.Id`, "stable_id", "Must be a safe stable waypoint ID.");
      } else if (ids.has(waypoint.Id)) {
        addIssue(issues, `${waypointPath}.Id`, "duplicate_id", "Waypoint ID must be unique.");
      } else {
        ids.add(waypoint.Id);
      }
      if (validateFinite(waypoint.Time, `${waypointPath}.Time`, issues, 0, Number(profile.DurationSeconds))) {
        if (index === 0 && Math.abs(waypoint.Time) > 1e-6) {
          addIssue(issues, `${waypointPath}.Time`, "first_waypoint_zero", "First waypoint time must be zero.");
        }
        if (waypoint.Time <= previousTime + 1e-6) {
          addIssue(issues, `${waypointPath}.Time`, "unique_sorted_time", "Waypoint times must be strictly increasing.");
        }
        previousTime = waypoint.Time;
      }
      validateFinite(waypoint.X, `${waypointPath}.X`, issues, -2000, 2000);
      validateFinite(waypoint.Y, `${waypointPath}.Y`, issues, -100, 1000);
      validateFinite(waypoint.Z, `${waypointPath}.Z`, issues, -3000, 3000);
      validateFinite(waypoint.RotationX, `${waypointPath}.RotationX`, issues, -100_000, 100_000);
      validateFinite(waypoint.RotationY, `${waypointPath}.RotationY`, issues, -100_000, 100_000);
      validateFinite(waypoint.RotationZ, `${waypointPath}.RotationZ`, issues, -100_000, 100_000);
      if (waypoint.TargetSpeedMetersPerSecond !== undefined) {
        validateFinite(waypoint.TargetSpeedMetersPerSecond, `${waypointPath}.TargetSpeedMetersPerSecond`, issues, 0.1, 500);
      }
    }
  }

  if (!isRecord(profile.ReleaseSource)) {
    addIssue(issues, `${path}.ReleaseSource`, "object", "Must be an object.");
    return;
  }
  const release = profile.ReleaseSource;
  if (release.Mode === "manual" || release.Mode === "mixed") {
    if (!Array.isArray(release.Events)) {
      addIssue(issues, `${path}.ReleaseSource.Events`, "array", "Must be an array.");
    } else {
      if (release.Events.length > MAX_MANUAL_EVENTS) {
        addIssue(issues, `${path}.ReleaseSource.Events`, "event_count", `Must not exceed ${MAX_MANUAL_EVENTS} source events.`);
      }
      if (release.Mode === "manual" && release.Events.length === 0 && release.LegacyDynamic !== true) {
        addIssue(issues, `${path}.ReleaseSource.Events`, "empty_manual_schedule", "An empty manual schedule must be marked LegacyDynamic.");
      }
      let totalUnits = 0;
      let previousTime = -Infinity;
      const ids = new Set<string>();
      const availableHardpoints = getAvailableHardpoints(profile as unknown as EditorSourceProfile, metadata);
      for (const [index, event] of release.Events.entries()) {
        const eventPath = `${path}.ReleaseSource.Events[${index}]`;
        validatePayloadFields(event, eventPath, issues, false);
        if (!isRecord(event)) {
          continue;
        }
        if (typeof event.Id !== "string" || !STABLE_ID_PATTERN.test(event.Id)) {
          addIssue(issues, `${eventPath}.Id`, "stable_id", "Must be a safe stable release-event ID.");
        } else if (ids.has(event.Id)) {
          addIssue(issues, `${eventPath}.Id`, "duplicate_id", "Release-event ID must be unique.");
        } else {
          ids.add(event.Id);
        }
        if (validateFinite(event.Time, `${eventPath}.Time`, issues, 0, Number(profile.DurationSeconds))) {
          if (event.Time < previousTime) {
            addIssue(issues, `${eventPath}.Time`, "sorted_time", "Manual release events must be sorted by time.");
          }
          previousTime = event.Time;
        }
        if (event.HardpointId !== undefined) {
          if (typeof event.HardpointId !== "string" || !STABLE_ID_PATTERN.test(event.HardpointId)) {
            addIssue(issues, `${eventPath}.HardpointId`, "stable_id", "Must be a safe hardpoint ID.");
          } else if (!availableHardpoints.has(event.HardpointId)) {
            addIssue(issues, `${eventPath}.HardpointId`, "unknown_hardpoint", `Unknown hardpoint '${event.HardpointId}'.`);
          }
        }
        if (typeof event.Count === "number" && Number.isFinite(event.Count)) {
          totalUnits += event.Count;
        }
      }
      if (totalUnits > MAX_COMPILED_RELEASE_UNITS) {
        addIssue(issues, `${path}.ReleaseSource.Events`, "compiled_unit_count", `Materialized releases must not exceed ${MAX_COMPILED_RELEASE_UNITS} units.`);
      }
      if (release.Mode === "manual" && release.Events.length > 0 && typeof profile.FirstPayloadDelaySeconds === "number") {
        const earliest = Math.min(...release.Events.map((event) => Number(isRecord(event) ? event.Time : Infinity)));
        if (Number.isFinite(earliest) && Math.abs(profile.FirstPayloadDelaySeconds - earliest) > 1e-6) {
          addIssue(issues, `${path}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal the earliest manual release event time.");
        }
      }
    }
    if (release.MaximumUnits !== undefined) {
      validateInteger(release.MaximumUnits, `${path}.ReleaseSource.MaximumUnits`, issues, 0, MAX_COMPILED_RELEASE_UNITS);
    }
    if (release.FallbackIntervalSeconds !== undefined) {
      validateFinite(release.FallbackIntervalSeconds, `${path}.ReleaseSource.FallbackIntervalSeconds`, issues, 0.01, 30);
    }
    if (release.Template !== undefined) {
      validatePayloadFields(release.Template, `${path}.ReleaseSource.Template`, issues, true);
    }
  }
  if (release.Mode === "repeated" || release.Mode === "mixed") {
    if (release.Groups !== undefined) {
      if (!Array.isArray(release.Groups) || release.Groups.length === 0) {
        addIssue(issues, `${path}.ReleaseSource.Groups`, "array", "Must contain at least one automatic release group.");
      } else {
        if (release.Groups.length > MAX_REPEATED_GROUPS) {
          addIssue(issues, `${path}.ReleaseSource.Groups`, "group_count", `Must not exceed ${MAX_REPEATED_GROUPS} automatic groups.`);
        }
        const ids = new Set<string>();
        const available = getAvailableHardpoints(profile as unknown as EditorSourceProfile, metadata);
        let earliest = Infinity;
        let totalUnits = 0;
        release.Groups.forEach((group, groupIndex) => {
          const groupPath = `${path}.ReleaseSource.Groups[${groupIndex}]`;
          if (!isRecord(group)) {
            addIssue(issues, groupPath, "object", "Automatic release group must be an object.");
            return;
          }
          if (typeof group.Id !== "string" || !STABLE_ID_PATTERN.test(group.Id)) {
            addIssue(issues, `${groupPath}.Id`, "stable_id", "Must be a safe stable automatic-group ID.");
          } else if (ids.has(group.Id)) {
            addIssue(issues, `${groupPath}.Id`, "duplicate_id", "Automatic-group ID must be unique.");
          } else {
            ids.add(group.Id);
          }
          if (typeof group.Name !== "string" || group.Name.trim() === "" || group.Name.length > 100) {
            addIssue(issues, `${groupPath}.Name`, "name", "Must be a name between 1 and 100 characters.");
          }
          if (validateFinite(group.StartTime, `${groupPath}.StartTime`, issues, 0, Number(profile.DurationSeconds))) {
            earliest = Math.min(earliest, group.StartTime);
          }
          validateFinite(group.IntervalSeconds, `${groupPath}.IntervalSeconds`, issues, 0.001, 30);
          const unitsValid = validateInteger(group.UnitsPerRelease, `${groupPath}.UnitsPerRelease`, issues, 1, 200);
          const unitsPerRelease = Number(group.UnitsPerRelease);
          const unitInterval = group.UnitIntervalSeconds ?? 0;
          const unitIntervalValid = validateFinite(unitInterval, `${groupPath}.UnitIntervalSeconds`, issues, 0, 30);
          if (unitsValid && unitIntervalValid && typeof group.IntervalSeconds === "number"
            && Number(group.UnitsPerRelease) * unitInterval > group.IntervalSeconds + 1e-9) {
            addIssue(issues, `${groupPath}.UnitIntervalSeconds`, "burst_overlap", "All units in a burst must fit before the next burst starts.");
          }
          const maximumValid = validateInteger(group.MaximumUnits, `${groupPath}.MaximumUnits`, issues, 1, MAX_COMPILED_RELEASE_UNITS);
          const maximumUnits = Number(group.MaximumUnits);
          if (maximumValid) {
            totalUnits += maximumUnits;
          }
          if (unitsValid && maximumValid && unitIntervalValid && typeof group.StartTime === "number"
            && typeof group.IntervalSeconds === "number" && typeof profile.DurationSeconds === "number") {
            const finalUnit = maximumUnits - 1;
            const finalTime = group.StartTime
              + Math.floor(finalUnit / unitsPerRelease) * group.IntervalSeconds
              + (finalUnit % unitsPerRelease) * unitInterval;
            if (finalTime > profile.DurationSeconds + 1e-9) {
              addIssue(issues, `${groupPath}.MaximumUnits`, "release_after_duration", "All generated units must occur within the profile duration.");
            }
          }
          validatePayloadFields(group.Template, `${groupPath}.Template`, issues, false);
          if (!Array.isArray(group.HardpointSequence)) {
            addIssue(issues, `${groupPath}.HardpointSequence`, "array", "Must be an array.");
          } else {
            group.HardpointSequence.forEach((id, index) => {
              if (typeof id !== "string" || !STABLE_ID_PATTERN.test(id)) {
                addIssue(issues, `${groupPath}.HardpointSequence[${index}]`, "stable_id", "Must be a safe hardpoint ID.");
              } else if (!available.has(id)) {
                addIssue(issues, `${groupPath}.HardpointSequence[${index}]`, "unknown_hardpoint", `Unknown hardpoint '${id}'.`);
              }
            });
          }
        });
        if (totalUnits > MAX_COMPILED_RELEASE_UNITS) {
          addIssue(issues, `${path}.ReleaseSource.Groups`, "compiled_unit_count", `Automatic groups must not exceed ${MAX_COMPILED_RELEASE_UNITS} total units.`);
        }
        if (release.Mode === "repeated" && typeof profile.FirstPayloadDelaySeconds === "number" && Number.isFinite(earliest) && Math.abs(profile.FirstPayloadDelaySeconds - earliest) > 1e-6) {
          addIssue(issues, `${path}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal the earliest automatic group start time.");
        }
      }
    } else {
      validateFinite(release.StartTime, `${path}.ReleaseSource.StartTime`, issues, 0, Number(profile.DurationSeconds));
      validateFinite(release.IntervalSeconds, `${path}.ReleaseSource.IntervalSeconds`, issues, 0.01, 30);
      validateInteger(release.UnitsPerRelease, `${path}.ReleaseSource.UnitsPerRelease`, issues, 1, MAX_COMPILED_RELEASE_UNITS);
      validateInteger(
        release.MaximumUnits,
        `${path}.ReleaseSource.MaximumUnits`,
        issues,
        release.LegacyDynamic === true ? 0 : 1,
        MAX_COMPILED_RELEASE_UNITS,
      );
      const legacyUnitsPerRelease = Number(release.UnitsPerRelease);
      const legacyMaximumUnits = Number(release.MaximumUnits);
      if (typeof release.StartTime === "number" && typeof release.IntervalSeconds === "number"
        && Number.isInteger(legacyUnitsPerRelease) && legacyUnitsPerRelease > 0
        && Number.isInteger(legacyMaximumUnits) && legacyMaximumUnits > 0
        && typeof profile.DurationSeconds === "number") {
        const finalTime = release.StartTime + Math.floor((legacyMaximumUnits - 1) / legacyUnitsPerRelease) * release.IntervalSeconds;
        if (finalTime > profile.DurationSeconds + 1e-9) {
          addIssue(issues, `${path}.ReleaseSource.MaximumUnits`, "release_after_duration", "All generated units must occur within the profile duration.");
        }
      }
      validatePayloadFields(release.Template, `${path}.ReleaseSource.Template`, issues, false);
      if (!Array.isArray(release.HardpointSequence)) {
        addIssue(issues, `${path}.ReleaseSource.HardpointSequence`, "array", "Must be an array.");
      } else {
        const available = getAvailableHardpoints(profile as unknown as EditorSourceProfile, metadata);
        release.HardpointSequence.forEach((id, index) => {
          if (typeof id !== "string" || !STABLE_ID_PATTERN.test(id)) {
            addIssue(issues, `${path}.ReleaseSource.HardpointSequence[${index}]`, "stable_id", "Must be a safe hardpoint ID.");
          } else if (!available.has(id)) {
            addIssue(issues, `${path}.ReleaseSource.HardpointSequence[${index}]`, "unknown_hardpoint", `Unknown hardpoint '${id}'.`);
          }
        });
      }
      if (typeof profile.FirstPayloadDelaySeconds === "number" && typeof release.StartTime === "number" && Math.abs(profile.FirstPayloadDelaySeconds - release.StartTime) > 1e-6) {
        addIssue(issues, `${path}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal repeated StartTime.");
      }
    }
  }
  if (release.Mode !== "manual" && release.Mode !== "repeated" && release.Mode !== "mixed") {
    addIssue(issues, `${path}.ReleaseSource.Mode`, "release_mode", "Must be manual, repeated, or mixed.");
  }
  if (release.Mode === "mixed") {
    const manualUnits = Array.isArray(release.Events)
      ? release.Events.reduce((sum, event) => sum + (isRecord(event) && typeof event.Count === "number" ? event.Count : 0), 0)
      : 0;
    const generatedUnits = Array.isArray(release.Groups)
      ? release.Groups.reduce((sum, group) => sum + (isRecord(group) && typeof group.MaximumUnits === "number" ? group.MaximumUnits : 0), 0)
      : 0;
    if (manualUnits + generatedUnits > MAX_COMPILED_RELEASE_UNITS) {
      addIssue(issues, `${path}.ReleaseSource`, "compiled_unit_count", `Mixed releases must not exceed ${MAX_COMPILED_RELEASE_UNITS} total units.`);
    }
    const times = [
      ...(Array.isArray(release.Events) ? release.Events.map((event) => isRecord(event) ? Number(event.Time) : Infinity) : []),
      ...(Array.isArray(release.Groups) ? release.Groups.map((group) => isRecord(group) ? Number(group.StartTime) : Infinity) : []),
    ].filter(Number.isFinite);
    if (times.length > 0 && typeof profile.FirstPayloadDelaySeconds === "number"
      && Math.abs(profile.FirstPayloadDelaySeconds - Math.min(...times)) > 1e-6) {
      addIssue(issues, `${path}.FirstPayloadDelaySeconds`, "first_release_sync", "Must equal the earliest mixed release time.");
    }
  }

  if (profile.AudioSource !== undefined) {
    const audioPath = `${path}.AudioSource`;
    if (!isRecord(profile.AudioSource)) {
      addIssue(issues, audioPath, "object", "Must be an object.");
    } else {
      const audio = profile.AudioSource;
      if (audio.Mode !== "automatic" && audio.Mode !== "authored") {
        addIssue(issues, `${audioPath}.Mode`, "audio_mode", "Must be automatic or authored.");
      }
      const validateCue = (value: Record<string, unknown>, cuePath: string): void => {
        if (typeof value.Cue !== "string" || !SUPPORTED_AUDIO_CUES.includes(value.Cue as never)) {
          addIssue(issues, `${cuePath}.Cue`, "supported_audio_cue", "Must be a supported audio cue.");
        }
        if (value.Anchor !== "carrier" && value.Anchor !== "target") {
          addIssue(issues, `${cuePath}.Anchor`, "audio_anchor", "Must be carrier or target.");
        }
        validateFinite(value.OffsetX, `${cuePath}.OffsetX`, issues, -500, 500);
        validateFinite(value.OffsetY, `${cuePath}.OffsetY`, issues, -500, 500);
        validateFinite(value.OffsetZ, `${cuePath}.OffsetZ`, issues, -500, 500);
      };
      if (!Array.isArray(audio.Events) || audio.Events.length > MAX_AUDIO_EVENTS) {
        addIssue(issues, `${audioPath}.Events`, "audio_events", `Must be an array of at most ${MAX_AUDIO_EVENTS} events.`);
      } else {
        const ids = new Set<string>();
        audio.Events.forEach((event, index) => {
          const eventPath = `${audioPath}.Events[${index}]`;
          if (!isRecord(event)) return addIssue(issues, eventPath, "object", "Must be an object.");
          if (typeof event.Id !== "string" || !STABLE_ID_PATTERN.test(event.Id) || ids.has(event.Id)) {
            addIssue(issues, `${eventPath}.Id`, "stable_id", "Must be a unique safe audio-event ID.");
          } else ids.add(event.Id);
          validateFinite(event.Time, `${eventPath}.Time`, issues, 0, Number(profile.DurationSeconds));
          validateCue(event, eventPath);
        });
      }
      if (!Array.isArray(audio.Groups) || audio.Groups.length > MAX_AUDIO_GROUPS) {
        addIssue(issues, `${audioPath}.Groups`, "audio_groups", `Must be an array of at most ${MAX_AUDIO_GROUPS} groups.`);
      } else {
        const ids = new Set<string>();
        audio.Groups.forEach((group, index) => {
          const groupPath = `${audioPath}.Groups[${index}]`;
          if (!isRecord(group)) return addIssue(issues, groupPath, "object", "Must be an object.");
          if (typeof group.Id !== "string" || !STABLE_ID_PATTERN.test(group.Id) || ids.has(group.Id)) {
            addIssue(issues, `${groupPath}.Id`, "stable_id", "Must be a unique safe audio-group ID.");
          } else ids.add(group.Id);
          if (typeof group.Name !== "string" || group.Name.trim() === "" || group.Name.length > 100) {
            addIssue(issues, `${groupPath}.Name`, "name", "Must be a name between 1 and 100 characters.");
          }
          validateFinite(group.StartTime, `${groupPath}.StartTime`, issues, 0, Number(profile.DurationSeconds));
          validateFinite(group.EndTime, `${groupPath}.EndTime`, issues, 0, Number(profile.DurationSeconds));
          if (typeof group.StartTime === "number" && typeof group.EndTime === "number" && group.EndTime < group.StartTime) {
            addIssue(issues, `${groupPath}.EndTime`, "audio_time_range", "Must not precede StartTime.");
          }
          validateFinite(group.IntervalSeconds, `${groupPath}.IntervalSeconds`, issues, 0.05, 30);
          validateInteger(group.MaximumCues, `${groupPath}.MaximumCues`, issues, 1, MAX_AUDIO_CUES_PER_GROUP);
          validateCue(group, groupPath);
        });
      }
    }
  }

  const editorMetadata = isRecord(profile.EditorMetadata) ? profile.EditorMetadata : {};
  const globalSpeed = editorMetadata.GlobalTargetSpeedMetersPerSecond;
  if (globalSpeed !== undefined) {
    validateFinite(globalSpeed, `${path}.EditorMetadata.GlobalTargetSpeedMetersPerSecond`, issues, 0.1, 500);
  }
}

function getAvailableHardpoints(profile: EditorSourceProfile, metadata?: VehiclePreviewMetadataFile): Set<string> {
  const ids = new Set<string>();
  for (const hardpoint of metadata?.vehicles?.[profile.Vehicle]?.hardpoints ?? []) {
    ids.add(hardpoint.id);
  }
  for (const hardpoint of profile.EditorMetadata?.VehiclePreviewOverrides?.Hardpoints ?? []) {
    ids.add(hardpoint.Id);
  }
  return ids;
}

export function validateSourceBundle(value: unknown, metadata?: VehiclePreviewMetadataFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$root", code: "object", message: "Source bundle must be an object." }];
  }
  if (value.EditorSourceSchemaVersion !== 1 && value.EditorSourceSchemaVersion !== EDITOR_SOURCE_SCHEMA_VERSION) {
    addIssue(issues, "EditorSourceSchemaVersion", "schema_version", "Must be editor source schema version 1 or 2.");
  }
  if (typeof value.AllowDangerousPayloadPreview !== "boolean") {
    addIssue(issues, "AllowDangerousPayloadPreview", "boolean", "Must be boolean.");
  }
  if (!isRecord(value.Profiles)) {
    addIssue(issues, "Profiles", "object", "Must be an object keyed by profile ID.");
    return issues;
  }
  const profileEntries = Object.entries(value.Profiles);
  if (profileEntries.length > 500) {
    addIssue(issues, "Profiles", "profile_count", "Must not contain more than 500 profiles.");
  }
  for (const [key, profile] of profileEntries) {
    if (!PROFILE_KEY_PATTERN.test(key)) {
      addIssue(issues, `Profiles.${key}`, "safe_profile_key", "Profile map key is not safe.");
    }
    validateProfile(profile, key, `Profiles.${key}`, issues, metadata);
  }
  return issues;
}

export function assertValidSourceBundle(value: unknown, metadata?: VehiclePreviewMetadataFile): asserts value is EditorSourceBundle {
  const issues = validateSourceBundle(value, metadata);
  if (issues.length > 0) {
    throw new SourceValidationError(issues);
  }
}

export function clonePayloadFields(fields: PayloadEventFields): PayloadEventFields {
  return {
    Payload: fields.Payload,
    AmmoSequence: [...(fields.AmmoSequence ?? [])],
    Count: fields.Count,
    CarrierOffsetX: fields.CarrierOffsetX,
    CarrierOffsetY: fields.CarrierOffsetY,
    CarrierOffsetZ: fields.CarrierOffsetZ,
    TargetOffsetX: fields.TargetOffsetX,
    TargetOffsetY: fields.TargetOffsetY,
    TargetOffsetZ: fields.TargetOffsetZ,
    SpreadRadius: fields.SpreadRadius,
    TargetingMode: fields.TargetingMode === "advanced" ? "advanced" : "simple",
    AccuracyPercent: Number.isFinite(fields.AccuracyPercent)
      ? Math.min(100, Math.max(0, fields.AccuracyPercent))
      : 75,
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
