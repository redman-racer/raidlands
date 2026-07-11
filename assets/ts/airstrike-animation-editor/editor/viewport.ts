import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
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
  SphereGeometry,
  CylinderGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { evaluateSourcePose } from "../math";
import type { EditorSourceProfile, VehiclePreviewMetadataFile } from "../types";
import { unityPositionToThreeVector, unityQuaternionValueToThreeQuaternion } from "./coordinates";
import { getReleasePreviewEvents, type ReleasePreviewEvent } from "./release-source";
import { createVehicleProxy, loadVehiclePreview, metadataForVehicle } from "./vehicle-preview";
import { dynamicControlScale, frameBounds, routeBounds } from "./viewport-framing";

type ViewportStatus = {
  vehicle: string;
  prefabLabel: string;
  modelState: string;
};

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
  private readonly routeMaterial = new LineBasicMaterial({ color: 0x55d6ff, linewidth: 2 });
  private readonly handleGeometry = new SphereGeometry(3.2, 20, 12);
  private readonly releaseGeometry = new SphereGeometry(2.5, 18, 10);
  private readonly releaseTargetGeometry = new ConeGeometry(2.8, 7, 18);
  private readonly handles = new Map<string, Mesh>();
  private readonly releaseMarkers = new Map<string, Mesh>();
  private grid: GridHelper | null = null;
  private ground: Mesh | null = null;
  private routeLine: Line | null = null;
  private profile: EditorSourceProfile | null = null;
  private selectedWaypointId = "";
  private selectedReleaseId = "";
  private releaseVisibilityMode: ReleaseVisibilityMode = "near";
  private scrubTime = 0;
  private animationFrame = 0;
  private vehicleToken = 0;
  private currentVehicle = "";
  private currentOrientationKey = "";
  private followVehicle = false;
  private rideVehicle = false;
  private rideYawDegrees = 0;
  private ridePitchDegrees = 0;
  private ridePointerId = -1;
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
    this.scene.background = new Color(0x071013);
    this.camera.position.set(180, 120, 250);
    this.camera.lookAt(0, 55, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = "srgb";
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
      iso: new Vector3(0.52, 0.46, 0.72),
      top: new Vector3(0, 1, 0.001),
      bottom: new Vector3(0, -1, 0.001),
      front: new Vector3(0, 0.12, 1),
      back: new Vector3(0, 0.12, -1),
      left: new Vector3(-1, 0.12, 0),
      right: new Vector3(1, 0.12, 0),
    };
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
    const ambient = new AmbientLight(0xffffff, 0.58);
    const key = new DirectionalLight(0xffffff, 1.55);
    key.position.set(90, 180, 120);
    this.scene.add(ambient, key);

    this.syncSceneFloor();

    const target = new Mesh(new ConeGeometry(6, 18, 24), targetMaterial);
    target.name = "target-marker";
    target.position.y = 9;
    this.scene.add(target);

    const approach = new Mesh(new ConeGeometry(5, 18, 20), new MeshBasicMaterial({ color: 0x89f7fe }));
    approach.name = "approach-direction";
    approach.rotation.x = -Math.PI / 2;
    approach.position.set(0, 10, 90);
    this.scene.add(approach);

    this.createScaleReferenceEntities();
  }

  private createScaleReferenceEntities(): void {
    this.scaleReferenceGroup.name = "scale-reference-placeholders";
    this.scaleReferenceGroup.clear();

    this.scaleReferenceGroup.add(this.createTerrainReferenceGroup());

    const standingPlayer = this.createPlayerPlaceholder("scale-player-standing", scaleReferenceMaterials.player);
    standingPlayer.position.set(-26, 0, 18);
    standingPlayer.rotation.y = MathUtils.degToRad(18);
    this.scaleReferenceGroup.add(standingPlayer);

    const secondPlayer = this.createPlayerPlaceholder("scale-player-near-crates", scaleReferenceMaterials.playerAccent);
    secondPlayer.position.set(40, 0, -34);
    secondPlayer.rotation.y = MathUtils.degToRad(-32);
    this.scaleReferenceGroup.add(secondPlayer);

    const crateStack = new Group();
    crateStack.name = "scale-crate-stack";
    const crateGeometry = new BoxGeometry(7, 7, 7);
    const crateOffsets = [
      new Vector3(0, 3.5, 0),
      new Vector3(7.4, 3.5, 0),
      new Vector3(3.7, 10.7, 0),
    ];
    for (const offset of crateOffsets) {
      const crate = new Mesh(crateGeometry, scaleReferenceMaterials.crate);
      crate.position.copy(offset);
      crateStack.add(crate);
    }
    crateStack.position.set(18, 0, 38);
    crateStack.rotation.y = MathUtils.degToRad(-16);
    this.scaleReferenceGroup.add(crateStack);

    const barricade = new Group();
    barricade.name = "scale-barricade-line";
    const barricadeGeometry = new BoxGeometry(22, 5, 3);
    for (let index = 0; index < 3; index += 1) {
      const block = new Mesh(barricadeGeometry, scaleReferenceMaterials.barricade);
      block.position.set(index * 23, 2.5, Math.sin(index) * 2);
      block.rotation.y = MathUtils.degToRad(index === 1 ? 8 : -5);
      barricade.add(block);
    }
    barricade.position.set(-58, 0, -40);
    barricade.rotation.y = MathUtils.degToRad(24);
    this.scaleReferenceGroup.add(barricade);

    const tower = this.createTowerPlaceholder();
    tower.position.set(68, 0, 42);
    tower.rotation.y = MathUtils.degToRad(-28);
    this.scaleReferenceGroup.add(tower);
  }

  private createTerrainReferenceGroup(): Group {
    const terrain = new Group();
    terrain.name = "scale-terrain-placeholders";

    const dirtGeometry = new BoxGeometry(34, 0.18, 104);
    const dirtSegments = [
      { position: new Vector3(-88, 0.08, -28), yaw: 18 },
      { position: new Vector3(-54, 0.1, -6), yaw: 28 },
      { position: new Vector3(-18, 0.12, 12), yaw: 20 },
      { position: new Vector3(22, 0.1, 24), yaw: 10 },
      { position: new Vector3(62, 0.08, 32), yaw: -4 },
    ];
    for (const segment of dirtSegments) {
      const path = new Mesh(dirtGeometry, scaleReferenceMaterials.dirt);
      path.name = "scale-dirt-track";
      path.position.copy(segment.position);
      path.rotation.y = MathUtils.degToRad(segment.yaw);
      terrain.add(path);
    }

    const moundGeometry = new ConeGeometry(1, 1, 18);
    const mounds = [
      { position: new Vector3(-82, 2, 52), scale: new Vector3(34, 4, 26), yaw: -12 },
      { position: new Vector3(86, 2.5, -58), scale: new Vector3(46, 5, 32), yaw: 28 },
      { position: new Vector3(6, 1.35, -78), scale: new Vector3(28, 2.7, 22), yaw: 4 },
    ];
    for (const mound of mounds) {
      const mesh = new Mesh(moundGeometry, scaleReferenceMaterials.grass);
      mesh.name = "scale-terrain-mound";
      mesh.position.copy(mound.position);
      mesh.scale.copy(mound.scale);
      mesh.rotation.y = MathUtils.degToRad(mound.yaw);
      terrain.add(mesh);
    }

    const treePlacements = [
      { position: new Vector3(-102, 0, 38), scale: 1.15 },
      { position: new Vector3(-120, 0, 62), scale: 0.85 },
      { position: new Vector3(-76, 0, 74), scale: 1 },
      { position: new Vector3(82, 0, -82), scale: 1.2 },
      { position: new Vector3(110, 0, -54), scale: 0.92 },
      { position: new Vector3(122, 0, -86), scale: 0.78 },
      { position: new Vector3(38, 0, 86), scale: 0.95 },
      { position: new Vector3(62, 0, 100), scale: 0.72 },
    ];
    for (const [index, placement] of treePlacements.entries()) {
      const tree = this.createTreePlaceholder(`scale-tree-${index + 1}`, placement.scale);
      tree.position.copy(placement.position);
      tree.rotation.y = MathUtils.degToRad(index * 31);
      terrain.add(tree);
    }

    const rockGeometry = new BoxGeometry(6, 3, 4);
    const rocks = [
      { position: new Vector3(-44, 1.5, 64), scale: new Vector3(1.4, 0.8, 1.1), yaw: 22 },
      { position: new Vector3(-38, 1.1, 72), scale: new Vector3(0.8, 0.6, 0.7), yaw: -18 },
      { position: new Vector3(76, 1.4, 72), scale: new Vector3(1.2, 0.7, 1.7), yaw: 44 },
      { position: new Vector3(104, 1.25, 18), scale: new Vector3(0.9, 0.75, 1.1), yaw: 8 },
    ];
    for (const rock of rocks) {
      const mesh = new Mesh(rockGeometry, scaleReferenceMaterials.rock);
      mesh.name = "scale-rock";
      mesh.position.copy(rock.position);
      mesh.scale.copy(rock.scale);
      mesh.rotation.set(MathUtils.degToRad(5), MathUtils.degToRad(rock.yaw), MathUtils.degToRad(-7));
      terrain.add(mesh);
    }

    const scrubGeometry = new ConeGeometry(4.5, 4, 8);
    const scrubPlacements = [
      new Vector3(-16, 2, -48),
      new Vector3(-2, 2, -54),
      new Vector3(22, 2, -52),
      new Vector3(54, 2, -14),
      new Vector3(54, 2, 0),
      new Vector3(-64, 2, 8),
    ];
    for (const [index, position] of scrubPlacements.entries()) {
      const scrub = new Mesh(scrubGeometry, scaleReferenceMaterials.grass);
      scrub.name = "scale-scrub";
      scrub.position.copy(position);
      scrub.rotation.y = MathUtils.degToRad(index * 27);
      terrain.add(scrub);
    }

    return terrain;
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

    const body = new Mesh(new CylinderGeometry(1.4, 1.8, 5.2, 12), material);
    body.position.y = 4.4;
    player.add(body);

    const head = new Mesh(new SphereGeometry(1.25, 14, 10), material);
    head.position.y = 7.8;
    player.add(head);

    const legs = new Mesh(new BoxGeometry(2.8, 2.8, 1.2), material);
    legs.position.y = 1.4;
    player.add(legs);

    const sightLine = new Mesh(new BoxGeometry(0.32, 0.32, 8), scaleReferenceMaterials.tower);
    sightLine.position.set(0, 5.2, -4.6);
    player.add(sightLine);

    return player;
  }

  private createTowerPlaceholder(): Group {
    const tower = new Group();
    tower.name = "scale-watchtower-placeholder";

    const deck = new Mesh(new BoxGeometry(14, 2, 14), scaleReferenceMaterials.tower);
    deck.position.y = 13;
    tower.add(deck);

    const legGeometry = new CylinderGeometry(0.45, 0.45, 13, 8);
    for (const x of [-5.2, 5.2]) {
      for (const z of [-5.2, 5.2]) {
        const leg = new Mesh(legGeometry, scaleReferenceMaterials.tower);
        leg.position.set(x, 6.5, z);
        tower.add(leg);
      }
    }

    const roof = new Mesh(new ConeGeometry(10.5, 5, 4), scaleReferenceMaterials.barricade);
    roof.position.y = 17.2;
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
    this.grid = new GridHelper(floorSize, divisions, 0x23434a, 0x142a30);
    this.grid.name = "meter-grid";
    this.grid.position.set(floorCenterX, 0, floorCenterZ);
    this.scene.add(this.grid);

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
