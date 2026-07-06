SET @super_serum_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- The custom Raidlands serum item is supertea named Super Serum.
-- maxhealthtea.pure is only one of the source effects and should not be exported as the kit item.

UPDATE game_kit_items AS gki
INNER JOIN game_kits AS gk ON gk.id = gki.kit_id
SET
  gki.shortname = 'supertea',
  gki.display_name = 'Super Serum',
  gki.skin = 0,
  gki.updated_at = NOW()
WHERE gk.kit_name IN ('kit_ultimate_vip', 'kit_titan_vip', 'pack_super_serum', 'custom.pending.super_serum')
  AND gki.shortname = 'maxhealthtea.pure';

SET @super_serum_shortname_changed_count := ROW_COUNT();

UPDATE game_kit_items AS gki
INNER JOIN game_kits AS gk ON gk.id = gki.kit_id
SET
  gki.display_name = 'Super Serum',
  gki.updated_at = NOW()
WHERE gk.kit_name IN ('kit_ultimate_vip', 'kit_titan_vip', 'pack_super_serum', 'custom.pending.super_serum')
  AND gki.shortname = 'supertea'
  AND COALESCE(gki.display_name, '') <> 'Super Serum';

SET @super_serum_display_changed_count := ROW_COUNT();
SET @super_serum_changed_count := @super_serum_shortname_changed_count + @super_serum_display_changed_count;

UPDATE game_kits
SET
  draft_revision = @super_serum_revision,
  published_revision = @super_serum_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE @super_serum_changed_count > 0
  AND kit_name IN ('kit_ultimate_vip', 'kit_titan_vip', 'pack_super_serum', 'custom.pending.super_serum');

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @super_serum_revision, 'pending', NULL, '', 'Corrected VIP Super Serum kit shortnames to supertea.'
WHERE @super_serum_changed_count > 0;
