-- Adds Blackjack, European Roulette, and 5x3 Slots to the RP Casino.
-- Safe to rerun: enum changes are idempotent and setting columns are checked.

SET @schema_name := DATABASE();

ALTER TABLE rp_point_requests
  MODIFY COLUMN source_type ENUM(
    'vote_reward','coinflip','dice','high_low','wheel','jackpot_entry','jackpot_payout',
    'raid_duel_entry','raid_duel_payout','supply_run_entry','supply_run_payout',
    'monument_wager','monument_payout','roulette','slots',
    'blackjack_wager','blackjack_double','blackjack_payout','admin_adjustment'
  ) NOT NULL;

ALTER TABLE rp_game_rounds
  MODIFY COLUMN game_type ENUM('coinflip','dice','high_low','wheel','roulette','slots') NOT NULL;

SET @column_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='rp_game_settings' AND COLUMN_NAME='roulette_enabled');
SET @sql := IF(@column_exists=0, 'ALTER TABLE rp_game_settings ADD COLUMN roulette_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER wheel_enabled', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='rp_game_settings' AND COLUMN_NAME='slots_enabled');
SET @sql := IF(@column_exists=0, 'ALTER TABLE rp_game_settings ADD COLUMN slots_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER roulette_enabled', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='rp_game_settings' AND COLUMN_NAME='blackjack_enabled');
SET @sql := IF(@column_exists=0, 'ALTER TABLE rp_game_settings ADD COLUMN blackjack_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER slots_enabled', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='rp_game_settings' AND COLUMN_NAME='casino_rtp_preset');
SET @sql := IF(@column_exists=0, 'ALTER TABLE rp_game_settings ADD COLUMN casino_rtp_preset ENUM(''safe'',''balanced'',''generous'') NOT NULL DEFAULT ''balanced'' AFTER blackjack_enabled', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS rp_blackjack_hands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  active_player_key BIGINT UNSIGNED NULL,
  status ENUM('wager_queued','playing','double_queued','payout_queued','paid','lost','push','canceled','failed') NOT NULL DEFAULT 'wager_queued',
  stake_rp INT UNSIGNED NOT NULL,
  total_stake_rp INT UNSIGNED NOT NULL,
  payout_rp INT UNSIGNED NOT NULL DEFAULT 0,
  player_cards_json TEXT NOT NULL,
  dealer_cards_json TEXT NOT NULL,
  deck_json LONGTEXT NOT NULL,
  deck_position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  action_version INT UNSIGNED NOT NULL DEFAULT 1,
  wager_request_id BIGINT UNSIGNED NULL,
  double_request_id BIGINT UNSIGNED NULL,
  payout_request_id BIGINT UNSIGNED NULL,
  last_action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blackjack_active_player (active_player_key),
  KEY idx_blackjack_player_created (player_id, created_at),
  KEY idx_blackjack_status_action (status, last_action_at),
  CONSTRAINT fk_blackjack_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_blackjack_wager_request FOREIGN KEY (wager_request_id) REFERENCES rp_point_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_blackjack_double_request FOREIGN KEY (double_request_id) REFERENCES rp_point_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_blackjack_payout_request FOREIGN KEY (payout_request_id) REFERENCES rp_point_requests(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
