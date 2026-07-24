import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(import.meta.dirname, "..", "database/migrations/078_regular_kits_restore_publish.sql"),
  "utf8",
);

describe("July 20 ordinary kit publication", () => {
  it("publishes all active ordinary kits, including the weapon kits", () => {
    for (const name of ["ak", "lr300", "m16", "mp5", "build", "raid", "medical"]) {
      expect(migration).toContain(`'${name}'`);
    }
  });

  it("fixes the LR300 syringe typo to the requested 100 count", () => {
    expect(migration).toContain("kits.kit_name = 'lr300'");
    expect(migration).toContain("items.shortname = 'syringe.medical'");
    expect(migration).toContain("SET items.amount = 100");
  });

  it("carries forward Auto Kit and the split rank-kit payload", () => {
    expect(migration).toContain("SET @raidlands_managed_kits_json");
    expect(migration).toContain("JSON_MERGE_PRESERVE(");
    expect(migration).toContain(
      "The newer revision includes the frozen split rank kits, Auto Kit, and all active ordinary July 20 kits.",
    );
  });

  it("keeps the obsolete unsplit rank slugs out of the ordinary-kit allowlist", () => {
    expect(migration).not.toMatch(/'ak', 'lr300', 'm16', 'mp5',[\s\S]*?'vip'/);
    expect(migration).not.toContain(" AS JSON)");
  });
});
