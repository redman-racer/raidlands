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
            ? 'Kit tables are not installed yet. Run database/migrations/006_game_kits.sql, database/migrations/014_kit_group_delete_tombstones.sql, then database/migrations/021_group_owned_kit_permissions.sql.'
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

function raidlands_kits_clean_claim_permission($value): string
{
    $permission = raidlands_kits_clean_permission($value);

    if ($permission === '') {
        return '';
    }

    if (!str_starts_with($permission, 'kits.')) {
        throw new InvalidArgumentException('Kit claim permissions must use the Kits plugin prefix, for example kits.raid.');
    }

    return $permission;
}

function raidlands_kits_clean_group_permission($value): string
{
    if (function_exists('raidlands_permissions_clean_permission')) {
        return raidlands_permissions_clean_permission($value);
    }

    $permission = strtolower(raidlands_kits_clean_text($value, 190));

    if ($permission === '') {
        return '';
    }

    if (!preg_match('/^[a-z0-9_.-]+$/', $permission) || !str_contains($permission, '.')) {
        throw new InvalidArgumentException('Permissions must use lowercase plugin.permission format.');
    }

    return $permission;
}

function raidlands_kits_permission_suffix(string $permission): string
{
    $permission = raidlands_kits_clean_claim_permission($permission);

    if ($permission === '') {
        return '';
    }

    return str_starts_with($permission, 'kits.') ? substr($permission, 5) : $permission;
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

function raidlands_kits_name_list($value): array
{
    $chunks = preg_split('/[,;\r\n]+/', (string) $value) ?: [];
    $names = [];
    $seen = [];

    foreach ($chunks as $chunk) {
        $name = raidlands_kits_clean_text($chunk, 160);

        if ($name === '') {
            continue;
        }

        $key = strtolower($name);

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $names[] = $name;
    }

    return $names;
}

function raidlands_kits_same_name(string $left, string $right): bool
{
    return strcasecmp(trim($left), trim($right)) === 0;
}

function raidlands_kits_lookup_admin_row(PDO $pdo, int $id): ?array
{
    if ($id <= 0) {
        return null;
    }

    $statement = $pdo->prepare('SELECT id, kit_name, previous_kit_name FROM game_kits WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function raidlands_kits_lookup_rename_row(PDO $pdo, array $candidate_names, string $new_name): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, kit_name, previous_kit_name
         FROM game_kits
         WHERE kit_name = :kit_name
           AND deleted_at IS NULL
         LIMIT 1'
    );

    foreach ($candidate_names as $candidate) {
        $candidate = raidlands_kits_clean_text($candidate, 160);

        if ($candidate === '' || raidlands_kits_same_name($candidate, $new_name)) {
            continue;
        }

        $statement->execute(['kit_name' => $candidate]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (is_array($row)) {
            return $row;
        }
    }

    return null;
}

function raidlands_kits_previous_names_for_save(string $new_name, array $submitted_previous_names, ?array $existing_row): array
{
    $names = [];

    if ($existing_row !== null) {
        $existing_name = raidlands_kits_clean_text($existing_row['kit_name'] ?? '', 160);

        if ($existing_name !== '' && !raidlands_kits_same_name($existing_name, $new_name)) {
            $names[] = $existing_name;
        }
    }

    foreach ($submitted_previous_names as $name) {
        $names[] = $name;
    }

    $clean = [];
    $seen = [];

    foreach ($names as $name) {
        $name = raidlands_kits_clean_text($name, 160);

        if ($name === '' || raidlands_kits_same_name($name, $new_name)) {
            continue;
        }

        $key = strtolower($name);

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $clean[] = $name;
    }

    return $clean;
}

function raidlands_kits_required_claim_permission(string $kit_name, $permission, bool $active): string
{
    $claim_permission = raidlands_kits_clean_claim_permission($permission);

    if ($claim_permission !== '' || !$active) {
        return $claim_permission;
    }

    throw new InvalidArgumentException('Active kit "' . $kit_name . '" needs a Kits plugin permission. Enter the suffix after kits. before saving.');
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

function raidlands_kits_canonical_image_path(string $kit_name, string $permission = ''): string
{
    $kit_key = strtolower(raidlands_kits_clean_text($kit_name, 160));
    $permission_key = raidlands_kits_clean_claim_permission($permission);
    $by_name = [
        'starter kit' => '/assets/media/kits/starter-kit.webp',
        'autokit' => '/assets/media/kits/autokit.webp',
        'raidlands_pvp_light' => '/assets/media/kits/pvp-light-kit.webp',
        'pvp_light' => '/assets/media/kits/pvp-light-kit.webp',
        'raidlands_pvp_rifle' => '/assets/media/kits/pvp-rifle-kit.webp',
        'pvp_rifle' => '/assets/media/kits/pvp-rifle-kit.webp',
        'raidlands_pvp_roamer' => '/assets/media/kits/pvp-roamer-kit.webp',
        'pvp_roamer' => '/assets/media/kits/pvp-roamer-kit.webp',
        'raidlands_pvp_heavy' => '/assets/media/kits/pvp-heavy-kit.webp',
        'pvp_heavy' => '/assets/media/kits/pvp-heavy-kit.webp',
        'raidlands_pvp_elite' => '/assets/media/kits/pvp-elite-kit.webp',
        'pvp_elite' => '/assets/media/kits/pvp-elite-kit.webp',
        'raidlands_pvp_breach' => '/assets/media/kits/pvp-breach-kit.webp',
        'pvp_breach' => '/assets/media/kits/pvp-breach-kit.webp',
        'vip' => '/assets/media/kits/vip-kit.webp',
        'kit_vip' => '/assets/media/kits/vip-kit.webp',
        'diamond' => '/assets/media/kits/vip-diamond-kit.webp',
        'kit_vip_diamond' => '/assets/media/kits/vip-diamond-kit.webp',
        'vip_plus' => '/assets/media/kits/vip-plus-kit.webp',
        'kit_vip_plus' => '/assets/media/kits/vip-plus-kit.webp',
        'kit_vip_plus_diamond' => '/assets/media/kits/vip-plus-diamond-kit.webp',
        'mvp' => '/assets/media/kits/mvp-kit.webp',
        'kit_mvp' => '/assets/media/kits/mvp-kit.webp',
        'golden' => '/assets/media/kits/golden-vip-kit.webp',
        'kit_golden_vip' => '/assets/media/kits/golden-vip-kit.webp',
        'ultimate' => '/assets/media/kits/ultimate-vip-kit.webp',
        'kit_ultimate_vip' => '/assets/media/kits/ultimate-vip-kit.webp',
        'titan' => '/assets/media/kits/titan-vip-kit.webp',
        'kit_titan_vip' => '/assets/media/kits/titan-vip-kit.webp',
        'sentry' => '/assets/media/kits/sentry-small-pack.webp',
        'pack_sentry_small' => '/assets/media/kits/sentry-small-pack.webp',
        'sentry_large' => '/assets/media/kits/sentry-large-pack.webp',
        'pack_sentry_large' => '/assets/media/kits/sentry-large-pack.webp',
        'portafort' => '/assets/media/kits/portafort-token.webp',
        'vehicles' => '/assets/media/kits/vehicle-pack.webp',
        'pack_vehicle' => '/assets/media/kits/vehicle-pack.webp',
        'steam_name_rewards' => '/assets/media/kits/steam-name-rewards-kit.webp',
        'kit_claim_steam_name_rewards' => '/assets/media/kits/steam-name-rewards-kit.webp',
        'steam' => '/assets/media/kits/steam-rewards-kit.webp',
        'kit_claim_steam_rewards' => '/assets/media/kits/steam-rewards-kit.webp',
        'discord_booster' => '/assets/media/kits/discord-booster-kit.webp',
        'kit_claim_discord_booster' => '/assets/media/kits/discord-booster-kit.webp',
        'discord_raid' => '/assets/media/kits/discord-raid-kit.webp',
        'kit_claim_discord_raid' => '/assets/media/kits/discord-raid-kit.webp',
        'discord' => '/assets/media/kits/discord-kit.webp',
        'kit_claim_discord' => '/assets/media/kits/discord-kit.webp',
        '556' => '/assets/media/kits/556-kit.webp',
        'kit_claim_556' => '/assets/media/kits/556-kit.webp',
        'cards' => '/assets/media/kits/cards-kit.webp',
        'kit_claim_cards' => '/assets/media/kits/cards-kit.webp',
        'scrap' => '/assets/media/kits/scrap-kit.webp',
        'kit_claim_scrap' => '/assets/media/kits/scrap-kit.webp',
        'scuba' => '/assets/media/kits/scuba-kit.webp',
        'kit_claim_scuba' => '/assets/media/kits/scuba-kit.webp',
        'components' => '/assets/media/kits/comps-kit.webp',
        'comps' => '/assets/media/kits/comps-kit.webp',
        'kit_claim_components' => '/assets/media/kits/comps-kit.webp',
        'build' => '/assets/media/kits/build-kit.webp',
        'build kit' => '/assets/media/kits/build-kit.webp',
        'kit_claim_build' => '/assets/media/kits/build-kit.webp',
        'raid' => '/assets/media/kits/raid-kit.webp',
        'raid kit' => '/assets/media/kits/raid-kit.webp',
        'kit_claim_raid' => '/assets/media/kits/raid-kit.webp',
        'medical' => '/assets/media/kits/medical-kit.webp',
        'kit_claim_medical' => '/assets/media/kits/medical-kit.webp',
        'mp5' => '/assets/media/kits/mp5-kit.webp',
        'kit_claim_mp5' => '/assets/media/kits/mp5-kit.webp',
        'lr300' => '/assets/media/kits/lr300-kit.webp',
        'kit_claim_lr300' => '/assets/media/kits/lr300-kit.webp',
        'm16' => '/assets/media/kits/m16a2-kit.webp',
        'kit_claim_m16a2' => '/assets/media/kits/m16a2-kit.webp',
        'ak' => '/assets/media/kits/ak-kit.webp',
        'kit_claim_ak' => '/assets/media/kits/ak-kit.webp',
    ];
    $by_permission = [
        'kits.autokit' => '/assets/media/kits/autokit.webp',
        'kits.pvp.light' => '/assets/media/kits/pvp-light-kit.webp',
        'kits.pvp.rifle' => '/assets/media/kits/pvp-rifle-kit.webp',
        'kits.pvp.roamer' => '/assets/media/kits/pvp-roamer-kit.webp',
        'kits.pvp.heavy' => '/assets/media/kits/pvp-heavy-kit.webp',
        'kits.pvp.elite' => '/assets/media/kits/pvp-elite-kit.webp',
        'kits.pvp.breach' => '/assets/media/kits/pvp-breach-kit.webp',
        'kits.vip' => '/assets/media/kits/vip-kit.webp',
        'kits.vip.diamond' => '/assets/media/kits/vip-diamond-kit.webp',
        'kits.vipplus' => '/assets/media/kits/vip-plus-kit.webp',
        'kits.vipplus.diamond' => '/assets/media/kits/vip-plus-diamond-kit.webp',
        'kits.mvp' => '/assets/media/kits/mvp-kit.webp',
        'kits.goldenvip' => '/assets/media/kits/golden-vip-kit.webp',
        'kits.ultimatevip' => '/assets/media/kits/ultimate-vip-kit.webp',
        'kits.titanvip' => '/assets/media/kits/titan-vip-kit.webp',
        'kits.sentry.small' => '/assets/media/kits/sentry-small-pack.webp',
        'kits.sentry.large' => '/assets/media/kits/sentry-large-pack.webp',
        'kits.portafort' => '/assets/media/kits/portafort-token.webp',
        'kits.vehicle' => '/assets/media/kits/vehicle-pack.webp',
        'kits.claim.steam_name_rewards' => '/assets/media/kits/steam-name-rewards-kit.webp',
        'kits.claim.steam_rewards' => '/assets/media/kits/steam-rewards-kit.webp',
        'kits.claim.discord_booster' => '/assets/media/kits/discord-booster-kit.webp',
        'kits.claim.discord_raid' => '/assets/media/kits/discord-raid-kit.webp',
        'kits.claim.discord' => '/assets/media/kits/discord-kit.webp',
        'kits.claim.556' => '/assets/media/kits/556-kit.webp',
        'kits.claim.cards' => '/assets/media/kits/cards-kit.webp',
        'kits.claim.scrap' => '/assets/media/kits/scrap-kit.webp',
        'kits.claim.scuba' => '/assets/media/kits/scuba-kit.webp',
        'kits.claim.components' => '/assets/media/kits/comps-kit.webp',
        'kits.comp' => '/assets/media/kits/comps-kit.webp',
        'kits.claim.build' => '/assets/media/kits/build-kit.webp',
        'kits.build' => '/assets/media/kits/build-kit.webp',
        'kits.claim.raid' => '/assets/media/kits/raid-kit.webp',
        'kits.raid' => '/assets/media/kits/raid-kit.webp',
        'kits.claim.medical' => '/assets/media/kits/medical-kit.webp',
        'kits.medical' => '/assets/media/kits/medical-kit.webp',
        'kits.claim.mp5' => '/assets/media/kits/mp5-kit.webp',
        'kits.claim.lr300' => '/assets/media/kits/lr300-kit.webp',
        'kits.claim.m16a2' => '/assets/media/kits/m16a2-kit.webp',
        'kits.claim.ak' => '/assets/media/kits/ak-kit.webp',
    ];

    if ($permission_key !== '' && isset($by_permission[$permission_key])) {
        return raidlands_kits_game_image_path($by_permission[$permission_key]);
    }

    return raidlands_kits_game_image_path($by_name[$kit_key] ?? '');
}

function raidlands_kits_game_image_path(string $path): string
{
    $path = trim($path);

    if (preg_match('~^(https?://[^?#]+/assets/media/kits/.+)\.webp([?#].*)?$~i', $path, $matches)) {
        return $matches[1] . '.png' . ($matches[2] ?? '');
    }

    if (preg_match('#^(/?assets/media/kits/.+)\.webp$#i', $path)) {
        return substr($path, 0, -5) . '.png';
    }

    return $path;
}

function raidlands_kits_sync_image_url(string $path): string
{
    $path = raidlands_kits_game_image_path($path);

    if ($path === '') {
        return '';
    }

    $url = filter_var($path, FILTER_VALIDATE_URL) !== false
        ? $path
        : raidlands_store_absolute_url(ltrim($path, '/'));
    $parts = parse_url($url);
    $host = strtolower((string) ($parts['host'] ?? ''));

    if (
        strtolower((string) ($parts['scheme'] ?? '')) === 'http'
        && !in_array($host, ['localhost', '127.0.0.1', '::1'], true)
    ) {
        $url = 'https://' . substr($url, strlen('http://'));
    }

    return raidlands_kits_game_image_path($url);
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
    $by_id = [];

    foreach ($kits as $index => $kit) {
        $kit['items'] = [
            'main' => [],
            'wear' => [],
            'belt' => [],
        ];
        $kit['permission_groups'] = [];
        $kit['derived_store_products'] = [];
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

    return $kits;
}

function raidlands_kits_effective_group_permission_map(): array
{
    if (!function_exists('raidlands_permissions_effective_desired_map')) {
        return [];
    }

    try {
        return raidlands_permissions_effective_desired_map();
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_kits_permission_metadata_map(): array
{
    if (!function_exists('raidlands_permissions_permission_metadata_map')) {
        return [];
    }

    try {
        return raidlands_permissions_permission_metadata_map();
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_kits_permissions_for_product(array $product, array $group_permissions): array
{
    $permissions = [];

    foreach (raidlands_store_clean_groups((array) ($product['fulfillment_groups'] ?? [$product['oxide_group'] ?? ''])) as $group) {
        foreach ((array) ($group_permissions[$group] ?? []) as $permission) {
            $permission = raidlands_kits_clean_group_permission($permission);

            if ($permission !== '') {
                $permissions[$permission] = $permission;
            }
        }
    }

    $permissions = array_values($permissions);
    sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);

    return $permissions;
}

function raidlands_kits_permission_report(array $permissions, array $metadata, int $limit = 8): array
{
    $reports = [];

    foreach ($permissions as $permission) {
        $permission = raidlands_kits_clean_group_permission($permission);

        if ($permission === '' || str_starts_with($permission, 'kits.')) {
            continue;
        }

        $meta = (array) ($metadata[$permission] ?? []);
        $plugin = trim((string) ($meta['plugin_name'] ?? ''));
        $label = $plugin !== '' ? $plugin . ': ' . $permission : $permission;
        $reports[$permission] = [
            'permission' => $permission,
            'label' => $label,
            'plugin_name' => $plugin,
        ];
    }

    uasort($reports, static function (array $left, array $right): int {
        return strnatcasecmp((string) $left['label'], (string) $right['label']);
    });

    return array_slice(array_values($reports), 0, $limit);
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

function raidlands_kits_attach_admin_usage(array $kits): array
{
    if ($kits === []) {
        return [];
    }

    $group_permissions = raidlands_kits_effective_group_permission_map();
    $groups_by_permission = [];

    foreach ($group_permissions as $group => $permissions) {
        $group = raidlands_kits_clean_group($group);

        if ($group === '') {
            continue;
        }

        foreach ((array) $permissions as $permission) {
            $permission = raidlands_kits_clean_group_permission($permission);

            if ($permission !== '' && str_starts_with($permission, 'kits.')) {
                $groups_by_permission[$permission][] = $group;
            }
        }
    }

    $products_by_permission = [];

    if (function_exists('raidlands_store_admin_product_rows')) {
        try {
            foreach (raidlands_store_admin_product_rows() as $product) {
                $product_permissions = raidlands_kits_permissions_for_product($product, $group_permissions);
                $product_groups = raidlands_store_clean_groups((array) ($product['fulfillment_groups'] ?? [$product['oxide_group'] ?? '']));

                foreach ($product_permissions as $permission) {
                    if (!str_starts_with($permission, 'kits.')) {
                        continue;
                    }

                    $products_by_permission[$permission][] = [
                        'id' => (int) ($product['id'] ?? 0),
                        'name' => (string) ($product['name'] ?? 'Store product'),
                        'slug' => (string) ($product['slug'] ?? ''),
                        'is_active' => !empty($product['is_active']),
                        'groups' => $product_groups,
                    ];
                }
            }
        } catch (Throwable $error) {
            $products_by_permission = [];
        }
    }

    foreach ($kits as &$kit) {
        $permission = raidlands_kits_clean_claim_permission($kit['required_permission'] ?? '');
        $groups = array_values(array_unique(array_map('strval', $groups_by_permission[$permission] ?? [])));
        sort($groups, SORT_NATURAL | SORT_FLAG_CASE);
        $kit['permission_groups'] = $groups;
        $kit['derived_store_products'] = $products_by_permission[$permission] ?? [];
    }
    unset($kit);

    return $kits;
}

function raidlands_kits_admin_rows(): array
{
    return raidlands_kits_attach_admin_usage(raidlands_kits_fetch_all(false));
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

function raidlands_kits_register_claim_permission(PDO $pdo, string $permission): void
{
    $permission = raidlands_kits_clean_claim_permission($permission);

    if ($permission === '' || !raidlands_kits_table_exists('oxide_permissions')) {
        return;
    }

    $prefix = explode('.', $permission, 2)[0] ?? 'kits';
    $statement = $pdo->prepare(
        'INSERT INTO oxide_permissions
            (permission_name, plugin_name, permission_prefix, source, is_active, last_seen_at)
         VALUES
            (:permission_name, "Kits", :permission_prefix, "kit", 1, NOW())
         ON DUPLICATE KEY UPDATE
            plugin_name = IF(plugin_name = "" OR plugin_name = "fallback", VALUES(plugin_name), plugin_name),
            permission_prefix = IF(permission_prefix = "", VALUES(permission_prefix), permission_prefix),
            is_active = 1,
            updated_at = NOW()'
    );
    $statement->execute([
        'permission_name' => $permission,
        'permission_prefix' => $prefix,
    ]);
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
            $submitted_previous_names = raidlands_kits_name_list($row['previous_kit_name'] ?? '');
            $original_name = raidlands_kits_clean_text($row['original_kit_name'] ?? '', 160);
            $existing_row = raidlands_kits_lookup_admin_row($pdo, $id);

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

                foreach (['game_kit_group_access', 'store_product_kits'] as $legacy_table) {
                    if (raidlands_kits_table_exists($legacy_table)) {
                        raidlands_db_execute(
                            'DELETE FROM ' . $legacy_table . ' WHERE kit_id = :id',
                            ['id' => $id]
                        );
                    }
                }

                $changed += 1;
                continue;
            }

            if ($name === '') {
                continue;
            }

            if ($existing_row === null) {
                $existing_row = raidlands_kits_lookup_rename_row(
                    $pdo,
                    array_merge([$original_name], $submitted_previous_names),
                    $name
                );

                if ($existing_row !== null) {
                    $id = (int) ($existing_row['id'] ?? 0);
                }
            }

            $previous_names = raidlands_kits_previous_names_for_save($name, $submitted_previous_names, $existing_row);

            $is_active = empty($row['is_active']) ? 0 : 1;
            $claim_permission = raidlands_kits_required_claim_permission($name, $row['required_permission'] ?? '', $is_active === 1);

            $image_path = raidlands_kits_clean_image_path($row['image_path'] ?? '');
            $uploaded = raidlands_kits_store_uploaded_image(raidlands_kits_file_at_index($files, 'kit_images', (int) $index));

            if ($uploaded !== '') {
                $image_path = $uploaded;
            }

            $params = [
                'kit_name' => $name,
                'previous_kit_name' => raidlands_kits_clean_text(implode(', ', $previous_names), 160),
                'description' => raidlands_kits_clean_multiline($row['description'] ?? ''),
                'required_permission' => $claim_permission,
                'maximum_uses' => raidlands_kits_int($row['maximum_uses'] ?? 0, 0, 99999999),
                'required_auth' => raidlands_kits_int($row['required_auth'] ?? 0, 0, 2),
                'cooldown_seconds' => raidlands_kits_int($row['cooldown_seconds'] ?? 0, 0, 31536000),
                'cost' => raidlands_kits_int($row['cost'] ?? 0, 0, 99999999),
                'is_hidden' => empty($row['is_hidden']) ? 0 : 1,
                'copy_paste_file' => raidlands_kits_clean_text($row['copy_paste_file'] ?? '', 160),
                'image_path' => $image_path,
                'is_active' => $is_active,
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
            raidlands_kits_register_claim_permission($pdo, $claim_permission);

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

    foreach ($kits as $kit) {
        $previous_names = raidlands_kits_name_list($kit['previous_kit_name'] ?? '');
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
            'PreviousName' => (string) ($previous_names[0] ?? ''),
            'PreviousNames' => $previous_names,
            'Description' => (string) ($kit['description'] ?? ''),
            'RequiredPermission' => (string) $kit['required_permission'],
            'MaximumUses' => (int) $kit['maximum_uses'],
            'RequiredAuth' => (int) $kit['required_auth'],
            'Cooldown' => (int) $kit['cooldown_seconds'],
            'Cost' => (int) $kit['cost'],
            'IsHidden' => !empty($kit['is_hidden']),
            'CopyPasteFile' => (string) $kit['copy_paste_file'],
            'KitImage' => raidlands_kits_sync_image_url((string) $kit['image_path']),
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
                'IconURL' => raidlands_kits_sync_image_url((string) ($kit['reward_icon_url'] ?: $kit['image_path'])),
                'Permission' => (string) $kit['reward_permission'],
            ];
        }

    }

    return [
        'revision' => $revision,
        'generated_at' => gmdate('c'),
        'kits' => $payload_kits,
        'server_rewards_kits' => $reward_kits,
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
        ];
    }

    $payload = raidlands_kits_published_payload($revision);

    if ($payload === null) {
        return [
            'revision' => 0,
            'has_update' => false,
            'kits' => [],
            'server_rewards_kits' => [],
        ];
    }

    $payload['revision'] = $revision;
    $payload['has_update'] = true;

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
                'SELECT id, required_permission, deleted_at FROM game_kits WHERE kit_name = :kit_name',
                ['kit_name' => $name]
            );

            if ($existing !== null && trim((string) ($existing['deleted_at'] ?? '')) !== '') {
                continue;
            }

            $incoming_permission = raidlands_kits_clean_claim_permission($kit['RequiredPermission'] ?? '');

            if ($incoming_permission === '' && $existing !== null) {
                $incoming_permission = raidlands_kits_clean_claim_permission($existing['required_permission'] ?? '');
            }

            if ($incoming_permission === '') {
                $incoming_permission = raidlands_kits_permission_from_name($name);
            }

            $canonical_image_path = raidlands_kits_canonical_image_path($name, $incoming_permission);
            $params = [
                'kit_name' => $name,
                'description' => raidlands_kits_clean_multiline($kit['Description'] ?? ''),
                'required_permission' => $incoming_permission,
                'maximum_uses' => raidlands_kits_int($kit['MaximumUses'] ?? 0, 0, 99999999),
                'required_auth' => raidlands_kits_int($kit['RequiredAuth'] ?? 0, 0, 2),
                'cooldown_seconds' => raidlands_kits_int($kit['Cooldown'] ?? 0, 0, 31536000),
                'cost' => raidlands_kits_int($kit['Cost'] ?? 0, 0, 99999999),
                'is_hidden' => empty($kit['IsHidden']) ? 0 : 1,
                'copy_paste_file' => raidlands_kits_clean_text($kit['CopyPasteFile'] ?? '', 160),
                'image_path' => $canonical_image_path !== ''
                    ? $canonical_image_path
                    : raidlands_kits_clean_image_path($kit['KitImage'] ?? ''),
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
            raidlands_kits_register_claim_permission($pdo, $incoming_permission);

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

function raidlands_kits_active_by_permission(): array
{
    if (!raidlands_kits_is_ready()) {
        return [];
    }

    $by_permission = [];

    foreach (raidlands_kits_fetch_all(true) as $kit) {
        $permission = raidlands_kits_clean_claim_permission($kit['required_permission'] ?? '');

        if ($permission === '') {
            continue;
        }

        $items = [];
        foreach (['main', 'wear', 'belt'] as $container) {
            foreach ((array) ($kit['items'][$container] ?? []) as $item) {
                $items[] = $item;
            }
        }
        $kit['items_flat'] = $items;
        $by_permission[$permission] = $kit;
    }

    return $by_permission;
}

function raidlands_kits_attach_to_products(array $products): array
{
    $group_permissions = raidlands_kits_effective_group_permission_map();
    $kits_by_permission = raidlands_kits_active_by_permission();
    $permission_metadata = raidlands_kits_permission_metadata_map();

    foreach ($products as &$product) {
        $permissions = raidlands_kits_permissions_for_product($product, $group_permissions);
        $linked_kits = [];

        foreach ($permissions as $permission) {
            if (isset($kits_by_permission[$permission])) {
                $linked_kits[] = $kits_by_permission[$permission];
            }
        }

        usort($linked_kits, static function (array $left, array $right): int {
            $sort = ((int) ($left['sort_order'] ?? 100)) <=> ((int) ($right['sort_order'] ?? 100));

            return $sort !== 0 ? $sort : strnatcasecmp((string) ($left['kit_name'] ?? ''), (string) ($right['kit_name'] ?? ''));
        });

        $product['linked_kits'] = $linked_kits;
        $product['linked_perks'] = raidlands_kits_permission_report($permissions, $permission_metadata, 8);
        $product['derived_permissions'] = $permissions;
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
