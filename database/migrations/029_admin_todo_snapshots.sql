CREATE TABLE IF NOT EXISTS admin_todo_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  status ENUM('generated', 'failed') NOT NULL DEFAULT 'generated',
  model VARCHAR(80) NOT NULL DEFAULT '',
  source_hash CHAR(64) NOT NULL DEFAULT '',
  item_count INT NOT NULL DEFAULT 0,
  open_bug_count INT NOT NULL DEFAULT 0,
  pending_suggestion_count INT NOT NULL DEFAULT 0,
  active_feature_count INT NOT NULL DEFAULT 0,
  generated_json JSON NULL,
  error_text TEXT NULL,
  generated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_todo_snapshots_status (status, generated_at),
  KEY idx_admin_todo_snapshots_source_hash (source_hash),
  KEY idx_admin_todo_snapshots_generated_at (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
