CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NULL,
  steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  steam_avatar_url VARCHAR(500) NOT NULL DEFAULT '',
  steam_profile_url VARCHAR(500) NOT NULL DEFAULT '',
  is_staff TINYINT(1) NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
  hidden_by_steam_id64 VARCHAR(32) NULL DEFAULT NULL,
  hidden_reason VARCHAR(500) NOT NULL DEFAULT '',
  hidden_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_messages_public (status, id),
  KEY idx_chat_messages_created (created_at, id),
  KEY idx_chat_messages_player_time (steam_id64, created_at),
  CONSTRAINT fk_chat_messages_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_mutes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  steam_id64 VARCHAR(32) NOT NULL,
  muted_by_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  reason VARCHAR(500) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  revoked_by_steam_id64 VARCHAR(32) NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_mutes_player_active (steam_id64, is_active, expires_at),
  KEY idx_chat_mutes_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_moderation_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NULL,
  target_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  actor_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  action ENUM('hide', 'restore', 'mute', 'unmute') NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_moderation_message (message_id, created_at),
  KEY idx_chat_moderation_target (target_steam_id64, created_at),
  KEY idx_chat_moderation_actor (actor_steam_id64, created_at),
  CONSTRAINT fk_chat_moderation_message FOREIGN KEY (message_id) REFERENCES chat_messages (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_permissions (permission_key, label, description) VALUES
  ('admin.chat.manage', 'Manage public chat', 'Allows moderating the Steam-linked public lobby chat.')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  updated_at = NOW();

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p ON p.permission_key = 'admin.chat.manage'
WHERE r.slug IN ('owner', 'administrator', 'moderator', 'support');
