CREATE TABLE IF NOT EXISTS player_api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT '',
  scopes_json LONGTEXT NOT NULL,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_api_keys_hash (key_hash),
  KEY idx_player_api_keys_player (player_id, revoked_at, created_at),
  KEY idx_player_api_keys_steam (steam_id64, revoked_at),
  CONSTRAINT fk_player_api_keys_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rate_key VARCHAR(160) NOT NULL,
  route_key VARCHAR(120) NOT NULL,
  window_start TIMESTAMP NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_rate_limit_window (rate_key, route_key, window_start),
  KEY idx_api_rate_limits_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
