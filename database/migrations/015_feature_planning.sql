CREATE TABLE IF NOT EXISTS feature_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(140) NOT NULL,
  icon_alias VARCHAR(32) NOT NULL DEFAULT 'EVENT',
  title VARCHAR(180) NOT NULL,
  summary VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(120) NOT NULL DEFAULT '',
  public_status ENUM('active', 'planned', 'in_development', 'under_review', 'archived') NOT NULL DEFAULT 'under_review',
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  is_voteable TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 100,
  created_by_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feature_items_slug (slug),
  KEY idx_feature_items_public_status (is_public, public_status, sort_order),
  KEY idx_feature_items_voteable (is_voteable, public_status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  feature_id BIGINT UNSIGNED NULL,
  support_feedback_id BIGINT UNSIGNED NULL,
  player_id BIGINT UNSIGNED NULL,
  steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  source_type ENUM('public', 'feedback', 'staff', 'staff_import') NOT NULL DEFAULT 'public',
  status ENUM('pending', 'grouped', 'rejected') NOT NULL DEFAULT 'pending',
  title VARCHAR(180) NOT NULL,
  details TEXT NOT NULL,
  admin_note TEXT NULL,
  created_by_steam_id64 VARCHAR(32) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feature_suggestions_feedback (support_feedback_id),
  KEY idx_feature_suggestions_status (status, created_at),
  KEY idx_feature_suggestions_feature (feature_id, status),
  KEY idx_feature_suggestions_player (player_id, created_at),
  KEY idx_feature_suggestions_steam (steam_id64, created_at),
  CONSTRAINT fk_feature_suggestions_feature FOREIGN KEY (feature_id) REFERENCES feature_items (id) ON DELETE SET NULL,
  CONSTRAINT fk_feature_suggestions_feedback FOREIGN KEY (support_feedback_id) REFERENCES support_feedback (id) ON DELETE SET NULL,
  CONSTRAINT fk_feature_suggestions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  feature_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  vote_window_start DATETIME NOT NULL,
  vote_window_end DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feature_votes_player_feature_window (player_id, feature_id, vote_window_start),
  KEY idx_feature_votes_feature_window (feature_id, vote_window_start),
  KEY idx_feature_votes_player_window (player_id, vote_window_start),
  CONSTRAINT fk_feature_votes_feature FOREIGN KEY (feature_id) REFERENCES feature_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_feature_votes_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO feature_items
  (slug, icon_alias, title, summary, category, public_status, is_public, is_voteable, sort_order, created_by_steam_id64)
VALUES
  ('1000x-gather', 'GATHER', '1000x Gather', 'Farm fast, gear fast, and spend more time fighting than waiting.', 'Combat and Raiding', 'active', 1, 0, 10, '76561198274680338'),
  ('battlefield-pvp', 'PVP', 'Battlefield PvP', 'A high-rate battlefield tuned for counters, chaos, and quick returns.', 'Combat and Raiding', 'active', 1, 0, 20, '76561198274680338'),
  ('kits', 'KIT', 'Kits', 'Fast starter and combat kits keep the pace moving after every death.', 'Movement and Convenience', 'active', 1, 0, 30, '76561198274680338'),
  ('teleport-homes', 'TP', 'Teleport / Homes', 'Move between bases, fights, teammates, and rebuilds without dead time.', 'Movement and Convenience', 'active', 1, 0, 40, '76561198274680338'),
  ('clans', 'CLAN', 'Clans', 'Build your team name around rivalries and wipe-long wars.', 'Community and Clans', 'active', 1, 0, 50, '76561198274680338'),
  ('skinbox', 'SKIN', 'Skinbox', 'Keep bases and gear looking sharp without breaking the battlefield pace.', 'Movement and Convenience', 'active', 1, 0, 60, '76561198274680338'),
  ('backpacks', 'PACK', 'Backpacks', 'Extra carry capacity for raiders, builders, and loot runners.', 'Movement and Convenience', 'active', 1, 0, 70, '76561198274680338'),
  ('personal-mini', 'MINI', 'Personal Mini', 'Fast map movement for scouts, counters, and strike teams.', 'Movement and Convenience', 'active', 1, 0, 80, '76561198274680338'),
  ('shop', 'SHOP', 'Shop', 'High-rate convenience economy for supplies, movement, and recovery.', 'Movement and Convenience', 'active', 1, 0, 90, '76561198274680338'),
  ('custom-events', 'EVENT', 'Custom Events', 'Wipe fights, clan clashes, and staff-run chaos during live seasons.', 'Community and Clans', 'active', 1, 0, 100, '76561198274680338'),
  ('active-staff', 'STAFF', 'Active Staff', 'Clear support, bug response, and rule enforcement without over-policing PvP.', 'Trust and Performance', 'active', 1, 0, 110, '76561198274680338'),
  ('performance-focused', 'FPS', 'Performance Focused', 'Lean systems and practical moderation built around stable wipe nights.', 'Trust and Performance', 'active', 1, 0, 120, '76561198274680338'),
  ('leaderboards', 'STAT', 'Leaderboards', 'Player rankings for kills, K/D, playtime, and RP sync from the game server.', 'Website Systems', 'active', 1, 0, 130, '76561198274680338'),
  ('player-profiles', 'ID', 'Player Profiles', 'Connected Steam profiles show VIP access, wipe stats, RP, and entitlement history.', 'Website Systems', 'active', 1, 0, 140, '76561198274680338'),
  ('account-linking', 'ID', 'Account Linking', 'Native Steam sign-in ties stats, VIP, and perks to the right Rust player.', 'Website Systems', 'active', 1, 0, 150, '76561198274680338'),
  ('vip-kits', 'KIT', 'VIP Kits', 'VIP tiers and one-time perks are tied to Steam and synced into the game.', 'Store and Rewards', 'active', 1, 0, 160, '76561198274680338'),
  ('clan-web-pages', 'CLAN', 'Clan Website Pages', 'Clan play and rivalries are active in game, with richer website pages able to build on top.', 'Community and Clans', 'planned', 1, 1, 170, '76561198274680338'),
  ('wipe-events', 'EVENT', 'Wipe Events', 'Wipe fights, clan clashes, staff battles, and community chaos are part of the live cadence.', 'Community and Clans', 'active', 1, 0, 180, '76561198274680338'),
  ('vote-rewards', 'PLAY', 'Vote Rewards', 'Voting loops can plug into the connected account layer as the web hub expands.', 'Store and Rewards', 'planned', 1, 1, 190, '76561198274680338'),
  ('appeals-and-support', 'APPEAL', 'Appeals and Support', 'Discord remains the active path for tickets, reports, and ban appeals.', 'Trust and Performance', 'active', 1, 0, 200, '76561198274680338')
ON DUPLICATE KEY UPDATE
  icon_alias = VALUES(icon_alias),
  title = VALUES(title),
  summary = VALUES(summary),
  category = VALUES(category),
  public_status = VALUES(public_status),
  is_public = VALUES(is_public),
  is_voteable = VALUES(is_voteable),
  sort_order = VALUES(sort_order),
  updated_at = NOW();

INSERT INTO feature_suggestions
  (support_feedback_id, player_id, steam_id64, source_type, status, title, details, admin_note, created_by_steam_id64, created_at, updated_at)
SELECT
  sf.id,
  sf.player_id,
  CASE
    WHEN sf.steam_id64 REGEXP '^7656119[0-9]{10}$' THEN sf.steam_id64
    WHEN p.steam_id64 REGEXP '^7656119[0-9]{10}$' THEN p.steam_id64
    ELSE '76561198274680338'
  END AS steam_id64,
  CASE
    WHEN sf.steam_id64 REGEXP '^7656119[0-9]{10}$' OR p.steam_id64 REGEXP '^7656119[0-9]{10}$' THEN 'feedback'
    ELSE 'staff_import'
  END AS source_type,
  'pending',
  LEFT(sf.summary, 180),
  sf.details,
  CONCAT('Imported from support feedback ', sf.public_id, '.'),
  '76561198274680338',
  sf.submitted_at,
  sf.updated_at
FROM support_feedback sf
LEFT JOIN players p ON p.id = sf.player_id
WHERE sf.type = 'feature_request'
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  details = VALUES(details),
  updated_at = VALUES(updated_at);
