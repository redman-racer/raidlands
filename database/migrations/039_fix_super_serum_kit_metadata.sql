SET @super_serum_metadata_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- RaidlandsConsumables only treats the item as custom Super Serum when the
-- base item is supertea and the item display name is exactly "Super Serum".
-- Repair existing kit rows so VIP kits stop exporting vanilla tea items.

UPDATE game_kit_items AS gki
INNER JOIN game_kits AS gk ON gk.id = gki.kit_id
SET
  gki.shortname = 'supertea',
  gki.display_name = 'Super Serum',
  gki.skin = 0,
  gki.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND gki.shortname IN ('supertea', 'maxhealthtea.pure')
  AND (
    gki.shortname <> 'supertea'
    OR COALESCE(gki.display_name, '') <> 'Super Serum'
    OR gki.skin <> 0
  );

SET @super_serum_metadata_changed_count := ROW_COUNT();

UPDATE game_kits
SET
  draft_revision = @super_serum_metadata_revision,
  published_revision = @super_serum_metadata_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE @super_serum_metadata_changed_count > 0
  AND deleted_at IS NULL;

SET @super_serum_metadata_published_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @super_serum_metadata_revision, 'pending', NULL, '', 'Repaired Super Serum kit item metadata.'
WHERE @super_serum_metadata_changed_count > 0
   OR @super_serum_metadata_published_count > 0;
