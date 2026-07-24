-- Migration 079: literal restore of the nine combat/reward kits.
--
-- Migration 078 only republished live rows. If the live server snapshot had
-- already replaced those rows, it republished the wrong definitions. This
-- migration first replaces metadata and every item row with pinned July 20
-- values, then appends the corrected definitions to the frozen managed payload.
--
-- Authoritative source:
-- database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql
-- SHA-256: 7324E1C5AF488C86C3E0A96DE0A0D9C4A6A39163EF3BB79C41CF795A69F3E495

SET @raidlands_combat_kit_revision := GREATEST(
  COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM game_kits), 0),
  COALESCE((SELECT MAX(revision) FROM game_kit_sync_log WHERE status <> 'snapshot'), 0)
) + 1;

SET @raidlands_previous_managed_kits_json := COALESCE((
  SELECT JSON_EXTRACT(payload_json, '$.kits')
  FROM game_kit_sync_log
  WHERE message = 'Republished all active July 20 ordinary kits with exact slot positions.'
    AND payload_json IS NOT NULL
  ORDER BY revision DESC, id DESC
  LIMIT 1
), JSON_ARRAY());

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_combat_kits;
CREATE TEMPORARY TABLE tmp_raidlands_combat_kits (
  kit_name varchar(160) NOT NULL PRIMARY KEY,
  description text NOT NULL,
  required_permission varchar(160) NOT NULL,
  maximum_uses int NOT NULL,
  cooldown_seconds int NOT NULL,
  image_path varchar(500) NOT NULL,
  sort_order int NOT NULL,
  reward_enabled tinyint NOT NULL,
  reward_product_id int NOT NULL,
  reward_display_name varchar(160) NOT NULL,
  reward_description text NOT NULL,
  reward_cost int NOT NULL,
  reward_icon_url varchar(500) NOT NULL
);

INSERT INTO tmp_raidlands_combat_kits VALUES
  ('ak', 'Default combat kit.', 'kits.claim.ak', 0, 391, '/assets/media/kits/ak-kit.webp', 100, 1, 1395, 'ak', 'Default combat kit.', 175, 'https://raidlands.net/assets/media/kits/ak-kit.png'),
  ('lr300', 'Default combat kit.', 'kits.claim.lr300', 0, 390, '/assets/media/kits/lr300-kit.webp', 110, 1, 1396, 'lr300', 'Default combat kit.', 170, 'https://raidlands.net/assets/media/kits/lr300-kit.png'),
  ('m16', 'Custom weapon/skin key needs final confirmation.', 'kits.claim.m16a2', 0, 390, '/assets/media/kits/m16a2-kit.webp', 120, 1, 1397, 'm16', 'Custom weapon/skin key needs final confirmation.', 185, 'https://raidlands.net/assets/media/kits/m16a2-kit.png'),
  ('mp5', 'Default combat kit.', 'kits.claim.mp5', 0, 390, '/assets/media/kits/mp5-kit.webp', 130, 1, 1398, 'mp5', 'Default combat kit.', 150, 'https://raidlands.net/assets/media/kits/mp5-kit.png'),
  ('steam', 'Outside shop purchase flow.', 'kits.claim.steam_rewards', 0, 600, '/assets/media/kits/steam-rewards-kit.webp', 140, 0, -1, '', '', 0, ''),
  ('steam_name_rewards', 'Outside shop purchase flow.', 'kits.claim.steam_name_rewards', 0, 600, '/assets/media/kits/steam-name-rewards-kit.webp', 140, 0, -1, '', '', 0, ''),
  ('discord', 'Outside shop purchase flow.', 'kits.claim.discord', 0, 390, '/assets/media/kits/discord-kit.webp', 150, 0, -1, '', '', 0, ''),
  ('discord_booster', 'Outside shop purchase flow; booster role sync required.', 'kits.claim.discord_booster', 0, 1800, '/assets/media/kits/discord-booster-kit.webp', 160, 0, -1, '', '', 0, ''),
  ('discord_raid', 'Max uses shown as 15.', 'kits.claim.discord_raid', 15, 3600, '/assets/media/kits/discord-raid-kit.webp', 190, 0, -1, '', '', 0, '');

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_combat_items;
CREATE TEMPORARY TABLE tmp_raidlands_combat_items (
  kit_name varchar(160) NOT NULL,
  container_name varchar(8) NOT NULL,
  position int NOT NULL,
  shortname varchar(160) NOT NULL,
  amount int NOT NULL,
  condition_value decimal(10,2) NOT NULL DEFAULT 0,
  max_condition decimal(10,2) NOT NULL DEFAULT 0,
  ammo int NOT NULL DEFAULT 0,
  ammo_type varchar(160) NULL,
  sort_order int NOT NULL,
  PRIMARY KEY (kit_name, container_name, position)
);

-- Exact ordinary weapon-kit main containers.
INSERT INTO tmp_raidlands_combat_items VALUES
  ('ak','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('ak','main',18,'weapon.mod.holosight',1,0,0,0,NULL,10),
  ('ak','main',19,'weapon.mod.extendedmags',1,0,0,0,NULL,20),
  ('ak','main',20,'weapon.mod.lasersight',1,0,0,0,NULL,30),
  ('lr300','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('lr300','main',18,'weapon.mod.holosight',1,0,0,0,NULL,10),
  ('lr300','main',19,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('lr300','main',20,'weapon.mod.extendedmags',1,0,0,0,NULL,30),
  ('m16','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('m16','main',1,'weapon.mod.holosight',1,300,300,0,NULL,10),
  ('m16','main',2,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('m16','main',3,'weapon.mod.extendedmags',1,100,100,0,NULL,30),
  ('mp5','main',0,'ammo.pistol',2500,0,0,0,NULL,0),
  ('mp5','main',1,'weapon.mod.holosight',1,300,300,0,NULL,10),
  ('mp5','main',2,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('mp5','main',3,'weapon.mod.extendedmags',1,100,100,0,NULL,30),
  ('steam','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('steam','main',1,'weapon.mod.holosight',1,300,300,0,NULL,10),
  ('steam','main',2,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('steam','main',3,'weapon.mod.extendedmags',1,100,100,0,NULL,30),
  ('steam_name_rewards','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('steam_name_rewards','main',1,'weapon.mod.holosight',1,300,300,0,NULL,10),
  ('steam_name_rewards','main',2,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('steam_name_rewards','main',3,'weapon.mod.extendedmags',1,100,100,0,NULL,30),
  ('discord','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('discord','main',1,'weapon.mod.holosight',1,300,300,0,NULL,10),
  ('discord','main',2,'weapon.mod.lasersight',1,0,0,0,NULL,20),
  ('discord','main',3,'weapon.mod.extendedmags',1,100,100,0,NULL,30);

-- Discord Booster and Discord Raid retain their special July 20 contents.
INSERT INTO tmp_raidlands_combat_items VALUES
  ('discord_booster','main',0,'ammo.rifle',2500,0,0,0,NULL,0),
  ('discord_booster','main',1,'weapon.mod.holosight',25,300,300,0,NULL,10),
  ('discord_booster','main',2,'weapon.mod.lasersight',25,0,0,0,NULL,20),
  ('discord_booster','main',3,'weapon.mod.extendedmags',25,100,100,0,NULL,30),
  ('discord_booster','main',4,'rifle.l96',25,60,60,5,'ammo.rifle',40),
  ('discord_booster','main',5,'m16a2',25,200,200,30,'ammo.rifle',50),
  ('discord_booster','main',6,'rifle.ak',25,150,150,30,'ammo.rifle',60),
  ('discord_booster','main',7,'ammo.rocket.basic',25,0,0,0,NULL,70),
  ('discord_booster','main',8,'ammo.rocket.hv',25,0,0,0,NULL,80),
  ('discord_booster','main',10,'weapon.mod.8x.scope',25,0,0,0,NULL,90),
  ('discord_booster','main',11,'rifle.lr300',25,150,150,0,NULL,100),
  ('discord_raid','main',0,'ammo.rifle',4000,0,0,0,NULL,0),
  ('discord_raid','main',1,'ammo.rifle.explosive',10000,0,0,0,NULL,10),
  ('discord_raid','main',2,'ammo.rocket.hv',35,0,0,0,NULL,20),
  ('discord_raid','main',3,'ammo.rocket.basic',35,0,0,0,NULL,30),
  ('discord_raid','main',18,'weapon.mod.holosight',1,0,0,0,NULL,40),
  ('discord_raid','main',19,'weapon.mod.lasersight',1,0,0,0,NULL,50),
  ('discord_raid','main',20,'weapon.mod.muzzleboost',1,100,100,0,NULL,60);

-- Common wear layout. Booster grants 25 of each piece; the other kits grant 1.
INSERT INTO tmp_raidlands_combat_items
  (kit_name, container_name, position, shortname, amount, condition_value, max_condition, ammo, ammo_type, sort_order)
SELECT kits.kit_name, 'wear', wear.position, wear.shortname,
       IF(kits.kit_name = 'discord_booster', 25, 1),
       wear.condition_value, wear.max_condition, 0, NULL, wear.sort_order
FROM tmp_raidlands_combat_kits kits
CROSS JOIN (
  SELECT 0 position, 'metal.facemask' shortname, 320 condition_value, 320 max_condition, 0 sort_order
  UNION ALL SELECT 1, 'metal.plate.torso', 360, 360, 10
  UNION ALL SELECT 2, 'roadsign.kilt', 150, 150, 20
  UNION ALL SELECT 3, 'hoodie', 0, 0, 30
  UNION ALL SELECT 4, 'pants', 0, 0, 40
  UNION ALL SELECT 5, 'shoes.boots', 0, 0, 50
  UNION ALL SELECT 6, 'tactical.gloves', 0, 0, 60
) wear;

-- Standard combat belts. LR300's source typo of 1 syringe is intentionally
-- corrected to the explicitly requested 100.
INSERT INTO tmp_raidlands_combat_items VALUES
  ('ak','belt',0,'rifle.ak',1,150,150,30,'ammo.rifle',0),
  ('lr300','belt',0,'rifle.lr300',1,150,150,30,'ammo.rifle',0),
  ('m16','belt',0,'m16a2',1,200,200,4,'ammo.rifle',0),
  ('mp5','belt',0,'smg.mp5',1,150,150,30,'ammo.pistol',0),
  ('steam','belt',0,'rifle.lr300',1,150,150,30,'ammo.rifle',0),
  ('steam_name_rewards','belt',0,'rifle.lr300',1,150,150,30,'ammo.rifle',0),
  ('discord','belt',0,'rifle.lr300',1,150,150,30,'ammo.rifle',0);

INSERT INTO tmp_raidlands_combat_items
  (kit_name, container_name, position, shortname, amount, condition_value, max_condition, ammo, ammo_type, sort_order)
SELECT kits.kit_name, 'belt', belt.position, belt.shortname, belt.amount, 0, 0, 0, NULL, belt.sort_order
FROM tmp_raidlands_combat_kits kits
CROSS JOIN (
  SELECT 1 position, 'syringe.medical' shortname, 100 amount, 10 sort_order
  UNION ALL SELECT 2, 'black.raspberries', 65, 20
  UNION ALL SELECT 3, 'largemedkit', 65, 30
  UNION ALL SELECT 5, 'barricade.wood.cover', 20, 40
) belt
WHERE kits.kit_name IN ('ak','lr300','m16','mp5','steam','steam_name_rewards','discord');

INSERT INTO tmp_raidlands_combat_items VALUES
  ('discord_booster','belt',0,'rifle.lr300',1,150,150,30,'ammo.rifle',0),
  ('discord_booster','belt',1,'syringe.medical',100,0,0,0,NULL,10),
  ('discord_booster','belt',2,'black.raspberries',65,0,0,0,NULL,20),
  ('discord_booster','belt',3,'largemedkit',65,0,0,0,NULL,30),
  ('discord_booster','belt',4,'rocket.launcher',1,100,100,0,NULL,40),
  ('discord_booster','belt',5,'barricade.wood.cover',20,100,100,0,'ammo.rocket.basic',50),
  ('discord_raid','belt',0,'lmg.m249',1,500,500,30,'ammo.rifle',0),
  ('discord_raid','belt',1,'syringe.medical',100,0,0,0,NULL,10),
  ('discord_raid','belt',2,'largemedkit',65,0,0,0,NULL,20),
  ('discord_raid','belt',3,'black.raspberries',65,0,0,0,NULL,30),
  ('discord_raid','belt',4,'explosive.timed',25,0,0,0,NULL,40),
  ('discord_raid','belt',5,'rocket.launcher',1,100,100,0,'ammo.rocket.basic',50);

START TRANSACTION;

UPDATE game_kits kits
INNER JOIN tmp_raidlands_combat_kits source ON source.kit_name = kits.kit_name
SET kits.previous_kit_name = '',
    kits.description = source.description,
    kits.required_permission = source.required_permission,
    kits.maximum_uses = source.maximum_uses,
    kits.required_auth = 0,
    kits.cooldown_seconds = source.cooldown_seconds,
    kits.cost = 0,
    kits.is_hidden = 0,
    kits.copy_paste_file = '',
    kits.image_path = source.image_path,
    kits.is_active = 1,
    kits.sort_order = source.sort_order,
    kits.reward_enabled = source.reward_enabled,
    kits.reward_product_id = source.reward_product_id,
    kits.reward_display_name = source.reward_display_name,
    kits.reward_description = source.reward_description,
    kits.reward_cost = source.reward_cost,
    kits.reward_cooldown = 0,
    kits.reward_icon_url = source.reward_icon_url,
    kits.reward_permission = '',
    kits.draft_revision = @raidlands_combat_kit_revision,
    kits.published_revision = @raidlands_combat_kit_revision,
    kits.published_at = UTC_TIMESTAMP(),
    kits.deleted_at = NULL,
    kits.deleted_revision = 0,
    kits.updated_at = NOW();

DELETE items
FROM game_kit_items items
INNER JOIN game_kits kits ON kits.id = items.kit_id
INNER JOIN tmp_raidlands_combat_kits source ON source.kit_name = kits.kit_name;

INSERT INTO game_kit_items
  (
    kit_id, container_name, position, shortname, display_name, skin, amount,
    condition_value, max_condition, ammo, ammo_type, frequency,
    blueprint_shortname, text_value, contents_json, container_json, sort_order
  )
SELECT
  kits.id, source.container_name, source.position, source.shortname, NULL, 0,
  source.amount, source.condition_value, source.max_condition, source.ammo,
  source.ammo_type, -1, NULL, NULL, NULL, NULL, source.sort_order
FROM tmp_raidlands_combat_items source
INNER JOIN game_kits kits ON kits.kit_name = source.kit_name;

-- Build corrected objects only after the literal rows have replaced live data.
SET @raidlands_corrected_combat_kits_json := (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
      'Name', kits.kit_name,
      'PreviousName', '',
      'PreviousNames', JSON_ARRAY(),
      'Description', COALESCE(kits.description, ''),
      'RequiredPermission', kits.required_permission,
      'MaximumUses', kits.maximum_uses,
      'RequiredAuth', kits.required_auth,
      'Cooldown', kits.cooldown_seconds,
      'Cost', kits.cost,
      'IsHidden', JSON_EXTRACT('false', '$'),
      'CopyPasteFile', kits.copy_paste_file,
      'KitImage', CONCAT('https://raidlands.net', kits.image_path),
      'IsActive', JSON_EXTRACT('true', '$'),
      'MainItems', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'Shortname', i.shortname, 'DisplayName', i.display_name, 'Skin', i.skin,
          'Amount', i.amount, 'Condition', i.condition_value, 'MaxCondition', i.max_condition,
          'Ammo', i.ammo, 'Ammotype', i.ammo_type, 'Position', i.position,
          'Frequency', i.frequency, 'BlueprintShortname', i.blueprint_shortname,
          'Text', i.text_value, 'Contents', NULL, 'Container', NULL
        )) FROM game_kit_items i WHERE i.kit_id = kits.id AND i.container_name = 'main'
      ), JSON_ARRAY()),
      'WearItems', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'Shortname', i.shortname, 'DisplayName', i.display_name, 'Skin', i.skin,
          'Amount', i.amount, 'Condition', i.condition_value, 'MaxCondition', i.max_condition,
          'Ammo', i.ammo, 'Ammotype', i.ammo_type, 'Position', i.position,
          'Frequency', i.frequency, 'BlueprintShortname', i.blueprint_shortname,
          'Text', i.text_value, 'Contents', NULL, 'Container', NULL
        )) FROM game_kit_items i WHERE i.kit_id = kits.id AND i.container_name = 'wear'
      ), JSON_ARRAY()),
      'BeltItems', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'Shortname', i.shortname, 'DisplayName', i.display_name, 'Skin', i.skin,
          'Amount', i.amount, 'Condition', i.condition_value, 'MaxCondition', i.max_condition,
          'Ammo', i.ammo, 'Ammotype', i.ammo_type, 'Position', i.position,
          'Frequency', i.frequency, 'BlueprintShortname', i.blueprint_shortname,
          'Text', i.text_value, 'Contents', NULL, 'Container', NULL
        )) FROM game_kit_items i WHERE i.kit_id = kits.id AND i.container_name = 'belt'
      ), JSON_ARRAY())
    )
  )
  FROM game_kits kits
  INNER JOIN tmp_raidlands_combat_kits source ON source.kit_name = kits.kit_name
);

-- Corrected duplicate names are intentionally appended last. WebsiteVipBridge
-- applies payload entries in order, so these pinned definitions overwrite the
-- stale copies inside migration 078's already-frozen payload.
SET @raidlands_literal_combat_payload := JSON_OBJECT(
  'revision', @raidlands_combat_kit_revision,
  'generated_at', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
  'kits', JSON_MERGE_PRESERVE(
    @raidlands_previous_managed_kits_json,
    @raidlands_corrected_combat_kits_json
  ),
  'server_rewards_kits', JSON_ARRAY()
);

UPDATE game_kit_sync_log
SET status = 'failed',
    message = 'Superseded by migration 079 literal combat-kit restore.',
    error_text = 'Migration 078 republished live rows; migration 079 replaces the nine affected kits with pinned July 20 definitions.',
    updated_at = NOW()
WHERE status = 'pending'
  AND message IN (
    'Republished all active July 20 ordinary kits with exact slot positions.',
    'Literally restored nine July 20 combat and community reward kits.'
  );

INSERT INTO game_kit_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES (
  @raidlands_combat_kit_revision,
  'pending',
  CAST(@raidlands_literal_combat_payload AS CHAR CHARACTER SET utf8mb4),
  SHA2(CAST(@raidlands_literal_combat_payload AS CHAR CHARACTER SET utf8mb4), 256),
  'Literally restored nine July 20 combat and community reward kits.'
);

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_combat_items;
DROP TEMPORARY TABLE IF EXISTS tmp_raidlands_combat_kits;
