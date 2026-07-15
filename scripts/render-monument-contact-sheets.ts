import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO, type Document, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { InstancedMesh } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "assets/media/models/monuments-lod/manifest.json");
const sourceDir = resolve(root, "assets/media/models/monuments");
const outputDir = resolve(root, "assets/media/models/monuments-lod/review");
const indexPath = resolve(outputDir, "review-index.json");
const checkOnly = process.argv.includes("--check");
const onlyAsset = process.argv.find((argument) => argument.startsWith("--only="))?.slice(7) || "";
const width = 1480;
const height = 1120;
const panelWidth = 350;
const panelHeight = 205;
const maxFaces = 1800;

type Bounds = { min: number[]; max: number[] };
type TierName = "map" | "mid" | "close";
type TierMetadata = { file: string; bytes: number; triangles: number; drawCalls: number; sourceNodes: string[] };
type ManifestEntry = {
  id: string;
  reviewStatus: string;
  layoutSource: string;
  sourceSha256: string;
  sourceTriangles: number;
  sourceDrawCalls: number;
  surfaceOnly: boolean;
  tiers: Record<TierName, TierMetadata>;
};
type Manifest = { version: number; recipeVersion: number; sourceRepository: { revision: string }; entries: ManifestEntry[] };
type Face = { points: [Vector3, Vector3, Vector3]; color: [number, number, number]; depth?: number };
type RenderModel = { faces: Face[]; bounds: Bounds };

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const nodeName = (node: Node): string => `${node.getName()} ${node.getMesh()?.getName() || ""}`.trim();

async function createIo(): Promise<NodeIO> {
  const decoder = await draco3d.createDecoderModule();
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": decoder,
    "meshopt.decoder": MeshoptDecoder,
  });
}

function mergeBounds(target: Bounds, source: Bounds): void {
  for (let axis = 0; axis < 3; axis++) {
    target.min[axis] = Math.min(target.min[axis]!, source.min[axis]!);
    target.max[axis] = Math.max(target.max[axis]!, source.max[axis]!);
  }
}

function nodeWorldMatrices(node: Node): Matrix4[] {
  const world = new Matrix4().fromArray(node.getWorldMatrix());
  const batch = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing");
  if (!batch) return [world];
  const translation = batch.getAttribute("TRANSLATION");
  const rotation = batch.getAttribute("ROTATION");
  const scale = batch.getAttribute("SCALE");
  const count = batch.listAttributes()[0]?.getCount() || 0;
  return Array.from({ length: count }, (_, index) => {
    const positionValue = translation?.getElement(index, []) || [0, 0, 0];
    const rotationValue = rotation?.getElement(index, []) || [0, 0, 0, 1];
    const scaleValue = scale?.getElement(index, []) || [1, 1, 1];
    return new Matrix4().compose(
      new Vector3(positionValue[0], positionValue[1], positionValue[2]),
      new Quaternion(rotationValue[0], rotationValue[1], rotationValue[2], rotationValue[3]),
      new Vector3(scaleValue[0], scaleValue[1], scaleValue[2]),
    ).premultiply(world);
  });
}

function nodeBounds(node: Node): Bounds {
  const primitiveBounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const primitive of node.getMesh()?.listPrimitives() || []) {
    const position = primitive.getAttribute("POSITION");
    if (!position) continue;
    const min = position.getMin([]), max = position.getMax([]);
    for (const matrix of nodeWorldMatrices(node)) for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const point = new Vector3(x, y, z).applyMatrix4(matrix);
      for (let axis = 0; axis < 3; axis++) {
        primitiveBounds.min[axis] = Math.min(primitiveBounds.min[axis]!, point.getComponent(axis));
        primitiveBounds.max[axis] = Math.max(primitiveBounds.max[axis]!, point.getComponent(axis));
      }
    }
  }
  return primitiveBounds;
}

function extractModel(document: Document, selectedNames?: Set<string>): RenderModel {
  let nodes = document.getRoot().listNodes().filter((node) => node.getMesh());
  if (selectedNames?.size) {
    const selected = nodes.filter((node) => selectedNames.has(nodeName(node)) || selectedNames.has(node.getMesh()?.getName() || "") || selectedNames.has(node.getName()));
    if (selected.length) nodes = selected;
  }
  const totalFaces = nodes.reduce((sum, node) => sum + (node.getMesh()?.listPrimitives().reduce((meshSum, primitive) => {
    if (primitive.getMode() !== 4) return meshSum;
    const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0;
    return meshSum + Math.floor(count / 3) * nodeWorldMatrices(node).length;
  }, 0) || 0), 0);
  const stride = Math.max(1, Math.ceil(totalFaces / maxFaces));
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const faces: Face[] = [];
  let faceIndex = 0;
  for (const node of nodes) {
    mergeBounds(bounds, nodeBounds(node));
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      if (primitive.getMode() !== 4) continue;
      const positions = primitive.getAttribute("POSITION")?.getArray();
      if (!positions) continue;
      const indices = primitive.getIndices()?.getArray();
      const count = indices?.length ?? Math.floor(positions.length / 3);
      const factor = primitive.getMaterial()?.getBaseColorFactor() || [0.5, 0.5, 0.5, 1];
      for (const matrix of nodeWorldMatrices(node)) for (let index = 0; index + 2 < count; index += 3, faceIndex++) {
          if (faceIndex % stride) continue;
          const points = [0, 1, 2].map((offset) => {
            const vertex = Number(indices ? indices[index + offset] : index + offset) * 3;
            return new Vector3(Number(positions[vertex]), Number(positions[vertex + 1]), Number(positions[vertex + 2])).applyMatrix4(matrix);
          }) as [Vector3, Vector3, Vector3];
          faces.push({ points, color: [factor[0]!, factor[1]!, factor[2]!] });
        }
    }
  }
  if (!Number.isFinite(bounds.min[0]!)) return { faces, bounds: { min: [-1, -1, -1], max: [1, 1, 1] } };
  return { faces, bounds };
}

function boundsCorners(bounds: Bounds): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [bounds.min[0]!, bounds.max[0]!]) for (const y of [bounds.min[1]!, bounds.max[1]!]) for (const z of [bounds.min[2]!, bounds.max[2]!]) corners.push(new Vector3(x, y, z));
  return corners;
}

function renderPanel(model: RenderModel, x: number, y: number, direction: Vector3, label: string): string {
  const view = direction.clone().normalize();
  const right = new Vector3(view.z, 0, -view.x).normalize();
  if (right.lengthSq() < 0.01) right.set(1, 0, 0);
  const up = new Vector3().crossVectors(view, right).normalize();
  const projectedBounds = boundsCorners(model.bounds).map((point) => [point.dot(right), point.dot(up)] as const);
  const minX = Math.min(...projectedBounds.map((point) => point[0]));
  const maxX = Math.max(...projectedBounds.map((point) => point[0]));
  const minY = Math.min(...projectedBounds.map((point) => point[1]));
  const maxY = Math.max(...projectedBounds.map((point) => point[1]));
  const scale = Math.min((panelWidth - 20) / Math.max(0.001, maxX - minX), (panelHeight - 34) / Math.max(0.001, maxY - minY));
  const light = new Vector3(-0.4, 1, 0.6).normalize();
  const polygons = model.faces.map((face) => {
    const normal = new Vector3().crossVectors(new Vector3().subVectors(face.points[1], face.points[0]), new Vector3().subVectors(face.points[2], face.points[0])).normalize();
    const shade = 0.5 + Math.max(0, normal.dot(light)) * 0.5;
    // Contact sheets are an approval artifact, not a beauty render. Keep even
    // very bright source materials well separated from the neutral panel so
    // thin railings, tracks, and roof edges remain legible at sheet scale.
    const color = face.color.map((channel) => Math.round(Math.min(0.55, 0.08 + Math.max(0, channel) * 0.42 * shade) * 255));
    return { ...face, depth: face.points.reduce((sum, point) => sum + point.dot(view), 0) / 3, fill: `rgb(${color.join(",")})` };
  }).sort((a, b) => a.depth - b.depth).map((face) => `<polygon points="${face.points.map((point) => `${x + 10 + (point.dot(right) - minX) * scale},${y + panelHeight - 10 - (point.dot(up) - minY) * scale}`).join(" ")}" fill="${face.fill}"/>`).join("");
  const clipId = `panel-${x}-${y}`;
  return `<g><defs><clipPath id="${clipId}"><rect x="${x + 1}" y="${y + 1}" width="${panelWidth - 2}" height="${panelHeight - 2}" rx="7"/></clipPath></defs><rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="8" fill="#d5d9d6" stroke="#5f6b63"/><g clip-path="url(#${clipId})">${polygons}</g><text x="${x + 10}" y="${y + 19}" font-size="13" font-weight="700" fill="#1f2923">${escapeXml(label)}</text></g>`;
}

function metricLine(label: string, tier: TierMetadata): string {
  return `${label}: ${(tier.bytes / 1024).toFixed(0)} KB | ${(tier.triangles / 1000).toFixed(1)}k triangles | ${tier.drawCalls} draws`;
}

async function renderEntry(io: NodeIO, manifest: Manifest, entry: ManifestEntry): Promise<string> {
  const source = await io.read(resolve(sourceDir, `${entry.id}.glb`));
  const models: RenderModel[] = [extractModel(source, new Set(entry.tiers.close.sourceNodes))];
  for (const tier of ["map", "mid", "close"] as TierName[]) models.push(extractModel(await io.read(resolve(root, "assets/media/models/monuments-lod", entry.tiers[tier].file))));
  const columns = ["Source structural selection", "Map", "Mid", "Close"];
  const views = [
    { label: "Top-down", direction: new Vector3(0.001, 1, 0) },
    { label: "Isometric A", direction: new Vector3(1, 0.72, 1) },
    { label: "Isometric B", direction: new Vector3(-1, 0.72, 1) },
    { label: "Low angle", direction: new Vector3(1, 0.24, 1) },
  ];
  let panels = "";
  for (let row = 0; row < views.length; row++) for (let column = 0; column < models.length; column++) {
    panels += renderPanel(models[column]!, 20 + column * 365, 105 + row * 220, views[row]!.direction, `${columns[column]} - ${views[row]!.label}`);
  }
  const metrics = [metricLine("Map", entry.tiers.map), metricLine("Mid", entry.tiers.mid), metricLine("Close", entry.tiers.close)];
  const exclusions = `Exclusions: interiors, furniture, loot, debris, lights, underground geometry${entry.surfaceOnly ? "" : ", oversized terrain and rocks"}.`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111814"/><text x="20" y="35" font-size="24" font-weight="700" fill="#f3f5ef">${escapeXml(entry.id)}</text><text x="20" y="61" font-size="14" fill="#b9c8bd">Recipe ${manifest.recipeVersion} | manifest ${manifest.version} | RustRelay ${escapeXml(manifest.sourceRepository.revision)} | ${escapeXml(entry.reviewStatus)}</text><text x="20" y="83" font-size="12" fill="#92a399">${escapeXml(entry.layoutSource)} | structural nodes ${entry.tiers.close.sourceNodes.length}</text>${panels}${metrics.map((line, index) => `<text x="20" y="${1005 + index * 22}" font-size="14" fill="#e1e7e1">${escapeXml(line)}</text>`).join("")}<text x="20" y="1080" font-size="13" fill="#b9c8bd">${escapeXml(exclusions)}</text><text x="20" y="1102" font-size="12" fill="#92a399">Source ${(entry.sourceTriangles / 1000).toFixed(1)}k triangles | ${entry.sourceDrawCalls} draws | ${entry.sourceSha256.slice(0, 16)}</text></svg>`;
  const output = resolve(outputDir, `${entry.id}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output);
  return sha256(output);
}

async function main(): Promise<void> {
  if (!existsSync(manifestPath)) throw new Error("Monument LOD manifest is missing. Run npm run monuments:lod first.");
  mkdirSync(outputDir, { recursive: true });
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const entries = onlyAsset ? manifest.entries.filter((entry) => entry.id === onlyAsset) : manifest.entries;
  if (!entries.length) throw new Error(`Unknown monument recipe: ${onlyAsset}`);
  if (checkOnly) {
    if (!existsSync(indexPath)) throw new Error("Contact-sheet review index is missing. Run npm run monuments:lod:review.");
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as { manifestSha256: string; sheets: Record<string, string> };
    if (index.manifestSha256 !== sha256(manifestPath)) throw new Error("Contact sheets are stale for the installed manifest.");
    for (const entry of entries) {
      const sheet = resolve(outputDir, `${entry.id}.png`);
      if (!existsSync(sheet) || index.sheets[entry.id] !== sha256(sheet)) throw new Error(`${entry.id}: contact sheet is missing or stale.`);
    }
    console.log(`Validated ${entries.length} monument contact sheets.`);
    return;
  }
  const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) as { sheets?: Record<string, string> } : {};
  const sheets = onlyAsset ? { ...(previous.sheets || {}) } : {};
  const io = await createIo();
  for (const entry of entries) sheets[entry.id] = await renderEntry(io, manifest, entry);
  if (!onlyAsset) {
    const expected = new Set(entries.map((entry) => `${entry.id}.png`));
    for (const file of readdirSync(outputDir).filter((name) => name.endsWith(".png") && !expected.has(name))) rmSync(resolve(outputDir, file));
  }
  writeFileSync(indexPath, `${JSON.stringify({ manifestSha256: sha256(manifestPath), generatedAt: new Date().toISOString(), sheets }, null, 2)}\n`);
  console.log(`Rendered ${entries.length} fixed-view monument contact sheets to ${outputDir}.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
