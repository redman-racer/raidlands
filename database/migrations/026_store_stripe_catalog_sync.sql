-- Tracks the Stripe catalog objects generated from Admin > Store.
-- Local store_products and store_prices remain the source of truth.

ALTER TABLE store_products
  ADD COLUMN stripe_product_id VARCHAR(160) NOT NULL DEFAULT '' AFTER sort_order,
  ADD COLUMN stripe_sync_mode ENUM('auto', 'external', 'disabled') NOT NULL DEFAULT 'auto' AFTER stripe_product_id,
  ADD COLUMN stripe_sync_status ENUM('pending', 'synced', 'skipped', 'archived', 'external', 'error') NOT NULL DEFAULT 'pending' AFTER stripe_sync_mode,
  ADD COLUMN stripe_sync_error VARCHAR(500) NOT NULL DEFAULT '' AFTER stripe_sync_status,
  ADD COLUMN stripe_last_synced_at TIMESTAMP NULL DEFAULT NULL AFTER stripe_sync_error,
  ADD KEY idx_store_products_stripe_product (stripe_product_id),
  ADD KEY idx_store_products_stripe_sync (stripe_sync_status, stripe_last_synced_at);

ALTER TABLE store_prices
  ADD COLUMN stripe_lookup_key VARCHAR(200) NOT NULL DEFAULT '' AFTER stripe_price_id,
  ADD COLUMN stripe_managed TINYINT(1) NOT NULL DEFAULT 0 AFTER stripe_lookup_key,
  ADD COLUMN stripe_sync_mode ENUM('auto', 'external', 'disabled') NOT NULL DEFAULT 'auto' AFTER stripe_managed,
  ADD COLUMN stripe_sync_status ENUM('pending', 'synced', 'skipped', 'archived', 'external', 'error') NOT NULL DEFAULT 'pending' AFTER stripe_sync_mode,
  ADD COLUMN stripe_sync_error VARCHAR(500) NOT NULL DEFAULT '' AFTER stripe_sync_status,
  ADD COLUMN stripe_last_synced_at TIMESTAMP NULL DEFAULT NULL AFTER stripe_sync_error,
  ADD KEY idx_store_prices_stripe_lookup (stripe_lookup_key),
  ADD KEY idx_store_prices_stripe_sync (stripe_managed, stripe_sync_status, stripe_last_synced_at);

UPDATE store_products
SET stripe_sync_mode = 'auto',
    stripe_sync_status = CASE WHEN is_active = 1 THEN 'pending' ELSE 'skipped' END,
    stripe_sync_error = '',
    stripe_last_synced_at = NULL
WHERE stripe_sync_status = 'pending';

UPDATE store_prices
SET stripe_lookup_key = CASE
      WHEN payment_method = 'stripe' THEN CONCAT('raidlands_store_price_', id)
      ELSE ''
    END,
    stripe_managed = 0,
    stripe_sync_mode = CASE
      WHEN payment_method <> 'stripe' THEN 'disabled'
      WHEN stripe_price_id LIKE 'price\_%' THEN 'external'
      ELSE 'auto'
    END,
    stripe_sync_status = CASE
      WHEN payment_method <> 'stripe' THEN 'skipped'
      WHEN stripe_price_id LIKE 'price\_%' THEN 'external'
      WHEN is_active = 1 AND amount_cents > 0 THEN 'pending'
      ELSE 'skipped'
    END,
    stripe_sync_error = '',
    stripe_last_synced_at = NULL;
