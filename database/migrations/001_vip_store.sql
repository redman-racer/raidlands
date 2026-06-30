CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  steam_id64 VARCHAR(32) NOT NULL,
  display_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_steam_id64 (steam_id64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS steam_identities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  display_name VARCHAR(120) NULL,
  avatar_url VARCHAR(500) NULL,
  profile_url VARCHAR(500) NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_steam_identities_steam_id64 (steam_id64),
  KEY idx_steam_identities_player_id (player_id),
  CONSTRAINT fk_steam_identities_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(160) NOT NULL,
  product_type ENUM('vip_subscription', 'one_time_perk', 'one_time_kit_unlock') NOT NULL,
  short_description VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NULL,
  oxide_group VARCHAR(120) NOT NULL DEFAULT '',
  tier_priority INT NOT NULL DEFAULT 0,
  is_stackable TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_products_slug (slug),
  KEY idx_store_products_type_active (product_type, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  stripe_price_id VARCHAR(160) NOT NULL DEFAULT '',
  label VARCHAR(120) NOT NULL DEFAULT '',
  amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'usd',
  billing_interval ENUM('one_time', 'month') NOT NULL DEFAULT 'one_time',
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_prices_stripe_price_id (stripe_price_id),
  KEY idx_store_prices_product_active (product_id, is_active, is_default),
  CONSTRAINT fk_store_prices_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_fulfillment_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('grant_group', 'revoke_group', 'note') NOT NULL DEFAULT 'grant_group',
  oxide_group VARCHAR(120) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_fulfillment_action (product_id, action_type, oxide_group),
  KEY idx_product_fulfillment_product (product_id, sort_order),
  CONSTRAINT fk_product_fulfillment_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_price_id BIGINT UNSIGNED NOT NULL,
  stripe_checkout_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  stripe_customer_id VARCHAR(255) NULL,
  mode ENUM('payment', 'subscription') NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'pending',
  amount_total_cents INT UNSIGNED NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'usd',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  refunded_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_checkout_session (stripe_checkout_session_id),
  KEY idx_orders_player_status (player_id, status),
  KEY idx_orders_payment_intent (stripe_payment_intent_id),
  CONSTRAINT fk_orders_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_price FOREIGN KEY (store_price_id) REFERENCES store_prices (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_price_id BIGINT UNSIGNED NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMP NULL DEFAULT NULL,
  current_period_end TIMESTAMP NULL DEFAULT NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  canceled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_stripe_subscription (stripe_subscription_id),
  KEY idx_subscriptions_player_status (player_id, status),
  CONSTRAINT fk_subscriptions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscriptions_price FOREIGN KEY (store_price_id) REFERENCES store_prices (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entitlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  source_type ENUM('order', 'subscription', 'manual') NOT NULL,
  source_id VARCHAR(255) NOT NULL DEFAULT '',
  oxide_group VARCHAR(120) NOT NULL DEFAULT '',
  status ENUM('pending', 'active', 'revoked', 'expired') NOT NULL DEFAULT 'pending',
  starts_at TIMESTAMP NULL DEFAULT NULL,
  ends_at TIMESTAMP NULL DEFAULT NULL,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entitlements_source_product (source_type, source_id, product_id),
  KEY idx_entitlements_player_status (player_id, status),
  KEY idx_entitlements_changed (changed_at),
  CONSTRAINT fk_entitlements_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_entitlements_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stripe_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stripe_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stripe_events_event_id (stripe_event_id),
  KEY idx_stripe_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bridge_sync_cursors (
  server_id VARCHAR(120) NOT NULL,
  last_cursor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_seen_changed_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor VARCHAR(120) NOT NULL DEFAULT 'admin',
  action VARCHAR(120) NOT NULL,
  subject_type VARCHAR(80) NOT NULL DEFAULT '',
  subject_id VARCHAR(120) NOT NULL DEFAULT '',
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_created (created_at),
  KEY idx_admin_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
