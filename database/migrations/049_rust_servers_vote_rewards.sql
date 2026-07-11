-- Adds direct Rust-Servers.net SteamID claim verification to vote rewards.
-- Safe to rerun on MySQL/MariaDB: each column is checked before creation.

SET @schema_name := DATABASE();

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'vote_reward_sites'
    AND COLUMN_NAME = 'api_provider'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE vote_reward_sites ADD COLUMN api_provider VARCHAR(40) NOT NULL DEFAULT ''none'' AFTER verification_mode',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'vote_reward_sites'
    AND COLUMN_NAME = 'api_key'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE vote_reward_sites ADD COLUMN api_key VARCHAR(160) NOT NULL DEFAULT '''' AFTER api_provider',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'vote_reward_sites'
    AND COLUMN_NAME = 'api_server_id'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE vote_reward_sites ADD COLUMN api_server_id VARCHAR(80) NOT NULL DEFAULT '''' AFTER api_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO vote_reward_sites (
  slug,
  name,
  description,
  vote_url_template,
  verification_mode,
  api_provider,
  api_key,
  api_server_id,
  callback_token,
  reward_rp,
  cooldown_hours,
  is_active,
  sort_order
) VALUES (
  'rust-servers-net',
  'Rust-Servers.net',
  'Vote using Steam on Rust-Servers.net, then return here to verify and claim RP.',
  'https://rust-servers.net/server/178053/vote/',
  'hybrid',
  'rust_servers',
  '',
  '178053',
  '',
  200,
  24,
  0,
  10
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  vote_url_template = VALUES(vote_url_template),
  verification_mode = VALUES(verification_mode),
  api_provider = VALUES(api_provider),
  api_server_id = VALUES(api_server_id),
  sort_order = VALUES(sort_order),
  updated_at = NOW();
