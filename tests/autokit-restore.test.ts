import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(import.meta.dirname, "..", "database/migrations/077_autokit_restore_layout.sql"),
  "utf8",
);

describe("July 20 Auto Kit restore", () => {
  it("restores the requested belt quantities in their original sparse slots", () => {
    expect(migration).toContain("'belt', 1, 'syringe.medical', NULL, 0, 100");
    expect(migration).toContain("'belt', 2, 'black.raspberries', NULL, 0, 65");
    expect(migration).toContain("'belt', 3, 'largemedkit', NULL, 0, 65");
    expect(migration).toContain("Belt position 4 is intentionally empty");
    expect(migration).toContain("'belt', 5, 'barricade.wood.cover', NULL, 0, 20");
  });

  it("preserves the original main, wear, and weapon positions", () => {
    expect(migration).toContain("'main', 12, 'ammo.rifle'");
    expect(migration).toContain("'main', 23, 'jackhammer'");
    expect(migration).toContain("'wear', 6, 'tactical.gloves'");
    expect(migration).toContain("'belt', 0, 'rifle.ak'");
  });

  it("carries the frozen twelve rank kits into the newer publication", () => {
    expect(migration).toContain("SET @raidlands_rank_kits_json");
    expect(migration).toContain("JSON_MERGE_PRESERVE(");
    expect(migration).toContain(
      "The exact frozen rank payload is included in the newer migration 077 publication.",
    );
    expect(migration).not.toContain(" AS JSON)");
  });
});
