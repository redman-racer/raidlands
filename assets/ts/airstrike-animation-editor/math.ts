import type {
  CompiledVisualFrame,
  CompiledVisualTrack,
  EditorSourceProfile,
  QuaternionValue,
  SourceWaypoint,
  Vector3Value,
} from "./types";

const EPSILON = 1e-9;
const DEG_TO_RAD = Math.PI / 180;
const WORLD_UP: Vector3Value = { x: 0, y: 1, z: 0 };
const LOCAL_FORWARD: Vector3Value = { x: 0, y: 0, z: 1 };

export function vector(x = 0, y = 0, z = 0): Vector3Value {
  return { x, y, z };
}

export function add(left: Vector3Value, right: Vector3Value): Vector3Value {
  return vector(left.x + right.x, left.y + right.y, left.z + right.z);
}

export function subtract(left: Vector3Value, right: Vector3Value): Vector3Value {
  return vector(left.x - right.x, left.y - right.y, left.z - right.z);
}

export function scale(value: Vector3Value, scalar: number): Vector3Value {
  return vector(value.x * scalar, value.y * scalar, value.z * scalar);
}

export function dot(left: Vector3Value, right: Vector3Value): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function cross(left: Vector3Value, right: Vector3Value): Vector3Value {
  return vector(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
}

export function magnitudeSquared(value: Vector3Value): number {
  return dot(value, value);
}

export function normalizeVector(value: Vector3Value, fallback = LOCAL_FORWARD): Vector3Value {
  const lengthSquared = magnitudeSquared(value);
  if (lengthSquared <= EPSILON) {
    if (value !== fallback) {
      return normalizeVector(fallback, LOCAL_FORWARD);
    }
    return { ...LOCAL_FORWARD };
  }
  return scale(value, 1 / Math.sqrt(lengthSquared));
}

export function lerpVector(left: Vector3Value, right: Vector3Value, t: number): Vector3Value {
  return add(left, scale(subtract(right, left), t));
}

export function waypointPosition(waypoint: SourceWaypoint): Vector3Value {
  return vector(waypoint.X, waypoint.Y, waypoint.Z);
}

export function quaternion(x = 0, y = 0, z = 0, w = 1): QuaternionValue {
  return { x, y, z, w };
}

export function quaternionDot(left: QuaternionValue, right: QuaternionValue): number {
  return left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w;
}

export function negateQuaternion(value: QuaternionValue): QuaternionValue {
  return quaternion(-value.x, -value.y, -value.z, -value.w);
}

export function normalizeQuaternion(value: QuaternionValue): QuaternionValue {
  const lengthSquared = quaternionDot(value, value);
  if (lengthSquared <= EPSILON) {
    return quaternion();
  }
  const inverse = 1 / Math.sqrt(lengthSquared);
  return quaternion(value.x * inverse, value.y * inverse, value.z * inverse, value.w * inverse);
}

/** Quaternion multiplication in Unity composition order. */
export function multiplyQuaternion(left: QuaternionValue, right: QuaternionValue): QuaternionValue {
  return quaternion(
    left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  );
}

function axisAngleQuaternion(axis: Vector3Value, degrees: number): QuaternionValue {
  const halfAngle = degrees * DEG_TO_RAD * 0.5;
  const sine = Math.sin(halfAngle);
  return quaternion(axis.x * sine, axis.y * sine, axis.z * sine, Math.cos(halfAngle));
}

/**
 * Matches Unity Quaternion.Euler(x,y,z): rotations are applied Z, then X,
 * then Y, represented as qY * qX * qZ.
 */
export function unityEulerQuaternion(xDegrees: number, yDegrees: number, zDegrees: number): QuaternionValue {
  const qx = axisAngleQuaternion({ x: 1, y: 0, z: 0 }, xDegrees);
  const qy = axisAngleQuaternion({ x: 0, y: 1, z: 0 }, yDegrees);
  const qz = axisAngleQuaternion({ x: 0, y: 0, z: 1 }, zDegrees);
  return normalizeQuaternion(multiplyQuaternion(multiplyQuaternion(qy, qx), qz));
}

function quaternionFromRotationMatrix(
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
): QuaternionValue {
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return normalizeQuaternion(quaternion((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4));
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return normalizeQuaternion(quaternion(s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s));
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return normalizeQuaternion(quaternion((m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s));
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return normalizeQuaternion(quaternion((m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s));
}

/** Unity-style LookRotation with deterministic degenerate/vertical fallbacks. */
export function lookRotation(
  forwardInput: Vector3Value,
  upInput: Vector3Value = WORLD_UP,
  fallbackForward: Vector3Value = LOCAL_FORWARD,
): QuaternionValue {
  const forward = normalizeVector(forwardInput, fallbackForward);
  let right = cross(upInput, forward);
  if (magnitudeSquared(right) <= EPSILON) {
    const auxiliaryUp = Math.abs(forward.y) > 0.999 ? LOCAL_FORWARD : WORLD_UP;
    right = cross(auxiliaryUp, forward);
  }
  if (magnitudeSquared(right) <= EPSILON) {
    right = cross({ x: 1, y: 0, z: 0 }, forward);
  }
  right = normalizeVector(right, { x: 1, y: 0, z: 0 });
  const correctedUp = normalizeVector(cross(forward, right), WORLD_UP);
  return quaternionFromRotationMatrix(
    right.x,
    correctedUp.x,
    forward.x,
    right.y,
    correctedUp.y,
    forward.y,
    right.z,
    correctedUp.z,
    forward.z,
  );
}

export function rotateVector(rotation: QuaternionValue, value: Vector3Value): Vector3Value {
  const normalized = normalizeQuaternion(rotation);
  const vectorQuaternion = quaternion(value.x, value.y, value.z, 0);
  const inverse = quaternion(-normalized.x, -normalized.y, -normalized.z, normalized.w);
  const rotated = multiplyQuaternion(multiplyQuaternion(normalized, vectorQuaternion), inverse);
  return vector(rotated.x, rotated.y, rotated.z);
}

/** Explicit Unity left-handed local -> Three.js right-handed render reflection. */
export function unityVectorToThree(value: Vector3Value): Vector3Value {
  return vector(value.x, value.y, -value.z);
}

export function threeVectorToUnity(value: Vector3Value): Vector3Value {
  return vector(value.x, value.y, -value.z);
}

/** Quaternion conversion for the same Z-axis reflection. */
export function unityQuaternionToThree(value: QuaternionValue): QuaternionValue {
  return normalizeQuaternion(quaternion(-value.x, -value.y, value.z, value.w));
}

export function threeQuaternionToUnity(value: QuaternionValue): QuaternionValue {
  return normalizeQuaternion(quaternion(-value.x, -value.y, value.z, value.w));
}

export function slerpQuaternion(leftInput: QuaternionValue, rightInput: QuaternionValue, t: number): QuaternionValue {
  const left = normalizeQuaternion(leftInput);
  let right = normalizeQuaternion(rightInput);
  let cosine = quaternionDot(left, right);
  if (cosine < 0) {
    right = negateQuaternion(right);
    cosine = -cosine;
  }
  if (cosine > 0.9995) {
    return normalizeQuaternion(
      quaternion(
        left.x + (right.x - left.x) * t,
        left.y + (right.y - left.y) * t,
        left.z + (right.z - left.z) * t,
        left.w + (right.w - left.w) * t,
      ),
    );
  }
  const theta = Math.acos(Math.min(1, Math.max(-1, cosine)));
  const sine = Math.sin(theta);
  const leftWeight = Math.sin((1 - t) * theta) / sine;
  const rightWeight = Math.sin(t * theta) / sine;
  return normalizeQuaternion(
    quaternion(
      left.x * leftWeight + right.x * rightWeight,
      left.y * leftWeight + right.y * rightWeight,
      left.z * leftWeight + right.z * rightWeight,
      left.w * leftWeight + right.w * rightWeight,
    ),
  );
}

function findSegment(waypoints: SourceWaypoint[], time: number): number {
  if (time <= waypoints[0]!.Time) {
    return 0;
  }
  const lastSegment = waypoints.length - 2;
  if (time >= waypoints[waypoints.length - 1]!.Time) {
    return lastSegment;
  }
  let low = 0;
  let high = lastSegment;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = waypoints[middle]!.Time;
    const end = waypoints[middle + 1]!.Time;
    if (time < start) {
      high = middle - 1;
    } else if (time > end) {
      low = middle + 1;
    } else {
      return middle;
    }
  }
  return Math.max(0, Math.min(lastSegment, low));
}

function waypointVelocity(waypoints: SourceWaypoint[], index: number): Vector3Value {
  const last = waypoints.length - 1;
  if (index <= 0) {
    const duration = waypoints[1]!.Time - waypoints[0]!.Time;
    return scale(subtract(waypointPosition(waypoints[1]!), waypointPosition(waypoints[0]!)), 1 / duration);
  }
  if (index >= last) {
    const duration = waypoints[last]!.Time - waypoints[last - 1]!.Time;
    return scale(subtract(waypointPosition(waypoints[last]!), waypointPosition(waypoints[last - 1]!)), 1 / duration);
  }
  const duration = waypoints[index + 1]!.Time - waypoints[index - 1]!.Time;
  return scale(subtract(waypointPosition(waypoints[index + 1]!), waypointPosition(waypoints[index - 1]!)), 1 / duration);
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface EvaluatedSourcePose {
  position: Vector3Value;
  tangent: Vector3Value;
  rotation: QuaternionValue;
  euler: Vector3Value;
}

export function evaluateSourcePose(profile: EditorSourceProfile, requestedTime: number): EvaluatedSourcePose {
  const waypoints = profile.Waypoints;
  const time = Math.min(profile.DurationSeconds, Math.max(0, requestedTime));
  const segmentIndex = findSegment(waypoints, time);
  const start = waypoints[segmentIndex]!;
  const end = waypoints[segmentIndex + 1]!;
  const duration = end.Time - start.Time;
  const rawProgress = duration <= EPSILON ? 0 : (time - start.Time) / duration;
  const progress = Math.min(1, Math.max(0, rawProgress));
  const startPosition = waypointPosition(start);
  const endPosition = waypointPosition(end);
  let position: Vector3Value;
  let tangent: Vector3Value;
  let interpolationProgress = progress;

  if (profile.StopAtWaypoints) {
    interpolationProgress = smoothStep(progress);
    position = lerpVector(startPosition, endPosition, interpolationProgress);
    const derivativeScale = duration <= EPSILON ? 0 : (6 * progress * (1 - progress)) / duration;
    tangent = scale(subtract(endPosition, startPosition), derivativeScale);
  } else {
    const m0 = waypointVelocity(waypoints, segmentIndex);
    const m1 = waypointVelocity(waypoints, segmentIndex + 1);
    const t2 = progress * progress;
    const t3 = t2 * progress;
    position = add(
      add(scale(startPosition, 2 * t3 - 3 * t2 + 1), scale(m0, (t3 - 2 * t2 + progress) * duration)),
      add(scale(endPosition, -2 * t3 + 3 * t2), scale(m1, (t3 - t2) * duration)),
    );
    tangent = add(
      add(scale(startPosition, (6 * t2 - 6 * progress) / duration), scale(m0, 3 * t2 - 4 * progress + 1)),
      add(scale(endPosition, (-6 * t2 + 6 * progress) / duration), scale(m1, 3 * t2 - 2 * progress)),
    );
  }

  if (magnitudeSquared(tangent) <= EPSILON) {
    const waypointIndex = segmentIndex + (progress >= 1 ? 1 : 0);
    if (waypointIndex > 0 && waypointIndex < waypoints.length - 1) {
      const before = waypointPosition(waypoints[waypointIndex - 1]!);
      const after = waypointPosition(waypoints[waypointIndex + 1]!);
      tangent = subtract(after, before);
    }
  }
  if (magnitudeSquared(tangent) <= EPSILON) {
    tangent = subtract(endPosition, startPosition);
  }

  const euler = vector(
    start.RotationX + (end.RotationX - start.RotationX) * interpolationProgress,
    start.RotationY + (end.RotationY - start.RotationY) * interpolationProgress,
    start.RotationZ + (end.RotationZ - start.RotationZ) * interpolationProgress,
  );
  const look = lookRotation(tangent, WORLD_UP, LOCAL_FORWARD);
  const offset = unityEulerQuaternion(euler.x, euler.y, euler.z);
  const rotation = normalizeQuaternion(multiplyQuaternion(look, offset));
  return { position, tangent: normalizeVector(tangent, LOCAL_FORWARD), rotation, euler };
}

export interface WorldBasis {
  forward: Vector3Value;
  right: Vector3Value;
  rotation: QuaternionValue;
}

export function createWorldBasis(horizontalApproach: Vector3Value): WorldBasis {
  const flattened = vector(horizontalApproach.x, 0, horizontalApproach.z);
  const forward = normalizeVector(flattened, LOCAL_FORWARD);
  const right = normalizeVector(cross(WORLD_UP, forward), { x: 1, y: 0, z: 0 });
  return { forward, right, rotation: lookRotation(forward, WORLD_UP, LOCAL_FORWARD) };
}

export function localFrameToWorld(
  frame: Pick<CompiledVisualFrame, "X" | "Y" | "Z" | "Qx" | "Qy" | "Qz" | "Qw">,
  target: Vector3Value,
  horizontalApproach: Vector3Value,
): { position: Vector3Value; rotation: QuaternionValue } {
  const basis = createWorldBasis(horizontalApproach);
  const position = add(
    target,
    add(scale(basis.right, frame.X), add(scale(WORLD_UP, frame.Y), scale(basis.forward, frame.Z))),
  );
  const localRotation = quaternion(frame.Qx, frame.Qy, frame.Qz, frame.Qw);
  return { position, rotation: normalizeQuaternion(multiplyQuaternion(basis.rotation, localRotation)) };
}

export function evaluateCompiledTrack(track: CompiledVisualTrack, requestedTime: number): CompiledVisualFrame {
  const frames = track.Frames;
  const time = Math.min(track.DurationSeconds, Math.max(0, requestedTime));
  if (time <= frames[0]!.Time) {
    return { ...frames[0]! };
  }
  const last = frames.length - 1;
  if (time >= frames[last]!.Time) {
    return { ...frames[last]! };
  }
  let low = 0;
  let high = last - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle + 1]!.Time < time) {
      low = middle + 1;
    } else if (frames[middle]!.Time > time) {
      high = middle - 1;
    } else {
      low = middle;
      break;
    }
  }
  const index = Math.min(last - 1, Math.max(0, low));
  const start = frames[index]!;
  const end = frames[index + 1]!;
  const duration = end.Time - start.Time;
  const progress = duration <= EPSILON ? 0 : (time - start.Time) / duration;
  const position = lerpVector(vector(start.X, start.Y, start.Z), vector(end.X, end.Y, end.Z), progress);
  const rotation = slerpQuaternion(
    quaternion(start.Qx, start.Qy, start.Qz, start.Qw),
    quaternion(end.Qx, end.Qy, end.Qz, end.Qw),
    progress,
  );
  return {
    Time: time,
    X: position.x,
    Y: position.y,
    Z: position.z,
    Qx: rotation.x,
    Qy: rotation.y,
    Qz: rotation.z,
    Qw: rotation.w,
  };
}
