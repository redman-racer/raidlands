import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("Titan 48-slot backpack fulfillment", () => {
  it("declares the backpack perk as part of the Titan website product", () => {
    const catalog = readFileSync(
      join(root, "includes/store-vip-rollout-catalog.php"),
      "utf8",
    );

    expect(catalog).toContain(
      "'perk_backpack_48'",
    );
    expect(catalog).toContain("'perk_backpack_keep_wipe'");
  });

  it("adds the fulfillment action and refreshes active Titan cursors", () => {
    const migration = readFileSync(
      join(root, "database/migrations/080_titan_backpack_fulfillment.sql"),
      "utf8",
    );

    expect(migration).toContain("'perk_backpack_48'");
    expect(migration).toContain("'perk_backpack_keep_wipe'");
    expect(migration).toContain("products.slug = 'rank-titan-vip'");
    expect(migration).toContain("entitlements.changed_at = NOW()");
    expect(migration).toContain("entitlements.last_synced_at = NULL");
  });
});
