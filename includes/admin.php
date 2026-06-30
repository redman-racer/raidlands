<?php

require_once __DIR__ . '/store.php';

function raidlands_admin_boot(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name('raidlands_admin');
        session_start();
    }
}

function raidlands_admin_handle_request(): void
{
    raidlands_admin_boot();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }

    $action = (string) ($_POST['action'] ?? '');
    $section = raidlands_admin_clean_section($_POST['section'] ?? ($_GET['section'] ?? 'identity'));

    if ($action === 'login') {
        raidlands_admin_handle_login();
    }

    if (!raidlands_admin_is_authenticated()) {
        raidlands_admin_set_flash('error', 'Sign in before changing site settings.');
        raidlands_admin_redirect($section);
    }

    if (!raidlands_admin_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        raidlands_admin_set_flash('error', 'Your session token expired. Try again.');
        raidlands_admin_redirect($section);
    }

    if ($action === 'logout') {
        raidlands_admin_logout();
        raidlands_admin_set_flash('success', 'Signed out.');
        raidlands_admin_redirect();
    }

    if ($action === 'save') {
        try {
            if ($section === 'store') {
                raidlands_store_admin_save_product_rows($_POST['store_products'] ?? []);
                raidlands_admin_set_flash('success', 'Store products saved.');
            } elseif ($section === 'grants') {
                $ends_at = trim((string) ($_POST['ends_at'] ?? ''));
                raidlands_store_admin_manual_grant(
                    (string) ($_POST['steam_id64'] ?? ''),
                    (int) ($_POST['product_id'] ?? 0),
                    $ends_at === '' ? null : $ends_at
                );
                raidlands_admin_set_flash('success', 'Manual entitlement granted.');
            } else {
                raidlands_admin_save_content(raidlands_admin_build_content_from_post($_POST, $section));
                raidlands_admin_set_flash('success', 'Site settings saved.');
            }
        } catch (Throwable $error) {
            raidlands_admin_set_flash('error', 'Settings could not be saved: ' . $error->getMessage());
        }

        raidlands_admin_redirect($section);
    }

    raidlands_admin_redirect($section);
}

function raidlands_admin_handle_login(): void
{
    $section = raidlands_admin_clean_section($_POST['section'] ?? 'identity');

    if (!raidlands_admin_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        raidlands_admin_set_flash('error', 'Your session token expired. Try again.');
        raidlands_admin_redirect($section);
    }

    $username = (string) ($_POST['username'] ?? '');
    $password = (string) ($_POST['password'] ?? '');

    if (raidlands_admin_verify_credentials($username, $password)) {
        session_regenerate_id(true);
        $_SESSION[raidlands_admin_session_key()] = true;
        raidlands_admin_set_flash('success', 'Signed in.');
        raidlands_admin_redirect($section);
    }

    raidlands_admin_set_flash('error', 'The admin username or password was not accepted.');
    raidlands_admin_redirect($section);
}

function raidlands_admin_verify_credentials(string $username, string $password): bool
{
    global $admin_panel;

    $expected_username = (string) ($admin_panel['username'] ?? '');
    $password_hash = (string) ($admin_panel['passwordHash'] ?? '');
    $expected_password = (string) ($admin_panel['password'] ?? '');

    if ($expected_username === '' || !hash_equals($expected_username, $username)) {
        return false;
    }

    if ($password_hash !== '') {
        return password_verify($password, $password_hash);
    }

    return $expected_password !== '' && hash_equals($expected_password, $password);
}

function raidlands_admin_is_authenticated(): bool
{
    raidlands_admin_boot();

    return !empty($_SESSION[raidlands_admin_session_key()]);
}

function raidlands_admin_logout(): void
{
    unset($_SESSION[raidlands_admin_session_key()]);
    unset($_SESSION['raidlands_admin_csrf']);
}

function raidlands_admin_session_key(): string
{
    global $admin_panel;

    return (string) ($admin_panel['sessionKey'] ?? 'raidlands_admin_authenticated');
}

function raidlands_admin_csrf_token(): string
{
    raidlands_admin_boot();

    if (empty($_SESSION['raidlands_admin_csrf'])) {
        $_SESSION['raidlands_admin_csrf'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['raidlands_admin_csrf'];
}

function raidlands_admin_validate_csrf(string $token): bool
{
    raidlands_admin_boot();

    return $token !== '' && hash_equals((string) ($_SESSION['raidlands_admin_csrf'] ?? ''), $token);
}

function raidlands_admin_set_flash(string $type, string $message): void
{
    raidlands_admin_boot();
    $_SESSION['raidlands_admin_flash'] = [
        'type' => $type,
        'message' => $message,
    ];
}

function raidlands_admin_take_flash(): ?array
{
    raidlands_admin_boot();

    $flash = $_SESSION['raidlands_admin_flash'] ?? null;
    unset($_SESSION['raidlands_admin_flash']);

    return is_array($flash) ? $flash : null;
}

function raidlands_admin_redirect(?string $section = null): void
{
    $target = (string) ($_SERVER['REQUEST_URI'] ?? './');
    $target = strtok($target, '?') ?: './';
    $section = $section === null ? null : raidlands_admin_clean_section($section);

    if ($section !== null && $section !== 'identity') {
        $target .= '?section=' . rawurlencode($section);
    }

    header('Location: ' . $target, true, 303);
    exit;
}

function raidlands_admin_section_keys(): array
{
    return ['identity', 'links', 'wipe', 'features', 'pages', 'seo', 'store', 'grants', 'sync'];
}

function raidlands_admin_clean_section($section): string
{
    $section = strtolower((string) $section);

    return in_array($section, raidlands_admin_section_keys(), true) ? $section : 'identity';
}

function raidlands_admin_current_content(): array
{
    global $site_config, $quick_features, $feature_cards, $roadmap_cards, $page_copy, $seo_pages;

    return [
        'site_config' => $site_config,
        'quick_features' => $quick_features,
        'feature_cards' => $feature_cards,
        'roadmap_cards' => $roadmap_cards,
        'page_copy' => $page_copy,
        'seo_pages' => $seo_pages,
    ];
}

function raidlands_admin_build_content_from_post(array $post, string $section = 'identity'): array
{
    global $page_copy, $seo_pages;

    $section = raidlands_admin_clean_section($section);
    $content = raidlands_admin_current_content();
    $site_input = raidlands_admin_array($post['site_config'] ?? []);
    $stats_input = raidlands_admin_array($site_input['serverStats'] ?? []);
    $wipe_input = raidlands_admin_array($site_input['wipe'] ?? []);
    $auth_input = raidlands_admin_array($site_input['auth'] ?? []);

    if ($section === 'identity') {
        $content['site_config']['serverName'] = raidlands_admin_clean_text($site_input['serverName'] ?? '', 120);
        $content['site_config']['tagline'] = raidlands_admin_clean_text($site_input['tagline'] ?? '', 160);
        $content['site_config']['region'] = raidlands_admin_clean_text($site_input['region'] ?? '', 80);
        $content['site_config']['mapName'] = raidlands_admin_clean_text($site_input['mapName'] ?? '', 120);
        $content['site_config']['serverFps'] = raidlands_admin_clean_text($site_input['serverFps'] ?? '', 40);
        $content['site_config']['queue'] = (string) raidlands_admin_int($site_input['queue'] ?? 0, 0, 9999);
        $content['site_config']['playersOnline'] = raidlands_admin_int($site_input['playersOnline'] ?? 0, 0, 9999);
        $content['site_config']['maxPlayers'] = raidlands_admin_int($site_input['maxPlayers'] ?? 0, 1, 9999);
        $content['site_config']['serverOnline'] = !empty($site_input['serverOnline']);
    }

    if ($section === 'links') {
        $content['site_config']['connectCommand'] = raidlands_admin_clean_text($site_input['connectCommand'] ?? '', 180);
        $content['site_config']['steamConnectUrl'] = raidlands_admin_clean_text($site_input['steamConnectUrl'] ?? '', 240);
        $content['site_config']['discordInviteUrl'] = raidlands_admin_clean_text($site_input['discordInviteUrl'] ?? '', 240);
        $content['site_config']['serverStats'] = [
            'provider' => raidlands_admin_clean_text($stats_input['provider'] ?? 'battlemetrics', 40),
            'battleMetricsServerId' => preg_replace('/\D+/', '', (string) ($stats_input['battleMetricsServerId'] ?? '')),
            'cacheSeconds' => raidlands_admin_int($stats_input['cacheSeconds'] ?? 60, 30, 3600),
        ];
        $content['site_config']['auth'] = [
            'steamUrl' => raidlands_admin_clean_text($auth_input['steamUrl'] ?? '', 240),
            'discordUrl' => raidlands_admin_clean_text($auth_input['discordUrl'] ?? '', 240),
        ];
    }

    if ($section === 'wipe') {
        $wipe_days = raidlands_admin_wipe_days($wipe_input['days'] ?? []);
        $content['site_config']['wipe'] = [
            'days' => $wipe_days,
            'dayNames' => raidlands_admin_wipe_day_names($wipe_days),
            'time' => raidlands_admin_time($wipe_input['time'] ?? '19:00'),
            'timezone' => raidlands_admin_clean_text($wipe_input['timezone'] ?? 'America/Chicago', 80),
        ];
    }

    if ($section === 'features') {
        $content['quick_features'] = raidlands_admin_parse_quick_feature_rows($post['quick_features_rows'] ?? []);
        $content['feature_cards'] = raidlands_admin_parse_feature_card_rows($post['feature_cards_rows'] ?? []);
        $content['roadmap_cards'] = raidlands_admin_parse_roadmap_rows($post['roadmap_cards_rows'] ?? []);
    }

    if ($section === 'pages') {
        $content['page_copy'] = [];
        $page_input = raidlands_admin_array($post['page_copy'] ?? []);

        foreach ($page_copy as $key => $defaults) {
            $row = raidlands_admin_array($page_input[$key] ?? []);
            $content['page_copy'][$key] = [
                'title' => raidlands_admin_clean_text($row['title'] ?? ($defaults['title'] ?? ''), 160),
                'lede' => raidlands_admin_clean_text($row['lede'] ?? ($defaults['lede'] ?? ''), 500),
            ];
        }
    }

    if ($section === 'seo') {
        $content['seo_pages'] = [];
        $seo_input = raidlands_admin_array($post['seo_pages'] ?? []);

        foreach ($seo_pages as $key => $defaults) {
            $row = raidlands_admin_array($seo_input[$key] ?? []);
            $content['seo_pages'][$key] = [
                'title' => raidlands_admin_clean_text($row['title'] ?? ($defaults['title'] ?? ''), 180),
                'description' => raidlands_admin_clean_text($row['description'] ?? ($defaults['description'] ?? ''), 320),
                'ogTitle' => raidlands_admin_clean_text($row['ogTitle'] ?? ($defaults['ogTitle'] ?? ''), 180),
                'ogDescription' => raidlands_admin_clean_text($row['ogDescription'] ?? ($defaults['ogDescription'] ?? ''), 320),
            ];
        }
    }

    return $content;
}

function raidlands_admin_save_content(array $content): void
{
    global $raidlands_content_file;

    $target = (string) $raidlands_content_file;
    $directory = dirname($target);

    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('The data directory could not be created.');
    }

    $json = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        throw new RuntimeException('The settings could not be encoded as JSON.');
    }

    if (file_put_contents($target, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('The content file is not writable.');
    }
}

function raidlands_admin_default_password_is_active(): bool
{
    global $admin_panel;

    return (string) ($admin_panel['passwordHash'] ?? '') === ''
        && (string) ($admin_panel['password'] ?? '') === 'change-me';
}

function raidlands_admin_array($value): array
{
    return is_array($value) ? $value : [];
}

function raidlands_admin_clean_text($value, int $max_length = 500): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_admin_int($value, int $min, int $max): int
{
    $number = is_numeric($value) ? (int) $value : $min;

    return max($min, min($max, $number));
}

function raidlands_admin_time($value): string
{
    $time = raidlands_admin_clean_text($value, 5);

    if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
        return '19:00';
    }

    [$hour, $minute] = array_map('intval', explode(':', $time));

    if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
        return '19:00';
    }

    return sprintf('%02d:%02d', $hour, $minute);
}

function raidlands_admin_wipe_days($value): array
{
    $days = [];

    foreach ((array) $value as $day) {
        $day = raidlands_admin_int($day, 0, 6);

        if (!in_array($day, $days, true)) {
            $days[] = $day;
        }
    }

    sort($days);

    return $days === [] ? [4] : $days;
}

function raidlands_admin_wipe_day_names(array $days): array
{
    $names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    $result = [];

    foreach ($days as $day) {
        $result[] = $names[(int) $day] ?? 'Thursday';
    }

    return $result;
}

function raidlands_admin_parse_pipe_rows(string $input, int $columns): array
{
    $rows = [];
    $lines = preg_split('/\R/', $input) ?: [];

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '') {
            continue;
        }

        $parts = array_map(
            static fn ($part) => raidlands_admin_clean_text($part, 700),
            explode('|', $line, $columns)
        );

        if (count($parts) !== $columns || implode('', $parts) === '') {
            continue;
        }

        $rows[] = $parts;
    }

    return $rows;
}

function raidlands_admin_parse_quick_feature_rows($input): array
{
    $rows = [];

    foreach ((array) $input as $row) {
        $row = raidlands_admin_array($row);

        if (!empty($row['delete'])) {
            continue;
        }

        $icon = strtoupper(raidlands_admin_clean_text($row['icon'] ?? '', 24));
        $label = raidlands_admin_clean_text($row['label'] ?? '', 80);

        if ($icon === '' && $label === '') {
            continue;
        }

        $rows[] = [$icon, $label];
    }

    return $rows;
}

function raidlands_admin_parse_feature_card_rows($input): array
{
    $rows = [];

    foreach ((array) $input as $row) {
        $row = raidlands_admin_array($row);

        if (!empty($row['delete'])) {
            continue;
        }

        $icon = strtoupper(raidlands_admin_clean_text($row['icon'] ?? '', 24));
        $title = raidlands_admin_clean_text($row['title'] ?? '', 120);
        $copy = raidlands_admin_clean_text($row['copy'] ?? '', 360);
        $status = raidlands_admin_clean_text($row['status'] ?? '', 80);

        if ($icon === '' && $title === '' && $copy === '' && $status === '') {
            continue;
        }

        $rows[] = [$icon, $title, $copy, $status];
    }

    return $rows;
}

function raidlands_admin_parse_roadmap_rows($input): array
{
    $rows = [];

    foreach ((array) $input as $row) {
        $row = raidlands_admin_array($row);

        if (!empty($row['delete'])) {
            continue;
        }

        $title = raidlands_admin_clean_text($row['title'] ?? '', 120);
        $copy = raidlands_admin_clean_text($row['copy'] ?? '', 360);
        $status = raidlands_admin_clean_text($row['status'] ?? '', 80);

        if ($title === '' && $copy === '' && $status === '') {
            continue;
        }

        $rows[] = [$title, $copy, $status];
    }

    return $rows;
}

function raidlands_admin_format_pipe_rows(array $rows): string
{
    $lines = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $lines[] = implode(' | ', array_map('strval', $row));
    }

    return implode("\n", $lines);
}
