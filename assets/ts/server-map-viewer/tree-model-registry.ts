import manifestJson from "../../media/models/trees-lod/manifest.json";

export type TreeModelTier = "map" | "mid" | "close";
export type TreeBiome = "temperate" | "tundra" | "arctic" | "arid" | "tropical" | "jungle" | "swamp";

export type TreeTierMetadata = {
  file: string;
  url: string;
  bytes: number;
  sha256: string;
  triangles: number;
  drawCalls: number;
  bounds: { min: number[]; max: number[] };
};

export type TreeModelEntry = {
  id: string;
  biome: TreeBiome;
  source: string;
  sourceSha256: string;
  sourceBytes: number;
  weight: number;
  nominalHeight: number;
  tags?: Array<"palm" | "dead" | "snow">;
  tiers: Record<TreeModelTier, TreeTierMetadata>;
};

type TreeManifest = {
  version: number;
  recipeVersion: number;
  sourceRepository: { repository: string; revision: string; defaultSibling: string };
  thresholds: { mapToMidDistance: number; midToCloseDistance: number; hysteresis: number };
  entries: TreeModelEntry[];
};

const manifest = manifestJson as TreeManifest;
const byBiome = new Map<TreeBiome, TreeModelEntry[]>();
for (const entry of manifest.entries) byBiome.set(entry.biome, [...(byBiome.get(entry.biome) || []), entry]);

export function treeModelForVariation(biome: TreeBiome, variation: number): TreeModelEntry {
  const entries = byBiome.get(biome) || byBiome.get("temperate")!;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, variation)) * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1]!;
}

export function treeManifestVersion(): number { return manifest.version; }
export function treeRecipeVersion(): number { return manifest.recipeVersion; }
export function treeSourceRevision(): string { return manifest.sourceRepository.revision; }
export function treeLodThresholds(): TreeManifest["thresholds"] { return manifest.thresholds; }
export function treeModelEntries(): TreeModelEntry[] { return manifest.entries; }
