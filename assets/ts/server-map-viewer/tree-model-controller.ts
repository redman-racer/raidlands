import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { EnvironmentQuality } from "./environment-quality";
import type { VegetationPlacement } from "./vegetation-policy";
import {
  treeLodThresholds,
  treeManifestVersion,
  treeModelForVariation,
  treeRecipeVersion,
  treeSourceRevision,
  type TreeModelEntry,
  type TreeModelTier,
} from "./tree-model-registry";

type SourcePart = { geometry: BufferGeometry; material: Material | Material[]; matrix: Matrix4 };
type LoadedSource = { parts: SourcePart[]; groundOffset: number };

const QUALITY_CLOSE: Record<EnvironmentQuality, number> = { low: 0, medium: 24, high: 72, ultra: 140 };
const QUALITY_MID: Record<EnvironmentQuality, number> = { low: 90, medium: 220, high: 420, ultra: 720 };

export class TreeModelController {
  private readonly layer = new Group();
  private readonly loader = new GLTFLoader();
  private readonly draco = new DRACOLoader();
  private readonly sources = new Map<string, LoadedSource>();
  private readonly failures = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly batches: Object3D[] = [];
  private lastTick = 0;
  private readonly lastBuildCamera = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  private disposed = false;
  private mapSettled = false;

  public constructor(private readonly options: {
    assetBase: string;
    camera: PerspectiveCamera;
    quality: EnvironmentQuality;
    placements: VegetationPlacement[];
    fallback: Group;
    parent: Group;
    root: HTMLElement;
    dracoDecoderUrl: string;
  }) {
    this.layer.name = "raidlands-rustrelay-tree-lods";
    options.parent.add(this.layer);
    this.draco.setDecoderPath(options.dracoDecoderUrl);
    this.loader.setDRACOLoader(this.draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    options.fallback.visible = false;
    this.syncDiagnostics();
    void this.preloadMap();
  }

  public tick(now: number): void {
    if (this.disposed || now - this.lastTick < 400) return;
    this.lastTick = now;
    this.requestVisibleDetail();
    if (this.options.camera.position.distanceToSquared(this.lastBuildCamera) > 625) this.rebuild();
  }

  public dispose(): void {
    this.disposed = true;
    this.clearBatches();
    this.options.parent.remove(this.layer);
    for (const source of this.sources.values()) for (const part of source.parts) {
      part.geometry.dispose();
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => material.dispose());
    }
    this.sources.clear();
    this.draco.dispose();
  }

  private async preloadMap(): Promise<void> {
    const entries = this.usedEntries();
    await Promise.allSettled(entries.map((entry) => this.load(entry, "map")));
    if (this.disposed) return;
    this.mapSettled = true;
    this.options.fallback.visible = this.failures.size > 0;
    this.layer.visible = !this.options.fallback.visible;
    this.rebuild();
    this.syncDiagnostics();
  }

  private requestVisibleDetail(): void {
    const closeLimit = QUALITY_CLOSE[this.options.quality];
    const midLimit = QUALITY_MID[this.options.quality];
    const ranked = this.options.placements
      .map((placement) => ({ placement, distance: this.options.camera.position.distanceTo(new Vector3(placement.x, placement.y, placement.z)) }))
      .sort((a, b) => a.distance - b.distance);
    const thresholds = treeLodThresholds();
    const requested = new Map<TreeModelEntry, Set<TreeModelTier>>();
    ranked.forEach(({ placement, distance }, index) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      const tiers = requested.get(entry) || new Set<TreeModelTier>();
      if (index < closeLimit && distance < thresholds.midToCloseDistance) tiers.add("close");
      else if (index < midLimit && distance < thresholds.mapToMidDistance) tiers.add("mid");
      requested.set(entry, tiers);
    });
    for (const [entry, tiers] of requested) for (const tier of tiers) void this.load(entry, tier);
  }

  private rebuild(): void {
    if (!this.mapSettled || this.disposed) return;
    this.lastBuildCamera.copy(this.options.camera.position);
    this.clearBatches();
    const thresholds = treeLodThresholds();
    const closeLimit = QUALITY_CLOSE[this.options.quality];
    const midLimit = QUALITY_MID[this.options.quality];
    const ranked = this.options.placements
      .map((placement) => ({ placement, distance: this.options.camera.position.distanceTo(new Vector3(placement.x, placement.y, placement.z)) }))
      .sort((a, b) => a.distance - b.distance);
    const grouped = new Map<string, { entry: TreeModelEntry; tier: TreeModelTier; placements: VegetationPlacement[] }>();

    ranked.forEach(({ placement, distance }, index) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      const desired: TreeModelTier = index < closeLimit && distance < thresholds.midToCloseDistance
        ? "close"
        : index < midLimit && distance < thresholds.mapToMidDistance ? "mid" : "map";
      const tier = this.sources.has(this.key(entry, desired)) ? desired
        : desired === "close" && this.sources.has(this.key(entry, "mid")) ? "mid" : "map";
      if (!this.sources.has(this.key(entry, tier))) return;
      const key = this.key(entry, tier);
      const group = grouped.get(key) || { entry, tier, placements: [] };
      group.placements.push(placement);
      grouped.set(key, group);
    });

    for (const group of grouped.values()) this.createBatch(group.entry, group.tier, group.placements);
    this.syncDiagnostics(grouped);
  }

  private createBatch(entry: TreeModelEntry, tier: TreeModelTier, placements: VegetationPlacement[]): void {
    const source = this.sources.get(this.key(entry, tier));
    if (!source) return;
    const placementMatrix = new Matrix4();
    const translation = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const final = new Matrix4();
    for (const part of source.parts) {
      const batch = new InstancedMesh(part.geometry, part.material, placements.length);
      batch.name = `tree-${entry.id}-${tier}`;
      batch.castShadow = tier === "close" && (this.options.quality === "high" || this.options.quality === "ultra");
      batch.receiveShadow = false;
      placements.forEach((placement, index) => {
        translation.set(placement.x, placement.y - source.groundOffset * placement.scale, placement.z);
        rotation.setFromAxisAngle(new Vector3(0, 1, 0), placement.variation * Math.PI * 2);
        const size = placement.scale * (0.86 + ((placement.variation * 17) % 1) * 0.28);
        scale.set(size, size, size);
        placementMatrix.compose(translation, rotation, scale);
        final.multiplyMatrices(placementMatrix, part.matrix);
        batch.setMatrixAt(index, final);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      this.layer.add(batch);
      this.batches.push(batch);
    }
  }

  private async load(entry: TreeModelEntry, tier: TreeModelTier): Promise<void> {
    const key = this.key(entry, tier);
    if (this.sources.has(key) || this.failures.has(key) || this.pending.has(key) || this.disposed) return this.pending.get(key);
    const base = new URL(this.options.assetBase, window.location.href);
    const metadata = entry.tiers[tier];
    const url = new URL(metadata.url, base);
    url.searchParams.set("v", metadata.sha256.slice(0, 12));
    const promise = this.loader.loadAsync(url.href).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(gltf.scene);
      const parts: SourcePart[] = [];
      gltf.scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        parts.push({ geometry: object.geometry, material: object.material, matrix: object.matrixWorld.clone() });
      });
      if (parts.length === 0) throw new Error("tree GLB contains no meshes");
      this.sources.set(key, { parts, groundOffset: bounds.min.y });
      if (tier !== "map") this.rebuild();
    }).catch((error) => {
      this.failures.add(key);
      console.warn(`Raidlands could not load ${entry.id} ${tier} tree LOD.`, error);
    }).finally(() => {
      this.pending.delete(key);
      this.syncDiagnostics();
    });
    this.pending.set(key, promise);
    this.syncDiagnostics();
    return promise;
  }

  private usedEntries(): TreeModelEntry[] {
    return [...new Map(this.options.placements.map((placement) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      return [entry.id, entry];
    })).values()];
  }

  private clearBatches(): void {
    for (const batch of this.batches) this.layer.remove(batch);
    this.batches.length = 0;
  }

  private key(entry: TreeModelEntry, tier: TreeModelTier): string { return `${entry.id}:${tier}`; }

  private syncDiagnostics(groups?: Map<string, { tier: TreeModelTier; placements: VegetationPlacement[] }>): void {
    const tierCounts = { map: 0, mid: 0, close: 0 };
    for (const group of groups?.values() || []) tierCounts[group.tier] += group.placements.length;
    const biomeCounts = this.options.placements.reduce<Record<string, number>>((counts, placement) => {
      counts[placement.biome] = (counts[placement.biome] || 0) + 1;
      return counts;
    }, {});
    Object.assign(this.options.root.dataset, {
      treeManifestVersion: String(treeManifestVersion()),
      treeRecipeVersion: String(treeRecipeVersion()),
      treeSourceRevision: treeSourceRevision(),
      treeMapInstances: String(tierCounts.map),
      treeMidInstances: String(tierCounts.mid),
      treeCloseInstances: String(tierCounts.close),
      treeLoadedAssets: String(this.sources.size),
      treeFailedAssets: String(this.failures.size),
      treeDecodeQueue: String(this.pending.size),
      treeFallbackActive: String(this.options.fallback.visible),
      treeBiomeInstances: JSON.stringify(biomeCounts),
    });
  }
}
