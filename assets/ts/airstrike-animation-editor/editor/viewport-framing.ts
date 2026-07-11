import { Box3, PerspectiveCamera, Vector3 } from "three";
import type { EditorSourceProfile } from "../types";
import { unityPositionToThreeVector } from "./coordinates";

export interface ViewportControlScale {
  panSpeed: number;
  zoomSpeed: number;
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function routeBounds(profile: EditorSourceProfile): Box3 {
  const points = profile.Waypoints.map((waypoint) =>
    unityPositionToThreeVector({ x: waypoint.X, y: waypoint.Y, z: waypoint.Z }),
  );
  points.push(new Vector3(0, 0, 0));
  return new Box3().setFromPoints(points);
}

export function boundsRadius(bounds: Box3): number {
  const size = new Vector3();
  bounds.getSize(size);
  return Math.max(1, size.length() * 0.5);
}

export function frameBounds(camera: PerspectiveCamera, target: Vector3, bounds: Box3): Vector3 {
  const radius = boundsRadius(bounds);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = clamp(radius / Math.sin(fov * 0.5), radius * 1.2, 5000);
  const direction = new Vector3(0.72, 0.46, 0.52).normalize();
  return target.clone().add(direction.multiplyScalar(distance));
}

export function dynamicControlScale(camera: PerspectiveCamera, target: Vector3, bounds: Box3): ViewportControlScale {
  const distance = camera.position.distanceTo(target);
  const radius = boundsRadius(bounds);
  return {
    panSpeed: clamp(distance / Math.max(80, radius), 0.35, 5),
    zoomSpeed: clamp(distance / Math.max(160, radius), 0.45, 3.5),
    minDistance: clamp(radius * 0.012, 0.35, 25),
    maxDistance: Math.max(500, radius * 12),
    near: clamp(Math.min(0.08, distance / 10000), 0.01, 1),
    far: Math.max(5000, distance + radius * 20),
  };
}
