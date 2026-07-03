INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes)
VALUES
  ('perk_pvp_light', 'perk_pvp_light', 0, '', 'perk', 1, 0, 0, 1, 250, 'Standalone Light PvP kit unlock.'),
  ('perk_pvp_rifle', 'perk_pvp_rifle', 0, '', 'perk', 1, 0, 0, 1, 260, 'Standalone Rifle PvP kit unlock.'),
  ('perk_pvp_roamer', 'perk_pvp_roamer', 0, '', 'perk', 1, 0, 0, 1, 270, 'Standalone Roamer PvP kit unlock.'),
  ('perk_pvp_heavy', 'perk_pvp_heavy', 0, '', 'perk', 1, 0, 0, 1, 280, 'Standalone Heavy PvP kit unlock.'),
  ('perk_pvp_elite', 'perk_pvp_elite', 0, '', 'perk', 1, 0, 0, 1, 290, 'Standalone Elite PvP kit unlock.'),
  ('perk_pvp_breach', 'perk_pvp_breach', 0, '', 'perk', 1, 0, 0, 1, 300, 'Standalone Breach PvP kit unlock.')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  is_managed = VALUES(is_managed),
  is_protected = VALUES(is_protected),
  is_read_only = VALUES(is_read_only),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order),
  updated_at = NOW();

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('kits.pvp.light', 'Kits', 'kits', 'seed', 1, NOW()),
  ('kits.pvp.rifle', 'Kits', 'kits', 'seed', 1, NOW()),
  ('kits.pvp.roamer', 'Kits', 'kits', 'seed', 1, NOW()),
  ('kits.pvp.heavy', 'Kits', 'kits', 'seed', 1, NOW()),
  ('kits.pvp.elite', 'Kits', 'kits', 'seed', 1, NOW()),
  ('kits.pvp.breach', 'Kits', 'kits', 'seed', 1, NOW())
ON DUPLICATE KEY UPDATE
  plugin_name = IF(plugin_name = '', VALUES(plugin_name), plugin_name),
  permission_prefix = IF(permission_prefix = '', VALUES(permission_prefix), permission_prefix),
  is_active = 1,
  last_seen_at = VALUES(last_seen_at),
  updated_at = NOW();

UPDATE game_kits
SET required_permission = CASE kit_name
  WHEN 'raidlands_pvp_light' THEN 'kits.pvp.light'
  WHEN 'raidlands_pvp_rifle' THEN 'kits.pvp.rifle'
  WHEN 'raidlands_pvp_roamer' THEN 'kits.pvp.roamer'
  WHEN 'raidlands_pvp_heavy' THEN 'kits.pvp.heavy'
  WHEN 'raidlands_pvp_elite' THEN 'kits.pvp.elite'
  WHEN 'raidlands_pvp_breach' THEN 'kits.pvp.breach'
  ELSE required_permission
END,
updated_at = NOW()
WHERE kit_name IN (
  'raidlands_pvp_light',
  'raidlands_pvp_rifle',
  'raidlands_pvp_roamer',
  'raidlands_pvp_heavy',
  'raidlands_pvp_elite',
  'raidlands_pvp_breach'
);

DELETE gga
FROM game_kit_group_access gga
INNER JOIN game_kits gk ON gk.id = gga.kit_id
WHERE gk.kit_name IN (
  'raidlands_pvp_light',
  'raidlands_pvp_rifle',
  'raidlands_pvp_roamer',
  'raidlands_pvp_heavy',
  'raidlands_pvp_elite',
  'raidlands_pvp_breach'
)
AND gga.oxide_group IN (
  'default',
  'vip_bronze',
  'vip_gold',
  'vip_elite',
  'perk_raid_kit',
  'perk_pvp_light',
  'perk_pvp_rifle',
  'perk_pvp_roamer',
  'perk_pvp_heavy',
  'perk_pvp_elite',
  'perk_pvp_breach'
);

DELETE ogpg
FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
WHERE og.group_name IN (
  'default',
  'vip_bronze',
  'vip_gold',
  'vip_elite',
  'perk_raid_kit',
  'perk_pvp_light',
  'perk_pvp_rifle',
  'perk_pvp_roamer',
  'perk_pvp_heavy',
  'perk_pvp_elite',
  'perk_pvp_breach'
)
AND op.permission_name IN ('kits.paidpvpkit', 'serverrewards.paidpvpkit');

DELETE ogpl
FROM oxide_group_permission_live ogpl
INNER JOIN oxide_groups og ON og.id = ogpl.group_id
INNER JOIN oxide_permissions op ON op.id = ogpl.permission_id
WHERE og.group_name IN (
  'default',
  'vip_bronze',
  'vip_gold',
  'vip_elite',
  'perk_raid_kit',
  'perk_pvp_light',
  'perk_pvp_rifle',
  'perk_pvp_roamer',
  'perk_pvp_heavy',
  'perk_pvp_elite',
  'perk_pvp_breach'
)
AND op.permission_name IN ('kits.paidpvpkit', 'serverrewards.paidpvpkit');

INSERT INTO game_kit_group_access
  (kit_id, oxide_group, is_granted)
SELECT gk.id, access_map.oxide_group, 1
FROM game_kits gk
INNER JOIN (
  SELECT 'raidlands_pvp_light' AS kit_name, 'perk_pvp_light' AS oxide_group
  UNION ALL SELECT 'raidlands_pvp_rifle', 'perk_pvp_rifle'
  UNION ALL SELECT 'raidlands_pvp_roamer', 'perk_pvp_roamer'
  UNION ALL SELECT 'raidlands_pvp_heavy', 'perk_pvp_heavy'
  UNION ALL SELECT 'raidlands_pvp_elite', 'perk_pvp_elite'
  UNION ALL SELECT 'raidlands_pvp_breach', 'perk_pvp_breach'
  UNION ALL SELECT 'raidlands_pvp_light', 'vip_bronze'
  UNION ALL SELECT 'raidlands_pvp_rifle', 'vip_bronze'
  UNION ALL SELECT 'raidlands_pvp_roamer', 'vip_gold'
  UNION ALL SELECT 'raidlands_pvp_heavy', 'vip_gold'
  UNION ALL SELECT 'raidlands_pvp_elite', 'vip_elite'
  UNION ALL SELECT 'raidlands_pvp_breach', 'vip_elite'
) access_map ON access_map.kit_name = gk.kit_name
ON DUPLICATE KEY UPDATE
  is_granted = VALUES(is_granted),
  updated_at = NOW();

INSERT INTO store_products
  (slug, name, product_type, short_description, description, oxide_group, tier_priority, is_stackable, is_active, is_featured, sort_order)
VALUES
  ('pvp-kit-light', 'Light PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Light PvP kit.', 'Inactive RP product stub for the Light PvP kit. Set the final RP cost before launch.', 'perk_pvp_light', 0, 1, 0, 0, 200),
  ('pvp-kit-rifle', 'Rifle PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Rifle PvP kit.', 'Inactive RP product stub for the Rifle PvP kit. Set the final RP cost before launch.', 'perk_pvp_rifle', 0, 1, 0, 0, 210),
  ('pvp-kit-roamer', 'Roamer PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Roamer PvP kit.', 'Inactive RP product stub for the Roamer PvP kit. Set the final RP cost before launch.', 'perk_pvp_roamer', 0, 1, 0, 0, 220),
  ('pvp-kit-heavy', 'Heavy PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Heavy PvP kit.', 'Inactive RP product stub for the Heavy PvP kit. Set the final RP cost before launch.', 'perk_pvp_heavy', 0, 1, 0, 0, 230),
  ('pvp-kit-elite', 'Elite PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Elite PvP kit.', 'Inactive RP product stub for the Elite PvP kit. Set the final RP cost before launch.', 'perk_pvp_elite', 0, 1, 0, 0, 240),
  ('pvp-kit-breach', 'Breach PvP Kit Unlock', 'one_time_kit_unlock', 'Standalone unlock for the Breach PvP kit.', 'Inactive RP product stub for the Breach PvP kit. Set the final RP cost before launch.', 'perk_pvp_breach', 0, 1, 0, 0, 250)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  product_type = VALUES(product_type),
  short_description = VALUES(short_description),
  description = VALUES(description),
  oxide_group = VALUES(oxide_group),
  tier_priority = VALUES(tier_priority),
  is_stackable = VALUES(is_stackable),
  sort_order = VALUES(sort_order),
  updated_at = NOW();

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
WHERE p.slug IN ('pvp-kit-light', 'pvp-kit-rifle', 'pvp-kit-roamer', 'pvp-kit-heavy', 'pvp-kit-elite', 'pvp-kit-breach')
ON DUPLICATE KEY UPDATE
  payment_method = VALUES(payment_method),
  label = VALUES(label),
  billing_interval = VALUES(billing_interval),
  access_interval = VALUES(access_interval),
  access_duration_seconds = VALUES(access_duration_seconds),
  allow_auto_renew = VALUES(allow_auto_renew),
  updated_at = NOW();

INSERT INTO store_product_kits
  (product_id, kit_id, sort_order)
SELECT p.id, gk.id, link_map.sort_order
FROM store_products p
INNER JOIN (
  SELECT 'pvp-kit-light' AS product_slug, 'raidlands_pvp_light' AS kit_name, 10 AS sort_order
  UNION ALL SELECT 'pvp-kit-rifle', 'raidlands_pvp_rifle', 10
  UNION ALL SELECT 'pvp-kit-roamer', 'raidlands_pvp_roamer', 10
  UNION ALL SELECT 'pvp-kit-heavy', 'raidlands_pvp_heavy', 10
  UNION ALL SELECT 'pvp-kit-elite', 'raidlands_pvp_elite', 10
  UNION ALL SELECT 'pvp-kit-breach', 'raidlands_pvp_breach', 10
  UNION ALL SELECT 'vip-bronze', 'raidlands_pvp_light', 10
  UNION ALL SELECT 'vip-bronze', 'raidlands_pvp_rifle', 20
  UNION ALL SELECT 'vip-gold', 'raidlands_pvp_light', 10
  UNION ALL SELECT 'vip-gold', 'raidlands_pvp_rifle', 20
  UNION ALL SELECT 'vip-gold', 'raidlands_pvp_roamer', 30
  UNION ALL SELECT 'vip-gold', 'raidlands_pvp_heavy', 40
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_light', 10
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_rifle', 20
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_roamer', 30
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_heavy', 40
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_elite', 50
  UNION ALL SELECT 'vip-elite', 'raidlands_pvp_breach', 60
) link_map ON link_map.product_slug = p.slug
INNER JOIN game_kits gk ON gk.kit_name = link_map.kit_name
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order),
  updated_at = NOW();
