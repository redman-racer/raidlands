-- Adds game-server raid telemetry to player wipe stats.
-- Safe to rerun on MySQL/MariaDB: only missing columns and indexes are added.

SET @schema_name := DATABASE();
SET @old_group_concat_max_len := @@SESSION.group_concat_max_len;
SET SESSION group_concat_max_len = 16384;

SET @raid_columns := (
  SELECT GROUP_CONCAT(definition ORDER BY ordinal SEPARATOR ', ')
  FROM (
    SELECT 1 AS ordinal, 'ADD COLUMN raw_raid_damage BIGINT UNSIGNED NOT NULL DEFAULT 0' AS definition, 'raw_raid_damage' AS column_name
    UNION ALL SELECT 2, 'ADD COLUMN raw_rockets_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raw_rockets_used'
    UNION ALL SELECT 3, 'ADD COLUMN raw_c4_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raw_c4_used'
    UNION ALL SELECT 4, 'ADD COLUMN raw_satchels_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raw_satchels_used'
    UNION ALL SELECT 5, 'ADD COLUMN raw_explosive_ammo_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raw_explosive_ammo_used'
    UNION ALL SELECT 6, 'ADD COLUMN raw_tcs_destroyed BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raw_tcs_destroyed'
    UNION ALL SELECT 7, 'ADD COLUMN baseline_raid_damage BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_raid_damage'
    UNION ALL SELECT 8, 'ADD COLUMN baseline_rockets_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_rockets_used'
    UNION ALL SELECT 9, 'ADD COLUMN baseline_c4_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_c4_used'
    UNION ALL SELECT 10, 'ADD COLUMN baseline_satchels_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_satchels_used'
    UNION ALL SELECT 11, 'ADD COLUMN baseline_explosive_ammo_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_explosive_ammo_used'
    UNION ALL SELECT 12, 'ADD COLUMN baseline_tcs_destroyed BIGINT UNSIGNED NOT NULL DEFAULT 0', 'baseline_tcs_destroyed'
    UNION ALL SELECT 13, 'ADD COLUMN raid_damage BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raid_damage'
    UNION ALL SELECT 14, 'ADD COLUMN rockets_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'rockets_used'
    UNION ALL SELECT 15, 'ADD COLUMN c4_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'c4_used'
    UNION ALL SELECT 16, 'ADD COLUMN satchels_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'satchels_used'
    UNION ALL SELECT 17, 'ADD COLUMN explosive_ammo_used BIGINT UNSIGNED NOT NULL DEFAULT 0', 'explosive_ammo_used'
    UNION ALL SELECT 18, 'ADD COLUMN tcs_destroyed BIGINT UNSIGNED NOT NULL DEFAULT 0', 'tcs_destroyed'
  ) requested
  WHERE NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS existing
    WHERE existing.TABLE_SCHEMA = @schema_name
      AND existing.TABLE_NAME = 'player_wipe_stats'
      AND existing.COLUMN_NAME = requested.column_name
  )
);
SET @sql := IF(
  COALESCE(@raid_columns, '') = '',
  'DO 1',
  CONCAT('ALTER TABLE player_wipe_stats ', @raid_columns)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET SESSION group_concat_max_len = @old_group_concat_max_len;

SET @raid_log_columns := (
  SELECT GROUP_CONCAT(definition ORDER BY ordinal SEPARATOR ', ')
  FROM (
    SELECT 1 AS ordinal, 'ADD COLUMN raid_players_received INT UNSIGNED NOT NULL DEFAULT 0' AS definition, 'raid_players_received' AS column_name
    UNION ALL SELECT 2, 'ADD COLUMN raid_damage_received BIGINT UNSIGNED NOT NULL DEFAULT 0', 'raid_damage_received'
  ) requested
  WHERE NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS existing
    WHERE existing.TABLE_SCHEMA = @schema_name
      AND existing.TABLE_NAME = 'stats_ingest_log'
      AND existing.COLUMN_NAME = requested.column_name
  )
);
SET @sql := IF(
  COALESCE(@raid_log_columns, '') = '',
  'DO 1',
  CONCAT('ALTER TABLE stats_ingest_log ', @raid_log_columns)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND INDEX_NAME = 'idx_player_wipe_stats_raid_damage'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE player_wipe_stats ADD KEY idx_player_wipe_stats_raid_damage (wipe_id, raid_damage, tcs_destroyed)',
  'DO 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND INDEX_NAME = 'idx_player_wipe_stats_tcs_destroyed'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE player_wipe_stats ADD KEY idx_player_wipe_stats_tcs_destroyed (wipe_id, tcs_destroyed, raid_damage)',
  'DO 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
