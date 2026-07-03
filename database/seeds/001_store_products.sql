INSERT INTO store_products
  (slug, name, product_type, short_description, description, oxide_group, tier_priority, is_stackable, is_active, is_featured, sort_order)
VALUES
  ('vip-bronze', 'Bronze VIP', 'vip_subscription', 'Starter VIP access with Bronze kit permissions.', 'Bronze VIP access mapped to the vip_bronze Oxide group. Configure the actual kit items, cooldowns, and max uses inside Rust Kits.', 'vip_bronze', 10, 0, 1, 1, 10),
  ('vip-gold', 'Gold VIP', 'vip_subscription', 'Upgraded VIP access with stronger Gold kit permissions.', 'Gold VIP access mapped to the vip_gold Oxide group. Rust Kits remains the source of truth for contents and cooldowns.', 'vip_gold', 20, 0, 1, 1, 20),
  ('vip-elite', 'Elite VIP', 'vip_subscription', 'Top VIP tier with Elite kit permissions.', 'Elite VIP access mapped to the vip_elite Oxide group. Keep cooldowns and max uses tuned in Rust Kits.', 'vip_elite', 30, 0, 1, 1, 30),
  ('personal-mini', 'Personal Mini Perk', 'one_time_perk', 'Unlock personal minicopter access as a one-time perk.', 'One-time perk mapped to the perk_personal_mini group.', 'perk_personal_mini', 0, 1, 1, 1, 110),
  ('skinbox-access', 'Skinbox Access', 'one_time_perk', 'Unlock Skinbox access as a one-time perk.', 'One-time perk mapped to the perk_skinbox group.', 'perk_skinbox', 0, 1, 1, 1, 120),
  ('raid-kit-unlock', 'Raid Kit Unlock', 'one_time_kit_unlock', 'Unlock a premium raid kit permission.', 'One-time kit unlock mapped to the perk_raid_kit group.', 'perk_raid_kit', 0, 1, 1, 1, 130),
  ('queue-priority', 'Queue Priority', 'one_time_perk', 'Add queue priority where your server stack supports it.', 'One-time perk mapped to the perk_queue_priority group.', 'perk_queue_priority', 0, 1, 1, 0, 140),
  ('supporter-badge', 'Supporter Badge', 'one_time_perk', 'Profile and Discord-style supporter badge group.', 'One-time supporter identity perk mapped to the perk_supporter_badge group.', 'perk_supporter_badge', 0, 1, 1, 0, 150)
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
SELECT p.id, 'stripe', CONCAT('configure_', p.slug), 'Configure Stripe Price ID', 0, 'usd', 0,
  CASE WHEN p.product_type = 'vip_subscription' THEN 'month' ELSE 'one_time' END,
  CASE WHEN p.product_type = 'vip_subscription' THEN 'month' ELSE 'one_time' END,
  CASE WHEN p.product_type = 'vip_subscription' THEN 2592000 ELSE 0 END,
  0,
  0, 1
FROM store_products p
WHERE p.slug IN ('vip-bronze', 'vip-gold', 'vip-elite', 'personal-mini', 'skinbox-access', 'raid-kit-unlock', 'queue-priority', 'supporter-badge')
ON DUPLICATE KEY UPDATE
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew);

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
  1,
  0,
  0
FROM store_products p
INNER JOIN (
  SELECT 'day' AS access_interval, 'Daily RP Pass' AS label, 86400 AS duration_seconds
  UNION ALL SELECT 'week', 'Weekly RP Pass', 604800
  UNION ALL SELECT 'month', 'Monthly RP Pass', 2592000
  UNION ALL SELECT 'year', 'Yearly RP Pass', 31536000
) offers
WHERE p.slug IN ('vip-bronze', 'vip-gold', 'vip-elite')
ON DUPLICATE KEY UPDATE
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew);

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT
  p.id,
  'rp',
  CONCAT('rp_', p.slug, '_one_time'),
  'One-time RP Unlock',
  0,
  'rp',
  0,
  'one_time',
  'one_time',
  0,
  0,
  0,
  0
FROM store_products p
WHERE p.slug IN ('personal-mini', 'skinbox-access', 'raid-kit-unlock', 'queue-priority', 'supporter-badge')
ON DUPLICATE KEY UPDATE
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew);

INSERT INTO product_fulfillment_actions
  (product_id, action_type, oxide_group, sort_order)
SELECT p.id, 'grant_group', p.oxide_group, 10
FROM store_products p
WHERE p.oxide_group <> ''
ON DUPLICATE KEY UPDATE
  oxide_group = VALUES(oxide_group);
