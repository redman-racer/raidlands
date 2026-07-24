import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("July 20 rank-kit restore and split", () => {
  it("pins the authoritative export and publishes an exact twelve-kit payload", () => {
    const migration = read("database/migrations/076_rank_kit_restore_split.sql");

    expect(migration).toContain(
      "7324E1C5AF488C86C3E0A96DE0A0D9C4A6A39163EF3BB79C41CF795A69F3E495",
    );
    expect(migration).toContain("INSERT INTO tmp_raidlands_rank_source_items");
    expect(migration.match(/^\s+\('(vip|vip_plus|mvp|golden|ultimate|titan)', '(main|wear|belt)',/gm)).toHaveLength(188);
    expect(migration).toContain("'kits', (");
    expect(migration).toContain("'server_rewards_kits', JSON_ARRAY()");
    expect(migration).toContain("CAST(@raidlands_rank_kit_payload AS CHAR CHARACTER SET utf8mb4)");
    expect(migration).toContain("SHA2(CAST(@raidlands_rank_kit_payload AS CHAR CHARACTER SET utf8mb4), 256)");
    expect(migration).not.toContain(" AS JSON)");
    expect(migration).toContain("JSON_EXTRACT('false', '$')");
  });

  it("removes only direct boom and installs the approved material totals", () => {
    const migration = read("database/migrations/076_rank_kit_restore_split.sql");

    expect(migration).toContain("source.shortname NOT IN (\n    'ammo.rocket.basic',\n    'explosive.timed',\n    'ammo.rifle.explosive'");
    expect(migration).toContain("('titan', 'sulfur', 332500000, 1)");
    expect(migration).toContain("('titan', 'charcoal', 457500000, 2)");
    expect(migration).toContain("('titan', 'cloth', 1250000, 6)");
    expect(migration).toContain("'ammo.rocket.hv'");
    expect(migration).toContain("'ammo.rocket.sam'");
    expect(migration).toContain("'ammo.grenadelauncher.he'");
  });

  it("uses friendly labels and the full signed item-amount range", () => {
    const kits = read("includes/kits.php");
    const admin = read("admin/index.php");
    const adminJs = read("assets/js/admin-kits.js");

    expect(kits).toContain("'titan_combat' => 'Titan Combat'");
    expect(kits).toContain("'titan_supplies' => 'Titan Supplies'");
    expect(kits).toContain("1, 2147483647");
    expect(admin).toContain('max="2147483647"');
    expect(adminJs).toContain("max: '2147483647'");
  });

  it("protects pending names and aliases from stale kit and reward snapshots", () => {
    const kits = read("includes/kits.php");

    expect(kits).toContain("function raidlands_kits_pending_managed_names");
    expect(kits).toContain("SELECT COALESCE(MAX(revision), 0) AS revision");
    expect(kits).toContain("[$kit['Name'] ?? '', $kit['PreviousName'] ?? '']");
    expect(kits.match(/isset\(\$pending_managed_names\[strtolower\(/g)).toHaveLength(2);
    expect(kits).toContain("raidlands_kits_save_items($pdo, $kit_id, [");
    expect(kits).toContain("], true);");
  });
});
