import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { Matrix4, Vector3 } from "three";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: npm run monuments:lod:preview -- <input.glb> <output.png>");
const topDown = process.argv[4] === "top";

const decoder = await draco3d.createDecoderModule();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": decoder, "meshopt.decoder": MeshoptDecoder });
const document = await io.read(input);
const width = 1000, height = 700;
const direction = topDown ? new Vector3(0, 1, 0) : new Vector3(1, 0.7, 1).normalize();
const right = topDown ? new Vector3(1, 0, 0) : new Vector3(1, 0, -1).normalize();
const up = topDown ? new Vector3(0, 0, -1) : new Vector3().crossVectors(direction, right).normalize();
const light = new Vector3(-0.4, 1, 0.6).normalize();
type Face = { points: Vector3[]; depth: number; color: string };
const faces: Face[] = [];

for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const matrix = new Matrix4().fromArray(node.getWorldMatrix());
  for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute("POSITION")?.getArray();
    const indices = primitive.getIndices()?.getArray();
    if (!positions || !indices) continue;
    const factor = primitive.getMaterial()?.getBaseColorFactor() || [0.5, 0.5, 0.5, 1];
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const points = [0, 1, 2].map((offset) => {
        const vertex = Number(indices[index + offset]) * 3;
        return new Vector3(Number(positions[vertex]), Number(positions[vertex + 1]), Number(positions[vertex + 2])).applyMatrix4(matrix);
      });
      const normal = new Vector3().crossVectors(new Vector3().subVectors(points[1]!, points[0]!), new Vector3().subVectors(points[2]!, points[0]!)).normalize();
      const shade = 0.5 + Math.max(0, normal.dot(light)) * 0.5;
      const color = `rgb(${[0, 1, 2].map((channel) => Math.round(Math.min(1, factor[channel]! * shade) * 255)).join(",")})`;
      faces.push({ points, depth: points.reduce((sum, point) => sum + point.dot(direction), 0) / 3, color });
    }
  }
}

const projected = faces.flatMap((face) => face.points.map((point) => [point.dot(right), point.dot(up)]));
let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
for (const point of projected) {
  minX = Math.min(minX, point[0]!); maxX = Math.max(maxX, point[0]!);
  minY = Math.min(minY, point[1]!); maxY = Math.max(maxY, point[1]!);
}
const scale = Math.min((width - 60) / (maxX - minX), (height - 60) / (maxY - minY));
const polygons = faces.sort((a, b) => a.depth - b.depth).map((face) => `<polygon points="${face.points.map((point) => `${30 + (point.dot(right) - minX) * scale},${height - 30 - (point.dot(up) - minY) * scale}`).join(" ")}" fill="${face.color}"/>`).join("");
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d7dde0"/>${polygons}</svg>`)).png().toFile(output);
