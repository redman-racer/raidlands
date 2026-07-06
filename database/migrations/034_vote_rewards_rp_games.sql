CREATE TABLE IF NOT EXISTS vote_reward_sites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  vote_url_template VARCHAR(700) NOT NULL DEFAULT '',
  verification_mode ENUM('hybrid', 'strict', 'manual') NOT NULL DEFAULT 'hybrid',
  callback_token VARCHAR(80) NOT NULL DEFAULT '',
  reward_rp INT UNSIGNED NOT NULL DEFAULT 200,
  cooldown_hours INT UNSIGNED NOT NULL DEFAULT 24,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vote_reward_sites_slug (slug),
  KEY idx_vote_reward_sites_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_point_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_token VARCHAR(64) NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  source_type ENUM('vote_reward', 'coinflip', 'dice', 'jackpot_entry', 'jackpot_payout', 'admin_adjustment') NOT NULL,
  source_id VARCHAR(64) NOT NULL DEFAULT '',
  debit_rp INT UNSIGNED NOT NULL DEFAULT 0,
  credit_rp INT UNSIGNED NOT NULL DEFAULT 0,
  reason VARCHAR(160) NOT NULL DEFAULT '',
  status ENUM('queued', 'processing', 'confirmed', 'rejected', 'failed', 'expired', 'canceled') NOT NULL DEFAULT 'queued',
  fail_code VARCHAR(80) NOT NULL DEFAULT '',
  message VARCHAR(500) NOT NULL DEFAULT '',
  balance_before INT NULL DEFAULT NULL,
  balance_after INT NULL DEFAULT NULL,
  bridge_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_at TIMESTAMP NULL DEFAULT NULL,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rp_point_requests_token (request_token),
  KEY idx_rp_point_requests_status (status, expires_at, locked_at),
  KEY idx_rp_point_requests_player (player_id, created_at),
  KEY idx_rp_point_requests_source (source_type, source_id),
  CONSTRAINT fk_rp_point_requests_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vote_reward_claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  rp_point_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  request_token VARCHAR(64) NOT NULL DEFAULT '',
  external_vote_id VARCHAR(120) NULL DEFAULT NULL,
  claim_source ENUM('manual', 'callback') NOT NULL DEFAULT 'manual',
  status ENUM('pending_callback', 'queued', 'processing', 'confirmed', 'rejected', 'failed', 'expired') NOT NULL DEFAULT 'queued',
  reward_rp INT UNSIGNED NOT NULL DEFAULT 0,
  message VARCHAR(500) NOT NULL DEFAULT '',
  callback_received TINYINT(1) NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vote_reward_external_vote (site_id, external_vote_id),
  KEY idx_vote_reward_claims_player_site (player_id, site_id, created_at),
  KEY idx_vote_reward_claims_request (rp_point_request_id),
  CONSTRAINT fk_vote_reward_claims_site FOREIGN KEY (site_id) REFERENCES vote_reward_sites (id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_reward_claims_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_reward_claims_request FOREIGN KEY (rp_point_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_game_settings (
  id TINYINT UNSIGNED NOT NULL,
  games_enabled TINYINT(1) NOT NULL DEFAULT 1,
  coinflip_enabled TINYINT(1) NOT NULL DEFAULT 1,
  dice_enabled TINYINT(1) NOT NULL DEFAULT 1,
  jackpot_enabled TINYINT(1) NOT NULL DEFAULT 1,
  min_stake_rp INT UNSIGNED NOT NULL DEFAULT 200,
  max_stake_rp INT UNSIGNED NOT NULL DEFAULT 2000,
  coinflip_payout_multiplier_basis INT UNSIGNED NOT NULL DEFAULT 200,
  dice_win_chance_percent INT UNSIGNED NOT NULL DEFAULT 45,
  dice_payout_multiplier_basis INT UNSIGNED NOT NULL DEFAULT 200,
  jackpot_ticket_cost_rp INT UNSIGNED NOT NULL DEFAULT 200,
  jackpot_max_entries_per_player INT UNSIGNED NOT NULL DEFAULT 10,
  jackpot_round_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  jackpot_house_edge_percent INT UNSIGNED NOT NULL DEFAULT 10,
  daily_wager_cap_rp INT UNSIGNED NOT NULL DEFAULT 10000,
  daily_loss_cap_rp INT UNSIGNED NOT NULL DEFAULT 5000,
  self_exclusion_enabled TINYINT(1) NOT NULL DEFAULT 1,
  terms_copy TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO rp_game_settings (
  id,
  games_enabled,
  coinflip_enabled,
  dice_enabled,
  jackpot_enabled,
  min_stake_rp,
  max_stake_rp,
  jackpot_ticket_cost_rp,
  jackpot_max_entries_per_player,
  daily_wager_cap_rp,
  daily_loss_cap_rp,
  terms_copy
) VALUES (
  1,
  1,
  1,
  1,
  1,
  200,
  2000,
  200,
  10,
  10000,
  5000,
  'RP games use in-game Raidlands RP only. RP has no cash value, outcomes are not final until the Rust server confirms the point change, and admins may pause games at any time.'
)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO vote_reward_sites (
  slug,
  name,
  description,
  vote_url_template,
  verification_mode,
  callback_token,
  reward_rp,
  cooldown_hours,
  is_active,
  sort_order
) VALUES (
  'raidlands-vote-site',
  'Raidlands vote site',
  'Configure the real vote URL, callback token, and active flag before showing this site publicly.',
  'https://example.com/vote?steam={steam_id64}',
  'hybrid',
  '',
  200,
  24,
  0,
  100
)
ON DUPLICATE KEY UPDATE slug = slug;

CREATE TABLE IF NOT EXISTS rp_game_rounds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_type ENUM('coinflip', 'dice') NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  rp_point_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  request_token VARCHAR(64) NOT NULL DEFAULT '',
  stake_rp INT UNSIGNED NOT NULL DEFAULT 0,
  payout_rp INT UNSIGNED NOT NULL DEFAULT 0,
  net_rp INT NOT NULL DEFAULT 0,
  odds_basis_points INT UNSIGNED NOT NULL DEFAULT 0,
  player_choice VARCHAR(40) NOT NULL DEFAULT '',
  roll_result VARCHAR(80) NOT NULL DEFAULT '',
  status ENUM('queued', 'processing', 'confirmed', 'rejected', 'failed', 'canceled') NOT NULL DEFAULT 'queued',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_game_rounds_player (player_id, created_at),
  KEY idx_rp_game_rounds_request (rp_point_request_id),
  KEY idx_rp_game_rounds_status (status, created_at),
  CONSTRAINT fk_rp_game_rounds_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_game_rounds_request FOREIGN KEY (rp_point_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_jackpot_rounds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  round_key VARCHAR(80) NOT NULL,
  status ENUM('open', 'drawing', 'payout_queued', 'paid', 'failed', 'canceled') NOT NULL DEFAULT 'open',
  ticket_cost_rp INT UNSIGNED NOT NULL DEFAULT 200,
  max_entries_per_player INT UNSIGNED NOT NULL DEFAULT 10,
  house_edge_percent INT UNSIGNED NOT NULL DEFAULT 10,
  opens_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closes_at TIMESTAMP NULL DEFAULT NULL,
  pot_rp INT UNSIGNED NOT NULL DEFAULT 0,
  total_entries INT UNSIGNED NOT NULL DEFAULT 0,
  winner_player_id BIGINT UNSIGNED NULL DEFAULT NULL,
  winner_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  winner_entry_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payout_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payout_request_token VARCHAR(64) NOT NULL DEFAULT '',
  payout_rp INT UNSIGNED NOT NULL DEFAULT 0,
  draw_roll INT UNSIGNED NOT NULL DEFAULT 0,
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rp_jackpot_rounds_key (round_key),
  KEY idx_rp_jackpot_rounds_status (status, closes_at),
  KEY idx_rp_jackpot_rounds_winner (winner_player_id),
  KEY idx_rp_jackpot_rounds_payout (payout_request_id),
  CONSTRAINT fk_rp_jackpot_rounds_winner FOREIGN KEY (winner_player_id) REFERENCES players (id) ON DELETE SET NULL,
  CONSTRAINT fk_rp_jackpot_rounds_payout FOREIGN KEY (payout_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_jackpot_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  round_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  rp_point_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  request_token VARCHAR(64) NOT NULL DEFAULT '',
  ticket_count INT UNSIGNED NOT NULL DEFAULT 1,
  cost_rp INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('queued', 'processing', 'confirmed', 'rejected', 'failed', 'canceled') NOT NULL DEFAULT 'queued',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_jackpot_entries_round (round_id, status),
  KEY idx_rp_jackpot_entries_player_round (player_id, round_id, status),
  KEY idx_rp_jackpot_entries_request (rp_point_request_id),
  CONSTRAINT fk_rp_jackpot_entries_round FOREIGN KEY (round_id) REFERENCES rp_jackpot_rounds (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_jackpot_entries_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_jackpot_entries_request FOREIGN KEY (rp_point_request_id) REFERENCES rp_point_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_game_daily_limits (
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  limit_date DATE NOT NULL,
  wagered_rp INT UNSIGNED NOT NULL DEFAULT 0,
  loss_rp INT UNSIGNED NOT NULL DEFAULT 0,
  rounds_played INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, limit_date),
  KEY idx_rp_game_daily_limits_date (limit_date),
  CONSTRAINT fk_rp_game_daily_limits_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_game_self_exclusions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NULL DEFAULT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_game_self_exclusions_player (player_id, starts_at, ends_at),
  CONSTRAINT fk_rp_game_self_exclusions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_permissions (permission_key, label, description) VALUES
  ('admin.rewards.manage', 'Manage rewards and RP games', 'Allows managing vote rewards, RP game settings, and reward-game request queues.')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  updated_at = NOW();

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p ON p.permission_key = 'admin.rewards.manage'
WHERE r.slug IN ('owner', 'administrator');
