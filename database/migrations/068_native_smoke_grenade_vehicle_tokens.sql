-- Replace retired CID vehicle item shortnames with the native smoke-grenade
-- tokens used by RaidlandsVehicleTokens 1.1.1.
--
-- Vehicle identity is carried by DisplayName because every token now uses
-- grenade.smoke with skin 0 and Require Display Name Match enabled.
-- Safe to rerun: a new kit revision is queued only when legacy rows exist.

START TRANSACTION;

SET @vehicle_token_item_count := (
  SELECT COUNT(*)
  FROM game_kit_items
  WHERE shortname IN (
    'raidlands.vehicle.token.minicopter',
    'raidlands.vehicle.token.scrap_transport_helicopter',
    'raidlands.vehicle.token.attack_helicopter',
    'raidlands.vehicle.token.rhib',
    'raidlands.vehicle.token.tugboat',
    'raidlands.vehicle.token.solo_submarine',
    'raidlands.vehicle.token.duo_submarine',
    'raidlands.vehicle.token.snowmobile',
    'raidlands.vehicle.token.hot_air_balloon'
  )
);

SET @vehicle_token_revision := GREATEST(
  (
    SELECT COALESCE(MAX(GREATEST(draft_revision, published_revision, deleted_revision)), 0)
    FROM game_kits
  ),
  (
    SELECT COALESCE(MAX(revision), 0)
    FROM game_kit_sync_log
    WHERE status <> 'snapshot'
  )
) + 1;

UPDATE game_kits
SET
  draft_revision = @vehicle_token_revision,
  published_revision = @vehicle_token_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE @vehicle_token_item_count > 0
  AND id IN (
    SELECT vehicle_kit_items.kit_id
    FROM (
      SELECT DISTINCT kit_id
      FROM game_kit_items
      WHERE shortname IN (
        'raidlands.vehicle.token.minicopter',
        'raidlands.vehicle.token.scrap_transport_helicopter',
        'raidlands.vehicle.token.attack_helicopter',
        'raidlands.vehicle.token.rhib',
        'raidlands.vehicle.token.tugboat',
        'raidlands.vehicle.token.solo_submarine',
        'raidlands.vehicle.token.duo_submarine',
        'raidlands.vehicle.token.snowmobile',
        'raidlands.vehicle.token.hot_air_balloon'
      )
    ) AS vehicle_kit_items
  );

UPDATE game_kit_items
SET
  display_name = CASE shortname
    WHEN 'raidlands.vehicle.token.minicopter' THEN 'Minicopter Token'
    WHEN 'raidlands.vehicle.token.scrap_transport_helicopter' THEN 'Scrap Transport Helicopter Token'
    WHEN 'raidlands.vehicle.token.attack_helicopter' THEN 'Attack Helicopter Token'
    WHEN 'raidlands.vehicle.token.rhib' THEN 'RHIB Token'
    WHEN 'raidlands.vehicle.token.tugboat' THEN 'Tugboat Token'
    WHEN 'raidlands.vehicle.token.solo_submarine' THEN 'Solo Submarine Token'
    WHEN 'raidlands.vehicle.token.duo_submarine' THEN 'Duo Submarine Token'
    WHEN 'raidlands.vehicle.token.snowmobile' THEN 'Snowmobile Token'
    WHEN 'raidlands.vehicle.token.hot_air_balloon' THEN 'Hot Air Balloon Token'
  END,
  shortname = 'grenade.smoke',
  skin = 0,
  updated_at = NOW()
WHERE shortname IN (
  'raidlands.vehicle.token.minicopter',
  'raidlands.vehicle.token.scrap_transport_helicopter',
  'raidlands.vehicle.token.attack_helicopter',
  'raidlands.vehicle.token.rhib',
  'raidlands.vehicle.token.tugboat',
  'raidlands.vehicle.token.solo_submarine',
  'raidlands.vehicle.token.duo_submarine',
  'raidlands.vehicle.token.snowmobile',
  'raidlands.vehicle.token.hot_air_balloon'
);

INSERT INTO game_kit_sync_log
  (revision, status, payload_json, payload_hash, message)
SELECT
  @vehicle_token_revision,
  'pending',
  NULL,
  '',
  CONCAT(
    'Published native smoke-grenade vehicle tokens for ',
    @vehicle_token_item_count,
    ' kit item rows.'
  )
WHERE @vehicle_token_item_count > 0;

COMMIT;
