CREATE TABLE IF NOT EXISTS discord_integration_settings (
  setting_key VARCHAR(120) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by_steam_id64 VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO discord_integration_settings (setting_key, setting_value) VALUES
  ('enabled', '0'), ('guild_id', ''), ('verified_role_id', ''),
  ('connection_label', 'Connect Discord'),
  ('connection_guidance', 'Connect Discord to verify your Raidlands player account and receive managed community roles.'),
  ('auto_join_guild', '1'), ('assign_verified_role', '1'), ('remove_roles_on_unlink', '1'),
  ('sync_interval_minutes', '15'), ('retry_limit', '5'), ('failure_notification_threshold', '3')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS discord_identities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  username VARCHAR(120) NOT NULL DEFAULT '',
  global_name VARCHAR(120) NOT NULL DEFAULT '',
  avatar_hash VARCHAR(255) NOT NULL DEFAULT '',
  guild_member TINYINT(1) NOT NULL DEFAULT 0,
  observed_role_ids_json LONGTEXT NULL,
  status ENUM('linked','sync_pending','synced','error','unlinked') NOT NULL DEFAULT 'linked',
  last_error VARCHAR(1000) NOT NULL DEFAULT '',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  unlinked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discord_identities_player (player_id),
  UNIQUE KEY uq_discord_identities_user (discord_user_id),
  KEY idx_discord_identities_status (status, updated_at),
  CONSTRAINT fk_discord_identities_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discord_role_mappings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  oxide_group VARCHAR(120) NOT NULL,
  discord_role_id VARCHAR(32) NOT NULL,
  label VARCHAR(160) NOT NULL DEFAULT '',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  remove_when_inactive TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discord_role_mapping_group (oxide_group),
  UNIQUE KEY uq_discord_role_mapping_role (discord_role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discord_sync_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'system',
  status ENUM('pending','processing','complete','failed') NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_discord_sync_queue (status, available_at, id),
  KEY idx_discord_sync_player (player_id, status),
  CONSTRAINT fk_discord_sync_jobs_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discord_connection_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NULL,
  discord_user_id VARCHAR(32) NOT NULL DEFAULT '',
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'info',
  actor VARCHAR(120) NOT NULL DEFAULT 'system',
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_discord_events_created (created_at),
  KEY idx_discord_events_player (player_id, created_at),
  CONSTRAINT fk_discord_events_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_permissions (permission_key, label, description) VALUES
  ('admin.discord.view', 'View Discord integration', 'View Discord connection status, mappings, linked players, and diagnostics.'),
  ('admin.discord.manage', 'Manage Discord integration', 'Change Discord behavior, mappings, and linked-player synchronization.')
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), updated_at = NOW();

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r INNER JOIN admin_permissions p
WHERE r.slug IN ('owner', 'administrator') AND p.permission_key IN ('admin.discord.view', 'admin.discord.manage');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r INNER JOIN admin_permissions p
WHERE r.slug = 'support' AND p.permission_key = 'admin.discord.view';
