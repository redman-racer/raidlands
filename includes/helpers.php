<?php

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function asset_url(string $path): string
{
    global $base_path;

    return $base_path . 'assets/' . ltrim($path, '/');
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

function status_icon(string $name): string
{
    global $feature_icons, $status_icons;

    if ($name === 'command') {
        return icon_svg($feature_icons['CMD']);
    }

    return icon_svg($status_icons[$name] ?? '');
}

function render_feature_symbol(string $icon): string
{
    global $feature_icon_aliases, $feature_icons;

    $key = $feature_icon_aliases[$icon] ?? $icon;
    $svg = $feature_icons[$key] ?? null;

    if ($svg !== null) {
        return '<span class="feature-symbol feature-symbol-svg" aria-hidden="true">' . icon_svg($svg) . '</span>';
    }

    return '<span class="feature-symbol" aria-hidden="true"><span class="feature-symbol-label">' . e($icon) . '</span></span>';
}

function status_class(string $status): string
{
    if ($status === 'Launch target') {
        return 'review';
    }

    if ($status === 'Planned') {
        return 'planned';
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
        . '<div class="tag-row"><span class="status-tag planned">' . e($status) . '</span></div>'
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

    return '<aside class="status-panel" aria-label="Raidlands server status">'
        . '<div class="status-head">'
        . '<span class="online-light" aria-hidden="true"></span>'
        . '<strong class="status-title">' . e($status) . '</strong>'
        . '</div>'
        . '<ul class="status-list">'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('players') . '</span><span><span class="status-label">Players: <span class="status-value">' . e((string) $site_config['playersOnline']) . '</span> / ' . e((string) $site_config['maxPlayers']) . '</span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('map') . '</span><span><span class="status-label">Map: <span class="status-value">' . e($site_config['mapName']) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('wipe') . '</span><span><span class="status-label">Next Wipe: <span class="status-value" data-next-wipe>Loading</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('cycle') . '</span><span><span class="status-label">Wipes: <span class="status-value">' . e(implode(' and ', $site_config['wipe']['dayNames'])) . '</span></span></span></li>'
        . '<li class="status-row"><span class="row-icon" aria-hidden="true">' . status_icon('region') . '</span><span><span class="status-label">Region: <span class="status-value">' . e($site_config['region']) . '</span></span></span></li>'
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

    foreach ($labels as $label) {
        $key = strtolower($label);
        $counts .= '<div class="count-box"><strong data-count-' . e($key) . '>00</strong><span>' . e($label) . '</span></div>';
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
    $label = $provider === 'steam' ? 'Steam' : 'Discord';
    $icon = $provider === 'steam' ? 'STM' : 'DSC';
    $copy = $provider === 'steam'
        ? 'Prepare for SteamID64 backed profiles, leaderboards, rewards, and ownership.'
        : 'Prepare for wipe alerts, guild membership checks, support context, and roles.';
    $button_class = $provider === 'steam' ? 'btn-steam' : 'btn-discord';
    $extra = '<button class="btn ' . e($button_class) . '" type="button" data-auth-provider="' . e($provider) . '">Link ' . e($label) . '</button>';

    return render_card($icon, 'Link ' . $label, $copy, $extra);
}

function render_auth_card(string $provider): string
{
    $label = $provider === 'steam' ? 'Steam' : 'Discord';
    $icon = $provider === 'steam' ? 'STM' : 'DSC';
    $button_class = $provider === 'steam' ? 'btn-steam' : 'btn-discord';
    $benefits = $provider === 'steam'
        ? ['Prepare for leaderboards.', 'Prepare for rewards.', 'Connect profile identity.', 'Reduce impersonation.']
        : ['Get wipe alerts.', 'Verify community membership.', 'Prepare for Discord roles.', 'Access support context.'];
    $list = '';

    foreach ($benefits as $benefit) {
        $list .= '<li>' . e($benefit) . '</li>';
    }

    return '<article class="metal-panel auth-card">'
        . render_feature_symbol($icon)
        . '<h2>' . e($label) . '</h2>'
        . '<div class="auth-status"><strong>Not linked.</strong> OAuth is ready to connect once the ' . e($label) . ' credentials are configured.</div>'
        . '<ul class="list-clean">' . $list . '</ul>'
        . '<div class="button-row">'
        . '<button class="btn ' . e($button_class) . '" type="button" data-auth-provider="' . e($provider) . '">Link ' . e($label) . '</button>'
        . '<button class="btn btn-ghost" type="button" data-unlink-provider="' . e($provider) . '">Unlink</button>'
        . '</div>'
        . '</article>';
}
