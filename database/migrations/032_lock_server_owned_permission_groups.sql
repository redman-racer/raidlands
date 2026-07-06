SET @permission_revision := (
  SELECT COALESCE(MAX(revision), 0) + 1
  FROM oxide_permission_sync_log
  WHERE status <> 'snapshot'
);

-- Keep server-owned Oxide groups visible as snapshots, but never publish them
-- as website-managed permission targets.

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, deleted_at, deleted_revision, draft_revision, published_revision)
VALUES
  ('admin', 'admin', 1, '', 'system', 0, 1, 1, 1, 900, 'Server-owned admin group; visible from snapshots only.', NULL, 0, @permission_revision, @permission_revision),
  ('authenticated', 'authenticated', 0, '', 'system', 0, 1, 1, 1, 910, 'Server-owned authenticated group; visible from snapshots only.', NULL, 0, @permission_revision, @permission_revision)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  group_rank = VALUES(group_rank),
  parent_group = VALUES(parent_group),
  category = VALUES(category),
  is_managed = 0,
  is_protected = 1,
  is_read_only = 1,
  is_active = 1,
  sort_order = VALUES(sort_order),
  notes = VALUES(notes),
  deleted_at = NULL,
  deleted_revision = 0,
  draft_revision = @permission_revision,
  published_revision = @permission_revision,
  published_at = NOW(),
  updated_at = NOW();

DELETE ogpg
FROM oxide_group_permission_grants AS ogpg
INNER JOIN oxide_groups AS og ON og.id = ogpg.group_id
WHERE og.group_name IN ('admin', 'authenticated');

UPDATE oxide_groups
SET published_revision = @permission_revision,
    published_at = NOW(),
    updated_at = NOW()
WHERE is_managed = 1
  AND is_active = 1
  AND is_read_only = 0
  AND deleted_at IS NULL;

INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
VALUES (
  @permission_revision,
  'pending',
  NULL,
  '',
  'Republished permissions after locking server-owned admin groups to snapshot-only.'
);
