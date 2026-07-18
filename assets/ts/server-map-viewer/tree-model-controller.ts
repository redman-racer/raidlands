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
type LoadedSource = {
  parts: SourcePart[];
  groundOffset: number;
  entry: TreeModelEntry;
  tier: TreeModelTier;
  lastUsedAt: number;
};
type RankedPlacement = { placement: VegetationPlacement; index: number; distance: number };
type TreeBatchGroup = { entry: TreeModelEntry; tier: TreeModelTier; placements: VegetationPlacement[] };
type TreeBatchRecord = { objects: InstancedMesh[]; signature: string; tier: TreeModelTier };
type TreeLoadTask = {
  key: string;
  entry: TreeModelEntry;
  tier: TreeModelTier;
  priority: number;
  detailGeneration: number;
  visibilityGeneration: number;
  resolve: () => void;
};

const QUALITY_CLOSE: Record<EnvironmentQuality, number> = { low: 0, medium: 24, high: 72, ultra: 140 };
const QUALITY_MID: Record<EnvironmentQuality, number> = { low: 0, medium: 220, high: 420, ultra: 720 };
const QUALITY_INSTANCES: Record<EnvironmentQuality, number> = { low: 240, medium: 1450, high: 1450, ultra: 1450 };
const QUALITY_CACHE: Record<EnvironmentQuality, { mid: number; close: number }> = {
  low: { mid: 0, close: 0 },
  medium: { mid: 8, close: 3 },
  high: { mid: 14, close: 6 },
  ultra: { mid: 20, close: 10 },
};
const Y_AXIS = new Vector3(0, 1, 0);

export function treeDecodeConcurrency(quality: EnvironmentQuality): number {
  return 1;
}

export function treeQualityLimits(quality: EnvironmentQuality): { mid: number; close: number } {
  return { mid: QUALITY_MID[quality], close: QUALITY_CLOSE[quality] };
}

export function treeInstanceLimit(quality: EnvironmentQuality): number {
  return QUALITY_INSTANCES[quality];
}

export function treePlacementDistance(camera: Pick<Vector3, "x" | "y" | "z">, placement: Pick<VegetationPlacement, "x" | "y" | "z">): number {
  return Math.hypot(camera.x - placement.x, camera.y - placement.y, camera.z - placement.z);
}

export function treeRequestIsStale(
  tier: TreeModelTier,
  taskDetailGeneration: number,
  currentDetailGeneration: number,
  taskVisibilityGeneration: number,
  currentVisibilityGeneration: number,
): boolean {
  return taskVisibilityGeneration !== currentVisibilityGeneration
    || (tier !== "map" && taskDetailGeneration !== currentDetailGeneration);
}

export class TreeModelController {
  private readonly layer = new Group();
  private readonly loader = new GLTFLoader();
  private readonly draco = new DRACOLoader();
  private readonly sources = new Map<string, LoadedSource>();
  private readonly failures = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly queue: TreeLoadTask[] = [];
  private readonly batchGroups = new Map<string, TreeBatchRecord>();
  private readonly activeSourceKeys = new Set<string>();
  private lastTick = 0;
  private lastMembershipSignature = "";
  private disposed = false;
  private mapSettled = false;
  private visible = true;
  private interactionActive = false;
  private detailGeneration = 0;
  private visibilityGeneration = 0;
  private activeLoads = 0;
  private quality: EnvironmentQuality;

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
    this.quality = options.quality;
    this.layer.name = "raidlands-rustrelay-tree-lods";
    options.parent.add(this.layer);
    this.draco.setDecoderPath(options.dracoDecoderUrl);
    this.loader.setDRACOLoader(this.draco);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    options.fallback.visible = true;
    this.layer.visible = false;
    this.syncDiagnostics();
    if (this.quality !== "low") void this.preloadMap();
  }

  public setQuality(quality: EnvironmentQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.detailGeneration += 1;
    if (quality === "low") {
      this.visibilityGeneration += 1;
      this.queue.splice(0).forEach((task) => {
        this.pending.delete(task.key);
        task.resolve();
      });
      this.mapSettled = false;
      this.options.fallback.visible = true;
      this.layer.visible = false;
    } else {
      this.cancelQueuedDetail();
      void this.preloadMap();
    }
    this.lastMembershipSignature = "";
    this.lastTick = 0;
    this.rebuild();
    this.syncDiagnostics();
  }

  public setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.visibilityGeneration += 1;
    this.queue.splice(0).forEach((task) => {
      this.pending.delete(task.key);
      task.resolve();
    });
    this.lastTick = 0;
    if (visible) {
      if (this.quality !== "low") void this.preloadMap();
      this.pump();
    }
    this.syncDiagnostics();
  }

  public setInteractionActive(active: boolean): void {
    if (active === this.interactionActive) return;
    this.interactionActive = active;
    this.detailGeneration += 1;
    if (active) this.cancelQueuedDetail();
    else {
      this.lastTick = 0;
      this.requestVisibleDetail();
      this.pump();
    }
    this.syncDiagnostics();
  }

  public tick(now: number): void {
    if (this.disposed || !this.visible || this.quality === "low" || now - this.lastTick < 500) return;
    this.lastTick = now;
    if (!this.interactionActive) this.requestVisibleDetail();
    this.rebuild();
  }

  public dispose(): void {
    this.disposed = true;
    this.visibilityGeneration += 1;
    this.queue.splice(0).forEach((task) => {
      this.pending.delete(task.key);
      task.resolve();
    });
    this.clearBatches();
    this.options.parent.remove(this.layer);
    for (const source of this.sources.values()) this.disposeSource(source);
    this.sources.clear();
    this.draco.dispose();
    this.syncDiagnostics();
  }

  private async preloadMap(): Promise<void> {
    await this.preloadMissingMap();
    if (this.disposed || !this.visible) return;
    this.mapSettled = true;
    this.options.fallback.visible = this.failures.size > 0;
    this.layer.visible = !this.options.fallback.visible;
    this.lastMembershipSignature = "";
    this.rebuild();
    this.syncDiagnostics();
  }

  private async preloadMissingMap(): Promise<void> {
    if (this.disposed || !this.visible) return;
    const entries = this.usedEntries().filter((entry) => !this.sources.has(this.key(entry, "map")) && !this.failures.has(this.key(entry, "map")));
    await Promise.allSettled(entries.map((entry, index) => this.load(entry, "map", index)));
  }

  private requestVisibleDetail(): void {
    if (!this.visible || this.interactionActive || this.quality === "low") return;
    const limits = treeQualityLimits(this.quality);
    const ranked = this.rankedPlacements();
    const thresholds = treeLodThresholds();
    const requested = new Map<TreeModelEntry, Map<TreeModelTier, number>>();
    ranked.forEach(({ placement, distance }, index) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      const tier: TreeModelTier | null = index < limits.close && distance < thresholds.midToCloseDistance
        ? "close"
        : index < limits.mid && distance < thresholds.mapToMidDistance ? "mid" : null;
      if (!tier) return;
      const priorities = requested.get(entry) || new Map<TreeModelTier, number>();
      priorities.set(tier, Math.min(priorities.get(tier) ?? Number.POSITIVE_INFINITY, distance));
      requested.set(entry, priorities);
    });
    for (const [entry, tiers] of requested) {
      for (const [tier, distance] of tiers) void this.load(entry, tier, 100 + distance);
    }
  }

  private rebuild(): void {
    if (!this.mapSettled || this.disposed || !this.visible || this.options.fallback.visible) return;
    const groups = this.planGroups();
    const cameraQuantum = `${Math.round(this.options.camera.position.x / 100)}:${Math.round(this.options.camera.position.z / 100)}`;
    let membershipHash = 2166136261;
    for (const [key, group] of groups) {
      for (let index = 0; index < key.length; index += 1) {
        membershipHash ^= key.charCodeAt(index);
        membershipHash = Math.imul(membershipHash, 16777619);
      }
      for (const placement of group.placements) {
        membershipHash ^= Math.round(placement.x) + Math.round(placement.z) * 31;
        membershipHash = Math.imul(membershipHash, 16777619);
      }
    }
    const signature = `${this.quality}|${cameraQuantum}|${membershipHash >>> 0}`;
    if (signature === this.lastMembershipSignature) {
      this.syncDiagnostics(groups);
      return;
    }
    this.lastMembershipSignature = signature;
    this.activeSourceKeys.clear();
    for (const [key, record] of this.batchGroups) {
      const group = groups.get(key);
      const signature = group ? this.groupSignature(group) : "";
      if (group && record.signature === signature) {
        record.objects.forEach((batch) => { batch.castShadow = group.tier === "close" && (this.quality === "high" || this.quality === "ultra"); });
        this.activeSourceKeys.add(key);
        continue;
      }
      this.removeBatchRecord(key, record);
    }
    for (const [key, group] of groups) {
      this.activeSourceKeys.add(key);
      if (this.batchGroups.has(key)) continue;
      this.batchGroups.set(key, {
        objects: this.createBatch(group.entry, group.tier, group.placements),
        signature: this.groupSignature(group),
        tier: group.tier,
      });
    }
    this.evictDetailCaches();
    this.syncDiagnostics(groups);
  }

  private planGroups(): Map<string, TreeBatchGroup> {
    const thresholds = treeLodThresholds();
    const limits = treeQualityLimits(this.quality);
    const groups = new Map<string, TreeBatchGroup>();
    this.rankedPlacements().forEach(({ placement, distance }, index) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      const desired: TreeModelTier = index < limits.close && distance < thresholds.midToCloseDistance
        ? "close"
        : index < limits.mid && distance < thresholds.mapToMidDistance ? "mid" : "map";
      const tier = this.sources.has(this.key(entry, desired)) ? desired
        : desired === "close" && this.sources.has(this.key(entry, "mid")) ? "mid" : "map";
      const key = this.key(entry, tier);
      const source = this.sources.get(key);
      if (!source) return;
      source.lastUsedAt = performance.now();
      const group = groups.get(key) || { entry, tier, placements: [] };
      group.placements.push(placement);
      groups.set(key, group);
    });
    return groups;
  }

  private rankedPlacements(): RankedPlacement[] {
    const camera = this.options.camera.position;
    return this.runtimePlacements().map(({ placement, index }) => ({
      placement,
      index,
      distance: treePlacementDistance(camera, placement),
    })).sort((left, right) => left.distance - right.distance || left.index - right.index);
  }

  private runtimePlacements(): Array<{ placement: VegetationPlacement; index: number }> {
    const limit = Math.min(this.options.placements.length, treeInstanceLimit(this.quality));
    if (limit >= this.options.placements.length) return this.options.placements.map((placement, index) => ({ placement, index }));
    const step = this.options.placements.length / Math.max(1, limit);
    return Array.from({ length: limit }, (_, index) => {
      const sourceIndex = Math.min(this.options.placements.length - 1, Math.floor(index * step));
      return { placement: this.options.placements[sourceIndex]!, index: sourceIndex };
    });
  }

  private createBatch(entry: TreeModelEntry, tier: TreeModelTier, placements: VegetationPlacement[]): InstancedMesh[] {
    const source = this.sources.get(this.key(entry, tier));
    if (!source) return [];
    const created: InstancedMesh[] = [];
    const placementMatrix = new Matrix4();
    const translation = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const final = new Matrix4();
    for (const part of source.parts) {
      const batch = new InstancedMesh(part.geometry, part.material, placements.length);
      batch.name = `tree-${entry.id}-${tier}`;
      batch.castShadow = tier === "close" && (this.quality === "high" || this.quality === "ultra");
      batch.receiveShadow = false;
      placements.forEach((placement, index) => {
        translation.set(placement.x, placement.y - source.groundOffset * placement.scale, placement.z);
        rotation.setFromAxisAngle(Y_AXIS, placement.variation * Math.PI * 2);
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
      created.push(batch);
    }
    return created;
  }

  private load(entry: TreeModelEntry, tier: TreeModelTier, priority = 1000): Promise<void> {
    const key = this.key(entry, tier);
    if (this.sources.has(key) || this.failures.has(key) || this.disposed) return Promise.resolve();
    const existing = this.pending.get(key);
    if (existing) return existing;
    let resolveTask: () => void = () => {};
    const promise = new Promise<void>((resolve) => { resolveTask = resolve; });
    this.pending.set(key, promise);
    this.queue.push({
      key,
      entry,
      tier,
      priority,
      detailGeneration: this.detailGeneration,
      visibilityGeneration: this.visibilityGeneration,
      resolve: resolveTask,
    });
    this.queue.sort((left, right) => left.priority - right.priority);
    this.pump();
    this.syncDiagnostics();
    return promise;
  }

  private pump(): void {
    const concurrency = treeDecodeConcurrency(this.quality);
    while (!this.disposed && this.visible && this.activeLoads < concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      if (this.isTaskStale(task)) {
        this.pending.delete(task.key);
        task.resolve();
        continue;
      }
      this.activeLoads += 1;
      void this.runLoad(task).finally(() => {
        this.activeLoads -= 1;
        this.pending.delete(task.key);
        task.resolve();
        this.syncDiagnostics();
        this.pump();
      });
    }
  }

  private async runLoad(task: TreeLoadTask): Promise<void> {
    const metadata = task.entry.tiers[task.tier];
    const base = new URL(this.options.assetBase, window.location.href);
    const url = new URL(metadata.url, base);
    url.searchParams.set("v", metadata.sha256.slice(0, 12));
    try {
      const gltf = await this.loader.loadAsync(url.href);
      gltf.scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(gltf.scene);
      const parts: SourcePart[] = [];
      gltf.scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        parts.push({ geometry: object.geometry, material: object.material, matrix: object.matrixWorld.clone() });
      });
      if (parts.length === 0) throw new Error("tree GLB contains no meshes");
      const source: LoadedSource = { parts, groundOffset: bounds.min.y, entry: task.entry, tier: task.tier, lastUsedAt: performance.now() };
      if (this.disposed || this.isTaskStale(task)) {
        this.disposeSource(source);
        return;
      }
      this.sources.set(task.key, source);
      if (task.tier !== "map") this.rebuild();
    } catch (error) {
      if (!this.isTaskStale(task) && !this.disposed) {
        this.failures.add(task.key);
        console.warn(`Raidlands could not load ${task.entry.id} ${task.tier} tree LOD.`, error);
      }
    }
  }

  private isTaskStale(task: TreeLoadTask): boolean {
    return treeRequestIsStale(
      task.tier,
      task.detailGeneration,
      this.detailGeneration,
      task.visibilityGeneration,
      this.visibilityGeneration,
    );
  }

  private cancelQueuedDetail(): void {
    const retained: TreeLoadTask[] = [];
    for (const task of this.queue) {
      if (task.tier === "map") retained.push(task);
      else {
        this.pending.delete(task.key);
        task.resolve();
      }
    }
    this.queue.splice(0, this.queue.length, ...retained);
  }

  private evictDetailCaches(): void {
    const limits = QUALITY_CACHE[this.quality];
    this.evictTier("close", limits.close);
    this.evictTier("mid", limits.mid);
  }

  private evictTier(tier: TreeModelTier, limit: number): void {
    const entries = [...this.sources.entries()]
      .filter(([key, source]) => source.tier === tier && !this.activeSourceKeys.has(key))
      .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt);
    const totalTierEntries = [...this.sources.values()].filter((source) => source.tier === tier).length;
    const removeCount = Math.max(0, totalTierEntries - limit);
    entries.slice(0, removeCount).forEach(([key, source]) => {
      this.disposeSource(source);
      this.sources.delete(key);
    });
  }

  private usedEntries(): TreeModelEntry[] {
    const nearest = new Map<string, { entry: TreeModelEntry; distance: number }>();
    this.options.placements.forEach((placement) => {
      const entry = treeModelForVariation(placement.biome, placement.variation);
      const distance = treePlacementDistance(this.options.camera.position, placement);
      const existing = nearest.get(entry.id);
      if (!existing || distance < existing.distance) nearest.set(entry.id, { entry, distance });
    });
    return [...nearest.values()].sort((left, right) => left.distance - right.distance).map(({ entry }) => entry);
  }

  private clearBatches(): void {
    for (const [key, record] of this.batchGroups) this.removeBatchRecord(key, record);
  }

  private removeBatchRecord(key: string, record: TreeBatchRecord): void {
    record.objects.forEach((batch) => {
      this.layer.remove(batch);
      batch.dispose();
    });
    this.batchGroups.delete(key);
  }

  private groupSignature(group: TreeBatchGroup): string {
    let hash = 2166136261;
    for (const placement of group.placements) {
      hash ^= Math.round(placement.x) + Math.round(placement.z) * 31;
      hash = Math.imul(hash, 16777619);
    }
    return `${group.tier}:${group.placements.length}:${hash >>> 0}`;
  }

  private disposeSource(source: LoadedSource): void {
    for (const part of source.parts) {
      part.geometry.dispose();
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.forEach((material) => material.dispose());
    }
  }

  private key(entry: TreeModelEntry, tier: TreeModelTier): string { return `${entry.id}:${tier}`; }

  private syncDiagnostics(groups?: Map<string, TreeBatchGroup>): void {
    const tierCounts = { map: 0, mid: 0, close: 0 };
    for (const group of groups?.values() || []) tierCounts[group.tier] += group.placements.length;
    const loadedBytes = [...this.sources.values()].reduce((sum, source) => sum + source.entry.tiers[source.tier].bytes, 0);
    const biomeCounts = this.options.placements.reduce<Record<string, number>>((counts, placement) => {
      counts[placement.biome] = (counts[placement.biome] || 0) + 1;
      return counts;
    }, {});
    Object.assign(this.options.root.dataset, {
      treeManifestVersion: String(treeManifestVersion()),
      treeRecipeVersion: String(treeRecipeVersion()),
      treeSourceRevision: treeSourceRevision(),
      treeQualityRuntime: this.quality,
      treeMapInstances: String(tierCounts.map),
      treeMidInstances: String(tierCounts.mid),
      treeCloseInstances: String(tierCounts.close),
      treeLoadedAssets: String(this.sources.size),
      treeLoadedBytes: String(loadedBytes),
      treeFailedAssets: String(this.failures.size),
      treeDecodeQueue: String(this.queue.length),
      treeActiveLoads: String(this.activeLoads),
      treeDecodeConcurrency: String(treeDecodeConcurrency(this.quality)),
      treeFallbackActive: String(this.options.fallback.visible),
      treeBiomeInstances: JSON.stringify(biomeCounts),
    });
  }
}
