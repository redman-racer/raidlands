SET @kit_absolute_image_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM game_kit_sync_log
  WHERE status <> 'snapshot'
);

SET @kit_asset_base_url := 'https://raidlands.net';

-- The live bridge accepts HTTPS kit image URLs reliably. Publish absolute PNG URLs
-- so older relative-path validators cannot reject otherwise valid kit artwork.

UPDATE game_kits
SET
  image_path = CASE
    WHEN image_path LIKE '/assets/media/kits/%.webp'
      THEN CONCAT(@kit_asset_base_url, SUBSTRING(image_path, 1, CHAR_LENGTH(image_path) - 5), '.png')
    WHEN image_path LIKE 'assets/media/kits/%.webp'
      THEN CONCAT(@kit_asset_base_url, '/', SUBSTRING(image_path, 1, CHAR_LENGTH(image_path) - 5), '.png')
    WHEN image_path LIKE '/assets/media/kits/%'
      THEN CONCAT(@kit_asset_base_url, image_path)
    WHEN image_path LIKE 'assets/media/kits/%'
      THEN CONCAT(@kit_asset_base_url, '/', image_path)
    WHEN image_path LIKE CONCAT(@kit_asset_base_url, '/assets/media/kits/%.webp')
      THEN CONCAT(SUBSTRING(image_path, 1, CHAR_LENGTH(image_path) - 5), '.png')
    ELSE image_path
  END,
  reward_icon_url = CASE
    WHEN reward_icon_url LIKE '/assets/media/kits/%.webp'
      THEN CONCAT(@kit_asset_base_url, SUBSTRING(reward_icon_url, 1, CHAR_LENGTH(reward_icon_url) - 5), '.png')
    WHEN reward_icon_url LIKE 'assets/media/kits/%.webp'
      THEN CONCAT(@kit_asset_base_url, '/', SUBSTRING(reward_icon_url, 1, CHAR_LENGTH(reward_icon_url) - 5), '.png')
    WHEN reward_icon_url LIKE '/assets/media/kits/%'
      THEN CONCAT(@kit_asset_base_url, reward_icon_url)
    WHEN reward_icon_url LIKE 'assets/media/kits/%'
      THEN CONCAT(@kit_asset_base_url, '/', reward_icon_url)
    WHEN reward_icon_url LIKE CONCAT(@kit_asset_base_url, '/assets/media/kits/%.webp')
      THEN CONCAT(SUBSTRING(reward_icon_url, 1, CHAR_LENGTH(reward_icon_url) - 5), '.png')
    ELSE reward_icon_url
  END,
  draft_revision = @kit_absolute_image_revision,
  published_revision = @kit_absolute_image_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE image_path LIKE '/assets/media/kits/%'
   OR image_path LIKE 'assets/media/kits/%'
   OR image_path LIKE CONCAT(@kit_asset_base_url, '/assets/media/kits/%.webp')
   OR reward_icon_url LIKE '/assets/media/kits/%'
   OR reward_icon_url LIKE 'assets/media/kits/%'
   OR reward_icon_url LIKE CONCAT(@kit_asset_base_url, '/assets/media/kits/%.webp');

SET @kit_absolute_image_changed_count := ROW_COUNT();

UPDATE game_kits
SET
  draft_revision = @kit_absolute_image_revision,
  published_revision = @kit_absolute_image_revision,
  published_at = NOW(),
  updated_at = NOW()
WHERE deleted_at IS NULL;

SET @kit_absolute_image_published_count := ROW_COUNT();

INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
SELECT @kit_absolute_image_revision, 'pending', NULL, '', 'Published absolute PNG kit image URLs for Rust kit sync.'
WHERE @kit_absolute_image_changed_count > 0
   OR @kit_absolute_image_published_count > 0;
