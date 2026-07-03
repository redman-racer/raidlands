-- Adds a dedicated public feature status for vote candidates.
-- Safe to rerun on MySQL/MariaDB: the enum is checked before modification.

SET @schema_name := DATABASE();

SET @feature_status_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'feature_items'
    AND COLUMN_NAME = 'public_status'
);

SET @sql := IF(
  @feature_status_type IS NOT NULL AND @feature_status_type NOT LIKE '%''voting''%',
  'ALTER TABLE feature_items MODIFY COLUMN public_status ENUM(''active'', ''voting'', ''planned'', ''in_development'', ''under_review'', ''archived'') NOT NULL DEFAULT ''under_review''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE feature_items
SET public_status = 'voting',
    updated_at = NOW()
WHERE is_voteable = 1
  AND public_status IN ('planned', 'under_review');
