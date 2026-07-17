import { MathUtils, Quaternion, Vector3 } from "three";

export type ReplayQuaternionValue = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type TimestampedWorldRouteSample = {
  timestampMs: number;
  position: Vector3;
  rotation: Quaternion;
};

const MODEL_FORWARD_CORRECTION = new Quaternion(0, 1, 0, 0);

/**
 * Converts a Rust/Unity world rotation into the viewer's mirrored-X world.
 * Viewer vehicle assets point down local -Z, while Unity entities point down
 * local +Z, so the local half-turn is part of the same conversion.
 */
export function rustWorldQuaternionToViewerQuaternion(value: ReplayQuaternionValue): Quaternion {
  return new Quaternion(value.x, -value.y, -value.z, value.w)
    .normalize()
    .multiply(MODEL_FORWARD_CORRECTION)
    .normalize();
}

export function replayTimelineFrameIntervalMs(frameSeconds: number, playbackSpeed: number): number {
  const seconds = MathUtils.clamp(Number(frameSeconds) || 60, 1, 24 * 60 * 60);
  const speed = MathUtils.clamp(Number(playbackSpeed) || 1, 0.25, 512);
  return (seconds * 1000) / speed;
}

export function replayTimelineHistoryRate(frameSeconds: number, playbackSpeed: number): number {
  return MathUtils.clamp(Number(playbackSpeed) || 1, 0.25, 512);
}

export function sampleTimestampedWorldRoute(
  route: TimestampedWorldRouteSample[],
  cursorMs: number,
  velocity: Vector3 | null = null,
  maximumExtrapolationMs = 0,
): { position: Vector3; rotation: Quaternion } | null {
  if (route.length === 0 || !Number.isFinite(cursorMs)) return null;
  if (cursorMs <= route[0]!.timestampMs) {
    return { position: route[0]!.position.clone(), rotation: route[0]!.rotation.clone() };
  }
  for (let index = 1; index < route.length; index += 1) {
    const current = route[index - 1]!;
    const next = route[index]!;
    if (cursorMs <= next.timestampMs) {
      const fraction = MathUtils.clamp((cursorMs - current.timestampMs) / Math.max(1, next.timestampMs - current.timestampMs), 0, 1);
      return {
        position: current.position.clone().lerp(next.position, fraction),
        rotation: current.rotation.clone().slerp(next.rotation, fraction),
      };
    }
  }

  const last = route[route.length - 1]!;
  const position = last.position.clone();
  if (velocity && maximumExtrapolationMs > 0) {
    position.addScaledVector(velocity, MathUtils.clamp(cursorMs - last.timestampMs, 0, maximumExtrapolationMs) / 1000);
  }
  return { position, rotation: last.rotation.clone() };
}
