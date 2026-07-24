-- Restore and split the six July 20 rank kits.
-- Authoritative source:
-- database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql
-- SHA-256: 7324E1C5AF488C86C3E0A96DE0A0D9C4A6A39163EF3BB79C41CF795A69F3E495
--
-- Forward-only and targeted: no order, entitlement, membership, price,
-- player, or unrelated kit records are replaced.

SET @raidlands_rank_kit_revision := (
  SELECT GREATEST(
    COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM game_kits), 0),
    COALESCE((SELECT MAX(revision) FROM game_kit_sync_log WHERE status <> 'snapshot'), 0)
  ) + 1
);

SET @raidlands_rank_permission_revision := (
  SELECT GREATEST(
    COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM oxide_groups), 0),
    COALESCE((SELECT MAX(revision) FROM oxide_permission_sync_log WHERE status <> 'snapshot'), 0)
  ) + 1
);

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_kit_map;
CREATE TEMPORARY TABLE tmp_raidlands_rank_kit_map (
  tier varchar(32) NOT NULL PRIMARY KEY,
  existing_id bigint unsigned NOT NULL,
  old_name varchar(160) NOT NULL,
  combat_name varchar(160) NOT NULL,
  supplies_name varchar(160) NOT NULL,
  combat_label varchar(160) NOT NULL,
  supplies_label varchar(160) NOT NULL,
  combat_permission varchar(190) NOT NULL,
  supplies_permission varchar(190) NOT NULL,
  maximum_uses int NOT NULL,
  cooldown_seconds int NOT NULL,
  sort_order int NOT NULL
);

INSERT INTO tmp_raidlands_rank_kit_map
  (tier, existing_id, old_name, combat_name, supplies_name, combat_label, supplies_label, combat_permission, supplies_permission, maximum_uses, cooldown_seconds, sort_order)
VALUES
  ('vip', 406, 'vip', 'vip_combat', 'vip_supplies', 'VIP Combat', 'VIP Supplies', 'kits.vip', 'kits.vip.supplies', 10, 3600, 1010),
  ('vip_plus', 408, 'vip_plus', 'vip_plus_combat', 'vip_plus_supplies', 'VIP+ Combat', 'VIP+ Supplies', 'kits.vipplus', 'kits.vipplus.supplies', 10, 3600, 1020),
  ('mvp', 410, 'mvp', 'mvp_combat', 'mvp_supplies', 'MVP Combat', 'MVP Supplies', 'kits.mvp', 'kits.mvp.supplies', 10, 3600, 1000),
  ('golden', 411, 'golden', 'golden_combat', 'golden_supplies', 'Golden Combat', 'Golden Supplies', 'kits.goldenvip', 'kits.goldenvip.supplies', 2, 259200, 1030),
  ('ultimate', 412, 'ultimate', 'ultimate_combat', 'ultimate_supplies', 'Ultimate Combat', 'Ultimate Supplies', 'kits.ultimatevip', 'kits.ultimatevip.supplies', 2, 259200, 1040),
  ('titan', 413, 'titan', 'titan_combat', 'titan_supplies', 'Titan Combat', 'Titan Supplies', 'kits.titanvip', 'kits.titanvip.supplies', 2, 259200, 1050);

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_source_items;
CREATE TEMPORARY TABLE tmp_raidlands_rank_source_items (
  tier varchar(32) NOT NULL,
  container_name enum('main', 'wear', 'belt') NOT NULL,
  source_position int NOT NULL,
  shortname varchar(160) NOT NULL,
  display_name varchar(160) NULL,
  skin bigint unsigned NOT NULL DEFAULT 0,
  amount int NOT NULL,
  condition_value decimal(10,2) NOT NULL DEFAULT 0,
  max_condition decimal(10,2) NOT NULL DEFAULT 0,
  ammo int NOT NULL DEFAULT 0,
  ammo_type varchar(160) NULL,
  frequency int NOT NULL DEFAULT -1,
  blueprint_shortname varchar(160) NULL,
  text_value text NULL,
  contents_json longtext NULL,
  container_json longtext NULL,
  source_sort_order int NOT NULL DEFAULT 0
);

-- BEGIN GENERATED JULY 20 SOURCE ROWS
INSERT INTO tmp_raidlands_rank_source_items
  (tier, container_name, source_position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, source_sort_order)
VALUES
  ('vip', 'main', 0, 'ammo.rocket.basic', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('vip', 'main', 1, 'ammo.rocket.hv', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('vip', 'main', 2, 'electric.generator.small', NULL, 0, 10, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('vip', 'main', 3, 'weapon.mod.lasersight', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('vip', 'main', 4, 'weapon.mod.holosight', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('vip', 'main', 5, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('vip', 'main', 6, 'ammo.rifle.explosive', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('vip', 'main', 7, 'ammo.rifle', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('vip', 'main', 8, 'weapon.mod.small.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('vip', 'main', 9, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('vip', 'main', 10, 'weapon.mod.8x.scope', NULL, 0, 100, 200.00, 200.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('vip', 'main', 11, 'weapon.mod.holosight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('vip', 'main', 12, 'explosive.timed', NULL, 0, 50, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('vip', 'main', 13, 'rifle.lr300', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('vip', 'main', 14, 'smg.mp5', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('vip', 'main', 15, 'rifle.l96', NULL, 0, 100, 60.00, 60.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('vip', 'main', 16, 'lmg.m249', NULL, 0, 100, 500.00, 500.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('vip', 'main', 17, 'rifle.ak', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('vip', 'main', 18, 'rocket.launcher', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 180),
  ('vip', 'main', 19, 'syringe.medical', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 190),
  ('vip', 'main', 20, 'black.raspberries', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 200),
  ('vip', 'main', 21, 'm16a2', NULL, 0, 100, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 210),
  ('vip', 'main', 22, 'samsite', NULL, 0, 9, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 220),
  ('vip', 'main', 23, 'autoturret', NULL, 0, 35, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 230),
  ('vip', 'wear', 0, 'ballistic.helmet', NULL, 0, 10, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('vip', 'wear', 1, 'ballistic.vest', NULL, 0, 10, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('vip', 'wear', 2, 'ballistic.legarmor', NULL, 0, 10, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('vip', 'wear', 3, 'bdu.shirt', NULL, 0, 10, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('vip', 'wear', 4, 'bdu.pants', NULL, 0, 10, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('vip', 'wear', 5, 'shoes.boots', NULL, 0, 10, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('vip', 'wear', 6, 'tactical.gloves', NULL, 0, 10, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('vip_plus', 'main', 0, 'ammo.rocket.basic', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('vip_plus', 'main', 1, 'ammo.rocket.hv', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('vip_plus', 'main', 2, 'electric.generator.small', NULL, 0, 10, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('vip_plus', 'main', 3, 'ammo.rifle.explosive', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('vip_plus', 'main', 4, 'ammo.rifle', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('vip_plus', 'main', 5, 'ammo.pistol', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('vip_plus', 'main', 6, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('vip_plus', 'main', 7, 'largemedkit', NULL, 0, 1000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('vip_plus', 'main', 8, 'black.raspberries', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('vip_plus', 'main', 9, 'weapon.mod.small.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('vip_plus', 'main', 10, 'weapon.mod.lasersight', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('vip_plus', 'main', 11, 'weapon.mod.holosight', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('vip_plus', 'main', 12, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('vip_plus', 'main', 13, 'weapon.mod.8x.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('vip_plus', 'main', 14, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('vip_plus', 'main', 15, 'rifle.lr300', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('vip_plus', 'main', 16, 'smg.mp5', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('vip_plus', 'main', 17, 'rifle.l96', NULL, 0, 100, 60.00, 60.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('vip_plus', 'main', 18, 'lmg.m249', NULL, 0, 100, 500.00, 500.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 180),
  ('vip_plus', 'main', 19, 'rifle.ak', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 190),
  ('vip_plus', 'main', 20, 'rocket.launcher', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 200),
  ('vip_plus', 'main', 21, 'm16a2', NULL, 0, 100, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 210),
  ('vip_plus', 'main', 22, 'samsite', NULL, 0, 17, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 220),
  ('vip_plus', 'main', 23, 'autoturret', NULL, 0, 50, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 230),
  ('vip_plus', 'wear', 0, 'ballistic.helmet', NULL, 0, 50, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('vip_plus', 'wear', 1, 'ballistic.vest', NULL, 0, 50, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('vip_plus', 'wear', 2, 'ballistic.legarmor', NULL, 0, 50, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('vip_plus', 'wear', 3, 'bdu.shirt', NULL, 0, 50, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('vip_plus', 'wear', 4, 'bdu.pants', NULL, 0, 50, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('vip_plus', 'wear', 5, 'shoes.boots', NULL, 0, 50, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('vip_plus', 'wear', 6, 'tactical.gloves', NULL, 0, 50, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('mvp', 'main', 0, 'ammo.rocket.basic', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('mvp', 'main', 1, 'ammo.rocket.hv', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('mvp', 'main', 2, 'ammo.rocket.sam', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('mvp', 'main', 3, 'explosive.timed', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('mvp', 'main', 4, 'samsite', NULL, 0, 1, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('mvp', 'main', 5, 'ammo.rifle.explosive', NULL, 0, 25000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('mvp', 'main', 6, 'ammo.rifle', NULL, 0, 25000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('mvp', 'main', 7, 'ammo.pistol', NULL, 0, 25000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('mvp', 'main', 8, 'autoturret', NULL, 0, 18, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('mvp', 'main', 9, 'largemedkit', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('mvp', 'main', 10, 'syringe.medical', NULL, 0, 1250, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('mvp', 'main', 11, 'black.raspberries', NULL, 0, 1250, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('mvp', 'main', 12, 'rifle.lr300', NULL, 0, 5, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('mvp', 'main', 13, 'smg.mp5', NULL, 0, 5, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('mvp', 'main', 14, 'rifle.l96', NULL, 0, 5, 60.00, 60.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('mvp', 'main', 15, 'lmg.m249', NULL, 0, 5, 500.00, 500.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('mvp', 'main', 16, 'rifle.ak', NULL, 0, 5, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('mvp', 'main', 17, 'rocket.launcher', NULL, 0, 5, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('mvp', 'main', 18, 'm16a2', NULL, 0, 5, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 180),
  ('mvp', 'wear', 0, 'ballistic.helmet', NULL, 0, 5, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('mvp', 'wear', 1, 'ballistic.vest', NULL, 0, 5, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('mvp', 'wear', 2, 'bdu.shirt', NULL, 0, 5, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('mvp', 'wear', 3, 'ballistic.legarmor', NULL, 0, 5, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('mvp', 'wear', 4, 'bdu.pants', NULL, 0, 5, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('mvp', 'wear', 5, 'shoes.boots', NULL, 0, 5, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('mvp', 'wear', 6, 'tactical.gloves', NULL, 0, 5, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('golden', 'main', 0, 'ammo.rocket.basic', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('golden', 'main', 1, 'ammo.rocket.hv', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('golden', 'main', 2, 'ammo.rocket.sam', NULL, 0, 50000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('golden', 'main', 3, 'explosive.timed', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('golden', 'main', 4, 'samsite', NULL, 0, 25, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('golden', 'main', 5, 'ammo.rifle.explosive', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('golden', 'main', 6, 'ammo.rifle', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('golden', 'main', 7, 'ammo.pistol', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('golden', 'main', 8, 'electric.generator.small', NULL, 0, 500, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('golden', 'main', 9, 'autoturret', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('golden', 'main', 10, 'largemedkit', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('golden', 'main', 11, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('golden', 'main', 12, 'black.raspberries', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('golden', 'main', 13, 'rifle.lr300', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('golden', 'main', 14, 'smg.mp5', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('golden', 'main', 15, 'rifle.l96', NULL, 0, 100, 60.00, 60.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('golden', 'main', 16, 'lmg.m249', NULL, 0, 100, 500.00, 500.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('golden', 'main', 17, 'rifle.ak', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('golden', 'main', 18, 'm16a2', NULL, 0, 100, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 180),
  ('golden', 'main', 19, 'rocket.launcher', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 190),
  ('golden', 'wear', 0, 'ballistic.helmet', NULL, 0, 100, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('golden', 'wear', 1, 'ballistic.vest', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('golden', 'wear', 2, 'ballistic.legarmor', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('golden', 'wear', 3, 'bdu.shirt', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('golden', 'wear', 4, 'bdu.pants', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('golden', 'wear', 5, 'shoes.boots', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('golden', 'wear', 6, 'tactical.gloves', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('ultimate', 'main', 0, 'ammo.rocket.hv', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('ultimate', 'main', 1, 'ammo.rocket.basic', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('ultimate', 'main', 2, 'ammo.rifle.explosive', NULL, 0, 200000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('ultimate', 'main', 3, 'ammo.rifle', NULL, 0, 200000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('ultimate', 'main', 4, 'ammo.rocket.sam', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('ultimate', 'main', 5, 'ammo.grenadelauncher.he', NULL, 0, 20000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('ultimate', 'main', 6, 'samsite', NULL, 0, 40, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('ultimate', 'main', 7, 'electric.generator.small', NULL, 0, 1500, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('ultimate', 'main', 8, 'supply.signal', NULL, 0, 10, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('ultimate', 'main', 9, 'autoturret', NULL, 0, 150, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('ultimate', 'main', 10, 'explosive.timed', NULL, 0, 15000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('ultimate', 'main', 11, 'supertea', 'Super Serum', 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('ultimate', 'main', 12, 'syringe.medical', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('ultimate', 'main', 13, 'largemedkit', NULL, 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('ultimate', 'main', 14, 'scrap', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('ultimate', 'main', 15, 'weapon.mod.silencer', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('ultimate', 'main', 16, 'weapon.mod.small.scope', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('ultimate', 'main', 17, 'weapon.mod.lasersight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('ultimate', 'main', 18, 'weapon.mod.holosight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 180),
  ('ultimate', 'main', 19, 'weapon.mod.flashlight', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 190),
  ('ultimate', 'main', 20, 'weapon.mod.8x.scope', NULL, 0, 100, 200.00, 200.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 200),
  ('ultimate', 'main', 21, 'rocket.launcher', NULL, 0, 100, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 210),
  ('ultimate', 'main', 22, 'multiplegrenadelauncher', NULL, 0, 100, 200.00, 200.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 220),
  ('ultimate', 'main', 23, 'black.raspberries', NULL, 0, 30000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 230),
  ('ultimate', 'wear', 0, 'ballistic.helmet', NULL, 0, 100, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('ultimate', 'wear', 1, 'ballistic.vest', NULL, 0, 100, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('ultimate', 'wear', 2, 'ballistic.legarmor', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('ultimate', 'wear', 3, 'bdu.shirt', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('ultimate', 'wear', 4, 'bdu.pants', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('ultimate', 'wear', 5, 'shoes.boots', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('ultimate', 'wear', 6, 'tactical.gloves', NULL, 0, 100, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('ultimate', 'belt', 0, 'rifle.ak', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('ultimate', 'belt', 1, 'lmg.m249', NULL, 0, 100, 500.00, 500.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('ultimate', 'belt', 2, 'rifle.lr300', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('ultimate', 'belt', 3, 'smg.mp5', NULL, 0, 100, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('ultimate', 'belt', 4, 'rifle.l96', NULL, 0, 100, 60.00, 60.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('ultimate', 'belt', 5, 'm16a2', NULL, 0, 100, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 50),
  ('titan', 'main', 0, 'ammo.rocket.basic', NULL, 0, 150000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('titan', 'main', 1, 'ammo.rocket.hv', NULL, 0, 150000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('titan', 'main', 2, 'ammo.pistol', NULL, 0, 500000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('titan', 'main', 3, 'ammo.rifle', NULL, 0, 500000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('titan', 'main', 4, 'ammo.rifle.explosive', NULL, 0, 500000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('titan', 'main', 5, 'samsite', NULL, 0, 50, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('titan', 'main', 6, 'electric.generator.small', NULL, 0, 10000, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('titan', 'main', 7, 'supply.signal', NULL, 0, 35, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 70),
  ('titan', 'main', 8, 'supertea', 'Super Serum', 0, 5000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 80),
  ('titan', 'main', 9, 'autoturret', NULL, 0, 1000, 100.00, 100.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 90),
  ('titan', 'main', 10, 'explosive.timed', NULL, 0, 50000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 100),
  ('titan', 'main', 11, 'metal.refined', NULL, 0, 1000000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 110),
  ('titan', 'main', 12, 'ammo.grenadelauncher.he', NULL, 0, 100000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 120),
  ('titan', 'main', 13, 'grenade.smoke', 'Portafort Token', 0, 25, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 130),
  ('titan', 'main', 14, 'cloth', NULL, 0, 1000000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 140),
  ('titan', 'main', 15, 'scrap', NULL, 0, 1000000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 150),
  ('titan', 'main', 16, 'syringe.medical', NULL, 0, 250000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 160),
  ('titan', 'main', 17, 'largemedkit', NULL, 0, 10000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 170),
  ('titan', 'main', 18, 'black.raspberries', NULL, 0, 500000, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 180),
  ('titan', 'main', 19, 'm16a2', NULL, 0, 500, 200.00, 200.00, 4, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 190),
  ('titan', 'main', 20, 'weapon.mod.holosight', NULL, 0, 5000, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 200),
  ('titan', 'main', 21, 'weapon.mod.lasersight', NULL, 0, 5000, 200.00, 200.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 210),
  ('titan', 'main', 22, 'multiplegrenadelauncher', NULL, 0, 500, 200.00, 200.00, 6, 'ammo.grenadelauncher.he', -1, NULL, NULL, NULL, NULL, 220),
  ('titan', 'wear', 0, 'ballistic.helmet', NULL, 0, 500, 800.00, 800.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  ('titan', 'wear', 1, 'ballistic.vest', NULL, 0, 500, 300.00, 300.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  ('titan', 'wear', 2, 'ballistic.legarmor', NULL, 0, 500, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  ('titan', 'wear', 3, 'bdu.shirt', NULL, 0, 500, 150.00, 150.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  ('titan', 'wear', 4, 'bdu.pants', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  ('titan', 'wear', 5, 'shoes.boots', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  ('titan', 'wear', 6, 'tactical.gloves', NULL, 0, 500, 0.00, 0.00, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  ('titan', 'belt', 0, 'lmg.m249', NULL, 0, 500, 500.00, 500.00, 100, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 0),
  ('titan', 'belt', 1, 'rifle.ak', NULL, 0, 500, 150.00, 150.00, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 10),
  ('titan', 'belt', 2, 'rocket.launcher', NULL, 0, 500, 100.00, 100.00, 0, 'ammo.rocket.basic', -1, NULL, NULL, NULL, NULL, 20),
  ('titan', 'belt', 3, 'rifle.lr300', NULL, 0, 500, 150.00, 150.00, 30, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 30),
  ('titan', 'belt', 4, 'smg.mp5', NULL, 0, 500, 150.00, 150.00, 30, 'ammo.pistol', -1, NULL, NULL, NULL, NULL, 40),
  ('titan', 'belt', 5, 'rifle.l96', NULL, 0, 500, 60.00, 60.00, 5, 'ammo.rifle', -1, NULL, NULL, NULL, NULL, 50);
-- END GENERATED JULY 20 SOURCE ROWS

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_stage_items;
CREATE TEMPORARY TABLE tmp_raidlands_rank_stage_items LIKE tmp_raidlands_rank_source_items;
ALTER TABLE tmp_raidlands_rank_stage_items
  ADD COLUMN target_kit_name varchar(160) NOT NULL FIRST,
  ADD COLUMN target_container enum('main', 'wear', 'belt') NOT NULL AFTER target_kit_name;

INSERT INTO tmp_raidlands_rank_stage_items
  (target_kit_name, target_container, tier, container_name, source_position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, source_sort_order)
SELECT
  CASE
    WHEN source.container_name = 'main'
      AND source.shortname IN (
        'ammo.rocket.sam',
        'electric.generator.small',
        'samsite',
        'autoturret',
        'supply.signal',
        'grenade.smoke',
        'metal.refined',
        'cloth',
        'scrap'
      )
      THEN map.supplies_name
    ELSE map.combat_name
  END,
  CASE
    WHEN source.container_name = 'main'
      AND source.shortname IN (
        'ammo.rocket.sam',
        'electric.generator.small',
        'samsite',
        'autoturret',
        'supply.signal',
        'grenade.smoke',
        'metal.refined',
        'cloth',
        'scrap'
      )
      THEN 'main'
    ELSE source.container_name
  END,
  source.tier,
  source.container_name,
  source.source_position,
  source.shortname,
  source.display_name,
  source.skin,
  source.amount,
  source.condition_value,
  source.max_condition,
  source.ammo,
  source.ammo_type,
  source.frequency,
  source.blueprint_shortname,
  source.text_value,
  source.contents_json,
  source.container_json,
  source.source_sort_order
FROM tmp_raidlands_rank_source_items source
INNER JOIN tmp_raidlands_rank_kit_map map ON map.tier = source.tier
WHERE source.shortname NOT IN (
    'ammo.rocket.basic',
    'explosive.timed',
    'ammo.rifle.explosive'
  )
  AND NOT (source.tier = 'titan' AND source.shortname = 'cloth');

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_materials;
CREATE TEMPORARY TABLE tmp_raidlands_rank_materials (
  tier varchar(32) NOT NULL,
  shortname varchar(160) NOT NULL,
  amount int NOT NULL,
  material_order int NOT NULL,
  PRIMARY KEY (tier, shortname)
);

INSERT INTO tmp_raidlands_rank_materials (tier, shortname, amount, material_order)
VALUES
  ('vip', 'sulfur', 500000, 1),
  ('vip', 'charcoal', 645000, 2),
  ('vip', 'metal.fragments', 70000, 3),
  ('vip', 'lowgradefuel', 6000, 4),
  ('vip', 'metalpipe', 200, 5),
  ('vip', 'cloth', 250, 6),
  ('vip', 'techparts', 100, 7),
  ('vip_plus', 'sulfur', 1200000, 1),
  ('vip_plus', 'charcoal', 1575000, 2),
  ('vip_plus', 'metal.fragments', 150000, 3),
  ('vip_plus', 'lowgradefuel', 15000, 4),
  ('vip_plus', 'metalpipe', 1000, 5),
  ('mvp', 'sulfur', 2425000, 1),
  ('mvp', 'charcoal', 3225000, 2),
  ('mvp', 'metal.fragments', 275000, 3),
  ('mvp', 'lowgradefuel', 45000, 4),
  ('mvp', 'metalpipe', 1000, 5),
  ('mvp', 'cloth', 2500, 6),
  ('mvp', 'techparts', 1000, 7),
  ('golden', 'sulfur', 20500000, 1),
  ('golden', 'charcoal', 27750000, 2),
  ('golden', 'metal.fragments', 2000000, 3),
  ('golden', 'lowgradefuel', 450000, 4),
  ('golden', 'metalpipe', 10000, 5),
  ('golden', 'cloth', 25000, 6),
  ('golden', 'techparts', 10000, 7),
  ('ultimate', 'sulfur', 66000000, 1),
  ('ultimate', 'charcoal', 90000000, 2),
  ('ultimate', 'metal.fragments', 6000000, 3),
  ('ultimate', 'lowgradefuel', 1500000, 4),
  ('ultimate', 'metalpipe', 40000, 5),
  ('ultimate', 'cloth', 75000, 6),
  ('ultimate', 'techparts', 30000, 7),
  ('titan', 'sulfur', 332500000, 1),
  ('titan', 'charcoal', 457500000, 2),
  ('titan', 'metal.fragments', 27500000, 3),
  ('titan', 'lowgradefuel', 7500000, 4),
  ('titan', 'metalpipe', 300000, 5),
  ('titan', 'cloth', 1250000, 6),
  ('titan', 'techparts', 100000, 7);

INSERT INTO tmp_raidlands_rank_stage_items
  (target_kit_name, target_container, tier, container_name, source_position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, source_sort_order)
SELECT
  map.supplies_name,
  'main',
  materials.tier,
  'main',
  1000 + materials.material_order,
  materials.shortname,
  NULL,
  0,
  materials.amount,
  0,
  0,
  0,
  NULL,
  -1,
  NULL,
  NULL,
  NULL,
  NULL,
  10000 + (materials.material_order * 10)
FROM tmp_raidlands_rank_materials materials
INNER JOIN tmp_raidlands_rank_kit_map map ON map.tier = materials.tier;

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_final_items;
CREATE TEMPORARY TABLE tmp_raidlands_rank_final_items (
  target_kit_name varchar(160) NOT NULL,
  container_name enum('main', 'wear', 'belt') NOT NULL,
  position int NOT NULL,
  shortname varchar(160) NOT NULL,
  display_name varchar(160) NULL,
  skin bigint unsigned NOT NULL DEFAULT 0,
  amount int NOT NULL,
  condition_value decimal(10,2) NOT NULL DEFAULT 0,
  max_condition decimal(10,2) NOT NULL DEFAULT 0,
  ammo int NOT NULL DEFAULT 0,
  ammo_type varchar(160) NULL,
  frequency int NOT NULL DEFAULT -1,
  blueprint_shortname varchar(160) NULL,
  text_value text NULL,
  contents_json longtext NULL,
  container_json longtext NULL,
  sort_order int NOT NULL,
  PRIMARY KEY (target_kit_name, container_name, position)
);

INSERT INTO tmp_raidlands_rank_final_items
  (target_kit_name, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, sort_order)
SELECT
  ranked.target_kit_name,
  ranked.target_container,
  ranked.position,
  ranked.shortname,
  ranked.display_name,
  ranked.skin,
  ranked.amount,
  ranked.condition_value,
  ranked.max_condition,
  ranked.ammo,
  ranked.ammo_type,
  ranked.frequency,
  ranked.blueprint_shortname,
  ranked.text_value,
  ranked.contents_json,
  ranked.container_json,
  ranked.position * 10
FROM (
  SELECT
    stage.*,
    ROW_NUMBER() OVER (
      PARTITION BY stage.target_kit_name, stage.target_container
      ORDER BY stage.source_position, stage.source_sort_order, stage.shortname
    ) - 1 AS position
  FROM tmp_raidlands_rank_stage_items stage
) ranked;

START TRANSACTION;

UPDATE game_kits kits
INNER JOIN tmp_raidlands_rank_kit_map map ON map.existing_id = kits.id
SET kits.kit_name = map.combat_name,
    kits.previous_kit_name = map.old_name,
    kits.description = CONCAT(map.combat_label, ' contains the restored July 20 weapons, ammunition, armor, healing, food, tea, launchers, and weapon mods.'),
    kits.required_permission = map.combat_permission,
    kits.maximum_uses = map.maximum_uses,
    kits.required_auth = 0,
    kits.cooldown_seconds = map.cooldown_seconds,
    kits.cost = 0,
    kits.is_hidden = 0,
    kits.copy_paste_file = '',
    kits.is_active = 1,
    kits.sort_order = map.sort_order,
    kits.reward_enabled = 0,
    kits.draft_revision = @raidlands_rank_kit_revision,
    kits.published_revision = @raidlands_rank_kit_revision,
    kits.published_at = NOW(),
    kits.deleted_at = NULL,
    kits.deleted_revision = 0,
    kits.updated_at = NOW();

INSERT INTO game_kits
  (kit_name, previous_kit_name, description, required_permission, maximum_uses, required_auth, cooldown_seconds, cost, is_hidden, copy_paste_file, image_path, is_active, sort_order, reward_enabled, reward_product_id, reward_display_name, reward_description, reward_cost, reward_cooldown, reward_icon_url, reward_permission, draft_revision, published_revision, published_at, deleted_at, deleted_revision)
SELECT
  map.supplies_name,
  '',
  CONCAT(map.supplies_label, ' contains the restored July 20 resources, defensive utility, supply signals, Portafort tokens, and exact base-material boom conversion.'),
  map.supplies_permission,
  map.maximum_uses,
  0,
  map.cooldown_seconds,
  0,
  0,
  '',
  combat.image_path,
  1,
  map.sort_order + 1,
  0,
  -1,
  '',
  '',
  0,
  0,
  '',
  '',
  @raidlands_rank_kit_revision,
  @raidlands_rank_kit_revision,
  NOW(),
  NULL,
  0
FROM tmp_raidlands_rank_kit_map map
INNER JOIN game_kits combat ON combat.id = map.existing_id
ON DUPLICATE KEY UPDATE
  previous_kit_name = '',
  description = VALUES(description),
  required_permission = VALUES(required_permission),
  maximum_uses = VALUES(maximum_uses),
  required_auth = 0,
  cooldown_seconds = VALUES(cooldown_seconds),
  cost = 0,
  is_hidden = 0,
  copy_paste_file = '',
  image_path = VALUES(image_path),
  is_active = 1,
  sort_order = VALUES(sort_order),
  reward_enabled = 0,
  draft_revision = @raidlands_rank_kit_revision,
  published_revision = @raidlands_rank_kit_revision,
  published_at = NOW(),
  deleted_at = NULL,
  deleted_revision = 0,
  updated_at = NOW();

DELETE items
FROM game_kit_items items
INNER JOIN game_kits kits ON kits.id = items.kit_id
WHERE kits.kit_name IN (
  'vip_combat', 'vip_supplies',
  'vip_plus_combat', 'vip_plus_supplies',
  'mvp_combat', 'mvp_supplies',
  'golden_combat', 'golden_supplies',
  'ultimate_combat', 'ultimate_supplies',
  'titan_combat', 'titan_supplies'
);

INSERT INTO game_kit_items
  (kit_id, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, sort_order)
SELECT
  kits.id,
  final.container_name,
  final.position,
  final.shortname,
  final.display_name,
  final.skin,
  final.amount,
  final.condition_value,
  final.max_condition,
  final.ammo,
  final.ammo_type,
  final.frequency,
  final.blueprint_shortname,
  final.text_value,
  final.contents_json,
  final.container_json,
  final.sort_order
FROM tmp_raidlands_rank_final_items final
INNER JOIN game_kits kits ON kits.kit_name = final.target_kit_name
ORDER BY kits.id, FIELD(final.container_name, 'main', 'wear', 'belt'), final.position;

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('kits.vip.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.vipplus.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.mvp.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.goldenvip.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.ultimatevip.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.titanvip.supplies', 'Kits', 'kits', 'rank-kit-split', 1, NOW())
ON DUPLICATE KEY UPDATE
  plugin_name = 'Kits',
  permission_prefix = 'kits',
  source = 'rank-kit-split',
  is_active = 1,
  last_seen_at = NOW(),
  updated_at = NOW();

INSERT IGNORE INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('kits.vip', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.vipplus', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.mvp', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.goldenvip', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.ultimatevip', 'Kits', 'kits', 'rank-kit-split', 1, NOW()),
  ('kits.titanvip', 'Kits', 'kits', 'rank-kit-split', 1, NOW());

DELETE grants
FROM oxide_group_permission_grants grants
INNER JOIN oxide_permissions permissions ON permissions.id = grants.permission_id
WHERE permissions.permission_name IN (
  'kits.vip.supplies',
  'kits.vipplus.supplies',
  'kits.mvp.supplies',
  'kits.goldenvip.supplies',
  'kits.ultimatevip.supplies',
  'kits.titanvip.supplies'
);

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT rank_groups.id, permissions.id, 'rank-kit-split'
FROM oxide_groups rank_groups
INNER JOIN oxide_permissions permissions
  ON permissions.permission_name = CASE rank_groups.group_name
    WHEN 'rank_vip' THEN 'kits.vip.supplies'
    WHEN 'rank_vip_plus' THEN 'kits.vipplus.supplies'
    WHEN 'rank_mvp' THEN 'kits.mvp.supplies'
    WHEN 'rank_golden_vip' THEN 'kits.goldenvip.supplies'
    WHEN 'rank_ultimate_vip' THEN 'kits.ultimatevip.supplies'
    WHEN 'rank_titan_vip' THEN 'kits.titanvip.supplies'
    ELSE ''
  END
WHERE rank_groups.group_name IN (
  'rank_vip',
  'rank_vip_plus',
  'rank_mvp',
  'rank_golden_vip',
  'rank_ultimate_vip',
  'rank_titan_vip'
);

INSERT IGNORE INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT rank_groups.id, permissions.id, 'rank-kit-split'
FROM oxide_groups rank_groups
INNER JOIN oxide_permissions permissions
  ON permissions.permission_name = CASE rank_groups.group_name
    WHEN 'rank_vip' THEN 'kits.vip'
    WHEN 'rank_vip_plus' THEN 'kits.vipplus'
    WHEN 'rank_mvp' THEN 'kits.mvp'
    WHEN 'rank_golden_vip' THEN 'kits.goldenvip'
    WHEN 'rank_ultimate_vip' THEN 'kits.ultimatevip'
    WHEN 'rank_titan_vip' THEN 'kits.titanvip'
    ELSE ''
  END
WHERE rank_groups.group_name IN (
  'rank_vip',
  'rank_vip_plus',
  'rank_mvp',
  'rank_golden_vip',
  'rank_ultimate_vip',
  'rank_titan_vip'
);

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT rank_groups.id, permissions.id, 'rank-kit-split'
FROM oxide_groups rank_groups
INNER JOIN oxide_permissions permissions
  ON permissions.permission_name IN (
    'kits.vip.supplies',
    'kits.vipplus.supplies',
    'kits.goldenvip.supplies'
  )
WHERE rank_groups.group_name = 'rank_diamond_vip';

INSERT IGNORE INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT rank_groups.id, permissions.id, 'rank-kit-split'
FROM oxide_groups rank_groups
INNER JOIN oxide_permissions permissions
  ON permissions.permission_name IN (
    'kits.vip',
    'kits.vipplus',
    'kits.goldenvip'
  )
WHERE rank_groups.group_name = 'rank_diamond_vip';

UPDATE oxide_groups
SET draft_revision = @raidlands_rank_permission_revision,
    published_revision = @raidlands_rank_permission_revision,
    published_at = NOW(),
    updated_at = NOW()
WHERE group_name IN (
  'rank_vip',
  'rank_vip_plus',
  'rank_mvp',
  'rank_golden_vip',
  'rank_diamond_vip',
  'rank_ultimate_vip',
  'rank_titan_vip'
);

-- The standalone rank-kit redemption offers remain in history but cannot be sold.
UPDATE store_products
SET is_active = 0,
    is_featured = 0,
    updated_at = NOW()
WHERE slug IN (
  'redeem-kit-vip',
  'redeem-kit-vip-plus',
  'redeem-kit-mvp',
  'redeem-kit-golden-vip',
  'redeem-kit-ultimate-vip',
  'redeem-kit-titan-vip'
);

UPDATE store_prices prices
INNER JOIN store_products products ON products.id = prices.product_id
SET prices.is_active = 0,
    prices.updated_at = NOW()
WHERE products.slug IN (
  'redeem-kit-vip',
  'redeem-kit-vip-plus',
  'redeem-kit-mvp',
  'redeem-kit-golden-vip',
  'redeem-kit-ultimate-vip',
  'redeem-kit-titan-vip'
);

-- Freeze the twelve-kit payload now. The sync endpoint will replay this exact JSON
-- even if a later snapshot changes current rows before the Rust server requests it.
SET @raidlands_rank_kit_payload := (
  SELECT JSON_OBJECT(
    'revision', @raidlands_rank_kit_revision,
    'generated_at', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
    'kits', (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'Name', kits.kit_name,
          'PreviousName', COALESCE(kits.previous_kit_name, ''),
          'PreviousNames', CASE
            WHEN COALESCE(kits.previous_kit_name, '') = '' THEN JSON_ARRAY()
            ELSE JSON_ARRAY(kits.previous_kit_name)
          END,
          'Description', COALESCE(kits.description, ''),
          'RequiredPermission', kits.required_permission,
          'MaximumUses', kits.maximum_uses,
          'RequiredAuth', kits.required_auth,
          'Cooldown', kits.cooldown_seconds,
          'Cost', kits.cost,
          'IsHidden', IF(kits.is_hidden = 1, JSON_EXTRACT('true', '$'), JSON_EXTRACT('false', '$')),
          'CopyPasteFile', kits.copy_paste_file,
          'KitImage', CASE
            WHEN kits.image_path LIKE '/%' THEN CONCAT('https://raidlands.net', kits.image_path)
            ELSE kits.image_path
          END,
          'IsActive', IF(kits.is_active = 1, JSON_EXTRACT('true', '$'), JSON_EXTRACT('false', '$')),
          'MainItems', COALESCE((
            SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'Shortname', items.shortname,
              'DisplayName', items.display_name,
              'Skin', items.skin,
              'Amount', items.amount,
              'Condition', items.condition_value,
              'MaxCondition', items.max_condition,
              'Ammo', items.ammo,
              'Ammotype', items.ammo_type,
              'Position', items.position,
              'Frequency', items.frequency,
              'BlueprintShortname', items.blueprint_shortname,
              'Text', items.text_value,
              'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
              'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
            ))
            FROM game_kit_items items
            WHERE items.kit_id = kits.id AND items.container_name = 'main'
          ), JSON_ARRAY()),
          'WearItems', COALESCE((
            SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'Shortname', items.shortname,
              'DisplayName', items.display_name,
              'Skin', items.skin,
              'Amount', items.amount,
              'Condition', items.condition_value,
              'MaxCondition', items.max_condition,
              'Ammo', items.ammo,
              'Ammotype', items.ammo_type,
              'Position', items.position,
              'Frequency', items.frequency,
              'BlueprintShortname', items.blueprint_shortname,
              'Text', items.text_value,
              'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
              'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
            ))
            FROM game_kit_items items
            WHERE items.kit_id = kits.id AND items.container_name = 'wear'
          ), JSON_ARRAY()),
          'BeltItems', COALESCE((
            SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'Shortname', items.shortname,
              'DisplayName', items.display_name,
              'Skin', items.skin,
              'Amount', items.amount,
              'Condition', items.condition_value,
              'MaxCondition', items.max_condition,
              'Ammo', items.ammo,
              'Ammotype', items.ammo_type,
              'Position', items.position,
              'Frequency', items.frequency,
              'BlueprintShortname', items.blueprint_shortname,
              'Text', items.text_value,
              'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
              'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
            ))
            FROM game_kit_items items
            WHERE items.kit_id = kits.id AND items.container_name = 'belt'
          ), JSON_ARRAY())
        )
      )
      FROM game_kits kits
      WHERE kits.kit_name IN (
        'vip_combat', 'vip_supplies',
        'vip_plus_combat', 'vip_plus_supplies',
        'mvp_combat', 'mvp_supplies',
        'golden_combat', 'golden_supplies',
        'ultimate_combat', 'ultimate_supplies',
        'titan_combat', 'titan_supplies'
      )
    ),
    'server_rewards_kits', JSON_ARRAY()
  )
);

UPDATE game_kit_sync_log
SET status = 'failed',
    message = 'Superseded by a newer July 20 rank-kit split revision.',
    error_text = 'Superseded before acknowledgement by a newer migration 076 payload.',
    updated_at = NOW()
WHERE status = 'pending'
  AND payload_json IS NOT NULL
  AND JSON_SEARCH(payload_json, 'one', 'vip_combat') IS NOT NULL
  AND JSON_SEARCH(payload_json, 'one', 'titan_supplies') IS NOT NULL;

UPDATE oxide_permission_sync_log
SET status = 'failed',
    message = 'Superseded by a newer July 20 rank-kit permission revision.',
    error_text = 'Superseded before acknowledgement by a newer migration 076 publication.',
    updated_at = NOW()
WHERE status = 'pending'
  AND message = 'Published six rank Supplies permissions and matching Diamond inheritance.';

INSERT INTO game_kit_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (
    @raidlands_rank_kit_revision,
    'pending',
    CAST(@raidlands_rank_kit_payload AS CHAR CHARACTER SET utf8mb4),
    SHA2(CAST(@raidlands_rank_kit_payload AS CHAR CHARACTER SET utf8mb4), 256),
    'Restored and split the six July 20 rank kits; rank RP products are disabled.'
  );

INSERT INTO oxide_permission_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (
    @raidlands_rank_permission_revision,
    'pending',
    NULL,
    '',
    'Published six rank Supplies permissions and matching Diamond inheritance.'
  );

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_final_items;
DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_materials;
DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_stage_items;
DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_source_items;
DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_rank_kit_map;
