import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BufferAttribute, BufferGeometry,
  CanvasTexture, ClampToEdgeWrapping, Color, ConeGeometry, CylinderGeometry, DirectionalLight, FogExp2,
  EquirectangularReflectionMapping, Float32BufferAttribute, Group, HemisphereLight, LinearFilter, MathUtils, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight,
  PMREMGenerator, Points, PointsMaterial, RectAreaLight, Scene, SkinnedMesh, SpotLight, Sprite,
  SpriteMaterial, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
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
  anchorPoint, arenaPlacementTransform, ArenaManifest, ArenaPlacement, clampArenaRotation,
  FORWARD_MOUND_VISIBILITY, generatedThemePlacements, idleArenaYawTarget, orbitCameraPosition,
  podiumCategoryTitle, podiumThemeFor, shouldLiftForwardMoundVisibility, shouldRenderArenaPlacement,
} from "./scene-policy";

type Payload = { leaders?: Leader[]; metric?: string; board?: string };
type CameraRecord = Record<string, unknown>;

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

function poseWearable(root: Object3D, rank: number) {
  const lean = [0, -0.025, 0.025][rank] || 0;
  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (name === "spine2") node.rotation.z += lean;
    if (name === "l_upperarm") { node.rotation.z += 1.16; node.rotation.x += 0.08; node.rotation.y -= 0.08; }
    if (name === "r_upperarm") { node.rotation.z -= 1.16; node.rotation.x -= 0.08; node.rotation.y += 0.08; }
    if (name === "l_forearm") { node.rotation.y -= 0.3; node.rotation.z += 0.12; }
    if (name === "r_forearm") { node.rotation.y += 0.3; node.rotation.z -= 0.12; }
    if (name === "head") node.rotation.y += [0, 0.06, -0.06][rank] || 0;
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
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext("2d")!; const random = seededRandom(0x51a9e);
  context.clearRect(0, 0, 128, 128); context.globalCompositeOperation = "lighter";
  for (let cloud = 0; cloud < 11; cloud += 1) {
    const x = 20 + random() * 88; const y = 25 + random() * 78; const radius = 22 + random() * 34;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(188,198,202,${.055 + random() * .075})`);
    gradient.addColorStop(.5, `rgba(112,123,128,${.025 + random() * .04})`);
    gradient.addColorStop(1, "rgba(45,51,55,0)"); context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new CanvasTexture(canvas); texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; return texture;
}

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
  private themeRoot = new Group();
  private effectsRoot = new Group();
  private loader: GLTFLoader;
  private environmentTexture?: Texture;
  private environmentTarget?: WebGLRenderTarget;
  private modelCache = new Map<string, Promise<Object3D>>();
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private generation = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private mobile = window.matchMedia("(max-width: 700px)").matches;
  private singleLayout: boolean;
  private manifest?: ArenaManifest;
  private arenaReady: Promise<void>;
  private rankX = [0, -2.55, 2.55];
  private standingHeights = [0.63, 0.4725, 0.4347];
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

  constructor(private host: HTMLElement) {
    const stage = host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) throw new Error("missing-stage");
    const capture = new URLSearchParams(location.search).has("podium-capture");
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
    const draco = new DRACOLoader(); draco.setDecoderPath(host.dataset.decoderPath || "");
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(draco); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.backdropRoot.name = "GENERATED_BACKDROP_PANELS"; this.backdropRoot.position.set(0, 2.8, -12.5);
    this.scene.add(this.camera);
    this.worldRoot.name = "SCENE_ROOT";
    this.worldRoot.add(this.backdropRoot, this.baseRoot, this.pedestalRoot, this.characterRoot, this.themeRoot, this.effectsRoot);
    this.scene.add(this.worldRoot);
    if (this.singleLayout) { this.buildSingleStage(); this.arenaReady = Promise.resolve(); }
    else this.arenaReady = this.buildArenaStage();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(stage); this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); this.fail("3D unavailable. Showing the arena poster and leaderboard cards."); });
    this.animate();
  }

  private buildSingleStage() {
    this.scene.background = new Color(0x100f0d); this.scene.fog = new FogExp2(0x17130f, .045);
    this.renderer.toneMappingExposure = 1.08;
    this.scene.add(new AmbientLight(0x8d8171, 1.15));
    const key = new DirectionalLight(0xffc184, 4.8); key.position.set(4, 9, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 5; key.shadow.camera.bottom = -2; key.shadow.bias = -0.0006; this.scene.add(key);
    const rim = new DirectionalLight(0xd45a22, 2.4); rim.position.set(-6, 5, -4); this.scene.add(rim);
    const ground = new Mesh(new PlaneGeometry(16, 9), new MeshStandardMaterial({ color: 0x161512, metalness: .12, roughness: .97 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.23, -1.8); ground.receiveShadow = true; this.baseRoot.add(ground);
    const floor = new Mesh(new CylinderGeometry(5.5, 6.2, 0.34, 12), new MeshStandardMaterial({ color: 0x211e19, metalness: .52, roughness: .68 }));
    floor.position.y = -0.25; floor.receiveShadow = true; this.baseRoot.add(floor);
    const pedestal = buildIndustrialPedestal(pedestalConfigForRank(1, this.mobile ? 32 : 48));
    this.standingHeights[0] = pedestal.standingHeight; this.pedestalRoot.add(pedestal.root);
    this.camera.position.set(0, 2.65, 6.4); this.camera.lookAt(0, 1.22, 0);
    this.addEmbers(28, 0x91f0a2);
  }

  private async buildArenaStage() {
    const response = await fetch(this.host.dataset.sceneManifest || "", { cache: "no-cache", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`scene manifest returned ${response.status}`);
    const manifest = await response.json() as ArenaManifest;
    if (manifest.revision !== APPROVED_SCENE_REVISION || manifest.assets.length !== APPROVED_SCENE_ASSET_COUNT) throw new Error("unapproved scene manifest");
    this.manifest = manifest; this.host.dataset.sceneRevision = manifest.revision;
    const camera = manifest.camera;
    this.camera.fov = ARENA_CAMERA.fov; this.camera.near = numeric(camera, "Near_m", .05); this.camera.far = numeric(camera, "Far_m", 60);
    this.cameraBase.copy(ARENA_CAMERA.position); this.cameraTarget.copy(ARENA_CAMERA.target);
    this.renderer.toneMappingExposure = Math.pow(2, numeric(camera, "Exposure_EV", -.45) - .55);
    this.scene.background = new Color(0x0b0d0e); this.scene.fog = new FogExp2(0x171a1b, .042);
    const fallbackOnly = new URLSearchParams(location.search).has("podium-fallback");
    const hasEnvironment = fallbackOnly ? false : await this.buildArenaEnvironment().catch(() => false);
    if (!hasEnvironment) { await this.buildBackdropPanels(); this.host.dataset.sceneEnvironment = "panels"; }
    this.buildArenaPodiums(manifest); this.buildSolidFloor(); this.buildArenaLights(manifest); this.buildAtmosphere();
    this.setupComposer();
    this.resize();
    const placements = manifest.basePlacements
      .filter((placement) => this.useNativePlacement(placement))
      .filter((placement) => shouldRenderArenaPlacement(placement.id, this.mobile))
      .sort((left, right) => this.placementPriority(left) - this.placementPriority(right));
    const loaded = await this.loadPlacementBatch(placements, this.baseRoot, 6);
    this.host.dataset.scenePlacements = String(loaded);
    const loadedIds = new Set(this.baseRoot.children.map((child) => child.name));
    const missingCritical = placements.filter((placement) => placement.lodClass === "Hero" && !loadedIds.has(placement.id));
    if (loaded < 1 || missingCritical.length) throw new Error("critical arena models unavailable");
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

  private buildSolidFloor() {
    const material = new MeshStandardMaterial({ color: 0x171512, metalness: .46, roughness: .82 });
    const floor = new Mesh(new PlaneGeometry(24, 22), material); floor.name = "ARENA_SOLID_FLOOR";
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.12, -1.5); floor.receiveShadow = true;
    this.baseRoot.add(floor);
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
    this.scene.add(leftWing, rightWing, leftForwardFill, rightForwardFill, rearFill);
  }

  private addLightShaft(start: Vector3, end: Vector3, color: string, weight: number) {
    const direction = end.clone().sub(start); const length = direction.length();
    const shaft = new Mesh(new ConeGeometry(.72, length, 18, 1, true), new MeshBasicMaterial({ color, transparent: true, opacity: .014 * weight, depthWrite: false, blending: AdditiveBlending }));
    shaft.position.copy(start).add(end).multiplyScalar(.5); shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    shaft.renderOrder = 18; this.effectsRoot.add(shaft);
  }

  private addBackdropSweep(start: Vector3, end: Vector3, phase: number) {
    const direction = end.clone().sub(start); const length = direction.length();
    const material = new MeshBasicMaterial({ color: 0xffa45e, transparent: true, opacity: .018, depthWrite: false, blending: AdditiveBlending });
    const shaft = new Mesh(new ConeGeometry(.92, length, 18, 1, true), material);
    shaft.position.copy(start).add(end).multiplyScalar(.5);
    shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    shaft.renderOrder = 18;
    shaft.userData = { backdropSweep: true, start, end, phase, amplitude: 3.2, opacity: material.opacity };
    this.effectsRoot.add(shaft);

    const practical = new PointLight(0xff8c42, 1.45, 10, 2);
    practical.position.copy(start); practical.userData = { backdropFlicker: true, baseIntensity: practical.intensity, phase };
    this.effectsRoot.add(practical);
  }

  private buildAtmosphere() {
    const texture = hazeTexture(); const centers: Array<[number, number, number, number]> = [
      [-7, 1.35, .9, .82], [-4.3, 1.45, -1.8, 1.2], [0, 1.65, -2.15, 1.05],
      [4.3, 1.45, -1.8, 1.2], [7, 1.35, .9, .82],
    ];
    centers.forEach(([x, y, z, density], group) => {
      for (let index = 0; index < (this.mobile ? 1 : 3); index += 1) {
        const haze = new Sprite(new SpriteMaterial({ map: texture, color: 0x727d80, transparent: true, opacity: .105 * density, depthWrite: false }));
        haze.position.set(x + (index - 1) * .78, y + index * .34, z - index * .3); haze.scale.set(4.4, 3.2, 1); haze.renderOrder = 17;
        haze.userData = {
          smoke: true, phase: group * 1.9 + index, speed: .09 + index * .018,
          drift: .28 + index * .08, opacity: .105 * density,
          basePosition: haze.position.clone(), baseScale: haze.scale.clone(),
        };
        this.effectsRoot.add(haze);
      }
    });
    const floorSmoke: Array<[number, number, number, number, number]> = [
      [-7, .25, 2.45, 4.2, .72], [-4.8, .25, .55, 4.8, 1.1], [-2.4, .18, .85, 3.8, .8],
      [0, .12, .65, 4.6, .72], [2.5, .18, .88, 3.8, .82], [4.9, .25, .58, 4.8, 1.1], [7, .25, 2.45, 4.2, .72],
    ];
    floorSmoke.forEach(([x, y, z, width, density], index) => {
      const smoke = new Sprite(new SpriteMaterial({ map: texture, color: 0x4f5657, transparent: true, opacity: .09 * density, depthWrite: false }));
      smoke.position.set(x, y, z); smoke.scale.set(width, 1.35, 1); smoke.renderOrder = 19;
      smoke.userData = {
        smoke: true, phase: 8 + index * 1.3, speed: .07 + index * .012,
        drift: .34 + index * .045, opacity: .09 * density,
        basePosition: smoke.position.clone(), baseScale: smoke.scale.clone(),
      };
      this.effectsRoot.add(smoke);
    });
    const backdropHaze: Array<[number, number, number, number]> = this.mobile
      ? [[-12, 1.8, -14.5, 8.5], [0, 2.1, -15.5, 10], [12, 1.8, -14.5, 8.5]]
      : [[-16, 1.8, -9, 8], [-10, 2, -15, 9], [0, 2.25, -16, 11], [10, 2, -15, 9], [16, 1.8, -9, 8]];
    backdropHaze.forEach(([x, y, z, width], index) => {
      const haze = new Sprite(new SpriteMaterial({ map: texture, color: 0x6d7374, transparent: true, opacity: .075, depthWrite: false }));
      haze.position.set(x, y, z); haze.scale.set(width, 3.2, 1); haze.renderOrder = 16;
      haze.userData = {
        smoke: true, phase: 20 + index * 1.45, speed: .045 + index * .006,
        drift: .48, opacity: .075, basePosition: haze.position.clone(), baseScale: haze.scale.clone(),
      };
      this.effectsRoot.add(haze);
    });
    this.addBackdropSweep(new Vector3(-16.6, 5.4, -8.2), new Vector3(-5.5, 1.2, -16.5), 0.4);
    this.addBackdropSweep(new Vector3(16.6, 5.5, -8.2), new Vector3(5.5, 1.2, -16.5), 2.7);
    this.addEmbers(this.mobile ? 28 : 64, 0x5eed1234);
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
    const composer = new EffectComposer(this.renderer); composer.addPass(new RenderPass(this.scene, this.camera));
    if (!this.mobile) {
      const ssao = new SSAOPass(this.scene, this.camera, width, height); ssao.kernelRadius = 5; ssao.minDistance = .0005; ssao.maxDistance = .045; composer.addPass(ssao);
    }
    composer.addPass(new UnrealBloomPass(new Vector2(width, height), .16, .65, 1.15));
    this.composer = composer;
  }

  private placementPriority(placement: ArenaPlacement): number {
    const classes: Record<string, number> = { Hero: 0, Primary: 1, Structure: 2, Secondary: 3, Detail: 4 };
    return classes[placement.lodClass] ?? 3;
  }

  private async loadPlacementBatch(placements: ArenaPlacement[], parent: Group, concurrency: number): Promise<number> {
    let cursor = 0; let loaded = 0;
    const worker = async () => {
      while (cursor < placements.length && !this.disposed) {
        const placement = placements[cursor++];
        try { const instance = await this.createPlacement(placement); parent.add(instance); loaded += 1; }
        catch { /* Individual dressing assets degrade without removing the podium. */ }
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
    const decorativeWeapon = /weapon|rifle|launcher|(?:^|[^a-z])gun(?:[^a-z]|$)/i.test(`${placement.role} ${placement.localPath}`);
    if (decorativeWeapon && transform.position[1] <= .08) {
      wrapper.updateMatrixWorld(true);
      const rotatedBounds = new Box3().setFromObject(wrapper);
      wrapper.position.y += .025 - rotatedBounds.min.y;
      wrapper.userData.grounded = true;
    }
    wrapper.userData.showcaseZone = transform.zone;
    wrapper.scale.set(...renderScale);
    return wrapper;
  }

  async setPresentation(board: string, metric: string, leaders: Leader[]) {
    const generation = ++this.generation; this.characterRoot.clear(); this.themeRoot.clear();
    this.targetYaw = 0; this.targetPitch = 0; this.currentIdleYaw = 0; this.lastCameraInteractionAt = performance.now();
    try { await this.arenaReady; }
    catch (error) { console.warn("Raidlands podium arena failed to initialize.", error); this.fail("Arena assets unavailable. Showing the poster and leaderboard cards."); return; }
    if (generation !== this.generation || this.disposed) return;
    const sceneLeaders = leaders.length ? leaders.slice(0, 3) : [{}, {}, {}];
    await Promise.all([
      ...sceneLeaders.map((leader, rank) => this.addCharacter(leader, rank, generation)),
      this.singleLayout ? Promise.resolve() : this.addTheme(board, metric, generation),
    ]);
    if (generation === this.generation && !this.disposed) {
      this.host.dataset.sceneCharacters = String(this.characterRoot.children.length);
      this.host.dataset.sceneThemeProps = String(this.themeRoot.children.reduce((total, group) => total + group.children.length, 0));
      this.host.dataset.podiumState = "ready";
      this.status(leaders.length ? "Player arena ready." : "3D arena ready.");
    }
  }

  private characterAnchor(rank: number): ArenaPlacement | undefined {
    const id = `CHAR_RANK_${rank + 1}`; return this.manifest?.characterAnchors.find((placement) => placement.id === id);
  }

  private async addCharacter(leader: Leader, rank: number, generation: number) {
    const keys = podiumWearables(leader, rank); const roots: Object3D[] = [];
    await Promise.all(keys.map(async (key) => {
      const file = LEADERBOARD_PODIUM_ASSETS[key]; if (!file) return;
      try { const model = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", file)); normalizeWearableOrigin(model); poseWearable(model, rank); roots.push(model); }
      catch { /* Resolve through the fallback chain below. */ }
    }));
    if (!roots.length) {
      await Promise.all(LEADERBOARD_PODIUM_PRESETS.survivor.map(async (key) => {
        try { const model = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", LEADERBOARD_PODIUM_ASSETS[key])); normalizeWearableOrigin(model); poseWearable(model, rank); roots.push(model); }
        catch { /* The merged mannequin is the final scene fallback. */ }
      }));
    }
    if (!roots.length && !this.singleLayout) {
      const anchor = this.characterAnchor(rank);
      if (anchor) try { roots.push(await this.loadInstance(joinedUrl(this.host.dataset.sceneModelBase || "", anchor.localPath))); } catch { /* Cards remain authoritative. */ }
    }
    if (generation !== this.generation || this.disposed || !roots.length) return;
    const visual = new Group(); roots.forEach((root) => visual.add(root));
    const targetHeight = this.characterAnchor(rank)?.targetExtent || 1.8; const box = staticBounds(visual); const size = box.getSize(new Vector3());
    visual.scale.setScalar(targetHeight / Math.max(size.y, .01)); const fitted = staticBounds(visual); const center = fitted.getCenter(new Vector3());
    visual.position.x -= center.x; visual.position.y -= fitted.min.y; visual.position.z -= center.z;
    const wrapper = new Group(); wrapper.add(visual);
    const anchor = this.characterAnchor(rank);
    wrapper.position.set(anchor?.position[0] ?? this.rankX[rank], anchor?.position[1] ?? (this.standingHeights[rank] + .01), anchor?.position[2] ?? 0);
    wrapper.rotation.y = podiumCharacterYaw(rank); wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = rank * 1.7;
    const weaponKey = podiumWeapon(leader);
    if (weaponKey) {
      try {
        const weapon = await this.loadInstance(joinedUrl(this.host.dataset.modelBase || "", LEADERBOARD_PODIUM_ASSETS[weaponKey]));
        if (generation !== this.generation) return;
        weapon.traverse((node) => { if ((node as Mesh).isMesh) (node as Mesh).castShadow = false; });
        const weaponSize = staticBounds(weapon).getSize(new Vector3()); const layout = podiumWeaponLayout(weaponKey, rank);
        weapon.scale.setScalar(layout.size / Math.max(weaponSize.x, weaponSize.y, weaponSize.z, .01));
        const weaponCenter = staticBounds(weapon).getCenter(new Vector3()); weapon.position.sub(weaponCenter);
        const mount = new Group(); mount.name = "weapon-mount"; mount.add(weapon); mount.position.set(...layout.position); mount.rotation.set(...layout.rotation); wrapper.add(mount);
      } catch { /* The selected outfit remains visible if its weapon fails. */ }
    }
    this.characterRoot.add(wrapper);
  }

  private async addTheme(board: string, metric: string, generation: number) {
    if (!this.manifest) return; const key = podiumThemeFor(board, metric); if (key === "neutral") return;
    const theme = this.manifest.themes[key]; if (!theme) return;
    const placements = generatedThemePlacements(key, theme); const staging = new Group(); staging.name = `Theme_${key}`;
    await this.loadPlacementBatch(placements, staging, 4);
    if (generation === this.generation && !this.disposed) this.themeRoot.add(staging);
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
      this.modelCache.set(url, promise);
    }
    return cloneSkinnedScene(await promise);
  }

  private resize() {
    const stage = this.host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) return;
    const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight); this.camera.aspect = width / height;
    if (this.singleLayout) {
      this.camera.position.set(0, 2.65, this.camera.aspect < .9 ? 9.4 : this.camera.aspect < 1.35 ? 7.8 : 6.4); this.camera.lookAt(0, 1.22, 0);
    } else {
      const framing = this.camera.aspect < 16 / 9 ? (16 / 9) / Math.max(.7, this.camera.aspect) : 1;
      this.cameraOrbitBase.copy(this.cameraBase);
      this.cameraOrbitBase.z = this.cameraTarget.z + (this.cameraBase.z - this.cameraTarget.z) * framing;
      this.updateArenaCamera();
    }
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.singleLayout || this.disposed) return; this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
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
    this.lastCameraInteractionAt = performance.now();
    const clamped = clampArenaRotation(this.targetYaw + deltaX * .004, this.targetPitch + deltaY * .003, this.mobile ? 60 : 75);
    this.targetYaw = clamped.yaw; this.targetPitch = clamped.pitch;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointer) return; this.dragPointer = -1; this.host.dataset.podiumDragging = "false";
    this.lastCameraInteractionAt = performance.now();
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
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
    const idleTarget = this.singleLayout ? 0 : idleArenaYawTarget(now, this.lastCameraInteractionAt, this.reduceMotion);
    this.currentIdleYaw += (idleTarget - this.currentIdleYaw) * .055;
    if (!this.singleLayout) this.updateArenaCamera();
    if (!this.reduceMotion) {
      this.characterRoot.children.forEach((character) => { character.position.y = character.userData.baseY + Math.sin(time * .72 + character.userData.phase) * .012; });
      const embers = this.effectsRoot.getObjectByName("ArenaEmbers"); if (embers) embers.position.y = Math.sin(time * .28) * .14;
      this.effectsRoot.children.forEach((effect) => {
        if (effect instanceof PointLight && effect.userData.backdropFlicker) {
          const phase = Number(effect.userData.phase || 0); const baseIntensity = Number(effect.userData.baseIntensity || 1);
          effect.intensity = baseIntensity * (.94 + Math.sin(time * 2.1 + phase) * .045 + Math.sin(time * 5.3 + phase * 2) * .015);
          return;
        }
        if (effect instanceof Mesh && effect.userData.backdropSweep) {
          const start = effect.userData.start as Vector3; const baseEnd = effect.userData.end as Vector3;
          const phase = Number(effect.userData.phase || 0); const end = baseEnd.clone();
          end.x += Math.sin(time * .24 + phase) * Number(effect.userData.amplitude || 3);
          const direction = end.clone().sub(start);
          effect.position.copy(start).add(end).multiplyScalar(.5);
          effect.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
          (effect.material as MeshBasicMaterial).opacity = Number(effect.userData.opacity || .018) * (.88 + Math.sin(time * 1.8 + phase) * .12);
          return;
        }
        if (!(effect instanceof Sprite) || !effect.userData.smoke) return;
        const phase = Number(effect.userData.phase || 0); const speed = Number(effect.userData.speed || .08);
        const drift = Number(effect.userData.drift || .25); const basePosition = effect.userData.basePosition as Vector3;
        const baseScale = effect.userData.baseScale as Vector3; const breath = 1 + Math.sin(time * speed * 1.7 + phase) * .075;
        effect.position.set(
          basePosition.x + Math.sin(time * speed + phase) * drift,
          basePosition.y + Math.sin(time * speed * 1.35 + phase * .7) * .12,
          basePosition.z + Math.cos(time * speed * .72 + phase) * drift * .32,
        );
        effect.scale.set(baseScale.x * breath, baseScale.y * (2 - breath), 1);
        effect.material.opacity = Number(effect.userData.opacity || .08) * (.72 + (Math.sin(time * speed * 2.1 + phase) + 1) * .14);
        effect.material.rotation = Math.sin(time * speed * .65 + phase) * .12;
      });
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private status(message: string) { const node = this.host.querySelector<HTMLElement>("[data-podium-status]"); if (node) node.textContent = message; }
  private fail(message: string) { this.host.dataset.podiumState = "fallback"; this.status(message); this.dispose(); }

  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown); this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp); this.renderer.domElement.removeEventListener("pointercancel", this.onPointerUp);
    const geometries = new Set<BufferGeometry>(); const materials = new Set<MeshStandardMaterial | MeshBasicMaterial | PointsMaterial | SpriteMaterial>();
    this.scene.traverse((node) => {
      const mesh = node as Mesh; if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material as MeshStandardMaterial));
      if ((node as Points).isPoints) { const points = node as Points; geometries.add(points.geometry); materials.add(points.material as PointsMaterial); }
      if (node instanceof Sprite) materials.add(node.material);
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    this.environmentTexture?.dispose(); this.environmentTarget?.dispose(); this.composer?.dispose(); this.renderer.dispose();
  }
}

const instances = new Map<HTMLElement, PodiumScene>();
function activateHost(host: HTMLElement): PodiumScene | undefined {
  if (instances.has(host) || !supportsWebGL2()) { if (!supportsWebGL2()) host.dataset.podiumState = "fallback"; return instances.get(host); }
  try { const scene = new PodiumScene(host); instances.set(host, scene); return scene; } catch { host.dataset.podiumState = "fallback"; }
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

window.addEventListener("pagehide", () => instances.forEach((instance) => instance.dispose()), { once: true });
