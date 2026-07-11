ALTER TABLE server_map_images
  ADD COLUMN terrain_public_url VARCHAR(500) NOT NULL DEFAULT '' AFTER relative_path,
  ADD COLUMN terrain_relative_path VARCHAR(255) NOT NULL DEFAULT '' AFTER terrain_public_url,
  ADD COLUMN terrain_hash CHAR(64) NOT NULL DEFAULT '' AFTER terrain_relative_path,
  ADD COLUMN terrain_bytes INT UNSIGNED NOT NULL DEFAULT 0 AFTER terrain_hash,
  ADD COLUMN terrain_resolution INT UNSIGNED NOT NULL DEFAULT 0 AFTER terrain_bytes,
  ADD COLUMN terrain_min_height DECIMAL(9,3) NOT NULL DEFAULT 0 AFTER terrain_resolution,
  ADD COLUMN terrain_max_height DECIMAL(9,3) NOT NULL DEFAULT 0 AFTER terrain_min_height,
  ADD COLUMN terrain_water_level DECIMAL(9,3) NOT NULL DEFAULT 0 AFTER terrain_max_height;
