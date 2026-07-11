SET @vip_kit_png_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- Kits/ImageLibrary expects PNG-backed artwork for the VIP-family kit cards.
-- Earlier VIP repair migrations restored these six rows to WebP, which renders as
-- a missing image in the in-game Kits UI.

CREATE TEMPORARY TABLE raidlands_vip_kit_png_images (
  required_permission VARCHAR(160) NOT NULL PRIMARY KEY,
  image_path VARCHAR(500) NOT NULL,
  reward_icon_url VARCHAR(500) NOT NULL
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO raidlands_vip_kit_png_images (required_permission, image_path, reward_icon_url)
VALUES
  ('kits.vip', '/assets/media/kits/vip-kit.png', 'https://raidlands.net/assets/media/kits/vip-kit.png'),
  ('kits.vipplus', '/assets/media/kits/vip-plus-kit.png', 'https://raidlands.net/assets/media/kits/vip-plus-kit.png'),
  ('kits.mvp', '/assets/media/kits/mvp-kit.png', 'https://raidlands.net/assets/media/kits/mvp-kit.png'),
  ('kits.goldenvip', '/assets/media/kits/golden-vip-kit.png', 'https://raidlands.net/assets/media/kits/golden-vip-kit.png'),
  ('kits.ultimatevip', '/assets/media/kits/ultimate-vip-kit.png', 'https://raidlands.net/assets/media/kits/ultimate-vip-kit.png'),
  ('kits.titanvip', '/assets/media/kits/titan-vip-kit.png', 'https://raidlands.net/assets/media/kits/titan-vip-kit.png');

UPDATE game_kits AS gk
INNER JOIN raidlands_vip_kit_png_images AS png_rows
  ON png_rows.required_permission = gk.required_permission
SET
  gk.image_path = png_rows.image_path,
  gk.reward_icon_url = png_rows.reward_icon_url,
  gk.draft_revision = @vip_kit_png_revision,
  gk.published_revision = @vip_kit_png_revision,
  gk.published_at = NOW(),
  gk.updated_at = NOW()
WHERE gk.deleted_at IS NULL
  AND gk.is_active = 1
  AND (
    COALESCE(gk.image_path, '') <> png_rows.image_path
    OR COALESCE(gk.reward_icon_url, '') <> png_rows.reward_icon_url
  );

SET @vip_kit_png_changed_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT
  @vip_kit_png_revision,
  'pending',
  NULL,
  '',
  CONCAT('Updated VIP kit artwork URLs to PNG assets across ', @vip_kit_png_changed_count, ' kits.')
WHERE @vip_kit_png_changed_count > 0;

DROP TEMPORARY TABLE raidlands_vip_kit_png_images;
