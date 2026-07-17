import { AUTHORABLE_PAYLOADS, type PayloadCatalogEntry } from "./types";

const details: Record<(typeof AUTHORABLE_PAYLOADS)[number], Omit<PayloadCatalogEntry, "id">> = {
  patrol_heli_gun: { label: "Patrol Helicopter Machine Gun", category: "Vehicle guns", nativeSource: "Patrol Helicopter helibullet", executionType: "hitscan_round" },
  bradley_coax_gun: { label: "Bradley Coax Machine Gun", category: "Vehicle guns", nativeSource: "M2 Bradley coaxbullet", executionType: "hitscan_round" },
  autoturret_gun: { label: "Auto Turret Gun", category: "Automated defenses", nativeSource: "Auto Turret sentrybullet", executionType: "hitscan_round" },
  bradley_main_cannon: { label: "Bradley Main Cannon", category: "Vehicle cannon", nativeSource: "M2 Bradley MainCannonShell", executionType: "native_projectile" },
  patrol_heli_rocket: { label: "Patrol Helicopter Rocket", category: "Vehicle rockets", nativeSource: "rocket_heli", executionType: "native_projectile", restriction: "One projectile per release" },
  patrol_heli_rocket_airburst: { label: "Patrol Helicopter Airburst Rocket", category: "Vehicle rockets", nativeSource: "rocket_heli_airburst", executionType: "native_projectile", restriction: "One projectile per release" },
  patrol_heli_rocket_napalm: { label: "Patrol Helicopter Napalm Rocket", category: "Vehicle rockets", nativeSource: "rocket_heli_napalm", executionType: "native_projectile", restriction: "One projectile per release" },
  sam_rocket: { label: "SAM Rocket", category: "Guided rockets", nativeSource: "rocket_sam", executionType: "native_projectile" },
  mlrs_rocket: { label: "MLRS Rocket", category: "Guided rockets", nativeSource: "rocket_mlrs", executionType: "native_projectile" },
  homing_missile: { label: "Homing Missile", category: "Guided rockets", nativeSource: "HV rocket tracking", executionType: "tracked_projectile", restriction: "Vehicle target required" },
  hv_rocket: { label: "HV Rocket", category: "Rockets", nativeSource: "rocket_hv", executionType: "native_projectile" },
  rocket: { label: "Standard Rocket", category: "Rockets", nativeSource: "rocket_basic", executionType: "native_projectile" },
  incendiary_rocket: { label: "Incendiary Rocket", category: "Rockets", nativeSource: "rocket_fire", executionType: "native_projectile" },
  mortar_he_payload: { label: "Mortar HE Shell", category: "Artillery", nativeSource: "mortar_shell_basic", executionType: "native_projectile" },
  mortar_frag_payload: { label: "Mortar Fragmentation Shell", category: "Artillery", nativeSource: "mortar_shell_fragment", executionType: "native_projectile" },
  cannon_ball: { label: "Deployable Cannon Ball", category: "Artillery", nativeSource: "cannon_ball", executionType: "native_projectile" },
  he_40mm: { label: "40mm HE Grenade", category: "Explosives", nativeSource: "40mm_grenade_he", executionType: "native_projectile" },
  catapult_boulder: { label: "Catapult Boulder", category: "Siege", nativeSource: "boulder", executionType: "native_projectile" },
  bee_catapult_bomb: { label: "Catapult Bee Bomb", category: "Siege", nativeSource: "boulder_bee", executionType: "native_projectile" },
  firebomb: { label: "Catapult Incendiary Bomb", category: "Siege", nativeSource: "boulder_incendiary", executionType: "native_projectile" },
  propane_bomb: { label: "Catapult Explosive Bomb", category: "Siege", nativeSource: "boulder_explosive", executionType: "native_projectile" },
  ballista_hammerhead: { label: "Ballista Hammerhead Bolt", category: "Siege", nativeSource: "ballista.bolt.hammerhead.projectile", executionType: "native_projectile" },
  ballista_incendiary: { label: "Ballista Incendiary Bolt", category: "Siege", nativeSource: "ballista.bolt.incendiary.projectile", executionType: "native_projectile" },
  ballista_piercer: { label: "Ballista Piercer Bolt", category: "Siege", nativeSource: "ballista.bolt.piercer.projectile", executionType: "native_projectile" },
  ballista_pitchfork: { label: "Ballista Pitchfork Bolt", category: "Siege", nativeSource: "ballista.bolt.pitchfork.projectile", executionType: "native_projectile" },
  flame_turret_fireball: { label: "Flame Turret Fireball", category: "Automated defenses", nativeSource: "flameturret_fireball", executionType: "native_projectile" },
  torpedo: { label: "Torpedo", category: "Naval", nativeSource: "TorpedoStraight", executionType: "native_projectile", restriction: "Water target required" },
  bee_grenade: { label: "Bee Grenade", category: "Dropped ordnance", nativeSource: "grenade.bee.deployed", executionType: "native_projectile" },
  beancan: { label: "Beancan Grenade", category: "Dropped ordnance", nativeSource: "grenade.beancan.deployed", executionType: "native_projectile" },
  f1_grenade: { label: "F1 Grenade", category: "Dropped ordnance", nativeSource: "grenade.f1.deployed", executionType: "native_projectile" },
  smoke: { label: "Smoke Grenade", category: "Dropped ordnance", nativeSource: "grenade.smoke.deployed", executionType: "native_projectile" },
  flashbang: { label: "Flashbang", category: "Dropped ordnance", nativeSource: "grenade.flashbang.deployed", executionType: "native_projectile" },
  molotov: { label: "Molotov", category: "Dropped ordnance", nativeSource: "grenade.molotov.deployed", executionType: "native_projectile" },
};

export const PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = AUTHORABLE_PAYLOADS.map((id) => ({ id, ...details[id] }));

export const LEGACY_PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = [{
  id: "bradley_longbarrel_burst",
  label: "Legacy Bradley Cannon Pulse",
  category: "Legacy",
  nativeSource: "Bradley main-cannon effects",
  executionType: "simulated_pulse",
  restriction: "Existing profiles only",
  deprecated: true,
  replacementId: "bradley_main_cannon",
}];

export function payloadCatalogEntry(id: string): PayloadCatalogEntry | undefined {
  return [...PAYLOAD_CATALOG, ...LEGACY_PAYLOAD_CATALOG].find((entry) => entry.id === id);
}
