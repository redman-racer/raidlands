<?php

require_once __DIR__ . '/store.php';

function raidlands_kits_table_exists(string $table): bool
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

function raidlands_kits_column_exists(string $table, string $column): bool
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

function raidlands_kits_is_ready(): bool
{
    return raidlands_kits_table_exists('game_kits')
        && raidlands_kits_table_exists('game_kit_items')
        && raidlands_kits_table_exists('game_kit_sync_log')
        && raidlands_kits_column_exists('game_kit_sync_log', 'payload_json')
        && raidlands_kits_column_exists('game_kits', 'deleted_at')
        && raidlands_kits_column_exists('game_kits', 'deleted_revision');
}

function raidlands_kits_readiness_message(bool $admin = false): string
{
    if (!raidlands_db_is_configured()) {
        return $admin
            ? 'Database credentials are not configured yet.'
            : 'Kit details are being prepared.';
    }

    if (!raidlands_kits_is_ready()) {
        return $admin
            ? 'Kit tables are not installed yet. Run database/migrations/006_game_kits.sql, then database/migrations/014_kit_group_delete_tombstones.sql.'
            : 'Kit details are being prepared.';
    }

    return '';
}

function raidlands_kits_clean_text($value, int $max_length = 160): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_kits_clean_multiline($value, int $max_length = 3000): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_kits_int($value, int $min, int $max): int
{
    return max($min, min($max, (int) $value));
}

function raidlands_kits_decimal($value, float $min, float $max): float
{
    return max($min, min($max, (float) $value));
}

function raidlands_kits_clean_permission($value): string
{
    $permission = strtolower(raidlands_kits_clean_text($value, 160));

    if ($permission === '') {
        return '';
    }

    if (!preg_match('/^[a-z0-9_.-]+$/', $permission)) {
        throw new InvalidArgumentException('Kit permissions can only use letters, numbers, dots, dashes, and underscores.');
    }

    $allowed_prefixes = ['kits.', 'serverrewards.'];

    foreach ($allowed_prefixes as $prefix) {
        if (str_starts_with($permission, $prefix)) {
            return $permission;
        }
    }

    return 'kits.' . $permission;
}

function raidlands_kits_permission_from_name(string $name): string
{
    $slug = strtolower(raidlands_kits_clean_text($name, 120));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');

    if ($slug === '') {
        return '';
    }

    return 'kits.' . $slug;
}

function raidlands_kits_clean_group($value): string
{
    $group = strtolower(raidlands_kits_clean_text($value, 160));

    if ($group === '' || !preg_match('/^[a-z0-9_.-]+$/', $group)) {
        return '';
    }

    return $group;
}

function raidlands_kits_clean_groups(array $groups): array
{
    $clean = [];

    foreach ($groups as $group) {
        $group = raidlands_kits_clean_group($group);

        if ($group !== '') {
            $clean[] = $group;
        }
    }

    $clean = array_values(array_unique($clean));
    sort($clean, SORT_NATURAL | SORT_FLAG_CASE);

    return $clean;
}

function raidlands_kits_guided_claim_permission(string $kit_name, $permission, array $groups): string
{
    $claim_permission = raidlands_kits_clean_permission($permission);

    if ($claim_permission !== '' || raidlands_kits_clean_groups($groups) === []) {
        return $claim_permission;
    }

    $claim_permission = raidlands_kits_permission_from_name($kit_name);

    if ($claim_permission === '') {
        throw new InvalidArgumentException('Kit "' . $kit_name . '" has group grants selected, but no claim permission. Enter a claim permission such as kits.raid before saving.');
    }

    return $claim_permission;
}

function raidlands_kits_clean_image_path($value): string
{
    $path = trim(str_replace("\0", '', (string) $value));

    if ($path === '') {
        return '';
    }

    if (preg_match('/(^file:|^[a-z]:[\\\\\\/]|\\\\|\\.php(?:\\?|$))/i', $path)) {
        throw new InvalidArgumentException('Kit images must use HTTPS or assets/media/kits uploads.');
    }

    if (filter_var($path, FILTER_VALIDATE_URL) !== false) {
        $scheme = strtolower((string) parse_url($path, PHP_URL_SCHEME));

        if ($scheme !== 'https') {
            throw new InvalidArgumentException('Kit image URLs must use HTTPS.');
        }

        return $path;
    }

    $path = '/' . ltrim($path, '/');

    if (!preg_match('#^/assets/media/kits/[a-z0-9._/-]+\\.(png|jpe?g|webp|gif)$#i', $path)) {
        throw new InvalidArgumentException('Uploaded kit images must live under assets/media/kits/.');
    }

    return $path;
}

function raidlands_kits_public_image_url(string $path): string
{
    $path = trim($path);

    if ($path === '') {
        return '';
    }

    if (filter_var($path, FILTER_VALIDATE_URL) !== false) {
        return $path;
    }

    if (str_starts_with($path, '/assets/')) {
        return asset_url(substr($path, strlen('/assets/')));
    }

    if (str_starts_with($path, 'assets/')) {
        return asset_url(substr($path, strlen('assets/')));
    }

    return $path;
}

function raidlands_kits_file_at_index(array $files, string $field, int $index): ?array
{
    if (empty($files[$field]) || !is_array($files[$field])) {
        return null;
    }

    $group = $files[$field];

    if (!isset($group['error'][$index])) {
        return null;
    }

    return [
        'name' => (string) ($group['name'][$index] ?? ''),
        'type' => (string) ($group['type'][$index] ?? ''),
        'tmp_name' => (string) ($group['tmp_name'][$index] ?? ''),
        'error' => (int) ($group['error'][$index] ?? UPLOAD_ERR_NO_FILE),
        'size' => (int) ($group['size'][$index] ?? 0),
    ];
}

function raidlands_kits_store_uploaded_image(?array $file): string
{
    if ($file === null || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return '';
    }

    if ((int) $file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Kit image upload failed.');
    }

    if ((int) $file['size'] > 5 * 1024 * 1024) {
        throw new RuntimeException('Kit images must be 5 MB or smaller.');
    }

    $tmp = (string) $file['tmp_name'];

    if ($tmp === '' || !is_uploaded_file($tmp)) {
        throw new RuntimeException('Kit image upload was not accepted by PHP.');
    }

    $mime = '';

    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = (string) finfo_file($finfo, $tmp);
            finfo_close($finfo);
        }
    }

    $extensions = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    if (!isset($extensions[$mime])) {
        throw new RuntimeException('Kit images must be PNG, JPG, WebP, or GIF files.');
    }

    $name = strtolower(pathinfo((string) $file['name'], PATHINFO_FILENAME));
    $name = trim(preg_replace('/[^a-z0-9-]+/', '-', $name) ?? '', '-');

    if ($name === '') {
        $name = 'kit-image';
    }

    $directory = dirname(__DIR__) . '/assets/media/kits';

    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create kit image upload directory.');
    }

    $filename = $name . '-' . date('Ymd-His') . '.' . $extensions[$mime];
    $target = $directory . '/' . $filename;

    if (!move_uploaded_file($tmp, $target)) {
        throw new RuntimeException('Could not save kit image upload.');
    }

    return '/assets/media/kits/' . $filename;
}

function raidlands_kits_next_revision(PDO $pdo): int
{
    $revision = (int) $pdo->query('SELECT COALESCE(MAX(GREATEST(draft_revision, published_revision, deleted_revision)), 0) + 1 FROM game_kits')->fetchColumn();
    $log_revision = (int) $pdo->query(
        "SELECT COALESCE(MAX(revision), 0) + 1 FROM game_kit_sync_log WHERE status <> 'snapshot'"
    )->fetchColumn();

    return max(1, $revision, $log_revision);
}

function raidlands_kits_fetch_all(bool $active_only = false, bool $include_deleted = false): array
{
    if (!raidlands_kits_is_ready()) {
        return [];
    }

    $conditions = [];

    if ($active_only) {
        $conditions[] = 'is_active = 1';
    }

    if (!$include_deleted) {
        $conditions[] = 'deleted_at IS NULL';
    }

    $where = $conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions);
    $kits = raidlands_db_fetch_all(
        "SELECT * FROM game_kits $where ORDER BY sort_order ASC, id ASC"
    );

    if ($kits === []) {
        return [];
    }

    $ids = array_map(static fn (array $kit): int => (int) $kit['id'], $kits);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $items = raidlands_db_fetch_all(
        "SELECT * FROM game_kit_items WHERE kit_id IN ($placeholders) ORDER BY kit_id ASC, container_name ASC, position ASC, sort_order ASC, id ASC",
        $ids
    );
    $groups = raidlands_db_fetch_all(
        "SELECT * FROM game_kit_group_access WHERE kit_id IN ($placeholders) ORDER BY oxide_group ASC",
        $ids
    );
    $links = raidlands_db_fetch_all(
        "SELECT * FROM store_product_kits WHERE kit_id IN ($placeholders) ORDER BY sort_order ASC, id ASC",
        $ids
    );

    $by_id = [];

    foreach ($kits as $index => $kit) {
        $kit['items'] = [
            'main' => [],
            'wear' => [],
            'belt' => [],
        ];
        $kit['groups'] = [];
        $kit['store_product_ids'] = [];
        $kits[$index] = $kit;
        $by_id[(int) $kit['id']] = $index;
    }

    foreach ($items as $item) {
        $kit_id = (int) $item['kit_id'];
        $container = (string) $item['container_name'];

        if (isset($by_id[$kit_id], $kits[$by_id[$kit_id]]['items'][$container])) {
            $kits[$by_id[$kit_id]]['items'][$container][] = $item;
        }
    }

    foreach ($groups as $group) {
        $kit_id = (int) $group['kit_id'];

        if (isset($by_id[$kit_id]) && !empty($group['is_granted'])) {
            $kits[$by_id[$kit_id]]['groups'][] = (string) $group['oxide_group'];
        }
    }

    foreach ($links as $link) {
        $kit_id = (int) $link['kit_id'];

        if (isset($by_id[$kit_id])) {
            $kits[$by_id[$kit_id]]['store_product_ids'][] = (int) $link['product_id'];
        }
    }

    return $kits;
}

function raidlands_kits_store_product_options(): array
{
    if (!raidlands_db_is_configured() || !raidlands_kits_table_exists('store_products')) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT id, name, slug, oxide_group, is_active FROM store_products ORDER BY sort_order ASC, id ASC'
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_kits_available_groups(): array
{
    $groups = array_merge(['default', 'discord'], raidlands_store_managed_groups());

    if (function_exists('raidlands_permissions_group_names')) {
        $groups = array_merge($groups, raidlands_permissions_group_names(false));
    }

    if (raidlands_kits_is_ready()) {
        try {
            $rows = raidlands_db_fetch_all(
                'SELECT DISTINCT gga.oxide_group
                 FROM game_kit_group_access gga
                 INNER JOIN game_kits gk ON gk.id = gga.kit_id
                 WHERE gga.oxide_group <> ""
                   AND gk.deleted_at IS NULL'
            );

            foreach ($rows as $row) {
                $groups[] = (string) $row['oxide_group'];
            }
        } catch (Throwable $error) {
            // Keep config/store groups if kit tables are not ready.
        }
    }

    $groups = array_values(array_filter(array_unique(array_map('raidlands_kits_clean_group', $groups))));
    sort($groups, SORT_NATURAL | SORT_FLAG_CASE);

    return $groups;
}

function raidlands_kits_item_catalog(bool $safe_only = true): array
{
    static $catalog = null;

    if ($catalog === null) {
        $catalog = [];
        $path = dirname(__DIR__) . '/assets/data/rust-items.json';

        if (is_file($path)) {
            $json = json_decode((string) file_get_contents($path), true);
            $items = is_array($json) ? (array) ($json['items'] ?? []) : [];

            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $shortname = strtolower(raidlands_kits_clean_text($item['shortname'] ?? '', 160));

                if ($shortname === '') {
                    continue;
                }

                $item['shortname'] = $shortname;
                $catalog[] = $item;
            }
        }
    }

    if (!$safe_only) {
        return $catalog;
    }

    return array_values(array_filter($catalog, static fn (array $item): bool => !empty($item['safe_shortname'])));
}

function raidlands_kits_item_catalog_map(bool $safe_only = true): array
{
    $map = [];

    foreach (raidlands_kits_item_catalog($safe_only) as $item) {
        $map[(string) $item['shortname']] = $item;
    }

    return $map;
}

function raidlands_kits_known_shortnames(): array
{
    $shortnames = [
        'ammo.pistol', 'ammo.rifle', 'ammo.rifle.explosive', 'ammo.rifle.hv', 'ammo.rocket.basic',
        'ammo.rocket.hv', 'barricade.wood.cover', 'black.raspberries', 'building.planner',
        'coffeecan.helmet', 'cupboard.tool.retro', 'diving.fins', 'diving.mask', 'diving.tank',
        'diving.wetsuit', 'door.double.hinged.toptier', 'door.hinged.toptier', 'explosive.timed',
        'fuse', 'gears', 'hammer', 'hatchet', 'hmlmg', 'hoodie', 'jackhammer', 'keycard_blue',
        'keycard_green', 'keycard_red', 'largemedkit', 'lmg.m249', 'm16a2', 'metal.facemask',
        'metal.fragments', 'metal.plate.torso', 'metal.refined', 'metalblade', 'metalpipe',
        'metalspring', 'pants', 'rifle.ak', 'rifle.l96', 'rifle.lr300', 'rifle.semiauto',
        'riflebody', 'roadsign.jacket', 'roadsign.kilt', 'roadsigns', 'rock', 'rocket.launcher',
        'rope', 'semibody', 'sewingkit', 'sheetmetal', 'shoes.boots', 'smg.2', 'smg.mp5',
        'smg.thompson', 'smgbody', 'stones', 'supply.signal', 'syringe.medical', 'tactical.gloves',
        'tarp', 'techparts', 'torch', 'weapon.mod.8x.scope', 'weapon.mod.extendedmags',
        'weapon.mod.holosight', 'weapon.mod.lasersight', 'wood',
    ];

    foreach (raidlands_kits_item_catalog(true) as $item) {
        $shortnames[] = (string) $item['shortname'];
    }

    if (raidlands_kits_is_ready()) {
        try {
            $rows = raidlands_db_fetch_all('SELECT DISTINCT shortname FROM game_kit_items WHERE shortname <> ""');

            foreach ($rows as $row) {
                $shortnames[] = (string) $row['shortname'];
            }
        } catch (Throwable $error) {
            // Static suggestions are enough if the table is not ready.
        }
    }

    $shortnames = array_values(array_unique(array_filter($shortnames)));
    sort($shortnames, SORT_NATURAL | SORT_FLAG_CASE);

    return $shortnames;
}

function raidlands_kits_admin_rows(): array
{
    return raidlands_kits_fetch_all(false);
}

function raidlands_kits_decode_optional_json($value, string $label): ?string
{
    $json = trim((string) $value);

    if ($json === '') {
        return null;
    }

    json_decode($json, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new InvalidArgumentException($label . ' must be valid JSON.');
    }

    return $json;
}

function raidlands_kits_decode_admin_items_json($value): ?array
{
    $json = trim((string) $value);

    if ($json === '') {
        return null;
    }

    $decoded = json_decode($json, true);

    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Kit item payload must be valid JSON.');
    }

    $items = [
        'main' => [],
        'wear' => [],
        'belt' => [],
    ];

    foreach (['main', 'wear', 'belt'] as $container) {
        $rows = $decoded[$container] ?? [];

        if (!is_array($rows)) {
            throw new InvalidArgumentException('Kit item payload has invalid ' . $container . ' rows.');
        }

        foreach ($rows as $row) {
            if (is_array($row)) {
                $items[$container][] = $row;
            }
        }
    }

    return $items;
}

function raidlands_kits_assert_complete_admin_post(array $post): void
{
    $expected_json = (string) ($post['kit_expected_items'] ?? '');

    if ($expected_json === '') {
        return;
    }

    $expected = json_decode($expected_json, true);

    if (!is_array($expected)) {
        throw new RuntimeException('The kit editor submitted an invalid form completeness marker. Reload the page and try again.');
    }

    $submitted_kits = (array) ($post['kits'] ?? []);

    foreach ($expected as $kit_index => $containers) {
        if (!is_array($containers)) {
            continue;
        }

        $kit_row = (array) ($submitted_kits[$kit_index] ?? []);

        if (!empty($containers['compact'])) {
            if (trim((string) ($kit_row['items_json'] ?? '')) === '') {
                throw new RuntimeException('The compact kit item payload did not reach PHP. Reload the kit editor and try again.');
            }

            raidlands_kits_decode_admin_items_json($kit_row['items_json']);
            continue;
        }

        $submitted_items = (array) ($kit_row['items'] ?? []);

        foreach (['main', 'wear', 'belt'] as $container) {
            $expected_count = (int) ($containers[$container] ?? 0);

            if ($expected_count <= 0) {
                continue;
            }

            $actual_count = count((array) ($submitted_items[$container] ?? []));

            if ($actual_count < $expected_count) {
                throw new RuntimeException('The kit editor form was cut off before all item rows reached PHP. Increase PHP max_input_vars or save fewer kit rows at once, then try again.');
            }
        }
    }
}

function raidlands_kits_save_items(PDO $pdo, int $kit_id, array $item_rows): void
{
    $delete = $pdo->prepare('DELETE FROM game_kit_items WHERE kit_id = :kit_id');
    $delete->execute(['kit_id' => $kit_id]);

    $insert = $pdo->prepare(
        "INSERT INTO game_kit_items
            (kit_id, container_name, position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, sort_order)
         VALUES
            (:kit_id, :container_name, :position, :shortname, :display_name, :skin, :amount, :condition_value, :max_condition, :ammo, :ammo_type, :frequency, :blueprint_shortname, :text_value, :contents_json, :container_json, :sort_order)"
    );

    foreach (['main', 'wear', 'belt'] as $container) {
        foreach ((array) ($item_rows[$container] ?? []) as $index => $row) {
            $row = is_array($row) ? $row : [];
            $shortname = strtolower(raidlands_kits_clean_text($row['shortname'] ?? $row['Shortname'] ?? '', 160));

            if ($shortname === '') {
                continue;
            }

            if (!preg_match('/^[a-z0-9._-]+$/', $shortname)) {
                throw new InvalidArgumentException('Item shortnames can only use letters, numbers, dots, dashes, and underscores.');
            }

            $insert->execute([
                'kit_id' => $kit_id,
                'container_name' => $container,
                'position' => raidlands_kits_int($row['position'] ?? $row['Position'] ?? $index, 0, $container === 'main' ? 23 : ($container === 'wear' ? 7 : 5)),
                'shortname' => $shortname,
                'display_name' => raidlands_kits_clean_text($row['display_name'] ?? $row['DisplayName'] ?? '', 160) ?: null,
                'skin' => max(0, (int) ($row['skin'] ?? $row['Skin'] ?? $row['SkinID'] ?? 0)),
                'amount' => raidlands_kits_int($row['amount'] ?? $row['Amount'] ?? 1, 1, 1000000),
                'condition_value' => raidlands_kits_decimal($row['condition'] ?? $row['Condition'] ?? 0, 0, 1000000),
                'max_condition' => raidlands_kits_decimal($row['max_condition'] ?? $row['MaxCondition'] ?? 0, 0, 1000000),
                'ammo' => raidlands_kits_int($row['ammo'] ?? $row['Ammo'] ?? 0, 0, 1000000),
                'ammo_type' => raidlands_kits_clean_text($row['ammo_type'] ?? $row['Ammotype'] ?? $row['AmmoType'] ?? '', 160) ?: null,
                'frequency' => raidlands_kits_int($row['frequency'] ?? $row['Frequency'] ?? -1, -1, 999999),
                'blueprint_shortname' => strtolower(raidlands_kits_clean_text($row['blueprint_shortname'] ?? $row['BlueprintShortname'] ?? '', 160)) ?: null,
                'text_value' => raidlands_kits_clean_multiline($row['text'] ?? $row['Text'] ?? '', 1000) ?: null,
                'contents_json' => raidlands_kits_decode_optional_json($row['contents_json'] ?? (!empty($row['Contents']) ? json_encode($row['Contents'], JSON_UNESCAPED_SLASHES) : ''), 'Contents JSON'),
                'container_json' => raidlands_kits_decode_optional_json($row['container_json'] ?? (!empty($row['Container']) ? json_encode($row['Container'], JSON_UNESCAPED_SLASHES) : ''), 'Container JSON'),
                'sort_order' => raidlands_kits_int($row['sort_order'] ?? ($index * 10), 0, 9999),
            ]);
        }
    }
}

function raidlands_kits_save_groups(PDO $pdo, int $kit_id, array $groups): void
{
    $pdo->prepare('DELETE FROM game_kit_group_access WHERE kit_id = :kit_id')->execute(['kit_id' => $kit_id]);
    $insert = $pdo->prepare(
        'INSERT INTO game_kit_group_access (kit_id, oxide_group, is_granted) VALUES (:kit_id, :oxide_group, 1)
         ON DUPLICATE KEY UPDATE is_granted = 1, updated_at = NOW()'
    );

    foreach (raidlands_kits_clean_groups($groups) as $group) {
        $insert->execute([
            'kit_id' => $kit_id,
            'oxide_group' => $group,
        ]);
    }
}

function raidlands_kits_save_product_links(PDO $pdo, int $kit_id, array $product_ids): void
{
    $pdo->prepare('DELETE FROM store_product_kits WHERE kit_id = :kit_id')->execute(['kit_id' => $kit_id]);
    $insert = $pdo->prepare(
        'INSERT INTO store_product_kits (product_id, kit_id, sort_order) VALUES (:product_id, :kit_id, :sort_order)
         ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), updated_at = NOW()'
    );

    foreach (array_values(array_unique(array_map('intval', $product_ids))) as $index => $product_id) {
        if ($product_id <= 0) {
            continue;
        }

        $insert->execute([
            'product_id' => $product_id,
            'kit_id' => $kit_id,
            'sort_order' => ($index + 1) * 10,
        ]);
    }
}

function raidlands_kits_queue_permission_publish(PDO $pdo, int $kit_revision): int
{
    $permissions_path = __DIR__ . '/permissions.php';

    if (!is_file($permissions_path)) {
        return 0;
    }

    require_once $permissions_path;

    if (
        !function_exists('raidlands_permissions_is_ready')
        || !function_exists('raidlands_permissions_next_revision')
        || !function_exists('raidlands_permissions_sync_payload')
        || !raidlands_permissions_is_ready()
    ) {
        return 0;
    }

    $revision = raidlands_permissions_next_revision($pdo);

    raidlands_db_execute(
        'UPDATE oxide_groups
         SET published_revision = :revision, published_at = NOW(), updated_at = NOW()
         WHERE is_managed = 1 AND is_active = 1 AND is_read_only = 0',
        ['revision' => $revision]
    );

    $payload = raidlands_permissions_sync_payload($revision);
    $payload_json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $hash = hash('sha256', $payload_json ?: '');

    raidlands_db_execute(
        'INSERT INTO oxide_permission_sync_log (revision, status, payload_json, payload_hash, message)
         VALUES (:revision, "pending", :payload_json, :payload_hash, :message)',
        [
            'revision' => $revision,
            'payload_json' => $payload_json,
            'payload_hash' => $hash,
            'message' => 'Published automatically from admin kit editor revision ' . $kit_revision . '.',
        ]
    );

    return $revision;
}

function raidlands_kits_admin_save(array $post, array $files = []): array
{
    if (!raidlands_kits_is_ready()) {
        throw new RuntimeException(raidlands_kits_readiness_message(true));
    }

    raidlands_kits_assert_complete_admin_post($post);

    $pdo = raidlands_db_required();
    $publish = (string) ($post['kit_save_mode'] ?? 'draft') === 'publish';
    $revision = raidlands_kits_next_revision($pdo);
    $changed = 0;

    $pdo->beginTransaction();

    try {
        foreach ((array) ($post['kits'] ?? []) as $index => $row) {
            $row = is_array($row) ? $row : [];
            $id = (int) ($row['id'] ?? 0);
            $name = raidlands_kits_clean_text($row['kit_name'] ?? '', 160);

            if (!empty($row['delete']) && $id > 0) {
                $statement = $pdo->prepare(
                    'UPDATE game_kits
                     SET is_active = 0,
                         deleted_at = NOW(),
                         deleted_revision = :deleted_revision,
                         draft_revision = :draft_revision,
                         updated_at = NOW()
                     WHERE id = :id'
                );
                $statement->execute([
                    'deleted_revision' => $revision,
                    'draft_revision' => $revision,
                    'id' => $id,
                ]);
                $pdo->prepare('DELETE FROM game_kit_group_access WHERE kit_id = :id')->execute(['id' => $id]);
                $pdo->prepare('DELETE FROM store_product_kits WHERE kit_id = :id')->execute(['id' => $id]);
                $changed += 1;
                continue;
            }

            if ($name === '') {
                continue;
            }

            $groups = raidlands_kits_clean_groups((array) ($row['groups'] ?? []));
            $claim_permission = raidlands_kits_guided_claim_permission($name, $row['required_permission'] ?? '', $groups);

            $image_path = raidlands_kits_clean_image_path($row['image_path'] ?? '');
            $uploaded = raidlands_kits_store_uploaded_image(raidlands_kits_file_at_index($files, 'kit_images', (int) $index));

            if ($uploaded !== '') {
                $image_path = $uploaded;
            }

            $params = [
                'kit_name' => $name,
                'previous_kit_name' => raidlands_kits_clean_text($row['previous_kit_name'] ?? '', 160),
                'description' => raidlands_kits_clean_multiline($row['description'] ?? ''),
                'required_permission' => $claim_permission,
                'maximum_uses' => raidlands_kits_int($row['maximum_uses'] ?? 0, 0, 99999999),
                'required_auth' => raidlands_kits_int($row['required_auth'] ?? 0, 0, 2),
                'cooldown_seconds' => raidlands_kits_int($row['cooldown_seconds'] ?? 0, 0, 31536000),
                'cost' => raidlands_kits_int($row['cost'] ?? 0, 0, 99999999),
                'is_hidden' => empty($row['is_hidden']) ? 0 : 1,
                'copy_paste_file' => raidlands_kits_clean_text($row['copy_paste_file'] ?? '', 160),
                'image_path' => $image_path,
                'is_active' => empty($row['is_active']) ? 0 : 1,
                'sort_order' => raidlands_kits_int($row['sort_order'] ?? 100, 0, 9999),
                'reward_enabled' => empty($row['reward_enabled']) ? 0 : 1,
                'reward_product_id' => raidlands_kits_int($row['reward_product_id'] ?? -1, -1, 99999999),
                'reward_display_name' => raidlands_kits_clean_text($row['reward_display_name'] ?? '', 160),
                'reward_description' => raidlands_kits_clean_multiline($row['reward_description'] ?? ''),
                'reward_cost' => raidlands_kits_int($row['reward_cost'] ?? 0, 0, 99999999),
                'reward_cooldown' => raidlands_kits_int($row['reward_cooldown'] ?? 0, 0, 31536000),
                'reward_icon_url' => raidlands_kits_clean_image_path($row['reward_icon_url'] ?? ''),
                'reward_permission' => raidlands_kits_clean_permission($row['reward_permission'] ?? ''),
                'draft_revision' => $revision,
            ];

            if ($id > 0) {
                $params['id'] = $id;
                $statement = $pdo->prepare(
                    "UPDATE game_kits
                     SET kit_name = :kit_name,
                         previous_kit_name = :previous_kit_name,
                         description = :description,
                         required_permission = :required_permission,
                         maximum_uses = :maximum_uses,
                         required_auth = :required_auth,
                         cooldown_seconds = :cooldown_seconds,
                         cost = :cost,
                         is_hidden = :is_hidden,
                         copy_paste_file = :copy_paste_file,
                         image_path = :image_path,
                         is_active = :is_active,
                         sort_order = :sort_order,
                         reward_enabled = :reward_enabled,
                         reward_product_id = :reward_product_id,
                         reward_display_name = :reward_display_name,
                         reward_description = :reward_description,
                         reward_cost = :reward_cost,
                         reward_cooldown = :reward_cooldown,
                         reward_icon_url = :reward_icon_url,
                         reward_permission = :reward_permission,
                         draft_revision = :draft_revision,
                         deleted_at = NULL,
                         deleted_revision = 0,
                         updated_at = NOW()
                     WHERE id = :id"
                );
                $statement->execute($params);
                $kit_id = $id;
            } else {
                $statement = $pdo->prepare(
                    "INSERT INTO game_kits
                        (kit_name, previous_kit_name, description, required_permission, maximum_uses, required_auth, cooldown_seconds, cost, is_hidden, copy_paste_file, image_path, is_active, sort_order, reward_enabled, reward_product_id, reward_display_name, reward_description, reward_cost, reward_cooldown, reward_icon_url, reward_permission, draft_revision)
                     VALUES
                        (:kit_name, :previous_kit_name, :description, :required_permission, :maximum_uses, :required_auth, :cooldown_seconds, :cost, :is_hidden, :copy_paste_file, :image_path, :is_active, :sort_order, :reward_enabled, :reward_product_id, :reward_display_name, :reward_description, :reward_cost, :reward_cooldown, :reward_icon_url, :reward_permission, :draft_revision)
                     ON DUPLICATE KEY UPDATE
                        previous_kit_name = VALUES(previous_kit_name),
                        description = VALUES(description),
                        required_permission = VALUES(required_permission),
                        maximum_uses = VALUES(maximum_uses),
                        required_auth = VALUES(required_auth),
                        cooldown_seconds = VALUES(cooldown_seconds),
                        cost = VALUES(cost),
                        is_hidden = VALUES(is_hidden),
                        copy_paste_file = VALUES(copy_paste_file),
                        image_path = VALUES(image_path),
                        is_active = VALUES(is_active),
                        sort_order = VALUES(sort_order),
                        reward_enabled = VALUES(reward_enabled),
                        reward_product_id = VALUES(reward_product_id),
                        reward_display_name = VALUES(reward_display_name),
                        reward_description = VALUES(reward_description),
                        reward_cost = VALUES(reward_cost),
                        reward_cooldown = VALUES(reward_cooldown),
                        reward_icon_url = VALUES(reward_icon_url),
                        reward_permission = VALUES(reward_permission),
                        draft_revision = VALUES(draft_revision),
                        deleted_at = NULL,
                        deleted_revision = 0,
                        updated_at = NOW()"
                );
                $statement->execute($params);
                $kit_id = (int) ($pdo->lastInsertId() ?: 0);

                if ($kit_id === 0) {
                    $lookup = $pdo->prepare('SELECT id FROM game_kits WHERE kit_name = :kit_name');
                    $lookup->execute(['kit_name' => $name]);
                    $kit_id = (int) ($lookup->fetchColumn() ?: 0);
                }
            }

            if ($kit_id <= 0) {
                continue;
            }

            $item_rows = raidlands_kits_decode_admin_items_json($row['items_json'] ?? '')
                ?? (array) ($row['items'] ?? []);

            raidlands_kits_save_items($pdo, $kit_id, $item_rows);
            raidlands_kits_save_groups($pdo, $kit_id, $groups);
            raidlands_kits_save_product_links($pdo, $kit_id, (array) ($row['store_product_ids'] ?? []));

            $changed += 1;
        }

        if ($publish) {
            $statement = $pdo->prepare('UPDATE game_kits SET published_revision = :revision, published_at = NOW(), updated_at = NOW()');
            $statement->execute(['revision' => $revision]);
        }

        $hash = '';
        $payload_json = null;

        if ($publish) {
            $payload = raidlands_kits_sync_payload($revision);
            $payload_json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $hash = hash('sha256', $payload_json ?: '');
        }

        $log = $pdo->prepare(
            'INSERT INTO game_kit_sync_log (revision, status, payload_json, payload_hash, message)
             VALUES (:revision, :status, :payload_json, :payload_hash, :message)'
        );
        $log->execute([
            'revision' => $revision,
            'status' => $publish ? 'pending' : 'draft',
            'payload_json' => $payload_json,
            'payload_hash' => $hash,
            'message' => $publish ? 'Published from admin kit editor.' : 'Draft saved from admin kit editor.',
        ]);

        $permission_revision = $publish ? raidlands_kits_queue_permission_publish($pdo, $revision) : 0;

        $pdo->commit();

        return [
            'changed' => $changed,
            'revision' => $revision,
            'permission_revision' => $permission_revision,
            'published' => $publish,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_kits_item_to_rust(array $item): array
{
    $contents = $item['contents_json'] !== null && $item['contents_json'] !== ''
        ? json_decode((string) $item['contents_json'], true)
        : null;
    $container = $item['container_json'] !== null && $item['container_json'] !== ''
        ? json_decode((string) $item['container_json'], true)
        : null;

    return [
        'Shortname' => (string) $item['shortname'],
        'DisplayName' => $item['display_name'] === null ? null : (string) $item['display_name'],
        'Skin' => (int) $item['skin'],
        'Amount' => (int) $item['amount'],
        'Condition' => (float) $item['condition_value'],
        'MaxCondition' => (float) $item['max_condition'],
        'Ammo' => (int) $item['ammo'],
        'Ammotype' => $item['ammo_type'] === null ? null : (string) $item['ammo_type'],
        'Position' => (int) $item['position'],
        'Frequency' => (int) $item['frequency'],
        'BlueprintShortname' => $item['blueprint_shortname'] === null ? null : (string) $item['blueprint_shortname'],
        'Text' => $item['text_value'] === null ? null : (string) $item['text_value'],
        'Contents' => $contents,
        'Container' => $container,
    ];
}

function raidlands_kits_sync_payload(?int $revision = null): array
{
    $kits = raidlands_kits_fetch_all(false, true);
    $revision = $revision ?? raidlands_kits_latest_published_revision();
    $payload_kits = [];
    $reward_kits = [];
    $group_access = [];

    foreach ($kits as $kit) {
        $items = [
            'MainItems' => [],
            'WearItems' => [],
            'BeltItems' => [],
        ];

        foreach (['main' => 'MainItems', 'wear' => 'WearItems', 'belt' => 'BeltItems'] as $container => $target) {
            foreach ((array) ($kit['items'][$container] ?? []) as $item) {
                $items[$target][] = raidlands_kits_item_to_rust($item);
            }
        }

        $payload_kits[] = array_merge([
            'Name' => (string) $kit['kit_name'],
            'PreviousName' => (string) ($kit['previous_kit_name'] ?? ''),
            'Description' => (string) ($kit['description'] ?? ''),
            'RequiredPermission' => (string) $kit['required_permission'],
            'MaximumUses' => (int) $kit['maximum_uses'],
            'RequiredAuth' => (int) $kit['required_auth'],
            'Cooldown' => (int) $kit['cooldown_seconds'],
            'Cost' => (int) $kit['cost'],
            'IsHidden' => !empty($kit['is_hidden']),
            'CopyPasteFile' => (string) $kit['copy_paste_file'],
            'KitImage' => (string) $kit['image_path'],
            'IsActive' => !empty($kit['is_active']),
        ], $items);

        if (!empty($kit['reward_enabled']) && !empty($kit['is_active'])) {
            $reward_kits[] = [
                'KitName' => (string) $kit['kit_name'],
                'Description' => (string) ($kit['reward_description'] ?: $kit['description'] ?: ''),
                'ID' => (int) $kit['reward_product_id'],
                'DisplayName' => (string) ($kit['reward_display_name'] ?: $kit['kit_name']),
                'Cost' => (int) $kit['reward_cost'],
                'Cooldown' => (int) $kit['reward_cooldown'],
                'IconURL' => (string) ($kit['reward_icon_url'] ?: $kit['image_path']),
                'Permission' => (string) $kit['reward_permission'],
            ];
        }

        $permission = (string) $kit['required_permission'];

        if ($permission !== '' && !empty($kit['is_active']) && empty($kit['deleted_at'])) {
            foreach ((array) ($kit['groups'] ?? []) as $group) {
                $group = raidlands_kits_clean_group($group);

                if ($group === '') {
                    continue;
                }

                $group_access[$group][] = $permission;
            }
        }
    }

    foreach ($group_access as $group => $permissions) {
        $group_access[$group] = array_values(array_unique($permissions));
        sort($group_access[$group], SORT_NATURAL | SORT_FLAG_CASE);
    }

    ksort($group_access, SORT_NATURAL | SORT_FLAG_CASE);

    return [
        'revision' => $revision,
        'generated_at' => gmdate('c'),
        'kits' => $payload_kits,
        'server_rewards_kits' => $reward_kits,
        'group_access' => (object) $group_access,
    ];
}

function raidlands_kits_latest_published_revision(): int
{
    if (!raidlands_kits_is_ready()) {
        return 0;
    }

    $row = raidlands_db_fetch_one(
        "SELECT COALESCE(MAX(revision), 0) AS revision
         FROM game_kit_sync_log
         WHERE status IN ('pending', 'applied', 'failed')"
    );

    return (int) ($row['revision'] ?? 0);
}

function raidlands_kits_published_payload(int $revision): ?array
{
    if ($revision <= 0) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        "SELECT payload_json
         FROM game_kit_sync_log
         WHERE revision = :revision
           AND status IN ('pending', 'applied', 'failed')
         ORDER BY id DESC
         LIMIT 1",
        ['revision' => $revision]
    );

    if ($row === null) {
        return null;
    }

    $payload_json = trim((string) ($row['payload_json'] ?? ''));

    if ($payload_json === '') {
        return raidlands_kits_sync_payload($revision);
    }

    $payload = json_decode($payload_json, true);

    return is_array($payload) ? $payload : null;
}

function raidlands_kits_pending_sync(int $since): array
{
    if (!raidlands_kits_is_ready()) {
        throw new RuntimeException(raidlands_kits_readiness_message(true));
    }

    $revision = raidlands_kits_latest_published_revision();

    if ($revision <= max(0, $since)) {
        return [
            'revision' => $revision,
            'has_update' => false,
            'kits' => [],
            'server_rewards_kits' => [],
            'group_access' => (object) [],
        ];
    }

    $payload = raidlands_kits_published_payload($revision);

    if ($payload === null) {
        return [
            'revision' => 0,
            'has_update' => false,
            'kits' => [],
            'server_rewards_kits' => [],
            'group_access' => (object) [],
        ];
    }

    $payload['revision'] = $revision;
    $payload['has_update'] = true;
    $payload['group_access'] = (object) ($payload['group_access'] ?? []);

    return $payload;
}

function raidlands_kits_insert_item_from_payload(PDO $pdo, int $kit_id, string $container, array $items): void
{
    $rows = [];

    foreach ($items as $index => $item) {
        if (!is_array($item)) {
            continue;
        }

        $rows[$container][$index] = [
            'shortname' => $item['Shortname'] ?? $item['shortname'] ?? '',
            'display_name' => $item['DisplayName'] ?? $item['display_name'] ?? '',
            'skin' => $item['Skin'] ?? $item['SkinID'] ?? $item['skin'] ?? 0,
            'amount' => $item['Amount'] ?? $item['amount'] ?? 1,
            'condition' => $item['Condition'] ?? $item['condition'] ?? 0,
            'max_condition' => $item['MaxCondition'] ?? $item['max_condition'] ?? 0,
            'ammo' => $item['Ammo'] ?? $item['ammo'] ?? 0,
            'ammo_type' => $item['Ammotype'] ?? $item['AmmoType'] ?? $item['ammo_type'] ?? '',
            'position' => $item['Position'] ?? $item['position'] ?? $index,
            'frequency' => $item['Frequency'] ?? $item['frequency'] ?? -1,
            'blueprint_shortname' => $item['BlueprintShortname'] ?? $item['blueprint_shortname'] ?? '',
            'text' => $item['Text'] ?? $item['text'] ?? '',
            'contents_json' => !empty($item['Contents']) ? json_encode($item['Contents'], JSON_UNESCAPED_SLASHES) : '',
            'container_json' => !empty($item['Container']) ? json_encode($item['Container'], JSON_UNESCAPED_SLASHES) : '',
            'sort_order' => $index * 10,
        ];
    }

    raidlands_kits_save_items($pdo, $kit_id, $rows);
}

function raidlands_kits_import_snapshot(array $payload): array
{
    if (!raidlands_kits_is_ready()) {
        throw new RuntimeException(raidlands_kits_readiness_message(true));
    }

    $kits_object = $payload['kits_data']['_kits']
        ?? $payload['kits']['_kits']
        ?? $payload['_kits']
        ?? [];

    if (is_object($kits_object)) {
        $kits_object = (array) $kits_object;
    }

    if (!is_array($kits_object)) {
        throw new InvalidArgumentException('Kit snapshot did not include Kits/kits_data content.');
    }

    $reward_kits = $payload['server_rewards']['Kits']
        ?? $payload['server_rewards_kits']
        ?? [];
    $group_access = $payload['groups'] ?? $payload['group_access'] ?? [];

    $pdo = raidlands_db_required();
    $revision = raidlands_kits_next_revision($pdo);
    $imported = 0;

    $pdo->beginTransaction();

    try {
        foreach ($kits_object as $kit_name => $kit) {
            $kit = is_array($kit) ? $kit : (array) $kit;
            $name = raidlands_kits_clean_text($kit['Name'] ?? $kit_name, 160);

            if ($name === '') {
                continue;
            }

            $existing = raidlands_db_fetch_one(
                'SELECT id, deleted_at FROM game_kits WHERE kit_name = :kit_name',
                ['kit_name' => $name]
            );

            if ($existing !== null && trim((string) ($existing['deleted_at'] ?? '')) !== '') {
                continue;
            }

            $params = [
                'kit_name' => $name,
                'description' => raidlands_kits_clean_multiline($kit['Description'] ?? ''),
                'required_permission' => raidlands_kits_clean_permission($kit['RequiredPermission'] ?? ''),
                'maximum_uses' => raidlands_kits_int($kit['MaximumUses'] ?? 0, 0, 99999999),
                'required_auth' => raidlands_kits_int($kit['RequiredAuth'] ?? 0, 0, 2),
                'cooldown_seconds' => raidlands_kits_int($kit['Cooldown'] ?? 0, 0, 31536000),
                'cost' => raidlands_kits_int($kit['Cost'] ?? 0, 0, 99999999),
                'is_hidden' => empty($kit['IsHidden']) ? 0 : 1,
                'copy_paste_file' => raidlands_kits_clean_text($kit['CopyPasteFile'] ?? '', 160),
                'image_path' => raidlands_kits_clean_image_path($kit['KitImage'] ?? ''),
                'draft_revision' => $revision,
            ];

            $statement = $pdo->prepare(
                "INSERT INTO game_kits
                    (kit_name, description, required_permission, maximum_uses, required_auth, cooldown_seconds, cost, is_hidden, copy_paste_file, image_path, is_active, draft_revision)
                 VALUES
                    (:kit_name, :description, :required_permission, :maximum_uses, :required_auth, :cooldown_seconds, :cost, :is_hidden, :copy_paste_file, :image_path, 1, :draft_revision)
                 ON DUPLICATE KEY UPDATE
                    description = VALUES(description),
                    required_permission = VALUES(required_permission),
                    maximum_uses = VALUES(maximum_uses),
                    required_auth = VALUES(required_auth),
                    cooldown_seconds = VALUES(cooldown_seconds),
                    cost = VALUES(cost),
                    is_hidden = VALUES(is_hidden),
                    copy_paste_file = VALUES(copy_paste_file),
                    image_path = VALUES(image_path),
                    is_active = 1,
                    deleted_at = NULL,
                    deleted_revision = 0,
                    draft_revision = VALUES(draft_revision),
                    updated_at = NOW()"
            );
            $statement->execute($params);

            $lookup = $pdo->prepare('SELECT id FROM game_kits WHERE kit_name = :kit_name');
            $lookup->execute(['kit_name' => $name]);
            $kit_id = (int) ($lookup->fetchColumn() ?: 0);

            if ($kit_id <= 0) {
                continue;
            }

            raidlands_kits_save_items($pdo, $kit_id, [
                'main' => array_map(static fn ($item) => is_array($item) ? $item : (array) $item, (array) ($kit['MainItems'] ?? [])),
                'wear' => array_map(static fn ($item) => is_array($item) ? $item : (array) $item, (array) ($kit['WearItems'] ?? [])),
                'belt' => array_map(static fn ($item) => is_array($item) ? $item : (array) $item, (array) ($kit['BeltItems'] ?? [])),
            ]);

            $imported += 1;
        }

        foreach ((array) $reward_kits as $reward) {
            $reward = is_array($reward) ? $reward : (array) $reward;
            $kit_name = raidlands_kits_clean_text($reward['KitName'] ?? '', 160);

            if ($kit_name === '') {
                continue;
            }

            $statement = $pdo->prepare(
                "UPDATE game_kits
                 SET reward_enabled = 1,
                     reward_product_id = :reward_product_id,
                     reward_display_name = :reward_display_name,
                     reward_description = :reward_description,
                     reward_cost = :reward_cost,
                     reward_cooldown = :reward_cooldown,
                     reward_icon_url = :reward_icon_url,
                     reward_permission = :reward_permission,
                     updated_at = NOW()
                 WHERE kit_name = :kit_name"
            );
            $statement->execute([
                'kit_name' => $kit_name,
                'reward_product_id' => raidlands_kits_int($reward['ID'] ?? -1, -1, 99999999),
                'reward_display_name' => raidlands_kits_clean_text($reward['DisplayName'] ?? '', 160),
                'reward_description' => raidlands_kits_clean_multiline($reward['Description'] ?? ''),
                'reward_cost' => raidlands_kits_int($reward['Cost'] ?? 0, 0, 99999999),
                'reward_cooldown' => raidlands_kits_int($reward['Cooldown'] ?? 0, 0, 31536000),
                'reward_icon_url' => raidlands_kits_clean_image_path($reward['IconURL'] ?? ''),
                'reward_permission' => raidlands_kits_clean_permission($reward['Permission'] ?? ''),
            ]);
        }

        if (is_array($group_access)) {
            $groups_by_kit = [];

            foreach ($group_access as $group => $permissions) {
                $group = raidlands_kits_clean_group($group);

                if ($group === '') {
                    continue;
                }

                foreach ((array) $permissions as $permission) {
                    $permission = raidlands_kits_clean_permission($permission);
                    $lookup = $pdo->prepare('SELECT id FROM game_kits WHERE required_permission = :permission LIMIT 1');
                    $lookup->execute(['permission' => $permission]);
                    $kit_id = (int) ($lookup->fetchColumn() ?: 0);

                    if ($kit_id > 0) {
                        $groups_by_kit[$kit_id][] = $group;
                    }
                }
            }

            foreach ($groups_by_kit as $kit_id => $groups) {
                raidlands_kits_save_groups($pdo, (int) $kit_id, $groups);
            }
        }

        $pdo->prepare(
            'INSERT INTO game_kit_sync_log (revision, status, message)
             VALUES (:revision, "snapshot", :message)'
        )->execute([
            'revision' => $revision,
            'message' => 'Imported kit snapshot from Rust server.',
        ]);

        $pdo->commit();

        return [
            'imported' => $imported,
            'revision' => $revision,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_kits_record_sync_result(array $payload): void
{
    if (!raidlands_kits_is_ready()) {
        throw new RuntimeException(raidlands_kits_readiness_message(true));
    }

    $revision = max(0, (int) ($payload['revision'] ?? 0));
    $status = strtolower((string) ($payload['status'] ?? ''));

    if (!in_array($status, ['applied', 'failed'], true)) {
        $status = !empty($payload['ok']) ? 'applied' : 'failed';
    }

    $message = raidlands_kits_clean_text($payload['message'] ?? '', 500);
    $error = raidlands_kits_clean_multiline($payload['error'] ?? $payload['error_text'] ?? '', 3000);
    $hash = raidlands_kits_clean_text($payload['payload_hash'] ?? '', 64);
    $pdo = raidlands_db_required();

    $statement = $pdo->prepare(
        "UPDATE game_kit_sync_log
         SET status = :status,
             payload_hash = COALESCE(NULLIF(:payload_hash, ''), payload_hash),
             message = :message,
             error_text = :error_text,
             applied_at = CASE WHEN :applied = 1 THEN NOW() ELSE applied_at END,
             updated_at = NOW()
         WHERE revision = :revision AND status = 'pending'"
    );
    $statement->execute([
        'revision' => $revision,
        'status' => $status,
        'applied' => $status === 'applied' ? 1 : 0,
        'payload_hash' => $hash,
        'message' => $message,
        'error_text' => $error,
    ]);

    if ($statement->rowCount() === 0) {
        $insert = $pdo->prepare(
            "INSERT INTO game_kit_sync_log (revision, status, payload_hash, message, error_text, applied_at)
             VALUES (:revision, :status, :payload_hash, :message, :error_text, CASE WHEN :applied = 1 THEN NOW() ELSE NULL END)"
        );
        $insert->execute([
            'revision' => $revision,
            'status' => $status,
            'applied' => $status === 'applied' ? 1 : 0,
            'payload_hash' => $hash,
            'message' => $message,
            'error_text' => $error,
        ]);
    }
}

function raidlands_kits_recent_sync_rows(int $limit = 20): array
{
    if (!raidlands_kits_is_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        'SELECT * FROM game_kit_sync_log ORDER BY updated_at DESC, id DESC LIMIT ' . max(1, min(100, $limit))
    );
}

function raidlands_kits_for_products(array $product_ids): array
{
    if (!raidlands_kits_is_ready()) {
        return [];
    }

    $product_ids = array_values(array_unique(array_filter(array_map('intval', $product_ids))));

    if ($product_ids === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($product_ids), '?'));
    $rows = raidlands_db_fetch_all(
        "SELECT spk.product_id, gk.*
         FROM store_product_kits spk
         INNER JOIN game_kits gk ON gk.id = spk.kit_id
         WHERE spk.product_id IN ($placeholders) AND gk.is_active = 1
         ORDER BY spk.product_id ASC, spk.sort_order ASC, gk.sort_order ASC, gk.id ASC",
        $product_ids
    );

    $kit_ids = array_values(array_unique(array_map(static fn (array $row): int => (int) $row['id'], $rows)));
    $items_by_kit = [];

    if ($kit_ids !== []) {
        $kit_placeholders = implode(',', array_fill(0, count($kit_ids), '?'));
        $items = raidlands_db_fetch_all(
            "SELECT * FROM game_kit_items WHERE kit_id IN ($kit_placeholders) ORDER BY kit_id ASC, container_name ASC, position ASC, sort_order ASC",
            $kit_ids
        );

        foreach ($items as $item) {
            $items_by_kit[(int) $item['kit_id']][] = $item;
        }
    }

    $by_product = [];

    foreach ($rows as $row) {
        $product_id = (int) $row['product_id'];
        $kit_id = (int) $row['id'];
        $row['items_flat'] = $items_by_kit[$kit_id] ?? [];
        $by_product[$product_id][] = $row;
    }

    return $by_product;
}

function raidlands_kits_attach_to_products(array $products): array
{
    $product_ids = array_map(static fn (array $product): int => (int) ($product['id'] ?? 0), $products);
    $kits_by_product = raidlands_kits_for_products($product_ids);

    foreach ($products as &$product) {
        $product['linked_kits'] = $kits_by_product[(int) ($product['id'] ?? 0)] ?? [];
    }
    unset($product);

    return $products;
}

function raidlands_kits_item_summary(array $kit, int $limit = 5): array
{
    $items = [];

    foreach ((array) ($kit['items_flat'] ?? []) as $item) {
        $shortname = (string) ($item['shortname'] ?? '');

        if ($shortname === '') {
            continue;
        }

        $items[] = ((int) ($item['amount'] ?? 1)) . 'x ' . $shortname;

        if (count($items) >= $limit) {
            break;
        }
    }

    return $items;
}
