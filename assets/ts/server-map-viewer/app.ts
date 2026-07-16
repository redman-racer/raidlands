import {
  AmbientLight,
  AdditiveBlending,
  BoxGeometry,
  Box3,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DataTexture,
  FogExp2,
  FloatType,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  CanvasTexture,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  PerspectiveCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  RingGeometry,
  RepeatWrapping,
  RedFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { unityPositionToThreeVector, unityQuaternionValueToThreeQuaternion } from "../airstrike-animation-editor/editor/coordinates";
import { createVehicleProxy, loadVehiclePreview, metadataForVehicle } from "../airstrike-animation-editor/editor/vehicle-preview";
import type { VehiclePreviewMetadataFile } from "../airstrike-animation-editor/types";
import { mapVehicleUsesDetailedModel } from "./world-event-model-policy";
import {
  replayTimelineFrameIntervalMs,
  replayTimelineHistoryRate,
  rustWorldQuaternionToViewerQuaternion,
} from "./world-event-replay-policy";
import {
  fogRayMarchSamples,
  lowDetailFogNearVisibility,
  parseFogDetail,
  resolveFogDetail,
  type FogCapabilities,
  type FogDetail,
} from "./fog-detail";
import { getSharedCanvasTexture, isSharedThreeAsset, loadSharedTexture } from "../shared/three-asset-cache";
import { applyRaidlandsEnvironment, updateRaidlandsEnvironment } from "../shared/three-environment";
import {
  parseRaidlandsCloudDetail,
  raidlandsCloudProfile,
  type RaidlandsCloudDetail,
  type RaidlandsCloudProfile,
} from "../shared/three-cloud-detail";
import {
  parseRaidlandsSunDetail,
  raidlandsSunProfile,
  type RaidlandsSunDetail,
  type RaidlandsSunProfile,
} from "../shared/three-sun-detail";
import {
  extrapolateRaidlandsSunDirection,
  raidlandsSunMotionBetween,
  type RaidlandsSunMotion,
} from "../shared/three-sun-motion";
import {
  parseEnvironmentQuality,
  preferredEnvironmentQuality,
  resolveEnvironmentQuality,
  type EnvironmentQuality,
  type EnvironmentQualityProfile,
} from "./environment-quality";
import {
  cameraHeightAboveTerrain,
  offshoreCameraCoordinateLimit,
  parseCameraPreferences,
  parseCameraMode,
  resolveCameraBounds,
  shouldResumeAutomaticCamera,
  transitionNeedsSafeWaypoint,
  type CameraBounds,
  type CameraMode,
  type ManualCameraStyle,
} from "./camera-policy";
import {
  cameraYForTerrainSightline,
  selectDirectorShot,
  updateDirectorFpsState,
  type DirectorActionSubject,
  type DirectorFpsState,
  type DirectorLandscapeFeature,
  type DirectorMode,
  type DirectorShotPlan,
} from "./camera-director-policy";
import { versionMapAssetUrl } from "./map-asset-policy";
import { monumentNavigationLabels, recentUniqueNavigationEvents, validNavigationCoordinate } from "./navigation-policy";
import {
  monumentModelAssetName,
  monumentModelManifestVersion,
  monumentModelMetadata,
  monumentModelRecipeVersion,
  monumentModelSourceRevision,
  monumentModelThresholds,
  type MonumentModelManifestEntry,
  type MonumentModelTier,
} from "./monument-model-registry";
import { monumentPrimitiveKind, monumentPrimitiveSearchKey, monumentPrimitiveSize } from "./monument-primitive-policy";
import { normalizePowerLines, type PowerLinePayload } from "./power-line-policy";
import { normalizeRoads, sampleSmoothRoadCenterline, type RoadPayload } from "./road-policy";
import { sampleTerrainSurfaceHeight } from "./terrain-height-policy";
import {
  desiredMonumentTier,
  monumentCacheEvictionKeys,
  monumentTierFitsBudget,
  parseMonumentMode,
  prioritizeMonuments,
  projectedMonumentDiameter,
  resolveMonumentQuality,
  visibleMonumentTier,
  type MonumentLodTier,
  type MonumentMode,
  type MonumentQualityPolicy,
} from "./monument-quality-policy";
import {
  buildTerrainVegetation,
  vegetationInstanceBudget,
  type VegetationPlacement,
} from "./vegetation-policy";
import { TreeModelController } from "./tree-model-controller";

const ENVIRONMENT_QUALITY_STORAGE_KEY = "raidlands:map-environment-quality";
const CAMERA_PREFERENCES_STORAGE_KEY = "raidlands:map-camera-preferences";
const DETAILED_MONUMENTS_STORAGE_KEY = "raidlands:map-detailed-monuments";
const DRACO_DECODER_URL = new URL(/* @vite-ignore */ "../../media/models/draco/", import.meta.url).href;

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
  powerLines?: PowerLinePayload[];
  roads?: RoadPayload[];
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

type DirectorShotRuntime = {
  plan: DirectorShotPlan;
  from: CameraPose;
  to: CameraPose;
  waypoint: CameraPose | null;
  fromFov: number;
  startedAt: number;
};

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

type WorldEventRouteSample = {
  timestampMs: number;
  position: Vector3;
  rotation: Quaternion;
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
  sampledAtMs: number;
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
      float sunsetGrade = uTwilight * mix(0.48, 1.0, clearSky);
      float warmth = sunsetGrade * (0.018 + shadowWeight * 0.048);

      color *= mix(vec3(1.0), vec3(1.075, 0.965, 0.91), sunsetGrade * 0.32);
      color += warmSun * warmth;
      float horizonWarmth = sunsetGrade * (1.0 - smoothstep(0.18, 0.78, vUv.y));
      color += vec3(1.0, 0.34, 0.2) * horizonWarmth * 0.018;
      float atmosphericShadowLift = shadowWeight * (uTwilight * 0.026 + uFogStrength * 0.052)
        * (1.0 - uRainIntensity * 0.34);
      color += mix(vec3(0.2, 0.3, 0.42), warmSun, uTwilight * 0.72) * atmosphericShadowLift;
      float hazeDesaturation = clamp(uFogStrength * 0.085 + uRainIntensity * 0.05, 0.0, 0.12);
      color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), hazeDesaturation);
      color = mix(vec3(0.5), color, mix(0.955, 1.028, clamp(uAtmosphereContrast / 1.4, 0.0, 1.0)));

      gl_FragColor = vec4(color, source.a);
    }
  `,
};

const RAIDLANDS_VOLUMETRIC_FOG_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tTerrainHeight: { value: null },
    uCameraNear: { value: 1 },
    uCameraFar: { value: 12000 },
    uInverseProjection: { value: new Matrix4() },
    uCameraWorld: { value: new Matrix4() },
    uCameraPosition: { value: new Vector3() },
    uWorldSize: { value: 4500 },
    uFogStrength: { value: 0 },
    uFogIntensity: { value: 0 },
    uFogColor: { value: new Color(0xc8dfe8) },
    uSunColor: { value: new Color(0xfff1cf) },
    uSunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
    uRainIntensity: { value: 0 },
    uMie: { value: 0.4 },
    uTime: { value: 0 },
    uSampleCount: { value: 44 },
    uMaxDetail: { value: 1 },
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
    uniform sampler2D tDepth;
    uniform sampler2D tTerrainHeight;
    uniform mat4 uInverseProjection;
    uniform mat4 uCameraWorld;
    uniform vec3 uCameraPosition;
    uniform float uWorldSize;
    uniform float uFogStrength;
    uniform float uFogIntensity;
    uniform vec3 uFogColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDirection;
    uniform float uRainIntensity;
    uniform float uMie;
    uniform float uTime;
    uniform float uSampleCount;
    uniform float uMaxDetail;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
    }

    float terrainHeight(vec2 worldXZ) {
      vec2 uv = clamp(vec2(0.5 - worldXZ.x / uWorldSize, 0.5 - worldXZ.y / uWorldSize), 0.0, 1.0);
      return texture2D(tTerrainHeight, uv).r;
    }

    float fogDensity(vec3 worldPosition) {
      float ground = terrainHeight(worldPosition.xz);
      float valleyRadius = uWorldSize * 0.025;
      float surroundingGround = (
        terrainHeight(worldPosition.xz + vec2(valleyRadius, 0.0))
        + terrainHeight(worldPosition.xz - vec2(valleyRadius, 0.0))
        + terrainHeight(worldPosition.xz + vec2(0.0, valleyRadius))
        + terrainHeight(worldPosition.xz - vec2(0.0, valleyRadius))
      ) * 0.25;
      float valleyDepth = clamp((surroundingGround - ground) / max(18.0, uWorldSize * 0.018), 0.0, 1.0);
      float fogTop = uWorldSize * mix(0.035, 0.09, uFogIntensity);
      float heightShape = 1.0 - smoothstep(ground - 12.0, ground + fogTop * mix(0.82, 1.34, valleyDepth), worldPosition.y);
      float broad = noise2(worldPosition.xz / (uWorldSize * 0.17) + vec2(uTime * 0.0032, -uTime * 0.0021));
      float detail = noise2(worldPosition.xz / (uWorldSize * 0.055) + vec2(-uTime * 0.006, uTime * 0.004));
      float structure = mix(0.5, 1.08, broad) * mix(0.82, 1.18, detail * uMaxDetail)
        * mix(0.86, 1.36, valleyDepth * uMaxDetail);
      return max(0.0, heightShape * structure * uFogStrength);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).x;
      if (uFogStrength <= 0.001 || depth >= 0.999999) {
        gl_FragColor = source;
        return;
      }

      vec4 viewPosition = uInverseProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      viewPosition /= max(viewPosition.w, 0.00001);
      vec3 worldEnd = (uCameraWorld * viewPosition).xyz;
      vec3 ray = worldEnd - uCameraPosition;
      float rayLength = length(ray);
      vec3 rayDirection = ray / max(rayLength, 0.0001);
      float stepLength = rayLength / max(uSampleCount, 1.0);
      float transmittance = 1.0;
      vec3 scattering = vec3(0.0);
      float sunFacing = pow(max(dot(rayDirection, normalize(uSunDirection)), 0.0), mix(3.0, 9.0, uMie));
      vec3 litFog = mix(uFogColor, uSunColor, sunFacing * mix(0.05, 0.22, uMaxDetail) * (1.0 - uRainIntensity * 0.55));

      for (int index = 0; index < 44; index++) {
        if (float(index) >= uSampleCount || transmittance < 0.025) break;
        // A stable midpoint sample avoids screen-space shimmer while the
        // automatic camera moves. The density field already supplies detail.
        float alongRay = (float(index) + 0.5) * stepLength;
        vec3 samplePosition = uCameraPosition + rayDirection * alongRay;
        float density = fogDensity(samplePosition);
        float extinction = 1.0 - exp(-density * stepLength / max(uWorldSize * 0.085, 1.0));
        scattering += transmittance * extinction * litFog;
        transmittance *= 1.0 - extinction;
      }

      gl_FragColor = vec4(source.rgb * transmittance + scattering, source.a);
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

function cloudShadowShaderSource(octaves: number): string {
  if (octaves <= 0) {
    return `
uniform float raidlandsCloudShadowStrength;
float raidlandsCloudShadowAt(vec2 worldPosition) { return 0.0; }`;
  }
  const weights = [0.54, 0.27, 0.13, 0.06];
  const noiseLines = weights.slice(0, octaves).map((weight, index) => {
    const scale = (2.03 ** index).toFixed(5);
    const offsetX = (index * 7.13).toFixed(3);
    const offsetY = (index * -4.27).toFixed(3);
    return `field += raidlandsCloudShadowNoise(position * ${scale} + vec2(${offsetX}, ${offsetY})) * ${weight.toFixed(3)};`;
  }).join("\n");
  const totalWeight = weights.slice(0, octaves).reduce((sum, value) => sum + value, 0).toFixed(3);
  return `
uniform float raidlandsCloudCoverage;
uniform float raidlandsCloudOpacity;
uniform float raidlandsCloudSize;
uniform float raidlandsCloudSharpness;
uniform float raidlandsCloudPhase;
uniform float raidlandsCloudShadowStrength;
uniform float raidlandsCloudWorldSize;

float raidlandsCloudShadowHash(vec2 position) {
  return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453123);
}

float raidlandsCloudShadowNoise(vec2 position) {
  vec2 cell = floor(position);
  vec2 local = fract(position);
  local = local * local * (3.0 - 2.0 * local);
  float lower = mix(raidlandsCloudShadowHash(cell), raidlandsCloudShadowHash(cell + vec2(1.0, 0.0)), local.x);
  float upper = mix(raidlandsCloudShadowHash(cell + vec2(0.0, 1.0)), raidlandsCloudShadowHash(cell + vec2(1.0, 1.0)), local.x);
  return mix(lower, upper, local.y);
}

float raidlandsCloudShadowAt(vec2 worldPosition) {
  float coverage = clamp(raidlandsCloudCoverage, 0.0, 1.0);
  if (coverage <= 0.001) return 0.0;
  float sizeFraction = clamp((raidlandsCloudSize - 0.2) / 7.8, 0.0, 1.0);
  float scale = raidlandsCloudWorldSize * mix(0.035, 0.13, sizeFraction);
  vec2 position = worldPosition / max(scale, 1.0)
    + vec2(raidlandsCloudPhase * 0.0032, raidlandsCloudPhase * 0.00135);
  float field = 0.0;
  ${noiseLines}
  field /= ${totalWeight};
  float threshold = mix(0.82, 0.27, sqrt(coverage));
  float edge = mix(0.095, 0.028, clamp(raidlandsCloudSharpness, 0.0, 1.0));
  return smoothstep(threshold - edge, threshold + edge, field)
    * smoothstep(0.005, 0.04, coverage)
    * clamp(raidlandsCloudOpacity, 0.0, 1.0)
    * raidlandsCloudShadowStrength;
}`;
}

const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-server-map-viewer]"));

for (const root of roots) {
  applyInitialEnvironmentQuality(root);
  void initTerrainViewer(root).then((instance) => {
    if (instance) {
      bindLiveTerrainUpdates(root, instance);
    }
  });
}

function applyInitialEnvironmentQuality(root: HTMLElement): void {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(ENVIRONMENT_QUALITY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }
  root.dataset.environmentQuality = preferredEnvironmentQuality(
    stored,
    root.dataset.environmentQuality,
    window.matchMedia("(pointer: coarse)").matches,
    window.innerWidth,
  );
  root.dataset.monumentMode = preferredMonumentMode(root);
}

function persistEnvironmentQuality(quality: EnvironmentQuality): void {
  try {
    window.localStorage.setItem(ENVIRONMENT_QUALITY_STORAGE_KEY, quality);
  } catch {
    // The active page still keeps the selection when storage is unavailable.
  }
}

function preferredMonumentMode(root: HTMLElement): MonumentMode {
  try {
    const stored = window.localStorage.getItem(DETAILED_MONUMENTS_STORAGE_KEY);
    if (stored !== null) return parseMonumentMode(stored);
  } catch {
    // Use the page default when storage is unavailable.
  }
  return parseMonumentMode(root.dataset.monumentMode ?? root.dataset.detailedMonuments);
}

function persistMonumentMode(mode: MonumentMode): void {
  try {
    window.localStorage.setItem(DETAILED_MONUMENTS_STORAGE_KEY, mode);
  } catch {
    // The active viewer still keeps the setting when storage is unavailable.
  }
}

async function initTerrainViewer(root: HTMLElement): Promise<TerrainViewerInstance | null> {
  const terrainUrl = root.dataset.terrainUrl || "";
  const status = root.querySelector<HTMLElement>("[data-map-viewer-status]");

  if (!terrainUrl) {
    setStatus(status, "Terrain export pending.");
    return null;
  }

  try {
    const assetFingerprint = mapAssetFingerprint(root);
    const response = await fetch(versionMapAssetUrl(terrainUrl, assetFingerprint), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Terrain request failed with HTTP ${response.status}.`);
    }

    const terrain = normalizeTerrain(await response.json(), root);
    const viewer = new TerrainViewer(root, terrain, {
      textureUrl: versionMapAssetUrl(root.dataset.textureUrl || "", assetFingerprint),
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

  let instance: TerrainViewerInstance | null = initial;
  let pollTimer = 0;
  let polling = false;

  const replaceViewer = async (): Promise<void> => {
    const previous = instance;
    previous?.binding.dispose();
    previous?.viewer.dispose();
    instance = await initTerrainViewer(root);
  };

  const onQualityChange = (event: Event) => {
    const quality = parseEnvironmentQuality((event as CustomEvent<{ quality?: string }>).detail?.quality, root.dataset.environmentQuality as EnvironmentQuality);
    if (quality === root.dataset.environmentQuality) return;
    root.dataset.environmentQuality = quality;
    persistEnvironmentQuality(quality);
    setStatus(root.querySelector<HTMLElement>("[data-map-viewer-status]"), `Applying ${quality} detail.`);
    void replaceViewer();
  };
  root.addEventListener("raidlands:environment-quality", onQualityChange);

  if (!statusUrl) return;

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

      await replaceViewer();
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

function mapAssetFingerprint(root: HTMLElement): string {
  return root.dataset.terrainHash
    || root.dataset.seed
    || root.dataset.mapPublishedAt
    || "";
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
  const powerLines = normalizePowerLines(payload.powerLines, Math.max(100, worldSize));
  const roads = normalizeRoads(payload.roads, Math.max(100, worldSize));

  return {
    version: Number(payload.version) || 1,
    resolution,
    worldSize: Math.max(100, worldSize),
    seed: Number(payload.seed) || 0,
    waterLevel: Number.isFinite(Number(payload.waterLevel)) ? Number(payload.waterLevel) : undefined,
    minHeight: Number.isFinite(Number(payload.minHeight)) ? Number(payload.minHeight) : Math.min(...heights),
    maxHeight: Number.isFinite(Number(payload.maxHeight)) ? Number(payload.maxHeight) : Math.max(...heights),
    heights,
    colors,
    monuments,
    powerLines,
    roads,
  };
}

function normalizeMonuments(value: unknown, worldSize: number): MonumentPayload[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const coordinateLimit = offshoreCameraCoordinateLimit(worldSize);
  return value
    .map((entry): MonumentPayload | null => {
      const monument = entry && typeof entry === "object" ? (entry as Partial<MonumentPayload>) : {};
      const x = Number(monument.x);
      const y = Number(monument.y);
      const z = Number(monument.z);

      if (![x, y, z].every(Number.isFinite) || Math.abs(x) > coordinateLimit || Math.abs(z) > coordinateLimit) {
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
  private readonly cameraBounds: CameraBounds;
  private readonly textureUrl: string;
  private readonly status: HTMLElement | null;
  private readonly cloudDetail: RaidlandsCloudDetail;
  private readonly cloudProfile: RaidlandsCloudProfile;
  private readonly sunDetail: RaidlandsSunDetail;
  private readonly sunProfile: RaidlandsSunProfile;
  private readonly fogDetail: FogDetail;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(48, 1, 1, 12000);
  private readonly renderer = new WebGLRenderer({ antialias: true, alpha: false });
  private readonly composer: EffectComposer;
  private readonly qualityProfile: EnvironmentQualityProfile;
  private readonly antialiasPass: SMAAPass | null;
  private readonly bloomPass: UnrealBloomPass | null;
  private readonly ambientOcclusionPass: SSAOPass;
  private readonly volumetricFogPass: ShaderPass | null;
  private readonly environmentGradePass: ShaderPass;
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private floatingControls: HTMLElement | null = null;
  private readonly terrainMesh: Mesh;
  private readonly terrainMaterial: MeshStandardMaterial;
  private readonly oceanSurfaceMesh: Mesh;
  private readonly oceanFloorMesh: Mesh;
  private readonly oceanWaveTexture: CanvasTexture;
  private readonly aerialCloudLayer: Group;
  private readonly gridLayer = new Group();
  private readonly heatmapLayer = new Group();
  private readonly playerLocationLayer = new Group();
  private readonly overlayLayerTransitions: OverlayLayerTransition[] = [];
  private readonly airstrikeLayer = new Group();
  private readonly roadLayer = new Group();
  private readonly monumentLayer = new Group();
  private readonly powerLineLayer = new Group();
  private readonly vegetationLayer = new Group();
  private readonly weatherCloudLayer = new Group();
  private readonly groundFogLayer: Group;
  private readonly terrainHeightTexture: DataTexture | null;
  private readonly rainSheetLayer = new Group();
  private readonly rainLayer = new Group();
  private readonly rainSplashLayer: Group;
  private readonly rainMaterial: LineBasicMaterial;
  private readonly terrainLightUniforms = {
    sunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
    sunColor: { value: new Color(0xfff1cf) },
    twilight: { value: 0 },
    cloudAttenuation: { value: 0.25 },
    fogColor: { value: new Color(0xc8dfe8) },
    distantLift: { value: 0 },
    worldSize: { value: 4500 },
    cloudCoverage: { value: 0 },
    cloudOpacity: { value: 1 },
    cloudSize: { value: 3.35 },
    cloudSharpness: { value: 1 },
    cloudPhase: { value: 0 },
    cloudShadowStrength: { value: 0 },
    wetness: { value: 0 },
    waterLevel: { value: 0 },
    minHeight: { value: 0 },
    maxHeight: { value: 300 },
    time: { value: 0 },
  };
  private readonly waterLightUniforms = {
    sunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
    sunColor: { value: new Color(0xffc18c) },
    skyColor: { value: new Color(0x8bb5c5) },
    reflectionStrength: { value: 0 },
    daylight: { value: 1 },
    time: { value: 0 },
    fogColor: { value: new Color(0xc8dfe8) },
    fogDensity: { value: 0 },
    worldSize: { value: 4500 },
    cloudCoverage: { value: 0 },
    cloudOpacity: { value: 1 },
    cloudSize: { value: 3.35 },
    cloudSharpness: { value: 1 },
    cloudPhase: { value: 0 },
    cloudShadowStrength: { value: 0 },
    rainIntensity: { value: 0 },
    waterLevel: { value: 0 },
    terrainHeight: { value: null as DataTexture | null },
    hasTerrainHeight: { value: 0 },
    detail: { value: 1 },
  };
  private readonly aerialCloudUniforms = {
    coverage: { value: 0 },
    opacity: { value: 1 },
    size: { value: 3.35 },
    sharpness: { value: 1 },
    attenuation: { value: 0.25 },
    brightness: { value: 0.55 },
    coloring: { value: 0.65 },
    rain: { value: 0 },
    phase: { value: 0 },
    visibility: { value: 0 },
    worldSize: { value: 4500 },
    sunColor: { value: new Color(0xfff1cf) },
    ambientColor: { value: new Color(0xddeaf0) },
    sunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
  };
  private ambientLight: AmbientLight | null = null;
  private sunLight: DirectionalLight | null = null;
  private fillLight: DirectionalLight | null = null;
  private lightningLight: PointLight | null = null;
  private activeEnvironment: NormalizedEnvironment | null = null;
  private targetEnvironment: NormalizedEnvironment | null = null;
  private environmentBlendStartedAt = 0;
  private environmentBlendDuration = 900;
  private sunMotion: RaidlandsSunMotion | null = null;
  private sunMotionBaseDirection = new Vector3(0.5, 0.78, 0.36).normalize();
  private sunMotionBaseAt = 0;
  private airstrikeReplay: AirstrikeReplayPlayer | null = null;
  private latestReplayEvents: MapReplayEvent[] = [];
  private latestReplaySpeed = 1;
  private latestReplayOptions: ReplayDisplayOptions = {};
  private readonly onResize = () => this.resize();
  private readonly onFullscreenChange = () => {
    const button = this.floatingControls?.querySelector<HTMLButtonElement>("[data-map-native-fullscreen]");
    const enabled = document.fullscreenElement === this.root;
    button?.setAttribute("aria-pressed", String(enabled));
    if (button) button.title = enabled ? "Exit fullscreen" : "Enter fullscreen";
    this.resize();
  };
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleFlightKey(event, true);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleFlightKey(event, false);
  private readonly onWindowBlur = () => this.pressedFlightKeys.clear();
  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointerDownAt = { x: event.clientX, y: event.clientY };
    if (this.cameraMode === "manual" && this.manualCameraStyle === "fly" && (event.button === 0 || event.button === 2)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.flightLookButtons.add(event.button);
      if (document.pointerLockElement !== this.renderer.domElement) {
        const lockRequest = this.renderer.domElement.requestPointerLock();
        if (lockRequest) {
          void lockRequest.catch(() => {
            this.pointerDownAt = null;
          });
        }
      }
    }
  };
  private readonly onPointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement === this.renderer.domElement) return;
    if (this.cameraMode === "manual" && this.manualCameraStyle === "fly" && this.pointerDownAt && event.buttons !== 0) {
      this.pointerLookDelta.x += event.movementX * 0.035;
      this.pointerLookDelta.y += event.movementY * 0.035;
      this.pauseAutomaticCamera();
    }
  };
  private readonly onLockedMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.pointerLookDelta.x += event.movementX * 0.035;
    this.pointerLookDelta.y += event.movementY * 0.035;
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    this.flightLookButtons.delete(event.button);
    if (document.pointerLockElement === this.renderer.domElement && (event.button === 0 || event.button === 2)) {
      document.exitPointerLock();
    }
    this.handleTargetPointer(event);
  };
  private readonly onLockedMouseUp = (event: MouseEvent) => {
    this.flightLookButtons.delete(event.button);
    if (document.pointerLockElement === this.renderer.domElement && (event.button === 0 || event.button === 2)) {
      document.exitPointerLock();
    }
  };
  private readonly onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.root.dataset.flightPointerLocked = String(locked);
    if (locked && this.flightLookButtons.size === 0) {
      document.exitPointerLock();
      return;
    }
    if (!locked) {
      this.pointerDownAt = null;
      this.flightLookButtons.clear();
    }
  };
  private readonly onContextMenu = (event: MouseEvent) => {
    if (this.cameraMode === "manual" && this.manualCameraStyle === "fly") event.preventDefault();
  };
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
  private cameraMode: CameraMode = "director";
  private manualCameraStyle: ManualCameraStyle = "orbit";
  private automaticPausedUntil = 0;
  private readonly pressedFlightKeys = new Set<string>();
  private lastAnimationTick = performance.now();
  private pointerDownAt: { x: number; y: number } | null = null;
  private readonly flightLookButtons = new Set<number>();
  private mobileMove = new Vector2();
  private mobileLook = new Vector2();
  private pointerLookDelta = new Vector2();
  private mobileRise = 0;
  private browserFillParent: ParentNode | null = null;
  private browserFillNextSibling: ChildNode | null = null;
  private readonly tourStyle: CameraTourStyle;
  private readonly actionHighlights = new Map<ActionHighlightSource, ActionHighlightFocus>();
  private actionTourStartedAt = performance.now();
  private directorShot: DirectorShotRuntime | null = null;
  private directorShotSequence = 0;
  private directorLastHeroSequence = -100;
  private readonly directorRecentShotIds: string[] = [];
  private readonly directorFeatures: DirectorLandscapeFeature[];
  private directorFps: DirectorFpsState = { smoothedFps: 60, tier: "healthy" };
  private readonly lockCameraInput: boolean;
  private monumentMode: MonumentMode = "auto";
  private readonly monumentModels: MonumentModelController;
  private readonly treeModels: TreeModelController;
  private transitionFrom: CameraPose | null = null;
  private transitionTo: CameraPose | null = null;
  private transitionFinal: CameraPose | null = null;
  private transitionStartedAt = 0;
  private transitionDuration = 1400;
  private selfLocation: PlayerLocation | null = null;
  private selfLocationOrbitEnabled = false;
  private selfLocationOrbitStartedAt = performance.now();
  private wetness = 0;
  private lastWeatherTick = performance.now();
  private disposed = false;

  public constructor(
    root: HTMLElement,
    terrain: TerrainPayload,
    options: { textureUrl: string; status: HTMLElement | null },
  ) {
    this.root = root;
    this.terrain = terrain;
    this.cameraBounds = resolveCameraBounds(
      this.terrain.worldSize || 4500,
      (this.terrain.monuments || []).map((monument) => ({
        x: -monument.x,
        z: monument.z,
        radius: monument.radius,
      })),
    );
    this.directorFeatures = buildDirectorLandscapeFeatures(this.terrain);
    this.root.dataset.cameraBounds = [
      this.cameraBounds.minX,
      this.cameraBounds.maxX,
      this.cameraBounds.minZ,
      this.cameraBounds.maxZ,
    ].map((value) => String(Math.round(value))).join(",");
    this.textureUrl = options.textureUrl;
    this.status = options.status;
    const capabilities = fogCapabilities(this.renderer);
    this.qualityProfile = resolveEnvironmentQuality(
      parseEnvironmentQuality(this.root.dataset.environmentQuality, "ultra"),
      capabilities,
    );
    this.root.dataset.environmentQualityRequested = this.qualityProfile.requested;
    this.root.dataset.environmentQualityResolved = this.qualityProfile.resolved;
    this.root.dataset.environmentCapabilities = [
      capabilities.webgl2 ? "webgl2" : "webgl1",
      capabilities.depthTexture ? "depth" : "no-depth",
      capabilities.floatTexture ? "float" : "no-float",
      capabilities.highPrecisionFragment ? "highp" : "mediump",
    ].join(" ");
    this.cloudDetail = parseRaidlandsCloudDetail(this.qualityProfile.cloudDetail, "max");
    this.cloudProfile = raidlandsCloudProfile(this.cloudDetail);
    this.root.dataset.cloudDetailResolved = this.cloudDetail;
    this.sunDetail = parseRaidlandsSunDetail(this.qualityProfile.sunDetail, "max");
    this.sunProfile = raidlandsSunProfile(this.sunDetail);
    this.root.dataset.sunDetailResolved = this.sunDetail;
    this.monumentMode = parseMonumentMode(this.root.dataset.monumentMode);
    this.monumentModels = new MonumentModelController({
      assetBase: this.root.dataset.assetBase || new URL(/* @vite-ignore */ "../../", import.meta.url).href,
      camera: this.camera,
      policy: resolveMonumentQuality(this.monumentMode, this.qualityProfile.resolved, monumentModelThresholds()),
      root: this.root,
    });
    this.tourEnabled = this.root.dataset.cameraTour === "true";
    this.tourStyle = this.root.dataset.cameraTourStyle === "orbit" ? "orbit" : "cinematic";
    this.lockCameraInput = this.root.dataset.cameraLocked === "true";
    this.cameraMode = this.lockCameraInput
      ? (this.tourStyle === "orbit" ? "orbit" : "cinematic")
      : parseCameraMode(this.root.dataset.cameraMode, this.tourEnabled ? "director" : "manual");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.qualityProfile.pixelRatioCap));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.qualityProfile.resolved === "ultra" || this.qualityProfile.resolved === "high";
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.fogDetail = resolveFogDetail(parseFogDetail(this.qualityProfile.fogDetail, "max"), capabilities);
    this.root.dataset.fogDetailResolved = this.fogDetail;
    applyRaidlandsEnvironment(this.scene, this.renderer, {
      preset: "terrain",
      exposure: 1.16,
      backgroundIntensity: 1.02,
      environmentIntensity: 0.98,
      cloudDetail: this.cloudDetail,
      sunDetail: this.sunDetail,
      worldSize: this.terrain.worldSize || 4500,
    });
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), this.qualityProfile.composerPixelRatioCap));
    this.ambientOcclusionPass = new SSAOPass(this.scene, this.camera, 1, 1, 24);
    this.ambientOcclusionPass.kernelRadius = this.qualityProfile.ambientOcclusionRadius;
    this.ambientOcclusionPass.minDistance = 0.0005;
    this.ambientOcclusionPass.maxDistance = 0.009;
    const renderAmbientOcclusion = this.ambientOcclusionPass.render.bind(this.ambientOcclusionPass);
    this.ambientOcclusionPass.render = ((...args: Parameters<SSAOPass["render"]>) => {
      const visibleSprites: Sprite[] = [];
      this.scene.traverse((object) => {
        if (object instanceof Sprite && object.visible) {
          visibleSprites.push(object);
          object.visible = false;
        }
      });
      try {
        renderAmbientOcclusion(...args);
      } finally {
        visibleSprites.forEach((sprite) => {
          sprite.visible = true;
        });
      }
    }) as SSAOPass["render"];
    this.environmentGradePass = new ShaderPass(RAIDLANDS_ENVIRONMENT_GRADE_SHADER);
    this.terrainHeightTexture = this.fogDetail === "low" ? null : createTerrainHeightTexture(this.terrain);
    this.volumetricFogPass = this.fogDetail === "low" ? null : new ShaderPass(RAIDLANDS_VOLUMETRIC_FOG_SHADER);
    if (this.volumetricFogPass && this.terrainHeightTexture) {
      // SSAO renders this dedicated normal/depth target immediately before the
      // fog pass. Unlike the composer's ping-pong targets, it is never also the
      // fog pass output, so sampling it cannot create a WebGL feedback loop.
      this.volumetricFogPass.uniforms.tDepth.value = this.ambientOcclusionPass.normalRenderTarget.depthTexture;
      this.volumetricFogPass.uniforms.tTerrainHeight.value = this.terrainHeightTexture;
      this.volumetricFogPass.uniforms.uSampleCount.value = fogRayMarchSamples(this.fogDetail);
      this.volumetricFogPass.uniforms.uMaxDetail.value = this.fogDetail === "max" ? 1 : 0;
    }
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.ambientOcclusionPass);
    if (this.volumetricFogPass) this.composer.addPass(this.volumetricFogPass);
    this.composer.addPass(this.environmentGradePass);
    this.bloomPass = this.qualityProfile.bloom
      ? new UnrealBloomPass(
        new Vector2(1, 1),
        this.qualityProfile.bloomStrength,
        this.qualityProfile.bloomRadius,
        this.qualityProfile.bloomThreshold,
      )
      : null;
    if (this.bloomPass) this.composer.addPass(this.bloomPass);
    this.antialiasPass = this.qualityProfile.stableAntialiasing
      ? new SMAAPass(1, 1)
      : null;
    if (this.antialiasPass) this.composer.addPass(this.antialiasPass);
    this.renderer.domElement.dataset.serverMapViewerCanvas = "true";
    this.terrainMaterial = this.createTerrainMaterial();
    this.oceanFloorMesh = this.createOceanFloorMesh();
    this.scene.add(this.oceanFloorMesh);
    this.terrainMesh = this.createTerrainMesh();
    this.scene.add(this.terrainMesh);
    this.vegetationLayer.name = "raidlands-terrain-vegetation";
    const vegetation = createTerrainVegetation(this.terrain, this.qualityProfile.resolved);
    this.vegetationLayer.add(vegetation);
    this.root.dataset.vegetationInstances = String(vegetation.userData.instanceCount || 0);
    this.scene.add(this.vegetationLayer);
    this.treeModels = new TreeModelController({
      assetBase: this.root.dataset.assetBase || new URL(/* @vite-ignore */ "../../", import.meta.url).href,
      camera: this.camera,
      quality: this.qualityProfile.resolved,
      placements: vegetation.userData.placements as VegetationPlacement[],
      fallback: vegetation,
      parent: this.vegetationLayer,
      root: this.root,
      dracoDecoderUrl: DRACO_DECODER_URL,
    });
    this.terrainLightUniforms.waterLevel.value = resolveOceanWaterLevel(this.terrain);
    this.terrainLightUniforms.minHeight.value = Number(this.terrain.minHeight) || 0;
    this.terrainLightUniforms.maxHeight.value = Number(this.terrain.maxHeight) || 300;
    this.waterLightUniforms.waterLevel.value = resolveOceanWaterLevel(this.terrain);
    this.waterLightUniforms.terrainHeight.value = this.terrainHeightTexture;
    this.waterLightUniforms.hasTerrainHeight.value = this.terrainHeightTexture ? 1 : 0;
    this.waterLightUniforms.detail.value = this.qualityProfile.waterDetail;
    this.oceanWaveTexture = createOceanWaveTexture();
    this.oceanSurfaceMesh = this.createOceanSurfaceMesh();
    this.scene.add(this.oceanSurfaceMesh);
    this.aerialCloudLayer = this.createAerialCloudLayer();
    this.scene.add(this.aerialCloudLayer);
    this.groundFogLayer = createGroundFogBanks(this.terrain);
    this.groundFogLayer.visible = false;
    this.scene.add(this.groundFogLayer);
    this.weatherCloudLayer.name = "raidlands-floating-weather-clouds";
    this.weatherCloudLayer.add(createFloatingWeatherClouds(this.terrain));
    this.weatherCloudLayer.visible = false;
    this.scene.add(this.weatherCloudLayer);
    this.rainSheetLayer.name = "raidlands-rain-sheet-layer";
    this.rainSheetLayer.add(createRainSheets(this.terrain, this.qualityProfile.rainDetail));
    this.rainSheetLayer.visible = false;
    this.scene.add(this.rainSheetLayer);
    this.rainMaterial = new LineBasicMaterial({
      color: 0xb7d4e6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
    });
    this.rainLayer.name = "raidlands-rain-streaks";
    this.rainLayer.add(createRainStreaks(this.terrain, this.rainMaterial, this.qualityProfile.rainDetail));
    this.rainLayer.visible = false;
    this.scene.add(this.rainLayer);
    this.rainSplashLayer = createRainSplashes(this.terrain, this.qualityProfile.rainDetail);
    this.rainSplashLayer.visible = false;
    this.scene.add(this.rainSplashLayer);
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
    this.addRoads();
    this.addMonuments();
    this.addPowerLines();
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
    this.controls.maxDistance = Math.max(1600, this.cameraFrameSize() * 1.4);
    (this.controls as OrbitControls & { zoomToCursor?: boolean }).zoomToCursor = true;
    this.controls.addEventListener("start", () => this.pauseAutomaticCamera());
  }

  public mount(): void {
    this.root.appendChild(this.renderer.domElement);
    this.applyCameraPose(this.isoPose(false));
    if (this.tourEnabled) {
      this.startNextTour(performance.now(), true);
    }
    this.bindFloatingViewSelect();
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown, true);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("mouseup", this.onLockedMouseUp);
    document.addEventListener("mousemove", this.onLockedMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.animate();
    this.loadTexture();
    this.root.classList.add("is-loaded");
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown, true);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("mouseup", this.onLockedMouseUp);
    document.removeEventListener("mousemove", this.onLockedMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.setBrowserFill(false);
    this.monumentModels.dispose();
    this.treeModels.dispose();
    this.controls.dispose();
    this.floatingControls?.remove();
    this.floatingControls = null;
    this.antialiasPass?.dispose();
    this.ambientOcclusionPass.dispose();
    this.volumetricFogPass?.dispose();
    this.environmentGradePass.dispose();
    this.bloomPass?.dispose();
    this.terrainHeightTexture?.dispose();
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

  public getMonumentMode(): MonumentMode {
    return this.monumentMode;
  }

  public setMonumentMode(mode: MonumentMode): void {
    this.monumentMode = mode;
    this.root.dataset.monumentMode = mode;
    this.monumentModels.setPolicy(resolveMonumentQuality(mode, this.qualityProfile.resolved, monumentModelThresholds()));
    this.root.closest<HTMLElement>(".server-terrain-panel")
      ?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-map-detailed-monuments]")
      .forEach((control) => {
        if (control instanceof HTMLInputElement) {
          control.checked = mode !== "primitives";
        } else {
          control.value = mode;
        }
      });
  }

  public setTourEnabled(enabled: boolean): void {
    this.setCameraMode(enabled ? "director" : "manual");
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.root.dataset.cameraModeActive = mode;
    this.tourEnabled = mode !== "manual" && mode !== "top";
    const interactive = !this.lockCameraInput;
    this.controls.enabled = interactive;
    this.controls.enableRotate = interactive && !(mode === "manual" && this.manualCameraStyle === "fly");
    this.controls.enablePan = interactive && !(mode === "manual" && this.manualCameraStyle === "fly");
    this.controls.enableZoom = interactive;
    this.focusUntil = 0;
    this.automaticPausedUntil = 0;
    this.transitionFrom = null;
    this.transitionTo = null;
    this.directorShot = null;
    this.activePose = this.currentPose();
    if (mode === "top") {
      this.focusCamera(this.topPose());
      return;
    }
    if (mode === "orbit" || mode === "cinematic" || mode === "director") {
      this.startNextTour(performance.now(), true);
    }
  }

  public getCameraMode(): CameraMode { return this.cameraMode; }

  public setManualCameraStyle(style: ManualCameraStyle): void {
    this.manualCameraStyle = style;
    this.root.dataset.manualCameraStyle = style;
    if (this.cameraMode === "manual") this.setCameraMode("manual");
  }

  public setMobileFlightInput(moveX: number, moveY: number, lookX: number, lookY: number, rise: number): void {
    this.mobileMove.set(moveX, moveY);
    this.mobileLook.set(lookX, lookY);
    this.mobileRise = rise;
    if (Math.abs(moveX) + Math.abs(moveY) + Math.abs(lookX) + Math.abs(lookY) + Math.abs(rise) > 0.01) {
      this.pauseAutomaticCamera();
    }
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
        alphaMap: texture,
        color,
        transparent: true,
        alphaTest: 0.01,
        opacity: MathUtils.lerp(0.18, 0.64, normalized),
        depthWrite: false,
        depthTest: true,
        fog: false,
        blending: AdditiveBlending,
        side: DoubleSide,
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
    const previousSignature = replayDirectorSignature(this.latestReplayEvents);
    this.latestReplayEvents = events;
    this.latestReplaySpeed = playbackSpeed;
    this.latestReplayOptions = options;
    this.airstrikeReplay?.showEvents(events, playbackSpeed, options);
    if (previousSignature !== replayDirectorSignature(events) && isDirectorMode(this.cameraMode)) {
      this.directorShot = null;
    }
  }

  public clearReplayEvents(): void {
    this.latestReplayEvents = [];
    this.latestReplaySpeed = 1;
    this.latestReplayOptions = {};
    this.airstrikeReplay?.clear();
    if (isDirectorMode(this.cameraMode)) this.directorShot = null;
  }

  public frameIso(cycle = true): void {
    this.focusCamera(this.isoPose(cycle));
  }

  private isoPose(cycle = true): CameraPose {
    const size = this.cameraFrameSize();
    const center = this.cameraFrameCenter();
    const height = Math.max(220, (this.terrain.maxHeight || 220) - Math.min(this.terrain.minHeight || 0, 0));
    if (cycle) {
      this.isoViewIndex = (this.isoViewIndex + 1) % isoViewDirections.length;
    } else {
      this.isoViewIndex = 0;
    }
    const direction = isoViewDirections[this.isoViewIndex] || isoViewDirections[0]!;
    return {
      position: new Vector3(center.x + size * direction.x, size * direction.y, center.z + size * direction.z),
      target: new Vector3(center.x, height * 0.22, center.z),
      up: new Vector3(0, 1, 0),
    };
  }

  public frameTop(): void {
    this.focusCamera(this.topPose());
  }

  public navigationMonuments(): MonumentPayload[] {
    return [...(this.terrain.monuments || [])];
  }

  public focusWorldPoint(x: number, y: number, z: number, label: string, radius = 90): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const point = rustWorldToViewerPosition(x, Number.isFinite(y) ? y : 0, z);
    const ground = Math.max(point.y, sampleTerrainHeight(this.terrain, point.x, point.z));
    const distance = MathUtils.clamp(Math.max(radius * 3.2, (this.terrain.worldSize || 4500) * 0.055), 210, 900);
    this.setCameraMode("manual");
    this.focusCamera({
      position: new Vector3(point.x - distance * 0.62, ground + distance * 0.72, point.z + distance * 0.78),
      target: new Vector3(point.x, ground + MathUtils.clamp(radius * 0.18, 18, 90), point.z),
      up: new Vector3(0, 1, 0),
    });
    this.root.dataset.cameraTarget = label;
    this.root.dispatchEvent(new CustomEvent("raidlands:camera-target", { detail: { label } }));
    return true;
  }

  public focusMonument(monument: MonumentPayload): boolean {
    this.monumentModels.focus(monument);
    return this.focusWorldPoint(monument.x, monument.y, monument.z, monument.name || "Monument", monument.radius || 90);
  }

  public focusPreset(key: string): void {
    const size = this.cameraFrameSize();
    const center = this.cameraFrameCenter();
    const height = Math.max(180, this.terrain.maxHeight || 220);
    const poses: Record<string, CameraPose> = {
      overview: this.isoPose(false),
      top: this.topPose(),
      north: { position: new Vector3(center.x, size * .42, center.z + size * .72), target: new Vector3(center.x, height * .18, center.z), up: new Vector3(0, 1, 0) },
      south: { position: new Vector3(center.x, size * .42, center.z - size * .72), target: new Vector3(center.x, height * .18, center.z), up: new Vector3(0, 1, 0) },
      east: { position: new Vector3(center.x - size * .72, size * .42, center.z), target: new Vector3(center.x, height * .18, center.z), up: new Vector3(0, 1, 0) },
      west: { position: new Vector3(center.x + size * .72, size * .42, center.z), target: new Vector3(center.x, height * .18, center.z), up: new Vector3(0, 1, 0) },
    };
    const pose = poses[key] || poses.overview!;
    this.setCameraMode(key === "top" ? "top" : "manual");
    this.focusCamera(pose);
    const label = key === "top" ? "Top down" : key.charAt(0).toUpperCase() + key.slice(1);
    this.root.dispatchEvent(new CustomEvent("raidlands:camera-target", { detail: { label } }));
  }

  private topPose(): CameraPose {
    const size = this.cameraFrameSize();
    const center = this.cameraFrameCenter();
    return {
      position: new Vector3(center.x, size * 0.86, center.z + 0.001),
      target: new Vector3(center.x, 0, center.z),
      up: new Vector3(0, 0, 1),
    };
  }

  private cameraFrameCenter(): Vector3 {
    return new Vector3(
      (this.cameraBounds.minX + this.cameraBounds.maxX) * 0.5,
      0,
      (this.cameraBounds.minZ + this.cameraBounds.maxZ) * 0.5,
    );
  }

  private cameraFrameSize(): number {
    return Math.max(
      this.terrain.worldSize || 4500,
      this.cameraBounds.maxX - this.cameraBounds.minX,
      this.cameraBounds.maxZ - this.cameraBounds.minZ,
    );
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
    controls.setAttribute("aria-label", "Map view and detail");
    const requested = this.qualityProfile.requested;
    const resolved = this.qualityProfile.resolved;
    const resolvedNote = requested === resolved ? "" : `<small>${resolved} available</small>`;
    controls.innerHTML = `
      <div class="server-terrain-view-buttons" role="group" aria-label="Map view">
        <button type="button" data-map-view="iso" aria-pressed="true" aria-label="Home view" title="Home view">
          <span aria-hidden="true">Home</span>
        </button>
        <button type="button" data-map-browser-fill aria-pressed="false" aria-label="Fill browser viewport" title="Fill browser viewport">
          <span aria-hidden="true">Fill</span>
        </button>
        <button type="button" data-map-native-fullscreen aria-pressed="false" aria-label="Enter fullscreen" title="Enter fullscreen">
          <span aria-hidden="true">Full</span>
        </button>
        <button type="button" data-map-view="top" aria-pressed="false" aria-label="Top view" title="Top view">
          <span aria-hidden="true">Top</span>
        </button>
      </div>
      <label class="server-terrain-detail-select">
        <span>Detail</span>
        <select data-map-environment-quality aria-label="Viewer detail level">
          <option value="low"${requested === "low" ? " selected" : ""}>Low</option>
          <option value="medium"${requested === "medium" ? " selected" : ""}>Medium</option>
          <option value="high"${requested === "high" ? " selected" : ""}>High</option>
          <option value="ultra"${requested === "ultra" ? " selected" : ""}>Ultra</option>
        </select>
        ${resolvedNote}
      </label>
      <label class="server-terrain-detail-select server-terrain-monument-select">
        <span>Monuments</span>
        <select data-map-detailed-monuments aria-label="Monument model detail">
          <option value="auto"${this.monumentMode === "auto" ? " selected" : ""}>Auto</option>
          <option value="primitives"${this.monumentMode === "primitives" ? " selected" : ""}>Map LOD</option>
          <option value="detailed"${this.monumentMode === "detailed" ? " selected" : ""}>Detailed</option>
        </select>
      </label>
      ${this.root.dataset.cameraProfile === "full" ? `
        <div class="server-map-flight-controls" data-map-flight-controls aria-label="Mobile flight controls">
          <div class="server-map-flight-stick" data-map-flight-move><span>Move</span><i></i></div>
          <div class="server-map-flight-altitude">
            <button type="button" data-map-flight-rise aria-label="Fly upward">+</button>
            <button type="button" data-map-flight-fall aria-label="Fly downward">−</button>
          </div>
          <div class="server-map-flight-stick" data-map-flight-look><span>Look</span><i></i></div>
        </div>` : ""}
    `;
    this.root.appendChild(controls);
    this.floatingControls = controls;
    bindMapViewButtons(Array.from(controls.querySelectorAll<HTMLButtonElement>("[data-map-view]")), this);
    const fillButton = controls.querySelector<HTMLButtonElement>("[data-map-browser-fill]");
    const fullscreenButton = controls.querySelector<HTMLButtonElement>("[data-map-native-fullscreen]");
    const monumentsSelect = controls.querySelector<HTMLSelectElement>("[data-map-detailed-monuments]");
    monumentsSelect?.addEventListener("change", () => {
      const mode = parseMonumentMode(monumentsSelect.value);
      persistMonumentMode(mode);
      this.setMonumentMode(mode);
    });
    // Heal the old persisted lockout state, but keep the other camera choices.
    const stored = parseCameraPreferences(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY));
    window.localStorage.setItem(CAMERA_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...stored, browserFill: false }));
    this.setBrowserFill(false);
    fillButton?.addEventListener("click", () => {
      this.setBrowserFill(!this.root.classList.contains("is-browser-fill"));
    });
    if (!this.root.requestFullscreen) {
      if (fullscreenButton) fullscreenButton.disabled = true;
      fullscreenButton?.setAttribute("title", "Fullscreen is not supported by this browser");
    } else {
      fullscreenButton?.addEventListener("click", () => {
        const request = document.fullscreenElement === this.root
          ? document.exitFullscreen()
          : this.root.requestFullscreen();
        void request.catch(() => setStatus(this.status, "Fullscreen could not be opened by this browser."));
      });
    }
    const moveStick = controls.querySelector<HTMLElement>("[data-map-flight-move]");
    const lookStick = controls.querySelector<HTMLElement>("[data-map-flight-look]");
    let move = new Vector2();
    let look = new Vector2();
    let rise = 0;
    const syncFlight = () => this.setMobileFlightInput(move.x, move.y, look.x, look.y, rise);
    const bindStick = (stick: HTMLElement | null, output: Vector2) => {
      if (!stick) return;
      const knob = stick.querySelector<HTMLElement>("i");
      const update = (event: PointerEvent) => {
        const rect = stick.getBoundingClientRect();
        output.set(
          MathUtils.clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.38), -1, 1),
          MathUtils.clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.38), -1, 1),
        );
        if (knob) knob.style.transform = `translate(${output.x * 20}px, ${output.y * 20}px)`;
        syncFlight();
      };
      stick.addEventListener("pointerdown", (event) => {
        stick.setPointerCapture(event.pointerId);
        update(event);
      });
      stick.addEventListener("pointermove", (event) => {
        if (stick.hasPointerCapture(event.pointerId)) update(event);
      });
      const reset = (event: PointerEvent) => {
        if (stick.hasPointerCapture(event.pointerId)) stick.releasePointerCapture(event.pointerId);
        output.set(0, 0);
        if (knob) knob.style.transform = "translate(0, 0)";
        syncFlight();
      };
      stick.addEventListener("pointerup", reset);
      stick.addEventListener("pointercancel", reset);
    };
    bindStick(moveStick, move);
    bindStick(lookStick, look);
    const bindAltitude = (button: HTMLButtonElement | null, value: number) => {
      if (!button) return;
      button.addEventListener("pointerdown", (event) => {
        button.setPointerCapture(event.pointerId);
        rise = value;
        syncFlight();
      });
      const reset = () => { rise = 0; syncFlight(); };
      button.addEventListener("pointerup", reset);
      button.addEventListener("pointercancel", reset);
    };
    bindAltitude(controls.querySelector("[data-map-flight-rise]"), 1);
    bindAltitude(controls.querySelector("[data-map-flight-fall]"), -1);
    controls.querySelector<HTMLSelectElement>("[data-map-environment-quality]")?.addEventListener("change", (event) => {
      const quality = parseEnvironmentQuality((event.currentTarget as HTMLSelectElement).value, requested);
      this.root.dispatchEvent(new CustomEvent("raidlands:environment-quality", {
        detail: { quality },
      }));
    });
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
    mesh.receiveShadow = this.renderer.shadowMap.enabled;
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
      shader.uniforms.raidlandsFogColor = this.terrainLightUniforms.fogColor;
      shader.uniforms.raidlandsDistantLift = this.terrainLightUniforms.distantLift;
      shader.uniforms.raidlandsWorldSize = this.terrainLightUniforms.worldSize;
      shader.uniforms.raidlandsCloudCoverage = this.terrainLightUniforms.cloudCoverage;
      shader.uniforms.raidlandsCloudOpacity = this.terrainLightUniforms.cloudOpacity;
      shader.uniforms.raidlandsCloudSize = this.terrainLightUniforms.cloudSize;
      shader.uniforms.raidlandsCloudSharpness = this.terrainLightUniforms.cloudSharpness;
      shader.uniforms.raidlandsCloudPhase = this.terrainLightUniforms.cloudPhase;
      shader.uniforms.raidlandsCloudShadowStrength = this.terrainLightUniforms.cloudShadowStrength;
      shader.uniforms.raidlandsCloudWorldSize = this.terrainLightUniforms.worldSize;
      shader.uniforms.raidlandsTerrainWetness = this.terrainLightUniforms.wetness;
      shader.uniforms.raidlandsTerrainWaterLevel = this.terrainLightUniforms.waterLevel;
      shader.uniforms.raidlandsTerrainMinHeight = this.terrainLightUniforms.minHeight;
      shader.uniforms.raidlandsTerrainMaxHeight = this.terrainLightUniforms.maxHeight;
      shader.uniforms.raidlandsTerrainTime = this.terrainLightUniforms.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 raidlandsTerrainWorldPosition;`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
raidlandsTerrainWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec3 raidlandsSunDirection;
uniform vec3 raidlandsSunColor;
uniform float raidlandsTwilight;
uniform float raidlandsCloudAttenuation;
uniform vec3 raidlandsFogColor;
uniform float raidlandsDistantLift;
uniform float raidlandsWorldSize;
uniform float raidlandsTerrainWetness;
uniform float raidlandsTerrainWaterLevel;
uniform float raidlandsTerrainMinHeight;
uniform float raidlandsTerrainMaxHeight;
uniform float raidlandsTerrainTime;
varying vec3 raidlandsTerrainWorldPosition;
${cloudShadowShaderSource(this.cloudProfile.shadowOctaves)}`,
        )
        .replace(
          "#include <normal_fragment_begin>",
          `#include <normal_fragment_begin>
vec3 raidlandsSunDirectionView = normalize((viewMatrix * vec4(raidlandsSunDirection, 0.0)).xyz);
float raidlandsSunFacing = max(dot(normal, raidlandsSunDirectionView), 0.0);
float raidlandsWarmSlope = raidlandsTwilight * (0.18 + raidlandsSunFacing * 0.82) * (1.0 - raidlandsCloudAttenuation * 0.58);
float raidlandsCloudShadow = raidlandsCloudShadowAt(raidlandsTerrainWorldPosition.xz);
vec3 raidlandsTerrainDx = dFdx(raidlandsTerrainWorldPosition);
vec3 raidlandsTerrainDy = dFdy(raidlandsTerrainWorldPosition);
vec3 raidlandsTerrainWorldNormal = normalize(cross(raidlandsTerrainDx, raidlandsTerrainDy));
if (raidlandsTerrainWorldNormal.y < 0.0) raidlandsTerrainWorldNormal *= -1.0;
float raidlandsTerrainSlope = 1.0 - clamp(raidlandsTerrainWorldNormal.y, 0.0, 1.0);
float raidlandsTerrainHeightRange = max(1.0, raidlandsTerrainMaxHeight - raidlandsTerrainMinHeight);
float raidlandsTerrainHeight = clamp((raidlandsTerrainWorldPosition.y - raidlandsTerrainMinHeight) / raidlandsTerrainHeightRange, 0.0, 1.0);
float raidlandsTerrainMicro = sin(raidlandsTerrainWorldPosition.x * 0.31 + raidlandsTerrainTime * 0.006)
  * cos(raidlandsTerrainWorldPosition.z * 0.27 - raidlandsTerrainTime * 0.004);
float raidlandsTerrainMacro = sin(raidlandsTerrainWorldPosition.x * 0.018) * cos(raidlandsTerrainWorldPosition.z * 0.021);
float raidlandsShoreContact = 1.0 - smoothstep(1.5, 11.0, abs(raidlandsTerrainWorldPosition.y - raidlandsTerrainWaterLevel));
float raidlandsWetSurface = raidlandsTerrainWetness * (1.0 - raidlandsTerrainSlope * 0.42);
diffuseColor.rgb *= 1.0 - raidlandsCloudShadow * 0.34;
diffuseColor.rgb *= mix(0.86, 1.06, raidlandsTerrainHeight * 0.35 + raidlandsTerrainSlope * 0.42);
diffuseColor.rgb *= 1.0 + raidlandsTerrainMicro * 0.018 + raidlandsTerrainMacro * 0.025;
diffuseColor.rgb *= 1.0 - raidlandsShoreContact * 0.1;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.69, 0.76, 0.78), raidlandsWetSurface * 0.48);
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.0) + raidlandsSunColor * 0.22, raidlandsWarmSlope);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
vec3 raidlandsRoughDx = dFdx(raidlandsTerrainWorldPosition);
vec3 raidlandsRoughDy = dFdy(raidlandsTerrainWorldPosition);
vec3 raidlandsRoughNormal = normalize(cross(raidlandsRoughDx, raidlandsRoughDy));
float raidlandsRoughSlope = 1.0 - abs(raidlandsRoughNormal.y);
float raidlandsRoughMicro = sin(raidlandsTerrainWorldPosition.x * 0.31) * cos(raidlandsTerrainWorldPosition.z * 0.27);
float raidlandsWetRoughness = raidlandsTerrainWetness * (1.0 - raidlandsRoughSlope * 0.5);
roughnessFactor = clamp(roughnessFactor - raidlandsWetRoughness * 0.38 + abs(raidlandsRoughMicro) * 0.035, 0.28, 1.0);`,
        )
        .replace(
          "#include <opaque_fragment>",
          `float raidlandsTerrainDistance = length(vViewPosition);
float raidlandsTerrainHorizon = smoothstep(raidlandsWorldSize * 0.3, raidlandsWorldSize * 1.08, raidlandsTerrainDistance);
outgoingLight = mix(outgoingLight, raidlandsFogColor, raidlandsTerrainHorizon * raidlandsDistantLift);
#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => `raidlands-terrain-ultra-${this.qualityProfile.resolved}-${this.cloudDetail}-v4`;
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
      fog: false,
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
      opacity: 0.68,
      map: this.oceanWaveTexture,
      fog: false,
      side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.raidlandsWaterSunDirection = this.waterLightUniforms.sunDirection;
      shader.uniforms.raidlandsWaterSunColor = this.waterLightUniforms.sunColor;
      shader.uniforms.raidlandsWaterSkyColor = this.waterLightUniforms.skyColor;
      shader.uniforms.raidlandsWaterReflectionStrength = this.waterLightUniforms.reflectionStrength;
      shader.uniforms.raidlandsWaterDaylight = this.waterLightUniforms.daylight;
      shader.uniforms.raidlandsWaterTime = this.waterLightUniforms.time;
      shader.uniforms.raidlandsWaterFogColor = this.waterLightUniforms.fogColor;
      shader.uniforms.raidlandsWaterFogDensity = this.waterLightUniforms.fogDensity;
      shader.uniforms.raidlandsWaterWorldSize = this.waterLightUniforms.worldSize;
      shader.uniforms.raidlandsCloudCoverage = this.waterLightUniforms.cloudCoverage;
      shader.uniforms.raidlandsCloudOpacity = this.waterLightUniforms.cloudOpacity;
      shader.uniforms.raidlandsCloudSize = this.waterLightUniforms.cloudSize;
      shader.uniforms.raidlandsCloudSharpness = this.waterLightUniforms.cloudSharpness;
      shader.uniforms.raidlandsCloudPhase = this.waterLightUniforms.cloudPhase;
      shader.uniforms.raidlandsCloudShadowStrength = this.waterLightUniforms.cloudShadowStrength;
      shader.uniforms.raidlandsCloudWorldSize = this.waterLightUniforms.worldSize;
      shader.uniforms.raidlandsWaterRainIntensity = this.waterLightUniforms.rainIntensity;
      shader.uniforms.raidlandsWaterLevel = this.waterLightUniforms.waterLevel;
      shader.uniforms.raidlandsTerrainHeight = this.waterLightUniforms.terrainHeight;
      shader.uniforms.raidlandsHasTerrainHeight = this.waterLightUniforms.hasTerrainHeight;
      shader.uniforms.raidlandsWaterDetail = this.waterLightUniforms.detail;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 raidlandsWaterWorldPosition;`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
raidlandsWaterWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec3 raidlandsWaterSunDirection;
uniform vec3 raidlandsWaterSunColor;
uniform vec3 raidlandsWaterSkyColor;
uniform float raidlandsWaterReflectionStrength;
uniform float raidlandsWaterDaylight;
uniform float raidlandsWaterTime;
uniform vec3 raidlandsWaterFogColor;
uniform float raidlandsWaterFogDensity;
uniform float raidlandsWaterWorldSize;
uniform float raidlandsWaterRainIntensity;
uniform float raidlandsWaterLevel;
uniform sampler2D raidlandsTerrainHeight;
uniform float raidlandsHasTerrainHeight;
uniform float raidlandsWaterDetail;
varying vec3 raidlandsWaterWorldPosition;
${cloudShadowShaderSource(this.cloudProfile.shadowOctaves)}`,
        )
        .replace(
          "#include <opaque_fragment>",
          `vec3 raidlandsWaterViewDirection = normalize(cameraPosition - raidlandsWaterWorldPosition);
float raidlandsWaterCloudShadow = raidlandsCloudShadowAt(raidlandsWaterWorldPosition.xz);
float raidlandsWaterWaveA = sin(raidlandsWaterWorldPosition.x * 0.038 + raidlandsWaterWorldPosition.z * 0.021 + raidlandsWaterTime * 0.55);
float raidlandsWaterWaveB = cos(raidlandsWaterWorldPosition.x * -0.019 + raidlandsWaterWorldPosition.z * 0.044 - raidlandsWaterTime * 0.37);
float raidlandsWaterRainRipple = sin(length(fract(raidlandsWaterWorldPosition.xz * 0.071) - 0.5) * 34.0 - raidlandsWaterTime * 8.0)
  * raidlandsWaterRainIntensity * raidlandsWaterDetail;
vec3 raidlandsWaterNormal = normalize(vec3(
  raidlandsWaterWaveA * 0.04 + raidlandsWaterRainRipple * 0.025,
  1.0,
  raidlandsWaterWaveB * 0.04 - raidlandsWaterRainRipple * 0.022
));
vec3 raidlandsWaterReflectionDirection = reflect(-normalize(raidlandsWaterSunDirection), raidlandsWaterNormal);
float raidlandsWaterAlignment = max(dot(raidlandsWaterViewDirection, raidlandsWaterReflectionDirection), 0.0);
float raidlandsWaterGlare = pow(raidlandsWaterAlignment, 90.0);
vec2 raidlandsWaterViewHorizontal = raidlandsWaterViewDirection.xz / max(length(raidlandsWaterViewDirection.xz), 0.0001);
vec2 raidlandsWaterReflectionHorizontal = raidlandsWaterReflectionDirection.xz / max(length(raidlandsWaterReflectionDirection.xz), 0.0001);
float raidlandsWaterElevationMatch = exp(-abs(raidlandsWaterViewDirection.y - raidlandsWaterReflectionDirection.y) * 6.0);
float raidlandsWaterStreak = pow(max(dot(raidlandsWaterViewHorizontal, raidlandsWaterReflectionHorizontal), 0.0), 10.0)
  * raidlandsWaterElevationMatch;
float raidlandsWaterRipples = 0.88 + 0.12 * sin(
  raidlandsWaterWorldPosition.x * 0.045 + sin(raidlandsWaterWorldPosition.z * 0.031 + raidlandsWaterTime * 0.24) * 2.4
);
float raidlandsWaterFresnel = pow(1.0 - clamp(dot(raidlandsWaterViewDirection, raidlandsWaterNormal), 0.0, 1.0), 3.0);
float raidlandsWaterSkyReflection = mix(0.055, 0.34, raidlandsWaterFresnel) * mix(0.56, 1.0, raidlandsWaterDaylight);
float raidlandsWaterSurfaceVariation = 0.97 + (raidlandsWaterWaveA + raidlandsWaterWaveB) * 0.015;
outgoingLight *= raidlandsWaterSurfaceVariation * (1.0 - raidlandsWaterCloudShadow * 0.3);
outgoingLight = mix(outgoingLight, raidlandsWaterSkyColor, raidlandsWaterSkyReflection);
float raidlandsWaterSunPath = (raidlandsWaterGlare * 0.95 + raidlandsWaterStreak * 0.3)
  * raidlandsWaterReflectionStrength * raidlandsWaterRipples;
outgoingLight += raidlandsWaterSunColor * raidlandsWaterSunPath;
vec2 raidlandsTerrainUv = vec2(
  0.5 - raidlandsWaterWorldPosition.x / raidlandsWaterWorldSize,
  0.5 - raidlandsWaterWorldPosition.z / raidlandsWaterWorldSize
);
float raidlandsInsideTerrain = step(0.0, raidlandsTerrainUv.x) * step(raidlandsTerrainUv.x, 1.0)
  * step(0.0, raidlandsTerrainUv.y) * step(raidlandsTerrainUv.y, 1.0) * raidlandsHasTerrainHeight;
float raidlandsGroundHeight = texture2D(raidlandsTerrainHeight, clamp(raidlandsTerrainUv, 0.0, 1.0)).r;
float raidlandsShoreDepth = raidlandsWaterLevel - raidlandsGroundHeight;
float raidlandsShallowWater = raidlandsInsideTerrain
  * (1.0 - smoothstep(1.0, 52.0, raidlandsShoreDepth))
  * smoothstep(-3.0, 2.0, raidlandsShoreDepth);
// Keep the authored terrain visible through shallow water. The depth cue is a
// restrained colour lift; transparency and the ground provide most of it.
outgoingLight = mix(outgoingLight, vec3(0.13, 0.32, 0.36), raidlandsShallowWater * 0.1);
float raidlandsShoreFoam = raidlandsInsideTerrain
  * (1.0 - smoothstep(0.2, 5.5, raidlandsShoreDepth))
  * smoothstep(-2.5, 1.2, raidlandsShoreDepth);
float raidlandsFoamBreakup = 0.84 + 0.16 * sin(
  raidlandsWaterWorldPosition.x * 0.22 + raidlandsWaterWorldPosition.z * 0.17 + raidlandsWaterTime * 1.8
);
raidlandsShoreFoam *= raidlandsFoamBreakup;
outgoingLight = mix(outgoingLight, vec3(0.62, 0.76, 0.78), raidlandsShoreFoam * 0.16);
outgoingLight += vec3(0.16, 0.2, 0.22) * max(raidlandsWaterRainRipple, 0.0) * raidlandsWaterRainIntensity * 0.18;
float raidlandsWaterFogDistance = length(vViewPosition);
float raidlandsWaterFogDistanceScaled = raidlandsWaterFogDensity * raidlandsWaterFogDistance;
float raidlandsWaterFogFactor = 1.0 - exp(-raidlandsWaterFogDistanceScaled * raidlandsWaterFogDistanceScaled);
outgoingLight = mix(outgoingLight, raidlandsWaterFogColor, clamp(raidlandsWaterFogFactor, 0.0, 0.86));
diffuseColor.a *= mix(0.72, 1.0, raidlandsWaterFresnel) * mix(1.0, 0.68, raidlandsShallowWater);
#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => `raidlands-water-ultra-${this.qualityProfile.resolved}-${this.cloudDetail}-v6`;
    const mesh = new Mesh(geometry, material);
    mesh.name = "raidlands-infinite-ocean-surface";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = waterLevel + 0.12;
    // The surface must win over the deep ocean floor when the transparent
    // layer and scene fog overlap at the horizon.
    mesh.renderOrder = 8;
    material.depthWrite = false;
    return mesh;
  }

  private createAerialCloudLayer(): Group {
    const worldSize = this.terrain.worldSize || 4500;
    const uniforms = this.aerialCloudUniforms;
    uniforms.worldSize.value = worldSize;
    const group = new Group();
    group.name = "raidlands-volumetric-cloud-slices";
    group.visible = false;
    const sliceCount = this.qualityProfile.cloudSliceCount;
    const sliceOpacity = sliceCount > 0 ? 1 - Math.exp(-1.8 / sliceCount) : 0;

    for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
      const layerFraction = sliceCount <= 1 ? 0.5 : sliceIndex / (sliceCount - 1);
      const material = new ShaderMaterial({
        uniforms: {
          uCoverage: uniforms.coverage,
          uOpacity: uniforms.opacity,
          uCloudSize: uniforms.size,
          uSharpness: uniforms.sharpness,
          uAttenuation: uniforms.attenuation,
          uBrightness: uniforms.brightness,
          uColoring: uniforms.coloring,
          uRain: uniforms.rain,
          uPhase: uniforms.phase,
          uVisibility: uniforms.visibility,
          uWorldSize: uniforms.worldSize,
          uSunColor: uniforms.sunColor,
          uAmbientColor: uniforms.ambientColor,
          uSunDirection: uniforms.sunDirection,
          uLayerFraction: { value: layerFraction },
          uSliceOpacity: { value: sliceOpacity },
        },
        vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
        fragmentShader: `
        precision highp float;
        varying vec3 vWorldPosition;
        uniform float uCoverage;
        uniform float uOpacity;
        uniform float uCloudSize;
        uniform float uSharpness;
        uniform float uAttenuation;
        uniform float uBrightness;
        uniform float uColoring;
        uniform float uRain;
        uniform float uPhase;
        uniform float uVisibility;
        uniform float uWorldSize;
        uniform vec3 uSunColor;
        uniform vec3 uAmbientColor;
        uniform vec3 uSunDirection;
        uniform float uLayerFraction;
        uniform float uSliceOpacity;

        float hash(vec2 position) {
          return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 position) {
          vec2 cell = floor(position);
          vec2 local = fract(position);
          local = local * local * (3.0 - 2.0 * local);
          float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x);
          float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x);
          return mix(lower, upper, local.y);
        }

        void main() {
          float coverage = clamp(uCoverage, 0.0, 1.0);
          if (coverage <= 0.001 || uVisibility <= 0.001) discard;
          float sizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
          float scale = uWorldSize * mix(0.035, 0.13, sizeFraction);
          vec2 position = vWorldPosition.xz / max(scale, 1.0)
            + vec2(uPhase * 0.0032, uPhase * 0.00135)
            + vec2(uLayerFraction * 0.38, -uLayerFraction * 0.27);
          float broad = noise(position * 0.51 + vec2(3.7, -2.1));
          float field = noise(position) * 0.54
            + broad * 0.25
            + noise(position * 2.03 + vec2(7.13, -4.27)) * 0.14
            + noise(position * 4.11 + vec2(-5.2, 8.4)) * 0.07;
          float layerShape = noise(position * 0.73 + vec2(uLayerFraction * 4.7, -uLayerFraction * 3.1));
          float erosion = noise(position * 8.17 + vec2(11.3 + uLayerFraction * 2.8, -6.8));
          float wisps = noise(position * 13.71 + vec2(-3.4, 14.2 - uLayerFraction * 3.6));
          float verticalEdge = abs(uLayerFraction * 2.0 - 1.0);
          float shapedField = field
            + (layerShape - 0.5) * 0.18
            + (erosion - 0.5) * 0.13
            + (wisps - 0.5) * 0.045
            - verticalEdge * 0.055;
          float threshold = mix(0.73, 0.27, coverage);
          float edge = mix(0.075, 0.018, clamp(uSharpness, 0.0, 1.0));
          float density = smoothstep(threshold - edge, threshold + edge, shapedField)
            * smoothstep(0.005, 0.04, coverage);
          float interior = smoothstep(threshold + edge * 0.35, threshold + edge * 5.5, shapedField);
          float topLight = clamp(interior * 0.72 + erosion * 0.2 + wisps * 0.08, 0.0, 1.0);
          float pocketShade = (1.0 - broad) * interior * mix(0.18, 0.42, uAttenuation);
          float layerLight = smoothstep(0.0, 1.0, uLayerFraction);
          vec3 neutralTop = mix(
            mix(vec3(0.12, 0.15, 0.2), uAmbientColor, 0.55),
            mix(uAmbientColor, vec3(0.76, 0.83, 0.88), 0.48),
            layerLight
          );
          vec3 sunTop = mix(vec3(1.0), uSunColor, clamp(uColoring, 0.0, 1.0));
          vec3 color = mix(neutralTop, sunTop, topLight * layerLight * mix(0.14, 0.48, uColoring));
          vec3 cloudNormal = normalize(vec3(
            noise(position + vec2(0.035, 0.0)) - noise(position - vec2(0.035, 0.0)),
            0.3 + interior,
            noise(position + vec2(0.0, 0.035)) - noise(position - vec2(0.0, 0.035))
          ));
          float silverFacing = pow(max(dot(cloudNormal, normalize(uSunDirection)), 0.0), 5.0);
          float silverEdge = silverFacing * (1.0 - interior) * density * mix(0.22, 0.7, uColoring);
          color += uSunColor * silverEdge;
          color *= mix(0.68, 1.12, clamp(uBrightness, 0.0, 2.0) * 0.5);
          color = mix(color, vec3(0.16, 0.19, 0.23), pocketShade);
          color = mix(color, vec3(0.08, 0.095, 0.12), clamp(uAttenuation * 0.22 + uRain * 0.48, 0.0, 0.72));
          float depthOpacity = mix(0.34, 1.0, interior) * mix(0.78, 1.0, erosion);
          float alpha = density * depthOpacity * clamp(uOpacity, 0.0, 1.0) * uVisibility * uSliceOpacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      });
      material.customProgramCacheKey = () => `raidlands-cloud-slice-${this.qualityProfile.resolved}-${this.cloudDetail}-${sliceIndex}-v3`;
      const mesh = new Mesh(new PlaneGeometry(worldSize * 6, worldSize * 6, 1, 1), material);
      mesh.name = `raidlands-cloud-volume-slice-${sliceIndex + 1}`;
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      mesh.userData.layerFraction = layerFraction;
      group.add(mesh);
    }

    return group;
  }

  private updateOceanPlanes(now: number): void {
    const anchorX = this.camera.position.x;
    const anchorZ = this.camera.position.z;
    this.oceanSurfaceMesh.position.x = anchorX;
    this.oceanSurfaceMesh.position.z = anchorZ;
    this.oceanFloorMesh.position.x = anchorX;
    this.oceanFloorMesh.position.z = anchorZ;
    this.aerialCloudLayer.position.x = anchorX;
    this.aerialCloudLayer.position.z = anchorZ;
    this.oceanWaveTexture.offset.set((now * 0.000018) % 1, (now * 0.000011) % 1);
    this.waterLightUniforms.time.value = now / 1000;
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
      if (shouldHideMonumentPrimitive(monument) && !monumentModelAssetName(monument.prefab)) {
        return;
      }
      const monumentPosition = rustWorldToViewerPosition(monument.x, monument.y, monument.z);
      const terrainHeight = sampleTerrainHeight(this.terrain, monumentPosition.x, monumentPosition.z);
      const monumentGroundY = Math.max(monumentPosition.y, terrainHeight);
      const groupY = monumentGroundY + 5;
      const rotationY = -MathUtils.degToRad(monument.rotationY || 0);
      const group = createMonumentPrimitive(monument, {
        terrain: this.terrain,
        center: monumentPosition,
        groupY,
        rotationY,
      });
      group.position.set(monumentPosition.x, groupY, monumentPosition.z);
      group.rotation.y = rotationY;
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.castShadow = this.renderer.shadowMap.enabled;
          object.receiveShadow = this.renderer.shadowMap.enabled;
        }
      });
      layer.add(group);
      // Procedural fallbacks sit on sampled terrain, while authored models keep
      // the Rust monument root Y. This prevents subterranean cave/lab geometry
      // from being lifted wholesale above the ground or ocean surface.
      this.monumentModels.register(group, monument, monumentPosition.y - groupY);
    });

    this.scene.add(layer);
  }

  private addRoads(): void {
    const roads = this.terrain.roads || [];
    if (!roads.length) return;

    this.roadLayer.name = "raidlands-road-network";
    const counts = { main: 0, side: 0, trail: 0 };

    roads.forEach((road, index) => {
      const mesh = this.createRoadSurface(road);
      if (!mesh) return;
      mesh.name = `road-${road.kind}-${index + 1}`;
      this.roadLayer.add(mesh);
      counts[road.kind]++;
    });

    if (this.roadLayer.children.length === 0) return;
    this.root.dataset.roadPathCount = String(this.roadLayer.children.length);
    this.root.dataset.mainRoadPathCount = String(counts.main);
    this.root.dataset.sideRoadPathCount = String(counts.side);
    this.root.dataset.trailRoadPathCount = String(counts.trail);
    this.scene.add(this.roadLayer);
  }

  private createRoadSurface(road: RoadPayload): Group | null {
    const authoredCenters: Vector3[] = [];
    road.points.forEach((point) => {
      const position = rustWorldToViewerPosition(point.x, point.y, point.z);
      const prior = authoredCenters[authoredCenters.length - 1];
      if (!prior || prior.distanceToSquared(position) > 0.01) authoredCenters.push(position);
    });
    if (authoredCenters.length < 2) return null;

    const worldSize = this.terrain.worldSize || 4500;
    const terrainCellSize = worldSize / Math.max(1, this.terrain.resolution - 1);
    const maximumSegmentLength = MathUtils.clamp(terrainCellSize * 0.24, 6, 10);
    const centers = sampleSmoothRoadCenterline(authoredCenters, maximumSegmentLength);

    const layer = new Group();
    const crossSections = Math.max(2, Math.ceil(road.width / Math.max(3.5, terrainCellSize * 0.2)));
    const addRibbon = (
      name: string,
      width: number,
      elevation: number,
      lateralOffset: number,
      color: number,
      roughness: number,
      emissive = 0x000000,
      emissiveIntensity = 0,
    ): void => {
      const mesh = this.createRoadRibbon(centers, width, elevation, lateralOffset, crossSections, new MeshStandardMaterial({
        color,
        roughness,
        metalness: 0,
        emissive,
        emissiveIntensity,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: DoubleSide,
      }));
      mesh.name = name;
      layer.add(mesh);
    };

    if (road.kind === "main") {
      // Rust's MainRoads are broad, nearly black asphalt without painted lane
      // markings. Leave only a narrow compacted shoulder to blend into terrain.
      addRibbon("road-main-shoulder", road.width + Math.min(1.8, road.width * 0.12), 0.38, 0, 0x655e52, 1);
      addRibbon("road-main-asphalt", road.width * 0.94, 0.62, 0, 0x151719, 0.96, 0x030404, 0.08);
    } else if (road.kind === "side") {
      // SideRoads are unpaved/gravel routes. The darker parallel ruts distinguish
      // them from both the asphalt network and the narrow foot trails.
      addRibbon("road-side-bed", road.width + Math.min(1.5, road.width * 0.18), 0.36, 0, 0x84613e, 1);
      addRibbon("road-side-compacted", road.width * 0.82, 0.54, 0, 0x9a734d, 0.98, 0x120b05, 0.1);
      const rutWidth = MathUtils.clamp(road.width * 0.095, 0.54, 0.9);
      const rutOffset = road.width * 0.22;
      addRibbon("road-side-rut-left", rutWidth, 0.7, -rutOffset, 0x59412d, 1);
      addRibbon("road-side-rut-right", rutWidth, 0.7, rutOffset, 0x59412d, 1);
    } else {
      // TrailRoads are deliberately slimmer and earth-toned: visible enough to
      // navigate from the air, but never mistaken for a vehicle road.
      addRibbon("road-trail-bed", road.width * 1.25, 0.34, 0, 0x714c30, 1);
      addRibbon("road-trail-tread", road.width * 0.56, 0.52, 0, 0x9a6d43, 1, 0x130a04, 0.08);
    }

    return layer;
  }

  private createRoadRibbon(
    centers: Vector3[],
    width: number,
    elevation: number,
    lateralOffset: number,
    crossSections: number,
    material: MeshStandardMaterial,
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];

    centers.forEach((center, index) => {
      const previous = centers[Math.max(0, index - 1)]!;
      const next = centers[Math.min(centers.length - 1, index + 1)]!;
      const direction = next.clone().sub(previous);
      direction.y = 0;
      if (direction.lengthSq() < 0.0001) direction.set(1, 0, 0);
      direction.normalize();
      const lateral = new Vector3(-direction.z, 0, direction.x);
      for (let cross = 0; cross <= crossSections; cross += 1) {
        const offset = lateralOffset + width * (cross / crossSections - 0.5);
        const position = center.clone().addScaledVector(lateral, offset);
        position.y = sampleTerrainHeight(this.terrain, position.x, position.z) + elevation;
        positions.push(position.x, position.y, position.z);
      }

      if (index > 0) {
        const stride = crossSections + 1;
        const prior = (index - 1) * stride;
        const current = index * stride;
        for (let cross = 0; cross < crossSections; cross += 1) {
          indices.push(prior + cross, prior + cross + 1, current + cross + 1, prior + cross, current + cross + 1, current + cross);
        }
      }
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(new Uint32BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  private addPowerLines(): void {
    const paths = this.terrain.powerLines || [];
    if (!paths.length) return;
    this.powerLineLayer.name = "raidlands-power-line-infrastructure";
    this.scene.add(this.powerLineLayer);
    const placements: Array<{ position: Vector3; rotationY: number; variant: number }> = [];
    const wireVertices: Vector3[] = [];
    paths.forEach((path, pathIndex) => {
      const points = path.points.map((point) => rustWorldToViewerPosition(point.x, point.y, point.z));
      points.forEach((point, index) => {
        const neighbor = points[Math.min(points.length - 1, index + 1)] || points[Math.max(0, index - 1)]!;
        const prior = points[Math.max(0, index - 1)] || neighbor;
        const direction = neighbor.clone().sub(prior);
        placements.push({ position: point, rotationY: Math.atan2(direction.x, direction.z), variant: (pathIndex + index) % 4 });
      });
      for (let index = 0; index < points.length - 1; index++) {
        const start = points[index]!; const end = points[index + 1]!;
        const perpendicular = new Vector3(-(end.z - start.z), 0, end.x - start.x).normalize();
        for (const lateral of [-7, 0, 7]) {
          const samples: Vector3[] = [];
          for (let step = 0; step <= 8; step++) {
            const t = step / 8;
            samples.push(start.clone().lerp(end, t).addScaledVector(perpendicular, lateral).add(new Vector3(0, 31 - Math.sin(t * Math.PI) * 4.5, 0)));
          }
          for (let step = 0; step < samples.length - 1; step++) wireVertices.push(samples[step]!, samples[step + 1]!);
        }
      }
    });
    if (wireVertices.length) {
      const wires = new LineSegments(
        new BufferGeometry().setFromPoints(wireVertices),
        new LineBasicMaterial({ color: 0x242a2a, transparent: true, opacity: 0.72 }),
      );
      wires.name = "power-line-wires";
      this.powerLineLayer.add(wires);
    }
    this.root.dataset.powerLinePathCount = String(paths.length);
    this.root.dataset.powerLineTowerCount = String(placements.length);
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_URL);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    const base = new URL(this.root.dataset.assetBase || new URL(/* @vite-ignore */ "../../", import.meta.url).href, window.location.href);
    const variants = ["a", "b", "c", "d"];
    void Promise.allSettled(variants.map((variant) => loader.loadAsync(new URL(`media/models/infrastructure/powerline_${variant}.glb`, base).href)))
      .then((results) => {
        if (this.disposed) {
          results.forEach((result) => {
            if (result.status === "fulfilled") result.value.scene.traverse((object) => {
              if (object instanceof Mesh) disposeGeometryMaterial(object);
            });
          });
          return;
        }
        results.forEach((result, variant) => {
          const selected = placements.filter((placement) => placement.variant === variant);
          if (!selected.length) {
            if (result.status === "fulfilled") result.value.scene.traverse((object) => {
              if (object instanceof Mesh) disposeGeometryMaterial(object);
            });
            return;
          }
          if (result.status === "rejected") {
            console.warn(`Raidlands map viewer could not load Rust power-line tower ${variants[variant]}; using lightweight pylons.`, result.reason);
            selected.forEach((placement) => {
              const fallback = createPowerLineTowerPrimitive();
              fallback.position.copy(placement.position);
              fallback.rotation.y = placement.rotationY;
              this.powerLineLayer.add(fallback);
            });
            return;
          }
          const gltf = result.value;
          gltf.scene.updateMatrixWorld(true);
          const source = gltf.scene.getObjectByProperty("isMesh", true) as Mesh | undefined;
          if (!source) return;
          const instances = new InstancedMesh(source.geometry, source.material, selected.length);
          instances.name = `power-line-towers-${variant}`;
          instances.castShadow = false;
          instances.receiveShadow = false;
          selected.forEach((placement, index) => {
            const placementMatrix = new Matrix4().compose(
              placement.position,
              new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), placement.rotationY),
              new Vector3(1, 1, 1),
            ).multiply(source.matrixWorld);
            instances.setMatrixAt(index, placementMatrix);
          });
          instances.instanceMatrix.needsUpdate = true;
          this.powerLineLayer.add(instances);
        });
      })
      .finally(() => draco.dispose());
  }

  private addLights(): void {
    const worldSize = this.terrain.worldSize || 4500;
    const ambient = new AmbientLight(0xddeaf0, 0.5);
    const sun = new DirectionalLight(0xfff1cf, 1.58);
    sun.position.set(900, 1400, 650);
    sun.castShadow = this.renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(
      this.qualityProfile.resolved === "ultra" ? 4096 : 2048,
      this.qualityProfile.resolved === "ultra" ? 4096 : 2048,
    );
    sun.shadow.camera.left = -worldSize * 0.56;
    sun.shadow.camera.right = worldSize * 0.56;
    sun.shadow.camera.top = worldSize * 0.56;
    sun.shadow.camera.bottom = -worldSize * 0.56;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = worldSize * 2.2;
    sun.shadow.bias = -0.00012;
    sun.shadow.normalBias = 0.75;
    const fill = new DirectionalLight(0x9fc7dd, 0.18);
    fill.position.set(-500, 500, -800);
    const lightning = new PointLight(0xc8e2ff, 0, worldSize * 1.35, 1.45);
    lightning.position.set(0, worldSize * 0.42, 0);
    this.ambientLight = ambient;
    this.sunLight = sun;
    this.fillLight = fill;
    this.lightningLight = lightning;
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
    this.scene.add(ambient, sun, sun.target, fill, lightning);
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
    if (document.visibilityState === "hidden") {
      return;
    }
    const now = performance.now();
    const frameMs = Math.max(0, now - this.lastAnimationTick);
    const deltaSeconds = Math.min(0.05, frameMs / 1000);
    this.lastAnimationTick = now;
    this.directorFps = updateDirectorFpsState(this.directorFps, frameMs);
    this.root.dataset.cameraPerformanceTier = this.directorFps.tier;
    this.updateFreeFlight(deltaSeconds);
    this.updateSelfLocationOrbit(now);
    this.updateCameraTour(now);
    if (this.cameraMode !== "manual" || this.manualCameraStyle !== "fly") {
      this.controls.update();
    }
    this.enforceCameraTerrainSafety();
    this.camera.updateMatrixWorld();
    this.updateOverlayLayerTransitions(now);
    this.updateGridOpacity();
    this.updateOceanPlanes(now);
    this.updateEnvironment(now);
    this.airstrikeLayer.userData.tick?.((now - this.clockStart) / 1000);
    this.monumentLayer.traverse((object) => object.userData.tick?.((now - this.clockStart) / 1000));
    this.monumentModels.tick(now);
    this.treeModels.tick(now);
    this.updateAircraftCameraSafety();
    this.composer.render();
    this.root.dataset.viewerDrawCalls = String(this.renderer.info.render.calls);
    this.root.dataset.viewerTriangles = String(this.renderer.info.render.triangles);
  }

  private pauseAutomaticCamera(): void {
    if (this.lockCameraInput || this.cameraMode === "manual") return;
    this.automaticPausedUntil = performance.now() + 8000;
    this.transitionFrom = null;
    this.transitionTo = null;
    this.transitionFinal = null;
    this.activePose = this.currentPose();
    this.root.dataset.cameraPaused = "true";
    window.setTimeout(() => {
      if (this.automaticPausedUntil <= performance.now()) delete this.root.dataset.cameraPaused;
    }, 8050);
  }

  private handleFlightKey(event: KeyboardEvent, pressed: boolean): void {
    if (pressed && event.code === "Escape" && this.root.classList.contains("is-browser-fill")) {
      event.preventDefault();
      this.setBrowserFill(false);
      return;
    }
    if (this.cameraMode !== "manual" || this.manualCameraStyle !== "fly") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, select, textarea, button, [contenteditable='true']")) return;
    const key = event.code;
    if (![
      "KeyW", "KeyA", "KeyS", "KeyD", "Space",
      "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight",
    ].includes(key)) return;
    event.preventDefault();
    if (pressed) this.pressedFlightKeys.add(key); else this.pressedFlightKeys.delete(key);
  }

  private updateFreeFlight(deltaSeconds: number): void {
    if (this.cameraMode !== "manual" || this.manualCameraStyle !== "fly") return;
    const forwardInput = Number(this.pressedFlightKeys.has("KeyW")) - Number(this.pressedFlightKeys.has("KeyS")) - this.mobileMove.y;
    const strafeInput = Number(this.pressedFlightKeys.has("KeyD")) - Number(this.pressedFlightKeys.has("KeyA")) + this.mobileMove.x;
    const riseInput = Number(this.pressedFlightKeys.has("Space"))
      - Number(this.pressedFlightKeys.has("ControlLeft") || this.pressedFlightKeys.has("ControlRight"))
      + this.mobileRise;
    const sprintMultiplier = this.pressedFlightKeys.has("ShiftLeft") || this.pressedFlightKeys.has("ShiftRight") ? 2 : 1;
    const lookX = this.mobileLook.x + this.pointerLookDelta.x;
    const lookY = this.mobileLook.y + this.pointerLookDelta.y;
    this.pointerLookDelta.set(0, 0);
    if (Math.abs(forwardInput) + Math.abs(strafeInput) + Math.abs(riseInput) + Math.abs(lookX) + Math.abs(lookY) < 0.001) return;

    const direction = this.controls.target.clone().sub(this.camera.position).normalize();
    const yaw = Math.atan2(direction.x, direction.z) - lookX * deltaSeconds * 1.8;
    const maxFlightPitch = MathUtils.degToRad(89.5);
    const pitch = MathUtils.clamp(
      Math.asin(direction.y) - lookY * deltaSeconds * 1.5,
      -maxFlightPitch,
      maxFlightPitch,
    );
    direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
    const horizontalForward = new Vector3(direction.x, 0, direction.z).normalize();
    const right = new Vector3(-horizontalForward.z, 0, horizontalForward.x);
    const terrainClearance = 12;
    const ground = sampleTerrainHeight(this.terrain, this.camera.position.x, this.camera.position.z);
    const heightAboveGround = this.camera.position.y - ground;
    const altitude = Math.max(terrainClearance, heightAboveGround);
    const speed = MathUtils.clamp(altitude * 0.85, 90, (this.terrain.worldSize || 4500) * 0.38) * sprintMultiplier;
    // Once a downward flight reaches minimum clearance, keep W moving at full
    // horizontal speed while terrain safety carries the camera over rising land.
    const forwardDirection = forwardInput > 0
      && direction.y < 0
      && heightAboveGround <= terrainClearance + 1
      ? horizontalForward
      : direction;
    const movement = forwardDirection.clone().multiplyScalar(forwardInput)
      .add(right.multiplyScalar(strafeInput))
      .add(new Vector3(0, riseInput, 0));
    if (movement.lengthSq() > 1) movement.normalize();
    this.camera.position.addScaledVector(movement, speed * deltaSeconds);
    const worldSize = this.terrain.worldSize || 4500;
    this.camera.position.y = cameraHeightAboveTerrain(
      this.camera.position.y,
      sampleTerrainHeight(this.terrain, this.camera.position.x, this.camera.position.z),
      terrainClearance,
    );
    this.controls.target.copy(this.camera.position).addScaledVector(direction, MathUtils.clamp(altitude * 1.8, 120, 900));
    this.camera.lookAt(this.controls.target);
  }

  private enforceCameraTerrainSafety(): void {
    this.camera.position.y = cameraHeightAboveTerrain(
      this.camera.position.y,
      sampleTerrainHeight(this.terrain, this.camera.position.x, this.camera.position.z),
      12,
    );
    this.controls.target.y = Math.max(
      this.controls.target.y,
      sampleTerrainHeight(this.terrain, this.controls.target.x, this.controls.target.z) + 4,
    );
  }

  private handleTargetPointer(event: PointerEvent): void {
    const started = this.pointerDownAt;
    this.pointerDownAt = null;
    if (!started || Math.hypot(event.clientX - started.x, event.clientY - started.y) > 6) return;
    if (this.cameraMode === "manual" && this.manualCameraStyle === "fly") return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([
      this.playerLocationLayer,
      this.heatmapLayer,
      this.airstrikeLayer,
      this.monumentLayer,
      this.terrainMesh,
    ], true);
    const hit = hits[0];
    if (!hit) return;
    const target = hit.point.clone();
    target.y = Math.max(target.y, sampleTerrainHeight(this.terrain, target.x, target.z) + 18);
    const distance = MathUtils.clamp(this.camera.position.distanceTo(target), 140, (this.terrain.worldSize || 4500) * 0.42);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    const pose = this.aboveTerrainPose(target.clone().addScaledVector(direction, distance), target, 36);
    this.pauseAutomaticCamera();
    this.focusCamera(pose);
    this.root.dataset.cameraTarget = hit.object.name || hit.object.parent?.name || "terrain";
    this.root.dispatchEvent(new CustomEvent("raidlands:camera-target", { detail: { label: this.root.dataset.cameraTarget } }));
  }

  public clearCameraTarget(): void {
    delete this.root.dataset.cameraTarget;
    this.root.dispatchEvent(new CustomEvent("raidlands:camera-target", { detail: { label: "Whole map" } }));
    if (this.cameraMode === "top") this.focusCamera(this.topPose());
  }

  private setBrowserFill(enabled: boolean): void {
    if (enabled && !this.root.classList.contains("is-browser-fill")) {
      this.browserFillParent = this.root.parentNode;
      this.browserFillNextSibling = this.root.nextSibling;
      document.body.appendChild(this.root);
    }
    this.root.classList.toggle("is-browser-fill", enabled);
    if (!enabled && this.browserFillParent) {
      if (this.browserFillNextSibling?.parentNode === this.browserFillParent) {
        this.browserFillParent.insertBefore(this.root, this.browserFillNextSibling);
      } else {
        this.browserFillParent.appendChild(this.root);
      }
      this.browserFillParent = null;
      this.browserFillNextSibling = null;
    }
    this.floatingControls?.querySelector<HTMLButtonElement>("[data-map-browser-fill]")
      ?.setAttribute("aria-pressed", String(enabled));
    this.resize();
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
    const previous = this.targetEnvironment;
    if (previous && next.sampledAtMs > 0 && next.sampledAtMs === previous.sampledAtMs) {
      return;
    }
    const now = performance.now();
    const currentBeforeUpdate = this.currentEnvironment(now);
    this.sunMotion = previous
      ? raidlandsSunMotionBetween(previous.sunDirection, previous.sampledAtMs, next.sunDirection, next.sampledAtMs)
      : null;
    this.sunMotionBaseDirection.copy(next.sunDirection);
    this.sunMotionBaseAt = now + Math.max(0, durationMs);
    this.activeEnvironment = currentBeforeUpdate;
    this.targetEnvironment = next;
    this.environmentBlendStartedAt = now;
    this.environmentBlendDuration = Math.max(0, durationMs);
    if (this.environmentBlendDuration === 0) {
      this.applyEnvironment(next);
      this.activeEnvironment = next;
    }
  }

  public setTimelineEnvironment(
    fromSnapshot: EnvironmentSnapshot | null | undefined,
    toSnapshot: EnvironmentSnapshot | null | undefined = fromSnapshot,
    progress = 0,
  ): void {
    const from = normalizeEnvironment(fromSnapshot);
    const to = normalizeEnvironment(toSnapshot) || from;
    if (!from || !to) {
      return;
    }

    const current = interpolateEnvironment(from, to, MathUtils.clamp(progress, 0, 1));
    this.sunMotion = null;
    this.sunMotionBaseAt = 0;
    this.activeEnvironment = current;
    this.targetEnvironment = current;
    this.environmentBlendStartedAt = performance.now();
    this.environmentBlendDuration = 0;
    this.applyEnvironment(current);
  }

  private currentEnvironment(now: number): NormalizedEnvironment | null {
    if (!this.activeEnvironment || !this.targetEnvironment || this.environmentBlendDuration <= 0) {
      const source = this.targetEnvironment || this.activeEnvironment;
      const current = source ? interpolateEnvironment(source, source, 1) : null;
      if (current && this.sunMotionBaseAt > 0) {
        current.sunDirection.copy(extrapolateRaidlandsSunDirection(
          this.sunMotionBaseDirection,
          this.sunMotion,
          now - this.sunMotionBaseAt,
        ));
      }
      return current;
    }
    const progress = MathUtils.clamp((now - this.environmentBlendStartedAt) / this.environmentBlendDuration, 0, 1);
    const current = interpolateEnvironment(this.activeEnvironment, this.targetEnvironment, MathUtils.smoothstep(progress, 0, 1));
    if (progress >= 1 && this.sunMotionBaseAt > 0) {
      current.sunDirection.copy(extrapolateRaidlandsSunDirection(
        this.sunMotionBaseDirection,
        this.sunMotion,
        now - this.sunMotionBaseAt,
      ));
    }
    return current;
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
    const sunHeight = MathUtils.clamp(environment.sunDirection.y, -0.32, 0.9);
    const daylight = MathUtils.smoothstep(sunHeight, -0.05, 0.55);
    const twilight = MathUtils.smoothstep(sunHeight, -0.2, -0.04)
      * (1 - MathUtils.smoothstep(sunHeight, 0.3, 0.56));
    const night = 1 - MathUtils.smoothstep(sunHeight, -0.14, 0.03);
    const solarVisibility = MathUtils.smoothstep(sunHeight, -0.055, 0.018);
    const visualCloudCoverage = visualCloudCoverageForEnvironment(environment);
    const fogStrength = visualFogStrengthForEnvironment(environment);
    const atmosphereBrightness = MathUtils.clamp(environment.atmosphereBrightness, 0.15, 2.4);
    const atmosphereContrast = MathUtils.clamp(environment.atmosphereContrast, 0.15, 2.4);
    const atmosphereBrightnessT = MathUtils.clamp(atmosphereBrightness / 1.5, 0, 1);
    const atmosphereWarmColor = environment.sunColor.clone().lerp(
      new Color(0xffd0aa),
      MathUtils.lerp(0.52, 0.7, MathUtils.clamp(environment.atmosphereMie / 4, 0, 1)),
    );
    const scatteringGlow = MathUtils.lerp(0.76, 1.26, MathUtils.clamp(environment.cloudScattering, 0, 1));
    const sunLightingResponse = this.sunProfile.lightingResponse;
    this.renderer.toneMappingExposure = MathUtils.lerp(0.9, 1.42, atmosphereBrightnessT)
      * MathUtils.lerp(0.72, 1, Math.max(daylight, twilight * 0.9))
      * (1 + twilight * (0.14 + sunLightingResponse * 0.035) + fogStrength * 0.1);
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
        + fogStrength * MathUtils.lerp(0.08, 0.2, Math.max(daylight, twilight))
      ) * MathUtils.lerp(0.72, 1.18, atmosphereBrightness / 1.4),
      0.14,
      1.5,
    );
    this.sunLight.color.copy(environment.sunColor);
    this.sunLight.intensity = Math.max(0, environment.sunIntensity * solarVisibility
      * MathUtils.lerp(0.78, 1.04, daylight) * scatteringGlow
      * (1 + twilight * sunLightingResponse * 0.08)
      * MathUtils.lerp(1, 0.72, Math.max(environment.fogIntensity * 0.42, environment.rainIntensity * 0.28)));
    const worldSize = this.terrain.worldSize || 4500;
    this.sunLight.position.copy(environment.sunDirection).multiplyScalar(worldSize * 0.62);
    this.sunLight.position.y = Math.max(this.sunLight.position.y, worldSize * -0.18);
    this.fillLight.color.set(0x88b7d6).lerp(atmosphereWarmColor, twilight * 0.38);
    this.fillLight.intensity = MathUtils.lerp(0.12, 0.32, daylight) + twilight * 0.3 + fogStrength * 0.08;
    this.terrainLightUniforms.sunDirection.value.copy(environment.sunDirection);
    this.terrainLightUniforms.sunColor.value.copy(environment.sunColor);
    this.terrainLightUniforms.twilight.value = twilight;
    this.terrainLightUniforms.cloudAttenuation.value = MathUtils.clamp(
      visualCloudCoverage * MathUtils.clamp(environment.cloudAttenuation, 0, 1),
      0,
      1,
    );
    const cameraViewDirection = this.controls.target.clone().sub(this.camera.position);
    const sceneFogSunFacing = horizontalDirectionalFacing(cameraViewDirection, environment.sunDirection);
    const fogColor = environmentFogColor(environment, sceneFogSunFacing);
    this.terrainLightUniforms.fogColor.value.copy(fogColor);
    this.terrainLightUniforms.distantLift.value = MathUtils.clamp(
      0.035 + fogStrength * 0.075 + twilight * 0.045,
      0.035,
      0.14,
    );
    this.terrainLightUniforms.worldSize.value = worldSize;
    this.terrainLightUniforms.cloudCoverage.value = visualCloudCoverage;
    this.terrainLightUniforms.cloudOpacity.value = environment.cloudOpacity;
    this.terrainLightUniforms.cloudSize.value = environment.cloudSize;
    this.terrainLightUniforms.cloudSharpness.value = environment.cloudSharpness;
    this.terrainLightUniforms.cloudPhase.value = performance.now() / 1000;
    this.terrainLightUniforms.time.value = performance.now() / 1000;
    this.terrainLightUniforms.wetness.value = this.wetness;
    this.terrainLightUniforms.cloudShadowStrength.value = this.cloudProfile.useVolumetricClouds
      ? MathUtils.clamp(environment.cloudOpacity * (0.28 + environment.cloudAttenuation * 0.48 + environment.rainIntensity * 0.16), 0, 0.92)
      : 0;
    const oceanMaterial = this.oceanSurfaceMesh.material as MeshStandardMaterial;
    const waterWeatherAttenuation = 1 - MathUtils.clamp(
      visualCloudCoverage * MathUtils.lerp(0.4, 0.72, environment.cloudAttenuation)
        + environment.rainIntensity * 0.55
        + fogStrength * 0.45,
      0,
      0.92,
    );
    const waterSunReflection = (twilight * 0.82 + daylight * 0.16)
      * waterWeatherAttenuation
      * solarVisibility
      * (1 + twilight * sunLightingResponse * 0.16)
      * MathUtils.clamp(environment.sunIntensity / 1.7, 0.2, 1.35);
    const waterBaseColor = new Color(0x071d2a)
      .lerp(new Color(0x176176), daylight)
      .lerp(new Color(0x273640), environment.rainIntensity * 0.32);
    const waterSkyColor = new Color(0x091323)
      .lerp(new Color(0x8bb5c5), daylight * 0.86)
      .lerp(atmosphereWarmColor, twilight * solarVisibility * 0.18)
      .lerp(new Color(0x35424e), environment.rainIntensity * 0.34);
    oceanMaterial.color.copy(waterBaseColor);
    oceanMaterial.roughness = MathUtils.clamp(MathUtils.lerp(0.46, 0.24, waterSunReflection) + environment.rainIntensity * 0.16, 0.18, 0.62);
    oceanMaterial.metalness = MathUtils.lerp(0.01, 0.1, waterSunReflection);
    oceanMaterial.emissive.copy(waterBaseColor);
    oceanMaterial.emissiveIntensity = 0.008 + night * 0.006;
    this.waterLightUniforms.sunDirection.value.copy(environment.sunDirection);
    this.waterLightUniforms.sunColor.value.copy(atmosphereWarmColor);
    this.waterLightUniforms.skyColor.value.copy(waterSkyColor);
    this.waterLightUniforms.reflectionStrength.value = waterSunReflection;
    this.waterLightUniforms.daylight.value = daylight;
    this.waterLightUniforms.fogColor.value.copy(fogColor);
    this.waterLightUniforms.fogDensity.value = fogStrength > 0.02
      ? visualFogDensityForCamera(fogStrength, this.camera.position, this.terrain, this.qualityProfile)
      : 0;
    this.waterLightUniforms.worldSize.value = worldSize;
    this.waterLightUniforms.cloudCoverage.value = visualCloudCoverage;
    this.waterLightUniforms.cloudOpacity.value = environment.cloudOpacity;
    this.waterLightUniforms.cloudSize.value = environment.cloudSize;
    this.waterLightUniforms.cloudSharpness.value = environment.cloudSharpness;
    this.waterLightUniforms.cloudPhase.value = performance.now() / 1000;
    this.waterLightUniforms.cloudShadowStrength.value = this.terrainLightUniforms.cloudShadowStrength.value;
    this.waterLightUniforms.rainIntensity.value = environment.rainIntensity;
    const cloudSizeFraction = MathUtils.clamp((environment.cloudSize - 0.2) / 7.8, 0, 1);
    const cloudBase = worldSize * (0.115 - environment.rainIntensity * 0.016);
    const cloudTop = cloudBase + worldSize * MathUtils.lerp(0.055, 0.105, cloudSizeFraction);
    this.aerialCloudUniforms.coverage.value = visualCloudCoverage;
    this.aerialCloudUniforms.opacity.value = environment.cloudOpacity;
    this.aerialCloudUniforms.size.value = environment.cloudSize;
    this.aerialCloudUniforms.sharpness.value = environment.cloudSharpness;
    this.aerialCloudUniforms.attenuation.value = environment.cloudAttenuation;
    this.aerialCloudUniforms.brightness.value = environment.cloudBrightness;
    this.aerialCloudUniforms.coloring.value = environment.cloudColoring;
    this.aerialCloudUniforms.rain.value = environment.rainIntensity;
    this.aerialCloudUniforms.phase.value = performance.now() / 1000;
    this.aerialCloudUniforms.visibility.value = this.cloudProfile.useVolumetricClouds ? 1 : 0;
    this.aerialCloudUniforms.worldSize.value = worldSize;
    this.aerialCloudUniforms.sunColor.value.copy(environment.sunColor);
    this.aerialCloudUniforms.ambientColor.value.copy(environment.ambientColor);
    this.aerialCloudUniforms.sunDirection.value.copy(environment.sunDirection);
    this.aerialCloudLayer.children.forEach((child) => {
      child.position.y = cloudBase + (Number(child.userData.layerFraction) || 0) * (cloudTop - cloudBase);
    });
    this.aerialCloudLayer.visible = this.aerialCloudUniforms.visibility.value > 0.002 && visualCloudCoverage > 0.015;
    const horizonDrama = MathUtils.clamp(1 - Math.abs(MathUtils.clamp(sunHeight, -0.1, 0.46) - 0.18) / 0.28, 0, 1);
    this.scene.backgroundIntensity = (MathUtils.lerp(0.7, 1.02, daylight) + horizonDrama * 0.11 - night * 0.18) * MathUtils.lerp(0.72, 1.16, atmosphereBrightness / 1.4);
    this.scene.environmentIntensity = (MathUtils.lerp(0.46, 0.96, daylight) + horizonDrama * 0.04) * MathUtils.lerp(0.82, 1.18, atmosphereContrast / 1.4);
    this.scene.fog = fogStrength > 0.02
      ? new FogExp2(
        fogColor,
        visualFogDensityForCamera(fogStrength, this.camera.position, this.terrain, this.qualityProfile) * (this.fogDetail === "low" ? 1 : 0.18),
      )
      : null;
    if (this.volumetricFogPass) {
      const uniforms = this.volumetricFogPass.uniforms;
      uniforms.uInverseProjection.value.copy(this.camera.projectionMatrixInverse);
      uniforms.uCameraWorld.value.copy(this.camera.matrixWorld);
      uniforms.uCameraPosition.value.copy(this.camera.position);
      uniforms.uWorldSize.value = worldSize;
      // Clear-weather atmospheric haze is handled by the scene fog and grade.
      // Do not run the volumetric raymarch for tiny baseline haze values.
      uniforms.uFogStrength.value = fogStrength > 0.025 ? fogStrength : 0;
      uniforms.uFogIntensity.value = environment.fogIntensity;
      uniforms.uFogColor.value.copy(fogColor);
      uniforms.uSunColor.value.copy(environment.sunColor);
      uniforms.uSunDirection.value.copy(environment.sunDirection);
      uniforms.uRainIntensity.value = environment.rainIntensity;
      uniforms.uMie.value = MathUtils.clamp(environment.atmosphereMie / 4, 0, 1);
      uniforms.uTime.value = performance.now() / 1000;
    }
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
      cloudSize: environment.cloudSize,
      cloudColoring: environment.cloudColoring,
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
    const weatherDeltaSeconds = MathUtils.clamp((now - this.lastWeatherTick) / 1000, 0, 0.25);
    this.lastWeatherTick = now;
    const wetnessTarget = MathUtils.smoothstep(rain, 0.015, 0.72);
    const wetnessResponseSeconds = wetnessTarget > this.wetness ? 10 : 210;
    this.wetness = MathUtils.lerp(
      this.wetness,
      wetnessTarget,
      1 - Math.exp(-weatherDeltaSeconds / wetnessResponseSeconds),
    );
    const visibleCloudAmount = visualCloudCoverageForEnvironment(environment);
    const sunHeight = MathUtils.clamp(environment.sunDirection.y, -0.32, 0.9);
    const twilight = MathUtils.smoothstep(sunHeight, -0.2, -0.04)
      * (1 - MathUtils.smoothstep(sunHeight, 0.3, 0.56));
    const cloudOpacity = MathUtils.lerp(0.18, 0.5, visibleCloudAmount)
      * MathUtils.clamp(environment.cloudOpacity, 0, 1)
      * MathUtils.lerp(0.72, 1.24, MathUtils.clamp(environment.cloudBrightness, 0, 1.6));
    const cloudScale = MathUtils.lerp(0.82, 1.18, visibleCloudAmount)
      * MathUtils.lerp(0.72, 1.32, MathUtils.clamp(environment.cloudSize / 4, 0, 1))
      * MathUtils.lerp(1, 1.22, rain);
    const cloudDarkening = MathUtils.clamp(
      MathUtils.clamp(environment.cloudAttenuation, 0, 1) * visibleCloudAmount * 0.42 + rain * 0.46,
      0,
      0.78,
    );
    const cameraTopDownAmount = MathUtils.clamp(
      this.camera.position.clone().sub(this.controls.target).normalize().dot(new Vector3(0, 1, 0)),
      0,
      1,
    );
    const floatingCloudViewOpacity = 1 - MathUtils.smoothstep(cameraTopDownAmount, 0.58, 0.9);

    const groundFogAmount = Math.sqrt(visualFogStrengthForEnvironment(environment));
    const horizontalSunLength = Math.max(0.0001, Math.hypot(environment.sunDirection.x, environment.sunDirection.z));
    this.groundFogLayer.visible = this.fogDetail === "low" && groundFogAmount > 0.015;
    this.groundFogLayer.children.forEach((child, index) => {
      if (!(child instanceof Sprite)) {
        return;
      }
      const distance = this.camera.position.distanceTo(child.position);
      const nearFade = lowDetailFogNearVisibility(groundFogAmount, distance / worldSize);
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
      material.color.copy(environmentFogColor(environment, sunFacing));
      material.opacity = groundFogAmount * nearFade * farFade * (Number(child.userData.opacityBias) || 1) * 0.34;
      child.visible = material.opacity > 0.003;
      child.position.x = (Number(child.userData.baseX) || 0) + Math.sin(now * 0.000018 + index * 1.9) * worldSize * 0.008;
      child.position.z = (Number(child.userData.baseZ) || 0) + Math.cos(now * 0.000014 + index * 1.3) * worldSize * 0.006;
    });

    this.weatherCloudLayer.visible = this.cloudProfile.useSpriteClouds && visibleCloudAmount > 0.015;
    this.weatherCloudLayer.position.x = this.camera.position.x * 0.035;
    this.weatherCloudLayer.position.z = this.camera.position.z * 0.035;
    this.weatherCloudLayer.rotation.y = now * 0.000012;
    if (this.cloudProfile.useSpriteClouds) this.weatherCloudLayer.children.forEach((child, index) => {
      if (!(child instanceof Sprite)) {
        return;
      }
      child.visible = (Number(child.userData.coverageRank) || 0) < visibleCloudAmount;
      const baseScale = Number(child.userData.baseScale) || worldSize * 0.18;
      const layerDepth = Number(child.userData.layerDepth) || 0;
      const drift = now * (0.000006 + (index % 5) * 0.0000015);
      child.position.x = (Number(child.userData.baseX) || 0) + Math.sin(drift + index) * worldSize * 0.025;
      child.position.y = (Number(child.userData.baseY) || worldSize * 0.19)
        - rain * layerDepth * worldSize * 0.018
        + Math.sin(drift * 0.7 + index * 0.91) * worldSize * 0.006;
      child.position.z = (Number(child.userData.baseZ) || 0) + Math.cos(drift * 0.8 + index * 0.7) * worldSize * 0.018;
      child.scale.set(
        baseScale * cloudScale * (Number(child.userData.scaleX) || 1),
        baseScale * cloudScale * (Number(child.userData.scaleY) || 0.34) * MathUtils.lerp(1, 1.36, rain),
        1,
      );
      const material = child.material as SpriteMaterial;
      material.opacity = Math.min(0.86, cloudOpacity * (Number(child.userData.opacityBias) || 1) * MathUtils.lerp(1, 1.42, rain))
        * floatingCloudViewOpacity;
      const cloudWarmColor = environment.sunColor.clone().lerp(new Color(0xffcda2), 0.58);
      const cloudSunFacing = horizontalDirectionalFacing(child.position, environment.sunDirection);
      const cloudEdgeWarmth = twilight
        * MathUtils.lerp(0.24, 0.68, cloudSunFacing)
        * MathUtils.lerp(0.58, 1, environment.cloudScattering)
        * environment.cloudColoring;
      material.color.copy(environment.ambientColor)
        .lerp(new Color(0xe9f2f7), MathUtils.lerp(0.54, 0.84, MathUtils.smoothstep(environment.sunDirection.y, -0.05, 0.5)))
        .lerp(cloudWarmColor, cloudEdgeWarmth)
        .lerp(new Color(0x111722), cloudDarkening * MathUtils.lerp(0.72, 1.12, layerDepth));
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
    this.rainSplashLayer.visible = rain > 0.08 && this.qualityProfile.rainDetail >= 0.5;
    if (this.rainSplashLayer.visible) {
      const waterLevel = resolveOceanWaterLevel(this.terrain);
      this.rainSplashLayer.children.forEach((child, index) => {
        if (!(child instanceof Mesh)) return;
        const cycle = (now * (Number(child.userData.speed) || 0.00055) + Number(child.userData.phase || 0)) % 1;
        const angle = Number(child.userData.angle) || 0;
        const radius = Number(child.userData.radius) || 100;
        const x = this.camera.position.x + Math.cos(angle + index * 0.17) * radius;
        const z = this.camera.position.z + Math.sin(angle + index * 0.17) * radius;
        const ground = sampleTerrainHeight(this.terrain, x, z);
        const surface = ground < waterLevel ? waterLevel + 0.18 : ground + 0.22;
        child.position.set(x, surface, z);
        const size = MathUtils.lerp(0.6, 8.5, Math.sin(cycle * Math.PI)) * MathUtils.lerp(0.72, 1.35, rain);
        child.scale.setScalar(size);
        const material = child.material as MeshStandardMaterial;
        material.opacity = Math.sin(cycle * Math.PI) * (1 - cycle) * rain * 0.38;
      });
    }

    const thunder = MathUtils.clamp(environment.thunderIntensity, 0, 1);
    if (this.lightningLight) this.lightningLight.intensity = 0;
    if (this.bloomPass) this.bloomPass.strength = this.qualityProfile.bloomStrength;
    if (thunder > 0.015 && visibleCloudAmount > 0.08 && this.ambientLight && this.sunLight && this.lightningLight) {
      const stormCycle = now / 7200;
      const stormCell = Math.floor(stormCycle);
      const stormPhase = stormCycle - stormCell;
      const primaryFlash = Math.exp(-Math.pow((stormPhase - 0.115) / 0.018, 2));
      const returnStroke = Math.exp(-Math.pow((stormPhase - 0.162) / 0.011, 2)) * 0.58;
      const flash = MathUtils.clamp(primaryFlash + returnStroke, 0, 1)
        * thunder
        * MathUtils.smoothstep(visibleCloudAmount, 0.08, 0.48);
      const strikeX = (Math.sin(stormCell * 91.731 + 0.37) * 0.5) * worldSize;
      const strikeZ = (Math.sin(stormCell * 47.119 + 2.11) * 0.5) * worldSize;
      this.lightningLight.position.set(strikeX, worldSize * 0.32, strikeZ);
      this.lightningLight.intensity = flash * 5.4;
      this.ambientLight.intensity += flash * 0.32;
      this.sunLight.intensity += flash * 1.4;
      this.scene.backgroundIntensity += flash * 0.22;
      this.renderer.toneMappingExposure *= 1 + flash * 0.12;
      if (this.bloomPass) this.bloomPass.strength += flash * 0.24;
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
    const from = this.currentPose();
    const worldSize = this.terrain.worldSize || 4500;
    const needsWaypoint = transitionNeedsSafeWaypoint(
      from.position,
      pose.position,
      (x, z) => sampleTerrainHeight(this.terrain, x, z),
      Math.max(24, worldSize * 0.012),
    );
    this.transitionFrom = from;
    this.transitionFinal = needsWaypoint ? clonePose(pose) : null;
    this.transitionTo = needsWaypoint
      ? {
        position: new Vector3(
          (from.position.x + pose.position.x) * 0.5,
          Math.max(from.position.y, pose.position.y, (this.terrain.maxHeight || 300) + worldSize * 0.18),
          (from.position.z + pose.position.z) * 0.5,
        ),
        target: from.target.clone().lerp(pose.target, 0.5),
        up: new Vector3(0, 1, 0),
      }
      : clonePose(pose);
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
        if (this.transitionFinal) {
          this.transitionFrom = this.currentPose();
          this.transitionTo = this.transitionFinal;
          this.transitionFinal = null;
          this.transitionStartedAt = now;
          this.transitionDuration = 1350;
        } else {
          this.transitionFrom = null;
          this.transitionTo = null;
        }
      }
      return;
    }

    if (now < this.focusUntil) {
      return;
    }

    if (shouldResumeAutomaticCamera(now, this.automaticPausedUntil)) {
      this.automaticPausedUntil = 0;
      this.activePose = this.currentPose();
      this.actionTourStartedAt = now;
      this.tourStartedAt = now;
      this.directorShot = null;
    }
    if (this.automaticPausedUntil > now || this.cameraMode === "manual" || this.cameraMode === "top") {
      return;
    }

    if (isDirectorMode(this.cameraMode)) {
      this.updateDirectorShot(now);
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

  private startDirectorShot(now: number): void {
    const environment = this.currentEnvironment(now) || normalizeEnvironment({
      sunDirection: { x: 0.5, y: 0.78, z: 0.36 },
      fogIntensity: 0,
      rainIntensity: 0,
      cloudCoverage: 0.2,
    })!;
    const sequence = this.directorShotSequence;
    const plan = selectDirectorShot({
      mode: this.cameraMode as DirectorMode,
      worldSize: this.terrain.worldSize || 4500,
      waterLevel: resolveOceanWaterLevel(this.terrain),
      environment: {
        sunDirection: vectorPoint(environment.sunDirection),
        fogIntensity: visualFogStrengthForEnvironment(environment),
        rainIntensity: environment.rainIntensity,
        cloudCoverage: environment.cloudCoverage,
      },
      features: this.directorFeatures,
      actions: this.directorActionSubjects(),
      performanceTier: this.directorFps.tier,
      recentShotIds: this.directorRecentShotIds,
      shotSequence: sequence,
      lastHeroSequence: this.directorLastHeroSequence,
    });
    const worldSize = this.terrain.worldSize || 4500;
    const mapLimit = worldSize * 0.49;
    const requestedPosition = pointVector(plan.position);
    requestedPosition.x = MathUtils.clamp(requestedPosition.x, -mapLimit, mapLimit);
    requestedPosition.z = MathUtils.clamp(requestedPosition.z, -mapLimit, mapLimit);
    requestedPosition.y = cameraYForTerrainSightline(
      requestedPosition.y,
      requestedPosition,
      plan.target,
      (x, z) => sampleTerrainHeight(this.terrain, x, z),
      Math.max(18, worldSize * 0.006),
      18,
    );
    const to = this.aboveTerrainPose(
      requestedPosition,
      pointVector(plan.target),
      Math.max(36, worldSize * 0.035),
    );
    const from = this.currentPose();
    const needsWaypoint = transitionNeedsSafeWaypoint(
      from.position,
      to.position,
      (x, z) => sampleTerrainHeight(this.terrain, x, z),
      Math.max(24, worldSize * 0.012),
      24,
    );
    const waypoint = needsWaypoint ? {
      position: new Vector3(
        (from.position.x + to.position.x) * 0.5,
        Math.max(from.position.y, to.position.y, (this.terrain.maxHeight || 300) + worldSize * 0.14),
        (from.position.z + to.position.z) * 0.5,
      ),
      target: from.target.clone().lerp(to.target, 0.5),
      up: new Vector3(0, 1, 0),
    } : null;
    this.directorShot = { plan, from, to, waypoint, fromFov: this.camera.fov, startedAt: now };
    this.directorShotSequence += 1;
    if (plan.kind === "hero") this.directorLastHeroSequence = sequence;
    this.directorRecentShotIds.unshift(plan.id);
    this.directorRecentShotIds.splice(6);
    this.root.dataset.cameraShotKind = plan.kind;
    this.root.dataset.cameraShotId = plan.id;
  }

  private updateDirectorShot(now: number): void {
    if (!this.directorShot) this.startDirectorShot(now);
    const shot = this.directorShot;
    if (!shot) return;
    const elapsed = now - shot.startedAt;
    if (elapsed < shot.plan.transitionMs) {
      const progress = easeInOutCubic(MathUtils.clamp(elapsed / Math.max(1, shot.plan.transitionMs), 0, 1));
      const pose = shot.waypoint
        ? progress < 0.5
          ? interpolatePose(shot.from, shot.waypoint, easeInOutCubic(progress * 2))
          : interpolatePose(shot.waypoint, shot.to, easeInOutCubic((progress - 0.5) * 2))
        : interpolatePose(shot.from, shot.to, progress);
      this.applyCameraPose(pose);
      this.setCameraFov(MathUtils.lerp(shot.fromFov, shot.plan.fov, progress));
      return;
    }

    const holdElapsed = elapsed - shot.plan.transitionMs;
    if (holdElapsed >= shot.plan.holdMs) {
      this.startDirectorShot(now);
      return;
    }

    const holdProgress = MathUtils.clamp(holdElapsed / Math.max(1, shot.plan.holdMs), 0, 1);
    const pose = clonePose(shot.to);
    if (shot.plan.kind === "hero" && shot.plan.heroRoute && shot.plan.heroRoute.length > 1) {
      const routePose = sampleDirectorRoute(shot.plan.heroRoute, holdProgress);
      const routeStart = pointVector(shot.plan.heroRoute[0]!);
      const offset = pointVector(shot.plan.position).sub(routeStart);
      pose.position.copy(routePose).add(offset);
      pose.target.copy(routePose);
      pose.target.y += Math.max(16, (this.terrain.worldSize || 4500) * 0.008);
    } else {
      const view = pose.target.clone().sub(pose.position).setY(0).normalize();
      const right = new Vector3(-view.z, 0, view.x);
      const worldSize = this.terrain.worldSize || 4500;
      const drift = Math.sin(holdProgress * Math.PI * 1.2) * worldSize * 0.004 * shot.plan.motionScale;
      const dolly = Math.sin(holdProgress * Math.PI) * worldSize * 0.005 * shot.plan.motionScale;
      pose.position.addScaledVector(right, drift).addScaledVector(view, dolly);
      pose.target.addScaledVector(right, drift * 0.28);
    }
    const safePose = this.aboveTerrainPose(
      pose.position,
      pose.target,
      Math.max(28, (this.terrain.worldSize || 4500) * 0.018),
    );
    this.applyCameraPose(safePose);
    this.setCameraFov(shot.plan.fov + Math.sin(holdProgress * Math.PI * 2) * 0.55 * shot.plan.motionScale);
  }

  private directorActionSubjects(): DirectorActionSubject[] {
    const nowEpoch = Date.now();
    const nowPerformance = performance.now();
    const overlays = Array.from(this.actionHighlights.entries()).map(([source, highlight]) => ({
      id: `overlay:${source}`,
      kind: "overlay" as const,
      position: vectorPoint(highlight.center),
      radius: highlight.radius,
      weight: MathUtils.clamp(highlight.weight, 0.2, 9),
      updatedAt: nowEpoch - Math.max(0, nowPerformance - highlight.updatedAt),
    }));
    const events = this.latestReplayEvents.slice(0, 20).map((event, index): DirectorActionSubject => {
      const position = replayEventPosition(event, this.terrain);
      const route = replayWorldEventRoute(event).map((sample) => vectorPoint(sample.position));
      const vehicle = replayVehicleForEvent(event);
      const state = String(event.payload?.state || "").toLowerCase();
      const occurredAt = Date.parse(String(event.occurredAt || ""));
      return {
        id: `event:${replayEventKey(event, index)}`,
        kind: route.length > 1 && vehicle ? "vehicle" : "event",
        position: vectorPoint(position),
        radius: event.eventType === "airstrike" ? 220 : route.length > 1 ? 150 : 130,
        weight: event.eventType === "airstrike" ? 8 : vehicle === "attack_heli" ? 7 : route.length > 1 ? 5.5 : 4,
        updatedAt: Number.isFinite(occurredAt) ? occurredAt : nowEpoch,
        vehicle,
        destroyed: state === "destroyed" || state === "ended",
        route,
      };
    });
    return [...events, ...overlays];
  }

  private setCameraFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) < 0.001) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private startNextTour(now: number, blendFromCurrent: boolean): void {
    if (this.cameraMode === "orbit" || (this.lockCameraInput && this.tourStyle === "orbit")) {
      this.tourKind = "home-orbit";
      this.tourStartedAt = now;
      this.tourDuration = 32000;
      this.activePose = blendFromCurrent ? this.currentPose() : null;
      return;
    }

    if (isDirectorMode(this.cameraMode)) {
      this.startDirectorShot(now);
      return;
    }

    const environment = this.currentEnvironment(now);
    const severeWeather = environment
      ? Math.max(environment.rainIntensity, visualFogStrengthForEnvironment(environment)) > 0.42
      : false;
    const night = environment ? environment.sunDirection.y < -0.08 : false;
    const kinds: CameraTourKind[] = severeWeather
      ? ["ridge-crossing", "monument-orbit", "coastal-sweep", "map-run"]
      : night
        ? ["coastal-sweep", "monument-orbit", "map-run", "ridge-crossing"]
        : ["coastal-sweep", "ridge-crossing", "monument-orbit", "map-run"];
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

    const breathing = Math.sin(elapsed * 0.00024) * 0.7;
    const targetFov = (this.tourKind === "monument-orbit" ? 43.5 : this.tourKind === "map-run" ? 50 : 46.5) + breathing;
    const nextFov = MathUtils.lerp(this.camera.fov, targetFov, 0.035);
    if (Math.abs(nextFov - this.camera.fov) > 0.001) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    const safePose = this.aboveTerrainPose(pose.position, pose.target, Math.max(24, (this.terrain.worldSize || 4500) * 0.012));
    safePose.up.copy(pose.up);
    this.applyCameraPose(safePose);
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
      if (isDirectorMode(this.cameraMode)) this.directorShot = null;
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

    const eventsByKey = new Map(events.map((event, index) => [replayEventKey(event, index), event]));
    events.slice(0, mode === "timeline" ? 80 : 8).forEach((event, index) => {
      const key = replayEventKey(event, index);
      visibleKeys.add(key);
      const startAt = Number(this.layer.userData.lastTickTime || 0);
      const existing = this.runs.find((run) => run.key === key);
      if (existing) {
        existing.refresh?.(event, startAt);
        if (mode === "timeline" && Number.isFinite(cursorMs)) {
          existing.syncToTimeline(cursorMs, playbackSpeed);
        }
        return;
      }

      const run = event.eventType === "airstrike"
        ? new AirstrikeReplayRun(key, event, this.terrain, this.profileForEvent(event), startAt, playbackSpeed, this.vehicleMetadata, this.assetBase)
        : event.eventType === "airdrop"
          ? new AirdropReplayRun(key, event, this.terrain, startAt, playbackSpeed, this.vehicleMetadata, this.assetBase, replayAirdropCarrierEvent(event, eventsByKey))
          : new GenericMapEventReplayRun(
            key,
            event,
            this.terrain,
            startAt,
            playbackSpeed,
            this.vehicleMetadata,
            this.assetBase,
            mode !== "timeline",
          );
      if (mode === "timeline" && Number.isFinite(cursorMs)) {
        run.syncToTimeline(cursorMs, playbackSpeed);
      }
      this.runs.push(run);
      this.active.add(run.group);
    });

    this.runs = this.runs.filter((run) => {
      const shouldPrune = mode === "timeline" || run.persistent === true;
      if (!shouldPrune || visibleKeys.has(run.key) || (run.source === "ambient" && this.ambientEnabled && visibleKeys.size === 0)) {
        return true;
      }
      this.active.remove(run.group);
      disposeObjectTree(run.group);
      return false;
    });
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
  persistent?: boolean;
  refresh?: (event: MapReplayEvent, now: number) => void;
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
  private readonly packageVisuals: Array<{ packageMesh: Group; parachute: Group; offsetX: number; offsetZ: number }>;
  private readonly carrierRoute: WorldEventRouteSample[];
  private timelineElapsed: number | null = null;

  public constructor(
    key: string,
    event: MapReplayEvent,
    terrain: TerrainPayload,
    startAt: number,
    playbackSpeed: number,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
    carrierEvent: MapReplayEvent | null,
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
      const packageMesh = createAirdropPackageMarker(assetBase, index + 1);
      const parachute = createAirdropParachuteMarker(assetBase, index + 1);
      const centeredIndex = index - ((visualDropCount - 1) / 2);
      this.group.add(packageMesh, parachute);
      return {
        packageMesh,
        parachute,
        offsetX: centeredIndex * 34,
        offsetZ: Math.abs(centeredIndex) * 10,
      };
    });
    this.carrierRoute = carrierEvent ? replayWorldEventRoute(carrierEvent) : [];
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
    const carrierPose = this.carrierRoute.length > 1 ? sampleWorldEventRoute(this.carrierRoute, progress) : null;
    if (carrierPose) {
      this.aircraft.position.copy(carrierPose.position);
      this.aircraft.quaternion.copy(carrierPose.rotation);
    } else {
      this.aircraft.position.set(x, planeHeight, z);
      this.aircraft.rotation.set(0, -Math.PI / 2, 0);
    }
    // The cargo-plane visual points opposite the replay vehicle convention.
    // Correct it after either route orientation so its nose follows its travel.
    this.aircraft.rotateY(Math.PI);

    const eventTime = elapsed * this.playbackSpeed;
    const fallProgress = MathUtils.clamp((eventTime - this.releaseTime) / this.dropFallSeconds, 0, 1);
    this.packageVisuals.forEach((visual, index) => {
      const staggerSeconds = index * 0.38;
      const visualProgress = MathUtils.clamp((eventTime - this.releaseTime - staggerSeconds) / this.dropFallSeconds, 0, 1);
      const visualHeight = MathUtils.lerp(planeHeight - 42, ground + 6, easeInOutCubic(visualProgress));
      const releaseProgress = MathUtils.clamp((this.releaseTime + staggerSeconds) / this.duration, 0, 1);
      const routeReleasePose = this.carrierRoute.length > 1 ? sampleWorldEventRoute(this.carrierRoute, releaseProgress) : null;
      const releasePosition = routeReleasePose?.position ?? new Vector3(
        MathUtils.lerp(this.flightStartX, this.flightEndX, releaseProgress),
        planeHeight,
        this.target.z,
      );
      const landingProgress = easeInOutCubic(visualProgress);
      visual.packageMesh.position.set(
        MathUtils.lerp(releasePosition.x + visual.offsetX, this.target.x + visual.offsetX, landingProgress),
        visualHeight,
        MathUtils.lerp(releasePosition.z + visual.offsetZ, this.target.z + visual.offsetZ, landingProgress),
      );
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
  public readonly persistent: boolean;
  private event: MapReplayEvent;
  private readonly terrain: TerrainPayload;
  private target: Vector3;
  private sourcePosition: Vector3;
  private route: WorldEventRouteSample[];
  private readonly vehicle: string;
  private readonly semanticType: string;
  private readonly airborne: boolean;
  private readonly startAt: number;
  private readonly duration: number;
  private playbackSpeed: number;
  private timelineElapsed: number | null = null;
  private readonly marker: Mesh;
  private readonly ring: Mesh;
  private readonly beacon: Sprite;
  private readonly vehicleMarker: Group | null;

  public constructor(
    key: string,
    event: MapReplayEvent,
    terrain: TerrainPayload,
    startAt: number,
    playbackSpeed: number,
    vehicleMetadata: VehiclePreviewMetadataFile | null,
    assetBase: string,
    liveMode = false,
  ) {
    this.key = key;
    this.event = event;
    this.terrain = terrain;
    this.startAt = startAt;
    this.playbackSpeed = MathUtils.clamp(playbackSpeed || 1, 0.1, 12);
    this.vehicle = replayVehicleForEvent(event);
    this.semanticType = replaySemanticEventType(event);
    this.airborne = replayVehicleIsAirborne(this.vehicle);
    this.persistent = liveMode && replayWorldVehicleIsActive(event);
    this.sourcePosition = replayEventPosition(event, terrain);
    this.route = replayWorldEventRoute(event);
    this.target = this.sourcePosition.clone();
    const ground = sampleTerrainHeight(terrain, this.target.x, this.target.z);
    this.target.y = this.vehicle === "cargo_ship"
      ? Math.max(Number(terrain.waterLevel) || 0, ground) + 4
      : ground + 5;
    this.duration = this.route.length > 1 || replayEventIsWorldVehicle(event) ? 18 : 12;
    this.group.name = `map-event-replay-${this.semanticType || String(event.eventType || "event")}`;
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
    this.vehicleMarker = replayVehicleHasViewerModel(this.vehicle)
      ? createAircraftMarker(this.vehicle, vehicleMetadata, assetBase)
      : null;
    if (this.vehicleMarker) {
      this.vehicleMarker.name = `map-event-vehicle-${this.vehicle}`;
      this.group.add(this.vehicleMarker);
    }
  }

  public update(now: number): boolean {
    const elapsed = this.timelineElapsed ?? (now - this.startAt);
    if (elapsed < 0) {
      this.group.visible = false;
      return true;
    }

    const eventTime = elapsed * this.playbackSpeed;
    if (!this.persistent && eventTime > this.duration) {
      return false;
    }

    this.group.visible = true;
    const progress = this.persistent
      ? (0.5 + Math.sin(elapsed * 0.8) * 0.5)
      : MathUtils.clamp(eventTime / this.duration, 0, 1);
    const pulse = 0.5 + (Math.sin(elapsed * Math.PI * 2) * 0.5);
    this.marker.position.copy(this.target).add(new Vector3(0, 10 + pulse * 10, 0));
    this.marker.scale.setScalar(MathUtils.lerp(0.8, 1.25, pulse));
    this.ring.position.copy(this.target);
    this.ring.scale.setScalar(this.persistent ? MathUtils.lerp(0.8, 1.15, pulse) : MathUtils.lerp(0.5, 2.8, easeOutCubic(progress)));
    this.beacon.position.copy(this.target).add(new Vector3(0, 54, 0));
    this.beacon.scale.setScalar(MathUtils.lerp(38, 92, easeOutCubic(progress)));
    setMaterialOpacity(this.ring.material, this.persistent ? MathUtils.lerp(0.2, 0.38, pulse) : MathUtils.lerp(0.62, 0, progress));
    setMaterialOpacity(this.beacon.material, this.persistent ? MathUtils.lerp(0.14, 0.3, pulse) : MathUtils.lerp(0.48, 0, progress));

    if (this.vehicleMarker) {
      const routePose = !this.persistent && this.route.length > 1 ? sampleWorldEventRoute(this.route, progress) : null;
      const currentPose = this.persistent && this.route.length > 0 ? this.route[this.route.length - 1] : null;
      const position = routePose?.position.clone() ?? currentPose?.position.clone() ?? this.sourcePosition.clone();
      if (this.airborne && !this.persistent && !routePose && !currentPose) {
        const forward = replayEventForward(this.event);
        const travel = Math.max(280, (this.semanticType === "cargo_plane" ? 0.34 : 0.16) * (this.terrain.worldSize || 4500));
        position.addScaledVector(forward, (progress - 0.5) * travel);
        position.y = Math.max(position.y, this.target.y + Math.max(130, (this.terrain.worldSize || 4500) * 0.055));
      } else if (!this.airborne) {
        position.y = Math.max(position.y, this.target.y);
      }
      this.vehicleMarker.position.copy(position);
      if (routePose || currentPose) {
        this.vehicleMarker.quaternion.copy((routePose || currentPose)!.rotation);
      } else {
        this.vehicleMarker.rotation.set(0, replayEventHeading(this.event), 0);
      }
      this.vehicleMarker.visible = true;
    }
    return true;
  }

  public refresh(event: MapReplayEvent): void {
    if (!this.persistent || !replayWorldVehicleIsActive(event)) {
      return;
    }

    this.event = event;
    this.sourcePosition = replayEventPosition(event, this.terrain);
    this.route = replayWorldEventRoute(event);
    this.target = this.sourcePosition.clone();
    const ground = sampleTerrainHeight(this.terrain, this.target.x, this.target.z);
    this.target.y = this.vehicle === "cargo_ship"
      ? Math.max(Number(this.terrain.waterLevel) || 0, ground) + 4
      : ground + 5;
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
  const explicit = normalizeReplayVehicle(String(event.vehicle || ""));
  if (explicit) return explicit;

  const assetKey = normalizeReplayVehicle(String(event.payload?.assetKey || ""));
  if (assetKey) return assetKey;

  const delivery = normalizeReplayVehicle(String(event.payload?.delivery || ""));
  if (delivery) return delivery;

  return normalizeReplayVehicle(replaySemanticEventType(event));
}

function normalizeReplayVehicle(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^rust:/, "");
  if (!normalized) return "";
  if (normalized === "cargo_plane_jet" || normalized === "jet" || normalized === "f15" || normalized.includes("f15")) return "f15";
  if (normalized === "patrol_heli" || normalized.includes("patrol_helicopter") || normalized.includes("attack_heli") || normalized.includes("attackhelicopter")) return "attack_heli";
  if (normalized === "ch47" || normalized.includes("ch47")) return "chinook";
  if (normalized.includes("cargo_ship") || normalized.includes("cargoship")) return "cargo_ship";
  if (normalized.includes("bradley")) return "bradley";
  if (normalized.includes("cargo_plane")) return "cargo_plane";
  if (normalized.includes("drone")) return "drone";
  return "";
}

function replaySemanticEventType(event: MapReplayEvent): string {
  const payloadType = String(event.payload?.eventType || "").trim().toLowerCase();
  return payloadType || String(event.eventType || "").trim().toLowerCase();
}

function replayEventIsWorldVehicle(event: MapReplayEvent): boolean {
  return String(event.payload?.kind || "").toLowerCase() === "world_vehicle";
}

function replayWorldVehicleIsActive(event: MapReplayEvent): boolean {
  if (!replayEventIsWorldVehicle(event)) return false;
  const state = String(event.payload?.state || "active").trim().toLowerCase();
  return state !== "ended" && state !== "destroyed";
}

function replayVehicleHasViewerModel(vehicle: string): boolean {
  return ["f15", "a10", "attack_heli", "cargo_plane", "drone", "chinook", "bradley", "cargo_ship"].includes(vehicle);
}

function replayVehicleIsAirborne(vehicle: string): boolean {
  return ["f15", "a10", "attack_heli", "cargo_plane", "drone", "chinook"].includes(vehicle);
}

function replayEventHeading(event: MapReplayEvent): number {
  const rotation = replayEventRotation(event);
  if (rotation) {
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
    return Math.atan2(-forward.x, -forward.z);
  }
  return 0;
}

function replayEventRotation(event: MapReplayEvent): Quaternion | null {
  const rotation = event.payload?.rotation;
  if (rotation && typeof rotation === "object") {
    const x = Number((rotation as Record<string, unknown>).x);
    const y = Number((rotation as Record<string, unknown>).y);
    const z = Number((rotation as Record<string, unknown>).z);
    const w = Number((rotation as Record<string, unknown>).w);
    if ([x, y, z, w].every(Number.isFinite)) {
      return rustWorldQuaternionToViewerQuaternion({ x, y, z, w });
    }
  }
  return null;
}

function replayEventForward(event: MapReplayEvent): Vector3 {
  const heading = replayEventHeading(event);
  return new Vector3(-Math.sin(heading), 0, -Math.cos(heading)).normalize();
}

function replayWorldEventRoute(event: MapReplayEvent): WorldEventRouteSample[] {
  const rawRoute = event.payload?.route;
  if (!Array.isArray(rawRoute)) return [];

  return rawRoute.flatMap((sample) => {
    if (!Array.isArray(sample) || sample.length < 8) return [];
    const [timestampMs, x, y, z, qx, qy, qz, qw] = sample.map(Number);
    if (![timestampMs, x, y, z, qx, qy, qz, qw].every(Number.isFinite)) return [];
    return [{
      timestampMs,
      position: rustWorldToViewerPosition(x, y, z),
      rotation: rustWorldQuaternionToViewerQuaternion({ x: qx, y: qy, z: qz, w: qw }),
    }];
  }).sort((left, right) => left.timestampMs - right.timestampMs);
}

function sampleWorldEventRoute(route: WorldEventRouteSample[], progress: number): { position: Vector3; rotation: Quaternion } | null {
  if (route.length === 0) return null;
  if (route.length === 1) return { position: route[0]!.position.clone(), rotation: route[0]!.rotation.clone() };
  const scaled = MathUtils.clamp(progress, 0, 1) * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  const next = route[index + 1]!;
  const current = route[index]!;
  const fraction = scaled - index;
  return {
    position: current.position.clone().lerp(next.position, fraction),
    rotation: current.rotation.clone().slerp(next.rotation, fraction),
  };
}

function replayAirdropCarrierEvent(event: MapReplayEvent, eventsByKey: Map<string, MapReplayEvent>): MapReplayEvent | null {
  const carrierKey = String(event.payload?.carrierEntityKey || "").trim();
  return carrierKey ? eventsByKey.get(carrierKey) || null : null;
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
  const type = replaySemanticEventType(event);
  const vehicle = replayVehicleForEvent(event);
  if (vehicle === "attack_heli") {
    return 0xff8766;
  }
  if (vehicle === "chinook") {
    return 0xdac78c;
  }
  if (vehicle === "bradley") {
    return 0x94c77c;
  }
  if (vehicle === "cargo_plane" || vehicle === "cargo_ship") {
    return 0xd5ecff;
  }
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

function isDirectorMode(mode: CameraMode): mode is DirectorMode {
  return mode === "director" || mode === "action" || mode === "cinematic";
}

function vectorPoint(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function pointVector(point: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(point.x, point.y, point.z);
}

function sampleDirectorRoute(route: Array<{ x: number; y: number; z: number }>, progress: number): Vector3 {
  if (route.length === 0) return new Vector3();
  if (route.length === 1) return pointVector(route[0]!);
  const scaled = MathUtils.clamp(progress, 0, 1) * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  return pointVector(route[index]!).lerp(pointVector(route[index + 1]!), scaled - index);
}

function replayDirectorSignature(events: MapReplayEvent[]): string {
  return events.slice(0, 20).map((event, index) => {
    const route = Array.isArray(event.payload?.route) ? event.payload.route.length : 0;
    return `${replayEventKey(event, index)}:${event.x}:${event.z}:${String(event.payload?.state || "")}:${route}`;
  }).join("|");
}

function buildDirectorLandscapeFeatures(terrain: TerrainPayload): DirectorLandscapeFeature[] {
  const worldSize = terrain.worldSize || 4500;
  const half = worldSize / 2;
  const water = resolveOceanWaterLevel(terrain);
  const samples: Array<{ x: number; y: number; z: number; prominence: number; coast: boolean }> = [];
  const grid = 11;
  const spacing = worldSize * 0.9 / (grid - 1);
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const x = MathUtils.lerp(-half * 0.9, half * 0.9, column / (grid - 1));
      const z = MathUtils.lerp(-half * 0.9, half * 0.9, row / (grid - 1));
      const y = sampleTerrainHeight(terrain, x, z);
      const neighbors = [
        sampleTerrainHeight(terrain, x + spacing, z),
        sampleTerrainHeight(terrain, x - spacing, z),
        sampleTerrainHeight(terrain, x, z + spacing),
        sampleTerrainHeight(terrain, x, z - spacing),
      ];
      const neighborAverage = neighbors.reduce((sum, height) => sum + height, 0) / neighbors.length;
      const prominence = MathUtils.clamp((y - neighborAverage) / Math.max(40, (terrain.maxHeight || 300) * 0.3), 0, 1.5);
      const coast = Math.abs(y - water) < Math.max(12, (terrain.maxHeight || 300) * 0.06)
        && neighbors.some((height) => height < water + 2)
        && neighbors.some((height) => height > water + 10);
      samples.push({ x, y, z, prominence, coast });
    }
  }

  const separated = (candidate: { x: number; z: number }, selected: DirectorLandscapeFeature[]) => selected.every((feature) => (
    Math.hypot(feature.position.x - candidate.x, feature.position.z - candidate.z) > worldSize * 0.16
  ));
  const terrainFeatures: DirectorLandscapeFeature[] = [];
  samples
    .filter((sample) => sample.y > water + 24)
    .sort((left, right) => (right.y + right.prominence * 100) - (left.y + left.prominence * 100))
    .forEach((sample) => {
      if (terrainFeatures.length >= 6 || !separated(sample, terrainFeatures)) return;
      terrainFeatures.push({
        id: `terrain-${terrainFeatures.length}`,
        kind: sample.prominence > 0.38 ? "peak" : "ridge",
        position: { x: sample.x, y: sample.y + 28, z: sample.z },
        radius: worldSize * 0.09,
        prominence: Math.max(0.45, sample.prominence),
      });
    });
  samples.filter((sample) => sample.coast).forEach((sample) => {
    if (terrainFeatures.filter((feature) => feature.kind === "coast").length >= 3 || !separated(sample, terrainFeatures)) return;
    terrainFeatures.push({
      id: `coast-${terrainFeatures.length}`,
      kind: "coast",
      position: { x: sample.x, y: Math.max(sample.y, water) + 24, z: sample.z },
      radius: worldSize * 0.08,
      prominence: 0.58,
    });
  });

  const monumentFeatures = [...(terrain.monuments || [])]
    .sort((left, right) => right.radius - left.radius)
    .slice(0, 8)
    .map((monument, index): DirectorLandscapeFeature => {
      const position = rustWorldToViewerPosition(monument.x, monument.y, monument.z);
      const ground = sampleTerrainHeight(terrain, position.x, position.z);
      return {
        id: `monument-${index}-${monument.name}`,
        kind: "monument",
        position: { x: position.x, y: Math.max(position.y, ground) + Math.max(24, monument.radius * 0.3), z: position.z },
        radius: Math.max(60, monument.radius),
        prominence: MathUtils.clamp(0.55 + monument.radius / Math.max(1, worldSize) * 3, 0.55, 1.25),
      };
    });
  return [
    ...terrainFeatures,
    ...monumentFeatures,
    {
      id: "map-center",
      kind: "center",
      position: { x: 0, y: sampleTerrainHeight(terrain, 0, 0) + 34, z: 0 },
      radius: worldSize * 0.12,
      prominence: 0.4,
    },
  ];
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

  // The Cargo Ship source model is the complete explorable Rust entity, not a
  // map-scale visual. Decoding it brings hundreds of thousands of vertices
  // and dozens of textures into an already busy terrain scene, which can
  // stall or crash the browser as the replay starts. Its dimensioned ship
  // proxy is intentional here: it preserves position, heading, and scale
  // without putting the viewer's render budget at risk.
  if (!mapVehicleUsesDetailedModel(vehicle)) {
    return group;
  }

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

const worldEventModelCache = new Map<string, Promise<Object3D>>();
const worldEventDraco = new DRACOLoader();
worldEventDraco.setDecoderPath(DRACO_DECODER_URL);
const worldEventModelLoader = new GLTFLoader();
worldEventModelLoader.setDRACOLoader(worldEventDraco);
worldEventModelLoader.setMeshoptDecoder(MeshoptDecoder);

function worldEventModelUrl(assetBase: string, file: string): string {
  const base = new URL(assetBase || "/assets/", window.location.href);
  return new URL(`media/models/world-events/${file}`, base).href;
}

function markSharedWorldEventModel(object: Object3D): void {
  object.traverse((child) => {
    child.userData.preserveSharedVehicleAsset = true;
    if (child instanceof Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
}

async function loadWorldEventModel(assetBase: string, file: string): Promise<Object3D> {
  const url = worldEventModelUrl(assetBase, file);
  let cached = worldEventModelCache.get(url);
  if (!cached) {
    cached = worldEventModelLoader.loadAsync(url).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(gltf.scene);
      if (!bounds.isEmpty()) {
        const center = new Vector3();
        bounds.getCenter(center);
        gltf.scene.position.sub(center);
      }
      markSharedWorldEventModel(gltf.scene);
      return gltf.scene;
    });
    worldEventModelCache.set(url, cached);
  }
  return cached;
}

function createAirdropAssetMarker(
  assetBase: string,
  file: string,
  name: string,
  fallback: Mesh,
): Group {
  const marker = new Group();
  marker.name = name;
  marker.add(fallback);
  void loadWorldEventModel(assetBase, file).then((template) => {
    if (!marker.parent) return;
    const asset = template.clone(true);
    marker.remove(fallback);
    disposeObjectTree(fallback);
    marker.add(asset);
  }).catch((error) => {
    console.info(`Raidlands could not load RustRelay world-event asset ${file}.`, error);
  });
  return marker;
}

function createAirdropPackageMarker(assetBase: string, index: number): Group {
  const fallback = new Mesh(
    new BoxGeometry(11, 10, 6),
    new MeshStandardMaterial({ color: 0x8a5f36, roughness: 0.82, metalness: 0.05 }),
  );
  fallback.name = "airdrop-package-fallback";
  return createAirdropAssetMarker(assetBase, "supply_drop.glb", `airdrop-replay-package-${index}`, fallback);
}

function createAirdropParachuteMarker(assetBase: string, index: number): Group {
  const fallback = new Mesh(
    new ConeGeometry(6, 3, 24, 1, true),
    new MeshStandardMaterial({ color: 0xf5ead8, roughness: 0.74, transparent: true, opacity: 0.88, side: DoubleSide }),
  );
  fallback.name = "airdrop-parachute-fallback";
  return createAirdropAssetMarker(assetBase, "parachute_supplydrop.glb", `airdrop-replay-parachute-${index}`, fallback);
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

interface MonumentPrimitivePlacement {
  terrain: TerrainPayload;
  center: Vector3;
  groupY: number;
  rotationY: number;
}

type MonumentCacheEntry = { source: Group; active: number; lastUsed: number };
type MonumentBinding = Record<MonumentModelTier, Group | null> & {
  group: Group;
  monument: MonumentPayload;
  metadata: MonumentModelManifestEntry;
  fallback: Object3D[];
  localGroundY: number;
  desired: MonumentLodTier;
  loading: Set<MonumentModelTier>;
  failed: Set<MonumentModelTier>;
};

class MonumentModelController {
  private readonly draco: DRACOLoader;
  private readonly loader: GLTFLoader;
  private readonly bindings: MonumentBinding[] = [];
  private readonly cache = new Map<string, MonumentCacheEntry>();
  private readonly pending = new Map<string, Promise<Group>>();
  private readonly queue: Array<() => Promise<void>> = [];
  private activeLoads = 0;
  private disposed = false;
  private focused: MonumentPayload | null = null;
  private focusedUntil = 0;
  private lastTick = 0;
  private policy: MonumentQualityPolicy;

  public constructor(private readonly options: { assetBase: string; camera: PerspectiveCamera; policy: MonumentQualityPolicy; root: HTMLElement }) {
    this.policy = options.policy;
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(DRACO_DECODER_URL);
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.syncDiagnostics();
  }

  public register(group: Group, monument: MonumentPayload, localGroundY: number): void {
    const metadata = monumentModelMetadata(monument.prefab);
    if (!metadata) return;
    this.bindings.push({
      group, monument, metadata, localGroundY,
      fallback: group.children.filter((child) => child.name !== "monument-title"),
      map: null, mid: null, close: null, desired: "fallback", loading: new Set(), failed: new Set(),
    });
  }

  public setPolicy(policy: MonumentQualityPolicy): void {
    this.policy = policy;
    this.lastTick = 0;
    this.syncDiagnostics();
  }

  public focus(monument: MonumentPayload): void {
    this.focused = monument;
    this.focusedUntil = performance.now() + 15000;
    this.lastTick = 0;
  }

  public tick(now: number): void {
    if (this.disposed || now - this.lastTick < 250) return;
    this.lastTick = now;
    const viewportHeight = Math.max(1, this.options.root.clientHeight || window.innerHeight);
    const ranked = prioritizeMonuments(this.bindings.map((binding) => ({
      binding,
      distance: this.options.camera.position.distanceTo(binding.group.position),
      focused: now < this.focusedUntil && binding.monument === this.focused,
      projectedDiameter: projectedMonumentDiameter(
        this.structuralRadius(binding),
        this.options.camera.position.distanceTo(binding.group.position),
        this.options.camera.fov,
        viewportHeight,
      ),
    })));

    const mapSet = new Set<MonumentBinding>();
    const midSet = new Set<MonumentBinding>();
    const closeSet = new Set<MonumentBinding>();
    const requestedTiers = new Map<MonumentBinding, Exclude<MonumentLodTier, "fallback">>();
    let activeTriangles = 0;
    let activeDrawCalls = 0;

    for (const item of ranked.slice(0, this.policy.activeMapLimit)) {
      const tier = item.binding.metadata.tiers.map;
      if (!monumentTierFitsBudget(
        { triangles: activeTriangles, drawCalls: activeDrawCalls },
        { triangles: 0, drawCalls: 0 },
        tier,
        this.policy,
      )) continue;
      mapSet.add(item.binding);
      activeTriangles += tier.triangles;
      activeDrawCalls += tier.drawCalls;
    }

    for (const item of ranked) {
      if (!mapSet.has(item.binding)) continue;
      let requested = desiredMonumentTier(item.projectedDiameter, item.binding.desired, this.policy, item.focused);
      if (this.policy.requested === "detailed") requested = "close";
      requestedTiers.set(item.binding, requested);
    }

    const closeRanked = this.policy.requested === "detailed"
      ? [...ranked].sort((a, b) => Number(b.focused) - Number(a.focused) || a.distance - b.distance)
      : ranked;
    for (const item of closeRanked) {
      if (!mapSet.has(item.binding)) continue;
      const requested = requestedTiers.get(item.binding) || "map";
      if (requested !== "close" || closeSet.size >= this.policy.activeCloseLimit) continue;
      const mapTier = item.binding.metadata.tiers.map;
      const closeTier = item.binding.metadata.tiers.close;
      const triangleDelta = Math.max(0, closeTier.triangles - mapTier.triangles);
      const drawCallDelta = Math.max(0, closeTier.drawCalls - mapTier.drawCalls);
      if (!monumentTierFitsBudget(
        { triangles: activeTriangles, drawCalls: activeDrawCalls },
        mapTier,
        closeTier,
        this.policy,
      )) continue;
      closeSet.add(item.binding);
      activeTriangles += triangleDelta;
      activeDrawCalls += drawCallDelta;
    }

    for (const item of ranked) {
      if (!mapSet.has(item.binding) || closeSet.has(item.binding) || midSet.size >= this.policy.activeMidLimit) continue;
      const requested = requestedTiers.get(item.binding) || "map";
      if (requested === "map") continue;
      const mapTier = item.binding.metadata.tiers.map;
      const midTier = item.binding.metadata.tiers.mid;
      const triangleDelta = Math.max(0, midTier.triangles - mapTier.triangles);
      const drawCallDelta = Math.max(0, midTier.drawCalls - mapTier.drawCalls);
      if (!monumentTierFitsBudget(
        { triangles: activeTriangles, drawCalls: activeDrawCalls },
        mapTier,
        midTier,
        this.policy,
      )) continue;
      midSet.add(item.binding);
      activeTriangles += triangleDelta;
      activeDrawCalls += drawCallDelta;
    }

    for (const { binding } of ranked) {
      this.setDesired(binding, closeSet.has(binding) ? "close" : midSet.has(binding) ? "mid" : mapSet.has(binding) ? "map" : "fallback");
    }

    const preloadMidAt = this.policy.mapToMidPixels * (1 - this.policy.hysteresis);
    const preloadCloseAt = this.policy.midToClosePixels * (1 - this.policy.hysteresis);
    if (this.policy.activeMidLimit > 0) {
      ranked.filter((item) => mapSet.has(item.binding) && item.projectedDiameter >= preloadMidAt)
        .slice(0, this.policy.activeMidLimit + 2)
        .forEach((item) => this.preload(item.binding, "mid"));
    }
    if (this.policy.activeCloseLimit > 0) {
      ranked.filter((item) => mapSet.has(item.binding) && item.projectedDiameter >= preloadCloseAt)
        .slice(0, this.policy.activeCloseLimit + 1)
        .forEach((item) => this.preload(item.binding, "close"));
    }

    this.evict("close", this.policy.closeCacheLimit);
    this.evict("mid", this.policy.midCacheLimit);
    this.evict("map", this.policy.activeMapLimit + 2);
    this.syncDiagnostics();
  }

  public dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    for (const binding of this.bindings) {
      this.detach(binding, "close");
      this.detach(binding, "mid");
      this.detach(binding, "map");
    }
    for (const entry of this.cache.values()) this.disposeSource(entry.source);
    this.cache.clear();
    this.bindings.length = 0;
    this.draco.dispose();
    this.syncDiagnostics();
  }

  private setDesired(binding: MonumentBinding, desired: MonumentBinding["desired"]): void {
    binding.desired = desired;
    if (desired !== "close") this.detach(binding, "close");
    if (desired === "map" || desired === "fallback") this.detach(binding, "mid");
    if (desired === "fallback") this.detach(binding, "map");
    if (desired !== "fallback") this.ensure(binding, "map");
    if (desired === "mid" || desired === "close") this.ensure(binding, "mid");
    if (desired === "close") this.ensure(binding, "close");
    this.applyVisibility(binding);
  }

  private ensure(binding: MonumentBinding, tier: MonumentModelTier): void {
    if (binding[tier] || binding.loading.has(tier) || binding.failed.has(tier) || this.disposed) return;
    binding.loading.add(tier);
    this.queue.push(async () => {
      try {
        const source = await this.load(binding, tier);
        if (this.disposed || this.tierRank(binding.desired) < this.tierRank(tier)) {
          if (this.disposed) this.disposeSource(source);
          return;
        }
        const model = source.clone(true);
        model.name = `monument-${tier}-${binding.metadata.id}`;
        model.position.set(0, binding.localGroundY, 0);
        model.traverse((object) => {
          if (object instanceof Mesh) {
            object.castShadow = tier === "close" && this.policy.shadows;
            object.receiveShadow = tier === "close" && this.policy.shadows;
            object.userData.preserveSharedVehicleAsset = true;
          } else if ((object as Object3D & { isLight?: boolean }).isLight) object.visible = false;
        });
        binding.group.add(model);
        binding[tier] = model;
        const cached = this.cache.get(this.key(binding, tier));
        if (cached) cached.active++;
      } catch (error) {
        binding.failed.add(tier);
        console.warn(`Raidlands map viewer could not load ${binding.metadata.id} ${tier} LOD; keeping a lower tier.`, error);
      } finally {
        binding.loading.delete(tier);
        this.applyVisibility(binding);
      }
    });
    this.pump();
  }

  private preload(binding: MonumentBinding, tier: MonumentModelTier): void {
    if (binding[tier] || binding.loading.has(tier) || binding.failed.has(tier) || this.cache.has(this.key(binding, tier)) || this.disposed) return;
    binding.loading.add(tier);
    this.queue.push(async () => {
      try {
        await this.load(binding, tier);
      } catch (error) {
        binding.failed.add(tier);
        console.warn(`Raidlands map viewer could not preload ${binding.metadata.id} ${tier} LOD; retaining the current tier.`, error);
      } finally {
        binding.loading.delete(tier);
      }
    });
    this.pump();
  }

  private async load(binding: MonumentBinding, tier: MonumentModelTier): Promise<Group> {
    const key = this.key(binding, tier);
    const cached = this.cache.get(key);
    if (cached) { cached.lastUsed = performance.now(); return cached.source; }
    const pending = this.pending.get(key);
    if (pending) return pending;
    const base = new URL(this.options.assetBase, window.location.href);
    const tierMetadata = binding.metadata.tiers[tier];
    const path = binding.metadata.reviewStatus === "approved"
      ? tierMetadata.url
      : `media/models/monuments-lod/${tier === "map" ? binding.metadata.legacy.map : binding.metadata.legacy.detail}`;
    const hash = binding.metadata.reviewStatus === "approved"
      ? tierMetadata.sha256
      : tier === "map" ? tierMetadata.sha256 : binding.metadata.sourceSha256;
    const url = new URL(path, base);
    url.searchParams.set("v", hash.slice(0, 12));
    const promise = this.loader.loadAsync(url.href).then((gltf) => {
      const source = gltf.scene;
      if (!this.disposed) this.cache.set(key, { source, active: 0, lastUsed: performance.now() });
      return source;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  private pump(): void {
    while (!this.disposed && this.activeLoads < this.policy.decodeConcurrency && this.queue.length) {
      const task = this.queue.shift()!;
      this.activeLoads++;
      void task().finally(() => { this.activeLoads--; this.pump(); });
    }
  }

  private detach(binding: MonumentBinding, tier: MonumentModelTier): void {
    const model = binding[tier];
    if (!model) return;
    binding.group.remove(model);
    binding[tier] = null;
    const cached = this.cache.get(this.key(binding, tier));
    if (cached) { cached.active = Math.max(0, cached.active - 1); cached.lastUsed = performance.now(); }
  }

  private applyVisibility(binding: MonumentBinding): void {
    const loaded = new Set<MonumentModelTier>();
    for (const tier of ["map", "mid", "close"] as MonumentModelTier[]) if (binding[tier]) loaded.add(tier);
    const visible = visibleMonumentTier(binding.desired, loaded);
    binding.close && (binding.close.visible = visible === "close");
    binding.mid && (binding.mid.visible = visible === "mid");
    binding.map && (binding.map.visible = visible === "map");
    for (const child of binding.fallback) child.visible = visible === "fallback";
    binding.group.userData.primitiveKind = visible === "fallback" ? "fallback" : `${visible}-lod`;
    binding.group.userData.monumentLodTier = visible;
  }

  private evict(tier: MonumentModelTier, limit: number): void {
    const keys = monumentCacheEvictionKeys([...this.cache.entries()].map(([key, entry]) => ({ key, ...entry })), tier, limit);
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (!entry) continue;
      this.disposeSource(entry.source);
      this.cache.delete(key);
    }
  }

  private key(binding: MonumentBinding, tier: MonumentModelTier): string { return `${tier}:${binding.metadata.id}`; }

  private structuralRadius(binding: MonumentBinding): number {
    const { min, max } = binding.metadata.tiers.close.structuralBounds;
    return Math.max(1, ...[0, 1, 2].map((axis) => Math.abs((max[axis] || 0) - (min[axis] || 0)) / 2));
  }

  private tierRank(tier: MonumentLodTier | MonumentModelTier): number {
    return tier === "close" ? 3 : tier === "mid" ? 2 : tier === "map" ? 1 : 0;
  }

  private visibleTier(binding: MonumentBinding): MonumentLodTier {
    return binding.close?.visible ? "close" : binding.mid?.visible ? "mid" : binding.map?.visible ? "map" : "fallback";
  }

  private disposeSource(source: Group): void {
    source.traverse((object) => {
      if (object instanceof Mesh || object instanceof Sprite || object instanceof LineSegments) disposeGeometryMaterial(object as Mesh | Sprite | LineSegments);
    });
  }

  private syncDiagnostics(): void {
    const active = this.bindings.map((binding) => ({ binding, tier: this.visibleTier(binding) }));
    const activeMap = active.filter((entry) => entry.tier === "map").length;
    const activeMid = active.filter((entry) => entry.tier === "mid").length;
    const activeClose = active.filter((entry) => entry.tier === "close").length;
    const triangles = active.reduce((sum, { binding, tier }) => sum
      + (tier === "fallback" ? 0 : binding.metadata.tiers[tier].triangles), 0);
    const drawCalls = active.reduce((sum, { binding, tier }) => sum
      + (tier === "fallback" ? 0 : binding.metadata.tiers[tier].drawCalls), 0);
    const activeBytes = active.reduce((sum, { binding, tier }) => sum
      + (tier === "fallback" ? 0 : binding.metadata.tiers[tier].bytes), 0);
    const loadedBytes = [...this.cache.keys()].reduce((sum, key) => {
      const [tier, id] = key.split(":") as [MonumentModelTier, string];
      const metadata = this.bindings.find((binding) => binding.metadata.id === id)?.metadata;
      return sum + (metadata?.tiers[tier]?.bytes || 0);
    }, 0);
    const failures = this.bindings.reduce((sum, binding) => sum + binding.failed.size, 0);
    Object.assign(this.options.root.dataset, {
      monumentModeRequested: this.policy.requested,
      monumentModeResolved: this.policy.resolved,
      monumentManifestVersion: String(monumentModelManifestVersion()),
      monumentRecipeVersion: String(monumentModelRecipeVersion()),
      monumentSourceRevision: monumentModelSourceRevision(),
      monumentMapLoaded: String(activeMap), monumentMidLoaded: String(activeMid), monumentCloseLoaded: String(activeClose),
      monumentDetailLoaded: String(activeMid + activeClose),
      monumentCacheEntries: String(this.cache.size), monumentFailedAssets: String(failures),
      monumentApproxTriangles: String(triangles), monumentApproxDrawCalls: String(drawCalls),
      monumentActiveBytes: String(activeBytes), monumentLoadedBytes: String(loadedBytes),
      monumentTriangleBudget: String(this.policy.triangleBudget), monumentDrawCallBudget: String(this.policy.drawCallBudget),
      monumentDecodeQueue: String(this.queue.length + this.activeLoads),
      monumentActiveAssets: JSON.stringify(active.filter((entry) => entry.tier !== "fallback").map((entry) => {
        const tier = entry.tier as MonumentModelTier;
        const metadata = entry.binding.metadata.tiers[tier];
        return { id: entry.binding.metadata.id, tier, url: metadata.url, hash: metadata.sha256.slice(0, 12) };
      })),
    });
  }
}

function createMonumentPrimitive(monument: MonumentPayload, placement?: MonumentPrimitivePlacement): Group {
  const group = new Group();
  const key = monumentKey(monument);
  const primitiveKind = monumentPrimitiveKind(monument);
  const size = monumentPrimitiveSize(monument, monument.radius);

  group.name = `monument-${key}`;
  group.userData.primitiveKind = primitiveKind;
  const addTitle = () => {
    group.add(createMonumentTitleSprite(monument.name, size));
    return group;
  };

  if (primitiveKind === "airfield") {
    createAirfieldMonumentPrimitive(group, size);
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

  if (primitiveKind === "sphere-tank") {
    createSphereTankMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "satellite-dish") {
    createSatelliteDishMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "lighthouse") {
    createLighthouseMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("oilrig") || key.includes("oil_rig")) {
    createOilRigMonumentPrimitive(group, size);
    group.scale.y = 0.58;
    const titledGroup = addTitle();
    const title = titledGroup.getObjectByName("monument-title");
    if (title) {
      title.scale.y *= 1 / 0.58;
    }
    return titledGroup;
  }

  if (key.includes("harbor")) {
    createHarborMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("junkyard") || key.includes("junk_yard")) {
    createJunkyardMonumentPrimitive(group, size, placement);
    return addTitle();
  }

  if (key.includes("radtown")) {
    createRadtownMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("ferry_terminal") || key.includes("ferryterminal")) {
    createFerryTerminalMonumentPrimitive(group, size * 1.45);
    return addTitle();
  }

  if (key.includes("fishing_village") || key.includes("fishingvillage")) {
    createFishingVillageMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("stables") || key.includes("large_barn") || key.includes("ranch")) {
    createStablesMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("arctic_research") || key.includes("arcticresearch")) {
    createArcticResearchBaseMonumentPrimitive(group, size * 1.35);
    return addTitle();
  }

  if (key.includes("ziggurat")) {
    createJungleZigguratMonumentPrimitive(group, size * 1.35);
    return addTitle();
  }

  if (key.includes("bandit") || key.includes("banditcamp") || key.includes("bandit_camp")) {
    createBanditCampMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("apartment") || key.includes("apartments")) {
    // Apartment complexes occupy a full city block in-world; give the map proxy
    // enough footprint to read at the same zoom as the other large monuments.
    createApartmentComplexMonumentPrimitive(group, size * 2);
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
    group.scale.set(0.72, 0.72, 0.72);
    const titledGroup = addTitle();
    const title = titledGroup.getObjectByName("monument-title");
    if (title) {
      title.scale.multiplyScalar(1 / 0.72);
    }
    return titledGroup;
  }

  if (primitiveKind === "power-plant") {
    createPowerPlantMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "substation") {
    createSubstationMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("excavator")) {
    createExcavatorMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "train-yard") {
    createTrainYardMonumentPrimitive(group, size);
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

  if (primitiveKind === "military-tunnels") {
    createMilitaryTunnelsMonumentPrimitive(group, size);
    return addTitle();
  }

  if (key.includes("cave_")) {
    createCaveEntranceMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "bunker") {
    createBunkerMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "gas-station") {
    createGasStationMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "supermarket") {
    createSupermarketMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "warehouse") {
    createWarehouseMonumentPrimitive(group, size);
    return addTitle();
  }

  if (primitiveKind === "quarry") {
    createQuarryMonumentPrimitive(group, size);
    return addTitle();
  }

  createGenericMonumentPrimitive(group, size);
  return addTitle();
}

function createAirfieldMonumentPrimitive(group: Group, size: number): void {
  const asphalt = 0x292d2e;
  const concrete = 0x777970;
  const fadedConcrete = 0x989386;
  const hangar = 0x696c66;
  const rust = 0x8b4c35;
  const marking = 0xd7d0ad;

  // Long runway, parallel taxiway, and concrete aprons dominate the overhead view.
  addBox(group, size * 2.18, size * 0.025, size * 0.24, asphalt, 0, size * 0.015, size * 0.24);
  addBox(group, size * 1.8, size * 0.02, size * 0.12, asphalt, -size * 0.08, size * 0.014, -size * 0.23);
  addBox(group, size * 0.82, size * 0.018, size * 0.58, concrete, -size * 0.42, size * 0.012, -size * 0.3);
  for (let x = -0.86; x <= 0.86; x += 0.22) {
    addBox(group, size * 0.095, size * 0.008, size * 0.018, marking, size * x, size * 0.033, size * 0.24);
  }
  [-0.98, 0.98].forEach((x) => {
    for (const z of [0.18, 0.24, 0.3]) addBox(group, size * 0.11, size * 0.009, size * 0.014, marking, size * x, size * 0.034, size * z);
  });

  // Three broad, low hangars sit together along the apron.
  [-0.72, -0.24, 0.24].forEach((x, index) => {
    addBox(group, size * 0.36, size * 0.2, size * 0.32, index === 1 ? fadedConcrete : hangar, size * x, size * 0.12, -size * 0.48);
    addPitchedRoof(group, size * 0.4, size * 0.34, size * 0.06, rust, size * x, size * 0.245, -size * 0.48);
    addBox(group, size * 0.22, size * 0.12, size * 0.015, 0x222827, size * x, size * 0.1, -size * 0.65);
  });

  // Office block and control tower form the recognizable east-side skyline.
  addBox(group, size * 0.42, size * 0.2, size * 0.25, concrete, size * 0.7, size * 0.12, -size * 0.42);
  addBox(group, size * 0.18, size * 0.52, size * 0.18, fadedConcrete, size * 0.83, size * 0.3, -size * 0.16);
  addBox(group, size * 0.26, size * 0.12, size * 0.26, 0x434b4b, size * 0.83, size * 0.63, -size * 0.16);
  addBox(group, size * 0.3, size * 0.035, size * 0.3, rust, size * 0.83, size * 0.72, -size * 0.16);
  addCylinder(group, size * 0.018, size * 0.34, rust, size * 0.83, size * 0.9, -size * 0.16);
}

function createSphereTankMonumentPrimitive(group: Group, size: number): void {
  const steel = 0x9ba49d;
  const rust = 0x86513b;
  const concrete = 0x817f73;
  const pipe = 0x626b68;

  addBox(group, size * 1.2, size * 0.025, size * 0.84, concrete, 0, size * 0.015, 0);
  const tankY = size * 0.55;
  addSphere(group, size * 0.34, steel, -size * 0.1, tankY, 0);
  for (const [x, z] of [[-0.25, -0.16], [0.05, -0.16], [-0.25, 0.16], [0.05, 0.16]]) {
    const leg = addBox(group, size * 0.035, size * 0.42, size * 0.035, rust, size * x, size * 0.22, size * z);
    leg.rotation.z = MathUtils.degToRad(x < -0.1 ? -7 : 7);
  }
  const catwalk = new Mesh(new RingGeometry(size * 0.35, size * 0.39, 28), monumentMaterial(rust));
  catwalk.position.set(-size * 0.1, tankY, 0);
  catwalk.rotation.x = -Math.PI / 2;
  group.add(catwalk);
  addCylinder(group, size * 0.025, size * 0.5, pipe, size * 0.38, size * 0.26, 0);
  addBox(group, size * 0.48, size * 0.035, size * 0.035, pipe, size * 0.15, size * 0.16, 0);
  addBox(group, size * 0.32, size * 0.18, size * 0.24, 0x676a62, size * 0.42, size * 0.11, -size * 0.26);
}

function createSatelliteDishMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x77786e;
  const steel = 0x9ba39d;
  const dark = 0x414947;
  const rust = 0x86513b;

  addBox(group, size * 1.42, size * 0.025, size * 0.92, concrete, 0, size * 0.015, 0);
  [[-0.42, -0.05, 54], [0.42, 0.08, -54]].forEach(([x, z, tilt]) => {
    addCylinder(group, size * 0.065, size * 0.42, dark, size * x, size * 0.22, size * z);
    addBox(group, size * 0.28, size * 0.07, size * 0.24, rust, size * x, size * 0.43, size * z);
    const dish = addCone(group, size * 0.28, size * 0.12, steel, size * x, size * 0.58, size * z);
    dish.rotation.x = MathUtils.degToRad(tilt);
    const feed = addCylinder(group, size * 0.018, size * 0.25, dark, size * x, size * 0.7, size * z);
    feed.rotation.x = MathUtils.degToRad(tilt);
  });
  addBox(group, size * 0.38, size * 0.18, size * 0.25, dark, 0, size * 0.11, -size * 0.36);
  addBox(group, size * 0.42, size * 0.035, size * 0.29, rust, 0, size * 0.22, -size * 0.36);
}

function createLighthouseMonumentPrimitive(group: Group, size: number): void {
  const stone = 0x666258;
  const plaster = 0xd0c8b0;
  const red = 0x914333;
  const dark = 0x2e3332;

  addCone(group, size * 0.5, size * 0.2, stone, 0, size * 0.1, 0);
  addBox(group, size * 0.48, size * 0.2, size * 0.34, stone, size * 0.24, size * 0.18, size * 0.14);
  addPitchedRoof(group, size * 0.52, size * 0.38, size * 0.06, red, size * 0.24, size * 0.31, size * 0.14);
  const tower = new Mesh(new CylinderGeometry(size * 0.11, size * 0.18, size * 0.95, 18), monumentMaterial(plaster));
  tower.position.set(-size * 0.08, size * 0.66, -size * 0.04);
  group.add(tower);
  [0.42, 0.66, 0.88].forEach((y) => addBox(group, size * 0.025, size * 0.065, size * 0.01, dark, -size * 0.08, size * y, -size * 0.145));
  addCylinder(group, size * 0.16, size * 0.055, red, -size * 0.08, size * 1.16, -size * 0.04);
  addCylinder(group, size * 0.12, size * 0.16, 0x334143, -size * 0.08, size * 1.26, -size * 0.04);
  addCone(group, size * 0.16, size * 0.13, red, -size * 0.08, size * 1.405, -size * 0.04);
}

function createPowerPlantMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x85837a;
  const stained = 0x65665f;
  const rust = 0x8c4b35;
  const steel = 0x5e6968;
  const asphalt = 0x303536;

  addBox(group, size * 1.65, size * 0.025, size * 1.2, asphalt, 0, size * 0.015, 0);
  [-0.42, 0.38].forEach((x, index) => {
    addCoolingTower(group, size * (index ? 0.42 : 0.48), size * x, size * (index ? 0.08 : -0.08), concrete);
  });
  addBox(group, size * 0.72, size * 0.28, size * 0.3, stained, 0, size * 0.17, size * 0.46);
  addPitchedRoof(group, size * 0.76, size * 0.34, size * 0.055, rust, 0, size * 0.34, size * 0.46);
  addBox(group, size * 0.28, size * 0.48, size * 0.28, stained, size * 0.62, size * 0.26, size * 0.42);
  // Elevated red process pipes and a rail spur tie the site together.
  addBox(group, size * 1.1, size * 0.035, size * 0.035, rust, 0, size * 0.34, -size * 0.48);
  [-0.48, -0.18, 0.18, 0.48].forEach((x) => addCylinder(group, size * 0.018, size * 0.34, steel, size * x, size * 0.18, -size * 0.48));
  addRailTrack(group, size, -size * 0.52, size * 1.35);
}

function addCoolingTower(group: Group, towerSize: number, x: number, z: number, color: number): void {
  const lower = new Mesh(new CylinderGeometry(towerSize * 0.3, towerSize * 0.5, towerSize * 0.68, 22, 1, true), monumentMaterial(color));
  lower.position.set(x, towerSize * 0.34, z);
  group.add(lower);
  const upper = new Mesh(new CylinderGeometry(towerSize * 0.43, towerSize * 0.3, towerSize * 0.42, 22, 1, true), monumentMaterial(color));
  upper.position.set(x, towerSize * 0.89, z);
  group.add(upper);
  const rim = new Mesh(new RingGeometry(towerSize * 0.34, towerSize * 0.44, 22), monumentMaterial(0x5c5d58));
  rim.position.set(x, towerSize * 1.1, z);
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);
}

function createTrainYardMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x777b75;
  const dark = 0x303536;
  const rust = 0x955033;
  const steel = 0x5e696b;
  const tank = 0x7f765f;

  addBox(group, size * 1.65, size * 0.025, size * 1.15, 0x55564f, 0, size * 0.015, 0);
  [-0.48, -0.16, 0.16, 0.48].forEach((z) => addRailTrack(group, size, size * z, size * 1.55));
  addBox(group, size * 0.44, size * 0.7, size * 0.32, concrete, -size * 0.5, size * 0.36, -size * 0.04);
  addBox(group, size * 0.38, size * 0.46, size * 0.28, concrete, size * 0.48, size * 0.25, size * 0.34);
  addBox(group, size * 0.5, size * 0.24, size * 0.26, dark, size * 0.06, size * 0.14, -size * 0.44);
  addPitchedRoof(group, size * 0.54, size * 0.3, size * 0.05, rust, size * 0.06, size * 0.28, -size * 0.44);
  [-0.58, 0.05, 0.62].forEach((x, index) => addFreightCrane(group, size * 0.55, size * x, size * (index === 1 ? 0.2 : -0.2), index % 2 ? -0.12 : 0.12));
  // Water tower and short rail cars make the silhouette legible from low orbit.
  for (const [x, z] of [[0.67, -0.48], [0.78, -0.48], [0.67, -0.32], [0.78, -0.32]]) {
    addBox(group, size * 0.025, size * 0.46, size * 0.025, steel, size * x, size * 0.24, size * z);
  }
  addCylinder(group, size * 0.14, size * 0.18, tank, size * 0.725, size * 0.55, -size * 0.4);
  [[-0.2, -0.16, 0x86503a], [0.24, 0.16, 0x4d6870], [-0.42, 0.48, 0x766448]].forEach(([x, z, color]) => {
    addBox(group, size * 0.32, size * 0.11, size * 0.12, color, size * (x as number), size * 0.085, size * (z as number));
  });
}

function addRailTrack(group: Group, size: number, z: number, length: number): void {
  addBox(group, length, size * 0.018, size * 0.018, 0x202525, 0, size * 0.032, z - size * 0.035);
  addBox(group, length, size * 0.018, size * 0.018, 0x202525, 0, size * 0.032, z + size * 0.035);
  for (let x = -length * 0.46; x <= length * 0.46; x += size * 0.14) {
    addBox(group, size * 0.025, size * 0.012, size * 0.11, 0x574638, x, size * 0.018, z);
  }
}

function addFreightCrane(group: Group, craneSize: number, x: number, z: number, rotationY: number): void {
  const rust = 0x955033;
  const dark = 0x434b4c;
  [-0.15, 0.15].forEach((offset) => {
    const leg = addBox(group, craneSize * 0.035, craneSize * 0.7, craneSize * 0.035, dark, x + craneSize * offset, craneSize * 0.36, z);
    leg.rotation.z = MathUtils.degToRad(offset < 0 ? -8 : 8);
  });
  const bridge = addBox(group, craneSize * 0.62, craneSize * 0.045, craneSize * 0.06, rust, x, craneSize * 0.72, z);
  bridge.rotation.y = rotationY;
  addBox(group, craneSize * 0.025, craneSize * 0.3, craneSize * 0.025, dark, x, craneSize * 0.55, z);
}

function createMilitaryTunnelsMonumentPrimitive(group: Group, size: number): void {
  const earth = 0x5d584b;
  const concrete = 0x777970;
  const military = 0x566153;
  const dark = 0x252a29;
  const rust = 0x67483a;

  addBox(group, size * 1.55, size * 0.025, size * 1.08, earth, 0, size * 0.015, 0);
  addBox(group, size * 0.86, size * 0.025, size * 0.2, 0x353a3a, -size * 0.12, size * 0.032, size * 0.22);
  // Recessed concrete portal and dark tunnel mouth.
  addBox(group, size * 0.56, size * 0.32, size * 0.26, concrete, -size * 0.38, size * 0.18, -size * 0.38);
  addBox(group, size * 0.34, size * 0.22, size * 0.02, dark, -size * 0.38, size * 0.13, -size * 0.52);
  addBox(group, size * 0.64, size * 0.12, size * 0.34, earth, -size * 0.38, size * 0.36, -size * 0.36);
  // Loading shed, container yard, and watchtower match the visible surface complex.
  addBox(group, size * 0.46, size * 0.2, size * 0.28, military, size * 0.42, size * 0.12, -size * 0.18);
  addPitchedRoof(group, size * 0.5, size * 0.32, size * 0.05, rust, size * 0.42, size * 0.24, -size * 0.18);
  addGuardTower(group, size * 0.42, size * 0.56, size * 0.34);
  [[0.15, 0.42, 0x5b6a5c], [0.42, 0.44, 0x83503b], [0.18, 0.56, 0x525c65]].forEach(([x, z, color]) => {
    addBox(group, size * 0.28, size * 0.11, size * 0.12, color, size * (x as number), size * 0.075, size * (z as number));
  });
}

function createBunkerMonumentPrimitive(group: Group, size: number): void {
  const earth = 0x625c4d;
  const concrete = 0x777970;
  addBox(group, size * 1.05, size * 0.025, size * 0.76, earth, 0, size * 0.015, 0);
  addBox(group, size * 0.68, size * 0.18, size * 0.46, concrete, 0, size * 0.1, 0);
  addBox(group, size * 0.38, size * 0.17, size * 0.025, 0x202525, 0, size * 0.11, -size * 0.245);
  addBox(group, size * 0.18, size * 0.08, size * 0.4, 0x3e4441, 0, size * 0.21, size * 0.04);
  [-0.22, 0.22].forEach((x) => addCylinder(group, size * 0.035, size * 0.22, 0x555f5b, size * x, size * 0.28, size * 0.08));
}

function createGasStationMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x8a887d;
  const wall = 0xb1aa91;
  const oxum = 0xb86435;
  const dark = 0x343a39;

  addBox(group, size * 1.18, size * 0.025, size * 0.82, concrete, 0, size * 0.015, 0);
  addBox(group, size * 0.58, size * 0.28, size * 0.4, wall, size * 0.2, size * 0.15, size * 0.12);
  addBox(group, size * 0.28, size * 0.22, size * 0.035, dark, size * 0.34, size * 0.13, size * 0.335);
  addBox(group, size * 0.24, size * 0.22, size * 0.035, 0x506063, size * 0.02, size * 0.13, size * 0.335);
  addBox(group, size * 0.64, size * 0.045, size * 0.46, oxum, size * 0.2, size * 0.32, size * 0.12);
  // Roadside pump canopy with two fuel islands.
  addBox(group, size * 0.62, size * 0.045, size * 0.28, oxum, -size * 0.26, size * 0.3, -size * 0.3);
  [-0.48, -0.04].forEach((x) => {
    addBox(group, size * 0.03, size * 0.28, size * 0.03, dark, size * x, size * 0.16, -size * 0.3);
    addBox(group, size * 0.08, size * 0.12, size * 0.06, 0x8b4d35, size * x, size * 0.08, -size * 0.3);
  });
  addCylinder(group, size * 0.025, size * 0.5, dark, -size * 0.48, size * 0.27, size * 0.3);
  addBox(group, size * 0.22, size * 0.16, size * 0.035, oxum, -size * 0.48, size * 0.52, size * 0.3);
}

function createSupermarketMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x88877d;
  const wall = 0xb2ad94;
  const green = 0x536b55;
  const orange = 0xb56b3c;
  const dark = 0x333a39;

  addBox(group, size * 1.18, size * 0.025, size * 0.88, concrete, 0, size * 0.015, 0);
  addBox(group, size * 0.78, size * 0.3, size * 0.52, wall, 0, size * 0.17, 0);
  addBox(group, size * 0.84, size * 0.045, size * 0.58, green, 0, size * 0.34, 0);
  addBox(group, size * 0.8, size * 0.055, size * 0.025, orange, 0, size * 0.25, -size * 0.272);
  [-0.24, 0, 0.24].forEach((x) => addBox(group, size * 0.2, size * 0.13, size * 0.018, dark, size * x, size * 0.12, -size * 0.282));
  [-0.22, 0.22].forEach((x) => addBox(group, size * 0.16, size * 0.07, size * 0.13, 0x626965, size * x, size * 0.405, 0));
  // Faded parking bays reinforce the broad roadside footprint.
  [-0.36, -0.12, 0.12, 0.36].forEach((x) => addBox(group, size * 0.012, size * 0.006, size * 0.2, 0xc6c09e, size * x, size * 0.032, -size * 0.38));
}

function createWarehouseMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x7d7d74;
  const sheet = 0x65706d;
  const rust = 0x874b35;
  const dark = 0x303635;

  addBox(group, size * 1.22, size * 0.025, size * 0.86, concrete, 0, size * 0.015, 0);
  addBox(group, size * 0.86, size * 0.34, size * 0.5, sheet, -size * 0.08, size * 0.19, 0);
  addPitchedRoof(group, size * 0.92, size * 0.56, size * 0.07, rust, -size * 0.08, size * 0.4, 0);
  [-0.32, 0, 0.32].forEach((x) => addBox(group, size * 0.2, size * 0.19, size * 0.022, dark, size * x - size * 0.08, size * 0.12, -size * 0.262));
  addBox(group, size * 0.34, size * 0.18, size * 0.26, 0x5a615d, size * 0.48, size * 0.11, size * 0.2);
  [[0.44, -0.26, 0x9a5c37], [0.53, -0.08, 0x4d6768], [0.42, 0.04, 0x59664f]].forEach(([x, z, color]) => {
    addBox(group, size * 0.18, size * 0.1, size * 0.12, color, size * (x as number), size * 0.07, size * (z as number));
  });
}

function createQuarryMonumentPrimitive(group: Group, size: number): void {
  const earth = 0x625b4a;
  const rust = 0x8d4f31;
  const dark = 0x343a38;
  const steel = 0x646d6a;

  addBox(group, size * 1.22, size * 0.025, size * 0.9, earth, 0, size * 0.015, 0);
  const pit = new Mesh(new RingGeometry(size * 0.25, size * 0.46, 28), monumentMaterial(0x514a3e));
  pit.rotation.x = -Math.PI / 2;
  pit.position.set(-size * 0.2, size * 0.035, 0);
  group.add(pit);
  addCylinder(group, size * 0.15, size * 0.1, 0x292e2c, -size * 0.2, size * 0.045, 0);
  // Quarry engine, tall frame, angled bucket boom, and output conveyor.
  addBox(group, size * 0.32, size * 0.2, size * 0.26, dark, size * 0.3, size * 0.12, size * 0.12);
  [-0.12, 0.12].forEach((z) => addBox(group, size * 0.035, size * 0.62, size * 0.035, steel, size * 0.22, size * 0.34, size * z));
  addBox(group, size * 0.38, size * 0.04, size * 0.28, rust, size * 0.22, size * 0.65, 0);
  const boom = addBox(group, size * 0.72, size * 0.05, size * 0.08, rust, -size * 0.04, size * 0.48, 0);
  boom.rotation.z = MathUtils.degToRad(-24);
  addCylinder(group, size * 0.11, size * 0.07, dark, -size * 0.36, size * 0.31, 0).rotation.x = Math.PI / 2;
  const conveyor = addBox(group, size * 0.62, size * 0.045, size * 0.12, rust, size * 0.26, size * 0.2, -size * 0.32);
  conveyor.rotation.z = MathUtils.degToRad(12);
  addCone(group, size * 0.15, size * 0.28, steel, size * 0.54, size * 0.22, -size * 0.32);
}

function createRadtownMonumentPrimitive(group: Group, size: number): void {
  const road = 0x34383a;
  const concrete = 0x77776e;
  const brick = 0x81513e;
  const rust = 0x9a4e31;
  const steel = 0x596567;
  const dark = 0x282e2f;

  addBox(group, size * 1.72, size * 0.025, size * 1.18, road, 0, size * 0.015, 0);
  addBox(group, size * 0.68, size * 0.34, size * 0.34, brick, -size * 0.36, size * 0.19, -size * 0.24);
  addPitchedRoof(group, size * 0.72, size * 0.38, size * 0.065, rust, -size * 0.36, size * 0.41, -size * 0.24);
  addBox(group, size * 0.46, size * 0.55, size * 0.34, concrete, size * 0.42, size * 0.29, size * 0.16);
  addBox(group, size * 0.52, size * 0.055, size * 0.4, rust, size * 0.42, size * 0.59, size * 0.16);
  addBox(group, size * 0.54, size * 0.22, size * 0.28, steel, size * 0.12, size * 0.13, -size * 0.42);
  [-0.54, -0.38, -0.22].forEach((x) => addCylinder(group, size * 0.055, size * 0.3, steel, size * x, size * 0.17, size * 0.3));
  addCylinder(group, size * 0.07, size * 0.8, rust, size * 0.66, size * 0.41, -size * 0.32);
  addCylinder(group, size * 0.1, size * 0.055, dark, size * 0.66, size * 0.82, -size * 0.32);
  addGuardTower(group, size * 0.42, -size * 0.68, size * 0.38);
  [[-0.05, 0.4, 0x4f684e], [0.2, 0.43, 0x9b5936], [0.46, -0.42, 0x526a70]].forEach(([x, z, color]) => {
    addBox(group, size * 0.25, size * 0.11, size * 0.13, color, size * Number(x), size * 0.075, size * Number(z));
  });
}

function createFerryTerminalMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x969387;
  const asphalt = 0x303638;
  const steel = 0x59666a;
  const rust = 0x8f5036;
  const glass = 0x3e555c;
  const marking = 0xd2c99c;

  addBox(group, size * 1.75, size * 0.025, size * 1.05, asphalt, 0, size * 0.015, 0);
  addBox(group, size * 0.9, size * 0.035, size * 0.46, concrete, size * 0.38, size * 0.035, size * 0.27);
  [-0.28, -0.12, 0.04, 0.2].forEach((z) => addBox(group, size * 1.35, size * 0.008, size * 0.012, marking, -size * 0.08, size * 0.04, size * z));
  addBox(group, size * 0.74, size * 0.28, size * 0.3, concrete, -size * 0.38, size * 0.16, -size * 0.28);
  addBox(group, size * 0.8, size * 0.05, size * 0.36, rust, -size * 0.38, size * 0.33, -size * 0.28);
  addBox(group, size * 0.42, size * 0.2, size * 0.025, glass, -size * 0.38, size * 0.18, -size * 0.445);
  // Twin loading ramps and their overhead gantries make the ferry terminal legible from orbit.
  [-0.38, 0.38].forEach((x) => {
    const ramp = addBox(group, size * 0.32, size * 0.035, size * 0.72, steel, size * x, size * 0.11, size * 0.22);
    ramp.rotation.x = MathUtils.degToRad(-7);
    [-0.13, 0.13].forEach((dx) => addBox(group, size * 0.025, size * 0.55, size * 0.025, rust, size * x + size * dx, size * 0.3, -size * 0.02));
    addBox(group, size * 0.34, size * 0.035, size * 0.05, rust, size * x, size * 0.58, -size * 0.02);
  });
  addBox(group, size * 0.17, size * 0.62, size * 0.17, concrete, size * 0.68, size * 0.32, -size * 0.32);
  addBox(group, size * 0.24, size * 0.13, size * 0.24, glass, size * 0.68, size * 0.68, -size * 0.32);
}

function createFishingVillageMonumentPrimitive(group: Group, size: number): void {
  const wood = 0x75583e;
  const darkWood = 0x3e3329;
  const roof = 0x8b4c35;
  const tarp = 0x42637a;

  const pier = addBox(group, size * 1.5, size * 0.055, size * 0.2, wood, 0, size * 0.12, 0);
  pier.rotation.y = MathUtils.degToRad(4);
  [-0.62, -0.3, 0, 0.3, 0.62].forEach((x) => {
    [-0.07, 0.07].forEach((z) => addBox(group, size * 0.025, size * 0.34, size * 0.025, darkWood, size * x, size * 0.02, size * z));
  });
  [[-0.4, -0.24, 0.4], [0.08, 0.25, -0.2], [0.5, -0.2, 0.25]].forEach(([x, z, rotation], index) => {
    const hut = addBox(group, size * 0.32, size * 0.22, size * 0.28, index === 1 ? 0x67675b : wood, size * x, size * 0.27, size * z);
    hut.rotation.y = rotation;
    addPitchedRoof(group, size * 0.36, size * 0.32, size * 0.055, index === 2 ? tarp : roof, size * x, size * 0.41, size * z);
  });
  addCylinder(group, size * 0.025, size * 0.55, darkWood, -size * 0.65, size * 0.38, size * 0.18);
  const sign = addBox(group, size * 0.22, size * 0.12, size * 0.025, tarp, -size * 0.65, size * 0.62, size * 0.18);
  sign.rotation.y = MathUtils.degToRad(-10);
}

function createStablesMonumentPrimitive(group: Group, size: number): void {
  const dirt = 0x665b47;
  const timber = 0x71523a;
  const darkWood = 0x3f3125;
  const roof = 0x8d4932;

  addBox(group, size * 1.55, size * 0.02, size * 1.08, dirt, 0, size * 0.012, 0);
  addBox(group, size * 0.82, size * 0.38, size * 0.46, timber, -size * 0.18, size * 0.21, -size * 0.14);
  addPitchedRoof(group, size * 0.9, size * 0.52, size * 0.075, roof, -size * 0.18, size * 0.46, -size * 0.14);
  addBox(group, size * 0.2, size * 0.28, size * 0.025, darkWood, -size * 0.18, size * 0.16, -size * 0.385);
  // Open paddocks and fence rails provide the broad stable footprint missing from a generic shed.
  [[0.42, -0.3], [0.42, 0.28], [-0.42, 0.35]].forEach(([cx, cz], index) => {
    const width = size * (index === 2 ? 0.42 : 0.5);
    const depth = size * 0.34;
    [-1, 1].forEach((side) => {
      addBox(group, width, size * 0.018, size * 0.018, darkWood, size * cx, size * 0.16, size * cz + side * depth / 2);
      addBox(group, size * 0.018, size * 0.18, size * 0.018, darkWood, size * cx - width / 2, size * 0.1, size * cz + side * depth / 2);
      addBox(group, size * 0.018, size * 0.18, size * 0.018, darkWood, size * cx + width / 2, size * 0.1, size * cz + side * depth / 2);
    });
  });
  addCylinder(group, size * 0.11, size * 0.18, 0x696b62, size * 0.58, size * 0.12, size * 0.46);
}

function createArcticResearchBaseMonumentPrimitive(group: Group, size: number): void {
  const snow = 0xd2d7d5;
  const steel = 0x687578;
  const blue = 0x315b72;
  const orange = 0xb76435;
  const dark = 0x263236;

  addBox(group, size * 1.45, size * 0.025, size * 1.1, snow, 0, size * 0.015, 0);
  [[-0.35, -0.18], [0.25, -0.2], [-0.05, 0.3]].forEach(([x, z], index) => {
    addBox(group, size * 0.48, size * 0.25, size * 0.3, index === 1 ? blue : steel, size * x, size * 0.15, size * z);
    addBox(group, size * 0.52, size * 0.045, size * 0.34, orange, size * x, size * 0.3, size * z);
  });
  addCylinder(group, size * 0.075, size * 0.56, dark, size * 0.5, size * 0.3, size * 0.22);
  const dish = addCone(group, size * 0.22, size * 0.1, snow, size * 0.5, size * 0.64, size * 0.22);
  dish.rotation.x = MathUtils.degToRad(55);
  addBox(group, size * 0.24, size * 0.15, size * 0.16, blue, -size * 0.55, size * 0.1, size * 0.32);
  addGuardTower(group, size * 0.32, -size * 0.58, -size * 0.38);
}

function createJungleZigguratMonumentPrimitive(group: Group, size: number): void {
  const stone = 0x66695a;
  const moss = 0x40543b;
  const dark = 0x252c28;
  [1, 0.76, 0.53, 0.3].forEach((scale, index) => {
    addBox(group, size * scale, size * 0.15, size * scale, index % 2 ? moss : stone, 0, size * (0.08 + index * 0.14), 0);
  });
  addBox(group, size * 0.2, size * 0.2, size * 0.18, dark, 0, size * 0.29, -size * 0.38);
  for (let i = 0; i < 6; i++) addBox(group, size * 0.11, size * 0.035, size * 0.08, stone, 0, size * (0.05 + i * 0.055), -size * (0.53 - i * 0.065));
  [[-0.48, -0.46], [0.5, -0.42], [-0.44, 0.48], [0.46, 0.46]].forEach(([x, z]) => {
    addCylinder(group, size * 0.025, size * 0.34, 0x514735, size * x, size * 0.18, size * z);
    addSphere(group, size * 0.08, 0x35513a, size * x, size * 0.4, size * z);
  });
}

function createCaveEntranceMonumentPrimitive(group: Group, size: number): void {
  const rock = 0x59564d;
  const darkRock = 0x3c3a35;
  const mouth = 0x141817;
  // Everything remains at or above local ground: the detailed cave GLBs include
  // their subterranean chambers, which must never be raised into view.
  const mound = new Mesh(new SphereGeometry(size * 0.42, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), monumentMaterial(rock));
  mound.scale.set(1.35, 0.72, 1);
  mound.position.set(0, 0, size * 0.04);
  group.add(mound);
  addBox(group, size * 0.34, size * 0.24, size * 0.035, mouth, 0, size * 0.12, -size * 0.36);
  addBox(group, size * 0.46, size * 0.08, size * 0.12, darkRock, 0, size * 0.26, -size * 0.32).rotation.x = MathUtils.degToRad(-8);
  [-0.3, 0.3].forEach((x) => addBox(group, size * 0.14, size * 0.22, size * 0.15, darkRock, size * x, size * 0.11, -size * 0.24));
}

function createPowerLineTowerPrimitive(): Group {
  const group = new Group();
  const steel = 0x4f595c;
  [-4.8, 4.8].forEach((x) => {
    const leg = addBox(group, 0.65, 28, 0.65, steel, x, 14, 0);
    leg.rotation.z = MathUtils.degToRad(x < 0 ? -10 : 10);
  });
  addBox(group, 22, 0.65, 0.75, steel, 0, 27, 0);
  addBox(group, 15, 0.55, 0.65, steel, 0, 22, 0);
  addBox(group, 7, 0.5, 0.55, steel, 0, 17, 0);
  [-18, -9, 9, 18].forEach((angle, index) => {
    const brace = addBox(group, 12, 0.42, 0.42, steel, 0, 7 + index * 5, 0);
    brace.rotation.z = MathUtils.degToRad(angle);
  });
  return group;
}

function createGenericMonumentPrimitive(group: Group, size: number): void {
  const concrete = 0x77786f;
  const wall = 0x686e63;
  const rust = 0x85513a;
  addBox(group, size * 1.05, size * 0.025, size * 0.78, concrete, 0, size * 0.015, 0);
  addBox(group, size * 0.56, size * 0.26, size * 0.38, wall, -size * 0.12, size * 0.15, 0);
  addPitchedRoof(group, size * 0.6, size * 0.42, size * 0.055, rust, -size * 0.12, size * 0.31, 0);
  addBox(group, size * 0.28, size * 0.18, size * 0.24, 0x515a58, size * 0.36, size * 0.11, size * 0.2);
  addGuardTower(group, size * 0.32, size * 0.42, -size * 0.25);
}

function addPitchedRoof(group: Group, width: number, depth: number, thickness: number, color: number, x: number, y: number, z: number): void {
  const panelWidth = width * 0.54;
  const pitch = MathUtils.degToRad(13);
  const left = addBox(group, panelWidth, thickness, depth, color, x - width * 0.235, y, z);
  left.rotation.z = pitch;
  const right = addBox(group, panelWidth, thickness, depth, color, x + width * 0.235, y, z);
  right.rotation.z = -pitch;
}

function addGuardTower(group: Group, towerSize: number, x: number, z: number): void {
  const steel = 0x4f5956;
  const rust = 0x704536;
  for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
    addBox(group, towerSize * 0.035, towerSize * 0.8, towerSize * 0.035, steel, x + towerSize * dx, towerSize * 0.4, z + towerSize * dz);
  }
  addBox(group, towerSize * 0.4, towerSize * 0.17, towerSize * 0.4, steel, x, towerSize * 0.82, z);
  addBox(group, towerSize * 0.46, towerSize * 0.04, towerSize * 0.46, rust, x, towerSize * 0.93, z);
}

function createJunkyardMonumentPrimitive(group: Group, size: number, placement?: MonumentPrimitivePlacement): void {
  const rust = 0x8f4b32;
  const darkRust = 0x4b332b;
  const steel = 0x697276;
  const sheet = 0x596365;
  const scrap = 0x7c6650;
  const rubber = 0x252827;

  // Junkyard's large earth piles are already present in the published Rust
  // height map. Seat each proxy on that terrain instead of drawing duplicate
  // mound geometry over it.
  const groundY = (x: number, z: number): number => {
    if (!placement) {
      return 0;
    }
    const cos = Math.cos(placement.rotationY);
    const sin = Math.sin(placement.rotationY);
    const worldX = placement.center.x + x * cos + z * sin;
    const worldZ = placement.center.z - x * sin + z * cos;
    return sampleTerrainHeight(placement.terrain, worldX, worldZ) - placement.groupY + 1.5;
  };
  const boxOnGround = (width: number, height: number, depth: number, color: number, x: number, z: number, lift = 0): Mesh =>
    addBox(group, width, height, depth, color, x, groundY(x, z) + height * 0.5 + lift, z);
  const cylinderOnGround = (radius: number, height: number, color: number, x: number, z: number, lift = 0): Mesh =>
    addCylinder(group, radius, height, color, x, groundY(x, z) + height * 0.5 + lift, z);

  // Central sorting/crusher line crossing the saddle between the real mounds.
  boxOnGround(size * 0.46, size * 0.12, size * 0.24, darkRust, -size * 0.03, size * 0.02);
  boxOnGround(size * 0.34, size * 0.08, size * 0.12, rust, size * 0.27, -size * 0.02, size * 0.14).rotation.z = -0.28;
  boxOnGround(size * 0.48, size * 0.07, size * 0.1, rust, -size * 0.34, size * 0.03, size * 0.1).rotation.z = 0.22;

  // The broad, rusted crusher bowl is Junkyard's clearest silhouette.
  const bowlX = -size * 0.48;
  const bowlZ = size * 0.34;
  const bowl = new Mesh(
    new CylinderGeometry(size * 0.29, size * 0.19, size * 0.1, 24, 1, true),
    monumentMaterial(rust),
  );
  bowl.position.set(bowlX, groundY(bowlX, bowlZ) + size * 0.12, bowlZ);
  bowl.rotation.x = Math.PI;
  group.add(bowl);
  cylinderOnGround(size * 0.055, size * 0.22, darkRust, bowlX, bowlZ, size * 0.02);

  // Elevated picking gantry and conveyor climbing the central mound.
  const gantryX = size * 0.04;
  const gantryZ = -size * 0.2;
  const gantryBase = groundY(gantryX, gantryZ);
  [-0.16, 0.16].forEach((xOffset) => {
    [-0.12, 0.12].forEach((zOffset) => {
      addBox(group, size * 0.025, size * 0.42, size * 0.025, darkRust, gantryX + size * xOffset, gantryBase + size * 0.21, gantryZ + size * zOffset);
    });
  });
  addBox(group, size * 0.42, size * 0.045, size * 0.3, rust, gantryX, gantryBase + size * 0.43, gantryZ);
  const craneBoom = addBox(group, size * 0.72, size * 0.035, size * 0.04, darkRust, gantryX + size * 0.12, gantryBase + size * 0.62, gantryZ);
  craneBoom.rotation.z = 0.22;
  addBox(group, size * 0.035, size * 0.28, size * 0.035, steel, gantryX + size * 0.43, gantryBase + size * 0.47, gantryZ);

  // Patchwork sheds, scrap stacks and upright tanks distributed around the
  // mound bases. Their individual terrain samples keep them out of the hills.
  [
    [-0.42, -0.32, 0.26, 0.18],
    [0.43, -0.35, 0.3, 0.16],
    [0.46, 0.29, 0.22, 0.2],
  ].forEach(([x, z, width, depth], index) => {
    const shed = boxOnGround(size * width, size * 0.16, size * depth, index === 1 ? sheet : scrap, size * x, size * z);
    shed.rotation.y = index === 1 ? -0.18 : 0.12;
    const roof = boxOnGround(size * (width + 0.04), size * 0.025, size * (depth + 0.04), rust, size * x, size * z, size * 0.17);
    roof.rotation.y = shed.rotation.y;
  });

  [
    [-0.68, -0.08], [-0.6, 0.02], [-0.56, -0.18],
    [0.62, 0.08], [0.7, 0.17], [0.57, 0.2],
    [0.12, 0.48], [0.23, 0.52], [-0.02, 0.54],
  ].forEach(([x, z], index) => {
    const stack = boxOnGround(size * 0.11, size * (0.06 + (index % 3) * 0.018), size * 0.075, index % 2 ? rust : scrap, size * x, size * z);
    stack.rotation.y = (index % 4) * 0.36;
  });

  [
    [0.66, -0.16], [0.73, -0.12], [-0.22, 0.58],
  ].forEach(([x, z]) => cylinderOnGround(size * 0.055, size * 0.17, steel, size * x, size * z));

  // A broken perimeter reads as the dense ring of vehicle panels in-game.
  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2;
    const x = Math.cos(angle) * size * 0.82;
    const z = Math.sin(angle) * size * 0.66;
    const panel = boxOnGround(size * 0.11, size * (0.09 + (index % 3) * 0.018), size * 0.025, index % 4 === 0 ? rubber : rust, x, z);
    panel.rotation.y = -angle;
  }
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
    [0.73, 0.92, 1.1].forEach((y) => addLamp(size * x, size * y, size * 0.44, 0xffb43d, 0.2, size * 0.24));
  });
  // Cool task lights mark the exterior catwalks and lower service level.
  [-0.52, -0.17, 0.2, 0.54].forEach((x) => addLamp(size * x, size * 0.62, -size * 0.45, 0x9fdcff, 0.14, size * 0.2, size * 0.014));
  // Red obstruction beacons on the communications tower and crane tips.
  [[0, 2.12, -0.1], [-0.82, 1.58, -0.3], [0.84, 1.58, 0.2]].forEach(([x, y, z]) => addLamp(size * x, size * y, size * z, 0xff1d22, 0.3, size * 0.18, size * 0.022));

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
  addBox(group, size * 1.42, 3, size * 1.48, concreteDark, 0, 1.5, 0);
  addBox(group, size * 1.28, 2.2, size * 1.28, 0x6b706b, 0, 3, 0);

  // Two broad rows of circular settling/clarifier basins match the monument's
  // long industrial footprint and keep the overhead silhouette legible.
  const basinRadius = size * 0.17;
  for (const [x, z] of [[-0.42, -0.56], [0.42, -0.56], [-0.42, 0], [0.42, 0], [-0.42, 0.56], [0.42, 0.56]]) {
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

  // Two modest ground storage tanks sit together on the service side.
  [-0.78, -0.57].forEach((x) => {
    addCylinder(group, size * 0.075, size * 0.36, rust, size * x, size * 0.22, -size * 0.52);
    addCylinder(group, size * 0.09, size * 0.04, concreteDark, size * x, size * 0.42, -size * 0.52);
  });

  // The recurring hill behind the plant carries a smaller, centered water tower.
  addCone(group, size * 0.24, size * 0.22, 0x625b4e, 0, size * 0.11, -size * 0.78);
  addCylinder(group, size * 0.055, size * 0.68, 0x646b65, 0, size * 0.52, -size * 0.78);
  addCylinder(group, size * 0.105, size * 0.11, rust, 0, size * 0.89, -size * 0.78);
  addSphere(group, size * 0.085, 0x77766b, 0, size * 0.99, -size * 0.78);
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
    alphaTest: 0.02,
    depthTest: false,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
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
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.strokeText(label, canvas.width / 2, 64);
  context.fillStyle = "#ffffff";
  context.fillText(label, canvas.width / 2, 64);

    const created = new CanvasTexture(canvas);
    created.colorSpace = NoColorSpace;
    return created;
  });
  const material = new SpriteMaterial({
    alphaMap: texture,
    color: 0xfff6da,
    transparent: true,
    alphaTest: 0.02,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
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
    gradient.addColorStop(0, "rgb(255,255,255)");
    gradient.addColorStop(0.34, "rgb(128,128,128)");
    gradient.addColorStop(0.68, "rgb(42,42,42)");
    gradient.addColorStop(1, "rgb(0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
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
  const cloudCount = 42;
  const height = MathUtils.clamp(worldSize * 0.19, 520, 980);

  for (let index = 0; index < cloudCount; index += 1) {
    const ring = index / cloudCount;
    const angle = ring * Math.PI * 2 * 2.618;
    const layerDepth = ((index * 13) % 11) / 10;
    const radius = worldSize * MathUtils.lerp(0.04, 0.54, ((index * 37) % cloudCount) / Math.max(1, cloudCount - 1));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const baseScale = worldSize * MathUtils.lerp(0.14, 0.29, ((index * 17) % 9) / 8);
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
    const baseY = height + Math.sin(index * 1.7) * worldSize * 0.022 + layerDepth * worldSize * 0.035;
    sprite.position.set(x, baseY, z);
    sprite.scale.set(baseScale, baseScale * 0.34, 1);
    sprite.renderOrder = 4;
    sprite.userData.baseX = x;
    sprite.userData.baseY = baseY;
    sprite.userData.baseZ = z;
    sprite.userData.layerDepth = layerDepth;
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

function createTerrainVegetation(terrain: TerrainPayload, quality: EnvironmentQuality): Group {
  const group = new Group();
  const placements = buildTerrainVegetation({
    resolution: terrain.resolution,
    worldSize: terrain.worldSize || 4500,
    seed: terrain.seed,
    waterLevel: resolveOceanWaterLevel(terrain),
    minHeight: terrain.minHeight,
    maxHeight: terrain.maxHeight,
    heights: terrain.heights,
    colors: terrain.colors,
    // The exported monument positions are Rust coordinates; tree generation
    // runs in the mirrored viewer coordinate space.
    monuments: terrain.monuments?.map((monument) => ({
      x: -monument.x,
      z: monument.z,
      radius: monument.radius,
    })),
  }, vegetationInstanceBudget(quality));

  group.userData.instanceCount = placements.length;
  group.userData.placements = placements;
  if (placements.length === 0) return group;

  group.add(createVegetationTrunks(placements));
  const pines = placements.filter((placement) => placement.kind === "pine");
  const broadleaf = placements.filter((placement) => placement.kind === "broadleaf");
  const jungle = placements.filter((placement) => placement.kind === "jungle");
  if (pines.length > 0) group.add(createVegetationCanopy("pine", pines));
  if (broadleaf.length > 0) group.add(createVegetationCanopy("broadleaf", broadleaf));
  if (jungle.length > 0) {
    group.add(createVegetationCanopy("jungle", jungle));
    group.add(createJungleCanopyCrown(jungle));
  }
  return group;
}

function createVegetationTrunks(placements: VegetationPlacement[]): InstancedMesh {
  const mesh = new InstancedMesh(
    new CylinderGeometry(0.72, 1, 1, 6),
    new MeshStandardMaterial({ color: 0x6c4f32, roughness: 0.94, metalness: 0 }),
    placements.length,
  );
  const transform = new Object3D();
  const darkBark = new Color(0x4d3624);
  const sunlitBark = new Color(0x8a6744);

  placements.forEach((placement, index) => {
    const dimensions = vegetationDimensions(placement);
    const width = MathUtils.lerp(0.72, 1.28, placement.variation) * placement.scale;
    transform.position.set(placement.x, placement.y + dimensions.trunkHeight * 0.5, placement.z);
    transform.rotation.set(0, placement.variation * Math.PI * 2, 0);
    transform.scale.set(width, dimensions.trunkHeight, width);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, darkBark.clone().lerp(sunlitBark, placement.variation));
  });

  return finalizeVegetationMesh(mesh, "raidlands-tree-trunks");
}

function createVegetationCanopy(kind: VegetationPlacement["kind"], placements: VegetationPlacement[]): InstancedMesh {
  const pine = kind === "pine";
  const mesh = new InstancedMesh(
    pine ? new ConeGeometry(1, 1, 7) : new SphereGeometry(1, 7, 5),
    new MeshStandardMaterial({ color: 0x315d35, roughness: 0.9, metalness: 0 }),
    placements.length,
  );
  const transform = new Object3D();
  const palette = kind === "jungle"
    ? [new Color(0x1d472c), new Color(0x4d8143)]
    : pine
      ? [new Color(0x204331), new Color(0x3f6a3e)]
      : [new Color(0x2e512d), new Color(0x55783e)];

  placements.forEach((placement, index) => {
    const dimensions = vegetationDimensions(placement);
    const canopyY = placement.y + dimensions.trunkHeight + dimensions.canopyHeight * (pine ? 0.44 : 0.48);
    transform.position.set(placement.x, canopyY, placement.z);
    transform.rotation.set(0, placement.variation * Math.PI * 2, pine ? 0 : placement.variation * 0.18);
    transform.scale.set(
      dimensions.canopyWidth,
      dimensions.canopyHeight * (pine ? 0.78 : 0.52),
      dimensions.canopyWidth,
    );
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, palette[0].clone().lerp(palette[1], placement.variation));
  });

  return finalizeVegetationMesh(mesh, `raidlands-${kind}-tree-canopy`);
}

function createJungleCanopyCrown(placements: VegetationPlacement[]): InstancedMesh {
  const mesh = new InstancedMesh(
    new SphereGeometry(1, 6, 4),
    new MeshStandardMaterial({ color: 0x356536, roughness: 0.92, metalness: 0 }),
    placements.length,
  );
  const transform = new Object3D();
  const shaded = new Color(0x183d29);
  const lit = new Color(0x5a8c43);

  placements.forEach((placement, index) => {
    const dimensions = vegetationDimensions(placement);
    const angle = placement.variation * Math.PI * 2;
    const offset = dimensions.canopyWidth * 0.34;
    transform.position.set(
      placement.x + Math.cos(angle) * offset,
      placement.y + dimensions.trunkHeight + dimensions.canopyHeight * 0.72,
      placement.z + Math.sin(angle) * offset,
    );
    transform.rotation.set(0, angle, placement.variation * 0.22);
    transform.scale.set(dimensions.canopyWidth * 0.72, dimensions.canopyHeight * 0.34, dimensions.canopyWidth * 0.72);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, shaded.clone().lerp(lit, placement.variation));
  });

  return finalizeVegetationMesh(mesh, "raidlands-jungle-canopy-crown");
}

function vegetationDimensions(placement: VegetationPlacement): {
  trunkHeight: number;
  canopyHeight: number;
  canopyWidth: number;
} {
  if (placement.kind === "jungle") {
    return {
      trunkHeight: 8 + placement.scale * 8,
      canopyHeight: 10 + placement.scale * 7,
      canopyWidth: 8 + placement.scale * 6,
    };
  }
  if (placement.kind === "pine") {
    return {
      trunkHeight: 5 + placement.scale * 6,
      canopyHeight: 12 + placement.scale * 9,
      canopyWidth: 4 + placement.scale * 3.8,
    };
  }
  return {
    trunkHeight: 5 + placement.scale * 5.5,
    canopyHeight: 7 + placement.scale * 5,
    canopyWidth: 5 + placement.scale * 4.4,
  };
}

function finalizeVegetationMesh(mesh: InstancedMesh, name: string): InstancedMesh {
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
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
  return getSharedCanvasTexture("server-map-weather-cloud-v2", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const lobes = [
        [42, 72, 48, 25, 0.58],
        [76, 58, 62, 34, 0.78],
        [118, 48, 72, 40, 0.9],
        [166, 56, 70, 36, 0.82],
        [211, 70, 55, 28, 0.62],
        [128, 79, 126, 35, 0.76],
        [82, 88, 78, 23, 0.5],
        [178, 89, 76, 22, 0.48],
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

function createRainSheets(terrain: TerrainPayload, detail = 1): Group {
  const group = new Group();
  const worldSize = terrain.worldSize || 4500;
  const texture = createRainSheetTexture();
  const sheetSize = MathUtils.clamp(worldSize * 1.18, 1800, 6200);

  const sheetCount = Math.max(2, Math.round(MathUtils.lerp(2, 6, detail)));
  for (let index = 0; index < sheetCount; index += 1) {
    const material = new SpriteMaterial({
      map: texture,
      color: 0xc8dbea,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
    });
    const sprite = new Sprite(material);
    const angle = (index / sheetCount) * Math.PI * 2 + Math.PI * 0.25;
    const radius = sheetSize * 0.18;
    sprite.name = "raidlands-rain-sheet";
    sprite.position.set(Math.cos(angle) * radius, index * sheetSize * 0.035, Math.sin(angle) * radius);
    sprite.scale.set(sheetSize, sheetSize * 0.72, 1);
    sprite.renderOrder = 24 + index;
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.opacityBias = MathUtils.lerp(0.68, 1.08, index / Math.max(1, sheetCount - 1));
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

function createRainStreaks(terrain: TerrainPayload, material: LineBasicMaterial, detail = 1): LineSegments {
  const worldSize = terrain.worldSize || 4500;
  const width = MathUtils.clamp(worldSize * 1.45, 1800, 7600);
  const height = MathUtils.clamp(worldSize * 0.92, 1800, 5200);
  const streakCount = Math.round(MathUtils.clamp(worldSize * 0.42, 900, 2400) * MathUtils.lerp(0.34, 1, detail));
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

function createRainSplashes(terrain: TerrainPayload, detail = 1): Group {
  const group = new Group();
  group.name = "raidlands-rain-surface-splashes";
  const worldSize = terrain.worldSize || 4500;
  const count = Math.round(MathUtils.lerp(12, 38, detail));
  const geometry = new RingGeometry(0.42, 0.72, 12);

  for (let index = 0; index < count; index += 1) {
    const material = new MeshStandardMaterial({
      color: 0xc9e2ec,
      emissive: 0x678b9c,
      emissiveIntensity: 0.08,
      roughness: 0.24,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
    const splash = new Mesh(geometry.clone(), material);
    splash.name = "raidlands-rain-splash";
    splash.rotation.x = -Math.PI / 2;
    splash.renderOrder = 22;
    splash.userData.angle = ((index * 137.508) % 360) * Math.PI / 180;
    splash.userData.radius = MathUtils.lerp(worldSize * 0.012, worldSize * 0.12, ((index * 73) % 101) / 100);
    splash.userData.phase = ((index * 47) % 97) / 97;
    splash.userData.speed = MathUtils.lerp(0.00038, 0.00082, ((index * 31) % 89) / 88);
    group.add(splash);
  }

  geometry.dispose();
  return group;
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
    sampledAtMs: Number.isFinite(Date.parse(String(snapshot.sampledAt || "")))
      ? Date.parse(String(snapshot.sampledAt || ""))
      : 0,
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
    sampledAtMs: MathUtils.lerp(from.sampledAtMs, to.sampledAtMs, progress),
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

function horizontalDirectionalFacing(direction: Vector3, sunDirection: Vector3): number {
  const directionLength = Math.hypot(direction.x, direction.z);
  const sunLength = Math.hypot(sunDirection.x, sunDirection.z);
  if (directionLength < 0.0001 || sunLength < 0.0001) {
    return 0.5;
  }
  return MathUtils.clamp(
    (direction.x * sunDirection.x + direction.z * sunDirection.z) / (directionLength * sunLength) * 0.5 + 0.5,
    0,
    1,
  );
}

function environmentFogColor(environment: NormalizedEnvironment, sunFacing: number): Color {
  const sunHeight = MathUtils.clamp(environment.sunDirection.y, -0.32, 0.9);
  const daylight = MathUtils.smoothstep(sunHeight, -0.05, 0.55);
  const twilight = MathUtils.smoothstep(sunHeight, -0.2, -0.04)
    * (1 - MathUtils.smoothstep(sunHeight, 0.3, 0.56));
  const night = 1 - MathUtils.smoothstep(sunHeight, -0.14, 0.03);
  const mie = MathUtils.clamp(environment.atmosphereMie / 4, 0, 1);
  const atmosphereBrightness = MathUtils.clamp(environment.atmosphereBrightness / 1.5, 0, 1);
  const cloudShade = environment.cloudCoverage * MathUtils.lerp(0.36, 0.7, environment.cloudAttenuation);
  const weatherAttenuation = 1 - MathUtils.clamp(
    cloudShade + environment.rainIntensity * 0.46 + environment.fogIntensity * 0.18,
    0,
    0.88,
  );
  const warmFog = environment.sunColor.clone()
    .lerp(new Color(0xffc4a0), 0.52)
    .lerp(new Color(0xf47f68), mie * 0.34);
  const warmStrength = twilight
    * MathUtils.lerp(0.16, 0.58, MathUtils.clamp(sunFacing, 0, 1))
    * MathUtils.lerp(0.42, 1, mie)
    * weatherAttenuation;
  return new Color(0x172235)
    .lerp(new Color(0xc8dfe8), daylight)
    .lerp(warmFog, warmStrength)
    .lerp(new Color(0x8f9faa), environment.rainIntensity * 0.2)
    .lerp(new Color(0x0d1625), night * 0.52)
    .multiplyScalar(MathUtils.lerp(0.82, 1.06, atmosphereBrightness));
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

function visualFogDensityForCamera(
  fogStrength: number,
  cameraPosition: Vector3,
  terrain: TerrainPayload,
  qualityProfile: EnvironmentQualityProfile,
): number {
  const worldSize = terrain.worldSize || 4500;
  const terrainHeight = sampleTerrainHeight(terrain, cameraPosition.x, cameraPosition.z);
  const cameraAltitude = Math.max(0, cameraPosition.y - terrainHeight);
  const altitudeTaper = MathUtils.smoothstep(
    cameraAltitude,
    worldSize * qualityProfile.fogAltitudeFadeStart,
    worldSize * qualityProfile.fogAltitudeFadeEnd,
  );
  const altitudeScale = MathUtils.lerp(1, qualityProfile.fogAltitudeDensityFloor, altitudeTaper);
  const baseDensity = MathUtils.lerp(0.00001, 0.00072, Math.pow(MathUtils.clamp(fogStrength, 0, 1), 1.3));

  // Preserve fog through nearly the full camera range on Ultra, then taper it
  // progressively sooner and more aggressively on each lower detail tier.
  return baseDensity * altitudeScale;
}

function fogCapabilities(renderer: WebGLRenderer): FogCapabilities {
  const webgl2 = renderer.capabilities.isWebGL2;
  return {
    webgl2,
    depthTexture: webgl2 || renderer.extensions.has("WEBGL_depth_texture"),
    floatTexture: webgl2 || renderer.extensions.has("OES_texture_float"),
    highPrecisionFragment: renderer.capabilities.getMaxPrecision("highp") === "highp",
  };
}

function createTerrainHeightTexture(terrain: TerrainPayload): DataTexture {
  const resolution = Math.max(1, terrain.resolution);
  const expectedLength = resolution * resolution;
  const data = new Float32Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    data[index] = Number.isFinite(terrain.heights[index]) ? terrain.heights[index] : 0;
  }
  const texture = new DataTexture(data, resolution, resolution, RedFormat, FloatType);
  texture.flipY = false;
  // The water shader reads this texture as a continuous depth field around the
  // coast. DataTexture defaults to nearest-neighbour filtering, which exposes
  // the exported terrain grid as chunky diagonal bands in shallow water.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
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
  return monumentPrimitiveSearchKey(monument);
}

function shouldHideMonumentPrimitive(monument: MonumentPayload): boolean {
  const key = monumentKey(monument);
  return key.includes("ice_lake") || key.includes("ice_lakes") || key.includes("wild_swamp");
}

const sampleTerrainHeight = sampleTerrainSurfaceHeight;

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
  const detailedMonuments = panel?.querySelector<HTMLSelectElement>("[data-map-detailed-monuments]");
  const tour = panel?.querySelector<HTMLInputElement>("[data-map-viewer-tour]");
  const cameraMode = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-camera-mode]");
  const manualStyle = panel?.querySelector<HTMLSelectElement>("[data-map-viewer-manual-style]");
  const cameraTarget = panel?.querySelector<HTMLOutputElement>("[data-map-viewer-camera-target]");
  const clearCameraTarget = panel?.querySelector<HTMLButtonElement>("[data-map-viewer-camera-target-clear]");
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
  let playbackFrameSeconds = 60;
  let playerPollTimer = 0;
  let environmentPollTimer = 0;
  let playbackHistoryPollTimer = 0;
  let playbackRequestId = 0;
  const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];
  const playerLocationRefreshMs = 15_000;
  const disposers: Array<() => void> = [];
  const cameraFingerprint = root.dataset.terrainHash || root.dataset.seed || "";
  const cameraPreferences = parseCameraPreferences(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY));
  const saveCameraPreferences = () => {
    const current = parseCameraPreferences(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY));
    window.localStorage.setItem(CAMERA_PREFERENCES_STORAGE_KEY, JSON.stringify({
      ...current,
      mode: viewer.getCameraMode(),
      manualStyle: manualStyle?.value === "fly" ? "fly" : "orbit",
      terrainFingerprint: cameraFingerprint,
    }));
  };
  let followMyLocation = false;
  let orbitMyLocation = false;
  let navigationPlayers: PlayerLocation[] = [];
  let navigationEvents: MapReplayEvent[] = [];
  let pendingNavigationEvent: MapReplayEvent | null = null;
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

  const navigation = root.querySelector<HTMLElement>("[data-map-navigation]");
  const navigationToggle = root.querySelector<HTMLButtonElement>("[data-map-navigation-toggle]");
  const navigationClose = root.querySelector<HTMLButtonElement>("[data-map-navigation-close]");
  const navigationSearch = root.querySelector<HTMLInputElement>("[data-map-navigation-search]");
  const navigationList = root.querySelector<HTMLElement>("[data-map-navigation-list]");
  const navigationTarget = root.querySelector<HTMLElement>("[data-map-navigation-target]");
  const navigationPrevious = root.querySelector<HTMLButtonElement>("[data-map-navigation-previous]");
  const navigationNext = root.querySelector<HTMLButtonElement>("[data-map-navigation-next]");
  const navigationClear = root.querySelector<HTMLButtonElement>("[data-map-navigation-clear]");
  const navigationTabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-map-navigation-tab]"));
  let navigationTab = window.localStorage.getItem("raidlands:map-navigation-tab") || "monuments";
  let navigationItems: Array<{ label: string; run: () => void }> = [];
  let navigationIndex = -1;

  const setNavigationOpen = (open: boolean) => {
    if (!navigation || !navigationToggle) return;
    navigation.dataset.open = String(open);
    navigation.setAttribute("aria-hidden", String(!open));
    navigationToggle.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => navigationSearch?.focus(), 0);
  };
  const addNavigationButton = (label: string, meta: string, run: () => void) => {
    if (!navigationList) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "server-map-navigation-item";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const small = document.createElement("small");
    small.textContent = meta;
    button.append(strong, small);
    const index = navigationItems.push({ label, run }) - 1;
    button.addEventListener("click", () => {
      navigationIndex = index;
      run();
      if (navigationTarget) navigationTarget.textContent = label;
      if (navigationPrevious) navigationPrevious.disabled = navigationIndex <= 0;
      if (navigationNext) navigationNext.disabled = navigationIndex >= navigationItems.length - 1;
    });
    navigationList.append(button);
  };
  const renderNavigation = () => {
    if (!navigationList || !navigation) return;
    navigationList.replaceChildren();
    navigationItems = [];
    navigationIndex = -1;
    const query = (navigationSearch?.value || "").trim().toLowerCase();
    const matches = (...parts: unknown[]) => !query || parts.some((part) => String(part || "").toLowerCase().includes(query));
    navigationTabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.mapNavigationTab === navigationTab)));

    if (navigationTab === "monuments") {
      const monuments = viewer.navigationMonuments();
      const labels = monumentNavigationLabels(monuments);
      monuments.filter((monument) => matches(monument.name, monument.kind)).sort((a, b) => a.name.localeCompare(b.name)).forEach((monument) => {
        addNavigationButton(labels.get(monument) || monument.name, `${monument.kind || "Monument"} · X ${Math.round(monument.x)} Z ${Math.round(monument.z)}`, () => viewer.focusMonument(monument));
      });
    } else if (navigationTab === "players") {
      navigationPlayers.filter((player) => matches(player.displayName, player.clanTag, player.steamId64)).sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || String(a.displayName).localeCompare(String(b.displayName))).forEach((player) => {
        const name = player.isSelf ? `${player.displayName || "You"} (You)` : player.displayName || "Teammate";
        addNavigationButton(name, `${player.clanTag ? `[${player.clanTag}] · ` : ""}X ${Math.round(player.x)} Z ${Math.round(player.z)}`, () => viewer.focusWorldPoint(player.x, Number(player.y) || 0, player.z, name, 70));
      });
    } else if (navigationTab === "events") {
      recentUniqueNavigationEvents(navigationEvents.filter((event) => matches(event.eventType, event.vehicle, event.profileKey))).forEach((event) => {
        const label = replaySemanticEventType(event).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
        const when = event.occurredAt ? new Date(event.occurredAt).toLocaleString() : "Recent";
        addNavigationButton(label, `${when} · X ${Math.round(event.x)} Z ${Math.round(event.z)}`, () => {
          if (heatmapPlayback) heatmapPlayback.checked = true;
          if (!wantsHeatmap() && players) players.checked = true;
          if (heatmapHistory.length === 0) {
            pendingNavigationEvent = event;
            viewer.focusWorldPoint(event.x, Number(event.y) || 0, event.z, label, 110);
            reloadPlayback(undefined, false, true);
            return;
          }
          const occurred = Date.parse(String(event.occurredAt || ""));
          const frameIndex = nearestPlaybackFrameIndexForTime(occurred);
          playbackVirtualFrame = frameIndex;
          stopHeatmapPlayback();
          showPlaybackFrame(frameIndex);
          viewer.focusWorldPoint(event.x, Number(event.y) || 0, event.z, label, 110);
          viewer.clearReplayEvents();
          viewer.showReplayEvents([event], 1);
        });
      });
    } else if (navigationTab === "views") {
      [["Overview", "overview"], ["Top down", "top"], ["North approach", "north"], ["South approach", "south"], ["East approach", "east"], ["West approach", "west"]].filter(([label]) => matches(label)).forEach(([label, key]) => addNavigationButton(label, "Camera placement", () => viewer.focusPreset(key)));
      viewer.navigationMonuments().filter((monument) => matches(monument.name, "featured monument")).slice(0, 8).forEach((monument) => addNavigationButton(`${monument.name} orbit`, "Wipe-generated view", () => viewer.focusMonument(monument)));
    } else {
      const form = document.createElement("form");
      form.className = "server-map-navigation-goto";
      form.innerHTML = '<label><span>Rust X</span><input name="x" type="number" step="any" required></label><label><span>Rust Z</span><input name="z" type="number" step="any" required></label><button type="submit">Focus coordinates</button>';
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const x = validNavigationCoordinate(data.get("x"));
        const z = validNavigationCoordinate(data.get("z"));
        if (x !== null && z !== null && viewer.focusWorldPoint(x, 0, z, `X ${Math.round(x)} Z ${Math.round(z)}`, 80) && navigationTarget) navigationTarget.textContent = `X ${Math.round(x)} Z ${Math.round(z)}`;
      });
      navigationList.append(form);
    }
    if (navigationItems.length === 0 && navigationTab !== "goto") {
      const empty = document.createElement("p");
      empty.className = "server-map-navigation-empty";
      empty.textContent = query ? "No matching destinations." : navigationTab === "players" ? "No permitted player locations are available in this frame." : navigationTab === "events" ? "No events are available in this range." : "No destinations are available.";
      navigationList.append(empty);
    }
    if (navigationPrevious) navigationPrevious.disabled = true;
    if (navigationNext) navigationNext.disabled = navigationItems.length < 2;
  };
  bind(navigationToggle, "click", () => setNavigationOpen(navigation?.dataset.open !== "true"));
  bind(navigationClose, "click", () => setNavigationOpen(false));
  bind(navigationSearch, "input", renderNavigation);
  navigationTabs.forEach((tab) => bind(tab, "click", () => {
    navigationTab = tab.dataset.mapNavigationTab || "monuments";
    window.localStorage.setItem("raidlands:map-navigation-tab", navigationTab);
    if (navigationSearch) navigationSearch.value = "";
    renderNavigation();
  }));
  const stepNavigation = (offset: number) => {
    if (navigationItems.length === 0) return;
    navigationIndex = MathUtils.clamp(navigationIndex + offset, 0, navigationItems.length - 1);
    const item = navigationItems[navigationIndex];
    item?.run();
    if (navigationTarget && item) navigationTarget.textContent = item.label;
    if (navigationPrevious) navigationPrevious.disabled = navigationIndex <= 0;
    if (navigationNext) navigationNext.disabled = navigationIndex >= navigationItems.length - 1;
  };
  bind(navigationPrevious, "click", () => stepNavigation(-1));
  bind(navigationNext, "click", () => stepNavigation(1));
  bind(navigationClear, "click", () => {
    viewer.clearCameraTarget();
    viewer.focusPreset("overview");
    if (navigationTarget) navigationTarget.textContent = "Whole map";
  });
  bind(root, "raidlands:camera-target", ((event: CustomEvent<{ label?: string }>) => {
    if (navigationTarget) navigationTarget.textContent = event.detail?.label || "Whole map";
  }) as EventListener);
  bind(document, "keydown", ((event: KeyboardEvent) => {
    if (navigation?.dataset.open !== "true") return;
    if (event.key === "Escape") {
      setNavigationOpen(false);
      navigationToggle?.focus();
      return;
    }
    if (event.key === "Tab" && navigation) {
      const focusable = Array.from(navigation.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }) as EventListener);
  if (root.dataset.navigationPanel === "true") renderNavigation();

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

  bind(detailedMonuments, "change", () => {
    if (!detailedMonuments) return;
    const mode = parseMonumentMode(detailedMonuments.value);
    persistMonumentMode(mode);
    viewer.setMonumentMode(mode);
  });

  bind(tour, "change", () => {
    if (tour) {
      viewer.setTourEnabled(tour.checked && !followMyLocation);
    }
  });
  bind(cameraMode, "change", () => {
    if (!cameraMode) return;
    viewer.setCameraMode(parseCameraMode(cameraMode.value));
    if (manualStyle) manualStyle.disabled = cameraMode.value !== "manual";
    saveCameraPreferences();
  });
  bind(manualStyle, "change", () => {
    if (!manualStyle) return;
    viewer.setManualCameraStyle(manualStyle.value === "fly" ? "fly" : "orbit");
    saveCameraPreferences();
  });
  bind(clearCameraTarget, "click", () => viewer.clearCameraTarget());
  bind(root, "raidlands:camera-target", ((event: CustomEvent<{ label?: string }>) => {
    if (cameraTarget) cameraTarget.value = event.detail?.label || "Whole map";
  }) as EventListener);

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

  const playbackIntervalMs = (): number => replayTimelineFrameIntervalMs(playbackFrameSeconds, playbackSpeed());

  const timelineHistoryRate = (): number => replayTimelineHistoryRate(playbackFrameSeconds, playbackSpeed());

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
      if (wantsTimelineOverlay()) {
        return;
      }
      viewer.setEnvironment(payload.environment);
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
      void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers()).then((payload) => {
        navigationPlayers = Array.isArray(payload?.players) ? payload.players : [];
        if (navigationTab === "players") renderNavigation();
        syncMyLocationControl();
        if (followMyLocation && !orbitMyLocation) {
          viewer.followSelfLocation();
        }
      });
    } else {
      viewer.setPlayerLocationsVisible(false);
    }

    void loadLiveReplayEvents(root).then((events) => {
      navigationEvents = events;
      if (navigationTab === "events") renderNavigation();
      if (!wantsTimelineOverlay()) {
        viewer.showReplayEvents(events, 1);
      }
    });
  };

  const startLiveOverlayPolling = () => {
    if (wantsTimelineOverlay()) {
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
    viewer.showReplayEvents(timelineReplayEvents(cursorMs), timelineHistoryRate(), {
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
      syncTimelineEnvironment(playbackVirtualFrame);
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

  const syncTimelineEnvironment = (frameValue = playbackVirtualFrame) => {
    if (!wantsTimelineOverlay() || heatmapHistory.length === 0) {
      return;
    }

    const clamped = MathUtils.clamp(frameValue, 0, Math.max(0, heatmapHistory.length - 1));
    const lowerIndex = Math.floor(clamped);
    const upperIndex = Math.min(heatmapHistory.length - 1, lowerIndex + 1);
    const lowerEnvironment = heatmapHistory[lowerIndex]?.environment ?? null;
    const upperEnvironment = heatmapHistory[upperIndex]?.environment ?? lowerEnvironment;
    if (!lowerEnvironment && !upperEnvironment) {
      return;
    }

    viewer.setTimelineEnvironment(
      lowerEnvironment || upperEnvironment,
      upperEnvironment || lowerEnvironment,
      clamped - lowerIndex,
    );
  };

  const showPlaybackFrame = (index: number) => {
    const clampedIndex = MathUtils.clamp(Math.round(index), 0, Math.max(0, heatmapHistory.length - 1));
    const frame = heatmapHistory[clampedIndex];
    playbackShownFrame = clampedIndex;

    if (!frame) {
      setTimelineLabel(null, heatmapHistory.length === 0 ? "No frames" : "Latest");
      return;
    }

    syncTimelineEnvironment(clampedIndex);

    if (wantsHeatmap()) {
      viewer.setHeatmap(frame);
      viewer.setHeatmapVisible(Array.isArray(frame.buckets) && frame.buckets.length > 0);
    } else {
      viewer.setHeatmapVisible(false);
    }

    if (wantsPlayers()) {
      navigationPlayers = Array.isArray(frame.players) ? frame.players : [];
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
      if (navigationTab === "players") renderNavigation();
    }
    navigationEvents = Array.from(new Map(heatmapHistory.flatMap((historyFrame) => historyFrame.events || []).map((event, index) => [replayEventKey(event, index), event])).values());
    if (navigationTab === "events") renderNavigation();
    syncTimelineReplay();
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
      stopPlaybackHistoryPolling();
      heatmapHistory = [];
      viewer.clearReplayEvents();
      viewer.setHeatmapVisible(false);
      viewer.setPlayerLocationsVisible(false);
      startLiveOverlayPolling();
      startEnvironmentPolling();
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
        playbackFrameSeconds = Math.max(1, Number(payload.frameSeconds) || Math.ceil(selectedRangeSeconds() / Math.max(1, heatmapHistory.length)));
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
        if (pendingNavigationEvent) {
          const event = pendingNavigationEvent;
          pendingNavigationEvent = null;
          const eventFrame = nearestPlaybackFrameIndexForTime(Date.parse(String(event.occurredAt || "")));
          playbackVirtualFrame = eventFrame;
          if (heatmapFrame) heatmapFrame.value = String(eventFrame);
          showPlaybackFrame(eventFrame);
          const label = replaySemanticEventType(event).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
          viewer.focusWorldPoint(event.x, Number(event.y) || 0, event.z, label, 110);
          viewer.clearReplayEvents();
          viewer.showReplayEvents([event], 1);
        }
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
      viewer.setPlayerLocationsVisible(false);
      if (!wantsTimelineOverlay()) {
        startLiveOverlayPolling();
      } else {
        stopLiveOverlayPolling();
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
  if (detailedMonuments) {
    detailedMonuments.value = viewer.getMonumentMode();
  }
  if (tour) {
    viewer.setTourEnabled(tour.checked && !followMyLocation);
  }
  if (cameraMode) {
    cameraMode.value = cameraPreferences.mode;
    if (manualStyle) {
      manualStyle.value = cameraPreferences.manualStyle;
      manualStyle.disabled = cameraPreferences.mode !== "manual";
      viewer.setManualCameraStyle(cameraPreferences.manualStyle);
    }
    viewer.setCameraMode(cameraPreferences.mode);
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

    void loadPlayerLocations(root, viewer, myLocation, true, wantsAllPlayers()).then((payload) => {
      navigationPlayers = Array.isArray(payload?.players) ? payload.players : [];
      if (navigationTab === "players") renderNavigation();
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

  if (!wantsTimelineOverlay()) {
    startLiveOverlayPolling();
  }
  if (wantsTimelineOverlay()) {
    stopEnvironmentPolling();
  } else {
    startEnvironmentPolling();
  }

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

  const activeWorldVehicles = new Map<string, MapReplayEvent>();
  let latestTransientEvents: MapReplayEvent[] = [];
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

    if (maxAgeMs <= 0 && freshEvents.length > 0) {
      return freshEvents.slice(0, 8);
    }

    freshEvents.forEach((event, eventIndex) => {
      if (replayWorldVehicleIsActive(event)) {
        const key = replayEventKey(event, eventIndex);
        if (!activeWorldVehicles.has(key)) activeWorldVehicles.set(key, event);
      }
    });
    if (latestTransientEvents.length === 0) {
      latestTransientEvents = freshEvents.filter((event) => !replayEventIsWorldVehicle(event));
    }
  }

  return [...activeWorldVehicles.values(), ...latestTransientEvents].slice(0, 8);
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

async function loadPlayerLocations(root: HTMLElement, viewer: TerrainViewer, myLocation?: HTMLButtonElement | null, showLayer = true, allPlayers = false): Promise<PlayerLocationPayload | null> {
  const baseUrl = root.dataset.playerLocationsUrl || "";

  if (!baseUrl) {
    viewer.setPlayerLocationsVisible(false);
    if (myLocation) {
      myLocation.disabled = true;
    }
    return null;
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
    return payload;
  } catch (error) {
    console.info("Raidlands player locations could not be loaded.", error);
    viewer.setPlayerLocationsVisible(false);
    if (myLocation) {
      myLocation.disabled = true;
    }
    return null;
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

  if (Number.isFinite(exportedLevel)) {
    // Some published terrain payloads contain an absolute/runtime water value
    // that is not in the same vertical coordinate space as the height grid.
    // Reject it when it disagrees with the shoreline represented by the map;
    // otherwise the visible water plane cuts through the terrain and the
    // reflection appears below the map.
    if (Math.abs(exportedLevel - inferredLevel) <= 8) {
      return exportedLevel;
    }
  }

  return inferredLevel;
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
