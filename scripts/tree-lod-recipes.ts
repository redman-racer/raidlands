import { RUSTRELAY_SOURCE } from "./monument-lod-recipes";

export type TreeBiome = "temperate" | "tundra" | "arctic" | "arid" | "tropical" | "jungle" | "swamp";
export type TreeLodTier = "map" | "mid" | "close";

export type TreeLodRecipe = {
  id: string;
  biome: TreeBiome;
  source: string;
  weight: number;
  nominalHeight: number;
  tags?: Array<"palm" | "dead" | "snow">;
};

const RESOURCE = "bundled/prefabs/autospawn/resource";

export const TREE_LOD_SOURCE = RUSTRELAY_SOURCE;
export const TREE_LOD_RECIPE_VERSION = 1;

export const TREE_LOD_RECIPES: TreeLodRecipe[] = [
  { id: "temperate-pine-a", biome: "temperate", source: `${RESOURCE}/v3_temp_forest_pine/pine_a.glb`, weight: 1.1, nominalHeight: 48 },
  { id: "temperate-beech-a", biome: "temperate", source: `${RESOURCE}/v3_temp_forest/american_beech_a.glb`, weight: 1, nominalHeight: 28 },
  { id: "temperate-birch-big", biome: "temperate", source: `${RESOURCE}/v3_temp_forest/birch_big_temp.glb`, weight: 0.75, nominalHeight: 27 },
  { id: "tundra-fir-a", biome: "tundra", source: `${RESOURCE}/v3_tundra_forest/douglas_fir_a.glb`, weight: 1, nominalHeight: 42 },
  { id: "tundra-birch-big", biome: "tundra", source: `${RESOURCE}/v3_tundra_forest/birch_big_tundra.glb`, weight: 0.75, nominalHeight: 27 },
  { id: "tundra-dead-pine-a", biome: "tundra", source: `${RESOURCE}/v3_tundra_forest_dead/pine_dead_a.glb`, weight: 0.22, nominalHeight: 25, tags: ["dead"] },
  { id: "arctic-pine-a", biome: "arctic", source: `${RESOURCE}/v3_arctic_forest/pine_a_snow.glb`, weight: 1, nominalHeight: 48, tags: ["snow"] },
  { id: "arctic-fir-a", biome: "arctic", source: `${RESOURCE}/v3_arctic_forest/douglas_fir_a_snow.glb`, weight: 0.85, nominalHeight: 42, tags: ["snow"] },
  { id: "arctic-dead-pine-a", biome: "arctic", source: `${RESOURCE}/v3_arctic_forest/pine_dead_snow_a.glb`, weight: 0.18, nominalHeight: 25, tags: ["dead", "snow"] },
  { id: "arid-palm-tall-a", biome: "arid", source: `${RESOURCE}/v3_arid_forest/palm_tree_tall_a_entity.glb`, weight: 1, nominalHeight: 22, tags: ["palm"] },
  { id: "arid-palm-short-b", biome: "arid", source: `${RESOURCE}/v3_arid_forest/palm_tree_short_b_entity.glb`, weight: 0.7, nominalHeight: 13, tags: ["palm"] },
  { id: "tropical-palm-tall-a", biome: "tropical", source: `${RESOURCE}/v3_tropical_forest/palm_tree_tropical_tall_a_entity.glb`, weight: 1, nominalHeight: 23, tags: ["palm"] },
  { id: "tropical-palm-small-a", biome: "tropical", source: `${RESOURCE}/v3_tropical_forest/palm_tree_tropical_small_a_entity.glb`, weight: 0.65, nominalHeight: 14, tags: ["palm"] },
  { id: "jungle-hura-a", biome: "jungle", source: `${RESOURCE}/v3_jungle_forest/hura_crepitans_a.glb`, weight: 1, nominalHeight: 19 },
  { id: "jungle-trumpet-a", biome: "jungle", source: `${RESOURCE}/v3_jungle_forest/trumpet_tree_a.glb`, weight: 0.85, nominalHeight: 23 },
  { id: "jungle-mauritia-l", biome: "jungle", source: `${RESOURCE}/v3_jungle_forest/mauritia_flexuosa_l.glb`, weight: 0.6, nominalHeight: 22, tags: ["palm"] },
  { id: "swamp-tree-a", biome: "swamp", source: `${RESOURCE}/swamp-trees/swamp_tree_a.glb`, weight: 1, nominalHeight: 18 },
  { id: "swamp-tree-b", biome: "swamp", source: `${RESOURCE}/swamp-trees/swamp_tree_b.glb`, weight: 0.8, nominalHeight: 20 },
];
