import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BoxGeometry, BufferAttribute, BufferGeometry,
  CanvasTexture, ClampToEdgeWrapping, Color, ConeGeometry, CylinderGeometry, DepthTexture, DirectionalLight, DoubleSide, FogExp2,
  EquirectangularReflectionMapping, Float32BufferAttribute, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  LineBasicMaterial, LineSegments, LinearFilter, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, MirroredRepeatWrapping, Object3D,
  PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight,
  PMREMGenerator, Points, PointsMaterial, Raycaster, RectAreaLight, Scene, SkinnedMesh, SphereGeometry, SpotLight,
  SRGBColorSpace, Texture, TextureLoader, UnsignedIntType, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import {
  Leader, LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_PRESETS,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "./policy";
import { normalizeWearableOrigin, podiumCharacterYaw, podiumWeaponLayout } from "./layout";
import { buildIndustrialPedestal, pedestalConfigForRank, pedestalRanksForLayout } from "./pedestal";
import {
  buildIndustrialSign, CATEGORY_SIGN_TRANSFORM, fitSignageText, industrialSignDetail,
  industrialSignVariantForRank, INDUSTRIAL_SIGN_PROFILES, IndustrialSignSurfaceTextures,
  playerSignageText, playerSignageTransform,
} from "./signage";
import {
  anchorPoint, arenaPlacementTransform, ArenaManifest, ArenaPlacement, clampArenaRotation,
  FORWARD_MOUND_VISIBILITY, idleArenaYawTarget, isBarbedWirePlacement, JUNKYARD_ATMOSPHERE, JUNKYARD_GROUND,
  junkyardFallbackFogLayers, junkyardGroundedPlacementY, junkyardGroundHeight, junkyardGroundScatter,
  junkyardGroundSurfaceShade, JUNKYARD_GANTRY_LAYOUT, JUNKYARD_PODIUM_CENTERS_X,
  JUNKYARD_SEARCHLIGHTS, junkyardSearchlightTarget, PROFILE_PODIUM_GROUND, profilePodiumGroundHeight,
  JunkyardFogQualityState, nextJunkyardFogQuality,
  orbitCameraPosition, podiumCategoryTitle, podiumGroundMaterialState,
  shouldLiftForwardMoundVisibility, shouldRenderArenaPlacement,
} from "./scene-policy";

type Payload = { leaders?: Leader[]; metric?: string; board?: string };
type PoseRotation = { x?: number; y?: number; z?: number };
type PoseBones = Record<string, PoseRotation>;
type CameraRecord = Record<string, unknown>;
type GroundConfig = {
  readonly width: number;
  readonly depth: number;
  readonly centerZ: number;
  readonly baseY: number;
  readonly widthSegments: number;
  readonly depthSegments: number;
  readonly repeatX: number;
  readonly repeatY: number;
};

const APPROVED_SCENE_REVISION = "494242bdeae941e3389b34a819c514aae2cf39f8";
const APPROVED_SCENE_ASSET_COUNT = 79;
const ARENA_CAMERA = {
  fov: 37,
  position: new Vector3(0, 3.25, 11.7),
  target: new Vector3(0, 1.42, -0.35),
};
const SCENE_MODEL_FALLBACKS: Record<string, string> = {
  "prefabs/Weapons/lr300/lr300.worldmodel.glb": "prefabs/Weapons/ak47u/ak47u.worldmodel.glb",
  "prefabs/Weapons/mp5/mp5.worldmodel.glb": "prefabs/Weapons/ak47u/ak47u.worldmodel.glb",
};

function supportsWebGL2(): boolean {
  try { return Boolean(document.createElement("canvas").getContext("webgl2")); } catch { return false; }
}

function yieldToRenderer(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function parsePayload(host: HTMLElement): Payload {
  try { return JSON.parse(host.querySelector<HTMLScriptElement>("[data-podium-payload]")?.textContent || "{}") as Payload; }
  catch { return {}; }
}

function renderCards(host: HTMLElement, leaders: Leader[], board: string, metric: string) {
  const cards = host.querySelector<HTMLElement>("[data-podium-cards]");
  if (!cards) return;
  cards.replaceChildren();
  if (!leaders.length) {
    const empty = document.createElement("p"); empty.className = "leaderboard-podium-empty";
    empty.textContent = "The podium is waiting for contenders."; cards.append(empty); return;
  }
  leaders.slice(0, 3).forEach((leader, index) => {
    const rank = index + 1; const isBot = board === "bots";
    const name = String(leader.display_name || (isBot ? "Raidlands Bot" : "Raidlands Player"));
    const profileUrl = isBot ? "" : String(leader.steam_profile_url || "").trim();
    const avatarUrl = isBot ? "" : String(leader.steam_avatar_url || "").trim();
    const [value, label] = leaderboardPodiumMetricValue(leader, board, metric);
    const card = document.createElement("article"); card.className = "leaderboard-podium-card"; card.dataset.podiumRank = String(rank);
    const medal = document.createElement("span"); medal.className = "leaderboard-podium-medal";
    medal.setAttribute("aria-label", `Rank ${rank}`); medal.textContent = `#${rank}`; card.append(medal);
    if (avatarUrl) {
      const avatar = document.createElement(profileUrl ? "a" : "span"); avatar.className = "steam-avatar steam-avatar-sm";
      if (avatar instanceof HTMLAnchorElement) { avatar.href = profileUrl; avatar.target = "_blank"; avatar.rel = "noopener noreferrer"; avatar.setAttribute("aria-label", `${name} Steam profile`); }
      const image = document.createElement("img"); image.src = avatarUrl; image.alt = `${name} Steam avatar`; image.referrerPolicy = "no-referrer";
      avatar.append(image); card.append(avatar);
    } else if (isBot) {
      const avatar = document.createElement("span"); avatar.className = "leaderboard-bot-avatar"; avatar.setAttribute("aria-hidden", "true"); avatar.textContent = "AI"; card.append(avatar);
    }
    const copy = document.createElement("span"); copy.className = "leaderboard-podium-copy";
    const title = document.createElement(profileUrl ? "a" : "strong"); title.textContent = name;
    if (title instanceof HTMLAnchorElement) { title.href = profileUrl; title.target = "_blank"; title.rel = "noopener noreferrer"; }
    const stat = document.createElement("span"); const bold = document.createElement("b"); bold.textContent = value; stat.append(bold, ` ${label}`);
    copy.append(title, stat); card.append(copy); cards.append(card);
  });
}

function poseWearable(root: Object3D, rank: number, bones: PoseBones = {}) {
  const lean = [0, -0.025, 0.025][rank] || 0;
  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (name === "spine2") node.rotation.z += lean;
    if (name === "l_upperarm") { node.rotation.z += 1.16; node.rotation.x += 0.08; node.rotation.y -= 0.08; }
    if (name === "r_upperarm") { node.rotation.z -= 1.16; node.rotation.x -= 0.08; node.rotation.y += 0.08; }
    if (name === "l_forearm") { node.rotation.y -= 0.3; node.rotation.z += 0.12; }
    if (name === "r_forearm") { node.rotation.y += 0.3; node.rotation.z -= 0.12; }
    if (name === "head") node.rotation.y += [0, 0.06, -0.06][rank] || 0;
    node.userData.podiumBaseRotation = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z };
    const custom = bones[name];
    if (custom) {
      node.rotation.x += Number(custom.x) || 0;
      node.rotation.y += Number(custom.y) || 0;
      node.rotation.z += Number(custom.z) || 0;
    }
    if ((node as Mesh).isMesh) {
      const mesh = node as Mesh;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    }
  });
}

export function staticBounds(root: Object3D): Box3 {
  const bounds = new Box3(); bounds.makeEmpty(); root.updateMatrixWorld(true);
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if ((mesh as SkinnedMesh).isSkinnedMesh) {
      const skinned = mesh as SkinnedMesh;
      skinned.skeleton.update(); skinned.computeBoundingBox();
      if (skinned.boundingBox) bounds.union(skinned.boundingBox.clone().applyMatrix4(skinned.matrixWorld));
      return;
    }
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  if (bounds.isEmpty()) bounds.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1));
  return bounds;
}

function component(attribute: { getX(index: number): number; getY(index: number): number; getZ(index: number): number; getW(index: number): number }, index: number, item: number): number {
  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index), attribute.getW(index)][item] || 0;
}

function expandSkinAttributes(mesh: SkinnedMesh): boolean {
  const position = mesh.geometry.getAttribute("position");
  const indices = mesh.geometry.getAttribute("skinIndex");
  const weights = mesh.geometry.getAttribute("skinWeight");
  if (!position || !indices || !weights || indices.count !== position.count || weights.count !== position.count) return false;
  if (indices.itemSize === 4 && weights.itemSize === 4) return true;
  const expandedIndices = new Uint16Array(position.count * 4); const expandedWeights = new Float32Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    for (let item = 0; item < 4; item += 1) {
      if (item < indices.itemSize) expandedIndices[vertex * 4 + item] = component(indices, vertex, item);
      if (item < weights.itemSize) expandedWeights[vertex * 4 + item] = component(weights, vertex, item);
    }
  }
  mesh.geometry.setAttribute("skinIndex", new BufferAttribute(expandedIndices, 4));
  mesh.geometry.setAttribute("skinWeight", new BufferAttribute(expandedWeights, 4));
  return true;
}

function numeric(record: CameraRecord, key: string, fallback = 0): number {
  const value = Number(record[key]); return Number.isFinite(value) ? value : fallback;
}

function encodedPath(pathname: string): string {
  return pathname.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function joinedUrl(base: string, relative: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(encodedPath(relative), new URL(normalizedBase, document.baseURI)).href;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
}

function hazeTexture(): CanvasTexture {
  const size = 256; const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d")!; const random = seededRandom(0x51a9e);
  const clouds = Array.from({ length: 12 }, () => ({
    x: size * (.2 + random() * .6), y: size * (.24 + random() * .52),
    radiusX: size * (.12 + random() * .2), radiusY: size * (.09 + random() * .17),
    weight: .36 + random() * .34,
  }));
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let density = 0;
      clouds.forEach((cloud) => {
        const dx = (x - cloud.x) / cloud.radiusX; const dy = (y - cloud.y) / cloud.radiusY;
        density += Math.exp(-(dx * dx + dy * dy) * 2.15) * cloud.weight;
      });
      const border = Math.min(x, y, size - 1 - x, size - 1 - y);
      const edgeFade = MathUtils.smoothstep(border, 0, 72);
      const alpha = Math.min(.78, density * .68) * edgeFade * edgeFade;
      const offset = (y * size + x) * 4;
      pixels.data[offset] = 224; pixels.data[offset + 1] = 231; pixels.data[offset + 2] = 232;
      pixels.data[offset + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas); texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; return texture;
}

function signageCanvas(width = 1024, height = 256): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#050606"; context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width / 2, height * .48, 12, width / 2, height * .48, width * .58);
  glow.addColorStop(0, "#25150d"); glow.addColorStop(.52, "#0d0c0a"); glow.addColorStop(1, "#030404");
  context.fillStyle = glow; context.fillRect(7, 7, width - 14, height - 14);
  // Fine staggered perforations read as a physical grille without extra geometry.
  context.fillStyle = "rgba(0,0,0,.58)";
  for (let y = 10; y < height - 8; y += 8) for (let x = 10 + ((y / 8) % 2) * 4; x < width - 8; x += 8) {
    context.beginPath(); context.arc(x, y, 1.65, 0, Math.PI * 2); context.fill();
  }
  const edge = context.createLinearGradient(0, 0, width, 0);
  edge.addColorStop(0, "rgba(0,0,0,.82)"); edge.addColorStop(.08, "rgba(0,0,0,0)"); edge.addColorStop(.92, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(0,0,0,.82)");
  context.fillStyle = edge; context.fillRect(0, 0, width, height);
  let seed = width * 31 + height;
  for (let index = 0; index < 180; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed % width;
    seed = (seed * 1664525 + 1013904223) >>> 0; const y = seed % height;
    context.fillStyle = index % 3 ? "rgba(255,139,55,.045)" : "rgba(110,77,55,.12)"; context.fillRect(x, y, 2 + index % 4, 1);
  }
  return { canvas, context };
}

function categorySignTexture(title: string): CanvasTexture {
  const { canvas, context } = signageCanvas();
  context.textAlign = "center"; context.textBaseline = "middle";
  context.font = "800 35px Arial Narrow, Arial, sans-serif"; context.letterSpacing = "5px"; context.fillStyle = "#d2cbc0";
  context.fillText("CURRENT CATEGORY", canvas.width / 2, 57);
  context.shadowColor = "#ff5a16"; context.shadowBlur = 24; context.fillStyle = "#ff792c";
  const fit = fitSignageText(title.toUpperCase(), 900, (text, size) => { context.font = `900 ${size}px Impact, Arial Narrow, sans-serif`; return context.measureText(text).width; }, 102, 64);
  context.font = `900 ${fit.fontSize}px Impact, Arial Narrow, sans-serif`; context.letterSpacing = "3px";
  context.fillText(fit.text, canvas.width / 2, 164);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; return texture;
}

function playerSignTexture(text: ReturnType<typeof playerSignageText>): CanvasTexture {
  const { canvas, context } = signageCanvas(); const split = 205;
  context.strokeStyle = "rgba(255,132,45,.55)"; context.lineWidth = 4; context.beginPath(); context.moveTo(split, 18); context.lineTo(split, 238); context.stroke();
  context.textAlign = "center"; context.textBaseline = "middle"; context.fillStyle = "#ff8a30"; context.shadowColor = "#ff5a16"; context.shadowBlur = 18;
  context.font = "900 100px Impact, Arial Narrow, sans-serif"; context.fillText(`#${text.rank}`, split / 2, 127);
  context.textAlign = "left"; context.shadowBlur = 14;
  const fitted = fitSignageText(text.name, 735, (candidate, size) => { context.font = `800 ${size}px Arial Narrow, Arial, sans-serif`; return context.measureText(candidate).width; }, 64, 38);
  context.font = `800 ${fitted.fontSize}px Arial Narrow, Arial, sans-serif`; context.fillText(fitted.text, 245, 91);
  context.shadowBlur = 7; context.fillStyle = "#f1e4d2"; context.font = "700 39px Arial Narrow, Arial, sans-serif";
  context.fillText(`${text.value} ${text.label}`, 245, 176);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; return texture;
}

const VOLUMETRIC_FOG_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    cameraNear: { value: .05 }, cameraFar: { value: 60 },
    cameraProjectionMatrixInverse: { value: null }, cameraWorldMatrix: { value: null },
    fogTime: { value: 0 }, fogDensity: { value: JUNKYARD_ATMOSPHERE.volumetricDensity },
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
    uniform mat4 cameraProjectionMatrixInverse;
    uniform mat4 cameraWorldMatrix;
    uniform float fogTime;
    uniform float fogDensity;
    varying vec2 vUv;

    float flowingNoise(vec3 point) {
      vec3 p = point * vec3(.48, .82, .48);
      float a = sin(p.x * 1.63 + sin(p.z * 1.17 + fogTime * .09) + p.y * 2.11);
      float b = sin(p.z * 2.03 - p.x * .57 - fogTime * .065) * .52;
      float c = sin(dot(p, vec3(.71, 2.37, 1.13)) + fogTime * .075) * .28;
      float d = sin(p.x * 3.21 + p.z * 2.73 - fogTime * .12) * .16;
      return .5 + .5 * (a + b + c + d) / 1.96;
    }

    float podiumFogInfluence(vec3 point) {
      float distanceToPodium = min(
        length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[0]}, 0.0)),
        min(
          length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[1].toFixed(1)}, 0.0)),
          length(point.xz - vec2(${JUNKYARD_PODIUM_CENTERS_X[2]}, 0.0))
        )
      );
      return 1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.podiumInnerRadius.toFixed(1)}, ${JUNKYARD_ATMOSPHERE.podiumOuterRadius.toFixed(1)}, distanceToPodium);
    }

    vec3 worldPositionFromDepth(float depth) {
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = cameraProjectionMatrixInverse * clip;
      view /= max(view.w, .00001);
      return (cameraWorldMatrix * view).xyz;
    }

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).x;
      if (depth <= .00001) {
        gl_FragColor = sceneColor;
        return;
      }
      vec3 cameraPosition = cameraWorldMatrix[3].xyz;
      vec3 surfacePosition = worldPositionFromDepth(depth);
      vec3 ray = surfacePosition - cameraPosition;
      float rayLength = min(length(ray), 36.0);
      vec3 rayDirection = normalize(ray);
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      float integratedDensity = 0.0;
      const int STEPS = 14;
      for (int index = 0; index < STEPS; index++) {
        float distanceAlongRay = (float(index) + jitter) / float(STEPS) * rayLength;
        vec3 point = cameraPosition + rayDirection * distanceAlongRay;
        float horizontal = (1.0 - smoothstep(14.0, 17.0, abs(point.x)))
          * smoothstep(-17.0, -14.0, point.z) * (1.0 - smoothstep(4.3, 6.0, point.z));
        float groundEntry = smoothstep(-.12, .08, point.y);
        float mainBank = 1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.fullBankHeight.toFixed(2)}, ${JUNKYARD_ATMOSPHERE.bankFadeHeight.toFixed(2)}, point.y);
        float highWisps = (1.0 - smoothstep(${JUNKYARD_ATMOSPHERE.wispStartHeight.toFixed(2)}, ${JUNKYARD_ATMOSPHERE.wispFadeHeight.toFixed(1)}, point.y))
          * ${JUNKYARD_ATMOSPHERE.wispStrength.toFixed(2)};
        float vertical = groundEntry * max(mainBank, highWisps);
        float noiseValue = smoothstep(.27, .82, flowingNoise(point));
        float podiumBoost = podiumFogInfluence(point);
        integratedDensity += horizontal * vertical * (.12 + noiseValue * .88) * (.62 + podiumBoost * 1.25);
      }
      float stepLength = rayLength / float(STEPS);
      float fogAmount = min(${JUNKYARD_ATMOSPHERE.volumetricOpacityCeiling.toFixed(2)}, 1.0 - exp(-integratedDensity * stepLength * .075 * fogDensity));
      vec3 fogColor = vec3(.30, .335, .325);
      gl_FragColor = vec4(mix(sceneColor.rgb, fogColor, fogAmount), sceneColor.a);
    }
  `,
};

class PodiumScene {
  private scene = new Scene();
  private camera = new PerspectiveCamera(41, 1, 0.05, 60);
  private renderer: WebGLRenderer;
  private composer?: EffectComposer;
  private backdropRoot = new Group();
  private worldRoot = new Group();
  private baseRoot = new Group();
  private pedestalRoot = new Group();
  private characterRoot = new Group();
  private poseEditorRoot = new Group();
  private signageRoot = new Group();
  private effectsRoot = new Group();
  private loader: GLTFLoader;
  private environmentTexture?: Texture;
  private environmentTarget?: WebGLRenderTarget;
  private ownedTextures = new Set<Texture>();
  private signSurfacePromise?: Promise<IndustrialSignSurfaceTextures | undefined>;
  private searchlights: Array<{ light: SpotLight; shaft: Mesh; side: -1 | 1; phase: number }> = [];
  private groundFogLayers: Array<{ mesh: Mesh; texture: Texture; speed: Vector2; offset: Vector2 }> = [];
  private volumetricFogPass?: ShaderPass;
  private volumetricFogCapable = false;
  private fogQuality: JunkyardFogQualityState = { mode: "fallback", lowSamples: 0, highSamples: 0 };
  private fogSampleStartedAt = performance.now();
  private fogSampleFrames = 0;
  private fogReadyAt = 0;
  private modelCache = new Map<string, Promise<Object3D>>();
  private arenaEnhancement?: () => Promise<void>;
  private arenaEnhancementStarted = false;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private generation = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private mobile = window.matchMedia("(max-width: 700px)").matches;
  private capture = false;
  private singleLayout: boolean;
  private manifest?: ArenaManifest;
  private arenaReady: Promise<void>;
  private rankX = [0, -2.55, 2.55];
  private standingHeights = [0.8694, 0.7056, 0.6489];
  private cameraBase = ARENA_CAMERA.position.clone();
  private cameraOrbitBase = ARENA_CAMERA.position.clone();
  private cameraTarget = ARENA_CAMERA.target.clone();
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
  private currentIdleYaw = 0;
  private lastCameraInteractionAt = performance.now();
  private orbitFov = ARENA_CAMERA.fov;
  private dragPointer = -1;
  private dragX = 0;
  private dragY = 0;
  private poseBones: PoseBones = {};
  private editableBoneNames = new Set<string>();
  private editableBoneNodes = new Map<string, Object3D[]>();
  private primaryBoneNodes = new Map<string, Object3D>();
  private poseHandles = new Map<string, Mesh>();
  private poseHandleTargets = new Map<string, Object3D>();
  private poseLine?: LineSegments;
  private poseLinePairs: Array<[Object3D, Object3D]> = [];
  private poseRaycaster = new Raycaster();
  private posePointer = new Vector2();
  private activePoseBone = "";
  private activePoseButton = -1;
  private targetCharacterYaw = 0;
  private currentCharacterYaw = 0;

  constructor(private host: HTMLElement) {
    const stage = host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) throw new Error("missing-stage");
    host.dataset.podiumState = "initializing";
    this.status("Starting the 3D renderer…", 46);
    const capture = new URLSearchParams(location.search).has("podium-capture"); this.capture = capture;
    if (capture) {
      host.dataset.podiumCapture = "true";
      document.documentElement.dataset.podiumCapture = "true";
    }
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: capture });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.7));
    this.renderer.outputColorSpace = SRGBColorSpace; this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.dataset.podiumCanvas = ""; this.renderer.domElement.style.touchAction = "none"; stage.append(this.renderer.domElement);
    this.singleLayout = host.dataset.podiumLayout === "single";
    this.editableBoneNames = new Set(String(host.dataset.poseBones || "").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean));
    const draco = new DRACOLoader(); draco.setDecoderPath(host.dataset.decoderPath || "");
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(draco); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.backdropRoot.name = "GENERATED_BACKDROP_PANELS"; this.backdropRoot.position.set(0, 2.8, -12.5);
    this.scene.add(this.camera);
    this.worldRoot.name = "SCENE_ROOT";
    this.poseEditorRoot.name = "PROFILE_POSE_EDITOR_RIG";
    this.worldRoot.add(this.backdropRoot, this.baseRoot, this.pedestalRoot, this.characterRoot, this.signageRoot, this.effectsRoot, this.poseEditorRoot);
    this.scene.add(this.worldRoot);
    if (this.singleLayout) this.arenaReady = this.buildSingleStage();
    else this.arenaReady = this.buildArenaStage();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(stage); this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored);
    this.animate();
  }

  attachTo(host: HTMLElement) {
    if (this.host === host) return;
    const stage = host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) throw new Error("missing-stage");
    this.observer.disconnect();
    this.host = host;
    this.singleLayout = host.dataset.podiumLayout === "single";
    stage.append(this.renderer.domElement);
    this.observer.observe(stage);
    this.resize();
  }

  private async buildSingleStage() {
    this.scene.background = new Color(0x100f0d); this.scene.fog = new FogExp2(0x17130f, .045);
    this.renderer.toneMappingExposure = 1.08;
    this.scene.add(new AmbientLight(0x8d8171, 1));
    const key = new DirectionalLight(0xffc995, 5.2); key.name = "PROFILE_CHARACTER_KEY"; key.position.set(4, 9, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 5; key.shadow.camera.bottom = -2; key.shadow.bias = -0.0006; this.scene.add(key);
    const fill = new DirectionalLight(0xd9e4df, 1.25); fill.name = "PROFILE_CHARACTER_FILL"; fill.position.set(-4, 4.5, 5.5);
    const rim = new DirectionalLight(0xd45a22, 2); rim.name = "PROFILE_CHARACTER_WARM_RIM"; rim.position.set(-6, 5, -4);
    const coolRim = new DirectionalLight(0x8eb7c7, 1.05); coolRim.name = "PROFILE_CHARACTER_COOL_RIM"; coolRim.position.set(4.5, 4, -5);
    this.scene.add(fill, rim, coolRim);
    const ground = await this.buildTexturedGround(PROFILE_PODIUM_GROUND, profilePodiumGroundHeight, "PROFILE_PODIUM_GROUND");
    this.baseRoot.add(ground);
    const floor = new Mesh(new CylinderGeometry(5.5, 6.2, 0.34, 12), new MeshStandardMaterial({ color: 0x211e19, metalness: .52, roughness: .68 }));
    floor.position.y = -0.25; floor.receiveShadow = true; this.baseRoot.add(floor);
    const pedestal = buildIndustrialPedestal(pedestalConfigForRank(1, this.mobile ? 32 : 48));
    this.standingHeights[0] = pedestal.standingHeight; this.pedestalRoot.add(pedestal.root);
    this.camera.position.set(0, 2.65, 6.4); this.camera.lookAt(0, 1.22, 0);
    this.addEmbers(28, 0x91f0a2);
  }

  private async buildArenaStage() {
    this.host.dataset.podiumState = "scene"; this.status("Building the arena shell…", 62);
    const response = await fetch(this.host.dataset.sceneManifest || "", { cache: "no-cache", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`scene manifest returned ${response.status}`);
    const manifest = await response.json() as ArenaManifest;
    if (manifest.revision !== APPROVED_SCENE_REVISION || manifest.assets.length !== APPROVED_SCENE_ASSET_COUNT) throw new Error("unapproved scene manifest");
    this.manifest = manifest; this.host.dataset.sceneRevision = manifest.revision;
    const camera = manifest.camera;
    this.camera.fov = ARENA_CAMERA.fov; this.camera.near = numeric(camera, "Near_m", .05); this.camera.far = numeric(camera, "Far_m", 60);
    this.cameraBase.copy(ARENA_CAMERA.position); this.cameraTarget.copy(ARENA_CAMERA.target);
    this.renderer.toneMappingExposure = Math.pow(2, numeric(camera, "Exposure_EV", -.45) - .55);
    this.scene.background = new Color(0x0b0d0e); this.scene.fog = new FogExp2(0x171a1b, JUNKYARD_ATMOSPHERE.sceneFogDensity);
    const fallbackOnly = new URLSearchParams(location.search).has("podium-fallback");
    const hasEnvironment = fallbackOnly ? false : await this.buildArenaEnvironment().catch(() => false);
    if (!hasEnvironment) { await this.buildBackdropPanels(); this.host.dataset.sceneEnvironment = "panels"; }
    this.buildArenaPodiums(manifest); this.buildInitialFloor(); this.buildArenaGantrySupports(); this.buildArenaLights(manifest); this.buildAtmosphere();
    this.setupComposer();
    this.resize();
    const placements = manifest.basePlacements
      .filter((placement) => this.useNativePlacement(placement))
      .filter((placement) => shouldRenderArenaPlacement(placement.id, this.mobile))
      .sort((left, right) => this.placementPriority(left) - this.placementPriority(right));
    this.arenaEnhancement = () => this.enhanceArena(placements);
  }

  private buildInitialFloor() {
    const geometry = this.buildGroundGeometry(JUNKYARD_GROUND, junkyardGroundHeight, junkyardGroundSurfaceShade);
    const material = new MeshStandardMaterial({ color: 0x3b3027, roughness: .94, metalness: 0, vertexColors: true });
    const floor = new Mesh(geometry, material); floor.name = "ARENA_JUNKYARD_GROUND";
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, JUNKYARD_GROUND.baseY, JUNKYARD_GROUND.centerZ); floor.receiveShadow = true;
    this.baseRoot.add(floor); this.buildGroundScatter(); this.host.dataset.sceneGround = "initial-material";
  }

  private async enhanceArena(placements: ArenaPlacement[]) {
    if (this.arenaEnhancementStarted || this.disposed) return;
    this.arenaEnhancementStarted = true; this.host.dataset.podiumDetail = "loading";
    // Let the completed podium paint once, then stream detail without artificial idle delays.
    await yieldToRenderer();
    const floor = this.baseRoot.getObjectByName("ARENA_JUNKYARD_GROUND") as Mesh | undefined;
    if (floor) {
      try {
        const { material, state } = await this.buildGroundMaterial(JUNKYARD_GROUND);
        if (!this.disposed) { const previous = floor.material; floor.material = material; (Array.isArray(previous) ? previous : [previous]).forEach((item) => item.dispose()); this.host.dataset.sceneGround = state; }
        else material.dispose();
      } catch { /* The fast material remains usable. */ }
    }
    if (this.disposed) return;
    await yieldToRenderer();
    this.host.dataset.scenePlacements = "0";
    this.host.dataset.scenePlacementsTotal = String(placements.length);
    let loaded = await this.loadPlacementBatch(placements, this.baseRoot, this.mobile ? 3 : 6, true, (count) => {
      this.host.dataset.scenePlacements = String(count);
      this.setProgress(88 + (count / Math.max(placements.length, 1)) * 11);
    });
    if (this.disposed) return;
    let loadedIds = new Set(this.baseRoot.children.map((child) => child.name));
    let missing = placements.filter((placement) => !loadedIds.has(placement.id));
    if (missing.length) {
      await yieldToRenderer();
      const firstPassLoaded = loaded;
      loaded += await this.loadPlacementBatch(missing, this.baseRoot, this.mobile ? 2 : 3, true, (count) => {
        const total = firstPassLoaded + count;
        this.host.dataset.scenePlacements = String(total);
        this.setProgress(88 + (total / Math.max(placements.length, 1)) * 11);
      });
      loadedIds = new Set(this.baseRoot.children.map((child) => child.name));
      missing = placements.filter((placement) => !loadedIds.has(placement.id));
    }
    this.host.dataset.scenePlacements = String(loaded);
    if (missing.length || loaded !== placements.length) {
      this.host.dataset.scenePlacementsFailed = missing.map((placement) => placement.id).join(",");
      throw new Error(`arena placements unavailable: ${missing.map((placement) => placement.id).join(", ")}`);
    }
    delete this.host.dataset.scenePlacementsFailed;
    await yieldToRenderer();
    this.host.dataset.sceneEffects = this.composer ? "full" : "direct";
    this.host.dataset.podiumDetail = "ready";
  }

  private async buildArenaEnvironment(): Promise<boolean> {
    const source = this.host.dataset.environmentSrc || ""; if (!source) return false;
    const texture = await new RGBELoader().loadAsync(source);
    if (this.disposed) { texture.dispose(); return false; }
    texture.mapping = EquirectangularReflectionMapping;
    const generator = new PMREMGenerator(this.renderer);
    generator.compileEquirectangularShader();
    const target = generator.fromEquirectangular(texture); generator.dispose();
    this.environmentTexture = texture; this.environmentTarget = target;
    this.scene.background = texture; this.scene.environment = target.texture;
    this.scene.backgroundIntensity = .62; this.scene.environmentIntensity = .72;
    const rotation = MathUtils.degToRad(180);
    this.scene.backgroundRotation.set(0, rotation, 0); this.scene.environmentRotation.set(0, rotation, 0);
    this.host.dataset.sceneEnvironment = "hdri";
    return true;
  }

  private async buildBackdropPanels() {
    const source = this.host.dataset.backdropSrc || ""; if (!source) return;
    const texture = await new TextureLoader().loadAsync(source); texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
    const panels = [
      { textureIndex: 0, position: [-9.15, 0, 5.1] as [number, number, number], yaw: 43, width: 12.5, shade: 0x817a70 },
      { textureIndex: 1, position: [0, 0, 0] as [number, number, number], yaw: 0, width: 12.5, shade: 0x817a70 },
      { textureIndex: 2, position: [9.15, 0, 5.1] as [number, number, number], yaw: -43, width: 12.5, shade: 0x817a70 },
      { textureIndex: 0, position: [-14, 0, 11.2] as [number, number, number], yaw: 90, width: 20, shade: 0x5f5a52 },
      { textureIndex: 2, position: [14, 0, 11.2] as [number, number, number], yaw: -90, width: 20, shade: 0x5f5a52 },
    ];
    panels.forEach((spec, index) => {
      const panelTexture = texture.clone(); panelTexture.colorSpace = SRGBColorSpace;
      panelTexture.wrapS = ClampToEdgeWrapping; panelTexture.wrapT = ClampToEdgeWrapping;
      panelTexture.repeat.set(1 / 3, 1); panelTexture.offset.set(spec.textureIndex / 3, 0); panelTexture.needsUpdate = true;
      const panel = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ map: panelTexture, color: spec.shade, fog: true, toneMapped: true, depthWrite: false }),
      );
      panel.name = `GENERATED_BACKDROP_PANEL_${index + 1}`; panel.renderOrder = -100;
      panel.position.set(...spec.position); panel.rotation.y = MathUtils.degToRad(spec.yaw); panel.scale.set(spec.width, 20.25, 1);
      panel.userData.panelIndex = index; this.backdropRoot.add(panel);
    });
  }

  private placementRenderScale(placement: ArenaPlacement): [number, number, number] {
    // The RustRelay GLBs share Unity's meter scale. Only the generic tiled cubes
    // are intentionally stretched to construct the arena shell.
    if (shouldLiftForwardMoundVisibility(placement.id)) {
      return [
        placement.scale[0] * FORWARD_MOUND_VISIBILITY.horizontalScale,
        placement.scale[1] * FORWARD_MOUND_VISIBILITY.verticalScale,
        placement.scale[2] * FORWARD_MOUND_VISIBILITY.horizontalScale,
      ];
    }
    if (/^(?:ENV_(?:FLOOR|BACKWALL|SIDEWALL)|BG_)/.test(placement.id)) return placement.scale;
    return [1, 1, 1];
  }

  private useNativePlacement(placement: ArenaPlacement): boolean {
    if (placement.id === "ENV_TARP_BACK" || placement.id.startsWith("ENV_FLOOR_") || placement.id.startsWith("ENV_SIDEWALL_")) return false;
    if (["L_WEAPON_THOMPSON", "C_WEAPON_L96", "C_WEAPON_M39", "C_MINIGUN", "R_ROCKET_LAUNCHER"].includes(placement.id)) return false;
    return !/(?:RUBBLE|GRAVEL)/.test(placement.id);
  }

  private buildArenaPodiums(manifest: ArenaManifest) {
    ([1, 2, 3] as const).forEach((podiumRank) => {
      const rank = podiumRank - 1; const node = manifest.sceneNodes.find((item) => String(item.node_id) === `PODIUM_RANK_${podiumRank}`);
      const position = Array.isArray(node?.position_m) ? node.position_m.map(Number) : [this.rankX[rank], 0, 0];
      const pedestal = buildIndustrialPedestal(pedestalConfigForRank(podiumRank, this.mobile ? 32 : 48));
      pedestal.root.position.set(position[0] || 0, position[1] || 0, position[2] || 0);
      this.rankX[rank] = pedestal.root.position.x; this.standingHeights[rank] = pedestal.root.position.y + pedestal.standingHeight;
      this.pedestalRoot.add(pedestal.root);
    });
  }

  private async loadGroundTexture(source: string): Promise<Texture | undefined> {
    if (!source) return undefined;
    try {
      const texture = await new TextureLoader().loadAsync(source);
      if (this.disposed) { texture.dispose(); return undefined; }
      this.ownedTextures.add(texture); return texture;
    } catch { return undefined; }
  }

  private buildGroundGeometry(
    config: GroundConfig,
    heightAt: (x: number, z: number) => number,
    surfaceShadeAt: (x: number, z: number) => number = () => 1,
  ): PlaneGeometry {
    const geometry = new PlaneGeometry(
      config.width, config.depth, config.widthSegments, config.depthSegments,
    );
    const positions = geometry.getAttribute("position"); const colors: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index); const worldZ = config.centerZ - positions.getY(index);
      const heightOffset = heightAt(x, worldZ) - config.baseY;
      const heightShade = 1 + heightOffset * .72;
      const shade = MathUtils.clamp(heightShade * surfaceShadeAt(x, worldZ), .7, 1.26);
      positions.setZ(index, heightOffset);
      colors.push(shade, shade * .98, shade * .94);
    }
    positions.needsUpdate = true; geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    return geometry;
  }

  private async buildGroundMaterial(config: GroundConfig): Promise<{ material: MeshStandardMaterial; state: string }> {
    const [preferredAlbedo, normal, arm] = await Promise.all([
      this.loadGroundTexture(this.host.dataset.groundAlbedoSrc || ""),
      this.loadGroundTexture(this.host.dataset.groundNormalSrc || ""),
      this.loadGroundTexture(this.host.dataset.groundArmSrc || ""),
    ]);
    const albedo = preferredAlbedo || await this.loadGroundTexture(this.host.dataset.groundFallbackSrc || "");
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    [albedo, normal, arm].forEach((texture) => {
      if (!texture) return;
      texture.wrapS = MirroredRepeatWrapping; texture.wrapT = MirroredRepeatWrapping;
      texture.repeat.set(config.repeatX, config.repeatY); texture.anisotropy = anisotropy;
    });
    if (albedo) albedo.colorSpace = SRGBColorSpace;
    const material = new MeshStandardMaterial({
      color: albedo ? 0x9a8877 : 0x2a2119,
      map: albedo,
      normalMap: normal,
      normalScale: new Vector2(.92, .92),
      aoMap: arm,
      aoMapIntensity: .9,
      roughnessMap: arm,
      roughness: .9,
      metalness: 0,
      vertexColors: true,
    });
    return { material, state: podiumGroundMaterialState(Boolean(preferredAlbedo), Boolean(albedo)) };
  }

  private async buildTexturedGround(
    config: GroundConfig,
    heightAt: (x: number, z: number) => number,
    name: string,
    surfaceShadeAt: (x: number, z: number) => number = () => 1,
  ): Promise<Mesh> {
    const geometry = this.buildGroundGeometry(config, heightAt, surfaceShadeAt);
    const { material, state } = await this.buildGroundMaterial(config);
    const ground = new Mesh(geometry, material); ground.name = name;
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, config.baseY, config.centerZ); ground.receiveShadow = true;
    this.host.dataset.sceneGround = state;
    return ground;
  }

  private async buildSolidFloor() {
    const floor = await this.buildTexturedGround(
      JUNKYARD_GROUND, junkyardGroundHeight, "ARENA_JUNKYARD_GROUND", junkyardGroundSurfaceShade,
    );
    this.baseRoot.add(floor); this.buildGroundScatter();
  }

  private buildGroundScatter() {
    const placements = junkyardGroundScatter(this.mobile); const dummy = new Object3D();
    const specs = [
      { kind: "pebble" as const, geometry: new IcosahedronGeometry(1, 1), material: new MeshStandardMaterial({ color: 0x514a42, roughness: .94, metalness: 0 }) },
      { kind: "metal" as const, geometry: new BoxGeometry(1, 1, 1), material: new MeshStandardMaterial({ color: 0x563324, roughness: .7, metalness: .66 }) },
    ];
    specs.forEach((spec) => {
      const instances = placements.filter((placement) => placement.kind === spec.kind);
      const mesh = new InstancedMesh(spec.geometry, spec.material, instances.length); mesh.name = `ARENA_GROUND_${spec.kind.toUpperCase()}`;
      instances.forEach((placement, index) => {
        dummy.position.set(...placement.position); dummy.rotation.set(...placement.rotation); dummy.scale.set(...placement.scale); dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.receiveShadow = true; this.baseRoot.add(mesh);
    });
  }

  private buildArenaGantrySupports() {
    const layout = JUNKYARD_GANTRY_LAYOUT;
    const root = new Group(); root.name = "GENERATED_GANTRY_SUPPORTS";
    const material = new MeshStandardMaterial({ color: 0x342b25, roughness: .72, metalness: .68 });
    const addBeam = (name: string, start: Vector3, end: Vector3, thicknessX: number, thicknessZ: number) => {
      const direction = end.clone().sub(start); const length = direction.length();
      const beam = new Mesh(new BoxGeometry(thicknessX, length, thicknessZ), material);
      beam.name = name; beam.position.copy(start).add(end).multiplyScalar(.5);
      beam.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
      beam.castShadow = !this.mobile; beam.receiveShadow = true; root.add(beam);
    };
    layout.supportXs.forEach((x, index) => {
      const side = x < 0 ? -1 : 1;
      addBeam(
        `GANTRY_COLUMN_${index === 0 ? "L" : "R"}`,
        new Vector3(x, junkyardGroundHeight(x, layout.trussCenterZ), layout.trussCenterZ),
        new Vector3(x, layout.supportTopY, layout.trussCenterZ),
        layout.supportWidth,
        layout.supportDepth,
      );
      addBeam(
        `GANTRY_BRACE_${index === 0 ? "L" : "R"}`,
        new Vector3(x, layout.braceBottomY, layout.trussCenterZ),
        new Vector3(x - side * layout.braceInset, layout.braceTopY, layout.trussCenterZ),
        layout.braceThickness,
        layout.braceThickness,
      );
    });
    this.baseRoot.add(root);
  }

  private buildArenaLights(manifest: ArenaManifest) {
    RectAreaLightUniformsLib.init();
    for (const row of manifest.lights) {
      if (!(row.Enabled === true || String(row.Enabled).toLowerCase() === "true")) continue;
      const type = String(row.Type || "").toLowerCase(); const color = String(row.Color_Hex || "#ffffff"); const intensity = Number(row.Intensity) || 0;
      const position = new Vector3(Number(row.Pos_X_m) || 0, Number(row.Pos_Y_m) || 0, Number(row.Pos_Z_m) || 0);
      const target = new Vector3(Number(row.Target_X_m) || 0, Number(row.Target_Y_m) || 0, Number(row.Target_Z_m) || 0);
      if (type.includes("hemisphere")) {
        const light = new HemisphereLight(color, 0x17100b, intensity * 2.2); light.position.copy(position); this.scene.add(light); continue;
      }
      if (type.includes("rect")) {
        const area = Math.max(.1, (Number(row.Area_Width_m) || 1) * (Number(row.Area_Height_m) || 1));
        const light = new RectAreaLight(color, intensity / (56 * Math.PI * area), Number(row.Area_Width_m) || 1, Number(row.Area_Height_m) || 1);
        light.position.copy(position); light.lookAt(target); this.scene.add(light); continue;
      }
      if (type.includes("spot")) {
        const outer = MathUtils.degToRad(Number(row.Outer_Cone_deg) || 30);
        const light = new SpotLight(color, intensity / 58, Number(row.Range_m) || 18, outer, Number(row.Penumbra) || .5, 2);
        light.position.copy(position); light.target.position.copy(target); light.castShadow = row.Cast_Shadow === true;
        if (light.castShadow) { const mapSize = this.mobile ? 1024 : 2048; light.shadow.mapSize.set(mapSize, mapSize); light.shadow.bias = Number(row.Shadow_Bias) || -.0005; }
        this.scene.add(light, light.target);
        if (Number(row.Volumetric_Weight) > .4) this.addLightShaft(position, target, color, Number(row.Volumetric_Weight));
        continue;
      }
      const divisor = String(row.Entity_ID || "").includes("PODIUM") ? 62 : 48;
      const light = new PointLight(color, intensity / divisor, Number(row.Range_m) || 5, 2); light.position.copy(position); this.scene.add(light);
    }
    const leftWing = new PointLight(0xff7b32, 4.2, 10, 2); leftWing.position.set(-7.4, 2.15, 1.2);
    const rightWing = new PointLight(0xffad62, 3.8, 10, 2); rightWing.position.set(7.4, 2.15, 1.2);
    const leftForwardFill = new PointLight(0xff7430, 8, 14, 2); leftForwardFill.position.set(-16.5, 3.1, 5);
    const rightForwardFill = new PointLight(0xff8e45, 7.5, 14, 2); rightForwardFill.position.set(16.5, 3.1, 5);
    const rearFill = new PointLight(0x7e99a2, 2.1, 13, 2); rearFill.position.set(0, 3.6, -7.4);
    const terrainRake = new DirectionalLight(0xd98549, .9); terrainRake.name = "ARENA_TERRAIN_RAKE";
    terrainRake.position.set(-13, 1.9, 8); terrainRake.target.position.set(7, -.1, -18);
    this.scene.add(leftWing, rightWing, leftForwardFill, rightForwardFill, rearFill, terrainRake, terrainRake.target);
    this.addArenaCharacterLights();
  }

  private addArenaCharacterLights() {
    const keyIntensity = this.mobile ? 58 : 92;
    const rimIntensity = this.mobile ? 24 : 38;
    this.rankX.forEach((x, rank) => {
      const targetY = this.standingHeights[rank] + 1.15;
      const key = new SpotLight(0xffd4a6, keyIntensity, 10, MathUtils.degToRad(31), .82, 1.45);
      key.name = `PODIUM_CHARACTER_KEY_RANK_${rank + 1}`;
      key.position.set(x + (rank === 1 ? -.55 : .55), targetY + 2.15, 4.15);
      key.target.position.set(x, targetY, 0);
      key.castShadow = false;

      const rim = new SpotLight(0x8eb8c8, rimIntensity, 8, MathUtils.degToRad(35), .88, 1.5);
      rim.name = `PODIUM_CHARACTER_RIM_RANK_${rank + 1}`;
      rim.position.set(x + (rank === 2 ? .7 : -.7), targetY + 1.25, -2.8);
      rim.target.position.set(x, targetY + .1, 0);
      rim.castShadow = false;

      this.scene.add(key, key.target, rim, rim.target);
    });
  }

  private addLightShaft(start: Vector3, end: Vector3, color: string, weight: number) {
    const direction = end.clone().sub(start); const length = direction.length();
    const shaft = new Mesh(new ConeGeometry(.72, length, 18, 1, true), new MeshBasicMaterial({ color, transparent: true, opacity: .014 * weight, depthWrite: false, blending: AdditiveBlending }));
    shaft.position.copy(start).add(end).multiplyScalar(.5); shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    shaft.renderOrder = 18; this.effectsRoot.add(shaft);
  }

  private alignSearchlightShaft(shaft: Mesh, origin: Vector3, target: Vector3) {
    const direction = target.clone().sub(origin); const length = direction.length();
    shaft.position.copy(origin).add(target).multiplyScalar(.5);
    // ConeGeometry's tip is at local +Y, so point +Y back toward the fixture.
    // The broad end then lands at the moving target instead of at the lamp.
    shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize().negate());
    const targetRadius = Math.tan(MathUtils.degToRad(18)) * length;
    shaft.scale.set(targetRadius, length, targetRadius);
  }

  private addScanningSearchlights() {
    JUNKYARD_SEARCHLIGHTS.forEach((config) => {
      const origin = new Vector3(...config.origin); const targetPosition = new Vector3(...junkyardSearchlightTarget(config.side, 0, this.reduceMotion, config.phase));
      const light = new SpotLight(0xffa45e, this.mobile ? 280 : 430, 38, MathUtils.degToRad(23), .68, 1.65);
      light.name = config.side < 0 ? "ARENA_SEARCHLIGHT_LEFT" : "ARENA_SEARCHLIGHT_RIGHT";
      light.position.copy(origin); light.target.position.copy(targetPosition); light.castShadow = false;
      this.scene.add(light, light.target);
      const shaft = new Mesh(
        new ConeGeometry(1, 1, 24, 1, true),
        new MeshBasicMaterial({
          color: 0xffad68, transparent: true, opacity: this.mobile ? .045 : .065,
          depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false,
        }),
      );
      const core = new Mesh(
        new ConeGeometry(1, 1, 24, 1, true),
        new MeshBasicMaterial({
          color: 0xffc184, transparent: true, opacity: this.mobile ? .075 : .115,
          depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false,
        }),
      );
      core.name = `${light.name}_BEAM_CORE`; core.scale.set(.52, 1, .52); core.renderOrder = 19; shaft.add(core);
      shaft.name = `${light.name}_BEAM`; shaft.renderOrder = 18; this.alignSearchlightShaft(shaft, origin, targetPosition); this.effectsRoot.add(shaft);
      this.searchlights.push({ light, shaft, side: config.side, phase: config.phase });
    });
  }

  private buildAtmosphere() {
    const texture = hazeTexture(); this.ownedTextures.add(texture);
    this.buildGroundFog(texture);
    this.addScanningSearchlights();
    this.addEmbers(this.mobile ? 28 : 64, 0x5eed1234);
  }

  private buildGroundFog(source: Texture) {
    const specs = junkyardFallbackFogLayers(this.mobile);
    specs.forEach((spec, index) => {
      const map = source.clone(); map.wrapS = MirroredRepeatWrapping; map.wrapT = MirroredRepeatWrapping;
      map.repeat.set(spec.repeat[0], spec.repeat[1]); map.offset.set(spec.offset[0], spec.offset[1]); map.needsUpdate = true;
      this.ownedTextures.add(map);
      const material = new MeshBasicMaterial({
        map, color: index === 0 ? 0xaab4b0 : 0x87928f, transparent: true, opacity: spec.opacity,
        depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false, fog: true,
      });
      const fog = new Mesh(new PlaneGeometry(44, 30), material); fog.name = `ARENA_GROUND_FOG_${index + 1}`;
      fog.rotation.x = -Math.PI / 2; fog.position.set(0, spec.y, -3.5); fog.renderOrder = 15 + index; this.effectsRoot.add(fog);
      this.groundFogLayers.push({ mesh: fog, texture: map, speed: new Vector2(spec.speed[0], spec.speed[1]), offset: new Vector2(spec.offset[0], spec.offset[1]) });
    });
  }

  private addEmbers(count: number, seed: number) {
    const random = seededRandom(seed); const geometry = new BufferGeometry(); const positions: number[] = [];
    for (let index = 0; index < count; index += 1) positions.push((random() - .5) * 18, .25 + random() * 6.4, -5.8 + random() * 11);
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const embers = new Points(geometry, new PointsMaterial({ color: 0xffa03b, size: this.mobile ? .04 : .055, transparent: true, opacity: .58, depthWrite: false, blending: AdditiveBlending }));
    embers.name = "ArenaEmbers"; embers.userData.particles = true; this.effectsRoot.add(embers);
  }

  private setupComposer() {
    const stage = this.host.querySelector<HTMLElement>("[data-podium-stage]")!; const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight);
    const renderTarget = new WebGLRenderTarget(width, height, { depthBuffer: true });
    const composer = new EffectComposer(this.renderer, renderTarget);
    composer.renderTarget1.depthTexture = new DepthTexture(width, height, UnsignedIntType);
    composer.renderTarget2.depthTexture = new DepthTexture(width, height, UnsignedIntType);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.volumetricFogCapable = this.canUseVolumetricFog();
    if (this.volumetricFogCapable) {
      const fogPass = new ShaderPass(VOLUMETRIC_FOG_SHADER);
      fogPass.uniforms.cameraNear.value = this.camera.near; fogPass.uniforms.cameraFar.value = this.camera.far;
      fogPass.uniforms.cameraProjectionMatrixInverse.value = this.camera.projectionMatrixInverse;
      fogPass.uniforms.cameraWorldMatrix.value = this.camera.matrixWorld;
      composer.addPass(fogPass); this.volumetricFogPass = fogPass;
      this.setFogQuality("volumetric");
    } else this.setFogQuality("fallback");
    if (!this.mobile) {
      const ssao = new SSAOPass(this.scene, this.camera, width, height); ssao.kernelRadius = 5; ssao.minDistance = .0005; ssao.maxDistance = .045; composer.addPass(ssao);
    }
    composer.addPass(new UnrealBloomPass(new Vector2(width, height), .16, .65, 1.15));
    this.composer = composer;
  }

  private canUseVolumetricFog(): boolean {
    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8);
    return !this.mobile && !this.reduceMotion && this.renderer.capabilities.isWebGL2
      && (this.capture || (memory >= 4 && (navigator.hardwareConcurrency || 8) >= 6));
  }

  private setFogQuality(mode: "volumetric" | "fallback") {
    const volumetric = mode === "volumetric" && Boolean(this.volumetricFogPass);
    if (this.volumetricFogPass) this.volumetricFogPass.enabled = volumetric;
    this.groundFogLayers.forEach(({ mesh }) => { mesh.visible = !volumetric; });
    this.fogQuality = { mode: volumetric ? "volumetric" : "fallback", lowSamples: 0, highSamples: 0 };
    this.host.dataset.sceneFog = this.fogQuality.mode;
  }

  private updateFogPerformance(now: number) {
    // The desktop composition is authored around the volumetric pass. Background-tab
    // throttling can look like poor GPU performance and must not replace it with flat fog.
    if (!this.mobile || !this.volumetricFogCapable || this.capture) return;
    if (document.hidden) {
      this.fogReadyAt = 0; this.fogSampleStartedAt = now; this.fogSampleFrames = 0; return;
    }
    if (this.host.dataset.podiumState !== "ready") {
      this.fogReadyAt = 0; this.fogSampleStartedAt = now; this.fogSampleFrames = 0; return;
    }
    if (!this.fogReadyAt) { this.fogReadyAt = now; this.fogSampleStartedAt = now; this.fogSampleFrames = 0; return; }
    if (now - this.fogReadyAt < 5000) { this.fogSampleStartedAt = now; this.fogSampleFrames = 0; return; }
    this.fogSampleFrames += 1; const elapsed = now - this.fogSampleStartedAt;
    if (elapsed < 1000) return;
    const framesPerSecond = this.fogSampleFrames * 1000 / elapsed;
    const next = nextJunkyardFogQuality(this.fogQuality, framesPerSecond, true);
    if (next.mode !== this.fogQuality.mode) this.setFogQuality(next.mode); else this.fogQuality = next;
    this.host.dataset.sceneFogFps = framesPerSecond.toFixed(1);
    this.fogSampleStartedAt = now; this.fogSampleFrames = 0;
  }

  private onVisibilityChange = () => {
    const now = performance.now();
    this.fogReadyAt = 0; this.fogSampleStartedAt = now; this.fogSampleFrames = 0;
    this.fogQuality.lowSamples = 0; this.fogQuality.highSamples = 0;
  };

  private placementPriority(placement: ArenaPlacement): number {
    const classes: Record<string, number> = { Hero: 0, Primary: 1, Structure: 2, Secondary: 3, Detail: 4 };
    return classes[placement.lodClass] ?? 3;
  }

  private async loadPlacementBatch(
    placements: ArenaPlacement[],
    parent: Group,
    concurrency: number,
    yieldBetween = false,
    onProgress?: (loaded: number) => void,
  ): Promise<number> {
    let cursor = 0; let loaded = 0;
    const worker = async () => {
      while (cursor < placements.length && !this.disposed) {
        const placement = placements[cursor++];
        try { const instance = await this.createPlacement(placement); parent.add(instance); loaded += 1; onProgress?.(loaded); }
        catch { /* Individual dressing assets degrade without removing the podium. */ }
        if (yieldBetween) await yieldToRenderer();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, placements.length) }, () => worker())); return loaded;
  }

  private async createPlacement(placement: ArenaPlacement): Promise<Group> {
    if (!this.manifest) throw new Error("manifest unavailable");
    const base = this.host.dataset.sceneModelBase || "";
    let visual: Object3D;
    try { visual = await this.loadInstance(joinedUrl(base, placement.localPath)); }
    catch (error) {
      const fallback = SCENE_MODEL_FALLBACKS[placement.localPath];
      if (!fallback) throw error;
      visual = await this.loadInstance(joinedUrl(base, fallback));
      visual.userData.sceneFallbackFor = placement.localPath;
    }
    visual.scale.setScalar(1); visual.updateMatrixWorld(true);
    const nativeBounds = staticBounds(visual); visual.position.sub(anchorPoint(nativeBounds, placement.anchor));
    visual.traverse((node) => {
      const mesh = node as Mesh; if (!mesh.isMesh) return;
      const primary = placement.lodClass === "Hero" || placement.lodClass === "Primary";
      if (isBarbedWirePlacement(placement.id)) {
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((source) => {
          const material = source.clone() as MeshStandardMaterial;
          // The embedded texture contains alpha, but the source GLB marks this material OPAQUE.
          material.alphaTest = .35;
          material.transparent = false;
          material.depthWrite = true;
          material.side = DoubleSide;
          material.needsUpdate = true;
          return material;
        });
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      }
      if (/^ENV_(?:FLOOR|BACKWALL|SIDEWALL)/.test(placement.id)) {
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((source) => {
          const material = source.clone() as MeshStandardMaterial;
          if (material.color) material.color.multiplyScalar(placement.id.startsWith("ENV_FLOOR") ? .18 : .28);
          material.roughness = Math.max(material.roughness, .68); return material;
        });
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      }
      if (shouldLiftForwardMoundVisibility(placement.id)) {
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((source) => {
          const material = source.clone() as MeshStandardMaterial;
          if (material.color) material.color.multiplyScalar(FORWARD_MOUND_VISIBILITY.colorMultiplier);
          material.toneMapped = false;
          if (material.isMeshStandardMaterial) {
            material.emissive.setHex(FORWARD_MOUND_VISIBILITY.emissive);
            material.emissiveIntensity = FORWARD_MOUND_VISIBILITY.emissiveIntensity;
          }
          return material;
        });
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      }
      mesh.castShadow = placement.castShadow && primary && !this.mobile; mesh.receiveShadow = placement.receiveShadow; mesh.renderOrder = placement.renderOrder;
      mesh.frustumCulled = true;
    });
    const wrapper = new Group(); wrapper.name = placement.id; wrapper.add(visual);
    const renderScale = this.placementRenderScale(placement);
    const transform = arenaPlacementTransform(placement);
    wrapper.position.set(...transform.position); wrapper.rotation.set(...transform.rotation.map(MathUtils.degToRad) as [number, number, number]);
    const followsTerrain = transform.position[1] <= .08;
    const sampledGroundY = junkyardGroundHeight(transform.position[0], transform.position[2]);
    if (followsTerrain) {
      wrapper.position.y = junkyardGroundedPlacementY(transform.position[1], transform.position[0], transform.position[2]);
      wrapper.userData.terrainGrounded = true;
      wrapper.userData.terrainGroundY = sampledGroundY;
    }
    const decorativeWeapon = /weapon|rifle|launcher|(?:^|[^a-z])gun(?:[^a-z]|$)/i.test(`${placement.role} ${placement.localPath}`);
    if (decorativeWeapon && followsTerrain) {
      wrapper.updateMatrixWorld(true);
      const rotatedBounds = new Box3().setFromObject(wrapper);
      wrapper.position.y += sampledGroundY + .025 - rotatedBounds.min.y;
      wrapper.userData.grounded = true;
    }
    wrapper.userData.showcaseZone = transform.zone;
    wrapper.scale.set(...renderScale);
    return wrapper;
  }

  async setPresentation(board: string, metric: string, leaders: Leader[]) {
    const generation = ++this.generation;
    this.targetYaw = 0; this.targetPitch = 0; this.currentIdleYaw = 0; this.lastCameraInteractionAt = performance.now();
    try { await this.arenaReady; }
    catch (error) { console.warn("Raidlands podium arena failed to initialize.", error); this.fail("Arena assets unavailable. Showing the poster and leaderboard cards."); return; }
    if (generation !== this.generation || this.disposed) return;
    this.host.dataset.podiumState = "characters"; this.status("Loading the winning character…", 76);
    const sceneLeaders = Array.from({ length: 3 }, (_, index) => leaders[index] || {});
    if (!this.singleLayout) this.buildSignage(board, metric, leaders.slice(0, 3));
    const winner = await this.buildCharacter(sceneLeaders[0], 0, generation);
    if (generation !== this.generation || this.disposed) return;
    if (!winner) { this.fail("Character assets unavailable. Showing the poster and leaderboard cards."); return; }
    this.characterRoot.clear(); this.characterRoot.add(winner);
    this.poseBones = { ...(sceneLeaders[0]?.appearance?.pose?.bones || {}) };
    this.rebuildPoseEditorRig();
    this.host.dataset.sceneCharacters = "1"; this.host.dataset.sceneThemeProps = "0";
    this.setProgress(82);
    if (this.singleLayout) {
      this.host.dataset.podiumState = "ready";
      this.status(leaders.length ? "Player arena ready." : "3D arena ready.", 100);
      return;
    }
    try { await this.completePresentation(board, metric, leaders, sceneLeaders, generation); }
    catch (error) {
      console.warn("Raidlands podium presentation failed to initialize.", error);
      this.fail("Arena assets unavailable. Showing the poster and leaderboard cards."); return;
    }
    if (generation !== this.generation || this.disposed) return;
    this.host.dataset.podiumState = "ready";
    this.status(leaders.length ? "Player arena ready." : "3D arena ready.", 100);
  }

  private async completePresentation(board: string, metric: string, leaders: Leader[], sceneLeaders: Leader[], generation: number) {
    const secondaryCharacters = await Promise.all(sceneLeaders.slice(1).map((leader, index) => this.buildCharacter(leader, index + 1, generation)));
    if (generation !== this.generation || this.disposed) return;
    secondaryCharacters.forEach((character) => { if (character) this.characterRoot.add(character); });
    this.host.dataset.sceneCharacters = String(this.characterRoot.children.length);
    this.setProgress(86);
    if (!this.singleLayout) {
      const signSurface = await this.loadSignSurface();
      if (generation !== this.generation || this.disposed) return;
      this.buildSignage(board, metric, leaders.slice(0, 3), signSurface);
      this.host.dataset.podiumSignage = "ready";
    }
    if (this.arenaEnhancement) {
      this.host.dataset.podiumState = "details";
      this.status("Loading arena detail…", 88);
      await this.arenaEnhancement();
    }
  }

  private characterAnchor(rank: number): ArenaPlacement | undefined {
    const id = `CHAR_RANK_${rank + 1}`; return this.manifest?.characterAnchors.find((placement) => placement.id === id);
  }

  private async buildCharacter(leader: Leader, rank: number, generation: number): Promise<Group | undefined> {
    const keys = podiumWearables(leader, rank); const roots: Object3D[] = [];
    const poseBones = leader.appearance?.pose?.bones || {};
    await Promise.all(keys.map(async (key) => {
      const file = LEADERBOARD_PODIUM_ASSETS[key]; if (!file) return;
      try { const model = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", file)); normalizeWearableOrigin(model); poseWearable(model, rank, poseBones); roots.push(model); }
      catch { /* Resolve through the fallback chain below. */ }
    }));
    if (!roots.length) {
      await Promise.all(LEADERBOARD_PODIUM_PRESETS.survivor.map(async (key) => {
        try { const model = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", LEADERBOARD_PODIUM_ASSETS[key])); normalizeWearableOrigin(model); poseWearable(model, rank, poseBones); roots.push(model); }
        catch { /* The merged mannequin is the final scene fallback. */ }
      }));
    }
    if (!roots.length && !this.singleLayout) {
      const anchor = this.characterAnchor(rank);
      if (anchor) try { roots.push(await this.loadInstance(joinedUrl(this.host.dataset.sceneModelBase || "", anchor.localPath))); } catch { /* Cards remain authoritative. */ }
    }
    if (generation !== this.generation || this.disposed || !roots.length) return undefined;
    const visual = new Group(); roots.forEach((root) => visual.add(root));
    const targetHeight = this.characterAnchor(rank)?.targetExtent || 1.8; const box = staticBounds(visual); const size = box.getSize(new Vector3());
    visual.scale.setScalar(targetHeight / Math.max(size.y, .01)); const fitted = staticBounds(visual); const center = fitted.getCenter(new Vector3());
    visual.position.x -= center.x; visual.position.y -= fitted.min.y; visual.position.z -= center.z;
    const wrapper = new Group(); wrapper.add(visual);
    const anchor = this.characterAnchor(rank);
    // Keep the fitted soles exactly on the authored standing surface. The profile
    // viewer does not apply the leaderboard's idle bounce, so it cannot appear to hover.
    wrapper.position.set(anchor?.position[0] ?? this.rankX[rank], this.standingHeights[rank], anchor?.position[2] ?? 0);
    wrapper.rotation.y = podiumCharacterYaw(rank); wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = rank * 1.7;
    const weaponKey = podiumWeapon(leader);
    if (weaponKey) {
      try {
        const weapon = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", LEADERBOARD_PODIUM_ASSETS[weaponKey]));
        if (generation !== this.generation) return undefined;
        weapon.traverse((node) => { if ((node as Mesh).isMesh) (node as Mesh).castShadow = false; });
        const weaponSize = staticBounds(weapon).getSize(new Vector3()); const layout = podiumWeaponLayout(weaponKey, rank);
        weapon.scale.setScalar(layout.size / Math.max(weaponSize.x, weaponSize.y, weaponSize.z, .01));
        const weaponCenter = staticBounds(weapon).getCenter(new Vector3()); weapon.position.sub(weaponCenter);
        const mount = new Group(); mount.name = "weapon-mount"; mount.add(weapon); mount.position.set(...layout.position); mount.rotation.set(...layout.rotation); wrapper.add(mount);
      } catch { /* The selected outfit remains visible if its weapon fails. */ }
    }
    return wrapper;
  }

  private async loadInstance(url: string): Promise<Object3D> {
    let promise = this.modelCache.get(url);
    if (!promise) {
      promise = this.loader.loadAsync(url).then((gltf) => {
        const root = gltf.scene; const rigidReplacements: Array<{ source: SkinnedMesh; replacement: Mesh }> = [];
        root.traverse((node) => {
          if ((node as Mesh).isMesh) (node as Mesh).frustumCulled = false;
          if ((node as SkinnedMesh).isSkinnedMesh) {
            const skinned = node as SkinnedMesh; if (expandSkinAttributes(skinned)) return;
            const rigidGeometry = skinned.geometry.clone(); rigidGeometry.applyMatrix4(skinned.bindMatrix);
            const replacement = new Mesh(rigidGeometry, skinned.material); replacement.name = skinned.name; replacement.position.copy(skinned.position);
            replacement.quaternion.copy(skinned.quaternion); replacement.scale.copy(skinned.scale); replacement.renderOrder = skinned.renderOrder; replacement.frustumCulled = false;
            rigidReplacements.push({ source: skinned, replacement });
          }
        });
        rigidReplacements.forEach(({ source, replacement }) => { if (source.parent) { source.parent.add(replacement); source.parent.remove(source); } });
        return root;
      });
      promise = promise.catch((error) => { this.modelCache.delete(url); throw error; });
      this.modelCache.set(url, promise);
    }
    return cloneSkinnedScene(await promise);
  }

  setPoseBones(bones: PoseBones) {
    if (!this.singleLayout || this.disposed) return;
    this.poseBones = JSON.parse(JSON.stringify(bones || {})) as PoseBones;
    this.editableBoneNodes.forEach((nodes, name) => {
      const custom = this.poseBones[name] || {};
      nodes.forEach((node) => {
        const base = node.userData.podiumBaseRotation as PoseRotation | undefined;
        if (!base) return;
        node.rotation.set(
          Number(base.x) + (Number(custom.x) || 0),
          Number(base.y) + (Number(custom.y) || 0),
          Number(base.z) + (Number(custom.z) || 0),
        );
      });
    });
    this.characterRoot.updateMatrixWorld(true);
    this.updatePoseEditorRig();
  }

  rebuildPoseEditorRig() {
    this.poseEditorRoot.traverse((node) => {
      const mesh = node as Mesh; if (mesh.geometry) mesh.geometry.dispose();
      const material = (mesh as Mesh).material; if (material) (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
    });
    this.poseEditorRoot.clear(); this.editableBoneNodes.clear(); this.primaryBoneNodes.clear();
    this.poseHandles.clear(); this.poseHandleTargets.clear(); this.poseLinePairs = []; this.poseLine = undefined;
    if (this.host.dataset.poseEditor !== "true" || this.host.dataset.interactionMode !== "pose" || !this.characterRoot.children.length) return;
    this.characterRoot.traverse((node) => {
      const name = node.name.toLowerCase();
      if (!this.editableBoneNames.has(name) || !node.userData.podiumBaseRotation) return;
      const nodes = this.editableBoneNodes.get(name) || []; nodes.push(node); this.editableBoneNodes.set(name, nodes);
      if (!this.primaryBoneNodes.has(name)) this.primaryBoneNodes.set(name, node);
    });
    this.primaryBoneNodes.forEach((node, name) => {
      const child = node.children.find((candidate) => this.editableBoneNames.has(candidate.name.toLowerCase()));
      const target = child || node; this.poseHandleTargets.set(name, target);
      if (child) this.poseLinePairs.push([node, child]);
      const sideColor = name.startsWith("l_") ? 0x65bfff : name.startsWith("r_") ? 0xff875f : 0x91f0a2;
      const handle = new Mesh(new SphereGeometry(.045, 12, 8), new MeshBasicMaterial({ color: sideColor, depthTest: false, transparent: true, opacity: .92 }));
      handle.name = `POSE_HANDLE_${name}`; handle.userData.poseBone = name; handle.renderOrder = 1000;
      this.poseHandles.set(name, handle); this.poseEditorRoot.add(handle);
    });
    const positions = new Float32Array(Math.max(1, this.poseLinePairs.length) * 6);
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.poseLine = new LineSegments(geometry, new LineBasicMaterial({ color: 0x91f0a2, depthTest: false, transparent: true, opacity: .72 }));
    this.poseLine.name = "PROFILE_POSE_BONES"; this.poseLine.renderOrder = 999; this.poseEditorRoot.add(this.poseLine);
    this.setPoseBones(this.poseBones);
  }

  private updatePoseEditorRig() {
    if (!this.poseHandles.size) return;
    const world = new Vector3();
    this.poseHandles.forEach((handle, name) => {
      const target = this.poseHandleTargets.get(name); if (!target) return;
      target.getWorldPosition(world); this.worldRoot.worldToLocal(world); handle.position.copy(world);
      const material = handle.material as MeshBasicMaterial;
      material.opacity = this.activePoseBone === name ? 1 : .82; handle.scale.setScalar(this.activePoseBone === name ? 1.45 : 1);
    });
    const attribute = this.poseLine?.geometry.getAttribute("position") as BufferAttribute | undefined;
    if (!attribute) return;
    this.poseLinePairs.forEach(([start, end], index) => {
      start.getWorldPosition(world); this.worldRoot.worldToLocal(world); attribute.setXYZ(index * 2, world.x, world.y, world.z);
      end.getWorldPosition(world); this.worldRoot.worldToLocal(world); attribute.setXYZ(index * 2 + 1, world.x, world.y, world.z);
    });
    attribute.needsUpdate = true;
  }

  private clearSignage() {
    const geometries = new Set<BufferGeometry>(); const materials = new Set<MeshStandardMaterial | MeshBasicMaterial>(); const textures = new Set<CanvasTexture>();
    this.signageRoot.traverse((node) => {
      const mesh = node as Mesh; if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        const standard = material as MeshStandardMaterial;
        if (standard.map instanceof CanvasTexture) textures.add(standard.map);
        materials.add(material as MeshStandardMaterial);
      });
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose());
    this.signageRoot.clear();
  }

  private loadSignSurface(): Promise<IndustrialSignSurfaceTextures | undefined> {
    if (this.signSurfacePromise) return this.signSurfacePromise;
    this.signSurfacePromise = (async () => {
      const sources = [this.host.dataset.signAlbedoSrc, this.host.dataset.signNormalSrc, this.host.dataset.signArmSrc];
      if (sources.some((source) => !source)) return undefined;
      try {
        const [albedo, normal, arm] = await Promise.all(sources.map((source) => new TextureLoader().loadAsync(source!)));
        if (this.disposed) { albedo.dispose(); normal.dispose(); arm.dispose(); return undefined; }
        const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        [albedo, normal, arm].forEach((texture) => {
          texture.wrapS = MirroredRepeatWrapping; texture.wrapT = MirroredRepeatWrapping;
          texture.repeat.set(2.2, 1.35); texture.anisotropy = anisotropy; this.ownedTextures.add(texture);
        });
        albedo.colorSpace = SRGBColorSpace; return { albedo, normal, arm };
      } catch { return undefined; }
    })();
    return this.signSurfacePromise;
  }

  private buildSignage(board: string, metric: string, leaders: Leader[], surface?: IndustrialSignSurfaceTextures) {
    this.clearSignage();
    const detail = industrialSignDetail(this.mobile); const categoryProfile = INDUSTRIAL_SIGN_PROFILES.category;
    const category = buildIndustrialSign({ variant: "category", detail, ...categoryProfile, texture: categorySignTexture(podiumCategoryTitle(board, metric)), surface }).root;
    category.name = "CATEGORY_SIGN"; category.position.set(...CATEGORY_SIGN_TRANSFORM.position);
    if (this.mobile) category.scale.setScalar(1.35);
    for (const x of [-2.35, 2.35]) {
      const chain = new Group(); chain.name = "CATEGORY_HANGING_CHAIN";
      const links = this.mobile ? 4 : 7; const chainMaterial = new MeshStandardMaterial({ color: 0x171512, metalness: .94, roughness: .42 });
      for (let index = 0; index < links; index += 1) {
        const link = new Mesh(new CylinderGeometry(.027, .027, .18, 8), chainMaterial);
        link.position.y = index * .15; link.rotation.z = index % 2 ? Math.PI / 2 : 0; chain.add(link);
      }
      chain.position.set(x, CATEGORY_SIGN_TRANSFORM.position[1] + .82, CATEGORY_SIGN_TRANSFORM.position[2]); this.signageRoot.add(chain);
    }
    this.signageRoot.add(category);
    if (!this.mobile) {
      for (const x of [-2.05, 2.05]) {
        const light = new PointLight(0xff5a16, 4.2, 3.2, 2); light.name = "SIGN_ACCENT_LIGHT";
        light.position.set(x, CATEGORY_SIGN_TRANSFORM.position[1] - .55, CATEGORY_SIGN_TRANSFORM.position[2] + .62); this.signageRoot.add(light);
      }
    }
    for (let rank = 1; rank <= 3; rank += 1) {
      const transform = playerSignageTransform(rank, this.mobile, this.rankX[rank - 1]);
      const variant = industrialSignVariantForRank(rank); const profile = INDUSTRIAL_SIGN_PROFILES[variant];
      const plaque = buildIndustrialSign({ variant, detail, ...profile, texture: playerSignTexture(playerSignageText(leaders[rank - 1], rank, board, metric)), surface }).root;
      plaque.name = `PLAYER_SIGN_${rank}`; plaque.position.set(...transform.position);
      plaque.rotation.set(transform.pitch, transform.yaw, 0); plaque.scale.setScalar(transform.scale);
      this.signageRoot.add(plaque);
      if (rank === 1 && !this.mobile) {
        const winnerLight = new PointLight(0xff4a0c, 3.4, 2.5, 2); winnerLight.name = "WINNER_SIGN_LIGHT";
        winnerLight.position.set(transform.position[0], transform.position[1] - .18, transform.position[2] + .7); this.signageRoot.add(winnerLight);
      }
    }
  }

  private resize() {
    const stage = this.host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) return;
    const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight); this.camera.aspect = width / height;
    if (this.singleLayout) {
      this.camera.position.set(0, 2.65, this.camera.aspect < .9 ? 9.4 : this.camera.aspect < 1.35 ? 7.8 : 6.4); this.camera.lookAt(0, 1.22, 0);
    } else {
      const framing = this.camera.aspect < 16 / 9 ? (16 / 9) / Math.max(this.mobile ? .9 : .7, this.camera.aspect) : 1;
      this.cameraOrbitBase.copy(this.cameraBase);
      this.cameraOrbitBase.z = this.cameraTarget.z + (this.cameraBase.z - this.cameraTarget.z) * framing;
      this.updateArenaCamera();
    }
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.disposed) return;
    if (this.singleLayout) {
      const poseMode = this.host.dataset.poseEditor === "true" && this.host.dataset.interactionMode === "pose";
      if (poseMode) {
        if (event.button !== 0 && event.button !== 2) return;
        if (this.activePoseBone && event.pointerId === this.dragPointer) { this.activePoseButton = event.button; return; }
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.posePointer.set(((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1);
        this.poseRaycaster.setFromCamera(this.posePointer, this.camera);
        const hit = this.poseRaycaster.intersectObjects([...this.poseHandles.values()], false)[0];
        const bone = String(hit?.object.userData.poseBone || ""); if (!bone) return;
        event.preventDefault(); this.activePoseBone = bone; this.activePoseButton = event.button;
        this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
        this.renderer.domElement.setPointerCapture(event.pointerId); this.host.dataset.poseBoneDragging = "true";
        this.host.dispatchEvent(new CustomEvent("raidlands:podium-bone-select", { detail: { bone } }));
        this.updatePoseEditorRig(); return;
      }
      if (event.button !== 0) return;
      event.preventDefault(); this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
      this.renderer.domElement.setPointerCapture(event.pointerId); this.host.dataset.podiumDragging = "true";
      return;
    }
    this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
    const yawLimit = MathUtils.degToRad(this.mobile ? 60 : 75);
    this.currentYaw = MathUtils.clamp(this.currentYaw + this.currentIdleYaw, -yawLimit, yawLimit);
    this.targetYaw = MathUtils.clamp(this.targetYaw + this.currentIdleYaw, -yawLimit, yawLimit);
    this.currentIdleYaw = 0;
    this.lastCameraInteractionAt = performance.now();
    this.renderer.domElement.setPointerCapture(event.pointerId); this.host.dataset.podiumDragging = "true";
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointer) return;
    const deltaX = event.clientX - this.dragX; const deltaY = event.clientY - this.dragY; this.dragX = event.clientX; this.dragY = event.clientY;
    if (this.singleLayout && this.activePoseBone) {
      event.preventDefault(); const current = this.poseBones[this.activePoseBone] || { x: 0, y: 0, z: 0 };
      const next = { x: Number(current.x) || 0, y: Number(current.y) || 0, z: Number(current.z) || 0 };
      const rolling = this.activePoseButton === 2 || Boolean(event.buttons & 2);
      if (rolling) next.z = MathUtils.clamp(next.z + deltaX * .012, -Math.PI, Math.PI);
      else {
        next.x = MathUtils.clamp(next.x + deltaY * .01, -Math.PI, Math.PI);
        next.y = MathUtils.clamp(next.y + deltaX * .01, -Math.PI, Math.PI);
      }
      this.poseBones[this.activePoseBone] = next; this.setPoseBones(this.poseBones);
      this.host.dispatchEvent(new CustomEvent("raidlands:podium-bone-edit", { detail: { bone: this.activePoseBone, rotation: next } }));
      return;
    }
    if (this.singleLayout) {
      event.preventDefault();
      this.targetCharacterYaw += deltaX * .012;
      return;
    }
    this.lastCameraInteractionAt = performance.now();
    const clamped = clampArenaRotation(this.targetYaw + deltaX * .004, this.targetPitch + deltaY * .003, this.mobile ? 60 : 75);
    this.targetYaw = clamped.yaw; this.targetPitch = clamped.pitch;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointer) return; this.dragPointer = -1; this.host.dataset.podiumDragging = "false";
    if (this.singleLayout && this.activePoseBone) {
      if (event.buttons) { this.dragPointer = event.pointerId; this.activePoseButton = event.buttons & 2 ? 2 : 0; return; }
      this.activePoseBone = ""; this.activePoseButton = -1; this.host.dataset.poseBoneDragging = "false";
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
      this.updatePoseEditorRig(); return;
    }
    this.lastCameraInteractionAt = performance.now();
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  private onContextMenu = (event: MouseEvent) => {
    if (this.singleLayout && this.host.dataset.poseEditor === "true") event.preventDefault();
  };

  private onContextLost = (event: Event) => {
    event.preventDefault(); this.host.dataset.podiumState = "loading";
    this.status("3D graphics paused. Restoring the preview…");
  };

  private onContextRestored = () => {
    if (this.disposed) return; this.resize(); this.host.dataset.podiumState = "ready";
    this.status("3D preview restored.");
  };

  private updateArenaCamera() {
    const yawLimit = MathUtils.degToRad(this.mobile ? 60 : 75);
    const effectiveYaw = MathUtils.clamp(this.currentYaw + this.currentIdleYaw, -yawLimit, yawLimit);
    const edge = MathUtils.clamp(Math.abs(effectiveYaw) / yawLimit, 0, 1);
    const orbit = orbitCameraPosition(this.cameraOrbitBase, this.cameraTarget, effectiveYaw, this.currentPitch);
    orbit.sub(this.cameraTarget).multiplyScalar(1 + edge * (this.mobile ? .08 : .12)).add(this.cameraTarget);
    this.camera.position.copy(orbit);
    const nextFov = ARENA_CAMERA.fov + edge * (this.mobile ? 1.5 : 2.5);
    if (Math.abs(nextFov - this.orbitFov) > .01) { this.orbitFov = nextFov; this.camera.fov = nextFov; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(this.cameraTarget);
  }

  private animate = () => {
    if (this.disposed) return; const now = performance.now(); const time = now * .001;
    this.currentYaw += (this.targetYaw - this.currentYaw) * .1; this.currentPitch += (this.targetPitch - this.currentPitch) * .1;
    this.currentCharacterYaw += (this.targetCharacterYaw - this.currentCharacterYaw) * .16;
    if (this.singleLayout && this.characterRoot.children[0]) this.characterRoot.children[0].rotation.y = podiumCharacterYaw(0) + this.currentCharacterYaw;
    const idleTarget = this.singleLayout ? 0 : idleArenaYawTarget(now, this.lastCameraInteractionAt, this.reduceMotion);
    this.currentIdleYaw += (idleTarget - this.currentIdleYaw) * .055;
    if (!this.singleLayout) this.updateArenaCamera();
    this.searchlights.forEach(({ light, shaft, side, phase }) => {
      light.target.position.set(...junkyardSearchlightTarget(side, time, this.reduceMotion, phase));
      this.alignSearchlightShaft(shaft, light.position, light.target.position);
    });
    this.groundFogLayers.forEach(({ texture, speed, offset }) => {
      const motionTime = this.reduceMotion ? 0 : time;
      texture.offset.set(offset.x + motionTime * speed.x, offset.y + motionTime * speed.y);
    });
    if (!this.reduceMotion) {
      if (!this.singleLayout) this.characterRoot.children.forEach((character) => { character.position.y = character.userData.baseY + Math.sin(time * .72 + character.userData.phase) * .012; });
      const embers = this.effectsRoot.getObjectByName("ArenaEmbers"); if (embers) embers.position.y = Math.sin(time * .28) * .14;
    }
    if (this.poseHandles.size) this.updatePoseEditorRig();
    if (this.composer) {
      if (this.volumetricFogPass) {
        this.volumetricFogPass.uniforms.tDepth.value = this.composer.readBuffer.depthTexture;
        this.volumetricFogPass.uniforms.fogTime.value = this.reduceMotion ? 0 : time;
      }
      this.composer.render(); this.updateFogPerformance(now);
    } else this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private setProgress(progress: number) {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    this.host.style.setProperty("--loader-progress", String(value));
    this.host.style.setProperty("--loader-progress-sweep", `${value * 3.6}deg`);
    this.host.style.setProperty("--loader-progress-tip-opacity", value > 0 && value < 100 ? "1" : "0");
    this.host.style.setProperty("--loader-progress-tip-angle", `${value * 3.6 - 180}deg`);
    this.host.style.setProperty("--loader-progress-tip-counter-angle", `${180 - value * 3.6}deg`);
    const node = this.host.querySelector<HTMLElement>("[data-podium-progress-value]");
    if (node) node.textContent = String(value).padStart(2, "0");
  }

  private status(message: string, progress?: number) {
    const node = this.host.querySelector<HTMLElement>("[data-podium-status]"); if (node) node.textContent = message;
    if (progress !== undefined) this.setProgress(progress);
  }
  private fail(message: string) { this.host.dataset.podiumState = "fallback"; this.status(message, 100); this.dispose(); }

  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown); this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp); this.renderer.domElement.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContextMenu);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    const geometries = new Set<BufferGeometry>(); const materials = new Set<MeshStandardMaterial | MeshBasicMaterial | PointsMaterial>();
    this.scene.traverse((node) => {
      const mesh = node as Mesh; if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material as MeshStandardMaterial));
      if ((node as Points).isPoints) { const points = node as Points; geometries.add(points.geometry); materials.add(points.material as PointsMaterial); }
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); this.ownedTextures.forEach((texture) => texture.dispose());
    this.environmentTexture?.dispose(); this.environmentTarget?.dispose(); this.composer?.dispose(); this.renderer.dispose();
  }
}

const instances = new Map<HTMLElement, PodiumScene>();
let sharedLeaderboardScene: PodiumScene | undefined;
function activateHost(host: HTMLElement): PodiumScene | undefined {
  if (host.dataset.podiumLayout !== "single" && sharedLeaderboardScene) {
    sharedLeaderboardScene.attachTo(host);
    instances.set(host, sharedLeaderboardScene);
    return sharedLeaderboardScene;
  }
  if (instances.has(host) || !supportsWebGL2()) {
    if (!supportsWebGL2()) {
      host.dataset.podiumState = "fallback";
      const status = host.querySelector<HTMLElement>("[data-podium-status]");
      if (status) status.textContent = "3D is unavailable on this device. Leaderboard results are still ready below.";
    }
    return instances.get(host);
  }
  try {
    const scene = new PodiumScene(host); instances.set(host, scene);
    if (host.dataset.podiumLayout !== "single") sharedLeaderboardScene = scene;
    return scene;
  } catch { host.dataset.podiumState = "fallback"; }
}

function present(host: HTMLElement, payload: Payload) {
  const board = String(payload.board || host.dataset.board || "players"); const metric = String(payload.metric || host.dataset.metric || "kills");
  const leaders = Array.isArray(payload.leaders) ? payload.leaders : [];
  host.dataset.board = board; host.dataset.metric = metric; renderCards(host, leaders, board, metric);
  const category = host.querySelector<HTMLElement>("[data-podium-category]"); if (category) category.textContent = podiumCategoryTitle(board, metric);
  void activateHost(host)?.setPresentation(board, metric, leaders);
}

document.querySelectorAll<HTMLElement>("[data-leaderboard-podium]").forEach((host) => {
  const payload = parsePayload(host); if (!host.closest<HTMLElement>("[data-leaderboard-panel]")?.hidden) present(host, payload);
});

document.addEventListener("raidlands:leaderboard-payload", (event) => {
  const custom = event as CustomEvent<Payload>;
  const panel = custom.target instanceof HTMLElement ? custom.target.closest<HTMLElement>("[data-leaderboard-panel]") : null;
  const host = panel?.querySelector<HTMLElement>("[data-leaderboard-podium]"); if (host) present(host, custom.detail);
});

document.addEventListener("raidlands:podium-preview", (event) => {
  const custom = event as CustomEvent<Payload>; const host = custom.target instanceof HTMLElement ? custom.target.closest<HTMLElement>("[data-leaderboard-podium]") : null;
  if (host) present(host, custom.detail);
});

document.addEventListener("raidlands:podium-pose-change", (event) => {
  const custom = event as CustomEvent<{ bones?: PoseBones }>;
  const host = custom.target instanceof HTMLElement ? custom.target.closest<HTMLElement>("[data-leaderboard-podium]") : null;
  const instance = host ? instances.get(host) : undefined;
  if (instance) instance.setPoseBones(custom.detail?.bones || {});
});

document.addEventListener("raidlands:podium-interaction-mode", (event) => {
  const custom = event as CustomEvent<{ mode?: string }>;
  const host = custom.target instanceof HTMLElement ? custom.target.closest<HTMLElement>("[data-leaderboard-podium]") : null;
  if (!host) return;
  host.dataset.interactionMode = custom.detail?.mode === "pose" ? "pose" : "spin";
  instances.get(host)?.rebuildPoseEditorRig();
});

window.addEventListener("pagehide", () => new Set(instances.values()).forEach((instance) => instance.dispose()), { once: true });
