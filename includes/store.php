<?php

require_once __DIR__ . '/database.php';

function raidlands_store_boot(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('raidlands_site');
        session_start();
    }
}

function raidlands_store_flash(?string $type = null, ?string $message = null): ?array
{
    raidlands_store_boot();

    if ($type !== null && $message !== null) {
        $_SESSION['raidlands_store_flash'] = [
            'type' => $type,
            'message' => $message,
        ];

        return null;
    }

    $flash = $_SESSION['raidlands_store_flash'] ?? null;
    unset($_SESSION['raidlands_store_flash']);

    return is_array($flash) ? $flash : null;
}

function raidlands_store_csrf_token(): string
{
    raidlands_store_boot();

    if (empty($_SESSION['raidlands_store_csrf'])) {
        $_SESSION['raidlands_store_csrf'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['raidlands_store_csrf'];
}

function raidlands_store_validate_csrf(string $token): bool
{
    raidlands_store_boot();

    return $token !== '' && hash_equals((string) ($_SESSION['raidlands_store_csrf'] ?? ''), $token);
}

function raidlands_store_redirect(string $path): void
{
    header('Location: ' . route_url($path), true, 303);
    exit;
}

function raidlands_store_absolute_url(string $path = ''): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $script_dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')));
    $root = preg_replace('#/(admin|api(?:/.*)?|api-docs|bans|clans|discord|events|features|leaderboard|link|play|privacy|profile|rules|store|support|terms|vote)$#', '', rtrim($script_dir, '/')) ?? '';
    $root = $root === '/' ? '' : $root;

    return $scheme . '://' . $host . $root . '/' . ltrim($path, '/');
}

function raidlands_store_validate_steam_id64(string $steam_id64): bool
{
    return preg_match('/^7656119[0-9]{10}$/', $steam_id64) === 1;
}

function raidlands_store_clean_group($value): string
{
    $group = strtolower(trim(str_replace("\0", '', (string) $value)));
    $group = strip_tags($group);

    if (function_exists('mb_substr')) {
        $group = mb_substr($group, 0, 120);
    } else {
        $group = substr($group, 0, 120);
    }

    return preg_match('/^[a-z0-9_-]+$/', $group) === 1 ? $group : '';
}

function raidlands_store_group_rule_hint(): string
{
    return 'Use lowercase letters, numbers, underscores, or dashes.';
}

function raidlands_store_clean_groups($values): array
{
    if (!is_array($values)) {
        $values = preg_split('/[\s,]+/', (string) $values) ?: [];
    }

    $groups = [];
    $seen = [];

    foreach ($values as $value) {
        if (is_array($value)) {
            foreach (raidlands_store_clean_groups($value) as $nested_group) {
                if (!isset($seen[$nested_group])) {
                    $seen[$nested_group] = true;
                    $groups[] = $nested_group;
                }
            }

            continue;
        }

        $group = raidlands_store_clean_group($value);

        if ($group !== '' && !isset($seen[$group])) {
            $seen[$group] = true;
            $groups[] = $group;
        }
    }

    return $groups;
}

function raidlands_store_fulfillment_groups_for_products(array $product_ids): array
{
    if (!raidlands_db_is_configured()) {
        return [];
    }

    $product_ids = array_values(array_unique(array_filter(array_map('intval', $product_ids))));

    if ($product_ids === []) {
        return [];
    }

    [$placeholders, $params] = raidlands_store_sql_in_params($product_ids, 'product_id');

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT product_id, oxide_group
             FROM product_fulfillment_actions
             WHERE action_type = "grant_group"
               AND oxide_group <> ""
               AND product_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY product_id ASC, sort_order ASC, id ASC',
            $params
        );
    } catch (Throwable $error) {
        return [];
    }

    $by_product = [];

    foreach ($rows as $row) {
        $product_id = (int) ($row['product_id'] ?? 0);
        $group = raidlands_store_clean_group($row['oxide_group'] ?? '');

        if ($product_id > 0 && $group !== '') {
            $by_product[$product_id][] = $group;
        }
    }

    foreach ($by_product as &$groups) {
        $groups = array_values(array_unique($groups));
    }
    unset($groups);

    return $by_product;
}

function raidlands_store_effective_fulfillment_groups(int $product_id, $fallback_group = ''): array
{
    $groups_by_product = raidlands_store_fulfillment_groups_for_products([$product_id]);
    $groups = $groups_by_product[$product_id] ?? [];

    if ($groups === []) {
        $groups = raidlands_store_clean_groups([$fallback_group]);
    }

    return $groups;
}

function raidlands_store_attach_fulfillment_groups(array $products): array
{
    $product_ids = array_map(static fn (array $product): int => (int) ($product['id'] ?? 0), $products);
    $groups_by_product = raidlands_store_fulfillment_groups_for_products($product_ids);

    foreach ($products as &$product) {
        $product_id = (int) ($product['id'] ?? 0);
        $groups = $groups_by_product[$product_id] ?? [];

        if ($groups === []) {
            $groups = raidlands_store_clean_groups([$product['oxide_group'] ?? '']);
        }

        $product['fulfillment_groups'] = $groups;
        $product['oxide_group'] = $groups[0] ?? raidlands_store_clean_group($product['oxide_group'] ?? '');
    }
    unset($product);

    return $products;
}

function raidlands_store_verified_session_fields(string $verified_at = ''): array
{
    $verified_at = trim($verified_at);

    return [
        'steam_openid_verified' => true,
        'steam_auth_provider' => 'steam_openid',
        'steam_verified_at' => $verified_at !== '' ? $verified_at : gmdate(DATE_ATOM),
    ];
}

function raidlands_store_session_has_verified_steam($session_player): bool
{
    if (!is_array($session_player)) {
        return false;
    }

    $steam_id64 = preg_replace('/\D+/', '', (string) ($session_player['steam_id64'] ?? '')) ?? '';

    return raidlands_store_validate_steam_id64($steam_id64)
        && !empty($session_player['steam_openid_verified'])
        && (string) ($session_player['steam_auth_provider'] ?? '') === 'steam_openid';
}

function raidlands_store_steam_api_key(): string
{
    global $steam_api_config;

    $key = trim((string) ($steam_api_config['apiKey'] ?? ''));

    if ($key === '') {
        $env_key = getenv('RAIDLANDS_STEAM_API_KEY');
        $key = is_string($env_key) ? trim($env_key) : '';
    }

    if ($key === 'steam_web_api_key_replace_me' || str_contains($key, 'replace_me')) {
        return '';
    }

    return $key;
}

function raidlands_store_steam_profiles_enabled(): bool
{
    return raidlands_store_steam_api_key() !== '';
}

function raidlands_store_steam_profile_cache_seconds(): int
{
    global $steam_api_config;

    return max(300, (int) ($steam_api_config['cacheSeconds'] ?? 86400));
}

function raidlands_store_steam_api_base_url(): string
{
    global $steam_api_config;

    $base_url = trim((string) ($steam_api_config['baseUrl'] ?? 'https://api.steampowered.com'));

    return rtrim($base_url !== '' ? $base_url : 'https://api.steampowered.com', '/');
}

function raidlands_store_clean_profile_text($value, int $max_length = 120): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_store_clean_profile_url($value): string
{
    $url = trim(str_replace("\0", '', (string) $value));

    if ($url === '' || strlen($url) > 500 || filter_var($url, FILTER_VALIDATE_URL) === false) {
        return '';
    }

    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

    if (!in_array($scheme, ['http', 'https'], true)) {
        return '';
    }

    return $url;
}

function raidlands_store_http_get(string $url, int $timeout = 6): ?string
{
    if (function_exists('curl_init')) {
        $curl = curl_init($url);

        if ($curl !== false) {
            curl_setopt_array($curl, [
                CURLOPT_CONNECTTIMEOUT => min(3, $timeout),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_USERAGENT => 'RaidlandsSteamProfile/1.0',
            ]);

            $response = curl_exec($curl);
            $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);

            if (is_string($response) && $status >= 200 && $status < 300) {
                return $response;
            }
        }
    }

    $context = stream_context_create([
        'http' => [
            'header' => "User-Agent: RaidlandsSteamProfile/1.0\r\n",
            'ignore_errors' => false,
            'timeout' => $timeout,
        ],
    ]);
    $response = @file_get_contents($url, false, $context);

    return is_string($response) ? $response : null;
}

function raidlands_store_normalize_steam_profile(array $api_player): array
{
    $steam_id64 = preg_replace('/\D+/', '', (string) ($api_player['steamid'] ?? '')) ?? '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        return [];
    }

    $avatar_url = raidlands_store_clean_profile_url($api_player['avatarfull'] ?? '');

    if ($avatar_url === '') {
        $avatar_url = raidlands_store_clean_profile_url($api_player['avatarmedium'] ?? '');
    }

    if ($avatar_url === '') {
        $avatar_url = raidlands_store_clean_profile_url($api_player['avatar'] ?? '');
    }

    return [
        'steam_id64' => $steam_id64,
        'display_name' => raidlands_store_clean_profile_text($api_player['personaname'] ?? '', 120),
        'avatar_url' => $avatar_url,
        'profile_url' => raidlands_store_clean_profile_url($api_player['profileurl'] ?? ''),
    ];
}

function raidlands_store_fetch_steam_profiles(array $steam_ids): array
{
    $api_key = raidlands_store_steam_api_key();

    if ($api_key === '') {
        return [];
    }

    $valid_ids = [];

    foreach ($steam_ids as $steam_id64) {
        $steam_id64 = preg_replace('/\D+/', '', (string) $steam_id64) ?? '';

        if (raidlands_store_validate_steam_id64($steam_id64)) {
            $valid_ids[$steam_id64] = $steam_id64;
        }
    }

    if ($valid_ids === []) {
        return [];
    }

    $profiles = [];

    foreach (array_chunk(array_values($valid_ids), 100) as $chunk) {
        $query = http_build_query([
            'key' => $api_key,
            'steamids' => implode(',', $chunk),
            'format' => 'json',
        ], '', '&', PHP_QUERY_RFC3986);
        $response = raidlands_store_http_get(
            raidlands_store_steam_api_base_url() . '/ISteamUser/GetPlayerSummaries/v2/?' . $query
        );

        if ($response === null) {
            continue;
        }

        $decoded = json_decode($response, true);
        $players = is_array($decoded) ? ($decoded['response']['players'] ?? []) : [];

        if (!is_array($players)) {
            continue;
        }

        foreach ($players as $api_player) {
            if (!is_array($api_player)) {
                continue;
            }

            $profile = raidlands_store_normalize_steam_profile($api_player);

            if ($profile !== []) {
                $profiles[(string) $profile['steam_id64']] = $profile;
            }
        }
    }

    return $profiles;
}

function raidlands_store_fetch_steam_profile(string $steam_id64): array
{
    $steam_id64 = preg_replace('/\D+/', '', $steam_id64) ?? '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        return [];
    }

    $profiles = raidlands_store_fetch_steam_profiles([$steam_id64]);

    return $profiles[$steam_id64] ?? [];
}

function raidlands_store_steam_profile_targets(array $players): array
{
    $targets = [];

    foreach ($players as $player) {
        if (!is_array($player)) {
            continue;
        }

        $player_id = (int) ($player['player_id'] ?? $player['id'] ?? 0);
        $steam_id64 = preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? '')) ?? '';

        if ($player_id > 0 && raidlands_store_validate_steam_id64($steam_id64)) {
            $targets[$steam_id64] = $player_id;
        }
    }

    return $targets;
}

function raidlands_store_sql_in_params(array $values, string $prefix = 'value'): array
{
    $placeholders = [];
    $params = [];

    foreach (array_values($values) as $index => $value) {
        $key = $prefix . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $value;
    }

    return [$placeholders, $params];
}

function raidlands_store_upsert_steam_identity(PDO $pdo, int $player_id, string $steam_id64, array $profile, bool $verified): void
{
    if ($player_id <= 0 || !raidlands_store_validate_steam_id64($steam_id64)) {
        return;
    }

    $display_name = raidlands_store_clean_profile_text($profile['display_name'] ?? '', 120);
    $avatar_url = raidlands_store_clean_profile_url($profile['avatar_url'] ?? '');
    $profile_url = raidlands_store_clean_profile_url($profile['profile_url'] ?? '');
    $statement = $pdo->prepare(
        'INSERT INTO steam_identities (player_id, steam_id64, display_name, avatar_url, profile_url, verified_at)
         VALUES (:player_id, :steam_id64, :display_name, :avatar_url, :profile_url, :verified_at)
         ON DUPLICATE KEY UPDATE
            player_id = VALUES(player_id),
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            avatar_url = IF(VALUES(avatar_url) <> "", VALUES(avatar_url), avatar_url),
            profile_url = IF(VALUES(profile_url) <> "", VALUES(profile_url), profile_url),
            verified_at = COALESCE(VALUES(verified_at), verified_at),
            updated_at = NOW()'
    );
    $statement->execute([
        'player_id' => $player_id,
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
        'avatar_url' => $avatar_url,
        'profile_url' => $profile_url,
        'verified_at' => $verified ? gmdate('Y-m-d H:i:s') : null,
    ]);
}

function raidlands_store_prime_steam_profiles(array $players): void
{
    if (!raidlands_store_steam_profiles_enabled() || !raidlands_db_is_configured()) {
        return;
    }

    $targets = raidlands_store_steam_profile_targets($players);

    if ($targets === []) {
        return;
    }

    try {
        $pdo = raidlands_db_required();
        [$placeholders, $params] = raidlands_store_sql_in_params(array_keys($targets), 'steam');
        $rows = raidlands_db_fetch_all(
            'SELECT steam_id64, avatar_url, profile_url, updated_at
             FROM steam_identities
             WHERE steam_id64 IN (' . implode(', ', $placeholders) . ')',
            $params
        );
        $existing = [];

        foreach ($rows as $row) {
            $existing[(string) $row['steam_id64']] = $row;
        }

        $refresh_before = time() - raidlands_store_steam_profile_cache_seconds();
        $stale_ids = [];

        foreach (array_keys($targets) as $steam_id64) {
            $row = $existing[$steam_id64] ?? null;
            $updated_at = is_array($row) ? strtotime((string) ($row['updated_at'] ?? '')) : false;

            if (
                $row === null
                || trim((string) ($row['avatar_url'] ?? '')) === ''
                || trim((string) ($row['profile_url'] ?? '')) === ''
                || $updated_at === false
                || $updated_at < $refresh_before
            ) {
                $stale_ids[] = $steam_id64;
            }
        }

        if ($stale_ids === []) {
            return;
        }

        foreach (raidlands_store_fetch_steam_profiles($stale_ids) as $steam_id64 => $profile) {
            raidlands_store_upsert_steam_identity($pdo, (int) $targets[$steam_id64], $steam_id64, $profile, false);
        }
    } catch (Throwable $error) {
        return;
    }
}

function raidlands_store_steam_profiles_for_players(array $players): array
{
    if (!raidlands_store_steam_profiles_enabled() || !raidlands_db_is_configured()) {
        return [];
    }

    $targets = raidlands_store_steam_profile_targets($players);

    if ($targets === []) {
        return [];
    }

    try {
        raidlands_store_prime_steam_profiles($players);
        [$placeholders, $params] = raidlands_store_sql_in_params(array_keys($targets), 'steam');
        $rows = raidlands_db_fetch_all(
            'SELECT
                steam_id64,
                display_name AS steam_display_name,
                avatar_url AS steam_avatar_url,
                profile_url AS steam_profile_url,
                updated_at AS steam_profile_updated_at
             FROM steam_identities
             WHERE steam_id64 IN (' . implode(', ', $placeholders) . ')',
            $params
        );
    } catch (Throwable $error) {
        return [];
    }

    $profiles = [];

    foreach ($rows as $row) {
        $steam_id64 = (string) ($row['steam_id64'] ?? '');

        if (!raidlands_store_validate_steam_id64($steam_id64)) {
            continue;
        }

        $profiles[$steam_id64] = [
            'steam_display_name' => raidlands_store_clean_profile_text($row['steam_display_name'] ?? '', 120),
            'steam_avatar_url' => raidlands_store_clean_profile_url($row['steam_avatar_url'] ?? ''),
            'steam_profile_url' => raidlands_store_clean_profile_url($row['steam_profile_url'] ?? ''),
            'steam_profile_updated_at' => (string) ($row['steam_profile_updated_at'] ?? ''),
        ];
    }

    return $profiles;
}

function raidlands_store_attach_steam_profiles(array $players): array
{
    if (!raidlands_store_steam_profiles_enabled() || $players === []) {
        return $players;
    }

    $profiles = raidlands_store_steam_profiles_for_players($players);

    if ($profiles === []) {
        return $players;
    }

    foreach ($players as &$player) {
        if (!is_array($player)) {
            continue;
        }

        $steam_id64 = preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? '')) ?? '';
        $profile = $profiles[$steam_id64] ?? null;

        if (!is_array($profile)) {
            continue;
        }

        $player = array_merge($player, $profile);

        if (trim((string) ($player['display_name'] ?? '')) === '' && $profile['steam_display_name'] !== '') {
            $player['display_name'] = $profile['steam_display_name'];
        }
    }
    unset($player);

    return $players;
}

function raidlands_store_money(int $amount_cents, string $currency = 'usd'): string
{
    if ($amount_cents <= 0) {
        return 'Price coming soon';
    }

    return '$' . number_format($amount_cents / 100, 2) . ' ' . strtoupper($currency);
}

function raidlands_store_rp(int $amount): string
{
    return number_format(max(0, $amount)) . ' RP';
}

function raidlands_store_product_type_aliases(): array
{
    return [
        'vip_subscription' => 'kit_bundle',
        'one_time_kit_unlock' => 'kit_unlock',
        'one_time_perk' => 'perk',
    ];
}

function raidlands_store_product_types(): array
{
    return ['kit_bundle', 'kit_unlock', 'perk'];
}

function raidlands_store_normalize_product_type(string $type): string
{
    $type = trim($type);
    $aliases = raidlands_store_product_type_aliases();
    $type = $aliases[$type] ?? $type;

    return in_array($type, raidlands_store_product_types(), true) ? $type : 'perk';
}

function raidlands_store_offer_intervals(bool $include_lifetime = true): array
{
    $intervals = ['day', 'week', 'month', 'year'];

    return $include_lifetime ? array_merge(['one_time'], $intervals) : $intervals;
}

function raidlands_store_access_interval_label(string $interval): string
{
    return match ($interval) {
        'day' => 'Daily',
        'week' => 'Weekly',
        'month' => 'Monthly',
        'year' => 'Yearly',
        default => 'Lifetime',
    };
}

function raidlands_store_access_duration_seconds(string $interval): int
{
    return match ($interval) {
        'day' => 86400,
        'week' => 604800,
        'month' => 2592000,
        'year' => 31536000,
        default => 0,
    };
}

function raidlands_store_access_ends_at(int $duration_seconds, ?string $from = null): ?string
{
    if ($duration_seconds <= 0) {
        return null;
    }

    $timestamp = $from !== null && strtotime($from) !== false ? (int) strtotime($from) : time();

    return gmdate('Y-m-d H:i:s', $timestamp + $duration_seconds);
}

function raidlands_store_type_label(string $type): string
{
    return match (raidlands_store_normalize_product_type($type)) {
        'kit_bundle' => 'Kit bundle',
        'kit_unlock' => 'Individual kit',
        default => 'Standalone perk',
    };
}

function raidlands_store_offer_sort_order(string $interval): int
{
    return [
        'one_time' => 5,
        'day' => 10,
        'week' => 20,
        'month' => 30,
        'year' => 40,
    ][$interval] ?? 99;
}

function raidlands_store_offer_label(array $price, string $fallback_prefix = ''): string
{
    $label = trim((string) ($price['label'] ?? ''));

    if ($label !== '') {
        return $label;
    }

    $interval = (string) ($price['access_interval'] ?? $price['billing_interval'] ?? 'one_time');
    $base = raidlands_store_access_interval_label($interval);

    return trim($base . ' ' . $fallback_prefix);
}

function raidlands_store_seed_catalog(): array
{
    $rollout_catalog = __DIR__ . '/store-vip-rollout-catalog.php';

    if (is_file($rollout_catalog)) {
        $catalog = require $rollout_catalog;

        if (is_array($catalog)) {
            return $catalog;
        }
    }

    return [];
}

function raidlands_store_catalog(bool $active_only = true): array
{
    if (!raidlands_db_is_configured()) {
        return [
            'source' => 'fallback',
            'setupRequired' => true,
            'error' => 'Store setup is not finished yet.',
            'products' => raidlands_store_seed_catalog(),
        ];
    }

    try {
        $where = $active_only ? 'WHERE p.is_active = 1' : '';
        $rows = raidlands_db_fetch_all(
            "SELECT
                p.*,
                pr.id AS price_id,
                pr.payment_method,
                pr.stripe_price_id,
                pr.label AS price_label,
                pr.amount_cents,
                pr.currency,
                pr.rp_cost,
                pr.billing_interval,
                pr.access_interval,
                pr.access_duration_seconds,
                pr.allow_auto_renew,
                pr.is_active AS price_is_active,
                pr.is_default AS price_is_default
             FROM store_products p
             LEFT JOIN store_prices pr ON pr.product_id = p.id
             $where
             ORDER BY p.sort_order ASC, p.id ASC, pr.is_default DESC, pr.id ASC"
        );
    } catch (Throwable $error) {
        return [
            'source' => 'fallback',
            'setupRequired' => true,
            'error' => $error->getMessage(),
            'products' => raidlands_store_seed_catalog(),
        ];
    }

    $products = [];

    foreach ($rows as $row) {
        $id = (int) $row['id'];
        $oxide_group = raidlands_store_clean_group($row['oxide_group'] ?? '');

        if (!isset($products[$id])) {
            $products[$id] = [
                'id' => $id,
                'slug' => (string) $row['slug'],
                'name' => (string) $row['name'],
                'product_type' => raidlands_store_normalize_product_type((string) $row['product_type']),
                'short_description' => (string) $row['short_description'],
                'description' => (string) ($row['description'] ?? ''),
                'oxide_group' => $oxide_group,
                'tier_priority' => (int) $row['tier_priority'],
                'is_stackable' => (int) $row['is_stackable'],
                'is_active' => (int) $row['is_active'],
                'is_featured' => (int) $row['is_featured'],
                'sort_order' => (int) $row['sort_order'],
                'prices' => [],
            ];
        }

        if ($row['price_id'] !== null) {
            $products[$id]['prices'][] = [
                'id' => (int) $row['price_id'],
                'payment_method' => (string) ($row['payment_method'] ?? 'stripe'),
                'stripe_price_id' => (string) $row['stripe_price_id'],
                'label' => (string) $row['price_label'],
                'amount_cents' => (int) $row['amount_cents'],
                'currency' => (string) $row['currency'],
                'rp_cost' => (int) ($row['rp_cost'] ?? 0),
                'billing_interval' => (string) $row['billing_interval'],
                'access_interval' => (string) ($row['access_interval'] ?? 'one_time'),
                'access_duration_seconds' => (int) ($row['access_duration_seconds'] ?? 0),
                'allow_auto_renew' => (int) ($row['allow_auto_renew'] ?? 0),
                'is_active' => (int) $row['price_is_active'],
                'is_default' => (int) $row['price_is_default'],
            ];
        }
    }

    $products = raidlands_store_attach_fulfillment_groups(array_values($products));

    if ($active_only) {
        $products = array_values(array_filter(
            $products,
            static fn (array $product): bool => (array) ($product['fulfillment_groups'] ?? []) !== []
        ));
    }

    return [
        'source' => 'database',
        'setupRequired' => false,
        'error' => '',
        'products' => $products,
    ];
}

function raidlands_store_products_by_type(array $products, string $type): array
{
    $type = raidlands_store_normalize_product_type($type);

    return array_values(array_filter(
        $products,
        static fn (array $product): bool => raidlands_store_normalize_product_type((string) $product['product_type']) === $type
    ));
}

function raidlands_store_default_price(array $product): ?array
{
    foreach ((array) ($product['prices'] ?? []) as $price) {
        if (
            !empty($price['is_default'])
            && (string) ($price['payment_method'] ?? 'stripe') === 'stripe'
            && (string) ($price['billing_interval'] ?? 'one_time') === 'one_time'
        ) {
            return $price;
        }
    }

    foreach ((array) ($product['prices'] ?? []) as $price) {
        if ((string) ($price['payment_method'] ?? 'stripe') === 'stripe') {
            return $price;
        }
    }

    return null;
}

function raidlands_store_sort_offers(array $offers, bool $use_billing_interval = false): array
{
    usort($offers, static function (array $left, array $right) use ($use_billing_interval): int {
        $left_interval = (string) ($use_billing_interval ? ($left['billing_interval'] ?? 'one_time') : ($left['access_interval'] ?? 'one_time'));
        $right_interval = (string) ($use_billing_interval ? ($right['billing_interval'] ?? 'one_time') : ($right['access_interval'] ?? 'one_time'));

        return raidlands_store_offer_sort_order($left_interval)
            <=> raidlands_store_offer_sort_order($right_interval);
    });

    return $offers;
}

function raidlands_store_cash_pass_offers(array $product, bool $active_only = false): array
{
    $offers = array_values(array_filter(
        (array) ($product['prices'] ?? []),
        static fn (array $price): bool => (string) ($price['payment_method'] ?? 'stripe') === 'stripe'
            && (string) ($price['billing_interval'] ?? 'one_time') === 'one_time'
            && (!$active_only || !empty($price['is_active']))
    ));

    return raidlands_store_sort_offers($offers);
}

function raidlands_store_cash_subscription_offers(array $product, bool $active_only = false): array
{
    $offers = array_values(array_filter(
        (array) ($product['prices'] ?? []),
        static fn (array $price): bool => (string) ($price['payment_method'] ?? 'stripe') === 'stripe'
            && (string) ($price['billing_interval'] ?? 'one_time') !== 'one_time'
            && (!$active_only || !empty($price['is_active']))
    ));

    return raidlands_store_sort_offers($offers, true);
}

function raidlands_store_cash_offers(array $product): array
{
    return array_merge(
        raidlands_store_cash_pass_offers($product),
        raidlands_store_cash_subscription_offers($product)
    );
}

function raidlands_store_rp_offers(array $product, bool $active_only = false): array
{
    $offers = array_values(array_filter(
        (array) ($product['prices'] ?? []),
        static fn (array $price): bool => (string) ($price['payment_method'] ?? 'stripe') === 'rp'
            && (!$active_only || !empty($price['is_active']))
    ));

    return raidlands_store_sort_offers($offers);
}

function raidlands_store_price_is_buyable(?array $price): bool
{
    if ($price === null) {
        return false;
    }

    if ((string) ($price['payment_method'] ?? 'stripe') !== 'stripe') {
        return false;
    }

    $stripe_price_id = trim((string) ($price['stripe_price_id'] ?? ''));

    return !empty($price['is_active'])
        && (int) ($price['amount_cents'] ?? 0) > 0
        && $stripe_price_id !== ''
        && !str_starts_with($stripe_price_id, 'configure_');
}

function raidlands_store_price_checkout_mode(array $price): string
{
    return (string) ($price['billing_interval'] ?? 'one_time') === 'one_time'
        ? 'payment'
        : 'subscription';
}

function raidlands_store_rp_offer_is_buyable(?array $price): bool
{
    if ($price === null || (string) ($price['payment_method'] ?? '') !== 'rp') {
        return false;
    }

    $duration = (int) ($price['access_duration_seconds'] ?? 0);
    $interval = (string) ($price['access_interval'] ?? 'one_time');

    return !empty($price['is_active'])
        && (int) ($price['rp_cost'] ?? 0) > 0
        && ($interval === 'one_time' || $duration > 0);
}

function raidlands_store_current_player(): ?array
{
    raidlands_store_boot();
    $session_player = $_SESSION['raidlands_player'] ?? null;

    if (!is_array($session_player) || empty($session_player['steam_id64'])) {
        return null;
    }

    if (!raidlands_store_session_has_verified_steam($session_player)) {
        unset($_SESSION['raidlands_player']);
        return null;
    }

    $verified_session_fields = raidlands_store_verified_session_fields((string) ($session_player['steam_verified_at'] ?? ''));

    if (!raidlands_db_is_configured()) {
        return array_merge($session_player, $verified_session_fields);
    }

    try {
        $row = raidlands_db_fetch_one(
            'SELECT id, steam_id64, display_name, created_at, updated_at, last_seen_at FROM players WHERE steam_id64 = :steam_id64',
            ['steam_id64' => (string) $session_player['steam_id64']]
        );

        if ($row !== null) {
            $row = raidlands_store_attach_steam_profiles([$row])[0] ?? $row;
            $row = array_merge($row, $verified_session_fields);
            $_SESSION['raidlands_player'] = $row;
            return $row;
        }
    } catch (Throwable $error) {
        return array_merge($session_player, $verified_session_fields);
    }

    return array_merge($session_player, $verified_session_fields);
}

function raidlands_store_link_verified_player(string $steam_id64): array
{
    raidlands_store_boot();
    $steam_id64 = preg_replace('/\D+/', '', $steam_id64) ?? '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Enter a valid 17-digit Steam ID. It should start with 7656119.');
    }

    $steam_profile = raidlands_store_fetch_steam_profile($steam_id64);
    $display_name = '';

    if ($display_name === '' && !empty($steam_profile['display_name'])) {
        $display_name = (string) $steam_profile['display_name'];
    }

    $verified_session_fields = raidlands_store_verified_session_fields();
    $player = [
        'id' => null,
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
        'steam_display_name' => (string) ($steam_profile['display_name'] ?? ''),
        'steam_avatar_url' => (string) ($steam_profile['avatar_url'] ?? ''),
        'steam_profile_url' => (string) ($steam_profile['profile_url'] ?? ''),
    ] + $verified_session_fields;

    if (raidlands_db_is_configured()) {
        $pdo = raidlands_db_required();
        $pdo->beginTransaction();

        try {
            $statement = $pdo->prepare(
                'INSERT INTO players (steam_id64, display_name, last_seen_at)
                 VALUES (:steam_id64, :display_name, NOW())
                 ON DUPLICATE KEY UPDATE
                    display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
                    last_seen_at = NOW(),
                    updated_at = NOW()'
            );
            $statement->execute([
                'steam_id64' => $steam_id64,
                'display_name' => $display_name,
            ]);

            $row = raidlands_db_fetch_one(
                'SELECT id, steam_id64, display_name, created_at, updated_at, last_seen_at FROM players WHERE steam_id64 = :steam_id64',
                ['steam_id64' => $steam_id64]
            );

            if ($row === null) {
                throw new RuntimeException('The player record could not be loaded after linking.');
            }

            $identity_profile = $steam_profile;
            $identity_profile['display_name'] = $display_name;
            raidlands_store_upsert_steam_identity($pdo, (int) $row['id'], $steam_id64, $identity_profile, true);

            $pdo->commit();
            $player = raidlands_store_attach_steam_profiles([$row])[0] ?? $row;
            $player = array_merge($player, $verified_session_fields);
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    if (!headers_sent()) {
        session_regenerate_id(true);
    }
    $_SESSION['raidlands_player'] = $player;

    return $player;
}

function raidlands_store_link_player(string $steam_id64, string $display_name = ''): array
{
    throw new RuntimeException('Steam accounts must be linked through Steam sign-in.');
}

function raidlands_store_current_origin(): string
{
    $host = trim((string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? ''));

    if ($host === '') {
        $host = trim((string) ($_SERVER['SERVER_NAME'] ?? 'localhost'));
        $port = trim((string) ($_SERVER['SERVER_PORT'] ?? ''));

        if ($port !== '' && !in_array($port, ['80', '443'], true)) {
            $host .= ':' . $port;
        }
    }

    $scheme = strtolower(trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));

    if ($scheme === '') {
        $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
        $scheme = ($https === 'on' || $https === '1') ? 'https' : 'http';
    }

    return $scheme . '://' . $host;
}

function raidlands_store_absolute_route_url(string $path = ''): string
{
    $path = trim($path, '/');

    return raidlands_store_absolute_url($path === '' ? '' : $path . '/');
}

function raidlands_store_steam_openid_url(string $return_path = 'link'): string
{
    raidlands_store_boot();

    $return_path = trim($return_path, '/');
    $return_to = raidlands_store_absolute_route_url($return_path !== '' ? $return_path : 'link');
    $separator = str_contains($return_to, '?') ? '&' : '?';
    $return_to .= $separator . 'steam_openid=1';

    $_SESSION['raidlands_steam_openid_nonce'] = bin2hex(random_bytes(16));
    $return_to .= '&state=' . rawurlencode((string) $_SESSION['raidlands_steam_openid_nonce']);

    $params = [
        'openid.ns' => 'http://specs.openid.net/auth/2.0',
        'openid.mode' => 'checkid_setup',
        'openid.return_to' => $return_to,
        'openid.realm' => rtrim(raidlands_store_current_origin(), '/') . '/',
        'openid.identity' => 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id' => 'http://specs.openid.net/auth/2.0/identifier_select',
    ];

    return 'https://steamcommunity.com/openid/login?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
}

function raidlands_store_steam_openid_response_present(): bool
{
    return isset($_GET['steam_openid']) || isset($_GET['openid_mode']) || isset($_GET['openid.mode']);
}

function raidlands_store_steam_openid_verify(): array
{
    raidlands_store_boot();

    $mode = (string) ($_GET['openid_mode'] ?? $_GET['openid.mode'] ?? '');

    if ($mode !== 'id_res') {
        throw new RuntimeException('Steam did not authorize the identity request.');
    }

    $state = (string) ($_GET['state'] ?? '');
    $expected_state = (string) ($_SESSION['raidlands_steam_openid_nonce'] ?? '');
    unset($_SESSION['raidlands_steam_openid_nonce']);

    if ($state === '' || $expected_state === '' || !hash_equals($expected_state, $state)) {
        throw new RuntimeException('Steam sign-in state expired. Try linking again.');
    }

    $claimed_id = (string) ($_GET['openid_claimed_id'] ?? $_GET['openid.claimed_id'] ?? '');

    if (!preg_match('#^https?://steamcommunity\.com/openid/id/(\d{17})$#', $claimed_id, $matches)) {
        throw new RuntimeException('Steam did not return a valid Steam account.');
    }

    $params = [];

    foreach ($_GET as $key => $value) {
        if (str_starts_with($key, 'openid_')) {
            $params[str_replace('_', '.', $key)] = (string) $value;
        } elseif (str_starts_with($key, 'openid.')) {
            $params[$key] = (string) $value;
        }
    }

    $params['openid.mode'] = 'check_authentication';
    $body = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    $headers = "Content-Type: application/x-www-form-urlencoded\r\n"
        . "User-Agent: RaidlandsSteamOpenID/1.0\r\n";

    $response = false;

    if (function_exists('curl_init')) {
        $curl = curl_init('https://steamcommunity.com/openid/login');

        if ($curl !== false) {
            curl_setopt_array($curl, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_USERAGENT => 'RaidlandsSteamOpenID/1.0',
            ]);
            $response = curl_exec($curl);
            curl_close($curl);
        }
    }

    if ($response === false) {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => $headers,
                'content' => $body,
                'timeout' => 8,
            ],
        ]);

        $response = @file_get_contents('https://steamcommunity.com/openid/login', false, $context);
    }

    if ($response === false || !str_contains($response, 'is_valid:true')) {
        throw new RuntimeException('Steam did not confirm the sign-in. Try Steam sign-in again.');
    }

    return raidlands_store_link_verified_player((string) $matches[1]);
}

function raidlands_store_unlink_player(): void
{
    raidlands_store_boot();
    unset($_SESSION['raidlands_player']);
}

function raidlands_store_entitlements_for_player(int $player_id): array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return [];
    }

    raidlands_store_expire_stale_entitlements();

    $rows = raidlands_db_fetch_all(
        "SELECT e.*, p.name, p.slug, p.product_type, p.oxide_group AS product_oxide_group, p.tier_priority
         FROM entitlements e
         INNER JOIN store_products p ON p.id = e.product_id
         WHERE e.player_id = :player_id
         ORDER BY
            FIELD(e.status, 'active', 'pending', 'expired', 'revoked'),
            p.product_type ASC,
            p.tier_priority DESC,
            e.created_at DESC",
        ['player_id' => $player_id]
    );

    $groups_by_product = raidlands_store_fulfillment_groups_for_products(array_map(
        static fn (array $row): int => (int) ($row['product_id'] ?? 0),
        $rows
    ));

    foreach ($rows as &$row) {
        $product_id = (int) ($row['product_id'] ?? 0);
        $groups = $groups_by_product[$product_id] ?? [];
        $fallback_group = raidlands_store_clean_group($row['oxide_group'] ?? $row['product_oxide_group'] ?? '');

        if ($groups === [] && $fallback_group !== '') {
            $groups = [$fallback_group];
        }

        $row['fulfillment_groups'] = $groups;
        $row['oxide_group'] = $groups[0] ?? $fallback_group;
    }
    unset($row);

    return $rows;
}

function raidlands_store_current_rp_balance(int $player_id): ?array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return null;
    }

    raidlands_store_refresh_reported_rp_balance($player_id);

    try {
        $row = raidlands_db_fetch_one(
            'SELECT s.raw_reward_points AS reward_points, s.reward_points AS wipe_reward_points, s.last_seen_at, w.wipe_key, w.is_active
             FROM player_wipe_stats s
             INNER JOIN wipe_seasons w ON w.id = s.wipe_id
             WHERE s.player_id = :player_id
             ORDER BY w.is_active DESC, s.last_seen_at DESC, s.updated_at DESC
             LIMIT 1',
            ['player_id' => $player_id]
        );
    } catch (Throwable $error) {
        return null;
    }

    if ($row === null) {
        return null;
    }

    return [
        'reward_points' => (int) ($row['reward_points'] ?? 0),
        'wipe_reward_points' => (int) ($row['wipe_reward_points'] ?? 0),
        'last_seen_at' => (string) ($row['last_seen_at'] ?? ''),
        'wipe_key' => (string) ($row['wipe_key'] ?? ''),
        'is_active' => (int) ($row['is_active'] ?? 0),
    ];
}

function raidlands_store_time_value($value): int
{
    $timestamp = strtotime((string) $value);

    return $timestamp === false ? 0 : $timestamp;
}

function raidlands_store_apply_reported_rp_balance(PDO $pdo, int $player_id, ?int $balance): bool
{
    if ($player_id <= 0 || $balance === null || $balance < 0) {
        return false;
    }

    try {
        $statement = $pdo->prepare(
            'SELECT s.id
             FROM player_wipe_stats s
             INNER JOIN wipe_seasons w ON w.id = s.wipe_id
             WHERE s.player_id = :player_id
             ORDER BY w.is_active DESC, s.last_seen_at DESC, s.updated_at DESC
             LIMIT 1
             FOR UPDATE'
        );
        $statement->execute(['player_id' => $player_id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            return false;
        }

        $update = $pdo->prepare(
            'UPDATE player_wipe_stats
             SET raw_reward_points = :balance,
                 reward_points = GREATEST(0, :balance - baseline_reward_points),
                 last_seen_at = NOW(),
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'balance' => $balance,
            'id' => (int) $row['id'],
        ]);

        return $update->rowCount() > 0;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_store_refresh_reported_rp_balance(int $player_id): bool
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return false;
    }

    $pdo = null;
    $owns_transaction = false;

    try {
        $pdo = raidlands_db_required();
        $owns_transaction = !$pdo->inTransaction();

        if ($owns_transaction) {
            $pdo->beginTransaction();
        }

        $request_statement = $pdo->prepare(
            'SELECT balance_after, processed_at, updated_at, created_at
             FROM rp_purchase_requests
             WHERE player_id = :player_id
               AND status = "confirmed"
               AND balance_after IS NOT NULL
             ORDER BY COALESCE(processed_at, updated_at, created_at) DESC, id DESC
             LIMIT 1'
        );
        $request_statement->execute(['player_id' => $player_id]);
        $request = $request_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($request)) {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return false;
        }

        $stats_statement = $pdo->prepare(
            'SELECT s.id, s.raw_reward_points, s.last_seen_at, s.updated_at
             FROM player_wipe_stats s
             INNER JOIN wipe_seasons w ON w.id = s.wipe_id
             WHERE s.player_id = :player_id
             ORDER BY w.is_active DESC, s.last_seen_at DESC, s.updated_at DESC
             LIMIT 1
             FOR UPDATE'
        );
        $stats_statement->execute(['player_id' => $player_id]);
        $stats = $stats_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($stats)) {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return false;
        }

        $reported_at = max(
            raidlands_store_time_value($request['processed_at'] ?? ''),
            raidlands_store_time_value($request['updated_at'] ?? ''),
            raidlands_store_time_value($request['created_at'] ?? '')
        );
        $stats_at = max(
            raidlands_store_time_value($stats['last_seen_at'] ?? ''),
            raidlands_store_time_value($stats['updated_at'] ?? '')
        );

        if ($reported_at > 0 && $stats_at > 0 && $reported_at <= $stats_at) {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return false;
        }

        $synced = raidlands_store_apply_reported_rp_balance($pdo, $player_id, (int) $request['balance_after']);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return $synced;
    } catch (Throwable $error) {
        if ($pdo instanceof PDO && $owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return false;
    }
}

function raidlands_store_rp_requests_for_player(int $player_id, int $limit = 12): array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT r.*, p.name AS product_name, p.product_type, sp.label AS price_label
             FROM rp_purchase_requests r
             INNER JOIN store_products p ON p.id = r.product_id
             INNER JOIN store_prices sp ON sp.id = r.store_price_id
             WHERE r.player_id = :player_id
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT ' . max(1, min(50, $limit)),
            ['player_id' => $player_id]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_store_rp_subscriptions_for_player(int $player_id): array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT s.*, p.name AS product_name, p.slug AS product_slug, sp.label AS price_label
             FROM rp_subscriptions s
             INNER JOIN store_products p ON p.id = s.product_id
             INNER JOIN store_prices sp ON sp.id = s.store_price_id
             WHERE s.player_id = :player_id
             ORDER BY FIELD(s.status, "active", "cancel_at_period_end", "past_due", "expired", "canceled"), s.current_period_end DESC, s.id DESC',
            ['player_id' => $player_id]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_store_cash_subscriptions_for_player(int $player_id): array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT s.*, p.name AS product_name, p.slug AS product_slug, p.product_type, sp.label AS price_label, sp.billing_interval
             FROM subscriptions s
             INNER JOIN store_products p ON p.id = s.product_id
             INNER JOIN store_prices sp ON sp.id = s.store_price_id
             WHERE s.player_id = :player_id
             ORDER BY FIELD(s.status, "active", "trialing", "past_due", "canceled", "unpaid", "incomplete"), s.current_period_end DESC, s.id DESC',
            ['player_id' => $player_id]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_store_create_billing_portal_session(): string
{
    global $stripe_config;

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['id'])) {
        throw new RuntimeException('Connect your Steam account before managing billing.');
    }

    $subscription = raidlands_db_fetch_one(
        'SELECT stripe_customer_id
         FROM subscriptions
         WHERE player_id = :player_id
           AND stripe_customer_id <> ""
         ORDER BY FIELD(status, "active", "trialing", "past_due", "incomplete", "canceled"), updated_at DESC, id DESC
         LIMIT 1',
        ['player_id' => (int) $player['id']]
    );

    if ($subscription === null || trim((string) ($subscription['stripe_customer_id'] ?? '')) === '') {
        throw new RuntimeException('No cash subscription billing profile was found for this account.');
    }

    $secret_key = (string) ($stripe_config['secretKey'] ?? '');

    if ($secret_key === '') {
        throw new RuntimeException('Stripe secret key is not configured.');
    }

    raidlands_store_load_stripe();
    \Stripe\Stripe::setApiKey($secret_key);

    $params = [
        'customer' => (string) $subscription['stripe_customer_id'],
        'return_url' => raidlands_store_absolute_url('profile/'),
    ];
    $configuration_id = trim((string) ($stripe_config['billingPortalConfigurationId'] ?? ''));

    if ($configuration_id !== '') {
        $params['configuration'] = $configuration_id;
    }

    $session = \Stripe\BillingPortal\Session::create($params);

    return (string) $session->url;
}

function raidlands_store_rp_price_by_id(int $price_id): ?array
{
    if ($price_id <= 0) {
        return null;
    }

    return raidlands_db_fetch_one(
        "SELECT
            pr.*,
            p.name,
            p.slug,
            p.product_type,
            p.oxide_group,
            p.is_active AS product_is_active
         FROM store_prices pr
         INNER JOIN store_products p ON p.id = pr.product_id
         WHERE pr.id = :price_id AND pr.payment_method = 'rp'",
        ['price_id' => $price_id]
    );
}

function raidlands_store_create_rp_purchase_request(int $price_id, bool $auto_renew): array
{
    $player = raidlands_store_current_player();

    if ($player === null || empty($player['id']) || empty($player['steam_id64'])) {
        throw new RuntimeException('Connect your Steam account before using RP.');
    }

    $row = raidlands_store_rp_price_by_id($price_id);

    if ($row === null || empty($row['product_is_active']) || empty($row['is_active'])) {
        throw new RuntimeException('That RP offer is not active.');
    }

    if (raidlands_store_effective_fulfillment_groups((int) ($row['product_id'] ?? 0), $row['oxide_group'] ?? '') === []) {
        throw new RuntimeException('That product does not have an applied server group configured yet.');
    }

    $rp_cost = (int) ($row['rp_cost'] ?? 0);
    $duration = (int) ($row['access_duration_seconds'] ?? 0);
    $interval = (string) ($row['access_interval'] ?? 'one_time');

    if ($rp_cost <= 0) {
        throw new RuntimeException('That RP offer still needs a price.');
    }

    if ($interval !== 'one_time' && $duration <= 0) {
        throw new RuntimeException('That RP offer still needs an access duration.');
    }

    if ($auto_renew && (empty($row['allow_auto_renew']) || $interval === 'one_time' || $duration <= 0)) {
        throw new RuntimeException('Auto-renew is not available for that RP offer.');
    }

    $token = bin2hex(random_bytes(16));

    raidlands_db_execute(
        'INSERT INTO rp_purchase_requests
            (request_token, player_id, product_id, store_price_id, steam_id64, rp_cost, access_interval, access_duration_seconds, auto_renew_requested, status, expires_at)
         VALUES
            (:request_token, :player_id, :product_id, :store_price_id, :steam_id64, :rp_cost, :access_interval, :access_duration_seconds, :auto_renew_requested, "queued", DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [
            'request_token' => $token,
            'player_id' => (int) $player['id'],
            'product_id' => (int) $row['product_id'],
            'store_price_id' => (int) $row['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'rp_cost' => $rp_cost,
            'access_interval' => $interval,
            'access_duration_seconds' => $duration,
            'auto_renew_requested' => $auto_renew ? 1 : 0,
        ]
    );

    return [
        'request_token' => $token,
        'product_name' => (string) $row['name'],
        'price_label' => (string) $row['label'],
        'rp_cost' => $rp_cost,
        'auto_renew' => $auto_renew,
    ];
}

function raidlands_store_cancel_rp_subscription(int $subscription_id): void
{
    $player = raidlands_store_current_player();

    if ($player === null || empty($player['id'])) {
        throw new RuntimeException('Connect your Steam account before changing RP renewals.');
    }

    $updated = raidlands_db_execute(
        "UPDATE rp_subscriptions
         SET status = 'cancel_at_period_end',
             cancel_at_period_end = 1,
             canceled_at = NOW(),
             updated_at = NOW()
         WHERE id = :id
           AND player_id = :player_id
           AND status IN ('active', 'past_due')",
        [
            'id' => $subscription_id,
            'player_id' => (int) $player['id'],
        ]
    );

    if ($updated === 0) {
        throw new RuntimeException('That RP renewal could not be canceled.');
    }
}

function raidlands_store_queue_due_rp_renewals(): void
{
    if (!raidlands_db_is_configured()) {
        return;
    }

    try {
        raidlands_db_execute(
            "UPDATE rp_subscriptions
             SET status = CASE WHEN cancel_at_period_end = 1 THEN 'canceled' ELSE 'expired' END,
                 updated_at = NOW()
             WHERE status IN ('active', 'cancel_at_period_end')
               AND current_period_end IS NOT NULL
               AND current_period_end <= NOW()
               AND (cancel_at_period_end = 1 OR next_renewal_at IS NULL)"
        );

        $subscriptions = raidlands_db_fetch_all(
            "SELECT s.*
             FROM rp_subscriptions s
             WHERE s.status = 'active'
               AND s.cancel_at_period_end = 0
               AND s.next_renewal_at IS NOT NULL
               AND s.next_renewal_at <= NOW()
               AND NOT EXISTS (
                 SELECT 1
                 FROM rp_purchase_requests r
                 WHERE r.rp_subscription_id = s.id
                   AND r.status IN ('queued', 'processing')
               )
             ORDER BY s.next_renewal_at ASC
             LIMIT 25"
        );

        foreach ($subscriptions as $subscription) {
            $token = bin2hex(random_bytes(16));
            raidlands_db_execute(
                'INSERT INTO rp_purchase_requests
                    (request_token, player_id, product_id, store_price_id, rp_subscription_id, steam_id64, rp_cost, access_interval, access_duration_seconds, auto_renew_requested, status, expires_at)
                 VALUES
                    (:request_token, :player_id, :product_id, :store_price_id, :subscription_id, :steam_id64, :rp_cost, :access_interval, :access_duration_seconds, 1, "queued", DATE_ADD(NOW(), INTERVAL 1 HOUR))',
                [
                    'request_token' => $token,
                    'player_id' => (int) $subscription['player_id'],
                    'product_id' => (int) $subscription['product_id'],
                    'store_price_id' => (int) $subscription['store_price_id'],
                    'subscription_id' => (int) $subscription['id'],
                    'steam_id64' => (string) $subscription['steam_id64'],
                    'rp_cost' => (int) $subscription['rp_cost'],
                    'access_interval' => (string) $subscription['access_interval'],
                    'access_duration_seconds' => (int) $subscription['access_duration_seconds'],
                ]
            );
        }
    } catch (Throwable $error) {
        return;
    }
}

function raidlands_store_bridge_rp_requests(int $limit = 25): array
{
    raidlands_store_queue_due_rp_renewals();

    raidlands_db_execute(
        "UPDATE rp_purchase_requests
         SET status = 'expired', message = 'The server did not process this RP request before it expired.', updated_at = NOW()
         WHERE status = 'queued' AND expires_at IS NOT NULL AND expires_at <= NOW()"
    );
    raidlands_db_execute(
        "UPDATE rp_purchase_requests
         SET status = 'queued', locked_at = NULL, updated_at = NOW()
         WHERE status = 'processing' AND locked_at IS NOT NULL AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    );

    $rows = raidlands_db_fetch_all(
        'SELECT r.*, p.name AS product_name, p.slug AS product_slug, p.product_type, sp.label AS price_label
         FROM rp_purchase_requests r
         INNER JOIN store_products p ON p.id = r.product_id
         INNER JOIN store_prices sp ON sp.id = r.store_price_id
         WHERE r.status = "queued"
         ORDER BY r.created_at ASC, r.id ASC
         LIMIT ' . max(1, min(100, $limit))
    );

    if ($rows === []) {
        return [];
    }

    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    [$placeholders, $params] = raidlands_store_sql_in_params($ids, 'request_id');
    raidlands_db_execute(
        'UPDATE rp_purchase_requests
         SET status = "processing",
             locked_at = NOW(),
             bridge_attempts = bridge_attempts + 1,
             updated_at = NOW()
         WHERE id IN (' . implode(', ', $placeholders) . ')',
        $params
    );

    return $rows;
}

function raidlands_store_rp_subscription_next_renewal(string $period_end): ?string
{
    $end = strtotime($period_end);

    if ($end === false) {
        return null;
    }

    return gmdate('Y-m-d H:i:s', max(time(), $end - 300));
}

function raidlands_store_activate_rp_request(PDO $pdo, array $request): array
{
    $duration = (int) ($request['access_duration_seconds'] ?? 0);
    $period_start = gmdate('Y-m-d H:i:s');
    $period_end = raidlands_store_access_ends_at($duration, $period_start);
    $subscription_id = (int) ($request['rp_subscription_id'] ?? 0);

    if (!empty($request['auto_renew_requested'])) {
        if ($subscription_id > 0) {
            $subscription = raidlands_db_fetch_one(
                'SELECT * FROM rp_subscriptions WHERE id = :id FOR UPDATE',
                ['id' => $subscription_id]
            );

            if ($subscription !== null) {
                $current_end = trim((string) ($subscription['current_period_end'] ?? ''));
                $period_start = $current_end !== '' && strtotime($current_end) !== false && strtotime($current_end) > time()
                    ? $current_end
                    : gmdate('Y-m-d H:i:s');
                $period_end = raidlands_store_access_ends_at($duration, $period_start);
            }
        } else {
            raidlands_db_execute(
                'INSERT INTO rp_subscriptions
                    (player_id, product_id, store_price_id, steam_id64, status, rp_cost, access_interval, access_duration_seconds, current_period_start, current_period_end, next_renewal_at)
                 VALUES
                    (:player_id, :product_id, :store_price_id, :steam_id64, "active", :rp_cost, :access_interval, :access_duration_seconds, :period_start, :period_end, :next_renewal_at)',
                [
                    'player_id' => (int) $request['player_id'],
                    'product_id' => (int) $request['product_id'],
                    'store_price_id' => (int) $request['store_price_id'],
                    'steam_id64' => (string) $request['steam_id64'],
                    'rp_cost' => (int) $request['rp_cost'],
                    'access_interval' => (string) $request['access_interval'],
                    'access_duration_seconds' => $duration,
                    'period_start' => $period_start,
                    'period_end' => $period_end,
                    'next_renewal_at' => $period_end === null ? null : raidlands_store_rp_subscription_next_renewal($period_end),
                ]
            );
            $subscription_id = (int) $pdo->lastInsertId();
        }

        if ($subscription_id > 0) {
            raidlands_db_execute(
                'UPDATE rp_subscriptions
                 SET status = "active",
                     current_period_start = :period_start,
                     current_period_end = :period_end,
                     next_renewal_at = :next_renewal_at,
                     last_request_id = :request_id,
                     failed_attempts = 0,
                     updated_at = NOW()
                 WHERE id = :subscription_id',
                [
                    'period_start' => $period_start,
                    'period_end' => $period_end,
                    'next_renewal_at' => $period_end === null ? null : raidlands_store_rp_subscription_next_renewal($period_end),
                    'request_id' => (int) $request['id'],
                    'subscription_id' => $subscription_id,
                ]
            );

            raidlands_store_grant_entitlement(
                (int) $request['player_id'],
                (int) $request['product_id'],
                'rp_subscription',
                (string) $subscription_id,
                $period_end
            );

            return ['source_type' => 'rp_subscription', 'source_id' => (string) $subscription_id, 'ends_at' => $period_end];
        }
    }

    raidlands_store_grant_entitlement(
        (int) $request['player_id'],
        (int) $request['product_id'],
        'rp_purchase',
        (string) $request['request_token'],
        $period_end
    );

    return ['source_type' => 'rp_purchase', 'source_id' => (string) $request['request_token'], 'ends_at' => $period_end];
}

function raidlands_store_record_rp_purchase_result(array $payload): array
{
    $token = trim((string) ($payload['request_id'] ?? $payload['request_token'] ?? ''));
    $status = strtolower(trim((string) ($payload['status'] ?? '')));

    if ($token === '') {
        throw new InvalidArgumentException('RP purchase result is missing request_id.');
    }

    if (!in_array($status, ['confirmed', 'rejected', 'failed'], true)) {
        throw new InvalidArgumentException('RP purchase result has an invalid status.');
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $statement = $pdo->prepare('SELECT * FROM rp_purchase_requests WHERE request_token = :token FOR UPDATE');
        $statement->execute(['token' => $token]);
        $request = $statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($request)) {
            throw new RuntimeException('RP purchase request was not found.');
        }

        if (in_array((string) $request['status'], ['confirmed', 'rejected', 'failed'], true)) {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return ['ok' => true, 'duplicate' => true, 'request_id' => $token, 'status' => (string) $request['status']];
        }

        $message = mb_substr(raidlands_store_clean_profile_text($payload['message'] ?? $payload['error'] ?? '', 500), 0, 500);
        $fail_code = mb_substr(raidlands_store_clean_profile_text($payload['fail_code'] ?? $payload['reason'] ?? '', 80), 0, 80);
        $balance_before = isset($payload['balance_before']) ? (int) $payload['balance_before'] : null;
        $balance_after = isset($payload['balance_after']) ? (int) $payload['balance_after'] : null;

        raidlands_db_execute(
            'UPDATE rp_purchase_requests
             SET status = :status,
                 fail_code = :fail_code,
                 message = :message,
                 balance_before = :balance_before,
                 balance_after = :balance_after,
                 processed_at = NOW(),
                 updated_at = NOW()
             WHERE id = :id',
            [
                'status' => $status,
                'fail_code' => $fail_code,
                'message' => $message,
                'balance_before' => $balance_before,
                'balance_after' => $balance_after,
                'id' => (int) $request['id'],
            ]
        );

        if ($status === 'confirmed') {
            $activation = raidlands_store_activate_rp_request($pdo, $request);
            $rp_balance_synced = raidlands_store_apply_reported_rp_balance(
                $pdo,
                (int) $request['player_id'],
                $balance_after
            );

            if ($owns_transaction) {
                $pdo->commit();
            }

            return [
                'ok' => true,
                'request_id' => $token,
                'status' => $status,
                'rp_balance_synced' => $rp_balance_synced,
            ] + $activation;
        }

        $subscription_id = (int) ($request['rp_subscription_id'] ?? 0);

        if ($subscription_id > 0) {
            $subscription_status = $status === 'rejected' ? 'past_due' : 'active';
            raidlands_db_execute(
                'UPDATE rp_subscriptions
                 SET status = :status,
                     failed_attempts = failed_attempts + 1,
                     updated_at = NOW()
                 WHERE id = :id',
                [
                    'status' => $subscription_status,
                    'id' => $subscription_id,
                ]
            );
        }

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['ok' => true, 'request_id' => $token, 'status' => $status];
    } catch (Throwable $error) {
        if ($owns_transaction) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_store_recent_sync_rows(int $limit = 25): array
{
    if (!raidlands_db_is_configured()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        "SELECT e.*, p.steam_id64, sp.name, sp.slug
         FROM entitlements e
         INNER JOIN players p ON p.id = e.player_id
         INNER JOIN store_products sp ON sp.id = e.product_id
         ORDER BY e.changed_at DESC, e.id DESC
         LIMIT " . max(1, min(100, $limit))
    );

    $groups_by_product = raidlands_store_fulfillment_groups_for_products(array_map(
        static fn (array $row): int => (int) ($row['product_id'] ?? 0),
        $rows
    ));

    foreach ($rows as &$row) {
        $product_id = (int) ($row['product_id'] ?? 0);
        $groups = $groups_by_product[$product_id] ?? [];
        $fallback_group = raidlands_store_clean_group($row['oxide_group'] ?? '');

        if ($groups === [] && $fallback_group !== '') {
            $groups = [$fallback_group];
        }

        $row['fulfillment_groups'] = $groups;
        $row['oxide_group'] = $groups[0] ?? $fallback_group;
    }
    unset($row);

    return $rows;
}

function raidlands_store_managed_groups(): array
{
    global $vip_bridge_config;

    $groups = array_values(array_filter(array_map('raidlands_store_clean_group', (array) ($vip_bridge_config['managedGroups'] ?? []))));
    $deleted_groups = [];

    if (raidlands_db_is_configured()) {
        try {
            $rows = raidlands_db_fetch_all("SELECT DISTINCT oxide_group FROM store_products WHERE oxide_group <> ''");

            foreach ($rows as $row) {
                $group = raidlands_store_clean_group($row['oxide_group'] ?? '');

                if ($group !== '') {
                    $groups[] = $group;
                }
            }
        } catch (Throwable $error) {
            // Keep config groups if the database is not migrated yet.
        }

        try {
            $rows = raidlands_db_fetch_all(
                'SELECT DISTINCT oxide_group
                 FROM product_fulfillment_actions
                 WHERE action_type = "grant_group"
                   AND oxide_group <> ""'
            );

            foreach ($rows as $row) {
                $group = raidlands_store_clean_group($row['oxide_group'] ?? '');

                if ($group !== '') {
                    $groups[] = $group;
                }
            }
        } catch (Throwable $error) {
            // Older installs can rely on the legacy product group column.
        }

        try {
            $rows = raidlands_db_fetch_all(
                "SELECT group_name
                 FROM oxide_groups
                 WHERE is_active = 1
                   AND deleted_at IS NULL
                   AND is_read_only = 0
                   AND category IN ('vip', 'perk', 'store')"
            );

            foreach ($rows as $row) {
                $group = raidlands_store_clean_group($row['group_name'] ?? '');

                if ($group !== '') {
                    $groups[] = $group;
                }
            }
        } catch (Throwable $error) {
            // Permission catalog is optional for older installs.
        }

        try {
            $rows = raidlands_db_fetch_all(
                "SELECT group_name
                 FROM oxide_groups
                 WHERE deleted_at IS NOT NULL"
            );

            foreach ($rows as $row) {
                $group = raidlands_store_clean_group($row['group_name'] ?? '');

                if ($group !== '') {
                    $deleted_groups[] = $group;
                }
            }
        } catch (Throwable $error) {
            // Older installs may not have group tombstones yet.
        }
    }

    $deleted_set = array_fill_keys(array_map('strval', $deleted_groups), true);
    $groups = array_values(array_filter(array_unique($groups), static fn (string $group): bool => !isset($deleted_set[$group])));
    sort($groups);

    return $groups;
}

function raidlands_store_load_stripe(): void
{
    $autoload = dirname(__DIR__) . '/vendor/autoload.php';

    if (is_file($autoload)) {
        require_once $autoload;
    }

    if (!class_exists('\Stripe\Stripe')) {
        throw new RuntimeException('Stripe PHP is not installed. Run composer install before enabling checkout.');
    }
}

function raidlands_store_checkout_for_price(int $price_id): string
{
    global $stripe_config;

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['id']) || empty($player['steam_id64'])) {
        throw new RuntimeException('Connect your Steam account before checkout.');
    }

    $secret_key = (string) ($stripe_config['secretKey'] ?? '');

    if ($secret_key === '') {
        throw new RuntimeException('Stripe secret key is not configured.');
    }

    raidlands_store_load_stripe();
    \Stripe\Stripe::setApiKey($secret_key);

    $row = raidlands_db_fetch_one(
        "SELECT
            pr.*,
            p.slug,
            p.name,
            p.product_type,
            p.oxide_group
         FROM store_prices pr
         INNER JOIN store_products p ON p.id = pr.product_id
         WHERE pr.id = :price_id
           AND pr.payment_method = 'stripe'
           AND pr.is_active = 1
           AND p.is_active = 1",
        ['price_id' => $price_id]
    );

    if ($row === null) {
        throw new RuntimeException('That store price is not active.');
    }

    $fulfillment_groups = raidlands_store_effective_fulfillment_groups(
        (int) ($row['product_id'] ?? 0),
        $row['oxide_group'] ?? ''
    );
    $oxide_group = $fulfillment_groups[0] ?? '';

    if ($fulfillment_groups === []) {
        throw new RuntimeException('That product does not have an applied server group configured yet.');
    }

    $stripe_price_id = (string) $row['stripe_price_id'];

    if ($stripe_price_id === '' || str_starts_with($stripe_price_id, 'configure_')) {
        throw new RuntimeException('This product still needs a live Stripe Price ID.');
    }

    $mode = raidlands_store_price_checkout_mode($row);
    $metadata = [
        'player_id' => (string) $player['id'],
        'steam_id64' => (string) $player['steam_id64'],
        'product_id' => (string) $row['product_id'],
        'store_price_id' => (string) $row['id'],
        'purchase_mode' => $mode,
        'oxide_group' => $oxide_group,
        'fulfillment_groups' => implode(',', $fulfillment_groups),
        'access_interval' => (string) ($row['access_interval'] ?? 'one_time'),
        'billing_interval' => (string) ($row['billing_interval'] ?? 'one_time'),
    ];
    $params = [
        'mode' => $mode,
        'client_reference_id' => (string) $player['id'],
        'line_items' => [[
            'price' => $stripe_price_id,
            'quantity' => 1,
        ]],
        'success_url' => raidlands_store_absolute_url('store/success/?session_id={CHECKOUT_SESSION_ID}'),
        'cancel_url' => raidlands_store_absolute_url('store/cancel/'),
        'metadata' => $metadata,
    ];

    if ($mode === 'subscription') {
        $params['subscription_data'] = ['metadata' => $metadata];
    } else {
        $params['payment_intent_data'] = ['metadata' => $metadata];
    }

    $session = \Stripe\Checkout\Session::create($params);
    $session_id = (string) $session->id;

    raidlands_db_execute(
        "INSERT INTO orders
            (player_id, product_id, store_price_id, stripe_checkout_session_id, mode, status, amount_total_cents, currency)
         VALUES
            (:player_id, :product_id, :store_price_id, :session_id, :mode, 'pending', :amount, :currency)
         ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = NOW()",
        [
            'player_id' => (int) $player['id'],
            'product_id' => (int) $row['product_id'],
            'store_price_id' => (int) $row['id'],
            'session_id' => $session_id,
            'mode' => $mode,
            'amount' => (int) $row['amount_cents'],
            'currency' => (string) $row['currency'],
        ]
    );

    return (string) $session->url;
}

function raidlands_store_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function raidlands_store_expire_stale_entitlements(): void
{
    if (!raidlands_db_is_configured()) {
        return;
    }

    try {
        raidlands_db_execute(
            "UPDATE entitlements
             SET status = 'expired', changed_at = NOW(), updated_at = NOW()
             WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= NOW()"
        );
    } catch (Throwable $error) {
        // Expiration is opportunistic; callers should still return available state.
    }
}

function raidlands_store_product_by_id(int $product_id): ?array
{
    return raidlands_db_fetch_one(
        'SELECT * FROM store_products WHERE id = :product_id',
        ['product_id' => $product_id]
    );
}

function raidlands_store_grant_entitlement(
    int $player_id,
    int $product_id,
    string $source_type,
    string $source_id,
    ?string $ends_at = null
): void {
    $product = raidlands_store_product_by_id($product_id);

    if ($product === null) {
        throw new RuntimeException('Product could not be found for entitlement grant.');
    }

    $fulfillment_groups = raidlands_store_effective_fulfillment_groups($product_id, $product['oxide_group'] ?? '');
    $oxide_group = $fulfillment_groups[0] ?? '';

    if ($fulfillment_groups === []) {
        throw new RuntimeException('Product does not have any applied server groups configured.');
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        if (raidlands_store_normalize_product_type((string) $product['product_type']) === 'kit_bundle' && empty($product['is_stackable'])) {
            $revoke = $pdo->prepare(
                "UPDATE entitlements e
                 INNER JOIN store_products p ON p.id = e.product_id
                 SET e.status = 'revoked', e.changed_at = NOW(), e.updated_at = NOW()
                 WHERE e.player_id = :player_id
                    AND e.status = 'active'
                    AND p.product_type IN ('kit_bundle', 'vip_subscription')
                    AND p.is_stackable = 0
                    AND e.product_id <> :product_id"
            );
            $revoke->execute([
                'player_id' => $player_id,
                'product_id' => $product_id,
            ]);
        }

        $grant = $pdo->prepare(
            "INSERT INTO entitlements
                (player_id, product_id, source_type, source_id, oxide_group, status, starts_at, ends_at, changed_at)
             VALUES
                (:player_id, :product_id, :source_type, :source_id, :oxide_group, 'active', NOW(), :ends_at, NOW())
             ON DUPLICATE KEY UPDATE
                oxide_group = VALUES(oxide_group),
                status = 'active',
                starts_at = COALESCE(starts_at, NOW()),
                ends_at = VALUES(ends_at),
                changed_at = NOW(),
                updated_at = NOW()"
        );
        $grant->execute([
            'player_id' => $player_id,
            'product_id' => $product_id,
            'source_type' => $source_type,
            'source_id' => $source_id,
            'oxide_group' => $oxide_group,
            'ends_at' => $ends_at,
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }
    } catch (Throwable $error) {
        if ($owns_transaction) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_store_revoke_entitlements(string $source_type, string $source_id): void
{
    raidlands_db_execute(
        "UPDATE entitlements
         SET status = 'revoked', changed_at = NOW(), updated_at = NOW()
         WHERE source_type = :source_type AND source_id = :source_id AND status IN ('pending', 'active')",
        [
            'source_type' => $source_type,
            'source_id' => $source_id,
        ]
    );
}

function raidlands_store_timestamp($value): ?string
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        return null;
    }

    return gmdate('Y-m-d H:i:s', (int) $value);
}

function raidlands_store_metadata(array $object): array
{
    $metadata = $object['metadata'] ?? [];

    if (is_object($metadata)) {
        $metadata = (array) $metadata;
    }

    if (!is_array($metadata)) {
        return [];
    }

    return $metadata;
}

function raidlands_store_stripe_metadata_ids(array $metadata): array
{
    return [
        'player_id' => (int) ($metadata['player_id'] ?? 0),
        'product_id' => (int) ($metadata['product_id'] ?? 0),
        'store_price_id' => (int) ($metadata['store_price_id'] ?? 0),
        'steam_id64' => (string) ($metadata['steam_id64'] ?? ''),
    ];
}

function raidlands_store_record_stripe_event(array $event, string $payload): bool
{
    $event_id = (string) ($event['id'] ?? '');

    if ($event_id === '') {
        throw new RuntimeException('Stripe event id is missing.');
    }

    try {
        raidlands_db_execute(
            'INSERT INTO stripe_events (stripe_event_id, event_type, payload_json) VALUES (:event_id, :event_type, :payload)',
            [
                'event_id' => $event_id,
                'event_type' => (string) ($event['type'] ?? ''),
                'payload' => $payload,
            ]
        );

        return true;
    } catch (Throwable $error) {
        if (str_contains(strtolower($error->getMessage()), 'duplicate')) {
            return false;
        }

        throw $error;
    }
}

function raidlands_store_handle_stripe_webhook(string $payload, string $signature): array
{
    global $stripe_config;

    raidlands_store_load_stripe();

    $webhook_secret = (string) ($stripe_config['webhookSecret'] ?? '');

    if ($webhook_secret === '') {
        throw new RuntimeException('Stripe webhook secret is not configured.');
    }

    $event = \Stripe\Webhook::constructEvent($payload, $signature, $webhook_secret);
    $event_array = $event->toArray(true);

    if (!raidlands_store_record_stripe_event($event_array, $payload)) {
        return ['ok' => true, 'duplicate' => true];
    }

    $type = (string) ($event_array['type'] ?? '');
    $object = $event_array['data']['object'] ?? [];

    if (!is_array($object)) {
        return ['ok' => true, 'ignored' => $type];
    }

    match ($type) {
        'checkout.session.completed' => raidlands_store_handle_checkout_completed($object),
        'invoice.paid' => raidlands_store_handle_invoice_paid($object),
        'invoice.payment_failed' => raidlands_store_handle_invoice_failed($object),
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted' => raidlands_store_handle_subscription_changed($object),
        'charge.refunded',
        'refund.created',
        'charge.dispute.created' => raidlands_store_handle_refund_or_dispute($object),
        default => null,
    };

    return ['ok' => true, 'type' => $type];
}

function raidlands_store_handle_checkout_completed(array $session): void
{
    $metadata = raidlands_store_metadata($session);
    $ids = raidlands_store_stripe_metadata_ids($metadata);
    $session_id = (string) ($session['id'] ?? '');
    $mode = (string) ($session['mode'] ?? $metadata['purchase_mode'] ?? 'payment');
    $subscription_id = (string) ($session['subscription'] ?? '');
    $payment_intent_id = (string) ($session['payment_intent'] ?? '');
    $customer_id = (string) ($session['customer'] ?? '');

    if ($ids['player_id'] <= 0 || $ids['product_id'] <= 0 || $ids['store_price_id'] <= 0 || $session_id === '') {
        return;
    }

    raidlands_db_execute(
        "INSERT INTO orders
            (player_id, product_id, store_price_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, mode, status, amount_total_cents, currency, paid_at)
         VALUES
            (:player_id, :product_id, :store_price_id, :session_id, :payment_intent_id, :customer_id, :mode, 'paid', :amount, :currency, NOW())
         ON DUPLICATE KEY UPDATE
            stripe_payment_intent_id = VALUES(stripe_payment_intent_id),
            stripe_customer_id = VALUES(stripe_customer_id),
            status = 'paid',
            paid_at = COALESCE(paid_at, NOW()),
            updated_at = NOW()",
        [
            'player_id' => $ids['player_id'],
            'product_id' => $ids['product_id'],
            'store_price_id' => $ids['store_price_id'],
            'session_id' => $session_id,
            'payment_intent_id' => $payment_intent_id,
            'customer_id' => $customer_id,
            'mode' => $mode === 'subscription' ? 'subscription' : 'payment',
            'amount' => (int) ($session['amount_total'] ?? 0),
            'currency' => (string) ($session['currency'] ?? 'usd'),
        ]
    );

    if ($mode === 'subscription' && $subscription_id !== '') {
        raidlands_db_execute(
            "INSERT INTO subscriptions
                (player_id, product_id, store_price_id, stripe_subscription_id, stripe_customer_id, status)
             VALUES
                (:player_id, :product_id, :store_price_id, :subscription_id, :customer_id, 'active')
             ON DUPLICATE KEY UPDATE
                player_id = VALUES(player_id),
                product_id = VALUES(product_id),
                store_price_id = VALUES(store_price_id),
                stripe_customer_id = VALUES(stripe_customer_id),
                status = 'active',
                updated_at = NOW()",
            [
                'player_id' => $ids['player_id'],
                'product_id' => $ids['product_id'],
                'store_price_id' => $ids['store_price_id'],
                'subscription_id' => $subscription_id,
                'customer_id' => $customer_id,
            ]
        );
        return;
    }

    $price = raidlands_db_fetch_one(
        'SELECT access_duration_seconds
         FROM store_prices
         WHERE id = :price_id',
        ['price_id' => $ids['store_price_id']]
    );
    $ends_at = $price === null
        ? null
        : raidlands_store_access_ends_at((int) ($price['access_duration_seconds'] ?? 0));

    raidlands_store_grant_entitlement($ids['player_id'], $ids['product_id'], 'order', $session_id, $ends_at);
}

function raidlands_store_handle_invoice_paid(array $invoice): void
{
    $subscription_id = (string) ($invoice['subscription'] ?? '');

    if ($subscription_id === '') {
        return;
    }

    $subscription = raidlands_db_fetch_one(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = :subscription_id',
        ['subscription_id' => $subscription_id]
    );

    if ($subscription === null) {
        return;
    }

    $period_end = raidlands_store_timestamp($invoice['period_end'] ?? null);

    raidlands_db_execute(
        "UPDATE subscriptions
         SET status = 'active',
             current_period_start = COALESCE(:period_start, current_period_start),
             current_period_end = COALESCE(:period_end, current_period_end),
             updated_at = NOW()
         WHERE stripe_subscription_id = :subscription_id",
        [
            'period_start' => raidlands_store_timestamp($invoice['period_start'] ?? null),
            'period_end' => $period_end,
            'subscription_id' => $subscription_id,
        ]
    );

    raidlands_store_grant_entitlement(
        (int) $subscription['player_id'],
        (int) $subscription['product_id'],
        'subscription',
        $subscription_id,
        $period_end
    );
}

function raidlands_store_handle_invoice_failed(array $invoice): void
{
    $subscription_id = (string) ($invoice['subscription'] ?? '');

    if ($subscription_id === '') {
        return;
    }

    raidlands_db_execute(
        "UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE stripe_subscription_id = :subscription_id",
        ['subscription_id' => $subscription_id]
    );
}

function raidlands_store_handle_subscription_changed(array $subscription): void
{
    $subscription_id = (string) ($subscription['id'] ?? '');

    if ($subscription_id === '') {
        return;
    }

    $metadata = raidlands_store_metadata($subscription);
    $ids = raidlands_store_stripe_metadata_ids($metadata);
    $status = (string) ($subscription['status'] ?? 'unknown');
    $period_end = raidlands_store_timestamp($subscription['current_period_end'] ?? null);

    $existing = raidlands_db_fetch_one(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = :subscription_id',
        ['subscription_id' => $subscription_id]
    );

    if ($existing === null && $ids['player_id'] > 0 && $ids['product_id'] > 0 && $ids['store_price_id'] > 0) {
        raidlands_db_execute(
            "INSERT INTO subscriptions
                (player_id, product_id, store_price_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at)
             VALUES
                (:player_id, :product_id, :store_price_id, :subscription_id, :customer_id, :status, :period_start, :period_end, :cancel_at_period_end, :canceled_at)",
            [
                'player_id' => $ids['player_id'],
                'product_id' => $ids['product_id'],
                'store_price_id' => $ids['store_price_id'],
                'subscription_id' => $subscription_id,
                'customer_id' => (string) ($subscription['customer'] ?? ''),
                'status' => $status,
                'period_start' => raidlands_store_timestamp($subscription['current_period_start'] ?? null),
                'period_end' => $period_end,
                'cancel_at_period_end' => !empty($subscription['cancel_at_period_end']) ? 1 : 0,
                'canceled_at' => raidlands_store_timestamp($subscription['canceled_at'] ?? null),
            ]
        );
        $existing = raidlands_db_fetch_one(
            'SELECT * FROM subscriptions WHERE stripe_subscription_id = :subscription_id',
            ['subscription_id' => $subscription_id]
        );
    } elseif ($existing !== null) {
        raidlands_db_execute(
            "UPDATE subscriptions
             SET status = :status,
                 stripe_customer_id = :customer_id,
                 current_period_start = COALESCE(:period_start, current_period_start),
                 current_period_end = COALESCE(:period_end, current_period_end),
                 cancel_at_period_end = :cancel_at_period_end,
                 canceled_at = COALESCE(:canceled_at, canceled_at),
                 updated_at = NOW()
             WHERE stripe_subscription_id = :subscription_id",
            [
                'status' => $status,
                'customer_id' => (string) ($subscription['customer'] ?? ''),
                'period_start' => raidlands_store_timestamp($subscription['current_period_start'] ?? null),
                'period_end' => $period_end,
                'cancel_at_period_end' => !empty($subscription['cancel_at_period_end']) ? 1 : 0,
                'canceled_at' => raidlands_store_timestamp($subscription['canceled_at'] ?? null),
                'subscription_id' => $subscription_id,
            ]
        );
    }

    $current = $existing ?? raidlands_db_fetch_one(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = :subscription_id',
        ['subscription_id' => $subscription_id]
    );

    if ($current === null) {
        return;
    }

    if (in_array($status, ['active', 'trialing'], true)) {
        raidlands_store_grant_entitlement(
            (int) $current['player_id'],
            (int) $current['product_id'],
            'subscription',
            $subscription_id,
            $period_end
        );
        return;
    }

    if (in_array($status, ['canceled', 'unpaid', 'incomplete_expired'], true)) {
        raidlands_store_revoke_entitlements('subscription', $subscription_id);
    }
}

function raidlands_store_handle_refund_or_dispute(array $object): void
{
    $payment_intent = (string) ($object['payment_intent'] ?? '');

    if ($payment_intent === '' && isset($object['charge'])) {
        $payment_intent = (string) $object['charge'];
    }

    if ($payment_intent === '') {
        return;
    }

    $order = raidlands_db_fetch_one(
        'SELECT * FROM orders WHERE stripe_payment_intent_id = :payment_intent',
        ['payment_intent' => $payment_intent]
    );

    if ($order === null) {
        return;
    }

    raidlands_db_execute(
        "UPDATE orders SET status = 'refunded', refunded_at = NOW(), updated_at = NOW() WHERE id = :id",
        ['id' => (int) $order['id']]
    );
    raidlands_store_revoke_entitlements('order', (string) $order['stripe_checkout_session_id']);
}

function raidlands_bridge_body_hash(string $body): string
{
    return hash('sha256', $body);
}

function raidlands_bridge_payload(string $method, string $request_uri, string $timestamp, string $body): string
{
    return strtoupper($method) . "\n" . $request_uri . "\n" . $timestamp . "\n" . raidlands_bridge_body_hash($body);
}

function raidlands_bridge_authorize(string $body = ''): void
{
    global $vip_bridge_config;

    $shared_secret = (string) ($vip_bridge_config['sharedSecret'] ?? '');

    if ($shared_secret === '') {
        raidlands_store_json_response(['ok' => false, 'error' => 'Bridge secret is not configured.'], 503);
    }

    $server_id = (string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? '');
    $timestamp = (string) ($_SERVER['HTTP_X_RAIDLANDS_TIMESTAMP'] ?? '');
    $signature = (string) ($_SERVER['HTTP_X_RAIDLANDS_SIGNATURE'] ?? '');
    $expected_server = (string) ($vip_bridge_config['serverId'] ?? '');

    if ($expected_server !== '' && !hash_equals($expected_server, $server_id)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Unknown bridge server.'], 401);
    }

    if ($timestamp === '' || $signature === '' || !ctype_digit($timestamp)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Missing bridge authentication headers.'], 401);
    }

    $skew = (int) ($vip_bridge_config['hmacSkewSeconds'] ?? 300);

    if (abs(time() - (int) $timestamp) > max(60, $skew)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Bridge timestamp is outside the allowed window.'], 401);
    }

    $payload = raidlands_bridge_payload(
        (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'),
        (string) ($_SERVER['REQUEST_URI'] ?? ''),
        $timestamp,
        $body
    );
    $expected = hash_hmac('sha256', $payload, $shared_secret);

    if (!hash_equals($expected, $signature)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Bridge signature was not accepted.'], 401);
    }
}

function raidlands_store_active_groups_for_steam(string $steam_id64): array
{
    raidlands_store_expire_stale_entitlements();

    $player = raidlands_db_fetch_one(
        'SELECT id, steam_id64, display_name FROM players WHERE steam_id64 = :steam_id64',
        ['steam_id64' => $steam_id64]
    );

    if ($player === null) {
        return [
            'player' => null,
            'groups' => [],
            'entitlements' => [],
            'cursor' => time(),
        ];
    }

    $rows = raidlands_db_fetch_all(
        "SELECT e.id, e.product_id, e.oxide_group, e.ends_at, e.changed_at, p.slug, p.name, p.product_type
         FROM entitlements e
         INNER JOIN store_products p ON p.id = e.product_id
         WHERE e.player_id = :player_id
            AND e.status = 'active'
            AND (e.ends_at IS NULL OR e.ends_at > NOW())
         ORDER BY p.product_type ASC, p.tier_priority DESC, p.sort_order ASC",
        ['player_id' => (int) $player['id']]
    );

    $groups_by_product = raidlands_store_fulfillment_groups_for_products(array_map(
        static fn (array $row): int => (int) ($row['product_id'] ?? 0),
        $rows
    ));
    $groups = [];

    foreach ($rows as &$row) {
        $product_id = (int) ($row['product_id'] ?? 0);
        $row_groups = $groups_by_product[$product_id] ?? [];
        $fallback_group = raidlands_store_clean_group($row['oxide_group'] ?? '');

        if ($row_groups === [] && $fallback_group !== '') {
            $row_groups = [$fallback_group];
        }

        $row['fulfillment_groups'] = $row_groups;
        $row['oxide_group'] = $row_groups[0] ?? $fallback_group;

        foreach ($row_groups as $group) {
            if ($group !== '') {
                $groups[] = $group;
            }
        }
    }
    unset($row);

    return [
        'player' => $player,
        'groups' => array_values(array_unique($groups)),
        'entitlements' => $rows,
        'cursor' => time(),
    ];
}

function raidlands_store_bridge_changes(int $since): array
{
    raidlands_store_expire_stale_entitlements();
    $since = max(0, $since);

    if ($since === 0) {
        $players = raidlands_db_fetch_all(
            "SELECT DISTINCT p.steam_id64
             FROM players p
             INNER JOIN entitlements e ON e.player_id = p.id"
        );
    } else {
        $players = raidlands_db_fetch_all(
            "SELECT DISTINCT p.steam_id64
             FROM players p
             INNER JOIN entitlements e ON e.player_id = p.id
             WHERE UNIX_TIMESTAMP(e.changed_at) > :since",
            ['since' => $since]
        );
    }

    $states = [];

    foreach ($players as $player) {
        $steam_id64 = (string) $player['steam_id64'];
        $state = raidlands_store_active_groups_for_steam($steam_id64);
        $states[] = [
            'steam_id64' => $steam_id64,
            'groups' => $state['groups'],
            'entitlements' => $state['entitlements'],
        ];
    }

    return [
        'players' => $states,
        'cursor' => time(),
    ];
}

function raidlands_store_admin_product_rows(): array
{
    if (!raidlands_db_is_configured()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        'SELECT p.*
         FROM store_products p
         ORDER BY p.sort_order ASC, p.id ASC'
    );

    $product_ids = array_values(array_filter(array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows)));

    if ($product_ids === []) {
        return $rows;
    }

    [$placeholders, $params] = raidlands_store_sql_in_params($product_ids, 'product_id');
    $price_rows = raidlands_db_fetch_all(
        'SELECT *
         FROM store_prices
         WHERE product_id IN (' . implode(', ', $placeholders) . ')
         ORDER BY product_id ASC, payment_method ASC, billing_interval ASC, access_duration_seconds ASC, id ASC',
        $params
    );
    $fulfillment_rows = [];

    try {
        $fulfillment_rows = raidlands_db_fetch_all(
            'SELECT product_id, oxide_group, sort_order
             FROM product_fulfillment_actions
             WHERE product_id IN (' . implode(', ', $placeholders) . ')
               AND action_type = "grant_group"
               AND oxide_group <> ""
             ORDER BY product_id ASC, sort_order ASC, id ASC',
            $params
        );
    } catch (Throwable $error) {
        $fulfillment_rows = [];
    }

    $rp_by_product = [];
    $cash_pass_by_product = [];
    $cash_subscription_by_product = [];
    $fulfillment_groups_by_product = [];

    foreach ($price_rows as $price_row) {
        $product_id = (int) $price_row['product_id'];
        $payment_method = (string) ($price_row['payment_method'] ?? 'stripe');
        $billing_interval = (string) ($price_row['billing_interval'] ?? 'one_time');
        $access_interval = (string) ($price_row['access_interval'] ?? 'one_time');

        if ($payment_method === 'rp') {
            $rp_by_product[$product_id][$access_interval] = $price_row;
        } elseif ($billing_interval === 'one_time') {
            $cash_pass_by_product[$product_id][$access_interval] = $price_row;
        } else {
            $cash_subscription_by_product[$product_id][$billing_interval] = $price_row;
        }
    }

    foreach ($fulfillment_rows as $fulfillment_row) {
        $group = raidlands_store_clean_group($fulfillment_row['oxide_group'] ?? '');

        if ($group !== '') {
            $fulfillment_groups_by_product[(int) $fulfillment_row['product_id']][] = $group;
        }
    }

    foreach ($rows as &$row) {
        $product_id = (int) ($row['id'] ?? 0);
        $fulfillment_groups = array_values(array_unique($fulfillment_groups_by_product[$product_id] ?? []));

        if ($fulfillment_groups === []) {
            $fulfillment_groups = raidlands_store_clean_groups([$row['oxide_group'] ?? '']);
        }

        $row['product_type'] = raidlands_store_normalize_product_type((string) ($row['product_type'] ?? 'perk'));
        $row['fulfillment_groups'] = $fulfillment_groups;
        $row['oxide_group'] = $fulfillment_groups[0] ?? raidlands_store_clean_group($row['oxide_group'] ?? '');
        $row['rp_prices'] = $rp_by_product[$product_id] ?? [];
        $row['cash_pass_prices'] = $cash_pass_by_product[$product_id] ?? [];
        $row['cash_subscription_prices'] = $cash_subscription_by_product[$product_id] ?? [];
    }
    unset($row);

    return $rows;
}

function raidlands_store_admin_price_intervals(string $product_type): array
{
    return raidlands_store_offer_intervals(true);
}

function raidlands_store_admin_subscription_intervals(): array
{
    return raidlands_store_offer_intervals(false);
}

function raidlands_store_admin_clean_fulfillment_groups($values, string $product_name): array
{
    if (!is_array($values)) {
        $values = [$values];
    }

    $groups = [];
    $seen = [];

    foreach ($values as $value) {
        if (is_array($value)) {
            foreach (raidlands_store_admin_clean_fulfillment_groups($value, $product_name) as $nested_group) {
                if (!isset($seen[$nested_group])) {
                    $seen[$nested_group] = true;
                    $groups[] = $nested_group;
                }
            }

            continue;
        }

        $raw_group = trim((string) $value);

        if ($raw_group === '') {
            continue;
        }

        $group = raidlands_store_clean_group($raw_group);

        if ($group === '') {
            throw new InvalidArgumentException('Store product "' . $product_name . '" has an invalid applied server group. ' . raidlands_store_group_rule_hint());
        }

        if (!isset($seen[$group])) {
            $seen[$group] = true;
            $groups[] = $group;
        }
    }

    return $groups;
}

function raidlands_store_admin_valid_fulfillment_group_map(): ?array
{
    if (!function_exists('raidlands_permissions_group_names')) {
        return null;
    }

    try {
        $groups = raidlands_permissions_group_names(false);
    } catch (Throwable $error) {
        return null;
    }

    $map = [];

    foreach ($groups as $group) {
        $group = raidlands_store_clean_group($group);

        if ($group !== '') {
            $map[$group] = true;
        }
    }

    return $map;
}

function raidlands_store_admin_validate_fulfillment_groups(array $groups, string $product_name): void
{
    $valid_groups = raidlands_store_admin_valid_fulfillment_group_map();

    if ($valid_groups === null) {
        return;
    }

    $invalid_groups = [];

    foreach ($groups as $group) {
        if (!isset($valid_groups[$group])) {
            $invalid_groups[] = $group;
        }
    }

    if ($invalid_groups !== []) {
        throw new InvalidArgumentException(
            'Active store product "' . $product_name . '" uses unavailable applied group(s): '
            . implode(', ', $invalid_groups)
            . '. Create and activate those groups in Groups first.'
        );
    }
}

function raidlands_store_admin_touch_product_entitlements(PDO $pdo, int $product_id, string $primary_group): void
{
    if ($product_id <= 0) {
        return;
    }

    try {
        $statement = $pdo->prepare(
            "UPDATE entitlements
             SET oxide_group = :oxide_group,
                 changed_at = NOW(),
                 updated_at = NOW()
             WHERE product_id = :product_id
               AND status IN ('pending', 'active')"
        );
        $statement->execute([
            'oxide_group' => $primary_group,
            'product_id' => $product_id,
        ]);
    } catch (Throwable $error) {
        // Older installs may not have entitlements yet.
    }
}

function raidlands_store_admin_group_category(string $product_type, string $group): string
{
    $product_type = raidlands_store_normalize_product_type($product_type);

    if ($product_type === 'kit_bundle' || str_starts_with($group, 'vip_') || str_starts_with($group, 'bundle_')) {
        return 'store';
    }

    if (str_starts_with($group, 'perk_') || $product_type === 'perk') {
        return 'perk';
    }

    return 'store';
}

function raidlands_store_admin_sync_product_groups(
    PDO $pdo,
    int $product_id,
    array $groups,
    string $product_type,
    string $name,
    int $tier_priority,
    int $sort_order
): void {
    $groups = raidlands_store_clean_groups($groups);

    try {
        $pdo->prepare(
            'DELETE FROM product_fulfillment_actions
             WHERE product_id = :product_id AND action_type = "grant_group"'
        )->execute(['product_id' => $product_id]);

        if ($groups !== []) {
            $statement = $pdo->prepare(
                'INSERT INTO product_fulfillment_actions (product_id, action_type, oxide_group, sort_order)
                 VALUES (:product_id, "grant_group", :oxide_group, :sort_order)
                 ON DUPLICATE KEY UPDATE oxide_group = VALUES(oxide_group), sort_order = VALUES(sort_order), updated_at = NOW()'
            );

            foreach ($groups as $index => $group) {
                $statement->execute([
                    'product_id' => $product_id,
                    'oxide_group' => $group,
                    'sort_order' => ($index + 1) * 10,
                ]);
            }
        }
    } catch (Throwable $error) {
        // Older installs may not have the legacy fulfillment mirror yet. The product row remains authoritative.
    }

    if (
        $groups === []
        || !function_exists('raidlands_permissions_is_ready')
        || !function_exists('raidlands_permissions_upsert_group')
        || !raidlands_permissions_is_ready()
    ) {
        return;
    }

    foreach ($groups as $index => $group) {
        $category = raidlands_store_admin_group_category($product_type, $group);
        $existing = raidlands_db_fetch_one(
            'SELECT id, is_read_only
             FROM oxide_groups
             WHERE group_name = :group_name',
            ['group_name' => $group]
        );

        if ($existing !== null) {
            if (empty($existing['is_read_only'])) {
                raidlands_db_execute(
                    'UPDATE oxide_groups
                     SET is_managed = 1,
                         is_active = 1,
                         category = CASE WHEN category IN ("", "custom", "snapshot") THEN :category ELSE category END,
                         deleted_at = NULL,
                         deleted_revision = 0,
                         updated_at = NOW()
                     WHERE id = :id',
                    [
                        'category' => $category,
                        'id' => (int) $existing['id'],
                    ]
                );
            }

            continue;
        }

        raidlands_permissions_upsert_group($pdo, [
            'group_name' => $group,
            'title' => $group,
            'rank' => raidlands_store_normalize_product_type($product_type) === 'kit_bundle' ? $tier_priority : 0,
            'parent_group' => '',
            'category' => $category,
            'is_managed' => 1,
            'is_protected' => 0,
            'is_active' => 1,
            'sort_order' => $sort_order + ($index * 10),
            'notes' => trim('Store product: ' . $name),
        ], false);
    }
}

function raidlands_store_admin_offer_placeholder(string $slug, string $kind, string $interval): string
{
    if ($kind === 'rp') {
        return 'rp_' . $slug . '_' . $interval;
    }

    return 'configure_' . $slug . '_' . $kind . '_' . $interval;
}

function raidlands_store_admin_offer_default_label(string $kind, string $interval): string
{
    $interval_label = raidlands_store_access_interval_label($interval);

    return match ($kind) {
        'rp' => $interval === 'one_time' ? 'Lifetime RP Unlock' : $interval_label . ' RP Pass',
        'cash_sub' => $interval_label . ' Cash Subscription',
        default => $interval === 'one_time' ? 'Lifetime Cash Pass' : $interval_label . ' Cash Pass',
    };
}

function raidlands_store_admin_save_offer_price(PDO $pdo, int $product_id, string $slug, string $kind, string $interval, array $row): void
{
    $allowed = $kind === 'cash_sub'
        ? raidlands_store_admin_subscription_intervals()
        : raidlands_store_offer_intervals(true);

    if (!in_array($interval, $allowed, true)) {
        return;
    }

    $price_id = (int) ($row['id'] ?? 0);
    $duration = raidlands_store_access_duration_seconds($interval);
    $label = trim(strip_tags((string) ($row['label'] ?? '')));

    if ($label === '') {
        $label = raidlands_store_admin_offer_default_label($kind, $interval);
    }

    $is_rp = $kind === 'rp';
    $is_subscription = $kind === 'cash_sub';
    $stripe_price_id = $is_rp
        ? raidlands_store_admin_offer_placeholder($slug, 'rp', $interval)
        : trim(strip_tags((string) ($row['stripe_price_id'] ?? '')));

    if ($stripe_price_id === '') {
        $stripe_price_id = raidlands_store_admin_offer_placeholder($slug, $kind, $interval);
    }

    $price = [
        'product_id' => $product_id,
        'payment_method' => $is_rp ? 'rp' : 'stripe',
        'stripe_price_id' => $stripe_price_id,
        'label' => mb_substr($label, 0, 120),
        'amount_cents' => $is_rp ? 0 : max(0, (int) round(((float) ($row['amount_dollars'] ?? 0)) * 100)),
        'currency' => $is_rp ? 'rp' : (strtolower(mb_substr(trim((string) ($row['currency'] ?? 'usd')), 0, 3)) ?: 'usd'),
        'rp_cost' => $is_rp ? max(0, (int) ($row['rp_cost'] ?? 0)) : 0,
        'billing_interval' => $is_subscription ? $interval : 'one_time',
        'access_interval' => $interval,
        'access_duration_seconds' => $duration,
        'allow_auto_renew' => $is_rp && $interval !== 'one_time' && $duration > 0 && !empty($row['allow_auto_renew']) ? 1 : 0,
        'is_active' => empty($row['is_active']) ? 0 : 1,
        'is_default' => !$is_rp && !$is_subscription && $interval === 'one_time' ? 1 : 0,
    ];

    if ($price_id > 0) {
        $price['id'] = $price_id;
        $statement = $pdo->prepare(
            'UPDATE store_prices
             SET payment_method = :payment_method,
                 stripe_price_id = :stripe_price_id,
                 label = :label,
                 amount_cents = :amount_cents,
                 currency = :currency,
                 rp_cost = :rp_cost,
                 billing_interval = :billing_interval,
                 access_interval = :access_interval,
                 access_duration_seconds = :access_duration_seconds,
                 allow_auto_renew = :allow_auto_renew,
                 is_active = :is_active,
                 is_default = :is_default,
                 updated_at = NOW()
             WHERE id = :id'
        );
        unset($price['product_id']);
        $statement->execute($price);
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO store_prices
            (product_id, payment_method, stripe_price_id, label, amount_cents, currency, rp_cost, billing_interval, access_interval, access_duration_seconds, allow_auto_renew, is_active, is_default)
         VALUES
            (:product_id, :payment_method, :stripe_price_id, :label, :amount_cents, :currency, :rp_cost, :billing_interval, :access_interval, :access_duration_seconds, :allow_auto_renew, :is_active, :is_default)
         ON DUPLICATE KEY UPDATE
            product_id = VALUES(product_id),
            payment_method = VALUES(payment_method),
            label = VALUES(label),
            amount_cents = VALUES(amount_cents),
            currency = VALUES(currency),
            rp_cost = VALUES(rp_cost),
            billing_interval = VALUES(billing_interval),
            access_interval = VALUES(access_interval),
            access_duration_seconds = VALUES(access_duration_seconds),
            allow_auto_renew = VALUES(allow_auto_renew),
            is_active = VALUES(is_active),
            is_default = VALUES(is_default),
            updated_at = NOW()'
    );
    $statement->execute($price);
}

function raidlands_store_admin_save_rp_price(PDO $pdo, int $product_id, string $slug, string $product_type, string $interval, array $row): void
{
    raidlands_store_admin_save_offer_price($pdo, $product_id, $slug, 'rp', $interval, $row);
}

function raidlands_store_admin_save_product_rows($rows): void
{
    $pdo = raidlands_db_required();
    $publish_permissions = false;
    $pdo->beginTransaction();

    try {
        foreach ((array) $rows as $row) {
            $row = is_array($row) ? $row : [];
            $id = (int) ($row['id'] ?? 0);
            $slug = strtolower(trim(preg_replace('/[^a-z0-9-]+/', '-', (string) ($row['slug'] ?? '')), '-'));
            $name = trim(strip_tags((string) ($row['name'] ?? '')));
            $type = raidlands_store_normalize_product_type((string) ($row['product_type'] ?? 'perk'));

            if (!empty($row['delete']) && $id > 0) {
                $statement = $pdo->prepare('UPDATE store_products SET is_active = 0, updated_at = NOW() WHERE id = :id');
                $statement->execute(['id' => $id]);
                $publish_permissions = true;
                continue;
            }

            if ($slug === '' && $name === '') {
                continue;
            }

            if ($slug === '') {
                $slug = strtolower(trim(preg_replace('/[^a-z0-9-]+/', '-', $name), '-'));
            }

            if ($name === '') {
                $name = ucwords(str_replace('-', ' ', $slug));
            }

            $fulfillment_group_input = array_key_exists('fulfillment_groups', $row)
                ? $row['fulfillment_groups']
                : [$row['oxide_group'] ?? ''];
            $fulfillment_groups = raidlands_store_admin_clean_fulfillment_groups($fulfillment_group_input, $name);
            $oxide_group = $fulfillment_groups[0] ?? '';

            if (!empty($row['is_active']) && $fulfillment_groups === []) {
                throw new InvalidArgumentException('Active store product "' . $name . '" needs at least one applied server group.');
            }

            if (!empty($row['is_active'])) {
                raidlands_store_admin_validate_fulfillment_groups($fulfillment_groups, $name);
            }

            $params = [
                'slug' => $slug,
                'name' => mb_substr($name, 0, 160),
                'product_type' => $type,
                'short_description' => mb_substr(trim(strip_tags((string) ($row['short_description'] ?? ''))), 0, 255),
                'description' => trim(strip_tags((string) ($row['description'] ?? ''))),
                'oxide_group' => $oxide_group,
                'tier_priority' => max(0, min(999, (int) ($row['tier_priority'] ?? 0))),
                'is_stackable' => empty($row['is_stackable']) ? 0 : 1,
                'is_active' => empty($row['is_active']) ? 0 : 1,
                'is_featured' => empty($row['is_featured']) ? 0 : 1,
                'sort_order' => max(0, min(9999, (int) ($row['sort_order'] ?? 100))),
            ];

            if ($id > 0) {
                $params['id'] = $id;
                $statement = $pdo->prepare(
                    "UPDATE store_products
                     SET slug = :slug,
                         name = :name,
                         product_type = :product_type,
                         short_description = :short_description,
                         description = :description,
                         oxide_group = :oxide_group,
                         tier_priority = :tier_priority,
                         is_stackable = :is_stackable,
                         is_active = :is_active,
                         is_featured = :is_featured,
                         sort_order = :sort_order,
                         updated_at = NOW()
                     WHERE id = :id"
                );
                $statement->execute($params);
                $product_id = $id;
            } else {
                $statement = $pdo->prepare(
                    "INSERT INTO store_products
                        (slug, name, product_type, short_description, description, oxide_group, tier_priority, is_stackable, is_active, is_featured, sort_order)
                     VALUES
                        (:slug, :name, :product_type, :short_description, :description, :oxide_group, :tier_priority, :is_stackable, :is_active, :is_featured, :sort_order)
                     ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        product_type = VALUES(product_type),
                        short_description = VALUES(short_description),
                        description = VALUES(description),
                        oxide_group = VALUES(oxide_group),
                        tier_priority = VALUES(tier_priority),
                        is_stackable = VALUES(is_stackable),
                        is_active = VALUES(is_active),
                        is_featured = VALUES(is_featured),
                        sort_order = VALUES(sort_order),
                        updated_at = NOW()"
                );
                $statement->execute($params);
                $product_id = (int) ($pdo->lastInsertId() ?: 0);

                if ($product_id === 0) {
                    $lookup = $pdo->prepare('SELECT id FROM store_products WHERE slug = :slug');
                    $lookup->execute(['slug' => $slug]);
                    $product_id = (int) ($lookup->fetchColumn() ?: 0);
                }
            }

            if ($product_id <= 0) {
                continue;
            }

            raidlands_store_admin_sync_product_groups(
                $pdo,
                $product_id,
                $fulfillment_groups,
                $type,
                (string) $params['name'],
                (int) $params['tier_priority'],
                (int) $params['sort_order']
            );
            raidlands_store_admin_touch_product_entitlements($pdo, $product_id, (string) $params['oxide_group']);
            $publish_permissions = true;

            foreach (raidlands_store_offer_intervals(true) as $interval) {
                $rp_rows = (array) ($row['rp_prices'] ?? []);
                raidlands_store_admin_save_offer_price($pdo, $product_id, $slug, 'rp', $interval, (array) ($rp_rows[$interval] ?? []));

                $cash_pass_rows = (array) ($row['cash_pass_prices'] ?? []);
                raidlands_store_admin_save_offer_price($pdo, $product_id, $slug, 'cash_pass', $interval, (array) ($cash_pass_rows[$interval] ?? []));
            }

            foreach (raidlands_store_admin_subscription_intervals() as $interval) {
                $cash_subscription_rows = (array) ($row['cash_subscription_prices'] ?? []);
                raidlands_store_admin_save_offer_price($pdo, $product_id, $slug, 'cash_sub', $interval, (array) ($cash_subscription_rows[$interval] ?? []));
            }

        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    if ($publish_permissions && function_exists('raidlands_permissions_publish_from_related_change')) {
        raidlands_permissions_publish_from_related_change('Published permission sync from store product group changes.');
    }
}

function raidlands_store_admin_manual_grant(string $steam_id64, int $product_id, ?string $ends_at = null): void
{
    $steam_id64 = preg_replace('/\D+/', '', $steam_id64) ?? '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Enter a valid SteamID64 for the manual grant.');
    }

    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO players (steam_id64, last_seen_at)
         VALUES (:steam_id64, NOW())
         ON DUPLICATE KEY UPDATE last_seen_at = NOW(), updated_at = NOW()'
    );
    $statement->execute(['steam_id64' => $steam_id64]);
    $player = raidlands_db_fetch_one(
        'SELECT id FROM players WHERE steam_id64 = :steam_id64',
        ['steam_id64' => $steam_id64]
    );

    if ($player === null || empty($player['id'])) {
        throw new RuntimeException('The player record could not be created.');
    }

    raidlands_store_grant_entitlement((int) $player['id'], $product_id, 'manual', 'admin-' . time(), $ends_at);
}

function raidlands_store_bridge_cursors(): array
{
    if (!raidlands_db_is_configured()) {
        return [];
    }

    return raidlands_db_fetch_all('SELECT * FROM bridge_sync_cursors ORDER BY updated_at DESC');
}
