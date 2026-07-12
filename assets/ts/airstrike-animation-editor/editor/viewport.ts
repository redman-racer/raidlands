import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  GridHelper,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  CylinderGeometry,
  TextureLoader,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { evaluateSourcePose } from "../math";
import type { EditorSourceProfile, VehiclePreviewMetadataFile } from "../types";
import { applyRaidlandsEnvironment } from "../../shared/three-environment";
import { threeVectorToUnityPosition, unityPositionToThreeVector, unityQuaternionValueToThreeQuaternion } from "./coordinates";
import { getReleasePreviewEvents, type ReleasePreviewEvent } from "./release-source";
import { createVehicleProxy, loadVehiclePreview, metadataForVehicle } from "./vehicle-preview";
import { dynamicControlScale, frameBounds, routeBounds } from "./viewport-framing";

type ViewportStatus = {
  vehicle: string;
  prefabLabel: string;
  modelState: string;
};

export interface WorldReference {
  seed: number;
  worldSize: number;
  mapName: string;
  mapImageUrl?: string;
  terrainUrl?: string;
  heightmapUrl?: string;
  skyboxUrl?: string;
  terrain?: TerrainReferencePayload;
}

export interface TerrainReferencePayload {
  resolution: number;
  worldSize: number;
  seed: number;
  waterLevel: number;
  minHeight: number;
  maxHeight: number;
  heights: number[];
  colors?: string[];
  monuments?: MonumentReferencePayload[];
}

export interface MonumentReferencePayload {
  name: string;
  prefab: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  rotationY: number;
}

export type ReleaseVisibilityMode = "all" | "near" | "current" | "selected";
export type ViewOrientation = "iso" | "top" | "bottom" | "front" | "back" | "left" | "right";
export interface ViewOrientationState {
  current: Exclude<ViewOrientation, "iso">;
  yawDegrees: number;
  pitchDegrees: number;
}

export interface AirstrikeViewportOptions {
  assetBase: string;
  metadata: VehiclePreviewMetadataFile | null;
  onSelectWaypoint: (waypointId: string) => void;
  onWaypointMoved: (waypointId: string, position: Vector3) => EditorSourceProfile | null;
  onSelectRelease?: (releaseId: string) => void;
  onVehicleStatus?: (status: ViewportStatus) => void;
  onViewOrientation?: (state: ViewOrientationState) => void;
}

const handleMaterial = new MeshStandardMaterial({ color: 0x36c5e6, metalness: 0.1, roughness: 0.45 });
const selectedHandleMaterial = new MeshStandardMaterial({ color: 0xffd166, metalness: 0.05, roughness: 0.35 });
const targetMaterial = new MeshBasicMaterial({ color: 0xff5f57, side: DoubleSide, transparent: true, opacity: 0.72 });
const releaseMaterial = new MeshStandardMaterial({ color: 0xf97316, emissive: 0x2b1203, roughness: 0.38 });
const selectedReleaseMaterial = new MeshStandardMaterial({ color: 0xffd166, emissive: 0x322000, roughness: 0.28 });
const releaseTargetMaterial = new MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.75 });
const releaseLineMaterial = new LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.68 });
const groundMaterial = new MeshBasicMaterial({ color: 0x0c1518, side: DoubleSide, transparent: true, opacity: 0.22 });
const scaleReferenceMaterials = {
  player: new MeshStandardMaterial({ color: 0x8fd3ff, metalness: 0.02, roughness: 0.68 }),
  playerAccent: new MeshStandardMaterial({ color: 0xffd166, metalness: 0.02, roughness: 0.55 }),
  crate: new MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0.08, roughness: 0.82 }),
  barricade: new MeshStandardMaterial({ color: 0xa75b3d, metalness: 0.18, roughness: 0.72 }),
  tower: new MeshStandardMaterial({ color: 0x58666c, metalness: 0.22, roughness: 0.62 }),
  dirt: new MeshStandardMaterial({ color: 0x5b4633, metalness: 0.02, roughness: 0.92 }),
  grass: new MeshStandardMaterial({ color: 0x24432f, metalness: 0.01, roughness: 0.95 }),
  pine: new MeshStandardMaterial({ color: 0x1f5a3d, metalness: 0.01, roughness: 0.86 }),
  trunk: new MeshStandardMaterial({ color: 0x5f3f2b, metalness: 0.02, roughness: 0.84 }),
  rock: new MeshStandardMaterial({ color: 0x5e6a68, metalness: 0.06, roughness: 0.78 }),
};
const minimumFloorSize = 800;
const maximumFloorDivisions = 120;
const preferredGridCellSize = 20;
const terrainMinimumPatchSize = 800;
const terrainPatchPadding = 1.45;
const isoViewDirections = [
  new Vector3(0.52, 0.46, 0.72),
  new Vector3(-0.52, 0.46, 0.72),
  new Vector3(-0.52, 0.46, -0.72),
  new Vector3(0.52, 0.46, -0.72),
];

export class AirstrikeViewport {
  private readonly container: HTMLElement;
  private readonly options: AirstrikeViewportOptions;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(48, 1, 0.1, 5000);
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly orbit: OrbitControls;
  private readonly transform: TransformControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly waypointGroup = new Group();
  private readonly releaseGroup = new Group();
  private readonly vehicleRoot = new Group();
  private readonly scaleReferenceGroup = new Group();
  private readonly terrainReferenceGroup = new Group();
  private readonly sceneExtrasGroup = new Group();
  private readonly monumentReferenceGroup = new Group();
  private readonly routeMaterial = new LineBasicMaterial({ color: 0x55d6ff, linewidth: 2 });
  private readonly handleGeometry = new SphereGeometry(3.2, 20, 12);
  private readonly releaseGeometry = new SphereGeometry(2.5, 18, 10);
  private readonly releaseTargetGeometry = new ConeGeometry(2.8, 7, 18);
  private readonly handles = new Map<string, Mesh>();
  private readonly releaseMarkers = new Map<string, Mesh>();
  private grid: GridHelper | null = null;
  private ground: Mesh | null = null;
  private routeLine: Line | null = null;
  private targetMarker: Mesh | null = null;
  private approachMarker: Mesh | null = null;
  private profile: EditorSourceProfile | null = null;
  private selectedWaypointId = "";
  private selectedReleaseId = "";
  private releaseVisibilityMode: ReleaseVisibilityMode = "near";
  private scrubTime = 0;
  private playbackActive = false;
  private animationFrame = 0;
  private vehicleToken = 0;
  private currentVehicle = "";
  private currentOrientationKey = "";
  private followVehicle = false;
  private rideVehicle = false;
  private rideYawDegrees = 0;
  private ridePitchDegrees = 0;
  private ridePointerId = -1;
  private isoViewIndex = -1;
  private worldReference: WorldReference = { seed: 1337, worldSize: 4500, mapName: "Procedural preview" };
  private sceneExtrasEnabled = true;
  private terrainReferenceEnabled = true;
  private groundGridEnabled = true;
  private terrainMaterial: MeshStandardMaterial | null = null;
  private readonly ridePointerStart = new Vector2();
  private ridePointerStartYaw = 0;
  private ridePointerStartPitch = 0;
  private readonly onResize = () => this.resize();
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onRidePointerMove = (event: PointerEvent) => this.handleRidePointerMove(event);
  private readonly onRidePointerEnd = (event: PointerEvent) => this.handleRidePointerEnd(event);

  public constructor(container: HTMLElement, options: AirstrikeViewportOptions) {
    this.container = container;
    this.options = options;
    this.camera.position.set(180, 120, 250);
    this.camera.lookAt(0, 55, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    applyRaidlandsEnvironment(this.scene, this.renderer, {
      preset: "terrain",
      exposure: 1.05,
      backgroundIntensity: 0.95,
      environmentIntensity: 0.92,
    });
    this.renderer.domElement.dataset.airstrikeViewportCanvas = "true";
    this.container.appendChild(this.renderer.domElement);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 55, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    (this.orbit as OrbitControls & { zoomToCursor?: boolean }).zoomToCursor = true;

    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setMode("translate");
    this.transform.setSpace("world");
    this.transform.addEventListener("dragging-changed", (event) => {
      this.syncInteractiveControls(Boolean(event.value));
    });
    this.transform.addEventListener("objectChange", () => this.handleTransformObjectChange());

    this.scene.add(this.waypointGroup);
    this.scene.add(this.releaseGroup);
    this.scene.add(this.vehicleRoot);
    this.scene.add(this.scaleReferenceGroup);
    this.scene.add(this.transform);
    this.setupSceneChrome();
    this.container.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.onResize);
    this.resize();
    this.animate();
  }

  public updateMetadata(metadata: VehiclePreviewMetadataFile | null): void {
    this.options.metadata = metadata;
    if (this.profile) {
      this.loadVehicleForProfile(this.profile);
    }
  }

  public updateWorldReference(reference: Partial<WorldReference>): void {
    const seed = Number(reference.seed);
    const worldSize = Number(reference.worldSize);
    this.worldReference = {
      seed: Number.isFinite(seed) && seed > 0 ? seed : this.worldReference.seed,
      worldSize: Number.isFinite(worldSize) && worldSize > 0 ? worldSize : this.worldReference.worldSize,
      mapName: String(reference.mapName || this.worldReference.mapName || "Procedural preview"),
      mapImageUrl: reference.mapImageUrl || this.worldReference.mapImageUrl,
      terrainUrl: reference.terrainUrl || this.worldReference.terrainUrl,
      heightmapUrl: reference.heightmapUrl || this.worldReference.heightmapUrl,
      skyboxUrl: reference.skyboxUrl || this.worldReference.skyboxUrl,
      terrain: reference.terrain || this.worldReference.terrain,
    };
    if (reference.skyboxUrl) {
      applyRaidlandsEnvironment(this.scene, this.renderer, {
        preset: "terrain",
        exposure: 1.05,
        backgroundIntensity: 0.95,
        environmentIntensity: 0.92,
        skyboxUrl: reference.skyboxUrl,
      });
    }
    this.syncSceneFloor();
    this.syncSceneChromeMarkers();
    this.createScaleReferenceEntities();
  }

  public setSceneExtrasEnabled(enabled: boolean): void {
    if (this.sceneExtrasEnabled === enabled) {
      return;
    }
    this.sceneExtrasEnabled = enabled;
    this.createScaleReferenceEntities();
  }

  public setTerrainReferenceEnabled(enabled: boolean): void {
    if (this.terrainReferenceEnabled === enabled) {
      return;
    }
    this.terrainReferenceEnabled = enabled;
    this.syncSceneFloor();
    this.syncSceneChromeMarkers();
    this.createScaleReferenceEntities();
  }

  public setGroundGridEnabled(enabled: boolean): void {
    if (this.groundGridEnabled === enabled) {
      return;
    }
    this.groundGridEnabled = enabled;
    this.syncSceneFloor();
  }

  public updateProfile(profile: EditorSourceProfile, selectedWaypointId: string, scrubTime = this.scrubTime): void {
    this.profile = profile;
    this.selectedWaypointId = selectedWaypointId;
    this.scrubTime = Math.min(profile.DurationSeconds, Math.max(0, scrubTime));
    this.refreshRoute();
    this.syncSceneFloor();
    this.refreshWaypointHandles();
    this.refreshReleaseMarkers();
    this.selectWaypoint(selectedWaypointId, false);
    this.loadVehicleForProfile(profile);
    this.refreshVehiclePose();
    this.createScaleReferenceEntities();
    this.syncSceneChromeMarkers();
    this.applyDynamicControls();
  }

  public updateSelectedWaypoint(waypointId: string): void {
    this.selectedWaypointId = waypointId;
    this.selectWaypoint(waypointId, false);
  }

  public updateSelectedRelease(releaseId: string): void {
    this.selectedReleaseId = releaseId;
    this.selectRelease(releaseId, false);
    this.updateReleaseVisibility();
  }

  public updateTime(time: number): void {
    this.scrubTime = time;
    this.refreshVehiclePose();
    this.updateReleaseVisibility();
  }

  public setPlaybackActive(active: boolean): void {
    this.playbackActive = active;
  }

  public updateReleaseVisibilityMode(mode: ReleaseVisibilityMode): void {
    this.releaseVisibilityMode = mode;
    this.updateReleaseVisibility();
  }

  public frameRoute(): void {
    if (!this.profile) {
      return;
    }
    this.frameBox(routeBounds(this.profile));
  }

  public frameVehicle(): void {
    if (this.vehicleRoot.children.length === 0) {
      this.frameRoute();
      return;
    }
    const bounds = new Box3().setFromObject(this.vehicleRoot);
    if (bounds.isEmpty()) {
      this.frameRoute();
      return;
    }
    this.frameBox(bounds);
  }

  public setVehicleFollowEnabled(enabled: boolean): void {
    this.followVehicle = enabled;
    if (enabled) {
      this.rideVehicle = false;
    }
    this.syncInteractiveControls();
    if (enabled) {
      this.followVehicleCamera(true);
    }
  }

  public setVehicleRideEnabled(enabled: boolean): void {
    this.rideVehicle = enabled;
    if (enabled) {
      this.followVehicle = false;
      this.rideYawDegrees = 0;
      this.ridePitchDegrees = 0;
      this.rideVehicleCamera();
    } else {
      this.endRidePointerDrag();
    }
    this.syncInteractiveControls();
  }

  public frameTarget(): void {
    const targetBounds = new Box3().setFromCenterAndSize(new Vector3(0, 20, 0), new Vector3(80, 80, 80));
    this.frameBox(targetBounds);
  }

  public setOrientation(orientation: ViewOrientation): void {
    const directions: Record<ViewOrientation, Vector3> = {
      iso: isoViewDirections[0]!.clone(),
      top: new Vector3(0, 1, 0.001),
      bottom: new Vector3(0, -1, 0.001),
      front: new Vector3(0, 0.12, 1),
      back: new Vector3(0, 0.12, -1),
      left: new Vector3(-1, 0.12, 0),
      right: new Vector3(1, 0.12, 0),
    };
    if (orientation === "iso") {
      this.isoViewIndex = (this.isoViewIndex + 1) % isoViewDirections.length;
      this.snapCameraToDirection(isoViewDirections[this.isoViewIndex]!.clone(), orientation);
      return;
    }
    this.snapCameraToDirection(directions[orientation] ?? directions.iso, orientation);
  }

  public dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onRidePointerMove);
    window.removeEventListener("pointerup", this.onRidePointerEnd);
    window.removeEventListener("pointercancel", this.onRidePointerEnd);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.orbit.dispose();
    this.transform.dispose();
    this.renderer.dispose();
  }

  private setupSceneChrome(): void {
    const ambient = new AmbientLight(0xfff4df, 0.36);
    const key = new DirectionalLight(0xfff1d6, 1.34);
    key.position.set(90, 180, 120);
    const rim = new DirectionalLight(0x9fd8ff, 0.42);
    rim.position.set(-120, 90, -160);
    this.scene.add(ambient, key, rim);

    this.syncSceneFloor();

    const target = new Mesh(new ConeGeometry(6, 18, 24), targetMaterial);
    target.name = "target-marker";
    this.targetMarker = target;
    this.scene.add(target);

    const approach = new Mesh(new ConeGeometry(5, 18, 20), new MeshBasicMaterial({ color: 0x89f7fe }));
    approach.name = "approach-direction";
    approach.rotation.x = -Math.PI / 2;
    this.approachMarker = approach;
    this.scene.add(approach);
    this.syncSceneChromeMarkers();

    this.createScaleReferenceEntities();
  }

  private syncSceneChromeMarkers(): void {
    this.placeSceneMarkerOnGround(this.targetMarker, 0, 0, 9);
    this.placeSceneMarkerOnGround(this.approachMarker, 0, 90, 10);
  }

  private placeSceneMarkerOnGround(marker: Mesh | null, worldX: number, worldZ: number, verticalOffset: number): void {
    if (!marker) {
      return;
    }
    const groundHeight =
      this.worldReference.terrain && this.terrainReferenceEnabled ? this.currentGroundHeightAt(worldX, worldZ) : 0;
    marker.position.set(worldX, groundHeight + verticalOffset, worldZ);
  }

  private createScaleReferenceEntities(): void {
    this.scaleReferenceGroup.name = "scale-reference-placeholders";
    this.scaleReferenceGroup.clear();
    this.terrainReferenceGroup.clear();
    this.monumentReferenceGroup.clear();
    this.sceneExtrasGroup.clear();
    this.terrainReferenceGroup.name = "map-terrain-reference";
    this.monumentReferenceGroup.name = "monument-reference-primitives";
    this.sceneExtrasGroup.name = "scene-extra-placeholders";

    if (this.terrainReferenceEnabled) {
      this.terrainReferenceGroup.add(this.createTerrainReferenceGroup());
      this.scaleReferenceGroup.add(this.terrainReferenceGroup);
      this.addMonumentReferencePrimitives();
      this.scaleReferenceGroup.add(this.monumentReferenceGroup);
    }

    if (!this.sceneExtrasEnabled) {
      return;
    }

    const standingPlayer = this.createPlayerPlaceholder("scale-player-standing", scaleReferenceMaterials.player);
    this.placeOnGround(standingPlayer, -26, 18);
    standingPlayer.rotation.y = MathUtils.degToRad(18);
    this.sceneExtrasGroup.add(standingPlayer);

    const secondPlayer = this.createPlayerPlaceholder("scale-player-near-crates", scaleReferenceMaterials.playerAccent);
    this.placeOnGround(secondPlayer, 40, -34);
    secondPlayer.rotation.y = MathUtils.degToRad(-32);
    this.sceneExtrasGroup.add(secondPlayer);

    const crateStack = new Group();
    crateStack.name = "scale-crate-stack";
    const crateGeometry = new BoxGeometry(1.6, 1.6, 1.6);
    const crateOffsets = [
      new Vector3(0, 0.8, 0),
      new Vector3(1.75, 0.8, 0),
      new Vector3(0.88, 2.45, 0),
    ];
    for (const offset of crateOffsets) {
      const crate = new Mesh(crateGeometry, scaleReferenceMaterials.crate);
      crate.position.copy(offset);
      crateStack.add(crate);
    }
    this.placeOnGround(crateStack, 18, 38);
    crateStack.rotation.y = MathUtils.degToRad(-16);
    this.sceneExtrasGroup.add(crateStack);

    const barricade = new Group();
    barricade.name = "scale-barricade-line";
    const barricadeGeometry = new BoxGeometry(3.4, 1.15, 0.55);
    for (let index = 0; index < 3; index += 1) {
      const block = new Mesh(barricadeGeometry, scaleReferenceMaterials.barricade);
      block.position.set(index * 3.6, 0.58, Math.sin(index) * 0.35);
      block.rotation.y = MathUtils.degToRad(index === 1 ? 8 : -5);
      barricade.add(block);
    }
    this.placeOnGround(barricade, -58, -40);
    barricade.rotation.y = MathUtils.degToRad(24);
    this.sceneExtrasGroup.add(barricade);

    const tower = this.createTowerPlaceholder();
    this.placeOnGround(tower, 68, 42);
    tower.rotation.y = MathUtils.degToRad(-28);
    this.sceneExtrasGroup.add(tower);
    this.scaleReferenceGroup.add(this.sceneExtrasGroup);
  }

  private addMonumentReferencePrimitives(): void {
    const monuments = this.worldReference.terrain?.monuments || [];
    if (monuments.length === 0) {
      return;
    }

    monuments.forEach((monument) => {
      const group = createMonumentPrimitive(monument);
      const position = unityPositionToThreeVector({ x: monument.x, y: monument.y, z: monument.z });
      const terrainHeight = this.currentGroundHeightAt(position.x, position.z);
      group.position.set(position.x, Math.max(position.y, terrainHeight) + 5, position.z);
      group.rotation.y = -MathUtils.degToRad(monument.rotationY || 0);
      this.monumentReferenceGroup.add(group);
    });
  }

  private createTerrainReferenceGroup(): Group {
    if (this.worldReference.terrain) {
      return this.createHeightmapTerrainReferenceGroup(this.worldReference.terrain);
    }

    const terrain = new Group();
    terrain.name = "procedural-terrain-reference";

    const seed = this.worldReference.seed || 1337;
    const patch = this.currentTerrainPatch();
    const terrainSize = patch.size;
    const terrainSegments = 48;
    const terrainGeometry = new PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const positions = terrainGeometry.getAttribute("position") as Float32BufferAttribute;

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index) + patch.center.x;
      const z = positions.getY(index) + patch.center.z;
      positions.setZ(index, this.proceduralTerrainHeight(x, z, seed));
    }
    positions.needsUpdate = true;
    terrainGeometry.computeVertexNormals();

    const terrainMesh = new Mesh(terrainGeometry, scaleReferenceMaterials.grass);
    terrainMesh.name = "procedural-terrain-preview";
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.position.set(patch.center.x, 0, patch.center.z);
    terrain.add(terrainMesh);

    const road = this.createProceduralRoad(seed, terrainSize);
    terrain.add(road);

    const random = this.seededRandom(seed ^ 0xa517);
    for (let index = 0; index < 34; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = patch.center.x + (random() - 0.5) * terrainSize * 0.85;
      const z = patch.center.z + side * (terrainSize * (0.26 + random() * 0.2));
      const height = this.proceduralTerrainHeight(x, z, seed);
      const tree = this.createTreePlaceholder(`scale-tree-${index + 1}`, 0.55 + random() * 0.85);
      tree.position.set(x, height, z);
      tree.rotation.y = MathUtils.degToRad(random() * 360);
      terrain.add(tree);
    }

    const moundGeometry = new ConeGeometry(1, 1, 18);
    for (let index = 0; index < 5; index += 1) {
      const x = patch.center.x + (random() - 0.5) * terrainSize * 0.72;
      const z = patch.center.z + (random() - 0.5) * terrainSize * 0.72;
      const mesh = new Mesh(moundGeometry, scaleReferenceMaterials.grass);
      mesh.name = "scale-terrain-mound";
      mesh.position.set(x, this.proceduralTerrainHeight(x, z, seed) + 1.4, z);
      mesh.scale.set(18 + random() * 26, 2.8 + random() * 4, 14 + random() * 22);
      mesh.rotation.y = MathUtils.degToRad(random() * 360);
      terrain.add(mesh);
    }

    const rockGeometry = new BoxGeometry(6, 3, 4);
    for (let index = 0; index < 12; index += 1) {
      const x = patch.center.x + (random() - 0.5) * terrainSize * 0.8;
      const z = patch.center.z + (random() - 0.5) * terrainSize * 0.8;
      const mesh = new Mesh(rockGeometry, scaleReferenceMaterials.rock);
      mesh.name = "scale-rock";
      mesh.position.set(x, this.proceduralTerrainHeight(x, z, seed) + 1.2, z);
      mesh.scale.set(0.55 + random() * 1.25, 0.45 + random() * 0.6, 0.55 + random() * 1.3);
      mesh.rotation.set(MathUtils.degToRad(random() * 12), MathUtils.degToRad(random() * 360), MathUtils.degToRad(random() * -12));
      terrain.add(mesh);
    }

    const scrubGeometry = new ConeGeometry(4.5, 4, 8);
    for (let index = 0; index < 18; index += 1) {
      const x = patch.center.x + (random() - 0.5) * terrainSize * 0.72;
      const z = patch.center.z + (random() - 0.5) * terrainSize * 0.72;
      const scrub = new Mesh(scrubGeometry, scaleReferenceMaterials.grass);
      scrub.name = "scale-scrub";
      scrub.position.set(x, this.proceduralTerrainHeight(x, z, seed) + 1.8, z);
      scrub.scale.setScalar(0.55 + random() * 0.7);
      scrub.rotation.y = MathUtils.degToRad(random() * 360);
      terrain.add(scrub);
    }

    return terrain;
  }

  private createHeightmapTerrainReferenceGroup(terrainPayload: TerrainReferencePayload): Group {
    const terrain = new Group();
    terrain.name = "heightmap-terrain-reference";

    const mesh = this.createHeightmapTerrainMesh(terrainPayload);
    terrain.add(mesh);

    if (this.worldReference.mapImageUrl) {
      this.loadTerrainTexture(this.worldReference.mapImageUrl);
    }

    return terrain;
  }

  private createHeightmapTerrainMesh(terrainPayload: TerrainReferencePayload): Mesh {
    const resolution = Math.max(2, Math.min(terrainPayload.resolution, 129));
    const worldSize = Math.max(100, terrainPayload.worldSize || this.worldReference.worldSize || 4500);
    const patch = this.currentTerrainPatch(worldSize);
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let row = 0; row < resolution; row += 1) {
      const v = row / (resolution - 1);
      const localZ = patch.center.z + patch.size * 0.5 - v * patch.size;
      for (let col = 0; col < resolution; col += 1) {
        const u = col / (resolution - 1);
        const localX = patch.center.x - patch.size * 0.5 + u * patch.size;
        const height = this.sampleTerrainHeight(terrainPayload, localX, localZ);
        positions.push(localX, height, localZ);
        const textureUv = this.terrainTextureUv(terrainPayload, localX, localZ);
        uvs.push(textureUv.x, textureUv.y);
        this.pushTerrainColor(colors, this.sampleTerrainColor(terrainPayload, localX, localZ), height, terrainPayload);
      }
    }

    for (let row = 0; row < resolution - 1; row += 1) {
      for (let col = 0; col < resolution - 1; col += 1) {
        const a = row * resolution + col;
        const b = a + 1;
        const c = a + resolution;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.setIndex(new Uint32BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    this.terrainMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
    });

    const mesh = new Mesh(geometry, this.terrainMaterial);
    mesh.name = "current-rust-map-heightmap-ground";
    return mesh;
  }

  private currentTerrainPatch(worldSize = this.worldReference.worldSize || 4500): { center: Vector3; size: number } {
    const bounds = this.currentFocusBounds();
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const routeFootprint = Math.max(size.x, size.z, terrainMinimumPatchSize);
    const patchSize = MathUtils.clamp(routeFootprint * terrainPatchPadding, terrainMinimumPatchSize, worldSize);
    const halfRange = Math.max(0, worldSize * 0.5 - patchSize * 0.5);
    center.x = MathUtils.clamp(Number.isFinite(center.x) ? center.x : 0, -halfRange, halfRange);
    center.y = 0;
    center.z = MathUtils.clamp(Number.isFinite(center.z) ? center.z : 0, -halfRange, halfRange);
    return { center, size: patchSize };
  }

  private sampleTerrainHeight(terrainPayload: TerrainReferencePayload, worldX: number, worldZ: number): number {
    const resolution = terrainPayload.resolution;
    const worldSize = Math.max(100, terrainPayload.worldSize || this.worldReference.worldSize || 4500);
    const half = worldSize / 2;
    const rustPosition = threeVectorToUnityPosition(new Vector3(worldX, 0, worldZ));
    const u = MathUtils.clamp((rustPosition.x + half) / worldSize, 0, 1) * (resolution - 1);
    const v = MathUtils.clamp((half - rustPosition.z) / worldSize, 0, 1) * (resolution - 1);
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    const x1 = Math.min(resolution - 1, x0 + 1);
    const z1 = Math.min(resolution - 1, z0 + 1);
    const tx = u - x0;
    const tz = v - z0;
    const mirroredX0 = resolution - 1 - x0;
    const mirroredX1 = resolution - 1 - x1;
    const a = terrainPayload.heights[z0 * resolution + mirroredX0] || 0;
    const b = terrainPayload.heights[z0 * resolution + mirroredX1] || a;
    const c = terrainPayload.heights[z1 * resolution + mirroredX0] || a;
    const d = terrainPayload.heights[z1 * resolution + mirroredX1] || c;
    return MathUtils.lerp(MathUtils.lerp(a, b, tx), MathUtils.lerp(c, d, tx), tz);
  }

  private currentGroundHeightAt(worldX: number, worldZ: number): number {
    if (this.worldReference.terrain) {
      return this.sampleTerrainHeight(this.worldReference.terrain, worldX, worldZ);
    }
    return this.proceduralTerrainHeight(worldX, worldZ, this.worldReference.seed || 1337);
  }

  private terrainReferenceBaseHeight(terrainPayload: TerrainReferencePayload): number {
    const patch = this.currentTerrainPatch(terrainPayload.worldSize || this.worldReference.worldSize);
    const samplesPerAxis = 17;
    let baseHeight = Number.POSITIVE_INFINITY;

    for (let row = 0; row < samplesPerAxis; row += 1) {
      const z = patch.center.z - patch.size * 0.5 + (patch.size * row) / (samplesPerAxis - 1);
      for (let col = 0; col < samplesPerAxis; col += 1) {
        const x = patch.center.x - patch.size * 0.5 + (patch.size * col) / (samplesPerAxis - 1);
        baseHeight = Math.min(baseHeight, this.sampleTerrainHeight(terrainPayload, x, z));
      }
    }

    return Number.isFinite(baseHeight) ? baseHeight : 0;
  }

  private placeOnGround(object: Object3D, worldX: number, worldZ: number, verticalOffset = 0): void {
    object.position.set(worldX, this.currentGroundHeightAt(worldX, worldZ) + verticalOffset, worldZ);
  }

  private terrainTextureUv(terrainPayload: TerrainReferencePayload, worldX: number, worldZ: number): Vector2 {
    const worldSize = Math.max(100, terrainPayload.worldSize || this.worldReference.worldSize || 4500);
    const half = worldSize / 2;
    const rustPosition = threeVectorToUnityPosition(new Vector3(worldX, 0, worldZ));
    const u = MathUtils.clamp((rustPosition.x + half) / worldSize, 0, 1);
    const v = MathUtils.clamp((half - rustPosition.z) / worldSize, 0, 1);
    return new Vector2(u, 1 - v);
  }

  private sampleTerrainColor(terrainPayload: TerrainReferencePayload, worldX: number, worldZ: number): string | undefined {
    if (!terrainPayload.colors || terrainPayload.colors.length !== terrainPayload.resolution * terrainPayload.resolution) {
      return undefined;
    }
    const resolution = terrainPayload.resolution;
    const worldSize = Math.max(100, terrainPayload.worldSize || this.worldReference.worldSize || 4500);
    const half = worldSize / 2;
    const rustPosition = threeVectorToUnityPosition(new Vector3(worldX, 0, worldZ));
    const sourceCol = Math.round(MathUtils.clamp((rustPosition.x + half) / worldSize, 0, 1) * (resolution - 1));
    const col = resolution - 1 - sourceCol;
    const row = Math.round(MathUtils.clamp((half - rustPosition.z) / worldSize, 0, 1) * (resolution - 1));
    return terrainPayload.colors[row * resolution + col];
  }

  private loadTerrainTexture(url: string): void {
    const material = this.terrainMaterial;
    if (!material) {
      return;
    }
    const loader = new TextureLoader();
    loader.load(
      url,
      (texture) => {
        if (material !== this.terrainMaterial) {
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        material.vertexColors = false;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        // Vertex colors are the primary terrain texturing path; map image texture is optional.
      },
    );
  }

  private pushTerrainColor(target: number[], color: string | undefined, height: number, terrainPayload: TerrainReferencePayload): void {
    const min = Number.isFinite(terrainPayload.minHeight) ? terrainPayload.minHeight || 0 : 0;
    const max = Number.isFinite(terrainPayload.maxHeight) ? terrainPayload.maxHeight || 1 : 1;
    const t = MathUtils.clamp((height - min) / Math.max(1, max - min), 0, 1);

    if (color && /^#[0-9a-f]{6}$/i.test(color)) {
      const parsed = this.balanceTerrainColor(new Color(color), t);
      target.push(parsed.r, parsed.g, parsed.b);
      return;
    }

    const low = new Color(0x3f5537);
    const mid = new Color(0x776d4e);
    const high = new Color(0xdce0da);
    const mixed = t < 0.58
      ? low.lerp(mid, MathUtils.smoothstep(t / 0.58, 0, 1))
      : mid.lerp(high, MathUtils.smoothstep((t - 0.58) / 0.42, 0, 1));
    target.push(mixed.r, mixed.g, mixed.b);
  }

  private balanceTerrainColor(color: Color, heightT: number): Color {
    const balanced = color.clone();
    const greenBias = Math.max(0, balanced.g - Math.max(balanced.r, balanced.b));

    if (greenBias > 0.04) {
      const correction = MathUtils.clamp(greenBias * 0.45, 0, 0.12);
      balanced.g = Math.max(0, balanced.g - correction);
      balanced.r = Math.min(1, balanced.r + correction * 0.55);
      balanced.b = Math.min(1, balanced.b + correction * 0.28);
    }

    if (heightT > 0.68) {
      const snow = new Color(0xe6e8e2);
      balanced.lerp(snow, MathUtils.smoothstep(heightT, 0.68, 0.92) * 0.72);
    } else if (heightT > 0.5) {
      const rock = new Color(0x8b8572);
      balanced.lerp(rock, MathUtils.smoothstep(heightT, 0.5, 0.72) * 0.28);
    }

    return balanced;
  }

  private createProceduralRoad(seed: number, terrainSize: number): Group {
    const road = new Group();
    road.name = "procedural-road-preview";
    const random = this.seededRandom(seed ^ 0x42d3);
    const segmentCount = 7;
    const segmentDepth = terrainSize / segmentCount;
    const roadGeometry = new BoxGeometry(24, 0.22, segmentDepth * 1.12);
    const patch = this.currentTerrainPatch();
    let x = patch.center.x + (random() - 0.5) * terrainSize * 0.28;

    for (let index = 0; index < segmentCount; index += 1) {
      const z = patch.center.z - terrainSize * 0.5 + segmentDepth * (index + 0.5);
      x += (random() - 0.5) * 18;
      const y = this.proceduralTerrainHeight(x, z, seed) + 0.16;
      const segment = new Mesh(roadGeometry, scaleReferenceMaterials.dirt);
      segment.name = "scale-dirt-track";
      segment.position.set(x, y, z);
      segment.rotation.y = MathUtils.degToRad((random() - 0.5) * 18);
      road.add(segment);
    }

    return road;
  }

  private proceduralTerrainHeight(x: number, z: number, seed: number): number {
    const continental = this.valueNoise(x * 0.006, z * 0.006, seed) * 17;
    const hills = this.valueNoise(x * 0.018 + 41, z * 0.018 - 13, seed ^ 0x6d2b) * 7;
    const detail = this.valueNoise(x * 0.052 - 9, z * 0.052 + 71, seed ^ 0xb529) * 1.8;
    const targetFlatten = MathUtils.clamp(1 - Math.sqrt(x * x + z * z) / 68, 0, 1);
    return (continental + hills + detail) * (1 - targetFlatten * 0.68);
  }

  private valueNoise(x: number, z: number, seed: number): number {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = this.smoothstep(x - x0);
    const tz = this.smoothstep(z - z0);
    const a = this.hashNoise(x0, z0, seed);
    const b = this.hashNoise(x0 + 1, z0, seed);
    const c = this.hashNoise(x0, z0 + 1, seed);
    const d = this.hashNoise(x0 + 1, z0 + 1, seed);
    return MathUtils.lerp(MathUtils.lerp(a, b, tx), MathUtils.lerp(c, d, tx), tz) * 2 - 1;
  }

  private hashNoise(x: number, z: number, seed: number): number {
    let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  private smoothstep(value: number): number {
    return value * value * (3 - 2 * value);
  }

  private seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  private createTreePlaceholder(name: string, scale: number): Group {
    const tree = new Group();
    tree.name = name;
    tree.scale.setScalar(scale);

    const trunk = new Mesh(new CylinderGeometry(0.9, 1.15, 9, 8), scaleReferenceMaterials.trunk);
    trunk.position.y = 4.5;
    tree.add(trunk);

    const lowerCanopy = new Mesh(new ConeGeometry(6.2, 11, 10), scaleReferenceMaterials.pine);
    lowerCanopy.position.y = 12;
    tree.add(lowerCanopy);

    const upperCanopy = new Mesh(new ConeGeometry(4.6, 9, 10), scaleReferenceMaterials.pine);
    upperCanopy.position.y = 17.5;
    tree.add(upperCanopy);

    return tree;
  }

  private createPlayerPlaceholder(name: string, material: MeshStandardMaterial): Group {
    const player = new Group();
    player.name = name;

    const body = new Mesh(new CylinderGeometry(0.26, 0.32, 1.05, 12), material);
    body.position.y = 1.03;
    player.add(body);

    const head = new Mesh(new SphereGeometry(0.24, 14, 10), material);
    head.position.y = 1.7;
    player.add(head);

    const legs = new Mesh(new BoxGeometry(0.48, 0.68, 0.28), material);
    legs.position.y = 0.34;
    player.add(legs);

    const sightLine = new Mesh(new BoxGeometry(0.05, 0.05, 1.4), scaleReferenceMaterials.tower);
    sightLine.position.set(0, 1.28, -0.82);
    player.add(sightLine);

    return player;
  }

  private createTowerPlaceholder(): Group {
    const tower = new Group();
    tower.name = "scale-watchtower-placeholder";

    const deck = new Mesh(new BoxGeometry(4.2, 0.45, 4.2), scaleReferenceMaterials.tower);
    deck.position.y = 5.4;
    tower.add(deck);

    const legGeometry = new CylinderGeometry(0.13, 0.16, 5.4, 8);
    for (const x of [-1.65, 1.65]) {
      for (const z of [-1.65, 1.65]) {
        const leg = new Mesh(legGeometry, scaleReferenceMaterials.tower);
        leg.position.set(x, 2.7, z);
        tower.add(leg);
      }
    }

    const roof = new Mesh(new ConeGeometry(3.15, 1.45, 4), scaleReferenceMaterials.barricade);
    roof.position.y = 6.55;
    roof.rotation.y = MathUtils.degToRad(45);
    tower.add(roof);

    return tower;
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate(): void {
    this.animationFrame = window.requestAnimationFrame(() => this.animate());
    this.applyDynamicControls();
    this.orbit.update();
    this.syncVehicleCameraMode();
    this.emitViewOrientation();
    this.renderer.render(this.scene, this.camera);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !this.profile) {
      return;
    }
    if (this.rideVehicle) {
      this.startRidePointerDrag(event);
      return;
    }
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects([...this.handles.values()], false);
    const hit = intersections[0]?.object as Mesh | undefined;
    const waypointId = typeof hit?.userData?.waypointId === "string" ? hit.userData.waypointId : "";
    if (waypointId) {
      this.selectWaypoint(waypointId, true);
      return;
    }
    const releaseIntersections = this.raycaster.intersectObjects([...this.releaseMarkers.values()], false);
    const releaseHit = releaseIntersections[0]?.object as Mesh | undefined;
    const releaseId = typeof releaseHit?.userData?.releaseId === "string" ? releaseHit.userData.releaseId : "";
    if (releaseId) {
      this.selectRelease(releaseId, true);
    }
  }

  private handleTransformObjectChange(): void {
    const object = this.transform.object as Mesh | undefined;
    if (!object || !this.profile) {
      return;
    }
    const waypointId = typeof object.userData?.waypointId === "string" ? object.userData.waypointId : "";
    if (!waypointId) {
      return;
    }
    const nextProfile = this.options.onWaypointMoved(waypointId, object.position.clone());
    if (nextProfile) {
      this.profile = nextProfile;
      this.refreshRoute();
      this.syncSceneFloor();
      this.refreshReleaseMarkers();
      this.refreshVehiclePose();
    }
  }

  private selectWaypoint(waypointId: string, notify: boolean): void {
    this.selectedWaypointId = waypointId;
    for (const [id, mesh] of this.handles) {
      mesh.material = id === waypointId ? selectedHandleMaterial : handleMaterial;
    }
    const selected = this.handles.get(waypointId);
    if (selected) {
      this.transform.attach(selected);
    } else {
      this.transform.detach();
    }
    if (notify) {
      this.options.onSelectWaypoint(waypointId);
    }
  }

  private selectRelease(releaseId: string, notify: boolean): void {
    this.selectedReleaseId = releaseId;
    for (const [id, mesh] of this.releaseMarkers) {
      mesh.material = id === releaseId ? selectedReleaseMaterial : releaseMaterial;
    }
    if (notify) {
      this.options.onSelectRelease?.(releaseId);
    }
  }

  private refreshWaypointHandles(): void {
    this.transform.detach();
    this.waypointGroup.clear();
    this.handles.clear();
    if (!this.profile) {
      return;
    }
    for (const waypoint of this.profile.Waypoints) {
      const mesh = new Mesh(this.handleGeometry, waypoint.Id === this.selectedWaypointId ? selectedHandleMaterial : handleMaterial);
      mesh.name = `waypoint:${waypoint.Id}`;
      mesh.userData.waypointId = waypoint.Id;
      mesh.position.copy(unityPositionToThreeVector({ x: waypoint.X, y: waypoint.Y, z: waypoint.Z }));
      this.waypointGroup.add(mesh);
      this.handles.set(waypoint.Id, mesh);
    }
  }

  private refreshReleaseMarkers(): void {
    this.releaseGroup.clear();
    this.releaseMarkers.clear();
    if (!this.profile || this.profile.Waypoints.length < 2) {
      return;
    }
    const releases = getReleasePreviewEvents(this.profile, this.options.metadata);
    for (const release of releases) {
      const points = this.releasePoints(release);
      const marker = new Mesh(
        this.releaseGeometry,
        release.id === this.selectedReleaseId ? selectedReleaseMaterial : releaseMaterial,
      );
      marker.name = `release:${release.id}`;
      marker.userData.releaseId = release.id;
      marker.userData.releaseTime = release.time;
      marker.position.copy(points.origin);
      this.releaseGroup.add(marker);
      this.releaseMarkers.set(release.id, marker);

      const target = new Mesh(this.releaseTargetGeometry, releaseTargetMaterial);
      target.name = `release-target:${release.id}`;
      target.userData.releaseId = release.id;
      target.userData.releaseTime = release.time;
      target.position.copy(points.target);
      target.rotation.x = Math.PI;
      this.releaseGroup.add(target);

      const line = new Line(new BufferGeometry().setFromPoints([points.origin, points.target]), releaseLineMaterial);
      line.name = `release-line:${release.id}`;
      line.userData.releaseId = release.id;
      line.userData.releaseTime = release.time;
      this.releaseGroup.add(line);
    }
    this.updateReleaseVisibility();
  }

  private updateReleaseVisibility(): void {
    const vicinitySeconds = 0.075;
    const currentReleaseTimes = this.currentReleaseSlotTimes();
    for (const child of this.releaseGroup.children) {
      const releaseId = typeof child.userData.releaseId === "string" ? child.userData.releaseId : "";
      const releaseTime = typeof child.userData.releaseTime === "number" ? child.userData.releaseTime : Number.NaN;
      child.visible =
        this.releaseVisibilityMode === "all" ||
        (this.releaseVisibilityMode === "selected" && releaseId === this.selectedReleaseId) ||
        (this.releaseVisibilityMode === "current" && currentReleaseTimes.has(this.releaseTimeKey(releaseTime))) ||
        (this.releaseVisibilityMode === "near" && Math.abs(releaseTime - this.scrubTime) <= vicinitySeconds);
    }
  }

  private currentReleaseSlotTimes(): Set<string> {
    if (this.releaseVisibilityMode !== "current") {
      return new Set();
    }
    const times = [...new Set([...this.releaseMarkers.values()].map((marker) => Number(marker.userData.releaseTime)))]
      .filter((time) => Number.isFinite(time))
      .sort((left, right) => left - right);
    if (times.length === 0) {
      return new Set();
    }
    let closestIndex = 0;
    let closestDistance = Math.abs(times[0]! - this.scrubTime);
    for (let index = 1; index < times.length; index += 1) {
      const distance = Math.abs(times[index]! - this.scrubTime);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    }
    const previousGap = closestIndex > 0 ? times[closestIndex]! - times[closestIndex - 1]! : Number.POSITIVE_INFINITY;
    const nextGap = closestIndex < times.length - 1 ? times[closestIndex + 1]! - times[closestIndex]! : Number.POSITIVE_INFINITY;
    const closestGap = Math.min(previousGap, nextGap);
    const slotWindow = Number.isFinite(closestGap) ? Math.min(0.12, Math.max(0.025, closestGap * 0.5)) : 0.075;
    return closestDistance <= slotWindow ? new Set([this.releaseTimeKey(times[closestIndex]!)]) : new Set();
  }

  private releaseTimeKey(time: number): string {
    return Number.isFinite(time) ? time.toFixed(3) : "";
  }

  private releasePoints(release: ReleasePreviewEvent): { origin: Vector3; target: Vector3 } {
    if (!this.profile) {
      return { origin: new Vector3(), target: new Vector3() };
    }
    const pose = evaluateSourcePose(this.profile, release.time);
    const origin = unityPositionToThreeVector(pose.position);
    const vehicleRotation = unityQuaternionValueToThreeQuaternion(pose.rotation);
    const carrierOffset = unityPositionToThreeVector({
      x: release.fields.CarrierOffsetX,
      y: release.fields.CarrierOffsetY,
      z: release.fields.CarrierOffsetZ,
    });
    carrierOffset.applyQuaternion(vehicleRotation);
    origin.add(carrierOffset);
    const target = unityPositionToThreeVector({
      x: release.fields.TargetOffsetX,
      y: release.fields.TargetOffsetY,
      z: release.fields.TargetOffsetZ,
    });
    return { origin, target };
  }

  private refreshRoute(): void {
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine = null;
    }
    if (!this.profile || this.profile.Waypoints.length < 2) {
      return;
    }
    const samples = Math.max(24, Math.min(180, Math.ceil(this.profile.DurationSeconds * 12)));
    const points: Vector3[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const time = (this.profile.DurationSeconds * index) / samples;
      const pose = evaluateSourcePose(this.profile, time);
      points.push(unityPositionToThreeVector(pose.position));
    }
    const geometry = new BufferGeometry().setFromPoints(points);
    this.routeLine = new Line(geometry, this.routeMaterial);
    this.routeLine.name = "route-preview";
    this.scene.add(this.routeLine);
  }

  private syncSceneFloor(): void {
    const bounds = this.currentFocusBounds();
    const size = new Vector3();
    const center = new Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    const footprint = Math.max(size.x, size.z, minimumFloorSize);
    const floorSize = Math.ceil((footprint * 1.35) / preferredGridCellSize) * preferredGridCellSize;
    const divisions = Math.max(4, Math.min(maximumFloorDivisions, Math.round(floorSize / preferredGridCellSize)));
    const floorCenterX = Number.isFinite(center.x) ? center.x : 0;
    const floorCenterZ = Number.isFinite(center.z) ? center.z : 0;

    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
    }
    if (this.groundGridEnabled) {
      this.grid = new GridHelper(floorSize, divisions, 0x23434a, 0x142a30);
      this.grid.name = "meter-grid";
      this.grid.position.set(floorCenterX, 0, floorCenterZ);
      this.scene.add(this.grid);
    } else {
      this.grid = null;
    }

    if (this.worldReference.terrain && this.terrainReferenceEnabled) {
      if (this.ground) {
        this.scene.remove(this.ground);
        this.ground.geometry.dispose();
        this.ground = null;
      }
      return;
    }

    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
    }
    this.ground = new Mesh(new PlaneGeometry(floorSize, floorSize), groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(floorCenterX, 0, floorCenterZ);
    this.ground.name = "ground-plane";
    this.scene.add(this.ground);
  }

  private frameBox(bounds: Box3): void {
    const target = new Vector3();
    bounds.getCenter(target);
    this.orbit.target.copy(target);
    this.camera.position.copy(frameBounds(this.camera, target, bounds));
    this.camera.lookAt(target);
    this.applyDynamicControls(bounds);
  }

  private syncInteractiveControls(transformDragging = false): void {
    this.orbit.enabled = !transformDragging && !this.rideVehicle;
    this.transform.enabled = !this.rideVehicle;
    if (this.rideVehicle) {
      this.transform.detach();
    } else {
      this.selectWaypoint(this.selectedWaypointId, false);
    }
  }

  private startRidePointerDrag(event: PointerEvent): void {
    event.preventDefault();
    this.ridePointerId = event.pointerId;
    this.ridePointerStart.set(event.clientX, event.clientY);
    this.ridePointerStartYaw = this.rideYawDegrees;
    this.ridePointerStartPitch = this.ridePitchDegrees;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", this.onRidePointerMove);
    window.addEventListener("pointerup", this.onRidePointerEnd);
    window.addEventListener("pointercancel", this.onRidePointerEnd);
  }

  private handleRidePointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.ridePointerId) {
      return;
    }
    const deltaX = event.clientX - this.ridePointerStart.x;
    const deltaY = event.clientY - this.ridePointerStart.y;
    this.rideYawDegrees = this.ridePointerStartYaw - deltaX * 0.16;
    this.ridePitchDegrees = MathUtils.clamp(this.ridePointerStartPitch + deltaY * 0.16, -78, 78);
    this.rideVehicleCamera();
  }

  private handleRidePointerEnd(event: PointerEvent): void {
    if (event.pointerId === this.ridePointerId) {
      this.endRidePointerDrag();
    }
  }

  private endRidePointerDrag(): void {
    if (this.ridePointerId >= 0) {
      if (this.renderer.domElement.hasPointerCapture(this.ridePointerId)) {
        this.renderer.domElement.releasePointerCapture(this.ridePointerId);
      }
    }
    this.ridePointerId = -1;
    window.removeEventListener("pointermove", this.onRidePointerMove);
    window.removeEventListener("pointerup", this.onRidePointerEnd);
    window.removeEventListener("pointercancel", this.onRidePointerEnd);
  }

  private snapCameraToDirection(direction: Vector3, orientation: ViewOrientation): void {
    const target = this.orbit.target.clone();
    const distance = Math.max(this.camera.position.distanceTo(target), 80);
    const normalized = direction.clone().normalize();
    const cameraUp =
      orientation === "top" ? new Vector3(0, 0, -1) : orientation === "bottom" ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
    this.camera.up.copy(cameraUp);
    this.camera.position.copy(target.add(normalized.multiplyScalar(distance)));
    this.camera.lookAt(this.orbit.target);
    this.orbit.update();
    this.applyDynamicControls();
    this.emitViewOrientation(true);
  }

  private emitViewOrientation(force = false): void {
    if (!this.options.onViewOrientation) {
      return;
    }
    const direction = this.camera.position.clone().sub(this.orbit.target).normalize();
    const absolute = {
      x: Math.abs(direction.x),
      y: Math.abs(direction.y),
      z: Math.abs(direction.z),
    };
    let current: ViewOrientationState["current"];
    if (absolute.y >= absolute.x && absolute.y >= absolute.z) {
      current = direction.y >= 0 ? "top" : "bottom";
    } else if (absolute.x >= absolute.z) {
      current = direction.x >= 0 ? "right" : "left";
    } else {
      current = direction.z >= 0 ? "front" : "back";
    }
    const yawDegrees = (Math.atan2(direction.x, direction.z) * 180) / Math.PI;
    const pitchDegrees = (Math.asin(Math.max(-1, Math.min(1, direction.y))) * 180) / Math.PI;
    const key = `${current}:${yawDegrees.toFixed(1)}:${pitchDegrees.toFixed(1)}`;
    if (!force && key === this.currentOrientationKey) {
      return;
    }
    this.currentOrientationKey = key;
    this.options.onViewOrientation({ current, yawDegrees, pitchDegrees });
  }

  private applyDynamicControls(bounds = this.currentFocusBounds()): void {
    const scale = dynamicControlScale(this.camera, this.orbit.target, bounds);
    this.orbit.panSpeed = scale.panSpeed;
    this.orbit.zoomSpeed = scale.zoomSpeed;
    this.orbit.minDistance = scale.minDistance;
    this.orbit.maxDistance = scale.maxDistance;
    this.camera.near = scale.near;
    this.camera.far = scale.far;
    this.camera.updateProjectionMatrix();
  }

  private currentFocusBounds(): Box3 {
    if (this.profile) {
      return routeBounds(this.profile);
    }
    return new Box3().setFromCenterAndSize(new Vector3(0, 55, 0), new Vector3(400, 180, 400));
  }

  private loadVehicleForProfile(profile: EditorSourceProfile): void {
    if (profile.Vehicle === this.currentVehicle && this.vehicleRoot.children.length > 0) {
      return;
    }
    this.currentVehicle = profile.Vehicle;
    const token = ++this.vehicleToken;
    const metadata = metadataForVehicle(this.options.metadata, profile.Vehicle);
    this.setVehicleObject(createVehicleProxy(metadata));
    this.options.onVehicleStatus?.({
      vehicle: metadata.vehicle,
      prefabLabel: metadata.prefabLabel ?? "",
      modelState: "Proxy preview",
    });
    void loadVehiclePreview(metadata, this.options.assetBase).then((result) => {
      if (token !== this.vehicleToken || this.profile?.Vehicle !== profile.Vehicle) {
        return;
      }
      this.setVehicleObject(result.object);
      this.refreshVehiclePose();
      this.options.onVehicleStatus?.({
        vehicle: metadata.vehicle,
        prefabLabel: metadata.prefabLabel ?? "",
        modelState: result.usedFallback ? "Proxy preview" : "GLB loaded",
      });
    });
  }

  private setVehicleObject(object: Object3D): void {
    this.vehicleRoot.clear();
    this.vehicleRoot.add(object);
  }

  private refreshVehiclePose(): void {
    if (!this.profile || this.profile.Waypoints.length < 2 || this.vehicleRoot.children.length === 0) {
      return;
    }
    const time = Math.min(this.profile.DurationSeconds, Math.max(0, this.scrubTime));
    const pose = evaluateSourcePose(this.profile, time);
    this.vehicleRoot.position.copy(unityPositionToThreeVector(pose.position));
    this.vehicleRoot.quaternion.copy(unityQuaternionValueToThreeQuaternion(pose.rotation));
    this.syncVehicleCameraMode();
  }

  private syncVehicleCameraMode(): void {
    if (this.rideVehicle) {
      this.rideVehicleCamera();
    } else if (this.followVehicle) {
      this.followVehicleCamera();
    }
  }

  private followVehicleCamera(frameIfNeeded = false): void {
    if (this.vehicleRoot.children.length === 0) {
      return;
    }
    const bounds = new Box3().setFromObject(this.vehicleRoot);
    if (bounds.isEmpty()) {
      return;
    }
    const nextTarget = new Vector3();
    bounds.getCenter(nextTarget);
    if (frameIfNeeded) {
      this.frameBox(bounds);
      return;
    }
    const offset = this.camera.position.clone().sub(this.orbit.target);
    this.orbit.target.copy(nextTarget);
    this.camera.position.copy(nextTarget.clone().add(offset));
    this.camera.lookAt(nextTarget);
    this.applyDynamicControls(bounds);
  }

  private rideVehicleCamera(): void {
    if (this.vehicleRoot.children.length === 0) {
      return;
    }
    const bounds = new Box3().setFromObject(this.vehicleRoot);
    if (bounds.isEmpty()) {
      return;
    }
    const vehicleCenter = new Vector3();
    bounds.getCenter(vehicleCenter);
    const vehicleRotation = this.vehicleRoot.quaternion;
    const ridePosition = new Vector3(0, 8, -28).applyQuaternion(vehicleRotation).add(vehicleCenter);
    const yaw = MathUtils.degToRad(this.rideYawDegrees);
    const pitch = MathUtils.degToRad(this.ridePitchDegrees);
    const localLookDirection = new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).normalize();
    const lookDirection = localLookDirection.applyQuaternion(vehicleRotation).normalize();
    const lookTarget = ridePosition.clone().add(lookDirection.multiplyScalar(90));
    this.camera.up.copy(new Vector3(0, 1, 0).applyQuaternion(vehicleRotation).normalize());
    this.camera.position.copy(ridePosition);
    this.camera.lookAt(lookTarget);
    this.orbit.target.copy(lookTarget);
    this.applyDynamicControls(bounds);
    this.emitViewOrientation(true);
  }
}

function createMonumentPrimitive(monument: MonumentReferencePayload): Group {
  const group = new Group();
  const key = monumentKey(monument);
  const size = MathUtils.clamp(monument.radius, 24, 180);
  group.name = `monument-${key}`;
  const addTitle = () => {
    group.add(createMonumentTitleSprite(monument.name, size));
    return group;
  };

  if (key.includes("airfield")) {
    addBox(group, size * 2.1, 5, size * 0.22, 0x2c3030, 0, 1, 0);
    addBox(group, size * 0.44, 22, size * 0.34, 0x6e7470, -size * 0.55, 13, -size * 0.32);
    return addTitle();
  }
  if (key.includes("launch")) {
    addBox(group, size * 1.35, 9, size * 0.82, 0x353b3a, 0, 4, 0);
    addCylinder(group, size * 0.12, size * 1.05, 0x9fafa8, -size * 0.15, size * 0.55, 0);
    addCone(group, size * 0.2, size * 0.34, 0xb86f3f, -size * 0.15, size * 1.24, 0);
    return addTitle();
  }
  if (key.includes("sphere") || key.includes("dome")) {
    addSphere(group, size * 0.42, 0x9baaa0, 0, size * 0.42, 0);
    addCylinder(group, size * 0.08, size * 0.55, 0x7f6b45, size * 0.48, size * 0.28, -size * 0.12);
    return addTitle();
  }
  if (key.includes("satellite")) {
    addCylinder(group, size * 0.07, size * 0.46, 0x7d837f, 0, size * 0.23, 0);
    const dish = addCone(group, size * 0.42, size * 0.18, 0x9aa29c, 0, size * 0.58, 0);
    dish.rotation.x = MathUtils.degToRad(58);
    return addTitle();
  }
  if (key.includes("lighthouse")) {
    addCylinder(group, size * 0.14, size * 1.1, 0xd9d2bd, 0, size * 0.55, 0);
    addCylinder(group, size * 0.2, size * 0.16, 0x9b3e2e, 0, size * 1.18, 0);
    addCone(group, size * 0.24, size * 0.18, 0x342f2b, 0, size * 1.35, 0);
    return addTitle();
  }
  if (key.includes("oilrig") || key.includes("oil_rig")) {
    addBox(group, size * 1.1, 10, size * 0.86, 0x3d4546, 0, 6, 0);
    addBox(group, size * 0.18, size * 0.8, size * 0.18, 0x808783, -size * 0.36, size * 0.45, -size * 0.22);
    addCylinder(group, size * 0.05, size * 0.88, 0xe0b35f, 0, size * 0.5, 0);
    return addTitle();
  }
  if (key.includes("harbor")) {
    addBox(group, size * 1.4, 7, size * 0.28, 0x3e484a, 0, 4, 0);
    addBox(group, size * 0.24, size * 0.58, size * 0.24, 0x8b7044, -size * 0.42, size * 0.32, -size * 0.08);
    return addTitle();
  }
  if (key.includes("powerplant") || key.includes("power_plant")) {
    addBox(group, size * 0.92, size * 0.2, size * 0.62, 0x5b605c, 0, size * 0.1, 0);
    addCylinder(group, size * 0.09, size * 0.92, 0x9a9a90, -size * 0.24, size * 0.55, 0);
    addCylinder(group, size * 0.09, size * 0.72, 0x9a9a90, size * 0.24, size * 0.45, 0);
    return addTitle();
  }
  if (key.includes("excavator")) {
    addBox(group, size * 0.7, size * 0.26, size * 0.5, 0x6f5b35, -size * 0.15, size * 0.13, 0);
    const arm = addBox(group, size * 0.92, size * 0.08, size * 0.12, 0xc59a4a, size * 0.32, size * 0.48, 0);
    arm.rotation.z = MathUtils.degToRad(-24);
    return addTitle();
  }
  if (key.includes("trainyard") || key.includes("train_yard")) {
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, -size * 0.22);
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, size * 0.22);
    addBox(group, size * 0.72, size * 0.32, size * 0.34, 0x6f5f48, -size * 0.18, size * 0.18, 0);
    return addTitle();
  }
  if (key.includes("military") || key.includes("tunnel") || key.includes("bunker")) {
    addBox(group, size * 0.94, size * 0.26, size * 0.62, 0x59645b, 0, size * 0.13, 0);
    addBox(group, size * 0.24, size * 0.32, size * 0.28, 0x303635, -size * 0.38, size * 0.16, 0);
    return addTitle();
  }
  if (key.includes("gas") || key.includes("supermarket") || key.includes("warehouse")) {
    addBox(group, size * 0.74, size * 0.26, size * 0.56, 0x7d7359, 0, size * 0.13, 0);
    addBox(group, size * 0.82, size * 0.08, size * 0.22, 0xb76d3a, 0, size * 0.34, -size * 0.18);
    return addTitle();
  }
  if (key.includes("quarry") || key.includes("mining")) {
    addCone(group, size * 0.42, size * 0.24, 0x6d624c, 0, size * 0.12, 0);
    addCylinder(group, size * 0.08, size * 0.48, 0x6f5f48, size * 0.26, size * 0.24, 0);
    return addTitle();
  }

  addBox(group, size * 0.68, size * 0.24, size * 0.5, 0x6a705e, 0, size * 0.12, 0);
  addCylinder(group, size * 0.08, size * 0.46, 0x8b7044, size * 0.28, size * 0.23, -size * 0.12);
  return addTitle();
}

function createMonumentTitleSprite(title: string, size: number): Sprite {
  const label = title.trim() || "Monument";
  const fontSize = 34;
  const paddingX = 22;
  const paddingY = 14;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return new Sprite(new SpriteMaterial({ color: 0xf8f0dc }));
  }

  context.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const metrics = context.measureText(label);
  const width = Math.ceil(metrics.width + paddingX * 2);
  const height = fontSize + paddingY * 2;
  canvas.width = nextPowerOfTwo(Math.max(128, width));
  canvas.height = nextPowerOfTwo(Math.max(64, height));

  context.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(18, 20, 18, 0.74)";
  roundRect(context, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height, 16);
  context.fill();
  context.strokeStyle = "rgba(248, 231, 172, 0.82)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#fff5d7";
  context.shadowColor = "rgba(0, 0, 0, 0.65)";
  context.shadowBlur = 5;
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  const worldWidth = MathUtils.clamp(size * 1.35, 80, 230);
  sprite.name = "monument-title";
  sprite.position.set(0, Math.max(size * 1.48, 64), 0);
  sprite.scale.set(worldWidth, worldWidth * (canvas.height / canvas.width), 1);
  sprite.renderOrder = 20;
  return sprite;
}

function monumentKey(monument: MonumentReferencePayload): string {
  return `${monument.kind} ${monument.name} ${monument.prefab}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function monumentMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.08, roughness: 0.72 });
}

function addBox(group: Group, width: number, height: number, depth: number, color: number, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), monumentMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addCylinder(group: Group, radius: number, height: number, color: number, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 14), monumentMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addCone(group: Group, radius: number, height: number, color: number, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new ConeGeometry(radius, height, 16), monumentMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addSphere(group: Group, radius: number, color: number, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 18, 12), monumentMaterial(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}
