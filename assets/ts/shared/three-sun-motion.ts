import { MathUtils, Vector3 } from "three";

export type RaidlandsSunMotion = {
  axis: Vector3;
  radiansPerMs: number;
};

export function raidlandsSunMotionBetween(
  previousDirection: Vector3,
  previousSampleMs: number,
  nextDirection: Vector3,
  nextSampleMs: number,
): RaidlandsSunMotion | null {
  const elapsedMs = nextSampleMs - previousSampleMs;
  const angle = previousDirection.angleTo(nextDirection);
  const axis = previousDirection.clone().cross(nextDirection);
  if (elapsedMs < 1_000 || angle < 0.00001 || axis.lengthSq() < 0.00000001) {
    return null;
  }

  axis.normalize();
  return {
    axis,
    // Reject implausible producer jumps while allowing Rust's accelerated day.
    radiansPerMs: MathUtils.clamp(angle / elapsedMs, 0, 0.01 / 1_000),
  };
}

export function extrapolateRaidlandsSunDirection(
  direction: Vector3,
  motion: RaidlandsSunMotion | null,
  elapsedMs: number,
  maxElapsedMs = 45_000,
): Vector3 {
  if (!motion || elapsedMs <= 0) {
    return direction.clone();
  }

  return direction.clone()
    .applyAxisAngle(motion.axis, motion.radiansPerMs * Math.min(elapsedMs, maxElapsedMs))
    .normalize();
}
