CREATE TABLE IF NOT EXISTS server_player_location_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  server_id VARCHAR(120) NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  clan_tag VARCHAR(32) NOT NULL DEFAULT '',
  x DECIMAL(10,3) NOT NULL DEFAULT 0,
  y DECIMAL(10,3) NOT NULL DEFAULT 0,
  z DECIMAL(10,3) NOT NULL DEFAULT 0,
  sampled_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_player_location_sample (server_id, steam_id64, sampled_at),
  KEY idx_player_location_history_time (server_id, sampled_at),
  KEY idx_player_location_history_clan (server_id, clan_tag, sampled_at),
  KEY idx_player_location_history_player (server_id, steam_id64, sampled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO server_player_location_history
  (server_id, steam_id64, display_name, clan_tag, x, y, z, sampled_at)
SELECT
  server_id, steam_id64, display_name, clan_tag, x, y, z, sampled_at
FROM server_player_locations
WHERE sampled_at IS NOT NULL;
