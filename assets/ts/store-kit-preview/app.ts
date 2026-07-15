import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color,
  CylinderGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, Object3D,
  PerspectiveCamera, PlaneGeometry, Raycaster, Scene, SRGBColorSpace, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

type PreviewItem = {
  id: string; shortname: string; label: string; quantity: number; container: string;
  position: number; skin: number; condition: number; maxCondition: number; ammo: number;
  ammoType: string; contents: unknown[]; kitName: string; iconUrl: string; modelUrl: string;
  modelScale: number; category: string;
};
type Rank = { id: number; slug: string; name: string; priority: number; items: PreviewItem[]; perks: string[] };
type Payload = { version: number; title: string; items: PreviewItem[]; ranks: Rank[]; activeRankSlug: string; decoderPath: string; labels: Record<string, string> };

const record = (type: string, details: Record<string, unknown> = {}) => {
  const diagnostic = (window as Window & { __raidlandsRecordAnimationDiagnostic?: (type: string, data: unknown) => void }).__raidlandsRecordAnimationDiagnostic;
  diagnostic?.(`store_preview_${type}`, details);
};

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function parsePayload(host: HTMLElement): Payload | null {
  const node = host.querySelector<HTMLScriptElement>("[data-store-preview-payload]");
  if (!node?.textContent) return null;
  try { return JSON.parse(node.textContent) as Payload; } catch { return null; }
}

function itemKey(item: PreviewItem): string { return `${item.shortname}|${item.kitName}`; }

class StorePreview {
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.05, 150);
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private stage = new Group();
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pickables: Object3D[] = [];
  private selected: Object3D | null = null;
  private frame = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private gltf: GLTFLoader;
  private textureLoader = new TextureLoader();
  private started = performance.now();

  constructor(private host: HTMLElement, private payload: Payload) {
    const canvasHost = host.querySelector<HTMLElement>("[data-store-preview-canvas]");
    if (!canvasHost) throw new Error("missing-canvas-host");
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute("aria-label", `${payload.title} interactive 3D preview`);
    this.renderer.domElement.tabIndex = 0;
    canvasHost.replaceChildren(this.renderer.domElement);

    this.camera.position.set(0, 5.4, 10.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 1.1, 0);

    const draco = new DRACOLoader();
    draco.setDecoderPath(payload.decoderPath);
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(draco);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);

    this.buildStage();
    this.bind();
    const targetSelect = this.host.querySelector<HTMLSelectElement>("[data-store-preview-target]");
    const activeIndex = this.payload.ranks.findIndex((rank) => rank.slug === this.payload.activeRankSlug);
    if (targetSelect && activeIndex >= 0 && this.payload.ranks[activeIndex + 1]) {
      targetSelect.value = this.payload.ranks[activeIndex + 1].slug;
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvasHost);
    this.resize();
  }

  private buildStage() {
    this.scene.background = new Color(0x090d0e);
    this.scene.add(new AmbientLight(0xb8d7ce, 1.25));
    const key = new DirectionalLight(0xffd4a0, 4.2); key.position.set(5, 9, 6); this.scene.add(key);
    const rim = new DirectionalLight(0x39d98a, 2.4); rim.position.set(-7, 5, -5); this.scene.add(rim);
    const floor = new Mesh(new CylinderGeometry(5.2, 5.6, 0.35, 64), new MeshStandardMaterial({ color: 0x171d1e, metalness: 0.86, roughness: 0.4 }));
    floor.position.y = -0.2; this.scene.add(floor);
    const pedestal = new Mesh(new CylinderGeometry(1.65, 2.05, 0.65, 8), new MeshStandardMaterial({ color: 0x30393a, metalness: 0.9, roughness: 0.27, emissive: 0x071b12 }));
    pedestal.position.y = 0.2; this.scene.add(pedestal);
    this.scene.add(this.stage);
  }

  private bind() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.host.querySelector("[data-store-preview-html]")?.addEventListener("click", this.useHtml);
    this.host.querySelector("[data-store-preview-close]")?.addEventListener("click", () => this.closeDrawer());
    this.host.querySelector<HTMLSelectElement>("[data-store-preview-base]")?.addEventListener("change", () => this.updateComparison());
    this.host.querySelector<HTMLSelectElement>("[data-store-preview-target]")?.addEventListener("change", () => this.updateComparison());
  }

  async start() {
    await this.setItems(this.initialItems());
    this.host.dataset.previewState = "ready";
    this.setStatus(this.payload.labels.ready || "Interactive kit preview ready.");
    record("ready", { durationMs: Math.round(performance.now() - this.started), items: this.pickables.length });
    if (this.payload.ranks.length) this.updateComparison();
    this.animate();
  }

  private initialItems(): PreviewItem[] {
    return this.payload.ranks.find((rank) => rank.slug === this.payload.activeRankSlug)?.items || this.payload.items;
  }

  private async setItems(items: PreviewItem[], gained = new Set<string>()) {
    this.stage.clear(); this.pickables = []; this.closeDrawer();
    const count = Math.max(1, items.length);
    await Promise.all(items.map(async (item, index) => {
      const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.11;
      const ring = item.category === "sentry" || item.category === "deployable" ? 3.55 : 2.2 + (index % 3) * 0.75;
      const root = new Group();
      root.position.set(Math.cos(angle) * ring, 0.55 + (index % 2) * 0.24, Math.sin(angle) * ring);
      root.rotation.y = -angle + Math.PI / 2;
      root.userData.item = item;
      root.userData.gained = gained.has(itemKey(item));
      const visual = await this.loadVisual(item);
      root.add(visual);
      if (item.category === "sentry" && item.modelUrl && item.quantity > 1) {
        const placedCount = Math.min(item.quantity, 12);
        for (let placed = 1; placed < placedCount; placed += 1) {
          const extra = await this.loadVisual(item);
          const spreadAngle = (placed / placedCount) * Math.PI * 2;
          extra.position.x += Math.cos(spreadAngle) * (0.7 + Math.floor(placed / 6) * 0.55);
          extra.position.z += Math.sin(spreadAngle) * (0.7 + Math.floor(placed / 6) * 0.55);
          root.add(extra);
        }
      }
      const badge = this.quantityBadge(item.quantity, root.userData.gained); badge.position.set(0.55, 1.1, 0); root.add(badge);
      this.stage.add(root); this.pickables.push(root);
    }));
  }

  private async loadVisual(item: PreviewItem): Promise<Object3D> {
    if (item.modelUrl) {
      try {
        const gltf = await this.gltf.loadAsync(item.modelUrl);
        const model = gltf.scene;
        const box = new Box3().setFromObject(model); const size = box.getSize(new Vector3());
        const fit = (item.category === "sentry" || item.category === "deployable" ? 2.1 : 1.55) / Math.max(size.x, size.y, size.z, 0.01);
        model.scale.setScalar(fit * item.modelScale);
        const fitted = new Box3().setFromObject(model); const center = fitted.getCenter(new Vector3());
        model.position.sub(center); model.position.y -= fitted.min.y;
        model.traverse((child) => { child.userData.item = item; });
        return model;
      } catch { record("item_model_fallback", { shortname: item.shortname }); }
    }
    const material = new MeshStandardMaterial({ color: 0x26302f, metalness: 0.35, roughness: 0.5 });
    if (item.iconUrl) {
      try { const texture = await this.textureLoader.loadAsync(item.iconUrl); texture.colorSpace = SRGBColorSpace; material.map = texture; material.color.set(0xffffff); material.transparent = true; } catch { /* label fallback below */ }
    }
    const card = new Mesh(new PlaneGeometry(1.35, 1.35), material); card.position.y = 0.7; card.userData.item = item;
    return card;
  }

  private quantityBadge(quantity: number, gained: boolean): Mesh {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 96;
    const context = canvas.getContext("2d")!; context.fillStyle = gained ? "#39d98a" : "#101717"; context.roundRect(4, 4, 248, 88, 24); context.fill();
    context.strokeStyle = gained ? "#c8ffe4" : "#6f857f"; context.lineWidth = 5; context.stroke(); context.fillStyle = gained ? "#07100c" : "#ffffff";
    context.font = "700 42px system-ui"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(`×${quantity.toLocaleString()}`, 128, 50);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return new Mesh(new PlaneGeometry(1.05, 0.39), new MeshStandardMaterial({ map: texture, transparent: true, emissive: gained ? 0x16452f : 0x000000 }));
  }

  private updateComparison() {
    const baseSlug = this.host.querySelector<HTMLSelectElement>("[data-store-preview-base]")?.value || "";
    const targetSlug = this.host.querySelector<HTMLSelectElement>("[data-store-preview-target]")?.value || "";
    const base = this.payload.ranks.find((rank) => rank.slug === baseSlug); const target = this.payload.ranks.find((rank) => rank.slug === targetSlug);
    if (!base || !target) return;
    const baseAmounts = new Map<string, number>(); base.items.forEach((item) => baseAmounts.set(item.shortname, (baseAmounts.get(item.shortname) || 0) + item.quantity));
    const gained = new Set(target.items.filter((item) => item.quantity > (baseAmounts.get(item.shortname) || 0)).map(itemKey));
    void this.setItems(target.items, gained);
    const list = this.host.querySelector<HTMLElement>("[data-store-preview-gains]");
    if (list) {
      const gains = target.items.filter((item) => item.quantity > (baseAmounts.get(item.shortname) || 0));
      list.replaceChildren(...gains.map((item) => { const li = document.createElement("li"); li.textContent = `${item.label}: +${Math.max(0, item.quantity - (baseAmounts.get(item.shortname) || 0)).toLocaleString()}`; return li; }));
      if (!gains.length) { const li = document.createElement("li"); li.textContent = "No additional equipment in this comparison."; list.append(li); }
    }
  }

  private onPointerMove = (event: PointerEvent) => { this.pick(event, false); };
  private onClick = (event: MouseEvent) => { this.pick(event, true); };
  private pick(event: MouseEvent | PointerEvent, open: boolean) {
    const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera); const hit = this.raycaster.intersectObjects(this.pickables, true)[0]?.object;
    let root: Object3D | null = hit || null; while (root && !root.userData.item && root.parent) root = root.parent;
    this.renderer.domElement.style.cursor = root?.userData.item ? "pointer" : "grab";
    if (root?.userData.item) { const item = root.userData.item as PreviewItem; this.setStatus(`${item.label}, quantity ${item.quantity.toLocaleString()}`); if (open) this.openDrawer(item); }
  }
  private onKeyDown = (event: KeyboardEvent) => { if ((event.key === "Enter" || event.key === " ") && this.pickables.length) { event.preventDefault(); const item = (this.selected || this.pickables[0]).userData.item as PreviewItem; this.openDrawer(item); } };
  private onContextLost = (event: Event) => { event.preventDefault(); this.fail("context-lost"); };
  private useHtml = () => { try { sessionStorage.setItem("raidlands-store-preview", "html"); } catch {} this.fail("user-html", false); };

  private openDrawer(item: PreviewItem) {
    const drawer = this.host.querySelector<HTMLElement>("[data-store-preview-drawer]"); if (!drawer) return;
    drawer.querySelector<HTMLElement>("[data-store-preview-detail-title]")!.textContent = item.label;
    drawer.querySelector<HTMLElement>("[data-store-preview-detail-meta]")!.textContent = `${item.quantity.toLocaleString()}× · ${item.container} · ${item.kitName}`;
    drawer.querySelector<HTMLElement>("[data-store-preview-detail-extra]")!.textContent = [item.ammo ? `${item.ammo} ammo${item.ammoType ? ` / ${item.ammoType}` : ""}` : "", item.skin ? `Skin ${item.skin}` : "", item.maxCondition ? `Condition ${item.condition}/${item.maxCondition}` : ""].filter(Boolean).join(" · ") || item.shortname;
    const image = drawer.querySelector<HTMLImageElement>("[data-store-preview-detail-image]"); if (image) { image.src = item.iconUrl; image.hidden = !item.iconUrl; }
    drawer.hidden = false; drawer.querySelector<HTMLButtonElement>("[data-store-preview-close]")?.focus();
  }
  private closeDrawer() { const drawer = this.host.querySelector<HTMLElement>("[data-store-preview-drawer]"); if (drawer) drawer.hidden = true; }
  private setStatus(message: string) { const status = this.host.querySelector<HTMLElement>("[data-store-preview-status]"); if (status) status.textContent = message; }
  private resize() { const parent = this.renderer.domElement.parentElement; if (!parent) return; const width = Math.max(1, parent.clientWidth); const height = Math.max(320, parent.clientHeight); this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  private animate = () => { if (this.disposed) return; try { this.controls.update(); this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.animate); } catch { this.fail("render-error"); } };
  fail(reason: string, diagnostic = true) { this.dispose(); this.host.dataset.previewState = "fallback"; this.setStatus(this.payload.labels.unavailable || "3D preview unavailable — full kit contents are shown below."); if (diagnostic) record("fallback", { reason }); }
  dispose() { if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.resizeObserver?.disconnect(); this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

function initialize(host: HTMLElement) {
  const payload = parsePayload(host); if (!payload) return;
  if (!host.dataset.previewFallbackBound) {
    host.dataset.previewFallbackBound = "true";
    host.querySelector("[data-store-preview-list]")?.addEventListener("click", () => document.querySelector("[data-store-html-inventory]")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  record("attempted", { version: payload.version });
  if (new URLSearchParams(window.location.search).get("preview3d") === "1") {
    try { sessionStorage.removeItem("raidlands-store-preview"); } catch {}
  }
  try { if (sessionStorage.getItem("raidlands-store-preview") === "html") { host.dataset.previewState = "fallback"; return; } } catch {}
  if (!supportsWebGL2()) { host.dataset.previewState = "fallback"; record("fallback", { reason: "no-webgl2" }); return; }
  let preview: StorePreview | null = null;
  const timeout = window.setTimeout(() => { if (host.dataset.previewState === "loading") preview?.fail("startup-timeout"); }, 12000);
  try { preview = new StorePreview(host, payload); void preview.start().catch(() => preview?.fail("load-error")).finally(() => window.clearTimeout(timeout)); } catch { window.clearTimeout(timeout); host.dataset.previewState = "fallback"; record("fallback", { reason: "initialization-error" }); }
}

document.querySelectorAll<HTMLElement>("[data-store-preview]").forEach((host) => {
  if ("IntersectionObserver" in window) { const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); initialize(host); } }, { rootMargin: "300px" }); observer.observe(host); }
  else initialize(host);
});
