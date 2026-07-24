import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("Raidlands 10X rollout", () => {
  it("publishes the configured progression baseline without replacing the wipe settings", () => {
    const config = read("includes/config.php");

    expect(config).toContain("'Raidlands 10X'");
    expect(config).toContain("['10X', 'Player gather'");
    expect(config).toContain("['5X', 'Loot'");
    expect(config).toContain("['3X', 'Scrap'");
    expect(config).toContain("'Maximum team size: 16.'");
    expect(config).toContain("'C4 / rocket stacks'");
    expect(config).toContain("RAIDLANDS_WIPE_DAY");
    expect(config).toContain("RAIDLANDS_WIPE_TIME");
    expect(config).toContain("RAIDLANDS_WIPE_TIMEZONE");
  });

  it("ships canonical social metadata and GameServer structured data", () => {
    const header = read("includes/header.php");
    const helpers = read("includes/helpers.php");

    expect(header).toContain('rel="canonical"');
    expect(header).toContain('property="og:image"');
    expect(header).toContain('name="twitter:card"');
    expect(header).toContain("'@type' => 'GameServer'");
    expect(header).toContain("'serverStatus'");
    expect(helpers).toContain("png|jpe?g|webp|svg|ico");
  });

  it("keeps unsafe backpack offers hidden and maps packs to live permissions", () => {
    const migration = read("database/migrations/074_raidlands_10x_progression.sql");
    const repairMigration = read("database/migrations/075_raidlands_10x_store_repair.sql");
    const store = read("includes/store.php");
    const storePage = read("pages/store.php");
    const storeItemPage = read("pages/store-item.php");
    const storeKitPage = read("pages/store-kit.php");

    expect(migration).toContain("WHERE slug = 'perk-backpack-keep-death'");
    expect(migration).toContain("WHERE slug = 'perk-backpack-keep-wipe'");
    expect(migration).toContain("'backpacks.keepondeath'");
    expect(migration).toContain("'kits.sentry.small'");
    expect(migration).toContain("'kits.sentry.large'");
    expect(migration).toContain("'kits.portafort'");
    expect(migration).toContain("'kits.vehicle'");
    expect(repairMigration).toContain("'rank_vip' THEN 'backpacks.size.36'");
    expect(repairMigration).toContain("'rank_golden_vip' THEN 'backpacks.size.42'");
    expect(repairMigration).toContain("'rank_titan_vip' THEN 'backpacks.size.48'");
    expect(repairMigration).toContain("'default' THEN 'backpacks.size.6'");
    expect(repairMigration).toContain("op.permission_name LIKE 'backpacks.size.%'");
    expect(repairMigration).toContain("op.permission_name = 'backpacks.keepondeath'");
    expect(store).toContain("raidlands_store_product_is_live_ready");
    expect(store).toContain("raidlands_store_product_backpack_slots");
    expect(store).toContain(" backpack slots");
    expect(storePage).toContain("backpack slots</span>");
    expect(storeItemPage).toContain("backpack slots</span>");
    expect(storeKitPage).toContain("backpack slots included");
  });

  it("blocks preserved production overrides from reintroducing the retired identity", () => {
    const config = read("includes/config.php");
    const serverStatus = read("includes/server-status.php");

    expect(config).toContain("raidlands_enforce_10x_release_content");
    expect(config).toContain("1000\\s*x|battlefield");
    expect(config).toContain("$raidlands_10x_release_defaults");
    expect(serverStatus).toContain("raidlands_server_status_public_map_name");
    expect(serverStatus).toContain("preg_replace('/\\s*battlefield\\s*/i'");
  });

  it("preserves stronger and lifetime access during fulfillment", () => {
    const store = read("includes/store.php");

    expect(store).toContain("Your account already has a higher Raidlands rank");
    expect(store).toContain("Your account already has permanent access");
    expect(store).toContain("WHEN ends_at IS NULL OR VALUES(ends_at) IS NULL THEN NULL");
    expect(store).toContain("if ($existing_tier >= $candidate_tier)");
  });
});
