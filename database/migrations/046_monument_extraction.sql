-- Monument Extraction is intentionally disabled by default. The PHP service seeds
-- the first versioned configuration from data/monument-extraction-default.json.

SET @has_monument_enabled = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rp_game_settings'
    AND COLUMN_NAME = 'monument_extraction_enabled'
);
SET @sql = IF(
  @has_monument_enabled = 0,
  'ALTER TABLE rp_game_settings ADD COLUMN monument_extraction_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER jackpot_enabled',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

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
    'monument_wager',
    'monument_payout',
    'admin_adjustment'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS monument_extraction_config_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  version_name VARCHAR(80) NOT NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  config_json LONGTEXT NOT NULL,
  config_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL DEFAULT NULL,
  activated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monument_config_hash (config_hash),
  KEY idx_monument_config_active (is_active, id),
  CONSTRAINT fk_monument_config_admin FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monument_extraction_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  active_player_key BIGINT UNSIGNED NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'CREATING',
  wager_rp INT UNSIGNED NOT NULL,
  payout_rp INT UNSIGNED NOT NULL DEFAULT 0,
  payout_multiplier_bps INT UNSIGNED NOT NULL DEFAULT 0,
  loadout_key VARCHAR(40) NOT NULL,
  config_version_id BIGINT UNSIGNED NOT NULL,
  frozen_config_json LONGTEXT NOT NULL,
  seed_commitment CHAR(64) NOT NULL,
  server_seed_encrypted TEXT NOT NULL,
  state_json LONGTEXT NOT NULL,
  wager_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payout_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payout_status VARCHAR(30) NOT NULL DEFAULT 'none',
  failure_reason VARCHAR(120) NOT NULL DEFAULT '',
  lock_version INT UNSIGNED NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monument_active_player (active_player_key),
  UNIQUE KEY uq_monument_wager_request (wager_request_id),
  UNIQUE KEY uq_monument_payout_request (payout_request_id),
  KEY idx_monument_runs_player (player_id, created_at),
  KEY idx_monument_runs_status (status, expires_at),
  CONSTRAINT fk_monument_runs_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_monument_runs_config FOREIGN KEY (config_version_id) REFERENCES monument_extraction_config_versions (id),
  CONSTRAINT fk_monument_runs_wager FOREIGN KEY (wager_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL,
  CONSTRAINT fk_monument_runs_payout FOREIGN KEY (payout_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monument_extraction_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  client_action_id VARCHAR(64) NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  action_type VARCHAR(60) NOT NULL,
  request_payload_json LONGTEXT NULL,
  result_payload_json LONGTEXT NULL,
  random_draw_start INT UNSIGNED NOT NULL DEFAULT 0,
  random_draw_end INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monument_action_client (player_id, client_action_id),
  UNIQUE KEY uq_monument_action_sequence (run_id, sequence_number),
  KEY idx_monument_actions_run (run_id, id),
  CONSTRAINT fk_monument_actions_run FOREIGN KEY (run_id) REFERENCES monument_extraction_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_monument_actions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
