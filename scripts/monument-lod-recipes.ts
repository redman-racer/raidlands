export type MonumentSizeClass = "tiny" | "small" | "medium" | "large" | "xlarge";
export type MonumentReviewStatus = "candidate" | "approved" | "rejected";
export type MonumentTierName = "map" | "mid" | "close";
export type MonumentStructuralRole = "shell" | "roof" | "platform" | "stairs" | "perimeter" | "landmark-prop" | "ground-pad";

export type MonumentExclusionPolicy = {
  interiors: true;
  furniture: true;
  loot: true;
  debris: true;
  lights: true;
  undergroundGeometry: true;
  oversizedTerrainAndRocks: true;
};

export type MonumentCompositePlacement = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale?: number;
};

export type MonumentCompositeRecipe = {
  id: string;
  rustRelayPath: string;
  localFallback?: string;
  minimumTier: MonumentTierName;
  placements: MonumentCompositePlacement[];
};

export type MonumentLodRecipe = {
  id: string;
  layoutSource: string;
  sizeClass: MonumentSizeClass;
  deliveryWave: 2 | 3 | 4;
  reviewStatus: MonumentReviewStatus;
  structuralRoles: MonumentStructuralRole[];
  exclusions: MonumentExclusionPolicy;
  surfaceOnly?: boolean;
  standaloneOnly?: boolean;
  preferAuthoredMap?: boolean;
  explicitMapIncludes?: string[];
  explicitStructuralIncludes?: string[];
  explicitExcludes?: string[];
  composites?: MonumentCompositeRecipe[];
};

export const RUSTRELAY_SOURCE = {
  repository: "Facepunch/RustRelay.Assets",
  revision: "494242b",
  defaultSibling: "../RustRelay.Assets/assets",
} as const;

const AUTOSPAWN = "bundled/prefabs/autospawn";
const MONUMENT = `${AUTOSPAWN}/monument`;
const STRUCTURAL_ROLES: MonumentStructuralRole[] = ["shell", "roof", "platform", "stairs", "perimeter", "landmark-prop", "ground-pad"];
const EXCLUSIONS: MonumentExclusionPolicy = {
  interiors: true,
  furniture: true,
  loot: true,
  debris: true,
  lights: true,
  undergroundGeometry: true,
  oversizedTerrainAndRocks: true,
};

const LAYOUT_SOURCES: Record<string, string> = {
  airfield_1: `${MONUMENT}/large/airfield_1.glb`,
  apartments_complex_1: `${MONUMENT}/medium/apartments_complex_1.glb`,
  arctic_research_base_a: `${MONUMENT}/arctic_bases/arctic_research_base_a.glb`,
  bandit_town: `${MONUMENT}/medium/bandit_town.glb`,
  cave_large_hard: `${MONUMENT}/cave/cave_large_hard.glb`,
  cave_large_medium: `${MONUMENT}/cave/cave_large_medium.glb`,
  cave_large_sewers_hard: `${MONUMENT}/cave/cave_large_sewers_hard.glb`,
  cave_medium_easy: `${MONUMENT}/cave/cave_medium_easy.glb`,
  cave_medium_hard: `${MONUMENT}/cave/cave_medium_hard.glb`,
  cave_medium_medium: `${MONUMENT}/cave/cave_medium_medium.glb`,
  cave_small_easy: `${MONUMENT}/cave/cave_small_easy.glb`,
  cave_small_hard: `${MONUMENT}/cave/cave_small_hard.glb`,
  cave_small_medium: `${MONUMENT}/cave/cave_small_medium.glb`,
  compound: `${MONUMENT}/medium/compound.glb`,
  desert_military_base_a: `${MONUMENT}/military_bases/desert_military_base_a.glb`,
  desert_military_base_b: `${MONUMENT}/military_bases/desert_military_base_b.glb`,
  desert_military_base_c: `${MONUMENT}/military_bases/desert_military_base_c.glb`,
  desert_military_base_d: `${MONUMENT}/military_bases/desert_military_base_d.glb`,
  entrance_bunker_a: `${AUTOSPAWN}/tunnel-entrance/entrance_bunker_a.glb`,
  entrance_bunker_b: `${AUTOSPAWN}/tunnel-entrance/entrance_bunker_b.glb`,
  entrance_bunker_c: `${AUTOSPAWN}/tunnel-entrance/entrance_bunker_c.glb`,
  entrance_bunker_d: `${AUTOSPAWN}/tunnel-entrance/entrance_bunker_d.glb`,
  excavator_1: `${MONUMENT}/large/excavator_1.glb`,
  ferry_terminal_1: `${MONUMENT}/harbor/ferry_terminal_1.glb`,
  fishing_village_a: `${MONUMENT}/fishing_village/fishing_village_a.glb`,
  fishing_village_b: `${MONUMENT}/fishing_village/fishing_village_b.glb`,
  fishing_village_c: `${MONUMENT}/fishing_village/fishing_village_c.glb`,
  gas_station_1: `${MONUMENT}/roadside/gas_station_1.glb`,
  harbor_1: `${MONUMENT}/harbor/harbor_1.glb`,
  harbor_2: `${MONUMENT}/harbor/harbor_2.glb`,
  ice_lake_1: `${MONUMENT}/ice_lakes/ice_lake_1.glb`,
  ice_lake_2: `${MONUMENT}/ice_lakes/ice_lake_2.glb`,
  ice_lake_3: `${MONUMENT}/ice_lakes/ice_lake_3.glb`,
  ice_lake_4: `${MONUMENT}/ice_lakes/ice_lake_4.glb`,
  jungle_ruins_a: `${MONUMENT}/jungle_ruins/jungle_ruins_a.glb`,
  jungle_ruins_b: `${MONUMENT}/jungle_ruins/jungle_ruins_b.glb`,
  jungle_ruins_c: `${MONUMENT}/jungle_ruins/jungle_ruins_c.glb`,
  jungle_ruins_d: `${MONUMENT}/jungle_ruins/jungle_ruins_d.glb`,
  jungle_ruins_e: `${MONUMENT}/jungle_ruins/jungle_ruins_e.glb`,
  jungle_ziggurat_a: `${MONUMENT}/jungle_ruins/jungle_ziggurat_a.glb`,
  junkyard_1: `${MONUMENT}/medium/junkyard_1.glb`,
  launch_site_1: `${MONUMENT}/xlarge/launch_site_1.glb`,
  lighthouse: `${MONUMENT}/lighthouse/lighthouse.glb`,
  military_tunnel_1: `${MONUMENT}/large/military_tunnel_1.glb`,
  mining_quarry_a: `${MONUMENT}/small/mining_quarry_a.glb`,
  mining_quarry_b: `${MONUMENT}/small/mining_quarry_b.glb`,
  mining_quarry_c: `${MONUMENT}/small/mining_quarry_c.glb`,
  nuclear_missile_silo: `${MONUMENT}/medium/nuclear_missile_silo.glb`,
  oilrig_1: `${MONUMENT}/offshore/oilrig_1.glb`,
  oilrig_2: `${MONUMENT}/offshore/oilrig_2.glb`,
  power_sub_big_1: `${AUTOSPAWN}/power substations/big/power_sub_big_1.glb`,
  power_sub_big_2: `${AUTOSPAWN}/power substations/big/power_sub_big_2.glb`,
  power_sub_small_1: `${AUTOSPAWN}/power substations/small/power_sub_small_1.glb`,
  power_sub_small_2: `${AUTOSPAWN}/power substations/small/power_sub_small_2.glb`,
  powerplant_1: `${MONUMENT}/large/powerplant_1.glb`,
  radtown_1: `${MONUMENT}/roadside/radtown_1.glb`,
  radtown_small_3: `${MONUMENT}/medium/radtown_small_3.glb`,
  satellite_dish: `${MONUMENT}/small/satellite_dish.glb`,
  sphere_tank: `${MONUMENT}/small/sphere_tank.glb`,
  stables_a: `${MONUMENT}/small/stables_a.glb`,
  stables_b: `${MONUMENT}/small/stables_b.glb`,
  supermarket_1: `${MONUMENT}/roadside/supermarket_1.glb`,
  swamp_a: `${MONUMENT}/swamp/swamp_a.glb`,
  swamp_b: `${MONUMENT}/swamp/swamp_b.glb`,
  swamp_c: `${MONUMENT}/swamp/swamp_c.glb`,
  trainyard_1: `${MONUMENT}/large/trainyard_1.glb`,
  ue_jungle_swamp_a: `${AUTOSPAWN}/unique_environment/jungle/ue_jungle_swamp_a.glb`,
  underwater_lab_a: `${MONUMENT}/underwater_lab/underwater_lab_a.glb`,
  underwater_lab_b: `${MONUMENT}/underwater_lab/underwater_lab_b.glb`,
  underwater_lab_c: `${MONUMENT}/underwater_lab/underwater_lab_c.glb`,
  underwater_lab_d: `${MONUMENT}/underwater_lab/underwater_lab_d.glb`,
  warehouse: `${MONUMENT}/roadside/warehouse.glb`,
  water_treatment_plant_1: `${MONUMENT}/large/water_treatment_plant_1.glb`,
  water_well_a: `${MONUMENT}/tiny/water_well_a.glb`,
  water_well_b: `${MONUMENT}/tiny/water_well_b.glb`,
  water_well_c: `${MONUMENT}/tiny/water_well_c.glb`,
  water_well_d: `${MONUMENT}/tiny/water_well_d.glb`,
  water_well_e: `${MONUMENT}/tiny/water_well_e.glb`,
};

const LARGE = new Set([
  "airfield_1", "apartments_complex_1", "arctic_research_base_a", "excavator_1", "ferry_terminal_1",
  "harbor_1", "harbor_2", "military_tunnel_1", "nuclear_missile_silo", "oilrig_1", "powerplant_1",
  "trainyard_1", "water_treatment_plant_1",
]);
const MEDIUM = new Set([
  "bandit_town", "compound", "desert_military_base_a", "desert_military_base_b", "desert_military_base_c",
  "desert_military_base_d", "fishing_village_a", "fishing_village_b", "fishing_village_c", "junkyard_1",
  "oilrig_2", "radtown_1", "radtown_small_3", "jungle_ziggurat_a",
]);
const TINY = new Set([
  "power_sub_small_1", "power_sub_small_2", "water_well_a", "water_well_b", "water_well_c", "water_well_d", "water_well_e",
]);

function sizeClass(id: string): MonumentSizeClass {
  if (id === "launch_site_1") return "xlarge";
  if (LARGE.has(id)) return "large";
  if (MEDIUM.has(id)) return "medium";
  if (TINY.has(id)) return "tiny";
  return "small";
}

const SURFACE_ONLY = /^(?:cave_|entrance_bunker_)/;
const WAVE_TWO = new Set([
  "apartments_complex_1", "launch_site_1", "compound", "desert_military_base_a", "desert_military_base_b", "desert_military_base_c", "desert_military_base_d",
  "powerplant_1", "harbor_1", "radtown_1", "airfield_1", "trainyard_1", "bandit_town", "oilrig_1", "oilrig_2",
  "water_treatment_plant_1", "harbor_2", "junkyard_1", "excavator_1",
]);
const WAVE_FOUR = /^(?:power_sub_|mining_quarry_|water_well_|cave_|entrance_bunker_|ice_lake_|swamp_|jungle_|ue_jungle_|underwater_lab_)/;

const EXPLICIT_INCLUDES: Record<string, string[]> = {
  airfield_1: ["hangar", "office_bld", "airfield", "runway", "substation", "watch_tower", "fuel_tank"],
  apartments_complex_1: ["apartment_complex", "apartments_complex", "facade", "roof", "core", "wing"],
  arctic_research_base_a: ["arctic_base", "dome_radar", "comms_tower", "wind_turbine", "portacabin_", "walkway_b", "chainlink_fence"],
  bandit_town: ["bandit", "town", "market", "shop", "casino", "crane", "dredge", "dradge", "barge", "dock", "platform", "tower", "wooden_cabin", "wooden_walkway", "windmill", "helipad", "gate.wall.wood"],
  compound: ["rowhouse", "outbuilding", "compound_wall", "compound_gate", "watch_tower", "marketplace", "marketpalce", "caboose", "shipping_container"],
  desert_military_base_a: ["checkpoint", "barbedwire", "hesco_barrier", "trail_path", "dirt_mound"],
  desert_military_base_b: ["checkpoint", "barbedwire", "hesco_barrier", "trail_path", "dirt_mound"],
  desert_military_base_c: ["checkpoint", "barbedwire", "hesco_barrier", "trail_path", "dirt_mound"],
  desert_military_base_d: ["checkpoint", "barbedwire", "hesco_barrier", "trail_path", "dirt_mound"],
  excavator_1: ["excavator", "conveyor", "bucket", "crane", "platform", "tower"],
  ferry_terminal_1: ["ferry", "terminal", "dock", "pier", "building", "platform", "wall", "crane"],
  harbor_2: ["harbor", "warehouse", "dock", "pier", "crane", "gantry", "barge", "loading", "building"],
  ice_lake_1: ["ice_lake_a"],
  ice_lake_2: ["ice_lake_b"],
  ice_lake_3: ["ice_lake_c"],
  ice_lake_4: ["ice_lake_d"],
  junkyard_1: ["junkyard", "carshredder", "car_shredder", "crane", "junk_stack", "warehouse", "wall", "tower"],
  launch_site_1: ["rocket_factory", "rocket_boosters", "rocket_payload", "space_center", "warehouse_launch_site", "watch_tower", "range_core_exterior", "pipeline_bespoke_launchsite"],
  nuclear_missile_silo: ["nuclear_silo_bunker_hatch", "nuclear_silo_chute", "nuclear_silo_tunnel_exit", "cliff_tall_", "rock_formation_huge_", "military_hangar", "portacabin_", "radio_tower", "watchtower", "chainlink_fence", "fuel_tank"],
  oilrig_1: ["level0", "level1", "level2", "level3", "level4", "level5", "level6", "structure_", "helipad", "burner", "comms_tower", "gas_room", "moon_pool", "oilrig_crane", "dock"],
  oilrig_2: ["level0", "level1", "level2", "level3", "level4", "structure_", "helipad", "burner", "moon_pool", "oilrig_crane", "dock"],
  sphere_tank: ["sphere_exterior", "sphere_pillars", "pipes_exterior", "evac_pipes"],
  trainyard_1: ["coaling_tower", "train_crane", "train_track", "train_wagon", "loading_platform", "warehouse", "pavemnent_trainyard", "building", "tower"],
  water_treatment_plant_1: ["sewage", "water_tower", "pump", "treatment", "warehouse", "tank", "basin", "tower", "platform", "bridge", "pipe"],
};

const EXPLICIT_EXCLUDES: Record<string, string[]> = {
  apartments_complex_1: [
    "_SP", "bathroom", "elevator_shaft", "lift_shaft", "corridor_train_tunnel", "apartment_fridge", "apartment_pillow", "apartment_queen_bed",
    "apartment_single_bed", "apartment_single_blanket", "apartment_wood_stove", "bulky_apartment_sofa",
    "coat_hanger", "kitchen_counter", "kitchen_cupboard", "magazine_stand",
  ],
  compound: ["corridor_train_tunnel", "sewer_tunnel"],
  ice_lake_1: ["cliff", "rock_formation"],
  ice_lake_2: ["cliff", "rock_formation"],
  ice_lake_3: ["cliff", "rock_formation"],
  ice_lake_4: ["cliff", "rock_formation"],
  launch_site_1: ["bunker.room", "corridor_train_tunnel", "office_a_floor", "office_b_floor", "sewer_tunnel"],
  nuclear_missile_silo: ["nuclear_silo_room_", "nuclear_silo_tunnel_300", "nuclear_silo_tunnel_tube", "nuclear_silo_missile", "elevator_shaft"],
};

const MAP_INCLUDES: Record<string, string[]> = {
  apartments_complex_1: [
    "apartment_complex_core_", "apartment_complex_facade", "apartment_complex_side", "apartment_complex_roof",
    "apartments_complex_b_facade", "apartments_complex_roof", "apartments_complex_b_entrance",
    "apartment_complex_foundation", "rentable_shop_", "wall_",
  ],
  compound: EXPLICIT_INCLUDES.compound!,
};
const FORCE_RECIPE_MAP = new Set([
  "airfield_1", "apartments_complex_1", "arctic_research_base_a", "bandit_town", "desert_military_base_a", "desert_military_base_b", "desert_military_base_c", "desert_military_base_d",
  "excavator_1", "ferry_terminal_1", "harbor_2", "jungle_ruins_e", "jungle_ziggurat_a", "junkyard_1",
  "military_tunnel_1", "nuclear_missile_silo", "oilrig_1", "oilrig_2", "power_sub_small_1", "power_sub_small_2",
  "power_sub_big_1", "power_sub_big_2", "radtown_small_3", "stables_a", "stables_b", "supermarket_1", "trainyard_1", "underwater_lab_a",
  "underwater_lab_b", "underwater_lab_c", "underwater_lab_d", "water_treatment_plant_1", "jungle_ruins_a",
]);

const MILITARY_COMPOSITES: MonumentCompositeRecipe[] = [
  {
    id: "hangar",
    rustRelayPath: "Content/structures/military_hangar/military_hangar_1350x1100.glb",
    localFallback: "assets/media/models/military-base/military_hangar_1350x1100.glb",
    minimumTier: "map",
    placements: [{ x: 2, y: 0, z: -27, rotationY: 0 }],
  },
  {
    id: "field-tent",
    rustRelayPath: "Content/structures/military_tents/tent_tunnel_600_a.glb",
    localFallback: "assets/media/models/military-base/tent_tunnel_600_a.glb",
    minimumTier: "map",
    placements: [{ x: -25, y: 0, z: 17, rotationY: Math.PI * 0.5 }, { x: -25, y: 0, z: 7, rotationY: Math.PI * 0.5 }],
  },
  {
    id: "shipping-container",
    rustRelayPath: "Content/Props/shipping_containers/shipping_container_600_a_green.glb",
    localFallback: "assets/media/models/military-base/shipping_container_600_a_green.glb",
    minimumTier: "mid",
    placements: [{ x: -14, y: 0, z: 25, rotationY: 0 }, { x: -8, y: 0, z: 25, rotationY: 0 }, { x: 25, y: 0, z: -17, rotationY: Math.PI * 0.5 }],
  },
  {
    id: "sandbags",
    rustRelayPath: "Content/Props/Barricades_static/barricade_sandbags.glb",
    localFallback: "assets/media/models/military-base/barricade_sandbags.glb",
    minimumTier: "mid",
    placements: [{ x: -18, y: 0, z: -7, rotationY: Math.PI * 0.35 }, { x: -12, y: 0, z: -10, rotationY: Math.PI * 0.35 }, { x: -6, y: 0, z: -13, rotationY: Math.PI * 0.35 }, { x: 19, y: 0, z: 19, rotationY: Math.PI * 0.5 }],
  },
  {
    id: "generator",
    rustRelayPath: "Content/Props/power_generator/power_generator_a.glb",
    localFallback: "assets/media/models/military-base/power_generator_a.glb",
    minimumTier: "close",
    placements: [{ x: 23, y: 0, z: 12, rotationY: Math.PI * 0.5 }, { x: 23, y: 0, z: 7, rotationY: Math.PI * 0.5 }],
  },
  {
    id: "fuel-tank",
    rustRelayPath: "Content/Props/fuel_tank/fuel_tank_a_600.glb",
    localFallback: "assets/media/models/military-base/fuel_tank_a_600.glb",
    minimumTier: "close",
    placements: [{ x: 28, y: 0, z: 11, rotationY: 0 }, { x: 28, y: 0, z: 4, rotationY: 0 }],
  },
  {
    id: "mlrs",
    rustRelayPath: "Content/Vehicles/MLRS/mlrs.entity.glb",
    localFallback: "assets/media/models/vehicles/mlrs.entity.glb",
    minimumTier: "mid",
    placements: [{ x: -7, y: 0.35, z: -5, rotationY: Math.PI * 0.32, scale: 1.35 }],
  },
];

const UNDERWATER_SHELLS: Record<string, MonumentCompositeRecipe[]> = {
  underwater_lab_a: [{
    id: "lab-shell-4way",
    rustRelayPath: "Content/structures/underwater_labs/module_1200x1200_4way.glb",
    minimumTier: "map",
    placements: [{ x: 0, y: 0, z: 0, rotationY: 0 }],
  }],
  underwater_lab_b: [{
    id: "lab-shell-long",
    rustRelayPath: "Content/structures/underwater_labs/module_1200x1800_2way.glb",
    minimumTier: "map",
    placements: [{ x: 0, y: 0, z: 0, rotationY: 0 }],
  }],
  underwater_lab_c: [{
    id: "lab-shell-lshaped",
    rustRelayPath: "Content/structures/underwater_labs/module_1500x1500_4way_lshaped.glb",
    minimumTier: "map",
    placements: [{ x: 0, y: 0, z: 0, rotationY: 0 }],
  }],
  underwater_lab_d: [{
    id: "lab-shell-moonpool",
    rustRelayPath: "Content/structures/underwater_labs/module_1200x1500_1way_moonpool.glb",
    minimumTier: "map",
    placements: [{ x: 0, y: 0, z: 0, rotationY: 0 }],
  }],
};

export const MONUMENT_LOD_RECIPES: MonumentLodRecipe[] = Object.entries(LAYOUT_SOURCES)
  .map(([id, layoutSource]) => ({
    id,
    layoutSource,
    sizeClass: sizeClass(id),
    deliveryWave: WAVE_TWO.has(id) ? 2 as const : WAVE_FOUR.test(id) ? 4 as const : 3 as const,
    reviewStatus: "candidate" as const,
    structuralRoles: [...STRUCTURAL_ROLES],
    exclusions: { ...EXCLUSIONS },
    surfaceOnly: SURFACE_ONLY.test(id),
    standaloneOnly: Boolean(UNDERWATER_SHELLS[id]),
    preferAuthoredMap: !MAP_INCLUDES[id] && !FORCE_RECIPE_MAP.has(id),
    explicitMapIncludes: MAP_INCLUDES[id],
    explicitStructuralIncludes: EXPLICIT_INCLUDES[id],
    explicitExcludes: EXPLICIT_EXCLUDES[id],
    composites: id.startsWith("desert_military_base_") ? MILITARY_COMPOSITES : UNDERWATER_SHELLS[id],
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

if (MONUMENT_LOD_RECIPES.length !== 78) {
  throw new Error(`Expected 78 monument LOD recipes, received ${MONUMENT_LOD_RECIPES.length}.`);
}

export function monumentRecipe(id: string): MonumentLodRecipe {
  const recipe = MONUMENT_LOD_RECIPES.find((entry) => entry.id === id);
  if (!recipe) throw new Error(`Missing monument LOD recipe for ${id}.`);
  return recipe;
}
