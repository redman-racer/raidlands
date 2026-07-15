import {
  ACESFilmicToneMapping, AmbientLight, Box3, Color, CylinderGeometry,
  DirectionalLight, Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera,
  Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Leader, LEADERBOARD_PODIUM_THEMES, leaderboardPodiumMetricValue } from "./policy";

type Payload = { leaders?: Leader[]; metric?: string; board?: string };

const PODIUM_X = [-3.25, 0, 3.25];
const PODIUM_HEIGHTS = [1.15, 1.75, 0.88];

function supportsWebGL2(): boolean {
  try { return Boolean(document.createElement("canvas").getContext("webgl2")); } catch { return false; }
}

function parsePayload(host: HTMLElement): Payload {
  try {
    return JSON.parse(host.querySelector<HTMLScriptElement>("[data-podium-payload]")?.textContent || "{}") as Payload;
  } catch { return {}; }
}

function renderCards(host: HTMLElement, leaders: Leader[], board: string, metric: string) {
  const cards = host.querySelector<HTMLElement>("[data-podium-cards]");
  if (!cards) return;
  cards.replaceChildren();

  if (!leaders.length) {
    const empty = document.createElement("p");
    empty.className = "leaderboard-podium-empty";
    empty.textContent = "The podium is waiting for contenders.";
    cards.append(empty);
    return;
  }

  leaders.slice(0, 3).forEach((leader, index) => {
    const rank = index + 1;
    const isBot = board === "bots";
    const name = String(leader.display_name || (isBot ? "Raidlands Bot" : "Raidlands Player"));
    const profileUrl = isBot ? "" : String(leader.steam_profile_url || "").trim();
    const avatarUrl = isBot ? "" : String(leader.steam_avatar_url || "").trim();
    const [value, label] = leaderboardPodiumMetricValue(leader, board, metric);
    const card = document.createElement("article");
    card.className = "leaderboard-podium-card";
    card.dataset.podiumRank = String(rank);

    const medal = document.createElement("span");
    medal.className = "leaderboard-podium-medal";
    medal.setAttribute("aria-label", `Rank ${rank}`);
    medal.textContent = `#${rank}`;
    card.append(medal);

    if (avatarUrl) {
      const avatar = document.createElement(profileUrl ? "a" : "span");
      avatar.className = "steam-avatar steam-avatar-sm";
      if (avatar instanceof HTMLAnchorElement) {
        avatar.href = profileUrl; avatar.target = "_blank"; avatar.rel = "noopener noreferrer";
        avatar.setAttribute("aria-label", `${name} Steam profile`);
      }
      const image = document.createElement("img");
      image.src = avatarUrl; image.alt = `${name} Steam avatar`; image.referrerPolicy = "no-referrer";
      avatar.append(image); card.append(avatar);
    } else if (isBot) {
      const avatar = document.createElement("span");
      avatar.className = "leaderboard-bot-avatar"; avatar.setAttribute("aria-hidden", "true"); avatar.textContent = "AI";
      card.append(avatar);
    }

    const copy = document.createElement("span"); copy.className = "leaderboard-podium-copy";
    const title = document.createElement(profileUrl ? "a" : "strong"); title.textContent = name;
    if (title instanceof HTMLAnchorElement) { title.href = profileUrl; title.target = "_blank"; title.rel = "noopener noreferrer"; }
    const stat = document.createElement("span");
    const bold = document.createElement("b"); bold.textContent = value; stat.append(bold, ` ${label}`);
    copy.append(title, stat); card.append(copy); cards.append(card);
  });
}

class PodiumScene {
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private renderer: WebGLRenderer;
  private propRoot = new Group();
  private loader: GLTFLoader;
  private cache = new Map<string, Object3D>();
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private generation = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private host: HTMLElement) {
    const stage = host.querySelector<HTMLElement>("[data-podium-stage]");
    if (!stage) throw new Error("missing-stage");
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    stage.replaceChildren(this.renderer.domElement);
    this.camera.position.set(0, 3.7, 8.35);
    this.camera.lookAt(0, 1.35, 0);

    const draco = new DRACOLoader(); draco.setDecoderPath(host.dataset.decoderPath || "");
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(draco); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.buildStage();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(stage); this.resize();
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault(); this.fail("3D unavailable. Showing leaderboard cards.");
    });
    this.animate();
  }

  private buildStage() {
    this.scene.background = new Color(0x0a1010);
    this.scene.add(new AmbientLight(0xb7d9cf, 1.65));
    const key = new DirectionalLight(0xffd6a8, 4.3); key.position.set(4, 8, 6); this.scene.add(key);
    const rim = new DirectionalLight(0x39d98a, 3); rim.position.set(-6, 5, -4); this.scene.add(rim);
    const floor = new Mesh(new CylinderGeometry(6.8, 7.2, 0.35, 48), new MeshStandardMaterial({ color: 0x17201f, metalness: 0.75, roughness: 0.42 }));
    floor.position.y = -0.25; this.scene.add(floor);
    PODIUM_X.forEach((x, index) => {
      const height = PODIUM_HEIGHTS[index];
      const pedestal = new Mesh(new CylinderGeometry(1.48, 1.68, height, 8), new MeshStandardMaterial({
        color: [0x697574, 0xb38b3a, 0x765441][index], metalness: 0.78, roughness: 0.34,
      }));
      pedestal.position.set(x, height / 2, 0); this.scene.add(pedestal);
      const topLip = new Mesh(new CylinderGeometry(1.53, 1.53, 0.1, 8), new MeshStandardMaterial({
        color: [0xa8b3b0, 0xe2b854, 0xb77b52][index], metalness: 0.9, roughness: 0.24,
      }));
      topLip.position.set(x, height + 0.02, 0); this.scene.add(topLip);
      const baseBand = new Mesh(new CylinderGeometry(1.71, 1.76, 0.13, 8), new MeshStandardMaterial({
        color: 0x202827, metalness: 0.86, roughness: 0.3,
      }));
      baseBand.position.set(x, 0.02, 0); this.scene.add(baseBand);
    });
    this.scene.add(this.propRoot);
  }

  async setTheme(metric: string) {
    const generation = ++this.generation; this.propRoot.clear();
    const files = LEADERBOARD_PODIUM_THEMES[metric] || LEADERBOARD_PODIUM_THEMES.kills;
    await Promise.all(files.map(async (file, index) => {
      try {
        const model = await this.load(file);
        if (generation !== this.generation || this.disposed) return;
        const visual = model.clone(true);
        const box = new Box3().setFromObject(visual); const size = box.getSize(new Vector3());
        visual.scale.setScalar(2.15 / Math.max(size.x, size.y, size.z, 0.01));
        const fitted = new Box3().setFromObject(visual); const center = fitted.getCenter(new Vector3());
        visual.position.x -= center.x;
        visual.position.y -= fitted.min.y;
        visual.position.z -= center.z;
        const wrapper = new Group(); wrapper.add(visual);
        wrapper.position.set(PODIUM_X[index], PODIUM_HEIGHTS[index] + 0.03, -0.1);
        wrapper.rotation.y = file === "rocket-launcher.glb"
          ? Math.PI / 2
          : (index === 0 ? 0.3 : index === 2 ? -0.3 : 0);
        if (file === "rocket-launcher.glb") wrapper.rotation.z = -0.08;
        wrapper.userData.baseY = wrapper.position.y; wrapper.userData.phase = index * 1.8;
        this.propRoot.add(wrapper);
      } catch { /* The HTML podium remains the fallback for individual assets. */ }
    }));
    this.status("3D podium ready.");
  }

  private async load(file: string): Promise<Object3D> {
    if (this.cache.has(file)) return this.cache.get(file)!;
    const base = this.host.dataset.modelBase || "";
    const gltf = await this.loader.loadAsync(`${base}${file}`);
    this.cache.set(file, gltf.scene); return gltf.scene;
  }

  private resize() {
    const stage = this.host.querySelector<HTMLElement>("[data-podium-stage]"); if (!stage) return;
    const width = Math.max(1, stage.clientWidth); const height = Math.max(1, stage.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
  }

  private animate = () => {
    if (this.disposed) return;
    const time = performance.now() * 0.001;
    if (!this.reduceMotion) this.propRoot.children.forEach((prop) => { prop.position.y = prop.userData.baseY + Math.sin(time * 1.1 + prop.userData.phase) * 0.06; });
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.animate);
  };

  private status(message: string) { const node = this.host.querySelector<HTMLElement>("[data-podium-status]"); if (node) node.textContent = message; }
  private fail(message: string) { this.host.dataset.podiumState = "fallback"; this.status(message); this.dispose(); }
  dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.renderer.dispose(); }
}

const instances = new Map<HTMLElement, PodiumScene>();

function activateHost(host: HTMLElement): PodiumScene | undefined {
  if (instances.has(host) || !supportsWebGL2()) {
    if (!supportsWebGL2()) host.dataset.podiumState = "fallback";
    return instances.get(host);
  }
  try {
    const scene = new PodiumScene(host); instances.set(host, scene); return scene;
  } catch { host.dataset.podiumState = "fallback"; }
}

document.querySelectorAll<HTMLElement>("[data-leaderboard-podium]").forEach((host) => {
  const payload = parsePayload(host); const board = host.dataset.board || "players"; const metric = host.dataset.metric || "kills";
  renderCards(host, Array.isArray(payload.leaders) ? payload.leaders : [], board, metric);
  if (!host.closest<HTMLElement>("[data-leaderboard-panel]")?.hidden) void activateHost(host)?.setTheme(metric);
});

document.addEventListener("raidlands:leaderboard-payload", (event) => {
  const custom = event as CustomEvent<Payload>;
  const panel = custom.target instanceof HTMLElement ? custom.target.closest<HTMLElement>("[data-leaderboard-panel]") : null;
  const host = panel?.querySelector<HTMLElement>("[data-leaderboard-podium]"); if (!host) return;
  const board = String(custom.detail.board || panel?.dataset.board || "players");
  const metric = String(custom.detail.metric || panel?.dataset.metric || "kills");
  const leaders = Array.isArray(custom.detail.leaders) ? custom.detail.leaders : [];
  host.dataset.board = board; host.dataset.metric = metric; renderCards(host, leaders, board, metric);
  void activateHost(host)?.setTheme(metric);
});

window.addEventListener("pagehide", () => instances.forEach((instance) => instance.dispose()), { once: true });
