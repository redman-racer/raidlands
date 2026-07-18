import { Object3D, Vector3 } from "three";

type Point = readonly [number, number, number];

// RustRelay exports do not all use the same scene origin. These anchors are the
// shared male mannequin frame used by the body layers and let every wearable be
// translated and scaled into one coordinate system before the outfit is fitted.
export const MANNEQUIN_ANCHORS: Record<string, Point> = {
  pelvis: [0, 0.3283832, -0.03834376],
  spine2: [0, 0.4888, -0.0628],
  head: [0, 0.9581, -0.0531],
  l_toe: [0.1880345, -0.6017, -0.0116],
  r_toe: [-0.18402065, -0.60211344, -0.01100226],
};

const ANCHOR_PRIORITY = ["pelvis", "head", "spine2", "l_toe", "r_toe"];

function point(values: Point): Vector3 {
  return new Vector3(values[0], values[1], values[2]);
}

export type MannequinOriginResult = {
  anchors: number;
  scale: number;
};

export function normalizeWearableOrigin(root: Object3D): MannequinOriginResult {
  root.updateMatrixWorld(true);
  const nodes = new Map<string, Object3D>();
  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (MANNEQUIN_ANCHORS[name] && !nodes.has(name)) nodes.set(name, node);
  });

  const names = ANCHOR_PRIORITY.filter((name) => nodes.has(name));
  if (!names.length) return { anchors: 0, scale: 1 };

  let scale = 1;
  let widestTargetSpan = 0;
  for (let left = 0; left < names.length; left += 1) {
    for (let right = left + 1; right < names.length; right += 1) {
      const sourceSpan = nodes.get(names[left])!.getWorldPosition(new Vector3())
        .distanceTo(nodes.get(names[right])!.getWorldPosition(new Vector3()));
      const targetSpan = point(MANNEQUIN_ANCHORS[names[left]])
        .distanceTo(point(MANNEQUIN_ANCHORS[names[right]]));
      if (sourceSpan > 0.00001 && targetSpan > widestTargetSpan) {
        widestTargetSpan = targetSpan;
        scale = targetSpan / sourceSpan;
      }
    }
  }

  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const originName = names[0];
  const sourceOrigin = nodes.get(originName)!.getWorldPosition(new Vector3());
  root.position.add(point(MANNEQUIN_ANCHORS[originName]).sub(sourceOrigin));
  root.updateMatrixWorld(true);
  return { anchors: names.length, scale };
}

export function podiumCharacterYaw(rank: number): number {
  return [0, 0.12, -0.12][rank] || 0;
}

export type PodiumWeaponLayout = {
  position: Point;
  rotation: Point;
  size: number;
};

export function podiumWeaponLayout(weapon: string, rank: number): PodiumWeaponLayout {
  const side = rank === 1 ? -1 : 1;
  const turnsBroadside = weapon === "rocket-launcher" || weapon === "sap";
  return {
    position: [side * (weapon === "rocket-launcher" ? 0.5 : 0.4), weapon === "sap" ? 1.12 : 1.24, 0.34],
    rotation: [weapon === "rocket-launcher" ? 0 : -0.08, turnsBroadside ? Math.PI / 2 : 0, side * 0.1],
    size: weapon === "sap" ? 0.42 : weapon === "rocket-launcher" ? 1.04 : 0.92,
  };
}
