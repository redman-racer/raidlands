-- Adds the backed High-Low and Wheel RP games.
-- Safe to rerun: enum modifications are idempotent, columns are checked first.

SET @schema_name := DATABASE();

ALTER TABLE rp_point_requests
  MODIFY COLUMN source_type ENUM(
    'vote_reward',
    'coinflip',
    'dice',
    'high_low',
    'wheel',
    'jackpot_entry',
    'jackpot_payout',
    'admin_adjustment'
  ) NOT NULL;

ALTER TABLE rp_game_rounds
  MODIFY COLUMN game_type ENUM('coinflip', 'dice', 'high_low', 'wheel') NOT NULL;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'rp_game_settings'
    AND COLUMN_NAME = 'high_low_enabled'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN high_low_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER jackpot_enabled',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'rp_game_settings'
    AND COLUMN_NAME = 'wheel_enabled'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN wheel_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER high_low_enabled',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
