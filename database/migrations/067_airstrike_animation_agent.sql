-- Profile-scoped AI agent threads, events, and preview-only proposals.
-- Apply after 047_airstrike_animation_editor.sql. Additive and safe to rerun.

CREATE TABLE IF NOT EXISTS airstrike_agent_threads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  profile_id BIGINT UNSIGNED NULL DEFAULT NULL,
  client_profile_key VARCHAR(100) NOT NULL DEFAULT '',
  title VARCHAR(160) NOT NULL DEFAULT 'New conversation',
  active_mode ENUM('plan', 'regular') NOT NULL DEFAULT 'plan',
  pinned_plan MEDIUMTEXT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_airstrike_agent_threads_owner_profile (admin_user_id, profile_id, archived_at, updated_at),
  KEY idx_airstrike_agent_threads_client_profile (admin_user_id, client_profile_key, archived_at),
  CONSTRAINT fk_airstrike_agent_threads_admin
    FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE CASCADE,
  CONSTRAINT fk_airstrike_agent_threads_profile
    FOREIGN KEY (profile_id) REFERENCES airstrike_animation_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_agent_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  item_type ENUM('message', 'tool_call', 'tool_result', 'mode_change', 'error') NOT NULL DEFAULT 'message',
  role ENUM('user', 'assistant', 'tool', 'system') NOT NULL DEFAULT 'assistant',
  content MEDIUMTEXT NOT NULL,
  payload_json LONGTEXT NULL,
  openai_items_json LONGTEXT NULL,
  model VARCHAR(100) NOT NULL DEFAULT '',
  response_id VARCHAR(160) NOT NULL DEFAULT '',
  usage_json TEXT NULL,
  latency_ms INT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_airstrike_agent_item_sequence (thread_id, sequence_number),
  KEY idx_airstrike_agent_items_thread_created (thread_id, created_at),
  CONSTRAINT fk_airstrike_agent_items_thread
    FOREIGN KEY (thread_id) REFERENCES airstrike_agent_threads (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airstrike_agent_proposals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id BIGINT UNSIGNED NOT NULL,
  assistant_item_id BIGINT UNSIGNED NULL DEFAULT NULL,
  base_source_sha256 CHAR(64) NOT NULL,
  candidate_source_sha256 CHAR(64) NOT NULL,
  candidate_source_json LONGTEXT NOT NULL,
  diff_json LONGTEXT NOT NULL,
  validation_json LONGTEXT NOT NULL,
  compile_summary_json TEXT NULL,
  status ENUM('proposed', 'applied', 'discarded', 'undone', 'saved') NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_airstrike_agent_proposals_thread_status (thread_id, status, created_at),
  CONSTRAINT fk_airstrike_agent_proposals_thread
    FOREIGN KEY (thread_id) REFERENCES airstrike_agent_threads (id) ON DELETE CASCADE,
  CONSTRAINT fk_airstrike_agent_proposals_item
    FOREIGN KEY (assistant_item_id) REFERENCES airstrike_agent_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
