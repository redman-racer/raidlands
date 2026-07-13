-- Adds first-class Rust weather override columns to environment snapshots.
-- Safe to rerun on MySQL/MariaDB: only missing columns are added.

SET @schema_name := DATABASE();
SET SESSION group_concat_max_len = 8192;

DROP TEMPORARY TABLE IF EXISTS raidlands_environment_weather_columns;
CREATE TEMPORARY TABLE raidlands_environment_weather_columns (
  column_name VARCHAR(80) NOT NULL PRIMARY KEY,
  column_definition VARCHAR(160) NOT NULL,
  sort_order INT UNSIGNED NOT NULL
);

INSERT INTO raidlands_environment_weather_columns (column_name, column_definition, sort_order) VALUES
  ('weather_rain_raw', 'weather_rain_raw DECIMAL(9,4) DEFAULT NULL', 10),
  ('weather_rain_value', 'weather_rain_value DECIMAL(9,4) DEFAULT NULL', 11),
  ('weather_thunder_raw', 'weather_thunder_raw DECIMAL(9,4) DEFAULT NULL', 20),
  ('weather_thunder_value', 'weather_thunder_value DECIMAL(9,4) DEFAULT NULL', 21),
  ('weather_rainbow_raw', 'weather_rainbow_raw DECIMAL(9,4) DEFAULT NULL', 30),
  ('weather_rainbow_value', 'weather_rainbow_value DECIMAL(9,4) DEFAULT NULL', 31),
  ('weather_fog_raw', 'weather_fog_raw DECIMAL(9,4) DEFAULT NULL', 40),
  ('weather_fog_value', 'weather_fog_value DECIMAL(9,4) DEFAULT NULL', 41),
  ('weather_atmosphere_rayleigh_raw', 'weather_atmosphere_rayleigh_raw DECIMAL(9,4) DEFAULT NULL', 50),
  ('weather_atmosphere_rayleigh_value', 'weather_atmosphere_rayleigh_value DECIMAL(9,4) DEFAULT NULL', 51),
  ('weather_atmosphere_mie_raw', 'weather_atmosphere_mie_raw DECIMAL(9,4) DEFAULT NULL', 60),
  ('weather_atmosphere_mie_value', 'weather_atmosphere_mie_value DECIMAL(9,4) DEFAULT NULL', 61),
  ('weather_atmosphere_brightness_raw', 'weather_atmosphere_brightness_raw DECIMAL(9,4) DEFAULT NULL', 70),
  ('weather_atmosphere_brightness_value', 'weather_atmosphere_brightness_value DECIMAL(9,4) DEFAULT NULL', 71),
  ('weather_atmosphere_contrast_raw', 'weather_atmosphere_contrast_raw DECIMAL(9,4) DEFAULT NULL', 80),
  ('weather_atmosphere_contrast_value', 'weather_atmosphere_contrast_value DECIMAL(9,4) DEFAULT NULL', 81),
  ('weather_atmosphere_directionality_raw', 'weather_atmosphere_directionality_raw DECIMAL(9,4) DEFAULT NULL', 90),
  ('weather_atmosphere_directionality_value', 'weather_atmosphere_directionality_value DECIMAL(9,4) DEFAULT NULL', 91),
  ('weather_cloud_size_raw', 'weather_cloud_size_raw DECIMAL(9,4) DEFAULT NULL', 100),
  ('weather_cloud_size_value', 'weather_cloud_size_value DECIMAL(9,4) DEFAULT NULL', 101),
  ('weather_cloud_opacity_raw', 'weather_cloud_opacity_raw DECIMAL(9,4) DEFAULT NULL', 110),
  ('weather_cloud_opacity_value', 'weather_cloud_opacity_value DECIMAL(9,4) DEFAULT NULL', 111),
  ('weather_cloud_coverage_raw', 'weather_cloud_coverage_raw DECIMAL(9,4) DEFAULT NULL', 120),
  ('weather_cloud_coverage_value', 'weather_cloud_coverage_value DECIMAL(9,4) DEFAULT NULL', 121),
  ('weather_cloud_sharpness_raw', 'weather_cloud_sharpness_raw DECIMAL(9,4) DEFAULT NULL', 130),
  ('weather_cloud_sharpness_value', 'weather_cloud_sharpness_value DECIMAL(9,4) DEFAULT NULL', 131),
  ('weather_cloud_coloring_raw', 'weather_cloud_coloring_raw DECIMAL(9,4) DEFAULT NULL', 140),
  ('weather_cloud_coloring_value', 'weather_cloud_coloring_value DECIMAL(9,4) DEFAULT NULL', 141),
  ('weather_cloud_attenuation_raw', 'weather_cloud_attenuation_raw DECIMAL(9,4) DEFAULT NULL', 150),
  ('weather_cloud_attenuation_value', 'weather_cloud_attenuation_value DECIMAL(9,4) DEFAULT NULL', 151),
  ('weather_cloud_scattering_raw', 'weather_cloud_scattering_raw DECIMAL(9,4) DEFAULT NULL', 160),
  ('weather_cloud_scattering_value', 'weather_cloud_scattering_value DECIMAL(9,4) DEFAULT NULL', 161),
  ('weather_cloud_brightness_raw', 'weather_cloud_brightness_raw DECIMAL(9,4) DEFAULT NULL', 170),
  ('weather_cloud_brightness_value', 'weather_cloud_brightness_value DECIMAL(9,4) DEFAULT NULL', 171);

SELECT GROUP_CONCAT(CONCAT('ADD COLUMN ', column_definition) ORDER BY sort_order SEPARATOR ', ')
  INTO @weather_columns_to_add
FROM raidlands_environment_weather_columns candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM INFORMATION_SCHEMA.COLUMNS existing
  WHERE existing.TABLE_SCHEMA = @schema_name
    AND existing.TABLE_NAME = 'server_environment_snapshots'
    AND existing.COLUMN_NAME = candidate.column_name
);

SET @sql := IF(
  @weather_columns_to_add IS NULL OR @weather_columns_to_add = '',
  'SELECT 1',
  CONCAT('ALTER TABLE server_environment_snapshots ', @weather_columns_to_add)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS raidlands_environment_weather_columns;
