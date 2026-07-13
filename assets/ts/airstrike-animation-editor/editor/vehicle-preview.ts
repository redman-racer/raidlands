import {
  BoxGeometry,
  BoxHelper,
  Box3,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { unityPositionToThreeVector } from "./coordinates";
import type { VehiclePreviewMetadata, VehiclePreviewMetadataFile } from "../types";

const DEFAULT_METADATA: VehiclePreviewMetadata = {
  vehicle: "f15",
  modelUrl: "/assets/airstrike-animation-editor/models/f15/scene.gltf",
  prefabLabel: "assets/scripts/entity/misc/f15/f15e.prefab",
  scale: 0.00000185,
  positionCorrection: { x: 0, y: 0, z: 0 },
  rotationCorrection: { x: 0, y: 0, z: 0 },
  bounds: { x: 13, y: 5.5, z: 19.5 },
  proxy: "plane",
  hardpoints: [
    { id: "left_rocket", x: -3.1, y: -0.7, z: 0.8 },
    { id: "right_rocket", x: 3.1, y: -0.7, z: 0.8 },
  ],
};

export function metadataForVehicle(
  metadataFile: VehiclePreviewMetadataFile | null | undefined,
  vehicle: string,
): VehiclePreviewMetadata {
  return metadataFile?.vehicles?.[vehicle] ?? metadataFile?.vehicles?.f15 ?? DEFAULT_METADATA;
}

export function resolvePreviewAssetUrl(modelUrl: string, assetBase: string): string {
  const trimmed = modelUrl.trim();
  if (!trimmed) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  const normalizedBase = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
  if (trimmed.startsWith("/assets/")) {
    return `${normalizedBase}${trimmed.slice("/assets/".length)}`;
  }
  if (trimmed.startsWith("assets/")) {
    return `${normalizedBase}${trimmed.slice("assets/".length)}`;
  }
  return trimmed;
}

function standard(color: number, roughness = 0.72): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.18, roughness });
}

function addBox(group: Group, name: string, size: [number, number, number], position: Vector3, color: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), standard(color));
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addHardpointMarkers(group: Group, metadata: VehiclePreviewMetadata): void {
  const material = new MeshBasicMaterial({ color: 0xffd166 });
  const geometry = new SphereGeometry(Math.max(0.12, Math.min(metadata.bounds.x, metadata.bounds.z) * 0.018), 12, 8);
  for (const hardpoint of metadata.hardpoints) {
    const marker = new Mesh(geometry, material);
    marker.name = `hardpoint:${hardpoint.id}`;
    marker.position.copy(unityPositionToThreeVector({ x: hardpoint.x, y: hardpoint.y, z: hardpoint.z }));
    group.add(marker);
  }
}

function addBounds(group: Group): void {
  const helper = new BoxHelper(group, 0x6ee7ff);
  helper.name = "vehicle-bounds";
  group.add(helper);
}

function centerLoadedScene(scene: Object3D): void {
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  if (box.isEmpty()) {
    return;
  }
  const center = new Vector3();
  box.getCenter(center);
  scene.position.sub(center);
}

function alignVisualOrigin(group: Group, originY = 0.5): void {
  group.updateMatrixWorld(true);
  const box = new Box3().setFromObject(group);
  if (box.isEmpty()) {
    return;
  }
  const ratio = Math.min(1, Math.max(0, Number.isFinite(originY) ? originY : 0.5));
  const anchorY = box.min.y + (box.max.y - box.min.y) * ratio;
  group.position.y -= anchorY;
}

function addPlaneProxy(group: Group, metadata: VehiclePreviewMetadata): void {
  const width = metadata.bounds.x;
  const height = metadata.bounds.y;
  const length = metadata.bounds.z;
  addBox(group, "fuselage", [Math.max(width * 0.12, 0.55), Math.max(height * 0.34, 0.35), length], new Vector3(0, 0, 0), 0x6b7c85);
  addBox(group, "wings", [width, Math.max(height * 0.08, 0.15), Math.max(length * 0.16, 0.8)], new Vector3(0, 0, -length * 0.08), 0x8ca3ad);
  addBox(group, "tail-wing", [width * 0.45, Math.max(height * 0.07, 0.12), Math.max(length * 0.11, 0.5)], new Vector3(0, height * 0.04, length * 0.42), 0x8ca3ad);
  addBox(group, "tail-fin", [Math.max(width * 0.055, 0.15), height * 0.48, Math.max(length * 0.11, 0.45)], new Vector3(0, height * 0.28, length * 0.42), 0x708790);
  const nose = new Mesh(new ConeGeometry(Math.max(width * 0.08, 0.32), Math.max(length * 0.16, 0.75), 18), standard(0xdfe9ec, 0.55));
  nose.name = "nose-direction";
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -length * 0.58;
  group.add(nose);
}

function addDroneProxy(group: Group, metadata: VehiclePreviewMetadata): void {
  const width = Math.max(metadata.bounds.x, 1.2);
  const height = Math.max(metadata.bounds.y, 0.5);
  addBox(group, "drone-body", [width * 0.42, height * 0.45, width * 0.42], new Vector3(0, 0, 0), 0x6b7c85);
  addBox(group, "drone-arm-x", [width * 1.15, height * 0.08, width * 0.08], new Vector3(0, 0, 0), 0x9cafb7);
  addBox(group, "drone-arm-z", [width * 0.08, height * 0.08, width * 1.15], new Vector3(0, 0, 0), 0x9cafb7);
  const rotorMaterial = new MeshBasicMaterial({ color: 0xcbe8ee, transparent: true, opacity: 0.42 });
  const rotorGeometry = new CircleGeometry(width * 0.18, 22);
  for (const x of [-width * 0.48, width * 0.48]) {
    for (const z of [-width * 0.48, width * 0.48]) {
      const rotor = new Mesh(rotorGeometry, rotorMaterial);
      rotor.name = "rotor-disc";
      rotor.rotation.x = -Math.PI / 2;
      rotor.position.set(x, height * 0.08, z);
      group.add(rotor);
    }
  }
}

function addHelicopterProxy(group: Group, metadata: VehiclePreviewMetadata): void {
  const width = metadata.bounds.x;
  const height = metadata.bounds.y;
  const length = metadata.bounds.z;
  addBox(group, "heli-body", [Math.max(width * 0.24, 1.8), Math.max(height * 0.38, 1), Math.max(length * 0.33, 2.8)], new Vector3(0, 0, -length * 0.08), 0x74848b);
  addBox(group, "heli-tail", [Math.max(width * 0.09, 0.55), Math.max(height * 0.12, 0.32), length * 0.5], new Vector3(0, height * 0.08, length * 0.28), 0x8ca3ad);
  addBox(group, "heli-tail-rotor", [width * 0.24, Math.max(height * 0.06, 0.16), Math.max(length * 0.04, 0.2)], new Vector3(0, height * 0.16, length * 0.55), 0xcbe8ee);
  addBox(group, "heli-main-rotor-a", [width * 0.9, Math.max(height * 0.035, 0.12), Math.max(length * 0.035, 0.12)], new Vector3(0, height * 0.46, -length * 0.09), 0xcbe8ee);
  addBox(group, "heli-main-rotor-b", [Math.max(width * 0.035, 0.12), Math.max(height * 0.035, 0.12), length * 0.55], new Vector3(0, height * 0.46, -length * 0.09), 0xcbe8ee);
  const nose = new Mesh(new ConeGeometry(Math.max(width * 0.08, 0.4), Math.max(length * 0.12, 0.8), 18), standard(0xdfe9ec, 0.55));
  nose.name = "heli-nose-direction";
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -length * 0.33;
  group.add(nose);
}

export function createVehicleProxy(metadata: VehiclePreviewMetadata, options: { showBounds?: boolean } = {}): Group {
  const group = new Group();
  group.name = `vehicle-proxy:${metadata.vehicle}`;
  const proxy = metadata.proxy ?? (metadata.vehicle === "drone" ? "drone" : metadata.vehicle === "attack_heli" ? "helicopter" : "plane");
  if (proxy === "drone") {
    addDroneProxy(group, metadata);
  } else if (proxy === "helicopter") {
    addHelicopterProxy(group, metadata);
  } else {
    addPlaneProxy(group, metadata);
  }
  addHardpointMarkers(group, metadata);
  if (options.showBounds) {
    addBounds(group);
  }
  return group;
}

export async function loadVehiclePreview(
  metadata: VehiclePreviewMetadata,
  assetBase: string,
): Promise<{ object: Object3D; usedFallback: boolean; resolvedUrl: string }> {
  const resolvedUrl = resolvePreviewAssetUrl(metadata.modelUrl, assetBase);
  if (!resolvedUrl) {
    return { object: createVehicleProxy(metadata), usedFallback: true, resolvedUrl };
  }

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(resolvedUrl);
    const group = new Group();
    group.name = `vehicle-glb:${metadata.vehicle}`;
    centerLoadedScene(gltf.scene);
    group.add(gltf.scene);
    group.scale.setScalar(metadata.scale || 1);
    group.rotation.set(
      (metadata.rotationCorrection.x * Math.PI) / 180,
      (metadata.rotationCorrection.y * Math.PI) / 180,
      (metadata.rotationCorrection.z * Math.PI) / 180,
    );
    alignVisualOrigin(group, metadata.visualOriginY);
    const correction = unityPositionToThreeVector(metadata.positionCorrection);
    group.position.add(correction);
    return { object: group, usedFallback: false, resolvedUrl };
  } catch {
    return { object: createVehicleProxy(metadata), usedFallback: true, resolvedUrl };
  }
}
