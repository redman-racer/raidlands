import { Group, Object3D } from "three";
import { monumentPrefabId } from "./monument-model-registry";

export const MILITARY_BASE_MLRS_ASSET = "media/models/vehicles/mlrs.entity.glb";
export const MILITARY_BASE_MLRS_SHA256 = "63fbdcb819ce5b4c5ac04b3515d206885c2f5057d7c303562e22ec050513fcf6";

export type MilitaryBaseCompositeAsset = {
  id: string;
  path: string;
  sha256: string;
  placements: Array<{ x: number; y: number; z: number; rotationY: number }>;
};

export const MILITARY_BASE_COMPOSITE_ASSETS: MilitaryBaseCompositeAsset[] = [
  {
    id: "hangar",
    path: "media/models/military-base/military_hangar_1350x1100.glb",
    sha256: "70d4f27e73acac8a8f44a383266eaf5ea7d58ca9d7118274dfce43b3bd3a85a2",
    placements: [{ x: -15, y: 0, z: -8, rotationY: Math.PI * 0.08 }],
  },
  {
    id: "helipad",
    path: "media/models/military-base/helipad_desert_1500x1500.glb",
    sha256: "da79a539b50302e4a4704a04f56c2a5024984baa1de847d169902846d922b223",
    placements: [{ x: 19, y: 0, z: 18, rotationY: 0 }],
  },
  {
    id: "field-tent",
    path: "media/models/military-base/tent_tunnel_600_a.glb",
    sha256: "3b878a9bf81270e22cb9332950863e2caa64d989636d081ae84eedb2f4ff23cb",
    placements: [
      { x: -8, y: 0, z: 14, rotationY: -Math.PI * 0.08 },
      { x: 1, y: 0, z: 16, rotationY: -Math.PI * 0.08 },
    ],
  },
  {
    id: "shipping-container",
    path: "media/models/military-base/shipping_container_600_a_green.glb",
    sha256: "aa2c5c418822fada46f40cb127507a6c1f3d823f2ef608c44c83b12dcdf7ba83",
    placements: [
      { x: -25, y: 0, z: 14, rotationY: Math.PI * 0.48 },
      { x: -21, y: 0, z: 18, rotationY: Math.PI * 0.48 },
      { x: 25, y: 0, z: -1, rotationY: Math.PI * 0.06 },
    ],
  },
  {
    id: "sandbags",
    path: "media/models/military-base/barricade_sandbags.glb",
    sha256: "514ce1639a5cb706f127539ed44d5f3680d5729e433c5a228e35aa008c740a5a",
    placements: [
      { x: 7, y: 0, z: -17, rotationY: Math.PI * 0.5 },
      { x: 13, y: 0, z: -17, rotationY: Math.PI * 0.5 },
      { x: 19, y: 0, z: -17, rotationY: Math.PI * 0.5 },
      { x: -4, y: 0, z: 4, rotationY: Math.PI * 0.12 },
    ],
  },
  {
    id: "generator",
    path: "media/models/military-base/power_generator_a.glb",
    sha256: "37cfadb80d969a0070dbc06c0c6f3bd8da6327fdcb87973684b7baca28877b79",
    placements: [
      { x: -23, y: 0, z: -2, rotationY: Math.PI * 0.35 },
      { x: 6, y: 0, z: 7, rotationY: -Math.PI * 0.18 },
    ],
  },
];

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

export function usesEnhancedMilitaryBaseMapModel(prefab: string): boolean {
  return militaryBaseMlrsPlacement(prefab) !== null;
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

export function attachMilitaryBaseCompositeAsset(monument: Group, source: Group, asset: MilitaryBaseCompositeAsset): Group[] {
  return asset.placements.map((placement, index) => {
    const instance = source.clone(true);
    instance.name = `monument-military-base-${asset.id}-${index + 1}`;
    instance.position.set(placement.x, placement.y, placement.z);
    instance.rotation.y = placement.rotationY;
    instance.userData.raidlandsMilitaryBaseDetail = asset.id;
    monument.add(instance);
    return instance;
  });
}
