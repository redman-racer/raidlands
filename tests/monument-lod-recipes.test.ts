import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MONUMENT_LOD_RECIPES, RUSTRELAY_SOURCE, monumentRecipe } from "../scripts/monument-lod-recipes";

describe("RustRelay monument LOD recipes", () => {
  it("pins all 78 registered recipes to the audited RustRelay revision", () => {
    expect(RUSTRELAY_SOURCE.revision).toBe("494242b");
    expect(MONUMENT_LOD_RECIPES).toHaveLength(78);
    expect(new Set(MONUMENT_LOD_RECIPES.map((recipe) => recipe.id)).size).toBe(78);
    expect(new Set(MONUMENT_LOD_RECIPES.map((recipe) => recipe.layoutSource)).size).toBe(78);
  });

  it("defines the exterior roles, exclusions, source, and review state for every recipe", () => {
    for (const recipe of MONUMENT_LOD_RECIPES) {
      expect(recipe.layoutSource).toMatch(/\.glb$/);
      expect([2, 3, 4]).toContain(recipe.deliveryWave);
      expect(recipe.structuralRoles).toEqual(["shell", "roof", "platform", "stairs", "perimeter", "landmark-prop", "ground-pad"]);
      expect(Object.values(recipe.exclusions).every(Boolean)).toBe(true);
      expect(["candidate", "approved", "rejected"]).toContain(recipe.reviewStatus);
    }
  });

  it("resolves every layout and standalone override unambiguously in the 9,098-file catalog", () => {
    const catalog = JSON.parse(readFileSync(resolve("data/rustrelay-asset-catalog.json"), "utf8")) as {
      revision: string;
      assetCount: number;
      assets: Array<{ path: string }>;
    };
    const paths = new Set(catalog.assets.map((asset) => asset.path.toLowerCase()));
    expect(catalog.revision).toBe(RUSTRELAY_SOURCE.revision);
    expect(catalog.assetCount).toBe(9_098);
    for (const recipe of MONUMENT_LOD_RECIPES) {
      expect(paths.has(recipe.layoutSource.toLowerCase()), recipe.layoutSource).toBe(true);
      for (const override of recipe.composites || []) expect(paths.has(override.rustRelayPath.toLowerCase()), override.rustRelayPath).toBe(true);
    }
  });

  it("moves the complete Abandoned Military Base assembly into its recipe", () => {
    for (const variant of ["a", "b", "c", "d"]) {
      const recipe = monumentRecipe(`desert_military_base_${variant}`);
      expect(recipe.composites?.map((component) => component.id)).toEqual([
        "hangar", "field-tent", "shipping-container", "sandbags", "generator", "fuel-tank", "mlrs",
      ]);
      expect(recipe.composites?.every((component) => component.placements.length > 0)).toBe(true);
    }
  });

  it("protects existing baselines and uses named selections for the first repair wave", () => {
    for (const id of ["apartments_complex_1", "launch_site_1", "compound", "powerplant_1", "harbor_1", "radtown_1"]) {
      const recipe = monumentRecipe(id);
      expect(recipe.preferAuthoredMap || (recipe.explicitMapIncludes?.length || 0) > 0, id).toBe(true);
    }
    for (const id of ["airfield_1", "trainyard_1", "bandit_town", "oilrig_1", "oilrig_2", "water_treatment_plant_1", "harbor_2", "junkyard_1", "excavator_1"]) {
      const recipe = monumentRecipe(id);
      expect((recipe.explicitMapIncludes?.length || 0) + (recipe.explicitStructuralIncludes?.length || 0), id).toBeGreaterThan(0);
    }
  });

  it("groups the conversion backlog into the approved delivery waves", () => {
    expect(monumentRecipe("airfield_1").deliveryWave).toBe(2);
    expect(monumentRecipe("gas_station_1").deliveryWave).toBe(3);
    expect(monumentRecipe("power_sub_big_1").deliveryWave).toBe(4);
    expect(monumentRecipe("underwater_lab_d").deliveryWave).toBe(4);
  });

  it("replaces incomplete Underwater Lab interior layouts with dedicated exterior modules", () => {
    for (const variant of ["a", "b", "c", "d"]) {
      const recipe = monumentRecipe(`underwater_lab_${variant}`);
      expect(recipe.standaloneOnly).toBe(true);
      expect(recipe.composites).toHaveLength(1);
      expect(recipe.composites?.[0]?.rustRelayPath).toMatch(/^Content\/structures\/underwater_labs\/module_/);
      expect(recipe.composites?.[0]?.minimumTier).toBe("map");
    }
  });

  it("keeps Ice Lake tiers on the lake mesh without oversized cliffs or rock formations", () => {
    for (const [variant, suffix] of [["1", "a"], ["2", "b"], ["3", "c"], ["4", "d"]]) {
      const recipe = monumentRecipe(`ice_lake_${variant}`);
      expect(recipe.explicitStructuralIncludes).toContain(`ice_lake_${suffix}`);
      expect(recipe.explicitExcludes).toEqual(expect.arrayContaining(["cliff", "rock_formation"]));
    }
  });
});
