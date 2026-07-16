export type VegetationKind = "pine" | "broadleaf" | "jungle";

export type VegetationPlacement = {
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: VegetationKind;
  variation: number;
};

export type TerrainVegetationInput = {
  resolution: number;
  worldSize: number;
  seed?: number;
  waterLevel: number;
  minHeight?: number;
  maxHeight?: number;
  heights: number[];
  colors?: string[];
  monuments?: Array<{ x: number; z: number; radius?: number }>;
};

export type VegetationQuality = "ultra" | "high" | "medium" | "low";

const INSTANCE_BUDGETS: Record<VegetationQuality, number> = {
  ultra: 1450,
  high: 920,
  medium: 540,
  low: 240,
};

export function vegetationInstanceBudget(quality: VegetationQuality): number {
  return INSTANCE_BUDGETS[quality];
}

// The terrain export does not contain Rust resource/tree entity positions. This
// policy produces a stable visual canopy from the exported seed, surface colour,
// elevation, and monument footprints instead of pretending the placements are
// live entity data.
export function buildTerrainVegetation(
  terrain: TerrainVegetationInput,
  budget: number,
): VegetationPlacement[] {
  const resolution = Math.max(2, Math.floor(terrain.resolution));
  const worldSize = Math.max(100, Number(terrain.worldSize) || 4500);
  const expected = resolution * resolution;
  if (terrain.heights.length !== expected || budget <= 0) return [];

  const waterLevel = Number.isFinite(terrain.waterLevel) ? terrain.waterLevel : 0;
  const minHeight = finite(terrain.minHeight, Math.min(...terrain.heights));
  const maxHeight = finite(terrain.maxHeight, Math.max(...terrain.heights));
  const heightRange = Math.max(1, maxHeight - minHeight);
  const seed = Math.abs(Math.floor(Number(terrain.seed) || 0)) || 1;
  const inset = Math.min(Math.max(worldSize * 0.022, 42), worldSize * 0.12);
  const span = Math.max(1, worldSize - inset * 2);
  const sampleSpacing = Math.max(worldSize / Math.max(1, resolution - 1), 12);
  const placements: VegetationPlacement[] = [];
  const candidateLimit = Math.max(budget * 12, 720);

  for (let candidate = 0; candidate < candidateLimit && placements.length < budget; candidate += 1) {
    const key = seed + candidate * 7919;
    const x = (hashUnit(key + 11) - 0.5) * span;
    const z = (hashUnit(key + 23) - 0.5) * span;
    const sample = terrainSample(terrain, resolution, worldSize, x, z);
    const height = sample.height;

    if (height <= waterLevel + 2.4 || tooCloseToMonument(terrain.monuments, x, z)) continue;

    const slope = terrainSlope(terrain, resolution, worldSize, x, z, sampleSpacing);
    if (slope > 0.72) continue;

    const elevation = clamp((height - minHeight) / heightRange, 0, 1);
    const colorFertility = foliageFertility(sample.color);
    if (colorFertility <= 0) continue;

    const tropical = smoothValueNoise(x, z, worldSize * 0.2, seed + 67);
    const slopeFertility = 1 - clamp((slope - 0.12) / 0.6, 0, 1) * 0.68;
    const highlandFertility = 1 - clamp((elevation - 0.56) / 0.44, 0, 1) * 0.72;
    const fertility = clamp(colorFertility * slopeFertility * highlandFertility, 0, 1);
    const density = clamp(0.26 + fertility * 0.56 + tropical * 0.18, 0, 0.94);
    if (hashUnit(key + 37) > density) continue;

    const jungle = tropical > 0.58 && elevation < 0.62 && hashUnit(key + 41) < 0.72;
    const pine = !jungle && (elevation > 0.54 || slope > 0.3 || hashUnit(key + 43) < 0.34);
    const scaleBase = jungle ? 1.2 : pine ? 0.92 : 1;
    const scale = scaleBase * (0.72 + hashUnit(key + 53) * 0.78);
    placements.push({
      x,
      y: height,
      z,
      scale,
      kind: jungle ? "jungle" : pine ? "pine" : "broadleaf",
      variation: hashUnit(key + 61),
    });
  }

  return placements;
}

function terrainSample(
  terrain: TerrainVegetationInput,
  resolution: number,
  worldSize: number,
  x: number,
  z: number,
): { height: number; color: string | undefined } {
  const half = worldSize / 2;
  const u = clamp((x + half) / worldSize, 0, 1);
  const v = clamp((half - z) / worldSize, 0, 1);
  const col = resolution - 1 - Math.round(u * (resolution - 1));
  const row = Math.round(v * (resolution - 1));
  const index = row * resolution + col;
  return { height: finite(terrain.heights[index], 0), color: terrain.colors?.[index] };
}

function terrainSlope(
  terrain: TerrainVegetationInput,
  resolution: number,
  worldSize: number,
  x: number,
  z: number,
  spacing: number,
): number {
  const center = terrainSample(terrain, resolution, worldSize, x, z).height;
  const neighboringHeights = [
    terrainSample(terrain, resolution, worldSize, x + spacing, z).height,
    terrainSample(terrain, resolution, worldSize, x - spacing, z).height,
    terrainSample(terrain, resolution, worldSize, x, z + spacing).height,
    terrainSample(terrain, resolution, worldSize, x, z - spacing).height,
  ];
  return Math.max(...neighboringHeights.map((height) => Math.abs(height - center))) / Math.max(1, spacing);
}

function foliageFertility(color: string | undefined): number {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return 0.66;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  if (blue > green * 0.94 && blue > red * 1.12) return 0;
  return clamp((green - Math.max(red, blue) + 26) / 66, 0.18, 1);
}

function tooCloseToMonument(monuments: TerrainVegetationInput["monuments"], x: number, z: number): boolean {
  return (monuments || []).some((monument) => {
    const clearance = Math.max(58, (Number(monument.radius) || 30) * 1.5);
    return Math.hypot(x - monument.x, z - monument.z) < clearance;
  });
}

function smoothValueNoise(x: number, z: number, cellSize: number, seed: number): number {
  const scaledX = x / Math.max(1, cellSize);
  const scaledZ = z / Math.max(1, cellSize);
  const baseX = Math.floor(scaledX);
  const baseZ = Math.floor(scaledZ);
  const localX = smoothstep(scaledX - baseX);
  const localZ = smoothstep(scaledZ - baseZ);
  const lower = mix(cellHash(baseX, baseZ, seed), cellHash(baseX + 1, baseZ, seed), localX);
  const upper = mix(cellHash(baseX, baseZ + 1, seed), cellHash(baseX + 1, baseZ + 1, seed), localX);
  return mix(lower, upper, localZ);
}

function cellHash(x: number, z: number, seed: number): number {
  return hashUnit(seed + x * 374761393 + z * 668265263);
}

function hashUnit(value: number): number {
  const hashed = Math.sin(value * 12.9898) * 43758.5453123;
  return hashed - Math.floor(hashed);
}

function finite(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
