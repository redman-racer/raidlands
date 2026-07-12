-- Repair airstrike animation storage widths for databases that created these
-- tables before the final long-text schema landed.
-- Safe to rerun after 047_airstrike_animation_editor.sql.

ALTER TABLE airstrike_animation_profiles
  MODIFY profile_key VARCHAR(100) NOT NULL,
  MODIFY display_name VARCHAR(160) NOT NULL DEFAULT '',
  MODIFY vehicle VARCHAR(40) NOT NULL,
  MODIFY draft_source_json LONGTEXT NOT NULL,
  MODIFY draft_source_sha256 CHAR(64) NOT NULL;

ALTER TABLE airstrike_animation_bundles
  MODIFY compiler_version VARCHAR(80) NOT NULL,
  MODIFY bundle_json LONGTEXT NOT NULL,
  MODIFY sha256 CHAR(64) NOT NULL,
  MODIFY publish_notes VARCHAR(1000) NOT NULL DEFAULT '';

ALTER TABLE airstrike_animation_profile_revisions
  MODIFY source_json LONGTEXT NOT NULL,
  MODIFY source_sha256 CHAR(64) NOT NULL,
  MODIFY runtime_json LONGTEXT NOT NULL,
  MODIFY runtime_sha256 CHAR(64) NOT NULL,
  MODIFY publish_notes VARCHAR(1000) NOT NULL DEFAULT '';

ALTER TABLE airstrike_animation_server_syncs
  MODIFY server_id VARCHAR(80) NOT NULL,
  MODIFY installed_sha256 CHAR(64) NOT NULL DEFAULT '',
  MODIFY local_sha256 CHAR(64) NOT NULL DEFAULT '',
  MODIFY status VARCHAR(50) NOT NULL DEFAULT 'never_contacted',
  MODIFY message VARCHAR(1000) NOT NULL DEFAULT '',
  MODIFY plugin_version VARCHAR(40) NOT NULL DEFAULT '',
  MODIFY runtime_plugin_version VARCHAR(40) NOT NULL DEFAULT '',
  MODIFY editor_plugin_version VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE airstrike_animation_server_snapshots
  MODIFY server_id VARCHAR(80) NOT NULL,
  MODIFY reason VARCHAR(40) NOT NULL,
  MODIFY snapshot_json LONGTEXT NOT NULL,
  MODIFY sha256 CHAR(64) NOT NULL,
  MODIFY changed_profile_keys_json LONGTEXT NULL DEFAULT NULL,
  MODIFY status VARCHAR(40) NOT NULL DEFAULT 'pending',
  MODIFY conflict_message VARCHAR(1000) NULL DEFAULT NULL;
