import { canonicalJson, quantizeCanonicalNumber } from "./canonical-json";
import { evaluateSourcePose, negateQuaternion, quaternionDot } from "./math";
import { compileReleaseSchedule } from "./release-compiler";
import { sha256Hex } from "./sha256";
import {
  DEFAULT_COMPILER_VERSION,
  DEFAULT_SAMPLE_RATE_HZ,
  RUNTIME_COORDINATE_SYSTEM,
  RUNTIME_SCHEMA_VERSION,
  type CompileOptions,
  type CompiledBundleResult,
  type CompiledProfileResult,
  type CompiledVisualFrame,
  type EditorSourceBundle,
  type EditorSourceProfile,
  type RuntimeVisualProfile,
  type RuntimeVisualProfileFile,
} from "./types";
import { assertValidSourceBundle } from "./validation";

const MAX_COMPILED_FRAMES = 6000;
const MAX_BUNDLE_BYTES = 20 * 1024 * 1024;

function sourceHashProjection(
  profile: EditorSourceProfile,
  resolvedHardpointOffsets: Record<string, { X: number; Y: number; Z: number }>,
): unknown {
  const release = profile.ReleaseSource;
  const releaseProjection =
    release.Mode === "manual"
      ? {
          Mode: release.Mode,
          LegacyDynamic: release.LegacyDynamic === true,
          MaximumUnits: release.MaximumUnits ?? null,
          FallbackIntervalSeconds: release.FallbackIntervalSeconds ?? null,
          Template: release.Template ?? null,
          Events: release.Events.map(({ Id: _id, ...event }) => event),
          ...(Object.keys(resolvedHardpointOffsets).length > 0
            ? { ResolvedHardpointOffsets: resolvedHardpointOffsets }
            : {}),
        }
      : {
          Mode: release.Mode,
          LegacyDynamic: release.LegacyDynamic === true,
          StartTime: release.StartTime,
          IntervalSeconds: release.IntervalSeconds,
          UnitsPerRelease: release.UnitsPerRelease,
          MaximumUnits: release.MaximumUnits,
          Template: release.Template,
          HardpointSequence: release.HardpointSequence,
          ResolvedHardpointOffsets: resolvedHardpointOffsets,
        };
  return {
    ProfileKey: profile.ProfileKey,
    Vehicle: profile.Vehicle,
    DurationSeconds: profile.DurationSeconds,
    FirstPayloadDelaySeconds: profile.FirstPayloadDelaySeconds,
    RotationSmoothTimeSeconds: profile.RotationSmoothTimeSeconds,
    StopAtWaypoints: profile.StopAtWaypoints,
    MinimumTerrainClearance: profile.MinimumTerrainClearance,
    PositionInterpolation: profile.PositionInterpolation,
    RotationMode: profile.RotationMode,
    Waypoints: profile.Waypoints.map(({ Id: _id, ...waypoint }) => waypoint),
    ReleaseSource: releaseProjection,
    ...(profile.EditorMetadata.GlobalTargetSpeedMetersPerSecond !== undefined
      ? { GlobalTargetSpeedMetersPerSecond: profile.EditorMetadata.GlobalTargetSpeedMetersPerSecond }
      : {}),
  };
}

function compileFrames(profile: EditorSourceProfile, sampleRateHz: number): CompiledVisualFrame[] {
  const duration = profile.DurationSeconds;
  const regularFrameCount = Math.floor(duration * sampleRateHz + 1e-9);
  const frames: CompiledVisualFrame[] = [];
  let previousRotation: { x: number; y: number; z: number; w: number } | undefined;

  const appendFrame = (time: number): void => {
    const pose = evaluateSourcePose(profile, time);
    let rotation = pose.rotation;
    if (previousRotation && quaternionDot(previousRotation, rotation) < 0) {
      rotation = negateQuaternion(rotation);
    }
    previousRotation = rotation;
    frames.push({
      Time: quantizeCanonicalNumber(time),
      X: quantizeCanonicalNumber(pose.position.x),
      Y: quantizeCanonicalNumber(pose.position.y),
      Z: quantizeCanonicalNumber(pose.position.z),
      Qx: quantizeCanonicalNumber(rotation.x),
      Qy: quantizeCanonicalNumber(rotation.y),
      Qz: quantizeCanonicalNumber(rotation.z),
      Qw: quantizeCanonicalNumber(rotation.w),
    });
  };

  for (let index = 0; index <= regularFrameCount; index += 1) {
    const time = index / sampleRateHz;
    if (time <= duration + 1e-9) {
      appendFrame(Math.min(time, duration));
    }
  }
  if (Math.abs(frames[frames.length - 1]!.Time - duration) > 1e-6) {
    appendFrame(duration);
  } else {
    frames[frames.length - 1]!.Time = quantizeCanonicalNumber(duration);
  }
  if (frames.length > MAX_COMPILED_FRAMES) {
    throw new RangeError(`Compiled frame count ${frames.length} exceeds ${MAX_COMPILED_FRAMES}.`);
  }
  return frames;
}

export function compileSourceProfile(
  profile: EditorSourceProfile,
  options: Required<Pick<CompileOptions, "publishedRevision" | "compilerVersion" | "sampleRateHz">> &
    Pick<CompileOptions, "vehicleMetadata">,
): CompiledProfileResult {
  const releases = compileReleaseSchedule(profile, options.vehicleMetadata);
  const sourceHash = sha256Hex(canonicalJson(sourceHashProjection(profile, releases.resolvedHardpointOffsets)));
  const frames = compileFrames(profile, options.sampleRateHz);
  const firstPayloadDelay =
    profile.ReleaseSource.Mode === "manual" && profile.ReleaseSource.Events.length > 0
      ? Math.min(...profile.ReleaseSource.Events.map((event) => event.Time))
      : profile.ReleaseSource.Mode === "repeated"
        ? profile.ReleaseSource.StartTime
        : profile.FirstPayloadDelaySeconds;

  const runtimeProfile: RuntimeVisualProfile = {
    Vehicle: profile.Vehicle,
    DurationSeconds: quantizeCanonicalNumber(profile.DurationSeconds),
    FirstPayloadDelaySeconds: quantizeCanonicalNumber(firstPayloadDelay),
    PayloadReleaseMode: releases.legacyMode,
    MaxPayloadCount: releases.legacyMaximumUnits,
    PayloadReleaseIntervalSeconds: quantizeCanonicalNumber(releases.legacyIntervalSeconds),
    ReleaseTemplate: releases.legacyTemplate,
    RotationSmoothTimeSeconds: quantizeCanonicalNumber(profile.RotationSmoothTimeSeconds),
    StopAtWaypoints: profile.StopAtWaypoints,
    MinimumTerrainClearance: quantizeCanonicalNumber(profile.MinimumTerrainClearance),
    Waypoints: profile.Waypoints.map((waypoint) => ({
      Time: quantizeCanonicalNumber(waypoint.Time),
      X: quantizeCanonicalNumber(waypoint.X),
      Y: quantizeCanonicalNumber(waypoint.Y),
      Z: quantizeCanonicalNumber(waypoint.Z),
      RotationX: quantizeCanonicalNumber(waypoint.RotationX),
      RotationY: quantizeCanonicalNumber(waypoint.RotationY),
      RotationZ: quantizeCanonicalNumber(waypoint.RotationZ),
    })),
    PayloadEvents: releases.legacyEvents,
    CompiledTrack: {
      CompilerVersion: options.compilerVersion,
      SourceHash: sourceHash,
      CoordinateSystem: RUNTIME_COORDINATE_SYSTEM,
      SampleRateHz: options.sampleRateHz,
      SampleIntervalSeconds: quantizeCanonicalNumber(1 / options.sampleRateHz),
      DurationSeconds: quantizeCanonicalNumber(profile.DurationSeconds),
      Frames: frames,
    },
    ...(releases.compiledEvents === undefined ? {} : { CompiledReleaseEvents: releases.compiledEvents }),
  };
  return { profile: runtimeProfile, sourceHash };
}

export function compileSourceBundle(source: EditorSourceBundle, options: CompileOptions): CompiledBundleResult {
  assertValidSourceBundle(source, options.vehicleMetadata);
  const compilerVersion = options.compilerVersion ?? DEFAULT_COMPILER_VERSION;
  const sampleRateHz = options.sampleRateHz ?? DEFAULT_SAMPLE_RATE_HZ;
  if (!Number.isInteger(options.publishedRevision) || options.publishedRevision < 1) {
    throw new RangeError("publishedRevision must be a positive integer.");
  }
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0 || sampleRateHz > 120) {
    throw new RangeError("sampleRateHz must be finite and between 1 and 120.");
  }

  const profiles: RuntimeVisualProfileFile["Profiles"] = {};
  const sourceHashes: Record<string, string> = {};
  for (const key of Object.keys(source.Profiles).sort()) {
    const compiled = compileSourceProfile(source.Profiles[key]!, {
      publishedRevision: options.publishedRevision,
      compilerVersion,
      sampleRateHz,
      vehicleMetadata: options.vehicleMetadata,
    });
    profiles[key] = compiled.profile;
    sourceHashes[key] = compiled.sourceHash;
  }
  const bundle: RuntimeVisualProfileFile = {
    SchemaVersion: RUNTIME_SCHEMA_VERSION,
    CompilerVersion: compilerVersion,
    PublishedRevision: options.publishedRevision,
    AllowDangerousPayloadPreview: source.AllowDangerousPayloadPreview,
    Profiles: profiles,
  };
  const canonical = canonicalJson(bundle);
  const byteLength = new TextEncoder().encode(canonical).length;
  if (byteLength > MAX_BUNDLE_BYTES) {
    throw new RangeError(`Canonical runtime bundle is ${byteLength} bytes; maximum is ${MAX_BUNDLE_BYTES}.`);
  }
  return { bundle, canonicalJson: canonical, sha256: sha256Hex(canonical), sourceHashes };
}
