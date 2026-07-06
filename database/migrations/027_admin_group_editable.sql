-- Allows the website Groups editor to manage permission grants on the built-in
-- Oxide admin group while keeping the group protected from deletion.

INSERT INTO oxide_groups
  (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, deleted_at, deleted_revision)
VALUES
  ('admin', 'admin', 1, '', 'system', 1, 1, 0, 1, 900, 'Protected built-in group; website manages permission grants for server admins.', NULL, 0)
ON DUPLICATE KEY UPDATE
  title = CASE WHEN title = '' OR title = group_name THEN VALUES(title) ELSE title END,
  group_rank = VALUES(group_rank),
  parent_group = VALUES(parent_group),
  category = CASE WHEN category IN ('', 'custom', 'snapshot') THEN VALUES(category) ELSE category END,
  is_managed = 1,
  is_protected = 1,
  is_read_only = 0,
  is_active = 1,
  sort_order = CASE WHEN sort_order = 0 OR sort_order >= 900 THEN VALUES(sort_order) ELSE sort_order END,
  notes = CASE WHEN notes IS NULL OR notes = '' THEN VALUES(notes) ELSE notes END,
  deleted_at = NULL,
  deleted_revision = 0,
  updated_at = NOW();
