-- Makes Oxide Groups the only source of kit permission grants.
-- Active kits must carry a Kits plugin permission; public kits are granted
-- through the protected default group instead of a blank kit permission.

SET @schema_name := DATABASE();
SET @rollout_revision := UNIX_TIMESTAMP();

CREATE TEMPORARY TABLE IF NOT EXISTS tmp_legacy_public_kit_permissions (
  permission_name VARCHAR(190) NOT NULL,
  PRIMARY KEY (permission_name)
) ENGINE=Memory;

DELETE FROM tmp_legacy_public_kit_permissions;

INSERT IGNORE INTO tmp_legacy_public_kit_permissions (permission_name)
SELECT
  CONCAT(
    'kits.',
    CASE
      WHEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gk.kit_name), '[^a-z0-9]+', '-')) <> ''
        THEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gk.kit_name), '[^a-z0-9]+', '-'))
      ELSE CONCAT('kit-', gk.id)
    END
  ) AS permission_name
FROM game_kits gk
WHERE gk.is_active = 1
  AND gk.deleted_at IS NULL
  AND TRIM(gk.required_permission) = '';

UPDATE game_kits gk
SET gk.required_permission = CONCAT(
    'kits.',
    CASE
      WHEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gk.kit_name), '[^a-z0-9]+', '-')) <> ''
        THEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(gk.kit_name), '[^a-z0-9]+', '-'))
      ELSE CONCAT('kit-', gk.id)
    END
  ),
  gk.draft_revision = @rollout_revision,
  gk.updated_at = NOW()
WHERE gk.is_active = 1
  AND gk.deleted_at IS NULL
  AND TRIM(gk.required_permission) = '';

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
SELECT DISTINCT
  gk.required_permission,
  'Kits',
  'kits',
  'kit',
  1,
  NOW()
FROM game_kits gk
WHERE gk.is_active = 1
  AND gk.deleted_at IS NULL
  AND gk.required_permission LIKE 'kits.%'
ON DUPLICATE KEY UPDATE
  plugin_name = IF(plugin_name = '' OR plugin_name = 'fallback', VALUES(plugin_name), plugin_name),
  permission_prefix = IF(permission_prefix = '', VALUES(permission_prefix), permission_prefix),
  is_active = 1,
  updated_at = NOW();

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT
  og.id,
  op.id,
  'kit-default-backfill'
FROM tmp_legacy_public_kit_permissions legacy
INNER JOIN oxide_permissions op ON op.permission_name = legacy.permission_name
INNER JOIN oxide_groups og ON og.group_name = 'default'
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

UPDATE oxide_groups
SET draft_revision = @rollout_revision,
    published_revision = @rollout_revision,
    published_at = NOW(),
    updated_at = NOW()
WHERE group_name = 'default';

INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
VALUES (@rollout_revision, 'pending', NULL, '', 'Published group-owned kit permission backfill.');

DROP TABLE IF EXISTS game_kit_group_access;
DROP TABLE IF EXISTS store_product_kits;
