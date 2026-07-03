ALTER TABLE store_prices
  ADD COLUMN payment_method ENUM('stripe', 'rp') NOT NULL DEFAULT 'stripe' AFTER product_id,
  ADD COLUMN rp_cost INT UNSIGNED NOT NULL DEFAULT 0 AFTER amount_cents,
  ADD COLUMN access_interval ENUM('one_time', 'day', 'week', 'month', 'year') NOT NULL DEFAULT 'one_time' AFTER billing_interval,
  ADD COLUMN access_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER access_interval,
  ADD COLUMN allow_auto_renew TINYINT(1) NOT NULL DEFAULT 0 AFTER access_duration_seconds;

UPDATE store_prices sp
INNER JOIN store_products p ON p.id = sp.product_id
SET sp.payment_method = 'stripe',
    sp.rp_cost = 0,
    sp.access_interval = CASE WHEN p.product_type = 'vip_subscription' THEN 'month' ELSE 'one_time' END,
    sp.access_duration_seconds = CASE WHEN p.product_type = 'vip_subscription' THEN 2592000 ELSE 0 END,
    sp.allow_auto_renew = 0
WHERE sp.payment_method = 'stripe';

ALTER TABLE entitlements
  MODIFY source_type ENUM('order', 'subscription', 'manual', 'rp_purchase', 'rp_subscription') NOT NULL;

CREATE TABLE IF NOT EXISTS rp_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_price_id BIGINT UNSIGNED NOT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  status ENUM('active', 'cancel_at_period_end', 'past_due', 'canceled', 'expired') NOT NULL DEFAULT 'active',
  rp_cost INT UNSIGNED NOT NULL DEFAULT 0,
  access_interval ENUM('one_time', 'day', 'week', 'month', 'year') NOT NULL DEFAULT 'month',
  access_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  current_period_start TIMESTAMP NULL DEFAULT NULL,
  current_period_end TIMESTAMP NULL DEFAULT NULL,
  next_renewal_at TIMESTAMP NULL DEFAULT NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  last_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  canceled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_subscriptions_player_status (player_id, status),
  KEY idx_rp_subscriptions_due (status, cancel_at_period_end, next_renewal_at),
  KEY idx_rp_subscriptions_price (store_price_id),
  CONSTRAINT fk_rp_subscriptions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_subscriptions_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_rp_subscriptions_price FOREIGN KEY (store_price_id) REFERENCES store_prices (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rp_purchase_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_token VARCHAR(64) NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_price_id BIGINT UNSIGNED NOT NULL,
  rp_subscription_id BIGINT UNSIGNED NULL DEFAULT NULL,
  steam_id64 VARCHAR(32) NOT NULL,
  rp_cost INT UNSIGNED NOT NULL DEFAULT 0,
  access_interval ENUM('one_time', 'day', 'week', 'month', 'year') NOT NULL DEFAULT 'month',
  access_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  auto_renew_requested TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('queued', 'processing', 'confirmed', 'rejected', 'failed', 'expired', 'canceled') NOT NULL DEFAULT 'queued',
  fail_code VARCHAR(80) NOT NULL DEFAULT '',
  message VARCHAR(500) NOT NULL DEFAULT '',
  balance_before INT NULL DEFAULT NULL,
  balance_after INT NULL DEFAULT NULL,
  bridge_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_at TIMESTAMP NULL DEFAULT NULL,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rp_purchase_requests_token (request_token),
  KEY idx_rp_purchase_requests_status (status, expires_at, locked_at),
  KEY idx_rp_purchase_requests_player (player_id, created_at),
  KEY idx_rp_purchase_requests_subscription (rp_subscription_id, created_at),
  CONSTRAINT fk_rp_purchase_requests_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_purchase_requests_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_rp_purchase_requests_price FOREIGN KEY (store_price_id) REFERENCES store_prices (id) ON DELETE RESTRICT,
  CONSTRAINT fk_rp_purchase_requests_subscription FOREIGN KEY (rp_subscription_id) REFERENCES rp_subscriptions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
