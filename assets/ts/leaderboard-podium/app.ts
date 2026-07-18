import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BufferAttribute, BufferGeometry,
  CanvasTexture, ClampToEdgeWrapping, Color, ConeGeometry, CylinderGeometry, DirectionalLight, FogExp2,
  Float32BufferAttribute, Group, HemisphereLight, LinearFilter, MathUtils, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight,
  Points, PointsMaterial, RectAreaLight, Scene, ShadowMaterial, SkinnedMesh, SpotLight, Sprite,
  SpriteMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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
  anchorPoint, ArenaManifest, ArenaPlacement, clampArenaRotation, generatedThemePlacements,
  normalizationScale, podiumCategoryTitle, podiumThemeFor,
} from "./scene-policy";

type Payload = { leaders?: Leader[]; metric?: string; board?: string };
type CameraRecord = Record<string, unknown>;

const APPROVED_SCENE_REVISION = "494242bdeae941e3389b34a819c514aae2cf39f8";
const ARENA_CAMERA = {
  fov: 35,
  position: new Vector3(0, 3.05, 9.7),
  target: new Vector3(0, 1.35, -0.25),
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
  const context = canvas.getContext("2d")!; const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(185,196,204,.38)"); gradient.addColorStop(.4, "rgba(119,130,138,.14)"); gradient.addColorStop(1, "rgba(45,51,55,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas); texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; return texture;
}

class PodiumScene {
  private scene = new Scene();
  private camera = new PerspectiveCamera(41, 1, 0.05, 60);
  private renderer: WebGLRenderer;
  private composer?: EffectComposer;
  private backdropRoot = new Group();
  private displayRoot = new Group();
  private worldRoot = new Group();
  private baseRoot = new Group();
  private pedestalRoot = new Group();
  private characterRoot = new Group();
  private themeRoot = new Group();
  private effectsRoot = new Group();
  private loader: GLTFLoader;
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
  private cameraTarget = ARENA_CAMERA.target.clone();
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
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
    this.backdropRoot.name = "GENERATED_BACKDROP_PANELS"; this.backdropRoot.position.z = -42;
    this.camera.add(this.backdropRoot); this.scene.add(this.camera);
    this.displayRoot.name = "ORBIT_PIVOT"; this.worldRoot.name = "SCENE_ROOT";
    this.worldRoot.add(this.baseRoot, this.pedestalRoot, this.characterRoot, this.themeRoot, this.effectsRoot);
    this.displayRoot.add(this.worldRoot); this.scene.add(this.displayRoot);
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
    const response = await fetch(this.host.dataset.sceneManifest || "", { cache: "force-cache", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`scene manifest returned ${response.status}`);
    const manifest = await response.json() as ArenaManifest;
    if (manifest.revision !== APPROVED_SCENE_REVISION || manifest.assets.length !== 76) throw new Error("unapproved scene manifest");
    this.manifest = manifest; this.host.dataset.sceneRevision = manifest.revision;
    const camera = manifest.camera;
    this.camera.fov = ARENA_CAMERA.fov; this.camera.near = numeric(camera, "Near_m", .05); this.camera.far = numeric(camera, "Far_m", 60);
    this.cameraBase.copy(ARENA_CAMERA.position); this.cameraTarget.copy(ARENA_CAMERA.target);
    const pivot = new Vector3(numeric(camera, "Orbit_Pivot_X_m"), numeric(camera, "Orbit_Pivot_Y_m"), numeric(camera, "Orbit_Pivot_Z_m"));
    this.displayRoot.position.copy(pivot); this.worldRoot.position.copy(pivot).multiplyScalar(-1);
    this.renderer.toneMappingExposure = Math.pow(2, numeric(camera, "Exposure_EV", -.45) - .55);
    this.scene.background = new Color(0x0b0d0e); this.scene.fog = new FogExp2(0x171a1b, .042);
    await this.buildBackdropPanels();
    this.buildArenaPodiums(manifest); this.buildShadowCatcher(); this.buildArenaLights(manifest); this.buildAtmosphere();
    this.setupComposer();
    this.resize();
    const placements = manifest.basePlacements
      .filter((placement) => this.useForegroundPlacement(placement))
      .sort((left, right) => this.placementPriority(left) - this.placementPriority(right));
    const loaded = await this.loadPlacementBatch(placements, this.baseRoot, 6);
    this.host.dataset.scenePlacements = String(loaded);
    const loadedIds = new Set(this.baseRoot.children.map((child) => child.name));
    const missingCritical = placements.filter((placement) => placement.lodClass === "Hero" && !loadedIds.has(placement.id));
    if (loaded < 1 || missingCritical.length) throw new Error("critical arena models unavailable");
  }

  private async buildBackdropPanels() {
    const source = this.host.dataset.backdropSrc || ""; if (!source) return;
    const texture = await new TextureLoader().loadAsync(source); texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping;
    for (let index = 0; index < 3; index += 1) {
      const panelTexture = texture.clone(); panelTexture.colorSpace = SRGBColorSpace;
      panelTexture.wrapS = ClampToEdgeWrapping; panelTexture.wrapT = ClampToEdgeWrapping;
      panelTexture.repeat.set(1 / 3, 1); panelTexture.offset.set(index / 3, 0); panelTexture.needsUpdate = true;
      const panel = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ map: panelTexture, fog: false, toneMapped: false, depthTest: false, depthWrite: false }),
      );
      panel.name = `GENERATED_BACKDROP_PANEL_${index + 1}`; panel.renderOrder = -100;
      panel.userData.panelIndex = index; panel.userData.panelTexture = panelTexture; this.backdropRoot.add(panel);
    }
  }

  private buildShadowCatcher() {
    const catcher = new Mesh(new PlaneGeometry(17, 9), new ShadowMaterial({ color: 0x050505, opacity: .14 }));
    catcher.name = "ARENA_SHADOW_CATCHER"; catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(0, -.015, -.35); catcher.receiveShadow = true; this.baseRoot.add(catcher);
  }

  private useForegroundPlacement(placement: ArenaPlacement): boolean {
    if (placement.id.startsWith("ENV_") || placement.lodClass === "Background" || placement.lodClass === "Structure") return false;
    if (/^FIX_(?:SEARCH|CEILING|LIGHTPOST)/.test(placement.id)) return false;
    return placement.position[2] > -3.35 || placement.lodClass === "Hero";
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
  }

  private addLightShaft(start: Vector3, end: Vector3, color: string, weight: number) {
    const direction = end.clone().sub(start); const length = direction.length();
    const shaft = new Mesh(new ConeGeometry(.72, length, 18, 1, true), new MeshBasicMaterial({ color, transparent: true, opacity: .014 * weight, depthWrite: false, blending: AdditiveBlending }));
    shaft.position.copy(start).add(end).multiplyScalar(.5); shaft.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    shaft.renderOrder = 18; this.effectsRoot.add(shaft);
  }

  private buildAtmosphere() {
    const texture = hazeTexture(); const centers: Array<[number, number, number, number]> = [[-4.3, 1.45, -1.8, 1.2], [0, 1.65, -2.15, 1.05], [4.3, 1.45, -1.8, 1.2]];
    centers.forEach(([x, y, z, density], group) => {
      for (let index = 0; index < (this.mobile ? 1 : 3); index += 1) {
        const haze = new Sprite(new SpriteMaterial({ map: texture, color: 0x727d80, transparent: true, opacity: .105 * density, depthWrite: false }));
        haze.position.set(x + (index - 1) * .78, y + index * .34, z - index * .3); haze.scale.set(4.4, 3.2, 1); haze.renderOrder = 17;
        haze.userData.phase = group * 1.9 + index; this.effectsRoot.add(haze);
      }
    });
    const floorSmoke: Array<[number, number, number, number, number]> = [
      [-4.8, .25, .55, 4.8, 1.1], [-2.4, .18, .85, 3.8, .8], [0, .12, .65, 4.6, .72],
      [2.5, .18, .88, 3.8, .82], [4.9, .25, .58, 4.8, 1.1],
    ];
    floorSmoke.forEach(([x, y, z, width, density], index) => {
      const smoke = new Sprite(new SpriteMaterial({ map: texture, color: 0x4f5657, transparent: true, opacity: .09 * density, depthWrite: false }));
      smoke.position.set(x, y, z); smoke.scale.set(width, 1.35, 1); smoke.renderOrder = 19;
      smoke.userData.phase = 8 + index * 1.3; this.effectsRoot.add(smoke);
    });
    this.addEmbers(this.mobile ? 28 : 64, 0x5eed1234);
  }

  private addEmbers(count: number, seed: number) {
    const random = seededRandom(seed); const geometry = new BufferGeometry(); const positions: number[] = [];
    for (let index = 0; index < count; index += 1) positions.push((random() - .5) * 15, .25 + random() * 6.4, -4.8 + random() * 7.2);
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
    const initialBounds = staticBounds(visual); visual.scale.setScalar(normalizationScale(initialBounds, placement)); visual.updateMatrixWorld(true);
    const normalizedBounds = staticBounds(visual); visual.position.sub(anchorPoint(normalizedBounds, placement.anchor));
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
      mesh.castShadow = placement.castShadow && primary && !this.mobile; mesh.receiveShadow = placement.receiveShadow; mesh.renderOrder = placement.renderOrder;
      mesh.frustumCulled = true;
    });
    const wrapper = new Group(); wrapper.name = placement.id; wrapper.add(visual);
    wrapper.position.set(...placement.position); wrapper.rotation.set(...placement.rotation.map(MathUtils.degToRad) as [number, number, number]); wrapper.scale.set(...placement.scale);
    return wrapper;
  }

  async setPresentation(board: string, metric: string, leaders: Leader[]) {
    const generation = ++this.generation; this.characterRoot.clear(); this.themeRoot.clear();
    this.targetYaw = 0; this.targetPitch = 0;
    try { await this.arenaReady; }
    catch { this.fail("Arena assets unavailable. Showing the poster and leaderboard cards."); return; }
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
      this.camera.position.copy(this.cameraBase); this.camera.position.z *= framing; this.camera.lookAt(this.cameraTarget);
    }
    if (this.backdropRoot.children.length) {
      const distance = Math.abs(this.backdropRoot.position.z); const height = 2 * distance * Math.tan(MathUtils.degToRad(this.camera.fov * .5)) * 1.025;
      const width = height * this.camera.aspect * 1.025; const panelWidth = width / 3;
      const sourceAspect = 16 / 9; const wide = this.camera.aspect >= sourceAspect;
      const visibleX = wide ? 1 : this.camera.aspect / sourceAspect;
      const visibleY = wide ? sourceAspect / this.camera.aspect : 1;
      const offsetX = (1 - visibleX) * .5; const offsetY = (1 - visibleY) * .5;
      this.backdropRoot.children.forEach((panel, index) => {
        panel.position.set((index - 1) * panelWidth, 0, 0); panel.scale.set(panelWidth * 1.006, height, 1);
        const texture = panel.userData.panelTexture as CanvasTexture | undefined;
        if (texture) { texture.repeat.set(visibleX / 3, visibleY); texture.offset.set(offsetX + index * visibleX / 3, offsetY); }
      });
    }
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.singleLayout || this.disposed) return; this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
    this.renderer.domElement.setPointerCapture(event.pointerId); this.host.dataset.podiumDragging = "true";
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointer) return;
    const deltaX = event.clientX - this.dragX; const deltaY = event.clientY - this.dragY; this.dragX = event.clientX; this.dragY = event.clientY;
    const clamped = clampArenaRotation(this.targetYaw + deltaX * .004, this.targetPitch + deltaY * .003);
    this.targetYaw = clamped.yaw; this.targetPitch = clamped.pitch;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointer) return; this.dragPointer = -1; this.host.dataset.podiumDragging = "false";
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  private animate = () => {
    if (this.disposed) return; const time = performance.now() * .001;
    this.currentYaw += (this.targetYaw - this.currentYaw) * .1; this.currentPitch += (this.targetPitch - this.currentPitch) * .1;
    this.displayRoot.rotation.set(this.currentPitch, this.currentYaw, 0);
    if (!this.reduceMotion) {
      this.characterRoot.children.forEach((character) => { character.position.y = character.userData.baseY + Math.sin(time * .72 + character.userData.phase) * .012; });
      const embers = this.effectsRoot.getObjectByName("ArenaEmbers"); if (embers) embers.position.y = Math.sin(time * .28) * .14;
      this.effectsRoot.children.forEach((effect) => { if (effect instanceof Sprite) effect.material.rotation = Math.sin(time * .08 + Number(effect.userData.phase || 0)) * .04; });
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
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); this.composer?.dispose(); this.renderer.dispose();
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
