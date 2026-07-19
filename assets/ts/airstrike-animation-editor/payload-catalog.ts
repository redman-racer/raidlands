import { PAYLOAD_CATALOG_ENTRIES, type PayloadCatalogEntry } from "./types";

export const PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = PAYLOAD_CATALOG_ENTRIES.filter((entry) => !entry.deprecated);
export const LEGACY_PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = PAYLOAD_CATALOG_ENTRIES.filter((entry) => entry.deprecated);

export function payloadCatalogEntry(id: string): PayloadCatalogEntry | undefined {
  return PAYLOAD_CATALOG_ENTRIES.find((entry) => entry.id === id);
}

const DOWNWARD_TRAJECTORY_PAYLOADS = new Set([
  "bee_grenade",
  "beancan",
  "f1_grenade",
  "smoke",
  "flashbang",
  "molotov",
  "he_40mm",
  "catapult_boulder",
  "bee_catapult_bomb",
  "firebomb",
  "propane_bomb",
  "mortar_he_payload",
  "mortar_frag_payload",
]);

export function usesDownwardVehiclePath(payloadId: string): boolean {
  return DOWNWARD_TRAJECTORY_PAYLOADS.has(payloadId);
}
