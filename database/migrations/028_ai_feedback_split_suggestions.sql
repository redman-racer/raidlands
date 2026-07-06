-- Adds AI split lineage for bundled feedback/suggestion submissions.
-- Safe to rerun on MySQL/MariaDB: columns, indexes, constraints, and enums are checked before modification.

SET @schema_name := DATABASE();

SET @feature_suggestion_status_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND COLUMN_NAME = 'status'
);

SET @sql := IF(
  @feature_suggestion_status_type IS NOT NULL AND @feature_suggestion_status_type NOT LIKE '%''split''%',
  'ALTER TABLE feature_suggestions MODIFY COLUMN status ENUM(''pending'', ''grouped'', ''rejected'', ''split'') NOT NULL DEFAULT ''pending''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @review_action_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ai_feedback_reviews'
    AND COLUMN_NAME = 'action'
);

SET @sql := IF(
  @review_action_type IS NOT NULL AND @review_action_type NOT LIKE '%''split_submission''%',
  'ALTER TABLE ai_feedback_reviews MODIFY COLUMN action ENUM(''group_existing'', ''create_public_card'', ''close_invalid'', ''needs_review'', ''split_submission'', ''none'') NOT NULL DEFAULT ''none''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent_suggestion_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND COLUMN_NAME = 'parent_suggestion_id'
);

SET @sql := IF(
  @has_parent_suggestion_id = 0,
  'ALTER TABLE feature_suggestions ADD COLUMN parent_suggestion_id BIGINT UNSIGNED NULL AFTER support_feedback_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_split_group_key := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND COLUMN_NAME = 'split_group_key'
);

SET @sql := IF(
  @has_split_group_key = 0,
  'ALTER TABLE feature_suggestions ADD COLUMN split_group_key VARCHAR(80) NULL DEFAULT NULL AFTER parent_suggestion_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_split_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND COLUMN_NAME = 'split_index'
);

SET @sql := IF(
  @has_split_index = 0,
  'ALTER TABLE feature_suggestions ADD COLUMN split_index INT NULL DEFAULT NULL AFTER split_group_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_ai_kind := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND COLUMN_NAME = 'ai_kind'
);

SET @sql := IF(
  @has_ai_kind = 0,
  'ALTER TABLE feature_suggestions ADD COLUMN ai_kind ENUM(''bug'', ''suggestion'', ''feature_request'') NULL DEFAULT NULL AFTER source_type',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND INDEX_NAME = 'idx_feature_suggestions_parent'
);

SET @sql := IF(
  @has_parent_index = 0,
  'ALTER TABLE feature_suggestions ADD KEY idx_feature_suggestions_parent (parent_suggestion_id, split_index)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_split_group_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND INDEX_NAME = 'idx_feature_suggestions_split_group'
);

SET @sql := IF(
  @has_split_group_index = 0,
  'ALTER TABLE feature_suggestions ADD KEY idx_feature_suggestions_split_group (split_group_key, split_index)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_split_unique_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND INDEX_NAME = 'uq_feature_suggestions_split_group'
);

SET @sql := IF(
  @has_split_unique_index = 0,
  'ALTER TABLE feature_suggestions ADD UNIQUE KEY uq_feature_suggestions_split_group (split_group_key, split_index)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_suggestions'
    AND CONSTRAINT_NAME = 'fk_feature_suggestions_parent'
);

SET @sql := IF(
  @has_parent_fk = 0,
  'ALTER TABLE feature_suggestions ADD CONSTRAINT fk_feature_suggestions_parent FOREIGN KEY (parent_suggestion_id) REFERENCES feature_suggestions (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
