SET @vip_kit_artwork_restore_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

CREATE TEMPORARY TABLE raidlands_vip_kit_artwork_restore (
  required_permission VARCHAR(160) NOT NULL PRIMARY KEY,
  image_path VARCHAR(500) NOT NULL,
  reward_icon_url VARCHAR(500) NOT NULL
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO raidlands_vip_kit_artwork_restore (required_permission, image_path, reward_icon_url)
VALUES
  ('kits.vip', '/assets/media/kits/vip-kit.webp', 'https://raidlands.net/assets/media/kits/vip-kit.webp'),
  ('kits.vipplus', '/assets/media/kits/vip-plus-kit.webp', 'https://raidlands.net/assets/media/kits/vip-plus-kit.webp'),
  ('kits.mvp', '/assets/media/kits/mvp-kit.webp', 'https://raidlands.net/assets/media/kits/mvp-kit.webp'),
  ('kits.goldenvip', '/assets/media/kits/golden-vip-kit.webp', 'https://raidlands.net/assets/media/kits/golden-vip-kit.webp'),
  ('kits.ultimatevip', '/assets/media/kits/ultimate-vip-kit.webp', 'https://raidlands.net/assets/media/kits/ultimate-vip-kit.webp'),
  ('kits.titanvip', '/assets/media/kits/titan-vip-kit.webp', 'https://raidlands.net/assets/media/kits/titan-vip-kit.webp');

UPDATE game_kits AS gk
INNER JOIN raidlands_vip_kit_artwork_restore AS restore_rows
  ON restore_rows.required_permission = gk.required_permission
SET
  gk.image_path = restore_rows.image_path,
  gk.reward_icon_url = restore_rows.reward_icon_url,
  gk.draft_revision = @vip_kit_artwork_restore_revision,
  gk.published_revision = @vip_kit_artwork_restore_revision,
  gk.published_at = NOW(),
  gk.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND gk.is_active = 1;

SET @vip_kit_artwork_restore_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT
  @vip_kit_artwork_restore_revision,
  'pending',
  NULL,
  '',
  CONCAT('Restored VIP kit artwork URLs to existing WEBP assets across ', @vip_kit_artwork_restore_count, ' kits.')
WHERE @vip_kit_artwork_restore_count > 0;

DROP TEMPORARY TABLE raidlands_vip_kit_artwork_restore;
