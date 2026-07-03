CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_system TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_roles_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_key VARCHAR(120) NOT NULL,
  label VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_permissions_key (permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_admin_role_permissions_role FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES admin_permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  steam_id64 VARCHAR(32) NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_steam_id64 VARCHAR(32) NULL DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_steam_id64 (steam_id64),
  KEY idx_admin_users_active (is_active, steam_id64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, role_id),
  CONSTRAINT fk_admin_user_roles_user FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_roles_role FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_roles (slug, name, description, is_system) VALUES
  ('owner', 'Owner', 'Full access to every admin section and future admin-user management.', 1),
  ('administrator', 'Administrator', 'Can manage site content, store setup, kits, grants, feedback, and bridge status.', 1),
  ('moderator', 'Moderator', 'Can review player feedback and inspect bridge status.', 1),
  ('editor', 'Editor', 'Can update public website identity, links, wipe settings, pages, features, and SEO.', 1),
  ('support', 'Support', 'Can review player feedback and inspect sync status.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  updated_at = NOW();

INSERT INTO admin_permissions (permission_key, label, description) VALUES
  ('admin.access', 'Access admin panel', 'Allows an approved Steam account to enter the admin panel.'),
  ('admin.users.manage', 'Manage admin users', 'Allows managing approved Steam IDs, roles, and permissions.'),
  ('admin.content.manage', 'Manage site content', 'Allows editing identity, links, wipe settings, features, pages, and SEO.'),
  ('admin.feedback.manage', 'Manage feedback', 'Allows reviewing and updating support feedback.'),
  ('admin.store.manage', 'Manage store', 'Allows editing store products and prices.'),
  ('admin.kits.manage', 'Manage kits', 'Allows editing and publishing game kit catalog changes.'),
  ('admin.permissions.manage', 'Manage groups', 'Allows editing and publishing Oxide group permission changes.'),
  ('admin.grants.manage', 'Manage manual grants', 'Allows granting store entitlements manually by SteamID64.'),
  ('admin.sync.view', 'View bridge sync', 'Allows viewing bridge state, stats ingest, clan bridge, and entitlement sync status.')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  updated_at = NOW();

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p
WHERE r.slug = 'owner';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p ON p.permission_key IN (
  'admin.access',
  'admin.content.manage',
  'admin.feedback.manage',
  'admin.store.manage',
  'admin.kits.manage',
  'admin.permissions.manage',
  'admin.grants.manage',
  'admin.sync.view'
)
WHERE r.slug = 'administrator';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p ON p.permission_key IN (
  'admin.access',
  'admin.feedback.manage',
  'admin.sync.view'
)
WHERE r.slug IN ('moderator', 'support');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p ON p.permission_key IN (
  'admin.access',
  'admin.content.manage'
)
WHERE r.slug = 'editor';

-- Bootstrap the first approved Steam account manually, then remove or change the placeholder.
-- INSERT INTO admin_users (steam_id64, display_name, notes)
-- VALUES ('7656119XXXXXXXXXX', 'Initial Owner', 'First Raidlands admin')
-- ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = 1, updated_at = NOW();
--
-- INSERT IGNORE INTO admin_user_roles (admin_user_id, role_id)
-- SELECT u.id, r.id
-- FROM admin_users u
-- INNER JOIN admin_roles r ON r.slug = 'owner'
-- WHERE u.steam_id64 = '7656119XXXXXXXXXX';
