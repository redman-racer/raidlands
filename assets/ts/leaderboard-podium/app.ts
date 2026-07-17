import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BufferAttribute, BufferGeometry, Color,
  CylinderGeometry, DirectionalLight, FogExp2, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry,
  Object3D, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, SkinnedMesh, SRGBColorSpace,
  TorusGeometry, Vector3, WebGLRenderer,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  Leader, LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_PRESETS, LEADERBOARD_PODIUM_THEMES,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "./policy";
import { normalizeWearableOrigin, podiumCharacterYaw, podiumWeaponLayout } from "./layout";

type Payload = { leaders?: Leader[]; metric?: string; board?: string };

const RANK_X = [0, -3.15, 3.15];
const RANK_HEIGHTS = [1.7, 1.1, 0.84];
const RANK_COLORS = [0xe2b854, 0xa8b3b0, 0xb77b52];

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
  const lean = [0, -0.035, 0.035][rank] || 0;
  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (name === "spine2") node.rotation.z += lean;
    if (name === "l_upperarm") { node.rotation.z -= 0.9; node.rotation.x += 0.18; }
    if (name === "r_upperarm") { node.rotation.z += 0.9; node.rotation.x -= 0.18; }
    if (name === "l_forearm") { node.rotation.y -= 0.58; node.rotation.z -= 0.18; }
    if (name === "r_forearm") { node.rotation.y += 0.58; node.rotation.z += 0.18; }
    if (name === "head") node.rotation.y += [0, 0.08, -0.08][rank] || 0;
    if ((node as Mesh).isMesh) {
      const mesh = node as Mesh;
      mesh.castShadow = false; mesh.receiveShadow = true;
      // Several exported Rust wearable skins omit non-rendering helper joints.
      // Static bounds are fitted above, so skip Three's per-frame skinned culling pass.
      mesh.frustumCulled = false;
    }
  });
}

function staticBounds(root: Object3D): Box3 {
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

  const expandedIndices = new Uint16Array(position.count * 4);
  const expandedWeights = new Float32Array(position.count * 4);
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

class PodiumScene {
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private renderer: WebGLRenderer;
  private characterRoot = new Group();
  private propRoot = new Group();
  private effectsRoot = new Group();
  private loader: GLTFLoader;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private generation = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private host: HTMLElement) {
    const stage = host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) throw new Error("missing-stage");
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7)); this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = false; stage.replaceChildren(this.renderer.domElement);
    this.camera.position.set(0, 4.05, 10.8); this.camera.lookAt(0, 1.75, 0);
    const draco = new DRACOLoader(); draco.setDecoderPath(host.dataset.decoderPath || "");
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(draco); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.buildStage(); this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(stage); this.resize();
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); this.fail("3D unavailable. Showing leaderboard cards."); });
    this.animate();
  }

  private buildStage() {
    this.scene.background = new Color(0x100f0d); this.scene.fog = new FogExp2(0x17130f, .045);
    this.scene.add(new AmbientLight(0x8d8171, 1.15));
    const key = new DirectionalLight(0xffc184, 4.8); key.position.set(4, 9, 6); this.scene.add(key);
    const rim = new DirectionalLight(0xd45a22, 2.4); rim.position.set(-6, 5, -4); this.scene.add(rim);
    const ground = new Mesh(new PlaneGeometry(24, 11), new MeshStandardMaterial({ color: 0x161512, metalness: .12, roughness: .97 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.23, -1.8); ground.receiveShadow = true; this.scene.add(ground);
    const floor = new Mesh(new CylinderGeometry(7.5, 8.2, 0.34, 12), new MeshStandardMaterial({ color: 0x211e19, metalness: 0.52, roughness: 0.68 }));
    floor.position.y = -0.25; floor.receiveShadow = true; this.scene.add(floor);

    // Industrial silhouettes and scattered rubble give the podium the depth of a Rust monument
    // without inventing leaderboard state or requiring a separate environment payload.
    const ruinMaterial = new MeshStandardMaterial({ color: 0x201d19, metalness: .58, roughness: .72 });
    [-8.2, -6.9, -5.7, 5.8, 7.1, 8.35].forEach((x, index) => {
      const height = [4.9, 3.1, 5.8, 3.8, 6.4, 4.5][index];
      const tower = new Group();
      const shaft = new Mesh(new CylinderGeometry(.075, .11, height, 6), ruinMaterial); shaft.position.y = height / 2;
      const cap = new Mesh(new CylinderGeometry(.58, .72, .16, 8), ruinMaterial); cap.position.y = height * .72;
      tower.add(shaft, cap);
      for (let level = .5; level < height; level += .65) {
        const brace = new Mesh(new CylinderGeometry(.025, .025, 1.05, 5), ruinMaterial);
        brace.position.y = level; brace.rotation.z = Math.PI / 3; tower.add(brace);
      }
      tower.position.set(x, -.1, -4.6 - (index % 2) * .8); tower.rotation.z = (index % 3 - 1) * .035; this.scene.add(tower);
    });
    for (let index = 0; index < 28; index++) {
      const rubble = new Mesh(new CylinderGeometry(.12 + Math.random() * .22, .18 + Math.random() * .3, .16 + Math.random() * .35, 5), ruinMaterial);
      const side = index % 2 ? 1 : -1; rubble.position.set(side * (4.1 + Math.random() * 3.5), -.02, -2.7 + Math.random() * 3.2);
      rubble.rotation.set(Math.random(), Math.random(), Math.random()); this.scene.add(rubble);
    }
    [[-6.1, -3.7], [5.35, -4.2], [1.8, -5.2]].forEach(([x, z], index) => {
      const fire = new PointLight(0xff6b21, index === 2 ? 9 : 13, 6.5, 2.1); fire.position.set(x, .35, z); this.scene.add(fire);
      const ember = new Mesh(new SphereGeometry(.13, 10, 8), new MeshStandardMaterial({ color: 0xff8a28, emissive: 0xff4a14, emissiveIntensity: 4 }));
      ember.position.copy(fire.position); this.effectsRoot.add(ember);
    });
    RANK_X.forEach((x, rank) => {
      const height = RANK_HEIGHTS[rank];
      const pedestal = new Mesh(new CylinderGeometry(1.4, 1.72, height, 8), new MeshStandardMaterial({ color: [0x59441f, 0x414541, 0x4d3327][rank], metalness: 0.72, roughness: 0.5 }));
      pedestal.position.set(x, height / 2, 0); pedestal.receiveShadow = true; this.scene.add(pedestal);
      const lip = new Mesh(new CylinderGeometry(1.46, 1.46, 0.1, 8), new MeshStandardMaterial({ color: RANK_COLORS[rank], emissive: RANK_COLORS[rank], emissiveIntensity: 0.07, metalness: 0.9, roughness: 0.24 }));
      lip.position.set(x, height + .02, 0); this.scene.add(lip);
      const ring = new Mesh(new TorusGeometry(1.23, .025, 8, 48), new MeshStandardMaterial({ color: RANK_COLORS[rank], emissive: RANK_COLORS[rank], emissiveIntensity: 1.2 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, height + .085, 0); this.effectsRoot.add(ring);
      const light = new PointLight(RANK_COLORS[rank], rank === 0 ? 11 : 6, 5.5, 2); light.position.set(x, height + 2.25, -1.1); this.scene.add(light);
    });
    const particles = new BufferGeometry(); const positions: number[] = [];
    for (let index = 0; index < 54; index++) positions.push((Math.random() - .5) * 12, .35 + Math.random() * 4.5, -1.8 + Math.random() * 2.5);
    particles.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const dust = new Points(particles, new PointsMaterial({ color: 0xd9a84c, size: .035, transparent: true, opacity: .42, depthWrite: false, blending: AdditiveBlending }));
    dust.userData.particles = true; this.effectsRoot.add(dust);
    this.scene.add(this.characterRoot, this.propRoot, this.effectsRoot);
  }

  async setPresentation(metric: string, leaders: Leader[]) {
    const generation = ++this.generation; this.characterRoot.clear(); this.propRoot.clear();
    await Promise.all([
      ...leaders.slice(0, 3).map((leader, rank) => this.addCharacter(leader, rank, generation)),
      ...((LEADERBOARD_PODIUM_THEMES[metric] || LEADERBOARD_PODIUM_THEMES.kills).slice(0, 2).map((file, index) => this.addBackdropProp(file, index, generation))),
    ]);
    if (generation === this.generation) this.status(leaders.length ? "Player podium ready." : "3D podium ready.");
  }

  private async addCharacter(leader: Leader, rank: number, generation: number) {
    const keys = podiumWearables(leader, rank); const roots: Object3D[] = [];
    await Promise.all(keys.map(async (key) => {
      const file = LEADERBOARD_PODIUM_ASSETS[key]; if (!file) return;
      try { const model = await this.loadInstance(file); normalizeWearableOrigin(model); poseWearable(model, rank); roots.push(model); } catch { /* A missing layer falls back to the remaining mannequin. */ }
    }));
    if (!roots.length) {
      const fallbackKeys = LEADERBOARD_PODIUM_PRESETS.survivor;
      await Promise.all(fallbackKeys.map(async (key) => {
        try { const model = await this.loadInstance(LEADERBOARD_PODIUM_ASSETS[key]); normalizeWearableOrigin(model); poseWearable(model, rank); roots.push(model); } catch { /* The card remains if the base mannequin cannot load. */ }
      }));
    }
    if (generation !== this.generation || this.disposed || !roots.length) return;
    const visual = new Group(); roots.forEach((root) => visual.add(root));
    const box = staticBounds(visual); const size = box.getSize(new Vector3()); visual.scale.setScalar(2.65 / Math.max(size.y, .01));
    const fitted = staticBounds(visual); const center = fitted.getCenter(new Vector3());
    visual.position.x -= center.x; visual.position.y -= fitted.min.y; visual.position.z -= center.z;
    const wrapper = new Group(); wrapper.add(visual); wrapper.position.set(RANK_X[rank], RANK_HEIGHTS[rank] + .08, 0);
    wrapper.rotation.y = podiumCharacterYaw(rank); wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = rank * 1.7;
    const weaponKey = podiumWeapon(leader);
    if (weaponKey) {
      try {
        const weapon = await this.loadInstance(LEADERBOARD_PODIUM_ASSETS[weaponKey]);
        if (generation !== this.generation) return;
        weapon.traverse((node) => { if ((node as Mesh).isMesh) (node as Mesh).castShadow = false; });
        const weaponBox = staticBounds(weapon); const weaponSize = weaponBox.getSize(new Vector3());
        const layout = podiumWeaponLayout(weaponKey, rank);
        weapon.scale.setScalar(layout.size / Math.max(weaponSize.x, weaponSize.y, weaponSize.z, .01));
        const scaled = staticBounds(weapon); const weaponCenter = scaled.getCenter(new Vector3()); weapon.position.sub(weaponCenter);
        const mount = new Group(); mount.name = "weapon-mount"; mount.add(weapon);
        mount.position.set(...layout.position); mount.rotation.set(...layout.rotation);
        wrapper.add(mount);
      } catch { /* The character remains the representative if a weapon fails. */ }
    }
    this.characterRoot.add(wrapper);
  }

  private async addBackdropProp(file: string, index: number, generation: number) {
    try {
      const visual = await this.loadInstance(file); if (generation !== this.generation || this.disposed) return;
      const box = staticBounds(visual); const size = box.getSize(new Vector3()); visual.scale.setScalar(1.15 / Math.max(size.x, size.y, size.z, .01));
      const fitted = staticBounds(visual); const center = fitted.getCenter(new Vector3()); visual.position.x -= center.x; visual.position.y -= fitted.min.y; visual.position.z -= center.z;
      const wrapper = new Group(); wrapper.add(visual); wrapper.position.set(index === 0 ? -4.65 : 4.65, .04, -1.15); wrapper.rotation.y = index === 0 ? .35 : -.35;
      wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = index * 2.2; this.propRoot.add(wrapper);
    } catch { /* Set dressing is optional. */ }
  }

  private async loadInstance(file: string): Promise<Object3D> {
    const gltf = await this.loader.loadAsync(`${this.host.dataset.modelBase || ""}${file}`);
    const rigidReplacements: Array<{ source: SkinnedMesh; replacement: Mesh }> = [];
    gltf.scene.traverse((node) => {
      if ((node as Mesh).isMesh) (node as Mesh).frustumCulled = false;
      if ((node as SkinnedMesh).isSkinnedMesh) {
        const skinned = node as SkinnedMesh;
        // Keep valid wearable skins live so their mannequin bones establish the
        // attachment frame and the shared pose can affect every clothing layer.
        if (expandSkinAttributes(skinned)) return;
        // A few decorative props carry an unusable skin with no weight stream.
        // Those props are genuinely rigid and remain safe to flatten.
        const rigidGeometry = skinned.geometry.clone();
        rigidGeometry.applyMatrix4(skinned.bindMatrix);
        const replacement = new Mesh(rigidGeometry, skinned.material);
        replacement.name = skinned.name; replacement.position.copy(skinned.position);
        replacement.quaternion.copy(skinned.quaternion); replacement.scale.copy(skinned.scale);
        replacement.renderOrder = skinned.renderOrder; replacement.frustumCulled = false;
        rigidReplacements.push({ source: skinned, replacement });
      }
    });
    rigidReplacements.forEach(({ source, replacement }) => {
      if (!source.parent) return;
      source.parent.add(replacement); source.parent.remove(source);
    });
    return gltf.scene;
  }

  private resize() {
    const stage = this.host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) return;
    const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight);
    this.camera.aspect = width / height;
    this.camera.position.z = this.camera.aspect < .9 ? 15.8 : this.camera.aspect < 1.35 ? 12.6 : 10.8;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
  }

  private animate = () => {
    if (this.disposed) return; const time = performance.now() * .001;
    if (!this.reduceMotion) {
      this.characterRoot.children.forEach((character) => { character.position.y = character.userData.baseY + Math.sin(time * .75 + character.userData.phase) * .018; });
      this.propRoot.children.forEach((prop) => { prop.position.y = prop.userData.baseY + Math.sin(time * .55 + prop.userData.phase) * .025; });
      this.effectsRoot.rotation.y = Math.sin(time * .1) * .012;
    }
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.animate);
  };

  private status(message: string) { const node = this.host.querySelector<HTMLElement>("[data-podium-status]"); if (node) node.textContent = message; }
  private fail(message: string) { this.host.dataset.podiumState = "fallback"; this.status(message); this.dispose(); }
  dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.renderer.dispose(); }
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
  void activateHost(host)?.setPresentation(metric, leaders);
}

document.querySelectorAll<HTMLElement>("[data-leaderboard-podium]").forEach((host) => {
  const payload = parsePayload(host);
  if (!host.closest<HTMLElement>("[data-leaderboard-panel]")?.hidden) present(host, payload);
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
