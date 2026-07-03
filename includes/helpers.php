<?php

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function asset_url(string $path): string
{
    global $base_path;

    $asset_path = ltrim($path, '/');
    $url = $base_path . 'assets/' . $asset_path;
    $absolute_path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $asset_path);

    if (preg_match('/\.(css|js)$/i', $asset_path) && is_file($absolute_path)) {
        return $url . '?v=' . filemtime($absolute_path);
    }

    return $url;
}

function route_url(string $path = ''): string
{
    global $base_path;

    $path = trim($path, '/');

    return $path === '' ? $base_path : $base_path . $path . '/';
}

function icon_svg(string $paths): string
{
    return '<svg viewBox="0 0 64 64" focusable="false">' . $paths . '</svg>';
}

function action_icon(string $name): string
{
    global $action_icons;

    return icon_svg($action_icons[$name] ?? '');
}

function render_steam_avatar(string $avatar_url, string $profile_url, string $name, string $class = ''): string
{
    $avatar_url = trim($avatar_url);

    if ($avatar_url === '') {
        return '';
    }

    $classes = trim('steam-avatar ' . $class);
    $name = trim($name);
    $alt = $name !== '' ? $name . ' Steam avatar' : 'Steam avatar';
    $image = '<img src="' . e($avatar_url) . '" alt="' . e($alt) . '" loading="lazy" referrerpolicy="no-referrer">';
    $profile_url = trim($profile_url);

    if ($profile_url !== '') {
        $label = $name !== '' ? $name . ' Steam profile' : 'Steam profile';

        return '<a class="' . e($classes) . '" href="' . e($profile_url) . '" target="_blank" rel="noopener noreferrer" aria-label="' . e($label) . '">' . $image . '</a>';
    }

    return '<span class="' . e($classes) . '">' . $image . '</span>';
}

function raidlands_linked_player(): ?array
{
    static $checked = false;
    static $player = null;

    if ($checked) {
        return $player;
    }

    $checked = true;

    if (!function_exists('raidlands_store_current_player')) {
        require_once __DIR__ . '/store.php';
    }

    try {
        $current_player = raidlands_store_current_player();
    } catch (Throwable $error) {
        return null;
    }

    if (is_array($current_player) && !empty($current_player['steam_id64'])) {
        $player = $current_player;
    }

    return $player;
}

function raidlands_has_linked_account(): bool
{
    return raidlands_linked_player() !== null;
}

function raidlands_account_url(): string
{
    return route_url(raidlands_has_linked_account() ? 'profile' : 'link');
}

function raidlands_account_label(string $unlinked_label = 'Link Account', string $linked_label = 'View Account'): string
{
    return raidlands_has_linked_account() ? $linked_label : $unlinked_label;
}

function raidlands_loader_payload(): array
{
    global $base_path, $page_copy, $page_id, $site_config;

    $explosion_asset_urls = [
        asset_url('media/loading/raidlands-vfx-01-ground-blast-green.webp'),
        asset_url('media/loading/raidlands-vfx-02-fireball-core-green.webp'),
        asset_url('media/loading/raidlands-vfx-03-molten-debris-burst-green.webp'),
        asset_url('media/loading/raidlands-vfx-04-smoke-plume-green.webp'),
        asset_url('media/loading/raidlands-vfx-05-shockwave-ring-green.webp'),
        asset_url('media/loading/raidlands-vfx-06-ember-field-green.webp'),
    ];
    $mobile_explosion_asset_urls = [
        $explosion_asset_urls[0],
        $explosion_asset_urls[3],
    ];
    $linked_player = raidlands_linked_player();
    $page_meta = $page_copy[$page_id] ?? $page_copy['home'];
    $player_name = '';
    $steam_id64 = '';

    if ($linked_player !== null) {
        $steam_id64 = (string) ($linked_player['steam_id64'] ?? '');
        $player_name = trim((string) ($linked_player['display_name'] ?? ''));
    }

    $account_label = $linked_player !== null
        ? ($player_name !== '' ? $player_name : 'Steam ' . $steam_id64)
        : 'No Steam account linked on this browser';
    $store_ready = function_exists('raidlands_db_is_configured') && raidlands_db_is_configured();
    $wipe_days = implode(' and ', (array) ($site_config['wipe']['dayNames'] ?? ['Thursday']));
    $wipe_time = (string) ($site_config['wipe']['time'] ?? '19:00');
    $wipe_timezone = (string) ($site_config['wipe']['timezone'] ?? 'America/Chicago');

    return [
        'brand' => (string) ($site_config['serverName'] ?? 'Raidlands 1000x'),
        'tagline' => (string) ($site_config['tagline'] ?? 'Raid. Respawn. Rebuild. Repeat.'),
        'pageId' => $page_id,
        'pageTitle' => (string) ($page_meta['title'] ?? 'Raidlands'),
        'logoUrl' => asset_url('media/raidlands-logo.webp'),
        'serverStatusUrl' => $base_path . 'api/server-status.php',
        'statusProbeTimeoutMs' => 750,
        'startupColdMs' => 340,
        'startupMs' => 1500,
        'minVisibleMs' => 1500,
        'completeHoldMs' => 560,
        'fastTrackAfterMs' => 260,
        'fadeMs' => 520,
        'explosionAssetUrls' => $explosion_asset_urls,
        'mobileExplosionAssetUrls' => $mobile_explosion_asset_urls,
        'explosionAssetTimeoutMs' => 6500,
        'fallbackStatus' => [
            'online' => (bool) ($site_config['serverOnline'] ?? false),
            'statusLabel' => !empty($site_config['serverOnline']) ? 'Online' : 'Offline',
            'players' => (int) ($site_config['playersOnline'] ?? 0),
            'maxPlayers' => (int) ($site_config['maxPlayers'] ?? 0),
            'queue' => (int) ($site_config['queue'] ?? 0),
            'mapName' => (string) ($site_config['mapName'] ?? 'Unknown'),
            'source' => 'fallback',
            'sourceLabel' => 'site fallback',
        ],
        'tips' => [
            'High-rate wipes reward fast rebuilds as much as first-strike raids.',
            'Keep a flank kit staged before pushing a loaded base.',
            'Thursday wipes are the clean reset: new bases, new grudges, new counters.',
            'A copied connect command is still the fastest backup when Steam links stall.',
        ],
        'lines' => [
            ['level' => 'info', 'text' => 'Initializing Raidlands web uplink...'],
            ['level' => 'info', 'text' => 'Route locked: ' . (string) ($page_meta['title'] ?? 'Raidlands')],
            ['level' => 'info', 'text' => 'Syncing linked Steam session...'],
            [
                'level' => $linked_player !== null ? 'ok' : 'warn',
                'text' => ($linked_player !== null ? '[OK] Authenticated: ' : '[WAIT] ') . $account_label,
            ],
            ['level' => 'info', 'text' => 'Checking store backend...'],
            [
                'level' => $store_ready ? 'ok' : 'warn',
                'text' => $store_ready ? '[OK] Store database configured' : '[SETUP] Store database using setup mode',
            ],
            ['id' => 'server-status', 'level' => 'info', 'text' => 'Connecting to live Rust status feed...', 'wait' => 'server'],
            ['level' => 'info', 'text' => 'Loading wipe schedule...'],
            ['level' => 'ok', 'text' => '[OK] ' . $wipe_days . ' wipe window ' . $wipe_time . ' ' . $wipe_timezone],
            ['id' => 'dom-ready', 'level' => 'info', 'text' => 'Parsing battlefield route...', 'wait' => 'dom', 'successText' => '[OK] Route markup parsed'],
            ['id' => 'window-load', 'level' => 'info', 'text' => 'Loading visual assets...', 'wait' => 'load', 'successText' => '[OK] Visual assets mounted'],
            ['level' => 'info', 'text' => 'Establishing breach route...', 'decorative' => true],
            ['level' => 'info', 'text' => 'Compiling target intel...', 'decorative' => true],
            ['level' => 'info', 'text' => 'Locating enemy silhouettes...', 'decorative' => true],
            ['level' => 'warn', 'text' => 'Target acquired.', 'decorative' => true],
            ['level' => 'warn', 'text' => 'Engaging...', 'decorative' => true],
            ['level' => 'ok', 'text' => '[OK] Raidlands console ready', 'decorative' => true],
        ],
    ];
}

function render_raidlands_loader(array $payload): string
{
    $tip = (string) ($payload['tips'][0] ?? 'Every wipe starts cleaner when your account is linked before checkout.');

    return '<div class="raidlands-loader is-power-cold" data-raidlands-loader role="status" aria-live="polite" aria-label="Raidlands loading console">'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--ground" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--fireball" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-power-overlay" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-frame">'
        . '<div class="raidlands-loader-targeting" data-loader-targeting aria-hidden="true"></div>'
        . '<div class="raidlands-loader-console" aria-hidden="true">'
        . '<div class="raidlands-loader-console-lines" data-loader-console></div>'
        . '</div>'
        . '<div class="raidlands-loader-core">'
        . '<div class="raidlands-loader-progress" aria-hidden="true">'
        . '<span class="raidlands-loader-hud-ring" aria-hidden="true"></span>'
        . '<img class="raidlands-loader-logo" src="' . e((string) $payload['logoUrl']) . '" alt="">'
        . '<span class="raidlands-loader-progress-mark is-top">270</span>'
        . '<span class="raidlands-loader-progress-mark is-right">90</span>'
        . '<span class="raidlands-loader-progress-mark is-bottom">180</span>'
        . '<span class="raidlands-loader-progress-mark is-left">03</span>'
        . '<span class="raidlands-loader-progress-value" data-loader-progress>00</span>'
        . '<span class="raidlands-loader-progress-label">Loading</span>'
        . '<span class="raidlands-loader-progress-route">&gt;&gt;&gt; Breach route &lt;&lt;&lt;</span>'
        . '<span class="raidlands-loader-progress-tip" aria-hidden="true"></span>'
        . '</div>'
        . '<p class="raidlands-loader-state" data-loader-state>Initializing</p>'
        . '<div class="raidlands-loader-tip">'
        . '<span>Wipe intel</span>'
        . '<p data-loader-tip>' . e($tip) . '</p>'
        . '</div>'
        . '</div>'
        . '</div>'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--debris" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--smoke" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--shockwave" aria-hidden="true"></div>'
        . '<div class="raidlands-loader-vfx raidlands-loader-vfx--embers" aria-hidden="true"></div>'
        . '</div>';
}

function raidlands_public_access_label(string $access): string
{
    $clean = trim(str_replace(['_', '-'], ' ', $access));
    $clean = preg_replace('/\s+/', ' ', $clean) ?? $clean;
    $lower = strtolower($clean);

    if (str_starts_with($lower, 'perk ')) {
        $clean = substr($clean, 5);
    } elseif (str_starts_with($lower, 'vip ')) {
        $clean = 'VIP ' . substr($clean, 4);
    }

    $label = ucwords(strtolower($clean));
    return str_replace(['Vip ', ' Rp'], ['VIP ', ' RP'], $label);
}

function status_icon(string $name): string
{
    global $feature_icons, $status_icons;

    if ($name === 'command') {
        return icon_svg($feature_icons['CMD']);
    }

    if ($name === 'fps') {
        return icon_svg($feature_icons['FPS']);
    }

    if ($name === 'queue') {
        return icon_svg($feature_icons['STAT']);
    }

    return icon_svg($status_icons[$name] ?? '');
}

function render_feature_symbol(string $icon): string
{
    global $feature_icon_aliases, $feature_icon_assets, $feature_icons;

    $icon_key = strtoupper($icon);
    $key = $feature_icon_aliases[$icon] ?? $feature_icon_aliases[$icon_key] ?? $icon_key;
    $asset = $feature_icon_assets[$key] ?? null;
    $svg = $feature_icons[$key] ?? null;

    if ($asset !== null) {
        return '<span class="feature-symbol feature-symbol-image" aria-hidden="true"><img src="' . e(asset_url($asset)) . '" alt="" loading="lazy" decoding="async"></span>';
    }

    if ($svg !== null) {
        return '<span class="feature-symbol feature-symbol-svg" aria-hidden="true">' . icon_svg($svg) . '</span>';
    }

    return '<span class="feature-symbol" aria-hidden="true"><span class="feature-symbol-label">' . e($icon) . '</span></span>';
}

function status_class(string $status): string
{
    $normalized = strtolower($status);

    if (str_starts_with($normalized, 'live') || str_contains($normalized, 'active')) {
        return 'live';
    }

    if (str_contains($normalized, 'planned') || str_contains($normalized, 'future') || str_contains($normalized, 'later')) {
        return 'planned';
    }

    if (str_contains($normalized, 'review') || str_contains($normalized, 'next') || str_contains($normalized, 'develop')) {
        return 'review';
    }

    return 'review';
}

function render_card(string $icon, string $title, string $copy, string $extra = ''): string
{
    return '<article class="metal-card">'
        . render_feature_symbol($icon)
        . '<h3>' . e($title) . '</h3>'
        . '<p class="card-copy">' . e($copy) . '</p>'
        . $extra
        . '</article>';
}

function render_feature_card(array $card): string
{
    [$icon, $title, $copy, $status] = $card;
    $extra = '<div class="tag-row"><span class="status-tag ' . e(status_class($status)) . '">' . e($status) . '</span></div>';

    return render_card($icon, $title, $copy, $extra);
}

function render_roadmap_card(array $card): string
{
    [$title, $copy, $status] = $card;

    return '<article class="metal-card roadmap-card">'
        . '<h3>' . e($title) . '</h3>'
        . '<p class="card-copy">' . e($copy) . '</p>'
        . '<div class="tag-row"><span class="status-tag ' . e(status_class($status)) . '">' . e($status) . '</span></div>'
        . '</article>';
}

function render_rule_block(string $title, array $items): string
{
    $list = '';

    foreach ($items as $item) {
        $list .= '<li>' . e($item) . '</li>';
    }

    return '<article class="rule-block">'
        . '<h3>' . e($title) . '</h3>'
        . '<ul class="list-clean">' . $list . '</ul>'
        . '</article>';
}

function render_page_hero(string $key, string $actions = ''): string
{
    global $page_copy, $site_config;

    $meta = $page_copy[$key] ?? $page_copy['home'];
    $action_markup = $actions !== '' ? '<div class="button-row">' . $actions . '</div>' : '';

    return '<section class="page-hero">'
        . '<div class="page-hero-content">'
        . '<img class="page-hero-logo" src="' . e(asset_url('media/raidlands-logo.webp')) . '" alt="">'
        . '<div class="page-hero-copy">'
        . '<p class="eyebrow">' . e($site_config['tagline']) . '</p>'
        . '<h1>' . e($meta['title']) . '</h1>'
        . '<p class="page-lede">' . e($meta['lede']) . '</p>'
        . '</div>'
        . $action_markup
        . '</div>'
        . '</section>';
}

function render_status_panel(): string
{
    global $site_config;

    $status = $site_config['serverOnline'] ? 'Online' : 'Offline';
    $status_class = $site_config['serverOnline'] ? 'is-online' : 'is-offline';

    return '<aside class="status-panel ' . e($status_class) . '" aria-label="Raidlands server status" data-server-status-panel>'
        . '<div class="status-head">'
        . '<span class="online-light" aria-hidden="true" data-server-light></span>'
        . '<strong class="status-title" data-server-status>' . e($status) . '</strong>'
        . '</div>'
        . '<ul class="status-list">'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('players') . '</span><span><span class="status-label">Players: <span class="status-value" data-server-players>' . e((string) $site_config['playersOnline']) . '</span> / <span data-server-max-players>' . e((string) $site_config['maxPlayers']) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('queue') . '</span><span><span class="status-label">Queue: <span class="status-value" data-server-queue>' . e((string) $site_config['queue']) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('health') . '</span><span><span class="status-label">Health: <span class="status-value" data-server-health>' . e($status) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('map') . '</span><span><span class="status-label">Map: <span class="status-value" data-server-map>' . e($site_config['mapName']) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('wipe') . '</span><span><span class="status-label">Next Wipe: <span class="status-value" data-next-wipe>Loading</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('cycle') . '</span><span><span class="status-label">Wipes: <span class="status-value">' . e(implode(' and ', $site_config['wipe']['dayNames'])) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('region') . '</span><span><span class="status-label">Region: <span class="status-value">' . e($site_config['region']) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('cycle') . '</span><span><span class="status-label">Updated: <span class="status-value" data-server-updated>Live lookup pending</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('command') . '</span><span><span class="status-label status-command">Console command: <span class="status-value">' . e($site_config['connectCommand']) . '</span></span></span></li>'
        . '</ul>'
        . '</aside>';
}

function render_quick_features(): string
{
    global $quick_features;

    $items = '';

    foreach ($quick_features as [$icon, $label]) {
        $items .= '<div class="quick-feature">' . render_feature_symbol($icon) . '<span>' . e($label) . '</span></div>';
    }

    return '<div class="quick-feature-wrap" aria-label="Raidlands core features"><div class="quick-feature-grid">' . $items . '</div></div>';
}

function render_wipe_bar(): string
{
    $labels = ['Days', 'Hours', 'Minutes', 'Seconds'];
    $counts = '';

    foreach ($labels as $index => $label) {
        $key = strtolower($label);
        $counts .= '<div class="count-box"><strong data-count-' . e($key) . '>00</strong><span>' . e($label) . '</span></div>';
        if ($index < count($labels) - 1) {
            $counts .= '<span class="count-separator" aria-hidden="true">:</span>';
        }
    }

    return '<div class="wipe-bar">'
        . '<div class="wipe-title">'
        . '<span class="warning-mark" aria-hidden="true">!</span>'
        . '<div><h2>Next Wipe Incoming</h2><p>Prepare. Raid. Repeat.</p></div>'
        . '</div>'
        . '<div class="countdown" data-countdown>' . $counts . '</div>'
        . '</div>';
}

function render_command_box(): string
{
    global $site_config;

    return '<div class="command-box">'
        . '<code>' . e($site_config['connectCommand']) . '</code>'
        . '<button class="btn btn-secondary copy-small" type="button" data-copy-command>Copy</button>'
        . '</div>';
}

function render_join_method_cards(): string
{
    global $site_config;

    return render_card('PLAY', 'Launch Rust and Join', 'Use the Steam connect button for the fastest path into Raidlands.', '<a class="btn btn-primary" href="' . e($site_config['steamConnectUrl']) . '" data-track="join_server_clicked">Launch Rust</a>')
        . render_card('CMD', 'Console Command', 'Open Rust, press F1, paste the command, and press Enter.', render_command_box())
        . render_card('SRCH', 'Server Browser', "Open Rust's modded server browser and search Raidlands.", '<a class="btn btn-secondary" href="' . e(route_url('support')) . '">Need Help?</a>');
}

function render_auth_summary_card(string $provider): string
{
    $linked_player = raidlands_linked_player();
    $label = $provider === 'steam' ? 'Steam' : 'Discord';
    $icon = $provider === 'steam' ? 'STM' : 'DSC';
    $copy = $linked_player !== null
        ? ($provider === 'steam'
            ? 'Your Steam account is connected. Use your account page for profile, stats, and VIP access.'
            : 'Your Raidlands account is ready. Discord connection can be added later.')
        : ($provider === 'steam'
            ? 'Connect Steam for profiles, leaderboards, rewards, and VIP ownership.'
            : 'Prepare for wipe alerts, support, and community roles.');
    $button_class = $provider === 'steam' ? 'btn-steam' : 'btn-discord';
    $title = $linked_player !== null
        ? ($provider === 'steam' ? 'Steam Linked' : 'Discord Coming Soon')
        : 'Link ' . $label;

    if ($linked_player !== null) {
        $extra = '<a class="btn ' . e($button_class) . '" href="' . e(route_url('profile')) . '">View Account</a>';
    } else {
        $extra = $provider === 'steam'
            ? '<a class="btn ' . e($button_class) . '" href="' . e(route_url('link') . '?action=steam') . '">Link ' . e($label) . '</a>'
            : '<button class="btn ' . e($button_class) . '" type="button" data-auth-provider="' . e($provider) . '">Link ' . e($label) . '</button>';
    }

    return render_card($icon, $title, $copy, $extra);
}

function render_auth_card(string $provider): string
{
    $linked_player = raidlands_linked_player();
    $label = $provider === 'steam' ? 'Steam' : 'Discord';
    $icon = $provider === 'steam' ? 'STM' : 'DSC';
    $button_class = $provider === 'steam' ? 'btn-steam' : 'btn-discord';
    $benefits = $provider === 'steam'
        ? ['Keep VIP tied to you.', 'Prepare for leaderboards.', 'Keep rewards with your profile.', 'Help prevent impersonation.']
        : ['Get wipe alerts.', 'Join support faster.', 'Prepare for Discord roles.', 'Stay connected with the community.'];
    $list = '';

    foreach ($benefits as $benefit) {
        $list .= '<li>' . e($benefit) . '</li>';
    }

    $status = $linked_player !== null
        ? ($provider === 'steam'
            ? 'Steam ID ' . (string) $linked_player['steam_id64'] . ' is connected on this browser.'
            : $label . ' connection is not live yet. Your account page is ready for Steam access.')
        : ($provider === 'steam'
            ? 'Use Steam sign-in to confirm account ownership before linking.'
            : $label . ' connection is not live yet.');
    $link_button = $linked_player !== null
        ? '<a class="btn ' . e($button_class) . '" href="' . e(route_url('profile')) . '">View Account</a>'
        : ($provider === 'steam'
            ? '<a class="btn ' . e($button_class) . '" href="' . e(route_url('link') . '?action=steam') . '">Link ' . e($label) . '</a>'
            : '<button class="btn ' . e($button_class) . '" type="button" data-auth-provider="' . e($provider) . '">Link ' . e($label) . '</button>');
    $status_class = $linked_player !== null ? ' is-linked' : '';
    $status_lead = $linked_player !== null ? 'Ready.' : 'Not connected.';

    return '<article class="metal-panel auth-card">'
        . render_feature_symbol($icon)
        . '<h2>' . e($label) . '</h2>'
        . '<div class="auth-status' . $status_class . '"><strong>' . e($status_lead) . '</strong> ' . e($status) . '</div>'
        . '<ul class="list-clean">' . $list . '</ul>'
        . '<div class="button-row">'
        . $link_button
        . '<button class="btn btn-ghost" type="button" data-unlink-provider="' . e($provider) . '">Unlink</button>'
        . '</div>'
        . '</article>';
}
