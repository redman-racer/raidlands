-- Portable Airstrikes website authoring, immutable publication, and server-sync state.
-- Apply after 007_admin_auth.sql. This migration is additive and safe to rerun.

INSERT INTO admin_permissions (permission_key, label, description) VALUES
  (
    'admin.airstrike_animations.manage',
    'Manage airstrike animations',
    'Allows creating, editing, publishing, restoring, and synchronizing Portable Airstrikes animation profiles.'
  )
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  updated_at = NOW();

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
INNER JOIN admin_permissions p
  ON p.permission_key = 'admin.airstrike_animations.manage'
WHERE r.slug IN ('owner', 'administrator');

CREATE TABLE IF NOT EXISTS airstrike_animation_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_key VARCHAR(100) NOT NULL,
  display_name VARCHAR(160) NOT NULL DEFAULT '',
  vehicle VARCHAR(40) NOT NULL,
  draft_source_json LONGTEXT NOT NULL,
  draft_source_sha256 CHAR(64) NOT NULL,
  draft_version INT UNSIGNED NOT NULL DEFAULT 1,
  last_published_profile_revision INT UNSIGNED NULL DEFAULT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL DEFAULT NULL,
  updated_by BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_airstrike_animation_profile_key (profile_key),
  KEY idx_airstrike_animation_profiles_active (archived_at, profile_key),
  KEY idx_airstrike_animation_profiles_updated (updated_at),
  CONSTRAINT fk_airstrike_animation_profiles_created_by
    FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL,
  CONSTRAINT fk_airstrike_animation_profiles_updated_by
    FOREIGN KEY (updated_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_animation_bundles (
  revision BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schema_version INT UNSIGNED NOT NULL DEFAULT 2,
  compiler_version VARCHAR(80) NOT NULL,
  bundle_json LONGTEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  profile_count INT UNSIGNED NOT NULL DEFAULT 0,
  publish_notes VARCHAR(1000) NOT NULL DEFAULT '',
  published_by BIGINT UNSIGNED NULL DEFAULT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (revision),
  KEY idx_airstrike_animation_bundle_sha (sha256),
  KEY idx_airstrike_animation_bundles_published (published_at),
  CONSTRAINT fk_airstrike_animation_bundles_published_by
    FOREIGN KEY (published_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_animation_profile_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  profile_revision INT UNSIGNED NOT NULL,
  bundle_revision BIGINT UNSIGNED NOT NULL,
  source_json LONGTEXT NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  runtime_json LONGTEXT NOT NULL,
  runtime_sha256 CHAR(64) NOT NULL,
  publish_notes VARCHAR(1000) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_airstrike_animation_profile_revision (profile_id, profile_revision),
  KEY idx_airstrike_animation_profile_bundle (bundle_revision, profile_id),
  CONSTRAINT fk_airstrike_animation_revisions_profile
    FOREIGN KEY (profile_id) REFERENCES airstrike_animation_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_airstrike_animation_revisions_bundle
    FOREIGN KEY (bundle_revision) REFERENCES airstrike_animation_bundles (revision) ON DELETE RESTRICT,
  CONSTRAINT fk_airstrike_animation_revisions_created_by
    FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_animation_server_syncs (
  server_id VARCHAR(80) NOT NULL,
  installed_revision BIGINT UNSIGNED NULL DEFAULT NULL,
  installed_sha256 CHAR(64) NOT NULL DEFAULT '',
  local_sha256 CHAR(64) NOT NULL DEFAULT '',
  local_dirty TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'never_contacted',
  message VARCHAR(1000) NOT NULL DEFAULT '',
  plugin_version VARCHAR(40) NOT NULL DEFAULT '',
  runtime_plugin_version VARCHAR(40) NOT NULL DEFAULT '',
  editor_plugin_version VARCHAR(40) NOT NULL DEFAULT '',
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  installed_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id),
  KEY idx_airstrike_animation_sync_status (status, updated_at),
  KEY idx_airstrike_animation_sync_revision (installed_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_animation_server_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  server_id VARCHAR(80) NOT NULL,
  based_on_revision BIGINT UNSIGNED NULL DEFAULT NULL,
  reason VARCHAR(40) NOT NULL,
  snapshot_json LONGTEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  changed_profile_keys_json LONGTEXT NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  conflict_message VARCHAR(1000) NULL DEFAULT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imported_at TIMESTAMP NULL DEFAULT NULL,
  imported_by BIGINT UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_airstrike_animation_snapshot_server_sha (server_id, sha256),
  KEY idx_airstrike_animation_snapshots_queue (server_id, status, received_at),
  KEY idx_airstrike_animation_snapshots_revision (based_on_revision),
  CONSTRAINT fk_airstrike_animation_snapshots_imported_by
    FOREIGN KEY (imported_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
