-- Clears stale Stripe catalog IDs that Stripe reports as deleted.
-- Admin > Store will recreate managed Product/Price rows on the next save.

UPDATE store_products
SET stripe_product_id = '',
    stripe_sync_mode = 'auto',
    stripe_sync_status = 'pending',
    stripe_sync_error = '',
    stripe_last_synced_at = NULL,
    updated_at = NOW()
WHERE stripe_product_id = 'prod_UqhN1uB7o3mWz2'
   OR stripe_sync_error LIKE '%No such product:%';

UPDATE store_prices
SET stripe_price_id = '',
    stripe_managed = 0,
    stripe_sync_mode = 'auto',
    stripe_sync_status = CASE
      WHEN is_active = 1 AND amount_cents > 0 THEN 'pending'
      ELSE 'skipped'
    END,
    stripe_sync_error = '',
    stripe_last_synced_at = NULL,
    updated_at = NOW()
WHERE stripe_price_id = 'price_1TqzytAAkrEKPrBYVQy4XOv3'
   OR stripe_sync_error LIKE '%No such price:%';
