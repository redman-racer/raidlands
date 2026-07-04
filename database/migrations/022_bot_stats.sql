-- Adds separate NPC/bot combat counters without mixing them into normal PvP K/D.
-- Safe to rerun on MySQL/MariaDB: columns and indexes are checked before creation.

SET @schema_name := DATABASE();

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'raw_npc_kills'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN raw_npc_kills INT UNSIGNED NOT NULL DEFAULT 0 AFTER raw_reward_points',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'raw_deaths_by_npc'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN raw_deaths_by_npc INT UNSIGNED NOT NULL DEFAULT 0 AFTER raw_npc_kills',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'baseline_npc_kills'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN baseline_npc_kills INT UNSIGNED NOT NULL DEFAULT 0 AFTER baseline_reward_points',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'baseline_deaths_by_npc'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN baseline_deaths_by_npc INT UNSIGNED NOT NULL DEFAULT 0 AFTER baseline_npc_kills',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'npc_kills'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN npc_kills INT UNSIGNED NOT NULL DEFAULT 0 AFTER deaths',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND COLUMN_NAME = 'deaths_by_npc'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE player_wipe_stats ADD COLUMN deaths_by_npc INT UNSIGNED NOT NULL DEFAULT 0 AFTER npc_kills',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND INDEX_NAME = 'idx_player_wipe_stats_npc_kills'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE player_wipe_stats ADD KEY idx_player_wipe_stats_npc_kills (wipe_id, npc_kills, deaths_by_npc)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'player_wipe_stats'
    AND INDEX_NAME = 'idx_player_wipe_stats_deaths_by_npc'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE player_wipe_stats ADD KEY idx_player_wipe_stats_deaths_by_npc (wipe_id, deaths_by_npc, npc_kills)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS bot_wipe_stats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wipe_id BIGINT UNSIGNED NOT NULL,
  bot_key VARCHAR(120) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  kit_name VARCHAR(80) NOT NULL DEFAULT '',
  skill_tier VARCHAR(40) NOT NULL DEFAULT '',
  raw_kills INT UNSIGNED NOT NULL DEFAULT 0,
  raw_deaths INT UNSIGNED NOT NULL DEFAULT 0,
  baseline_kills INT UNSIGNED NOT NULL DEFAULT 0,
  baseline_deaths INT UNSIGNED NOT NULL DEFAULT 0,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  deaths INT UNSIGNED NOT NULL DEFAULT 0,
  kdr DECIMAL(10,3) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bot_wipe_stats_bot (wipe_id, bot_key),
  KEY idx_bot_wipe_stats_kills (wipe_id, kills, deaths),
  KEY idx_bot_wipe_stats_kdr (wipe_id, kdr, kills),
  KEY idx_bot_wipe_stats_bot_key (bot_key),
  CONSTRAINT fk_bot_wipe_stats_wipe FOREIGN KEY (wipe_id) REFERENCES wipe_seasons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
