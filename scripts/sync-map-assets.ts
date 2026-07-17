import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type MapImageMetadata = {
  serverId?: string;
  relativePath?: string;
  publicUrl?: string;
  url?: string;
  hash?: string;
  extension?: string;
  terrainRelativePath?: string;
  terrainPublicUrl?: string;
  terrainUrl?: string;
  terrainHash?: string;
  terrainResolution?: number;
  skyboxRelativePath?: string;
  skyboxPublicUrl?: string;
  skyboxUrl?: string;
  skyboxHash?: string;
  textureUrl?: string;
  seed?: number;
  resolution?: number;
  worldSize?: number;
  wipeKey?: string;
  generatedAt?: string;
};

type StatusPayload = { mapImage?: MapImageMetadata | null };
type AssetPlan = { name: string; sourceUrl: string; relativePath: string; expectedHash: string };

const workspace = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const representative = args.includes("--representative");
const statusArgument = args.find((arg) => arg.startsWith("--status-url="))?.slice("--status-url=".length);
const statusUrl = statusArgument || process.env.MAP_SYNC_STATUS_URL || "http://localhost/raidlands/api/server-status.php";

function sha256(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/media/maps/") || normalized.includes("../")) {
    throw new Error(`Refusing to write map asset outside assets/media/maps: ${relativePath}`);
  }
  return normalized;
}

function textureSource(metadata: MapImageMetadata): string {
  const configured = String(metadata.textureUrl || "");
  const image = String(metadata.publicUrl || metadata.url || "");
  if (!image) return configured;
  try {
    const configuredUrl = configured ? new URL(configured) : null;
    const imageUrl = new URL(image);
    if (!configuredUrl || ["localhost", "127.0.0.1", "::1"].includes(configuredUrl.hostname)) {
      imageUrl.pathname = imageUrl.pathname.replace(/\/current\.[a-z0-9]+$/i, `/current-texture.${metadata.extension || "jpg"}`);
      return imageUrl.href;
    }
  } catch {
    // Keep the configured URL when metadata contains a relative source.
  }
  return configured;
}

function textureRelativePath(metadata: MapImageMetadata): string {
  const imagePath = safeRelativePath(String(metadata.relativePath || ""));
  return imagePath.replace(/\/current\.[a-z0-9]+$/i, `/current-texture.${metadata.extension || "jpg"}`);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "*/*" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function writeAtomic(relativePath: string, bytes: Uint8Array): Promise<void> {
  const destination = path.resolve(workspace, safeRelativePath(relativePath));
  const mapRoot = path.resolve(workspace, "assets/media/maps");
  if (!destination.startsWith(`${mapRoot}${path.sep}`)) throw new Error(`Unsafe destination ${destination}`);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.map-sync-${process.pid}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
}

async function main(): Promise<void> {
  const statusResponse = await fetch(`${statusUrl}${statusUrl.includes("?") ? "&" : "?"}mapSync=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!statusResponse.ok) throw new Error(`Status endpoint returned HTTP ${statusResponse.status}`);
  const status = await statusResponse.json() as StatusPayload;
  const metadata = status.mapImage;
  if (!metadata?.serverId || !metadata.relativePath || !metadata.terrainRelativePath) {
    throw new Error("The status endpoint did not return complete map image metadata.");
  }

  const plans: AssetPlan[] = [
    {
      name: "map",
      sourceUrl: String(metadata.publicUrl || metadata.url || ""),
      relativePath: safeRelativePath(metadata.relativePath),
      expectedHash: String(metadata.hash || "").toLowerCase(),
    },
    {
      name: "terrain",
      sourceUrl: String(metadata.terrainPublicUrl || metadata.terrainUrl || ""),
      relativePath: safeRelativePath(metadata.terrainRelativePath),
      expectedHash: String(metadata.terrainHash || "").toLowerCase(),
    },
  ];
  const textureUrl = textureSource(metadata);
  if (textureUrl) plans.push({
    name: "texture",
    sourceUrl: textureUrl,
    relativePath: textureRelativePath(metadata),
    expectedHash: "",
  });
  if (metadata.skyboxRelativePath && (metadata.skyboxPublicUrl || metadata.skyboxUrl)) plans.push({
    name: "skybox",
    sourceUrl: String(metadata.skyboxPublicUrl || metadata.skyboxUrl),
    relativePath: safeRelativePath(metadata.skyboxRelativePath),
    expectedHash: String(metadata.skyboxHash || "").toLowerCase(),
  });

  for (const plan of plans) {
    if (!plan.sourceUrl) throw new Error(`No source URL was provided for ${plan.name}.`);
  }
  const downloaded = await Promise.all(plans.map(async (plan) => {
    const bytes = await fetchBytes(plan.sourceUrl);
    const actualHash = sha256(bytes);
    return { ...plan, bytes, actualHash, hashMatches: !plan.expectedHash || actualHash === plan.expectedHash };
  }));

  const terrainDownload = downloaded.find((asset) => asset.name === "terrain");
  if (!terrainDownload) throw new Error("Terrain asset was not downloaded.");
  const terrain = JSON.parse(new TextDecoder().decode(terrainDownload.bytes)) as Record<string, unknown>;
  const metadataChecks = {
    seed: Number(terrain.seed) === Number(metadata.seed),
    resolution: Number(terrain.resolution) === Number(metadata.terrainResolution || metadata.resolution),
    worldSize: Number(terrain.worldSize) === Number(metadata.worldSize),
  };
  const hashMismatches = downloaded.filter((asset) => !asset.hashMatches);
  const metadataMismatches = Object.entries(metadataChecks).filter(([, matches]) => !matches).map(([key]) => key);
  if (!representative && (hashMismatches.length > 0 || metadataMismatches.length > 0)) {
    const details = [
      ...hashMismatches.map((asset) => `${asset.name} hash ${asset.actualHash} != ${asset.expectedHash}`),
      ...metadataMismatches.map((key) => `terrain ${key} does not match database metadata`),
    ];
    throw new Error(`Historical map assets are no longer available at their mutable URLs:\n- ${details.join("\n- ")}\nRe-run with --representative for explicitly labeled performance-only assets.`);
  }

  await Promise.all(downloaded.map((asset) => writeAtomic(asset.relativePath, asset.bytes)));
  const serverDirectory = path.dirname(path.resolve(workspace, safeRelativePath(metadata.terrainRelativePath)));
  const manifest = {
    version: 1,
    mode: representative ? "representative" : "verified",
    serverId: metadata.serverId,
    wipeKey: metadata.wipeKey || "",
    syncedAt: new Date().toISOString(),
    statusUrl,
    expected: {
      terrainHash: metadata.terrainHash || "",
      imageHash: metadata.hash || "",
      skyboxHash: metadata.skyboxHash || "",
      seed: Number(metadata.seed || 0),
      resolution: Number(metadata.terrainResolution || metadata.resolution || 0),
      worldSize: Number(metadata.worldSize || 0),
    },
    actual: {
      seed: Number(terrain.seed || 0),
      resolution: Number(terrain.resolution || 0),
      worldSize: Number(terrain.worldSize || 0),
      assets: Object.fromEntries(downloaded.map((asset) => [asset.name, {
        path: asset.relativePath,
        bytes: asset.bytes.byteLength,
        sha256: asset.actualHash,
        matchesMetadata: asset.hashMatches,
      }])),
    },
    metadataChecks,
    performanceOnly: representative,
  };
  await writeFile(path.join(serverDirectory, "map-sync.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const label = representative ? "representative performance assets" : "verified historical assets";
  process.stdout.write(`Synchronized ${downloaded.length} ${label} for ${metadata.serverId}.\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
