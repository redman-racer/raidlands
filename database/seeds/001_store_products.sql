-- Run after database/migrations/018_store_bundle_offer_matrix.sql.
-- These rows create inactive offer slots. Set real RP costs, cash amounts, and
-- Stripe price_... IDs in Admin > Store before enabling any offer.

INSERT INTO store_products
  (slug, name, product_type, short_description, description, oxide_group, tier_priority, is_stackable, is_active, is_featured, sort_order)
VALUES
  ('vip-bronze', 'Bronze Kit Bundle', 'kit_bundle', 'Starter bundle for players who want the core shop kit set.', 'Main kit bundle mapped to vip_bronze. Link the included kits and perk permissions in Admin > Store.', 'vip_bronze', 10, 0, 1, 1, 10),
  ('vip-gold', 'Gold Kit Bundle', 'kit_bundle', 'Upgraded bundle with stronger kit access and optional perks.', 'Main kit bundle mapped to vip_gold. Link the included kits and perk permissions in Admin > Store.', 'vip_gold', 20, 0, 1, 1, 20),
  ('vip-elite', 'Elite Kit Bundle', 'kit_bundle', 'Top bundle for players who want the widest kit and perk access.', 'Main kit bundle mapped to vip_elite. Link the included kits and perk permissions in Admin > Store.', 'vip_elite', 30, 0, 1, 1, 30),
  ('personal-mini', 'Personal Mini Perk', 'perk', 'Unlock personal minicopter access as a standalone perk.', 'Standalone perk mapped to perk_personal_mini. Link direct permission grants in Admin > Store.', 'perk_personal_mini', 0, 1, 1, 1, 110),
  ('skinbox-access', 'Skinbox Access', 'perk', 'Unlock Skinbox access as a standalone perk.', 'Standalone perk mapped to perk_skinbox. Link direct permission grants in Admin > Store.', 'perk_skinbox', 0, 1, 1, 1, 120),
  ('raid-kit-unlock', 'Raid Kit Unlock', 'kit_unlock', 'Unlock one premium raid kit without a full bundle.', 'Individual kit product mapped to perk_raid_kit. Link the kit in Admin > Store.', 'perk_raid_kit', 0, 1, 1, 1, 130),
  ('queue-priority', 'Queue Priority', 'perk', 'Add queue priority where your server stack supports it.', 'Standalone perk mapped to perk_queue_priority. Link direct permission grants in Admin > Store.', 'perk_queue_priority', 0, 1, 1, 0, 140),
  ('supporter-badge', 'Supporter Badge', 'perk', 'Profile and Discord-style supporter badge group.', 'Standalone identity perk mapped to perk_supporter_badge.', 'perk_supporter_badge', 0, 1, 1, 0, 150)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  product_type = VALUES(product_type),
  short_description = VALUES(short_description),
  description = VALUES(description),
  oxide_group = VALUES(oxide_group),
  tier_priority = VALUES(tier_priority),
  is_stackable = VALUES(is_stackable),
  is_active = VALUES(is_active),
  is_featured = VALUES(is_featured),
  sort_order = VALUES(sort_order);

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT
  p.id,
  'rp',
  CONCAT('rp_', p.slug, '_', offers.access_interval),
  offers.label,
  0,
  'rp',
  0,
  'one_time',
  offers.access_interval,
  offers.duration_seconds,
  CASE WHEN offers.access_interval = 'one_time' THEN 0 ELSE 1 END,
  0,
  0
FROM store_products p
INNER JOIN (
  SELECT 'one_time' AS access_interval, 'Lifetime RP Unlock' AS label, 0 AS duration_seconds
  UNION ALL SELECT 'day', 'Daily RP Pass', 86400
  UNION ALL SELECT 'week', 'Weekly RP Pass', 604800
  UNION ALL SELECT 'month', 'Monthly RP Pass', 2592000
  UNION ALL SELECT 'year', 'Yearly RP Pass', 31536000
) offers
WHERE p.slug IN ('vip-bronze', 'vip-gold', 'vip-elite', 'personal-mini', 'skinbox-access', 'raid-kit-unlock', 'queue-priority', 'supporter-badge')
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew),
  is_default = VALUES(is_default);

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT
  p.id,
  'stripe',
  CONCAT('configure_', p.slug, '_cash_pass_', offers.access_interval),
  offers.label,
  0,
  'usd',
  0,
  'one_time',
  offers.access_interval,
  offers.duration_seconds,
  0,
  0,
  CASE WHEN offers.access_interval = 'one_time' THEN 1 ELSE 0 END
FROM store_products p
INNER JOIN (
  SELECT 'one_time' AS access_interval, 'Lifetime Cash Pass' AS label, 0 AS duration_seconds
  UNION ALL SELECT 'day', 'Daily Cash Pass', 86400
  UNION ALL SELECT 'week', 'Weekly Cash Pass', 604800
  UNION ALL SELECT 'month', 'Monthly Cash Pass', 2592000
  UNION ALL SELECT 'year', 'Yearly Cash Pass', 31536000
) offers
WHERE p.slug IN ('vip-bronze', 'vip-gold', 'vip-elite', 'personal-mini', 'skinbox-access', 'raid-kit-unlock', 'queue-priority', 'supporter-badge')
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew),
  is_default = VALUES(is_default);

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT
  p.id,
  'stripe',
  CONCAT('configure_', p.slug, '_cash_sub_', offers.billing_interval),
  offers.label,
  0,
  'usd',
  0,
  offers.billing_interval,
  offers.billing_interval,
  offers.duration_seconds,
  0,
  0,
  0
FROM store_products p
INNER JOIN (
  SELECT 'day' AS billing_interval, 'Daily Cash Subscription' AS label, 86400 AS duration_seconds
  UNION ALL SELECT 'week', 'Weekly Cash Subscription', 604800
  UNION ALL SELECT 'month', 'Monthly Cash Subscription', 2592000
  UNION ALL SELECT 'year', 'Yearly Cash Subscription', 31536000
) offers
WHERE p.slug IN ('vip-bronze', 'vip-gold', 'vip-elite', 'personal-mini', 'skinbox-access', 'raid-kit-unlock', 'queue-priority', 'supporter-badge')
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew),
  is_default = VALUES(is_default);

INSERT INTO product_fulfillment_actions
  (product_id, action_type, oxide_group, sort_order)
SELECT p.id, 'grant_group', p.oxide_group, 10
FROM store_products p
WHERE p.oxide_group <> ''
ON DUPLICATE KEY UPDATE
  oxide_group = VALUES(oxide_group);
