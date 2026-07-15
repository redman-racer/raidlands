import { Group, Object3D } from "three";
import { monumentPrefabId } from "./monument-model-registry";

export const MILITARY_BASE_MLRS_ASSET = "media/models/vehicles/mlrs.entity.glb";
export const MILITARY_BASE_MLRS_SHA256 = "63fbdcb819ce5b4c5ac04b3515d206885c2f5057d7c303562e22ec050513fcf6";

type MlrsPlacement = { x: number; y: number; z: number; rotationY: number };

const MILITARY_BASE_MLRS_PLACEMENTS: Record<string, MlrsPlacement> = {
  desert_military_base_a: { x: 12, y: 0, z: -6, rotationY: Math.PI * 0.5 },
  desert_military_base_b: { x: 10, y: 0, z: -5, rotationY: Math.PI * 0.5 },
  desert_military_base_c: { x: 13, y: 0, z: -8, rotationY: Math.PI * 0.5 },
  desert_military_base_d: { x: 15, y: 0, z: -4, rotationY: Math.PI * 0.5 },
};

export function militaryBaseMlrsPlacement(prefab: string): MlrsPlacement | null {
  return MILITARY_BASE_MLRS_PLACEMENTS[monumentPrefabId(prefab)] || null;
}

export function attachMilitaryBaseMlrs(monument: Group, mlrsSource: Group, prefab: string): Group | null {
  const placement = militaryBaseMlrsPlacement(prefab);
  if (!placement) return null;

  const mlrs = mlrsSource.clone(true);
  mlrs.name = "monument-vehicle-mlrs";
  mlrs.position.set(placement.x, placement.y, placement.z);
  mlrs.rotation.y = placement.rotationY;
  mlrs.userData.raidlandsVehicleKind = "mlrs";
  mlrs.userData.raidlandsAnimationReady = true;

  const horizontal = mlrs.getObjectByName("hRotator");
  const vertical = mlrs.getObjectByName("vRotator");
  const launcher = mlrs.getObjectByName("mlrs_rocket_launcher");
  if (horizontal) horizontal.userData.raidlandsAnimationRole = "launcher-yaw";
  if (vertical) vertical.userData.raidlandsAnimationRole = "launcher-pitch";
  if (launcher) launcher.userData.raidlandsAnimationRole = "launcher-rack";

  const launchOrigin = new Object3D();
  launchOrigin.name = "raidlands-mlrs-launch-origin";
  launchOrigin.userData.raidlandsAnimationRole = "rocket-origin";
  (launcher || vertical || mlrs).add(launchOrigin);

  monument.add(mlrs);
  return mlrs;
}
