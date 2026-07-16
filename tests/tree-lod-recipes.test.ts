import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TREE_LOD_RECIPES, TREE_LOD_RECIPE_VERSION, TREE_LOD_SOURCE } from "../scripts/tree-lod-recipes";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "assets/media/models/trees-lod/manifest.json"), "utf8"));

describe("RustRelay tree LOD recipes", () => {
  it("covers every supported biome with multiple full-size families", () => {
    const expected = ["temperate", "tundra", "arctic", "arid", "tropical", "jungle", "swamp"];
    for (const biome of expected) {
      expect(TREE_LOD_RECIPES.filter((recipe) => recipe.biome === biome).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps generated assets bound to the recipe and RustRelay revision", () => {
    expect(manifest.recipeVersion).toBe(TREE_LOD_RECIPE_VERSION);
    expect(manifest.sourceRepository.revision).toBe(TREE_LOD_SOURCE.revision);
    expect(manifest.entries.map((entry: { id: string }) => entry.id)).toEqual(TREE_LOD_RECIPES.map((recipe) => recipe.id));
    for (const entry of manifest.entries) {
      for (const tier of ["map", "mid", "close"]) {
        expect(entry.tiers[tier].sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(entry.tiers[tier].bytes).toBeGreaterThan(0);
        expect(entry.tiers[tier].triangles).toBeGreaterThan(0);
      }
    }
  });
});
