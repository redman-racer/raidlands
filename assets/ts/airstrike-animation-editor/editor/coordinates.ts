import { Quaternion, Vector3 } from "three";
import {
  threeQuaternionToUnity,
  threeVectorToUnity,
  unityEulerQuaternion,
  unityQuaternionToThree,
  unityVectorToThree,
} from "../math";
import type { QuaternionValue, SourceWaypoint, Vector3Value } from "../types";

function vectorFromThree(value: Vector3): Vector3Value {
  return { x: value.x, y: value.y, z: value.z };
}

function quaternionFromThree(value: Quaternion): QuaternionValue {
  return { x: value.x, y: value.y, z: value.z, w: value.w };
}

export function sourceWaypointToUnityPosition(waypoint: SourceWaypoint): Vector3Value {
  return {
    x: Number(waypoint.X) || 0,
    y: Number(waypoint.Y) || 0,
    z: Number(waypoint.Z) || 0,
  };
}

export function unityPositionToThreeVector(value: Vector3Value): Vector3 {
  const converted = unityVectorToThree(value);
  return new Vector3(converted.x, converted.y, converted.z);
}

export function sourceWaypointToThreePosition(waypoint: SourceWaypoint): Vector3 {
  return unityPositionToThreeVector(sourceWaypointToUnityPosition(waypoint));
}

export function threeVectorToUnityPosition(value: Vector3): Vector3Value {
  return threeVectorToUnity(vectorFromThree(value));
}

export function sourceWaypointToThreeQuaternion(waypoint: SourceWaypoint): Quaternion {
  const unity = unityEulerQuaternion(
    Number(waypoint.RotationX) || 0,
    Number(waypoint.RotationY) || 0,
    Number(waypoint.RotationZ) || 0,
  );
  const converted = unityQuaternionToThree(unity);
  return new Quaternion(converted.x, converted.y, converted.z, converted.w);
}

export function unityQuaternionValueToThreeQuaternion(value: QuaternionValue): Quaternion {
  const converted = unityQuaternionToThree(value);
  return new Quaternion(converted.x, converted.y, converted.z, converted.w);
}

export function threeQuaternionToUnityValue(value: Quaternion): QuaternionValue {
  return threeQuaternionToUnity(quaternionFromThree(value));
}
