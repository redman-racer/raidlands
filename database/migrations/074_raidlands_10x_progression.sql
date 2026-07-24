-- Raidlands 10X progression, catalogue, backpack defaults, and verified kit mappings.
-- Forward-only: preserves product, price, order, entitlement, and membership history.

SET @raidlands_10x_revision := (
  SELECT GREATEST(
    UNIX_TIMESTAMP(),
    COALESCE(MAX(revision), 0) + 1
  )
  FROM oxide_permission_sync_log
  WHERE status <> 'snapshot'
);

-- Preserve feature IDs and votes while replacing the retired 1000X/battlefield identity.
UPDATE feature_items
SET slug = '10x-gather',
    icon_alias = 'GATHER',
    title = '10X Gather and Production',
    summary = '10X player gathering plus 10X excavator, quarry, pumpjack, and survey production.',
    category = 'Progression and Raiding'
WHERE id = 1 OR slug = '1000x-gather';

UPDATE feature_items
SET slug = 'progression-pvp',
    icon_alias = 'PVP',
    title = 'Progression-Focused PvP',
    summary = 'Fast progression, meaningful loot, active counters, and raid pacing with an economy that still matters.',
    category = 'Progression and Raiding'
WHERE id = 2 OR slug = 'battlefield-pvp';

UPDATE feature_items
SET summary = 'Keep bases and gear looking sharp while the progression and raid pace stays moving.'
WHERE id = 6 OR slug = 'skinbox';

UPDATE feature_items
SET summary = 'Archived quality-of-life request retained for history. Quarry and Giant Excavator production now follows the 10X production model.'
WHERE id = 66;

UPDATE feature_items
SET title = '10X Quarry and Giant Excavator Production',
    summary = 'Keep quarry and Giant Excavator output aligned with the 10X production model.',
    category = 'Progression and Raiding'
WHERE id = 74 OR slug = 'giant-excav';

-- The July 24 export contains one confirmed RP redemption that references
-- historical price ID 42, but the inactive price row itself is absent.
-- Restore a non-purchasable record so the history can be foreign-key valid.
INSERT INTO store_prices
  (id, product_id, payment_method, stripe_price_id, stripe_lookup_key, stripe_managed, stripe_sync_mode, stripe_sync_status, stripe_sync_error, label, amount_cents, rp_cost, currency, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default, created_at, updated_at)
SELECT
  42,
  p.id,
  'rp',
  'legacy-rp-price-42',
  '',
  0,
  'disabled',
  'archived',
  '',
  'Historical RP Redemption',
  0,
  500,
  'rp',
  'one_time',
  'one_time',
  0,
  0,
  0,
  0,
  '2026-07-03 04:36:16',
  '2026-07-03 04:36:20'
FROM store_products p
WHERE p.slug = 'perk-chat-title'
  AND NOT EXISTS (SELECT 1 FROM store_prices WHERE id = 42);

-- Rewrite the live catalogue in place. Prices, durations, Stripe IDs, and product IDs are unchanged.
UPDATE store_products
SET short_description = '36-slot backpack, VIP kit, queue priority, teleport and home access, chat style, and approved conveniences.',
    description = 'Includes a 36-slot backpack, the server-synced VIP kit, queue priority, teleport and home access, chat and cosmetic benefits, and approved convenience permissions.'
WHERE slug = 'rank-vip';

UPDATE store_products
SET short_description = '36-slot backpack, VIP+ kit, queue priority, faster homes and teleport, and enhanced reward benefits.',
    description = 'Includes a 36-slot backpack, the server-synced VIP+ kit, queue priority, faster home and teleport access, chat and cosmetic benefits, and enhanced reward permissions.'
WHERE slug = 'rank-vip-plus';

UPDATE store_products
SET short_description = '36-slot backpack, MVP kit, queue priority, movement perks, reward benefits, and approved conveniences.',
    description = 'Includes a 36-slot backpack, the server-synced MVP kit, queue priority, movement perks, chat and cosmetic benefits, and approved convenience permissions.'
WHERE slug = 'rank-mvp';

UPDATE store_products
SET short_description = '42-slot backpack, Golden kit, queue priority, movement perks, and expanded rank conveniences.',
    description = 'Includes a 42-slot backpack, the server-synced Golden kit, queue priority, movement perks, chat and cosmetic benefits, and expanded approved conveniences.'
WHERE slug = 'rank-golden-vip';

UPDATE store_products
SET short_description = '48-slot backpack with access to the current VIP, VIP+, and Golden kit set.',
    description = 'Diamond has no separate active kit. It includes a 48-slot backpack and access to the current server-synced VIP, VIP+, and Golden kit set, plus Diamond rank conveniences.'
WHERE slug = 'rank-diamond-vip';

UPDATE store_products
SET short_description = '48-slot backpack, Ultimate kit, vehicle and sentry access, queue priority, and rank conveniences.',
    description = 'Includes a 48-slot backpack, the server-synced Ultimate kit, approved vehicle and sentry access, queue priority, movement perks, and Ultimate rank conveniences.'
WHERE slug = 'rank-ultimate-vip';

UPDATE store_products
SET short_description = '48-slot backpack, Titan kit, expanded vehicle and sentry access, queue priority, and top-tier conveniences.',
    description = 'Includes a 48-slot backpack, the server-synced Titan kit, expanded approved vehicle and sentry access, queue priority, movement perks, and Titan rank conveniences.'
WHERE slug = 'rank-titan-vip';

UPDATE store_products
SET short_description = 'Join ahead of the standard queue when the server is busy.',
    description = 'Applies the Raidlands queue-priority group to your connected Steam account.'
WHERE slug = 'perk-queue-priority';

UPDATE store_products
SET short_description = 'Use the configured priority teleport timing on your connected account.',
    description = 'Applies the priority teleport permission to your connected Steam account.'
WHERE slug = 'perk-teleport-instant';

UPDATE store_products
SET short_description = 'Reduce the configured home teleport countdown to five seconds.',
    description = 'Applies the five-second home teleport permission to your connected Steam account.'
WHERE slug = 'perk-home-5s';

UPDATE store_products
SET short_description = 'Use custom sign art on supported player-owned signs.',
    description = 'Applies the custom sign-art permission to your connected Steam account.'
WHERE slug = 'perk-sign-art';

UPDATE store_products
SET short_description = 'Display the configured Raidlands custom chat title.',
    description = 'Applies the custom chat-title group to your connected Steam account.'
WHERE slug = 'perk-chat-title';

UPDATE store_products
SET short_description = 'Expand the free six-slot backpack to 36 slots.',
    description = 'Applies a 36-slot backpack capacity to your connected Steam account. Keeping backpack contents on death is already free for everyone.'
WHERE slug = 'perk-backpack-36';

UPDATE store_products
SET short_description = 'Expand the free six-slot backpack to 42 slots.',
    description = 'Applies a 42-slot backpack capacity to your connected Steam account. Keeping backpack contents on death is already free for everyone.'
WHERE slug = 'perk-backpack-42';

UPDATE store_products
SET short_description = 'Expand the free six-slot backpack to 48 slots.',
    description = 'Applies a 48-slot backpack capacity to your connected Steam account. Keeping backpack contents on death is already free for everyone.'
WHERE slug = 'perk-backpack-48';

UPDATE store_products
SET short_description = 'Shop-spawned vehicles receive the configured 1.5X health benefit.',
    description = 'Applies the 1.5X shop-vehicle health permission to your connected Steam account.'
WHERE slug = 'perk-vehicle-hp-150';

UPDATE store_products
SET short_description = 'Use up to 12 tool cupboards under the configured server limit.',
    description = 'Applies the 12-tool-cupboard limit permission to your connected Steam account.'
WHERE slug = 'perk-tc-12';

UPDATE store_products
SET short_description = CASE slug
      WHEN 'perk-spawn-full' THEN 'Inactive spawn-status offer retained for catalogue history.'
      WHEN 'perk-vehicle-hp-125' THEN 'Inactive 1.25X vehicle-health offer retained for catalogue history.'
      WHEN 'perk-minicopter-instant-takeoff' THEN 'Inactive standalone minicopter offer retained for catalogue history.'
      WHEN 'perk-shop-sale-25' THEN 'Inactive 25% shop discount offer retained for catalogue history.'
      WHEN 'perk-shop-sale-50' THEN 'Inactive 50% shop discount offer retained for catalogue history.'
      WHEN 'perk-shop-sale-75' THEN 'Inactive 75% shop discount offer retained for catalogue history.'
      ELSE short_description
    END,
    description = 'This standalone offer is not currently sold.'
WHERE slug IN (
  'perk-spawn-full',
  'perk-vehicle-hp-125',
  'perk-minicopter-instant-takeoff',
  'perk-shop-sale-25',
  'perk-shop-sale-50',
  'perk-shop-sale-75'
);

UPDATE store_products
SET short_description = CONCAT('Inactive ', name, ' retained for catalogue history.'),
    description = 'This standalone kit unlock is not currently sold.'
WHERE slug IN (
  'redeem-kit-vip',
  'redeem-kit-vip-plus',
  'redeem-kit-mvp',
  'redeem-kit-golden-vip',
  'redeem-kit-ultimate-vip',
  'redeem-kit-titan-vip'
);

UPDATE store_products
SET short_description = 'Two defensive sentries per redemption, available once per wipe.',
    description = 'Redeems the server-synced small sentry pack: two auto turrets, once per wipe.'
WHERE slug = 'redeem-pack-sentry-small';

UPDATE store_products
SET short_description = 'Five defensive sentries per redemption, available once per wipe.',
    description = 'Redeems the server-synced large sentry pack: five auto turrets, once per wipe.'
WHERE slug = 'redeem-pack-sentry-large';

UPDATE store_products
SET short_description = 'Two Portafort tokens per redemption, five uses, one-hour cooldown.',
    description = 'Redeems two server-synced Portafort smoke tokens per use, with five uses and a one-hour cooldown.'
WHERE slug = 'redeem-pack-portafort';

UPDATE store_products
SET short_description = 'One of each current vehicle token, available once per wipe.',
    description = 'Redeems one of each server-synced vehicle token: attack helicopter, scrap helicopter, balloon, RHIB, snowmobile, solo and duo submarines, and tugboat.'
WHERE slug = 'redeem-pack-vehicle';

-- Historical products remain addressable by orders and entitlements but cannot be purchased.
UPDATE store_products
SET short_description = 'Legacy offer retained for purchase history; death retention is now free for everyone.',
    description = 'This legacy offer is no longer sold. Every player receives backpack keep-on-death by default.',
    is_active = 0,
    is_featured = 0,
    stripe_sync_status = 'archived',
    stripe_sync_error = ''
WHERE slug = 'perk-backpack-keep-death';

UPDATE store_products
SET short_description = 'Hidden while normal-wipe and force-wipe behavior is verified.',
    description = 'This standalone offer is not sold until its wipe behavior is verified on the live server.',
    is_active = 0,
    is_featured = 0,
    stripe_sync_status = 'archived',
    stripe_sync_error = ''
WHERE slug = 'perk-backpack-keep-wipe';

UPDATE store_prices sp
INNER JOIN store_products p ON p.id = sp.product_id
SET sp.is_active = 0,
    sp.stripe_sync_status = 'archived',
    sp.stripe_sync_error = ''
WHERE p.slug IN ('perk-backpack-keep-death', 'perk-backpack-keep-wipe');

-- Register the exact production permissions and the historical fulfillment groups.
INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
VALUES
  ('backpacks.size.6', 'Backpacks', 'backpacks', 'raidlands-10x', 1, NOW()),
  ('backpacks.keepondeath', 'Backpacks', 'backpacks', 'raidlands-10x', 1, NOW()),
  ('kits.sentry.small', 'Kits', 'kits', 'raidlands-10x', 1, NOW()),
  ('kits.sentry.large', 'Kits', 'kits', 'raidlands-10x', 1, NOW()),
  ('kits.portafort', 'Kits', 'kits', 'raidlands-10x', 1, NOW()),
  ('kits.vehicle', 'Kits', 'kits', 'raidlands-10x', 1, NOW())
ON DUPLICATE KEY UPDATE
  plugin_name = VALUES(plugin_name),
  permission_prefix = VALUES(permission_prefix),
  is_active = 1,
  updated_at = NOW();

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, draft_revision, published_revision, published_at, deleted_at, deleted_revision)
VALUES
  ('store_redeem_pack_sentry_small', 'Small Sentry Pack', 0, '', 'store', 1, 0, 0, 1, 320, 'Grants the live small sentry kit permission after server synchronization.', @raidlands_10x_revision, @raidlands_10x_revision, NOW(), NULL, 0),
  ('store_redeem_pack_sentry_large', 'Large Sentry Pack', 0, '', 'store', 1, 0, 0, 1, 330, 'Grants the live large sentry kit permission after server synchronization.', @raidlands_10x_revision, @raidlands_10x_revision, NOW(), NULL, 0),
  ('store_redeem_pack_portafort', 'Portafort Pack', 0, '', 'store', 1, 0, 0, 1, 340, 'Grants the live Portafort kit permission after server synchronization.', @raidlands_10x_revision, @raidlands_10x_revision, NOW(), NULL, 0),
  ('store_redeem_pack_vehicle', 'Vehicle Pack', 0, '', 'store', 1, 0, 0, 1, 350, 'Grants the live vehicle kit permission after server synchronization.', @raidlands_10x_revision, @raidlands_10x_revision, NOW(), NULL, 0)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = 'store',
  is_managed = 1,
  is_read_only = 0,
  is_active = 1,
  sort_order = VALUES(sort_order),
  notes = VALUES(notes),
  draft_revision = @raidlands_10x_revision,
  published_revision = @raidlands_10x_revision,
  published_at = NOW(),
  deleted_at = NULL,
  deleted_revision = 0,
  updated_at = NOW();

-- Keep default backpack behavior global and remove redundant paid keep-on-death grants.
DELETE ogpg
FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
WHERE op.permission_name = 'backpacks.keepondeath'
  AND og.group_name IN (
    'vip_gold',
    'vip_elite',
    'perk_backpack_keep_death',
    'rank_mvp',
    'rank_golden_vip',
    'rank_diamond_vip',
    'rank_ultimate_vip',
    'rank_titan_vip'
  );

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT og.id, op.id, 'raidlands-10x'
FROM oxide_groups og
INNER JOIN oxide_permissions op
  ON op.permission_name IN ('backpacks.size.6', 'backpacks.keepondeath')
WHERE og.group_name = 'default'
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

-- Replace only the kit permission portion of the four pack groups.
DELETE ogpg
FROM oxide_group_permission_grants ogpg
INNER JOIN oxide_groups og ON og.id = ogpg.group_id
INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
WHERE og.group_name IN (
    'store_redeem_pack_sentry_small',
    'store_redeem_pack_sentry_large',
    'store_redeem_pack_portafort',
    'store_redeem_pack_vehicle'
  )
  AND op.permission_name LIKE 'kits.%';

INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
SELECT og.id, op.id, 'raidlands-10x'
FROM oxide_groups og
INNER JOIN oxide_permissions op
  ON op.permission_name = CASE og.group_name
    WHEN 'store_redeem_pack_sentry_small' THEN 'kits.sentry.small'
    WHEN 'store_redeem_pack_sentry_large' THEN 'kits.sentry.large'
    WHEN 'store_redeem_pack_portafort' THEN 'kits.portafort'
    WHEN 'store_redeem_pack_vehicle' THEN 'kits.vehicle'
    ELSE ''
  END
WHERE og.group_name IN (
  'store_redeem_pack_sentry_small',
  'store_redeem_pack_sentry_large',
  'store_redeem_pack_portafort',
  'store_redeem_pack_vehicle'
)
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

-- Product permission summaries mirror the same verified mappings.
DELETE spg
FROM store_product_permission_grants spg
INNER JOIN store_products p ON p.id = spg.product_id
WHERE spg.permission_name = 'backpacks.keepondeath'
  AND p.slug IN (
    'perk-backpack-keep-death',
    'rank-mvp',
    'rank-golden-vip',
    'rank-diamond-vip',
    'rank-ultimate-vip',
    'rank-titan-vip'
  );

DELETE spg
FROM store_product_permission_grants spg
INNER JOIN store_products p ON p.id = spg.product_id
WHERE p.slug IN (
    'redeem-pack-sentry-small',
    'redeem-pack-sentry-large',
    'redeem-pack-portafort',
    'redeem-pack-vehicle'
  )
  AND spg.permission_name LIKE 'kits.%';

INSERT INTO store_product_permission_grants
  (product_id, permission_name, display_label, sort_order)
SELECT p.id,
       CASE p.slug
         WHEN 'redeem-pack-sentry-small' THEN 'kits.sentry.small'
         WHEN 'redeem-pack-sentry-large' THEN 'kits.sentry.large'
         WHEN 'redeem-pack-portafort' THEN 'kits.portafort'
         WHEN 'redeem-pack-vehicle' THEN 'kits.vehicle'
         ELSE ''
       END,
       CASE p.slug
         WHEN 'redeem-pack-sentry-small' THEN 'Small Sentry Kit'
         WHEN 'redeem-pack-sentry-large' THEN 'Large Sentry Kit'
         WHEN 'redeem-pack-portafort' THEN 'Portafort Kit'
         WHEN 'redeem-pack-vehicle' THEN 'Vehicle Kit'
         ELSE ''
       END,
       10
FROM store_products p
WHERE p.slug IN (
  'redeem-pack-sentry-small',
  'redeem-pack-sentry-large',
  'redeem-pack-portafort',
  'redeem-pack-vehicle'
)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  updated_at = NOW();

UPDATE oxide_groups
SET draft_revision = @raidlands_10x_revision,
    published_revision = @raidlands_10x_revision,
    published_at = NOW(),
    updated_at = NOW()
WHERE group_name IN (
  'default',
  'vip_gold',
  'vip_elite',
  'perk_backpack_keep_death',
  'rank_mvp',
  'rank_golden_vip',
  'rank_diamond_vip',
  'rank_ultimate_vip',
  'rank_titan_vip',
  'store_redeem_pack_sentry_small',
  'store_redeem_pack_sentry_large',
  'store_redeem_pack_portafort',
  'store_redeem_pack_vehicle'
);

INSERT INTO oxide_permission_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (@raidlands_10x_revision, 'pending', NULL, '', 'Published Raidlands 10X backpack defaults and verified store pack permission mappings.');

-- Complete the historical price relationship when restoring an export that
-- previously skipped this constraint because price ID 42 was absent.
SET @raidlands_has_rp_price_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rp_purchase_requests'
    AND CONSTRAINT_NAME = 'fk_rp_purchase_requests_price'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @raidlands_add_rp_price_fk := IF(
  @raidlands_has_rp_price_fk = 0,
  'ALTER TABLE rp_purchase_requests ADD CONSTRAINT fk_rp_purchase_requests_price FOREIGN KEY (store_price_id) REFERENCES store_prices (id)',
  'DO 0'
);
PREPARE raidlands_rp_price_fk_statement FROM @raidlands_add_rp_price_fk;
EXECUTE raidlands_rp_price_fk_statement;
DEALLOCATE PREPARE raidlands_rp_price_fk_statement;
