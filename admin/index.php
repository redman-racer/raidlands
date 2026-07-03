<?php

$page_id = 'admin';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require $site_root . '/includes/admin.php';
require_once $site_root . '/includes/stats.php';
require_once $site_root . '/includes/clans.php';

raidlands_admin_handle_request();

$flash = raidlands_admin_take_flash();
$authenticated = raidlands_admin_is_authenticated();
$admin_user = raidlands_admin_current_user();
$admin_player = raidlands_store_current_player();
$admin_auth_tables_ready = raidlands_admin_auth_tables_ready();
$admin_auth_message = raidlands_admin_auth_message();
$admin_player_name = is_array($admin_player)
    ? trim((string) ($admin_player['display_name'] ?: ($admin_player['steam_display_name'] ?? 'Raidlands Player')))
    : '';
$admin_player_steam_id64 = is_array($admin_player) ? (string) ($admin_player['steam_id64'] ?? '') : '';
$admin_user_role_label = $admin_user !== null && !empty($admin_user['role_names'])
    ? implode(', ', array_map('strval', (array) $admin_user['role_names']))
    : 'Setup Admin';
$csrf = raidlands_admin_csrf_token();
$content = raidlands_admin_current_content();
$admin_site = $content['site_config'];
$admin_page_copy = $content['page_copy'];
$admin_seo_pages = $content['seo_pages'];
$admin_weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
$admin_wipe_days = array_map('intval', $admin_site['wipe']['days'] ?? []);
$admin_sections_all = [
    'identity' => ['label' => 'Identity', 'kicker' => 'Core', 'title' => 'Server Identity', 'summary' => 'Names, fallback status, map, region, and the numbers used when live status is unavailable.'],
    'links' => ['label' => 'Links', 'kicker' => 'Launch', 'title' => 'Links and Integrations', 'summary' => 'Join buttons, Discord invites, BattleMetrics lookup, and future OAuth links.'],
    'wipe' => ['label' => 'Wipe', 'kicker' => 'Schedule', 'title' => 'Wipe Settings', 'summary' => 'The wipe days and time used by countdowns and schedule text.'],
    'features' => ['label' => 'Features', 'kicker' => 'Content', 'title' => 'Feature Lists', 'summary' => 'Homepage feature chips, feature cards, and roadmap cards.'],
    'pages' => ['label' => 'Pages', 'kicker' => 'Copy', 'title' => 'Hero Copy', 'summary' => 'The title and intro text shown at the top of each page.'],
    'seo' => ['label' => 'SEO', 'kicker' => 'Search', 'title' => 'SEO Metadata', 'summary' => 'Browser titles, descriptions, and social sharing copy.'],
    'feedback' => ['label' => 'Feedback', 'kicker' => 'Inbox', 'title' => 'Player Feedback', 'summary' => 'Bug reports, suggestions, and feature requests submitted from the support page.'],
    'store' => ['label' => 'Store', 'kicker' => 'VIP', 'title' => 'Products and Prices', 'summary' => 'VIP tiers, one-time perks, Stripe Price IDs, and managed Oxide groups.'],
    'kits' => ['label' => 'Kits', 'kicker' => 'Loadouts', 'title' => 'Kit Catalog', 'summary' => 'Rust kit contents, images, cooldowns, uses, RP shop rows, and group availability.'],
    'groups' => ['label' => 'Groups', 'kicker' => 'Permissions', 'title' => 'Oxide Groups', 'summary' => 'Website-owned group permissions, live snapshots, and bridge-published revisions.'],
    'grants' => ['label' => 'Grants', 'kicker' => 'Access', 'title' => 'Manual Entitlement Grant', 'summary' => 'Grant a product to a SteamID64 without going through Stripe.'],
    'sync' => ['label' => 'Sync', 'kicker' => 'Bridge', 'title' => 'WebsiteVipBridge State', 'summary' => 'Entitlement sync, stats ingest status, and server API endpoints.'],
];
$admin_sections = $admin_sections_all;

if ($authenticated) {
    $admin_sections = array_filter(
        $admin_sections,
        static fn (array $section, string $key): bool => raidlands_admin_can_view_section($key),
        ARRAY_FILTER_USE_BOTH
    );
}

$requested_section = raidlands_admin_clean_section($_GET['section'] ?? 'identity');
$active_section = $requested_section;
$denied_section = '';

if ($authenticated && $admin_sections === []) {
    $active_section = 'none';
} elseif ($authenticated && !isset($admin_sections[$active_section])) {
    $denied_section = isset($admin_sections_all[$requested_section]) ? $requested_section : '';
    $active_section = (string) array_key_first($admin_sections);
}

$admin_has_visible_sections = !$authenticated || $admin_sections !== [];
$active_meta = $active_section === 'none'
    ? ['label' => 'No Access', 'kicker' => 'Roles', 'title' => 'No Admin Sections Available', 'summary' => 'Your approved Steam account does not have a section permission yet.']
    : ($admin_sections[$active_section]
    ?? $admin_sections_all[$active_section]
    ?? ['label' => 'No Access', 'kicker' => 'Roles', 'title' => 'No Admin Sections Available', 'summary' => 'Your approved Steam account does not have a section permission yet.']);
$admin_store_ready = false;
$admin_store_error = '';
$admin_store_rows = [];
$admin_store_catalog = ['products' => []];
$admin_sync_rows = [];
$admin_feedback_rows = [];
$admin_feedback_counts = [];
$admin_feedback_ready = false;
$admin_feedback_error = '';
$admin_kits_ready = false;
$admin_kits_error = '';
$admin_kit_rows = [];
$admin_kit_groups = [];
$admin_kit_products = [];
$admin_kit_shortnames = [];
$admin_kit_item_catalog = [];
$admin_kit_item_map = [];
$admin_kit_sync_rows = [];
$admin_permissions_ready = false;
$admin_permissions_error = '';
$admin_permission_groups = [];
$admin_permission_options = [];
$admin_permission_sync_rows = [];
$admin_stats_summary = [
    'ready' => false,
    'active_wipe' => null,
    'latest_ingest' => null,
    'current_players' => 0,
];
$admin_clan_summary = [
    'ready' => false,
    'message' => '',
    'clan_count' => 0,
    'member_count' => 0,
    'active_api_keys' => 0,
    'latest_snapshot' => null,
    'latest_action' => null,
    'recent_actions' => [],
];

try {
    $admin_store_ready = raidlands_db_is_configured() && raidlands_db() instanceof PDO;

    if ($active_section === 'store' && $admin_store_ready) {
        $admin_store_rows = raidlands_store_admin_product_rows();
    }

    if (in_array($active_section, ['grants', 'sync'], true)) {
        $admin_store_catalog = raidlands_store_catalog(false);

        if (!empty($admin_store_catalog['setupRequired'])) {
            $admin_store_ready = false;
            $admin_store_error = (string) ($admin_store_catalog['error'] ?? $admin_store_error);
        }
    }

    if ($active_section === 'sync') {
        $admin_clan_summary = raidlands_clans_admin_summary();

        if ($admin_store_ready) {
            $admin_sync_rows = raidlands_store_recent_sync_rows(30);
            $admin_stats_summary = raidlands_stats_admin_summary();
        }
    }

    if ($active_section === 'feedback') {
        $admin_feedback_ready = raidlands_feedback_is_ready();

        if ($admin_feedback_ready) {
            $admin_feedback_rows = raidlands_feedback_submissions();
            $admin_feedback_counts = raidlands_feedback_status_counts($admin_feedback_rows);
        } else {
            $admin_feedback_error = raidlands_feedback_readiness_message(true);
        }
    }

    if ($active_section === 'kits') {
        $admin_kits_ready = raidlands_kits_is_ready();

        if ($admin_kits_ready) {
            $admin_kit_rows = raidlands_kits_admin_rows();
            $admin_kit_groups = raidlands_kits_available_groups();
            $admin_kit_products = raidlands_kits_store_product_options();
            $admin_kit_shortnames = raidlands_kits_known_shortnames();
            $admin_kit_item_catalog = raidlands_kits_item_catalog(true);
            $admin_kit_item_map = raidlands_kits_item_catalog_map(true);
            $admin_kit_sync_rows = raidlands_kits_recent_sync_rows(12);
        } else {
            $admin_kits_error = raidlands_kits_readiness_message(true);
        }
    }

    if ($active_section === 'groups') {
        $admin_permissions_ready = raidlands_permissions_is_ready();

        if ($admin_permissions_ready) {
            $admin_permission_groups = raidlands_permissions_admin_rows();
            $admin_permission_options = raidlands_permissions_permission_names();
            $admin_permission_sync_rows = raidlands_permissions_recent_sync_rows(12);
        } else {
            $admin_permissions_error = raidlands_permissions_readiness_message(true);
        }
    }
} catch (Throwable $error) {
    $admin_store_ready = false;
    $admin_store_error = $error->getMessage();
    $admin_kits_ready = false;
    $admin_kits_error = $error->getMessage();
    $admin_permissions_ready = false;
    $admin_permissions_error = $error->getMessage();
}

function admin_page_label(string $key): string
{
    return ucwords(str_replace(['-', '_'], ' ', $key));
}

function admin_section_url(string $section): string
{
    $section = raidlands_admin_clean_section($section);

    return $section === 'identity' ? './' : './?section=' . rawurlencode($section);
}

function admin_action_url(string $section, string $action): string
{
    $url = admin_section_url($section);
    $separator = str_contains($url, '?') ? '&' : '?';

    return $url . $separator . 'action=' . rawurlencode($action);
}

function admin_field_head(string $label, string $help): string
{
    return '<span class="admin-label-row"><span>' . e($label) . '</span><span class="admin-tooltip" tabindex="0" aria-label="' . e($help) . '">?</span></span>'
        . '<small class="admin-help-text">' . e($help) . '</small>';
}

function admin_check_copy(string $label, string $help): string
{
    return '<span class="admin-check-copy"><span class="admin-label-row"><span>' . e($label) . '</span><span class="admin-tooltip" tabindex="0" aria-label="' . e($help) . '">?</span></span>'
        . '<small class="admin-help-text">' . e($help) . '</small></span>';
}

function admin_hint(string $text): string
{
    return '<small class="admin-inline-hint">' . e($text) . '</small>';
}

function admin_option_map(array $options, array $current_values = []): array
{
    $result = [];

    foreach ($options as $value => $label) {
        if (is_int($value)) {
            $value = $label;
        }

        $value = trim((string) $value);
        $label = trim((string) $label);

        if ($value === '') {
            continue;
        }

        $result[$value] = $label !== '' ? $label : $value;
    }

    foreach ($current_values as $value) {
        $value = trim((string) $value);

        if ($value !== '' && !isset($result[$value])) {
            $result[$value] = $value . ' (custom)';
        }
    }

    return $result;
}

function admin_render_options(array $options, string $selected = ''): string
{
    $selected = (string) $selected;
    $html = '';

    foreach (admin_option_map($options, [$selected]) as $value => $label) {
        $html .= '<option value="' . e($value) . '"' . ($selected === $value ? ' selected' : '') . '>' . e($label) . '</option>';
    }

    return $html;
}

function admin_render_datalist(string $id, array $options, array $current_values = []): string
{
    $html = '<datalist id="' . e($id) . '">';

    foreach (admin_option_map($options, $current_values) as $value => $label) {
        $html .= '<option value="' . e($value) . '">' . e($label) . '</option>';
    }

    return $html . '</datalist>';
}

function admin_status_options(): array
{
    return ['Launch target', 'Planned', 'Under review', 'In development', 'After launch', 'Live'];
}

function admin_feature_icon_options(array $current_values = []): array
{
    global $feature_icon_aliases, $feature_icon_assets;

    $values = [];

    foreach (array_keys((array) ($feature_icon_assets ?? [])) as $icon) {
        $values[] = (string) $icon;
    }

    foreach ((array) ($feature_icon_aliases ?? []) as $alias => $canonical) {
        $values[] = (string) $alias;
        $values[] = (string) $canonical;
    }

    $values = admin_option_map($values, $current_values);
    ksort($values, SORT_NATURAL | SORT_FLAG_CASE);

    return $values;
}

function admin_status_provider_options(string $current = ''): array
{
    return admin_option_map([
        'battlemetrics' => 'BattleMetrics',
    ], [$current]);
}

function admin_timezone_options(string $current = ''): array
{
    return admin_option_map([
        'America/Chicago' => 'America/Chicago',
        'America/New_York' => 'America/New_York',
        'America/Denver' => 'America/Denver',
        'America/Los_Angeles' => 'America/Los_Angeles',
        'Europe/London' => 'Europe/London',
        'UTC' => 'UTC',
    ], [$current]);
}

function admin_currency_options(array $current_values = []): array
{
    return admin_option_map([
        'usd' => 'USD',
        'cad' => 'CAD',
        'eur' => 'EUR',
        'gbp' => 'GBP',
        'aud' => 'AUD',
    ], $current_values);
}

function admin_price_label_options(array $current_values = []): array
{
    return admin_option_map(['Monthly', 'One-time', 'Lifetime', 'Wipe', 'Season', 'Limited'], $current_values);
}

function admin_product_type_options(): array
{
    return [
        'vip_subscription' => 'Monthly VIP',
        'one_time_perk' => 'One-time perk',
        'one_time_kit_unlock' => 'One-time kit unlock',
    ];
}

function admin_kit_item_rows(array $kit, string $container): array
{
    $capacity = admin_kit_slot_capacity($container);
    $slots = array_fill(0, $capacity, []);
    $overflow = [];

    foreach (array_values((array) ($kit['items'][$container] ?? [])) as $fallback_position => $item) {
        $item = is_array($item) ? $item : [];
        $position = (int) ($item['position'] ?? $fallback_position);

        if ($position >= 0 && $position < $capacity && $slots[$position] === []) {
            $slots[$position] = $item;
        } else {
            $overflow[] = $item;
        }
    }

    foreach ($overflow as $item) {
        foreach ($slots as $position => $slot) {
            if ($slot === []) {
                $slots[$position] = $item;
                break;
            }
        }
    }

    foreach ($slots as $position => $slot) {
        $slot = is_array($slot) ? $slot : [];
        $slot['position'] = $position;
        $slot['sort_order'] = $slot['sort_order'] ?? ($position * 10);
        $slots[$position] = $slot;
    }

    return $slots;
}

function admin_kit_slot_capacity(string $container): int
{
    return match ($container) {
        'wear' => 8,
        'belt' => 6,
        default => 24,
    };
}

function admin_kit_container_label(string $container): string
{
    return match ($container) {
        'wear' => 'Wear',
        'belt' => 'Hotbar',
        default => 'Inventory',
    };
}

function admin_kit_item_count(array $kit): int
{
    $count = 0;

    foreach (['main', 'wear', 'belt'] as $container) {
        foreach ((array) ($kit['items'][$container] ?? []) as $item) {
            if (trim((string) ($item['shortname'] ?? '')) !== '') {
                $count += 1;
            }
        }
    }

    return $count;
}

function admin_kit_item_meta(array $catalog, string $shortname): array
{
    $shortname = strtolower(trim($shortname));

    return $shortname !== '' && isset($catalog[$shortname]) && is_array($catalog[$shortname])
        ? $catalog[$shortname]
        : [];
}

function admin_kit_item_display_name(array $item, array $catalog): string
{
    $shortname = trim((string) ($item['shortname'] ?? ''));
    $meta = admin_kit_item_meta($catalog, $shortname);
    $display = trim((string) ($item['display_name'] ?? ''));

    if ($display !== '') {
        return $display;
    }

    if (!empty($meta['display_name'])) {
        return (string) $meta['display_name'];
    }

    return $shortname;
}

function admin_kit_item_icon_url(array $item, array $catalog): string
{
    $shortname = trim((string) ($item['shortname'] ?? ''));
    $meta = admin_kit_item_meta($catalog, $shortname);
    $icon = trim((string) ($meta['icon'] ?? ''));

    return $icon !== '' ? asset_url($icon) : '';
}

function admin_kit_slot_expected_json(): string
{
    return json_encode([
        'main' => admin_kit_slot_capacity('main'),
        'wear' => admin_kit_slot_capacity('wear'),
        'belt' => admin_kit_slot_capacity('belt'),
    ], JSON_UNESCAPED_SLASHES) ?: '{}';
}

function admin_render_kit_slot_fields(int $kit_index, string $container, int $slot_index, array $item): string
{
    $fields = [
        'shortname' => trim((string) ($item['shortname'] ?? '')),
        'amount' => (string) max(1, (int) ($item['amount'] ?? 1)),
        'position' => (string) $slot_index,
        'skin' => (string) max(0, (int) ($item['skin'] ?? 0)),
        'condition' => (string) ($item['condition_value'] ?? $item['condition'] ?? 0),
        'max_condition' => (string) ($item['max_condition'] ?? 0),
        'ammo' => (string) max(0, (int) ($item['ammo'] ?? 0)),
        'ammo_type' => trim((string) ($item['ammo_type'] ?? '')),
        'frequency' => (string) (int) ($item['frequency'] ?? -1),
        'display_name' => trim((string) ($item['display_name'] ?? '')),
        'blueprint_shortname' => trim((string) ($item['blueprint_shortname'] ?? '')),
        'text' => trim((string) ($item['text_value'] ?? $item['text'] ?? '')),
        'contents_json' => trim((string) ($item['contents_json'] ?? '')),
        'container_json' => trim((string) ($item['container_json'] ?? '')),
        'sort_order' => (string) (int) ($item['sort_order'] ?? ($slot_index * 10)),
    ];
    $html = '<div class="admin-kit-slot-fields" data-kit-slot-fields hidden>';

    foreach ($fields as $field => $value) {
        $name = 'kits[' . $kit_index . '][items][' . $container . '][' . $slot_index . '][' . $field . ']';
        $html .= '<input type="hidden" data-kit-item-field="' . e($field) . '" name="' . e($name) . '" value="' . e($value) . '">';
    }

    return $html . '</div>';
}

function admin_render_kit_slot(int $kit_index, string $container, int $slot_index, array $item, array $catalog): string
{
    $shortname = trim((string) ($item['shortname'] ?? ''));
    $is_filled = $shortname !== '';
    $display = $is_filled ? admin_kit_item_display_name($item, $catalog) : '';
    $icon_url = $is_filled ? admin_kit_item_icon_url($item, $catalog) : '';
    $amount = max(1, (int) ($item['amount'] ?? 1));
    $slot_label = admin_kit_container_label($container) . ' slot ' . (string) ($slot_index + 1);
    $aria = $is_filled ? 'Edit ' . $display . ' in ' . $slot_label : 'Set item for ' . $slot_label;
    $classes = 'rust-kit-slot' . ($is_filled ? ' is-filled' : '');
    $html = '<div class="rust-kit-slot-wrap" data-kit-slot-wrap>';

    $html .= '<button class="' . e($classes) . '" type="button" data-kit-slot data-kit-index="' . e((string) $kit_index) . '" data-container="' . e($container) . '" data-position="' . e((string) $slot_index) . '" aria-label="' . e($aria) . '">';
    $html .= '<span class="rust-kit-slot-index">' . e((string) ($slot_index + 1)) . '</span>';
    $html .= '<img data-slot-icon alt="" loading="lazy" decoding="async"' . ($icon_url === '' ? ' hidden' : ' src="' . e($icon_url) . '"') . '>';
    $html .= '<span class="rust-kit-slot-empty" data-slot-empty' . ($is_filled ? ' hidden' : '') . '>+</span>';
    $html .= '<span class="rust-kit-slot-title" data-slot-title>' . e($display) . '</span>';
    $html .= '<span class="rust-kit-slot-amount" data-slot-amount' . (!$is_filled || $amount <= 1 ? ' hidden' : '') . '>x' . e((string) $amount) . '</span>';
    $html .= '</button>';
    $html .= admin_render_kit_slot_fields($kit_index, $container, $slot_index, $item);

    return $html . '</div>';
}

function admin_render_kit_slot_editor(array $kit, int $kit_index, array $catalog): string
{
    $html = '<div class="rust-kit-loadout">';

    foreach (['wear', 'main', 'belt'] as $container) {
        $slots = admin_kit_item_rows($kit, $container);
        $html .= '<section class="rust-kit-container rust-kit-container-' . e($container) . '">';
        $html .= '<div class="rust-kit-container-head">';
        $html .= '<h3>' . e(admin_kit_container_label($container)) . '</h3>';
        $html .= '<span>' . e((string) count($slots)) . ' slots</span>';
        $html .= '</div>';
        $html .= '<div class="rust-slot-grid rust-slot-grid-' . e($container) . '">';

        foreach ($slots as $slot_index => $item) {
            $html .= admin_render_kit_slot($kit_index, $container, (int) $slot_index, is_array($item) ? $item : [], $catalog);
        }

        $html .= '</div>';
        $html .= '</section>';
    }

    return $html . '</div>';
}
?>
<!doctype html>
<html lang="en" data-page="admin" data-base="<?= e($base_path) ?>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Raidlands Admin</title>
    <meta name="theme-color" content="#0b0d0e">
    <meta name="msapplication-TileColor" content="#050607">
    <meta name="msapplication-TileImage" content="<?= e(asset_url('icons/mstile-150x150.png')) ?>">
    <meta name="msapplication-config" content="<?= e($base_path . 'browserconfig.xml') ?>">
    <link rel="icon" href="<?= e(asset_url('icons/favicon.ico')) ?>" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-16x16.ico')) ?>" sizes="16x16" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-32x32.ico')) ?>" sizes="32x32" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-48x48.ico')) ?>" sizes="48x48" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-64x64.ico')) ?>" sizes="64x64" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-96x96.ico')) ?>" sizes="96x96" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-128x128.png')) ?>" sizes="128x128" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-180x180.png')) ?>" sizes="180x180" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-192x192.png')) ?>" sizes="192x192" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-256x256.png')) ?>" sizes="256x256" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-512x512.png')) ?>" sizes="512x512" type="image/png">
    <link rel="apple-touch-icon" href="<?= e(asset_url('icons/apple-touch-icon.png')) ?>" sizes="180x180">
    <link rel="manifest" href="<?= e($base_path . 'site.webmanifest') ?>">
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
    <?php if ($active_section === 'kits') : ?>
      <link rel="stylesheet" href="<?= e(asset_url('css/admin-kits.css')) ?>">
    <?php endif; ?>
  </head>
  <body class="admin-body">
    <?php if (!$authenticated) : ?>
      <main class="admin-login-shell">
        <?php if ($admin_auth_tables_ready) : ?>
        <div class="admin-login-panel">
          <img class="admin-login-logo" src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="Raidlands">
          <h1>Raidlands Admin</h1>
          <?php if ($flash !== null) : ?>
            <div class="admin-alert <?= e((string) $flash['type']) ?>"><?= e((string) $flash['message']) ?></div>
          <?php endif; ?>
          <div class="admin-alert warning"><?= e($admin_auth_message) ?></div>
          <?php if ($admin_player_steam_id64 !== '') : ?>
            <div class="auth-status warning">
              <strong>Steam linked in this browser.</strong>
              <span>Steam ID <code><?= e($admin_player_steam_id64) ?></code><?= $admin_player_name !== '' ? ' as ' . e($admin_player_name) : '' ?> is not approved for admin access.</span>
            </div>
          <?php endif; ?>
          <div class="button-row admin-login-actions">
            <a class="btn btn-steam admin-full-button" href="<?= e(admin_action_url($active_section, 'steam')) ?>">Continue with Steam</a>
            <a class="btn btn-secondary admin-full-button" href="<?= e(route_url('link')) ?>">Manage Linked Account</a>
          </div>
        </div>
        <?php else : ?>
        <form class="admin-login-panel" method="post" action="<?= e(admin_section_url($active_section)) ?>">
          <input type="hidden" name="action" value="login">
          <input type="hidden" name="section" value="<?= e($active_section) ?>">
          <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
          <img class="admin-login-logo" src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="Raidlands">
          <h1>Raidlands Admin</h1>
          <?php if ($flash !== null) : ?>
            <div class="admin-alert <?= e((string) $flash['type']) ?>"><?= e((string) $flash['message']) ?></div>
          <?php endif; ?>
          <div class="admin-alert warning"><?= e($admin_auth_message) ?> Config login is only a setup fallback.</div>
          <?php if (raidlands_admin_default_password_is_active()) : ?>
            <div class="admin-alert warning">Default admin password is active. Change it in <code>.env</code>.</div>
          <?php endif; ?>
          <label class="admin-field">
            <?= admin_field_head('Username', 'Temporary setup username from .env.') ?>
            <input type="text" name="username" autocomplete="username" required autofocus>
          </label>
          <label class="admin-field">
            <?= admin_field_head('Password', 'Temporary setup password or password hash from .env.') ?>
            <input type="password" name="password" autocomplete="current-password" required>
          </label>
          <button class="btn btn-primary admin-full-button" type="submit">Sign In</button>
        </form>
        <?php endif; ?>
      </main>
    <?php else : ?>
      <header class="admin-topbar">
        <a class="admin-brand" href="<?= e(route_url()) ?>">
          <img
            src="<?= e(asset_url('media/horizontal-logo-xsm.webp')) ?>"
            srcset="<?= e(asset_url('media/horizontal-logo-xxsm.webp')) ?> 120w, <?= e(asset_url('media/horizontal-logo-xsm.webp')) ?> 300w, <?= e(asset_url('media/horizontal-logo-sm.webp')) ?> 550w, <?= e(asset_url('media/horizontal-logo-med.webp')) ?> 1100w"
            sizes="(max-width: 520px) 136px, 168px"
            width="300"
            height="100"
            alt="Raidlands"
            decoding="async">
          <span>Admin</span>
        </a>
        <div class="admin-topbar-actions">
          <span class="admin-user-chip">
            <strong><?= e($admin_user_role_label) ?></strong>
            <?php if ($admin_user !== null) : ?>
              <code><?= e((string) $admin_user['steam_id64']) ?></code>
            <?php else : ?>
              <code>setup fallback</code>
            <?php endif; ?>
          </span>
          <a class="btn btn-secondary" href="<?= e(route_url()) ?>">View Site</a>
          <form method="post" action="<?= e(admin_section_url($active_section)) ?>">
            <input type="hidden" name="action" value="logout">
            <input type="hidden" name="section" value="<?= e($active_section) ?>">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <button class="btn btn-ghost" type="submit">Logout</button>
          </form>
        </div>
      </header>

      <main class="admin-shell">
        <div class="admin-container">
          <div class="admin-heading">
            <p class="section-kicker">Website Control</p>
            <h1>Raidlands Admin Panel</h1>
          </div>

          <?php if ($flash !== null) : ?>
            <div class="admin-alert <?= e((string) $flash['type']) ?>"><?= e((string) $flash['message']) ?></div>
          <?php endif; ?>

          <?php if ($denied_section !== '') : ?>
            <?php $denied_meta = $admin_sections_all[$denied_section] ?? ['label' => admin_page_label($denied_section)]; ?>
            <div class="admin-alert warning">
              <?= e((string) $denied_meta['label']) ?> exists, but your current admin role cannot view it.
              Required permission: <code><?= e(raidlands_admin_section_permission($denied_section)) ?></code>.
            </div>
          <?php endif; ?>

          <div class="admin-layout">
            <aside class="admin-sidebar" aria-label="Admin sections">
              <nav class="admin-side-nav">
                <?php foreach ($admin_sections as $section_key => $section) : ?>
                  <a class="admin-nav-link<?= $section_key === $active_section ? ' is-active' : '' ?>" href="<?= e(admin_section_url((string) $section_key)) ?>">
                    <span><?= e($section['label']) ?></span>
                    <small><?= e($section['summary']) ?></small>
                  </a>
                <?php endforeach; ?>
              </nav>
            </aside>

            <section class="admin-workspace" aria-labelledby="admin-section-title">
              <div class="admin-section-head admin-workspace-head">
                <div>
                  <p class="section-kicker"><?= e($active_meta['kicker']) ?></p>
                  <h2 id="admin-section-title"><?= e($active_meta['title']) ?></h2>
                </div>
                <p class="admin-section-summary"><?= e($active_meta['summary']) ?></p>
              </div>

              <form class="admin-form" method="post" action="<?= e(admin_section_url($active_section)) ?>" enctype="multipart/form-data">
                <input type="hidden" name="action" value="save">
                <input type="hidden" name="section" value="<?= e($active_section) ?>">
                <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                <?php if ($active_section === 'kits') : ?>
                  <?php
                    $admin_kit_expected_items = [];

                    if ($admin_kits_ready) {
                        foreach (['main', 'wear', 'belt'] as $expected_container) {
                            $admin_kit_expected_items[0][$expected_container] = admin_kit_slot_capacity($expected_container);
                        }
                    }
                  ?>
                  <input type="hidden" name="kit_save_mode" value="draft" data-kit-save-mode>
                  <input type="hidden" name="kit_expected_items" value="<?= e(json_encode($admin_kit_expected_items, JSON_UNESCAPED_SLASHES)) ?>">
                <?php endif; ?>

                <?php if (!$admin_has_visible_sections) : ?>
                  <section class="admin-section">
                    <div class="admin-alert warning">This Steam account is approved for admin entry, but it does not have any section permissions yet. Add a role permission in the admin RBAC tables.</div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'identity') : ?>
                  <section class="admin-section">
                    <div class="admin-grid three">
                      <label class="admin-field">
                        <?= admin_field_head('Server name', 'Public server name used in page headers, browser metadata, and status fallbacks.') ?>
                        <input type="text" name="site_config[serverName]" maxlength="120" placeholder="Raidlands 1000x" value="<?= e((string) ($admin_site['serverName'] ?? '')) ?>">
                        <?= admin_hint('Changes public brand text. It does not rename the Rust server inside BattleMetrics.') ?>
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Tagline', 'Short brand line shown in page heroes and reusable headers.') ?>
                        <input type="text" name="site_config[tagline]" maxlength="160" placeholder="Raid. Respawn. Rebuild. Repeat." value="<?= e((string) ($admin_site['tagline'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Region', 'Shown in the server status panel so players know the server location.') ?>
                        <input type="text" name="site_config[region]" maxlength="80" placeholder="US Central" value="<?= e((string) ($admin_site['region'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Fallback map name', 'Map label shown before live BattleMetrics data loads or when it is unavailable.') ?>
                        <input type="text" name="site_config[mapName]" maxlength="120" placeholder="Procedural Battlefield" value="<?= e((string) ($admin_site['mapName'] ?? '')) ?>">
                        <?= admin_hint('Live status can override this when BattleMetrics responds.') ?>
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Fallback players', 'Player count used only when the live server lookup cannot answer.') ?>
                        <input type="number" min="0" max="9999" name="site_config[playersOnline]" value="<?= e((string) ($admin_site['playersOnline'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Max players', 'Capacity shown in the status panel and used as the fallback max player count.') ?>
                        <input type="number" min="1" max="9999" name="site_config[maxPlayers]" value="<?= e((string) ($admin_site['maxPlayers'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Fallback queue', 'Queue count shown only when live status is stale or unavailable.') ?>
                        <input type="number" min="0" max="9999" name="site_config[queue]" value="<?= e((string) ($admin_site['queue'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Fallback server FPS', 'Performance label shown in the status panel before live FPS is available.') ?>
                        <input type="text" name="site_config[serverFps]" maxlength="40" placeholder="Stable" value="<?= e((string) ($admin_site['serverFps'] ?? '')) ?>">
                      </label>
                      <label class="admin-check admin-check-field">
                        <input type="checkbox" name="site_config[serverOnline]" value="1" <?= !empty($admin_site['serverOnline']) ? 'checked' : '' ?>>
                        <?= admin_check_copy('Online fallback', 'Controls the default online/offline state before live status responds.') ?>
                      </label>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'links') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <label class="admin-field">
                        <?= admin_field_head('Connect command', 'The exact Rust console command copied by players from the site.') ?>
                        <input type="text" name="site_config[connectCommand]" maxlength="180" placeholder="connect raidlands.net:25607" value="<?= e((string) ($admin_site['connectCommand'] ?? '')) ?>">
                        <?= admin_hint('Used by copy buttons and fallback join instructions.') ?>
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Steam connect URL', 'The steam:// link used by Join Server and Launch Rust buttons.') ?>
                        <input type="text" name="site_config[steamConnectUrl]" maxlength="240" placeholder="steam://connect/raidlands.net:25607" value="<?= e((string) ($admin_site['steamConnectUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Discord invite URL', 'Every Discord call-to-action points here.') ?>
                        <input type="url" name="site_config[discordInviteUrl]" maxlength="240" placeholder="https://discord.gg/..." value="<?= e((string) ($admin_site['discordInviteUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('BattleMetrics server ID', 'Numeric BattleMetrics ID used by api/server-status.php for live players, queue, map, and FPS.') ?>
                        <input type="text" inputmode="numeric" pattern="[0-9]*" name="site_config[serverStats][battleMetricsServerId]" placeholder="39516376" value="<?= e((string) ($admin_site['serverStats']['battleMetricsServerId'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Status provider', 'Live status currently expects BattleMetrics. Custom values are preserved for future integrations.') ?>
                        <?= admin_render_datalist('admin-status-provider-options', admin_status_provider_options((string) ($admin_site['serverStats']['provider'] ?? 'battlemetrics'))) ?>
                        <input type="text" list="admin-status-provider-options" name="site_config[serverStats][provider]" maxlength="40" value="<?= e((string) ($admin_site['serverStats']['provider'] ?? 'battlemetrics')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Status cache seconds', 'How long the status API can reuse a BattleMetrics response before checking again.') ?>
                        <input type="number" min="30" max="3600" name="site_config[serverStats][cacheSeconds]" value="<?= e((string) ($admin_site['serverStats']['cacheSeconds'] ?? 60)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Steam OAuth URL', 'Legacy placeholder only. Native Steam sign-in now starts from /link/?action=steam.') ?>
                        <input type="url" name="site_config[auth][steamUrl]" maxlength="240" placeholder="Leave blank unless a future custom Steam link needs it" value="<?= e((string) ($admin_site['auth']['steamUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Discord OAuth URL', 'Future account-link button destination. Leave blank until the Discord login backend exists.') ?>
                        <input type="url" name="site_config[auth][discordUrl]" maxlength="240" placeholder="Leave blank until Discord login exists" value="<?= e((string) ($admin_site['auth']['discordUrl'] ?? '')) ?>">
                      </label>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'wipe') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <label class="admin-field">
                        <?= admin_field_head('Wipe time', 'The local time used by countdowns and wipe schedule labels.') ?>
                        <input type="time" name="site_config[wipe][time]" value="<?= e((string) ($admin_site['wipe']['time'] ?? '19:00')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Timezone', 'IANA timezone used when calculating and displaying wipe times.') ?>
                        <?= admin_render_datalist('admin-timezone-options', admin_timezone_options((string) ($admin_site['wipe']['timezone'] ?? 'America/Chicago'))) ?>
                        <input type="text" list="admin-timezone-options" name="site_config[wipe][timezone]" maxlength="80" placeholder="America/Chicago" value="<?= e((string) ($admin_site['wipe']['timezone'] ?? 'America/Chicago')) ?>">
                        <?= admin_hint('Examples: America/Chicago, Europe/London, UTC. The countdown uses this value.') ?>
                      </label>
                      <div class="admin-field admin-span-all">
                        <?= admin_field_head('Wipe days', 'Selected days drive countdowns, next wipe labels, and schedule copy generated from config.') ?>
                        <div class="admin-check-row">
                          <?php foreach ($admin_weekdays as $day_index => $day_name) : ?>
                            <label class="admin-check">
                              <input type="checkbox" name="site_config[wipe][days][]" value="<?= e((string) $day_index) ?>" <?= in_array($day_index, $admin_wipe_days, true) ? 'checked' : '' ?>>
                              <span><?= e($day_name) ?></span>
                            </label>
                          <?php endforeach; ?>
                        </div>
                      </div>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'features') : ?>
                  <?php
                    $quick_rows = array_values($content['quick_features']);
                    $feature_rows = array_values($content['feature_cards']);
                    $roadmap_rows = array_values($content['roadmap_cards']);
                    $admin_feature_icon_values = [];
                    $admin_feature_status_values = [];

                    foreach ($quick_rows as $row) {
                        $admin_feature_icon_values[] = (string) ($row[0] ?? '');
                    }

                    foreach ($feature_rows as $row) {
                        $admin_feature_icon_values[] = (string) ($row[0] ?? '');
                        $admin_feature_status_values[] = (string) ($row[3] ?? '');
                    }

                    foreach ($roadmap_rows as $row) {
                        $admin_feature_status_values[] = (string) ($row[2] ?? '');
                    }

                    echo admin_render_datalist('admin-feature-icon-options', admin_feature_icon_options($admin_feature_icon_values));
                    echo admin_render_datalist('admin-status-options', admin_status_options(), $admin_feature_status_values);
                  ?>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Quick Feature Chips</h3>
                      <p>Small chips shown near the homepage hero. Icon suggestions come from the current Raidlands feature icon aliases.</p>
                    </div>
                    <div class="admin-repeat-list compact">
                      <?php
                        $quick_total = count($quick_rows) + 4;
                      ?>
                      <?php for ($index = 0; $index < $quick_total; $index += 1) : ?>
                        <?php $row = $quick_rows[$index] ?? ['', '']; ?>
                        <article class="admin-repeat-row">
                          <label class="admin-field">
                            <?= admin_field_head('Icon alias', 'Icon alias used by the chip. Suggested aliases render image icons; custom text is preserved.') ?>
                            <input type="text" list="admin-feature-icon-options" name="quick_features_rows[<?= e((string) $index) ?>][icon]" maxlength="24" placeholder="GATHER" value="<?= e((string) ($row[0] ?? '')) ?>">
                          </label>
                          <label class="admin-field">
                            <?= admin_field_head('Label', 'The short chip text players see.') ?>
                            <input type="text" name="quick_features_rows[<?= e((string) $index) ?>][label]" maxlength="80" placeholder="1000x Gather" value="<?= e((string) ($row[1] ?? '')) ?>">
                          </label>
                          <?php if (isset($quick_rows[$index])) : ?>
                            <label class="admin-check admin-delete-check">
                              <input type="checkbox" name="quick_features_rows[<?= e((string) $index) ?>][delete]" value="1">
                              <span>Remove</span>
                            </label>
                          <?php endif; ?>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Feature Cards</h3>
                      <p>Cards used on the homepage and Features page. The status controls the small badge at the bottom of each card.</p>
                    </div>
                    <div class="admin-repeat-list">
                      <?php
                        $feature_total = count($feature_rows) + 3;
                      ?>
                      <?php for ($index = 0; $index < $feature_total; $index += 1) : ?>
                        <?php $row = $feature_rows[$index] ?? ['', '', '', '']; ?>
                        <article class="admin-repeat-card">
                          <div class="admin-repeat-card-head">
                            <h3><?= isset($feature_rows[$index]) ? 'Feature Card ' . e((string) ($index + 1)) : 'New Feature Card' ?></h3>
                            <?php if (isset($feature_rows[$index])) : ?>
                              <label class="admin-check admin-delete-check">
                                <input type="checkbox" name="feature_cards_rows[<?= e((string) $index) ?>][delete]" value="1">
                                <span>Remove</span>
                              </label>
                            <?php endif; ?>
                          </div>
                          <div class="admin-grid feature-card-grid">
                            <label class="admin-field">
                              <?= admin_field_head('Icon alias', 'Icon alias shown above the card title. Use suggestions like GATHER, PVP, KIT, TP, or STAFF.') ?>
                              <input type="text" list="admin-feature-icon-options" name="feature_cards_rows[<?= e((string) $index) ?>][icon]" maxlength="24" placeholder="PVP" value="<?= e((string) ($row[0] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Card heading shown to players.') ?>
                              <input type="text" name="feature_cards_rows[<?= e((string) $index) ?>][title]" maxlength="120" placeholder="Battlefield PvP" value="<?= e((string) ($row[1] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Status', 'Badge text shown on the card. You can type a custom status.') ?>
                              <input type="text" list="admin-status-options" name="feature_cards_rows[<?= e((string) $index) ?>][status]" maxlength="80" placeholder="Live" value="<?= e((string) ($row[3] ?? '')) ?>">
                            </label>
                            <label class="admin-field admin-span-all">
                              <?= admin_field_head('Copy', 'Short card description. Keep it scan-friendly.') ?>
                              <textarea name="feature_cards_rows[<?= e((string) $index) ?>][copy]" rows="3" maxlength="360"><?= e((string) ($row[2] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Roadmap Cards</h3>
                      <p>Cards used in the Coming Soon section to explain future systems without changing public routes.</p>
                    </div>
                    <div class="admin-repeat-list">
                      <?php
                        $roadmap_total = count($roadmap_rows) + 3;
                      ?>
                      <?php for ($index = 0; $index < $roadmap_total; $index += 1) : ?>
                        <?php $row = $roadmap_rows[$index] ?? ['', '', '']; ?>
                        <article class="admin-repeat-card">
                          <div class="admin-repeat-card-head">
                            <h3><?= isset($roadmap_rows[$index]) ? 'Roadmap Card ' . e((string) ($index + 1)) : 'New Roadmap Card' ?></h3>
                            <?php if (isset($roadmap_rows[$index])) : ?>
                              <label class="admin-check admin-delete-check">
                                <input type="checkbox" name="roadmap_cards_rows[<?= e((string) $index) ?>][delete]" value="1">
                                <span>Remove</span>
                              </label>
                            <?php endif; ?>
                          </div>
                          <div class="admin-grid three">
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Roadmap item heading.') ?>
                              <input type="text" name="roadmap_cards_rows[<?= e((string) $index) ?>][title]" maxlength="120" placeholder="Vote Rewards" value="<?= e((string) ($row[0] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Status', 'Badge text shown beside the roadmap item.') ?>
                              <input type="text" list="admin-status-options" name="roadmap_cards_rows[<?= e((string) $index) ?>][status]" maxlength="80" placeholder="Next web step" value="<?= e((string) ($row[2] ?? '')) ?>">
                            </label>
                            <label class="admin-field admin-span-all">
                              <?= admin_field_head('Copy', 'Short description of the planned system.') ?>
                              <textarea name="roadmap_cards_rows[<?= e((string) $index) ?>][copy]" rows="3" maxlength="360"><?= e((string) ($row[1] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'pages') : ?>
                  <section class="admin-section">
                    <div class="admin-details-grid">
                      <?php foreach ($admin_page_copy as $copy_key => $copy_row) : ?>
                        <?php $copy_route = (string) $copy_key === 'home' ? '/' : '/' . (string) $copy_key . '/'; ?>
                        <details class="admin-details">
                          <summary><?= e(admin_page_label((string) $copy_key)) ?> <small><?= e($copy_route) ?></small></summary>
                          <p class="admin-detail-note">Changes the public hero title and intro copy for <?= e($copy_route) ?>.</p>
                          <div class="admin-grid two">
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Main page title for this route hero.') ?>
                              <input type="text" name="page_copy[<?= e((string) $copy_key) ?>][title]" maxlength="160" value="<?= e((string) ($copy_row['title'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Lede', 'Intro sentence or short paragraph shown under the page title.') ?>
                              <textarea name="page_copy[<?= e((string) $copy_key) ?>][lede]" rows="3" maxlength="500"><?= e((string) ($copy_row['lede'] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'seo') : ?>
                  <section class="admin-section">
                    <div class="admin-details-grid">
                      <?php foreach ($admin_seo_pages as $seo_key => $seo_row) : ?>
                        <?php $seo_route = (string) $seo_key === 'home' ? '/' : '/' . (string) $seo_key . '/'; ?>
                        <details class="admin-details">
                          <summary><?= e(admin_page_label((string) $seo_key)) ?> <small><?= e($seo_route) ?></small></summary>
                          <p class="admin-detail-note">Search and share metadata for <?= e($seo_route) ?>. This does not change the visible page hero.</p>
                          <div class="admin-grid two">
                            <label class="admin-field">
                              <?= admin_field_head('Browser title', 'Text used in the browser tab and search result title.') ?>
                              <input type="text" name="seo_pages[<?= e((string) $seo_key) ?>][title]" maxlength="180" value="<?= e((string) ($seo_row['title'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Meta description', 'Search engines often use this as the page summary.') ?>
                              <textarea name="seo_pages[<?= e((string) $seo_key) ?>][description]" rows="3" maxlength="320"><?= e((string) ($seo_row['description'] ?? '')) ?></textarea>
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Open Graph title', 'Title used when the page is shared on apps that read Open Graph metadata.') ?>
                              <input type="text" name="seo_pages[<?= e((string) $seo_key) ?>][ogTitle]" maxlength="180" value="<?= e((string) ($seo_row['ogTitle'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Open Graph description', 'Description used in social or chat previews when supported.') ?>
                              <textarea name="seo_pages[<?= e((string) $seo_key) ?>][ogDescription]" rows="3" maxlength="320"><?= e((string) ($seo_row['ogDescription'] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'feedback') : ?>
                  <?php if (!$admin_feedback_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning"><?= e($admin_feedback_error) ?></div>
                    </section>
                  <?php else : ?>
                    <section class="admin-section">
                      <div class="admin-grid three">
                        <?php foreach (raidlands_feedback_status_options() as $status_key => $status_label) : ?>
                          <div class="metal-panel admin-feedback-stat">
                            <p class="section-kicker"><?= e($status_label) ?></p>
                            <h3><?= e((string) ($admin_feedback_counts[$status_key] ?? 0)) ?></h3>
                            <p class="store-muted">Feedback items</p>
                          </div>
                        <?php endforeach; ?>
                      </div>
                    </section>
                  <?php endif; ?>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Support page submissions</h3>
                      <p>Review new reports, keep a short internal note, and move each item as staff triages it.</p>
                    </div>
                    <?php if (!$admin_feedback_ready) : ?>
                      <div class="admin-alert warning">The feedback inbox will appear here after the migration is installed.</div>
                    <?php elseif ($admin_feedback_rows === []) : ?>
                      <div class="admin-alert warning">No bug reports, suggestions, or feature requests have been submitted yet.</div>
                    <?php else : ?>
                      <div class="admin-repeat-list">
                        <?php foreach ($admin_feedback_rows as $feedback_row) : ?>
                          <?php
                            $feedback_id = (string) ($feedback_row['id'] ?? '');
                            $feedback_status = (string) ($feedback_row['status'] ?? 'open');
                            $feedback_type = (string) ($feedback_row['type'] ?? 'bug');
                            $feedback_contact = trim((string) ($feedback_row['contact_name'] ?? ''));
                            $feedback_email = trim((string) ($feedback_row['contact_email'] ?? ''));
                            $feedback_steam = trim((string) ($feedback_row['steam_id64'] ?? ''));
                            $feedback_page = trim((string) ($feedback_row['page_url'] ?? ''));
                            $feedback_browser = trim((string) ($feedback_row['browser'] ?? ''));
                          ?>
                          <article class="admin-repeat-card admin-feedback-card">
                            <input type="hidden" name="feedback_rows[<?= e($feedback_id) ?>][id]" value="<?= e($feedback_id) ?>">
                            <div class="admin-repeat-card-head admin-feedback-card-head">
                              <div>
                                <h3><?= e((string) ($feedback_row['summary'] ?? 'Untitled feedback')) ?></h3>
                                <p class="admin-feedback-subtitle">
                                  <?= e(raidlands_feedback_type_label($feedback_type)) ?> submitted <?= e((string) ($feedback_row['submitted_at'] ?? '')) ?>
                                </p>
                              </div>
                              <span class="status-pill <?= e($feedback_status) ?>"><?= e(raidlands_feedback_status_label($feedback_status)) ?></span>
                            </div>

                            <div class="admin-feedback-body">
                              <div class="admin-feedback-details"><?= nl2br(e((string) ($feedback_row['details'] ?? ''))) ?></div>
                              <dl class="admin-feedback-meta">
                                <div>
                                  <dt>Contact</dt>
                                  <dd><?= e($feedback_contact !== '' ? $feedback_contact : 'Not provided') ?></dd>
                                </div>
                                <div>
                                  <dt>Email</dt>
                                  <dd>
                                    <?php if ($feedback_email !== '') : ?>
                                      <a href="mailto:<?= e($feedback_email) ?>"><?= e($feedback_email) ?></a>
                                    <?php else : ?>
                                      Not provided
                                    <?php endif; ?>
                                  </dd>
                                </div>
                                <div>
                                  <dt>SteamID64</dt>
                                  <dd><?= $feedback_steam !== '' ? '<code>' . e($feedback_steam) . '</code>' : 'Not provided' ?></dd>
                                </div>
                                <div>
                                  <dt>Page</dt>
                                  <dd>
                                    <?php if ($feedback_page !== '') : ?>
                                      <a href="<?= e($feedback_page) ?>" target="_blank" rel="noopener noreferrer"><?= e($feedback_page) ?></a>
                                    <?php else : ?>
                                      Not provided
                                    <?php endif; ?>
                                  </dd>
                                </div>
                                <div>
                                  <dt>Browser</dt>
                                  <dd><?= e($feedback_browser !== '' ? $feedback_browser : 'Not provided') ?></dd>
                                </div>
                                <div>
                                  <dt>Updated</dt>
                                  <dd><?= e((string) ($feedback_row['updated_at'] ?? '')) ?></dd>
                                </div>
                              </dl>
                            </div>

                            <div class="admin-grid two">
                              <label class="admin-field">
                                <?= admin_field_head('Status', 'Moves the item through staff review. This status is internal to the admin inbox.') ?>
                                <select name="feedback_rows[<?= e($feedback_id) ?>][status]">
                                  <?= admin_render_options(raidlands_feedback_status_options(), $feedback_status) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Staff note', 'Internal triage note. Keep player-facing replies in Discord or email for now.') ?>
                                <textarea name="feedback_rows[<?= e($feedback_id) ?>][admin_note]" rows="3" maxlength="1600"><?= e((string) ($feedback_row['admin_note'] ?? '')) ?></textarea>
                              </label>
                            </div>
                          </article>
                        <?php endforeach; ?>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'store') : ?>
                  <?php if (!$admin_store_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning">MySQL is not configured or the VIP store tables are not available. Run <code>database/migrations/001_vip_store.sql</code>, then <code>database/seeds/001_store_products.sql</code>, and add credentials to <code>data/raidlands-secrets.php</code>. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    </section>
                  <?php else : ?>
                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Store product rows</h3>
                        <p>These rows control what appears in the public store and which Oxide group WebsiteVipBridge grants after checkout or manual grant.</p>
                      </div>
                      <div class="admin-repeat-list">
                        <?php
                          $product_rows = array_values($admin_store_rows);
                          $admin_store_price_labels = [];
                          $admin_store_currencies = [];
                          $admin_store_groups = raidlands_store_managed_groups();

                          foreach ($product_rows as $product_row) {
                              $admin_store_price_labels[] = (string) ($product_row['price_label'] ?? '');
                              $admin_store_currencies[] = (string) ($product_row['currency'] ?? '');
                              $admin_store_groups[] = (string) ($product_row['oxide_group'] ?? '');
                          }

                          echo admin_render_datalist('admin-price-label-options', admin_price_label_options($admin_store_price_labels));
                          echo admin_render_datalist('admin-currency-options', admin_currency_options($admin_store_currencies));
                          echo admin_render_datalist('admin-oxide-group-options', admin_option_map($admin_store_groups));

                          $product_total = count($product_rows) + 2;
                        ?>
                        <?php for ($index = 0; $index < $product_total; $index += 1) : ?>
                          <?php
                            $row = $product_rows[$index] ?? [
                                'id' => '',
                                'slug' => '',
                                'name' => '',
                                'product_type' => 'one_time_perk',
                                'short_description' => '',
                                'description' => '',
                                'oxide_group' => '',
                                'tier_priority' => 0,
                                'is_stackable' => 1,
                                'is_active' => 0,
                                'is_featured' => 0,
                                'sort_order' => 100,
                                'price_id' => '',
                                'stripe_price_id' => '',
                                'price_label' => '',
                                'amount_cents' => 0,
                                'currency' => 'usd',
                                'price_is_active' => 0,
                            ];
                            $amount_dollars = ((int) ($row['amount_cents'] ?? 0)) / 100;
                          ?>
                          <article class="admin-repeat-card">
                            <input type="hidden" name="store_products[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <input type="hidden" name="store_products[<?= e((string) $index) ?>][price_id]" value="<?= e((string) ($row['price_id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <h3><?= !empty($row['id']) ? e((string) $row['name']) : 'New Store Product' ?></h3>
                              <?php if (!empty($row['id'])) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="store_products[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Deactivate</span>
                                </label>
                              <?php endif; ?>
                            </div>
                            <div class="admin-grid three">
                              <label class="admin-field">
                                <?= admin_field_head('Slug', 'Stable store identifier used by admin and support. Keep lowercase with hyphens.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][slug]" maxlength="120" placeholder="vip-bronze" value="<?= e((string) ($row['slug'] ?? '')) ?>">
                                <?= admin_hint('Changing an existing slug can affect support lookups and saved Stripe metadata.') ?>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Name', 'Product title shown to players.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][name]" maxlength="160" placeholder="Bronze VIP" value="<?= e((string) ($row['name'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Type', 'Monthly VIP creates Stripe subscription checkout. Other product types create one-time checkout.') ?>
                                <select name="store_products[<?= e((string) $index) ?>][product_type]">
                                  <?= admin_render_options(admin_product_type_options(), (string) ($row['product_type'] ?? 'one_time_perk')) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Oxide group', 'WebsiteVipBridge adds this managed group while the entitlement is active.') ?>
                                <input type="text" list="admin-oxide-group-options" name="store_products[<?= e((string) $index) ?>][oxide_group]" maxlength="120" placeholder="vip_bronze" value="<?= e((string) ($row['oxide_group'] ?? '')) ?>">
                                <?= admin_hint('Use a group that also exists in the bridge managed group list, or add it to bridge config before relying on sync.') ?>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Tier priority', 'Higher VIP priority revokes lower active VIP tier entitlements for the same player.') ?>
                                <input type="number" min="0" max="999" name="store_products[<?= e((string) $index) ?>][tier_priority]" value="<?= e((string) ($row['tier_priority'] ?? 0)) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Sort order', 'Lower products appear first on the public store.') ?>
                                <input type="number" min="0" max="9999" name="store_products[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Stripe Price ID', 'Use a real Stripe Price ID such as price_123. Blank or placeholder values disable checkout.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][stripe_price_id]" maxlength="160" placeholder="price_..." value="<?= e((string) ($row['stripe_price_id'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Price label', 'Small label near the product price, such as Monthly or One-time.') ?>
                                <input type="text" list="admin-price-label-options" name="store_products[<?= e((string) $index) ?>][price_label]" maxlength="120" placeholder="Monthly" value="<?= e((string) ($row['price_label'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Amount USD', 'Public display amount in dollars. Stripe still charges the configured Price ID amount.') ?>
                                <input type="number" min="0" step="0.01" name="store_products[<?= e((string) $index) ?>][amount_dollars]" value="<?= e(number_format($amount_dollars, 2, '.', '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Currency', 'Three-letter currency for display, usually usd.') ?>
                                <input type="text" list="admin-currency-options" name="store_products[<?= e((string) $index) ?>][currency]" maxlength="3" placeholder="usd" value="<?= e((string) ($row['currency'] ?? 'usd')) ?>">
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Product active', 'Controls whether this product can appear on the public store. Checkout also requires an active price.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][price_is_active]" value="1" <?= !empty($row['price_is_active']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Price active', 'Checkout is available only when product active, price active, and Stripe Price ID are all valid.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_featured]" value="1" <?= !empty($row['is_featured']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Featured', 'Featured products can be emphasized on future storefront layouts.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_stackable]" value="1" <?= !empty($row['is_stackable']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Stackable', 'One-time perks can stack. VIP tiers should usually be non-stackable.') ?>
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Short description', 'Brief copy shown on store cards.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][short_description]" maxlength="255" value="<?= e((string) ($row['short_description'] ?? '')) ?>">
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Full description', 'Longer admin/support note for what this product should grant.') ?>
                                <textarea name="store_products[<?= e((string) $index) ?>][description]" rows="3"><?= e((string) ($row['description'] ?? '')) ?></textarea>
                              </label>
                            </div>
                          </article>
                        <?php endfor; ?>
                        </div>
                    </section>
                  <?php endif; ?>
                <?php endif; ?>

                <?php if ($active_section === 'kits') : ?>
                  <?php if (!$admin_kits_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning"><?= e($admin_kits_error !== '' ? $admin_kits_error : 'Kit tables are not ready yet.') ?></div>
                    </section>
                  <?php else : ?>
                    <?php
                      echo admin_render_datalist('admin-kit-shortname-options', admin_option_map($admin_kit_shortnames));
                      echo admin_render_datalist('admin-kit-group-options', admin_option_map($admin_kit_groups));
                      $kit_rows = array_values($admin_kit_rows);
                      $kit_total = count($kit_rows) + 1;
                    ?>
                    <section class="admin-section">
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Published revision</p>
                          <h3><?= e((string) raidlands_kits_latest_published_revision()) ?></h3>
                          <p class="store-muted">Rust pulls only published kit revisions.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Editable kits</p>
                          <h3><?= e((string) count($kit_rows)) ?></h3>
                          <p class="store-muted">Imported and website-created kit rows.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Server sync</p>
                          <h3><?= e((string) ($admin_kit_sync_rows[0]['status'] ?? 'Pending')) ?></h3>
                          <p class="store-muted"><?= e((string) ($admin_kit_sync_rows[0]['updated_at'] ?? 'No kit sync yet')) ?></p>
                        </div>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Kit editor</h3>
                        <p>Save Draft keeps changes on the website. Publish sends the latest catalog to the server on its next kit sync.</p>
                      </div>
                      <div
                        class="admin-kit-editor-shell"
                        data-admin-kit-editor
                        data-rust-items-url="<?= e(asset_url('data/rust-items.json')) ?>"
                        data-assets-base="<?= e(asset_url('')) ?>">
                        <div class="admin-kit-panels">
                        <?php for ($index = 0; $index < $kit_total; $index += 1) : ?>
                          <?php
                            $row = $kit_rows[$index] ?? [
                                'id' => '',
                                'kit_name' => '',
                                'previous_kit_name' => '',
                                'description' => '',
                                'required_permission' => '',
                                'maximum_uses' => 0,
                                'required_auth' => 0,
                                'cooldown_seconds' => 0,
                                'cost' => 0,
                                'is_hidden' => 0,
                                'copy_paste_file' => '',
                                'image_path' => '',
                                'is_active' => 1,
                                'sort_order' => 100,
                                'reward_enabled' => 0,
                                'reward_product_id' => -1,
                                'reward_display_name' => '',
                                'reward_description' => '',
                                'reward_cost' => 0,
                                'reward_cooldown' => 0,
                                'reward_icon_url' => '',
                                'reward_permission' => '',
                                'items' => ['main' => [], 'wear' => [], 'belt' => []],
                                'groups' => [],
                                'store_product_ids' => [],
                            ];
                            $kit_title = trim((string) ($row['kit_name'] ?? ''));
                            $kit_groups = array_map('strval', (array) ($row['groups'] ?? []));
                            $kit_products = array_map('intval', (array) ($row['store_product_ids'] ?? []));
                            $kit_item_count = admin_kit_item_count($row);
                            $kit_is_active_panel = $index === 0;
                          ?>
                          <article
                            class="admin-repeat-card admin-kit-card admin-kit-panel<?= $kit_is_active_panel ? ' is-active' : '' ?>"
                            data-kit-panel
                            data-kit-index="<?= e((string) $index) ?>"
                            data-kit-expected="<?= e(admin_kit_slot_expected_json()) ?>"
                            <?= $kit_is_active_panel ? '' : 'hidden' ?>>
                            <input type="hidden" name="kits[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3 data-kit-card-title><?= e($kit_title !== '' ? $kit_title : 'New Kit') ?></h3>
                                <?php if (!empty($row['published_revision'])) : ?>
                                  <p class="admin-feedback-subtitle">Published revision <?= e((string) $row['published_revision']) ?><?= !empty($row['published_at']) ? ' at ' . e((string) $row['published_at']) : '' ?></p>
                                <?php endif; ?>
                              </div>
                              <?php if (!empty($row['id'])) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Deactivate</span>
                                </label>
                              <?php endif; ?>
                            </div>

                            <details class="admin-details" open>
                              <summary>Kit settings <small>Name, access, image, cooldown, uses</small></summary>
                              <div class="admin-grid three">
                                <label class="admin-field">
                                  <?= admin_field_head('Kit name', 'Exact Rust kit name. Renaming updates the server on publish.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][kit_name]" maxlength="160" placeholder="Raid Kit" value="<?= e((string) ($row['kit_name'] ?? '')) ?>" data-kit-name-input>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Previous name', 'Only needed when renaming an existing Rust kit.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][previous_kit_name]" maxlength="160" value="<?= e((string) ($row['previous_kit_name'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Required permission', 'Permission needed to claim the kit, such as kits.raid or serverrewards.paidpvpkit.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][required_permission]" maxlength="160" placeholder="kits.raid" value="<?= e((string) ($row['required_permission'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Max uses', 'Total claim limit tracked by the Rust Kits plugin. 0 means unlimited.') ?>
                                  <input type="number" min="0" max="99999999" name="kits[<?= e((string) $index) ?>][maximum_uses]" value="<?= e((string) ($row['maximum_uses'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Cooldown seconds', 'Seconds before the same player can claim this kit again.') ?>
                                  <input type="number" min="0" max="31536000" name="kits[<?= e((string) $index) ?>][cooldown_seconds]" value="<?= e((string) ($row['cooldown_seconds'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Claim cost', 'Cost charged by the Kits plugin when players claim directly from /kit.') ?>
                                  <input type="number" min="0" max="99999999" name="kits[<?= e((string) $index) ?>][cost]" value="<?= e((string) ($row['cost'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Auth level', 'Rust auth level required by the kit, usually 0.') ?>
                                  <input type="number" min="0" max="2" name="kits[<?= e((string) $index) ?>][required_auth]" value="<?= e((string) ($row['required_auth'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Sort order', 'Lower kits appear first in the website admin and public product details.') ?>
                                  <input type="number" min="0" max="9999" name="kits[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('CopyPaste file', 'Optional building file name used by the Rust Kits plugin.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][copy_paste_file]" maxlength="160" value="<?= e((string) ($row['copy_paste_file'] ?? '')) ?>">
                                </label>
                                <label class="admin-field admin-span-all">
                                  <?= admin_field_head('Description', 'Player-facing kit description shown on the website and in the Rust UI when supported.') ?>
                                  <textarea name="kits[<?= e((string) $index) ?>][description]" rows="3" maxlength="3000"><?= e((string) ($row['description'] ?? '')) ?></textarea>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Image URL/path', 'Use an HTTPS URL or an uploaded image under assets/media/kits/.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][image_path]" maxlength="500" placeholder="/assets/media/kits/raid-kit.png" value="<?= e((string) ($row['image_path'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Upload image', 'Optional PNG, JPG, WebP, or GIF. Upload replaces the URL/path above.') ?>
                                  <input type="file" name="kit_images[<?= e((string) $index) ?>]" accept="image/png,image/jpeg,image/webp,image/gif">
                                </label>
                                <?php if (!empty($row['image_path'])) : ?>
                                  <div class="admin-kit-image-preview">
                                    <img src="<?= e(raidlands_kits_public_image_url((string) $row['image_path'])) ?>" alt="">
                                  </div>
                                <?php endif; ?>
                                <label class="admin-check admin-check-field">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?>>
                                  <?= admin_check_copy('Active', 'Inactive kits stay in the website admin but are removed from the next published server payload.') ?>
                                </label>
                                <label class="admin-check admin-check-field">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][is_hidden]" value="1" <?= !empty($row['is_hidden']) ? 'checked' : '' ?>>
                                  <?= admin_check_copy('Hidden in /kit', 'Hidden kits can still be used by other systems such as the RP shop.') ?>
                                </label>
                              </div>
                            </details>
                            <details class="admin-details">
                              <summary>Availability and store links <small>Groups and public products</small></summary>
                              <div class="admin-grid two">
                                <div class="admin-field">
                                  <?= admin_field_head('Available groups', 'WebsiteVipBridge grants or revokes the kit permission for these groups during kit sync.') ?>
                                  <div class="admin-check-grid">
                                    <?php foreach ($admin_kit_groups as $group) : ?>
                                      <label class="admin-check">
                                        <input type="checkbox" name="kits[<?= e((string) $index) ?>][groups][]" value="<?= e((string) $group) ?>" <?= in_array((string) $group, $kit_groups, true) ? 'checked' : '' ?>>
                                        <span><?= e((string) $group) ?></span>
                                      </label>
                                    <?php endforeach; ?>
                                  </div>
                                  <input type="text" list="admin-kit-group-options" name="kits[<?= e((string) $index) ?>][groups][]" maxlength="160" placeholder="custom_group">
                                </div>
                                <div class="admin-field">
                                  <?= admin_field_head('Linked store products', 'Public store cards for selected products will show this kit and its contents.') ?>
                                  <div class="admin-check-grid">
                                    <?php foreach ($admin_kit_products as $product) : ?>
                                      <?php $product_id = (int) $product['id']; ?>
                                      <label class="admin-check">
                                        <input type="checkbox" name="kits[<?= e((string) $index) ?>][store_product_ids][]" value="<?= e((string) $product_id) ?>" <?= in_array($product_id, $kit_products, true) ? 'checked' : '' ?>>
                                        <span><?= e((string) $product['name']) ?></span>
                                      </label>
                                    <?php endforeach; ?>
                                  </div>
                                </div>
                              </div>
                            </details>

                            <details class="admin-details">
                              <summary>RP shop row <small>Optional /s listing</small></summary>
                              <div class="admin-grid three">
                                <label class="admin-check admin-check-field">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][reward_enabled]" value="1" <?= !empty($row['reward_enabled']) ? 'checked' : '' ?>>
                                  <?= admin_check_copy('Show in rewards shop', 'Adds or updates this kit in the ServerRewards kit list.') ?>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Rewards product ID', 'Existing ServerRewards product ID. Leave -1 for the bridge to create one.') ?>
                                  <input type="number" min="-1" max="99999999" name="kits[<?= e((string) $index) ?>][reward_product_id]" value="<?= e((string) ($row['reward_product_id'] ?? -1)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('RP price', 'Reward points charged in the /s shop.') ?>
                                  <input type="number" min="0" max="99999999" name="kits[<?= e((string) $index) ?>][reward_cost]" value="<?= e((string) ($row['reward_cost'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Shop display name', 'Name shown in the ServerRewards shop.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][reward_display_name]" maxlength="160" value="<?= e((string) ($row['reward_display_name'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Shop cooldown', 'ServerRewards purchase cooldown in seconds.') ?>
                                  <input type="number" min="0" max="31536000" name="kits[<?= e((string) $index) ?>][reward_cooldown]" value="<?= e((string) ($row['reward_cooldown'] ?? 0)) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Shop permission', 'Optional ServerRewards purchase permission, such as serverrewards.paidpvpkit.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][reward_permission]" maxlength="160" value="<?= e((string) ($row['reward_permission'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Shop icon URL/path', 'Defaults to the kit image when blank.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][reward_icon_url]" maxlength="500" value="<?= e((string) ($row['reward_icon_url'] ?? '')) ?>">
                                </label>
                                <label class="admin-field admin-span-all">
                                  <?= admin_field_head('Shop description', 'Optional copy for the ServerRewards shop row.') ?>
                                  <textarea name="kits[<?= e((string) $index) ?>][reward_description]" rows="2" maxlength="3000"><?= e((string) ($row['reward_description'] ?? '')) ?></textarea>
                                </label>
                              </div>
                            </details>

                            <details class="admin-details admin-kit-loadout-details" open>
                              <summary>Kit contents <small>Inventory, wear, and hotbar slots</small></summary>
                              <?= admin_render_kit_slot_editor($row, $index, $admin_kit_item_map) ?>
                            </details>

                            <?php if (false) : ?>
                            <details class="admin-details">
                              <summary>Kit contents <small>Main, wear, and belt item rows</small></summary>
                              <?php foreach (['main', 'wear', 'belt'] as $container) : ?>
                                <div class="admin-kit-container">
                                  <div class="admin-subsection-head">
                                    <h3><?= e(admin_kit_container_label($container)) ?> Items</h3>
                                    <p>Leave a shortname blank to ignore that row. Nested contents/container fields accept guarded JSON.</p>
                                  </div>
                                  <div class="admin-repeat-list compact">
                                    <?php foreach (admin_kit_item_rows($row, $container) as $item_index => $item) : ?>
                                      <article class="admin-repeat-row admin-kit-item-row">
                                        <div class="admin-grid three">
                                          <label class="admin-field">
                                            <?= admin_field_head('Shortname', 'Rust item shortname.') ?>
                                            <input type="text" list="admin-kit-shortname-options" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][shortname]" maxlength="160" value="<?= e((string) ($item['shortname'] ?? '')) ?>">
                                          </label>
                                          <label class="admin-field">
                                            <?= admin_field_head('Amount', 'Stack amount given in the kit.') ?>
                                            <input type="number" min="1" max="1000000" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][amount]" value="<?= e((string) ($item['amount'] ?? 1)) ?>">
                                          </label>
                                          <label class="admin-field">
                                            <?= admin_field_head('Slot', 'Container slot position.') ?>
                                            <input type="number" min="0" max="<?= e($container === 'main' ? '23' : ($container === 'wear' ? '7' : '5')) ?>" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][position]" value="<?= e((string) ($item['position'] ?? $item_index)) ?>">
                                          </label>
                                          <?php if ((int) ($item['skin'] ?? 0) !== 0) : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Skin', 'Rust workshop skin ID. Use 0 for default.') ?>
                                              <input type="number" min="0" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][skin]" value="<?= e((string) ($item['skin'] ?? 0)) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if ((float) ($item['condition_value'] ?? 0) !== 0.0) : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Condition', 'Current item condition. 0 lets Rust defaults apply for many items.') ?>
                                              <input type="number" min="0" step="0.01" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][condition]" value="<?= e((string) ($item['condition_value'] ?? 0)) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if ((float) ($item['max_condition'] ?? 0) !== 0.0) : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Max condition', 'Maximum item condition saved by the Kits plugin.') ?>
                                              <input type="number" min="0" step="0.01" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][max_condition]" value="<?= e((string) ($item['max_condition'] ?? 0)) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if ((int) ($item['ammo'] ?? 0) !== 0) : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Ammo', 'Loaded ammo count for weapons.') ?>
                                              <input type="number" min="0" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][ammo]" value="<?= e((string) ($item['ammo'] ?? 0)) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['ammo_type'] ?? '')) !== '') : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Ammo type', 'Optional ammo shortname for loaded weapons.') ?>
                                              <input type="text" list="admin-kit-shortname-options" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][ammo_type]" maxlength="160" value="<?= e((string) ($item['ammo_type'] ?? '')) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if ((int) ($item['frequency'] ?? -1) !== -1) : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Frequency', 'RF frequency for pagers or similar items. -1 means none.') ?>
                                              <input type="number" min="-1" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][frequency]" value="<?= e((string) ($item['frequency'] ?? -1)) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['display_name'] ?? '')) !== '') : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Display name', 'Optional custom item display name.') ?>
                                              <input type="text" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][display_name]" maxlength="160" value="<?= e((string) ($item['display_name'] ?? '')) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['blueprint_shortname'] ?? '')) !== '') : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Blueprint target', 'Optional blueprint target shortname.') ?>
                                              <input type="text" list="admin-kit-shortname-options" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][blueprint_shortname]" maxlength="160" value="<?= e((string) ($item['blueprint_shortname'] ?? '')) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['text_value'] ?? '')) !== '') : ?>
                                            <label class="admin-field">
                                              <?= admin_field_head('Text', 'Optional custom item text.') ?>
                                              <input type="text" name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][text]" maxlength="1000" value="<?= e((string) ($item['text_value'] ?? '')) ?>">
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['contents_json'] ?? '')) !== '') : ?>
                                            <label class="admin-field admin-span-all">
                                              <?= admin_field_head('Contents JSON', 'Advanced: nested item contents JSON array. Leave blank unless the imported kit needs it.') ?>
                                              <textarea name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][contents_json]" rows="2"><?= e((string) ($item['contents_json'] ?? '')) ?></textarea>
                                            </label>
                                          <?php endif; ?>
                                          <?php if (trim((string) ($item['container_json'] ?? '')) !== '') : ?>
                                            <label class="admin-field admin-span-all">
                                              <?= admin_field_head('Container JSON', 'Advanced: serialized item container JSON. Leave blank unless the imported kit needs it.') ?>
                                              <textarea name="kits[<?= e((string) $index) ?>][items][<?= e($container) ?>][<?= e((string) $item_index) ?>][container_json]" rows="2"><?= e((string) ($item['container_json'] ?? '')) ?></textarea>
                                            </label>
                                          <?php endif; ?>
                                        </div>
                                      </article>
                                    <?php endforeach; ?>
                                  </div>
                                </div>
                              <?php endforeach; ?>
                            </details>
                            <?php endif; ?>
                          </article>
                        <?php endfor; ?>
                        </div>
                        <aside class="admin-kit-picker" aria-label="Kit selector">
                          <div class="admin-kit-picker-head">
                            <h3>Kits</h3>
                            <p><?= e((string) count($kit_rows)) ?> saved<?= $kit_rows === [] ? '' : ' plus new draft slot' ?></p>
                          </div>
                          <div class="admin-kit-picker-list">
                            <?php for ($selector_index = 0; $selector_index < $kit_total; $selector_index += 1) : ?>
                              <?php
                                $selector_row = $kit_rows[$selector_index] ?? ['id' => '', 'kit_name' => '', 'is_active' => 1, 'items' => ['main' => [], 'wear' => [], 'belt' => []]];
                                $selector_title = trim((string) ($selector_row['kit_name'] ?? ''));
                                $selector_is_active = $selector_index === 0;
                                $selector_item_count = admin_kit_item_count($selector_row);
                              ?>
                              <button
                                class="admin-kit-picker-button<?= $selector_is_active ? ' is-active' : '' ?>"
                                type="button"
                                data-kit-select
                                data-kit-index="<?= e((string) $selector_index) ?>"
                                <?= $selector_is_active ? 'aria-current="true"' : '' ?>>
                                <span data-kit-select-label><?= e($selector_title !== '' ? $selector_title : 'New Kit') ?></span>
                                <small><?= e($selector_item_count . ' item' . ($selector_item_count === 1 ? '' : 's')) ?> / <?= empty($selector_row['id']) ? 'Draft' : (empty($selector_row['is_active']) ? 'Inactive' : 'Active') ?></small>
                              </button>
                            <?php endfor; ?>
                          </div>
                        </aside>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Recent kit sync</h3>
                        <p>The Rust server reports whether a published kit revision was applied or failed.</p>
                      </div>
                      <?php if ($admin_kit_sync_rows === []) : ?>
                        <div class="admin-alert warning">No kit sync events have been recorded yet.</div>
                      <?php else : ?>
                        <div class="store-table-wrap">
                          <table class="store-table">
                            <thead>
                              <tr>
                                <th>Revision</th>
                                <th>Status</th>
                                <th>Message</th>
                                <th>Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              <?php foreach ($admin_kit_sync_rows as $sync_row) : ?>
                                <tr>
                                  <td><?= e((string) $sync_row['revision']) ?></td>
                                  <td><span class="status-pill <?= e((string) $sync_row['status']) ?>"><?= e((string) $sync_row['status']) ?></span></td>
                                  <td><?= e((string) ($sync_row['message'] ?: $sync_row['error_text'] ?: '')) ?></td>
                                  <td><?= e((string) $sync_row['updated_at']) ?></td>
                                </tr>
                              <?php endforeach; ?>
                            </tbody>
                          </table>
                        </div>
                      <?php endif; ?>
                    </section>
                  <?php endif; ?>
                <?php endif; ?>

                <?php if ($active_section === 'groups') : ?>
                  <?php if (!$admin_permissions_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning"><?= e($admin_permissions_error !== '' ? $admin_permissions_error : 'Permission tables are not ready yet.') ?></div>
                    </section>
                  <?php else : ?>
                    <?php
                      echo admin_render_datalist('admin-permission-options', admin_option_map($admin_permission_options));
                      echo admin_render_datalist('admin-group-name-options', admin_option_map(raidlands_permissions_group_names(true)));
                      $permission_group_rows = array_values($admin_permission_groups);
                      $permission_group_total = count($permission_group_rows) + 1;
                      $permission_option_set = array_fill_keys(array_map('strval', $admin_permission_options), true);
                    ?>
                    <section class="admin-section">
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Published revision</p>
                          <h3><?= e((string) raidlands_permissions_latest_published_revision()) ?></h3>
                          <p class="store-muted">Rust applies only published group revisions.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Managed groups</p>
                          <h3><?= e((string) count(array_filter($permission_group_rows, static fn (array $row): bool => !empty($row['is_managed']) && empty($row['is_read_only'])))) ?></h3>
                          <p class="store-muted">Editable groups in the website catalog.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Permission catalog</p>
                          <h3><?= e((string) count($admin_permission_options)) ?></h3>
                          <p class="store-muted">Live snapshot and seeded permission options.</p>
                        </div>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Group editor</h3>
                        <p>Save Draft keeps desired permissions on the website. Publish sends the composed group and kit permissions to Rust on the next bridge sync.</p>
                      </div>
                      <div class="admin-repeat-list">
                        <?php for ($index = 0; $index < $permission_group_total; $index += 1) : ?>
                          <?php
                            $row = $permission_group_rows[$index] ?? [
                                'id' => '',
                                'group_name' => '',
                                'title' => '',
                                'rank' => 0,
                                'parent_group' => '',
                                'category' => 'custom',
                                'is_managed' => 1,
                                'is_protected' => 0,
                                'is_read_only' => 0,
                                'is_active' => 1,
                                'sort_order' => 100,
                                'notes' => '',
                                'desired_permissions' => [],
                                'live_permissions' => [],
                            ];
                            $group_name = (string) ($row['group_name'] ?? '');
                            $desired_permissions = array_values(array_unique(array_map('strval', (array) ($row['desired_permissions'] ?? []))));
                            $live_permissions = array_values(array_unique(array_map('strval', (array) ($row['live_permissions'] ?? []))));
                            $desired_set = array_fill_keys($desired_permissions, true);
                            $custom_permissions = array_values(array_filter($desired_permissions, static fn (string $permission): bool => !isset($permission_option_set[$permission])));
                            $missing_live = array_values(array_diff($desired_permissions, $live_permissions));
                            $extra_live = array_values(array_diff($live_permissions, $desired_permissions));
                            $is_read_only = !empty($row['is_read_only']);
                            $card_title = $group_name !== '' ? $group_name : 'New Group';
                          ?>
                          <article class="admin-repeat-card">
                            <input type="hidden" name="permission_groups[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3><?= e($card_title) ?></h3>
                                <?php if ($is_read_only) : ?>
                                  <p class="admin-feedback-subtitle">Read-only system group. The website will snapshot this group but will not publish changes for it.</p>
                                <?php elseif ($missing_live !== [] || $extra_live !== []) : ?>
                                  <p class="admin-feedback-subtitle">Live drift: <?= e((string) count($missing_live)) ?> missing / <?= e((string) count($extra_live)) ?> extra direct grants.</p>
                                <?php else : ?>
                                  <p class="admin-feedback-subtitle">Desired permissions match the latest live snapshot.</p>
                                <?php endif; ?>
                              </div>
                            </div>

                            <div class="admin-grid three">
                              <label class="admin-field">
                                <?= admin_field_head('Group name', 'Stable Oxide group name. Use lowercase letters, numbers, dots, dashes, or underscores.') ?>
                                <input type="text" list="admin-group-name-options" name="permission_groups[<?= e((string) $index) ?>][group_name]" maxlength="160" placeholder="vip_bronze" value="<?= e($group_name) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Title', 'Optional Oxide group title. Usually matches the group name.') ?>
                                <input type="text" name="permission_groups[<?= e((string) $index) ?>][title]" maxlength="160" value="<?= e((string) ($row['title'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Parent', 'Optional inherited Oxide parent group. Leave blank for no parent.') ?>
                                <input type="text" list="admin-group-name-options" name="permission_groups[<?= e((string) $index) ?>][parent_group]" maxlength="160" value="<?= e((string) ($row['parent_group'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Rank', 'Oxide group rank. Higher ranks are useful for VIP tier order.') ?>
                                <input type="number" min="0" max="9999" name="permission_groups[<?= e((string) $index) ?>][rank]" value="<?= e((string) ($row['rank'] ?? 0)) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Category', 'Admin grouping only: public, vip, perk, store, system, snapshot, or custom.') ?>
                                <select name="permission_groups[<?= e((string) $index) ?>][category]">
                                  <?= admin_render_options(['public', 'vip', 'perk', 'store', 'system', 'snapshot', 'custom'], (string) ($row['category'] ?? 'custom')) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Sort order', 'Lower groups appear first in this editor and picker lists.') ?>
                                <input type="number" min="0" max="9999" name="permission_groups[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>">
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Active', 'Inactive groups stay in the catalog but are ignored by published sync.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][is_managed]" value="1" <?= !empty($row['is_managed']) && !$is_read_only ? 'checked' : '' ?> <?= $is_read_only ? 'disabled' : '' ?>>
                                <?= admin_check_copy('Website managed', 'Managed groups are included in published permission sync. Read-only system groups are never published.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][is_protected]" value="1" <?= !empty($row['is_protected']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Protected', 'Marks gameplay-sensitive groups like default or discord so edits stay visible and intentional.') ?>
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Notes', 'Admin-only context for why this group exists or what it should unlock.') ?>
                                <textarea name="permission_groups[<?= e((string) $index) ?>][notes]" rows="2" maxlength="3000"><?= e((string) ($row['notes'] ?? '')) ?></textarea>
                              </label>
                            </div>

                            <details class="admin-details" <?= $group_name !== '' && !$is_read_only ? 'open' : '' ?>>
                              <summary>Direct permissions <small><?= e((string) count($desired_permissions)) ?> desired / <?= e((string) count($live_permissions)) ?> live</small></summary>
                              <?php if ($is_read_only) : ?>
                                <div class="admin-alert warning">This system group is snapshot-only. Direct grants are visible in live drift checks but are not editable from the website.</div>
                              <?php endif; ?>
                              <div class="admin-grid three">
                                <?php foreach ($admin_permission_options as $permission_name) : ?>
                                  <label class="admin-check admin-check-field">
                                    <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][permissions][]" value="<?= e((string) $permission_name) ?>" <?= isset($desired_set[(string) $permission_name]) ? 'checked' : '' ?> <?= $is_read_only ? 'disabled' : '' ?>>
                                    <?= admin_check_copy((string) $permission_name, isset($desired_set[(string) $permission_name]) && !in_array((string) $permission_name, $live_permissions, true) ? 'Desired but missing from latest live snapshot.' : 'Toggle this direct Oxide group permission.') ?>
                                  </label>
                                <?php endforeach; ?>
                                <label class="admin-field admin-span-all">
                                  <?= admin_field_head('Custom permissions', 'One permission per line for live permissions not listed above yet.') ?>
                                  <textarea name="permission_groups[<?= e((string) $index) ?>][custom_permissions]" rows="3" placeholder="plugin.permission" <?= $is_read_only ? 'disabled' : '' ?>><?= e(implode("\n", $custom_permissions)) ?></textarea>
                                </label>
                              </div>
                            </details>
                          </article>
                        <?php endfor; ?>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Recent group sync</h3>
                        <p>The Rust server reports whether a published group permission revision was applied or failed.</p>
                      </div>
                      <?php if ($admin_permission_sync_rows === []) : ?>
                        <div class="admin-alert warning">No group permission sync events have been recorded yet.</div>
                      <?php else : ?>
                        <div class="store-table-wrap">
                          <table class="store-table">
                            <thead>
                              <tr>
                                <th>Revision</th>
                                <th>Status</th>
                                <th>Message</th>
                                <th>Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              <?php foreach ($admin_permission_sync_rows as $sync_row) : ?>
                                <tr>
                                  <td><?= e((string) $sync_row['revision']) ?></td>
                                  <td><span class="status-pill <?= e((string) $sync_row['status']) ?>"><?= e((string) $sync_row['status']) ?></span></td>
                                  <td><?= e((string) ($sync_row['message'] ?: $sync_row['error_text'] ?: '')) ?></td>
                                  <td><?= e((string) $sync_row['updated_at']) ?></td>
                                </tr>
                              <?php endforeach; ?>
                            </tbody>
                          </table>
                        </div>
                      <?php endif; ?>
                    </section>
                  <?php endif; ?>
                <?php endif; ?>

                <?php if ($active_section === 'grants') : ?>
                  <section class="admin-section">
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL must be configured before manual grants can be recorded. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif (empty($admin_store_catalog['products'])) : ?>
                      <div class="admin-alert warning">No products are available to grant yet. Add at least one active store product with an Oxide group before using manual grants.</div>
                    <?php else : ?>
                      <?php $admin_grant_products = array_values($admin_store_catalog['products']); ?>
                      <div class="admin-grid two">
                        <label class="admin-field">
                          <?= admin_field_head('SteamID64', 'The 17-digit Rust player ID that should receive this entitlement.') ?>
                          <input type="text" name="steam_id64" inputmode="numeric" pattern="[0-9]{17}" maxlength="17" placeholder="7656119XXXXXXXXXX" required>
                          <?= admin_hint('Manual grants link directly to the selected player. Double-check the ID before saving.') ?>
                        </label>
                        <label class="admin-field">
                          <?= admin_field_head('Product', 'The selected product controls the Oxide group WebsiteVipBridge will sync.') ?>
                          <select name="product_id" required>
                            <option value="" disabled selected>Choose a product to grant</option>
                            <?php foreach ($admin_grant_products as $product) : ?>
                              <option value="<?= e((string) $product['id']) ?>"><?= e((string) $product['name']) ?> (<?= e((string) $product['oxide_group']) ?>)</option>
                            <?php endforeach; ?>
                          </select>
                        </label>
                        <label class="admin-field">
                          <?= admin_field_head('Ends at', 'Optional MySQL datetime such as 2026-07-31 23:59:59. Leave blank for no scheduled expiration.') ?>
                          <input type="text" name="ends_at" placeholder="YYYY-MM-DD HH:MM:SS">
                          <?= admin_hint('Monthly VIP should usually have an end date. Permanent one-time perks can stay blank.') ?>
                        </label>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'sync') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <div class="metal-panel">
                        <p class="section-kicker">Managed groups</p>
                        <h3>Bridge-controlled permissions</h3>
                        <p class="store-muted">Only products using these groups should be expected to sync cleanly into Rust.</p>
                        <ul class="list-clean">
                          <?php foreach (raidlands_store_managed_groups() as $group) : ?>
                            <li><code><?= e($group) ?></code></li>
                          <?php endforeach; ?>
                        </ul>
                      </div>
                      <div class="metal-panel">
                        <p class="section-kicker">Bridge API</p>
                        <h3>Endpoints</h3>
                        <p class="store-muted">WebsiteVipBridge calls these from the Rust server with the shared HMAC secret.</p>
                        <ul class="list-clean">
                          <li><code>/api/server/vip-player.php?steam_id64=...</code></li>
                          <li><code>/api/server/vip-changes.php?since=...</code></li>
                          <li><code>/api/server/stats-snapshot.php</code></li>
                          <li><code>/api/server/kits-snapshot.php</code></li>
                          <li><code>/api/server/kits-sync.php?since=...</code></li>
                          <li><code>/api/server/kits-sync-result.php</code></li>
                          <li><code>/api/server/permissions-snapshot.php</code></li>
                          <li><code>/api/server/permissions-sync.php?since=...</code></li>
                          <li><code>/api/server/permissions-sync-result.php</code></li>
                          <li><code>/api/server/clan-snapshot.php</code></li>
                          <li><code>/api/server/clan-actions.php?limit=...</code></li>
                          <li><code>/api/server/clan-action-result.php</code></li>
                          <li>Requests require Raidlands HMAC headers.</li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Stats ingest</h3>
                      <p>Website leaderboards and profile RP use snapshots posted by WebsiteVipBridge. The active wipe comes from the bridge wipe key, not this admin schedule form.</p>
                    </div>
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL is not configured yet. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif (empty($admin_stats_summary['ready'])) : ?>
                      <div class="admin-alert warning">Stats tables are not installed yet. Run <code>database/migrations/002_player_stats.sql</code>.</div>
                    <?php else : ?>
                      <?php
                        $active_wipe = $admin_stats_summary['active_wipe'];
                        $latest_ingest = $admin_stats_summary['latest_ingest'];
                      ?>
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Active wipe</p>
                          <h3><?= e((string) ($active_wipe['wipe_key'] ?? 'None')) ?></h3>
                          <p class="store-muted">Snapshots: <?= e((string) ($active_wipe['snapshot_count'] ?? 0)) ?></p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Tracked players</p>
                          <h3><?= e((string) $admin_stats_summary['current_players']) ?></h3>
                          <p class="store-muted">Current wipe rows</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Last stats sync</p>
                          <h3><?= e((string) ($latest_ingest['created_at'] ?? 'Pending')) ?></h3>
                          <p class="store-muted"><?= e((string) ($latest_ingest['players_accepted'] ?? 0)) ?> accepted / <?= e((string) ($latest_ingest['players_received'] ?? 0)) ?> received</p>
                        </div>
                      </div>
                    <?php endif; ?>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Clan bridge</h3>
                      <p>WebsiteClanBridge posts roster snapshots, claims queued website/API actions, and sends action results back after the Rust server processes them.</p>
                    </div>
                    <?php if (empty($admin_clan_summary['ready'])) : ?>
                      <div class="admin-alert warning"><?= e((string) ($admin_clan_summary['message'] ?: 'Clan tables are not ready. Run database/migrations/004_clan_management.sql.')) ?></div>
                    <?php else : ?>
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Synced clans</p>
                          <h3><?= e((string) $admin_clan_summary['clan_count']) ?></h3>
                          <p class="store-muted"><?= e((string) $admin_clan_summary['member_count']) ?> member rows</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Last clan snapshot</p>
                          <h3><?= e((string) ($admin_clan_summary['latest_snapshot'] ?? 'Pending')) ?></h3>
                          <p class="store-muted">Actions disable after ten stale minutes.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Public API keys</p>
                          <h3><?= e((string) $admin_clan_summary['active_api_keys']) ?></h3>
                          <p class="store-muted">Active Steam-linked keys</p>
                        </div>
                      </div>

                      <?php if ($admin_clan_summary['recent_actions'] !== []) : ?>
                        <div class="store-table-wrap admin-clan-actions">
                          <table class="store-table">
                            <thead>
                              <tr>
                                <th>Action</th>
                                <th>Actor</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Changed</th>
                              </tr>
                            </thead>
                            <tbody>
                              <?php foreach ($admin_clan_summary['recent_actions'] as $row) : ?>
                                <tr>
                                  <td><?= e(ucwords(str_replace('_', ' ', (string) $row['action_type']))) ?> <code><?= e((string) $row['clan_tag']) ?></code></td>
                                  <td><code><?= e((string) $row['actor_steam_id64']) ?></code></td>
                                  <td><code><?= e((string) ($row['target_steam_id64'] ?: 'Clan')) ?></code></td>
                                  <td><span class="status-pill <?= e((string) $row['status']) ?>"><?= e((string) $row['status']) ?></span></td>
                                  <td><?= e((string) ($row['completed_at'] ?: $row['created_at'])) ?></td>
                                </tr>
                              <?php endforeach; ?>
                            </tbody>
                          </table>
                        </div>
                      <?php endif; ?>
                    <?php endif; ?>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Recent entitlement changes</h3>
                      <p>These rows drive the bridge change cursor. A row here means the website recorded a grant, revoke, or expiration that Rust should pick up.</p>
                    </div>
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL is not configured yet. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif ($admin_sync_rows === []) : ?>
                      <div class="admin-alert warning">No entitlement changes have been recorded yet.</div>
                    <?php else : ?>
                      <div class="store-table-wrap">
                        <table class="store-table">
                          <thead>
                            <tr>
                              <th>SteamID64</th>
                              <th>Product</th>
                              <th>Group</th>
                              <th>Status</th>
                              <th>Ends</th>
                              <th>Changed</th>
                            </tr>
                          </thead>
                          <tbody>
                            <?php foreach ($admin_sync_rows as $row) : ?>
                              <tr>
                                <td><code><?= e((string) $row['steam_id64']) ?></code></td>
                                <td><?= e((string) $row['name']) ?></td>
                                <td><code><?= e((string) $row['oxide_group']) ?></code></td>
                                <td><span class="status-pill <?= e((string) $row['status']) ?>"><?= e((string) $row['status']) ?></span></td>
                                <td><?= e((string) ($row['ends_at'] ?: 'None')) ?></td>
                                <td><?= e((string) $row['changed_at']) ?></td>
                              </tr>
                            <?php endforeach; ?>
                          </tbody>
                        </table>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <div class="admin-savebar">
                  <?php
                    $admin_save_allowed = raidlands_admin_can_save_section($active_section);
                    $admin_save_hidden = !$admin_save_allowed
                        || $active_section === 'sync'
                        || ($active_section === 'feedback' && (!$admin_feedback_ready || $admin_feedback_rows === []));
                    $admin_save_disabled = ($active_section === 'store' && !$admin_store_ready)
                        || ($active_section === 'kits' && !$admin_kits_ready)
                        || ($active_section === 'groups' && !$admin_permissions_ready)
                        || ($active_section === 'grants' && (!$admin_store_ready || empty($admin_store_catalog['products'])));
                    $admin_disabled_label = match ($active_section) {
                        'store' => 'Store Unavailable',
                        'kits' => 'Kits Unavailable',
                        'groups' => 'Groups Unavailable',
                        default => 'Grant Unavailable',
                    };
                  ?>
                  <?php if (!$admin_save_hidden) : ?>
                    <?php if ($active_section === 'kits') : ?>
                      <button class="btn btn-secondary" type="submit" name="kit_save_mode" value="draft" data-kit-save-submit="draft" <?= $admin_save_disabled ? 'disabled' : '' ?>><?= $admin_save_disabled ? e($admin_disabled_label) : 'Save Draft' ?></button>
                      <button class="btn btn-primary" type="submit" name="kit_save_mode" value="publish" data-kit-save-submit="publish" <?= $admin_save_disabled ? 'disabled' : '' ?>><?= $admin_save_disabled ? e($admin_disabled_label) : 'Publish to Server' ?></button>
                    <?php elseif ($active_section === 'groups') : ?>
                      <button class="btn btn-secondary" type="submit" name="permission_save_mode" value="draft" <?= $admin_save_disabled ? 'disabled' : '' ?>><?= $admin_save_disabled ? e($admin_disabled_label) : 'Save Draft' ?></button>
                      <button class="btn btn-primary" type="submit" name="permission_save_mode" value="publish" <?= $admin_save_disabled ? 'disabled' : '' ?>><?= $admin_save_disabled ? e($admin_disabled_label) : 'Publish to Server' ?></button>
                    <?php else : ?>
                      <button class="btn btn-primary" type="submit" <?= $admin_save_disabled ? 'disabled' : '' ?>><?= $admin_save_disabled ? e($admin_disabled_label) : 'Save ' . e($active_meta['label']) ?></button>
                    <?php endif; ?>
                  <?php endif; ?>
                  <a class="btn btn-secondary" href="<?= e(route_url()) ?>">View Site</a>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
      <?php if ($active_section === 'kits') : ?>
        <script src="<?= e(asset_url('js/admin-kits.js')) ?>" defer></script>
        <script>
          document.querySelectorAll('[data-kit-save-submit]').forEach(function (button) {
            button.addEventListener('click', function () {
              var mode = document.querySelector('[data-kit-save-mode]');

              if (mode) {
                mode.value = button.getAttribute('data-kit-save-submit') || 'draft';
              }
            });
          });
        </script>
      <?php endif; ?>
    <?php endif; ?>
  </body>
</html>
