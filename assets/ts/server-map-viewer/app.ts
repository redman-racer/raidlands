import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Uint32BufferAttribute,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
};

const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-server-map-viewer]"));

for (const root of roots) {
  void initTerrainViewer(root);
}

async function initTerrainViewer(root: HTMLElement): Promise<void> {
  const terrainUrl = root.dataset.terrainUrl || "";
  const status = root.querySelector<HTMLElement>("[data-map-viewer-status]");

  if (!terrainUrl) {
    setStatus(status, "Terrain export pending.");
    return;
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
    bindExternalControls(root, viewer);
    setStatus(status, "");
  } catch (error) {
    console.info("Raidlands terrain viewer could not be loaded.", error);
    setStatus(status, "Terrain export pending.");
  }
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
  };
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
  private readonly onResize = () => this.resize();
  private animationFrame = 0;

  public constructor(
    root: HTMLElement,
    terrain: TerrainPayload,
    options: { textureUrl: string; status: HTMLElement | null },
  ) {
    this.root = root;
    this.terrain = terrain;
    this.textureUrl = options.textureUrl;
    this.status = options.status;
    this.scene.background = new Color(0x071013);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.domElement.dataset.serverMapViewerCanvas = "true";
    this.terrainMesh = this.createTerrainMesh();
    this.scene.add(this.terrainMesh);
    this.addWaterPlane();
    this.addLights();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = MathUtils.degToRad(84);
    this.controls.minDistance = Math.max(120, (this.terrain.worldSize || 4500) * 0.08);
    this.controls.maxDistance = Math.max(1600, (this.terrain.worldSize || 4500) * 1.4);
    (this.controls as OrbitControls & { zoomToCursor?: boolean }).zoomToCursor = true;
  }

  public mount(): void {
    this.root.appendChild(this.renderer.domElement);
    this.frameIso();
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.animate();
    this.loadTexture();
  }

  public setRelief(value: number): void {
    this.terrainMesh.scale.y = MathUtils.clamp(value, 0.35, 2.5);
  }

  public frameIso(): void {
    const size = this.terrain.worldSize || 4500;
    const height = Math.max(220, (this.terrain.maxHeight || 220) - Math.min(this.terrain.minHeight || 0, 0));
    this.controls.target.set(0, height * 0.22, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(size * 0.48, size * 0.34, size * 0.58);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  public frameTop(): void {
    const size = this.terrain.worldSize || 4500;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, size * 0.86, 0.001);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
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
        const index = row * resolution + col;
        positions.push(x, this.terrain.heights[index] || 0, z);
        uvs.push(u, 1 - v);
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

    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
      vertexColors: true,
      side: DoubleSide,
    });

    const mesh = new Mesh(geometry, material);
    mesh.name = "raidlands-current-wipe-terrain";
    return mesh;
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
        const material = this.terrainMesh.material as MeshStandardMaterial;
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => setStatus(this.status, ""),
    );
  }

  private addWaterPlane(): void {
    const worldSize = this.terrain.worldSize || 4500;
    const geometry = new PlaneGeometry(worldSize * 1.04, worldSize * 1.04, 1, 1);
    const material = new MeshStandardMaterial({
      color: 0x1d5c72,
      transparent: true,
      opacity: 0.32,
      roughness: 0.62,
      metalness: 0.02,
      side: DoubleSide,
    });
    const water = new Mesh(geometry, material);
    water.name = "terrain-water-plane";
    water.rotation.x = -Math.PI / 2;
    water.position.y = this.terrain.waterLevel || 0;
    this.scene.add(water);
  }

  private addLights(): void {
    const ambient = new AmbientLight(0xffffff, 0.7);
    const sun = new DirectionalLight(0xffffff, 1.85);
    sun.position.set(900, 1400, 650);
    const fill = new DirectionalLight(0x8fd3ff, 0.42);
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

function bindExternalControls(root: HTMLElement, viewer: TerrainViewer): void {
  const panel = root.closest<HTMLElement>(".server-terrain-panel");
  const buttons = Array.from(panel?.querySelectorAll<HTMLButtonElement>("[data-map-view]") || []);
  const relief = panel?.querySelector<HTMLInputElement>("[data-map-viewer-relief]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
      if (button.dataset.mapView === "top") {
        viewer.frameTop();
      } else {
        viewer.frameIso();
      }
    });
  });

  relief?.addEventListener("input", () => {
    viewer.setRelief(Number(relief.value) || 1);
  });
}

function pushColor(target: number[], color: string | undefined, height: number, terrain: TerrainPayload): void {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    const parsed = new Color(color);
    target.push(parsed.r, parsed.g, parsed.b);
    return;
  }

  const min = Number.isFinite(terrain.minHeight) ? terrain.minHeight || 0 : 0;
  const max = Number.isFinite(terrain.maxHeight) ? terrain.maxHeight || 1 : 1;
  const t = MathUtils.clamp((height - min) / Math.max(1, max - min), 0, 1);
  const low = new Color(0x44623f);
  const high = new Color(0xd2d7cf);
  const mixed = low.lerp(high, Math.pow(t, 1.6));
  target.push(mixed.r, mixed.g, mixed.b);
}

function setStatus(status: HTMLElement | null, message: string): void {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.hidden = message === "";
}
