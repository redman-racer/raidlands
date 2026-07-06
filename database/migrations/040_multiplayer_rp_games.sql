-- Adds backed multiplayer RP pool games: Raid Duel and Supply Run.
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
    'raid_duel_entry',
    'raid_duel_payout',
    'supply_run_entry',
    'supply_run_payout',
    'admin_adjustment'
  ) NOT NULL;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'rp_game_settings'
    AND COLUMN_NAME = 'raid_duel_enabled'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN raid_duel_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER jackpot_enabled',
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
    AND COLUMN_NAME = 'supply_run_enabled'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN supply_run_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER raid_duel_enabled',
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
    AND COLUMN_NAME = 'pool_round_minutes'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN pool_round_minutes INT UNSIGNED NOT NULL DEFAULT 20 AFTER jackpot_house_edge_percent',
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
    AND COLUMN_NAME = 'pool_house_edge_percent'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN pool_house_edge_percent INT UNSIGNED NOT NULL DEFAULT 8 AFTER pool_round_minutes',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS rp_pool_rounds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_type VARCHAR(40) NOT NULL,
  round_key VARCHAR(80) NOT NULL,
  status ENUM('open', 'drawing', 'payout_queued', 'paid', 'failed', 'canceled') NOT NULL DEFAULT 'open',
  options_json LONGTEXT NULL,
  house_edge_percent INT UNSIGNED NOT NULL DEFAULT 8,
  opens_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closes_at TIMESTAMP NULL DEFAULT NULL,
  total_stake_rp INT UNSIGNED NOT NULL DEFAULT 0,
  total_entries INT UNSIGNED NOT NULL DEFAULT 0,
  outcome_key VARCHAR(40) NOT NULL DEFAULT '',
  outcome_roll INT UNSIGNED NOT NULL DEFAULT 0,
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rp_pool_rounds_key (round_key),
  KEY idx_rp_pool_rounds_game_status (game_type, status, closes_at),
  KEY idx_rp_pool_rounds_status (status, closes_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_pool_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  round_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  entry_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  entry_request_token VARCHAR(64) NOT NULL DEFAULT '',
  payout_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payout_request_token VARCHAR(64) NOT NULL DEFAULT '',
  option_key VARCHAR(40) NOT NULL DEFAULT '',
  stake_rp INT UNSIGNED NOT NULL DEFAULT 0,
  payout_rp INT UNSIGNED NOT NULL DEFAULT 0,
  net_rp INT NOT NULL DEFAULT 0,
  status ENUM('queued', 'processing', 'confirmed', 'rejected', 'failed', 'expired', 'canceled', 'lost', 'payout_queued', 'paid') NOT NULL DEFAULT 'queued',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_pool_entries_round (round_id, status),
  KEY idx_rp_pool_entries_player (player_id, created_at),
  KEY idx_rp_pool_entries_entry_request (entry_request_id),
  KEY idx_rp_pool_entries_payout_request (payout_request_id),
  CONSTRAINT fk_rp_pool_entries_round FOREIGN KEY (round_id) REFERENCES rp_pool_rounds (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_pool_entries_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_pool_entries_entry_request FOREIGN KEY (entry_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL,
  CONSTRAINT fk_rp_pool_entries_payout_request FOREIGN KEY (payout_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
