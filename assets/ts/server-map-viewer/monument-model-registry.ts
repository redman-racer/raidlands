import manifestJson from "../../media/models/monuments-lod/manifest.json";

export type MonumentModelTier = "map" | "mid" | "close";
export type MonumentMaterialMode = "palette" | "textured";

export type MonumentModelTierMetadata = {
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  triangles: number;
  drawCalls: number;
  instanceBatches: number;
  instances: number;
  textureBytes: number;
  textureSize: number;
  baseColorTexturedTriangles: number;
  baseColorTextureCoverage: number;
  materialMode: MonumentMaterialMode;
  selectionKind: "authored-hlod" | "recipe-structural" | "surface-structural" | "largest-structural" | "standalone-override";
  sourceNodes: string[];
  roleNodes: Record<string, string[]>;
  roleCounts: Record<string, number>;
  componentResolutions: Array<{ sourceNode: string; resolution: "standalone-catalog" | "embedded-layout"; catalogPath: string | null }>;
  compositeSources: string[];
  bounds: { min: number[]; max: number[] };
  structuralBounds: { min: number[]; max: number[] };
  maxBytes: number;
  maxTriangles: number;
  maxDrawCalls: number;
  footprintCoverage: number;
  normalizedCenterOffset: number;
  normalizedElevationOffset: number;
};

export type MonumentModelManifestEntry = {
  id: string;
  reviewStatus: "candidate" | "approved" | "rejected";
  review: { sourceSha256: string; reviewedAt: string } | null;
  layoutSource: string;
  sizeClass: "tiny" | "small" | "medium" | "large" | "xlarge";
  deliveryWave: 2 | 3 | 4;
  surfaceOnly: boolean;
  structuralRoles: string[];
  sourceSha256: string;
  sourceMatchesRustRelay: boolean;
  sourceBytes: number;
  sourceTriangles: number;
  sourceDrawCalls: number;
  sourceBounds: { min: number[]; max: number[] };
  legacy: { map: string; detail: string };
  exclusions: { policy: Record<string, boolean>; hard: string; natural: string | null; looseProps: string };
  standaloneOverrides: Array<{ id: string; sourcePath: string; sourceSha256: string; minimumTier: MonumentModelTier; placements: Array<{ x: number; y: number; z: number; rotationY: number; scale?: number }> }>;
  tiers: Record<MonumentModelTier, MonumentModelTierMetadata>;
};

type MonumentModelManifest = {
  version: number;
  recipeVersion: number;
  sourceRepository: { repository: string; revision: string; defaultSibling: string };
  thresholds: { mapToMidPixels: number; midToClosePixels: number; hysteresis: number };
  targets: Record<MonumentModelTier, { maxBytes: number; maxTriangles: number; maxDrawCalls: number }>;
  entries: MonumentModelManifestEntry[];
};

const manifest = manifestJson as MonumentModelManifest;
const manifestById = new Map(manifest.entries.map((entry) => [entry.id, entry]));
const registeredIds = new Set(manifest.entries.map((entry) => entry.id));

export function monumentPrefabId(prefab: string): string {
  const normalized = prefab.trim().replace(/\\/g, "/").split("/").pop() || "";
  return normalized.replace(/\.prefab$/i, "").replace(/\.glb$/i, "").toLowerCase();
}

export function monumentModelAssetName(prefab: string): string | null {
  const id = monumentPrefabId(prefab);
  return registeredIds.has(id) ? `${id}.glb` : null;
}

export function monumentModelMetadata(prefab: string): MonumentModelManifestEntry | null {
  return manifestById.get(monumentPrefabId(prefab)) || null;
}

export function monumentModelTierMetadata(prefab: string, tier: MonumentModelTier): MonumentModelTierMetadata | null {
  return monumentModelMetadata(prefab)?.tiers[tier] || null;
}

export function monumentModelManifestVersion(): number {
  return manifest.version;
}

export function monumentModelRecipeVersion(): number {
  return manifest.recipeVersion;
}

export function monumentModelSourceRevision(): string {
  return manifest.sourceRepository.revision;
}

export function monumentModelThresholds(): MonumentModelManifest["thresholds"] {
  return manifest.thresholds;
}

export function monumentModelBudgetBytes(tier: MonumentModelTier = "map"): number {
  return manifest.targets[tier].maxBytes;
}

export function monumentModelCount(): number {
  return registeredIds.size;
}

export function monumentModelAssetNames(): string[] {
  return Array.from(registeredIds, (id) => `${id}.glb`).sort();
}

export function monumentModelTierAssetNames(): string[] {
  return manifest.entries.flatMap((entry) => (["map", "mid", "close"] as MonumentModelTier[]).map((tier) => entry.tiers[tier].file)).sort();
}
