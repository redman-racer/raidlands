import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Document, NodeIO, type Material, type Mesh as GltfMesh, type Node, type Scene, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { InstancedMesh } from "@gltf-transform/extensions";
import { copyToDocument, dedup, flatten, getBounds, instance, join, normals, prune, simplify, simplifyPrimitive, unpartition, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";
import { MONUMENT_LOD_RECIPES, RUSTRELAY_SOURCE, type MonumentLodRecipe, type MonumentSizeClass, type MonumentTierName } from "./monument-lod-recipes";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, "assets/media/models/monuments");
const outputDir = resolve(root, "assets/media/models/monuments-lod");
const manifestPath = resolve(outputDir, "manifest.json");
const approvalsPath = resolve(root, "data/monument-lod-approvals.json");
const catalogPath = resolve(root, "data/rustrelay-asset-catalog.json");
const rustRelayRoot = resolve(
  process.env.RUSTRELAY_ASSETS_ROOT || resolve(root, "..", "RustRelay.Assets", "assets"),
);
const checkOnly = process.argv.includes("--check");
const manifestOnly = process.argv.includes("--manifest-only");
const onlyAsset = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length) || "";

type Bounds = { min: number[]; max: number[] };
type Stats = {
  triangles: number;
  drawCalls: number;
  textureBytes: number;
  baseColorTexturedTriangles: number;
  baseColorTextureCoverage: number;
  bounds: Bounds;
  instanceBatches: number;
  instances: number;
};
type SelectedNodes = { nodes: Node[]; names: string[]; roles: Record<string, string[]>; kind: "authored-hlod" | "recipe-structural" | "surface-structural" | "largest-structural" | "standalone-override" };
type ReviewApproval = {
  status: "approved" | "rejected";
  sourceSha256: string;
  tierSha256: Record<MonumentTierName, string>;
  reviewedAt: string;
};
type TierBudget = {
  maxBytes: number;
  maxTriangles: number;
  targetTriangles: Record<MonumentSizeClass, number>;
  maxDrawCalls: number;
  textureSize: number;
  simplifyError: number;
};

const TIER_ORDER: MonumentTierName[] = ["map", "mid", "close"];
const TIER_INDEX = new Map(TIER_ORDER.map((tier, index) => [tier, index]));
const TIER_BUDGETS: Record<MonumentTierName, TierBudget> = {
  map: {
    maxBytes: 1536 * 1024,
    maxTriangles: 250_000,
    targetTriangles: { tiny: 5_000, small: 10_000, medium: 22_000, large: 30_000, xlarge: 42_000 },
    maxDrawCalls: 120,
    textureSize: 128,
    simplifyError: 0.025,
  },
  mid: {
    maxBytes: 2 * 1024 * 1024,
    maxTriangles: 260_000,
    targetTriangles: { tiny: 18_000, small: 32_000, medium: 65_000, large: 100_000, xlarge: 120_000 },
    maxDrawCalls: 120,
    textureSize: 512,
    simplifyError: 0.012,
  },
  close: {
    maxBytes: 4 * 1024 * 1024,
    maxTriangles: 350_000,
    targetTriangles: { tiny: 35_000, small: 75_000, medium: 150_000, large: 240_000, xlarge: 300_000 },
    maxDrawCalls: 180,
    textureSize: 1024,
    simplifyError: 0.006,
  },
};

const MAP_PALETTE = [
  [0.11, 0.13, 0.13], [0.24, 0.27, 0.27], [0.39, 0.42, 0.4], [0.58, 0.58, 0.53],
  [0.73, 0.7, 0.61], [0.42, 0.27, 0.18], [0.56, 0.26, 0.14], [0.17, 0.26, 0.16],
  [0.28, 0.39, 0.24], [0.17, 0.3, 0.39], [0.48, 0.16, 0.12], [0.91, 0.89, 0.8],
] as const;

const STRUCTURAL_NAME = /(?:apartment|airfield|hangar|building|warehouse|factory|office|rowhouse|outbuilding|house|tower|tank|silo|dish|radar|lighthouse|station|supermarket|market|shop|store|garage|shed|barn|stable|compound|wall|gate|platform|walkway|stair|railing|handrail|window|opening|doorway|roof|helipad|crane|excavator|conveyor|pipeline|bridge|dock|harbor|oilrig|level\d|structure|cooling|sewage|treatment|pump|substation|quarry|mining|well|bunker|entrance|cave|tunnel|ruin|ziggurat|fishing|barge|module|foundation|ground_pad|road|runway|pavemnent|pavement|ice_mesh|swamp|water_plane|waterbody|range_core|rocket|launch|dredge|carshredder|train_track|train_wagon|coaling)/i;
const LANDMARK_NAME = /(?:rocket|silo|dish|radar|lighthouse|cooling_tower|water_tower|excavator|conveyor|crane|helipad|burner|mlrs|carshredder|coaling_tower|watch_tower|marketplace|marketpalce|caboose|dredge)/i;
const HARD_EXCLUDE = /(?:interior|underground|basement|mineshaft|collider|collision|trigger|volume|navmesh|occluder|socket|spawn|invisible|lod[1-9]|shadow_proxy|door_handle|loot|(?:^|[_\-. ])(?:lights?|lamps?|spotlights?|floodlights?)(?:[_\-. ]|$)|cardboard|chair|desk|computer|telephone|poster|pallet|food|bottle|can_cluster|toilet|rug|mattress|cabinet|shelf|book|kettle|typewriter)/i;
const NATURAL_EXCLUDE = /(?:grass|bush|fern|foliage|twig|tree|debris|rubble|terrain|cliff|mountain|rock|boulder)/i;
const LOOSE_PROP = /(?:barrel|box|crate|vehicle|sedan|truck|van|helicopter|forklift|road_cone|sandbag|lamp|spotlight|fluorescent|switch|sign_|junk_pile|trash|tire|cloth|pipe_[a-e]_|electrical_box|locker|plant|bench)/i;

async function createIo(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder,
    "draco3d.encoder": encoder,
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

type CatalogAsset = { path: string; basename: string; ambiguousBasename: boolean };
const catalog = existsSync(catalogPath)
  ? JSON.parse(readFileSync(catalogPath, "utf8")) as { revision: string; assets: CatalogAsset[] }
  : null;
if (!catalog || catalog.revision !== RUSTRELAY_SOURCE.revision) throw new Error("RustRelay asset catalog is missing or stale. Run npm run monuments:catalog.");
const catalogByNormalizedName = new Map<string, CatalogAsset[]>();
for (const asset of catalog.assets) {
  const key = normalizeComponentName(asset.basename);
  const matches = catalogByNormalizedName.get(key) || [];
  matches.push(asset);
  catalogByNormalizedName.set(key, matches);
}

function normalizeComponentName(value: string): string {
  return value.toLowerCase().replace(/\.glb$/i, "").replace(/(?:[_\-. ]lod\d+)$/i, "").replace(/\s*\(clone\)$/i, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function componentResolutions(selection: SelectedNodes): Array<{ sourceNode: string; resolution: "standalone-catalog" | "embedded-layout"; catalogPath: string | null }> {
  return selection.names.map((name) => {
    const matches = catalogByNormalizedName.get(normalizeComponentName(name)) || [];
    return matches.length === 1
      ? { sourceNode: name, resolution: "standalone-catalog" as const, catalogPath: matches[0]!.path }
      : { sourceNode: name, resolution: "embedded-layout" as const, catalogPath: null };
  });
}

function resolvedCompositePath(recipe: MonumentLodRecipe, path: string, fallback?: string): string {
  const rustRelayPath = resolve(rustRelayRoot, path);
  const fallbackPath = fallback ? resolve(root, fallback) : "";
  const sourcePath = existsSync(rustRelayPath) ? rustRelayPath : fallbackPath;
  if (!existsSync(sourcePath)) throw new Error(`${recipe.id}: missing standalone override ${path}.`);
  return sourcePath;
}

function documentStats(document: Document): Stats {
  const documentRoot = document.getRoot();
  const scene = documentRoot.getDefaultScene() || documentRoot.listScenes()[0];
  if (!scene) throw new Error("glTF document has no scene.");
  let triangles = 0;
  let baseColorTexturedTriangles = 0;
  let drawCalls = 0;
  let instanceBatches = 0;
  let instances = 0;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const batch = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing");
    const instanceCount = batch?.listAttributes()[0]?.getCount() || 1;
    if (batch) { instanceBatches++; instances += instanceCount; }
    drawCalls += mesh.listPrimitives().length;
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) continue;
      const primitiveTriangles = Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3) * instanceCount;
      triangles += primitiveTriangles;
      if (primitive.getMaterial()?.getBaseColorTexture()) baseColorTexturedTriangles += primitiveTriangles;
    }
  });
  return {
    triangles,
    drawCalls,
    textureBytes: documentRoot.listTextures().reduce((sum, texture) => sum + (texture.getImage()?.byteLength ?? 0), 0),
    baseColorTexturedTriangles,
    baseColorTextureCoverage: triangles > 0 ? baseColorTexturedTriangles / triangles : 0,
    bounds: documentBounds(scene),
    instanceBatches,
    instances,
  };
}

function documentTextureSize(document: Document): number {
  return document.getRoot().listTextures().reduce((largest, texture) => {
    const size = texture.getSize();
    return size ? Math.max(largest, size[0], size[1]) : largest;
  }, 0);
}

function nodeWorldMatrices(node: Node): Matrix4[] {
  const world = new Matrix4().fromArray(node.getWorldMatrix());
  const batch = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing");
  if (!batch) return [world];
  const translation = batch.getAttribute("TRANSLATION");
  const rotation = batch.getAttribute("ROTATION");
  const scale = batch.getAttribute("SCALE");
  const count = batch.listAttributes()[0]?.getCount() || 0;
  const matrices: Matrix4[] = [];
  for (let index = 0; index < count; index++) {
    const positionValue = translation?.getElement(index, []) || [0, 0, 0];
    const rotationValue = rotation?.getElement(index, []) || [0, 0, 0, 1];
    const scaleValue = scale?.getElement(index, []) || [1, 1, 1];
    const local = new Matrix4().compose(
      new Vector3(positionValue[0], positionValue[1], positionValue[2]),
      new Quaternion(rotationValue[0], rotationValue[1], rotationValue[2], rotationValue[3]),
      new Vector3(scaleValue[0], scaleValue[1], scaleValue[2]),
    );
    matrices.push(local.premultiply(world));
  }
  return matrices;
}

function documentBounds(scene: Scene): Bounds {
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      const min = position.getMin([]);
      const max = position.getMax([]);
      for (const matrix of nodeWorldMatrices(node)) {
        for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
          const point = new Vector3(x, y, z).applyMatrix4(matrix);
          for (let axis = 0; axis < 3; axis++) {
            bounds.min[axis] = Math.min(bounds.min[axis]!, point.getComponent(axis));
            bounds.max[axis] = Math.max(bounds.max[axis]!, point.getComponent(axis));
          }
        }
      }
    }
  });
  return bounds;
}

function nodeName(node: Node): string {
  return `${node.getName()} ${node.getMesh()?.getName() || ""}`.trim();
}

function nodeExtent(node: Node): { max: number; footprint: number; height: number; volume: number } {
  const bounds = getBounds(node);
  const width = Math.max(0, bounds.max[0] - bounds.min[0]);
  const height = Math.max(0, bounds.max[1] - bounds.min[1]);
  const depth = Math.max(0, bounds.max[2] - bounds.min[2]);
  return { max: Math.max(width, height, depth), footprint: Math.max(width, depth), height, volume: Math.max(0.001, width * height * depth) };
}

function authoredHlodNodes(document: Document): Node[] {
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh() && /(?:^|[_\-.])hlod(?:[_\-.]|$)/i.test(nodeName(node)));
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.listChildren().includes(node)));
}

function matchesAny(name: string, values?: string[]): boolean {
  return Boolean(values?.some((value) => name.toLowerCase().includes(value.toLowerCase())));
}

function roleForName(name: string): string {
  if (/wall|gate|fence|perimeter/i.test(name)) return "perimeter";
  if (/roof/i.test(name)) return "roof";
  if (/stair|ladder/i.test(name)) return "stairs";
  if (/platform|walkway|bridge|dock|pier|helipad/i.test(name)) return "platform";
  if (/ground|road|foundation|runway|pavemnent/i.test(name)) return "ground-pad";
  if (LANDMARK_NAME.test(name)) return "landmark-prop";
  return "shell";
}

function selectStructuralNodes(source: Document, recipe: MonumentLodRecipe, tier: MonumentTierName): SelectedNodes {
  if (recipe.standaloneOnly) {
    const names = (recipe.composites || []).filter((entry) => compositeEnabled(entry.minimumTier, tier)).map((entry) => entry.rustRelayPath);
    return { nodes: [], names, roles: { shell: names }, kind: "standalone-override" };
  }
  const sourceScene = source.getRoot().getDefaultScene() || source.getRoot().listScenes()[0]!;
  const sceneBounds = getBounds(sourceScene);
  const footprint = Math.max(sceneBounds.max[0] - sceneBounds.min[0], sceneBounds.max[2] - sceneBounds.min[2]);
  const compactMapSelection = tier === "map" && recipe.preferAuthoredMap !== false;
  const minimumExtent = Math.max(compactMapSelection ? 2 : 0.55, footprint * (compactMapSelection ? 0.014 : 0.003));
  const authored = authoredHlodNodes(source);
  if (recipe.id === "apartments_complex_1" && authored.length) {
    return summarizeSelection(authored, "authored-hlod");
  }
  if (tier === "map" && recipe.preferAuthoredMap !== false && authored.length) {
    return summarizeSelection(authored, "authored-hlod");
  }

  const selected = source.getRoot().listNodes().filter((node) => {
    if (!node.getMesh()) return false;
    const name = nodeName(node);
    if (HARD_EXCLUDE.test(name) || authored.includes(node) || matchesAny(name, recipe.explicitExcludes)) return false;
    const bounds = getBounds(node);
    if (recipe.surfaceOnly && bounds.max[1] < -5) return false;
    const explicitMap = tier === "map" && matchesAny(name, recipe.explicitMapIncludes);
    const explicitStructural = matchesAny(name, recipe.explicitStructuralIncludes);
    if (tier === "map" && recipe.explicitMapIncludes?.length) return explicitMap;
    if (explicitStructural) return true;
    const extent = nodeExtent(node);
    if (extent.max < minimumExtent) return false;
    if (!recipe.surfaceOnly && NATURAL_EXCLUDE.test(name)) return false;
    if (LOOSE_PROP.test(name) && !LANDMARK_NAME.test(name)) return false;
    return STRUCTURAL_NAME.test(name) || (recipe.surfaceOnly && extent.footprint >= minimumExtent * 1.5);
  });

  if (selected.length) return summarizeSelection(selected, recipe.surfaceOnly ? "surface-structural" : "recipe-structural");

  const largest = source.getRoot().listNodes()
    .filter((node) => node.getMesh() && !HARD_EXCLUDE.test(nodeName(node)))
    .filter((node) => !recipe.surfaceOnly || getBounds(node).max[1] >= -5)
    .sort((a, b) => nodeExtent(b).volume - nodeExtent(a).volume)
    .slice(0, tier === "map" ? 12 : tier === "mid" ? 30 : 60);
  if (!largest.length) throw new Error(`${recipe.id}: no renderable nodes for ${tier}.`);
  return summarizeSelection(largest, "largest-structural");
}

function summarizeSelection(nodes: Node[], kind: SelectedNodes["kind"]): SelectedNodes {
  const roles: Record<string, string[]> = {};
  const names = nodes.map((node, index) => node.getMesh()?.getName() || node.getName() || `unnamed-structural-node-${index + 1}`);
  for (const [index, node] of nodes.entries()) {
    const role = roleForName(nodeName(node));
    (roles[role] ||= []).push(node.getMesh()?.getName() || node.getName() || `unnamed-structural-node-${index + 1}`);
  }
  for (const role of Object.keys(roles)) roles[role] = Array.from(new Set(roles[role])).sort();
  return { nodes, names: Array.from(new Set(names)).sort(), roles, kind };
}

function copySelectedNodes(source: Document, selection: SelectedNodes): { document: Document; scene: Scene } {
  const target = new Document();
  const scene = target.createScene("monument-lod");
  const sourceMeshes = Array.from(new Set(selection.nodes.map((node) => node.getMesh()).filter((mesh): mesh is GltfMesh => Boolean(mesh))));
  const copied = copyToDocument(target, source, sourceMeshes);
  for (const sourceNode of selection.nodes) {
    const sourceMesh = sourceNode.getMesh();
    const mesh = sourceMesh ? copied.get(sourceMesh) as GltfMesh | undefined : undefined;
    if (!mesh) continue;
    const node = target.createNode(sourceNode.getName() || sourceMesh?.getName() || "structural-component")
      .setMesh(mesh)
      .setMatrix(sourceNode.getWorldMatrix());
    scene.addChild(node);
  }
  target.getRoot().setDefaultScene(scene);
  return { document: target, scene };
}

function selectionBounds(selection: SelectedNodes): Bounds {
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const node of selection.nodes) {
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      const min = position.getMin([]), max = position.getMax([]);
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
        const point = new Vector3(x, y, z).applyMatrix4(matrix);
        for (let axis = 0; axis < 3; axis++) {
          bounds.min[axis] = Math.min(bounds.min[axis]!, point.getComponent(axis));
          bounds.max[axis] = Math.max(bounds.max[axis]!, point.getComponent(axis));
        }
      }
    }
  }
  return bounds;
}

function compositeEnabled(minimumTier: MonumentTierName, tier: MonumentTierName): boolean {
  return (TIER_INDEX.get(tier) ?? 0) >= (TIER_INDEX.get(minimumTier) ?? 0);
}

async function addComposites(target: Document, scene: Scene, recipe: MonumentLodRecipe, tier: MonumentTierName, reader: NodeIO): Promise<string[]> {
  const used: string[] = [];
  for (const composite of recipe.composites || []) {
    if (!compositeEnabled(composite.minimumTier, tier)) continue;
    const rustRelayPath = resolve(rustRelayRoot, composite.rustRelayPath);
    const fallbackPath = composite.localFallback ? resolve(root, composite.localFallback) : "";
    const sourcePath = existsSync(rustRelayPath) ? rustRelayPath : fallbackPath;
    if (!existsSync(sourcePath)) throw new Error(`${recipe.id}: missing composite ${composite.id} at ${sourcePath}.`);
    const component = await reader.read(sourcePath);
    const componentScene = component.getRoot().getDefaultScene() || component.getRoot().listScenes()[0];
    if (!componentScene) throw new Error(`${recipe.id}: composite ${composite.id} has no scene.`);
    const componentRoots = componentScene.listChildren();
    for (const [placementIndex, placement] of composite.placements.entries()) {
      const copied = copyToDocument(target, component, componentRoots);
      const wrapper = target.createNode(`${recipe.id}-${composite.id}-${placementIndex + 1}`)
        .setTranslation([placement.x, placement.y, placement.z])
        .setRotation([0, Math.sin(placement.rotationY / 2), 0, Math.cos(placement.rotationY / 2)])
        .setScale([placement.scale || 1, placement.scale || 1, placement.scale || 1]);
      for (const componentRoot of componentRoots) {
        const copiedRoot = copied.get(componentRoot) as Node | undefined;
        if (!copiedRoot) continue;
        wrapper.addChild(copiedRoot);
      }
      scene.addChild(wrapper);
    }
    used.push(composite.rustRelayPath);
  }
  return used;
}

async function standaloneStructuralBounds(recipe: MonumentLodRecipe, reader: NodeIO): Promise<Bounds> {
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const composite of recipe.composites || []) {
    if (!compositeEnabled(composite.minimumTier, "map")) continue;
    const component = await reader.read(resolvedCompositePath(recipe, composite.rustRelayPath, composite.localFallback));
    const componentScene = component.getRoot().getDefaultScene() || component.getRoot().listScenes()[0];
    if (!componentScene) throw new Error(`${recipe.id}: standalone override ${composite.id} has no scene.`);
    const componentBounds = documentBounds(componentScene);
    for (const placement of composite.placements) {
      const scale = placement.scale || 1;
      const matrix = new Matrix4().compose(
        new Vector3(placement.x, placement.y, placement.z),
        new Quaternion(0, Math.sin(placement.rotationY / 2), 0, Math.cos(placement.rotationY / 2)),
        new Vector3(scale, scale, scale),
      );
      for (const x of [componentBounds.min[0], componentBounds.max[0]]) for (const y of [componentBounds.min[1], componentBounds.max[1]]) for (const z of [componentBounds.min[2], componentBounds.max[2]]) {
        const point = new Vector3(x, y, z).applyMatrix4(matrix);
        for (let axis = 0; axis < 3; axis++) {
          bounds.min[axis] = Math.min(bounds.min[axis]!, point.getComponent(axis));
          bounds.max[axis] = Math.max(bounds.max[axis]!, point.getComponent(axis));
        }
      }
    }
  }
  if (!Number.isFinite(bounds.min[0]!)) throw new Error(`${recipe.id}: standalone structural bounds are empty.`);
  return bounds;
}

function nearestPalette(color: number[], candidates: readonly (readonly number[])[] = MAP_PALETTE): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate, index) => {
    const next = candidate.reduce((sum, channel, channelIndex) => sum + (channel - (color[channelIndex] ?? 0.5)) ** 2, 0);
    if (next < distance) { distance = next; best = index; }
  });
  return best;
}

async function textureAverage(texture: Texture, cache: Map<Texture, Promise<number[]>>): Promise<number[]> {
  const cached = cache.get(texture);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const image = texture.getImage();
      if (!image) return [0.5, 0.5, 0.5];
      const sample = await sharp(image).resize(1, 1, { fit: "fill" }).removeAlpha().raw().toBuffer();
      return [0, 1, 2].map((index) => (sample[index] ?? 128) / 255);
    } catch {
      return [0.5, 0.5, 0.5];
    }
  })();
  cache.set(texture, promise);
  return promise;
}

async function materialColor(material: Material, textureCache: Map<Texture, Promise<number[]>>): Promise<number[]> {
  const factor = material.getBaseColorFactor();
  const texture = material.getBaseColorTexture();
  const average = texture ? await textureAverage(texture, textureCache) : [1, 1, 1];
  return [0, 1, 2].map((index) => average[index]! * factor[index]!);
}

async function applyPalette(document: Document, paletteLimit = MAP_PALETTE.length): Promise<void> {
  const originals = document.getRoot().listMaterials();
  const colors = paletteLimit <= 3
    ? [MAP_PALETTE[1], MAP_PALETTE[5], MAP_PALETTE[7]]
    : paletteLimit <= 6
      ? [MAP_PALETTE[0], MAP_PALETTE[2], MAP_PALETTE[3], MAP_PALETTE[5], MAP_PALETTE[7], MAP_PALETTE[9]]
      : MAP_PALETTE;
  const paletteMaterials = colors.map((color, index) => document.createMaterial(`monument-palette-${index}`).setBaseColorFactor([...color, 1]));
  const textureCache = new Map<Texture, Promise<number[]>>();
  const materialMap = new Map<Material, Material>();
  for (const material of originals) materialMap.set(material, paletteMaterials[nearestPalette(await materialColor(material, textureCache), colors)]!);
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (material) primitive.setMaterial(materialMap.get(material)!);
      for (const semantic of primitive.listSemantics()) if (semantic !== "POSITION") primitive.setAttribute(semantic, null);
      for (const morphTarget of primitive.listTargets()) primitive.removeTarget(morphTarget);
    }
  }
}

function stripSecondaryTextures(document: Document): void {
  for (const material of document.getRoot().listMaterials()) {
    material
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null)
      .setMetallicRoughnessTexture(null)
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setEmissiveFactor([0, 0, 0]);
  }
}

async function simplifyPerComponent(document: Document, targetTriangles: number, error: number, lockBorder: boolean, preserveInstances: boolean): Promise<void> {
  await document.transform(weld({ overwrite: true }), prune());
  const current = documentStats(document).triangles;
  const ratio = Math.min(1, targetTriangles / Math.max(1, current));
  if (ratio < 0.995) {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) continue;
        const triangles = Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3);
        if (triangles < 24) continue;
        try {
          simplifyPrimitive(primitive, {
            simplifier: MeshoptSimplifier,
            ratio: Math.max(ratio, Math.min(1, 12 / Math.max(1, triangles))),
            error,
            lockBorder,
          });
        } catch (error) {
          console.warn(`Could not simplify ${mesh.getName() || "unnamed mesh"}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  if (preserveInstances) await document.transform(normals({ overwrite: true }), dedup(), instance({ min: 2 }), flatten(), join({ keepNamed: false }), prune());
  else await document.transform(normals({ overwrite: true }), flatten(), join({ keepNamed: false }), prune());
  const joinedTriangles = documentStats(document).triangles;
  if (joinedTriangles > targetTriangles) {
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: Math.min(1, targetTriangles / Math.max(1, joinedTriangles)),
        error: 1,
        lockBorder: true,
      }),
      normals({ overwrite: true }),
      prune(),
    );
  }
  const borderedTriangles = documentStats(document).triangles;
  if (borderedTriangles > targetTriangles) {
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: Math.min(1, targetTriangles / Math.max(1, borderedTriangles) * 0.92),
        error: 1,
        lockBorder: false,
      }),
      normals({ overwrite: true }),
      prune(),
    );
  }
}

async function buildTierDocument(
  source: Document,
  recipe: MonumentLodRecipe,
  tier: MonumentTierName,
  reader: NodeIO,
  forcePalette: boolean,
  targetScale = 1,
  preserveInstances = tier !== "map",
): Promise<{ document: Document; selection: SelectedNodes; composites: string[]; materialMode: "palette" | "textured" }> {
  const selection = selectStructuralNodes(source, recipe, tier);
  const { document, scene } = copySelectedNodes(source, selection);
  const composites = await addComposites(document, scene, recipe, tier, reader);
  const budget = TIER_BUDGETS[tier];
  const targetTriangles = Math.max(1_000, Math.round(Math.min(budget.maxTriangles, budget.targetTriangles[recipe.sizeClass]) * targetScale));
  const hasBaseColorTextures = document.getRoot().listMaterials().some((material) => material.getBaseColorTexture());
  const materialMode = forcePalette || !hasBaseColorTextures ? "palette" : "textured";
  if (tier === "map" && materialMode === "textured") stripSecondaryTextures(document);
  if (materialMode === "palette") await applyPalette(document, tier === "mid" ? 3 : tier === "close" ? 6 : MAP_PALETTE.length);
  await simplifyPerComponent(
    document,
    targetTriangles,
    Math.min(1, budget.simplifyError / Math.max(0.02, targetScale * targetScale)),
    tier === "close",
    preserveInstances,
  );
  await document.transform(prune(), unpartition());
  return { document, selection, composites, materialMode };
}

function optimizeStagedAsset(stagedPath: string, outputPath: string, textureSize: number, textured: boolean): void {
  const optimizedPath = `${stagedPath}.optimized.glb`;
  rmSync(optimizedPath, { force: true });
  const args = [
    resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js"), "optimize", stagedPath, optimizedPath,
    "--compress", "draco", "--simplify", "false", "--flatten", "true", "--join", "true", "--palette", "false",
  ];
  if (textured) args.push("--texture-compress", "webp", "--texture-size", String(textureSize));
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  rmSync(outputPath, { force: true });
  renameSync(optimizedPath, outputPath);
}

function textureSizeCandidates(maximum: number): number[] {
  if (maximum <= 0) return [0];
  const candidates: number[] = [];
  for (let size = maximum; size >= 64; size = Math.floor(size / 2)) candidates.push(size);
  if (!candidates.includes(64)) candidates.push(64);
  return candidates;
}

async function writeTier(
  reader: NodeIO,
  source: Document,
  recipe: MonumentLodRecipe,
  tier: MonumentTierName,
  outputPath: string,
): Promise<{ selection: SelectedNodes; composites: string[]; materialMode: "palette" | "textured" }> {
  const budget = TIER_BUDGETS[tier];
  const stagedPaths: string[] = [];
  let retainInstances = tier !== "map";
  let built: Awaited<ReturnType<typeof buildTierDocument>>;
  let stats: Stats;
  let bytes: number;

  const buildAndOptimize = async (tag: string, targetScale: number, preserveInstances: boolean): Promise<void> => {
    built = await buildTierDocument(source, recipe, tier, reader, false, targetScale, preserveInstances);
    const stagedPath = resolve(outputDir, `.${recipe.id}-${tier}-${tag}.staged.glb`);
    stagedPaths.push(stagedPath);
    rmSync(stagedPath, { force: true });
    await reader.write(stagedPath, built.document);
    const textureSizes = built.materialMode === "textured" ? textureSizeCandidates(budget.textureSize) : [0];
    for (const textureSize of textureSizes) {
      optimizeStagedAsset(stagedPath, outputPath, textureSize, built.materialMode === "textured");
      stats = documentStats(await reader.read(outputPath));
      bytes = statSync(outputPath).size;
      if (bytes <= tierMaxBytes(recipe, tier)) break;
    }
  };

  await buildAndOptimize("initial", 1, retainInstances);
  if (stats.drawCalls > budget.maxDrawCalls) {
    retainInstances = false;
    await buildAndOptimize("draw-budget", 1, false);
  }
  let targetScale = 1;
  for (let attempt = 0; attempt < 3 && (bytes > tierMaxBytes(recipe, tier) || stats.triangles > budget.maxTriangles); attempt++) {
    targetScale *= Math.max(0.2, Math.min(0.82,
      tierMaxBytes(recipe, tier) / Math.max(1, bytes) * 0.82,
      budget.maxTriangles / Math.max(1, stats.triangles) * 0.9,
    ));
    await buildAndOptimize(`budget-${attempt + 1}`, targetScale, retainInstances);
  }
  for (const path of stagedPaths) rmSync(path, { force: true });
  if (bytes > tierMaxBytes(recipe, tier)) throw new Error(`${recipe.id} ${tier}: ${bytes} bytes exceeds ${tierMaxBytes(recipe, tier)}.`);
  if (stats.triangles > budget.maxTriangles) throw new Error(`${recipe.id} ${tier}: ${stats.triangles} triangles exceeds ${budget.maxTriangles}.`);
  if (stats.drawCalls > budget.maxDrawCalls) throw new Error(`${recipe.id} ${tier}: ${stats.drawCalls} draw calls exceeds ${budget.maxDrawCalls}.`);
  return built;
}

function tierMaxBytes(recipe: MonumentLodRecipe, tier: MonumentTierName): number {
  if (tier === "close" && (recipe.sizeClass === "large" || recipe.sizeClass === "xlarge")) return 6 * 1024 * 1024;
  return TIER_BUDGETS[tier].maxBytes;
}

function footprint(bounds: Bounds): number {
  return Math.max(bounds.max[0]! - bounds.min[0]!, bounds.max[2]! - bounds.min[2]!);
}

function centerOffset(a: Bounds, b: Bounds): number {
  const ax = (a.min[0]! + a.max[0]!) / 2;
  const az = (a.min[2]! + a.max[2]!) / 2;
  const bx = (b.min[0]! + b.max[0]!) / 2;
  const bz = (b.min[2]! + b.max[2]!) / 2;
  return Math.hypot(ax - bx, az - bz);
}

function elevationOffset(a: Bounds, b: Bounds): number {
  const ay = (a.min[1]! + a.max[1]!) / 2;
  const by = (b.min[1]! + b.max[1]!) / 2;
  return Math.abs(ay - by);
}

async function main(): Promise<void> {
  mkdirSync(outputDir, { recursive: true });
  const reader = await createIo();
  const approvals = existsSync(approvalsPath)
    ? (JSON.parse(readFileSync(approvalsPath, "utf8")) as { approvals?: Record<string, ReviewApproval> }).approvals || {}
    : {};
  const previousEntries = existsSync(manifestPath)
    ? new Map((JSON.parse(readFileSync(manifestPath, "utf8")) as { entries?: Array<{ id: string; sourceSha256: string }> }).entries?.map((entry) => [entry.id, entry]) || [])
    : new Map<string, { id: string; sourceSha256: string }>();
  const changedSourceHashes: string[] = [];
  const entries = [];
  for (const recipe of MONUMENT_LOD_RECIPES) {
    if (onlyAsset && recipe.id !== onlyAsset) continue;
    const localSourcePath = resolve(sourceDir, `${recipe.id}.glb`);
    const rustRelaySourcePath = resolve(rustRelayRoot, recipe.layoutSource);
    if (!existsSync(localSourcePath)) throw new Error(`${recipe.id}: local layout source is missing.`);
    const sourceSha256 = sha256(localSourcePath);
    const previous = previousEntries.get(recipe.id);
    if (previous && previous.sourceSha256 !== sourceSha256) changedSourceHashes.push(`${recipe.id}: ${previous.sourceSha256.slice(0, 12)} -> ${sourceSha256.slice(0, 12)}`);
    const sourceMatchesRustRelay = existsSync(rustRelaySourcePath) && sha256(rustRelaySourcePath) === sourceSha256;
    if (existsSync(rustRelaySourcePath) && !sourceMatchesRustRelay) throw new Error(`${recipe.id}: local source differs from ${recipe.layoutSource}.`);
    const source = await reader.read(localSourcePath);
    const sourceStats = documentStats(source);
    const recipeStructuralBounds = recipe.standaloneOnly ? await standaloneStructuralBounds(recipe, reader) : null;
    const tierMetadata: Record<string, unknown> = {};
    let referenceBounds: Bounds | null = null;
    for (const tier of TIER_ORDER) {
      const file = `${recipe.id}-${tier}.glb`;
      const outputPath = resolve(outputDir, file);
      let buildMetadata: { selection: SelectedNodes; composites: string[]; materialMode: "palette" | "textured" } | null = null;
      if (!checkOnly && !manifestOnly && (!onlyAsset || onlyAsset === recipe.id)) {
        buildMetadata = await writeTier(reader, source, recipe, tier, outputPath);
      }
      if (!existsSync(outputPath)) throw new Error(`${recipe.id}: ${tier} asset is missing. Run npm run monuments:lod.`);
      const outputDocument = await reader.read(outputPath);
      const stats = documentStats(outputDocument);
      const budget = TIER_BUDGETS[tier];
      const selection = buildMetadata?.selection || selectStructuralNodes(source, recipe, tier);
      const structuralBounds = recipeStructuralBounds || selectionBounds(selection);
      const materialMode = outputDocument.getRoot().listTextures().length ? "textured" : "palette";
      const bytes = statSync(outputPath).size;
      if (bytes > tierMaxBytes(recipe, tier) || stats.triangles > budget.maxTriangles || stats.drawCalls > budget.maxDrawCalls) {
        throw new Error(`${recipe.id}: installed ${tier} asset exceeds its budget.`);
      }
      tierMetadata[tier] = {
        file,
        url: `media/models/monuments-lod/${file}`,
        sha256: sha256(outputPath),
        bytes,
        triangles: stats.triangles,
        drawCalls: stats.drawCalls,
        instanceBatches: stats.instanceBatches,
        instances: stats.instances,
        textureBytes: stats.textureBytes,
        textureSize: materialMode === "textured" ? documentTextureSize(outputDocument) : 0,
        baseColorTexturedTriangles: stats.baseColorTexturedTriangles,
        baseColorTextureCoverage: stats.baseColorTextureCoverage,
        materialMode,
        selectionKind: selection.kind,
        sourceNodes: selection.names,
        roleNodes: selection.roles,
        roleCounts: Object.fromEntries(Object.entries(selection.roles).map(([role, names]) => [role, names.length])),
        componentResolutions: componentResolutions(selection),
        compositeSources: buildMetadata?.composites || (recipe.composites || []).filter((entry) => compositeEnabled(entry.minimumTier, tier)).map((entry) => entry.rustRelayPath),
        bounds: stats.bounds,
        structuralBounds,
        maxBytes: tierMaxBytes(recipe, tier),
        maxTriangles: budget.maxTriangles,
        maxDrawCalls: budget.maxDrawCalls,
      };
      if (tier === "close") referenceBounds = structuralBounds;
    }
    if (!referenceBounds) throw new Error(`${recipe.id}: close reference bounds are missing.`);
    for (const tier of TIER_ORDER) {
      const metadata = tierMetadata[tier] as { structuralBounds: Bounds };
      const coverage = footprint(metadata.structuralBounds) / Math.max(0.001, footprint(referenceBounds));
      const normalizedOffset = centerOffset(metadata.structuralBounds, referenceBounds) / Math.max(0.001, footprint(referenceBounds));
      const normalizedElevation = elevationOffset(metadata.structuralBounds, referenceBounds) / Math.max(0.001, footprint(referenceBounds));
      const minimumCoverage = tier === "map" ? 0.8 : 0.95;
      if (coverage < minimumCoverage) throw new Error(`${recipe.id}: ${tier} preserves ${(coverage * 100).toFixed(1)}% of the structural footprint; ${(minimumCoverage * 100).toFixed(0)}% is required.`);
      if (normalizedOffset > 0.05) throw new Error(`${recipe.id}: ${tier} center drifts ${(normalizedOffset * 100).toFixed(1)}% from the structural reference.`);
      if (normalizedElevation > 0.05) throw new Error(`${recipe.id}: ${tier} elevation drifts ${(normalizedElevation * 100).toFixed(1)}% from the structural reference.`);
      Object.assign(metadata, {
        footprintCoverage: Number(coverage.toFixed(6)),
        normalizedCenterOffset: Number(normalizedOffset.toFixed(6)),
        normalizedElevationOffset: Number(normalizedElevation.toFixed(6)),
      });
    }
    const mapMetrics = tierMetadata.map as { triangles: number };
    const midMetrics = tierMetadata.mid as { triangles: number };
    const closeMetrics = tierMetadata.close as { triangles: number };
    if (mapMetrics.triangles > midMetrics.triangles || midMetrics.triangles > closeMetrics.triangles) throw new Error(`${recipe.id}: tier triangle counts are not monotonic.`);
    const approval = approvals[recipe.id];
    const tierSha256 = Object.fromEntries(TIER_ORDER.map((tier) => [tier, (tierMetadata[tier] as { sha256: string }).sha256])) as Record<MonumentTierName, string>;
    const approvalMatches = approval?.sourceSha256 === sourceSha256
      && TIER_ORDER.every((tier) => approval.tierSha256?.[tier] === tierSha256[tier]);
    const reviewStatus = approvalMatches ? approval.status : "candidate";
    entries.push({
      id: recipe.id,
      reviewStatus,
      review: approvalMatches ? { sourceSha256: approval.sourceSha256, tierSha256: approval.tierSha256, reviewedAt: approval.reviewedAt } : null,
      layoutSource: recipe.layoutSource,
      sizeClass: recipe.sizeClass,
      deliveryWave: recipe.deliveryWave,
      surfaceOnly: Boolean(recipe.surfaceOnly),
      structuralRoles: recipe.structuralRoles,
      sourceSha256,
      sourceMatchesRustRelay,
      sourceBytes: statSync(localSourcePath).size,
      sourceTriangles: sourceStats.triangles,
      sourceDrawCalls: sourceStats.drawCalls,
      sourceBounds: sourceStats.bounds,
      legacy: { map: `../monuments-map/${recipe.id}.glb`, detail: `../monuments/${recipe.id}.glb` },
      exclusions: {
        policy: recipe.exclusions,
        hard: HARD_EXCLUDE.source,
        natural: recipe.surfaceOnly ? null : NATURAL_EXCLUDE.source,
        looseProps: LOOSE_PROP.source,
      },
      standaloneOverrides: (recipe.composites || []).map((component) => ({
        id: component.id,
        sourcePath: component.rustRelayPath,
        sourceSha256: sha256(resolvedCompositePath(recipe, component.rustRelayPath, component.localFallback)),
        minimumTier: component.minimumTier,
        placements: component.placements,
      })),
      tiers: tierMetadata,
    });
  }
  if (onlyAsset) {
    if (entries.length !== 1) throw new Error(`Unknown monument recipe: ${onlyAsset}`);
    console.log(`Generated and validated ${onlyAsset} Map, Mid, and Close tiers.`);
    return;
  }
  if (entries.length !== 78) throw new Error(`Expected 78 manifest entries, received ${entries.length}.`);
  const manifest = {
    version: 10,
    recipeVersion: 5,
    generatedBy: "gltf-transform@4.3.0",
    sourceRepository: RUSTRELAY_SOURCE,
    thresholds: { mapToMidPixels: 48, midToClosePixels: 220, hysteresis: 0.2 },
    targets: TIER_BUDGETS,
    entries,
  };
  if (checkOnly) {
    if (!existsSync(manifestPath)) throw new Error("Monument LOD manifest is missing. Run npm run monuments:lod.");
    const installed = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (JSON.stringify(installed) !== JSON.stringify(manifest)) throw new Error("Monument LOD manifest or assets are stale. Run npm run monuments:lod.");
  } else {
    const expected = new Set(entries.flatMap((entry) => TIER_ORDER.map((tier) => `${entry.id}-${tier}.glb`)));
    for (const stale of readdirSync(outputDir).filter((name) => name.endsWith(".glb") && !expected.has(name))) rmSync(resolve(outputDir, stale));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const totals = TIER_ORDER.map((tier) => {
    const metadata = entries.map((entry) => (entry.tiers as Record<string, { bytes: number }>)[tier]!);
    return `${tier} ${(metadata.reduce((sum, entry) => sum + entry.bytes, 0) / 1048576).toFixed(1)} MB`;
  });
  if (changedSourceHashes.length) console.warn(`RustRelay source changes returned affected recipes to candidate:\n${changedSourceHashes.join("\n")}`);
  const approvedCount = entries.filter((entry) => entry.reviewStatus === "approved").length;
  console.log(`${checkOnly ? "Validated" : "Generated"} ${entries.length} three-tier monument recipes (${approvedCount} approved; ${totals.join(", ")}) from RustRelay ${RUSTRELAY_SOURCE.revision}.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
