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
  FogExp2,
  Float32BufferAttribute,
  Group,
  CanvasTexture,
  LineBasicMaterial,
  LineSegments,
  Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RingGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Uint32BufferAttribute,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { unityPositionToThreeVector, unityQuaternionValueToThreeQuaternion } from "../airstrike-animation-editor/editor/coordinates";
import { createVehicleProxy, loadVehiclePreview, metadataForVehicle } from "../airstrike-animation-editor/editor/vehicle-preview";
import type { VehiclePreviewMetadataFile } from "../airstrike-animation-editor/types";
import { getSharedCanvasTexture, isSharedThreeAsset, loadSharedTexture } from "../shared/three-asset-cache";
import { applyRaidlandsEnvironment, updateRaidlandsEnvironment } from "../shared/three-environment";

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
  Payload?: string;
  Count?: number;
  CarrierOffsetX?: number;
  CarrierOffsetY?: number;
  CarrierOffsetZ?: number;
  TargetOffsetX?: number;
  TargetOffsetY?: number;
  TargetOffsetZ?: number;
  SpreadRadius?: number;
  FuseSeconds?: number;
  SplashRadius?: number;
  ImpactRadius?: number;
  LaunchSpeed?: number;
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

type ActionHighlightSource = "heatmap" | "players";

type ActionHighlightFocus = {
  center: Vector3;
  radius: number;
  weight: number;
  updatedAt: number;
};

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
  events?: MapReplayEvent[];
  environment?: EnvironmentSnapshot | null;
};

type HeatmapHistoryPayload = HeatmapPayload & {
  frames?: HeatmapHistoryFrame[];
  frameSeconds?: number;
  windowEnd?: string;
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

type MapReplayEvent = {
  eventKey?: string;
  eventType?: "airstrike" | "airdrop" | string;
  occurredAt?: string;
  x: number;
  y?: number;
  z: number;
  profileKey?: string;
  vehicle?: string;
  payload?: Record<string, unknown>;
};

type MapReplayHistoryPayload = {
  ok?: boolean;
  frames?: Array<{
    index?: number;
    windowStart?: string;
    windowEnd?: string;
    events?: MapReplayEvent[];
  }>;
};

type EnvironmentSnapshot = {
  sampledAt?: string;
  rustTime?: number;
  dayFraction?: number;
  sunDirection?: { x?: number; y?: number; z?: number };
  sunIntensity?: number;
  sunColor?: string;
  ambientIntensity?: number;
  ambientColor?: string;
  cloudCoverage?: number | null;
  rainIntensity?: number | null;
  fogIntensity?: number | null;
  weatherSampleSummary?: string;
  weather?: WeatherSnapshot | null;
};

type WeatherParameter = {
  key?: string;
  value?: number | null;
  raw?: number | null;
  isDynamic?: boolean;
  is_dynamic?: boolean;
  source?: string;
};

type WeatherSnapshot = {
  parameters?: Record<string, WeatherParameter>;
  state?: WeatherState | null;
  overrideMode?: string;
  override_mode?: string;
  overrideCount?: number | null;
  override_count?: number | null;
  parameterCount?: number | null;
  parameter_count?: number | null;
};

type WeatherState = {
  previous?: string;
  current?: string;
  target?: string;
  next?: string;
  blend?: number | null;
  seedPrevious?: string | number | null;
  seedTarget?: string | number | null;
  seedNext?: string | number | null;
  rainGraceActive?: boolean | null;
  source?: string;
};

type EnvironmentPayload = {
  ok?: boolean;
  environment?: EnvironmentSnapshot | null;
  frames?: Array<{
    index?: number;
    windowStart?: string;
    windowEnd?: string;
    environment?: EnvironmentSnapshot | null;
  }>;
  frameSeconds?: number;
  windowEnd?: string;
};

type NormalizedEnvironment = {
  rustTime: number;
  sunDirection: Vector3;
  sunIntensity: number;
  sunColor: Color;
  ambientIntensity: number;
  ambientColor: Color;
  cloudCoverage: number;
  rainIntensity: number;
  fogIntensity: number;
  fogPresetBlend: number;
  thunderIntensity: number;
  rainbowIntensity: number;
  atmosphereRayleigh: number;
  atmosphereMie: number;
  atmosphereBrightness: number;
  atmosphereContrast: number;
  atmosphereDirectionality: number;
  cloudSize: number;
  cloudOpacity: number;
  cloudSharpness: number;
  cloudColoring: number;
  cloudAttenuation: number;
  cloudScattering: number;
  cloudBrightness: number;
};

const RAIDLANDS_ENVIRONMENT_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uSunColor: { value: new Color(0xffb072) },
    uTwilight: { value: 0 },
    uFogStrength: { value: 0 },
    uCloudCoverage: { value: 0 },
    uRainIntensity: { value: 0 },
    uAtmosphereContrast: { value: 1 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uSunColor;
    uniform float uTwilight;
    uniform float uFogStrength;
    uniform float uCloudCoverage;
    uniform float uRainIntensity;
    uniform float uAtmosphereContrast;

    varying vec2 vUv;

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 warmSun = uSunColor / max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 0.001));
      float shadowWeight = 1.0 - smoothstep(0.22, 0.78, luminance);
      float clearSky = 1.0 - clamp(uCloudCoverage * 0.62 + uRainIntensity * 0.48, 0.0, 0.82);
      float sunsetGrade = uTwilight * clearSky;
      float warmth = sunsetGrade * (0.018 + shadowWeight * 0.048);

      color *= mix(vec3(1.0), vec3(1.075, 0.965, 0.91), sunsetGrade * 0.32);
      color += warmSun * warmth;
      float horizonWarmth = sunsetGrade * (1.0 - smoothstep(0.18, 0.78, vUv.y));
      color += vec3(1.0, 0.34, 0.2) * horizonWarmth * 0.018;
      float hazeDesaturation = clamp(uFogStrength * 0.085 + uRainIntensity * 0.05, 0.0, 0.12);
      color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), hazeDesaturation);
      color = mix(vec3(0.5), color, mix(0.955, 1.028, clamp(uAtmosphereContrast / 1.4, 0.0, 1.0)));

      gl_FragColor = vec4(color, source.a);
    }
  `,
};

type ReplayDisplayMode = "ambient" | "timeline";

type ReplayDisplayOptions = {
  mode?: ReplayDisplayMode;
  cursorMs?: number;
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
      root.dataset.seed = Number.isFinite(Number(metadata.seed)) ? String(metadata.seed) : (root.dataset.seed || "");
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
  const url = new URL(statusUrl, window.location.href);
  url.searchParams.set("refresh", String(Date.now()));
  const response = await fetch(url.toString(), {
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
  return terrainIdentityFingerprint({
    terrainHash: root.dataset.terrainHash || "",
    terrainUrl: root.dataset.terrainUrl || "",
    worldSize: Number(root.dataset.worldSize || 0),
    seed: Number(root.dataset.seed || 0),
  });
}

function terrainMetadataFingerprint(metadata: Partial<ServerStatusMapImage> & { terrainUrl?: string; textureUrl?: string; skyboxUrl?: string; worldSize?: number }): string {
  return terrainIdentityFingerprint(metadata);
}

function terrainIdentityFingerprint(metadata: Partial<ServerStatusMapImage> & { terrainUrl?: string; worldSize?: number }): string {
  const terrainHash = String(metadata.terrainHash || "").trim();

  if (terrainHash !== "") {
    return [
      terrainHash,
      String(metadata.worldSize || ""),
      String(metadata.seed || ""),
    ].join("|");
  }

  return [
    metadata.terrainUrl || metadata.terrainPublicUrl || "",
    String(metadata.worldSize || ""),
    String(metadata.seed || ""),
  ].join("|");
}

function liveTerrainPollDelayMs(): number {
  return 30000;
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
  private readonly composer: EffectComposer;
  private readonly ambientOcclusionPass: SSAOPass;
  private readonly environmentGradePass: ShaderPass;
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
  private readonly monumentLayer = new Group();
  private readonly weatherCloudLayer = new Group();
  private readonly groundFogLayer: Group;
  private readonly rainSheetLayer = new Group();
  private readonly rainLayer = new Group();
  private readonly rainMaterial: LineBasicMaterial;
  private readonly terrainLightUniforms = {
    sunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
    sunColor: { value: new Color(0xfff1cf) },
    twilight: { value: 0 },
    cloudAttenuation: { value: 0.25 },
  };
  private ambientLight: AmbientLight | null = null;
  private sunLight: DirectionalLight | null = null;
  private fillLight: DirectionalLight | null = null;
  private activeEnvironment: NormalizedEnvironment | null = null;
  private targetEnvironment: NormalizedEnvironment | null = null;
  private environmentBlendStartedAt = 0;
  private environmentBlendDuration = 900;
  private airstrikeReplay: AirstrikeReplayPlayer | null = null;
  private latestReplayEvents: MapReplayEvent[] = [];
  private latestReplaySpeed = 1;
  private latestReplayOptions: ReplayDisplayOptions = {};
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
  private readonly actionHighlights = new Map<ActionHighlightSource, ActionHighlightFocus>();
  private actionTourStartedAt = performance.now();
  private readonly lockCameraInput: boolean;
  private transitionFrom: CameraPose | null = null;
  private transitionTo: CameraPose | null = null;
  private transitionStartedAt = 0;
  private transitionDuration = 1400;
  private selfLocation: PlayerLocation | null = null;
  private selfLocationOrbitEnabled = false;
  private selfLocationOrbitStartedAt = performance.now();

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
      exposure: 1.16,
      backgroundIntensity: 1.02,
      environmentIntensity: 0.98,
    });
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), 1.5));
    this.ambientOcclusionPass = new SSAOPass(this.scene, this.camera, 1, 1, 24);
    this.ambientOcclusionPass.kernelRadius = 7;
    this.ambientOcclusionPass.minDistance = 0.0005;
    this.ambientOcclusionPass.maxDistance = 0.009;
    this.environmentGradePass = new ShaderPass(RAIDLANDS_ENVIRONMENT_GRADE_SHADER);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.ambientOcclusionPass);
    this.composer.addPass(this.environmentGradePass);
    this.renderer.domElement.dataset.serverMapViewerCanvas = "true";
    this.terrainMaterial = this.createTerrainMaterial();
    this.oceanFloorMesh = this.createOceanFloorMesh();
    this.scene.add(this.oceanFloorMesh);
    this.terrainMesh = this.createTerrainMesh();
    this.scene.add(this.terrainMesh);
    this.oceanWaveTexture = createOceanWaveTexture();
    this.oceanSurfaceMesh = this.createOceanSurfaceMesh();
    this.scene.add(this.oceanSurfaceMesh);
    this.groundFogLayer = createGroundFogBanks(this.terrain);
    this.groundFogLayer.visible = false;
    this.scene.add(this.groundFogLayer);
    this.weatherCloudLayer.name = "raidlands-floating-weather-clouds";
    this.weatherCloudLayer.add(createFloatingWeatherClouds(this.terrain));
    this.scene.add(this.weatherCloudLayer);
    this.rainSheetLayer.name = "raidlands-rain-sheet-layer";
    this.rainSheetLayer.add(createRainSheets(this.terrain));
    this.rainSheetLayer.visible = false;
    this.scene.add(this.rainSheetLayer);
    this.rainMaterial = new LineBasicMaterial({
      color: 0xb7d4e6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    this.rainLayer.name = "raidlands-rain-streaks";
    this.rainLayer.add(createRainStreaks(this.terrain, this.rainMaterial));
    this.rainLayer.visible = false;
    this.scene.add(this.rainLayer);
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
    this.ambientOcclusionPass.dispose();
    this.environmentGradePass.dispose();
    this.composer.dispose();
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
    if (!visible) {
      this.setActionHighlight("heatmap", null);
    }
  }

  public setPlayerLocationsVisible(visible: boolean): void {
    this.playerLocationLayer.visible = visible;
    if (!visible) {
      this.setActionHighlight("players", null);
    }
  }

  public setHeatmap(payload: HeatmapPayload): void {
    const nextLayer = new Group();
    nextLayer.name = "heatmap-playback-frame";
    const buckets = Array.isArray(payload.buckets) ? payload.buckets : [];

    if (buckets.length === 0) {
      this.setActionHighlight("heatmap", null);
      this.replaceOverlayLayer(this.heatmapLayer, nextLayer);
      return;
    }

    const texture = createHeatmapCloudTexture();
    const maxValue = Math.max(0.0001, Number(payload.maxValue) || Math.max(...buckets.map((bucket) => Number(bucket.value) || 0), 0.0001));
    this.setActionHighlight("heatmap", this.heatmapActionHighlight(buckets, maxValue));

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
    this.setActionHighlight("players", this.playerActionHighlight(players));

    players.slice(0, 80).forEach((player) => {
      const x = Number(player.x);
      const z = Number(player.z);

      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return;
      }

      const isSelf = player.isSelf === true;
      const playerPosition = rustWorldToViewerPosition(x, Number(player.y) || 0, z);
      const y = Math.max(playerPosition.y, sampleTerrainHeight(this.terrain, playerPosition.x, playerPosition.z)) + (isSelf ? 58 : 46);
      const sprite = new Sprite(new SpriteMaterial({
        map: createPlayerLocationTexture(player, isSelf),
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }));
      const size = isSelf ? 96 : 78;
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
    return this.focusSelfLocation(false, false);
  }

  public followSelfLocation(): boolean {
    return this.focusSelfLocation(true, false);
  }

  public setSelfLocationOrbitEnabled(enabled: boolean): void {
    if (this.selfLocationOrbitEnabled === enabled) {
      return;
    }

    this.selfLocationOrbitEnabled = enabled;
    this.selfLocationOrbitStartedAt = performance.now();

    if (enabled) {
      this.focusSelfLocation(true, true);
    }
  }

  private focusSelfLocation(immediate: boolean, orbit: boolean): boolean {
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
    const cameraOffset = MathUtils.clamp(worldSize * 0.085, 280, 560);
    const elapsed = Math.max(0, performance.now() - this.selfLocationOrbitStartedAt);
    const orbitProgress = (elapsed / 18000) % 1;
    const orbitWave = (Math.sin(orbitProgress * Math.PI * 2) + 1) * 0.5;
    const orbitAngle = orbitProgress * Math.PI * 2 - Math.PI * 0.72;
    const orbitRadius = cameraOffset * 1.08;
    const target = orbit
      ? new Vector3(playerPosition.x, ground + MathUtils.lerp(32, 78, (Math.cos(orbitProgress * Math.PI * 2) + 1) * 0.5), playerPosition.z)
      : new Vector3(playerPosition.x, ground + 42, playerPosition.z);
    const pose = {
      position: orbit
        ? new Vector3(
          playerPosition.x + Math.cos(orbitAngle) * orbitRadius,
          ground + cameraOffset * MathUtils.lerp(0.56, 0.92, orbitWave),
          playerPosition.z + Math.sin(orbitAngle) * orbitRadius,
        )
        : new Vector3(playerPosition.x - cameraOffset * 0.62, ground + cameraOffset * 0.72, playerPosition.z + cameraOffset * 0.78),
      target,
      up: new Vector3(0, 1, 0),
    };

    if (immediate) {
      this.transitionFrom = null;
      this.transitionTo = null;
      this.activePose = null;
      this.focusUntil = performance.now() + 15000;
      this.applyCameraPose(pose);
    } else {
      this.focusCamera(pose);
    }

    return true;
  }

  private updateSelfLocationOrbit(now: number): void {
    if (!this.selfLocationOrbitEnabled || !this.selfLocation) {
      return;
    }

    this.focusUntil = now + 15000;
    this.focusSelfLocation(true, true);
  }

  public setAirstrikeProfiles(
    profiles: Record<string, RuntimeVisualProfile>,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
    ambientEnabled = false,
  ): void {
    this.airstrikeReplay = new AirstrikeReplayPlayer(
      this.airstrikeLayer,
      this.terrain,
      profiles,
      vehicleMetadata,
      assetBase,
      ambientEnabled,
    );
    this.airstrikeReplay.start();
    if (this.latestReplayEvents.length > 0) {
      this.airstrikeReplay.showEvents(this.latestReplayEvents, this.latestReplaySpeed, this.latestReplayOptions);
    }
  }

  public showReplayEvents(events: MapReplayEvent[], playbackSpeed: number, options: ReplayDisplayOptions = {}): void {
    this.latestReplayEvents = events;
    this.latestReplaySpeed = playbackSpeed;
    this.latestReplayOptions = options;
    this.airstrikeReplay?.showEvents(events, playbackSpeed, options);
  }

  public clearReplayEvents(): void {
    this.latestReplayEvents = [];
    this.latestReplaySpeed = 1;
    this.latestReplayOptions = {};
    this.airstrikeReplay?.clear();
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
        // Keep the front-face winding counter-clockwise when viewed from above so
        // computed normals point toward Rust's sky. The previous order produced
        // downward normals; DoubleSide kept the map visible, but real sun light
        // from the environment feed could not illuminate the terrain surface.
        indices.push(a, b, c, b, d, c);
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
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.raidlandsSunDirection = this.terrainLightUniforms.sunDirection;
      shader.uniforms.raidlandsSunColor = this.terrainLightUniforms.sunColor;
      shader.uniforms.raidlandsTwilight = this.terrainLightUniforms.twilight;
      shader.uniforms.raidlandsCloudAttenuation = this.terrainLightUniforms.cloudAttenuation;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec3 raidlandsSunDirection;
uniform vec3 raidlandsSunColor;
uniform float raidlandsTwilight;
uniform float raidlandsCloudAttenuation;`,
        )
        .replace(
          "#include <normal_fragment_begin>",
          `#include <normal_fragment_begin>
vec3 raidlandsSunDirectionView = normalize((viewMatrix * vec4(raidlandsSunDirection, 0.0)).xyz);
float raidlandsSunFacing = max(dot(normal, raidlandsSunDirectionView), 0.0);
float raidlandsWarmSlope = raidlandsTwilight * (0.18 + raidlandsSunFacing * 0.82) * (1.0 - raidlandsCloudAttenuation * 0.58);
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.0) + raidlandsSunColor * 0.22, raidlandsWarmSlope);`,
        );
    };
    material.customProgramCacheKey = () => "raidlands-terrain-sun-wash-v1";
    return material;
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

    void loadSharedTexture(this.textureUrl).then(
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        this.terrainMaterial.map = texture;
        this.terrainMaterial.color.set(0xffffff);
        this.terrainMaterial.roughness = 0.88;
        this.terrainMaterial.vertexColors = false;
        this.terrainMaterial.needsUpdate = true;
      },
      () => setStatus(this.status, ""),
    );
  }

  private addMonuments(): void {
    const monuments = this.terrain.monuments || [];

    if (monuments.length === 0) {
      return;
    }

    const layer = this.monumentLayer;
    layer.name = "raidlands-monument-primitives";

    monuments.forEach((monument) => {
      if (shouldHideMonumentPrimitive(monument)) {
        return;
      }
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
    const ambient = new AmbientLight(0xddeaf0, 0.5);
    const sun = new DirectionalLight(0xfff1cf, 1.58);
    sun.position.set(900, 1400, 650);
    const fill = new DirectionalLight(0x9fc7dd, 0.18);
    fill.position.set(-500, 500, -800);
    this.ambientLight = ambient;
    this.sunLight = sun;
    this.fillLight = fill;
    const initialEnvironment = normalizeEnvironment({
      rustTime: 12,
      sunDirection: { x: 0.5, y: 0.78, z: 0.36 },
      sunIntensity: 1.58,
      sunColor: "#fff1cf",
      ambientIntensity: 0.5,
      ambientColor: "#ddeaf0",
      cloudCoverage: 0.22,
      rainIntensity: 0,
      fogIntensity: 0,
    });
    this.activeEnvironment = initialEnvironment;
    this.targetEnvironment = initialEnvironment;
    this.scene.add(ambient, sun, fill);
  }

  private resize(): void {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  private animate(): void {
    this.animationFrame = window.requestAnimationFrame(() => this.animate());
    const now = performance.now();
    this.updateSelfLocationOrbit(now);
    this.updateCameraTour(now);
    this.controls.update();
    this.updateOverlayLayerTransitions(now);
    this.updateGridOpacity();
    this.updateOceanPlanes(now);
    this.updateEnvironment(now);
    this.airstrikeLayer.userData.tick?.((now - this.clockStart) / 1000);
    this.monumentLayer.traverse((object) => object.userData.tick?.((now - this.clockStart) / 1000));
    this.updateAircraftCameraSafety();
    this.composer.render();
  }

  private updateAircraftCameraSafety(): void {
    const aircraftPosition = new Vector3();
    this.airstrikeLayer.traverse((object) => {
      const safetyRadius = Number(object.userData.cameraSafetyRadius || 0);
      if (!(safetyRadius > 0)) {
        return;
      }
      object.getWorldPosition(aircraftPosition);
      object.visible = aircraftPosition.distanceTo(this.camera.position) >= safetyRadius;
    });
  }

  public setEnvironment(snapshot: EnvironmentSnapshot | null | undefined, durationMs = 900): void {
    const next = normalizeEnvironment(snapshot);
    if (!next) {
      return;
    }
    this.activeEnvironment = this.currentEnvironment(performance.now());
    this.targetEnvironment = next;
    this.environmentBlendStartedAt = performance.now();
    this.environmentBlendDuration = Math.max(0, durationMs);
    if (this.environmentBlendDuration === 0) {
      this.applyEnvironment(next);
      this.activeEnvironment = next;
    }
  }

  private currentEnvironment(now: number): NormalizedEnvironment | null {
    if (!this.activeEnvironment || !this.targetEnvironment || this.environmentBlendDuration <= 0) {
      return this.targetEnvironment || this.activeEnvironment;
    }
    const progress = MathUtils.clamp((now - this.environmentBlendStartedAt) / this.environmentBlendDuration, 0, 1);
    return interpolateEnvironment(this.activeEnvironment, this.targetEnvironment, MathUtils.smoothstep(progress, 0, 1));
  }

  private updateEnvironment(now: number): void {
    const environment = this.currentEnvironment(now);
    if (!environment) {
      return;
    }
    this.applyEnvironment(environment);
    this.updateWeatherEffects(environment, now);
    if (this.targetEnvironment && now - this.environmentBlendStartedAt >= this.environmentBlendDuration) {
      this.activeEnvironment = this.targetEnvironment;
    }
  }

  private applyEnvironment(environment: NormalizedEnvironment): void {
    if (!this.ambientLight || !this.sunLight || !this.fillLight) {
      return;
    }
    const sunHeight = MathUtils.clamp(environment.sunDirection.y, -0.16, 0.9);
    const daylight = MathUtils.smoothstep(sunHeight, -0.05, 0.55);
    const twilight = MathUtils.clamp(1 - Math.abs(sunHeight - 0.12) / 0.34, 0, 1);
    const night = 1 - MathUtils.smoothstep(sunHeight, -0.18, 0.08);
    const visualCloudCoverage = visualCloudCoverageForEnvironment(environment);
    const atmosphereBrightness = MathUtils.clamp(environment.atmosphereBrightness, 0.15, 2.4);
    const atmosphereContrast = MathUtils.clamp(environment.atmosphereContrast, 0.15, 2.4);
    const atmosphereBrightnessT = MathUtils.clamp(atmosphereBrightness / 1.5, 0, 1);
    const atmosphereWarmColor = environment.sunColor.clone().lerp(
      new Color(0xffd0aa),
      MathUtils.lerp(0.52, 0.7, MathUtils.clamp(environment.atmosphereMie / 4, 0, 1)),
    );
    const scatteringGlow = MathUtils.lerp(0.76, 1.26, MathUtils.clamp(environment.cloudScattering, 0, 1));
    this.renderer.toneMappingExposure = MathUtils.lerp(0.9, 1.42, atmosphereBrightnessT)
      * MathUtils.lerp(0.72, 1, Math.max(daylight, twilight * 0.9))
      * (1 + twilight * 0.16);
    this.ambientLight.color.copy(environment.ambientColor)
      .lerp(new Color(0xddeaf0), daylight * MathUtils.lerp(0.42, 0.72, atmosphereBrightnessT))
      .lerp(atmosphereWarmColor, twilight * MathUtils.lerp(0.24, 0.38, atmosphereBrightnessT))
      .lerp(new Color(0x101827), night * 0.52);
    this.ambientLight.intensity = MathUtils.clamp(
      (
        environment.ambientIntensity * MathUtils.lerp(0.82, 1.18, daylight)
        + MathUtils.lerp(0.05, 0.18, twilight)
        + daylight * MathUtils.lerp(0.24, 0.62, atmosphereBrightnessT)
        + twilight * MathUtils.lerp(0.22, 0.5, atmosphereBrightnessT)
      ) * MathUtils.lerp(0.72, 1.18, atmosphereBrightness / 1.4),
      0.14,
      1.5,
    );
    this.sunLight.color.copy(environment.sunColor);
    this.sunLight.intensity = Math.max(0.08, environment.sunIntensity * MathUtils.lerp(0.78, 1.04, daylight) * scatteringGlow
      * MathUtils.lerp(1, 0.72, Math.max(environment.fogIntensity * 0.42, environment.rainIntensity * 0.28)));
    const worldSize = this.terrain.worldSize || 4500;
    this.sunLight.position.copy(environment.sunDirection).multiplyScalar(worldSize * 0.62);
    this.sunLight.position.y = Math.max(this.sunLight.position.y, worldSize * -0.18);
    this.fillLight.color.set(0x88b7d6).lerp(atmosphereWarmColor, twilight * 0.38);
    this.fillLight.intensity = MathUtils.lerp(0.12, 0.32, daylight) + twilight * 0.22;
    this.terrainLightUniforms.sunDirection.value.copy(environment.sunDirection);
    this.terrainLightUniforms.sunColor.value.copy(environment.sunColor);
    this.terrainLightUniforms.twilight.value = twilight;
    this.terrainLightUniforms.cloudAttenuation.value = MathUtils.clamp(
      visualCloudCoverage * MathUtils.clamp(environment.cloudAttenuation, 0, 1),
      0,
      1,
    );
    const oceanMaterial = this.oceanSurfaceMesh.material as MeshStandardMaterial;
    const waterSunReflection = twilight * MathUtils.lerp(0.12, 0.5, 1 - visualCloudCoverage)
      * MathUtils.lerp(1, 0.72, environment.fogIntensity * 0.5 + environment.rainIntensity * 0.24);
    oceanMaterial.color.set(0x0a4f63).lerp(atmosphereWarmColor, waterSunReflection);
    oceanMaterial.roughness = MathUtils.lerp(0.44, 0.2, waterSunReflection);
    oceanMaterial.metalness = MathUtils.lerp(0.02, 0.14, waterSunReflection);
    oceanMaterial.emissive.copy(atmosphereWarmColor);
    oceanMaterial.emissiveIntensity = twilight * MathUtils.lerp(0.025, 0.11, 1 - visualCloudCoverage);
    const horizonDrama = MathUtils.clamp(1 - Math.abs(MathUtils.clamp(sunHeight, -0.1, 0.46) - 0.18) / 0.28, 0, 1);
    this.scene.backgroundIntensity = (MathUtils.lerp(0.7, 1.02, daylight) + horizonDrama * 0.11 - night * 0.18) * MathUtils.lerp(0.72, 1.16, atmosphereBrightness / 1.4);
    this.scene.environmentIntensity = (MathUtils.lerp(0.46, 0.96, daylight) + horizonDrama * 0.04) * MathUtils.lerp(0.82, 1.18, atmosphereContrast / 1.4);
    const fogStrength = visualFogStrengthForEnvironment(environment);
    const daylightFogColor = new Color(0xc8dfe8)
      .lerp(atmosphereWarmColor, MathUtils.clamp(environment.atmosphereMie / 4, 0, 1) * 0.1)
      .multiplyScalar(MathUtils.lerp(0.82, 1.08, atmosphereBrightnessT));
    const fogColor = new Color(0x172235)
      .lerp(daylightFogColor, daylight)
      .lerp(atmosphereWarmColor, twilight * 0.28)
      .lerp(new Color(0xffd1aa), twilight * MathUtils.clamp(environment.atmosphereMie / 4, 0, 1) * 0.1)
      .lerp(environment.ambientColor, night * 0.24);
    this.scene.fog = fogStrength > 0.02
      ? new FogExp2(fogColor, visualFogDensityForCamera(fogStrength, this.camera.position, this.terrain))
      : null;
    this.environmentGradePass.uniforms.uSunColor.value.copy(atmosphereWarmColor);
    this.environmentGradePass.uniforms.uTwilight.value = twilight;
    this.environmentGradePass.uniforms.uFogStrength.value = fogStrength;
    this.environmentGradePass.uniforms.uCloudCoverage.value = visualCloudCoverage;
    this.environmentGradePass.uniforms.uRainIntensity.value = environment.rainIntensity;
    this.environmentGradePass.uniforms.uAtmosphereContrast.value = atmosphereContrast;
    updateRaidlandsEnvironment(this.scene, {
      sunDirection: environment.sunDirection,
      sunColor: environment.sunColor,
      sunIntensity: environment.sunIntensity,
      cloudCoverage: visualCloudCoverage,
      fogIntensity: environment.fogIntensity,
      rainIntensity: environment.rainIntensity,
      thunderIntensity: environment.thunderIntensity,
      rainbowIntensity: environment.rainbowIntensity,
      atmosphereRayleigh: environment.atmosphereRayleigh,
      atmosphereMie: environment.atmosphereMie,
      atmosphereBrightness: environment.atmosphereBrightness,
      atmosphereContrast: environment.atmosphereContrast,
      atmosphereDirectionality: environment.atmosphereDirectionality,
      cloudOpacity: environment.cloudOpacity,
      cloudSharpness: environment.cloudSharpness,
      cloudAttenuation: environment.cloudAttenuation,
      cloudScattering: environment.cloudScattering,
      cloudBrightness: environment.cloudBrightness,
      timeSeconds: performance.now() / 1000,
      cameraPosition: this.camera.position,
    });
  }

  private updateWeatherEffects(environment: NormalizedEnvironment, now: number): void {
    const worldSize = this.terrain.worldSize || 4500;
    const rain = MathUtils.clamp(environment.rainIntensity, 0, 1);
    const visibleCloudAmount = visualCloudCoverageForEnvironment(environment);
    const sunHeight = MathUtils.clamp(environment.sunDirection.y, -0.16, 0.9);
    const twilight = MathUtils.clamp(1 - Math.abs(sunHeight - 0.12) / 0.34, 0, 1);
    const cloudOpacity = MathUtils.lerp(0.18, 0.5, visibleCloudAmount)
      * MathUtils.clamp(environment.cloudOpacity, 0, 1)
      * MathUtils.lerp(0.72, 1.24, MathUtils.clamp(environment.cloudBrightness, 0, 1.6));
    const cloudScale = MathUtils.lerp(0.82, 1.18, visibleCloudAmount)
      * MathUtils.lerp(0.72, 1.32, MathUtils.clamp(environment.cloudSize / 4, 0, 1));
    const cloudDarkening = MathUtils.clamp(environment.cloudAttenuation, 0, 1) * visibleCloudAmount * 0.36;

    const groundFogAmount = Math.sqrt(visualFogStrengthForEnvironment(environment));
    const ambientGroundFogColor = new Color(0xc7d4d8).lerp(environment.ambientColor, 0.34);
    const sunlitGroundFogColor = environment.sunColor.clone().lerp(new Color(0xffdfbd), 0.58);
    const horizontalSunLength = Math.max(0.0001, Math.hypot(environment.sunDirection.x, environment.sunDirection.z));
    this.groundFogLayer.visible = groundFogAmount > 0.015;
    this.groundFogLayer.children.forEach((child, index) => {
      if (!(child instanceof Sprite)) {
        return;
      }
      const distance = this.camera.position.distanceTo(child.position);
      const nearFade = MathUtils.smoothstep(distance, worldSize * 0.12, worldSize * 0.42);
      const farFade = 1 - MathUtils.smoothstep(distance, worldSize * 1.08, worldSize * 1.65);
      const horizontalBankLength = Math.max(0.0001, Math.hypot(child.position.x, child.position.z));
      const sunFacing = MathUtils.clamp(
        (
          child.position.x * environment.sunDirection.x
          + child.position.z * environment.sunDirection.z
        ) / (horizontalBankLength * horizontalSunLength) * 0.5 + 0.5,
        0,
        1,
      );
      const material = child.material as SpriteMaterial;
      material.color.copy(ambientGroundFogColor).lerp(
        sunlitGroundFogColor,
        twilight * MathUtils.lerp(0.32, 0.58, sunFacing),
      );
      material.opacity = groundFogAmount * nearFade * farFade * (Number(child.userData.opacityBias) || 1) * 0.34;
      child.visible = material.opacity > 0.003;
      child.position.x = (Number(child.userData.baseX) || 0) + Math.sin(now * 0.000018 + index * 1.9) * worldSize * 0.008;
      child.position.z = (Number(child.userData.baseZ) || 0) + Math.cos(now * 0.000014 + index * 1.3) * worldSize * 0.006;
    });

    this.weatherCloudLayer.visible = visibleCloudAmount > 0.015;
    this.weatherCloudLayer.position.x = this.camera.position.x * 0.035;
    this.weatherCloudLayer.position.z = this.camera.position.z * 0.035;
    this.weatherCloudLayer.rotation.y = now * 0.000012;
    this.weatherCloudLayer.children.forEach((child, index) => {
      if (!(child instanceof Sprite)) {
        return;
      }
      child.visible = (Number(child.userData.coverageRank) || 0) < visibleCloudAmount;
      const baseScale = Number(child.userData.baseScale) || worldSize * 0.18;
      const drift = now * (0.000006 + (index % 5) * 0.0000015);
      child.position.x = (Number(child.userData.baseX) || 0) + Math.sin(drift + index) * worldSize * 0.025;
      child.position.z = (Number(child.userData.baseZ) || 0) + Math.cos(drift * 0.8 + index * 0.7) * worldSize * 0.018;
      child.scale.set(baseScale * cloudScale * (Number(child.userData.scaleX) || 1), baseScale * cloudScale * (Number(child.userData.scaleY) || 0.34), 1);
      const material = child.material as SpriteMaterial;
      material.opacity = cloudOpacity * (Number(child.userData.opacityBias) || 1);
      const cloudWarmColor = environment.sunColor.clone().lerp(new Color(0xffcda2), 0.58);
      material.color.copy(environment.ambientColor)
        .lerp(new Color(0xe9f2f7), MathUtils.lerp(0.54, 0.84, MathUtils.smoothstep(environment.sunDirection.y, -0.05, 0.5)))
        .lerp(cloudWarmColor, twilight * 0.62)
        .lerp(new Color(0x1b222a), cloudDarkening);
    });

    const rainVisible = rain > 0.015;
    const rainDistance = MathUtils.clamp(worldSize * 0.18, 340, 940);
    const rainForward = new Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const rainUp = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const rainAnchor = this.camera.position.clone().add(rainForward.multiplyScalar(rainDistance));
    const rainFallOffset = (now * MathUtils.lerp(0.12, 0.48, rain)) % Math.max(180, worldSize * 0.16);

    this.rainSheetLayer.visible = rainVisible;
    this.rainSheetLayer.position.copy(rainAnchor).add(rainUp.clone().multiplyScalar(worldSize * 0.08));
    this.rainSheetLayer.quaternion.copy(this.camera.quaternion);
    this.rainSheetLayer.children.forEach((child, index) => {
      if (!(child instanceof Sprite)) {
        return;
      }
      const material = child.material as SpriteMaterial;
      material.opacity = MathUtils.lerp(0.028, 0.14, Math.sqrt(rain)) * (Number(child.userData.opacityBias) || 1);
      const drift = now * (0.00008 + index * 0.000016);
      child.position.x = (Number(child.userData.baseX) || 0) + Math.sin(drift) * worldSize * 0.08;
      child.position.y = (Number(child.userData.baseY) || 0) - rainFallOffset * 0.32;
      child.position.z = (Number(child.userData.baseZ) || 0) + Math.cos(drift * 0.7) * worldSize * 0.05;
    });
    this.rainLayer.visible = rainVisible;
    this.rainLayer.position.copy(rainAnchor);
    this.rainLayer.quaternion.copy(this.camera.quaternion);
    this.rainLayer.children.forEach((child) => {
      child.position.y = -rainFallOffset * 0.42;
    });
    this.rainMaterial.opacity = rainVisible ? MathUtils.lerp(0.08, 0.38, Math.sqrt(rain)) : 0;

    const thunder = MathUtils.clamp(environment.thunderIntensity, 0, 1);
    if (thunder > 0.015 && this.ambientLight && this.sunLight) {
      const flashSeed = Math.max(
        0,
        Math.sin(now * 0.0067) * 0.7 + Math.sin(now * 0.017 + 1.8) * 0.3,
      );
      const flash = Math.pow(flashSeed, 18) * thunder;
      this.ambientLight.intensity += flash * 0.32;
      this.sunLight.intensity += flash * 1.4;
      this.scene.backgroundIntensity += flash * 0.22;
    }
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

    const actionPose = this.actionHighlightPose(now);
    if (actionPose) {
      this.applyBlendedTourPose(actionPose, now - this.actionTourStartedAt);
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
    this.applyBlendedTourPose(pose, elapsed);
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

  private actionHighlightPose(now: number): CameraPose | null {
    const highlight = this.currentActionHighlight();

    if (!highlight) {
      return null;
    }

    const worldSize = this.terrain.worldSize || 4500;
    const focus = highlight.center.clone();
    const ground = sampleTerrainHeight(this.terrain, focus.x, focus.z);
    const radius = MathUtils.clamp(highlight.radius, worldSize * 0.08, worldSize * 0.48);
    const orbitRadius = MathUtils.clamp(radius * 2.55, worldSize * 0.26, worldSize * 0.68);
    const clearance = MathUtils.clamp(worldSize * 0.2 + radius * 0.28, worldSize * 0.13, worldSize * 0.44);
    const orbitProgress = ((now - this.actionTourStartedAt) / 26000) % 1;
    const angle = orbitProgress * Math.PI * 2 + Math.PI * 0.18;
    const mapCenterPull = MathUtils.clamp(radius / Math.max(1, worldSize) * 0.18, 0.04, 0.12);
    const target = new Vector3(
      MathUtils.lerp(focus.x, 0, mapCenterPull),
      ground + MathUtils.clamp(radius * 0.12, 44, 140),
      MathUtils.lerp(focus.z, 0, mapCenterPull),
    );

    return this.aboveTerrainPose(
      new Vector3(focus.x + Math.cos(angle) * orbitRadius, 0, focus.z + Math.sin(angle) * orbitRadius),
      target,
      clearance,
    );
  }

  private applyBlendedTourPose(pose: CameraPose, elapsed: number): void {
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

  private heatmapActionHighlight(buckets: HeatmapBucket[], maxValue: number): ActionHighlightFocus | null {
    const candidates = buckets
      .map((bucket) => {
        const normalized = MathUtils.clamp(Number(bucket.normalized) || ((Number(bucket.value) || 0) / Math.max(0.0001, maxValue)), 0, 1);
        const value = Math.max(0, Number(bucket.value) || 0);
        const bucketSize = MathUtils.clamp(Number(bucket.bucketSize) || 100, 25, 1000);
        const position = rustWorldToViewerPosition(bucket.x, 0, bucket.z);
        const score = Math.max(normalized, value / Math.max(0.0001, maxValue));

        return {
          position,
          bucketSize,
          score,
          weight: Math.max(0.001, score * score * Math.max(1, value)),
        };
      })
      .filter((candidate) => candidate.score >= 0.12)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 14);

    if (candidates.length === 0) {
      return null;
    }

    const center = new Vector3();
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    candidates.forEach((candidate) => {
      center.addScaledVector(candidate.position, candidate.weight / totalWeight);
    });

    let radius = 0;
    candidates.forEach((candidate) => {
      radius = Math.max(radius, center.distanceTo(candidate.position) + candidate.bucketSize * 0.72);
    });

    center.y = sampleTerrainHeight(this.terrain, center.x, center.z);

    return {
      center,
      radius: Math.max(radius, 160),
      weight: totalWeight,
      updatedAt: performance.now(),
    };
  }

  private playerActionHighlight(players: PlayerLocation[]): ActionHighlightFocus | null {
    const candidates = players
      .map((player) => {
        const x = Number(player.x);
        const y = Number(player.y) || 0;
        const z = Number(player.z);

        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          return null;
        }

        return {
          position: rustWorldToViewerPosition(x, y, z),
          weight: player.isSelf === true ? 1.8 : 1,
        };
      })
      .filter((candidate): candidate is { position: Vector3; weight: number } => candidate !== null)
      .slice(0, 80);

    if (candidates.length === 0) {
      return null;
    }

    const center = new Vector3();
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    candidates.forEach((candidate) => {
      center.addScaledVector(candidate.position, candidate.weight / totalWeight);
    });

    let radius = 0;
    candidates.forEach((candidate) => {
      radius = Math.max(radius, center.distanceTo(candidate.position) + (candidate.weight > 1 ? 170 : 130));
    });

    center.y = sampleTerrainHeight(this.terrain, center.x, center.z);

    return {
      center,
      radius: Math.max(radius, 190),
      weight: totalWeight * 1.35,
      updatedAt: performance.now(),
    };
  }

  private setActionHighlight(source: ActionHighlightSource, focus: ActionHighlightFocus | null): void {
    const now = performance.now();
    const previous = this.currentActionHighlight();

    if (focus) {
      this.actionHighlights.set(source, { ...focus, updatedAt: now });
    } else {
      this.actionHighlights.delete(source);
    }

    const next = this.currentActionHighlight();

    if (!this.tourEnabled) {
      return;
    }

    if (!next) {
      if (previous) {
        this.startNextTour(now, true);
      }
      return;
    }

    const movedFarEnough = !previous || previous.center.distanceTo(next.center) > Math.max(140, Math.min(previous.radius, next.radius) * 0.36);

    if (movedFarEnough) {
      this.actionTourStartedAt = now;
      this.activePose = this.currentPose();
    }
  }

  private currentActionHighlight(): ActionHighlightFocus | null {
    if (this.actionHighlights.size === 0) {
      return null;
    }

    const highlights = Array.from(this.actionHighlights.values());
    const totalWeight = highlights.reduce((sum, highlight) => sum + Math.max(0.001, highlight.weight), 0);
    const center = new Vector3();

    highlights.forEach((highlight) => {
      center.addScaledVector(highlight.center, Math.max(0.001, highlight.weight) / totalWeight);
    });

    let radius = 0;
    highlights.forEach((highlight) => {
      radius = Math.max(radius, center.distanceTo(highlight.center) + highlight.radius);
    });

    center.y = sampleTerrainHeight(this.terrain, center.x, center.z);

    return {
      center,
      radius,
      weight: totalWeight,
      updatedAt: Math.max(...highlights.map((highlight) => highlight.updatedAt)),
    };
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

class AirstrikeReplayPlayer {
  private readonly layer: Group;
  private readonly terrain: TerrainPayload;
  private readonly profiles: Record<string, RuntimeVisualProfile>;
  private readonly vehicleMetadata: VehiclePreviewMetadataFile | null;
  private readonly assetBase: string;
  private readonly ambientEnabled: boolean;
  private readonly active = new Group();
  private runs: MapReplayRun[] = [];
  private nextAmbientStartAt = 0;
  private ambientSequence = 0;
  private explicitEventsVisible = false;

  public constructor(
    layer: Group,
    terrain: TerrainPayload,
    profiles: Record<string, RuntimeVisualProfile>,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
    ambientEnabled: boolean,
  ) {
    this.layer = layer;
    this.terrain = terrain;
    this.profiles = profiles;
    this.vehicleMetadata = vehicleMetadata;
    this.assetBase = assetBase;
    this.ambientEnabled = ambientEnabled;
    this.active.name = "active-map-replay-events";
    this.layer.add(this.active);
  }

  public start(): void {
    this.layer.userData.tick = (time: number) => this.tick(time);
  }

  public showEvents(events: MapReplayEvent[], playbackSpeed: number, options: ReplayDisplayOptions = {}): void {
    const mode = options.mode || "ambient";
    const cursorMs = Number(options.cursorMs);
    const visibleKeys = new Set<string>();
    this.explicitEventsVisible = events.length > 0;

    events.slice(0, mode === "timeline" ? 80 : 8).forEach((event, index) => {
      const key = replayEventKey(event, index);
      visibleKeys.add(key);
      const existing = this.runs.find((run) => run.key === key);
      if (existing) {
        if (mode === "timeline" && Number.isFinite(cursorMs)) {
          existing.syncToTimeline(cursorMs, playbackSpeed);
        }
        return;
      }

      const startAt = Number(this.layer.userData.lastTickTime || 0);
      const run = event.eventType === "airstrike"
        ? new AirstrikeReplayRun(key, event, this.terrain, this.profileForEvent(event), startAt, playbackSpeed, this.vehicleMetadata, this.assetBase)
        : event.eventType === "airdrop"
          ? new AirdropReplayRun(key, event, this.terrain, startAt, playbackSpeed, this.vehicleMetadata, this.assetBase)
          : new GenericMapEventReplayRun(key, event, this.terrain, startAt, playbackSpeed);
      if (mode === "timeline" && Number.isFinite(cursorMs)) {
        run.syncToTimeline(cursorMs, playbackSpeed);
      }
      this.runs.push(run);
      this.active.add(run.group);
    });

    if (mode === "timeline") {
      this.runs = this.runs.filter((run) => {
        if (visibleKeys.has(run.key) || (run.source === "ambient" && this.ambientEnabled && visibleKeys.size === 0)) {
          return true;
        }
        this.active.remove(run.group);
        disposeObjectTree(run.group);
        return false;
      });
    }
  }

  public clear(): void {
    this.runs.forEach((run) => {
      this.active.remove(run.group);
      disposeObjectTree(run.group);
    });
    this.runs = [];
    this.explicitEventsVisible = false;
    if (this.ambientEnabled) {
      this.nextAmbientStartAt = Number(this.layer.userData.lastTickTime || 0) + 0.6;
    }
  }

  private tick(time: number): void {
    this.layer.userData.lastTickTime = time;
    this.runs = this.runs.filter((run) => {
      const alive = run.update(time);
      if (!alive) {
        this.active.remove(run.group);
        disposeObjectTree(run.group);
      }
      return alive;
    });

    if (!this.ambientEnabled || this.explicitEventsVisible || this.runs.length > 0 || time < this.nextAmbientStartAt) {
      return;
    }

    const profiles = Object.values(this.profiles).filter(hasUsablePreviewTrack);
    const count = Math.random() > 0.72 ? 2 : 1;
    let longestDuration = 0;
    for (let index = 0; index < count; index += 1) {
      const profile = randomEntry(profiles);
      if (!profile) {
        continue;
      }
      const startAt = time + index * (0.35 + Math.random() * 0.55);
      const target = ambientReplayTarget(profile, this.terrain, index);
      const key = `ambient-${this.ambientSequence += 1}`;
      const run = new AirstrikeReplayRun(
        key,
        { eventType: "airstrike", x: 0, y: target.y, z: 0, vehicle: String(profile.Vehicle || "f15") },
        this.terrain,
        profile,
        startAt,
        1,
        this.vehicleMetadata,
        this.assetBase,
        "ambient",
        target,
      );
      longestDuration = Math.max(longestDuration, Number(profile.CompiledTrack?.DurationSeconds || profile.DurationSeconds || 8));
      this.runs.push(run);
      this.active.add(run.group);
    }
    this.nextAmbientStartAt = time + longestDuration + 1.6 + Math.random() * 2.8;
  }

  private profileForEvent(event: MapReplayEvent): RuntimeVisualProfile | null {
    const key = String(event.profileKey || "").trim();
    if (key && this.profiles[key] && hasUsablePreviewTrack(this.profiles[key])) {
      return this.profiles[key];
    }

    const vehicle = replayVehicleForEvent(event);
    const fallback = Object.values(this.profiles).find((profile) => {
      return hasUsablePreviewTrack(profile) && String(profile.Vehicle || "").toLowerCase() === vehicle;
    });

    // Never substitute an unrelated vehicle profile. A missing profile can
    // still use the event's vehicle proxy and fallback flyover, but choosing
    // the first published profile can turn a jet event into a drone.
    return fallback || null;
  }
}

type MapReplayRun = {
  key: string;
  source: "ambient" | "event";
  group: Group;
  update: (now: number) => boolean;
  syncToTimeline: (cursorMs: number, playbackSpeed: number) => void;
};

class AirstrikeReplayRun implements MapReplayRun {
  public readonly key: string;
  public readonly source: "ambient" | "event";
  public readonly group = new Group();
  private readonly profile: RuntimeVisualProfile | null;
  private readonly terrain: TerrainPayload;
  private readonly event: MapReplayEvent;
  private readonly startAt: number;
  private readonly duration: number;
  private readonly frames: RuntimeVisualFrame[];
  private readonly aircraft: Group;
  private readonly vehicle: string;
  private readonly payloads: RuntimePayloadEvent[];
  private readonly firedPayloads = new Set<number>();
  private readonly projectiles: AirstrikeProjectile[] = [];
  private readonly target: Vector3;
  private playbackSpeed: number;
  private timelineElapsed: number | null = null;
  private lastProfileTime = -1;

  public constructor(
    key: string,
    event: MapReplayEvent,
    terrain: TerrainPayload,
    profile: RuntimeVisualProfile | null,
    startAt: number,
    playbackSpeed: number,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
    source: "ambient" | "event" = "event",
    targetOverride: Vector3 | null = null,
  ) {
    this.key = key;
    this.source = source;
    this.profile = profile;
    this.terrain = terrain;
    this.event = event;
    this.startAt = startAt;
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.frames = profile ? normalizePreviewFrames(profile) : [];
    this.duration = Math.max(2, Number(profile?.CompiledTrack?.DurationSeconds || profile?.DurationSeconds || lastFrameTime(this.frames) || 8));
    this.payloads = profile ? normalizePayloadEvents(profile) : [];
    this.target = targetOverride?.clone() ?? replayEventPosition(event, terrain);
    this.vehicle = String(profile?.Vehicle || replayVehicleForEvent(event) || "f15");
    this.group.name = `airstrike-replay-${this.vehicle}`;
    this.aircraft = createAircraftMarker(this.vehicle, vehicleMetadata, assetBase);
    this.group.add(this.aircraft);
  }

  public update(now: number): boolean {
    const elapsed = this.timelineElapsed ?? (now - this.startAt);
    if (elapsed < 0) {
      this.group.visible = false;
      return true;
    }

    this.group.visible = true;
    if ((elapsed * this.playbackSpeed) > this.duration + 3.6 && this.projectiles.length === 0) {
      return false;
    }

    const profileTime = Math.min(elapsed * this.playbackSpeed, Math.max(0.1, lastFrameTime(this.frames)));
    if (profileTime + 0.05 < this.lastProfileTime) {
      this.clearProjectiles();
      this.firedPayloads.clear();
    }
    this.lastProfileTime = profileTime;
    const pose = this.frames.length >= 2
      ? samplePreviewPose(this.frames, profileTime)
      : fallbackFlyoverPose((elapsed * this.playbackSpeed) / Math.max(0.1, this.duration));
    const world = this.toWorld(pose.position);
    world.y = Math.max(world.y, sampleTerrainHeight(this.terrain, world.x, world.z) + 10);
    this.aircraft.position.copy(world);
    this.aircraft.quaternion.copy(pose.rotation).normalize();

    this.payloads.forEach((payload, index) => {
      if (!this.firedPayloads.has(index) && profileTime >= Number(payload.Time || 0)) {
        this.firedPayloads.add(index);
        this.spawnPayloadProjectiles(payload, pose, now);
      }
    });

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index]!;
      if (!projectile.update(now, this.playbackSpeed)) {
        this.group.remove(projectile.group);
        disposeObjectTree(projectile.group);
        this.projectiles.splice(index, 1);
      }
    }

    return true;
  }

  public syncToTimeline(cursorMs: number, playbackSpeed: number): void {
    const occurredMs = Date.parse(String(this.event.occurredAt || ""));
    if (!Number.isFinite(occurredMs) || !Number.isFinite(cursorMs)) {
      this.timelineElapsed = null;
      return;
    }
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.timelineElapsed = (cursorMs - occurredMs) / 1000 / this.playbackSpeed;
  }

  private toWorld(local: Vector3): Vector3 {
    return new Vector3(
      this.target.x + local.x,
      this.target.y + local.y,
      this.target.z + local.z,
    );
  }

  private spawnPayloadProjectiles(payload: RuntimePayloadEvent, pose: { position: Vector3; rotation: Quaternion }, now: number): void {
    const count = MathUtils.clamp(Math.round(Number(payload.Count || 1)), 1, 6);
    const spread = MathUtils.clamp(Number(payload.SpreadRadius || payload.ImpactRadius || 0), 0, 80);
    const impactRadius = MathUtils.clamp(Number(payload.ImpactRadius || payload.SplashRadius || 18), 10, 70);
    const fuseSeconds = MathUtils.clamp(Number(payload.FuseSeconds || 0.7), 0.18, 3.4);
    const payloadName = String(payload.Payload || this.event.payload?.payload || this.event.payload?.payloadType || "payload");

    for (let index = 0; index < count; index += 1) {
      const carrierOffset = new Vector3(
        Number(payload.CarrierOffsetX || 0),
        Number(payload.CarrierOffsetY || 0),
        Number(payload.CarrierOffsetZ || 0),
      );
      const convertedCarrierOffset = unityPositionToThreeVector({
        x: carrierOffset.x,
        y: carrierOffset.y,
        z: carrierOffset.z,
      }).applyQuaternion(pose.rotation);
      const origin = this.toWorld(pose.position.clone().add(convertedCarrierOffset));
      const targetOffset = unityPositionToThreeVector({
        x: Number(payload.TargetOffsetX || 0),
        y: Number(payload.TargetOffsetY || 0),
        z: Number(payload.TargetOffsetZ || 0),
      });
      if (spread > 0 && count > 1) {
        const angle = (index / count) * Math.PI * 2 + ((index % 2) * 0.37);
        const radius = spread * Math.sqrt((index + 0.65) / count);
        targetOffset.x += Math.cos(angle) * radius;
        targetOffset.z += Math.sin(angle) * radius;
      }
      const impact = this.toWorld(targetOffset);
      impact.y = sampleTerrainHeight(this.terrain, impact.x, impact.z) + 2;
      const projectile = new AirstrikeProjectile(origin, impact, now, fuseSeconds / this.playbackSpeed, impactRadius, payloadName);
      this.projectiles.push(projectile);
      this.group.add(projectile.group);
    }
  }

  private clearProjectiles(): void {
    this.projectiles.forEach((projectile) => {
      this.group.remove(projectile.group);
      disposeObjectTree(projectile.group);
    });
    this.projectiles.length = 0;
  }
}

class AirstrikeProjectile {
  public readonly group = new Group();
  private readonly projectile: Mesh;
  private readonly flash: Mesh;
  private readonly ring: Mesh;
  private readonly smoke: Sprite;
  private explodedAt = 0;

  public constructor(
    private readonly origin: Vector3,
    private readonly impact: Vector3,
    private readonly startAt: number,
    private readonly duration: number,
    private readonly impactRadius: number,
    payloadName: string,
  ) {
    this.group.name = `airstrike-payload-${payloadName}`;
    this.projectile = createPayloadPrimitive(payloadName, impactRadius);
    this.flash = createExplosionFlash(impactRadius);
    this.ring = createExplosionRing(impactRadius);
    this.smoke = createExplosionSmoke(impactRadius);
    this.flash.visible = false;
    this.ring.visible = false;
    this.smoke.visible = false;
    this.group.add(this.projectile, this.flash, this.ring, this.smoke);
  }

  public update(now: number, playbackSpeed: number): boolean {
    const progress = MathUtils.clamp((now - this.startAt) / Math.max(0.08, this.duration), 0, 1);

    if (progress < 1) {
      const arc = Math.sin(progress * Math.PI) * Math.max(22, this.origin.distanceTo(this.impact) * 0.08);
      this.projectile.visible = true;
      this.projectile.position.copy(this.origin).lerp(this.impact, easeInCubic(progress));
      this.projectile.position.y += arc;
      this.projectile.lookAt(this.impact);
      this.projectile.rotateX(Math.PI / 2);
      return true;
    }

    if (this.explodedAt === 0) {
      this.explodedAt = now;
      this.projectile.visible = false;
      this.flash.visible = true;
      this.ring.visible = true;
      this.smoke.visible = true;
      this.flash.position.copy(this.impact);
      this.ring.position.copy(this.impact);
      this.ring.position.y += 1.2;
      this.smoke.position.copy(this.impact).add(new Vector3(0, Math.max(12, this.impactRadius * 0.45), 0));
    }

    const age = (now - this.explodedAt) * MathUtils.clamp(playbackSpeed || 1, 0.5, 8);
    const flashProgress = MathUtils.clamp(age / 0.82, 0, 1);
    const smokeProgress = MathUtils.clamp(age / 1.9, 0, 1);
    const flashScale = MathUtils.lerp(0.18, 1.15, easeOutCubic(flashProgress));
    const ringScale = MathUtils.lerp(0.24, 1.85, easeOutCubic(flashProgress));
    this.flash.scale.setScalar(this.impactRadius * flashScale);
    this.ring.scale.set(this.impactRadius * ringScale, this.impactRadius * ringScale, 1);
    this.smoke.scale.setScalar(this.impactRadius * MathUtils.lerp(1.2, 3.1, easeOutCubic(smokeProgress)));
    setMaterialOpacity(this.flash.material, MathUtils.lerp(0.92, 0, flashProgress));
    setMaterialOpacity(this.ring.material, MathUtils.lerp(0.72, 0, flashProgress));
    setMaterialOpacity(this.smoke.material, MathUtils.lerp(0.38, 0, smokeProgress));

    return smokeProgress < 1;
  }
}

class AirdropReplayRun implements MapReplayRun {
  public readonly key: string;
  public readonly source = "event" as const;
  public readonly group = new Group();
  private readonly event: MapReplayEvent;
  private readonly terrain: TerrainPayload;
  private readonly target: Vector3;
  private readonly startAt: number;
  private readonly duration: number;
  private readonly flightStartX: number;
  private readonly flightEndX: number;
  private readonly releaseProgress: number;
  private readonly releaseTime: number;
  private readonly dropFallSeconds: number;
  private playbackSpeed: number;
  private readonly aircraft: Group;
  private readonly dropCount: number;
  private readonly packageVisuals: Array<{ packageMesh: Mesh; parachute: Mesh; offsetX: number; offsetZ: number }>;
  private timelineElapsed: number | null = null;

  public constructor(
    key: string,
    event: MapReplayEvent,
    terrain: TerrainPayload,
    startAt: number,
    playbackSpeed: number,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
  ) {
    this.key = key;
    this.event = event;
    this.terrain = terrain;
    this.target = replayEventPosition(event, terrain);
    this.startAt = startAt;
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    const worldSize = this.terrain.worldSize || 4500;
    const mapHalf = Math.max(worldSize / 2, 1200);
    const margin = MathUtils.clamp(worldSize * 0.18, 650, 1250);
    this.flightStartX = -mapHalf - margin;
    this.flightEndX = mapHalf + margin;
    const flightDistance = Math.abs(this.flightEndX - this.flightStartX);
    this.duration = MathUtils.clamp(flightDistance / 305, 16, 28);
    this.releaseProgress = MathUtils.clamp(
      (this.target.x - this.flightStartX) / Math.max(1, this.flightEndX - this.flightStartX),
      0.08,
      0.92,
    );
    this.releaseTime = this.releaseProgress * this.duration;
    this.dropFallSeconds = MathUtils.clamp(worldSize / 620, 5.5, 8.5);
    this.dropCount = Math.max(1, Number(event.payload?.dropCount || 1));
    const visualDropCount = MathUtils.clamp(Math.ceil(this.dropCount / 3), 1, 3);
    this.group.name = "airdrop-replay";
    this.aircraft = createAircraftMarker("cargo_plane", vehicleMetadata, assetBase);
    this.aircraft.scale.multiplyScalar(1.35);
    this.packageVisuals = Array.from({ length: visualDropCount }, (_, index) => {
      const packageMesh = new Mesh(
        new BoxGeometry(26, 20, 26),
        new MeshStandardMaterial({ color: 0x8a5f36, roughness: 0.82, metalness: 0.05 }),
      );
      packageMesh.name = `airdrop-replay-package-${index + 1}`;
      const parachute = new Mesh(
        new ConeGeometry(34, 22, 24, 1, true),
        new MeshStandardMaterial({ color: 0xf5ead8, roughness: 0.74, transparent: true, opacity: 0.88, side: DoubleSide }),
      );
      parachute.name = `airdrop-replay-parachute-${index + 1}`;
      const centeredIndex = index - ((visualDropCount - 1) / 2);
      this.group.add(packageMesh, parachute);
      return {
        packageMesh,
        parachute,
        offsetX: centeredIndex * 34,
        offsetZ: Math.abs(centeredIndex) * 10,
      };
    });
    this.group.add(this.aircraft);
  }

  public update(now: number): boolean {
    const elapsed = this.timelineElapsed ?? (now - this.startAt);
    if (elapsed < 0) {
      this.group.visible = false;
      return true;
    }

    this.group.visible = true;
    if ((elapsed * this.playbackSpeed) > this.duration + this.dropFallSeconds + 1.5) {
      return false;
    }

    const progress = MathUtils.clamp((elapsed * this.playbackSpeed) / Math.max(0.1, this.duration), 0, 1);
    const worldSize = this.terrain.worldSize || 4500;
    const x = MathUtils.lerp(this.flightStartX, this.flightEndX, progress);
    const z = this.target.z;
    const ground = sampleTerrainHeight(this.terrain, this.target.x, this.target.z);
    const planeHeight = ground + MathUtils.clamp(worldSize * 0.09, 260, 520);
    this.aircraft.position.set(x, planeHeight, z);
    // The corrected cargo model points down local -Z. Rotate it toward the
    // replay lane's +X direction without rolling it onto its side.
    this.aircraft.rotation.set(0, -Math.PI / 2, 0);

    const eventTime = elapsed * this.playbackSpeed;
    const fallProgress = MathUtils.clamp((eventTime - this.releaseTime) / this.dropFallSeconds, 0, 1);
    this.packageVisuals.forEach((visual, index) => {
      const staggerSeconds = index * 0.38;
      const visualProgress = MathUtils.clamp((eventTime - this.releaseTime - staggerSeconds) / this.dropFallSeconds, 0, 1);
      const visualHeight = MathUtils.lerp(planeHeight - 42, ground + 20, easeInOutCubic(visualProgress));
      const releaseX = MathUtils.lerp(this.flightStartX, this.flightEndX, MathUtils.clamp((this.releaseTime + staggerSeconds) / this.duration, 0, 1));
      visual.packageMesh.position.set(releaseX + visual.offsetX, visualHeight, this.target.z + visual.offsetZ);
      visual.parachute.position.set(visual.packageMesh.position.x, visualHeight + 34, visual.packageMesh.position.z);
      visual.packageMesh.visible = eventTime >= this.releaseTime + staggerSeconds;
      visual.parachute.visible = fallProgress > 0 && visual.packageMesh.visible && visualProgress < 0.98;
    });
    return true;
  }

  public syncToTimeline(cursorMs: number, playbackSpeed: number): void {
    const occurredMs = Date.parse(String(this.event.occurredAt || ""));
    if (!Number.isFinite(occurredMs) || !Number.isFinite(cursorMs)) {
      this.timelineElapsed = null;
      return;
    }
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.timelineElapsed = (((cursorMs - occurredMs) / 1000) + this.releaseTime) / this.playbackSpeed;
  }
}

class GenericMapEventReplayRun implements MapReplayRun {
  public readonly key: string;
  public readonly source = "event" as const;
  public readonly group = new Group();
  private readonly event: MapReplayEvent;
  private readonly target: Vector3;
  private readonly startAt: number;
  private readonly duration = 12;
  private playbackSpeed: number;
  private timelineElapsed: number | null = null;
  private readonly marker: Mesh;
  private readonly ring: Mesh;
  private readonly beacon: Sprite;

  public constructor(key: string, event: MapReplayEvent, terrain: TerrainPayload, startAt: number, playbackSpeed: number) {
    this.key = key;
    this.event = event;
    this.startAt = startAt;
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.target = replayEventPosition(event, terrain);
    this.target.y = sampleTerrainHeight(terrain, this.target.x, this.target.z) + 5;
    this.group.name = `map-event-replay-${String(event.eventType || "event")}`;
    this.marker = new Mesh(
      new SphereGeometry(13, 20, 12),
      new MeshStandardMaterial({ color: replayEventColor(event), emissive: replayEventColor(event), emissiveIntensity: 0.5, roughness: 0.5 }),
    );
    this.ring = new Mesh(
      new RingGeometry(28, 34, 48),
      new MeshStandardMaterial({ color: replayEventColor(event), transparent: true, opacity: 0.62, side: DoubleSide }),
    );
    this.beacon = new Sprite(new SpriteMaterial({ color: replayEventColor(event), transparent: true, opacity: 0.5, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.marker, this.ring, this.beacon);
  }

  public update(now: number): boolean {
    const elapsed = this.timelineElapsed ?? (now - this.startAt);
    if (elapsed < 0) {
      this.group.visible = false;
      return true;
    }

    const eventTime = elapsed * this.playbackSpeed;
    if (eventTime > this.duration) {
      return false;
    }

    this.group.visible = true;
    const progress = MathUtils.clamp(eventTime / this.duration, 0, 1);
    const pulse = 0.5 + (Math.sin(progress * Math.PI * 6) * 0.5);
    this.marker.position.copy(this.target).add(new Vector3(0, 10 + pulse * 10, 0));
    this.marker.scale.setScalar(MathUtils.lerp(0.8, 1.25, pulse));
    this.ring.position.copy(this.target);
    this.ring.scale.setScalar(MathUtils.lerp(0.5, 2.8, easeOutCubic(progress)));
    this.beacon.position.copy(this.target).add(new Vector3(0, 54, 0));
    this.beacon.scale.setScalar(MathUtils.lerp(38, 92, easeOutCubic(progress)));
    setMaterialOpacity(this.ring.material, MathUtils.lerp(0.62, 0, progress));
    setMaterialOpacity(this.beacon.material, MathUtils.lerp(0.48, 0, progress));
    return true;
  }

  public syncToTimeline(cursorMs: number, playbackSpeed: number): void {
    const occurredMs = Date.parse(String(this.event.occurredAt || ""));
    if (!Number.isFinite(occurredMs) || !Number.isFinite(cursorMs)) {
      this.timelineElapsed = null;
      return;
    }
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.timelineElapsed = (cursorMs - occurredMs) / 1000 / this.playbackSpeed;
  }
}

async function bindAirstrikePreview(root: HTMLElement, viewer: TerrainViewer): Promise<void> {
  const profilesUrl = root.dataset.airstrikeProfilesUrl || "";
  if (!profilesUrl) {
    return;
  }

  try {
    const assetBase = normalizedAssetBase(root);
    const [response, vehicleMetadata] = await Promise.all([
      fetch(profilesUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      loadVehicleMetadata(assetBase),
    ]);
    if (!response.ok) {
      throw new Error(`Airstrike profile request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json() as { profiles?: Record<string, RuntimeVisualProfile> };
    viewer.setAirstrikeProfiles(payload.profiles || {}, vehicleMetadata, assetBase, root.dataset.airstrikeAmbient === "true");
  } catch (error) {
    console.info("Raidlands airstrike map preview could not be loaded.", error);
  }
}

function normalizedAssetBase(root: HTMLElement): string {
  const configured = String(root.dataset.assetBase || "/assets/");
  return configured.endsWith("/") ? configured : `${configured}/`;
}

async function loadVehicleMetadata(assetBase: string): Promise<VehiclePreviewMetadataFile | null> {
  try {
    const response = await fetch(`${assetBase}airstrike-animation-editor/vehicle-preview.json`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Vehicle metadata request failed with HTTP ${response.status}.`);
    }
    return (await response.json()) as VehiclePreviewMetadataFile;
  } catch (error) {
    console.info("Raidlands airstrike vehicle assets could not be loaded.", error);
    return null;
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
      Payload: String(event.Payload || ""),
      Count: MathUtils.clamp(Math.round(Number(event.Count || 1)), 1, 12),
      CarrierOffsetX: Number(event.CarrierOffsetX || 0),
      CarrierOffsetY: Number(event.CarrierOffsetY || 0),
      CarrierOffsetZ: Number(event.CarrierOffsetZ || 0),
      TargetOffsetX: Number(event.TargetOffsetX || 0),
      TargetOffsetY: Number(event.TargetOffsetY || 0),
      TargetOffsetZ: Number(event.TargetOffsetZ || 0),
      SpreadRadius: Number(event.SpreadRadius || 0),
      FuseSeconds: Number(event.FuseSeconds || 0),
      SplashRadius: Number(event.SplashRadius || 0),
      ImpactRadius: Number(event.ImpactRadius || 0),
      LaunchSpeed: Number(event.LaunchSpeed || 0),
    }))
    .filter((event) => Number.isFinite(event.Time))
    .slice(0, 32);
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
  return unityPositionToThreeVector({
    x: frame.X,
    y: frame.Y,
    z: frame.Z,
  });
}

function frameQuaternion(frame: RuntimeVisualFrame): Quaternion {
  return unityQuaternionValueToThreeQuaternion({
    x: frame.Qx,
    y: frame.Qy,
    z: frame.Qz,
    w: frame.Qw,
  }).normalize();
}

function replayVehicleForEvent(event: MapReplayEvent): string {
  const explicit = String(event.vehicle || "").trim().toLowerCase();
  if (explicit) {
    return explicit;
  }

  const delivery = String(event.payload?.delivery || "").trim().toLowerCase();
  if (delivery === "cargo_plane_jet" || delivery === "jet" || delivery === "f15") {
    return "f15";
  }
  if (delivery.includes("cargo_plane")) {
    return "cargo_plane";
  }
  if (delivery.includes("attack_heli") || delivery.includes("helicopter")) {
    return "attack_heli";
  }
  if (delivery.includes("drone")) {
    return "drone";
  }
  return "";
}

function lastFrameTime(frames: RuntimeVisualFrame[]): number {
  return frames.length > 0 ? Number(frames[frames.length - 1].Time || 0) : 0;
}

function replayEventKey(event: MapReplayEvent, index: number): string {
  return String(event.eventKey || `${event.eventType || "event"}-${event.occurredAt || ""}-${event.x}-${event.z}-${index}`);
}

function replayEventPosition(event: MapReplayEvent, terrain: TerrainPayload): Vector3 {
  const x = Number.isFinite(Number(event.x)) ? Number(event.x) : 0;
  const z = Number.isFinite(Number(event.z)) ? Number(event.z) : 0;
  const position = rustWorldToViewerPosition(x, Number(event.y) || 0, z);
  position.y = Number.isFinite(Number(event.y)) ? position.y : sampleTerrainHeight(terrain, position.x, position.z);
  return position;
}

function replayEventColor(event: MapReplayEvent): number {
  const type = String(event.eventType || "").toLowerCase();
  if (type.includes("oil")) {
    return 0x5fb4ff;
  }
  if (type.includes("excavator") || type.includes("quarry")) {
    return 0xf6c65b;
  }
  if (type.includes("crate") || type.includes("hack")) {
    return 0x73f29a;
  }
  if (type.includes("cargo")) {
    return 0xd5ecff;
  }
  return 0xff8f4a;
}

function fallbackFlyoverPose(progress: number): { position: Vector3; rotation: Quaternion } {
  const clamped = MathUtils.clamp(progress, 0, 1);
  return {
    position: new Vector3(MathUtils.lerp(-170, 170, clamped), 38, 0),
    rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
  };
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

function easeInCubic(progress: number): number {
  return progress * progress * progress;
}

function easeOutCubic(progress: number): number {
  return 1 - ((1 - progress) ** 3);
}

function randomMapOrigin(terrain: TerrainPayload, lane: number): Vector3 {
  const worldSize = terrain.worldSize || 4500;
  const span = worldSize * 0.44;
  const x = (Math.random() - 0.5) * span + (lane === 0 ? -worldSize * 0.1 : worldSize * 0.1);
  const z = (Math.random() - 0.5) * span;
  return new Vector3(x, sampleTerrainHeight(terrain, x, z), z);
}

function ambientReplayTarget(profile: RuntimeVisualProfile, terrain: TerrainPayload, lane: number): Vector3 {
  const frames = normalizePreviewFrames(profile);
  const positions = frames.map(frameVector);
  if (positions.length === 0) {
    return randomMapOrigin(terrain, lane);
  }

  const xs = positions.map((position) => position.x);
  const zs = positions.map((position) => position.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const pathCenterX = (minX + maxX) / 2;
  const pathCenterZ = (minZ + maxZ) / 2;
  const mapHalf = Math.max(600, (terrain.worldSize || 4500) * 0.47);
  const availableX = Math.max(0, mapHalf - (maxX - minX) / 2);
  const availableZ = Math.max(0, mapHalf - (maxZ - minZ) / 2);
  const laneBias = lane === 0 ? -0.22 : 0.22;
  const desiredCenterX = MathUtils.clamp(
    ((Math.random() - 0.5) * 1.35 + laneBias) * availableX,
    -availableX,
    availableX,
  );
  const desiredCenterZ = (Math.random() - 0.5) * 1.5 * availableZ;
  const targetX = desiredCenterX - pathCenterX;
  const targetZ = desiredCenterZ - pathCenterZ;
  return new Vector3(targetX, sampleTerrainHeight(terrain, desiredCenterX, desiredCenterZ), targetZ);
}

function createAircraftMarker(vehicle: string, metadataFile: VehiclePreviewMetadataFile | null, assetBase: string): Group {
  const group = new Group();
  group.name = `airstrike-preview-aircraft-${vehicle}`;
  const metadata = metadataForVehicle(metadataFile, vehicle);
  const largestDimension = Math.max(metadata.bounds.x, metadata.bounds.y, metadata.bounds.z);
  const mapDisplaySize = Number(metadata.mapDisplaySize || 48);
  const mapVisualScale = Math.max(1, mapDisplaySize / Math.max(1, largestDimension));
  const displayedLargestDimension = largestDimension * mapVisualScale;
  group.scale.setScalar(mapVisualScale);
  group.userData.cameraSafetyRadius = MathUtils.clamp(displayedLargestDimension * 3.25, 72, 220);
  const fallback = createVehicleProxy(metadata);
  prepareLoadedAircraftForMap(fallback);
  group.add(fallback);

  void loadVehiclePreview(metadata, assetBase || "/assets/").then((result) => {
    if (result.usedFallback) {
      return;
    }
    group.remove(fallback);
    disposeObjectTree(fallback);
    prepareLoadedAircraftForMap(result.object);
    group.add(result.object);
  });

  return group;
}

function prepareLoadedAircraftForMap(object: Object3D): void {
  object.name = `airstrike-preview-${object.name || "vehicle-asset"}`;
  object.traverse((child) => {
    if (child.name.startsWith("hardpoint:")) {
      child.visible = false;
    }
    if (child instanceof Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
}

function createPayloadPrimitive(payloadName: string, impactRadius: number): Mesh {
  const key = payloadName.toLowerCase();
  const explosive = key.includes("rocket") || key.includes("missile") || key.includes("mlrs");
  const geometry = explosive
    ? new ConeGeometry(MathUtils.clamp(impactRadius * 0.12, 2.6, 6), MathUtils.clamp(impactRadius * 0.52, 10, 28), 10)
    : new SphereGeometry(MathUtils.clamp(impactRadius * 0.13, 3.2, 8), 12, 8);
  const material = new MeshStandardMaterial({
    color: explosive ? 0xd6dad5 : 0x3c3c36,
    emissive: explosive ? 0xff7b25 : 0xff3d16,
    emissiveIntensity: explosive ? 0.42 : 0.28,
    roughness: 0.46,
    metalness: explosive ? 0.2 : 0.05,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "airstrike-preview-payload-primitive";
  return mesh;
}

function createExplosionFlash(impactRadius: number): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(1, 18, 12),
    new MeshStandardMaterial({
      color: 0xfff0b8,
      emissive: 0xff681f,
      emissiveIntensity: 2.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  mesh.name = "airstrike-preview-explosion-flash";
  mesh.scale.setScalar(Math.max(6, impactRadius * 0.35));
  return mesh;
}

function createExplosionRing(impactRadius: number): Mesh {
  const mesh = new Mesh(
    new RingGeometry(0.72, 1, 36),
    new MeshStandardMaterial({
      color: 0xffb35c,
      emissive: 0xff4d16,
      emissiveIntensity: 1.6,
      roughness: 0.38,
      transparent: true,
      opacity: 0.72,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  mesh.name = "airstrike-preview-explosion-ring";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 1.2;
  mesh.scale.setScalar(Math.max(8, impactRadius * 0.6));
  return mesh;
}

function createExplosionSmoke(impactRadius: number): Sprite {
  const sprite = new Sprite(new SpriteMaterial({
    map: createExplosionSmokeTexture(),
    color: 0x6f655a,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }));
  sprite.name = "airstrike-preview-explosion-smoke";
  sprite.scale.setScalar(Math.max(20, impactRadius * 1.4));
  return sprite;
}

function createExplosionSmokeTexture(): CanvasTexture {
  return getSharedCanvasTexture("server-map:explosion-smoke", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255, 228, 172, 0.68)");
    gradient.addColorStop(0.18, "rgba(194, 116, 54, 0.48)");
    gradient.addColorStop(0.52, "rgba(92, 83, 74, 0.28)");
    gradient.addColorStop(1, "rgba(30, 28, 24, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
  });
}

function createPayloadFlash(position: Vector3, startTime: number): Mesh {
  const mesh = createExplosionFlash(18);
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
    createLaunchSiteMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("dome")) {
    createDomeMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("sphere")) {
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
    createOilRigMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("harbor")) {
    createHarborMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("bandit") || key.includes("banditcamp") || key.includes("bandit_camp")) {
    createBanditCampMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("apartment") || key.includes("apartments")) {
    // Apartment complexes occupy a full city block in-world; give the map proxy
    // enough footprint to read at the same zoom as the other large monuments.
    createApartmentComplexMonumentPrimitive(group, size * 1.42);
    return addTitle();
  }

  if (key.includes("mining_outpost") || key.includes("miningoutpost")) {
    createMiningOutpostMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("outpost") || key.includes("compound")) {
    createOutpostMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("water_treatment") || key.includes("watertreatment") || key.includes("water_treatment_plant")) {
    createWaterTreatmentPlantMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("powerplant") || key.includes("power_plant")) {
    addBox(group, size * 0.92, size * 0.2, size * 0.62, 0x5b605c, 0, size * 0.1, 0);
    addCylinder(group, size * 0.09, size * 0.92, 0x9a9a90, -size * 0.24, size * 0.55, 0);
    addCylinder(group, size * 0.09, size * 0.72, 0x9a9a90, 0, size * 0.45, 0);
    addCylinder(group, size * 0.09, size * 0.82, 0x9a9a90, size * 0.24, size * 0.5, 0);
    return addTitle();
  }

  if (key.includes("substation") || key.includes("sub_station")) {
    createSubstationMonumentPrimitive(group, size);
    return group;
  }

  if (key.includes("excavator")) {
    createExcavatorMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("trainyard") || key.includes("train_yard")) {
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, -size * 0.22);
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, size * 0.22);
    addBox(group, size * 0.72, size * 0.32, size * 0.34, 0x6f5f48, -size * 0.18, size * 0.18, 0);
    addBox(group, size * 0.34, size * 0.42, size * 0.28, 0x7f6b45, size * 0.38, size * 0.24, 0);
    return addTitle();
  }

  if (key.includes("abandoned") && (key.includes("military") || key.includes("military_base"))) {
    createAbandonedMilitaryBaseMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("missile") && key.includes("silo")) {
    createMissileSiloMonumentPrimitive(group, size);
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

function createOilRigMonumentPrimitive(group: Group, size: number): void {
  const deck = 0xc19b45;
  const rust = 0x8b4a35;
  const steel = 0x748086;
  const dark = 0x394348;

  // Broad multi-level deck with four tapered support legs and cross-bracing.
  addBox(group, size * 1.18, 5, size * 0.86, dark, 0, size * 0.72, 0);
  [
    [-0.46, -0.32], [0.46, -0.32], [-0.46, 0.32], [0.46, 0.32],
  ].forEach(([x, z]) => addCylinder(group, size * 0.055, size * 1.18, deck, size * x, size * 0.08, size * z));
  for (const z of [-0.32, 0.32]) {
    const brace = addBox(group, size * 0.98, size * 0.025, size * 0.025, rust, 0, size * 0.38, size * z);
    brace.rotation.z = z < 0 ? MathUtils.degToRad(16) : MathUtils.degToRad(-16);
  }

  // Stacked container modules, process pipework, and tanks.
  const modules = [
    [-0.42, 0.82, 0x9b4b35], [0.02, 0.82, 0x7f7770], [0.42, 0.82, 0xb1853b],
    [-0.3, 1.02, 0x768078], [0.24, 1.02, 0x984a36],
  ];
  modules.forEach(([x, y, color]) => addBox(group, size * 0.38, size * 0.12, size * 0.3, color, size * (x as number), size * (y as number), 0));
  for (const x of [-0.22, -0.08, 0.06, 0.2]) {
    addCylinder(group, size * 0.018, size * 0.42, steel, size * x, size * 1.16, -size * 0.34);
  }

  // Communications tower, flare stack, cranes, and helipad are the key skyline cues.
  addCylinder(group, size * 0.018, size * 1.3, rust, 0, size * 1.42, -size * 0.1);
  addCylinder(group, size * 0.12, size * 0.08, steel, 0, size * 2.1, -size * 0.1);
  addSphere(group, size * 0.11, 0xd2d0bd, 0, size * 2.2, -size * 0.1);
  addCylinder(group, size * 0.025, size * 0.62, rust, -size * 0.42, size * 1.45, size * 0.2);
  addCone(group, size * 0.06, size * 0.14, 0xe2a24b, -size * 0.42, size * 1.83, size * 0.2);
  addBox(group, size * 0.72, 2, size * 0.06, rust, 0, size * 1.58, size * 0.48);
  addBox(group, size * 0.06, 2, size * 0.52, rust, 0, size * 1.58, size * 0.48);
  addOilRigCrane(group, size, -size * 0.55, size * 1.35, -size * 0.28, MathUtils.degToRad(-18));
  addOilRigCrane(group, size, size * 0.56, size * 1.35, size * 0.2, MathUtils.degToRad(18));
  addOilRigLighting(group, size);

  const boats = new Group();
  boats.name = "oil-rig-npc-boat-patrol";
  const routes = [[-1.7, -0.9, 0.35], [1.55, -0.55, -0.25], [0.2, 1.7, 1.6]];
  routes.forEach(([x, z, phase], index) => {
    const boat = createNpcBoat(size * 0.11);
    boat.userData.radius = size * (0.95 + index * 0.18);
    boat.userData.phase = phase;
    boat.userData.speed = 0.16 + index * 0.025;
    boat.position.set(size * x, -size * 0.02, size * z);
    boats.add(boat);
  });
  boats.userData.tick = (seconds: number) => {
    boats.children.forEach((boat) => {
      const radius = Number(boat.userData.radius);
      const angle = seconds * Number(boat.userData.speed) + Number(boat.userData.phase);
      boat.position.x = Math.cos(angle) * radius;
      boat.position.z = Math.sin(angle) * radius * 0.72;
      boat.rotation.y = -angle + Math.PI / 2;
    });
  };
  group.add(boats);
}

function addOilRigLighting(group: Group, size: number): void {
  const lighting = new Group();
  lighting.name = "oil-rig-night-lighting";

  const addLamp = (x: number, y: number, z: number, color: number, intensity: number, distance: number, sizePx = size * 0.018) => {
    const lamp = addSphere(lighting, sizePx, color, x, y, z);
    (lamp.material as MeshStandardMaterial).emissive.set(color);
    (lamp.material as MeshStandardMaterial).emissiveIntensity = 3.4;
    const light = new PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    lighting.add(light);
  };

  // Warm cabin and container lights across the stacked living/work decks.
  [-0.46, -0.18, 0.12, 0.42].forEach((x) => {
    [0.73, 0.92, 1.1].forEach((y) => addLamp(size * x, size * y, size * 0.44, 0xffb43d, 0.7, size * 0.6));
  });
  // Cool task lights mark the exterior catwalks and lower service level.
  [-0.52, -0.17, 0.2, 0.54].forEach((x) => addLamp(size * x, size * 0.62, -size * 0.45, 0x9fdcff, 0.42, size * 0.42, size * 0.014));
  // Red obstruction beacons on the communications tower and crane tips.
  [[0, 2.12, -0.1], [-0.82, 1.58, -0.3], [0.84, 1.58, 0.2]].forEach(([x, y, z]) => addLamp(size * x, size * y, size * z, 0xff1d22, 0.9, size * 0.42, size * 0.022));

  // Flare stack: a bright emissive core, a tapered flame, and a localized orange glow.
  const flare = addCone(lighting, size * 0.075, size * 0.18, 0xffa52e, -size * 0.42, size * 1.88, size * 0.2);
  const flareMaterial = flare.material as MeshStandardMaterial;
  flareMaterial.emissive.set(0xff4d16);
  flareMaterial.emissiveIntensity = 5;
  const flareLight = new PointLight(0xff7a22, 2.6, size * 1.4, 2);
  flareLight.position.set(-size * 0.42, size * 1.92, size * 0.2);
  lighting.add(flareLight);
  lighting.userData.tick = (seconds: number) => {
    const pulse = 0.88 + Math.sin(seconds * 11.5) * 0.08 + Math.sin(seconds * 23.1) * 0.04;
    flare.scale.set(0.92 + pulse * 0.08, pulse, 0.92 + pulse * 0.08);
    flareLight.intensity = 2.2 + pulse * 0.8;
  };
  group.add(lighting);
}

function addOilRigCrane(group: Group, size: number, x: number, y: number, z: number, rotationY: number): void {
  const boom = addBox(group, size * 0.52, size * 0.035, size * 0.035, 0x9d5837, x, y, z);
  boom.rotation.y = rotationY;
  const base = addBox(group, size * 0.12, size * 0.24, size * 0.12, 0x6b4d36, x, y - size * 0.1, z);
  base.rotation.y = rotationY;
}

function createNpcBoat(size: number): Group {
  const boat = new Group();
  addBox(boat, size * 1.8, size * 0.18, size * 0.42, 0x252d30, 0, 0, 0);
  addBox(boat, size * 0.42, size * 0.26, size * 0.28, 0x3b4648, -size * 0.12, size * 0.16, 0);
  addBox(boat, size * 0.08, size * 0.34, size * 0.08, 0x171d1e, -size * 0.12, size * 0.4, 0);
  addBox(boat, size * 0.24, size * 0.05, size * 0.05, 0x171d1e, -size * 0.12, size * 0.48, 0);
  const wake = addBox(boat, size * 0.65, size * 0.025, size * 0.08, 0xb4d4d8, size * 0.92, -size * 0.02, 0);
  (wake.material as MeshStandardMaterial).transparent = true;
  (wake.material as MeshStandardMaterial).opacity = 0.6;
  return boat;
}

function createWaterTreatmentPlantMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x777b76;
  const concreteDark = 0x4d5550;
  const rust = 0x8d4b35;
  const roof = 0x514841;
  const water = 0x426b70;
  const pipe = 0x9b5b3e;

  // The monument is a long, walled industrial yard rather than a single block.
  addBox(group, size * 1.72, 3, size * 1.18, concreteDark, 0, 1.5, 0);
  addBox(group, size * 1.55, 2.2, size * 0.96, 0x6b706b, 0, 3, 0);

  // Four circular settling/clarifier basins are the most useful overhead read.
  const basinRadius = size * 0.22;
  for (const [x, z] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.34], [0.48, 0.34]]) {
    addCylinder(group, basinRadius, 4, concrete, size * x, 5, size * z);
    addCylinder(group, basinRadius * 0.78, 0.8, water, size * x, 7.15, size * z);
    addCylinder(group, basinRadius * 0.08, 6, rust, size * x, 10, size * z);
    addBox(group, basinRadius * 1.65, 1.2, basinRadius * 0.07, rust, size * x, 10.2, size * z);
  }

  // Central process hall and the long side warehouse.
  addBox(group, size * 0.48, size * 0.28, size * 0.3, concreteDark, 0, size * 0.2, -size * 0.04);
  addBox(group, size * 0.82, size * 0.2, size * 0.22, roof, -size * 0.25, size * 0.16, size * 0.6);
  addBox(group, size * 0.25, size * 0.24, size * 0.74, roof, size * 0.68, size * 0.18, 0);

  // Elevated trunk pipes connect the tanks and make the plant legible at low zoom.
  addBox(group, size * 1.3, 3, size * 0.055, pipe, 0, size * 0.42, size * 0.02);
  addBox(group, size * 0.055, 3, size * 0.9, pipe, -size * 0.72, size * 0.42, 0);
  addBox(group, size * 0.055, 3, size * 0.9, pipe, size * 0.72, size * 0.42, 0);

  // Rear utility tanks and the tall water tower visible in the approach views.
  addCylinder(group, size * 0.13, size * 0.72, rust, -size * 0.65, size * 0.48, -size * 0.55);
  addCylinder(group, size * 0.18, size * 0.82, rust, size * 0.65, size * 0.54, -size * 0.58);
  addCylinder(group, size * 0.16, size * 1.35, 0x646b65, 0, size * 0.74, -size * 0.58);
  addCylinder(group, size * 0.24, size * 0.24, rust, 0, size * 1.45, -size * 0.58);
  addBox(group, size * 0.62, 2.5, size * 0.05, concreteDark, 0, 1.25, -size * 0.61);
}

function createAbandonedMilitaryBaseMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x8b887b;
  const earth = 0x656052;
  const canvas = 0x9b9379;
  const rust = 0x624638;
  const vehicle = 0x5b4939;
  const track = 0x292c2a;
  const dark = 0x30302c;

  // Broad fortified footprint: the real monument reads as a walled military yard.
  addBox(group, size * 1.65, size * 0.035, size * 1.22, earth, 0, size * 0.02, 0);
  addBox(group, size * 1.82, size * 0.2, size * 0.055, concrete, 0, size * 0.1, -size * 0.62);
  addBox(group, size * 1.82, size * 0.2, size * 0.055, concrete, 0, size * 0.1, size * 0.62);
  addBox(group, size * 0.055, size * 0.2, size * 1.18, concrete, -size * 0.88, size * 0.1, 0);
  addBox(group, size * 0.055, size * 0.2, size * 1.18, concrete, size * 0.88, size * 0.1, 0);

  // Three damaged canvas/quonset shelters visible from overhead.
  [-0.52, 0.02, 0.55].forEach((x, index) => {
    addBox(group, size * 0.38, size * 0.2, size * 0.32, canvas, size * x, size * 0.12, size * 0.31);
    addBox(group, size * 0.42, size * 0.035, size * 0.36, rust, size * x, size * 0.33, size * 0.31);
    if (index === 1) addBox(group, size * 0.08, size * 0.18, size * 0.02, dark, size * x, size * 0.11, size * 0.14);
  });
  addBox(group, size * 0.46, size * 0.24, size * 0.3, concrete, -size * 0.55, size * 0.14, -size * 0.32);

  // Water tanks and a ruined utility tower anchor the rear service area.
  [-0.26, 0.02].forEach((x) => {
    addCylinder(group, size * 0.13, size * 0.42, 0x72736c, size * x, size * 0.27, -size * 0.34);
    addCylinder(group, size * 0.15, size * 0.025, rust, size * x, size * 0.49, -size * 0.34);
    addBox(group, size * 0.035, size * 0.15, size * 0.035, rust, size * x, size * 0.58, -size * 0.34);
  });

  // Tracked MLRS vehicle: this is the future map-event launch origin.
  const mlrsX = size * 0.38;
  const mlrsZ = -size * 0.2;
  addBox(group, size * 0.52, size * 0.12, size * 0.22, track, mlrsX, size * 0.09, mlrsZ - size * 0.13);
  addBox(group, size * 0.52, size * 0.12, size * 0.22, track, mlrsX, size * 0.09, mlrsZ + size * 0.13);
  addBox(group, size * 0.4, size * 0.22, size * 0.28, vehicle, mlrsX, size * 0.22, mlrsZ);
  addBox(group, size * 0.22, size * 0.16, size * 0.25, vehicle, mlrsX - size * 0.12, size * 0.36, mlrsZ);
  addBox(group, size * 0.06, size * 0.06, size * 0.34, dark, mlrsX - size * 0.27, size * 0.36, mlrsZ);
  const launcher = addBox(group, size * 0.11, size * 0.5, size * 0.36, vehicle, mlrsX + size * 0.17, size * 0.55, mlrsZ);
  launcher.rotation.z = MathUtils.degToRad(-27);
  addBox(group, size * 0.13, size * 0.035, size * 0.39, dark, mlrsX + size * 0.29, size * 0.78, mlrsZ);
  [-0.11, 0, 0.11].forEach((z) => addCylinder(group, size * 0.025, size * 0.32, dark, mlrsX + size * 0.28, size * 0.82, mlrsZ + size * z));
}

function createMissileSiloMonumentPrimitive(group: Group, size: number): void {
  const earth = 0x5c5547;
  const concrete = 0x77756d;
  const darkConcrete = 0x343733;
  const steel = 0x5d5c57;
  const rust = 0x704332;
  const canvas = 0x76705d;

  // Excavated security yard and concrete perimeter walls.
  addBox(group, size * 1.72, size * 0.035, size * 1.3, earth, 0, size * 0.018, 0);
  addBox(group, size * 1.85, size * 0.16, size * 0.045, concrete, 0, size * 0.08, -size * 0.65);
  addBox(group, size * 1.85, size * 0.16, size * 0.045, concrete, 0, size * 0.08, size * 0.65);
  addBox(group, size * 0.045, size * 0.16, size * 1.3, concrete, -size * 0.92, size * 0.08, 0);
  addBox(group, size * 0.045, size * 0.16, size * 1.3, concrete, size * 0.92, size * 0.08, 0);

  // Large circular silo cap is the key overhead landmark.
  const siloX = 0;
  const siloZ = -size * 0.08;
  // The shaft is intentionally below the terrain anchor. The raised collar and
  // dark opening keep its underground construction readable in the map viewer.
  addCylinder(group, size * 0.43, size * 0.5, darkConcrete, siloX, -size * 0.18, siloZ);
  addCylinder(group, size * 0.37, size * 0.42, 0x202522, siloX, -size * 0.16, siloZ);
  addCylinder(group, size * 0.49, size * 0.08, darkConcrete, siloX, size * 0.08, siloZ);
  addCylinder(group, size * 0.42, size * 0.055, steel, siloX, size * 0.14, siloZ);
  addCylinder(group, size * 0.31, size * 0.025, 0x171b19, siloX, size * 0.18, siloZ);
  addCylinder(group, size * 0.2, size * 0.035, darkConcrete, siloX, size * 0.2, siloZ);
  addCylinder(group, size * 0.08, size * 0.025, rust, siloX, size * 0.23, siloZ);

  // Three ribbed access shelters in front of the silo.
  [-0.52, 0, 0.52].forEach((x, index) => {
    addBox(group, size * 0.38, size * 0.22, size * 0.3, canvas, size * x, size * 0.13, size * 0.4);
    addBox(group, size * 0.42, size * 0.035, size * 0.34, rust, size * x, size * 0.28, size * 0.4);
    for (let rib = -0.14; rib <= 0.14; rib += 0.07) {
      addBox(group, size * 0.018, size * 0.25, size * 0.32, steel, size * (x + rib), size * 0.15, size * 0.4);
    }
    if (index === 1) addBox(group, size * 0.08, size * 0.14, size * 0.02, darkConcrete, size * x, size * 0.1, size * 0.24);
  });

  // Guard tower and communications mast distinguish the facility from an ordinary bunker.
  addBox(group, size * 0.045, size * 0.7, size * 0.045, rust, size * 0.7, size * 0.36, size * 0.42);
  addBox(group, size * 0.22, size * 0.06, size * 0.22, steel, size * 0.7, size * 0.7, size * 0.42);
  addBox(group, size * 0.26, size * 0.04, size * 0.26, darkConcrete, size * 0.7, size * 0.76, size * 0.42);
  addCylinder(group, size * 0.025, size * 0.42, rust, -size * 0.68, size * 0.3, -size * 0.38);
  addBox(group, size * 0.16, size * 0.025, size * 0.025, rust, -size * 0.68, size * 0.48, -size * 0.38);
}

function createSubstationMonumentPrimitive(group: Group, size: number): void {
  const rust = 0x784535;
  const darkRust = 0x4a3029;
  const steel = 0x68716d;
  const corrugated = 0x65706d;
  const concrete = 0x9b9788;
  const insulator = 0xc8d0c6;

  // Broken concrete yard and low corrugated perimeter fence.
  addBox(group, size * 1.2, size * 0.035, size * 0.82, concrete, 0, size * 0.018, 0);
  addBox(group, size * 1.46, size * 0.18, size * 0.035, rust, 0, size * 0.09, -size * 0.5);
  addBox(group, size * 1.46, size * 0.18, size * 0.035, rust, 0, size * 0.09, size * 0.5);
  addBox(group, size * 0.035, size * 0.18, size * 0.9, rust, -size * 0.72, size * 0.09, 0);
  addBox(group, size * 0.035, size * 0.18, size * 0.9, rust, size * 0.72, size * 0.09, 0);

  // Transformer banks: horizontal weathered tanks on concrete feet.
  [-0.31, 0.02, 0.35].forEach((x, index) => {
    addBox(group, size * 0.2, size * 0.08, size * 0.18, concrete, size * x, size * 0.08, size * 0.18);
    const tank = addCylinder(group, size * 0.13, size * 0.38, index === 1 ? rust : corrugated, size * x, size * 0.31, size * 0.18);
    tank.rotation.z = Math.PI / 2;
    addCylinder(group, size * 0.035, size * 0.08, steel, size * (x - 0.12), size * 0.31, size * 0.18);
    addCylinder(group, size * 0.035, size * 0.08, steel, size * (x + 0.12), size * 0.31, size * 0.18);
  });

  // Tall busbar gantry with three pale insulators and a suspended crossbar.
  [-0.48, 0.48].forEach((x) => {
    addBox(group, size * 0.045, size * 0.95, size * 0.045, darkRust, size * x, size * 0.5, -size * 0.2);
    addBox(group, size * 0.07, size * 0.06, size * 0.07, concrete, size * x, size * 0.045, -size * 0.2);
  });
  addBox(group, size * 1.02, size * 0.045, size * 0.045, rust, 0, size * 0.92, -size * 0.2);
  [-0.3, 0, 0.3].forEach((x) => {
    addCylinder(group, size * 0.035, size * 0.2, insulator, size * x, size * 0.81, -size * 0.2);
    addCylinder(group, size * 0.05, size * 0.025, steel, size * x, size * 0.7, -size * 0.2);
  });

  // Corrugated control hut and a couple of smaller switchgear cabinets.
  addBox(group, size * 0.58, size * 0.34, size * 0.4, corrugated, -size * 0.35, size * 0.2, size * 0.3);
  addBox(group, size * 0.62, size * 0.045, size * 0.44, rust, -size * 0.35, size * 0.4, size * 0.3);
  [-0.08, 0.18].forEach((x) => addBox(group, size * 0.13, size * 0.25, size * 0.18, steel, size * x, size * 0.14, -size * 0.28));
}

function createDomeMonumentPrimitive(group: Group, size: number): void {
  const rust = 0x793f2d;
  const darkRust = 0x432b24;
  const steel = 0x64615a;
  const concrete = 0x89877d;
  const catwalk = 0x9a5638;
  const foliage = 0x4c633d;

  // The Dome is an elevated industrial tank, not a ground-level smooth sphere.
  addCylinder(group, size * 0.74, 4.5, concrete, 0, 2.25, 0);
  const tank = addSphere(group, size * 0.56, rust, 0, size * 0.94, 0);
  tank.scale.y = 0.96;

  // Welded horizontal bands and a rim catwalk give the sphere its weathered steel read.
  [0.63, 0.92, 1.2].forEach((height) => {
    const band = addCylinder(group, size * 0.575, size * 0.025, darkRust, 0, size * height, 0);
    band.scale.y = 1;
  });
  const rim = addCylinder(group, size * 0.5, size * 0.035, catwalk, 0, size * 1.42, 0);
  rim.scale.y = 1;

  // Raised top deck / hatch and its circular guardrail.
  addCylinder(group, size * 0.28, size * 0.09, darkRust, 0, size * 1.54, 0);
  addCylinder(group, size * 0.18, size * 0.05, steel, 0, size * 1.61, 0);
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const x = Math.cos(angle) * size * 0.29;
    const z = Math.sin(angle) * size * 0.29;
    addCylinder(group, size * 0.012, size * 0.1, steel, x, size * 1.7, z);
  }

  // Four heavy support legs, diagonal braces, and the exterior access stair.
  [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(([x, z]) => {
    addBox(group, size * 0.07, size * 0.78, size * 0.07, darkRust, size * x, size * 0.42, size * z);
    addBox(group, size * 0.16, size * 0.05, size * 0.16, concrete, size * x, size * 0.04, size * z);
  });
  [-1, 1].forEach((sign) => {
    const brace = addBox(group, size * 0.74, size * 0.026, size * 0.026, catwalk, 0, size * 0.42, size * sign * 0.38);
    brace.rotation.z = MathUtils.degToRad(sign * 24);
  });
  const stair = addBox(group, size * 0.52, size * 0.05, size * 0.13, catwalk, size * 0.56, size * 0.42, -size * 0.16);
  stair.rotation.z = MathUtils.degToRad(-28);

  // The adjacent rusted silos make the monument recognizable from the map camera.
  [[-0.72, -0.42, 0.24], [-0.62, -0.68, 0.2], [-0.4, -0.58, 0.17]].forEach(([x, z, radius]) => {
    addCylinder(group, size * radius, size * 0.55, rust, size * x, size * 0.34, size * z);
    addCylinder(group, size * (radius + 0.02), size * 0.035, catwalk, size * x, size * 0.63, size * z);
  });

  [[-0.48, 0.3], [0.42, -0.24], [0.54, 0.34], [-0.18, 0.52]].forEach(([x, z]) => {
    addCylinder(group, size * 0.02, size * 0.22, 0x483a29, size * x, size * 0.14, size * z);
    addSphere(group, size * 0.1, foliage, size * x, size * 0.31, size * z);
  });
}

function createMiningOutpostMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x6b6a61;
  const darkConcrete = 0x41443f;
  const corrugatedRoof = 0x74777a;
  const rust = 0x914831;
  const darkRust = 0x5a3028;
  const container = 0x70743c;
  const crate = 0xa88659;
  const tire = 0x242626;
  const shrub = 0x435737;

  // Mining Outpost is a low, open-sided workshop, deliberately unlike the walled Outpost town.
  addBox(group, size * 1.12, 3.5, size * 0.82, concrete, 0, 1.75, 0);
  addBox(group, size * 0.94, size * 0.035, size * 0.62, darkConcrete, 0, size * 0.08, -size * 0.02);

  // Corrugated gable roof, visible from the map's top camera.
  const roofLeft = addBox(group, size * 0.96, size * 0.05, size * 0.42, corrugatedRoof, 0, size * 0.35, -size * 0.13);
  roofLeft.rotation.x = MathUtils.degToRad(12);
  const roofRight = addBox(group, size * 0.96, size * 0.05, size * 0.42, corrugatedRoof, 0, size * 0.35, size * 0.13);
  roofRight.rotation.x = MathUtils.degToRad(-12);
  for (let stripe = -0.38; stripe <= 0.38; stripe += 0.11) {
    addBox(group, size * 0.014, size * 0.06, size * 0.84, darkRust, size * stripe, size * 0.37, 0);
  }

  // Rear wall and red steel frame; the front remains open toward the viewer.
  addBox(group, size * 0.96, size * 0.24, size * 0.045, darkConcrete, 0, size * 0.17, size * 0.3);
  [-0.47, 0.47].forEach((x) => addBox(group, size * 0.04, size * 0.46, size * 0.04, rust, size * x, size * 0.24, -size * 0.3));
  addBox(group, size * 1.02, size * 0.04, size * 0.04, rust, 0, size * 0.42, -size * 0.3);
  addBox(group, size * 0.05, size * 0.46, size * 0.04, rust, 0, size * 0.24, size * 0.3);

  // Workshop contents: shipping container, crate stacks, forklift silhouette, drums and tyres.
  addBox(group, size * 0.28, size * 0.17, size * 0.18, container, -size * 0.18, size * 0.15, size * 0.08);
  [[0.2, -0.08, 0.1], [0.32, -0.1, 0.075], [0.2, 0.04, 0.07]].forEach(([x, z, scale]) => addBox(group, size * scale, size * scale, size * scale, crate, size * x, size * scale * 0.5 + size * 0.08, size * z));
  addBox(group, size * 0.13, size * 0.1, size * 0.18, 0xc69835, size * 0.18, size * 0.12, size * 0.16);
  addBox(group, size * 0.025, size * 0.22, size * 0.025, darkRust, size * 0.25, size * 0.25, size * 0.16);
  [-0.08, 0.08].forEach((x) => addCylinder(group, size * 0.043, size * 0.06, tire, size * (0.18 + x), size * 0.07, size * 0.16));
  [-0.34, -0.25].forEach((x) => addCylinder(group, size * 0.045, size * 0.12, 0x4b5960, size * x, size * 0.12, -size * 0.17));
  [[-0.6, -0.32], [0.6, 0.28], [-0.56, 0.32]].forEach(([x, z]) => {
    addCylinder(group, size * 0.02, size * 0.16, 0x4b4230, size * x, size * 0.12, size * z);
    addSphere(group, size * 0.07, shrub, size * x, size * 0.24, size * z);
  });
}

function createApartmentComplexMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x85837d;
  const weatheredConcrete = 0x656560;
  const roof = 0x3e4140;
  const window = 0x273a44;
  const pavement = 0x5b5d59;
  const curb = 0xb2afa2;
  const grass = 0x526448;
  const tree = 0x405937;
  const rubble = 0x766a5b;

  // Courtyard and perimeter pavement create the large, city-block footprint visible from TOP.
  addBox(group, size * 1.78, 3.5, size * 1.52, pavement, 0, 1.75, 0);
  addBox(group, size * 1.48, size * 0.03, size * 0.9, grass, 0, size * 0.07, size * 0.05);
  addBox(group, size * 1.86, size * 0.04, size * 0.04, curb, 0, size * 0.09, -size * 0.76);
  addBox(group, size * 1.86, size * 0.04, size * 0.04, curb, 0, size * 0.09, size * 0.76);

  // Three tall slabs surround the central yard, matching the apartment complex's unmistakable skyline.
  addApartmentSlab(group, size, -size * 0.48, -size * 0.37, size * 0.55, size * 0.37, size * 0.46, concrete, roof, window, MathUtils.degToRad(90));
  addApartmentSlab(group, size, size * 0.5, -size * 0.37, size * 0.55, size * 0.37, size * 0.42, weatheredConcrete, roof, window, MathUtils.degToRad(90));
  addApartmentSlab(group, size, 0, size * 0.45, size * 0.95, size * 0.37, size * 0.4, concrete, roof, window, 0);

  // Lower entrance block and roof helipad preserve the recognisable service/safe-zone side of the monument.
  addBox(group, size * 0.54, size * 0.18, size * 0.22, weatheredConcrete, 0, size * 0.13, -size * 0.05);
  addCylinder(group, size * 0.14, size * 0.022, 0x424744, size * 0.5, size * 0.46, -size * 0.37);
  addCylinder(group, size * 0.1, size * 0.026, 0xd6d0a9, size * 0.5, size * 0.485, -size * 0.37);
  addBox(group, size * 0.038, size * 0.016, size * 0.18, 0x424744, size * 0.5, size * 0.51, -size * 0.37);
  addBox(group, size * 0.18, size * 0.016, size * 0.038, 0x424744, size * 0.5, size * 0.515, -size * 0.37);

  [[-0.58, 0.04], [-0.36, 0.16], [0.05, 0.02], [0.62, 0.12], [-0.66, 0.58], [0.62, 0.56]].forEach(([x, z]) => {
    addCylinder(group, size * 0.018, size * 0.22, 0x4c4030, size * x, size * 0.15, size * z);
    addSphere(group, size * 0.075, tree, size * x, size * 0.28, size * z);
  });

  [[-0.15, -0.05], [-0.04, -0.15], [0.1, -0.06]].forEach(([x, z], index) => {
    addBox(group, size * (0.11 + index * 0.02), size * 0.08, size * 0.09, rubble, size * x, size * 0.12, size * z);
  });
}

function addApartmentSlab(group: Group, size: number, x: number, z: number, width: number, depth: number, height: number, wallColor: number, roofColor: number, windowColor: number, rotationY: number): void {
  const body = addBox(group, width, height, depth, wallColor, x, height / 2 + size * 0.1, z);
  body.rotation.y = rotationY;
  const roof = addBox(group, width * 1.06, size * 0.055, depth * 1.08, roofColor, x, height + size * 0.12, z);
  roof.rotation.y = rotationY;

  const longSide = Math.max(width, depth);
  const narrowSide = Math.min(width, depth);
  for (let level = 0; level < 5; level += 1) {
    const windowBand = addBox(group, longSide * 0.76, size * 0.035, size * 0.012, windowColor, x, size * 0.22 + height * (0.18 + level * 0.15), z - narrowSide * 0.52);
    windowBand.rotation.y = rotationY;
  }

  addBox(group, size * 0.055, size * 0.1, size * 0.07, roofColor, x - width * 0.2, height + size * 0.18, z);
  addBox(group, size * 0.05, size * 0.08, size * 0.06, roofColor, x + width * 0.22, height + size * 0.17, z);
}

function createBanditCampMonumentPrimitive(group: Group, size: number): void {
  const mud = 0x49483a;
  const water = 0x384c4b;
  const wood = 0x604530;
  const darkWood = 0x35271e;
  const shack = 0x8d6c49;
  const roof = 0x5d4936;
  const rust = 0x93492f;
  const steel = 0x62675d;
  const tarp = 0x9d3f2c;
  const marketTarp = 0xc2a45f;
  const fire = 0xff8d31;
  const swampTree = 0x425038;

  // A shallow, irregular-looking wetland base keeps the camp distinct from Outpost's dry square compound.
  addCylinder(group, size * 0.82, 3.5, water, size * 0.14, 1.75, -size * 0.03);
  addCylinder(group, size * 0.68, 4.4, mud, -size * 0.08, 2.2, size * 0.02);

  // Palisade ring, intentionally broken at the dock/gate side.
  const palisadeRadius = size * 0.68;
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18;
    if (Math.abs(Math.sin(angle)) < 0.22 && Math.cos(angle) > 0.45) continue;
    const x = -size * 0.08 + Math.cos(angle) * palisadeRadius;
    const z = size * 0.02 + Math.sin(angle) * palisadeRadius * 0.76;
    const post = addCylinder(group, size * 0.028, size * (0.28 + (index % 3) * 0.025), wood, x, size * 0.17, z);
    post.rotation.z = MathUtils.degToRad(index % 2 === 0 ? -3 : 3);
  }

  addBanditCampShack(group, size, -size * 0.3, -size * 0.24, size * 0.31, size * 0.22, shack, roof, 0);
  addBanditCampShack(group, size, size * 0.26, -size * 0.25, size * 0.28, size * 0.2, 0x76644c, tarp, MathUtils.degToRad(-16));
  addBanditCampShack(group, size, size * 0.28, size * 0.29, size * 0.25, size * 0.18, shack, roof, MathUtils.degToRad(22));
  addBanditCampShack(group, size, -size * 0.34, size * 0.3, size * 0.26, size * 0.18, 0x796147, marketTarp, MathUtils.degToRad(-20));

  // Central helicopter pad/service yard: the strongest overhead read from the real monument.
  addCylinder(group, size * 0.24, size * 0.025, 0x303632, -size * 0.04, size * 0.08, size * 0.06);
  addCylinder(group, size * 0.17, size * 0.03, 0xd8d2ba, -size * 0.04, size * 0.1, size * 0.06);
  addBox(group, size * 0.06, size * 0.035, size * 0.33, 0x303632, -size * 0.04, size * 0.12, size * 0.06);
  addBox(group, size * 0.33, size * 0.035, size * 0.06, 0x303632, -size * 0.04, size * 0.13, size * 0.06);

  addBanditCampCrane(group, size, -size * 0.52, -size * 0.07, MathUtils.degToRad(-24));
  addBanditCampTower(group, size, size * 0.49, -size * 0.34, size * 0.42);
  addBanditCampTower(group, size, -size * 0.48, size * 0.4, size * 0.3);

  // Open market awnings and a lit barrel make the landmark feel inhabited at low camera angles.
  addBox(group, size * 0.34, size * 0.025, size * 0.18, marketTarp, size * 0.03, size * 0.27, -size * 0.48);
  [-0.11, 0.17].forEach((offset) => addCylinder(group, size * 0.014, size * 0.24, darkWood, size * offset, size * 0.13, -size * 0.48));
  addCylinder(group, size * 0.055, size * 0.1, steel, -size * 0.54, size * 0.07, size * 0.34);
  addSphere(group, size * 0.045, fire, -size * 0.54, size * 0.15, size * 0.34);
  addCylinder(group, size * 0.035, size * 0.18, rust, size * 0.54, size * 0.1, size * 0.16);

  [[-0.83, -0.48], [-0.78, 0.42], [0.78, 0.44], [0.8, -0.48]].forEach(([x, z]) => {
    addCylinder(group, size * 0.025, size * 0.22, darkWood, size * x, size * 0.14, size * z);
    addSphere(group, size * 0.11, swampTree, size * x, size * 0.29, size * z);
  });
}

function addBanditCampShack(group: Group, size: number, x: number, z: number, width: number, depth: number, wallColor: number, roofColor: number, rotationY: number): void {
  const base = addBox(group, width, size * 0.16, depth, wallColor, x, size * 0.12, z);
  base.rotation.y = rotationY;
  const roof = addBox(group, width * 1.1, size * 0.045, depth * 1.12, roofColor, x, size * 0.23, z);
  roof.rotation.y = rotationY;
  roof.rotation.z = MathUtils.degToRad(5);
}

function addBanditCampTower(group: Group, size: number, x: number, z: number, height: number): void {
  const leg = size * 0.015;
  const width = size * 0.13;
  const y = size * 0.09 + height / 2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => addBox(group, leg, height, leg, 0x493326, x + dx * width, y, z + dz * width));
  addBox(group, width * 2.35, size * 0.045, width * 2.35, 0x73543a, x, size * 0.1 + height, z);
  addBox(group, width * 2.65, size * 0.03, width * 2.65, 0x563a29, x, size * 0.18 + height, z);
}

function addBanditCampCrane(group: Group, size: number, x: number, z: number, rotationY: number): void {
  addBox(group, size * 0.08, size * 0.48, size * 0.08, 0x5d5041, x, size * 0.28, z);
  const boom = addBox(group, size * 0.54, size * 0.045, size * 0.055, 0x94492f, x + Math.cos(rotationY) * size * 0.22, size * 0.53, z - Math.sin(rotationY) * size * 0.22);
  boom.rotation.y = rotationY;
  const cable = addBox(group, size * 0.012, size * 0.25, size * 0.012, 0x242524, x + Math.cos(rotationY) * size * 0.45, size * 0.39, z - Math.sin(rotationY) * size * 0.45);
  cable.rotation.y = rotationY;
  addBox(group, size * 0.09, size * 0.055, size * 0.09, 0x65422f, cable.position.x, size * 0.24, cable.position.z);
}

function createOutpostMonumentPrimitive(group: Group, size: number): void {
  const wall = 0x8f8878;
  const darkWall = 0x5c5a51;
  const street = 0x3b3b36;
  const roof = 0xa86b3e;
  const tarpBlue = 0x3e5f86;
  const tarpTan = 0xc0aa7b;
  const brick = 0x8d6650;
  const plaster = 0xc0b7a7;
  const steel = 0x616966;
  const darkSteel = 0x2d3131;
  const rust = 0x9b4f30;
  const tree = 0x3f5e38;

  addBox(group, size * 1.5, 4.5, size * 1.08, wall, 0, 2.25, 0);
  addBox(group, size * 1.32, 3.2, size * 0.86, street, 0, 5.2, 0);
  addBox(group, size * 1.38, size * 0.09, size * 0.06, darkWall, 0, size * 0.1, -size * 0.54);
  addBox(group, size * 1.38, size * 0.09, size * 0.06, darkWall, 0, size * 0.1, size * 0.54);
  addBox(group, size * 0.06, size * 0.09, size * 0.96, darkWall, -size * 0.75, size * 0.1, 0);
  addBox(group, size * 0.06, size * 0.09, size * 0.96, darkWall, size * 0.75, size * 0.1, 0);

  addBox(group, size * 0.3, size * 0.12, size * 0.12, rust, 0, size * 0.12, -size * 0.57);
  addBox(group, size * 0.24, size * 0.1, size * 0.1, rust, -size * 0.3, size * 0.1, size * 0.58);
  addBox(group, size * 0.24, size * 0.1, size * 0.1, rust, size * 0.3, size * 0.1, size * 0.58);

  addOutpostBuilding(group, size, -size * 0.36, -size * 0.18, size * 0.36, size * 0.28, brick, roof, 0);
  addOutpostBuilding(group, size, size * 0.26, -size * 0.18, size * 0.3, size * 0.26, plaster, roof, MathUtils.degToRad(90));
  addOutpostBuilding(group, size, -size * 0.2, size * 0.24, size * 0.28, size * 0.24, plaster, tarpBlue, 0);
  addOutpostBuilding(group, size, size * 0.38, size * 0.26, size * 0.24, size * 0.2, brick, tarpTan, 0);
  addOutpostBuilding(group, size, size * 0.02, -size * 0.42, size * 0.28, size * 0.18, plaster, tarpTan, 0);

  addOutpostTower(group, size, -size * 0.62, -size * 0.42, size * 0.27);
  addOutpostTower(group, size, size * 0.62, -size * 0.42, size * 0.22);
  addOutpostTower(group, size, -size * 0.62, size * 0.4, size * 0.2);
  addOutpostTower(group, size, size * 0.62, size * 0.4, size * 0.24);

  addOutpostRadioMast(group, size, size * 0.14, size * 0.14, size * 0.48);
  addCylinder(group, size * 0.07, size * 0.18, steel, -size * 0.52, size * 0.14, size * 0.08);
  addCylinder(group, size * 0.07, size * 0.18, steel, -size * 0.4, size * 0.14, size * 0.08);
  addCylinder(group, size * 0.045, size * 0.16, steel, size * 0.54, size * 0.12, -size * 0.02);

  addBox(group, size * 0.16, size * 0.07, size * 0.1, rust, -size * 0.08, size * 0.09, size * 0.42);
  addBox(group, size * 0.14, size * 0.07, size * 0.1, rust, size * 0.1, size * 0.09, size * 0.42);
  addBox(group, size * 0.12, size * 0.06, size * 0.08, darkSteel, size * 0.54, size * 0.08, -size * 0.28);

  [
    [-0.44, 0.42],
    [-0.28, 0.5],
    [0.22, 0.46],
    [0.48, 0.02],
    [-0.52, -0.02],
  ].forEach(([x, z]) => {
    addCylinder(group, size * 0.018, size * 0.16, 0x5f4831, size * x, size * 0.12, size * z);
    addSphere(group, size * 0.055, tree, size * x, size * 0.23, size * z);
  });
}

function addOutpostBuilding(group: Group, size: number, x: number, z: number, width: number, depth: number, wallColor: number, roofColor: number, rotationY: number): void {
  const building = addBox(group, width, size * 0.18, depth, wallColor, x, size * 0.13, z);
  building.rotation.y = rotationY;
  const roof = addBox(group, width * 1.08, size * 0.045, depth * 1.08, roofColor, x, size * 0.24, z);
  roof.rotation.y = rotationY;
  roof.rotation.z = MathUtils.degToRad(3);
}

function addOutpostTower(group: Group, size: number, x: number, z: number, height: number): void {
  const darkWood = 0x4c3828;
  const platform = 0x7e6545;
  const leg = size * 0.014;
  const width = size * 0.12;
  const y = height / 2 + size * 0.08;

  addBox(group, leg, height, leg, darkWood, x - width / 2, y, z - width / 2);
  addBox(group, leg, height, leg, darkWood, x + width / 2, y, z - width / 2);
  addBox(group, leg, height, leg, darkWood, x - width / 2, y, z + width / 2);
  addBox(group, leg, height, leg, darkWood, x + width / 2, y, z + width / 2);
  addBox(group, width * 1.4, size * 0.04, width * 1.4, platform, x, size * 0.1 + height, z);
  addCone(group, width * 0.72, size * 0.12, 0x31415a, x, size * 0.18 + height, z);

  [0.38, 0.68].forEach((level, index) => {
    const cross = addBox(group, width * 1.2, size * 0.012, size * 0.012, darkWood, x, size * 0.08 + height * level, z);
    cross.rotation.z = MathUtils.degToRad(index % 2 === 0 ? 24 : -24);
  });
}

function addOutpostRadioMast(group: Group, size: number, x: number, z: number, height: number): void {
  const steel = 0x616966;
  const rust = 0x9b4f30;
  addBox(group, size * 0.018, height, size * 0.018, steel, x, height / 2 + size * 0.14, z);
  addCylinder(group, size * 0.035, size * 0.035, rust, x, height + size * 0.16, z);
  const armA = addBox(group, size * 0.22, size * 0.012, size * 0.012, rust, x, height + size * 0.08, z);
  armA.rotation.y = MathUtils.degToRad(18);
  const armB = addBox(group, size * 0.18, size * 0.012, size * 0.012, rust, x, height + size * 0.02, z);
  armB.rotation.y = MathUtils.degToRad(-32);
}

function createExcavatorMonumentPrimitive(group: Group, size: number): void {
  const earth = 0x6d624c;
  const darkEarth = 0x2e2a23;
  const rust = 0x9a552d;
  const darkRust = 0x5c3023;
  const steel = 0x6a6760;
  const darkSteel = 0x262a2b;
  const deck = 0x4c4a42;
  const cabin = 0x7b735c;

  addCylinder(group, size * 0.52, 3.2, earth, 0, 1.6, 0);
  addCylinder(group, size * 0.38, 3.8, darkEarth, 0, 3.4, 0);
  addCylinder(group, size * 0.25, size * 0.1, deck, 0, size * 0.07, 0);
  addCylinder(group, size * 0.17, size * 0.16, steel, 0, size * 0.16, 0);

  addBox(group, size * 0.5, size * 0.12, size * 0.22, darkSteel, -size * 0.06, size * 0.11, size * 0.02);
  addBox(group, size * 0.16, size * 0.2, size * 0.16, cabin, -size * 0.12, size * 0.28, size * 0.12);
  addBox(group, size * 0.18, size * 0.16, size * 0.15, cabin, size * 0.18, size * 0.24, -size * 0.1);

  addExcavatorMast(group, size, -size * 0.02, 0, size * 0.94);
  addExcavatorBoom(group, size, -size * 0.05, 0, size * 0.9, MathUtils.degToRad(-18), size * 0.46, rust);
  addExcavatorBoom(group, size, size * 0.04, 0, size * 0.74, MathUtils.degToRad(24), size * 0.38, rust);
  addExcavatorBoom(group, size, -size * 0.04, -size * 0.04, size * 0.58, MathUtils.degToRad(178), size * 0.28, darkRust);

  addExcavatorCable(group, size, -size * 0.02, 0, size * 0.88, MathUtils.degToRad(-18), size * 0.78);
  addExcavatorCable(group, size, -size * 0.02, 0, size * 0.82, MathUtils.degToRad(24), size * 0.62);
  addExcavatorCable(group, size, -size * 0.02, 0, size * 0.7, MathUtils.degToRad(178), size * 0.48);

  addExcavatorBucketWheel(group, size, -size * 0.48, size * 0.16, MathUtils.degToRad(-18));
  addExcavatorPulley(group, size, size * 0.48, size * 0.22, MathUtils.degToRad(24));

  addCylinder(group, size * 0.07, size * 0.18, steel, size * 0.32, size * 0.14, -size * 0.3);
  addCylinder(group, size * 0.07, size * 0.18, steel, size * 0.44, size * 0.14, -size * 0.3);
  addBox(group, size * 0.2, size * 0.08, size * 0.12, rust, -size * 0.32, size * 0.1, -size * 0.36);
  addBox(group, size * 0.18, size * 0.07, size * 0.1, darkRust, size * 0.12, size * 0.09, size * 0.36);
  addBox(group, size * 0.12, size * 0.09, size * 0.12, cabin, size * 0.42, size * 0.1, size * 0.32);
}

function addExcavatorMast(group: Group, size: number, x: number, z: number, height: number): void {
  const rust = 0x9a552d;
  const darkRust = 0x5c3023;
  const width = size * 0.22;
  const leg = size * 0.018;
  const y = height / 2 + size * 0.16;

  const left = addBox(group, leg, height, leg, rust, x - width / 2, y, z);
  left.rotation.z = MathUtils.degToRad(-6);
  const right = addBox(group, leg, height, leg, rust, x + width / 2, y, z);
  right.rotation.z = MathUtils.degToRad(6);
  addBox(group, width * 1.1, size * 0.035, size * 0.05, darkRust, x, size * 0.16 + height, z);

  [0.25, 0.46, 0.67, 0.88].forEach((level, index) => {
    const crossY = size * 0.16 + height * level;
    const cross = addBox(group, width * 1.18, size * 0.014, size * 0.018, darkRust, x, crossY, z);
    cross.rotation.z = MathUtils.degToRad(index % 2 === 0 ? 24 : -24);
  });
}

function addExcavatorBoom(group: Group, size: number, originX: number, originZ: number, length: number, rotationY: number, y: number, color: number): void {
  const darkRust = 0x5c3023;
  const width = size * 0.12;
  const centerX = originX + Math.cos(rotationY) * length * 0.5;
  const centerZ = originZ - Math.sin(rotationY) * length * 0.5;
  const sideX = Math.sin(rotationY) * width * 0.5;
  const sideZ = Math.cos(rotationY) * width * 0.5;

  const beamA = addBox(group, length, size * 0.035, size * 0.025, color, centerX + sideX, y, centerZ + sideZ);
  beamA.rotation.y = rotationY;
  const beamB = addBox(group, length, size * 0.035, size * 0.025, color, centerX - sideX, y - size * 0.08, centerZ - sideZ);
  beamB.rotation.y = rotationY;
  const deck = addBox(group, length * 0.92, size * 0.02, size * 0.035, darkRust, centerX, y - size * 0.04, centerZ);
  deck.rotation.y = rotationY;

  [-0.32, -0.12, 0.08, 0.28].forEach((offset, index) => {
    const brace = addBox(
      group,
      size * 0.18,
      size * 0.018,
      size * 0.018,
      darkRust,
      centerX + Math.cos(rotationY) * length * offset,
      y - size * 0.03,
      centerZ - Math.sin(rotationY) * length * offset,
    );
    brace.rotation.y = rotationY;
    brace.rotation.z = MathUtils.degToRad(index % 2 === 0 ? 26 : -26);
  });
}

function addExcavatorCable(group: Group, size: number, originX: number, originZ: number, y: number, rotationY: number, length: number): void {
  const cable = addBox(
    group,
    length,
    size * 0.01,
    size * 0.01,
    0x151718,
    originX + Math.cos(rotationY) * length * 0.5,
    y,
    originZ - Math.sin(rotationY) * length * 0.5,
  );
  cable.rotation.y = rotationY;
  cable.rotation.z = MathUtils.degToRad(-12);
}

function addExcavatorBucketWheel(group: Group, size: number, x: number, z: number, rotationY: number): void {
  const wheel = addCylinder(group, size * 0.13, size * 0.06, 0x2b2e2d, x, size * 0.34, z);
  wheel.rotation.x = MathUtils.degToRad(90);
  wheel.rotation.y = rotationY;
  addCylinder(group, size * 0.055, size * 0.08, 0x9a552d, x, size * 0.34, z);

  [-45, 0, 45, 90].forEach((angle) => {
    const bucket = addBox(group, size * 0.08, size * 0.035, size * 0.035, 0x9a552d, x, size * 0.34, z);
    bucket.rotation.x = MathUtils.degToRad(angle);
    bucket.rotation.y = rotationY;
    bucket.position.x += Math.cos(rotationY) * Math.cos(MathUtils.degToRad(angle)) * size * 0.1;
    bucket.position.y += Math.sin(MathUtils.degToRad(angle)) * size * 0.1;
  });
}

function addExcavatorPulley(group: Group, size: number, x: number, z: number, rotationY: number): void {
  const pulley = addCylinder(group, size * 0.09, size * 0.08, 0x2b2e2d, x, size * 0.5, z);
  pulley.rotation.x = MathUtils.degToRad(90);
  pulley.rotation.y = rotationY;
  const housing = addBox(group, size * 0.18, size * 0.08, size * 0.12, 0x7b735c, x, size * 0.44, z);
  housing.rotation.y = rotationY;
}

function createLaunchSiteMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x8e8a7d;
  const stainedConcrete = 0x69695f;
  const asphalt = 0x262b2d;
  const trench = 0x15191a;
  const rust = 0x9c4f2f;
  const darkRust = 0x6e3526;
  const steel = 0x687579;
  const paleSteel = 0xa9b4ae;
  const wall = 0x6f7064;
  const roof = 0xb7ad95;

  addBox(group, size * 1.72, 5, size * 0.98, concrete, -size * 0.04, 2.5, size * 0.02);
  addBox(group, size * 1.02, 4, size * 0.82, stainedConcrete, -size * 0.5, 2, -size * 0.08);
  addBox(group, size * 0.74, 4, size * 0.74, concrete, size * 0.58, 2, size * 0.1);
  addBox(group, size * 1.28, 2.4, size * 0.12, asphalt, -size * 0.12, 6.1, -size * 0.34);
  addBox(group, size * 0.18, 2.4, size * 0.82, asphalt, size * 0.38, 6.1, size * 0.04);

  const flameTrench = addBox(group, size * 0.82, 3.2, size * 0.16, trench, -size * 0.26, 7.2, -size * 0.12);
  flameTrench.rotation.y = MathUtils.degToRad(-14);
  const railA = addBox(group, size * 0.72, 2.2, size * 0.028, darkRust, -size * 0.24, 10, -size * 0.2);
  railA.rotation.y = MathUtils.degToRad(-14);
  const railB = addBox(group, size * 0.72, 2.2, size * 0.028, darkRust, -size * 0.24, 10, -size * 0.04);
  railB.rotation.y = MathUtils.degToRad(-14);

  addBox(group, size * 0.42, size * 0.28, size * 0.34, wall, size * 0.54, size * 0.17, -size * 0.32);
  addBox(group, size * 0.48, size * 0.06, size * 0.38, roof, size * 0.54, size * 0.34, -size * 0.32);
  addBox(group, size * 0.34, size * 0.2, size * 0.26, wall, size * 0.16, size * 0.13, size * 0.43);
  addBox(group, size * 0.22, size * 0.16, size * 0.22, wall, -size * 0.68, size * 0.11, size * 0.28);

  addCylinder(group, size * 0.08, size * 0.82, paleSteel, -size * 0.22, size * 0.46, size * 0.07);
  addCylinder(group, size * 0.1, size * 0.08, darkRust, -size * 0.22, size * 0.9, size * 0.07);
  addCone(group, size * 0.13, size * 0.22, rust, -size * 0.22, size * 1.05, size * 0.07);

  addLaunchScaffoldTower(group, size, -size * 0.42, size * 0.08, size * 0.88);
  addLaunchScaffoldTower(group, size, size * 0.1, size * 0.18, size * 0.7);
  addLaunchScaffoldTower(group, size, size * 0.7, size * 0.4, size * 0.58);
  addLaunchScaffoldTower(group, size, -size * 0.72, -size * 0.44, size * 0.54);

  addLaunchServiceArm(group, size, -size * 0.16, size * 0.17, size * 0.64, MathUtils.degToRad(-8));
  addLaunchServiceArm(group, size, -size * 0.05, size * 0.02, size * 0.48, MathUtils.degToRad(8));

  addCylinder(group, size * 0.08, size * 0.26, steel, size * 0.45, size * 0.15, size * 0.42);
  addCylinder(group, size * 0.08, size * 0.26, steel, size * 0.58, size * 0.15, size * 0.42);
  addCylinder(group, size * 0.08, size * 0.26, steel, size * 0.71, size * 0.15, size * 0.42);
  addCylinder(group, size * 0.055, size * 0.18, steel, -size * 0.65, size * 0.12, -size * 0.18);
  addCylinder(group, size * 0.055, size * 0.18, steel, -size * 0.52, size * 0.12, -size * 0.18);

  addBox(group, size * 0.22, size * 0.08, size * 0.12, rust, size * 0.2, size * 0.1, -size * 0.52);
  addBox(group, size * 0.18, size * 0.08, size * 0.12, darkRust, size * 0.46, size * 0.1, -size * 0.52);
  addBox(group, size * 0.16, size * 0.07, size * 0.1, rust, -size * 0.04, size * 0.09, size * 0.45);
}

function addLaunchScaffoldTower(group: Group, size: number, x: number, z: number, height: number): void {
  const rust = 0x9c4f2f;
  const darkRust = 0x6e3526;
  const width = size * 0.16;
  const legRadius = size * 0.012;
  const legHeight = height;
  const y = legHeight / 2 + size * 0.06;

  addBox(group, legRadius, legHeight, legRadius, rust, x - width / 2, y, z - width / 2);
  addBox(group, legRadius, legHeight, legRadius, rust, x + width / 2, y, z - width / 2);
  addBox(group, legRadius, legHeight, legRadius, rust, x - width / 2, y, z + width / 2);
  addBox(group, legRadius, legHeight, legRadius, rust, x + width / 2, y, z + width / 2);

  [0.26, 0.5, 0.74, 0.96].forEach((level) => {
    const crossY = size * 0.06 + legHeight * level;
    const front = addBox(group, width * 1.25, size * 0.014, size * 0.014, darkRust, x, crossY, z - width / 2);
    front.rotation.z = MathUtils.degToRad(level > 0.5 ? -18 : 18);
    const back = addBox(group, width * 1.25, size * 0.014, size * 0.014, darkRust, x, crossY, z + width / 2);
    back.rotation.z = MathUtils.degToRad(level > 0.5 ? 18 : -18);
    addBox(group, width, size * 0.012, size * 0.012, rust, x, crossY, z);
  });
}

function addLaunchServiceArm(group: Group, size: number, x: number, z: number, y: number, rotationY: number): void {
  const arm = addBox(group, size * 0.4, size * 0.026, size * 0.04, 0x9c4f2f, x, y, z);
  arm.rotation.y = rotationY;
  const brace = addBox(group, size * 0.24, size * 0.018, size * 0.028, 0x6e3526, x + size * 0.04, y - size * 0.06, z);
  brace.rotation.y = rotationY;
  brace.rotation.z = MathUtils.degToRad(-18);
}

function createHarborMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x9b9886;
  const stainedConcrete = 0x77786b;
  const asphalt = 0x343b3d;
  const rust = 0x8a5a38;
  const steel = 0x59676b;
  const darkSteel = 0x252d30;
  const containerGreen = 0x4f694d;
  const containerOrange = 0xa86a3a;
  const containerBlue = 0x3d5f70;

  addBox(group, size * 1.55, 5, size * 0.44, concrete, 0, 2.5, size * 0.22);
  addBox(group, size * 1.38, 2.4, size * 0.18, asphalt, -size * 0.03, 6.3, size * 0.18);
  addBox(group, size * 0.5, 4, size * 0.88, concrete, -size * 0.52, 2, -size * 0.26);
  addBox(group, size * 0.38, 4, size * 0.7, concrete, size * 0.54, 2, -size * 0.18);
  addBox(group, size * 1.34, 4.5, size * 0.24, stainedConcrete, size * 0.05, 2.25, -size * 0.72);
  addBox(group, size * 0.1, 8, size * 0.88, darkSteel, -size * 0.82, 4, -size * 0.2);
  addBox(group, size * 0.1, 8, size * 0.72, darkSteel, size * 0.78, 4, -size * 0.18);

  addHarborWarehouse(group, size, -size * 0.36, size * 0.5, size * 0.48, 0);
  addHarborWarehouse(group, size, size * 0.22, size * 0.48, size * 0.36, MathUtils.degToRad(90));

  addHarborBridge(group, size, -size * 0.3, -size * 0.53, 0);
  addHarborCrane(group, size, -size * 0.36, -size * 0.56, MathUtils.degToRad(-18));
  addHarborCrane(group, size, size * 0.38, -size * 0.66, MathUtils.degToRad(18));
  addHarborCrane(group, size, size * 0.62, -size * 0.04, MathUtils.degToRad(-44));

  addCylinder(group, size * 0.07, size * 0.34, steel, size * 0.45, size * 0.18, size * 0.32);
  addCylinder(group, size * 0.07, size * 0.34, steel, size * 0.58, size * 0.18, size * 0.32);
  addCylinder(group, size * 0.07, size * 0.34, steel, size * 0.71, size * 0.18, size * 0.32);

  addBox(group, size * 0.16, size * 0.1, size * 0.24, containerGreen, -size * 0.04, size * 0.12, -size * 0.72);
  addBox(group, size * 0.16, size * 0.1, size * 0.24, containerOrange, size * 0.14, size * 0.12, -size * 0.72);
  addBox(group, size * 0.16, size * 0.1, size * 0.24, containerBlue, size * 0.32, size * 0.12, -size * 0.72);
  addBox(group, size * 0.15, size * 0.1, size * 0.22, containerGreen, size * 0.5, size * 0.12, -size * 0.58);
  addBox(group, size * 0.15, size * 0.1, size * 0.22, containerOrange, size * 0.66, size * 0.12, -size * 0.58);
  addBox(group, size * 0.12, size * 0.1, size * 0.18, containerBlue, -size * 0.62, size * 0.12, -size * 0.5);

  const bollardPositions = [
    [-0.68, -0.36],
    [-0.38, -0.68],
    [0.02, -0.82],
    [0.42, -0.76],
    [0.72, -0.44],
    [0.66, 0.04],
  ];
  bollardPositions.forEach(([x, z]) => {
    addCylinder(group, size * 0.018, size * 0.12, rust, size * x, size * 0.1, size * z);
  });
}

function addHarborWarehouse(group: Group, size: number, x: number, z: number, width: number, rotationY: number): void {
  const building = addBox(group, width, size * 0.18, size * 0.24, 0x727363, x, size * 0.12, z);
  building.rotation.y = rotationY;

  const roof = addBox(group, width * 1.08, size * 0.045, size * 0.28, 0xd9d0b7, x, size * 0.24, z);
  roof.rotation.y = rotationY;
  roof.rotation.z = MathUtils.degToRad(4);
}

function addHarborBridge(group: Group, size: number, x: number, z: number, rotationY: number): void {
  const deck = addBox(group, size * 0.56, size * 0.04, size * 0.16, 0x50483f, x, size * 0.18, z);
  deck.rotation.y = rotationY;

  const railA = addBox(group, size * 0.58, size * 0.035, size * 0.025, 0x6f4e3a, x, size * 0.28, z - size * 0.07);
  railA.rotation.y = rotationY;
  const railB = addBox(group, size * 0.58, size * 0.035, size * 0.025, 0x6f4e3a, x, size * 0.28, z + size * 0.07);
  railB.rotation.y = rotationY;

  [-0.2, 0, 0.2].forEach((offset) => {
    const truss = addBox(group, size * 0.24, size * 0.025, size * 0.025, 0x6f4e3a, x + size * offset, size * 0.26, z);
    truss.rotation.y = rotationY;
    truss.rotation.z = MathUtils.degToRad(28);
  });
}

function addHarborCrane(group: Group, size: number, x: number, z: number, rotationY: number): void {
  const base = addBox(group, size * 0.12, size * 0.08, size * 0.12, 0x394246, x, size * 0.08, z);
  base.rotation.y = rotationY;

  const tower = addBox(group, size * 0.055, size * 0.5, size * 0.055, 0x59676b, x, size * 0.34, z);
  tower.rotation.y = rotationY;

  const boom = addBox(group, size * 0.46, size * 0.035, size * 0.04, 0x8a5a38, x + Math.cos(rotationY) * size * 0.16, size * 0.62, z - Math.sin(rotationY) * size * 0.16);
  boom.rotation.y = rotationY;
  boom.rotation.z = MathUtils.degToRad(8);

  const counterweight = addBox(group, size * 0.16, size * 0.06, size * 0.06, 0x303638, x - Math.cos(rotationY) * size * 0.13, size * 0.58, z + Math.sin(rotationY) * size * 0.13);
  counterweight.rotation.y = rotationY;
}

function createMonumentTitleSprite(title: string, size: number): Sprite {
  const label = title.trim() || "Monument";
  const fontSize = 34;
  const paddingX = 22;
  const paddingY = 14;
  const texture = getSharedCanvasTexture(`server-map:monument-title:${label}`, () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return new CanvasTexture(canvas);
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
    context.fillStyle = "rgba(18, 20, 18, 0.58)";
    roundRect(context, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height, 12);
    context.fill();
    context.strokeStyle = "rgba(248, 231, 172, 0.58)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#fff5d7";
    context.shadowColor = "rgba(0, 0, 0, 0.65)";
    context.shadowBlur = 5;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);

    const created = new CanvasTexture(canvas);
    created.colorSpace = SRGBColorSpace;
    return created;
  });
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  const worldWidth = MathUtils.clamp(size * 1.02, 58, 150);
  sprite.name = "monument-title";
  sprite.position.set(0, Math.max(size * 1.22, 48), 0);
  sprite.scale.set(worldWidth, worldWidth * textureAspectRatio(texture), 1);
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
    opacity: 0.24,
    depthTest: false,
    depthWrite: false,
  };

  for (let index = 0; index <= cells; index += 1) {
    const coord = MathUtils.clamp(-half + index * cellSize, -half, half);
    group.add(createGridLineSegment([coord, yOffset, half, coord, yOffset, -half], coord, 0, lineMaterialOptions));
    group.add(createGridLineSegment([-half, yOffset, coord, half, yOffset, coord], 0, coord, lineMaterialOptions));
  }

  const labelSize = MathUtils.clamp(cellSize * 0.22, 34, 58);
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
  const texture = getSharedCanvasTexture(`server-map:grid-label:${label}`, () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  canvas.width = 160;
  canvas.height = 128;
  context.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.shadowColor = "rgba(0, 0, 0, 0.42)";
  context.shadowBlur = 4;
  context.strokeStyle = "rgba(3, 5, 6, 0.56)";
  context.lineWidth = 6;
  context.strokeText(label, canvas.width / 2, 64);
  context.fillStyle = "rgba(255, 246, 218, 0.72)";
  context.fillText(label, canvas.width / 2, 64);

    const created = new CanvasTexture(canvas);
    created.colorSpace = SRGBColorSpace;
    return created;
  });
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
  return getSharedCanvasTexture("server-map:heatmap-cloud", () => {
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
  });
}

function createPlayerLocationTexture(player: PlayerLocation, isSelf: boolean): CanvasTexture {
  const clan = String(player.clanTag || "").slice(0, 6).toUpperCase();
  const name = String(player.displayName || (isSelf ? "You" : "Clan")).trim();
  const label = isSelf ? "YOU" : (clan || initialsForPlayer(name));
  return getSharedCanvasTexture(`server-map:player-location:${isSelf ? "self" : "clan"}:${label}:${name}`, () => {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

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
  });
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
  if (object.userData.preserveSharedVehicleAsset === true) {
    return;
  }

  if ("geometry" in object) {
    object.geometry.dispose();
  }

  const materials = Array.isArray(object.material) ? object.material : [object.material];
  materials.forEach((material) => {
    const map = (material as Material & { map?: { dispose?: () => void } }).map;
    if (!isSharedThreeAsset(map)) {
      map?.dispose?.();
    }
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

function createFloatingWeatherClouds(terrain: TerrainPayload): Group {
  const group = new Group();
  const worldSize = terrain.worldSize || 4500;
  const texture = createWeatherCloudTexture();
  const cloudCount = 24;
  const height = MathUtils.clamp(worldSize * 0.19, 520, 980);

  for (let index = 0; index < cloudCount; index += 1) {
    const ring = index / cloudCount;
    const angle = ring * Math.PI * 2 * 2.618;
    const radius = worldSize * MathUtils.lerp(0.08, 0.46, ((index * 37) % cloudCount) / Math.max(1, cloudCount - 1));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const baseScale = worldSize * MathUtils.lerp(0.11, 0.24, ((index * 17) % 9) / 8);
    const material = new SpriteMaterial({
      map: texture,
      color: 0xdce7ee,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      depthTest: true,
    });
    const sprite = new Sprite(material);
    sprite.name = "raidlands-floating-weather-cloud";
    sprite.position.set(x, height + Math.sin(index * 1.7) * worldSize * 0.025, z);
    sprite.scale.set(baseScale, baseScale * 0.34, 1);
    sprite.renderOrder = 4;
    sprite.userData.baseX = x;
    sprite.userData.baseZ = z;
    sprite.userData.baseScale = baseScale;
    sprite.userData.scaleX = MathUtils.lerp(0.88, 1.34, ((index * 11) % 7) / 6);
    sprite.userData.scaleY = MathUtils.lerp(0.26, 0.44, ((index * 13) % 5) / 4);
    sprite.userData.opacityBias = MathUtils.lerp(0.72, 1.12, ((index * 19) % 8) / 7);
    sprite.userData.coverageRank = ((index * 17) % cloudCount) / cloudCount;
    group.add(sprite);
  }

  return group;
}

function createGroundFogBanks(terrain: TerrainPayload): Group {
  const group = new Group();
  group.name = "raidlands-distance-ground-fog";
  const worldSize = terrain.worldSize || 4500;
  const texture = createGroundFogTexture();
  const bankCount = 18;

  for (let index = 0; index < bankCount; index += 1) {
    const angle = index * 2.399963229728653;
    const radiusRank = ((index * 11) % bankCount) / Math.max(1, bankCount - 1);
    const radius = worldSize * MathUtils.lerp(0.16, 0.58, radiusRank);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const terrainHeight = sampleTerrainHeight(terrain, x, z);
    const bankWidth = worldSize * MathUtils.lerp(0.16, 0.3, ((index * 7) % 8) / 7);
    const bankHeight = worldSize * MathUtils.lerp(0.032, 0.072, ((index * 5) % 7) / 6);
    const material = new SpriteMaterial({
      map: texture,
      color: 0xc7d4d8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
    });
    const sprite = new Sprite(material);
    sprite.name = "raidlands-ground-fog-bank";
    sprite.position.set(x, terrainHeight + bankHeight * 0.48 + 8, z);
    sprite.scale.set(bankWidth, bankHeight, 1);
    sprite.renderOrder = 3;
    sprite.userData.baseX = x;
    sprite.userData.baseZ = z;
    sprite.userData.opacityBias = MathUtils.lerp(0.72, 1.08, ((index * 13) % 9) / 8);
    group.add(sprite);
  }

  return group;
}

function createGroundFogTexture(): CanvasTexture {
  return getSharedCanvasTexture("server-map-ground-fog-v1", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const verticalFade = context.createLinearGradient(0, 0, 0, canvas.height);
      verticalFade.addColorStop(0, "rgba(255, 255, 255, 0)");
      verticalFade.addColorStop(0.28, "rgba(255, 255, 255, 0.24)");
      verticalFade.addColorStop(0.62, "rgba(255, 255, 255, 0.52)");
      verticalFade.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = verticalFade;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.globalCompositeOperation = "destination-in";
      const horizontalFade = context.createLinearGradient(0, 0, canvas.width, 0);
      horizontalFade.addColorStop(0, "rgba(255, 255, 255, 0)");
      horizontalFade.addColorStop(0.16, "rgba(255, 255, 255, 0.74)");
      horizontalFade.addColorStop(0.48, "rgba(255, 255, 255, 1)");
      horizontalFade.addColorStop(0.84, "rgba(255, 255, 255, 0.68)");
      horizontalFade.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = horizontalFade;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  });
}

function createWeatherCloudTexture(): CanvasTexture {
  return getSharedCanvasTexture("server-map-weather-cloud", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const lobes = [
        [74, 70, 58, 29, 0.72],
        [118, 56, 68, 36, 0.84],
        [166, 69, 64, 28, 0.7],
        [128, 78, 112, 30, 0.58],
        [94, 84, 72, 22, 0.44],
        [172, 86, 66, 20, 0.38],
      ];
      lobes.forEach(([x, y, radiusX, radiusY, opacity]) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY));
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(0.56, `rgba(210, 226, 235, ${opacity * 0.64})`);
        gradient.addColorStop(1, "rgba(190, 205, 216, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.fill();
      });
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  });
}

function createRainSheets(terrain: TerrainPayload): Group {
  const group = new Group();
  const worldSize = terrain.worldSize || 4500;
  const texture = createRainSheetTexture();
  const sheetSize = MathUtils.clamp(worldSize * 1.18, 1800, 6200);

  for (let index = 0; index < 4; index += 1) {
    const material = new SpriteMaterial({
      map: texture,
      color: 0xc8dbea,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new Sprite(material);
    const angle = (index / 4) * Math.PI * 2 + Math.PI * 0.25;
    const radius = sheetSize * 0.18;
    sprite.name = "raidlands-rain-sheet";
    sprite.position.set(Math.cos(angle) * radius, index * sheetSize * 0.035, Math.sin(angle) * radius);
    sprite.scale.set(sheetSize, sheetSize * 0.72, 1);
    sprite.renderOrder = 24 + index;
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.opacityBias = MathUtils.lerp(0.72, 1.08, index / 3);
    group.add(sprite);
  }

  return group;
}

function createRainSheetTexture(): CanvasTexture {
  return getSharedCanvasTexture("server-map-rain-sheet", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < 96; index += 1) {
        const x = (index * 47) % canvas.width;
        const y = (index * 89) % canvas.height;
        const length = 16 + (index % 7) * 5;
        const alpha = 0.08 + ((index * 13) % 9) * 0.012;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 2 + (index % 3), y + length);
        context.strokeStyle = `rgba(210, 230, 245, ${alpha})`;
        context.lineWidth = index % 4 === 0 ? 1.2 : 0.72;
        context.stroke();
      }
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2.4, 2.4);
    return texture;
  });
}

function createRainStreaks(terrain: TerrainPayload, material: LineBasicMaterial): LineSegments {
  const worldSize = terrain.worldSize || 4500;
  const width = MathUtils.clamp(worldSize * 1.45, 1800, 7600);
  const height = MathUtils.clamp(worldSize * 0.92, 1800, 5200);
  const streakCount = Math.round(MathUtils.clamp(worldSize * 0.42, 900, 2400));
  const positions: number[] = [];

  for (let index = 0; index < streakCount; index += 1) {
    const x = (((index * 97) % 997) / 996 - 0.5) * width;
    const z = ((((index * 193) % 991) / 990) - 0.5) * 36;
    const y = ((((index * 389) % 983) / 982) - 0.5) * height;
    const length = MathUtils.lerp(42, 86, ((index * 23) % 11) / 10);
    const slant = MathUtils.lerp(-2, 5, ((index * 31) % 13) / 12);
    positions.push(x, y, z, x + slant, y - length, z - Math.abs(slant) * 0.18);
    positions.push(x, y + height, z, x + slant, y + height - length, z - Math.abs(slant) * 0.18);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const rain = new LineSegments(geometry, material);
  rain.name = "raidlands-rain-streak-field";
  rain.frustumCulled = false;
  rain.renderOrder = 30;
  return rain;
}

function normalizeEnvironment(snapshot: EnvironmentSnapshot | null | undefined): NormalizedEnvironment | null {
  if (!snapshot) {
    return null;
  }
  const direction = new Vector3(
    // The viewer mirrors Rust's world X axis for terrain and all overlays.
    // Apply the same coordinate transform to directional environment data.
    -(Number(snapshot.sunDirection?.x) || 0),
    Number(snapshot.sunDirection?.y) || 1,
    Number(snapshot.sunDirection?.z) || 0,
  );
  if (direction.lengthSq() < 0.0001) {
    direction.set(0.5, 0.78, 0.36);
  }
  direction.normalize();
  const weatherRain = weatherParameterValue(snapshot, "rain", null);
  const weatherFog = weatherParameterValue(snapshot, "fog", null);
  const weatherCloudCoverage = weatherParameterValue(snapshot, "cloudCoverage", null);
  const cloudCoverage = nullableFiniteNumber(snapshot.cloudCoverage, Number.NaN);
  const rainIntensity = nullableFiniteNumber(snapshot.rainIntensity, Number.NaN);
  const fogIntensity = nullableFiniteNumber(snapshot.fogIntensity, Number.NaN);

  return {
    rustTime: MathUtils.clamp(finiteNumber(snapshot.rustTime, 0), 0, 24),
    sunDirection: direction,
    sunIntensity: MathUtils.clamp(finiteNumber(snapshot.sunIntensity, 0), 0, 4),
    sunColor: new Color(validHexColor(snapshot.sunColor) || "#fff1cf"),
    ambientIntensity: MathUtils.clamp(finiteNumber(snapshot.ambientIntensity, 0), 0, 2),
    ambientColor: new Color(validHexColor(snapshot.ambientColor) || "#ddeaf0"),
    cloudCoverage: MathUtils.clamp(Number.isFinite(cloudCoverage) ? cloudCoverage : weatherCloudCoverage ?? 0, 0, 1),
    rainIntensity: MathUtils.clamp(Number.isFinite(rainIntensity) ? Math.max(rainIntensity, weatherRain ?? 0) : weatherRain ?? 0, 0, 1),
    fogIntensity: MathUtils.clamp(Number.isFinite(fogIntensity) ? Math.max(fogIntensity, weatherFog ?? 0) : weatherFog ?? 0, 0, 1),
    fogPresetBlend: weatherPresetBlend(snapshot.weather?.state, "fog"),
    thunderIntensity: MathUtils.clamp(weatherParameterValue(snapshot, "thunder", 0) ?? 0, 0, 1),
    rainbowIntensity: MathUtils.clamp(weatherParameterValue(snapshot, "rainbow", 0) ?? 0, 0, 1),
    atmosphereRayleigh: MathUtils.clamp(weatherParameterValue(snapshot, "atmosphereRayleigh", 0.25) ?? 0.25, 0, 4),
    atmosphereMie: MathUtils.clamp(weatherParameterValue(snapshot, "atmosphereMie", 1.55) ?? 1.55, 0, 4),
    atmosphereBrightness: MathUtils.clamp(weatherParameterValue(snapshot, "atmosphereBrightness", 0.95) ?? 0.95, 0, 3),
    atmosphereContrast: MathUtils.clamp(weatherParameterValue(snapshot, "atmosphereContrast", 0.65) ?? 0.65, 0, 3),
    atmosphereDirectionality: MathUtils.clamp(weatherParameterValue(snapshot, "atmosphereDirectionality", 0.75) ?? 0.75, 0, 1),
    cloudSize: MathUtils.clamp(weatherParameterValue(snapshot, "cloudSize", 3.35) ?? 3.35, 0.2, 8),
    cloudOpacity: MathUtils.clamp(weatherParameterValue(snapshot, "cloudOpacity", 1) ?? 1, 0, 1),
    cloudSharpness: MathUtils.clamp(weatherParameterValue(snapshot, "cloudSharpness", 1) ?? 1, 0, 1),
    cloudColoring: MathUtils.clamp(weatherParameterValue(snapshot, "cloudColoring", 0.65) ?? 0.65, 0, 1),
    cloudAttenuation: MathUtils.clamp(weatherParameterValue(snapshot, "cloudAttenuation", 0.25) ?? 0.25, 0, 1),
    cloudScattering: MathUtils.clamp(weatherParameterValue(snapshot, "cloudScattering", 0.65) ?? 0.65, 0, 1),
    cloudBrightness: MathUtils.clamp(weatherParameterValue(snapshot, "cloudBrightness", 0.55) ?? 0.55, 0, 2),
  };
}

function interpolateEnvironment(from: NormalizedEnvironment, to: NormalizedEnvironment, progress: number): NormalizedEnvironment {
  return {
    rustTime: MathUtils.lerp(from.rustTime, to.rustTime, progress),
    sunDirection: from.sunDirection.clone().lerp(to.sunDirection, progress).normalize(),
    sunIntensity: MathUtils.lerp(from.sunIntensity, to.sunIntensity, progress),
    sunColor: from.sunColor.clone().lerp(to.sunColor, progress),
    ambientIntensity: MathUtils.lerp(from.ambientIntensity, to.ambientIntensity, progress),
    ambientColor: from.ambientColor.clone().lerp(to.ambientColor, progress),
    cloudCoverage: MathUtils.lerp(from.cloudCoverage, to.cloudCoverage, progress),
    rainIntensity: MathUtils.lerp(from.rainIntensity, to.rainIntensity, progress),
    fogIntensity: MathUtils.lerp(from.fogIntensity, to.fogIntensity, progress),
    fogPresetBlend: MathUtils.lerp(from.fogPresetBlend, to.fogPresetBlend, progress),
    thunderIntensity: MathUtils.lerp(from.thunderIntensity, to.thunderIntensity, progress),
    rainbowIntensity: MathUtils.lerp(from.rainbowIntensity, to.rainbowIntensity, progress),
    atmosphereRayleigh: MathUtils.lerp(from.atmosphereRayleigh, to.atmosphereRayleigh, progress),
    atmosphereMie: MathUtils.lerp(from.atmosphereMie, to.atmosphereMie, progress),
    atmosphereBrightness: MathUtils.lerp(from.atmosphereBrightness, to.atmosphereBrightness, progress),
    atmosphereContrast: MathUtils.lerp(from.atmosphereContrast, to.atmosphereContrast, progress),
    atmosphereDirectionality: MathUtils.lerp(from.atmosphereDirectionality, to.atmosphereDirectionality, progress),
    cloudSize: MathUtils.lerp(from.cloudSize, to.cloudSize, progress),
    cloudOpacity: MathUtils.lerp(from.cloudOpacity, to.cloudOpacity, progress),
    cloudSharpness: MathUtils.lerp(from.cloudSharpness, to.cloudSharpness, progress),
    cloudColoring: MathUtils.lerp(from.cloudColoring, to.cloudColoring, progress),
    cloudAttenuation: MathUtils.lerp(from.cloudAttenuation, to.cloudAttenuation, progress),
    cloudScattering: MathUtils.lerp(from.cloudScattering, to.cloudScattering, progress),
    cloudBrightness: MathUtils.lerp(from.cloudBrightness, to.cloudBrightness, progress),
  };
}

function visualCloudCoverageForEnvironment(environment: NormalizedEnvironment): number {
  // Rust already gives us effective cloud coverage. Opacity and rain style the
  // visible clouds, but must not invent extra sky coverage.
  return MathUtils.clamp(environment.cloudCoverage, 0, 1);
}

function visualFogStrengthForEnvironment(environment: NormalizedEnvironment): number {
  const sampledHaze = MathUtils.clamp(environment.fogIntensity, 0, 1) * 0.45;
  const weatherHaze = environment.cloudCoverage * 0.04
    + environment.rainIntensity * 0.05
    + MathUtils.clamp(environment.atmosphereMie / 4, 0, 1) * 0.025;

  // Rust's native fog value is not a visual percentage. In the captured live
  // data, the fully active Fog preset reports 0.25 while producing extremely
  // short visibility in-game. Preserve the effective scalar for diagnostics,
  // and use the authoritative preset transition to reproduce its visual impact.
  return MathUtils.clamp(Math.max(environment.fogPresetBlend, sampledHaze + weatherHaze), 0, 1);
}

function visualFogDensityForCamera(fogStrength: number, cameraPosition: Vector3, terrain: TerrainPayload): number {
  const worldSize = terrain.worldSize || 4500;
  const terrainHeight = sampleTerrainHeight(terrain, cameraPosition.x, cameraPosition.z);
  const cameraAltitude = Math.max(0, cameraPosition.y - terrainHeight);
  const altitudeTaper = MathUtils.smoothstep(cameraAltitude, worldSize * 0.08, worldSize * 0.55);
  const altitudeScale = MathUtils.lerp(1, 0.55, altitudeTaper);
  const baseDensity = MathUtils.lerp(0.00001, 0.00072, Math.pow(MathUtils.clamp(fogStrength, 0, 1), 1.3));

  // Rust's fog reads strongly near the terrain but thins from aerial views.
  // Keep the ground-level match while preventing the map-scale cameras from
  // accumulating exponential fog across several kilometres of empty air.
  return baseDensity * altitudeScale;
}

function weatherPresetBlend(state: WeatherState | null | undefined, presetName: string): number {
  if (!state) {
    return 0;
  }

  const normalizedPreset = presetName.trim().toLowerCase();
  const isPreset = (value: unknown): number => String(value || "").trim().toLowerCase() === normalizedPreset ? 1 : 0;
  const blend = MathUtils.clamp(nullableFiniteNumber(state.blend, 1), 0, 1);
  const current = isPreset(state.current || state.previous);
  const target = isPreset(state.target || state.current || state.previous);

  return MathUtils.lerp(current, target, blend);
}

function weatherParameterValue(snapshot: EnvironmentSnapshot, name: string, fallback: number | null): number | null {
  const parameter = snapshot.weather?.parameters?.[name];
  if (!parameter) {
    return fallback;
  }

  const value = nullableFiniteNumber(parameter.value, Number.NaN);
  if (Number.isFinite(value)) {
    return value;
  }

  const raw = nullableFiniteNumber(parameter.raw, Number.NaN);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableFiniteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return finiteNumber(value, fallback);
}

function validHexColor(value: unknown): string {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function textureAspectRatio(texture: CanvasTexture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = Math.max(1, Number(image?.width) || 1);
  const height = Math.max(1, Number(image?.height) || 1);
  return height / width;
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

function shouldHideMonumentPrimitive(monument: MonumentPayload): boolean {
  const key = monumentKey(monument);
  return key.includes("ice_lake") || key.includes("ice_lakes") || key.includes("wild_swamp");
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
  const heatmapFrameIntervalLabel = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-heatmap-frame-interval-label]");
  const forceAirstrike = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-force-airstrike]");
  const players = panel?.querySelector<HTMLInputElement>("[data-map-viewer-players]");
  const allPlayers = panel?.querySelector<HTMLInputElement>("[data-map-viewer-all-players]");
  const myLocation = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-my-location]");
  const myLocationOrbit = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-my-location-orbit]");
  const metric = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-heatmap-metric]");
  const range = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-heatmap-range]");
  let heatmapHistory: HeatmapHistoryFrame[] = [];
  let playbackAnimationFrame = 0;
  let playbackVirtualFrame = 0;
  let playbackLastTick = 0;
  let playbackShownFrame = -1;
  let playbackSpeedIndex = 2;
  let playerPollTimer = 0;
  let environmentPollTimer = 0;
  let playbackHistoryPollTimer = 0;
  let playbackRequestId = 0;
  const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];
  const playerLocationRefreshMs = 15_000;
  const disposers: Array<() => void> = [];
  let followMyLocation = false;
  let orbitMyLocation = false;
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

  const setFollowMyLocation = (enabled: boolean) => {
    followMyLocation = enabled;
    if (!followMyLocation) {
      orbitMyLocation = false;
      viewer.setSelfLocationOrbitEnabled(false);
    }
    if (myLocation) {
      myLocation.setAttribute("aria-pressed", String(followMyLocation));
    }
    if (myLocationOrbit) {
      myLocationOrbit.setAttribute("aria-pressed", String(orbitMyLocation));
    }
    if (tour) {
      viewer.setTourEnabled(tour.checked && !followMyLocation);
    }
    syncMyLocationControl();
  };

  const setOrbitMyLocation = (enabled: boolean) => {
    orbitMyLocation = enabled && followMyLocation;
    viewer.setSelfLocationOrbitEnabled(orbitMyLocation && viewer.hasSelfLocation());
    if (myLocationOrbit) {
      myLocationOrbit.setAttribute("aria-pressed", String(orbitMyLocation));
    }
    syncMyLocationControl();
  };

  const syncMyLocationControl = () => {
    const available = viewer.hasSelfLocation();
    if (myLocation) {
      myLocation.disabled = !available && !followMyLocation;
      myLocation.setAttribute("aria-pressed", String(followMyLocation));
      myLocation.title = available
        ? "Toggle camera follow for your server location during playback"
        : followMyLocation
          ? "Waiting for your server location to return"
          : "Log in and join the server to show your location";
    }
    if (myLocationOrbit) {
      myLocationOrbit.disabled = !followMyLocation || !available;
      myLocationOrbit.setAttribute("aria-pressed", String(orbitMyLocation));
      myLocationOrbit.title = followMyLocation
        ? available
          ? "Orbit around your followed server location"
          : "Waiting for your server location to return"
        : "Turn on Follow my location first";
    }
    viewer.setSelfLocationOrbitEnabled(orbitMyLocation && followMyLocation && available);
  };

  bind(grid, "change", () => {
    if (grid) {
      viewer.setGridVisible(grid.checked);
    }
  });

  bind(tour, "change", () => {
    if (tour) {
      viewer.setTourEnabled(tour.checked && !followMyLocation);
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

  const stopLiveOverlayPolling = () => {
    window.clearInterval(playerPollTimer);
    playerPollTimer = 0;
  };

  const stopEnvironmentPolling = () => {
    window.clearInterval(environmentPollTimer);
    environmentPollTimer = 0;
  };

  const loadLiveEnvironment = () => {
    void loadEnvironment(root).then((payload) => {
      if (!wantsTimelineOverlay()) {
        viewer.setEnvironment(payload.environment);
      }
    });
  };

  const startEnvironmentPolling = () => {
    if (wantsTimelineOverlay()) {
      stopEnvironmentPolling();
      return;
    }
    loadLiveEnvironment();
    if (environmentPollTimer !== 0) {
      return;
    }
    environmentPollTimer = window.setInterval(() => {
      if (wantsTimelineOverlay()) {
        stopEnvironmentPolling();
        return;
      }
      loadLiveEnvironment();
    }, playerLocationRefreshMs);
  };

  const loadLiveOverlays = () => {
    if (wantsTimelineOverlay()) {
      return;
    }

    const heatmapEnabled = wantsHeatmap();
    const playersEnabled = wantsPlayers();

    if (heatmapEnabled) {
      void loadHeatmap(root, viewer, selectedMetric(), selectedRange());
    } else {
      viewer.setHeatmapVisible(false);
    }

    if (playersEnabled) {
      void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers()).then(() => {
        syncMyLocationControl();
        if (followMyLocation && !orbitMyLocation) {
          viewer.followSelfLocation();
        }
      });
    } else {
      viewer.setPlayerLocationsVisible(false);
    }

    void loadLiveReplayEvents(root).then((events) => {
      if (!wantsTimelineOverlay() && events.length > 0) {
        viewer.showReplayEvents(events, 1);
      }
    });
  };

  const startLiveOverlayPolling = () => {
    if (wantsTimelineOverlay() || !(wantsHeatmap() || wantsPlayers())) {
      stopLiveOverlayPolling();
      return;
    }

    loadLiveOverlays();

    if (playerPollTimer !== 0) {
      return;
    }

    playerPollTimer = window.setInterval(() => {
      if (wantsTimelineOverlay() || !(wantsHeatmap() || wantsPlayers())) {
        stopLiveOverlayPolling();
        return;
      }

      loadLiveOverlays();
    }, playerLocationRefreshMs);
  };

  const updateTimelineValue = (value: number) => {
    if (!heatmapFrame) {
      return;
    }

    heatmapFrame.value = String(MathUtils.clamp(value, 0, Math.max(0, heatmapHistory.length - 1)));
  };

  const playbackCursorMs = (frameValue = playbackVirtualFrame): number | null => {
    if (heatmapHistory.length === 0) {
      return null;
    }
    const clamped = MathUtils.clamp(frameValue, 0, Math.max(0, heatmapHistory.length - 1));
    const lowerIndex = Math.floor(clamped);
    const upperIndex = Math.min(heatmapHistory.length - 1, lowerIndex + 1);
    const lowerTime = historyFrameTime(heatmapHistory[lowerIndex]);
    const upperTime = historyFrameTime(heatmapHistory[upperIndex]);
    if (lowerTime === null) {
      return upperTime;
    }
    if (upperTime === null || upperIndex === lowerIndex) {
      return lowerTime;
    }
    return MathUtils.lerp(lowerTime, upperTime, clamped - lowerIndex);
  };

  const timelineReplayEvents = (cursorMs: number | null): MapReplayEvent[] => {
    if (cursorMs === null) {
      return [];
    }
    const leadMs = 10_000;
    const trailMs = 120_000;
    const seen = new Set<string>();
    const events: MapReplayEvent[] = [];
    heatmapHistory.forEach((frame) => {
      (Array.isArray(frame.events) ? frame.events : []).forEach((event, index) => {
        const occurred = Date.parse(String(event.occurredAt || ""));
        if (!Number.isFinite(occurred) || occurred > cursorMs + leadMs || occurred < cursorMs - trailMs) {
          return;
        }
        const key = replayEventKey(event, index);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        events.push(event);
      });
    });
    return events;
  };

  const syncTimelineReplay = () => {
    const cursorMs = playbackCursorMs();
    if (cursorMs === null) {
      viewer.clearReplayEvents();
      return;
    }
    viewer.showReplayEvents(timelineReplayEvents(cursorMs), playbackSpeed(), {
      mode: "timeline",
      cursorMs,
    });
  };

  const updatePlaybackSpeedControls = () => {
    const controlsActive = wantsTimelineOverlay();
    const speed = playbackSpeed();
    if (heatmapSpeedLabel) {
      heatmapSpeedLabel.value = `${speed}x`;
      heatmapSpeedLabel.textContent = `${speed}x`;
    }
    if (heatmapSpeedDown) {
      heatmapSpeedDown.disabled = !controlsActive || playbackSpeedIndex <= 0;
    }
    if (heatmapSpeedUp) {
      heatmapSpeedUp.disabled = !controlsActive || playbackSpeedIndex >= playbackSpeeds.length - 1;
    }
  };

  const updatePlaybackControlAvailability = () => {
    const controlsActive = wantsTimelineOverlay();
    if (!controlsActive) {
      stopHeatmapPlayback();
    }
    if (heatmapPlay) {
      heatmapPlay.disabled = !controlsActive || heatmapHistory.length === 0;
    }
    if (heatmapLoop) {
      heatmapLoop.disabled = !controlsActive;
    }
    if (heatmapFrame) {
      heatmapFrame.disabled = !controlsActive || heatmapHistory.length === 0;
    }
    updatePlaybackSpeedControls();
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
      syncTimelineReplay();
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

  const selectedRangeSeconds = (): number => {
    return historyRangeSeconds(selectedRange());
  };

  const maxFrameCountForSelectedRange = (): number => {
    return Math.max(8, Math.min(72, Math.floor(selectedRangeSeconds() / 60)));
  };

  const heatmapFrameCountValue = (): number => {
    return maxFrameCountForSelectedRange();
  };

  const updateEstimatedFrameIntervalLabel = () => {
    setFrameIntervalLabel(Math.max(60, Math.ceil(selectedRangeSeconds() / heatmapFrameCountValue())));
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
      syncMyLocationControl();
      if (followMyLocation && !orbitMyLocation) {
        viewer.followSelfLocation();
      }
    }
    syncTimelineReplay();
    viewer.setEnvironment(frame.environment, 420);
    setTimelineLabel(frame);
  };

  const latestVisibleHeatmapFrame = (): number => {
    for (let index = heatmapHistory.length - 1; index >= 0; index -= 1) {
      const frame = heatmapHistory[index];
      if (
        (Array.isArray(frame?.buckets) && frame.buckets.length > 0)
        || (Array.isArray(frame?.players) && frame.players.length > 0)
        || (Array.isArray(frame?.events) && frame.events.length > 0)
      ) {
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
      stopLiveOverlayPolling();
      stopPlaybackHistoryPolling();
      heatmapHistory = [];
      viewer.clearReplayEvents();
      viewer.setHeatmapVisible(false);
      viewer.setPlayerLocationsVisible(false);
      updatePlaybackControlAvailability();
      return;
    }

    if (wantsPlayback()) {
      stopLiveOverlayPolling();
      stopEnvironmentPolling();
      const requestId = playbackRequestId + 1;
      playbackRequestId = requestId;
      const requestRange = selectedRange();
      const requestFrameCount = heatmapFrameCountValue();
      const wasPlayingLoop = playbackAnimationFrame > 0 && wantsLoop();
      const previousHistoryLength = heatmapHistory.length;
      const previousFrameProgress = previousHistoryLength > 0
        ? MathUtils.clamp(playbackVirtualFrame / Math.max(1, previousHistoryLength - 1), 0, 1)
        : 1;
      const previousFrame = heatmapHistory[currentPlaybackFrameIndex()] || null;
      const previousFrameTime = previousFrame ? historyFrameTime(previousFrame) : null;
      const shouldFollowLatest = selectLatest || (preferredFrame === undefined && isFollowingLatestPlaybackFrame());
      void Promise.all([
        loadOverlayHistory(root, heatmapEnabled, playersEnabled, wantsAllPlayers(), selectedMetric(), requestRange, requestFrameCount),
        loadReplayEventHistory(root, requestRange, requestFrameCount),
        loadEnvironmentHistory(root, requestRange, requestFrameCount),
      ]).then(([payload, replayPayload, environmentPayload]) => {
        if (requestId !== playbackRequestId || selectedRange() !== requestRange) {
          return;
        }

        heatmapHistory = trimHistoryFramesToRange(Array.isArray(payload.frames) ? payload.frames : [], requestRange, payload.windowEnd);
        mergeReplayEventsIntoFrames(heatmapHistory, replayPayload);
        mergeEnvironmentIntoFrames(heatmapHistory, environmentPayload);
        setFrameIntervalLabel(payload.frameSeconds);
        const latestFrame = preferredFrame !== undefined
          ? MathUtils.clamp(Math.round(preferredFrame), 0, Math.max(0, heatmapHistory.length - 1))
          : wasPlayingLoop
            ? MathUtils.clamp(previousFrameProgress * Math.max(0, heatmapHistory.length - 1), 0, Math.max(0, heatmapHistory.length - 1))
            : shouldFollowLatest || previousFrameTime === null
            ? latestVisibleHeatmapFrame()
            : nearestPlaybackFrameIndexForTime(previousFrameTime);
        if (heatmapFrame) {
          heatmapFrame.max = String(Math.max(0, heatmapHistory.length - 1));
          heatmapFrame.step = wasPlayingLoop ? "any" : "1";
          heatmapFrame.value = String(latestFrame);
        }
        playbackVirtualFrame = latestFrame;
        showPlaybackFrame(latestFrame);
        startPlaybackHistoryPolling();
        updatePlaybackControlAvailability();
        if (restartPlayback && wantsPlayback() && heatmapHistory.length > 1) {
          startHeatmapPlayback();
        }
      });
      return;
    }

    stopHeatmapPlayback();
    playbackRequestId += 1;
    stopPlaybackHistoryPolling();
    heatmapHistory = [];
    playbackVirtualFrame = 0;
    playbackShownFrame = -1;
    setTimelineLabel(null, "Live");
    if (heatmapFrame) {
      heatmapFrame.step = "1";
      heatmapFrame.value = "0";
      heatmapFrame.max = "0";
    }
    viewer.clearReplayEvents();
    startLiveOverlayPolling();
    startEnvironmentPolling();
    updatePlaybackControlAvailability();
  };

  const startPlaybackHistoryPolling = () => {
    if (!wantsTimelineOverlay()) {
      stopPlaybackHistoryPolling();
      startEnvironmentPolling();
      return;
    }

    stopEnvironmentPolling();

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
    updatePlaybackControlAvailability();
    reloadPlayback(undefined, true, wantsPlayback());
  });
  bind(metric, "change", () => reloadPlayback());
  bind(range, "change", () => {
    stopHeatmapPlayback();
    updateEstimatedFrameIntervalLabel();
    reloadPlayback(undefined, true, true);
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
    if (!wantsHeatmap() && players && !players.checked) {
      players.checked = true;
    }
    if (!wantsTimelineOverlay()) {
      updatePlaybackControlAvailability();
      return;
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

  bind(forceAirstrike, "click", () => {
    if (!forceAirstrike) {
      return;
    }

    const originalLabel = forceAirstrike.textContent || "Replay latest strike";
    forceAirstrike.disabled = true;
    forceAirstrike.textContent = "Loading strike";
    void loadForcedReplayEvents(root, selectedRange(), heatmapFrameCountValue()).then((events) => {
      if (events.length === 0) {
        forceAirstrike.textContent = "No recent strike";
        window.setTimeout(() => {
          forceAirstrike.textContent = originalLabel;
          forceAirstrike.disabled = false;
        }, 1800);
        return;
      }

      viewer.clearReplayEvents();
      viewer.showReplayEvents(events, 1);
      forceAirstrike.textContent = `Playing ${events.length}`;
      window.setTimeout(() => {
        forceAirstrike.textContent = originalLabel;
        forceAirstrike.disabled = false;
      }, 1800);
    }).catch((error) => {
      console.info("Raidlands forced airstrike replay could not be loaded.", error);
      forceAirstrike.textContent = "Replay failed";
      window.setTimeout(() => {
        forceAirstrike.textContent = originalLabel;
        forceAirstrike.disabled = false;
      }, 1800);
    });
  });

  const reloadPlayers = () => {
    if (!wantsPlayers()) {
      stopLiveOverlayPolling();
      viewer.setPlayerLocationsVisible(false);
      if (wantsHeatmap() && !wantsTimelineOverlay()) {
        startLiveOverlayPolling();
      }
      return;
    }

    if (wantsTimelineOverlay()) {
      stopLiveOverlayPolling();
      const selectedFrame = currentPlaybackFrameIndex();
      if (heatmapHistory.length > 0) {
        showPlaybackFrame(selectedFrame);
      } else {
        reloadPlayback(selectedFrame);
      }
      return;
    }

    startLiveOverlayPolling();
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
  updateEstimatedFrameIntervalLabel();
  updatePlaybackControlAvailability();
  updatePlaybackSpeedControls();
  if (tour) {
    viewer.setTourEnabled(tour.checked && !followMyLocation);
  }
  if (wantsHeatmap() || wantsPlayers()) {
    reloadPlayback();
  }

  bind(myLocation, "click", () => {
    if (players && !players.checked) {
      players.checked = true;
    }

    const nextFollowState = !followMyLocation;
    setFollowMyLocation(nextFollowState);

    if (wantsTimelineOverlay()) {
      const selectedFrame = currentPlaybackFrameIndex();
      if (heatmapHistory.length > 0) {
        showPlaybackFrame(selectedFrame);
        if (followMyLocation && !orbitMyLocation) {
          viewer.followSelfLocation();
        }
      } else {
        reloadPlayback(selectedFrame);
      }
      return;
    }

    if (viewer.hasSelfLocation()) {
      if (followMyLocation && !orbitMyLocation) {
        viewer.followSelfLocation();
      }
      if (playerPollTimer === 0) {
        reloadPlayers();
      }
      return;
    }

    void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers()).then(() => {
      if (followMyLocation && viewer.hasSelfLocation() && players) {
        players.checked = true;
        if (!orbitMyLocation) {
          viewer.followSelfLocation();
        }
      }
      syncMyLocationControl();
    });
  });

  bind(myLocationOrbit, "click", () => {
    if (!followMyLocation || !viewer.hasSelfLocation()) {
      syncMyLocationControl();
      return;
    }

    setOrbitMyLocation(!orbitMyLocation);
    if (!orbitMyLocation && followMyLocation) {
      viewer.followSelfLocation();
    }
  });

  if (!wantsPlayback()) {
    startLiveOverlayPolling();
  }
  startEnvironmentPolling();

  return {
    dispose: () => {
      window.cancelAnimationFrame(playbackAnimationFrame);
      stopLiveOverlayPolling();
      stopPlaybackHistoryPolling();
      stopEnvironmentPolling();
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

async function loadEnvironment(root: HTMLElement): Promise<EnvironmentPayload> {
  const baseUrl = root.dataset.environmentUrl || "";

  if (!baseUrl) {
    return { ok: false, environment: null };
  }

  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("refresh", String(Date.now()));

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Environment request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as EnvironmentPayload;
  } catch (error) {
    console.info("Raidlands environment could not be loaded.", error);
    return { ok: false, environment: null };
  }
}

async function loadEnvironmentHistory(root: HTMLElement, range: string, frames = 24): Promise<EnvironmentPayload> {
  const baseUrl = root.dataset.environmentUrl || "";

  if (!baseUrl) {
    return { ok: false, frames: [] };
  }

  const url = new URL(baseUrl, window.location.href);
  url.searchParams.set("range", range);
  url.searchParams.set("playback", "1");
  url.searchParams.set("frames", String(Math.max(8, Math.min(72, Math.round(frames)))));
  url.searchParams.set("refresh", String(Date.now()));

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Environment history request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as EnvironmentPayload;
  } catch (error) {
    console.info("Raidlands environment history could not be loaded.", error);
    return { ok: false, frames: [] };
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
  url.searchParams.set("refresh", String(Date.now()));

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
  url.searchParams.set("refresh", String(Date.now()));
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
    windowEnd: heatmapPayload.windowEnd || playerPayload.windowEnd,
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

async function loadReplayEventHistory(root: HTMLElement, range: string, frames = 24): Promise<MapReplayHistoryPayload> {
  const url = root.dataset.mapReplayEventsUrl || "";
  if (!url) {
    return { ok: true, frames: [] };
  }

  const params = new URLSearchParams({
    range,
    frames: String(Math.max(2, frames)),
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Replay events request failed with HTTP ${response.status}.`);
    }
    return await response.json() as MapReplayHistoryPayload;
  } catch (error) {
    console.info("Raidlands replay events could not be loaded.", error);
    return { ok: false, frames: [] };
  }
}

async function loadLiveReplayEvents(root: HTMLElement): Promise<MapReplayEvent[]> {
  const payload = await loadReplayEventHistory(root, "15m", 8);
  return latestReplayEventsFromPayload(payload, 15 * 60 * 1000);
}

async function loadForcedReplayEvents(root: HTMLElement, range: string, frames: number): Promise<MapReplayEvent[]> {
  const requestRange = range || "15m";
  const requestFrames = Math.max(8, Math.min(72, Math.round(frames) || 24));
  const payload = await loadReplayEventHistory(root, requestRange, requestFrames);
  return latestReplayEventsFromPayload(payload, 0);
}

function latestReplayEventsFromPayload(payload: MapReplayHistoryPayload, maxAgeMs: number): MapReplayEvent[] {
  const frames = Array.isArray(payload.frames) ? payload.frames : [];
  const payloadWindowEnd = Date.parse(String((payload as MapReplayHistoryPayload & { windowEnd?: string }).windowEnd || ""));
  const newestFrameEnd = [...frames].reverse()
    .map((frame) => Date.parse(String(frame.windowEnd || "")))
    .find((value) => Number.isFinite(value));
  const frameWindowEnd = newestFrameEnd ?? Number.NaN;
  const referenceTime: number = Number.isFinite(payloadWindowEnd)
    ? payloadWindowEnd
    : Number.isFinite(frameWindowEnd)
      ? frameWindowEnd
      : Date.now();

  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const events = Array.isArray(frames[index]?.events)
      ? frames[index]!.events!.map(normalizeReplayEvent).filter((event): event is MapReplayEvent => event !== null)
      : [];
    const freshEvents = maxAgeMs > 0
      ? events.filter((event) => {
        const occurred = Date.parse(String(event.occurredAt || ""));
        return Number.isFinite(occurred) ? referenceTime - occurred <= maxAgeMs : true;
      })
      : events;

    if (freshEvents.length > 0) {
      return freshEvents.slice(0, 8);
    }
  }

  return [];
}

function mergeReplayEventsIntoFrames(frames: HeatmapHistoryFrame[], replayPayload: MapReplayHistoryPayload): void {
  const replayFrames = Array.isArray(replayPayload.frames) ? replayPayload.frames : [];
  frames.forEach((frame, index) => {
    const replayFrame = replayFrames[index];
    frame.events = Array.isArray(replayFrame?.events)
      ? replayFrame.events.map(normalizeReplayEvent).filter((event): event is MapReplayEvent => event !== null)
      : [];
  });
}

function mergeEnvironmentIntoFrames(frames: HeatmapHistoryFrame[], environmentPayload: EnvironmentPayload): void {
  const environmentFrames = Array.isArray(environmentPayload.frames) ? environmentPayload.frames : [];
  frames.forEach((frame, index) => {
    const matching = environmentFrameFor(frame, environmentFrames, index, Math.max(60, Number(environmentPayload.frameSeconds) || 60));
    frame.environment = matching?.environment ?? null;
  });
}

function environmentFrameFor(
  frame: HeatmapHistoryFrame,
  environmentFrames: NonNullable<EnvironmentPayload["frames"]>,
  fallbackIndex: number,
  frameSeconds: number,
): NonNullable<EnvironmentPayload["frames"]>[number] | null {
  if (environmentFrames.length === 0) {
    return null;
  }

  const frameTime = historyFrameTime(frame);
  const fallbackFrame = environmentFrames[fallbackIndex] || null;
  if (frameTime === null) {
    return fallbackFrame;
  }

  let closest = fallbackFrame;
  let closestDelta = closest ? environmentFrameDeltaMs(closest, frameTime) : Number.POSITIVE_INFINITY;
  const toleranceMs = Math.max(90_000, frameSeconds * 1000 * 0.75);
  for (const environmentFrame of environmentFrames) {
    const delta = environmentFrameDeltaMs(environmentFrame, frameTime);
    if (delta < closestDelta) {
      closest = environmentFrame;
      closestDelta = delta;
    }
  }

  return closest && closestDelta <= toleranceMs ? closest : fallbackFrame;
}

function environmentFrameDeltaMs(frame: NonNullable<EnvironmentPayload["frames"]>[number], targetMs: number): number {
  const raw = frame.windowEnd || frame.windowStart || "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? Math.abs(time - targetMs) : Number.POSITIVE_INFINITY;
}

function normalizeReplayEvent(event: MapReplayEvent): MapReplayEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const x = Number(event.x);
  const z = Number(event.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }

  return {
    eventKey: String(event.eventKey || ""),
    eventType: String(event.eventType || ""),
    occurredAt: String(event.occurredAt || ""),
    x,
    y: Number.isFinite(Number(event.y)) ? Number(event.y) : undefined,
    z,
    profileKey: String(event.profileKey || ""),
    vehicle: String(event.vehicle || ""),
    payload: event.payload && typeof event.payload === "object" ? event.payload : {},
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

function trimHistoryFramesToRange(frames: HeatmapHistoryFrame[], range: string, windowEnd?: string): HeatmapHistoryFrame[] {
  if (frames.length === 0) {
    return frames;
  }

  const durationSeconds = historyRangeSeconds(range);
  const parsedWindowEnd = windowEnd ? Date.parse(windowEnd) : Number.NaN;
  const latestFrameTime = historyFrameTime(frames[frames.length - 1]);
  const endMs = Number.isFinite(parsedWindowEnd) ? parsedWindowEnd : latestFrameTime;

  if (!endMs || !Number.isFinite(endMs)) {
    return frames;
  }

  const startMs = endMs - durationSeconds * 1000;
  return frames.filter((frame) => {
    const frameTime = historyFrameTime(frame);
    return frameTime === null || frameTime >= startMs;
  });
}

function historyRangeSeconds(range: string): number {
  switch (range) {
    case "15m":
      return 15 * 60;
    case "30m":
      return 30 * 60;
    case "1h":
      return 60 * 60;
    case "3h":
      return 3 * 60 * 60;
    case "6h":
      return 6 * 60 * 60;
    case "12h":
      return 12 * 60 * 60;
    case "24h":
      return 24 * 60 * 60;
    case "wipe":
      return 31 * 24 * 60 * 60;
    default:
      return 24 * 60 * 60;
  }
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
