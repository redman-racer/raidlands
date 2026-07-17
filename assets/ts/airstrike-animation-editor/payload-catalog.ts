import { PAYLOAD_CATALOG_ENTRIES, type PayloadCatalogEntry } from "./types";

export const PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = PAYLOAD_CATALOG_ENTRIES.filter((entry) => !entry.deprecated);
export const LEGACY_PAYLOAD_CATALOG: readonly PayloadCatalogEntry[] = PAYLOAD_CATALOG_ENTRIES.filter((entry) => entry.deprecated);

export function payloadCatalogEntry(id: string): PayloadCatalogEntry | undefined {
  return PAYLOAD_CATALOG_ENTRIES.find((entry) => entry.id === id);
}
