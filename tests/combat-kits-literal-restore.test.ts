import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(import.meta.dirname, "..", "database/migrations/079_combat_reward_kits_literal_restore.sql"),
  "utf8",
);

describe("literal July 20 combat-kit restore", () => {
  it("replaces rows instead of merely republishing live data", () => {
    expect(migration).toContain("DELETE items");
    expect(migration).toContain("INSERT INTO game_kit_items");
    expect(migration).toContain("tmp_raidlands_combat_items");
  });

  it("pins all nine affected kit names", () => {
    for (const name of [
      "ak", "lr300", "m16", "mp5", "steam", "steam_name_rewards",
      "discord", "discord_booster", "discord_raid",
    ]) {
      expect(migration).toContain(`'${name}'`);
    }
  });

  it("pins the requested standard combat belt layout", () => {
    expect(migration).toContain("'syringe.medical' shortname, 100 amount");
    expect(migration).toContain("'black.raspberries', 65");
    expect(migration).toContain("'largemedkit', 65");
    expect(migration).toContain("'barricade.wood.cover', 20");
  });

  it("appends corrected definitions last so they replace stale frozen copies", () => {
    expect(migration).toContain("@raidlands_previous_managed_kits_json");
    expect(migration).toContain("@raidlands_corrected_combat_kits_json");
    expect(migration).toContain("WebsiteVipBridge");
    expect(migration).not.toContain(" AS JSON)");
  });
});
