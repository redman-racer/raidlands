-- Makes product_fulfillment_actions the authoritative product-to-group map.
-- Existing store_products.oxide_group values are kept as the legacy first-group
-- summary and backfilled into grant_group actions when missing.

CREATE TABLE IF NOT EXISTS product_fulfillment_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('grant_group', 'revoke_group', 'note') NOT NULL DEFAULT 'grant_group',
  oxide_group VARCHAR(120) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_fulfillment_action (product_id, action_type, oxide_group),
  KEY idx_product_fulfillment_product (product_id, sort_order),
  CONSTRAINT fk_product_fulfillment_product FOREIGN KEY (product_id) REFERENCES store_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_fulfillment_actions
  (product_id, action_type, oxide_group, sort_order)
SELECT p.id, 'grant_group', p.oxide_group, 10
FROM store_products p
WHERE p.oxide_group <> ''
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order),
  updated_at = NOW();

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes)
SELECT
  pfa.oxide_group,
  pfa.oxide_group,
  0,
  '',
  CASE WHEN LEFT(pfa.oxide_group, 5) = 'perk_' THEN 'perk' ELSE 'store' END,
  1,
  0,
  0,
  1,
  MIN(pfa.sort_order),
  'Store product applied group'
FROM product_fulfillment_actions pfa
WHERE pfa.action_type = 'grant_group'
  AND pfa.oxide_group <> ''
GROUP BY pfa.oxide_group
ON DUPLICATE KEY UPDATE
  category = CASE WHEN category IN ('', 'custom', 'snapshot') THEN VALUES(category) ELSE category END,
  is_managed = CASE WHEN is_read_only = 1 THEN is_managed ELSE 1 END,
  is_active = CASE WHEN is_read_only = 1 THEN is_active ELSE 1 END,
  deleted_at = CASE WHEN is_read_only = 1 THEN deleted_at ELSE NULL END,
  deleted_revision = CASE WHEN is_read_only = 1 THEN deleted_revision ELSE 0 END,
  updated_at = NOW();
