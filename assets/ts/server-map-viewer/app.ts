import {
  AmbientLight,
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  CanvasTexture,
  LineBasicMaterial,
  LineSegments,
  Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Uint32BufferAttribute,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyRaidlandsEnvironment } from "../shared/three-environment";

type TerrainPayload = {
  version?: number;
  resolution: number;
  worldSize?: number;
  seed?: number;
  waterLevel?: number;
  minHeight?: number;
  maxHeight?: number;
  heights: number[];
  colors?: string[];
  monuments?: MonumentPayload[];
};

type MonumentPayload = {
  name: string;
  prefab: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  rotationY: number;
};

type RuntimeVisualFrame = {
  Time: number;
  X: number;
  Y: number;
  Z: number;
  Qx: number;
  Qy: number;
  Qz: number;
  Qw: number;
};

type RuntimePayloadEvent = {
  Time: number;
  CarrierOffsetX?: number;
  CarrierOffsetY?: number;
  CarrierOffsetZ?: number;
};

type RuntimeVisualProfile = {
  Vehicle?: string;
  DurationSeconds?: number;
  PayloadEvents?: RuntimePayloadEvent[];
  CompiledReleaseEvents?: RuntimePayloadEvent[];
  CompiledTrack?: {
    DurationSeconds?: number;
    Frames?: RuntimeVisualFrame[];
  };
};

type MapView = "iso" | "top";

type CameraPose = {
  position: Vector3;
  target: Vector3;
  up: Vector3;
};

type CameraTourKind = "coastal-sweep" | "ridge-crossing" | "monument-orbit" | "map-run" | "home-orbit";

type CameraTourStyle = "cinematic" | "orbit";

type HeatmapBucket = {
  bucketSize: number;
  x: number;
  z: number;
  value: number;
  normalized: number;
};

type HeatmapPayload = {
  ok?: boolean;
  maxValue?: number;
  buckets?: HeatmapBucket[];
};

type HeatmapHistoryFrame = HeatmapPayload & {
  index?: number;
  label?: string;
  windowStart?: string;
  windowEnd?: string;
  players?: PlayerLocation[];
};

type HeatmapHistoryPayload = HeatmapPayload & {
  frames?: HeatmapHistoryFrame[];
  frameSeconds?: number;
  authenticated?: boolean;
  historyAvailable?: boolean;
};

type PlayerLocation = {
  steamId64?: string;
  displayName?: string;
  clanTag?: string;
  x: number;
  y?: number;
  z: number;
  isSelf?: boolean;
  sampledAt?: string;
};

type PlayerLocationPayload = {
  ok?: boolean;
  authenticated?: boolean;
  players?: PlayerLocation[];
  frames?: HeatmapHistoryFrame[];
};

type ServerStatusPayload = {
  ok?: boolean;
  mapImage?: ServerStatusMapImage | null;
  mapImageUrl?: string;
  worldSize?: number;
  seed?: number;
  fetchedAt?: string;
};

type ServerStatusMapImage = {
  terrainUrl?: string;
  terrainPublicUrl?: string;
  terrainHash?: string;
  textureUrl?: string;
  skyboxUrl?: string;
  skyboxPublicUrl?: string;
  skyboxHash?: string;
  url?: string;
  publicUrl?: string;
  hash?: string;
  worldSize?: number;
  seed?: number;
  publishedAt?: string;
  updatedAt?: string;
  generatedAt?: string;
};

type ViewerBinding = {
  dispose: () => void;
};

type OverlayLayerTransition = {
  incoming: Group;
  outgoing: Group | null;
  startedAt: number;
  durationMs: number;
};

type TerrainViewerInstance = {
  viewer: TerrainViewer;
  binding: ViewerBinding;
};

const isoViewDirections = [
  new Vector3(0, 0.56, -0.74),
  new Vector3(-0.48, 0.34, -0.58),
  new Vector3(0.48, 0.34, -0.58),
  new Vector3(0.48, 0.34, 0.58),
  new Vector3(-0.48, 0.34, 0.58),
];

const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-server-map-viewer]"));

for (const root of roots) {
  void initTerrainViewer(root).then((instance) => {
    if (instance) {
      bindLiveTerrainUpdates(root, instance);
    }
  });
}

async function initTerrainViewer(root: HTMLElement): Promise<TerrainViewerInstance | null> {
  const terrainUrl = root.dataset.terrainUrl || "";
  const status = root.querySelector<HTMLElement>("[data-map-viewer-status]");

  if (!terrainUrl) {
    setStatus(status, "Terrain export pending.");
    return null;
  }

  try {
    const response = await fetch(terrainUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Terrain request failed with HTTP ${response.status}.`);
    }

    const terrain = normalizeTerrain(await response.json(), root);
    const viewer = new TerrainViewer(root, terrain, {
      textureUrl: root.dataset.textureUrl || "",
      status,
    });

    viewer.mount();
    const binding = bindExternalControls(root, viewer);
    void bindAirstrikePreview(root, viewer);
    setStatus(status, "");
    root.dataset.mapFingerprint = terrainViewerFingerprint(root);
    return { viewer, binding };
  } catch (error) {
    console.info("Raidlands terrain viewer could not be loaded.", error);
    setStatus(status, "Terrain export pending.");
    return null;
  }
}

function bindLiveTerrainUpdates(root: HTMLElement, initial: TerrainViewerInstance): void {
  const statusUrl = root.dataset.statusUrl || "";

  if (!statusUrl) {
    return;
  }

  let instance: TerrainViewerInstance | null = initial;
  let pollTimer = 0;
  let polling = false;

  const schedule = (delay = liveTerrainPollDelayMs()) => {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(() => {
      void poll();
    }, delay);
  };

  const poll = async () => {
    if (polling) {
      schedule();
      return;
    }

    if (document.visibilityState === "hidden") {
      schedule();
      return;
    }

    polling = true;

    try {
      const metadata = await loadLatestTerrainMetadata(root, statusUrl);
      if (!metadata) {
        schedule();
        return;
      }

      const nextFingerprint = metadata.fingerprint;
      if (nextFingerprint === "" || nextFingerprint === (root.dataset.mapFingerprint || "")) {
        schedule();
        return;
      }

      setStatus(root.querySelector<HTMLElement>("[data-map-viewer-status]"), "Loading new wipe terrain.");
      root.dataset.terrainUrl = metadata.terrainUrl;
      root.dataset.textureUrl = metadata.textureUrl;
      root.dataset.skyboxUrl = metadata.skyboxUrl || root.dataset.skyboxUrl || "";
      root.dataset.worldSize = metadata.worldSize > 0 ? String(metadata.worldSize) : (root.dataset.worldSize || "");
      root.dataset.terrainHash = metadata.terrainHash || "";
      root.dataset.skyboxHash = metadata.skyboxHash || "";
      root.dataset.mapPublishedAt = metadata.publishedAt || "";

      instance?.binding.dispose();
      instance?.viewer.dispose();
      instance = await initTerrainViewer(root);
      if (instance) {
        root.dataset.mapFingerprint = nextFingerprint;
      }
    } catch (error) {
      console.info("Raidlands terrain viewer live refresh skipped.", error);
    } finally {
      polling = false;
      schedule();
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void poll();
    }
  });

  schedule(liveTerrainPollDelayMs() + 1200);
}

async function loadLatestTerrainMetadata(root: HTMLElement, statusUrl: string): Promise<ServerStatusMapImage & { terrainUrl: string; textureUrl: string; worldSize: number; fingerprint: string } | null> {
  const response = await fetch(new URL(statusUrl, window.location.href).toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Server status request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ServerStatusPayload;
  const mapImage = payload.mapImage && typeof payload.mapImage === "object" ? payload.mapImage : null;
  const terrainUrl = String(mapImage?.terrainUrl || mapImage?.terrainPublicUrl || "");

  if (terrainUrl === "") {
    return null;
  }

  const textureUrl = String(mapImage?.textureUrl || mapImage?.url || mapImage?.publicUrl || payload.mapImageUrl || root.dataset.textureUrl || "");
  const skyboxUrl = String(mapImage?.skyboxUrl || mapImage?.skyboxPublicUrl || root.dataset.skyboxUrl || "");
  const worldSize = Math.max(0, Number(mapImage?.worldSize || payload.worldSize || root.dataset.worldSize || 0));
  const metadata = {
    ...mapImage,
    terrainUrl,
    textureUrl,
    skyboxUrl,
    worldSize,
    fingerprint: "",
  };
  metadata.fingerprint = terrainMetadataFingerprint(metadata);

  return metadata;
}

function terrainViewerFingerprint(root: HTMLElement): string {
  return [
    root.dataset.terrainHash || "",
    root.dataset.terrainUrl || "",
    root.dataset.textureUrl || "",
    root.dataset.skyboxUrl || "",
    root.dataset.skyboxHash || "",
    root.dataset.worldSize || "",
    root.dataset.mapPublishedAt || "",
  ].join("|");
}

function terrainMetadataFingerprint(metadata: Partial<ServerStatusMapImage> & { terrainUrl?: string; textureUrl?: string; skyboxUrl?: string; worldSize?: number }): string {
  return [
    metadata.terrainHash || "",
    metadata.terrainUrl || metadata.terrainPublicUrl || "",
    metadata.textureUrl || metadata.url || metadata.publicUrl || "",
    metadata.hash || "",
    metadata.skyboxHash || "",
    metadata.skyboxUrl || metadata.skyboxPublicUrl || "",
    String(metadata.worldSize || ""),
    metadata.publishedAt || metadata.generatedAt || "",
  ].join("|");
}

function liveTerrainPollDelayMs(): number {
  return 300000;
}

function normalizeTerrain(value: unknown, root: HTMLElement): TerrainPayload {
  const payload = value && typeof value === "object" ? (value as Partial<TerrainPayload>) : {};
  const resolution = Math.max(2, Math.min(257, Math.floor(Number(payload.resolution) || 0)));
  const heights = Array.isArray(payload.heights) ? payload.heights.map((height) => Number(height)) : [];
  const expected = resolution * resolution;

  if (resolution < 2 || heights.length !== expected || heights.some((height) => !Number.isFinite(height))) {
    throw new Error("Terrain payload is not a square numeric height grid.");
  }

  const worldSize = Number(payload.worldSize) || Number(root.dataset.worldSize) || 4500;
  const colors = Array.isArray(payload.colors) && payload.colors.length === expected ? payload.colors.map(String) : undefined;
  const monuments = normalizeMonuments(payload.monuments, Math.max(100, worldSize));

  return {
    version: Number(payload.version) || 1,
    resolution,
    worldSize: Math.max(100, worldSize),
    seed: Number(payload.seed) || 0,
    waterLevel: Number(payload.waterLevel) || 0,
    minHeight: Number.isFinite(Number(payload.minHeight)) ? Number(payload.minHeight) : Math.min(...heights),
    maxHeight: Number.isFinite(Number(payload.maxHeight)) ? Number(payload.maxHeight) : Math.max(...heights),
    heights,
    colors,
    monuments,
  };
}

function normalizeMonuments(value: unknown, worldSize: number): MonumentPayload[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const half = worldSize / 2;
  return value
    .map((entry): MonumentPayload | null => {
      const monument = entry && typeof entry === "object" ? (entry as Partial<MonumentPayload>) : {};
      const x = Number(monument.x);
      const y = Number(monument.y);
      const z = Number(monument.z);

      if (![x, y, z].every(Number.isFinite) || Math.abs(x) > half * 1.2 || Math.abs(z) > half * 1.2) {
        return null;
      }

      const radius = MathUtils.clamp(Number(monument.radius) || 55, 18, 280);
      return {
        name: String(monument.name || "Monument").slice(0, 80),
        prefab: String(monument.prefab || "").slice(0, 160),
        kind: String(monument.kind || monument.name || monument.prefab || "monument").slice(0, 80),
        x,
        y: Number.isFinite(y) ? y : 0,
        z,
        radius,
        rotationY: Number.isFinite(Number(monument.rotationY)) ? Number(monument.rotationY) : 0,
      };
    })
    .filter((entry): entry is MonumentPayload => entry !== null)
    .slice(0, 96);
}

class TerrainViewer {
  private readonly root: HTMLElement;
  private readonly terrain: TerrainPayload;
  private readonly textureUrl: string;
  private readonly status: HTMLElement | null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(48, 1, 1, 12000);
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: false });
  private readonly controls: OrbitControls;
  private readonly terrainMesh: Mesh;
  private readonly terrainMaterial: MeshStandardMaterial;
  private readonly oceanSurfaceMesh: Mesh;
  private readonly oceanFloorMesh: Mesh;
  private readonly oceanWaveTexture: CanvasTexture;
  private readonly gridLayer = new Group();
  private readonly heatmapLayer = new Group();
  private readonly playerLocationLayer = new Group();
  private readonly overlayLayerTransitions: OverlayLayerTransition[] = [];
  private readonly airstrikeLayer = new Group();
  private readonly onResize = () => this.resize();
  private animationFrame = 0;
  private readonly clockStart = performance.now();
  private isoViewIndex = -1;
  private activePose: CameraPose | null = null;
  private focusUntil = 0;
  private tourStartedAt = performance.now();
  private tourDuration = 18000;
  private tourKind: CameraTourKind = "coastal-sweep";
  private tourIndex = -1;
  private tourEnabled: boolean;
  private readonly tourStyle: CameraTourStyle;
  private readonly lockCameraInput: boolean;
  private transitionFrom: CameraPose | null = null;
  private transitionTo: CameraPose | null = null;
  private transitionStartedAt = 0;
  private transitionDuration = 1400;
  private selfLocation: PlayerLocation | null = null;

  public constructor(
    root: HTMLElement,
    terrain: TerrainPayload,
    options: { textureUrl: string; status: HTMLElement | null },
  ) {
    this.root = root;
    this.terrain = terrain;
    this.textureUrl = options.textureUrl;
    this.status = options.status;
    this.tourEnabled = this.root.dataset.cameraTour === "true";
    this.tourStyle = this.root.dataset.cameraTourStyle === "orbit" ? "orbit" : "cinematic";
    this.lockCameraInput = this.root.dataset.cameraLocked === "true";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    applyRaidlandsEnvironment(this.scene, this.renderer, {
      preset: "terrain",
      exposure: 1.08,
      backgroundIntensity: 0.9,
      environmentIntensity: 0.76,
      skyboxUrl: this.root.dataset.skyboxUrl || "",
    });
    this.renderer.domElement.dataset.serverMapViewerCanvas = "true";
    this.terrainMaterial = this.createTerrainMaterial();
    this.oceanFloorMesh = this.createOceanFloorMesh();
    this.scene.add(this.oceanFloorMesh);
    this.terrainMesh = this.createTerrainMesh();
    this.scene.add(this.terrainMesh);
    this.oceanWaveTexture = createOceanWaveTexture();
    this.oceanSurfaceMesh = this.createOceanSurfaceMesh();
    this.scene.add(this.oceanSurfaceMesh);
    this.gridLayer.name = "raidlands-rust-map-grid";
    this.gridLayer.add(createRustMapGridOverlay(this.terrain));
    this.gridLayer.visible = this.root.dataset.gridOverlay === "true";
    this.scene.add(this.gridLayer);
    this.heatmapLayer.name = "raidlands-heatmap-cloud-volume-layer";
    this.heatmapLayer.visible = false;
    this.scene.add(this.heatmapLayer);
    this.playerLocationLayer.name = "raidlands-player-location-layer";
    this.playerLocationLayer.visible = false;
    this.scene.add(this.playerLocationLayer);
    this.airstrikeLayer.name = "raidlands-airstrike-preview-layer";
    this.scene.add(this.airstrikeLayer);
    this.addMonuments();
    this.addLights();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = !this.lockCameraInput;
    this.controls.enableRotate = !this.lockCameraInput;
    this.controls.enablePan = !this.lockCameraInput;
    this.controls.enableZoom = !this.lockCameraInput;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = MathUtils.degToRad(84);
    this.controls.minDistance = Math.max(120, (this.terrain.worldSize || 4500) * 0.08);
    this.controls.maxDistance = Math.max(1600, (this.terrain.worldSize || 4500) * 1.4);
    (this.controls as OrbitControls & { zoomToCursor?: boolean }).zoomToCursor = true;
  }

  public mount(): void {
    this.root.appendChild(this.renderer.domElement);
    this.applyCameraPose(this.isoPose(false));
    if (this.tourEnabled) {
      this.startNextTour(performance.now(), true);
    }
    this.bindFloatingViewSelect();
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.animate();
    this.loadTexture();
    this.root.classList.add("is-loaded");
  }

  public dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Sprite || object instanceof LineSegments) {
        disposeGeometryMaterial(object as Mesh | Sprite | LineSegments);
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.root.classList.remove("is-loaded");
  }

  public setGridVisible(visible: boolean): void {
    this.gridLayer.visible = visible;
    this.updateGridOpacity();
  }

  public setTourEnabled(enabled: boolean): void {
    this.tourEnabled = enabled;
    this.controls.enabled = !enabled && !this.lockCameraInput;
    this.controls.enableRotate = !enabled && !this.lockCameraInput;
    this.controls.enablePan = !enabled && !this.lockCameraInput;
    this.controls.enableZoom = !enabled && !this.lockCameraInput;
    this.focusUntil = 0;
    if (enabled) {
      this.startNextTour(performance.now(), true);
      return;
    }

    this.transitionFrom = null;
    this.transitionTo = null;
  }

  public setHeatmapVisible(visible: boolean): void {
    this.heatmapLayer.visible = visible;
  }

  public setPlayerLocationsVisible(visible: boolean): void {
    this.playerLocationLayer.visible = visible;
  }

  public setHeatmap(payload: HeatmapPayload): void {
    const nextLayer = new Group();
    nextLayer.name = "heatmap-playback-frame";
    const buckets = Array.isArray(payload.buckets) ? payload.buckets : [];

    if (buckets.length === 0) {
      this.replaceOverlayLayer(this.heatmapLayer, nextLayer);
      return;
    }

    const texture = createHeatmapCloudTexture();
    const maxValue = Math.max(0.0001, Number(payload.maxValue) || Math.max(...buckets.map((bucket) => Number(bucket.value) || 0), 0.0001));

    buckets.slice(0, 900).forEach((bucket) => {
      const normalized = MathUtils.clamp(Number(bucket.normalized) || ((Number(bucket.value) || 0) / maxValue), 0, 1);

      if (normalized <= 0) {
        return;
      }

      const bucketPosition = rustWorldToViewerPosition(bucket.x, 0, bucket.z);
      const bucketSize = MathUtils.clamp(Number(bucket.bucketSize) || 100, 25, 1000);
      const height = MathUtils.lerp(44, Math.max(120, bucketSize * 1.7), Math.sqrt(normalized));
      const baseY = sampleTerrainHeight(this.terrain, bucketPosition.x, bucketPosition.z) + 18;
      const color = heatmapRampColor(normalized);
      const material = new SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity: MathUtils.lerp(0.18, 0.64, normalized),
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
      });

      for (let layer = 0; layer < 3; layer += 1) {
        const sprite = new Sprite(material.clone());
        const spread = 1 + layer * 0.26;
        sprite.name = "heatmap-cloud-column";
        sprite.position.set(bucketPosition.x, baseY + height * (0.24 + layer * 0.23), bucketPosition.z);
        sprite.scale.set(bucketSize * spread, height * (0.82 - layer * 0.12), 1);
        sprite.renderOrder = 12 + layer;
        nextLayer.add(sprite);
      }
    });
    this.replaceOverlayLayer(this.heatmapLayer, nextLayer);
  }

  public setPlayerLocations(payload: PlayerLocationPayload): void {
    const nextLayer = new Group();
    nextLayer.name = "player-location-playback-frame";
    const players = Array.isArray(payload.players) ? payload.players : [];
    this.selfLocation = players.find((player) => player.isSelf === true) || null;

    players.slice(0, 80).forEach((player) => {
      const x = Number(player.x);
      const z = Number(player.z);

      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return;
      }

      const isSelf = player.isSelf === true;
      const playerPosition = rustWorldToViewerPosition(x, Number(player.y) || 0, z);
      const y = Math.max(playerPosition.y, sampleTerrainHeight(this.terrain, playerPosition.x, playerPosition.z)) + (isSelf ? 72 : 58);
      const sprite = new Sprite(new SpriteMaterial({
        map: createPlayerLocationTexture(player, isSelf),
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }));
      const size = isSelf ? 135 : 112;
      sprite.name = isSelf ? "raidlands-player-location-self" : "raidlands-player-location-clan";
      sprite.position.set(playerPosition.x, y, playerPosition.z);
      sprite.scale.set(size, size, 1);
      sprite.userData.baseScale = size;
      sprite.renderOrder = isSelf ? 42 : 40;
      nextLayer.add(sprite);
    });
    this.replaceOverlayLayer(this.playerLocationLayer, nextLayer, 0);
  }

  public hasSelfLocation(): boolean {
    return this.selfLocation !== null;
  }

  public frameSelfLocation(): boolean {
    const player = this.selfLocation;

    if (!player) {
      return false;
    }

    const x = Number(player.x);
    const z = Number(player.z);

    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return false;
    }

    this.setPlayerLocationsVisible(true);
    const worldSize = this.terrain.worldSize || 4500;
    const playerPosition = rustWorldToViewerPosition(x, Number(player.y) || 0, z);
    const ground = Math.max(playerPosition.y, sampleTerrainHeight(this.terrain, playerPosition.x, playerPosition.z));
    const target = new Vector3(playerPosition.x, ground + 42, playerPosition.z);
    const cameraOffset = MathUtils.clamp(worldSize * 0.085, 280, 560);

    this.focusCamera({
      position: new Vector3(playerPosition.x - cameraOffset * 0.62, ground + cameraOffset * 0.72, playerPosition.z + cameraOffset * 0.78),
      target,
      up: new Vector3(0, 1, 0),
    });

    return true;
  }

  public addAirstrikePreview(profiles: RuntimeVisualProfile[]): void {
    if (profiles.length === 0) {
      return;
    }

    const player = new AirstrikePreviewPlayer(this.airstrikeLayer, this.terrain, profiles);
    player.start();
  }

  public frameIso(cycle = true): void {
    this.focusCamera(this.isoPose(cycle));
  }

  private isoPose(cycle = true): CameraPose {
    const size = this.terrain.worldSize || 4500;
    const height = Math.max(220, (this.terrain.maxHeight || 220) - Math.min(this.terrain.minHeight || 0, 0));
    if (cycle) {
      this.isoViewIndex = (this.isoViewIndex + 1) % isoViewDirections.length;
    } else {
      this.isoViewIndex = 0;
    }
    const direction = isoViewDirections[this.isoViewIndex] || isoViewDirections[0]!;
    return {
      position: new Vector3(size * direction.x, size * direction.y, size * direction.z),
      target: new Vector3(0, height * 0.22, 0),
      up: new Vector3(0, 1, 0),
    };
  }

  public frameTop(): void {
    const size = this.terrain.worldSize || 4500;
    this.focusCamera({
      position: new Vector3(0, size * 0.86, 0.001),
      target: new Vector3(0, 0, 0),
      up: new Vector3(0, 0, 1),
    });
  }

  public setView(view: MapView): void {
    if (view === "top") {
      this.frameTop();
      return;
    }
    this.frameIso();
  }

  private bindFloatingViewSelect(): void {
    const controls = document.createElement("div");
    controls.className = "server-terrain-view-select";
    controls.setAttribute("aria-label", "Map view");
    controls.innerHTML = `
      <button type="button" data-map-view="iso" aria-pressed="true" aria-label="Home view" title="Home view">
        <span aria-hidden="true">Home</span>
      </button>
      <button type="button" data-map-view="top" aria-pressed="false" aria-label="Top view" title="Top view">
        <span aria-hidden="true">Top</span>
      </button>
    `;
    this.root.appendChild(controls);
    bindMapViewButtons(Array.from(controls.querySelectorAll<HTMLButtonElement>("[data-map-view]")), this);
  }

  private createTerrainMesh(): Mesh {
    const resolution = this.terrain.resolution;
    const worldSize = this.terrain.worldSize || 4500;
    const half = worldSize / 2;
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let row = 0; row < resolution; row += 1) {
      const v = row / (resolution - 1);
      const z = half - v * worldSize;

      for (let col = 0; col < resolution; col += 1) {
        const u = col / (resolution - 1);
        const x = -half + u * worldSize;
        // RustMapApi's terrain grid is mirrored on its X axis relative to its map render.
        // Keep the texture and world coordinates north-up/east-right, but read the matching
        // height and fallback colour from the reflected source column.
        const index = row * resolution + (resolution - 1 - col);
        positions.push(x, this.terrain.heights[index] || 0, z);
        // The Rust map image reaches WebGL with its horizontal axis reversed.
        // Mirror the texture coordinates to align its coastline with the terrain grid.
        uvs.push(1 - u, 1 - v);
        pushColor(colors, this.terrain.colors?.[index], this.terrain.heights[index] || 0, this.terrain);
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

    const mesh = new Mesh(geometry, this.terrainMaterial);
    mesh.name = "raidlands-current-wipe-terrain";
    return mesh;
  }

  private createTerrainMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
    });
  }

  private createOceanFloorMesh(): Mesh {
    const worldSize = this.terrain.worldSize || 4500;
    const sampledMinHeight = Number.isFinite(this.terrain.minHeight)
      ? this.terrain.minHeight || 0
      : Math.min(...this.terrain.heights.filter((height) => Number.isFinite(height)));
    const oceanFloorHeight = Number.isFinite(sampledMinHeight) ? sampledMinHeight - 3 : -12;
    const oceanSize = worldSize * 6;
    const geometry = new PlaneGeometry(oceanSize, oceanSize, 1, 1);
    const material = new MeshStandardMaterial({
      color: 0x063646,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: 0.94,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "raidlands-infinite-ocean-floor";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = oceanFloorHeight;
    mesh.renderOrder = -10;
    return mesh;
  }

  private createOceanSurfaceMesh(): Mesh {
    const worldSize = this.terrain.worldSize || 4500;
    const oceanSize = worldSize * 6;
    const waterLevel = resolveOceanWaterLevel(this.terrain);
    const geometry = new PlaneGeometry(oceanSize, oceanSize, 1, 1);
    const material = new MeshStandardMaterial({
      color: 0x0a4f63,
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      map: this.oceanWaveTexture,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = "raidlands-infinite-ocean-surface";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = waterLevel + 0.08;
    mesh.renderOrder = -8;
    return mesh;
  }

  private updateOceanPlanes(now: number): void {
    const anchorX = this.camera.position.x;
    const anchorZ = this.camera.position.z;
    this.oceanSurfaceMesh.position.x = anchorX;
    this.oceanSurfaceMesh.position.z = anchorZ;
    this.oceanFloorMesh.position.x = anchorX;
    this.oceanFloorMesh.position.z = anchorZ;
    this.oceanWaveTexture.offset.set((now * 0.000018) % 1, (now * 0.000011) % 1);
  }

  private loadTexture(): void {
    if (!this.textureUrl) {
      return;
    }

    const loader = new TextureLoader();
    loader.load(
      this.textureUrl,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        this.terrainMaterial.map = texture;
        this.terrainMaterial.color.set(0xf2f0e7);
        this.terrainMaterial.roughness = 0.82;
        this.terrainMaterial.vertexColors = false;
        this.terrainMaterial.needsUpdate = true;
      },
      undefined,
      () => setStatus(this.status, ""),
    );
  }

  private addMonuments(): void {
    const monuments = this.terrain.monuments || [];

    if (monuments.length === 0) {
      return;
    }

    const layer = new Group();
    layer.name = "raidlands-monument-primitives";

    monuments.forEach((monument) => {
      const group = createMonumentPrimitive(monument);
      const monumentPosition = rustWorldToViewerPosition(monument.x, monument.y, monument.z);
      const terrainHeight = sampleTerrainHeight(this.terrain, monumentPosition.x, monumentPosition.z);
      group.position.set(monumentPosition.x, Math.max(monumentPosition.y, terrainHeight) + 5, monumentPosition.z);
      group.rotation.y = -MathUtils.degToRad(monument.rotationY || 0);
      layer.add(group);
    });

    this.scene.add(layer);
  }

  private addLights(): void {
    const ambient = new AmbientLight(0xffead2, 0.38);
    const sun = new DirectionalLight(0xffc47a, 1.78);
    sun.position.set(900, 1400, 650);
    const fill = new DirectionalLight(0x9fc7dd, 0.18);
    fill.position.set(-500, 500, -800);
    this.scene.add(ambient, sun, fill);
  }

  private resize(): void {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate(): void {
    this.animationFrame = window.requestAnimationFrame(() => this.animate());
    const now = performance.now();
    this.updateCameraTour(now);
    this.controls.update();
    this.updateOverlayLayerTransitions(now);
    this.updateGridOpacity();
    this.updateOceanPlanes(now);
    this.airstrikeLayer.userData.tick?.((now - this.clockStart) / 1000);
    this.renderer.render(this.scene, this.camera);
  }

  private replaceOverlayLayer(parent: Group, incoming: Group, durationMs = 360): void {
    const existingTransitions = this.overlayLayerTransitions.filter((transition) => transition.incoming.parent === parent || transition.outgoing?.parent === parent);
    existingTransitions.forEach((transition) => {
      if (transition.incoming.parent) {
        transition.incoming.parent.remove(transition.incoming);
        disposeObjectTree(transition.incoming);
      }
      if (transition.outgoing?.parent) {
        transition.outgoing.parent.remove(transition.outgoing);
        disposeObjectTree(transition.outgoing);
      }
    });
    for (let index = this.overlayLayerTransitions.length - 1; index >= 0; index -= 1) {
      if (existingTransitions.includes(this.overlayLayerTransitions[index]!)) {
        this.overlayLayerTransitions.splice(index, 1);
      }
    }
    const outgoing = parent.children.find((child): child is Group => child instanceof Group) || null;

    if (durationMs <= 0) {
      if (outgoing) {
        parent.remove(outgoing);
        disposeObjectTree(outgoing);
      }
      setObjectOpacity(incoming, 1);
      parent.add(incoming);
      return;
    }

    setObjectOpacity(incoming, 0);
    parent.add(incoming);
    this.overlayLayerTransitions.push({
      incoming,
      outgoing,
      startedAt: performance.now(),
      durationMs,
    });
  }

  private updateOverlayLayerTransitions(now: number): void {
    for (let index = this.overlayLayerTransitions.length - 1; index >= 0; index -= 1) {
      const transition = this.overlayLayerTransitions[index]!;
      const progress = MathUtils.clamp((now - transition.startedAt) / Math.max(1, transition.durationMs), 0, 1);
      const eased = MathUtils.smoothstep(progress, 0, 1);
      setObjectOpacity(transition.incoming, eased);

      if (transition.outgoing) {
        setObjectOpacity(transition.outgoing, 1 - eased);
      }

      if (progress >= 1) {
        if (transition.outgoing && transition.outgoing.parent) {
          transition.outgoing.parent.remove(transition.outgoing);
          disposeObjectTree(transition.outgoing);
        }
        setObjectOpacity(transition.incoming, 1);
        this.overlayLayerTransitions.splice(index, 1);
      }
    }
  }

  private focusCamera(pose: CameraPose): void {
    this.transitionFrom = this.currentPose();
    this.transitionTo = clonePose(pose);
    this.transitionStartedAt = performance.now();
    this.transitionDuration = 1350;
    this.activePose = null;
    this.focusUntil = performance.now() + 15000;
  }

  private updateCameraTour(now: number): void {
    if (this.transitionTo) {
      const progress = MathUtils.clamp((now - this.transitionStartedAt) / Math.max(1, this.transitionDuration), 0, 1);
      const eased = easeInOutCubic(progress);
      const from = this.transitionFrom || this.currentPose();
      const pose = interpolatePose(from, this.transitionTo, eased);
      this.applyCameraPose(pose);
      if (progress >= 1) {
        this.transitionFrom = null;
        this.transitionTo = null;
      }
      return;
    }

    if (now < this.focusUntil) {
      return;
    }

    if (!this.tourEnabled) {
      return;
    }

    if (this.focusUntil > 0) {
      this.focusUntil = 0;
      this.startNextTour(now, true);
    }

    const elapsed = now - this.tourStartedAt;
    if (elapsed >= this.tourDuration) {
      if (this.tourStyle === "orbit") {
        this.tourStartedAt += this.tourDuration * Math.floor(elapsed / this.tourDuration);
        this.activePose = null;
        return;
      }

      this.startNextTour(now, true);
      return;
    }

    const progress = MathUtils.clamp(elapsed / this.tourDuration, 0, 1);
    const pose = this.tourPose(progress);
    const easeIn = MathUtils.smoothstep(MathUtils.clamp(elapsed / 2200, 0, 1), 0, 1);

    if (this.activePose) {
      pose.position.lerpVectors(this.activePose.position, pose.position, easeIn);
      pose.target.lerpVectors(this.activePose.target, pose.target, easeIn);
      pose.up.lerpVectors(this.activePose.up, pose.up, easeIn).normalize();
      if (easeIn >= 0.995) {
        this.activePose = null;
      }
    }

    this.applyCameraPose(pose);
  }

  private startNextTour(now: number, blendFromCurrent: boolean): void {
    if (this.tourStyle === "orbit") {
      this.tourKind = "home-orbit";
      this.tourStartedAt = now;
      this.tourDuration = 32000;
      this.activePose = blendFromCurrent ? this.currentPose() : null;
      return;
    }

    const kinds: CameraTourKind[] = ["coastal-sweep", "ridge-crossing", "monument-orbit", "map-run"];
    this.tourIndex = (this.tourIndex + 1) % kinds.length;
    this.tourKind = kinds[this.tourIndex] || "coastal-sweep";
    this.tourStartedAt = now;
    this.tourDuration = this.tourKind === "map-run" ? 21000 : 18000;
    this.activePose = blendFromCurrent ? this.currentPose() : null;
  }

  private tourPose(progress: number): CameraPose {
    const worldSize = this.terrain.worldSize || 4500;
    const half = worldSize / 2;
    const angle = progress * Math.PI * 2;
    const water = resolveOceanWaterLevel(this.terrain);
    const baseTargetHeight = Math.max(50, water + 26);

    if (this.tourKind === "home-orbit") {
      const target = new Vector3(0, baseTargetHeight + worldSize * 0.012, 0);
      const radius = half * 0.82;
      return this.aboveTerrainPose(
        new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        target,
        worldSize * 0.16,
      );
    }

    if (this.tourKind === "ridge-crossing") {
      const x = MathUtils.lerp(-half * 0.72, half * 0.72, progress);
      const z = Math.sin(progress * Math.PI * 1.5) * half * 0.44;
      const lookX = MathUtils.lerp(-half * 0.25, half * 0.25, progress);
      const lookZ = z - half * 0.22;
      return this.aboveTerrainPose(
        new Vector3(x, 0, z),
        new Vector3(lookX, baseTargetHeight, lookZ),
        worldSize * 0.11,
      );
    }

    if (this.tourKind === "monument-orbit") {
      const monument = this.featuredMonument();
      const monumentPosition = monument ? rustWorldToViewerPosition(monument.x, monument.y, monument.z) : null;
      const center = monument
        ? new Vector3(monumentPosition!.x, sampleTerrainHeight(this.terrain, monumentPosition!.x, monumentPosition!.z) + Math.max(40, monument.radius * 0.45), monumentPosition!.z)
        : new Vector3(0, baseTargetHeight, 0);
      const radius = monument ? MathUtils.clamp(monument.radius * 5.2, worldSize * 0.12, worldSize * 0.32) : worldSize * 0.28;
      return this.aboveTerrainPose(
        new Vector3(center.x + Math.cos(angle) * radius, 0, center.z + Math.sin(angle) * radius),
        center,
        worldSize * 0.095,
      );
    }

    if (this.tourKind === "map-run") {
      const x = Math.sin(progress * Math.PI * 2.2) * half * 0.64;
      const z = MathUtils.lerp(half * 0.68, -half * 0.68, progress);
      const lookAheadZ = MathUtils.clamp(z - worldSize * 0.2, -half, half);
      return this.aboveTerrainPose(
        new Vector3(x, 0, z),
        new Vector3(x * 0.55, baseTargetHeight, lookAheadZ),
        worldSize * 0.08,
      );
    }

    return this.aboveTerrainPose(
      new Vector3(Math.cos(angle) * half * 0.76, 0, Math.sin(angle) * half * 0.76),
      new Vector3(Math.cos(angle + 0.52) * half * 0.2, baseTargetHeight, Math.sin(angle + 0.52) * half * 0.2),
      worldSize * 0.13,
    );
  }

  private aboveTerrainPose(position: Vector3, target: Vector3, clearance: number): CameraPose {
    const worldSize = this.terrain.worldSize || 4500;
    const ground = sampleTerrainHeight(this.terrain, position.x, position.z);
    const targetGround = sampleTerrainHeight(this.terrain, target.x, target.z);
    const targetY = Math.max(target.y, targetGround + 28);
    const cameraY = Math.max(ground + clearance, targetY + worldSize * 0.035);

    return {
      position: new Vector3(position.x, cameraY, position.z),
      target: new Vector3(target.x, targetY, target.z),
      up: new Vector3(0, 1, 0),
    };
  }

  private featuredMonument(): MonumentPayload | null {
    const monuments = this.terrain.monuments || [];
    if (monuments.length === 0) {
      return null;
    }

    return monuments.reduce((best, monument) => monument.radius > best.radius ? monument : best, monuments[0]!);
  }

  private currentPose(): CameraPose {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      up: this.camera.up.clone(),
    };
  }

  private applyCameraPose(pose: CameraPose): void {
    this.camera.position.copy(pose.position);
    this.camera.up.copy(pose.up);
    this.controls.target.copy(pose.target);
    this.camera.lookAt(this.controls.target);
  }

  private updateGridOpacity(): void {
    if (!this.gridLayer.visible) {
      return;
    }

    const cameraDirection = this.camera.position.clone().sub(this.controls.target).normalize();
    const topDownAmount = MathUtils.clamp(cameraDirection.dot(new Vector3(0, 1, 0)), 0, 1);
    const fade = MathUtils.smoothstep(topDownAmount, 0.62, 0.96);
    const lineOpacity = MathUtils.lerp(0.1, 0.48, fade);
    const labelOpacity = MathUtils.lerp(0.34, 1, fade);
    const worldSize = this.terrain.worldSize || 4500;
    const gridFadeNear = worldSize * 0.16;
    const gridFadeFar = worldSize * 0.58;

    this.gridLayer.traverse((object) => {
      const fadePosition = object.userData.fadePosition as Vector3 | undefined;
      const groundDistance = Math.hypot(
        (fadePosition?.x ?? object.position.x) - this.camera.position.x,
        (fadePosition?.z ?? object.position.z) - this.camera.position.z,
      );
      const distanceFade = 1 - MathUtils.smoothstep(groundDistance, gridFadeNear, gridFadeFar);

      if (object instanceof LineSegments) {
        setMaterialOpacity(object.material, lineOpacity * distanceFade);
        return;
      }

      if (object instanceof Sprite) {
        setMaterialOpacity(object.material, labelOpacity * distanceFade);
      }
    });
  }
}

class AirstrikePreviewPlayer {
  private readonly layer: Group;
  private readonly terrain: TerrainPayload;
  private readonly profiles: RuntimeVisualProfile[];
  private readonly active = new Group();
  private nextStartAt = 0;
  private runs: AirstrikeRun[] = [];

  public constructor(layer: Group, terrain: TerrainPayload, profiles: RuntimeVisualProfile[]) {
    this.layer = layer;
    this.terrain = terrain;
    this.profiles = profiles;
    this.active.name = "active-airstrike-previews";
    this.layer.add(this.active);
  }

  public start(): void {
    this.layer.userData.tick = (time: number) => this.tick(time);
  }

  private tick(time: number): void {
    this.runs = this.runs.filter((run) => {
      const alive = run.update(time);
      if (!alive) {
        this.active.remove(run.group);
      }
      return alive;
    });

    if (this.runs.length > 0 || time < this.nextStartAt || Math.random() > 0.96) {
      return;
    }

    const count = Math.random() > 0.72 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const profile = randomEntry(this.profiles);
      if (!profile) {
        continue;
      }

      const run = new AirstrikeRun(profile, this.terrain, time + index * (0.35 + Math.random() * 0.55), index);
      this.runs.push(run);
      this.active.add(run.group);
    }

    this.nextStartAt = time + 1.6 + Math.random() * 2.8;
  }
}

class AirstrikeRun {
  public readonly group = new Group();
  private readonly profile: RuntimeVisualProfile;
  private readonly terrain: TerrainPayload;
  private readonly startAt: number;
  private readonly duration: number;
  private readonly frames: RuntimeVisualFrame[];
  private readonly aircraft: Mesh;
  private readonly payloads: RuntimePayloadEvent[];
  private readonly firedPayloads = new Set<number>();
  private readonly origin: Vector3;
  private readonly routeScale: number;

  public constructor(profile: RuntimeVisualProfile, terrain: TerrainPayload, startAt: number, lane: number) {
    this.profile = profile;
    this.terrain = terrain;
    this.startAt = startAt;
    this.frames = normalizePreviewFrames(profile);
    this.duration = Math.max(2, Number(profile.CompiledTrack?.DurationSeconds || profile.DurationSeconds || lastFrameTime(this.frames) || 8));
    this.payloads = normalizePayloadEvents(profile);
    this.origin = randomMapOrigin(terrain, lane);
    this.routeScale = MathUtils.clamp((terrain.worldSize || 4500) / 1200, 2.2, 5.4);
    this.group.name = `airstrike-preview-${String(profile.Vehicle || "aircraft")}`;
    this.aircraft = createAircraftMarker(String(profile.Vehicle || "f15"));
    this.group.add(this.aircraft);
  }

  public update(now: number): boolean {
    const elapsed = now - this.startAt;
    if (elapsed < 0) {
      this.group.visible = false;
      return true;
    }

    this.group.visible = true;
    if (elapsed > this.duration + 2.2) {
      return false;
    }

    const pose = samplePreviewPose(this.frames, Math.min(elapsed, this.duration));
    const world = this.toWorld(pose.position);
    world.y = Math.max(world.y, sampleTerrainHeight(this.terrain, world.x, world.z) + 95);
    this.aircraft.position.copy(world);
    this.aircraft.quaternion.copy(pose.rotation);
    this.aircraft.rotateY(Math.PI);

    this.payloads.forEach((payload, index) => {
      if (!this.firedPayloads.has(index) && elapsed >= Number(payload.Time || 0)) {
        this.firedPayloads.add(index);
        this.group.add(createPayloadFlash(this.toWorld(new Vector3(
          pose.position.x + Number(payload.CarrierOffsetX || 0),
          pose.position.y + Number(payload.CarrierOffsetY || 0),
          pose.position.z + Number(payload.CarrierOffsetZ || 0),
        )), now));
      }
    });

    this.group.children.forEach((child) => {
      if (child.userData.flashStart === undefined) {
        return;
      }
      const age = now - Number(child.userData.flashStart);
      child.scale.setScalar(Math.max(0.01, 1 + age * 3.8));
      const material = (child as Mesh).material;
      if (material instanceof MeshStandardMaterial) {
        material.opacity = Math.max(0, 1 - age / 0.9);
      }
      if (age > 0.9) {
        this.group.remove(child);
      }
    });

    return true;
  }

  private toWorld(local: Vector3): Vector3 {
    return new Vector3(
      this.origin.x + local.x * this.routeScale,
      this.origin.y + local.y * this.routeScale,
      this.origin.z + local.z * this.routeScale,
    );
  }
}

async function bindAirstrikePreview(root: HTMLElement, viewer: TerrainViewer): Promise<void> {
  const profilesUrl = root.dataset.airstrikeProfilesUrl || "";
  if (!profilesUrl) {
    return;
  }

  try {
    const response = await fetch(profilesUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Airstrike profile request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json() as { profiles?: Record<string, RuntimeVisualProfile> };
    const profiles = Object.values(payload.profiles || {}).filter(hasUsablePreviewTrack).slice(0, 48);
    viewer.addAirstrikePreview(profiles);
  } catch (error) {
    console.info("Raidlands airstrike map preview could not be loaded.", error);
  }
}

function hasUsablePreviewTrack(profile: RuntimeVisualProfile): boolean {
  return normalizePreviewFrames(profile).length >= 2;
}

function normalizePreviewFrames(profile: RuntimeVisualProfile): RuntimeVisualFrame[] {
  const frames = Array.isArray(profile.CompiledTrack?.Frames) ? profile.CompiledTrack.Frames : [];
  return frames
    .map((frame) => ({
      Time: Number(frame.Time),
      X: Number(frame.X),
      Y: Number(frame.Y),
      Z: Number(frame.Z),
      Qx: Number(frame.Qx),
      Qy: Number(frame.Qy),
      Qz: Number(frame.Qz),
      Qw: Number(frame.Qw),
    }))
    .filter((frame) => [
      frame.Time,
      frame.X,
      frame.Y,
      frame.Z,
      frame.Qx,
      frame.Qy,
      frame.Qz,
      frame.Qw,
    ].every(Number.isFinite))
    .sort((a, b) => a.Time - b.Time);
}

function normalizePayloadEvents(profile: RuntimeVisualProfile): RuntimePayloadEvent[] {
  const source = Array.isArray(profile.CompiledReleaseEvents) && profile.CompiledReleaseEvents.length > 0
    ? profile.CompiledReleaseEvents
    : Array.isArray(profile.PayloadEvents)
      ? profile.PayloadEvents
      : [];

  return source
    .map((event) => ({
      Time: Number(event.Time),
      CarrierOffsetX: Number(event.CarrierOffsetX || 0),
      CarrierOffsetY: Number(event.CarrierOffsetY || 0),
      CarrierOffsetZ: Number(event.CarrierOffsetZ || 0),
    }))
    .filter((event) => Number.isFinite(event.Time))
    .slice(0, 16);
}

function samplePreviewPose(frames: RuntimeVisualFrame[], time: number): { position: Vector3; rotation: Quaternion } {
  if (frames.length === 0) {
    return { position: new Vector3(), rotation: new Quaternion() };
  }

  if (time <= frames[0].Time) {
    return framePose(frames[0]);
  }

  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index];
    const previous = frames[index - 1];
    if (time <= frame.Time) {
      const progress = MathUtils.clamp((time - previous.Time) / Math.max(0.001, frame.Time - previous.Time), 0, 1);
      const position = frameVector(previous).lerp(frameVector(frame), progress);
      const rotation = frameQuaternion(previous).slerp(frameQuaternion(frame), progress);
      return { position, rotation };
    }
  }

  return framePose(frames[frames.length - 1]);
}

function framePose(frame: RuntimeVisualFrame): { position: Vector3; rotation: Quaternion } {
  return {
    position: frameVector(frame),
    rotation: frameQuaternion(frame),
  };
}

function frameVector(frame: RuntimeVisualFrame): Vector3 {
  return new Vector3(frame.X, frame.Y, frame.Z);
}

function frameQuaternion(frame: RuntimeVisualFrame): Quaternion {
  return new Quaternion(frame.Qx, frame.Qy, frame.Qz, frame.Qw).normalize();
}

function lastFrameTime(frames: RuntimeVisualFrame[]): number {
  return frames.length > 0 ? Number(frames[frames.length - 1].Time || 0) : 0;
}

function randomEntry<T>(values: T[]): T | null {
  if (values.length === 0) {
    return null;
  }

  return values[Math.floor(Math.random() * values.length)] || null;
}

function clonePose(pose: CameraPose): CameraPose {
  return {
    position: pose.position.clone(),
    target: pose.target.clone(),
    up: pose.up.clone(),
  };
}

function interpolatePose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  return {
    position: from.position.clone().lerp(to.position, progress),
    target: from.target.clone().lerp(to.target, progress),
    up: from.up.clone().lerp(to.up, progress).normalize(),
  };
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

function randomMapOrigin(terrain: TerrainPayload, lane: number): Vector3 {
  const worldSize = terrain.worldSize || 4500;
  const span = worldSize * 0.44;
  const x = (Math.random() - 0.5) * span + (lane === 0 ? -worldSize * 0.1 : worldSize * 0.1);
  const z = (Math.random() - 0.5) * span;
  return new Vector3(x, sampleTerrainHeight(terrain, x, z), z);
}

function createAircraftMarker(vehicle: string): Mesh {
  const geometry = new ConeGeometry(vehicle.includes("heli") ? 22 : 16, vehicle.includes("heli") ? 46 : 64, 3);
  const material = new MeshStandardMaterial({
    color: vehicle.includes("drone") ? 0xd8d2c5 : 0xf0a33a,
    emissive: 0x4a1b08,
    emissiveIntensity: 0.36,
    roughness: 0.42,
    metalness: 0.18,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "airstrike-preview-aircraft";
  mesh.rotation.x = MathUtils.degToRad(90);
  return mesh;
}

function createPayloadFlash(position: Vector3, startTime: number): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(18, 18, 12),
    new MeshStandardMaterial({
      color: 0xff9d28,
      emissive: 0xff5a12,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  mesh.name = "airstrike-preview-payload-flash";
  mesh.position.copy(position);
  mesh.userData.flashStart = startTime;
  return mesh;
}

function createMonumentPrimitive(monument: MonumentPayload): Group {
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
    addBox(group, size * 0.34, 16, size * 0.28, 0x7f6b45, size * 0.48, 10, size * 0.26);
    return addTitle();
  }

  if (key.includes("launch")) {
    addBox(group, size * 1.35, 9, size * 0.82, 0x353b3a, 0, 4, 0);
    addCylinder(group, size * 0.12, size * 1.05, 0x9fafa8, -size * 0.15, size * 0.55, 0);
    addCone(group, size * 0.2, size * 0.34, 0xb86f3f, -size * 0.15, size * 1.24, 0);
    addBox(group, size * 0.2, size * 0.78, size * 0.2, 0x6f5f48, size * 0.28, size * 0.42, 0);
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
    addBox(group, size * 0.86, 4, size * 0.16, 0x3f4543, 0, 2, -size * 0.24);
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
    addBox(group, size * 0.18, size * 0.65, size * 0.18, 0x808783, size * 0.34, size * 0.38, size * 0.2);
    addCylinder(group, size * 0.05, size * 0.88, 0xe0b35f, 0, size * 0.5, 0);
    return addTitle();
  }

  if (key.includes("harbor")) {
    addBox(group, size * 1.4, 7, size * 0.28, 0x3e484a, 0, 4, 0);
    addBox(group, size * 0.24, size * 0.58, size * 0.24, 0x8b7044, -size * 0.42, size * 0.32, -size * 0.08);
    addBox(group, size * 0.18, size * 0.46, size * 0.18, 0x8b7044, size * 0.36, size * 0.26, size * 0.12);
    return addTitle();
  }

  if (key.includes("powerplant") || key.includes("power_plant")) {
    addBox(group, size * 0.92, size * 0.2, size * 0.62, 0x5b605c, 0, size * 0.1, 0);
    addCylinder(group, size * 0.09, size * 0.92, 0x9a9a90, -size * 0.24, size * 0.55, 0);
    addCylinder(group, size * 0.09, size * 0.72, 0x9a9a90, 0, size * 0.45, 0);
    addCylinder(group, size * 0.09, size * 0.82, 0x9a9a90, size * 0.24, size * 0.5, 0);
    return addTitle();
  }

  if (key.includes("excavator")) {
    addBox(group, size * 0.7, size * 0.26, size * 0.5, 0x6f5b35, -size * 0.15, size * 0.13, 0);
    const arm = addBox(group, size * 0.92, size * 0.08, size * 0.12, 0xc59a4a, size * 0.32, size * 0.48, 0);
    arm.rotation.z = MathUtils.degToRad(-24);
    addCylinder(group, size * 0.18, size * 0.28, 0x2f3332, -size * 0.36, size * 0.15, -size * 0.18);
    addCylinder(group, size * 0.18, size * 0.28, 0x2f3332, -size * 0.36, size * 0.15, size * 0.18);
    return addTitle();
  }

  if (key.includes("trainyard") || key.includes("train_yard")) {
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, -size * 0.22);
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, size * 0.22);
    addBox(group, size * 0.72, size * 0.32, size * 0.34, 0x6f5f48, -size * 0.18, size * 0.18, 0);
    addBox(group, size * 0.34, size * 0.42, size * 0.28, 0x7f6b45, size * 0.38, size * 0.24, 0);
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
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  const worldWidth = MathUtils.clamp(size * 1.35, 80, 230);
  sprite.name = "monument-title";
  sprite.position.set(0, Math.max(size * 1.48, 64), 0);
  sprite.scale.set(worldWidth, worldWidth * (canvas.height / canvas.width), 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createRustMapGridOverlay(terrain: TerrainPayload): Group {
  const group = new Group();
  const worldSize = terrain.worldSize || 4500;
  const half = worldSize / 2;
  const cells = rustGridCellCount(worldSize);
  const cellSize = worldSize / cells;
  const yOffset = Math.max(8, worldSize * 0.002);
  const lineMaterialOptions = {
    color: 0x050607,
    transparent: true,
    opacity: 0.48,
    depthTest: false,
    depthWrite: false,
  };

  for (let index = 0; index <= cells; index += 1) {
    const coord = MathUtils.clamp(-half + index * cellSize, -half, half);
    group.add(createGridLineSegment([coord, yOffset, half, coord, yOffset, -half], coord, 0, lineMaterialOptions));
    group.add(createGridLineSegment([-half, yOffset, coord, half, yOffset, coord], 0, coord, lineMaterialOptions));
  }

  const labelSize = MathUtils.clamp(cellSize * 0.34, 54, 92);
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const label = `${rustGridColumnLabel(col)}${row + 1}`;
      const x = -half + col * cellSize + cellSize * 0.5;
      const z = half - row * cellSize - cellSize * 0.5;
      const viewerPosition = rustWorldToViewerPosition(x, yOffset + 24, z);
      group.add(createGridLabelSprite(label, labelSize, viewerPosition.x, viewerPosition.z, viewerPosition.y));
    }
  }

  return group;
}

function createGridLineSegment(positions: number[], fadeX: number, fadeZ: number, materialOptions: ConstructorParameters<typeof LineBasicMaterial>[0]): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const line = new LineSegments(geometry, new LineBasicMaterial(materialOptions));
  line.name = "rust-grid-line";
  line.renderOrder = 30;
  line.userData.fadePosition = new Vector3(fadeX, 0, fadeZ);
  return line;
}

function rustGridCellCount(worldSize: number): number {
  return Math.max(1, Math.round(worldSize / rustGridCellSize(worldSize)));
}

function rustGridCellSize(worldSize: number): number {
  if (worldSize <= 2000) {
    return 100;
  }

  return 250;
}

function rustGridColumnLabel(index: number): string {
  let value = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return label;
}

function createGridLabelSprite(label: string, size: number, x: number, z: number, y: number): Sprite {
  const fontSize = 42;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return new Sprite(new SpriteMaterial({ color: 0x050607 }));
  }

  canvas.width = 160;
  canvas.height = 128;
  context.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.shadowColor = "rgba(0, 0, 0, 0.62)";
  context.shadowBlur = 6;
  context.strokeStyle = "rgba(3, 5, 6, 0.88)";
  context.lineWidth = 9;
  context.strokeText(label, canvas.width / 2, 64);
  context.fillStyle = "rgba(255, 246, 218, 0.96)";
  context.fillText(label, canvas.width / 2, 64);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  sprite.name = `rust-grid-label-${label}`;
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 31;
  return sprite;
}

function createHeatmapCloudTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.86)");
    gradient.addColorStop(0.34, "rgba(255,255,255,0.42)");
    gradient.addColorStop(0.68, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createPlayerLocationTexture(player: PlayerLocation, isSelf: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  const clan = String(player.clanTag || "").slice(0, 6).toUpperCase();
  const name = String(player.displayName || (isSelf ? "You" : "Clan")).trim();
  const label = isSelf ? "YOU" : (clan || initialsForPlayer(name));
  const fill = isSelf ? "#ffb23f" : "#39d98a";
  const stroke = isSelf ? "#fff7d6" : "#d7ffe7";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = 18;
  context.fillStyle = "rgba(5, 6, 7, 0.78)";
  context.beginPath();
  context.arc(96, 82, 58, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 8;
  context.strokeStyle = fill;
  context.stroke();

  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(96, 176);
  context.lineTo(68, 128);
  context.lineTo(124, 128);
  context.closePath();
  context.fill();

  context.fillStyle = stroke;
  context.font = `900 ${label.length > 3 ? 28 : 36}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 96, 78, 92);

  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.font = "800 18px Arial, sans-serif";
  context.fillText(name || label, 96, 118, 124);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function initialsForPlayer(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "CL";
  }

  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
}

function heatmapRampColor(value: number): Color {
  const t = MathUtils.clamp(value, 0, 1);
  const low = new Color(0x2f80ff);
  const green = new Color(0x39d98a);
  const amber = new Color(0xffb23f);
  const hot = new Color(0xff3b30);
  const white = new Color(0xfff7d6);

  if (t < 0.35) {
    return low.lerp(green, MathUtils.smoothstep(t / 0.35, 0, 1));
  }

  if (t < 0.62) {
    return green.lerp(amber, MathUtils.smoothstep((t - 0.35) / 0.27, 0, 1));
  }

  if (t < 0.86) {
    return amber.lerp(hot, MathUtils.smoothstep((t - 0.62) / 0.24, 0, 1));
  }

  return hot.lerp(white, MathUtils.smoothstep((t - 0.86) / 0.14, 0, 1));
}

function setMaterialOpacity(material: Material | Material[], opacity: number): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => setMaterialOpacity(entry, opacity));
    return;
  }

  material.opacity = opacity;
  material.transparent = true;
}

function setObjectOpacity(object: Group | Mesh | Sprite | LineSegments, opacity: number): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof Sprite || child instanceof LineSegments) {
      setMaterialOpacity(child.material, opacity);
    }
  });
}

function disposeObjectTree(object: Group | Mesh | Sprite | LineSegments): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof Sprite || child instanceof LineSegments) {
      disposeGeometryMaterial(child);
    }
  });
}

function disposeGeometryMaterial(object: Mesh | Sprite | LineSegments): void {
  if ("geometry" in object) {
    object.geometry.dispose();
  }

  const materials = Array.isArray(object.material) ? object.material : [object.material];
  materials.forEach((material) => {
    const map = (material as Material & { map?: { dispose?: () => void } }).map;
    map?.dispose?.();
    material.dispose();
  });
}

function createOceanWaveTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#126f83");
    gradient.addColorStop(0.52, "#0b5065");
    gradient.addColorStop(1, "#073748");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 54; index += 1) {
      const y = (index * 37) % canvas.height;
      const phase = (index * 53) % canvas.width;
      const length = 92 + (index % 6) * 18;
      context.beginPath();
      for (let step = 0; step <= length; step += 4) {
        const x = (phase + step) % canvas.width;
        const waveY = y + Math.sin((step / length) * Math.PI * 2 + index) * (2.4 + (index % 4) * 0.45);
        if (step === 0) {
          context.moveTo(x, waveY);
        } else {
          context.lineTo(x, waveY);
        }
      }
      context.strokeStyle = index % 3 === 0 ? "rgba(190, 235, 238, 0.16)" : "rgba(104, 184, 200, 0.12)";
      context.lineWidth = index % 3 === 0 ? 1.35 : 0.8;
      context.stroke();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(38, 38);
  return texture;
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function monumentKey(monument: MonumentPayload): string {
  return `${monument.kind} ${monument.name} ${monument.prefab}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function sampleTerrainHeight(terrain: TerrainPayload, x: number, z: number): number {
  const resolution = terrain.resolution;
  const worldSize = terrain.worldSize || 4500;
  const half = worldSize / 2;
  const u = MathUtils.clamp((x + half) / worldSize, 0, 1);
  const v = MathUtils.clamp((half - z) / worldSize, 0, 1);
  const col = resolution - 1 - Math.round(u * (resolution - 1));
  const row = Math.round(v * (resolution - 1));
  return terrain.heights[row * resolution + col] || 0;
}

function rustWorldToViewerPosition(x: number, y: number, z: number): Vector3 {
  return new Vector3(-x, y, z);
}

function monumentMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04,
  });
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

function bindExternalControls(root: HTMLElement, viewer: TerrainViewer): ViewerBinding {
  const panel = root.closest<HTMLElement>(".server-terrain-panel");
  const buttons = Array.from(panel?.querySelectorAll<HTMLButtonElement>("[data-map-view]") || []);
  const grid = panel?.querySelector<HTMLInputElement>("[data-map-viewer-grid]");
  const tour = panel?.querySelector<HTMLInputElement>("[data-map-viewer-tour]");
  const heatmap = panel?.querySelector<HTMLInputElement>("[data-map-viewer-heatmap]");
  const heatmapPlayback = panel?.querySelector<HTMLInputElement>("[data-map-viewer-heatmap-playback]");
  const heatmapPlay = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-heatmap-play]");
  const heatmapLoop = panel?.querySelector<HTMLInputElement>("[data-map-viewer-heatmap-loop]");
  const heatmapSpeedDown = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-heatmap-speed-down]");
  const heatmapSpeedUp = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-heatmap-speed-up]");
  const heatmapSpeedLabel = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-heatmap-speed-label]");
  const heatmapFrame = panel?.querySelector<HTMLInputElement>("[data-map-viewer-heatmap-frame]");
  const heatmapFrameLabel = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-heatmap-frame-label]");
  const heatmapFrameCount = panel?.querySelector<HTMLInputElement>("[data-map-viewer-heatmap-frame-count]");
  const heatmapFrameCountLabel = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-heatmap-frame-count-label]");
  const heatmapFrameIntervalLabel = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-heatmap-frame-interval-label]");
  const players = panel?.querySelector<HTMLInputElement>("[data-map-viewer-players]");
  const allPlayers = panel?.querySelector<HTMLInputElement>("[data-map-viewer-all-players]");
  const myLocation = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-my-location]");
  const metric = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-heatmap-metric]");
  const range = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-heatmap-range]");
  let heatmapHistory: HeatmapHistoryFrame[] = [];
  let playbackAnimationFrame = 0;
  let playbackVirtualFrame = 0;
  let playbackLastTick = 0;
  let playbackShownFrame = -1;
  let playbackSpeedIndex = 2;
  let playerPollTimer = 0;
  let playbackHistoryPollTimer = 0;
  const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];
  const playerLocationRefreshMs = 15_000;
  const disposers: Array<() => void> = [];
  const dataFlag = (name: string, fallback = false): boolean => {
    const value = root.dataset[name];
    if (value === undefined) {
      return fallback;
    }

    return value === "true" || value === "1";
  };
  const wantsHeatmap = (): boolean => heatmap?.checked ?? dataFlag("overlayHeatmap");
  const wantsPlayback = (): boolean => heatmapPlayback?.checked ?? dataFlag("overlayPlayback");
  const wantsPlayers = (): boolean => players?.checked ?? dataFlag("overlayPlayers");
  const wantsAllPlayers = (): boolean => Boolean(allPlayers?.checked);
  const wantsLoop = (): boolean => heatmapLoop?.checked ?? dataFlag("overlayLoop");
  const wantsTimelineOverlay = (): boolean => wantsPlayback() && (wantsHeatmap() || wantsPlayers());
  const selectedMetric = (): string => metric?.value || root.dataset.overlayMetric || "deaths";
  const selectedRange = (): string => range?.value || root.dataset.overlayRange || "24h";
  const bind = <T extends EventTarget>(target: T | null | undefined, type: string, listener: EventListenerOrEventListenerObject): void => {
    if (!target) {
      return;
    }

    target.addEventListener(type, listener);
    disposers.push(() => target.removeEventListener(type, listener));
  };

  disposers.push(bindMapViewButtons(buttons, viewer).dispose);

  bind(grid, "change", () => {
    if (grid) {
      viewer.setGridVisible(grid.checked);
    }
  });

  bind(tour, "change", () => {
    if (tour) {
      viewer.setTourEnabled(tour.checked);
    }
  });

  const stopHeatmapPlayback = () => {
    window.cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = 0;
    playbackLastTick = 0;
    playbackVirtualFrame = Math.round(playbackVirtualFrame);
    if (heatmapFrame) {
      heatmapFrame.step = "1";
      heatmapFrame.value = String(MathUtils.clamp(playbackVirtualFrame, 0, Math.max(0, heatmapHistory.length - 1)));
    }
    heatmapPlay?.setAttribute("aria-pressed", "false");
    if (heatmapPlay) {
      heatmapPlay.textContent = "Play";
    }
  };

  const playbackSpeed = (): number => playbackSpeeds[playbackSpeedIndex] || 1;

  const playbackIntervalMs = (): number => Math.max(80, Math.round(900 / playbackSpeed()));

  const playbackHistoryPollDelayMs = (): number => playerLocationRefreshMs;

  const updateTimelineValue = (value: number) => {
    if (!heatmapFrame) {
      return;
    }

    heatmapFrame.value = String(MathUtils.clamp(value, 0, Math.max(0, heatmapHistory.length - 1)));
  };

  const updatePlaybackSpeedControls = () => {
    const speed = playbackSpeed();
    if (heatmapSpeedLabel) {
      heatmapSpeedLabel.value = `${speed}x`;
      heatmapSpeedLabel.textContent = `${speed}x`;
    }
    if (heatmapSpeedDown) {
      heatmapSpeedDown.disabled = playbackSpeedIndex <= 0;
    }
    if (heatmapSpeedUp) {
      heatmapSpeedUp.disabled = playbackSpeedIndex >= playbackSpeeds.length - 1;
    }
  };

  const currentPlaybackFrameIndex = (): number => {
    return MathUtils.clamp(Math.round(Number(heatmapFrame?.value ?? playbackVirtualFrame) || 0), 0, Math.max(0, heatmapHistory.length - 1));
  };

  const isFollowingLatestPlaybackFrame = (): boolean => {
    if (heatmapHistory.length === 0) {
      return true;
    }

    const selectedFrame = currentPlaybackFrameIndex();
    return selectedFrame >= Math.max(0, heatmapHistory.length - 1) || selectedFrame >= latestVisibleHeatmapFrame();
  };

  const nearestPlaybackFrameIndexForTime = (targetMs: number): number => {
    if (heatmapHistory.length === 0 || !Number.isFinite(targetMs)) {
      return 0;
    }

    let closestIndex = 0;
    let closestDelta = Number.POSITIVE_INFINITY;
    heatmapHistory.forEach((frame, index) => {
      const time = historyFrameTime(frame);
      if (time === null) {
        return;
      }

      const delta = Math.abs(time - targetMs);
      if (delta < closestDelta) {
        closestDelta = delta;
        closestIndex = index;
      }
    });
    return closestIndex;
  };

  const stopPlaybackHistoryPolling = () => {
    window.clearInterval(playbackHistoryPollTimer);
    playbackHistoryPollTimer = 0;
  };

  const startHeatmapPlayback = () => {
    if (!(wantsHeatmap() || wantsPlayers()) || !wantsPlayback() || heatmapHistory.length === 0) {
      return;
    }

    window.cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = 0;
    playbackVirtualFrame = MathUtils.clamp(Number(heatmapFrame?.value ?? playbackVirtualFrame) || 0, 0, Math.max(0, heatmapHistory.length - 1));
    playbackShownFrame = Math.floor(playbackVirtualFrame);
    playbackLastTick = performance.now();
    if (heatmapFrame) {
      heatmapFrame.step = "any";
    }
    heatmapPlay?.setAttribute("aria-pressed", "true");
    if (heatmapPlay) {
      heatmapPlay.textContent = "Pause";
    }

    const tick = (now: number) => {
      if (heatmapHistory.length === 0 || !wantsPlayback() || !(wantsHeatmap() || wantsPlayers())) {
        stopHeatmapPlayback();
        return;
      }

      const deltaMs = Math.max(0, now - playbackLastTick);
      playbackLastTick = now;
      playbackVirtualFrame += deltaMs / playbackIntervalMs();

      if (playbackVirtualFrame >= heatmapHistory.length - 1) {
        if (!wantsLoop()) {
          playbackVirtualFrame = heatmapHistory.length - 1;
          updateTimelineValue(playbackVirtualFrame);
          showPlaybackFrame(heatmapHistory.length - 1);
          stopHeatmapPlayback();
          return;
        }
        playbackVirtualFrame %= heatmapHistory.length;
      }

      updateTimelineValue(playbackVirtualFrame);
      const nextFrame = Math.floor(playbackVirtualFrame);
      if (nextFrame !== playbackShownFrame) {
        showPlaybackFrame(nextFrame);
      }
      playbackAnimationFrame = window.requestAnimationFrame(tick);
    };

    playbackAnimationFrame = window.requestAnimationFrame(tick);
  };

  const setTimelineLabel = (frame: HeatmapHistoryFrame | null, fallback = "Latest") => {
    if (!heatmapFrameLabel) {
      return;
    }

    heatmapFrameLabel.value = frame?.label || fallback;
    heatmapFrameLabel.textContent = frame?.label || fallback;
  };

  const heatmapFrameCountValue = (): number => {
    const value = Math.round(Number(heatmapFrameCount?.value ?? root.dataset.overlayFrames) || 24);
    return Math.max(8, Math.min(72, value));
  };

  const updateFrameCountLabel = () => {
    if (!heatmapFrameCountLabel) {
      return;
    }

    const value = heatmapFrameCountValue();
    heatmapFrameCountLabel.value = String(value);
    heatmapFrameCountLabel.textContent = String(value);
  };

  const setFrameIntervalLabel = (frameSeconds: number | undefined) => {
    if (!heatmapFrameIntervalLabel) {
      return;
    }

    const seconds = Math.max(0, Math.round(Number(frameSeconds) || 0));
    const label = seconds > 0 ? `~${formatDurationLabel(seconds)} apart` : "waiting";
    heatmapFrameIntervalLabel.value = label;
    heatmapFrameIntervalLabel.textContent = label;
  };

  const showPlaybackFrame = (index: number) => {
    const clampedIndex = MathUtils.clamp(Math.round(index), 0, Math.max(0, heatmapHistory.length - 1));
    const frame = heatmapHistory[clampedIndex];
    playbackShownFrame = clampedIndex;

    if (!frame) {
      setTimelineLabel(null, heatmapHistory.length === 0 ? "No frames" : "Latest");
      return;
    }

    if (wantsHeatmap()) {
      viewer.setHeatmap(frame);
      viewer.setHeatmapVisible(Array.isArray(frame.buckets) && frame.buckets.length > 0);
    } else {
      viewer.setHeatmapVisible(false);
    }

    if (wantsPlayers()) {
      viewer.setPlayerLocations({
        ok: true,
        authenticated: true,
        players: Array.isArray(frame.players) ? frame.players : [],
      });
      viewer.setPlayerLocationsVisible((frame.players || []).length > 0);
      if (myLocation) {
        myLocation.disabled = !viewer.hasSelfLocation();
      }
    }
    setTimelineLabel(frame);
  };

  const latestVisibleHeatmapFrame = (): number => {
    for (let index = heatmapHistory.length - 1; index >= 0; index -= 1) {
      const frame = heatmapHistory[index];
      if ((Array.isArray(frame?.buckets) && frame.buckets.length > 0) || (Array.isArray(frame?.players) && frame.players.length > 0)) {
        return index;
      }
    }

    return Math.max(0, heatmapHistory.length - 1);
  };

  const reloadPlayback = (preferredFrame?: number, restartPlayback = true, selectLatest = false) => {
    const heatmapEnabled = wantsHeatmap();
    const playersEnabled = wantsPlayers();

    if (!heatmapEnabled && !playersEnabled) {
      stopHeatmapPlayback();
      window.clearInterval(playerPollTimer);
      playerPollTimer = 0;
      stopPlaybackHistoryPolling();
      viewer.setHeatmapVisible(false);
      viewer.setPlayerLocationsVisible(false);
      return;
    }

    if (wantsPlayback()) {
      window.clearInterval(playerPollTimer);
      playerPollTimer = 0;
      const previousFrame = heatmapHistory[currentPlaybackFrameIndex()] || null;
      const previousFrameTime = previousFrame ? historyFrameTime(previousFrame) : null;
      const shouldFollowLatest = selectLatest || (preferredFrame === undefined && isFollowingLatestPlaybackFrame());
      void loadOverlayHistory(root, heatmapEnabled, playersEnabled, wantsAllPlayers(), selectedMetric(), selectedRange(), heatmapFrameCountValue()).then((payload) => {
        heatmapHistory = Array.isArray(payload.frames) ? payload.frames : [];
        setFrameIntervalLabel(payload.frameSeconds);
        const latestFrame = preferredFrame !== undefined
          ? MathUtils.clamp(Math.round(preferredFrame), 0, Math.max(0, heatmapHistory.length - 1))
          : shouldFollowLatest || previousFrameTime === null
            ? latestVisibleHeatmapFrame()
            : nearestPlaybackFrameIndexForTime(previousFrameTime);
        if (heatmapFrame) {
          heatmapFrame.max = String(Math.max(0, heatmapHistory.length - 1));
          heatmapFrame.step = "1";
          heatmapFrame.value = String(latestFrame);
          heatmapFrame.disabled = heatmapHistory.length === 0;
        }
        playbackVirtualFrame = latestFrame;
        showPlaybackFrame(latestFrame);
        startPlaybackHistoryPolling();
        if (restartPlayback && wantsPlayback() && heatmapHistory.length > 1) {
          startHeatmapPlayback();
        }
      });
      return;
    }

    stopHeatmapPlayback();
    stopPlaybackHistoryPolling();
    if (heatmapEnabled) {
      void loadHeatmap(root, viewer, selectedMetric(), selectedRange());
    } else {
      viewer.setHeatmapVisible(false);
    }
    if (playersEnabled) {
      void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers());
    }
  };

  const startPlaybackHistoryPolling = () => {
    if (!wantsTimelineOverlay()) {
      stopPlaybackHistoryPolling();
      return;
    }

    if (playbackHistoryPollTimer !== 0) {
      return;
    }

    playbackHistoryPollTimer = window.setInterval(() => {
      if (!wantsTimelineOverlay()) {
        stopPlaybackHistoryPolling();
        return;
      }

      reloadPlayback(undefined, false);
    }, playbackHistoryPollDelayMs());
  };

  bind(heatmap, "change", () => reloadPlayback());
  bind(heatmapPlayback, "change", () => {
    if (wantsPlayback() && !wantsHeatmap() && players && !players.checked) {
      players.checked = true;
    }
    reloadPlayback(undefined, true, wantsPlayback());
  });
  bind(metric, "change", () => reloadPlayback());
  bind(range, "change", () => {
    stopHeatmapPlayback();
    reloadPlayback(undefined, true, true);
  });
  bind(heatmapFrameCount, "input", () => {
    updateFrameCountLabel();
    if (wantsPlayback() && (wantsHeatmap() || wantsPlayers())) {
      stopHeatmapPlayback();
      reloadPlayback();
    }
  });
  bind(heatmapFrame, "pointerdown", () => {
    stopHeatmapPlayback();
  });
  bind(heatmapFrame, "keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "Home" || key === "End" || key === "PageUp" || key === "PageDown") {
      stopHeatmapPlayback();
    }
  });
  bind(heatmapFrame, "input", () => {
    const selectedFrame = Math.round(Number(heatmapFrame?.value) || 0);
    if (heatmapPlayback && !heatmapPlayback.checked) {
      heatmapPlayback.checked = true;
    }
    if (!wantsHeatmap() && players && !players.checked) {
      players.checked = true;
    }
    playbackVirtualFrame = selectedFrame;
    stopHeatmapPlayback();
    if (heatmapHistory.length === 0) {
      reloadPlayback(selectedFrame);
      return;
    }
    if (heatmapFrame) {
      heatmapFrame.step = "1";
      heatmapFrame.value = String(selectedFrame);
    }
    showPlaybackFrame(selectedFrame);
  });
  bind(heatmapSpeedDown, "click", () => {
    playbackSpeedIndex = Math.max(0, playbackSpeedIndex - 1);
    updatePlaybackSpeedControls();
    if (playbackAnimationFrame > 0) {
      startHeatmapPlayback();
    }
  });
  bind(heatmapSpeedUp, "click", () => {
    playbackSpeedIndex = Math.min(playbackSpeeds.length - 1, playbackSpeedIndex + 1);
    updatePlaybackSpeedControls();
    if (playbackAnimationFrame > 0) {
      startHeatmapPlayback();
    }
  });
  bind(heatmapPlay, "click", () => {
    if (!wantsHeatmap() && players && !players.checked) {
      players.checked = true;
    }
    if (heatmapPlayback && !heatmapPlayback.checked) {
      heatmapPlayback.checked = true;
      reloadPlayback(undefined, true, true);
      return;
    }

    if (!(wantsHeatmap() || wantsPlayers()) || !wantsPlayback() || heatmapHistory.length === 0) {
      return;
    }

    if (playbackAnimationFrame > 0) {
      stopHeatmapPlayback();
      return;
    }

    startHeatmapPlayback();
  });

  const reloadPlayers = () => {
    if (!wantsPlayers()) {
      window.clearInterval(playerPollTimer);
      playerPollTimer = 0;
      viewer.setPlayerLocationsVisible(false);
      return;
    }

    if (wantsTimelineOverlay()) {
      window.clearInterval(playerPollTimer);
      playerPollTimer = 0;
      const selectedFrame = currentPlaybackFrameIndex();
      if (heatmapHistory.length > 0) {
        showPlaybackFrame(selectedFrame);
      } else {
        reloadPlayback(selectedFrame);
      }
      return;
    }

    void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers());
    if (playerPollTimer === 0) {
      playerPollTimer = window.setInterval(() => {
        if (players?.checked && !wantsTimelineOverlay()) {
          void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers());
        }
      }, playerLocationRefreshMs);
    }
  };

  bind(players, "change", () => {
    if (wantsPlayback()) {
      reloadPlayback();
      return;
    }
    reloadPlayers();
  });
  bind(allPlayers, "change", () => {
    if (allPlayers?.checked && players && !players.checked) {
      players.checked = true;
    }
    if (wantsPlayback()) {
      reloadPlayback();
      return;
    }
    reloadPlayers();
  });
  updateFrameCountLabel();
  updatePlaybackSpeedControls();
  if (tour) {
    viewer.setTourEnabled(tour.checked);
  }
  if (wantsHeatmap() || wantsPlayers()) {
    reloadPlayback();
  }

  bind(myLocation, "click", () => {
    if (players && !players.checked) {
      players.checked = true;
    }

    if (wantsTimelineOverlay()) {
      const selectedFrame = currentPlaybackFrameIndex();
      if (heatmapHistory.length > 0) {
        showPlaybackFrame(selectedFrame);
        viewer.frameSelfLocation();
      } else {
        reloadPlayback(selectedFrame);
      }
      return;
    }

    if (viewer.frameSelfLocation()) {
      if (playerPollTimer === 0) {
        reloadPlayers();
      }
      return;
    }

    void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers()).then(() => {
      if (viewer.frameSelfLocation() && players) {
        players.checked = true;
      }
    });
  });

  if (!wantsPlayback()) {
    void loadPlayerLocations(root, viewer, myLocation, wantsPlayers(), wantsAllPlayers());
  }

  return {
    dispose: () => {
      window.cancelAnimationFrame(playbackAnimationFrame);
      window.clearInterval(playerPollTimer);
      stopPlaybackHistoryPolling();
      disposers.forEach((dispose) => dispose());
    },
  };
}

async function loadHeatmap(root: HTMLElement, viewer: TerrainViewer, metric: string, range: string): Promise<void> {
  const baseUrl = root.dataset.heatmapUrl || "";

  if (!baseUrl) {
    viewer.setHeatmapVisible(false);
    return;
  }

  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("metric", metric);
  url.searchParams.set("range", range);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Heat map request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as HeatmapPayload;

    if (payload.ok === false) {
      throw new Error("Heat map response did not include available bucket data.");
    }

    viewer.setHeatmap(payload);
    viewer.setHeatmapVisible(true);
  } catch (error) {
    console.info("Raidlands heat map could not be loaded.", error);
    viewer.setHeatmapVisible(false);
  }
}

async function loadHeatmapHistory(root: HTMLElement, metric: string, range: string, frames = 24): Promise<HeatmapHistoryPayload> {
  const baseUrl = root.dataset.heatmapUrl || "";

  if (!baseUrl) {
    return { frames: [] };
  }

  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("metric", metric);
  url.searchParams.set("range", range);
  url.searchParams.set("playback", "1");
  url.searchParams.set("frames", String(Math.max(8, Math.min(72, Math.round(frames)))));

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Heat map history request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as HeatmapHistoryPayload;
  } catch (error) {
    console.info("Raidlands heat map history could not be loaded.", error);
    return { frames: [] };
  }
}

async function loadPlayerLocationHistory(root: HTMLElement, range: string, frames = 24, allPlayers = false): Promise<HeatmapHistoryPayload> {
  const baseUrl = root.dataset.playerLocationsUrl || "";

  if (!baseUrl) {
    return { frames: [] };
  }

  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("range", range);
  url.searchParams.set("playback", "1");
  url.searchParams.set("frames", String(Math.max(8, Math.min(72, Math.round(frames)))));
  if (allPlayers) {
    url.searchParams.set("all", "1");
  }

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Player location history request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as HeatmapHistoryPayload;
  } catch (error) {
    console.info("Raidlands player location history could not be loaded.", error);
    return { frames: [] };
  }
}

async function loadOverlayHistory(root: HTMLElement, includeHeatmap: boolean, includePlayers: boolean, allPlayers: boolean, metric: string, range: string, frames = 24): Promise<HeatmapHistoryPayload> {
  const [heatmapPayload, playerPayload] = await Promise.all([
    includeHeatmap ? loadHeatmapHistory(root, metric, range, frames) : Promise.resolve({ frames: [] } as HeatmapHistoryPayload),
    includePlayers ? loadPlayerLocationHistory(root, range, frames, allPlayers) : Promise.resolve({ frames: [] } as HeatmapHistoryPayload),
  ]);
  const heatmapFrames = Array.isArray(heatmapPayload.frames) ? heatmapPayload.frames : [];
  const playerFrames = Array.isArray(playerPayload.frames) ? playerPayload.frames : [];
  const baseFrames = heatmapFrames.length > 0 ? heatmapFrames : playerFrames;
  const frameSeconds = Math.max(60, Number(heatmapPayload.frameSeconds || playerPayload.frameSeconds || 60));

  return {
    ...heatmapPayload,
    frameSeconds,
    authenticated: Boolean(heatmapPayload.authenticated || playerPayload.authenticated),
    frames: baseFrames.map((frame, index) => {
      const matchingPlayerFrame = includePlayers ? playerHistoryFrameFor(frame, playerFrames, index, frameSeconds) : null;
      const framePlayers = Array.isArray(frame.players) && frame.players.length > 0 ? frame.players : [];
      const matchingPlayers = Array.isArray(matchingPlayerFrame?.players) && matchingPlayerFrame.players.length > 0
        ? matchingPlayerFrame.players
        : [];

      return {
        ...frame,
        players: includePlayers ? (matchingPlayers.length > 0 ? matchingPlayers : framePlayers) : frame.players,
      };
    }),
  };
}

function playerHistoryFrameFor(frame: HeatmapHistoryFrame, playerFrames: HeatmapHistoryFrame[], fallbackIndex: number, frameSeconds: number): HeatmapHistoryFrame | null {
  if (playerFrames.length === 0) {
    return null;
  }

  const frameTime = historyFrameTime(frame);
  const fallbackFrame = playerFrames[fallbackIndex] || null;

  if (frameTime === null) {
    return frameHasPlayers(fallbackFrame) ? fallbackFrame : latestFrameWithPlayers(playerFrames);
  }

  let closest: HeatmapHistoryFrame | null = fallbackFrame;
  let closestDelta = closest ? historyFrameDeltaMs(closest, frameTime) : Number.POSITIVE_INFINITY;
  let closestWithPlayers: HeatmapHistoryFrame | null = frameHasPlayers(fallbackFrame) ? fallbackFrame : null;
  let closestWithPlayersDelta = closestWithPlayers ? historyFrameDeltaMs(closestWithPlayers, frameTime) : Number.POSITIVE_INFINITY;
  const toleranceMs = Math.max(90_000, frameSeconds * 1000 * 0.6);

  for (const playerFrame of playerFrames) {
    const delta = historyFrameDeltaMs(playerFrame, frameTime);
    if (delta < closestDelta) {
      closest = playerFrame;
      closestDelta = delta;
    }
    if (frameHasPlayers(playerFrame) && delta < closestWithPlayersDelta) {
      closestWithPlayers = playerFrame;
      closestWithPlayersDelta = delta;
    }
  }

  if (closestWithPlayers && closestWithPlayersDelta <= toleranceMs) {
    return closestWithPlayers;
  }

  return closestDelta <= toleranceMs ? closest : frameHasPlayers(fallbackFrame) ? fallbackFrame : null;
}

function frameHasPlayers(frame: HeatmapHistoryFrame | null | undefined): frame is HeatmapHistoryFrame {
  return Array.isArray(frame?.players) && frame.players.length > 0;
}

function latestFrameWithPlayers(frames: HeatmapHistoryFrame[]): HeatmapHistoryFrame | null {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    if (frameHasPlayers(frame)) {
      return frame;
    }
  }

  return null;
}

function historyFrameDeltaMs(frame: HeatmapHistoryFrame, targetMs: number): number {
  const time = historyFrameTime(frame);
  return time === null ? Number.POSITIVE_INFINITY : Math.abs(time - targetMs);
}

function historyFrameTime(frame: HeatmapHistoryFrame): number | null {
  const raw = frame.windowEnd || frame.windowStart || "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}

function formatDurationLabel(seconds: number): string {
  if (seconds < 90) {
    return "1 min";
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 90) {
    return `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours} hr`;
  }

  return `${Math.round(hours / 24)} days`;
}

async function loadPlayerLocations(root: HTMLElement, viewer: TerrainViewer, myLocation?: HTMLButtonElement | null, showLayer = true, allPlayers = false): Promise<void> {
  const baseUrl = root.dataset.playerLocationsUrl || "";

  if (!baseUrl) {
    viewer.setPlayerLocationsVisible(false);
    if (myLocation) {
      myLocation.disabled = true;
    }
    return;
  }

  try {
    const url = new URL(baseUrl, window.location.href);
    if (allPlayers) {
      url.searchParams.set("all", "1");
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Player location request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as PlayerLocationPayload;
    viewer.setPlayerLocations(payload);
    viewer.setPlayerLocationsVisible(showLayer && (payload.players || []).length > 0);
    if (myLocation) {
      myLocation.disabled = !viewer.hasSelfLocation();
      myLocation.title = viewer.hasSelfLocation() ? "Move camera to your latest server location" : "Log in and join the server to show your location";
    }
  } catch (error) {
    console.info("Raidlands player locations could not be loaded.", error);
    viewer.setPlayerLocationsVisible(false);
    if (myLocation) {
      myLocation.disabled = true;
    }
  }
}

function bindMapViewButtons(buttons: HTMLButtonElement[], viewer: TerrainViewer): ViewerBinding {
  const disposers: Array<() => void> = [];
  buttons.forEach((button) => {
    const listener = () => {
      const view: MapView = button.dataset.mapView === "top" ? "top" : "iso";
      viewer.setView(view);
      syncMapViewButtons(button, view);
    };
    button.addEventListener("click", listener);
    disposers.push(() => button.removeEventListener("click", listener));
  });

  return {
    dispose: () => disposers.forEach((dispose) => dispose()),
  };
}

function syncMapViewButtons(source: HTMLElement, view: MapView): void {
  const panel = source.closest<HTMLElement>(".server-terrain-panel");
  const scope = panel || source.closest<HTMLElement>("[data-server-map-viewer]");
  scope?.querySelectorAll<HTMLButtonElement>("[data-map-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapView === view));
  });
}

function resolveOceanWaterLevel(terrain: TerrainPayload): number {
  const exportedLevel = Number(terrain.waterLevel);
  const inferredLevel = inferOceanWaterLevel(terrain);

  if (!Number.isFinite(exportedLevel)) {
    return inferredLevel;
  }

  if (exportedLevel > inferredLevel + 8) {
    return inferredLevel;
  }

  return exportedLevel;
}

function inferOceanWaterLevel(terrain: TerrainPayload): number {
  const heights = terrain.heights.filter((height) => Number.isFinite(height)).sort((a, b) => a - b);

  if (heights.length === 0) {
    return 0;
  }

  const median = percentile(heights, 0.5);
  const lowShelf = percentile(heights, 0.12);

  if (Math.abs(median) <= 4) {
    return median;
  }

  if (Math.abs(lowShelf) <= 4) {
    return lowShelf;
  }

  return 0;
}

function percentile(sortedValues: number[], amount: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = MathUtils.clamp(Math.round((sortedValues.length - 1) * amount), 0, sortedValues.length - 1);
  return sortedValues[index] || 0;
}

function pushColor(target: number[], color: string | undefined, height: number, terrain: TerrainPayload): void {
  const min = Number.isFinite(terrain.minHeight) ? terrain.minHeight || 0 : 0;
  const max = Number.isFinite(terrain.maxHeight) ? terrain.maxHeight || 1 : 1;
  const t = MathUtils.clamp((height - min) / Math.max(1, max - min), 0, 1);

  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    const parsed = balanceTerrainColor(new Color(color), t);
    target.push(parsed.r, parsed.g, parsed.b);
    return;
  }

  const low = new Color(0x5a593d);
  const mid = new Color(0x87765b);
  const high = new Color(0xdce0da);
  const mixed = t < 0.58
    ? low.lerp(mid, MathUtils.smoothstep(t / 0.58, 0, 1))
    : mid.lerp(high, MathUtils.smoothstep((t - 0.58) / 0.42, 0, 1));
  target.push(mixed.r, mixed.g, mixed.b);
}

function balanceTerrainColor(color: Color, heightT: number): Color {
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

function setStatus(status: HTMLElement | null, message: string): void {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.hidden = message === "";
}
