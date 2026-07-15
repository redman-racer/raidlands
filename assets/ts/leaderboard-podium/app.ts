import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, Box3, BufferGeometry, Color,
  CylinderGeometry, DirectionalLight, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry,
  Object3D, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, SkinnedMesh, SRGBColorSpace,
  TorusGeometry, Vector3, WebGLRenderer,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  Leader, LEADERBOARD_PODIUM_ASSETS, LEADERBOARD_PODIUM_THEMES,
  leaderboardPodiumMetricValue, podiumWearables, podiumWeapon,
} from "./policy";

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
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  if (bounds.isEmpty()) bounds.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1));
  return bounds;
}

function mannequinHead(rank: number): Mesh {
  const head = new Mesh(
    new SphereGeometry(.13, 20, 16),
    new MeshStandardMaterial({ color: [0x9b6b4c, 0x875d45, 0x704936][rank], roughness: .92 }),
  );
  head.position.set(0, 1.01, -.012); head.scale.set(.86, 1.08, .92);
  head.frustumCulled = false; head.receiveShadow = true; return head;
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
    this.scene.background = new Color(0x08100f); this.scene.add(new AmbientLight(0x9ebbb3, 1.25));
    const key = new DirectionalLight(0xffd6a8, 4.4); key.position.set(4, 9, 6); this.scene.add(key);
    const rim = new DirectionalLight(0x39d98a, 2.7); rim.position.set(-6, 5, -4); this.scene.add(rim);
    const floor = new Mesh(new CylinderGeometry(6.8, 7.2, 0.35, 48), new MeshStandardMaterial({ color: 0x15201e, metalness: 0.74, roughness: 0.43 }));
    floor.position.y = -0.25; floor.receiveShadow = true; this.scene.add(floor);
    RANK_X.forEach((x, rank) => {
      const height = RANK_HEIGHTS[rank];
      const pedestal = new Mesh(new CylinderGeometry(1.4, 1.6, height, 8), new MeshStandardMaterial({ color: [0x8c681f, 0x5d6967, 0x674531][rank], metalness: 0.77, roughness: 0.35 }));
      pedestal.position.set(x, height / 2, 0); pedestal.receiveShadow = true; this.scene.add(pedestal);
      const lip = new Mesh(new CylinderGeometry(1.46, 1.46, 0.1, 8), new MeshStandardMaterial({ color: RANK_COLORS[rank], emissive: RANK_COLORS[rank], emissiveIntensity: 0.07, metalness: 0.9, roughness: 0.24 }));
      lip.position.set(x, height + .02, 0); this.scene.add(lip);
      const ring = new Mesh(new TorusGeometry(1.23, .025, 8, 48), new MeshStandardMaterial({ color: RANK_COLORS[rank], emissive: RANK_COLORS[rank], emissiveIntensity: 1.2 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, height + .085, 0); this.effectsRoot.add(ring);
      const light = new PointLight(RANK_COLORS[rank], rank === 0 ? 8 : 5, 5.5, 2); light.position.set(x, height + 2.25, -1.1); this.scene.add(light);
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
      try { const model = await this.loadInstance(file); poseWearable(model, rank); roots.push(model); } catch { /* A missing layer falls back to the remaining mannequin. */ }
    }));
    if (!roots.length) {
      const fallbackKeys = ["body-torso", "body-legs", "body-hands", "body-feet", "hoodie", "pants", "boots"];
      await Promise.all(fallbackKeys.map(async (key) => {
        try { const model = await this.loadInstance(LEADERBOARD_PODIUM_ASSETS[key]); poseWearable(model, rank); roots.push(model); } catch { /* The card remains if the base mannequin cannot load. */ }
      }));
    }
    if (generation !== this.generation || this.disposed || !roots.length) return;
    const visual = new Group(); roots.forEach((root) => visual.add(root)); visual.add(mannequinHead(rank));
    const box = staticBounds(visual); const size = box.getSize(new Vector3()); visual.scale.setScalar(2.65 / Math.max(size.y, .01));
    const fitted = staticBounds(visual); const center = fitted.getCenter(new Vector3());
    visual.position.x -= center.x; visual.position.y -= fitted.min.y; visual.position.z -= center.z;
    const wrapper = new Group(); wrapper.add(visual); wrapper.position.set(RANK_X[rank], RANK_HEIGHTS[rank] + .08, 0);
    wrapper.rotation.y = Math.PI + [0, .12, -.12][rank]; wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = rank * 1.7;
    const weaponKey = podiumWeapon(leader);
    if (weaponKey) {
      try {
        const weapon = await this.loadInstance(LEADERBOARD_PODIUM_ASSETS[weaponKey]);
        if (generation !== this.generation) return;
        weapon.traverse((node) => { if ((node as Mesh).isMesh) (node as Mesh).castShadow = false; });
        const weaponBox = staticBounds(weapon); const weaponSize = weaponBox.getSize(new Vector3());
        weapon.scale.setScalar((weaponKey === "sap" ? .58 : 1.02) / Math.max(weaponSize.x, weaponSize.y, weaponSize.z, .01));
        const scaled = staticBounds(weapon); const weaponCenter = scaled.getCenter(new Vector3()); weapon.position.sub(weaponCenter);
        const mount = new Group(); mount.add(weapon); mount.position.set(0, 1.35, -.3);
        mount.rotation.set(weaponKey === "rocket-launcher" ? 0 : -.08, weaponKey === "rocket-launcher" ? Math.PI / 2 : .2, weaponKey === "sap" ? -.25 : -.12);
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
        // RustRelay wearables are already authored in a usable standing bind pose.
        // Render that geometry rigidly because several exports intentionally omit
        // helper-joint weights that Three's runtime skinning requires.
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
