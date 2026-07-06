SET @kit_png_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

-- WebsiteVipBridge's in-game kit UI expects the generated kit artwork as PNG.
-- Keep website-safe paths, but stop publishing /assets/media/kits/*.webp to the Rust server.

UPDATE game_kits
SET
  image_path = CASE
    WHEN (
      image_path LIKE '/assets/media/kits/%.webp'
      OR image_path LIKE 'assets/media/kits/%.webp'
    ) THEN CONCAT(SUBSTRING(image_path, 1, CHAR_LENGTH(image_path) - 5), '.png')
    ELSE image_path
  END,
  reward_icon_url = CASE
    WHEN (
      reward_icon_url LIKE '/assets/media/kits/%.webp'
      OR reward_icon_url LIKE 'assets/media/kits/%.webp'
    ) THEN CONCAT(SUBSTRING(reward_icon_url, 1, CHAR_LENGTH(reward_icon_url) - 5), '.png')
    ELSE reward_icon_url
  END,
  draft_revision = @kit_png_revision,
  published_revision = @kit_png_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE image_path LIKE '/assets/media/kits/%.webp'
   OR image_path LIKE 'assets/media/kits/%.webp'
   OR reward_icon_url LIKE '/assets/media/kits/%.webp'
   OR reward_icon_url LIKE 'assets/media/kits/%.webp';

SET @kit_png_changed_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @kit_png_revision, 'pending', NULL, '', 'Converted kit sync image paths from WebP to PNG.'
WHERE @kit_png_changed_count > 0;
