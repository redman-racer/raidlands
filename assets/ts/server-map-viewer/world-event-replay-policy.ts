import { MathUtils, Quaternion } from "three";

export type ReplayQuaternionValue = {
  x: number;
  y: number;
  z: number;
  w: number;
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

/**
 * Timeline 1x is a readable 4x overview. On one-minute frames this makes the
 * 0.25x control advance one historical minute per real minute, while longer
 * ranges remain bounded to one real minute per sampled frame.
 */
export function replayTimelineFrameIntervalMs(frameSeconds: number, playbackSpeed: number): number {
  const seconds = MathUtils.clamp(Number(frameSeconds) || 60, 1, 24 * 60 * 60);
  const speed = MathUtils.clamp(Number(playbackSpeed) || 1, 0.1, 12);
  return MathUtils.clamp((seconds * 1000) / (4 * speed), 80, 60_000);
}

export function replayTimelineHistoryRate(frameSeconds: number, playbackSpeed: number): number {
  const seconds = MathUtils.clamp(Number(frameSeconds) || 60, 1, 24 * 60 * 60);
  return (seconds * 1000) / replayTimelineFrameIntervalMs(seconds, playbackSpeed);
}
