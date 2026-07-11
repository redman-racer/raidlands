import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  GridHelper,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
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

export type ReleaseVisibilityMode = "all" | "near" | "selected";

export interface AirstrikeViewportOptions {
  assetBase: string;
  metadata: VehiclePreviewMetadataFile | null;
  onSelectWaypoint: (waypointId: string) => void;
  onWaypointMoved: (waypointId: string, position: Vector3) => EditorSourceProfile | null;
  onSelectRelease?: (releaseId: string) => void;
  onVehicleStatus?: (status: ViewportStatus) => void;
}

const handleMaterial = new MeshStandardMaterial({ color: 0x36c5e6, metalness: 0.1, roughness: 0.45 });
const selectedHandleMaterial = new MeshStandardMaterial({ color: 0xffd166, metalness: 0.05, roughness: 0.35 });
const targetMaterial = new MeshBasicMaterial({ color: 0xff5f57, side: DoubleSide, transparent: true, opacity: 0.72 });
const releaseMaterial = new MeshStandardMaterial({ color: 0xf97316, emissive: 0x2b1203, roughness: 0.38 });
const selectedReleaseMaterial = new MeshStandardMaterial({ color: 0xffd166, emissive: 0x322000, roughness: 0.28 });
const releaseTargetMaterial = new MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.75 });
const releaseLineMaterial = new LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.68 });

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
  private readonly routeMaterial = new LineBasicMaterial({ color: 0x55d6ff, linewidth: 2 });
  private readonly handleGeometry = new SphereGeometry(3.2, 20, 12);
  private readonly releaseGeometry = new SphereGeometry(2.5, 18, 10);
  private readonly releaseTargetGeometry = new ConeGeometry(2.8, 7, 18);
  private readonly handles = new Map<string, Mesh>();
  private readonly releaseMarkers = new Map<string, Mesh>();
  private routeLine: Line | null = null;
  private profile: EditorSourceProfile | null = null;
  private selectedWaypointId = "";
  private selectedReleaseId = "";
  private releaseVisibilityMode: ReleaseVisibilityMode = "near";
  private scrubTime = 0;
  private animationFrame = 0;
  private vehicleToken = 0;
  private currentVehicle = "";
  private readonly onResize = () => this.resize();
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);

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
      this.orbit.enabled = !Boolean(event.value);
    });
    this.transform.addEventListener("objectChange", () => this.handleTransformObjectChange());

    this.scene.add(this.waypointGroup);
    this.scene.add(this.releaseGroup);
    this.scene.add(this.vehicleRoot);
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

  public frameTarget(): void {
    const targetBounds = new Box3().setFromCenterAndSize(new Vector3(0, 20, 0), new Vector3(80, 80, 80));
    this.frameBox(targetBounds);
  }

  public dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
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

    const grid = new GridHelper(800, 40, 0x23434a, 0x142a30);
    grid.name = "meter-grid";
    this.scene.add(grid);

    const ground = new Mesh(
      new PlaneGeometry(800, 800),
      new MeshBasicMaterial({ color: 0x0c1518, side: DoubleSide, transparent: true, opacity: 0.22 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.name = "ground-plane";
    this.scene.add(ground);

    const target = new Mesh(new ConeGeometry(6, 18, 24), targetMaterial);
    target.name = "target-marker";
    target.position.y = 9;
    this.scene.add(target);

    const approach = new Mesh(new ConeGeometry(5, 18, 20), new MeshBasicMaterial({ color: 0x89f7fe }));
    approach.name = "approach-direction";
    approach.rotation.x = -Math.PI / 2;
    approach.position.set(0, 10, 90);
    this.scene.add(approach);
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
    this.renderer.render(this.scene, this.camera);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !this.profile) {
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
    const vicinitySeconds = 0.35;
    for (const child of this.releaseGroup.children) {
      const releaseId = typeof child.userData.releaseId === "string" ? child.userData.releaseId : "";
      const releaseTime = typeof child.userData.releaseTime === "number" ? child.userData.releaseTime : Number.NaN;
      child.visible =
        this.releaseVisibilityMode === "all" ||
        (this.releaseVisibilityMode === "selected" && releaseId === this.selectedReleaseId) ||
        (this.releaseVisibilityMode === "near" && Math.abs(releaseTime - this.scrubTime) <= vicinitySeconds);
    }
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

  private frameBox(bounds: Box3): void {
    const target = new Vector3();
    bounds.getCenter(target);
    this.orbit.target.copy(target);
    this.camera.position.copy(frameBounds(this.camera, target, bounds));
    this.camera.lookAt(target);
    this.applyDynamicControls(bounds);
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
  }
}
