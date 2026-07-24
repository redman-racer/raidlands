-- Migration 080: make the Titan website product explicitly grant its advertised
-- 48-slot backpack and keep-on-wipe perk groups in addition to the Titan rank.

START TRANSACTION;

INSERT INTO product_fulfillment_actions
  (product_id, action_type, oxide_group, sort_order)
SELECT
  products.id,
  'grant_group',
  perks.oxide_group,
  perks.sort_order
FROM store_products products
INNER JOIN (
  SELECT 'perk_backpack_48' oxide_group, 20 sort_order
  UNION ALL
  SELECT 'perk_backpack_keep_wipe', 30
) perks
WHERE products.slug = 'rank-titan-vip'
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order),
  updated_at = NOW();

-- Force active Titan entitlements to receive a new cursor so connected players
-- are reconciled with both added website fulfillment groups.
UPDATE entitlements entitlements
INNER JOIN store_products products ON products.id = entitlements.product_id
SET entitlements.changed_at = NOW(),
    entitlements.last_synced_at = NULL,
    entitlements.updated_at = NOW()
WHERE products.slug = 'rank-titan-vip'
  AND entitlements.status = 'active'
  AND (entitlements.ends_at IS NULL OR entitlements.ends_at > NOW());

COMMIT;
