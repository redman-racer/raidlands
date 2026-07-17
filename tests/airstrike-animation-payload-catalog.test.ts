import { describe, expect, it } from "vitest";
import { LEGACY_PAYLOAD_CATALOG, PAYLOAD_CATALOG, payloadCatalogEntry } from "../assets/ts/airstrike-animation-editor/payload-catalog";
import { AUTHORABLE_PAYLOADS, SUPPORTED_PAYLOADS } from "../assets/ts/airstrike-animation-editor/types";

describe("airstrike payload catalog", () => {
  it("contains every authorable payload exactly once and excludes the shotgun trap", () => {
    expect(PAYLOAD_CATALOG.map((entry) => entry.id)).toEqual(AUTHORABLE_PAYLOADS);
    expect(new Set(PAYLOAD_CATALOG.map((entry) => entry.id)).size).toBe(PAYLOAD_CATALOG.length);
    expect(SUPPORTED_PAYLOADS).not.toContain("shotgun_trap");
  });

  it("exposes each patrol-heli rocket as an independent projectile choice", () => {
    const ids = PAYLOAD_CATALOG.filter((entry) => entry.id.startsWith("patrol_heli_rocket")).map((entry) => entry.id);
    expect(ids).toEqual([
      "patrol_heli_rocket",
      "patrol_heli_rocket_airburst",
      "patrol_heli_rocket_napalm",
    ]);
    for (const id of ids) {
      const entry = payloadCatalogEntry(id);
      expect(entry?.executionType).toBe("native_projectile");
      expect(entry?.restriction).toBe("One projectile per release");
    }
  });

  it("accepts the old Bradley value without offering it for new authoring", () => {
    expect(AUTHORABLE_PAYLOADS).not.toContain("bradley_longbarrel_burst");
    expect(SUPPORTED_PAYLOADS).toContain("bradley_longbarrel_burst");
    expect(LEGACY_PAYLOAD_CATALOG[0]).toMatchObject({
      id: "bradley_longbarrel_burst",
      deprecated: true,
      replacementId: "bradley_main_cannon",
    });
  });
});
