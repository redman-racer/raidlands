<?php

require_once __DIR__ . '/kits.php';

function raidlands_permissions_table_exists(string $table): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        $statement = raidlands_db_required()->prepare(
            'SELECT COUNT(*)
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = :table_name'
        );
        $statement->execute(['table_name' => $table]);

        return (int) $statement->fetchColumn() > 0;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_permissions_column_exists(string $table, string $column): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        $statement = raidlands_db_required()->prepare(
            'SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = :table_name
               AND column_name = :column_name'
        );
        $statement->execute([
            'table_name' => $table,
            'column_name' => $column,
        ]);

        return (int) $statement->fetchColumn() > 0;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_permissions_is_ready(): bool
{
    return raidlands_permissions_table_exists('oxide_groups')
        && raidlands_permissions_table_exists('oxide_permissions')
        && raidlands_permissions_table_exists('oxide_group_permission_grants')
        && raidlands_permissions_table_exists('oxide_group_permission_live')
        && raidlands_permissions_table_exists('oxide_permission_sync_log')
        && raidlands_permissions_column_exists('oxide_groups', 'deleted_at')
        && raidlands_permissions_column_exists('oxide_groups', 'deleted_revision');
}

function raidlands_permissions_readiness_message(bool $admin = false): string
{
    if (!raidlands_db_is_configured()) {
        return $admin
            ? 'Database credentials are not configured yet.'
            : 'Group details are being prepared.';
    }

    if (!raidlands_permissions_is_ready()) {
        return $admin
            ? 'Permission tables are not installed yet. Run database/migrations/008_oxide_permissions.sql, then database/migrations/014_kit_group_delete_tombstones.sql.'
            : 'Group details are being prepared.';
    }

    return '';
}

function raidlands_permissions_clean_text($value, int $max_length = 160): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_permissions_clean_multiline($value, int $max_length = 3000): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_permissions_clean_group($value): string
{
    $group = strtolower(raidlands_permissions_clean_text($value, 160));

    if ($group === '' || !preg_match('/^[a-z0-9_.-]+$/', $group)) {
        return '';
    }

    return $group;
}

function raidlands_permissions_clean_permission($value): string
{
    $permission = strtolower(raidlands_permissions_clean_text($value, 190));

    if ($permission === '') {
        return '';
    }

    if (!preg_match('/^[a-z0-9_.-]+$/', $permission) || !str_contains($permission, '.')) {
        throw new InvalidArgumentException('Permissions must use lowercase plugin.permission format.');
    }

    return $permission;
}

function raidlands_permissions_permission_prefix(string $permission): string
{
    $parts = explode('.', $permission, 2);

    return $parts[0] ?? '';
}

function raidlands_permissions_read_only_groups(): array
{
    return ['admin', 'authenticated'];
}

function raidlands_permissions_group_is_read_only(string $group_name): bool
{
    return in_array(raidlands_permissions_clean_group($group_name), raidlands_permissions_read_only_groups(), true);
}

function raidlands_permissions_protected_groups(): array
{
    return ['default', 'discord', 'admin', 'authenticated'];
}

function raidlands_permissions_group_has_forced_protection(string $group_name): bool
{
    return in_array(raidlands_permissions_clean_group($group_name), raidlands_permissions_protected_groups(), true);
}

function raidlands_permissions_default_group_names(): array
{
    return [
        'default',
        'discord',
        'vip_bronze',
        'vip_gold',
        'vip_elite',
        'perk_personal_mini',
        'perk_skinbox',
        'perk_raid_kit',
        'perk_queue_priority',
        'perk_supporter_badge',
    ];
}

function raidlands_permissions_fallback_permissions(): array
{
    return [
        'autodoors.use',
        'automaticauthorization.use',
        'backpacks.use',
        'backpacks.gui',
        'backpacks.size.6',
        'backpacks.size.12',
        'backpacks.size.24',
        'backpacks.size.48',
        'backpacks.fetch',
        'backpacks.gather',
        'backpacks.retrieve',
        'backpacks.keepondeath',
        'backpacks.nofoodspoiling',
        'bgrade.all',
        'blueprintmanager.all',
        'buildingskins.use',
        'buildingskins.build',
        'buildingskins.tc',
        'buildingskins.all',
        'disablewet.use',
        'discordauth.auth',
        'instantbuy.use',
        'instantcraft.use',
        'instantgather.use',
        'instantsmelt.use',
        'quicksmelt.use',
        'randomrespawner.use',
        'recyclerspeed.use',
        'removertool.normal',
        'skins.use',
        'sortbutton.use',
        'spawnheli.minicopter.spawn',
        'spawnheli.minicopter.fetch',
        'spawnheli.minicopter.despawn',
        'powerlessturrets.use',
        'powerlessturrets.radius',
        'powerlessturrets.samradius',
        'nteleportation.home',
        'nteleportation.tpr',
        'nteleportation.tpb',
        'nteleportation.tptown',
        'nteleportation.tpoutpost',
        'nteleportation.tpbandit',
        'nteleportation.globalcooldownvip',
        'kits.discord',
        'kits.build',
        'kits.cards',
        'kits.comp',
        'kits.medical',
        'kits.raid',
        'kits.scuba',
        'kits.pvp.light',
        'kits.pvp.rifle',
        'kits.pvp.roamer',
        'kits.pvp.heavy',
        'kits.pvp.elite',
        'kits.pvp.breach',
        'kits.paidpvpkit',
        'serverrewards.paidpvpkit',
    ];
}

function raidlands_permissions_next_revision(PDO $pdo): int
{
    $revision = (int) $pdo->query(
        'SELECT COALESCE(MAX(GREATEST(draft_revision, published_revision, deleted_revision)), 0) + 1 FROM oxide_groups'
    )->fetchColumn();
    $log_revision = (int) $pdo->query(
        "SELECT COALESCE(MAX(revision), 0) + 1 FROM oxide_permission_sync_log WHERE status <> 'snapshot'"
    )->fetchColumn();

    return max(1, $revision, $log_revision);
}

function raidlands_permissions_group_id(PDO $pdo, string $group_name): int
{
    $group_name = raidlands_permissions_clean_group($group_name);

    if ($group_name === '') {
        return 0;
    }

    $row = raidlands_db_fetch_one(
        'SELECT id FROM oxide_groups WHERE group_name = :group_name',
        ['group_name' => $group_name]
    );

    return $row === null ? 0 : (int) $row['id'];
}

function raidlands_permissions_permission_id(PDO $pdo, string $permission_name, string $source = 'admin', string $plugin_name = ''): int
{
    $permission_name = raidlands_permissions_clean_permission($permission_name);
    $prefix = raidlands_permissions_permission_prefix($permission_name);
    $plugin_name = raidlands_permissions_clean_text($plugin_name, 120);
    $source = raidlands_permissions_clean_text($source, 40) ?: 'admin';
    $statement = $pdo->prepare(
        'INSERT INTO oxide_permissions
            (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
         VALUES
            (:permission_name, :plugin_name, :permission_prefix, :source, 1, NOW())
         ON DUPLICATE KEY UPDATE
            plugin_name = IF(VALUES(plugin_name) <> "", VALUES(plugin_name), plugin_name),
            permission_prefix = IF(permission_prefix = "", VALUES(permission_prefix), permission_prefix),
            is_active = 1,
            last_seen_at = CASE WHEN VALUES(source) IN ("snapshot", "seed") THEN NOW() ELSE last_seen_at END,
            updated_at = NOW()'
    );
    $statement->execute([
        'permission_name' => $permission_name,
        'plugin_name' => $plugin_name,
        'permission_prefix' => $prefix,
        'source' => $source,
    ]);
    $row = raidlands_db_fetch_one(
        'SELECT id FROM oxide_permissions WHERE permission_name = :permission_name',
        ['permission_name' => $permission_name]
    );

    return $row === null ? 0 : (int) $row['id'];
}

function raidlands_permissions_upsert_group(PDO $pdo, array $row, bool $from_snapshot = false): int
{
    $group_name = raidlands_permissions_clean_group($row['group_name'] ?? $row['name'] ?? '');

    if ($group_name === '') {
        return 0;
    }

    $read_only = raidlands_permissions_group_is_read_only($group_name);
    $protected = raidlands_permissions_group_has_forced_protection($group_name);
    $title = raidlands_permissions_clean_text($row['title'] ?? $group_name, 160);
    $category = raidlands_permissions_clean_text($row['category'] ?? ($from_snapshot ? 'snapshot' : 'custom'), 80);
    $parent = raidlands_permissions_clean_group($row['parent_group'] ?? $row['parent'] ?? '');
    $params = [
        'group_name' => $group_name,
        'title' => $title !== '' ? $title : $group_name,
        'rank' => max(0, min(9999, (int) ($row['rank'] ?? 0))),
        'parent_group' => $parent,
        'category' => $category !== '' ? $category : 'custom',
        'is_managed' => $read_only ? 0 : (empty($row['is_managed']) ? 0 : 1),
        'is_protected' => $protected || !empty($row['is_protected']) ? 1 : 0,
        'is_read_only' => $read_only ? 1 : 0,
        'is_active' => empty($row['is_active']) ? 0 : 1,
        'sort_order' => max(0, min(9999, (int) ($row['sort_order'] ?? 100))),
        'notes' => raidlands_permissions_clean_multiline($row['notes'] ?? '', 3000) ?: null,
    ];

    $statement = $pdo->prepare(
        'INSERT INTO oxide_groups
            (group_name, title, group_rank, parent_group, category, is_managed, is_protected, is_read_only, is_active, sort_order, notes, last_seen_at)
         VALUES
            (:group_name, :title, :rank, :parent_group, :category, :is_managed, :is_protected, :is_read_only, :is_active, :sort_order, :notes, NOW())
         ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            group_rank = VALUES(group_rank),
            parent_group = VALUES(parent_group),
            category = IF(category = "snapshot" OR VALUES(category) <> "snapshot", VALUES(category), category),
            is_managed = VALUES(is_managed),
            is_protected = VALUES(is_protected),
            is_read_only = VALUES(is_read_only),
            is_active = VALUES(is_active),
            sort_order = VALUES(sort_order),
            notes = VALUES(notes),
            deleted_at = CASE WHEN :from_snapshot_deleted_at = 1 THEN deleted_at ELSE NULL END,
            deleted_revision = CASE WHEN :from_snapshot_deleted_revision = 1 THEN deleted_revision ELSE 0 END,
            last_seen_at = CASE WHEN :from_snapshot_seen = 1 THEN NOW() ELSE last_seen_at END,
            updated_at = NOW()'
    );
    $statement->execute(array_merge($params, [
        'from_snapshot_deleted_at' => $from_snapshot ? 1 : 0,
        'from_snapshot_deleted_revision' => $from_snapshot ? 1 : 0,
        'from_snapshot_seen' => $from_snapshot ? 1 : 0,
    ]));

    return raidlands_permissions_group_id($pdo, $group_name);
}

function raidlands_permissions_group_rows(): array
{
    if (!raidlands_permissions_is_ready()) {
        $rows = [];

        foreach (raidlands_permissions_default_group_names() as $index => $group_name) {
            $rows[] = [
                'id' => 0,
                'group_name' => $group_name,
                'title' => $group_name,
                'rank' => 0,
                'parent_group' => '',
                'category' => str_starts_with($group_name, 'vip_') ? 'vip' : (str_starts_with($group_name, 'perk_') ? 'perk' : 'public'),
                'is_managed' => 1,
                'is_protected' => in_array($group_name, ['default', 'discord'], true) ? 1 : 0,
                'is_read_only' => 0,
                'is_active' => 1,
                'sort_order' => ($index + 1) * 10,
                'desired_permissions' => [],
                'live_permissions' => [],
            ];
        }

        return $rows;
    }

    $groups = raidlands_db_fetch_all(
        'SELECT * FROM oxide_groups WHERE deleted_at IS NULL ORDER BY sort_order ASC, group_name ASC'
    );

    foreach ($groups as &$group) {
        $group_name = (string) ($group['group_name'] ?? '');
        $group['rank'] = (int) ($group['group_rank'] ?? 0);
        $group['is_protected'] = raidlands_permissions_group_has_forced_protection($group_name) ? 1 : (int) ($group['is_protected'] ?? 0);
        $group['is_read_only'] = raidlands_permissions_group_is_read_only($group_name) ? 1 : 0;
        $group['is_managed'] = !empty($group['is_read_only']) ? 0 : (int) ($group['is_managed'] ?? 0);
    }
    unset($group);

    $ids = array_values(array_filter(array_map(static fn (array $group): int => (int) $group['id'], $groups)));
    $desired = [];
    $live = [];

    if ($ids !== []) {
        [$placeholders, $params] = raidlands_store_sql_in_params($ids, 'group_id');
        $desired_rows = raidlands_db_fetch_all(
            'SELECT ogpg.group_id, op.permission_name
             FROM oxide_group_permission_grants ogpg
             INNER JOIN oxide_permissions op ON op.id = ogpg.permission_id
             WHERE ogpg.group_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY op.permission_name ASC',
            $params
        );
        $live_rows = raidlands_db_fetch_all(
            'SELECT ogpl.group_id, op.permission_name
             FROM oxide_group_permission_live ogpl
             INNER JOIN oxide_permissions op ON op.id = ogpl.permission_id
             WHERE ogpl.group_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY op.permission_name ASC',
            $params
        );

        foreach ($desired_rows as $row) {
            $desired[(int) $row['group_id']][] = (string) $row['permission_name'];
        }

        foreach ($live_rows as $row) {
            $live[(int) $row['group_id']][] = (string) $row['permission_name'];
        }
    }

    foreach ($groups as &$group) {
        $id = (int) $group['id'];
        $group['desired_permissions'] = $desired[$id] ?? [];
        $group['live_permissions'] = $live[$id] ?? [];
    }
    unset($group);

    return $groups;
}

function raidlands_permissions_group_names(bool $include_read_only = false): array
{
    $groups = [];

    foreach (raidlands_permissions_group_rows() as $row) {
        if (empty($row['is_active'])) {
            continue;
        }

        if (!$include_read_only && !empty($row['is_read_only'])) {
            continue;
        }

        $groups[] = (string) $row['group_name'];
    }

    $groups = array_values(array_unique(array_filter($groups)));
    sort($groups, SORT_NATURAL | SORT_FLAG_CASE);

    return $groups;
}

function raidlands_permissions_store_group_names(): array
{
    $groups = [];

    foreach (raidlands_permissions_group_rows() as $row) {
        $group_name = (string) ($row['group_name'] ?? '');
        $category = (string) ($row['category'] ?? '');

        if (empty($row['is_active']) || !empty($row['is_read_only'])) {
            continue;
        }

        if (in_array($category, ['vip', 'perk', 'store'], true)) {
            $groups[] = $group_name;
        }
    }

    return array_values(array_unique(array_filter($groups)));
}

function raidlands_permissions_group_is_tombstoned(PDO $pdo, string $group_name): bool
{
    $group_name = raidlands_permissions_clean_group($group_name);

    if ($group_name === '') {
        return false;
    }

    $row = raidlands_db_fetch_one(
        'SELECT deleted_at FROM oxide_groups WHERE group_name = :group_name',
        ['group_name' => $group_name]
    );

    return $row !== null && trim((string) ($row['deleted_at'] ?? '')) !== '';
}

function raidlands_permissions_deleted_group_names(): array
{
    if (!raidlands_permissions_is_ready()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        'SELECT group_name
         FROM oxide_groups
         WHERE deleted_at IS NOT NULL
           AND is_read_only = 0
           AND is_protected = 0
           AND group_name NOT IN ("default", "discord", "admin", "authenticated")
         ORDER BY group_name ASC'
    );
    $groups = array_map(static fn (array $row): string => (string) ($row['group_name'] ?? ''), $rows);
    $groups = array_values(array_unique(array_filter(array_map('raidlands_permissions_clean_group', $groups))));
    sort($groups, SORT_NATURAL | SORT_FLAG_CASE);

    return $groups;
}

function raidlands_permissions_delete_blockers(PDO $pdo, string $group_name): array
{
    $group_name = raidlands_permissions_clean_group($group_name);
    $blockers = [];

    if ($group_name === '') {
        return ['Group name is invalid.'];
    }

    if (raidlands_permissions_table_exists('store_products')) {
        $row = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total
             FROM store_products
             WHERE oxide_group = :group_name
               AND is_active = 1',
            ['group_name' => $group_name]
        );
        $total = (int) ($row['total'] ?? 0);

        if ($total > 0) {
            $blockers[] = $total === 1
                ? '1 active store product still uses this group.'
                : $total . ' active store products still use this group.';
        }
    }

    if (raidlands_permissions_table_exists('entitlements')) {
        $row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM entitlements
             WHERE oxide_group = :group_name
               AND status = 'active'
               AND (ends_at IS NULL OR ends_at > NOW())",
            ['group_name' => $group_name]
        );
        $total = (int) ($row['total'] ?? 0);

        if ($total > 0) {
            $blockers[] = $total === 1
                ? '1 active entitlement still grants this group.'
                : $total . ' active entitlements still grant this group.';
        }
    }

    if (
        raidlands_permissions_table_exists('game_kit_group_access')
        && raidlands_permissions_table_exists('game_kits')
        && raidlands_permissions_column_exists('game_kits', 'deleted_at')
    ) {
        $row = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total
             FROM game_kit_group_access gga
             INNER JOIN game_kits gk ON gk.id = gga.kit_id
             WHERE gga.oxide_group = :group_name
               AND gga.is_granted = 1
               AND gk.is_active = 1
               AND gk.deleted_at IS NULL',
            ['group_name' => $group_name]
        );
        $total = (int) ($row['total'] ?? 0);

        if ($total > 0) {
            $blockers[] = $total === 1
                ? '1 active kit still grants access through this group.'
                : $total . ' active kits still grant access through this group.';
        }
    }

    return $blockers;
}

function raidlands_permissions_delete_group(PDO $pdo, string $group_name, int $revision): void
{
    $group_name = raidlands_permissions_clean_group($group_name);

    if ($group_name === '') {
        throw new InvalidArgumentException('Choose a valid group before deleting.');
    }

    $row = raidlands_db_fetch_one(
        'SELECT * FROM oxide_groups WHERE group_name = :group_name',
        ['group_name' => $group_name]
    );

    if ($row === null) {
        throw new RuntimeException('That group no longer exists.');
    }

    if (
        raidlands_permissions_group_is_read_only($group_name)
        || raidlands_permissions_group_has_forced_protection($group_name)
        || !empty($row['is_read_only'])
        || !empty($row['is_protected'])
    ) {
        throw new RuntimeException('Protected or read-only groups cannot be deleted from the website.');
    }

    $blockers = raidlands_permissions_delete_blockers($pdo, $group_name);

    if ($blockers !== []) {
        throw new RuntimeException('Cannot delete ' . $group_name . ': ' . implode(' ', $blockers));
    }

    $group_id = (int) ($row['id'] ?? 0);

    if ($group_id > 0) {
        raidlands_db_execute(
            'DELETE FROM oxide_group_permission_grants WHERE group_id = :group_id',
            ['group_id' => $group_id]
        );
        raidlands_db_execute(
            'DELETE FROM oxide_group_permission_live WHERE group_id = :group_id',
            ['group_id' => $group_id]
        );
    }

    raidlands_db_execute(
        'UPDATE oxide_groups
         SET is_active = 0,
             is_managed = 0,
             deleted_at = NOW(),
             deleted_revision = :revision,
             draft_revision = :revision,
             updated_at = NOW()
         WHERE group_name = :group_name',
        [
            'revision' => $revision,
            'group_name' => $group_name,
        ]
    );
}

function raidlands_permissions_permission_rows(): array
{
    if (!raidlands_permissions_is_ready()) {
        $rows = [];

        foreach (raidlands_permissions_fallback_permissions() as $permission) {
            $rows[] = [
                'id' => 0,
                'permission_name' => $permission,
                'plugin_name' => '',
                'permission_prefix' => raidlands_permissions_permission_prefix($permission),
                'source' => 'fallback',
                'is_active' => 1,
            ];
        }

        return $rows;
    }

    return raidlands_db_fetch_all(
        'SELECT *
         FROM oxide_permissions
         WHERE is_active = 1
         ORDER BY permission_prefix ASC, permission_name ASC'
    );
}

function raidlands_permissions_permission_names(): array
{
    $permissions = array_map(
        static fn (array $row): string => (string) $row['permission_name'],
        raidlands_permissions_permission_rows()
    );
    $permissions = array_values(array_unique(array_merge($permissions, raidlands_permissions_fallback_permissions())));
    sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);

    return $permissions;
}

function raidlands_permissions_admin_rows(): array
{
    return raidlands_permissions_group_rows();
}

function raidlands_permissions_admin_save(array $post): array
{
    if (!raidlands_permissions_is_ready()) {
        throw new RuntimeException(raidlands_permissions_readiness_message(true));
    }

    $pdo = raidlands_db_required();
    $publish = (string) ($post['permission_save_mode'] ?? 'draft') === 'publish';
    $revision = raidlands_permissions_next_revision($pdo);
    $changed = 0;

    $pdo->beginTransaction();

    try {
        foreach ((array) ($post['permission_groups'] ?? []) as $row) {
            $row = is_array($row) ? $row : [];
            $id = (int) ($row['id'] ?? 0);
            $group_name = raidlands_permissions_clean_group($row['group_name'] ?? '');

            if (!empty($row['delete'])) {
                if ($id > 0) {
                    $existing = raidlands_db_fetch_one(
                        'SELECT group_name FROM oxide_groups WHERE id = :id',
                        ['id' => $id]
                    );

                    if ($existing !== null) {
                        $group_name = raidlands_permissions_clean_group($existing['group_name'] ?? $group_name);
                    }
                }

                if ($group_name !== '') {
                    raidlands_permissions_delete_group($pdo, $group_name, $revision);
                    $changed += 1;
                }

                continue;
            }

            if ($group_name === '') {
                continue;
            }

            $is_read_only = raidlands_permissions_group_is_read_only($group_name);
            $params = [
                'group_name' => $group_name,
                'title' => $row['title'] ?? $group_name,
                'rank' => $row['rank'] ?? 0,
                'parent_group' => $row['parent_group'] ?? '',
                'category' => $row['category'] ?? 'custom',
                'is_managed' => !empty($row['is_managed']),
                'is_protected' => raidlands_permissions_group_has_forced_protection($group_name) || !empty($row['is_protected']),
                'is_read_only' => $is_read_only,
                'is_active' => empty($row['is_active']) ? 0 : 1,
                'sort_order' => $row['sort_order'] ?? 100,
                'notes' => $row['notes'] ?? '',
            ];
            $group_id = raidlands_permissions_upsert_group($pdo, $params, false);

            if ($group_id <= 0) {
                continue;
            }

            raidlands_db_execute(
                'UPDATE oxide_groups SET draft_revision = :revision, updated_at = NOW() WHERE id = :id',
                ['revision' => $revision, 'id' => $group_id]
            );

            if ($is_read_only) {
                $changed += 1;
                continue;
            }

            $selected = [];

            foreach ((array) ($row['permissions'] ?? []) as $permission) {
                $permission = raidlands_permissions_clean_permission($permission);

                if ($permission !== '') {
                    $selected[$permission] = $permission;
                }
            }

            $custom_lines = preg_split('/\R/', (string) ($row['custom_permissions'] ?? '')) ?: [];

            foreach ($custom_lines as $line) {
                $line = trim($line);

                if ($line === '') {
                    continue;
                }

                $permission = raidlands_permissions_clean_permission($line);
                $selected[$permission] = $permission;
            }

            raidlands_db_execute(
                'DELETE FROM oxide_group_permission_grants WHERE group_id = :group_id',
                ['group_id' => $group_id]
            );

            foreach (array_values($selected) as $permission) {
                $permission_id = raidlands_permissions_permission_id($pdo, $permission, 'admin');

                if ($permission_id <= 0) {
                    continue;
                }

                raidlands_db_execute(
                    'INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
                     VALUES (:group_id, :permission_id, "admin")
                     ON DUPLICATE KEY UPDATE source = VALUES(source), updated_at = NOW()',
                    [
                        'group_id' => $group_id,
                        'permission_id' => $permission_id,
                    ]
                );
            }

            $changed += 1;
        }

        if ($publish) {
            raidlands_db_execute(
                'UPDATE oxide_groups
                 SET published_revision = :revision, published_at = NOW(), updated_at = NOW()
                 WHERE is_managed = 1 AND is_active = 1 AND group_name NOT IN ("admin", "authenticated")',
                ['revision' => $revision]
            );
        }

        $payload_json = null;
        $hash = '';

        if ($publish) {
            $payload = raidlands_permissions_sync_payload($revision);
            $payload_json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $hash = hash('sha256', $payload_json ?: '');
        }

        raidlands_db_execute(
            'INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
             VALUES (:revision, :status, :payload_json, :payload_hash, :message)',
            [
                'revision' => $revision,
                'status' => $publish ? 'pending' : 'draft',
                'payload_json' => $payload_json,
                'payload_hash' => $hash,
                'message' => $publish ? 'Published from admin group editor.' : 'Draft saved from admin group editor.',
            ]
        );

        $pdo->commit();

        return [
            'changed' => $changed,
            'revision' => $revision,
            'published' => $publish,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_permissions_desired_map(): array
{
    if (!raidlands_permissions_is_ready()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        'SELECT og.group_name, op.permission_name
         FROM oxide_groups og
         LEFT JOIN oxide_group_permission_grants ogpg ON ogpg.group_id = og.id
         LEFT JOIN oxide_permissions op ON op.id = ogpg.permission_id
         WHERE og.is_managed = 1
           AND og.is_active = 1
           AND og.deleted_at IS NULL
           AND og.group_name NOT IN ("admin", "authenticated")
         ORDER BY og.group_name ASC, op.permission_name ASC'
    );
    $map = [];

    foreach ($rows as $row) {
        $group = raidlands_permissions_clean_group($row['group_name'] ?? '');

        if ($group === '') {
            continue;
        }

        if (!isset($map[$group])) {
            $map[$group] = [];
        }

        $permission = (string) ($row['permission_name'] ?? '');

        if ($permission !== '') {
            $map[$group][] = $permission;
        }
    }

    return $map;
}

function raidlands_permissions_flatten_group_permissions(array $group_permissions, array $parent_map): array
{
    $resolved = [];
    $resolving = [];

    $resolve = static function (string $group) use (&$resolve, &$resolved, &$resolving, $group_permissions, $parent_map): array {
        $group = raidlands_permissions_clean_group($group);

        if ($group === '') {
            return [];
        }

        if (isset($resolved[$group])) {
            return $resolved[$group];
        }

        if (isset($resolving[$group])) {
            return array_values(array_unique(array_map('strval', (array) ($group_permissions[$group] ?? []))));
        }

        $resolving[$group] = true;
        $permissions = array_values(array_unique(array_map('strval', (array) ($group_permissions[$group] ?? []))));
        $parent = raidlands_permissions_clean_group($parent_map[$group] ?? '');

        if ($parent !== '' && isset($group_permissions[$parent])) {
            $permissions = array_merge($resolve($parent), $permissions);
        }

        $permissions = array_values(array_unique(array_filter($permissions)));
        sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);
        $resolved[$group] = $permissions;
        unset($resolving[$group]);

        return $permissions;
    };

    foreach (array_keys($group_permissions) as $group) {
        $group = raidlands_permissions_clean_group($group);

        if ($group !== '') {
            $group_permissions[$group] = $resolve($group);
        }
    }

    return $group_permissions;
}

function raidlands_permissions_sync_payload(?int $revision = null): array
{
    $revision = $revision ?? raidlands_permissions_latest_published_revision();
    $groups = [];
    $group_permissions = raidlands_permissions_desired_map();
    $parent_map = [];

    foreach (raidlands_permissions_group_rows() as $group) {
        if (empty($group['is_managed']) || empty($group['is_active']) || !empty($group['is_read_only'])) {
            continue;
        }

        $group_name = (string) $group['group_name'];
        $parent_map[$group_name] = (string) ($group['parent_group'] ?? '');
        $groups[] = [
            'name' => $group_name,
            'title' => (string) ($group['title'] ?: $group_name),
            'rank' => (int) $group['rank'],
            'parent' => (string) ($group['parent_group'] ?? ''),
            'category' => (string) ($group['category'] ?? 'custom'),
            'protected' => !empty($group['is_protected']),
        ];

        if (!isset($group_permissions[$group_name])) {
            $group_permissions[$group_name] = [];
        }
    }

    if (function_exists('raidlands_kits_is_ready') && raidlands_kits_is_ready()) {
        $kit_payload = raidlands_kits_sync_payload();

        foreach ((array) ($kit_payload['group_access'] ?? []) as $group => $permissions) {
            $group = raidlands_permissions_clean_group($group);

            if ($group === '' || !isset($group_permissions[$group])) {
                continue;
            }

            foreach ((array) $permissions as $permission) {
                $permission = raidlands_permissions_clean_permission($permission);
                $group_permissions[$group][] = $permission;
            }
        }
    }

    $group_permissions = raidlands_permissions_flatten_group_permissions($group_permissions, $parent_map);

    foreach ($group_permissions as $group => $permissions) {
        $permissions = array_values(array_unique(array_filter(array_map('strval', (array) $permissions))));
        sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);
        $group_permissions[$group] = $permissions;
    }

    ksort($group_permissions, SORT_NATURAL | SORT_FLAG_CASE);

    return [
        'revision' => $revision,
        'generated_at' => gmdate('c'),
        'managed_groups' => array_values(array_keys($group_permissions)),
        'read_only_groups' => raidlands_permissions_read_only_groups(),
        'deleted_groups' => raidlands_permissions_deleted_group_names(),
        'groups' => $groups,
        'group_permissions' => (object) $group_permissions,
    ];
}

function raidlands_permissions_latest_published_revision(): int
{
    if (!raidlands_permissions_is_ready()) {
        return 0;
    }

    $row = raidlands_db_fetch_one(
        "SELECT COALESCE(MAX(revision), 0) AS revision
         FROM oxide_permission_sync_log
         WHERE payload_json IS NOT NULL
           AND status IN ('pending', 'applied', 'failed')"
    );

    return (int) ($row['revision'] ?? 0);
}

function raidlands_permissions_published_payload(int $revision): ?array
{
    if ($revision <= 0) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        "SELECT payload_json
         FROM oxide_permission_sync_log
         WHERE revision = :revision
           AND payload_json IS NOT NULL
           AND status IN ('pending', 'applied', 'failed')
         ORDER BY id DESC
         LIMIT 1",
        ['revision' => $revision]
    );

    if ($row === null || trim((string) ($row['payload_json'] ?? '')) === '') {
        return null;
    }

    $payload = json_decode((string) $row['payload_json'], true);

    return is_array($payload) ? $payload : null;
}

function raidlands_permissions_pending_sync(int $since): array
{
    if (!raidlands_permissions_is_ready()) {
        throw new RuntimeException(raidlands_permissions_readiness_message(true));
    }

    $revision = raidlands_permissions_latest_published_revision();

    if ($revision <= max(0, $since)) {
        return [
            'revision' => $revision,
            'has_update' => false,
            'managed_groups' => [],
            'deleted_groups' => [],
            'groups' => [],
            'group_permissions' => (object) [],
        ];
    }

    $payload = raidlands_permissions_published_payload($revision);

    if ($payload === null) {
        return [
            'revision' => 0,
            'has_update' => false,
            'managed_groups' => [],
            'deleted_groups' => [],
            'groups' => [],
            'group_permissions' => (object) [],
        ];
    }

    $payload['revision'] = $revision;
    $payload['has_update'] = true;
    $payload['deleted_groups'] = array_values(array_map('strval', (array) ($payload['deleted_groups'] ?? [])));
    $payload['group_permissions'] = (object) ($payload['group_permissions'] ?? []);

    return $payload;
}

function raidlands_permissions_import_snapshot(array $payload): array
{
    if (!raidlands_permissions_is_ready()) {
        throw new RuntimeException(raidlands_permissions_readiness_message(true));
    }

    $pdo = raidlands_db_required();
    $revision = raidlands_permissions_next_revision($pdo);
    $groups = $payload['groups'] ?? [];
    $permissions = $payload['permissions'] ?? [];
    $group_permissions = $payload['group_permissions'] ?? $payload['permissions_by_group'] ?? [];
    $groups_seen = 0;
    $permissions_seen = 0;

    $pdo->beginTransaction();

    try {
        foreach ((array) $permissions as $permission_row) {
            if (is_array($permission_row)) {
                $name = (string) ($permission_row['name'] ?? $permission_row['permission'] ?? $permission_row['permission_name'] ?? '');
                $plugin = (string) ($permission_row['plugin'] ?? $permission_row['plugin_name'] ?? '');
            } else {
                $name = (string) $permission_row;
                $plugin = '';
            }

            if ($name === '') {
                continue;
            }

            raidlands_permissions_permission_id($pdo, $name, 'snapshot', $plugin);
            $permissions_seen += 1;
        }

        foreach ((array) $groups as $key => $group_row) {
            if (is_array($group_row)) {
                $name = (string) ($group_row['name'] ?? $group_row['group_name'] ?? $key);
                $row = [
                    'group_name' => $name,
                    'title' => $group_row['title'] ?? $name,
                    'rank' => $group_row['rank'] ?? 0,
                    'parent_group' => $group_row['parent'] ?? $group_row['parent_group'] ?? '',
                    'category' => $group_row['category'] ?? 'snapshot',
                    'is_managed' => in_array($name, raidlands_permissions_default_group_names(), true),
                    'is_protected' => raidlands_permissions_group_has_forced_protection($name),
                    'is_read_only' => raidlands_permissions_group_is_read_only($name),
                    'is_active' => 1,
                    'sort_order' => $group_row['sort_order'] ?? 100,
                ];
            } else {
                $name = (string) $group_row;
                $row = [
                    'group_name' => $name,
                    'title' => $name,
                    'rank' => 0,
                    'parent_group' => '',
                    'category' => 'snapshot',
                    'is_managed' => in_array($name, raidlands_permissions_default_group_names(), true),
                    'is_protected' => raidlands_permissions_group_has_forced_protection($name),
                    'is_read_only' => raidlands_permissions_group_is_read_only($name),
                    'is_active' => 1,
                    'sort_order' => 100,
                ];
            }

            if (raidlands_permissions_group_is_tombstoned($pdo, $name)) {
                continue;
            }

            if (raidlands_permissions_upsert_group($pdo, $row, true) > 0) {
                $groups_seen += 1;
            }
        }

        foreach ((array) $group_permissions as $group => $permission_list) {
            $group = raidlands_permissions_clean_group($group);

            if ($group === '') {
                continue;
            }

            if (raidlands_permissions_group_is_tombstoned($pdo, $group)) {
                continue;
            }

            $group_id = raidlands_permissions_group_id($pdo, $group);

            if ($group_id <= 0) {
                $group_id = raidlands_permissions_upsert_group($pdo, [
                    'group_name' => $group,
                    'title' => $group,
                    'category' => 'snapshot',
                    'is_managed' => in_array($group, raidlands_permissions_default_group_names(), true),
                    'is_protected' => raidlands_permissions_group_has_forced_protection($group),
                    'is_read_only' => raidlands_permissions_group_is_read_only($group),
                    'is_active' => 1,
                ], true);
            }

            if ($group_id <= 0) {
                continue;
            }

            raidlands_db_execute(
                'DELETE FROM oxide_group_permission_live WHERE group_id = :group_id',
                ['group_id' => $group_id]
            );

            $desired_count = (int) raidlands_db_fetch_one(
                'SELECT COUNT(*) AS total FROM oxide_group_permission_grants WHERE group_id = :group_id',
                ['group_id' => $group_id]
            )['total'];
            $group_meta = raidlands_db_fetch_one(
                'SELECT group_name, is_managed FROM oxide_groups WHERE id = :id',
                ['id' => $group_id]
            );
            $group_is_read_only = raidlands_permissions_group_is_read_only((string) ($group_meta['group_name'] ?? ''));
            $seed_desired = $desired_count === 0
                && !empty($group_meta['is_managed'])
                && !$group_is_read_only;

            foreach ((array) $permission_list as $permission) {
                $permission = raidlands_permissions_clean_permission($permission);
                $permission_id = raidlands_permissions_permission_id($pdo, $permission, 'snapshot');

                if ($permission_id <= 0) {
                    continue;
                }

                raidlands_db_execute(
                    'INSERT INTO oxide_group_permission_live (group_id, permission_id, source, last_seen_at)
                     VALUES (:group_id, :permission_id, "snapshot", NOW())
                     ON DUPLICATE KEY UPDATE last_seen_at = NOW(), updated_at = NOW()',
                    [
                        'group_id' => $group_id,
                        'permission_id' => $permission_id,
                    ]
                );

                if ($seed_desired) {
                    raidlands_db_execute(
                        'INSERT INTO oxide_group_permission_grants (group_id, permission_id, source)
                         VALUES (:group_id, :permission_id, "snapshot")
                         ON DUPLICATE KEY UPDATE updated_at = NOW()',
                        [
                            'group_id' => $group_id,
                            'permission_id' => $permission_id,
                        ]
                    );
                }
            }
        }

        raidlands_db_execute(
            'INSERT INTO oxide_permission_sync_log (revision, status, message)
             VALUES (:revision, "snapshot", :message)',
            [
                'revision' => $revision,
                'message' => 'Imported group and permission snapshot from Rust server.',
            ]
        );

        $pdo->commit();

        return [
            'revision' => $revision,
            'groups' => $groups_seen,
            'permissions' => $permissions_seen,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_permissions_record_sync_result(array $payload): void
{
    if (!raidlands_permissions_is_ready()) {
        throw new RuntimeException(raidlands_permissions_readiness_message(true));
    }

    $revision = max(0, (int) ($payload['revision'] ?? 0));
    $status = strtolower((string) ($payload['status'] ?? ''));

    if (!in_array($status, ['applied', 'failed'], true)) {
        $status = !empty($payload['ok']) ? 'applied' : 'failed';
    }

    $message = raidlands_permissions_clean_text($payload['message'] ?? '', 500);
    $error = raidlands_permissions_clean_multiline($payload['error'] ?? $payload['error_text'] ?? '', 3000);
    $hash = raidlands_permissions_clean_text($payload['payload_hash'] ?? '', 64);

    $updated = raidlands_db_execute(
        "UPDATE oxide_permission_sync_log
         SET status = :status,
             payload_hash = COALESCE(NULLIF(:payload_hash, ''), payload_hash),
             message = :message,
             error_text = :error_text,
             applied_at = CASE WHEN :applied = 1 THEN NOW() ELSE applied_at END,
             updated_at = NOW()
         WHERE revision = :revision AND status = 'pending'",
        [
            'revision' => $revision,
            'status' => $status,
            'applied' => $status === 'applied' ? 1 : 0,
            'payload_hash' => $hash,
            'message' => $message,
            'error_text' => $error,
        ]
    );

    if ($updated === 0) {
        raidlands_db_execute(
            "INSERT INTO oxide_permission_sync_log (revision, status, payload_hash, message, error_text, applied_at)
             VALUES (:revision, :status, :payload_hash, :message, :error_text, CASE WHEN :applied = 1 THEN NOW() ELSE NULL END)",
            [
                'revision' => $revision,
                'status' => $status,
                'applied' => $status === 'applied' ? 1 : 0,
                'payload_hash' => $hash,
                'message' => $message,
                'error_text' => $error,
            ]
        );
    }
}

function raidlands_permissions_recent_sync_rows(int $limit = 20): array
{
    if (!raidlands_permissions_is_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        'SELECT * FROM oxide_permission_sync_log ORDER BY updated_at DESC, id DESC LIMIT ' . max(1, min(100, $limit))
    );
}

function raidlands_permissions_publish_from_related_change(string $message): void
{
    if (!raidlands_permissions_is_ready()) {
        return;
    }

    $pdo = raidlands_db_required();
    $revision = raidlands_permissions_next_revision($pdo);
    $payload = raidlands_permissions_sync_payload($revision);
    $payload_json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    raidlands_db_execute(
        'INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
         VALUES (:revision, "pending", :payload_json, :payload_hash, :message)',
        [
            'revision' => $revision,
            'payload_json' => $payload_json,
            'payload_hash' => hash('sha256', $payload_json ?: ''),
            'message' => raidlands_permissions_clean_text($message, 500),
        ]
    );
}
