-- Expands the store from VIP/perk-only products into kit bundles, individual kits,
-- and standalone perks with RP, one-time cash pass, and recurring cash offer slots.

ALTER TABLE store_products
  MODIFY product_type ENUM('kit_bundle', 'kit_unlock', 'perk', 'vip_subscription', 'one_time_perk', 'one_time_kit_unlock') NOT NULL DEFAULT 'perk';

UPDATE store_products
SET product_type = CASE product_type
  WHEN 'vip_subscription' THEN 'kit_bundle'
  WHEN 'one_time_kit_unlock' THEN 'kit_unlock'
  WHEN 'one_time_perk' THEN 'perk'
  ELSE product_type
END;

ALTER TABLE store_prices
  MODIFY billing_interval ENUM('one_time', 'day', 'week', 'month', 'year') NOT NULL DEFAULT 'one_time',
  MODIFY access_interval ENUM('one_time', 'day', 'week', 'month', 'year') NOT NULL DEFAULT 'one_time';

UPDATE store_prices sp
INNER JOIN store_products p ON p.id = sp.product_id
SET sp.billing_interval = CASE
    WHEN sp.payment_method = 'stripe'
      AND sp.billing_interval = 'month'
      AND sp.access_interval = 'one_time'
      THEN 'month'
    ELSE sp.billing_interval
  END,
  sp.access_interval = CASE
    WHEN sp.payment_method = 'stripe'
      AND sp.billing_interval IN ('day', 'week', 'month', 'year')
      THEN sp.billing_interval
    WHEN sp.access_interval IN ('day', 'week', 'month', 'year')
      THEN sp.access_interval
    ELSE 'one_time'
  END;

UPDATE store_prices sp
SET sp.access_duration_seconds = CASE
    WHEN sp.access_interval = 'day' THEN 86400
    WHEN sp.access_interval = 'week' THEN 604800
    WHEN sp.access_interval = 'month' THEN 2592000
    WHEN sp.access_interval = 'year' THEN 31536000
    ELSE 0
  END,
  sp.allow_auto_renew = CASE
    WHEN sp.payment_method = 'rp' AND sp.access_interval IN ('day', 'week', 'month', 'year') THEN sp.allow_auto_renew
    ELSE 0
  END;

UPDATE store_prices sp
INNER JOIN store_products p ON p.id = sp.product_id
SET sp.stripe_price_id = CASE
  WHEN sp.payment_method = 'rp'
    THEN CONCAT('rp_', p.slug, '_', sp.access_interval)
  WHEN sp.payment_method = 'stripe' AND sp.billing_interval = 'one_time'
    THEN CONCAT('configure_', p.slug, '_cash_pass_', sp.access_interval)
  WHEN sp.payment_method = 'stripe'
    THEN CONCAT('configure_', p.slug, '_cash_sub_', sp.billing_interval)
  ELSE sp.stripe_price_id
END
WHERE sp.stripe_price_id = CONCAT('configure_', p.slug)
   OR sp.stripe_price_id = CONCAT('rp_', p.slug, '_one_time');

CREATE TABLE IF NOT EXISTS store_product_permission_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  permission_name VARCHAR(180) NOT NULL,
  display_label VARCHAR(160) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_product_permission_grants (product_id, permission_name),
  KEY idx_store_product_permission_product (product_id, sort_order),
  CONSTRAINT fk_store_product_permission_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
