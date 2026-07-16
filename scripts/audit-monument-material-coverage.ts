import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

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

function primitiveTriangles(indices: number | undefined, positions: number | undefined): number {
  return Math.floor((indices || positions || 0) / 3);
}

const files = process.argv.slice(2);
if (!files.length) throw new Error("Pass one or more monument GLB paths.");

const io = await createIo();
for (const file of files) {
  const document = await io.read(file);
  let totalTriangles = 0;
  let baseColorTexturedTriangles = 0;
  const untextured = new Map<string, number>();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) continue;
      const triangles = primitiveTriangles(
        primitive.getIndices()?.getCount(),
        primitive.getAttribute("POSITION")?.getCount(),
      );
      totalTriangles += triangles;
      const material = primitive.getMaterial();
      if (material?.getBaseColorTexture()) {
        baseColorTexturedTriangles += triangles;
      } else {
        const name = material?.getName() || "unassigned-material";
        untextured.set(name, (untextured.get(name) || 0) + triangles);
      }
    }
  }
  const coverage = totalTriangles > 0 ? baseColorTexturedTriangles / totalTriangles : 0;
  console.log(JSON.stringify({
    file,
    totalTriangles,
    baseColorTexturedTriangles,
    baseColorTextureCoverage: Number(coverage.toFixed(4)),
    largestUntexturedMaterials: [...untextured.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([material, triangles]) => ({ material, triangles })),
  }));
}
