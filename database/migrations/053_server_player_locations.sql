CREATE TABLE IF NOT EXISTS server_player_locations (
  server_id VARCHAR(120) NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  clan_tag VARCHAR(32) NOT NULL DEFAULT '',
  x DECIMAL(10,3) NOT NULL DEFAULT 0,
  y DECIMAL(10,3) NOT NULL DEFAULT 0,
  z DECIMAL(10,3) NOT NULL DEFAULT 0,
  is_online TINYINT(1) NOT NULL DEFAULT 1,
  sampled_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, steam_id64),
  KEY idx_server_player_locations_clan (server_id, clan_tag, is_online, sampled_at),
  KEY idx_server_player_locations_online (server_id, is_online, sampled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
