<?php

$page_id = 'admin';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require $site_root . '/includes/admin.php';
require_once $site_root . '/includes/server-status.php';
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
    'links' => ['label' => 'Links', 'kicker' => 'Launch', 'title' => 'Links and Integrations', 'summary' => 'Join buttons, Discord invites, live status settings, and future OAuth links.'],
    'wipe' => ['label' => 'Wipe', 'kicker' => 'Schedule', 'title' => 'Wipe Settings', 'summary' => 'The wipe days and time used by countdowns and schedule text.'],
    'features' => ['label' => 'Features', 'kicker' => 'Content', 'title' => 'Feature Lists', 'summary' => 'Public feature planning records, voting candidates, and suggestion review.'],
    'pages' => ['label' => 'Pages', 'kicker' => 'Copy', 'title' => 'Hero Copy', 'summary' => 'The title and intro text shown at the top of each page.'],
    'seo' => ['label' => 'SEO', 'kicker' => 'Search', 'title' => 'SEO Metadata', 'summary' => 'Browser titles, descriptions, and social sharing copy.'],
    'feedback' => ['label' => 'Feedback', 'kicker' => 'Inbox', 'title' => 'Player Feedback', 'summary' => 'Bug reports, suggestions, and feature requests submitted from the support page.'],
    'store' => ['label' => 'Store', 'kicker' => 'Offers', 'title' => 'Products and Prices', 'summary' => 'Kit bundles, individual kits, standalone perks, RP offers, Stripe Price IDs, and managed access groups.'],
    'kits' => ['label' => 'Kits', 'kicker' => 'Loadouts', 'title' => 'Kit Catalog', 'summary' => 'Rust kit contents, images, cooldowns, uses, RP shop rows, and required Kits plugin permissions.'],
    'groups' => ['label' => 'Groups', 'kicker' => 'Permissions', 'title' => 'Oxide Groups', 'summary' => 'Website-owned group permissions, live snapshots, and bridge-published revisions.'],
    'grants' => ['label' => 'Player Access', 'kicker' => 'Access', 'title' => 'Player Access', 'summary' => 'Load a SteamID64, grant products, add standalone shop groups, and remove website-owned manual access.'],
    'sync' => ['label' => 'Sync', 'kicker' => 'Bridge', 'title' => 'WebsiteVipBridge State', 'summary' => 'Entitlement sync, stats ingest status, and server API endpoints.'],
];
$admin_nav_groups = [
    'site-setup' => ['label' => 'Site Setup', 'sections' => ['identity', 'links']],
    'content' => ['label' => 'Content', 'sections' => ['features', 'pages', 'seo', 'feedback']],
    'store-access' => ['label' => 'Store & Access', 'sections' => ['store', 'kits', 'groups', 'grants']],
    'server-ops' => ['label' => 'Server Ops', 'sections' => ['wipe', 'sync']],
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
$admin_nav_groups_visible = [];
$active_nav_group = '';

foreach ($admin_nav_groups as $group_key => $group) {
    $visible_group_sections = [];

    foreach ($group['sections'] as $section_key) {
        if (!isset($admin_sections[$section_key])) {
            continue;
        }

        $visible_group_sections[$section_key] = $admin_sections[$section_key];

        if ($section_key === $active_section) {
            $active_nav_group = $group_key;
        }
    }

    if ($visible_group_sections !== []) {
        $admin_nav_groups_visible[$group_key] = [
            'label' => $group['label'],
            'sections' => $visible_group_sections,
        ];
    }
}
$admin_store_ready = false;
$admin_store_error = '';
$admin_store_rows = [];
$admin_store_catalog = ['products' => []];
$admin_access_steam_id64 = raidlands_store_normalize_steam_id64($_GET['steam_id64'] ?? '');
$admin_access_state = null;
$admin_access_group_rows = [];
$admin_access_assignments_ready = false;
$admin_access_lookup_error = '';
$admin_sync_rows = [];
$admin_feedback_rows = [];
$admin_feedback_counts = [];
$admin_feedback_ready = false;
$admin_feedback_error = '';
$admin_feedback_feature_rows = [];
$admin_feedback_feature_links = [];
$admin_feedback_features_ready = false;
$admin_feedback_features_error = '';
$admin_features_state = [
    'ready' => false,
    'error' => '',
    'features' => [],
    'pending_suggestions' => [],
    'grouped_suggestions' => [],
    'feedback_import_count' => 0,
    'window' => [],
];
$admin_features_ready = false;
$admin_features_error = '';
$admin_kits_ready = false;
$admin_kits_error = '';
$admin_kit_rows = [];
$admin_kit_shortnames = [];
$admin_kit_item_catalog = [];
$admin_kit_item_map = [];
$admin_kit_sync_rows = [];
$admin_permissions_ready = false;
$admin_permissions_error = '';
$admin_permission_groups = [];
$admin_permission_rows = [];
$admin_permission_options = [];
$admin_permission_sync_rows = [];
$admin_stats_summary = [
    'ready' => false,
    'active_wipe' => null,
    'latest_ingest' => null,
    'current_players' => 0,
];
$admin_server_status = null;
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

        $admin_permission_rows = raidlands_permissions_permission_rows();
        $admin_permission_options = raidlands_permissions_permission_names();
    }

    if ($active_section === 'grants') {
        $admin_store_catalog = raidlands_store_catalog(true);

        if (!empty($admin_store_catalog['setupRequired'])) {
            $admin_store_ready = false;
            $admin_store_error = (string) ($admin_store_catalog['error'] ?? $admin_store_error);
        }

        $admin_access_assignments_ready = raidlands_store_player_group_assignments_ready();
        $admin_access_group_rows = raidlands_store_admin_assignable_group_rows();

        if ($admin_access_steam_id64 !== '') {
            if (raidlands_store_validate_steam_id64($admin_access_steam_id64)) {
                $admin_access_state = raidlands_store_admin_player_access_state($admin_access_steam_id64);
            } else {
                $admin_access_lookup_error = 'Enter a valid SteamID64. It should be 17 digits and start with 7656119.';
            }
        }
    }

    if ($active_section === 'sync') {
        $admin_store_catalog = raidlands_store_catalog(false);

        if (!empty($admin_store_catalog['setupRequired'])) {
            $admin_store_ready = false;
            $admin_store_error = (string) ($admin_store_catalog['error'] ?? $admin_store_error);
        }
    }

    if ($active_section === 'sync') {
        $admin_clan_summary = raidlands_clans_admin_summary();
        $admin_server_status = raidlands_server_status_public();

        if ($admin_store_ready) {
            $admin_sync_rows = raidlands_store_recent_sync_rows(30);
            $admin_stats_summary = raidlands_stats_admin_summary();
        }
    }

    if ($active_section === 'features') {
        $admin_features_state = raidlands_features_admin_state();
        $admin_features_ready = !empty($admin_features_state['ready']);
        $admin_features_error = (string) ($admin_features_state['error'] ?? '');
    }

    if ($active_section === 'feedback') {
        $admin_feedback_ready = raidlands_feedback_is_ready();

        if ($admin_feedback_ready) {
            $admin_feedback_rows = raidlands_feedback_submissions();
            $admin_feedback_counts = raidlands_feedback_status_counts($admin_feedback_rows);
            $admin_feedback_features_ready = raidlands_features_is_ready();

            if ($admin_feedback_features_ready) {
                try {
                    raidlands_features_seed_defaults();
                    $admin_feedback_feature_rows = raidlands_features_admin_items();
                    $admin_feedback_feature_links = raidlands_features_feedback_workflow_state(array_column($admin_feedback_rows, 'id'));
                } catch (Throwable $error) {
                    $admin_feedback_features_ready = false;
                    $admin_feedback_features_error = $error->getMessage();
                }
            } else {
                $admin_feedback_features_error = raidlands_features_readiness_message(true);
            }
        } else {
            $admin_feedback_error = raidlands_feedback_readiness_message(true);
        }
    }

    if ($active_section === 'kits') {
        $admin_kits_ready = raidlands_kits_is_ready();

        if ($admin_kits_ready) {
            $admin_kit_rows = raidlands_kits_admin_rows();
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
            $admin_permission_rows = raidlands_permissions_permission_rows();
            $admin_permission_options = raidlands_permissions_permission_names();
            $admin_permission_sync_rows = raidlands_permissions_recent_sync_rows(12);
        } else {
            $admin_permissions_error = raidlands_permissions_readiness_message(true);
        }
    }
} catch (Throwable $error) {
    $admin_store_ready = false;
    $admin_store_error = $error->getMessage();
    $admin_features_ready = false;
    $admin_features_error = $error->getMessage();
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

function admin_permission_status_guide(): string
{
    $items = [
        ['Synced', 'Checked here and present in the latest live Rust snapshot.', 'synced'],
        ['Missing live', 'Checked here but not reported live yet; publish should add it.', 'missing-live'],
        ['Live extra', 'Reported live by Rust but unchecked here; publish should remove it.', 'extra-live'],
    ];
    $html = '<div class="admin-permission-status-guide" role="note" aria-label="Permission status legend">';
    $html .= '<p>Status compares this website draft with the latest live Rust snapshot. Publishing applies the checked state to Rust, then the badge updates after the bridge reports back.</p>';
    $html .= '<div class="admin-permission-status-list">';

    foreach ($items as [$label, $description, $state]) {
        $html .= '<span class="admin-permission-status-item">'
            . '<strong class="admin-permission-status-badge is-' . e($state) . '">' . e($label) . '</strong>'
            . '<span>' . e($description) . '</span>'
            . '</span>';
    }

    return $html . '</div></div>';
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

function admin_render_keyed_options(array $options, string $selected = ''): string
{
    $selected = (string) $selected;
    $html = '';

    foreach ($options as $value => $label) {
        $value = trim((string) $value);
        $label = trim((string) $label);

        if ($value === '') {
            continue;
        }

        $html .= '<option value="' . e($value) . '"' . ($selected === $value ? ' selected' : '') . '>' . e($label !== '' ? $label : $value) . '</option>';
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

function admin_permission_prefix_from_name(string $permission): string
{
    $parts = explode('.', $permission, 2);

    return strtolower(trim($parts[0] ?? 'other')) ?: 'other';
}

function admin_permission_prefix_label(string $prefix, string $plugin_name = ''): string
{
    $plugin_name = trim($plugin_name);

    if ($plugin_name !== '') {
        return $plugin_name;
    }

    return ucwords(str_replace(['-', '_'], ' ', $prefix));
}

function admin_permission_catalog_groups(array $permission_names, array $permission_rows): array
{
    $metadata = [];

    foreach ($permission_rows as $row) {
        $name = trim((string) ($row['permission_name'] ?? ''));

        if ($name === '') {
            continue;
        }

        $metadata[$name] = [
            'plugin_name' => trim((string) ($row['plugin_name'] ?? '')),
            'source' => trim((string) ($row['source'] ?? '')),
        ];
    }

    $groups = [];

    foreach ($permission_names as $permission_name) {
        $permission_name = trim((string) $permission_name);

        if ($permission_name === '') {
            continue;
        }

        $prefix = admin_permission_prefix_from_name($permission_name);
        $plugin_name = $metadata[$permission_name]['plugin_name'] ?? '';

        if (!isset($groups[$prefix])) {
            $groups[$prefix] = [
                'prefix' => $prefix,
                'plugin_name' => $plugin_name,
                'permissions' => [],
            ];
        } elseif ($groups[$prefix]['plugin_name'] === '' && $plugin_name !== '') {
            $groups[$prefix]['plugin_name'] = $plugin_name;
        }

        $groups[$prefix]['permissions'][] = [
            'name' => $permission_name,
            'plugin_name' => $plugin_name,
            'source' => $metadata[$permission_name]['source'] ?? '',
        ];
    }

    ksort($groups, SORT_NATURAL | SORT_FLAG_CASE);

    foreach ($groups as &$group) {
        usort(
            $group['permissions'],
            static fn (array $a, array $b): int => strnatcasecmp((string) $a['name'], (string) $b['name'])
        );
    }
    unset($group);

    return $groups;
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
        'raidlands' => 'Raidlands bridge',
        'fallback' => 'Site fallback',
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
    return admin_option_map([
        'Lifetime RP Unlock',
        'Daily RP Pass',
        'Weekly RP Pass',
        'Monthly RP Pass',
        'Yearly RP Pass',
        'Lifetime Cash Pass',
        'Daily Cash Pass',
        'Weekly Cash Pass',
        'Monthly Cash Pass',
        'Yearly Cash Pass',
        'Daily Cash Subscription',
        'Weekly Cash Subscription',
        'Monthly Cash Subscription',
        'Yearly Cash Subscription',
        'Wipe',
        'Season',
        'Limited',
    ], $current_values);
}

function admin_product_type_options(): array
{
    return [
        'kit_bundle' => 'Kit Bundle',
        'kit_unlock' => 'Individual Kit',
        'perk' => 'Standalone Perk',
    ];
}

function admin_store_stripe_sync_state(array $row, string $kind = 'price'): array
{
    $id = (int) ($row['id'] ?? 0);
    $status = trim((string) ($row['stripe_sync_status'] ?? ''));
    $mode = trim((string) ($row['stripe_sync_mode'] ?? 'auto'));
    $error = trim((string) ($row['stripe_sync_error'] ?? ''));
    $stripe_price_id = trim((string) ($row['stripe_price_id'] ?? ''));
    $stripe_product_id = trim((string) ($row['stripe_product_id'] ?? ''));
    $managed = !empty($row['stripe_managed']);

    if ($id <= 0) {
        return ['label' => 'Draft', 'class' => 'draft', 'note' => 'Save the row before Stripe can sync it.'];
    }

    if ($kind === 'price' && str_starts_with($stripe_price_id, 'price_') && !$managed && ($mode === 'external' || $status === 'external')) {
        return ['label' => 'External', 'class' => 'external', 'note' => 'External Stripe Price ID is protected and will not be updated or archived by Raidlands.'];
    }

    if ($kind === 'product' && str_starts_with($stripe_product_id, 'prod_') && ($mode === 'external' || $status === 'external')) {
        return ['label' => 'External', 'class' => 'external', 'note' => 'External Stripe Product is protected and will not be changed by Raidlands.'];
    }

    if ($status === 'error') {
        return ['label' => 'Needs attention', 'class' => 'error', 'note' => $error !== '' ? $error : 'Stripe sync reported an error.'];
    }

    if ($status === 'synced') {
        $object = $kind === 'product' ? $stripe_product_id : $stripe_price_id;
        return ['label' => 'Synced', 'class' => 'synced', 'note' => $object !== '' ? $object : 'Managed Stripe object is current.'];
    }

    if ($status === 'archived') {
        return ['label' => 'Archived', 'class' => 'archived', 'note' => 'The managed Stripe object is archived for new purchases.'];
    }

    if ($status === 'skipped') {
        return ['label' => 'Skipped', 'class' => 'skipped', 'note' => $error !== '' ? $error : 'No active managed cash offer needs Stripe sync.'];
    }

    if ($status === 'pending') {
        return ['label' => 'Pending sync', 'class' => 'pending', 'note' => 'This row will sync on the next Store save when Stripe is configured.'];
    }

    return ['label' => 'Auto sync', 'class' => 'pending', 'note' => 'Raidlands will manage this Stripe row on Store save.'];
}

function admin_store_stripe_sync_chip(array $row, string $kind = 'price'): string
{
    $state = admin_store_stripe_sync_state($row, $kind);

    return '<span class="admin-store-sync-chip is-' . e((string) $state['class']) . '">' . e((string) $state['label']) . '</span>';
}

function admin_store_stripe_sync_note(array $row, string $kind = 'price'): string
{
    $state = admin_store_stripe_sync_state($row, $kind);
    $last_synced = trim((string) ($row['stripe_last_synced_at'] ?? ''));
    $note = (string) $state['note'];

    if ($last_synced !== '' && in_array((string) $state['class'], ['synced', 'archived', 'external', 'skipped'], true)) {
        $note .= ' Last checked ' . $last_synced . '.';
    }

    return '<small>' . e($note) . '</small>';
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
    <?php if ($authenticated) : ?>
      <script src="<?= e(asset_url('js/admin-nav.js')) ?>" defer></script>
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
        <div class="admin-topbar-main">
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
        </div>
        <?php if ($admin_nav_groups_visible !== []) : ?>
          <nav class="admin-top-nav" aria-label="Admin sections" data-admin-nav>
            <?php foreach ($admin_nav_groups_visible as $group_key => $group) : ?>
              <?php
                $group_is_active = $group_key === $active_nav_group;
                $group_sections = $group['sections'];
                $section_count = count($group_sections);
                $group_summary = $group_is_active
                    ? (string) $active_meta['label']
                    : (string) $section_count . ' section' . ($section_count === 1 ? '' : 's');
              ?>
              <details class="admin-nav-group<?= $group_is_active ? ' is-active' : '' ?>" data-admin-nav-group>
                <summary class="admin-nav-group-toggle">
                  <span><?= e((string) $group['label']) ?></span>
                  <small><?= e($group_summary) ?></small>
                </summary>
                <div class="admin-nav-menu">
                  <?php foreach ($group_sections as $section_key => $section) : ?>
                    <a
                      class="admin-nav-link<?= $section_key === $active_section ? ' is-active' : '' ?>"
                      href="<?= e(admin_section_url((string) $section_key)) ?>"
                      <?= $section_key === $active_section ? 'aria-current="page"' : '' ?>>
                      <span><?= e($section['label']) ?></span>
                      <small><?= e($section['summary']) ?></small>
                    </a>
                  <?php endforeach; ?>
                </div>
              </details>
            <?php endforeach; ?>
          </nav>
        <?php endif; ?>
      </header>

      <main class="admin-shell">
        <div class="admin-container" data-admin-section="<?= e($active_section) ?>">
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
                        <?= admin_hint('Changes public brand text. It does not rename the Rust server itself.') ?>
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
                        <?= admin_field_head('Fallback map name', 'Map label shown before live server data loads or when it is unavailable.') ?>
                        <input type="text" name="site_config[mapName]" maxlength="120" placeholder="Procedural Battlefield" value="<?= e((string) ($admin_site['mapName'] ?? '')) ?>">
                        <?= admin_hint('Live status can override this when the server bridge responds.') ?>
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
                        <?= admin_field_head('Status provider', 'Live status is posted by WebsiteVipBridge. Custom values are preserved for future integrations.') ?>
                        <?= admin_render_datalist('admin-status-provider-options', admin_status_provider_options((string) ($admin_site['serverStats']['provider'] ?? 'raidlands'))) ?>
                        <input type="text" list="admin-status-provider-options" name="site_config[serverStats][provider]" maxlength="40" value="<?= e((string) ($admin_site['serverStats']['provider'] ?? 'raidlands')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Status refresh seconds', 'How often browsers refresh the public status endpoint.') ?>
                        <input type="number" min="30" max="3600" name="site_config[serverStats][cacheSeconds]" value="<?= e((string) ($admin_site['serverStats']['cacheSeconds'] ?? 60)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Heartbeat stale seconds', 'How long the website waits before marking the latest server heartbeat delayed.') ?>
                        <input type="number" min="30" max="3600" name="site_config[serverStats][staleSeconds]" value="<?= e((string) ($admin_site['serverStats']['staleSeconds'] ?? 90)) ?>">
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
                    $feature_rows = array_values((array) ($admin_features_state['features'] ?? []));
                    $pending_suggestions = array_values((array) ($admin_features_state['pending_suggestions'] ?? []));
                    $grouped_suggestions = array_values((array) ($admin_features_state['grouped_suggestions'] ?? []));
                    $feedback_import_count = (int) ($admin_features_state['feedback_import_count'] ?? 0);
                    $feature_window = (array) ($admin_features_state['window'] ?? []);
                    $admin_feature_icon_values = [];

                    foreach ($feature_rows as $row) {
                        $admin_feature_icon_values[] = (string) ($row['icon_alias'] ?? '');
                    }

                    $feature_option_map = [];
                    $admin_feature_category_options = [];

                    foreach ($feature_rows as $row) {
                        $feature_category = trim((string) ($row['category'] ?? ''));

                        if ($feature_category !== '') {
                            $admin_feature_category_options[$feature_category] = $feature_category;
                        }

                        if ((string) ($row['public_status'] ?? '') === 'archived') {
                            continue;
                        }

                        $feature_option_map[(string) ($row['id'] ?? '')] = (string) ($row['title'] ?? 'Feature #' . (string) ($row['id'] ?? ''));
                    }

                    uksort($admin_feature_category_options, 'strnatcasecmp');

                    $pending_suggestion_source_options = [];
                    foreach ($pending_suggestions as $suggestion) {
                        $source_key = (string) ($suggestion['source_type'] ?? 'public');
                        $pending_suggestion_source_options[$source_key] = ucwords(str_replace('_', ' ', $source_key));
                    }

                    ksort($pending_suggestion_source_options);

                    $grouped_suggestion_status_options = [];
                    foreach ($grouped_suggestions as $suggestion) {
                        $status_key = (string) ($suggestion['status'] ?? '');

                        if ($status_key !== '') {
                            $grouped_suggestion_status_options[$status_key] = ucwords(str_replace('_', ' ', $status_key));
                        }
                    }

                    ksort($grouped_suggestion_status_options);

                    echo admin_render_datalist('admin-feature-icon-options', admin_feature_icon_options($admin_feature_icon_values));
                  ?>

                  <?php if (!$admin_features_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning"><?= e($admin_features_error) ?></div>
                    </section>
                  <?php else : ?>
                    <section class="admin-section">
                      <div class="admin-grid four">
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Public</p>
                          <h3><?= e((string) count(array_filter($feature_rows, static fn (array $row): bool => !empty($row['is_public']) && (string) ($row['public_status'] ?? '') !== 'archived'))) ?></h3>
                          <p class="store-muted">visible features</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Voting</p>
                          <h3><?= e((string) count(array_filter($feature_rows, static fn (array $row): bool => !empty($row['is_voteable']) && (string) ($row['public_status'] ?? '') === 'voting'))) ?></h3>
                          <p class="store-muted">open candidates</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Pending</p>
                          <h3><?= e((string) count($pending_suggestions)) ?></h3>
                          <p class="store-muted">suggestions</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Vote window</p>
                          <h3><?= e((string) ($feature_window['expires_label'] ?? 'Current wipe')) ?></h3>
                          <p class="store-muted">votes refresh here</p>
                        </div>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Feature editor</h3>
                        <p>Select one feature at a time, then configure its public copy, status, voting visibility, and archived state.</p>
                      </div>
                      <?php
                        $feature_total = count($feature_rows) + 1;
                        $feature_selector_items = [];
                        $feature_has_active_panel = false;
                      ?>
                      <div class="admin-feature-editor-shell" data-admin-feature-editor>
                        <div class="admin-feature-panels">
                        <?php for ($index = 0; $index < $feature_total; $index += 1) : ?>
                          <?php
                            $row = $feature_rows[$index] ?? [
                                'id' => 0,
                                'slug' => '',
                                'icon_alias' => '',
                                'title' => '',
                                'summary' => '',
                                'category' => '',
                                'public_status' => 'voting',
                                'is_public' => 1,
                                'is_voteable' => 1,
                                'sort_order' => 500 + $index,
                                'support_score' => 0,
                                'vote_count' => 0,
                                'suggestion_count' => 0,
                            ];
                            $feature_is_existing = (int) ($row['id'] ?? 0) > 0;
                            $row_key = $feature_is_existing ? (string) $row['id'] : 'new_' . (string) $index;
                            $feature_panel_key = $feature_is_existing ? 'feature-' . (int) $row['id'] : 'new-' . $index;
                            $feature_panel_id = 'admin-feature-panel-' . (preg_replace('/[^a-zA-Z0-9_-]+/', '-', $feature_panel_key) ?: (string) $index);
                            $feature_is_active_panel = !$feature_has_active_panel;
                            $feature_has_active_panel = true;
                            $feature_title = trim((string) ($row['title'] ?? ''));
                            $feature_label = $feature_title !== '' ? $feature_title : 'New Feature';
                            $feature_status_key = (string) ($row['public_status'] ?? 'under_review');
                            $feature_status_label = raidlands_features_status_label($feature_status_key);
                            $feature_is_archived = $feature_status_key === 'archived';
                            $feature_visibility = !empty($row['is_public']) ? 'Public' : 'Hidden';
                            $feature_vote_state = $feature_status_key === 'voting' && !empty($row['is_voteable']) ? 'voting open' : 'not in voting';
                            $feature_support_score = (int) ($row['support_score'] ?? 0);
                            $feature_vote_count = (int) ($row['vote_count'] ?? 0);
                            $feature_suggestion_count = (int) ($row['suggestion_count'] ?? 0);
                            $feature_category_value = trim((string) ($row['category'] ?? ''));
                            $feature_sort_order = (int) ($row['sort_order'] ?? 100);
                            $feature_updated_at = (string) ($row['updated_at'] ?? '');
                            $feature_search_text = trim(implode(' ', [
                                (string) ($row['title'] ?? ''),
                                (string) ($row['summary'] ?? ''),
                                $feature_category_value,
                                $feature_status_key,
                                $feature_status_label,
                                $feature_visibility,
                                $feature_vote_state,
                            ]));
                            $feature_meta = $feature_is_existing
                                ? $feature_status_label . ' / ' . $feature_visibility . ', ' . $feature_vote_state . ' / score ' . (string) $feature_support_score
                                : 'Draft slot / blank rows are ignored';

                            $feature_selector_items[] = [
                                'index' => (string) $index,
                                'label' => $feature_label,
                                'meta' => $feature_meta,
                                'is_active' => $feature_is_active_panel,
                                'is_draft' => !$feature_is_existing,
                                'is_archived' => $feature_is_archived,
                                'status' => $feature_status_key,
                                'category' => $feature_category_value,
                                'visibility' => !empty($row['is_public']) ? 'public' : 'hidden',
                                'voting' => $feature_status_key === 'voting' && !empty($row['is_voteable']) ? 'voting' : 'not-voting',
                                'support_score' => $feature_support_score,
                                'vote_count' => $feature_vote_count,
                                'suggestion_count' => $feature_suggestion_count,
                                'sort_order' => $feature_sort_order,
                                'updated_at' => $feature_updated_at,
                                'search' => $feature_search_text,
                            ];
                          ?>
                          <article
                            class="admin-repeat-card admin-feature-planner-card admin-feature-panel<?= $feature_is_active_panel ? ' is-active' : '' ?>"
                            id="<?= e($feature_panel_id) ?>"
                            data-feature-panel
                            data-feature-index="<?= e((string) $index) ?>"
                            <?= $feature_is_active_panel ? '' : 'hidden' ?>>
                            <input type="hidden" name="feature_items[<?= e($row_key) ?>][id]" value="<?= e((string) ($row['id'] ?? 0)) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3 data-feature-card-title><?= e($feature_label) ?></h3>
                                <p class="admin-feedback-subtitle" data-feature-card-subtitle><?= $feature_is_existing ? 'Slug: ' . e((string) ($row['slug'] ?? '')) . ' / ' . e($feature_status_label) : 'Blank rows are ignored until you add a title.' ?></p>
                              </div>
                              <?php if ($feature_is_existing) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="feature_items[<?= e($row_key) ?>][archived]" value="1">
                                  <span>Archive on Save</span>
                                </label>
                              <?php endif; ?>
                            </div>

                            <div class="admin-feature-section-stack">
                              <details class="admin-details admin-feature-details" open>
                                <summary>Public card <small>Icon, title, category, and summary</small></summary>
                                <div class="admin-grid feature-planner-grid">
                                  <label class="admin-field">
                                    <?= admin_field_head('Icon alias', 'Icon shown above the card title. Suggested aliases render image icons; custom text is preserved.') ?>
                                    <input type="text" list="admin-feature-icon-options" name="feature_items[<?= e($row_key) ?>][icon_alias]" maxlength="32" placeholder="EVENT" value="<?= e((string) ($row['icon_alias'] ?? '')) ?>">
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Title', 'Public feature title.') ?>
                                    <input type="text" name="feature_items[<?= e($row_key) ?>][title]" maxlength="180" placeholder="Vote Rewards" value="<?= e((string) ($row['title'] ?? '')) ?>" data-feature-title-input>
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Slug', 'Stable internal URL-safe key. Leave blank for a generated slug on new rows.') ?>
                                    <input type="text" name="feature_items[<?= e($row_key) ?>][slug]" maxlength="140" placeholder="vote-rewards" value="<?= e((string) ($row['slug'] ?? '')) ?>">
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Category', 'Loose internal/public grouping for scanning.') ?>
                                    <input type="text" name="feature_items[<?= e($row_key) ?>][category]" maxlength="120" placeholder="Player Suggestions" value="<?= e((string) ($row['category'] ?? '')) ?>" data-feature-category-input>
                                  </label>
                                  <label class="admin-field admin-span-all">
                                    <?= admin_field_head('Summary', 'Short player-facing explanation. Keep it scan-friendly.') ?>
                                    <textarea name="feature_items[<?= e($row_key) ?>][summary]" rows="3" maxlength="500" data-feature-summary-input><?= e((string) ($row['summary'] ?? '')) ?></textarea>
                                  </label>
                                </div>
                              </details>

                              <details class="admin-details admin-feature-details" open>
                                <summary>Publishing and voting <small>Status, placement, and public controls</small></summary>
                                <div class="admin-grid three">
                                  <label class="admin-field">
                                    <?= admin_field_head('Status', 'Public status bucket used for grouping, voting placement, and badge color.') ?>
                                    <select name="feature_items[<?= e($row_key) ?>][public_status]" data-feature-status-select>
                                      <?= admin_render_options(raidlands_features_status_options(), $feature_status_key) ?>
                                    </select>
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Sort order', 'Lower numbers appear earlier within the same status group.') ?>
                                    <input type="number" name="feature_items[<?= e($row_key) ?>][sort_order]" min="0" max="9999" step="1" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>" data-feature-sort-input>
                                  </label>
                                  <label class="admin-check admin-check-field">
                                    <input type="checkbox" name="feature_items[<?= e($row_key) ?>][is_public]" value="1" <?= !empty($row['is_public']) ? 'checked' : '' ?> data-feature-public-input>
                                    <?= admin_check_copy('Public', 'Shows this feature on the public Features page.') ?>
                                  </label>
                                  <label class="admin-check admin-check-field">
                                    <input type="checkbox" name="feature_items[<?= e($row_key) ?>][is_voteable]" value="1" <?= !empty($row['is_voteable']) ? 'checked' : '' ?> data-feature-voteable-input>
                                    <?= admin_check_copy('Voteable', 'With Voting status, allows linked players to spend one of their current-wipe votes on this feature.') ?>
                                  </label>
                                </div>
                              </details>

                              <?php if ($feature_is_existing) : ?>
                                <details class="admin-details admin-feature-details">
                                  <summary>Player signal <small>Votes and grouped suggestions</small></summary>
                                  <div class="admin-feature-signal-grid">
                                    <span><strong><?= e((string) $feature_support_score) ?></strong> support score</span>
                                    <span><strong><?= e((string) $feature_vote_count) ?></strong> current votes</span>
                                    <span><strong><?= e((string) $feature_suggestion_count) ?></strong> grouped suggestions</span>
                                  </div>
                                </details>
                              <?php endif; ?>
                            </div>
                          </article>
                        <?php endfor; ?>
                        </div>
                        <aside class="admin-feature-picker" aria-label="Feature selector">
                          <div class="admin-feature-picker-head">
                            <div>
                              <h3>Features</h3>
                              <p><?= e((string) count($feature_rows)) ?> saved<?= $feature_rows === [] ? '' : ' plus new draft slot' ?></p>
                            </div>
                            <button class="btn btn-secondary" type="button" data-feature-add>Add Feature</button>
                          </div>
                          <div class="admin-feature-picker-controls">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="120" placeholder="Title, category, or summary" data-feature-search>
                            </label>
                            <div class="admin-feature-filter-grid">
                              <label class="admin-field">
                                <span>Status</span>
                                <select data-feature-status-filter>
                                  <option value="">All statuses</option>
                                  <?= admin_render_keyed_options(raidlands_features_status_options()) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Category</span>
                                <select data-feature-category-filter>
                                  <option value="">All categories</option>
                                  <?= admin_render_keyed_options($admin_feature_category_options) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Visibility</span>
                                <select data-feature-visibility-filter>
                                  <option value="">Public and hidden</option>
                                  <option value="public">Public</option>
                                  <option value="hidden">Hidden</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Voting</span>
                                <select data-feature-voting-filter>
                                  <option value="">Any voting state</option>
                                  <option value="voting">Voting open</option>
                                  <option value="not-voting">Not in voting</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Sort</span>
                                <select data-feature-sort>
                                  <option value="staff">Staff order</option>
                                  <option value="title">Title A-Z</option>
                                  <option value="support">Most support</option>
                                  <option value="votes">Most votes</option>
                                  <option value="updated">Recently updated</option>
                                </select>
                              </label>
                              <button class="btn btn-secondary admin-feature-filter-reset" type="button" data-feature-reset>Clear</button>
                            </div>
                            <p class="admin-feature-filter-count" data-feature-result-count><?= e((string) count($feature_selector_items)) ?> features shown</p>
                            <div class="admin-alert warning admin-feature-empty" data-feature-empty hidden>No features match these controls.</div>
                          </div>
                          <div class="admin-feature-picker-list">
                            <?php foreach ($feature_selector_items as $selector_item) : ?>
                              <button
                                class="admin-feature-picker-button<?= !empty($selector_item['is_active']) ? ' is-active' : '' ?><?= !empty($selector_item['is_draft']) ? ' is-draft' : '' ?><?= !empty($selector_item['is_archived']) ? ' is-archived' : '' ?>"
                                type="button"
                                data-feature-select
                                data-feature-index="<?= e((string) $selector_item['index']) ?>"
                                data-feature-status="<?= e((string) ($selector_item['status'] ?? 'under_review')) ?>"
                                data-feature-category="<?= e((string) ($selector_item['category'] ?? '')) ?>"
                                data-feature-visibility="<?= e((string) ($selector_item['visibility'] ?? 'public')) ?>"
                                data-feature-voting="<?= e((string) ($selector_item['voting'] ?? 'not-voting')) ?>"
                                data-feature-support="<?= e((string) ($selector_item['support_score'] ?? 0)) ?>"
                                data-feature-votes="<?= e((string) ($selector_item['vote_count'] ?? 0)) ?>"
                                data-feature-suggestions="<?= e((string) ($selector_item['suggestion_count'] ?? 0)) ?>"
                                data-feature-order="<?= e((string) ($selector_item['sort_order'] ?? 100)) ?>"
                                data-feature-updated="<?= e((string) ($selector_item['updated_at'] ?? '')) ?>"
                                data-feature-search="<?= e((string) ($selector_item['search'] ?? '')) ?>"
                                <?= !empty($selector_item['is_active']) ? 'aria-current="true"' : '' ?>>
                                <span data-feature-select-label><?= e((string) $selector_item['label']) ?></span>
                                <small data-feature-select-meta><?= e((string) $selector_item['meta']) ?></small>
                              </button>
                            <?php endforeach; ?>
                          </div>
                        </aside>
                      </div>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Suggestion review</h3>
                        <p>Approve new ideas, reject noise, or group similar suggestions into an existing feature. Grouped suggestions add support score without consuming player vote slots.</p>
                      </div>

                      <?php if ($feedback_import_count > 0) : ?>
                        <div class="admin-alert warning admin-action-alert">
                          <span><?= e((string) $feedback_import_count) ?> feedback suggestion<?= $feedback_import_count === 1 ? '' : 's' ?> can be imported as pending feature ideas.</span>
                          <button class="btn btn-secondary" type="submit" name="features_admin_action" value="import_feedback">Import Feedback Ideas</button>
                        </div>
                      <?php endif; ?>

                      <?php if ($pending_suggestions === []) : ?>
                        <div class="admin-alert warning">No pending feature suggestions are waiting for review.</div>
                      <?php else : ?>
                        <div class="admin-feature-queue" data-feature-queue>
                          <div class="admin-feature-queue-toolbar">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="120" placeholder="Suggestion title, source, or details" data-feature-queue-search>
                            </label>
                            <label class="admin-field">
                              <span>Source</span>
                              <select data-feature-queue-source>
                                <option value="">All sources</option>
                                <?= admin_render_keyed_options($pending_suggestion_source_options) ?>
                              </select>
                            </label>
                            <label class="admin-field">
                              <span>Sort</span>
                              <select data-feature-queue-sort>
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="title">Title A-Z</option>
                                <option value="source">Source</option>
                              </select>
                            </label>
                            <button class="btn btn-secondary" type="button" data-feature-queue-reset>Clear</button>
                            <p data-feature-queue-count><?= e((string) count($pending_suggestions)) ?> suggestions shown</p>
                          </div>
                          <div class="admin-alert warning admin-feature-queue-empty" data-feature-queue-empty hidden>No pending suggestions match these controls.</div>
                          <div class="admin-repeat-list" data-feature-queue-list>
                          <?php foreach ($pending_suggestions as $suggestion) : ?>
                            <?php
                              $suggestion_id = (int) ($suggestion['id'] ?? 0);
                              $matches = array_values((array) ($suggestion['matches'] ?? []));
                              $suggestion_source = (string) ($suggestion['source_type'] ?? 'public');
                              $suggestion_source_label = ucwords(str_replace('_', ' ', $suggestion_source));
                              $suggestion_search_text = trim(implode(' ', [
                                  (string) ($suggestion['title'] ?? ''),
                                  (string) ($suggestion['details'] ?? ''),
                                  $suggestion_source,
                                  $suggestion_source_label,
                                  (string) ($suggestion['steam_id64'] ?? ''),
                              ]));
                            ?>
                            <article
                              class="admin-repeat-card admin-feature-suggestion-card"
                              data-feature-queue-item
                              data-feature-queue-status="pending"
                              data-feature-queue-source="<?= e($suggestion_source) ?>"
                              data-feature-queue-title="<?= e((string) ($suggestion['title'] ?? '')) ?>"
                              data-feature-queue-created="<?= e((string) ($suggestion['created_at'] ?? '')) ?>"
                              data-feature-queue-updated="<?= e((string) ($suggestion['updated_at'] ?? '')) ?>"
                              data-feature-queue-search="<?= e($suggestion_search_text) ?>">
                              <div class="admin-repeat-card-head admin-feedback-card-head">
                                <div>
                                  <h3><?= e((string) ($suggestion['title'] ?? 'Feature suggestion')) ?></h3>
                                  <p class="admin-feedback-subtitle">
                                    <?= e($suggestion_source_label) ?>
                                    suggestion from <code><?= e((string) ($suggestion['steam_id64'] ?? RAIDLANDS_FEATURE_OWNER_STEAM_ID64)) ?></code>
                                  </p>
                                </div>
                                <span class="status-pill pending">Pending</span>
                              </div>

                              <div class="admin-feedback-body">
                                <div class="admin-feedback-details"><?= nl2br(e((string) ($suggestion['details'] ?? ''))) ?></div>
                                <?php if ($matches !== []) : ?>
                                  <div class="feature-match-list">
                                    <?php foreach ($matches as $match) : ?>
                                      <span class="tag">
                                        <span class="tag-label">Match <?= e((string) ($match['score'] ?? 0)) ?></span>
                                        <span class="tag-value"><?= e((string) ($match['feature']['title'] ?? 'Feature')) ?></span>
                                      </span>
                                    <?php endforeach; ?>
                                  </div>
                                <?php endif; ?>
                              </div>

                              <div class="admin-grid two">
                                <label class="admin-field">
                                  <?= admin_field_head('Group into feature', 'Suggested matches are selected by keyword overlap, but staff confirms the final grouping.') ?>
                                  <select name="suggestion_feature_id[<?= e((string) $suggestion_id) ?>]">
                                    <option value="" selected>Choose feature...</option>
                                    <?= admin_render_keyed_options($feature_option_map) ?>
                                  </select>
                                  <?= admin_hint('Choose the destination intentionally. Similar matches above are hints, not an automatic selection.') ?>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Staff note', 'Internal review note for why the suggestion was grouped, approved, or rejected.') ?>
                                  <textarea name="suggestion_admin_note[<?= e((string) $suggestion_id) ?>]" rows="3" maxlength="1200"><?= e((string) ($suggestion['admin_note'] ?? '')) ?></textarea>
                                </label>
                              </div>
                              <div class="button-row admin-suggestion-actions">
                                <button class="btn btn-primary" type="submit" name="feature_suggestion_action" value="group:<?= e((string) $suggestion_id) ?>" <?= $feature_option_map === [] ? 'disabled' : '' ?>>Group</button>
                                <button class="btn btn-secondary" type="submit" name="feature_suggestion_action" value="approve:<?= e((string) $suggestion_id) ?>">Approve as New</button>
                                <button class="btn btn-secondary" type="submit" name="feature_suggestion_action" value="reject:<?= e((string) $suggestion_id) ?>">Reject</button>
                              </div>
                            </article>
                          <?php endforeach; ?>
                          </div>
                        </div>
                      <?php endif; ?>
                    </section>

                    <section class="admin-section">
                      <div class="admin-subsection-head">
                        <h3>Recent suggestion decisions</h3>
                        <p>Grouped suggestions count toward the destination feature. Rejected suggestions stay here briefly so staff can audit recent triage.</p>
                      </div>
                      <?php if ($grouped_suggestions === []) : ?>
                        <div class="admin-alert warning">No suggestion decisions have been recorded yet.</div>
                      <?php else : ?>
                        <div class="admin-feature-queue" data-feature-queue>
                          <div class="admin-feature-queue-toolbar">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="120" placeholder="Suggestion, feature, or player" data-feature-queue-search>
                            </label>
                            <label class="admin-field">
                              <span>Status</span>
                              <select data-feature-queue-status>
                                <option value="">All statuses</option>
                                <?= admin_render_keyed_options($grouped_suggestion_status_options) ?>
                              </select>
                            </label>
                            <label class="admin-field">
                              <span>Sort</span>
                              <select data-feature-queue-sort>
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="title">Title A-Z</option>
                                <option value="status">Status</option>
                              </select>
                            </label>
                            <button class="btn btn-secondary" type="button" data-feature-queue-reset>Clear</button>
                            <p data-feature-queue-count><?= e((string) count($grouped_suggestions)) ?> decisions shown</p>
                          </div>
                          <div class="admin-alert warning admin-feature-queue-empty" data-feature-queue-empty hidden>No suggestion decisions match these controls.</div>
                          <div class="store-table-wrap">
                            <table class="store-table">
                              <thead>
                                <tr>
                                  <th>Suggestion</th>
                                  <th>Feature</th>
                                  <th>Source</th>
                                  <th>Status</th>
                                  <th>Updated</th>
                                </tr>
                              </thead>
                              <tbody data-feature-queue-list>
                                <?php foreach ($grouped_suggestions as $suggestion) : ?>
                                  <?php
                                    $decision_status = (string) ($suggestion['status'] ?? 'pending');
                                    $decision_search_text = trim(implode(' ', [
                                        (string) ($suggestion['title'] ?? ''),
                                        (string) ($suggestion['feature_title'] ?? ''),
                                        $decision_status,
                                        (string) ($suggestion['steam_id64'] ?? ''),
                                    ]));
                                  ?>
                                  <tr
                                    data-feature-queue-item
                                    data-feature-queue-status="<?= e($decision_status) ?>"
                                    data-feature-queue-title="<?= e((string) ($suggestion['title'] ?? '')) ?>"
                                    data-feature-queue-created="<?= e((string) ($suggestion['created_at'] ?? '')) ?>"
                                    data-feature-queue-updated="<?= e((string) ($suggestion['updated_at'] ?? '')) ?>"
                                    data-feature-queue-search="<?= e($decision_search_text) ?>">
                                  <td><?= e((string) ($suggestion['title'] ?? 'Feature suggestion')) ?></td>
                                  <td><?= e((string) (($suggestion['feature_title'] ?? '') ?: 'None')) ?></td>
                                  <td><code><?= e((string) ($suggestion['steam_id64'] ?? '')) ?></code></td>
                                  <td><span class="status-pill <?= e($decision_status) ?>"><?= e($decision_status) ?></span></td>
                                  <td><?= e((string) ($suggestion['updated_at'] ?? '')) ?></td>
                                  </tr>
                                <?php endforeach; ?>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      <?php endif; ?>
                    </section>
                  <?php endif; ?>
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
                    <?php
                      $feedback_total_count = count($admin_feedback_rows);
                      $feedback_active_count = (int) ($admin_feedback_counts['open'] ?? 0)
                          + (int) ($admin_feedback_counts['reviewing'] ?? 0)
                          + (int) ($admin_feedback_counts['planned'] ?? 0);
                      $feedback_closed_count = (int) ($admin_feedback_counts['resolved'] ?? 0)
                          + (int) ($admin_feedback_counts['closed'] ?? 0);
                      $feedback_candidate_count = count(array_filter(
                          $admin_feedback_rows,
                          static fn (array $row): bool => in_array((string) ($row['type'] ?? ''), raidlands_features_feedback_types(), true)
                      ));
                      $feedback_linked_count = count($admin_feedback_feature_links);
                    ?>
                    <section class="admin-section">
                      <div class="admin-grid four">
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Loaded</p>
                          <h3><?= e((string) $feedback_total_count) ?></h3>
                          <p class="store-muted">recent inbox items</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Needs review</p>
                          <h3><?= e((string) $feedback_active_count) ?></h3>
                          <p class="store-muted">open, reviewing, or planned</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Feature signal</p>
                          <h3><?= e((string) $feedback_candidate_count) ?></h3>
                          <p class="store-muted"><?= e((string) $feedback_linked_count) ?> linked to features</p>
                        </div>
                        <div class="metal-panel admin-feedback-stat">
                          <p class="section-kicker">Closed loop</p>
                          <h3><?= e((string) $feedback_closed_count) ?></h3>
                          <p class="store-muted">resolved or closed</p>
                        </div>
                      </div>
                    </section>
                  <?php endif; ?>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Support page submissions</h3>
                      <p>Search the queue, pick one submission, update staff notes, and route feature ideas without leaving the inbox.</p>
                    </div>
                    <?php if (!$admin_feedback_ready) : ?>
                      <div class="admin-alert warning">The feedback inbox will appear here after the migration is installed.</div>
                    <?php elseif ($admin_feedback_rows === []) : ?>
                      <div class="admin-alert warning">No bug reports, suggestions, or feature requests have been submitted yet.</div>
                    <?php else : ?>
                      <?php
                        $feedback_feature_option_map = [];
                        $feedback_selector_items = [];
                        $feedback_has_active_panel = false;
                        $feedback_status_options = raidlands_feedback_status_options();
                        $feedback_type_options = raidlands_feedback_type_options();
                        $feedback_workflow_options = [
                            'all' => 'All workflows',
                            'candidate' => 'Feature candidates',
                            'linked' => 'Linked to feature',
                            'unlinked' => 'Unlinked candidates',
                            'none' => 'No feature workflow',
                        ];
                        $feedback_sort_options = [
                            'newest' => 'Newest submitted',
                            'oldest' => 'Oldest submitted',
                            'updated' => 'Recently updated',
                            'status' => 'Status',
                            'type' => 'Type',
                        ];

                        foreach ($admin_feedback_feature_rows as $feature_row) {
                            if ((string) ($feature_row['public_status'] ?? '') === 'archived') {
                                continue;
                            }

                            $feature_id = (int) ($feature_row['id'] ?? 0);

                            if ($feature_id <= 0) {
                                continue;
                            }

                            $feedback_feature_option_map[(string) $feature_id] = (string) ($feature_row['title'] ?? 'Feature')
                                . ' / '
                                . raidlands_features_status_label((string) ($feature_row['public_status'] ?? 'under_review'));
                        }
                      ?>
                      <div class="admin-feedback-workbench" data-admin-feedback-workbench>
                        <div class="admin-feedback-editor-shell">
                          <div class="admin-feedback-panels">
                          <?php foreach ($admin_feedback_rows as $feedback_index => $feedback_row) : ?>
                            <?php
                              $feedback_id = (string) ($feedback_row['id'] ?? '');
                              $feedback_status = (string) ($feedback_row['status'] ?? 'open');
                              $feedback_type = (string) ($feedback_row['type'] ?? 'bug');
                              $feedback_contact = trim((string) ($feedback_row['contact_name'] ?? ''));
                              $feedback_email = trim((string) ($feedback_row['contact_email'] ?? ''));
                              $feedback_steam = trim((string) ($feedback_row['steam_id64'] ?? ''));
                              $feedback_page = trim((string) ($feedback_row['page_url'] ?? ''));
                              $feedback_browser = trim((string) ($feedback_row['browser'] ?? ''));
                              $feedback_player = trim((string) ($feedback_row['player_display_name'] ?? ''));
                              $feedback_linked_name = trim((string) ($feedback_row['linked_display_name'] ?? ''));
                              $feedback_summary = trim((string) ($feedback_row['summary'] ?? 'Untitled feedback'));
                              $feedback_summary = $feedback_summary !== '' ? $feedback_summary : 'Untitled feedback';
                              $feedback_type_label = raidlands_feedback_type_label($feedback_type);
                              $feedback_status_label = raidlands_feedback_status_label($feedback_status);
                              $feedback_submitted = (string) ($feedback_row['submitted_at'] ?? '');
                              $feedback_updated = (string) ($feedback_row['updated_at'] ?? '');
                              $feedback_contact_label = $feedback_contact !== ''
                                  ? $feedback_contact
                                  : ($feedback_linked_name !== ''
                                      ? $feedback_linked_name
                                      : ($feedback_player !== ''
                                          ? $feedback_player
                                          : ($feedback_email !== '' ? $feedback_email : ($feedback_steam !== '' ? $feedback_steam : 'Anonymous'))));
                              $feedback_is_feature_candidate = in_array($feedback_type, raidlands_features_feedback_types(), true);
                              $feedback_feature_link = $admin_feedback_feature_links[(int) $feedback_id] ?? null;
                              $feedback_feature_link_title = trim((string) ($feedback_feature_link['feature_title'] ?? ''));
                              $feedback_feature_default = (string) ((int) ($feedback_feature_link['feature_id'] ?? 0) > 0 ? (int) $feedback_feature_link['feature_id'] : '');
                              $feedback_feature_state = !$feedback_is_feature_candidate
                                  ? 'none'
                                  : ($feedback_feature_link !== null ? 'linked' : 'candidate');
                              $feedback_feature_state_label = match ($feedback_feature_state) {
                                  'linked' => 'Linked feature',
                                  'candidate' => 'Feature candidate',
                                  default => 'No feature workflow',
                              };
                              $feedback_feature_matches = [];

                              if ($feedback_is_feature_candidate && $admin_feedback_features_ready && $feedback_feature_default === '') {
                                  $feedback_feature_matches = raidlands_features_suggest_matches([
                                      'title' => (string) ($feedback_row['summary'] ?? ''),
                                      'details' => (string) ($feedback_row['details'] ?? ''),
                                  ], $admin_feedback_feature_rows);
                              }

                              $feedback_feature_select_options = $feedback_feature_option_map;

                              if ($feedback_feature_default !== '' && !isset($feedback_feature_select_options[$feedback_feature_default]) && $feedback_feature_link_title !== '') {
                                  $feedback_feature_select_options[$feedback_feature_default] = $feedback_feature_link_title . ' / linked';
                              }

                              $feedback_panel_key = 'feedback-' . ($feedback_id !== '' ? $feedback_id : (string) $feedback_index);
                              $feedback_panel_id = 'admin-feedback-panel-' . (preg_replace('/[^a-zA-Z0-9_-]+/', '-', $feedback_panel_key) ?: (string) $feedback_index);
                              $feedback_is_active_panel = !$feedback_has_active_panel;
                              $feedback_has_active_panel = true;
                              $feedback_search_text = implode(' ', [
                                  $feedback_id,
                                  (string) ($feedback_row['public_id'] ?? ''),
                                  $feedback_summary,
                                  (string) ($feedback_row['details'] ?? ''),
                                  $feedback_type_label,
                                  $feedback_status_label,
                                  $feedback_contact,
                                  $feedback_email,
                                  $feedback_steam,
                                  $feedback_player,
                                  $feedback_linked_name,
                                  $feedback_page,
                                  $feedback_browser,
                                  (string) ($feedback_row['admin_note'] ?? ''),
                              ]);
                              $feedback_selector_meta = $feedback_type_label . ' / ' . $feedback_submitted . ' / ' . $feedback_status_label;
                              $feedback_selector_items[] = [
                                  'index' => (string) $feedback_index,
                                  'id' => $feedback_panel_id,
                                  'label' => $feedback_summary,
                                  'meta' => $feedback_selector_meta,
                                  'contact' => $feedback_contact_label,
                                  'status' => $feedback_status,
                                  'status_label' => $feedback_status_label,
                                  'type' => $feedback_type,
                                  'type_label' => $feedback_type_label,
                                  'feature' => $feedback_feature_state,
                                  'feature_label' => $feedback_feature_state_label,
                                  'submitted' => $feedback_submitted,
                                  'updated' => $feedback_updated,
                                  'search' => $feedback_search_text,
                                  'is_active' => $feedback_is_active_panel,
                              ];
                            ?>
                            <article
                              class="admin-repeat-card admin-feedback-card admin-feedback-panel<?= $feedback_is_active_panel ? ' is-active' : '' ?>"
                              id="<?= e($feedback_panel_id) ?>"
                              data-feedback-panel
                              data-feedback-index="<?= e((string) $feedback_index) ?>"
                              data-feedback-status="<?= e($feedback_status) ?>"
                              data-feedback-type="<?= e($feedback_type) ?>"
                              data-feedback-feature="<?= e($feedback_feature_state) ?>"
                              <?= $feedback_is_active_panel ? '' : 'hidden' ?>>
                              <input type="hidden" name="feedback_rows[<?= e($feedback_id) ?>][id]" value="<?= e($feedback_id) ?>">
                              <div class="admin-repeat-card-head admin-feedback-card-head">
                                <div>
                                  <h3><?= e($feedback_summary) ?></h3>
                                  <p class="admin-feedback-subtitle">
                                    <?= e($feedback_type_label) ?> submitted <?= e($feedback_submitted !== '' ? $feedback_submitted : 'without a timestamp') ?>
                                  </p>
                                </div>
                                <span class="status-pill <?= e($feedback_status) ?>" data-feedback-status-pill><?= e($feedback_status_label) ?></span>
                              </div>

                              <div class="admin-feedback-overview" aria-label="Feedback summary">
                                <span>
                                  <small>Contact</small>
                                  <strong><?= e($feedback_contact_label) ?></strong>
                                </span>
                                <span>
                                  <small>SteamID64</small>
                                  <strong><?= e($feedback_steam !== '' ? $feedback_steam : 'Not provided') ?></strong>
                                </span>
                                <span>
                                  <small>Workflow</small>
                                  <strong><?= e($feedback_feature_state_label) ?></strong>
                                </span>
                                <span>
                                  <small>Updated</small>
                                  <strong><?= e($feedback_updated !== '' ? $feedback_updated : 'Not updated') ?></strong>
                                </span>
                              </div>

                              <div class="admin-feedback-section-stack">
                                <details class="admin-details admin-feedback-details-panel" open>
                                  <summary>Submission <small>Player message and source context</small></summary>
                                  <div class="admin-feedback-detail-wrap">
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
                                        <dt>Public ID</dt>
                                        <dd><code><?= e((string) ($feedback_row['public_id'] ?? '')) ?></code></dd>
                                      </div>
                                    </dl>
                                  </div>
                                </details>

                                <?php if ($feedback_is_feature_candidate) : ?>
                                  <details class="admin-details admin-feedback-details-panel" open>
                                    <summary>Feature workflow <small>Merge, link, or create public feature signal</small></summary>
                                    <div class="admin-feedback-feature-workflow">
                                      <div class="admin-feedback-feature-head">
                                        <div>
                                          <h4>Feature workflow</h4>
                                          <p>Promote this feedback into a voteable feature candidate or merge it into an existing feature signal.</p>
                                        </div>
                                        <?php if ($feedback_feature_link !== null) : ?>
                                          <span class="status-pill <?= e((string) ($feedback_feature_link['status'] ?? 'grouped')) ?>"><?= e(ucwords(str_replace('_', ' ', (string) ($feedback_feature_link['status'] ?? 'grouped')))) ?></span>
                                        <?php endif; ?>
                                      </div>

                                      <?php if (!$admin_feedback_features_ready) : ?>
                                        <div class="admin-alert warning">Feature workflow is unavailable. <?= $admin_feedback_features_error !== '' ? e($admin_feedback_features_error) : 'Run the feature planning migration first.' ?></div>
                                      <?php else : ?>
                                        <?php if ($feedback_feature_link !== null) : ?>
                                          <div class="admin-feedback-feature-linked">
                                            <span class="tag">
                                              <span class="tag-label">Linked feature</span>
                                              <span class="tag-value"><?= e($feedback_feature_link_title !== '' ? $feedback_feature_link_title : 'None') ?></span>
                                            </span>
                                            <?php if (!empty($feedback_feature_link['updated_at'])) : ?>
                                              <small>Updated <?= e((string) $feedback_feature_link['updated_at']) ?></small>
                                            <?php endif; ?>
                                          </div>
                                        <?php endif; ?>

                                        <?php if ($feedback_feature_matches !== []) : ?>
                                          <div class="feature-match-list">
                                            <?php foreach ($feedback_feature_matches as $match) : ?>
                                              <span class="tag">
                                                <span class="tag-label">Match <?= e((string) ($match['score'] ?? 0)) ?></span>
                                                <span class="tag-value"><?= e((string) ($match['feature']['title'] ?? 'Feature')) ?></span>
                                              </span>
                                            <?php endforeach; ?>
                                          </div>
                                        <?php endif; ?>

                                        <?php if ($feedback_feature_option_map === []) : ?>
                                          <div class="admin-alert warning">No saved features are available to merge yet. Converting to a new feature is still available.</div>
                                        <?php endif; ?>

                                        <div class="admin-grid two">
                                          <label class="admin-field">
                                            <?= admin_field_head('Merge into feature', 'Grouped feedback adds support signal to an existing public feature without creating another card.') ?>
                                            <select name="feedback_feature_id[<?= e($feedback_id) ?>]" <?= $feedback_feature_option_map === [] ? 'disabled' : '' ?>>
                                              <option value="" <?= $feedback_feature_default === '' ? 'selected' : '' ?>>Choose feature...</option>
                                              <?= admin_render_keyed_options($feedback_feature_select_options, $feedback_feature_default) ?>
                                            </select>
                                            <?= admin_hint('Choose the destination intentionally. Similar matches above are hints, not an automatic selection.') ?>
                                          </label>
                                          <label class="admin-field">
                                            <?= admin_field_head('Workflow note', 'Optional internal note saved on the feature suggestion and feedback item.') ?>
                                            <textarea name="feedback_feature_note[<?= e($feedback_id) ?>]" rows="3" maxlength="1200"><?= e((string) ($feedback_feature_link['admin_note'] ?? '')) ?></textarea>
                                          </label>
                                        </div>

                                        <div class="button-row admin-feedback-feature-actions">
                                          <button class="btn btn-primary" type="submit" name="feature_feedback_action" value="merge:<?= e($feedback_id) ?>" <?= $feedback_feature_option_map === [] ? 'disabled' : '' ?>>Merge into Feature</button>
                                          <button class="btn btn-secondary" type="submit" name="feature_feedback_action" value="new:<?= e($feedback_id) ?>">Convert to New Feature</button>
                                        </div>
                                      <?php endif; ?>
                                    </div>
                                  </details>
                                <?php endif; ?>

                                <details class="admin-details admin-feedback-details-panel" open>
                                  <summary>Staff triage <small>Status and internal note</small></summary>
                                  <div class="admin-grid two admin-feedback-triage-grid">
                                    <label class="admin-field">
                                      <?= admin_field_head('Status', 'Moves the item through staff review. This status is internal to the admin inbox.') ?>
                                      <select name="feedback_rows[<?= e($feedback_id) ?>][status]" data-feedback-status-select>
                                        <?= admin_render_options($feedback_status_options, $feedback_status) ?>
                                      </select>
                                    </label>
                                    <label class="admin-field">
                                      <?= admin_field_head('Staff note', 'Internal triage note. Keep player-facing replies in Discord or email for now.') ?>
                                      <textarea name="feedback_rows[<?= e($feedback_id) ?>][admin_note]" rows="3" maxlength="1600"><?= e((string) ($feedback_row['admin_note'] ?? '')) ?></textarea>
                                    </label>
                                  </div>
                                </details>
                              </div>
                            </article>
                          <?php endforeach; ?>
                          </div>

                          <aside class="admin-feedback-picker" aria-label="Feedback queue">
                            <div class="admin-feedback-picker-head">
                              <div>
                                <h3>Inbox queue</h3>
                                <p data-feedback-result-count><?= e((string) count($admin_feedback_rows)) ?> item<?= count($admin_feedback_rows) === 1 ? '' : 's' ?> shown</p>
                              </div>
                            </div>

                            <div class="admin-feedback-picker-controls">
                              <label class="admin-field">
                                <?= admin_field_head('Search', 'Search summary, details, contact info, SteamID64, page URL, browser, and staff notes.') ?>
                                <input type="search" placeholder="steam id, bug, /store, email" autocomplete="off" data-feedback-search>
                              </label>
                              <div class="admin-feedback-filter-grid">
                                <label class="admin-field">
                                  <?= admin_field_head('Status', 'Show only one triage status.') ?>
                                  <select data-feedback-status-filter>
                                    <option value="" selected>All statuses</option>
                                    <?= admin_render_options($feedback_status_options) ?>
                                  </select>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Type', 'Show bugs, suggestions, or feature requests.') ?>
                                  <select data-feedback-type-filter>
                                    <option value="" selected>All types</option>
                                    <?= admin_render_options($feedback_type_options) ?>
                                  </select>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Workflow', 'Filter feature candidates, linked items, or feedback without feature routing.') ?>
                                  <select data-feedback-workflow-filter>
                                    <?= admin_render_keyed_options($feedback_workflow_options, 'all') ?>
                                  </select>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Sort', 'Reorder the inbox queue without changing saved feedback.') ?>
                                  <select data-feedback-sort>
                                    <?= admin_render_keyed_options($feedback_sort_options, 'newest') ?>
                                  </select>
                                </label>
                                <button class="btn btn-secondary admin-feedback-filter-reset" type="button" data-feedback-reset>Clear</button>
                              </div>
                            </div>

                            <div class="admin-alert warning admin-feedback-queue-empty" data-feedback-empty hidden>No feedback matches the current filters.</div>

                            <div class="admin-feedback-picker-list" data-feedback-list>
                              <?php foreach ($feedback_selector_items as $selector_item) : ?>
                                <button
                                  class="admin-feedback-picker-button<?= !empty($selector_item['is_active']) ? ' is-active' : '' ?> is-<?= e((string) $selector_item['status']) ?><?= (string) $selector_item['feature'] === 'linked' ? ' is-feature-linked' : '' ?><?= (string) $selector_item['feature'] === 'candidate' ? ' is-feature-candidate' : '' ?>"
                                  type="button"
                                  data-feedback-select
                                  data-feedback-index="<?= e((string) $selector_item['index']) ?>"
                                  data-feedback-target="<?= e((string) $selector_item['id']) ?>"
                                  data-feedback-status="<?= e((string) $selector_item['status']) ?>"
                                  data-feedback-status-label="<?= e((string) $selector_item['status_label']) ?>"
                                  data-feedback-type="<?= e((string) $selector_item['type']) ?>"
                                  data-feedback-type-label="<?= e((string) $selector_item['type_label']) ?>"
                                  data-feedback-feature="<?= e((string) $selector_item['feature']) ?>"
                                  data-feedback-feature-label="<?= e((string) $selector_item['feature_label']) ?>"
                                  data-feedback-submitted="<?= e((string) $selector_item['submitted']) ?>"
                                  data-feedback-updated="<?= e((string) $selector_item['updated']) ?>"
                                  data-feedback-search="<?= e((string) $selector_item['search']) ?>"
                                  aria-controls="<?= e((string) $selector_item['id']) ?>"
                                  <?= !empty($selector_item['is_active']) ? 'aria-current="true"' : '' ?>>
                                  <span data-feedback-select-label><?= e((string) $selector_item['label']) ?></span>
                                  <small data-feedback-select-meta><?= e((string) $selector_item['meta']) ?></small>
                                  <em><?= e((string) $selector_item['contact']) ?> / <?= e((string) $selector_item['feature_label']) ?></em>
                                </button>
                              <?php endforeach; ?>
                            </div>
                          </aside>
                        </div>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'store') : ?>
                  <?php if (!$admin_store_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning">Store tables are not ready yet. Run the numbered files in <code>database/migrations/</code> through <code>026_store_stripe_catalog_sync.sql</code>, then <code>database/seeds/001_store_products.sql</code>, and confirm the database credentials in your environment config. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    </section>
                  <?php else : ?>
                    <section class="admin-section admin-store-editor-section">
                      <div class="admin-subsection-head">
                        <h3>Store editor</h3>
                        <p>Select one product at a time, then configure bundles, individual kits, perks, RP offers, cash passes, subscriptions, and the groups applied by purchase.</p>
                      </div>
                      <?php
                        $product_rows = array_values($admin_store_rows);
                        $admin_store_stripe_status = raidlands_store_stripe_setup_status();
                        $admin_store_stripe_schema_ready = raidlands_store_stripe_catalog_sync_schema_ready();
                        $admin_store_price_labels = [];
                        $admin_store_currencies = [];
                        $admin_store_groups = [];
                        $admin_store_group_details = [];

                        if (function_exists('raidlands_permissions_group_rows')) {
                            try {
                                foreach (raidlands_permissions_group_rows() as $group_row) {
                                    $group_name = raidlands_store_clean_group($group_row['group_name'] ?? '');

                                    if ($group_name === '' || !empty($group_row['is_read_only']) || empty($group_row['is_active'])) {
                                        continue;
                                    }

                                    $admin_store_group_details[$group_name] = [
                                        'category' => (string) ($group_row['category'] ?? 'custom'),
                                        'is_managed' => !empty($group_row['is_managed']),
                                        'is_active' => !empty($group_row['is_active']),
                                    ];
                                    $admin_store_groups[] = $group_name;
                                }
                            } catch (Throwable $error) {
                                $admin_store_group_details = [];
                            }
                        }

                        foreach ($product_rows as $product_row) {
                            foreach (['rp_prices', 'cash_pass_prices', 'cash_subscription_prices'] as $price_group_key) {
                                foreach ((array) ($product_row[$price_group_key] ?? []) as $price_row) {
                                    $admin_store_price_labels[] = (string) ($price_row['label'] ?? '');
                                    $admin_store_currencies[] = (string) ($price_row['currency'] ?? '');
                                }
                            }

                            foreach ((array) ($product_row['fulfillment_groups'] ?? []) as $product_group) {
                                $admin_store_groups[] = (string) $product_group;
                            }

                            $admin_store_groups[] = (string) ($product_row['oxide_group'] ?? '');
                        }

                        $admin_store_group_options = [];

                        foreach ($admin_store_group_details as $group_name => $group_detail) {
                            $category = trim((string) ($group_detail['category'] ?? 'custom')) ?: 'custom';
                            $admin_store_group_options[$group_name] = $group_name . ' (' . $category . ')';
                        }

                        foreach ($admin_store_groups as $group_name) {
                            $group_name = raidlands_store_clean_group($group_name);

                            if ($group_name !== '' && !isset($admin_store_group_options[$group_name])) {
                                $admin_store_group_options[$group_name] = $group_name;
                            }
                        }

                        echo admin_render_datalist('admin-price-label-options', admin_price_label_options($admin_store_price_labels));
                        echo admin_render_datalist('admin-currency-options', admin_currency_options($admin_store_currencies));

                        $admin_store_type_options = admin_product_type_options();
                        $product_total = count($product_rows) + 2;
                        $store_selector_items = [];
                        $store_has_active_panel = false;
                      ?>
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Stripe API</p>
                          <h3><?= !empty($admin_store_stripe_status['secret_configured']) ? e(ucfirst((string) $admin_store_stripe_status['secret_mode']) . ' mode') : 'Not configured' ?></h3>
                          <p class="store-muted">Secret key comes from <code>RAIDLANDS_STRIPE_SECRET_KEY</code>.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Webhook</p>
                          <h3><?= !empty($admin_store_stripe_status['webhook_configured']) ? 'Secret set' : 'Needs secret' ?></h3>
                          <p class="store-muted">Fulfillment expects <code>RAIDLANDS_STRIPE_WEBHOOK_SECRET</code>.</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Catalog sync</p>
                          <h3><?= !empty($admin_store_stripe_status['autoload_available']) ? 'Stripe PHP ready' : 'Composer needed' ?></h3>
                          <p class="store-muted"><?= $admin_store_stripe_schema_ready ? 'Cash offers sync automatically on Store save.' : 'Run migration 026 before automatic sync.' ?></p>
                        </div>
                      </div>
                      <?php if (!$admin_store_stripe_schema_ready) : ?>
                        <div class="admin-alert warning">Stripe catalog sync needs <code>database/migrations/026_store_stripe_catalog_sync.sql</code>. Local Store saves still work, but products and prices will not be created in Stripe until the migration is applied.</div>
                      <?php elseif (empty($admin_store_stripe_status['secret_configured']) || empty($admin_store_stripe_status['autoload_available'])) : ?>
                        <div class="admin-alert warning">Stripe catalog sync is paused until <code>RAIDLANDS_STRIPE_SECRET_KEY</code> is set and Composer dependencies are installed. Cash checkout stays disabled until a synced or external <code>price_...</code> is available.</div>
                      <?php endif; ?>
                      <div class="admin-store-editor-shell" data-admin-store-editor>
                        <div class="admin-store-panels">
                        <?php for ($index = 0; $index < $product_total; $index += 1) : ?>
                          <?php
                            $row = $product_rows[$index] ?? [
                                'id' => '',
                                'slug' => '',
                                'name' => '',
                                'product_type' => 'perk',
                                'short_description' => '',
                                'description' => '',
                                'oxide_group' => '',
                                'tier_priority' => 0,
                                'is_stackable' => 1,
                                'is_active' => 0,
                                'is_featured' => 0,
                                'sort_order' => 100,
                                'stripe_product_id' => '',
                                'stripe_sync_mode' => 'auto',
                                'stripe_sync_status' => 'pending',
                                'stripe_sync_error' => '',
                                'stripe_last_synced_at' => '',
                                'rp_prices' => [],
                                'cash_pass_prices' => [],
                                'cash_subscription_prices' => [],
                                'fulfillment_groups' => [],
                            ];
                            $product_type_value = raidlands_store_normalize_product_type((string) ($row['product_type'] ?? 'perk'));
                            $rp_prices = (array) ($row['rp_prices'] ?? []);
                            $rp_intervals = raidlands_store_admin_price_intervals($product_type_value);
                            $cash_pass_prices = (array) ($row['cash_pass_prices'] ?? []);
                            $cash_subscription_prices = (array) ($row['cash_subscription_prices'] ?? []);
                            $cash_subscription_intervals = raidlands_store_admin_subscription_intervals();
                            $selected_groups = raidlands_store_clean_groups((array) ($row['fulfillment_groups'] ?? []));

                            if ($selected_groups === []) {
                                $selected_groups = raidlands_store_clean_groups([(string) ($row['oxide_group'] ?? '')]);
                            }

                            $selected_group_set = array_fill_keys($selected_groups, true);
                            $store_is_existing = !empty($row['id']);
                            $store_panel_key = $store_is_existing ? 'product-' . (int) $row['id'] : 'new-' . $index;
                            $store_panel_id = 'admin-store-panel-' . (preg_replace('/[^a-zA-Z0-9_-]+/', '-', $store_panel_key) ?: (string) $index);
                            $store_is_active_panel = !$store_has_active_panel;
                            $store_has_active_panel = true;
                            $store_title = trim((string) ($row['name'] ?? ''));
                            $store_label = $store_title !== '' ? $store_title : 'New Store Product';
                            $store_group_display = $selected_groups !== [] ? implode(', ', $selected_groups) : '';
                            $store_group_summary = $selected_groups !== []
                                ? implode(', ', array_slice($selected_groups, 0, 3)) . (count($selected_groups) > 3 ? ' +' . (count($selected_groups) - 3) : '')
                                : 'No groups';
                            $store_status = $store_is_existing ? (!empty($row['is_active']) ? 'Active' : 'Inactive') : 'Draft slot';
                            $store_status_value = $store_is_existing ? (!empty($row['is_active']) ? 'active' : 'inactive') : 'draft';
                            $store_type_label = $admin_store_type_options[$product_type_value] ?? $product_type_value;
                            $store_rp_active_count = 0;
                            foreach ($rp_prices as $rp_price_summary_row) {
                                if (!empty($rp_price_summary_row['is_active'])) {
                                    $store_rp_active_count += 1;
                                }
                            }
                            $store_cash_active_count = 0;
                            foreach (array_merge($cash_pass_prices, $cash_subscription_prices) as $cash_price_summary_row) {
                                if (!empty($cash_price_summary_row['is_active'])) {
                                    $store_cash_active_count += 1;
                                }
                            }
                            $store_search_parts = [
                                $store_label,
                                (string) ($row['slug'] ?? ''),
                                $store_type_label,
                                $product_type_value,
                                $store_status,
                                $store_group_display,
                                (string) ($row['short_description'] ?? ''),
                                (string) ($row['description'] ?? ''),
                                !empty($row['is_featured']) ? 'featured' : '',
                                !empty($row['is_stackable']) ? 'stackable' : 'non-stackable',
                            ];
                            $store_search_parts = array_merge($store_search_parts, $selected_groups);

                            foreach ($rp_prices as $rp_interval => $rp_price_search_row) {
                                $rp_price_search_row = (array) $rp_price_search_row;
                                $rp_cost = (int) ($rp_price_search_row['rp_cost'] ?? 0);

                                if (!empty($rp_price_search_row['is_active']) || $rp_cost > 0) {
                                    $store_search_parts[] = (string) ($rp_price_search_row['label'] ?? raidlands_store_admin_offer_default_label('rp', (string) $rp_interval));
                                    $store_search_parts[] = (string) $rp_cost;
                                    $store_search_parts[] = (string) $rp_interval;
                                }
                            }

                            foreach (['cash_pass_prices', 'cash_subscription_prices'] as $cash_search_group) {
                                foreach ((array) ($row[$cash_search_group] ?? []) as $cash_interval => $cash_price_search_row) {
                                    $cash_price_search_row = (array) $cash_price_search_row;
                                    $stripe_price_id = trim((string) ($cash_price_search_row['stripe_price_id'] ?? ''));
                                    $amount_cents = (int) ($cash_price_search_row['amount_cents'] ?? 0);

                                    if (!empty($cash_price_search_row['is_active']) || $stripe_price_id !== '' || $amount_cents > 0) {
                                        $store_search_parts[] = (string) ($cash_price_search_row['label'] ?? '');
                                        $store_search_parts[] = $stripe_price_id;
                                        $store_search_parts[] = (string) ($cash_price_search_row['currency'] ?? '');
                                        $store_search_parts[] = $amount_cents > 0 ? number_format($amount_cents / 100, 2, '.', '') : '';
                                        $store_search_parts[] = (string) $cash_interval;
                                    }
                                }
                            }

                            $store_search_text = trim(implode(' ', array_filter(array_map(
                                static fn ($value): string => trim((string) $value),
                                $store_search_parts
                            ))));
                            $store_selector_items[] = [
                                'id' => $store_panel_id,
                                'index' => (string) $index,
                                'label' => $store_label,
                                'meta' => $store_status . ' / ' . $store_group_summary . ' / ' . $store_rp_active_count . ' RP, ' . $store_cash_active_count . ' cash',
                                'is_active' => $store_is_active_panel,
                                'is_draft' => !$store_is_existing,
                                'category' => $product_type_value,
                                'category_label' => $store_type_label,
                                'status' => $store_status_value,
                                'sort_order' => (string) ((int) ($row['sort_order'] ?? 100)),
                                'search' => $store_search_text,
                            ];
                          ?>
                          <article
                            class="admin-repeat-card admin-store-card admin-store-panel<?= $store_is_active_panel ? ' is-active' : '' ?>"
                            id="<?= e($store_panel_id) ?>"
                            data-admin-store-panel
                            data-admin-store-index="<?= e((string) $index) ?>"
                            <?= $store_is_active_panel ? '' : 'hidden' ?>>
                            <input type="hidden" name="store_products[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3 data-admin-store-card-title><?= e($store_label) ?></h3>
                                <p class="admin-feedback-subtitle"><?= e($store_status) ?> / <?= e($store_group_summary) ?></p>
                              </div>
                              <?php if (!empty($row['id'])) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="store_products[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Deactivate</span>
                                </label>
                              <?php endif; ?>
                            </div>
                            <div class="admin-store-section-stack">
                              <details class="admin-details admin-store-details" open>
                                <summary>Product setup <small>Identity, applied groups, and ordering</small></summary>
                                <div class="admin-grid two admin-store-basic-grid">
                                  <label class="admin-field">
                                    <?= admin_field_head('Slug', 'Stable store identifier used by admin and support. Keep lowercase with hyphens.') ?>
                                    <input type="text" name="store_products[<?= e((string) $index) ?>][slug]" maxlength="120" placeholder="starter-bundle" value="<?= e((string) ($row['slug'] ?? '')) ?>" data-admin-store-slug-input>
                                    <?= admin_hint('Changing an existing slug can affect support lookups and saved Stripe metadata.') ?>
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Name', 'Product title shown to players.') ?>
                                    <input type="text" name="store_products[<?= e((string) $index) ?>][name]" maxlength="160" placeholder="Starter Kit Bundle" value="<?= e((string) ($row['name'] ?? '')) ?>" data-admin-store-name-input>
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Type', 'Bundles are the main grouped products. Individual kits and standalone perks can still expose the same payment options.') ?>
                                    <select name="store_products[<?= e((string) $index) ?>][product_type]" data-admin-store-type-select>
                                      <?= admin_render_options($admin_store_type_options, $product_type_value) ?>
                                    </select>
                                  </label>
                                  <div class="admin-field admin-span-all">
                                    <?= admin_field_head('Applied groups', 'Purchases and manual grants apply every selected server group. Edit permissions for those groups in Groups.') ?>
                                    <div class="admin-store-meaning admin-store-meaning-grants">
                                      <strong>Access grant</strong>
                                      <span>Every selected group is applied when this product is purchased or manually granted.</span>
                                    </div>
                                    <?php if ($admin_store_group_options === []) : ?>
                                      <div class="admin-alert warning">No editable server groups are available yet. Add or sync groups before activating this product.</div>
                                    <?php else : ?>
                                      <div class="admin-check-grid admin-store-group-grid">
                                        <?php foreach ($admin_store_group_options as $group_name => $group_label) : ?>
                                          <?php $group_name = raidlands_store_clean_group($group_name); ?>
                                          <?php if ($group_name === '') { continue; } ?>
                                          <label class="admin-check">
                                            <input
                                              type="checkbox"
                                              name="store_products[<?= e((string) $index) ?>][fulfillment_groups][]"
                                              value="<?= e($group_name) ?>"
                                              <?= isset($selected_group_set[$group_name]) ? 'checked' : '' ?>>
                                            <span><?= e((string) $group_label) ?></span>
                                          </label>
                                        <?php endforeach; ?>
                                      </div>
                                    <?php endif; ?>
                                    <?= admin_hint('Select at least one group before activating a product. The first selected group is also kept in the legacy group column for older records and support views.') ?>
                                  </div>
                                  <label class="admin-field">
                                    <?= admin_field_head('Tier priority', 'Higher non-stackable bundle priority revokes lower active bundle entitlements for the same player.') ?>
                                    <input type="number" min="0" max="999" name="store_products[<?= e((string) $index) ?>][tier_priority]" value="<?= e((string) ($row['tier_priority'] ?? 0)) ?>">
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Sort order', 'Lower products appear first on the public store.') ?>
                                    <input type="number" min="0" max="9999" name="store_products[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>" data-admin-store-sort-input>
                                  </label>
                                  <label class="admin-check admin-check-field admin-span-all">
                                    <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?> data-admin-store-active-input>
                                    <?= admin_check_copy('Product active', 'Controls whether this product can appear on the public store. Checkout also requires an active price.') ?>
                                  </label>
                                  <div class="admin-store-stripe-status admin-span-all">
                                    <div>
                                      <span>Stripe Product</span>
                                      <?= admin_store_stripe_sync_chip($row, 'product') ?>
                                    </div>
                                    <?= admin_store_stripe_sync_note($row, 'product') ?>
                                  </div>
                                </div>
                              </details>

                              <details class="admin-details admin-store-details" open>
                                <summary>RP offers <small>Launch pricing and renewal options</small></summary>
                                <p class="admin-detail-note">RP is the launch payment method. Enable only offers with final RP costs.</p>
                                <div class="admin-rp-offer-grid admin-store-rp-grid">
                                  <?php foreach ($rp_intervals as $rp_interval) : ?>
                                    <?php
                                      $rp_row = (array) ($rp_prices[$rp_interval] ?? []);
                                      $rp_label = (string) ($rp_row['label'] ?? raidlands_store_admin_offer_default_label('rp', $rp_interval));
                                    ?>
                                    <article class="admin-rp-offer-card">
                                      <input type="hidden" name="store_products[<?= e((string) $index) ?>][rp_prices][<?= e($rp_interval) ?>][id]" value="<?= e((string) ($rp_row['id'] ?? '')) ?>">
                                      <input type="hidden" name="store_products[<?= e((string) $index) ?>][rp_prices][<?= e($rp_interval) ?>][label]" value="<?= e($rp_label) ?>">
                                      <div>
                                        <strong><?= e($rp_label) ?></strong>
                                        <small><?= e($rp_interval === 'one_time' ? 'Lifetime access' : raidlands_store_access_duration_seconds($rp_interval) . ' seconds') ?></small>
                                      </div>
                                      <label>
                                        <span>RP cost</span>
                                        <input type="number" min="0" max="99999999" name="store_products[<?= e((string) $index) ?>][rp_prices][<?= e($rp_interval) ?>][rp_cost]" value="<?= e((string) ($rp_row['rp_cost'] ?? 0)) ?>">
                                      </label>
                                      <label class="admin-check">
                                        <input type="checkbox" name="store_products[<?= e((string) $index) ?>][rp_prices][<?= e($rp_interval) ?>][is_active]" value="1" <?= !empty($rp_row['is_active']) ? 'checked' : '' ?>>
                                        <span>Active</span>
                                      </label>
                                      <?php if ($rp_interval !== 'one_time') : ?>
                                        <label class="admin-check">
                                          <input type="checkbox" name="store_products[<?= e((string) $index) ?>][rp_prices][<?= e($rp_interval) ?>][allow_auto_renew]" value="1" <?= !empty($rp_row['allow_auto_renew']) ? 'checked' : '' ?>>
                                          <span>Allow auto-renew</span>
                                        </label>
                                      <?php endif; ?>
                                    </article>
                                  <?php endforeach; ?>
                                </div>
                              </details>

                              <details class="admin-details admin-store-details">
                                <summary>Cash passes <small>One-time Stripe payments with optional expiration</small></summary>
                                <p class="admin-detail-note">Cash passes charge once. Lifetime has no scheduled expiration; timed passes expire on the website after the chosen duration. Test and live Stripe prices both work when they match the secret key mode above.</p>
                                <div class="admin-rp-offer-grid admin-store-price-grid">
                                  <?php foreach ($rp_intervals as $cash_interval) : ?>
                                    <?php
                                      $cash_row = (array) ($cash_pass_prices[$cash_interval] ?? []);
                                      $cash_label = (string) ($cash_row['label'] ?? raidlands_store_admin_offer_default_label('cash_pass', $cash_interval));
                                      $cash_amount = ((int) ($cash_row['amount_cents'] ?? 0)) / 100;
                                    ?>
                                    <article class="admin-rp-offer-card admin-store-price-card">
                                      <input type="hidden" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][id]" value="<?= e((string) ($cash_row['id'] ?? '')) ?>">
                                      <div>
                                        <strong><?= e($cash_label) ?></strong>
                                        <small><?= e($cash_interval === 'one_time' ? 'Lifetime access' : raidlands_store_access_duration_seconds($cash_interval) . ' seconds') ?></small>
                                      </div>
                                      <label class="admin-store-price-field admin-store-price-field-wide">
                                        <span>Stripe Price ID</span>
                                        <input type="text" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][stripe_price_id]" maxlength="160" placeholder="price_..." value="<?= e((string) ($cash_row['stripe_price_id'] ?? '')) ?>">
                                      </label>
                                      <label class="admin-store-price-field admin-store-price-field-wide">
                                        <span>Label</span>
                                        <input type="text" list="admin-price-label-options" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][label]" maxlength="120" value="<?= e($cash_label) ?>">
                                      </label>
                                      <label class="admin-store-price-field">
                                        <span>Amount</span>
                                        <input type="number" min="0" step="0.01" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][amount_dollars]" value="<?= e(number_format($cash_amount, 2, '.', '')) ?>">
                                      </label>
                                      <label class="admin-store-price-field">
                                        <span>Currency</span>
                                        <input type="text" list="admin-currency-options" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][currency]" maxlength="3" value="<?= e((string) ($cash_row['currency'] ?? 'usd')) ?>">
                                      </label>
                                      <div class="admin-store-price-field admin-store-price-field-wide admin-store-stripe-actions">
                                        <div class="admin-store-stripe-status">
                                          <div>
                                            <span>Stripe Price</span>
                                            <?= admin_store_stripe_sync_chip($cash_row, 'price') ?>
                                          </div>
                                          <?= admin_store_stripe_sync_note($cash_row, 'price') ?>
                                        </div>
                                      </div>
                                      <label class="admin-check">
                                        <input type="checkbox" name="store_products[<?= e((string) $index) ?>][cash_pass_prices][<?= e($cash_interval) ?>][is_active]" value="1" <?= !empty($cash_row['is_active']) ? 'checked' : '' ?>>
                                        <span>Active</span>
                                      </label>
                                    </article>
                                  <?php endforeach; ?>
                                </div>
                              </details>

                              <details class="admin-details admin-store-details">
                                <summary>Cash subscriptions <small>Recurring Stripe prices</small></summary>
                                <p class="admin-detail-note">Cash subscriptions renew in Stripe. Player billing changes are handled through the Stripe Billing Portal from Profile.</p>
                                <div class="admin-rp-offer-grid admin-store-price-grid">
                                  <?php foreach ($cash_subscription_intervals as $cash_interval) : ?>
                                    <?php
                                      $cash_row = (array) ($cash_subscription_prices[$cash_interval] ?? []);
                                      $cash_label = (string) ($cash_row['label'] ?? raidlands_store_admin_offer_default_label('cash_sub', $cash_interval));
                                      $cash_amount = ((int) ($cash_row['amount_cents'] ?? 0)) / 100;
                                    ?>
                                    <article class="admin-rp-offer-card admin-store-price-card">
                                      <input type="hidden" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][id]" value="<?= e((string) ($cash_row['id'] ?? '')) ?>">
                                      <div>
                                        <strong><?= e($cash_label) ?></strong>
                                        <small><?= e(raidlands_store_access_duration_seconds($cash_interval) . ' seconds per period') ?></small>
                                      </div>
                                      <label class="admin-store-price-field admin-store-price-field-wide">
                                        <span>Stripe Price ID</span>
                                        <input type="text" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][stripe_price_id]" maxlength="160" placeholder="price_..." value="<?= e((string) ($cash_row['stripe_price_id'] ?? '')) ?>">
                                      </label>
                                      <label class="admin-store-price-field admin-store-price-field-wide">
                                        <span>Label</span>
                                        <input type="text" list="admin-price-label-options" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][label]" maxlength="120" value="<?= e($cash_label) ?>">
                                      </label>
                                      <label class="admin-store-price-field">
                                        <span>Amount</span>
                                        <input type="number" min="0" step="0.01" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][amount_dollars]" value="<?= e(number_format($cash_amount, 2, '.', '')) ?>">
                                      </label>
                                      <label class="admin-store-price-field">
                                        <span>Currency</span>
                                        <input type="text" list="admin-currency-options" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][currency]" maxlength="3" value="<?= e((string) ($cash_row['currency'] ?? 'usd')) ?>">
                                      </label>
                                      <div class="admin-store-price-field admin-store-price-field-wide admin-store-stripe-actions">
                                        <div class="admin-store-stripe-status">
                                          <div>
                                            <span>Stripe Price</span>
                                            <?= admin_store_stripe_sync_chip($cash_row, 'price') ?>
                                          </div>
                                          <?= admin_store_stripe_sync_note($cash_row, 'price') ?>
                                        </div>
                                      </div>
                                      <label class="admin-check">
                                        <input type="checkbox" name="store_products[<?= e((string) $index) ?>][cash_subscription_prices][<?= e($cash_interval) ?>][is_active]" value="1" <?= !empty($cash_row['is_active']) ? 'checked' : '' ?>>
                                        <span>Active</span>
                                      </label>
                                    </article>
                                  <?php endforeach; ?>
                                </div>
                              </details>

                              <details class="admin-details admin-store-details">
                                <summary>Store flags <small>Featured placement and stacking behavior</small></summary>
                                <div class="admin-grid two admin-store-toggle-grid">
                                  <label class="admin-check admin-check-field">
                                    <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_featured]" value="1" <?= !empty($row['is_featured']) ? 'checked' : '' ?> data-admin-store-featured-input>
                                    <?= admin_check_copy('Featured', 'Featured products can be emphasized on future storefront layouts.') ?>
                                  </label>
                                  <label class="admin-check admin-check-field">
                                    <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_stackable]" value="1" <?= !empty($row['is_stackable']) ? 'checked' : '' ?> data-admin-store-stackable-input>
                                    <?= admin_check_copy('Stackable', 'Individual kits and perks usually stack. Main bundles should usually be non-stackable.') ?>
                                  </label>
                                </div>
                              </details>

                              <details class="admin-details admin-store-details">
                                <summary>Store copy <small>Card text and support notes</small></summary>
                                <div class="admin-grid">
                                  <label class="admin-field">
                                    <?= admin_field_head('Short description', 'Brief copy shown on store cards.') ?>
                                    <input type="text" name="store_products[<?= e((string) $index) ?>][short_description]" maxlength="255" value="<?= e((string) ($row['short_description'] ?? '')) ?>" data-admin-store-copy-input>
                                  </label>
                                  <label class="admin-field">
                                    <?= admin_field_head('Full description', 'Longer admin/support note for what this product should grant.') ?>
                                    <textarea name="store_products[<?= e((string) $index) ?>][description]" rows="3" data-admin-store-copy-input><?= e((string) ($row['description'] ?? '')) ?></textarea>
                                  </label>
                                </div>
                              </details>
                            </div>
                          </article>
                        <?php endfor; ?>
                        </div>
                        <aside class="admin-store-picker" aria-label="Store product selector">
                          <div class="admin-store-picker-head">
                            <h3>Products</h3>
                            <p><?= e((string) count($product_rows)) ?> saved plus draft slots</p>
                          </div>
                          <div class="admin-store-picker-controls">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="140" placeholder="Name, slug, group, kit, or price" data-admin-store-search>
                            </label>
                            <div class="admin-store-filter-grid">
                              <label class="admin-field">
                                <span>Category</span>
                                <select data-admin-store-category-filter>
                                  <option value="">All categories</option>
                                  <?= admin_render_keyed_options($admin_store_type_options) ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Status</span>
                                <select data-admin-store-status-filter>
                                  <option value="">Any status</option>
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="draft">Draft slots</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Sort</span>
                                <select data-admin-store-sort>
                                  <option value="order">Public order</option>
                                  <option value="name">Name A-Z</option>
                                  <option value="category">Category</option>
                                  <option value="status">Active first</option>
                                </select>
                              </label>
                              <button class="btn btn-secondary admin-store-filter-reset" type="button" data-admin-store-reset>Clear</button>
                            </div>
                            <p class="admin-store-filter-count" data-admin-store-result-count><?= e((string) count($store_selector_items)) ?> products shown</p>
                            <div class="admin-alert warning admin-store-empty" data-admin-store-empty hidden>No store products match these controls.</div>
                          </div>
                          <div class="admin-store-picker-list">
                            <?php foreach ($store_selector_items as $selector_item) : ?>
                              <button
                                class="admin-store-picker-button<?= !empty($selector_item['is_active']) ? ' is-active' : '' ?><?= !empty($selector_item['is_draft']) ? ' is-draft' : '' ?>"
                                type="button"
                                data-admin-store-select
                                data-admin-store-index="<?= e((string) $selector_item['index']) ?>"
                                data-admin-store-target="<?= e((string) $selector_item['id']) ?>"
                                data-admin-store-category="<?= e((string) $selector_item['category']) ?>"
                                data-admin-store-category-label="<?= e((string) $selector_item['category_label']) ?>"
                                data-admin-store-status="<?= e((string) $selector_item['status']) ?>"
                                data-admin-store-sort-order="<?= e((string) $selector_item['sort_order']) ?>"
                                data-admin-store-search="<?= e((string) $selector_item['search']) ?>"
                                aria-controls="<?= e((string) $selector_item['id']) ?>"
                                <?= !empty($selector_item['is_active']) ? 'aria-current="true"' : '' ?>>
                                <span data-admin-store-select-label><?= e((string) $selector_item['label']) ?></span>
                                <small data-admin-store-select-meta><?= e((string) $selector_item['meta']) ?></small>
                              </button>
                            <?php endforeach; ?>
                          </div>
                        </aside>
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
                      $kit_rows = array_values($admin_kit_rows);
                      $kit_total = count($kit_rows) + 1;
                      $kit_selector_items = [];
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
                                'permission_groups' => [],
                                'derived_store_products' => [],
                            ];
                            $kit_title = trim((string) ($row['kit_name'] ?? ''));
                            $kit_permission = (string) ($row['required_permission'] ?? '');
                            $kit_permission_suffix = $kit_permission !== '' ? raidlands_kits_permission_suffix($kit_permission) : '';
                            $kit_groups = array_map('strval', (array) ($row['permission_groups'] ?? []));
                            $kit_products = array_values((array) ($row['derived_store_products'] ?? []));
                            $kit_item_count = admin_kit_item_count($row);
                            $kit_is_active_panel = $index === 0;
                            $kit_is_existing = !empty($row['id']);
                            $kit_panel_key = $kit_is_existing ? 'kit-' . (int) $row['id'] : 'new-' . $index;
                            $kit_panel_id = 'admin-kit-panel-' . (preg_replace('/[^a-zA-Z0-9_-]+/', '-', $kit_panel_key) ?: (string) $index);
                            $kit_status_value = $kit_is_existing ? (!empty($row['is_active']) ? 'active' : 'inactive') : 'draft';
                            $kit_status_label = match ($kit_status_value) {
                                'active' => 'Active',
                                'inactive' => 'Inactive',
                                default => 'Draft slot',
                            };
                            $kit_access_value = $kit_permission === ''
                                ? 'no-permission'
                                : ($kit_groups === [] ? 'needs-group' : 'granted');
                            $kit_access_label = match ($kit_access_value) {
                                'granted' => (string) count($kit_groups) . ' group' . (count($kit_groups) === 1 ? '' : 's'),
                                'needs-group' => 'Needs group grant',
                                default => 'No permission',
                            };
                            $kit_shop_tokens = [];

                            if (!empty($row['reward_enabled'])) {
                                $kit_shop_tokens[] = 'rewards';
                            }

                            if ($kit_products !== []) {
                                $kit_shop_tokens[] = 'store';
                            }

                            if ($kit_shop_tokens === []) {
                                $kit_shop_tokens[] = 'none';
                            }

                            $kit_shop_label = match (implode(' ', $kit_shop_tokens)) {
                                'rewards store' => 'Rewards + Store',
                                'rewards' => 'Rewards shop',
                                'store' => 'Store derived',
                                default => 'No shop display',
                            };
                            $kit_meta = $kit_status_label
                                . ' / '
                                . $kit_item_count
                                . ' item'
                                . ($kit_item_count === 1 ? '' : 's')
                                . ' / '
                                . $kit_access_label
                                . ' / '
                                . $kit_shop_label;
                            $kit_published_label = !empty($row['published_revision'])
                                ? ' / published rev ' . (string) $row['published_revision']
                                : '';
                            $kit_search_parts = [
                                $kit_title,
                                $kit_permission,
                                $kit_permission_suffix,
                                (string) ($row['description'] ?? ''),
                                (string) ($row['reward_display_name'] ?? ''),
                                (string) ($row['reward_description'] ?? ''),
                                $kit_status_label,
                                $kit_access_label,
                                $kit_shop_label,
                            ];
                            $kit_search_parts = array_merge($kit_search_parts, $kit_groups);

                            foreach ($kit_products as $product) {
                                $kit_search_parts[] = (string) ($product['name'] ?? '');
                                foreach (raidlands_store_clean_groups((array) ($product['groups'] ?? [])) as $product_group) {
                                    $kit_search_parts[] = $product_group;
                                }
                            }

                            $kit_selector_items[] = [
                                'id' => $kit_panel_id,
                                'index' => (string) $index,
                                'label' => $kit_title !== '' ? $kit_title : 'New Kit',
                                'meta' => $kit_meta,
                                'is_active' => $kit_is_active_panel,
                                'is_draft' => !$kit_is_existing,
                                'status' => $kit_status_value,
                                'access' => $kit_access_value,
                                'shop' => implode(' ', $kit_shop_tokens),
                                'sort_order' => (string) ((int) ($row['sort_order'] ?? 100)),
                                'items' => (string) $kit_item_count,
                                'groups' => (string) count($kit_groups),
                                'products' => (string) count($kit_products),
                                'search' => trim(implode(' ', array_filter(array_map(
                                    static fn ($value): string => trim((string) $value),
                                    $kit_search_parts
                                )))),
                            ];
                          ?>
                          <article
                            class="admin-repeat-card admin-kit-card admin-kit-panel<?= $kit_is_active_panel ? ' is-active' : '' ?>"
                            id="<?= e($kit_panel_id) ?>"
                            data-kit-panel
                            data-kit-index="<?= e((string) $index) ?>"
                            data-kit-group-count="<?= e((string) count($kit_groups)) ?>"
                            data-kit-product-count="<?= e((string) count($kit_products)) ?>"
                            data-kit-original-permission="<?= e($kit_permission_suffix) ?>"
                            data-kit-published-label="<?= e($kit_published_label) ?>"
                            data-kit-expected="<?= e(admin_kit_slot_expected_json()) ?>"
                            <?= $kit_is_active_panel ? '' : 'hidden' ?>>
                            <input type="hidden" name="kits[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <input type="hidden" name="kits[<?= e((string) $index) ?>][original_kit_name]" value="<?= e((string) ($row['kit_name'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3 data-kit-card-title><?= e($kit_title !== '' ? $kit_title : 'New Kit') ?></h3>
                                <p class="admin-feedback-subtitle" data-kit-card-subtitle><?= e($kit_meta . $kit_published_label) ?></p>
                              </div>
                              <?php if (!empty($row['id'])) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Delete Kit</span>
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
                                  <?= admin_field_head('Previous aliases', 'Filled automatically when renaming. Add an older duplicate name here if the Rust server still has one to remove.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][previous_kit_name]" maxlength="160" placeholder="Old Kit Name" value="<?= e((string) ($row['previous_kit_name'] ?? '')) ?>">
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('Kit permission', 'The Rust Kits plugin gate. Active kits must have a Kits permission; public kits are granted through the default group in Groups.') ?>
                                  <div class="admin-prefixed-input">
                                    <span>kits.</span>
                                    <input type="text" name="kits[<?= e((string) $index) ?>][required_permission]" maxlength="155" placeholder="claim.raid" value="<?= e($kit_permission_suffix) ?>" data-kit-permission-input>
                                  </div>
                                  <?= admin_hint('Enter only the part after kits. The database still stores the full permission, such as kits.claim.raid.') ?>
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
                                  <input type="number" min="0" max="9999" name="kits[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>" data-kit-sort-input>
                                </label>
                                <label class="admin-field">
                                  <?= admin_field_head('CopyPaste file', 'Optional building file name used by the Rust Kits plugin.') ?>
                                  <input type="text" name="kits[<?= e((string) $index) ?>][copy_paste_file]" maxlength="160" value="<?= e((string) ($row['copy_paste_file'] ?? '')) ?>">
                                </label>
                                <label class="admin-field admin-span-all">
                                  <?= admin_field_head('Description', 'Player-facing kit description shown on the website and in the Rust UI when supported.') ?>
                                  <textarea name="kits[<?= e((string) $index) ?>][description]" rows="3" maxlength="3000" data-kit-description-input><?= e((string) ($row['description'] ?? '')) ?></textarea>
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
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?> data-kit-active-input>
                                  <?= admin_check_copy('Active', 'Inactive kits stay in the website admin but are removed from the next published server payload.') ?>
                                </label>
                                <label class="admin-check admin-check-field">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][is_hidden]" value="1" <?= !empty($row['is_hidden']) ? 'checked' : '' ?>>
                                  <?= admin_check_copy('Hidden in /kit', 'Hidden kits can still be used by other systems such as the RP shop.') ?>
                                </label>
                              </div>
                            </details>
                            <details class="admin-details">
                              <summary>Access report <small>Groups and derived store display</small></summary>
                              <div class="admin-grid two">
                                <div class="admin-field">
                                  <?= admin_field_head('Groups with this kit permission', 'Read-only report from Groups. Add or remove kit access in the Groups section.') ?>
                                  <?php if ($kit_permission === '') : ?>
                                    <div class="admin-alert warning">This kit has no permission yet, so no group can grant it.</div>
                                  <?php elseif ($kit_groups === []) : ?>
                                    <div class="admin-alert warning">No active group currently grants <code><?= e($kit_permission) ?></code>. Add it from Groups before players can claim this kit.</div>
                                  <?php else : ?>
                                    <div class="admin-permission-chip-list">
                                      <?php foreach ($kit_groups as $group) : ?>
                                        <span class="admin-permission-chip"><?= e($group) ?></span>
                                      <?php endforeach; ?>
                                    </div>
                                  <?php endif; ?>
                                </div>
                                <div class="admin-field">
                                  <?= admin_field_head('Store products deriving this kit', 'Read-only report from Store applied groups plus Group permissions. Store products no longer link kits manually.') ?>
                                  <?php if ($kit_products === []) : ?>
                                    <div class="admin-alert warning">No store product currently derives this kit from its applied groups.</div>
                                  <?php else : ?>
                                    <div class="admin-derived-product-list">
                                      <?php foreach ($kit_products as $product) : ?>
                                        <?php $product_groups = raidlands_store_clean_groups((array) ($product['groups'] ?? [])); ?>
                                        <div class="admin-derived-product">
                                          <strong><?= e((string) ($product['name'] ?? 'Store product')) ?></strong>
                                          <small><?= !empty($product['is_active']) ? 'Active' : 'Inactive' ?><?= $product_groups !== [] ? ' / ' . e(implode(', ', $product_groups)) : '' ?></small>
                                        </div>
                                      <?php endforeach; ?>
                                    </div>
                                  <?php endif; ?>
                                </div>
                              </div>
                            </details>

                            <details class="admin-details">
                              <summary>RP shop row <small>Optional /s listing</small></summary>
                              <div class="admin-grid three">
                                <label class="admin-check admin-check-field">
                                  <input type="checkbox" name="kits[<?= e((string) $index) ?>][reward_enabled]" value="1" <?= !empty($row['reward_enabled']) ? 'checked' : '' ?> data-kit-reward-enabled-input>
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
                                  <?= admin_field_head('Shop permission', 'Optional ServerRewards purchase permission. PvP kit access should use unique kit permissions such as kits.pvp.light.') ?>
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
                            <div>
                              <h3>Kits</h3>
                              <p><?= e((string) count($kit_rows)) ?> saved<?= $kit_rows === [] ? '' : ' plus new draft slot' ?></p>
                            </div>
                            <button class="btn btn-secondary" type="button" data-kit-add>Add Kit</button>
                          </div>
                          <div class="admin-kit-picker-controls">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="140" placeholder="Name, permission, group, item, or shop" data-kit-search>
                            </label>
                            <div class="admin-kit-filter-grid">
                              <label class="admin-field">
                                <span>Status</span>
                                <select data-kit-status-filter>
                                  <option value="">Any status</option>
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="draft">Draft slot</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Access</span>
                                <select data-kit-access-filter>
                                  <option value="">Any access</option>
                                  <option value="granted">Granted by group</option>
                                  <option value="needs-group">Needs group grant</option>
                                  <option value="no-permission">No permission</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Shop</span>
                                <select data-kit-shop-filter>
                                  <option value="">Any shop state</option>
                                  <option value="rewards">Rewards shop</option>
                                  <option value="store">Derived store display</option>
                                  <option value="none">No shop display</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Sort</span>
                                <select data-kit-sort>
                                  <option value="order">Admin order</option>
                                  <option value="name">Name A-Z</option>
                                  <option value="items">Most items</option>
                                  <option value="access">Access state</option>
                                  <option value="shop">Shop exposure</option>
                                </select>
                              </label>
                              <button class="btn btn-secondary admin-kit-filter-reset" type="button" data-kit-reset>Clear</button>
                            </div>
                            <p class="admin-kit-filter-count" data-kit-result-count><?= e((string) $kit_total) ?> kits shown</p>
                            <div class="admin-alert warning admin-kit-empty" data-kit-empty hidden>No kits match these controls.</div>
                          </div>
                          <div class="admin-kit-picker-list">
                            <?php foreach ($kit_selector_items as $selector_item) : ?>
                              <button
                                class="admin-kit-picker-button<?= !empty($selector_item['is_active']) ? ' is-active' : '' ?><?= !empty($selector_item['is_draft']) ? ' is-draft' : '' ?><?= (string) $selector_item['status'] === 'inactive' ? ' is-inactive' : '' ?><?= (string) $selector_item['access'] === 'needs-group' ? ' needs-access' : '' ?>"
                                type="button"
                                data-kit-select
                                data-kit-index="<?= e((string) $selector_item['index']) ?>"
                                data-kit-target="<?= e((string) $selector_item['id']) ?>"
                                data-kit-status="<?= e((string) $selector_item['status']) ?>"
                                data-kit-access="<?= e((string) $selector_item['access']) ?>"
                                data-kit-shop="<?= e((string) $selector_item['shop']) ?>"
                                data-kit-sort-order="<?= e((string) $selector_item['sort_order']) ?>"
                                data-kit-items="<?= e((string) $selector_item['items']) ?>"
                                data-kit-groups="<?= e((string) $selector_item['groups']) ?>"
                                data-kit-products="<?= e((string) $selector_item['products']) ?>"
                                data-kit-search="<?= e((string) $selector_item['search']) ?>"
                                aria-controls="<?= e((string) $selector_item['id']) ?>"
                                <?= !empty($selector_item['is_active']) ? 'aria-current="true"' : '' ?>>
                                <span data-kit-select-label><?= e((string) $selector_item['label']) ?></span>
                                <small data-kit-select-meta><?= e((string) $selector_item['meta']) ?></small>
                              </button>
                            <?php endforeach; ?>
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
                      $permission_group_active_index = $permission_group_total - 1;
                      $admin_kit_permission_options = array_values(array_filter(
                          array_map('strval', $admin_permission_options),
                          static fn (string $permission): bool => str_starts_with($permission, 'kits.')
                      ));
                      $admin_direct_permission_options = array_values(array_filter(
                          array_map('strval', $admin_permission_options),
                          static fn (string $permission): bool => !str_starts_with($permission, 'kits.')
                      ));
                      $permission_option_set = array_fill_keys($admin_direct_permission_options, true);
                      $kit_permission_option_set = array_fill_keys($admin_kit_permission_options, true);
                      $permission_catalog_groups = admin_permission_catalog_groups($admin_direct_permission_options, $admin_permission_rows);

                      foreach ($permission_group_rows as $candidate_index => $candidate_row) {
                          $candidate_name = (string) ($candidate_row['group_name'] ?? '');

                          if (
                              !raidlands_permissions_group_is_read_only($candidate_name)
                              && !raidlands_permissions_group_has_forced_protection($candidate_name)
                              && empty($candidate_row['is_protected'])
                          ) {
                              $permission_group_active_index = (int) $candidate_index;
                              break;
                          }
                      }

                      if ($permission_group_active_index === $permission_group_total - 1) {
                          foreach ($permission_group_rows as $candidate_index => $candidate_row) {
                              if (!raidlands_permissions_group_is_read_only((string) ($candidate_row['group_name'] ?? ''))) {
                                  $permission_group_active_index = (int) $candidate_index;
                                  break;
                              }
                          }
                      }
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
                          <p>Save Draft keeps desired permissions on the website. Publish sends kit access plus every selected non-kit plugin permission to Rust on the next bridge sync.</p>
                      </div>
                      <div class="admin-group-editor-shell" data-admin-group-editor>
                        <div class="admin-group-panels">
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
                            $live_set = array_fill_keys($live_permissions, true);
                            $direct_desired_permissions = array_values(array_filter($desired_permissions, static fn (string $permission): bool => !str_starts_with($permission, 'kits.')));
                            $direct_live_permissions = array_values(array_filter($live_permissions, static fn (string $permission): bool => !str_starts_with($permission, 'kits.')));
                            $kit_permission_names = array_values(array_unique(array_merge(
                                $admin_kit_permission_options,
                                array_filter($desired_permissions, static fn (string $permission): bool => str_starts_with($permission, 'kits.')),
                                array_filter($live_permissions, static fn (string $permission): bool => str_starts_with($permission, 'kits.'))
                            )));
                            sort($kit_permission_names, SORT_NATURAL | SORT_FLAG_CASE);
                            $kit_desired_count = count(array_filter($kit_permission_names, static fn (string $permission): bool => isset($desired_set[$permission])));
                            $kit_live_count = count(array_filter($kit_permission_names, static fn (string $permission): bool => isset($live_set[$permission])));
                            $custom_permissions = array_values(array_filter(
                                $direct_desired_permissions,
                                static fn (string $permission): bool => !isset($permission_option_set[$permission])
                            ));
                            $missing_live = array_values(array_diff($desired_permissions, $live_permissions));
                            $extra_live = array_values(array_diff($live_permissions, $desired_permissions));
                            $is_read_only = raidlands_permissions_group_is_read_only($group_name);
                            $is_forced_protected = raidlands_permissions_group_has_forced_protection($group_name);
                            $is_protected = $is_forced_protected || !empty($row['is_protected']);
                            $card_title = $group_name !== '' ? $group_name : 'New Group';
                            $group_is_active_panel = $index === $permission_group_active_index;
                            $active_permission_prefix = '';

                            foreach ($permission_catalog_groups as $prefix_group) {
                                foreach ((array) $prefix_group['permissions'] as $permission_meta) {
                                    if (isset($desired_set[(string) $permission_meta['name']])) {
                                        $active_permission_prefix = (string) $prefix_group['prefix'];
                                        break 2;
                                    }
                                }
                            }

                            if ($active_permission_prefix === '' && $permission_catalog_groups !== []) {
                                $active_permission_prefix = (string) array_key_first($permission_catalog_groups);
                            }

                            $active_permission_group = $permission_catalog_groups[$active_permission_prefix] ?? null;
                            $active_permission_label = 'Permission category';
                            $active_permission_meta = count($admin_direct_permission_options) . ' non-kit permissions available';

                            if (is_array($active_permission_group)) {
                                $active_permission_rows = (array) ($active_permission_group['permissions'] ?? []);
                                $active_permission_selected = count(array_filter(
                                    $active_permission_rows,
                                    static fn (array $permission): bool => isset($desired_set[(string) $permission['name']])
                                ));
                                $active_permission_label = admin_permission_prefix_label(
                                    (string) ($active_permission_group['prefix'] ?? $active_permission_prefix),
                                    (string) ($active_permission_group['plugin_name'] ?? '')
                                );
                                $active_permission_meta = $active_permission_prefix . ' / ' . $active_permission_selected . ' of ' . count($active_permission_rows) . ' selected';
                            }
                          ?>
                          <article
                            class="admin-repeat-card admin-group-card admin-group-panel<?= $group_is_active_panel ? ' is-active' : '' ?>"
                            data-group-panel
                            data-group-index="<?= e((string) $index) ?>"
                            data-group-read-only="<?= $is_read_only ? '1' : '0' ?>"
                            data-group-forced-protected="<?= $is_forced_protected ? '1' : '0' ?>"
                            data-group-initial-drift="<?= ($missing_live !== [] || $extra_live !== []) ? '1' : '0' ?>"
                            data-group-live-count="<?= e((string) count($live_permissions)) ?>"
                            <?= $group_is_active_panel ? '' : 'hidden' ?>>
                            <input type="hidden" name="permission_groups[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <div>
                                <h3 data-group-card-title><?= e($card_title) ?></h3>
                                <?php if ($is_read_only) : ?>
                                  <p class="admin-feedback-subtitle">Read-only system group. The website will snapshot this group but will not publish changes for it.</p>
                                <?php elseif ($missing_live !== [] || $extra_live !== []) : ?>
                                  <p class="admin-feedback-subtitle">Live drift: <?= e((string) count($missing_live)) ?> missing / <?= e((string) count($extra_live)) ?> extra permission grants.</p>
                                <?php else : ?>
                                  <p class="admin-feedback-subtitle">Desired permissions match the latest live snapshot.</p>
                                <?php endif; ?>
                              </div>
                              <?php if (!empty($row['id']) && !$is_read_only && !$is_protected) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Delete Group</span>
                                </label>
                              <?php endif; ?>
                            </div>

                            <div class="admin-grid three">
                              <label class="admin-field">
                                <?= admin_field_head('Group name', 'Stable Oxide group name. Use lowercase letters, numbers, dots, dashes, or underscores.') ?>
                                <input type="text" list="admin-group-name-options" name="permission_groups[<?= e((string) $index) ?>][group_name]" maxlength="160" placeholder="vip_bronze" value="<?= e($group_name) ?>" data-group-name-input>
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
                                <input type="checkbox" name="permission_groups[<?= e((string) $index) ?>][is_protected]" value="1" <?= $is_protected ? 'checked' : '' ?> <?= $is_forced_protected ? 'disabled' : '' ?>>
                                <?= admin_check_copy('Protected', 'Protected groups are guarded for structure changes. Non-kit grants remain editable unless the group is read-only. Clear this and save to return a custom group to normal edit mode.') ?>
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Notes', 'Admin-only context for why this group exists or what it should unlock.') ?>
                                <textarea name="permission_groups[<?= e((string) $index) ?>][notes]" rows="2" maxlength="3000"><?= e((string) ($row['notes'] ?? '')) ?></textarea>
                              </label>
                            </div>

                            <?php if ($is_read_only) : ?>
                              <div class="admin-group-edit-status is-locked">
                                <span>Edit status</span>
                                <strong>Read-only system group</strong>
                                <p>Permission grants are locked for <code><?= e($group_name) ?></code>. Use a managed group such as a VIP, perk, or custom group when you need to add or remove permissions.</p>
                              </div>
                            <?php elseif ($is_protected) : ?>
                              <div class="admin-group-edit-status is-protected">
                                <span>Edit status</span>
                                <strong>Protected group</strong>
                                <?php if ($is_forced_protected) : ?>
                                  <p><code><?= e($group_name) ?></code> is protected by its group name. Non-kit grants below can still be selected, but title, rank, and parent changes are guarded; use a custom managed group if you need normal structural editing.</p>
                                <?php else : ?>
                                  <p>Protected is on for this group. Non-kit grants below can still be selected; to return this group to normal edit mode, clear Protected and then Save Draft or Publish.</p>
                                <?php endif; ?>
                              </div>
                            <?php else : ?>
                              <div class="admin-group-edit-status is-editable">
                                <span>Edit status</span>
                                <strong>Editable managed group</strong>
                                <p>Non-kit grants below can be added or removed, then saved as a draft or published to the server.</p>
                              </div>
                            <?php endif; ?>

                            <details class="admin-details" <?= $group_name !== '' && !$is_read_only ? 'open' : '' ?>>
                              <summary>Kit access <small><?= e((string) $kit_desired_count) ?> desired / <?= e((string) $kit_live_count) ?> live</small></summary>
                              <?php if ($kit_permission_names === []) : ?>
                                <div class="admin-alert warning">No Kits plugin permissions are registered yet. Save active kits with a kit permission to populate this panel.</div>
                              <?php else : ?>
                                <p class="admin-detail-note">Grant in-game kit access by selecting the Kits plugin permissions this group should hold. Public/free kits belong on the protected <code>default</code> group.</p>
                                <?= admin_permission_status_guide() ?>
                                <div class="admin-kit-permission-grid">
                                  <?php foreach ($kit_permission_names as $permission_name) : ?>
                                    <?php
                                      $permission_selected = isset($desired_set[$permission_name]);
                                      $permission_live = isset($live_set[$permission_name]);
                                      $permission_state = $permission_selected && !$permission_live
                                          ? 'Missing live'
                                          : (!$permission_selected && $permission_live
                                              ? 'Live extra'
                                              : ($permission_selected ? 'Synced' : ''));
                                      $permission_classes = 'admin-check admin-permission-option admin-kit-permission-option';
                                      $permission_classes .= $permission_selected ? ' is-selected' : '';
                                      $permission_classes .= $permission_live ? ' is-live' : '';
                                      $permission_classes .= $permission_selected && !$permission_live ? ' is-missing-live' : '';
                                      $permission_classes .= !$permission_selected && $permission_live ? ' is-extra-live' : '';
                                      $permission_classes .= $is_read_only ? ' is-disabled' : '';
                                    ?>
                                    <label
                                      class="<?= e($permission_classes) ?>"
                                      data-permission-name="<?= e($permission_name) ?>"
                                      data-permission-live="<?= $permission_live ? '1' : '0' ?>">
                                      <input
                                        type="checkbox"
                                        name="permission_groups[<?= e((string) $index) ?>][permissions][]"
                                        value="<?= e($permission_name) ?>"
                                        <?= $permission_selected ? 'checked' : '' ?>
                                        <?= $is_read_only ? 'disabled' : '' ?>>
                                      <span class="admin-permission-option-copy">
                                        <span class="admin-permission-name"><?= e($permission_name) ?></span>
                                        <small <?= $permission_state === '' ? 'hidden' : '' ?>><?= e($permission_state) ?></small>
                                      </span>
                                    </label>
                                  <?php endforeach; ?>
                                </div>
                              <?php endif; ?>
                            </details>

                            <details class="admin-details" <?= $group_name !== '' && !$is_read_only ? 'open' : '' ?>>
                              <summary>Other permissions and perks <small><?= e((string) count($direct_desired_permissions)) ?> desired / <?= e((string) count($direct_live_permissions)) ?> live</small></summary>
                              <?php if ($is_read_only) : ?>
                                <div class="admin-alert warning">This system group is snapshot-only. Non-kit grants are visible in live drift checks but are not editable from the website.</div>
                              <?php elseif ($is_protected) : ?>
                                <?php if ($is_forced_protected) : ?>
                                  <div class="admin-alert warning">Protected is locked on for this built-in group. Non-kit grant rows are still editable; for full normal group editing, create or choose a custom managed group.</div>
                                <?php else : ?>
                                  <div class="admin-alert warning">Protected is on. If you want this group to behave like a normal editable group, clear Protected above and save. Non-kit grant rows remain editable here.</div>
                                <?php endif; ?>
                              <?php endif; ?>
                              <?= admin_permission_status_guide() ?>
                              <div class="admin-permission-workbench" data-permission-workbench>
                                <div class="admin-permission-toolbar">
                                  <label class="admin-field admin-permission-search">
                                    <?= admin_field_head('Find non-kit permissions', 'Filter the active permission category by plugin prefix, plugin name, or exact permission. Kit permissions are managed in Kit access above.') ?>
                                    <input type="search" data-permission-search placeholder="backpacks, teleport, queue" autocomplete="off">
                                  </label>
                                  <label class="admin-check admin-permission-filter">
                                    <input type="checkbox" data-permission-selected-only autocomplete="off">
                                    <span class="admin-permission-filter-copy">Selected only</span>
                                  </label>
                                  <div class="admin-permission-totals" aria-live="polite">
                                    <span data-permission-match-count><?= e((string) count($admin_direct_permission_options)) ?> visible</span>
                                    <span data-permission-selected-count><?= e((string) count($direct_desired_permissions)) ?> selected</span>
                                  </div>
                                </div>

                                <div class="admin-permission-selected" data-permission-selected-wrap>
                                  <div class="admin-permission-selected-head">
                                    <span>Selected non-kit grants</span>
                                    <small data-permission-selected-summary><?= e((string) count($direct_desired_permissions)) ?> selected</small>
                                  </div>
                                  <div class="admin-permission-chip-list" data-permission-selected-list></div>
                                </div>

                                <div class="admin-permission-section-picker">
                                  <label class="admin-field admin-permission-prefix-select">
                                    <?= admin_field_head('Permission category', 'Choose the non-kit plugin or permission prefix to browse.') ?>
                                    <select data-permission-prefix-select autocomplete="off" aria-label="Permission grant category">
                                      <?php foreach ($permission_catalog_groups as $prefix_group) : ?>
                                        <?php
                                          $prefix = (string) $prefix_group['prefix'];
                                          $prefix_permissions = (array) $prefix_group['permissions'];
                                          $prefix_selected = count(array_filter(
                                              $prefix_permissions,
                                              static fn (array $permission): bool => isset($desired_set[(string) $permission['name']])
                                          ));
                                          $prefix_label = admin_permission_prefix_label($prefix, (string) ($prefix_group['plugin_name'] ?? ''));
                                        ?>
                                        <option
                                          value="<?= e($prefix) ?>"
                                          data-permission-choice
                                          data-choice-label="<?= e($prefix_label) ?>"
                                          data-choice-prefix="<?= e($prefix) ?>"
                                          <?= $prefix === $active_permission_prefix ? 'selected' : '' ?>>
                                          <?= e($prefix_label . ' - ' . $prefix_selected . ' / ' . count($prefix_permissions)) ?>
                                        </option>
                                      <?php endforeach; ?>
                                    </select>
                                  </label>
                                  <div class="admin-permission-prefix-summary" data-permission-prefix-summary aria-live="polite">
                                    <span data-permission-active-label><?= e($active_permission_label) ?></span>
                                    <small data-permission-active-meta><?= e($active_permission_meta) ?></small>
                                  </div>
                                  <button class="btn btn-secondary admin-permission-category-open" type="button" data-permission-category-open>View Categories</button>
                                </div>

                                <div class="admin-permission-tabs" role="tablist" aria-label="Permission sections" aria-hidden="true">
                                  <?php foreach ($permission_catalog_groups as $prefix_group) : ?>
                                    <?php
                                      $prefix = (string) $prefix_group['prefix'];
                                      $prefix_permissions = (array) $prefix_group['permissions'];
                                      $prefix_selected = count(array_filter(
                                          $prefix_permissions,
                                          static fn (array $permission): bool => isset($desired_set[(string) $permission['name']])
                                      ));
                                      $prefix_label = admin_permission_prefix_label($prefix, (string) ($prefix_group['plugin_name'] ?? ''));
                                      $prefix_is_active = $prefix === $active_permission_prefix;
                                    ?>
                                    <button
                                      class="admin-permission-tab<?= $prefix_is_active ? ' is-active' : '' ?>"
                                      type="button"
                                      role="tab"
                                      aria-selected="<?= $prefix_is_active ? 'true' : 'false' ?>"
                                      data-permission-tab
                                      data-tab-prefix="<?= e($prefix) ?>">
                                      <span><?= e($prefix_label) ?></span>
                                      <small data-tab-count><?= e((string) $prefix_selected) ?> / <?= e((string) count($prefix_permissions)) ?></small>
                                    </button>
                                  <?php endforeach; ?>
                                </div>

                                <div class="admin-permission-empty" data-permission-empty hidden>No matching permissions in this tab.</div>

                                <div class="admin-permission-prefix-list">
                                  <?php foreach ($permission_catalog_groups as $prefix_group) : ?>
                                    <?php
                                      $prefix = (string) $prefix_group['prefix'];
                                      $prefix_permissions = (array) $prefix_group['permissions'];
                                      usort(
                                          $prefix_permissions,
                                          static function (array $a, array $b) use ($desired_set): int {
                                              $a_selected = isset($desired_set[(string) $a['name']]);
                                              $b_selected = isset($desired_set[(string) $b['name']]);

                                              if ($a_selected !== $b_selected) {
                                                  return $a_selected ? -1 : 1;
                                              }

                                              return strnatcasecmp((string) $a['name'], (string) $b['name']);
                                          }
                                      );
                                      $prefix_selected = count(array_filter(
                                          $prefix_permissions,
                                          static fn (array $permission): bool => isset($desired_set[(string) $permission['name']])
                                      ));
                                      $prefix_label = admin_permission_prefix_label($prefix, (string) ($prefix_group['plugin_name'] ?? ''));
                                      $prefix_is_active = $prefix === $active_permission_prefix;
                                    ?>
                                    <section
                                      class="admin-permission-prefix"
                                      data-permission-prefix
                                      data-prefix="<?= e($prefix) ?>"
                                      data-prefix-label="<?= e($prefix_label) ?>"
                                      <?= $prefix_is_active ? '' : 'hidden' ?>>
                                      <div class="admin-permission-prefix-head">
                                        <div>
                                          <h4><?= e($prefix_label) ?></h4>
                                          <code><?= e($prefix) ?></code>
                                        </div>
                                        <span data-prefix-count><?= e((string) $prefix_selected) ?> / <?= e((string) count($prefix_permissions)) ?> selected</span>
                                      </div>
                                      <div class="admin-permission-grid">
                                        <?php foreach ($prefix_permissions as $permission_meta) : ?>
                                          <?php
                                            $permission_name = (string) $permission_meta['name'];
                                            $permission_selected = isset($desired_set[$permission_name]);
                                            $permission_live = isset($live_set[$permission_name]);
                                            $permission_plugin = (string) ($permission_meta['plugin_name'] ?? '');
                                            $permission_classes = 'admin-check admin-permission-option';

                                            if ($permission_selected) {
                                                $permission_classes .= ' is-selected';
                                            }

                                            if ($permission_live) {
                                                $permission_classes .= ' is-live';
                                            }

                                            if ($is_read_only) {
                                                $permission_classes .= ' is-disabled';
                                            }

                                            if ($permission_selected && !$permission_live) {
                                                $permission_state = 'Missing live';
                                                $permission_classes .= ' is-missing-live';
                                            } elseif (!$permission_selected && $permission_live) {
                                                $permission_state = 'Live extra';
                                                $permission_classes .= ' is-extra-live';
                                            } elseif ($permission_selected) {
                                                $permission_state = 'Synced';
                                            } else {
                                                $permission_state = '';
                                            }
                                          ?>
                                          <label
                                            class="<?= e($permission_classes) ?>"
                                            data-permission-item
                                            data-permission-name="<?= e($permission_name) ?>"
                                            data-permission-prefix="<?= e($prefix) ?>"
                                            data-permission-plugin="<?= e($permission_plugin) ?>"
                                            data-permission-live="<?= $permission_live ? '1' : '0' ?>"
                                            <?php if ($is_read_only) : ?>
                                              data-guard-title="Permission grant locked"
                                              data-guard-message="<?= e('This permission belongs to ' . $group_name . ', which is a read-only system group. Use a managed VIP, perk, or custom group when you need to add or remove non-kit grants.') ?>"
                                              title="<?= e('Read-only system group. Click for why this grant cannot be changed.') ?>"
                                            <?php endif; ?>>
                                            <input
                                              type="checkbox"
                                              name="permission_groups[<?= e((string) $index) ?>][permissions][]"
                                              value="<?= e($permission_name) ?>"
                                              <?= $permission_selected ? 'checked' : '' ?>
                                              <?= $is_read_only ? 'disabled' : '' ?>>
                                            <span class="admin-permission-option-copy">
                                              <span class="admin-permission-name"><?= e($permission_name) ?></span>
                                              <small data-permission-state <?= $permission_state === '' ? 'hidden' : '' ?>><?= e($permission_state) ?></small>
                                            </span>
                                          </label>
                                        <?php endforeach; ?>
                                      </div>
                                    </section>
                                  <?php endforeach; ?>
                                </div>

                                <label class="admin-field admin-permission-custom">
                                  <?= admin_field_head('Custom non-kit permissions', 'One plugin.permission per line for permissions not listed above yet. Kit permissions should be added from Kit access.') ?>
                                  <textarea name="permission_groups[<?= e((string) $index) ?>][custom_permissions]" rows="3" placeholder="plugin.permission" <?= $is_read_only ? 'disabled' : '' ?>><?= e(implode("\n", $custom_permissions)) ?></textarea>
                                </label>
                              </div>
                            </details>
                          </article>
                        <?php endfor; ?>
                        </div>
                        <aside class="admin-group-picker" aria-label="Group selector">
                          <div class="admin-group-picker-head">
                            <div>
                              <h3>Groups</h3>
                              <p><?= e((string) count($permission_group_rows)) ?> saved<?= $permission_group_rows === [] ? '' : ' plus new draft slot' ?></p>
                            </div>
                            <button class="btn btn-secondary" type="button" data-group-add>Add Group</button>
                          </div>
                          <div class="admin-group-picker-controls">
                            <label class="admin-field">
                              <span>Search</span>
                              <input type="search" maxlength="140" placeholder="Name, category, permission, or notes" data-group-search>
                            </label>
                            <div class="admin-group-filter-grid">
                              <label class="admin-field">
                                <span>Category</span>
                                <select data-group-category-filter>
                                  <option value="">All categories</option>
                                  <?= admin_render_options(['public', 'vip', 'perk', 'store', 'system', 'snapshot', 'custom'], '') ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>State</span>
                                <select data-group-status-filter>
                                  <option value="">Any state</option>
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="protected">Protected</option>
                                  <option value="read-only">Read-only</option>
                                  <option value="draft">Draft slot</option>
                                  <option value="drift">Drift only</option>
                                  <option value="synced">No drift</option>
                                </select>
                              </label>
                              <label class="admin-field">
                                <span>Sort</span>
                                <select data-group-sort>
                                  <option value="order">Admin order</option>
                                  <option value="name">Name A-Z</option>
                                  <option value="category">Category</option>
                                  <option value="status">State</option>
                                  <option value="grants">Most grants</option>
                                  <option value="drift">Drift first</option>
                                </select>
                              </label>
                              <button class="btn btn-secondary admin-group-filter-reset" type="button" data-group-reset>Clear</button>
                            </div>
                            <p class="admin-group-filter-count" data-group-result-count><?= e((string) $permission_group_total) ?> groups shown</p>
                            <div class="admin-alert warning admin-group-empty" data-group-empty hidden>No groups match these controls.</div>
                          </div>
                          <div class="admin-group-picker-list">
                            <?php for ($selector_index = 0; $selector_index < $permission_group_total; $selector_index += 1) : ?>
                              <?php
                                $selector_row = $permission_group_rows[$selector_index] ?? [
                                    'id' => '',
                                    'group_name' => '',
                                    'title' => '',
                                    'parent_group' => '',
                                    'category' => 'custom',
                                    'sort_order' => 100,
                                    'notes' => '',
                                    'desired_permissions' => [],
                                    'live_permissions' => [],
                                    'is_read_only' => 0,
                                    'is_active' => 1,
                                ];
                                $selector_name = trim((string) ($selector_row['group_name'] ?? ''));
                                $selector_category = strtolower(trim((string) ($selector_row['category'] ?? 'custom'))) ?: 'custom';
                                $selector_category_options = ['public', 'vip', 'perk', 'store', 'system', 'snapshot', 'custom'];

                                if (!in_array($selector_category, $selector_category_options, true)) {
                                    $selector_category = 'custom';
                                }

                                $selector_desired_permissions = array_values(array_unique(array_map('strval', (array) ($selector_row['desired_permissions'] ?? []))));
                                $selector_live_permissions = array_values(array_unique(array_map('strval', (array) ($selector_row['live_permissions'] ?? []))));
                                $selector_missing_live = array_values(array_diff($selector_desired_permissions, $selector_live_permissions));
                                $selector_extra_live = array_values(array_diff($selector_live_permissions, $selector_desired_permissions));
                                $selector_has_drift = $selector_missing_live !== [] || $selector_extra_live !== [];
                                $selector_is_active = $selector_index === $permission_group_active_index;
                                $selector_is_read_only = raidlands_permissions_group_is_read_only($selector_name);
                                $selector_is_forced_protected = raidlands_permissions_group_has_forced_protection($selector_name);
                                $selector_is_protected = $selector_is_forced_protected || !empty($selector_row['is_protected']);
                                $selector_state = empty($selector_row['id'])
                                    ? 'Draft'
                                    : ($selector_is_read_only
                                        ? 'Read-only'
                                        : ($selector_is_protected ? 'Protected' : (empty($selector_row['is_active']) ? 'Inactive' : 'Active')));
                                $selector_status_value = strtolower(str_replace(' ', '-', $selector_state));
                                $selector_classes = 'admin-group-picker-button';
                                $selector_classes .= $selector_is_active ? ' is-active' : '';
                                $selector_classes .= $selector_has_drift ? ' has-drift' : '';
                                $selector_classes .= $selector_is_read_only ? ' is-guarded is-read-only' : ($selector_is_protected ? ' is-guarded is-protected' : '');
                                $selector_title = '';
                                $selector_message = '';
                                $selector_tooltip = '';

                                if ($selector_is_read_only) {
                                    $selector_title = 'Read-only system group';
                                    $selector_message = 'The ' . ($selector_name !== '' ? $selector_name : 'selected') . ' group is snapshot-only. Its live permissions are visible, but the website will not add or remove grants for it. Choose a managed VIP, perk, or custom group when you need editable permissions.';
                                    $selector_tooltip = 'Read-only system group. Click for why it cannot be edited.';
                                } elseif ($selector_is_protected) {
                                    $selector_title = $selector_is_forced_protected ? 'Protected built-in group' : 'Protected group';
                                    $selector_message = $selector_is_forced_protected
                                        ? 'The ' . ($selector_name !== '' ? $selector_name : 'selected') . ' group is protected by its group name. Non-kit grants can be reviewed, but normal structural editing is guarded; use a custom managed group for fully editable behavior.'
                                        : 'Protected is turned on for ' . ($selector_name !== '' ? $selector_name : 'this group') . '. Clear the Protected checkbox and save if you want it to behave like a normal editable group.';
                                    $selector_tooltip = 'Protected group. Click for what is guarded and how to change it.';
                                }
                                $selector_search = trim(implode(' ', array_filter(array_merge([
                                    $selector_name,
                                    (string) ($selector_row['title'] ?? ''),
                                    (string) ($selector_row['parent_group'] ?? ''),
                                    $selector_category,
                                    $selector_state,
                                    (string) ($selector_row['notes'] ?? ''),
                                ], $selector_desired_permissions, $selector_live_permissions))));
                                $selector_meta = e((string) count($selector_desired_permissions)) . ' desired / ' . e((string) count($selector_live_permissions)) . ' live / ' . e($selector_state . ($selector_has_drift ? ' / Drift' : ''));
                              ?>
                              <button
                                class="<?= e($selector_classes) ?>"
                                type="button"
                                data-group-select
                                data-group-index="<?= e((string) $selector_index) ?>"
                                data-group-category="<?= e($selector_category) ?>"
                                data-group-status="<?= e($selector_status_value) ?>"
                                data-group-drift="<?= $selector_has_drift ? '1' : '0' ?>"
                                data-group-sort-order="<?= e((string) ($selector_row['sort_order'] ?? 100)) ?>"
                                data-group-desired-count="<?= e((string) count($selector_desired_permissions)) ?>"
                                data-group-live-count="<?= e((string) count($selector_live_permissions)) ?>"
                                data-group-search="<?= e($selector_search) ?>"
                                <?php if ($selector_title !== '') : ?>
                                  data-guard-title="<?= e($selector_title) ?>"
                                  data-guard-message="<?= e($selector_message) ?>"
                                  data-guard-open-label="<?= e($selector_is_read_only ? 'View read-only group' : 'Open protected group') ?>"
                                  title="<?= e($selector_tooltip) ?>"
                                  aria-label="<?= e(($selector_name !== '' ? $selector_name : 'New Group') . '. ' . $selector_tooltip) ?>"
                                <?php endif; ?>
                                <?= $selector_is_active ? 'aria-current="true"' : '' ?>>
                                <span data-group-select-label><?= e($selector_name !== '' ? $selector_name : 'New Group') ?></span>
                                <small data-group-select-meta><?= $selector_meta ?></small>
                              </button>
                            <?php endfor; ?>
                          </div>
                        </aside>
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
                      <div class="admin-alert warning">MySQL must be configured before player access can be managed. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php else : ?>
                      <?php
                        $admin_grant_products = array_values(array_filter(
                            $admin_store_catalog['products'],
                            static fn (array $product): bool => raidlands_store_clean_groups((array) ($product['fulfillment_groups'] ?? [])) !== []
                        ));
                        $admin_access_player = is_array($admin_access_state) ? ($admin_access_state['player'] ?? null) : null;
                        $admin_access_entitlements = is_array($admin_access_state) ? (array) ($admin_access_state['entitlements'] ?? []) : [];
                        $admin_access_direct_groups = is_array($admin_access_state) ? (array) ($admin_access_state['direct_groups'] ?? []) : [];
                        $admin_access_groups = is_array($admin_access_state) ? (array) ($admin_access_state['groups'] ?? []) : [];
                      ?>
                      <div class="admin-grid two">
                        <label class="admin-field">
                          <?= admin_field_head('SteamID64', 'The 17-digit Rust player ID to load or update.') ?>
                          <input type="text" name="steam_id64" inputmode="numeric" pattern="[0-9]{17}" maxlength="17" placeholder="7656119XXXXXXXXXX" value="<?= e($admin_access_steam_id64) ?>" required>
                          <?= admin_hint('Loading does not create a player record. Granting access creates one if needed.') ?>
                        </label>
                        <div class="admin-field">
                          <span class="admin-label-row"><span>Lookup</span></span>
                          <button class="btn btn-secondary" type="submit" name="grant_action" value="load_player">Load Player</button>
                          <?= admin_hint('Use this before granting or removing access so current sources are visible.') ?>
                        </div>
                      </div>

                      <?php if ($admin_access_lookup_error !== '') : ?>
                        <div class="admin-alert error"><?= e($admin_access_lookup_error) ?></div>
                      <?php elseif ($admin_access_steam_id64 === '') : ?>
                        <div class="admin-alert warning">Load a SteamID64 to review current access before making changes.</div>
                      <?php elseif ($admin_access_state !== null) : ?>
                        <div class="admin-grid two">
                          <div class="metal-panel">
                            <p class="section-kicker">Player</p>
                            <h3><?= e((string) ($admin_access_player['display_name'] ?? $admin_access_player['steam_display_name'] ?? 'Uncreated player')) ?></h3>
                            <p class="store-muted"><code><?= e($admin_access_steam_id64) ?></code></p>
                            <?php if ($admin_access_player === null) : ?>
                              <p class="store-muted">No website player row exists yet. Granting a product or direct group will create it.</p>
                            <?php else : ?>
                              <p class="store-muted">Player ID <?= e((string) ($admin_access_player['id'] ?? '')) ?> - Last seen <?= e((string) ($admin_access_player['last_seen_at'] ?? 'Pending')) ?></p>
                            <?php endif; ?>
                          </div>
                          <div class="metal-panel">
                            <p class="section-kicker">Desired Groups</p>
                            <h3><?= e((string) count($admin_access_groups)) ?> active</h3>
                            <?php if ($admin_access_groups === []) : ?>
                              <p class="store-muted">No website-owned groups are currently active for this player.</p>
                            <?php else : ?>
                              <ul class="list-clean">
                                <?php foreach ($admin_access_groups as $group) : ?>
                                  <li><code><?= e((string) $group) ?></code></li>
                                <?php endforeach; ?>
                              </ul>
                            <?php endif; ?>
                          </div>
                        </div>

                        <section class="admin-section">
                          <div class="admin-subsection-head">
                            <h3>Product Access</h3>
                            <p>Paid access is shown as locked. Manual product grants can be revoked from here.</p>
                          </div>
                          <?php if ($admin_access_entitlements === []) : ?>
                            <div class="admin-alert warning">No active product access is recorded for this player.</div>
                          <?php else : ?>
                            <div class="store-table-wrap">
                              <table class="store-table">
                                <thead>
                                  <tr>
                                    <th>Source</th>
                                    <th>Product</th>
                                    <th>Groups</th>
                                    <th>Ends</th>
                                    <th>Updated</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <?php foreach ($admin_access_entitlements as $entitlement) : ?>
                                    <?php
                                      $entitlement_groups = raidlands_store_clean_groups((array) ($entitlement['fulfillment_groups'] ?? [$entitlement['oxide_group'] ?? '']));
                                      $can_revoke_entitlement = !empty($entitlement['can_revoke']);
                                    ?>
                                    <tr>
                                      <td><span class="status-pill <?= $can_revoke_entitlement ? 'active' : 'pending' ?>"><?= e((string) ($entitlement['source_label'] ?? 'Product')) ?></span></td>
                                      <td><?= e((string) ($entitlement['name'] ?? 'Product')) ?></td>
                                      <td><code><?= e($entitlement_groups !== [] ? implode(', ', $entitlement_groups) : 'None') ?></code></td>
                                      <td><?= e((string) ($entitlement['ends_at'] ?: 'Lifetime')) ?></td>
                                      <td><?= e((string) ($entitlement['changed_at'] ?? '')) ?></td>
                                      <td>
                                        <?php if ($can_revoke_entitlement) : ?>
                                          <button class="btn btn-secondary" type="submit" name="grant_action" value="revoke_manual_entitlement:<?= e((string) $entitlement['id']) ?>">Revoke</button>
                                        <?php else : ?>
                                          <span class="store-muted">Locked</span>
                                        <?php endif; ?>
                                      </td>
                                    </tr>
                                  <?php endforeach; ?>
                                </tbody>
                              </table>
                            </div>
                          <?php endif; ?>
                        </section>

                        <section class="admin-section">
                          <div class="admin-subsection-head">
                            <h3>Direct Group Access</h3>
                            <p>These are website-owned player-to-group assignments, separate from store purchases.</p>
                          </div>
                          <?php if (!$admin_access_assignments_ready) : ?>
                            <div class="admin-alert warning">Direct group assignments are not installed yet. Run <code>database/migrations/023_player_group_assignments.sql</code>.</div>
                          <?php elseif ($admin_access_direct_groups === []) : ?>
                            <div class="admin-alert warning">No direct group assignments are active for this player.</div>
                          <?php else : ?>
                            <div class="store-table-wrap">
                              <table class="store-table">
                                <thead>
                                  <tr>
                                    <th>Group</th>
                                    <th>Ends</th>
                                    <th>Note</th>
                                    <th>Updated</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <?php foreach ($admin_access_direct_groups as $assignment) : ?>
                                    <tr>
                                      <td><code><?= e((string) $assignment['group_name']) ?></code></td>
                                      <td><?= e((string) ($assignment['ends_at'] ?: 'Lifetime')) ?></td>
                                      <td><?= e((string) ($assignment['admin_note'] ?: '')) ?></td>
                                      <td><?= e((string) ($assignment['changed_at'] ?? '')) ?></td>
                                      <td>
                                        <button class="btn btn-secondary" type="submit" name="grant_action" value="revoke_direct_group:<?= e((string) $assignment['id']) ?>">Revoke</button>
                                      </td>
                                    </tr>
                                  <?php endforeach; ?>
                                </tbody>
                              </table>
                            </div>
                          <?php endif; ?>
                        </section>
                      <?php endif; ?>

                      <div class="admin-grid two">
                        <section class="admin-section">
                          <div class="admin-subsection-head">
                            <h3>Grant Product</h3>
                            <p>Products apply their configured store groups and remain visible as manual product access.</p>
                          </div>
                          <?php if ($admin_grant_products === []) : ?>
                            <div class="admin-alert warning">No active products with applied groups are available to grant.</div>
                          <?php else : ?>
                            <label class="admin-field">
                              <?= admin_field_head('Product', 'The selected product controls the server groups WebsiteVipBridge will sync.') ?>
                              <select name="product_id">
                                <option value="">Choose a product</option>
                                <?php foreach ($admin_grant_products as $product) : ?>
                                  <?php $grant_groups = raidlands_store_clean_groups((array) ($product['fulfillment_groups'] ?? [])); ?>
                                  <option value="<?= e((string) $product['id']) ?>"><?= e((string) $product['name']) ?> (<?= e(implode(', ', $grant_groups)) ?>)</option>
                                <?php endforeach; ?>
                              </select>
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Ends at', 'Optional datetime such as 2026-07-31 23:59:59. Leave blank for lifetime access.') ?>
                              <input type="text" name="product_ends_at" placeholder="YYYY-MM-DD HH:MM:SS">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Admin note', 'Optional note recorded in the admin audit log for this product grant.') ?>
                              <input type="text" name="product_admin_note" maxlength="500" placeholder="Reason or context">
                            </label>
                            <button class="btn btn-primary" type="submit" name="grant_action" value="grant_product">Grant Product</button>
                          <?php endif; ?>
                        </section>

                        <section class="admin-section">
                          <div class="admin-subsection-head">
                            <h3>Add Direct Groups</h3>
                            <p>Standalone shop groups must be active VIP, perk, or store groups in Groups.</p>
                          </div>
                          <?php if (!$admin_access_assignments_ready) : ?>
                            <div class="admin-alert warning">Run <code>database/migrations/023_player_group_assignments.sql</code> before assigning direct groups.</div>
                          <?php elseif ($admin_access_group_rows === []) : ?>
                            <div class="admin-alert warning">No active standalone store-access groups are available. Create one in Groups with category store, VIP, or perk.</div>
                          <?php else : ?>
                            <div class="admin-permission-grid">
                              <?php foreach ($admin_access_group_rows as $group_row) : ?>
                                <label class="admin-check admin-permission-option">
                                  <input type="checkbox" name="direct_groups[]" value="<?= e((string) $group_row['group_name']) ?>">
                                  <span class="admin-permission-option-copy">
                                    <span class="admin-permission-name"><?= e((string) $group_row['group_name']) ?></span>
                                    <small><?= e(ucwords((string) $group_row['category'])) ?></small>
                                  </span>
                                </label>
                              <?php endforeach; ?>
                            </div>
                            <label class="admin-field">
                              <?= admin_field_head('Ends at', 'Optional datetime such as 2026-07-31 23:59:59. Leave blank for lifetime access.') ?>
                              <input type="text" name="group_ends_at" placeholder="YYYY-MM-DD HH:MM:SS">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Admin note', 'Optional note stored with the direct group assignment.') ?>
                              <input type="text" name="group_admin_note" maxlength="500" placeholder="Reason or context">
                            </label>
                            <button class="btn btn-primary" type="submit" name="grant_action" value="grant_direct_groups">Add Groups</button>
                          <?php endif; ?>
                        </section>
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
                          <li><code>/api/server/status-heartbeat.php</code></li>
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
                      <h3>Server heartbeat</h3>
                      <p>Website status panels use signed heartbeats from WebsiteVipBridge. Public pages show player-safe status only.</p>
                    </div>
                    <?php if ($admin_server_status === null) : ?>
                      <div class="admin-alert warning">Server status has not been checked yet.</div>
                    <?php else : ?>
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Public status</p>
                          <h3><?= e((string) ($admin_server_status['statusLabel'] ?? 'Pending')) ?></h3>
                          <p class="store-muted"><?= e((string) ($admin_server_status['sourceLabel'] ?? 'site fallback')) ?></p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Population</p>
                          <h3><?= e((string) ($admin_server_status['players'] ?? 0)) ?> / <?= e((string) ($admin_server_status['maxPlayers'] ?? 0)) ?></h3>
                          <p class="store-muted">Queue <?= e((string) ($admin_server_status['queue'] ?? 0)) ?> / joining <?= e((string) ($admin_server_status['joining'] ?? 0)) ?></p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Last heartbeat</p>
                          <h3><?= e((string) ($admin_server_status['receivedAt'] ?: 'Pending')) ?></h3>
                          <p class="store-muted"><?= !empty($admin_server_status['stale']) ? 'Delayed' : 'Fresh' ?></p>
                        </div>
                      </div>
                    <?php endif; ?>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Stats ingest</h3>
                      <p>Website leaderboards and profile RP use snapshots posted by WebsiteVipBridge. The active wipe comes from the bridge wipe key, not this admin schedule form.</p>
                    </div>
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL is not configured yet. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif (empty($admin_stats_summary['ready'])) : ?>
                      <div class="admin-alert warning">Stats tables are not installed yet. Run <code>database/migrations/002_player_stats.sql</code>, then <code>database/migrations/016_player_stats_wipe_rp_baseline.sql</code>.</div>
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
                              <th>Groups</th>
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
                                <?php $sync_groups = raidlands_store_clean_groups((array) ($row['fulfillment_groups'] ?? [$row['oxide_group'] ?? ''])); ?>
                                <td><code><?= e($sync_groups !== [] ? implode(', ', $sync_groups) : 'None') ?></code></td>
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
                        || $active_section === 'grants'
                        || ($active_section === 'feedback' && (!$admin_feedback_ready || $admin_feedback_rows === []))
                        || ($active_section === 'features' && !$admin_features_ready);
                    $admin_save_disabled = ($active_section === 'store' && !$admin_store_ready)
                        || ($active_section === 'features' && !$admin_features_ready)
                        || ($active_section === 'kits' && !$admin_kits_ready)
                        || ($active_section === 'groups' && !$admin_permissions_ready);
                    $admin_disabled_label = match ($active_section) {
                        'store' => 'Store Unavailable',
                        'features' => 'Features Unavailable',
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
      <?php if ($active_section === 'groups') : ?>
        <script src="<?= e(asset_url('js/admin-groups.js')) ?>" defer></script>
      <?php endif; ?>
      <?php if ($active_section === 'store') : ?>
        <script src="<?= e(asset_url('js/admin-store.js')) ?>" defer></script>
      <?php endif; ?>
      <?php if ($active_section === 'features') : ?>
        <script src="<?= e(asset_url('js/admin-features.js')) ?>" defer></script>
      <?php endif; ?>
      <?php if ($active_section === 'feedback') : ?>
        <script src="<?= e(asset_url('js/admin-feedback.js')) ?>" defer></script>
      <?php endif; ?>
    <?php endif; ?>
  </body>
</html>
