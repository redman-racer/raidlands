import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = new URL("../assets/media/models/leaderboard/", import.meta.url);
const wearableFiles = new Set([
  "arctic-hazmat.glb", "body-feet.glb", "body-hands.glb", "body-head.glb", "body-legs.glb",
  "body-torso.glb", "boots.glb", "hazmat.glb", "heavy-scientist.glb", "hoodie.glb",
  "metal-chestplate.glb", "metal-facemask.glb", "ninja-suit.glb", "pants.glb",
  "roadsign-kilt.glb", "tactical-gloves.glb",
]);
const files = (await readdir(directory)).filter((file) => wearableFiles.has(file));

for (const file of files) {
  const path = join(directory.pathname.replace(/^\/(.:)/, "$1"), file);
  const source = await readFile(path);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8").trim());
  const binHeader = 20 + jsonLength;
  if (source.readUInt32LE(binHeader + 4) !== 0x004e4942) continue;
  let binary = Buffer.from(source.subarray(binHeader + 8, binHeader + 8 + source.readUInt32LE(binHeader)));
  let changed = false;

  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const attributes = primitive.attributes || {};
      if (attributes.JOINTS_0 === undefined || attributes.WEIGHTS_0 !== undefined) continue;
      const count = json.accessors[attributes.POSITION].count;
      const offset = binary.length;
      const weights = Buffer.alloc(count * 16);
      for (let vertex = 0; vertex < count; vertex += 1) weights.writeFloatLE(1, vertex * 16);
      binary = Buffer.concat([binary, weights]);
      json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: weights.length });
      json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: 5126, count, type: "VEC4" });
      attributes.WEIGHTS_0 = json.accessors.length - 1;
      changed = true;
    }
  }

  if (!changed) continue;
  json.buffers[0].byteLength = binary.length;
  let jsonChunk = Buffer.from(JSON.stringify(json));
  jsonChunk = Buffer.concat([jsonChunk, Buffer.alloc((4 - jsonChunk.length % 4) % 4, 0x20)]);
  binary = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(output, 20);
  const nextHeader = 20 + jsonChunk.length;
  output.writeUInt32LE(binary.length, nextHeader); output.writeUInt32LE(0x004e4942, nextHeader + 4); binary.copy(output, nextHeader + 8);
  await writeFile(path, output);
  console.log(`Added static fallback weights: ${file}`);
}
