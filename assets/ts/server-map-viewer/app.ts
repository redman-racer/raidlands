import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
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
  private readonly controls: OrbitControls;
  private readonly terrainMesh: Mesh;
  private readonly terrainMaterial: MeshStandardMaterial;
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
    this.terrainMaterial = this.createTerrainMaterial();
    this.terrainMesh = this.createTerrainMesh();
    this.scene.add(this.terrainMesh);
    this.addMonuments();
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

    const mesh = new Mesh(geometry, this.terrainMaterial);
    mesh.name = "raidlands-current-wipe-terrain";
    return mesh;
  }

  private createTerrainMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
    });
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
        this.terrainMaterial.map = texture;
        this.terrainMaterial.vertexColors = false;
        this.terrainMaterial.needsUpdate = true;
      },
      undefined,
      () => setStatus(this.status, ""),
    );
  }

  private addMonuments(): void {
    const monuments = this.terrain.monuments || [];

    if (monuments.length === 0) {
      return;
    }

    const layer = new Group();
    layer.name = "raidlands-monument-primitives";

    monuments.forEach((monument) => {
      const group = createMonumentPrimitive(monument);
      const terrainHeight = sampleTerrainHeight(this.terrain, monument.x, monument.z);
      group.position.set(monument.x, Math.max(monument.y, terrainHeight) + 5, monument.z);
      group.rotation.y = -MathUtils.degToRad(monument.rotationY || 0);
      layer.add(group);
    });

    this.scene.add(layer);
  }

  private addLights(): void {
    const ambient = new AmbientLight(0xfff4df, 0.82);
    const sun = new DirectionalLight(0xfff1cf, 1.95);
    sun.position.set(900, 1400, 650);
    const fill = new DirectionalLight(0xffd8a8, 0.18);
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

function createMonumentPrimitive(monument: MonumentPayload): Group {
  const group = new Group();
  const key = monumentKey(monument);
  const size = MathUtils.clamp(monument.radius, 24, 180);

  group.name = `monument-${key}`;

  if (key.includes("airfield")) {
    addBox(group, size * 2.1, 5, size * 0.22, 0x2c3030, 0, 1, 0);
    addBox(group, size * 0.44, 22, size * 0.34, 0x6e7470, -size * 0.55, 13, -size * 0.32);
    addBox(group, size * 0.34, 16, size * 0.28, 0x7f6b45, size * 0.48, 10, size * 0.26);
    return group;
  }

  if (key.includes("launch")) {
    addBox(group, size * 1.35, 9, size * 0.82, 0x353b3a, 0, 4, 0);
    addCylinder(group, size * 0.12, size * 1.05, 0x9fafa8, -size * 0.15, size * 0.55, 0);
    addCone(group, size * 0.2, size * 0.34, 0xb86f3f, -size * 0.15, size * 1.24, 0);
    addBox(group, size * 0.2, size * 0.78, size * 0.2, 0x6f5f48, size * 0.28, size * 0.42, 0);
    return group;
  }

  if (key.includes("sphere") || key.includes("dome")) {
    addSphere(group, size * 0.42, 0x9baaa0, 0, size * 0.42, 0);
    addCylinder(group, size * 0.08, size * 0.55, 0x7f6b45, size * 0.48, size * 0.28, -size * 0.12);
    return group;
  }

  if (key.includes("satellite")) {
    addCylinder(group, size * 0.07, size * 0.46, 0x7d837f, 0, size * 0.23, 0);
    const dish = addCone(group, size * 0.42, size * 0.18, 0x9aa29c, 0, size * 0.58, 0);
    dish.rotation.x = MathUtils.degToRad(58);
    addBox(group, size * 0.86, 4, size * 0.16, 0x3f4543, 0, 2, -size * 0.24);
    return group;
  }

  if (key.includes("lighthouse")) {
    addCylinder(group, size * 0.14, size * 1.1, 0xd9d2bd, 0, size * 0.55, 0);
    addCylinder(group, size * 0.2, size * 0.16, 0x9b3e2e, 0, size * 1.18, 0);
    addCone(group, size * 0.24, size * 0.18, 0x342f2b, 0, size * 1.35, 0);
    return group;
  }

  if (key.includes("oilrig") || key.includes("oil_rig")) {
    addBox(group, size * 1.1, 10, size * 0.86, 0x3d4546, 0, 6, 0);
    addBox(group, size * 0.18, size * 0.8, size * 0.18, 0x808783, -size * 0.36, size * 0.45, -size * 0.22);
    addBox(group, size * 0.18, size * 0.65, size * 0.18, 0x808783, size * 0.34, size * 0.38, size * 0.2);
    addCylinder(group, size * 0.05, size * 0.88, 0xe0b35f, 0, size * 0.5, 0);
    return group;
  }

  if (key.includes("harbor")) {
    addBox(group, size * 1.4, 7, size * 0.28, 0x3e484a, 0, 4, 0);
    addBox(group, size * 0.24, size * 0.58, size * 0.24, 0x8b7044, -size * 0.42, size * 0.32, -size * 0.08);
    addBox(group, size * 0.18, size * 0.46, size * 0.18, 0x8b7044, size * 0.36, size * 0.26, size * 0.12);
    return group;
  }

  if (key.includes("powerplant") || key.includes("power_plant")) {
    addBox(group, size * 0.92, size * 0.2, size * 0.62, 0x5b605c, 0, size * 0.1, 0);
    addCylinder(group, size * 0.09, size * 0.92, 0x9a9a90, -size * 0.24, size * 0.55, 0);
    addCylinder(group, size * 0.09, size * 0.72, 0x9a9a90, 0, size * 0.45, 0);
    addCylinder(group, size * 0.09, size * 0.82, 0x9a9a90, size * 0.24, size * 0.5, 0);
    return group;
  }

  if (key.includes("excavator")) {
    addBox(group, size * 0.7, size * 0.26, size * 0.5, 0x6f5b35, -size * 0.15, size * 0.13, 0);
    const arm = addBox(group, size * 0.92, size * 0.08, size * 0.12, 0xc59a4a, size * 0.32, size * 0.48, 0);
    arm.rotation.z = MathUtils.degToRad(-24);
    addCylinder(group, size * 0.18, size * 0.28, 0x2f3332, -size * 0.36, size * 0.15, -size * 0.18);
    addCylinder(group, size * 0.18, size * 0.28, 0x2f3332, -size * 0.36, size * 0.15, size * 0.18);
    return group;
  }

  if (key.includes("trainyard") || key.includes("train_yard")) {
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, -size * 0.22);
    addBox(group, size * 1.3, 4, size * 0.08, 0x252928, 0, 2, size * 0.22);
    addBox(group, size * 0.72, size * 0.32, size * 0.34, 0x6f5f48, -size * 0.18, size * 0.18, 0);
    addBox(group, size * 0.34, size * 0.42, size * 0.28, 0x7f6b45, size * 0.38, size * 0.24, 0);
    return group;
  }

  if (key.includes("military") || key.includes("tunnel") || key.includes("bunker")) {
    addBox(group, size * 0.94, size * 0.26, size * 0.62, 0x59645b, 0, size * 0.13, 0);
    addBox(group, size * 0.24, size * 0.32, size * 0.28, 0x303635, -size * 0.38, size * 0.16, 0);
    return group;
  }

  if (key.includes("gas") || key.includes("supermarket") || key.includes("warehouse")) {
    addBox(group, size * 0.74, size * 0.26, size * 0.56, 0x7d7359, 0, size * 0.13, 0);
    addBox(group, size * 0.82, size * 0.08, size * 0.22, 0xb76d3a, 0, size * 0.34, -size * 0.18);
    return group;
  }

  if (key.includes("quarry") || key.includes("mining")) {
    addCone(group, size * 0.42, size * 0.24, 0x6d624c, 0, size * 0.12, 0);
    addCylinder(group, size * 0.08, size * 0.48, 0x6f5f48, size * 0.26, size * 0.24, 0);
    return group;
  }

  addBox(group, size * 0.68, size * 0.24, size * 0.5, 0x6a705e, 0, size * 0.12, 0);
  addCylinder(group, size * 0.08, size * 0.46, 0x8b7044, size * 0.28, size * 0.23, -size * 0.12);
  return group;
}

function monumentKey(monument: MonumentPayload): string {
  return `${monument.kind} ${monument.name} ${monument.prefab}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function sampleTerrainHeight(terrain: TerrainPayload, x: number, z: number): number {
  const resolution = terrain.resolution;
  const worldSize = terrain.worldSize || 4500;
  const half = worldSize / 2;
  const u = MathUtils.clamp((x + half) / worldSize, 0, 1);
  const v = MathUtils.clamp((half - z) / worldSize, 0, 1);
  const col = Math.round(u * (resolution - 1));
  const row = Math.round(v * (resolution - 1));
  return terrain.heights[row * resolution + col] || 0;
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
  const min = Number.isFinite(terrain.minHeight) ? terrain.minHeight || 0 : 0;
  const max = Number.isFinite(terrain.maxHeight) ? terrain.maxHeight || 1 : 1;
  const t = MathUtils.clamp((height - min) / Math.max(1, max - min), 0, 1);

  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    const parsed = balanceTerrainColor(new Color(color), t);
    target.push(parsed.r, parsed.g, parsed.b);
    return;
  }

  const low = new Color(0x3f5537);
  const mid = new Color(0x776d4e);
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
