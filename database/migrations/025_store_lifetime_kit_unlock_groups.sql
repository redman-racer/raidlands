-- Gives individual kit shop products real store grant groups and lifetime cash slots.
-- Store products still grant groups; Groups/Kits own the actual Kits permissions.

SET @rollout_revision := UNIX_TIMESTAMP();

CREATE TEMPORARY TABLE tmp_store_lifetime_kit_unlocks (
  product_slug VARCHAR(120) NOT NULL,
  kit_name VARCHAR(160) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL,
  PRIMARY KEY (product_slug)
) ENGINE=Memory;

INSERT INTO tmp_store_lifetime_kit_unlocks
  (product_slug, kit_name, group_name, sort_order)
VALUES
  ('redeem-kit-vip', 'kit_vip', 'store_redeem_kit_vip', 260),
  ('redeem-kit-vip-plus', 'kit_vip_plus', 'store_redeem_kit_vip_plus', 270),
  ('redeem-kit-mvp', 'kit_mvp', 'store_redeem_kit_mvp', 280),
  ('redeem-kit-golden-vip', 'kit_golden_vip', 'store_redeem_kit_golden_vip', 290),
  ('redeem-kit-ultimate-vip', 'kit_ultimate_vip', 'store_redeem_kit_ultimate_vip', 300),
  ('redeem-kit-titan-vip', 'kit_titan_vip', 'store_redeem_kit_titan_vip', 310),
  ('redeem-pack-sentry-small', 'pack_sentry_small', 'store_redeem_pack_sentry_small', 320),
  ('redeem-pack-sentry-large', 'pack_sentry_large', 'store_redeem_pack_sentry_large', 330),
  ('redeem-pack-portafort', 'pack_portafort', 'store_redeem_pack_portafort', 340),
  ('redeem-pack-vehicle', 'pack_vehicle', 'store_redeem_pack_vehicle', 350);

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, draft_revision, published_revision, published_at, deleted_at, deleted_revision)
SELECT
  m.group_name,
  m.group_name,
  0,
  '',
  'store',
  1,
  0,
  0,
  1,
  m.sort_order,
  CONCAT('Store lifetime kit unlock for ', m.kit_name, '.'),
  @rollout_revision,
  @rollout_revision,
  NOW(),
  NULL,
  0
FROM tmp_store_lifetime_kit_unlocks m
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = CASE WHEN is_read_only = 1 THEN category ELSE VALUES(category) END,
  is_managed = CASE WHEN is_read_only = 1 THEN is_managed ELSE 1 END,
  is_active = CASE WHEN is_read_only = 1 THEN is_active ELSE 1 END,
  sort_order = VALUES(sort_order),
  notes = VALUES(notes),
  draft_revision = VALUES(draft_revision),
  published_revision = VALUES(published_revision),
  published_at = NOW(),
  deleted_at = CASE WHEN is_read_only = 1 THEN deleted_at ELSE NULL END,
  deleted_revision = CASE WHEN is_read_only = 1 THEN deleted_revision ELSE 0 END,
  updated_at = NOW();

INSERT INTO oxide_permissions
  (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
SELECT DISTINCT
  gk.required_permission,
  'Kits',
  'kits',
  'store-kit-lifetime',
  1,
  NOW()
FROM tmp_store_lifetime_kit_unlocks m
INNER JOIN game_kits gk ON gk.kit_name = m.kit_name
WHERE gk.required_permission <> ''
ON DUPLICATE KEY UPDATE
  plugin_name = IF(plugin_name = '' OR plugin_name = 'fallback', VALUES(plugin_name), plugin_name),
  permission_prefix = IF(permission_prefix = '', VALUES(permission_prefix), permission_prefix),
  is_active = 1,
  last_seen_at = VALUES(last_seen_at),
  updated_at = NOW();

INSERT INTO oxide_group_permission_grants
  (group_id, permission_id, source)
SELECT
  og.id,
  op.id,
  'store-kit-lifetime'
FROM tmp_store_lifetime_kit_unlocks m
INNER JOIN game_kits gk ON gk.kit_name = m.kit_name
INNER JOIN oxide_groups og ON og.group_name = m.group_name
INNER JOIN oxide_permissions op ON op.permission_name = gk.required_permission
WHERE gk.required_permission <> ''
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  updated_at = NOW();

UPDATE store_products p
INNER JOIN tmp_store_lifetime_kit_unlocks m ON m.product_slug = p.slug
SET p.oxide_group = CASE WHEN p.oxide_group = '' THEN m.group_name ELSE p.oxide_group END,
    p.updated_at = NOW();

INSERT INTO product_fulfillment_actions
  (product_id, action_type, oxide_group, sort_order)
SELECT
  p.id,
  'grant_group',
  m.group_name,
  10
FROM tmp_store_lifetime_kit_unlocks m
INNER JOIN store_products p ON p.slug = m.product_slug
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order),
  updated_at = NOW();

INSERT INTO store_prices
  (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
SELECT
  p.id,
  'stripe',
  CONCAT('configure_', p.slug, '_cash_pass_one_time'),
  'Lifetime Cash Pass',
  0,
  'usd',
  0,
  'one_time',
  'one_time',
  0,
  0,
  0,
  1
FROM tmp_store_lifetime_kit_unlocks m
INNER JOIN store_products p ON p.slug = m.product_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM store_prices existing
  WHERE existing.product_id = p.id
    AND existing.payment_method = 'stripe'
    AND existing.billing_interval = 'one_time'
    AND existing.access_interval = 'one_time'
);

INSERT INTO oxide_permission_sync_log
  (revision, status, payload_json, payload_hash, message)
VALUES
  (@rollout_revision, 'pending', NULL, '', 'Published store lifetime kit unlock groups.');

DROP TEMPORARY TABLE IF EXISTS tmp_store_lifetime_kit_unlocks;
