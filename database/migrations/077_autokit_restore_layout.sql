-- Migration 077: restore the exact July 20 Auto Kit layout and publish it with
-- the already-frozen twelve rank kits from migration 076.
--
-- Authoritative source:
-- database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql
-- SHA-256: 7324E1C5AF488C86C3E0A96DE0A0D9C4A6A39163EF3BB79C41CF795A69F3E495

SET @raidlands_autokit_revision := GREATEST(
  COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM game_kits), 0),
  COALESCE((SELECT MAX(revision) FROM game_kit_sync_log WHERE status <> 'snapshot'), 0)
) + 1;

-- Preserve migration 076's frozen payload before superseding its pending log.
-- This prevents a newer Auto Kit publication from stranding the rank-kit update
-- or rebuilding those twelve kits from rows that a snapshot may have changed.
SET @raidlands_rank_kits_json := COALESCE((
  SELECT JSON_EXTRACT(payload_json, '$.kits')
  FROM game_kit_sync_log
  WHERE message = 'Restored and split the six July 20 rank kits; rank RP products are disabled.'
    AND payload_json IS NOT NULL
  ORDER BY revision DESC, id DESC
  LIMIT 1
), JSON_ARRAY());

START TRANSACTION;

UPDATE game_kits
SET previous_kit_name = '',
    description = 'default player spawn kit',
    required_permission = 'kits.autokit',
    maximum_uses = 999999,
    required_auth = 0,
    cooldown_seconds = 1,
    cost = 0,
    is_hidden = 1,
    copy_paste_file = '',
    image_path = '/assets/media/kits/autokit.webp',
    is_active = 1,
    sort_order = 1,
    reward_enabled = 0,
    reward_product_id = -1,
    reward_display_name = '',
    reward_description = '',
    reward_cost = 0,
    reward_cooldown = 0,
    reward_icon_url = '',
    reward_permission = '',
    draft_revision = @raidlands_autokit_revision,
    published_revision = @raidlands_autokit_revision,
    published_at = UTC_TIMESTAMP(),
    deleted_at = NULL,
    deleted_revision = 0,
    updated_at = NOW()
WHERE kit_name = 'autokit';

SET @raidlands_autokit_id := (
  SELECT id FROM game_kits WHERE kit_name = 'autokit' LIMIT 1
);

DELETE FROM game_kit_items
WHERE kit_id = @raidlands_autokit_id;

INSERT INTO game_kit_items
  (
    kit_id, container_name, position, shortname, display_name, skin, amount,
    condition_value, max_condition, ammo, ammo_type, frequency,
    blueprint_shortname, text_value, contents_json, container_json, sort_order
  )
VALUES
  (@raidlands_autokit_id, 'main', 12, 'ammo.rifle', NULL, 0, 2500, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  (@raidlands_autokit_id, 'main', 18, 'weapon.mod.holosight', NULL, 0, 1, 300, 300, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  (@raidlands_autokit_id, 'main', 19, 'weapon.mod.extendedmags', NULL, 0, 1, 100, 100, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  (@raidlands_autokit_id, 'main', 20, 'weapon.mod.lasersight', NULL, 0, 1, 300, 300, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  (@raidlands_autokit_id, 'main', 22, 'hatchet', NULL, 0, 1, 400, 400, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  (@raidlands_autokit_id, 'main', 23, 'jackhammer', NULL, 0, 1, 300, 300, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  (@raidlands_autokit_id, 'wear', 0, 'metal.facemask', NULL, 0, 1, 320, 320, 0, NULL, -1, NULL, NULL, NULL, NULL, 0),
  (@raidlands_autokit_id, 'wear', 1, 'metal.plate.torso', NULL, 0, 1, 360, 360, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  (@raidlands_autokit_id, 'wear', 2, 'hoodie', NULL, 0, 1, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  (@raidlands_autokit_id, 'wear', 3, 'roadsign.kilt', NULL, 0, 1, 150, 150, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  (@raidlands_autokit_id, 'wear', 4, 'pants', NULL, 0, 1, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 40),
  (@raidlands_autokit_id, 'wear', 5, 'shoes.boots', NULL, 0, 1, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 50),
  (@raidlands_autokit_id, 'wear', 6, 'tactical.gloves', NULL, 0, 1, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 60),
  (
    @raidlands_autokit_id, 'belt', 0, 'rifle.ak', NULL, 0, 1,
    150, 150, 30, 'ammo.rifle', -1, NULL, NULL, NULL,
    '{"slots":4,"temperature":15,"flags":96,"allowedContents":1,"maxStackSize":0,"allowedItems":null,"availableSlots":[2,4,8,16,32,128],"volume":0,"contents":[]}',
    0
  ),
  (@raidlands_autokit_id, 'belt', 1, 'syringe.medical', NULL, 0, 100, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 10),
  (@raidlands_autokit_id, 'belt', 2, 'black.raspberries', NULL, 0, 65, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 20),
  (@raidlands_autokit_id, 'belt', 3, 'largemedkit', NULL, 0, 65, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 30),
  -- Belt position 4 is intentionally empty in the July 20 source.
  (@raidlands_autokit_id, 'belt', 5, 'barricade.wood.cover', NULL, 0, 20, 0, 0, 0, NULL, -1, NULL, NULL, NULL, NULL, 40);

SET @raidlands_autokit_json := (
  SELECT JSON_OBJECT(
    'Name', kits.kit_name,
    'PreviousName', COALESCE(kits.previous_kit_name, ''),
    'PreviousNames', JSON_ARRAY(),
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
        'Shortname', items.shortname, 'DisplayName', items.display_name,
        'Skin', items.skin, 'Amount', items.amount,
        'Condition', items.condition_value, 'MaxCondition', items.max_condition,
        'Ammo', items.ammo, 'Ammotype', items.ammo_type,
        'Position', items.position, 'Frequency', items.frequency,
        'BlueprintShortname', items.blueprint_shortname, 'Text', items.text_value,
        'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
        'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
      ))
      FROM game_kit_items items
      WHERE items.kit_id = kits.id AND items.container_name = 'main'
    ), JSON_ARRAY()),
    'WearItems', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'Shortname', items.shortname, 'DisplayName', items.display_name,
        'Skin', items.skin, 'Amount', items.amount,
        'Condition', items.condition_value, 'MaxCondition', items.max_condition,
        'Ammo', items.ammo, 'Ammotype', items.ammo_type,
        'Position', items.position, 'Frequency', items.frequency,
        'BlueprintShortname', items.blueprint_shortname, 'Text', items.text_value,
        'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
        'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
      ))
      FROM game_kit_items items
      WHERE items.kit_id = kits.id AND items.container_name = 'wear'
    ), JSON_ARRAY()),
    'BeltItems', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'Shortname', items.shortname, 'DisplayName', items.display_name,
        'Skin', items.skin, 'Amount', items.amount,
        'Condition', items.condition_value, 'MaxCondition', items.max_condition,
        'Ammo', items.ammo, 'Ammotype', items.ammo_type,
        'Position', items.position, 'Frequency', items.frequency,
        'BlueprintShortname', items.blueprint_shortname, 'Text', items.text_value,
        'Contents', CASE WHEN JSON_VALID(items.contents_json) THEN JSON_EXTRACT(items.contents_json, '$') ELSE NULL END,
        'Container', CASE WHEN JSON_VALID(items.container_json) THEN JSON_EXTRACT(items.container_json, '$') ELSE NULL END
      ))
      FROM game_kit_items items
      WHERE items.kit_id = kits.id AND items.container_name = 'belt'
    ), JSON_ARRAY())
  )
  FROM game_kits kits
  WHERE kits.id = @raidlands_autokit_id
);

SET @raidlands_autokit_payload := JSON_OBJECT(
  'revision', @raidlands_autokit_revision,
  'generated_at', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
  'kits', JSON_MERGE_PRESERVE(
    @raidlands_rank_kits_json,
    CONCAT('[', CAST(@raidlands_autokit_json AS CHAR CHARACTER SET utf8mb4), ']')
  ),
  'server_rewards_kits', JSON_ARRAY()
);

UPDATE game_kit_sync_log
SET status = 'failed',
    message = 'Superseded by migration 077 combined rank-kit and Auto Kit payload.',
    error_text = 'The exact frozen rank payload is included in the newer migration 077 publication.',
    updated_at = NOW()
WHERE status = 'pending'
  AND message IN (
    'Restored and split the six July 20 rank kits; rank RP products are disabled.',
    'Restored the exact July 20 Auto Kit layout and quantities.'
  );

INSERT INTO game_kit_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (
    @raidlands_autokit_revision,
    'pending',
    CAST(@raidlands_autokit_payload AS CHAR CHARACTER SET utf8mb4),
    SHA2(CAST(@raidlands_autokit_payload AS CHAR CHARACTER SET utf8mb4), 256),
    'Restored the exact July 20 Auto Kit layout and quantities.'
  );

COMMIT;
