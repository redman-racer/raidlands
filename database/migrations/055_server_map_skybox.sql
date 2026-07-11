ALTER TABLE server_map_images
  ADD COLUMN skybox_public_url VARCHAR(500) NOT NULL DEFAULT '' AFTER terrain_water_level,
  ADD COLUMN skybox_relative_path VARCHAR(255) NOT NULL DEFAULT '' AFTER skybox_public_url,
  ADD COLUMN skybox_hash CHAR(64) NOT NULL DEFAULT '' AFTER skybox_relative_path,
  ADD COLUMN skybox_mime VARCHAR(40) NOT NULL DEFAULT '' AFTER skybox_hash,
  ADD COLUMN skybox_extension VARCHAR(8) NOT NULL DEFAULT '' AFTER skybox_mime,
  ADD COLUMN skybox_bytes INT UNSIGNED NOT NULL DEFAULT 0 AFTER skybox_extension,
  ADD COLUMN skybox_width INT UNSIGNED NOT NULL DEFAULT 0 AFTER skybox_bytes,
  ADD COLUMN skybox_height INT UNSIGNED NOT NULL DEFAULT 0 AFTER skybox_width;
