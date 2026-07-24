-- Raidlands 10X store repair.
-- Forward-only: reasserts rank backpack capacities without deleting products,
-- prices, orders, entitlements, memberships, or historical permissions.

SET @raidlands_10x_repair_revision := (
  SELECT GREATEST(
    COALESCE((SELECT MAX(GREATEST(draft_revision, published_revision, deleted_revision)) FROM oxide_groups), 0),
    COALESCE((SELECT MAX(revision) FROM oxide_permission_sync_log WHERE status <> 'snapshot'), 0)
  ) + 1
);

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('backpacks.size.6', 'Backpacks', 'backpacks', 'raidlands-10x-repair', 1, NOW()),
  ('backpacks.size.36', 'Backpacks', 'backpacks', 'raidlands-10x-repair', 1, NOW()),
  ('backpacks.size.42', 'Backpacks', 'backpacks', 'raidlands-10x-repair', 1, NOW()),
  ('backpacks.size.48', 'Backpacks', 'backpacks', 'raidlands-10x-repair', 1, NOW()),
  ('backpacks.keepondeath', 'Backpacks', 'backpacks', 'raidlands-10x-repair', 1, NOW())
ON DUPLICATE KEY UPDATE
  plugin_name = VALUES(plugin_name),
  permission_prefix = VALUES(permission_prefix),
  is_active = 1,
  updated_at = NOW();

-- Make every published rank capacity exact. Remove stale or conflicting size
-- grants before adding the one capacity that belongs to each group.
DELETE ogpg
FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
WHERE op.permission_name LIKE 'backpacks.size.%'
  AND og.group_name IN (
    'default',
    'rank_vip',
    'rank_vip_plus',
    'rank_mvp',
    'rank_golden_vip',
    'rank_diamond_vip',
    'rank_ultimate_vip',
    'rank_titan_vip'
  );

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT og.id,
       op.id,
       'raidlands-10x-repair'
FROM oxide_groups og
INNER JOIN oxide_permissions op
  ON op.permission_name = CASE og.group_name
    WHEN 'default' THEN 'backpacks.size.6'
    WHEN 'rank_vip' THEN 'backpacks.size.36'
    WHEN 'rank_vip_plus' THEN 'backpacks.size.36'
    WHEN 'rank_mvp' THEN 'backpacks.size.36'
    WHEN 'rank_golden_vip' THEN 'backpacks.size.42'
    WHEN 'rank_diamond_vip' THEN 'backpacks.size.48'
    WHEN 'rank_ultimate_vip' THEN 'backpacks.size.48'
    WHEN 'rank_titan_vip' THEN 'backpacks.size.48'
    ELSE ''
  END
WHERE og.group_name IN (
  'default',
  'rank_vip',
  'rank_vip_plus',
  'rank_mvp',
  'rank_golden_vip',
  'rank_diamond_vip',
  'rank_ultimate_vip',
  'rank_titan_vip'
)
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

-- Death retention is a default-player benefit, not a paid rank or historical
-- entitlement advantage. Keep those groups and their history, but remove the
-- redundant permission contribution from them.
DELETE ogpg
FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
WHERE op.permission_name = 'backpacks.keepondeath'
  AND og.group_name IN (
    'perk_backpack_keep_death',
    'rank_vip',
    'rank_vip_plus',
    'rank_mvp',
    'rank_golden_vip',
    'rank_diamond_vip',
    'rank_ultimate_vip',
    'rank_titan_vip',
    'vip_gold',
    'vip_elite'
  );

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT og.id,
       op.id,
       'raidlands-10x-repair'
FROM oxide_groups og
INNER JOIN oxide_permissions op ON op.permission_name = 'backpacks.keepondeath'
WHERE og.group_name = 'default'
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

DELETE spg
FROM store_product_permission_grants spg
INNER JOIN store_products p ON p.id = spg.product_id
WHERE spg.permission_name LIKE 'backpacks.size.%'
  AND p.slug IN (
    'rank-vip',
    'rank-vip-plus',
    'rank-mvp',
    'rank-golden-vip',
    'rank-diamond-vip',
    'rank-ultimate-vip',
    'rank-titan-vip'
  );

DELETE spg
FROM store_product_permission_grants spg
INNER JOIN store_products p ON p.id = spg.product_id
WHERE spg.permission_name = 'backpacks.keepondeath'
  AND p.slug IN (
    'perk-backpack-keep-death',
    'rank-vip',
    'rank-vip-plus',
    'rank-mvp',
    'rank-golden-vip',
    'rank-diamond-vip',
    'rank-ultimate-vip',
    'rank-titan-vip'
  );

INSERT INTO store_product_permission_grants
  (product_id, permission_name, display_label, sort_order)
SELECT p.id,
       CASE p.slug
         WHEN 'rank-vip' THEN 'backpacks.size.36'
         WHEN 'rank-vip-plus' THEN 'backpacks.size.36'
         WHEN 'rank-mvp' THEN 'backpacks.size.36'
         WHEN 'rank-golden-vip' THEN 'backpacks.size.42'
         WHEN 'rank-diamond-vip' THEN 'backpacks.size.48'
         WHEN 'rank-ultimate-vip' THEN 'backpacks.size.48'
         WHEN 'rank-titan-vip' THEN 'backpacks.size.48'
         ELSE ''
       END,
       CASE p.slug
         WHEN 'rank-vip' THEN '36 Backpack Slots'
         WHEN 'rank-vip-plus' THEN '36 Backpack Slots'
         WHEN 'rank-mvp' THEN '36 Backpack Slots'
         WHEN 'rank-golden-vip' THEN '42 Backpack Slots'
         WHEN 'rank-diamond-vip' THEN '48 Backpack Slots'
         WHEN 'rank-ultimate-vip' THEN '48 Backpack Slots'
         WHEN 'rank-titan-vip' THEN '48 Backpack Slots'
         ELSE ''
       END,
       5
FROM store_products p
WHERE p.slug IN (
  'rank-vip',
  'rank-vip-plus',
  'rank-mvp',
  'rank-golden-vip',
  'rank-diamond-vip',
  'rank-ultimate-vip',
  'rank-titan-vip'
)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  updated_at = NOW();

UPDATE store_products
SET short_description = CASE slug
      WHEN 'rank-vip' THEN '36 backpack slots, VIP kit, queue priority, teleport and home access, chat style, and approved conveniences.'
      WHEN 'rank-vip-plus' THEN '36 backpack slots, VIP+ kit, queue priority, faster homes and teleport, and enhanced reward benefits.'
      WHEN 'rank-mvp' THEN '36 backpack slots, MVP kit, queue priority, movement perks, reward benefits, and approved conveniences.'
      WHEN 'rank-golden-vip' THEN '42 backpack slots, Golden kit, queue priority, movement perks, and expanded rank conveniences.'
      WHEN 'rank-diamond-vip' THEN '48 backpack slots with access to the current VIP, VIP+, and Golden kit set.'
      WHEN 'rank-ultimate-vip' THEN '48 backpack slots, Ultimate kit, vehicle and sentry access, queue priority, and rank conveniences.'
      WHEN 'rank-titan-vip' THEN '48 backpack slots, Titan kit, expanded vehicle and sentry access, queue priority, and top-tier conveniences.'
      ELSE short_description
    END,
    description = CASE slug
      WHEN 'rank-vip' THEN 'Includes 36 backpack slots, the server-synchronized VIP kit, queue priority, teleport and home access, chat and cosmetic benefits, and approved convenience permissions.'
      WHEN 'rank-vip-plus' THEN 'Includes 36 backpack slots, the server-synchronized VIP+ kit, queue priority, faster home and teleport access, chat and cosmetic benefits, and enhanced reward permissions.'
      WHEN 'rank-mvp' THEN 'Includes 36 backpack slots, the server-synchronized MVP kit, queue priority, movement perks, chat and cosmetic benefits, and approved convenience permissions.'
      WHEN 'rank-golden-vip' THEN 'Includes 42 backpack slots, the server-synchronized Golden kit, queue priority, movement perks, chat and cosmetic benefits, and expanded approved conveniences.'
      WHEN 'rank-diamond-vip' THEN 'Diamond has no separate active kit. It includes 48 backpack slots and access to the current server-synchronized VIP, VIP+, and Golden kit set, plus Diamond rank conveniences.'
      WHEN 'rank-ultimate-vip' THEN 'Includes 48 backpack slots, the server-synchronized Ultimate kit, approved vehicle and sentry access, queue priority, movement perks, and Ultimate rank conveniences.'
      WHEN 'rank-titan-vip' THEN 'Includes 48 backpack slots, the server-synchronized Titan kit, expanded approved vehicle and sentry access, queue priority, movement perks, and Titan rank conveniences.'
      ELSE description
    END,
    updated_at = NOW()
WHERE slug IN (
  'rank-vip',
  'rank-vip-plus',
  'rank-mvp',
  'rank-golden-vip',
  'rank-diamond-vip',
  'rank-ultimate-vip',
  'rank-titan-vip'
);

UPDATE oxide_groups
SET draft_revision = @raidlands_10x_repair_revision,
    published_revision = @raidlands_10x_repair_revision,
    published_at = NOW(),
    updated_at = NOW()
WHERE group_name IN (
  'default',
  'rank_vip',
  'rank_vip_plus',
  'rank_mvp',
  'rank_golden_vip',
  'rank_diamond_vip',
  'rank_ultimate_vip',
  'rank_titan_vip'
);

INSERT INTO oxide_permission_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (@raidlands_10x_repair_revision, 'pending', NULL, '', 'Reasserted Raidlands 10X default and rank backpack capacities.');
