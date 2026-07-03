-- Adds durable delete tombstones for website-managed kits and Oxide groups.
-- Safe to rerun on MySQL/MariaDB: each column/index is checked before creation.

SET @schema_name := DATABASE();

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'game_kits'
    AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE game_kits ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'game_kits'
    AND COLUMN_NAME = 'deleted_revision'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE game_kits ADD COLUMN deleted_revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER deleted_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'game_kits'
    AND INDEX_NAME = 'idx_game_kits_deleted_revision'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE game_kits ADD KEY idx_game_kits_deleted_revision (deleted_at, deleted_revision)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oxide_groups'
    AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE oxide_groups ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oxide_groups'
    AND COLUMN_NAME = 'deleted_revision'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE oxide_groups ADD COLUMN deleted_revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER deleted_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'oxide_groups'
    AND INDEX_NAME = 'idx_oxide_groups_deleted_revision'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE oxide_groups ADD KEY idx_oxide_groups_deleted_revision (deleted_at, deleted_revision)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
