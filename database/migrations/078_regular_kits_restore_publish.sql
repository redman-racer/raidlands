-- Migration 078: republish every active July 20 non-rank kit with its exact
-- database item positions. Migration 077 published Auto Kit and the split rank
-- kits but omitted AK, LR300, M16, MP5, and the other ordinary claim kits.
--
-- Authoritative source:
-- database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql
-- SHA-256: 7324E1C5AF488C86C3E0A96DE0A0D9C4A6A39163EF3BB79C41CF795A69F3E495

SET @raidlands_regular_kit_revision := GREATEST(
  COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM game_kits), 0),
  COALESCE((SELECT MAX(revision) FROM game_kit_sync_log WHERE status <> 'snapshot'), 0)
) + 1;

-- Carry forward the already-frozen Auto Kit and twelve split rank kits. The
-- latest revision must remain self-contained because the bridge requests only
-- the newest publication.
SET @raidlands_managed_kits_json := COALESCE((
  SELECT JSON_EXTRACT(payload_json, '$.kits')
  FROM game_kit_sync_log
  WHERE message = 'Restored the exact July 20 Auto Kit layout and quantities.'
    AND payload_json IS NOT NULL
  ORDER BY revision DESC, id DESC
  LIMIT 1
), JSON_ARRAY());

START TRANSACTION;

-- The July 20 LR300 row contains a one-count syringe typo. The requested
-- ordinary-kit behavior is 100 medical syringes, matching AK, M16, MP5, Steam,
-- and Discord combat kits.
UPDATE game_kit_items items
INNER JOIN game_kits kits ON kits.id = items.kit_id
SET items.amount = 100,
    items.updated_at = NOW()
WHERE kits.kit_name = 'lr300'
  AND items.container_name = 'belt'
  AND items.position = 1
  AND items.shortname = 'syringe.medical';

UPDATE game_kits
SET draft_revision = @raidlands_regular_kit_revision,
    published_revision = @raidlands_regular_kit_revision,
    published_at = UTC_TIMESTAMP(),
    updated_at = NOW()
WHERE is_active = 1
  AND kit_name IN (
    'ak', 'lr300', 'm16', 'mp5',
    'steam', 'steam_name_rewards', 'discord', 'discord_booster', 'discord_raid',
    'build', 'scuba', '556', 'cards', 'scrap', 'components', 'raid', 'medical',
    'portafort', 'vehicles', 'sentry', 'sentry_large'
  );

SET @raidlands_regular_kits_json := (
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
  WHERE kits.is_active = 1
    AND kits.kit_name IN (
      'ak', 'lr300', 'm16', 'mp5',
      'steam', 'steam_name_rewards', 'discord', 'discord_booster', 'discord_raid',
      'build', 'scuba', '556', 'cards', 'scrap', 'components', 'raid', 'medical',
      'portafort', 'vehicles', 'sentry', 'sentry_large'
    )
);

SET @raidlands_all_kits_payload := JSON_OBJECT(
  'revision', @raidlands_regular_kit_revision,
  'generated_at', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
  'kits', JSON_MERGE_PRESERVE(
    @raidlands_managed_kits_json,
    @raidlands_regular_kits_json
  ),
  'server_rewards_kits', JSON_ARRAY()
);

UPDATE game_kit_sync_log
SET status = 'failed',
    message = 'Superseded by migration 078 complete managed-kit payload.',
    error_text = 'The newer revision includes the frozen split rank kits, Auto Kit, and all active ordinary July 20 kits.',
    updated_at = NOW()
WHERE status = 'pending'
  AND message IN (
    'Restored and split the six July 20 rank kits; rank RP products are disabled.',
    'Restored the exact July 20 Auto Kit layout and quantities.',
    'Republished all active July 20 ordinary kits with exact slot positions.'
  );

INSERT INTO game_kit_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (
    @raidlands_regular_kit_revision,
    'pending',
    CAST(@raidlands_all_kits_payload AS CHAR CHARACTER SET utf8mb4),
    SHA2(CAST(@raidlands_all_kits_payload AS CHAR CHARACTER SET utf8mb4), 256),
    'Republished all active July 20 ordinary kits with exact slot positions.'
  );

COMMIT;
