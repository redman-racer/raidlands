export type TerrainHeightGrid = {
  resolution: number;
  worldSize?: number;
  heights: number[];
};

/**
 * Samples the same triangles used to construct the viewer terrain mesh. The
 * terrain source is mirrored horizontally from Rust, so the source column is
 * reflected after locating the viewer-space grid cell.
 */
export function sampleTerrainSurfaceHeight(terrain: TerrainHeightGrid, x: number, z: number): number {
  const resolution = Math.max(2, Math.floor(Number(terrain.resolution) || 0));
  const worldSize = Math.max(1, Number(terrain.worldSize) || 4500);
  const half = worldSize / 2;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const u = clamp((x + half) / worldSize) * (resolution - 1);
  const v = clamp((half - z) / worldSize) * (resolution - 1);
  const col = Math.floor(u);
  const row = Math.floor(v);
  const nextCol = Math.min(resolution - 1, col + 1);
  const nextRow = Math.min(resolution - 1, row + 1);
  const localX = u - col;
  const localZ = v - row;
  const heightAt = (sourceRow: number, viewerColumn: number): number => {
    const sourceColumn = resolution - 1 - viewerColumn;
    const value = Number(terrain.heights[sourceRow * resolution + sourceColumn]);
    return Number.isFinite(value) ? value : 0;
  };

  const topLeft = heightAt(row, col);
  const topRight = heightAt(row, nextCol);
  const bottomLeft = heightAt(nextRow, col);
  const bottomRight = heightAt(nextRow, nextCol);

  // TerrainViewer creates each grid cell with triangles topLeft/topRight/
  // bottomLeft and topRight/bottomRight/bottomLeft. Sampling that same split
  // prevents overlays from cutting through a sloped terrain face.
  if (localX + localZ <= 1) {
    return topLeft * (1 - localX - localZ) + topRight * localX + bottomLeft * localZ;
  }

  return topRight * (1 - localZ) + bottomRight * (localX + localZ - 1) + bottomLeft * (1 - localX);
}
