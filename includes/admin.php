<?php

require_once __DIR__ . '/store.php';
require_once __DIR__ . '/feedback.php';
require_once __DIR__ . '/features.php';
require_once __DIR__ . '/kits.php';
require_once __DIR__ . '/permissions.php';

function raidlands_admin_boot(): void
{
    raidlands_store_boot();
}

function raidlands_admin_handle_request(): void
{
    raidlands_admin_boot();
    $section = raidlands_admin_clean_section($_POST['section'] ?? ($_GET['section'] ?? 'identity'));

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ((string) ($_GET['action'] ?? '') === 'steam') {
            try {
                header('Location: ' . raidlands_store_steam_openid_url('admin'));
                exit;
            } catch (Throwable $error) {
                raidlands_admin_set_flash('error', 'Steam sign-in could not start. Try again from the admin sign-in screen.');
                raidlands_admin_redirect($section);
            }
        }

        if (raidlands_store_steam_openid_response_present()) {
            try {
                $player = raidlands_store_steam_openid_verify();
                raidlands_admin_complete_steam_login($player);
            } catch (Throwable $error) {
                raidlands_admin_set_flash('error', $error->getMessage());
            }

            raidlands_admin_redirect($section);
        }

        return;
    }

    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'login') {
        raidlands_admin_handle_login();
    }

    if ($action === 'logout') {
        if (!raidlands_admin_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            raidlands_admin_set_flash('error', 'Your session token expired. Try again.');
            raidlands_admin_redirect($section);
        }

        raidlands_admin_audit('logout', 'admin_session', '');
        raidlands_admin_logout();
        raidlands_admin_set_flash('success', 'Signed out.');
        raidlands_admin_redirect($section);
    }

    if (!raidlands_admin_is_authenticated()) {
        raidlands_admin_set_flash('error', 'Sign in with an approved Steam account before changing site settings.');
        raidlands_admin_redirect($section);
    }

    if (!raidlands_admin_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        raidlands_admin_set_flash('error', 'Your session token expired. Try again.');
        raidlands_admin_redirect($section);
    }

    if ($action === 'save') {
        if (!raidlands_admin_can_save_section($section)) {
            raidlands_admin_set_flash('error', 'Your admin role cannot save that section.');
            raidlands_admin_redirect($section);
        }

        $redirect_params = [];

        try {
            if ($section === 'store') {
                $store_rows = $_POST['store_products'] ?? [];

                raidlands_store_admin_save_product_rows($store_rows);
                $stripe_sync = raidlands_store_admin_sync_stripe_catalog();
                $stripe_summary = raidlands_store_admin_stripe_sync_summary_text($stripe_sync);
                $stripe_errors = array_slice((array) ($stripe_sync['errors'] ?? []), 0, 3);

                if (!empty($stripe_sync['skipped'])) {
                    raidlands_admin_set_flash('warning', 'Store products saved. ' . $stripe_summary);
                } elseif (empty($stripe_sync['ok'])) {
                    $error_suffix = $stripe_errors === [] ? '' : ' ' . implode(' ', $stripe_errors);
                    raidlands_admin_set_flash('warning', 'Store products saved, but some Stripe catalog rows need attention. ' . $stripe_summary . $error_suffix);
                } else {
                    raidlands_admin_set_flash('success', 'Store products saved. ' . $stripe_summary);
                }
            } elseif ($section === 'features') {
                raidlands_admin_set_flash('success', raidlands_features_admin_save($_POST));
            } elseif ($section === 'kits') {
                $result = raidlands_kits_admin_save($_POST, $_FILES ?? []);
                if (!empty($result['published'])) {
                    raidlands_permissions_publish_from_related_change('Published permission sync for kit revision ' . $result['revision'] . '.');
                }
                $message = $result['published']
                    ? 'Kit revision ' . $result['revision'] . ' published for server sync.'
                    : 'Kit draft saved.';
                raidlands_admin_set_flash('success', $message);
            } elseif ($section === 'groups') {
                $result = raidlands_permissions_admin_save($_POST);
                $message = $result['published']
                    ? 'Group permission revision ' . $result['revision'] . ' published for server sync.'
                    : 'Group permission draft saved.';
                raidlands_admin_set_flash('success', $message);
            } elseif ($section === 'grants') {
                $result = raidlands_admin_handle_grants_action($_POST);
                $redirect_params = $result['redirect'] ?? [];
                raidlands_admin_set_flash('success', (string) ($result['message'] ?? 'Player access updated.'));
            } elseif ($section === 'feedback') {
                $updated = raidlands_feedback_admin_save_rows($_POST['feedback_rows'] ?? []);
                $feedback_admin_action = (string) ($_POST['feedback_admin_action'] ?? '');

                if ($feedback_admin_action === 'ai_process_unchecked') {
                    $unchecked = raidlands_ai_unchecked_count('feedback');
                    $conversion_message = raidlands_ai_batch_message('feedback item' . ($unchecked === 1 ? '' : 's'), raidlands_ai_process_feedback_batch());
                } else {
                    $conversion_message = raidlands_features_admin_handle_feedback_action($_POST);
                }

                $feedback_message = $updated === 0
                    ? 'No feedback items changed.'
                    : ($updated === 1 ? 'Feedback item updated.' : $updated . ' feedback items updated.');
                $message = $conversion_message !== ''
                    ? trim(($updated > 0 ? $feedback_message . ' ' : '') . $conversion_message)
                    : $feedback_message;
                raidlands_admin_set_flash('success', $message);
            } else {
                raidlands_admin_save_content(raidlands_admin_build_content_from_post($_POST, $section));
                raidlands_admin_set_flash('success', 'Site settings saved.');
            }

            raidlands_admin_audit('save_' . $section, 'admin_section', $section);
        } catch (Throwable $error) {
            if ($section === 'grants') {
                $steam_id64 = raidlands_store_normalize_steam_id64($_POST['steam_id64'] ?? '');

                if ($steam_id64 !== '') {
                    $redirect_params['steam_id64'] = $steam_id64;
                }
            }

            raidlands_admin_set_flash('error', 'Settings could not be saved: ' . $error->getMessage());
        }

        raidlands_admin_redirect($section, $redirect_params);
    }

    raidlands_admin_redirect($section);
}

function raidlands_admin_handle_grants_action(array $post): array
{
    $grant_action = (string) ($post['grant_action'] ?? '');
    $steam_id64 = raidlands_store_normalize_steam_id64($post['steam_id64'] ?? '');
    $redirect = [];

    if ($steam_id64 !== '') {
        $redirect['steam_id64'] = $steam_id64;
    }

    if ($grant_action === '') {
        $grant_action = 'grant_product';
    }

    if ($grant_action === 'load_player') {
        if (!raidlands_store_validate_steam_id64($steam_id64)) {
            throw new InvalidArgumentException('Enter a valid SteamID64 to load player access.');
        }

        return [
            'message' => 'Loaded player access for ' . $steam_id64 . '.',
            'redirect' => $redirect,
        ];
    }

    $actor = '';
    $admin_user = raidlands_admin_current_user();

    if ($admin_user !== null && !empty($admin_user['steam_id64'])) {
        $actor = (string) $admin_user['steam_id64'];
    }

    if ($grant_action === 'grant_product') {
        $ends_at = raidlands_store_normalize_admin_datetime($post['product_ends_at'] ?? ($post['ends_at'] ?? ''), 'Product grant end date');
        $note = raidlands_store_clean_admin_note($post['product_admin_note'] ?? '');
        $result = raidlands_store_admin_grant_product_access(
            $steam_id64,
            (int) ($post['product_id'] ?? 0),
            $ends_at
        );
        $product = $result['product'] ?? [];
        $groups = (array) ($result['groups'] ?? []);

        raidlands_admin_audit('grant_product_access', 'player', $steam_id64, [
            'product_id' => (int) ($product['id'] ?? 0),
            'product_name' => (string) ($product['name'] ?? ''),
            'entitlement_id' => (int) ($result['entitlement_id'] ?? 0),
            'groups' => $groups,
            'ends_at' => $ends_at,
            'note' => $note,
        ]);

        return [
            'message' => 'Granted ' . (string) ($product['name'] ?? 'product access') . ' to ' . $steam_id64 . '.',
            'redirect' => $redirect,
        ];
    }

    if ($grant_action === 'grant_direct_groups') {
        $ends_at = raidlands_store_normalize_admin_datetime($post['group_ends_at'] ?? '', 'Group grant end date');
        $note = raidlands_store_clean_admin_note($post['group_admin_note'] ?? '');
        $result = raidlands_store_admin_grant_direct_groups(
            $steam_id64,
            (array) ($post['direct_groups'] ?? []),
            $ends_at,
            $note,
            $actor
        );
        $groups = (array) ($result['groups'] ?? []);

        raidlands_admin_audit('grant_direct_groups', 'player', $steam_id64, [
            'groups' => $groups,
            'ends_at' => $ends_at,
            'note' => $note,
        ]);

        return [
            'message' => 'Added ' . count($groups) . ' direct group' . (count($groups) === 1 ? '' : 's') . ' to ' . $steam_id64 . '.',
            'redirect' => $redirect,
        ];
    }

    if (str_starts_with($grant_action, 'revoke_manual_entitlement:')) {
        $entitlement_id = (int) substr($grant_action, strlen('revoke_manual_entitlement:'));
        $row = raidlands_store_admin_revoke_manual_entitlement($entitlement_id, $steam_id64);
        $steam_id64 = (string) ($row['steam_id64'] ?? $steam_id64);
        $redirect['steam_id64'] = $steam_id64;

        raidlands_admin_audit('revoke_manual_entitlement', 'player', $steam_id64, [
            'entitlement_id' => $entitlement_id,
            'product_id' => (int) ($row['product_id'] ?? 0),
            'product_name' => (string) ($row['product_name'] ?? ''),
        ]);

        return [
            'message' => 'Revoked manual product access for ' . $steam_id64 . '.',
            'redirect' => $redirect,
        ];
    }

    if (str_starts_with($grant_action, 'revoke_direct_group:')) {
        $assignment_id = (int) substr($grant_action, strlen('revoke_direct_group:'));
        $row = raidlands_store_admin_revoke_direct_group($assignment_id, $steam_id64, $actor);
        $steam_id64 = (string) ($row['steam_id64'] ?? $steam_id64);
        $redirect['steam_id64'] = $steam_id64;

        raidlands_admin_audit('revoke_direct_group', 'player', $steam_id64, [
            'assignment_id' => $assignment_id,
            'group_name' => (string) ($row['group_name'] ?? ''),
        ]);

        return [
            'message' => 'Revoked direct group ' . (string) ($row['group_name'] ?? '') . ' for ' . $steam_id64 . '.',
            'redirect' => $redirect,
        ];
    }

    throw new InvalidArgumentException('Choose a player access action.');
}

function raidlands_admin_handle_login(): void
{
    $section = raidlands_admin_clean_section($_POST['section'] ?? 'identity');

    if (raidlands_admin_auth_tables_ready()) {
        raidlands_admin_set_flash('error', 'Use Steam sign-in for admin access. Username and password login is only available before the admin auth tables are installed.');
        raidlands_admin_redirect($section);
    }

    if (!raidlands_admin_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        raidlands_admin_set_flash('error', 'Your session token expired. Try again.');
        raidlands_admin_redirect($section);
    }

    $username = (string) ($_POST['username'] ?? '');
    $password = (string) ($_POST['password'] ?? '');

    if (raidlands_admin_verify_credentials($username, $password)) {
        session_regenerate_id(true);
        $_SESSION[raidlands_admin_session_key()] = true;
        raidlands_admin_set_flash('success', 'Signed in with setup credentials.');
        raidlands_admin_audit('legacy_login', 'admin_session', '');
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

function raidlands_admin_complete_steam_login(array $player): void
{
    if (empty($player['steam_id64']) || !raidlands_store_validate_steam_id64((string) $player['steam_id64'])) {
        raidlands_admin_set_flash('error', 'Steam did not return a valid account for admin access.');
        return;
    }

    if (!raidlands_admin_auth_tables_ready()) {
        raidlands_admin_set_flash('warning', 'Steam account connected, but admin auth tables are not installed yet. Run database/migrations/007_admin_auth.sql, then approve the SteamID64.');
        return;
    }

    $user = raidlands_admin_current_user(true);

    if ($user === null) {
        raidlands_admin_set_flash('error', 'Steam ID ' . (string) $player['steam_id64'] . ' is not approved for admin access.');
        return;
    }

    raidlands_db_execute(
        'UPDATE admin_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = :id',
        ['id' => (int) $user['id']]
    );
    raidlands_admin_audit('steam_login', 'admin_user', (string) $user['steam_id64']);
    raidlands_admin_set_flash('success', 'Signed in with Steam.');
}

function raidlands_admin_is_authenticated(): bool
{
    raidlands_admin_boot();

    if (raidlands_admin_current_user() !== null) {
        return true;
    }

    return !raidlands_admin_auth_tables_ready()
        && !empty($_SESSION[raidlands_admin_session_key()]);
}

function raidlands_admin_logout(): void
{
    unset($_SESSION[raidlands_admin_session_key()]);
    unset($_SESSION['raidlands_admin_csrf']);
    unset($_SESSION['raidlands_admin_flash']);
    raidlands_store_unlink_player();
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

function raidlands_admin_redirect(?string $section = null, array $params = []): void
{
    $target = (string) ($_SERVER['REQUEST_URI'] ?? './');
    $target = strtok($target, '?') ?: './';
    $section = $section === null ? null : raidlands_admin_clean_section($section);
    $query = [];

    if ($section !== null && $section !== 'identity') {
        $query['section'] = $section;
    }

    foreach ($params as $key => $value) {
        $value = trim((string) $value);

        if ($value !== '') {
            $query[$key] = $value;
        }
    }

    if ($query !== []) {
        $target .= '?' . http_build_query($query);
    }

    header('Location: ' . $target, true, 303);
    exit;
}

function raidlands_admin_section_keys(): array
{
    return ['identity', 'links', 'wipe', 'features', 'pages', 'seo', 'feedback', 'store', 'kits', 'groups', 'grants', 'sync'];
}

function raidlands_admin_allowed_section_keys(): array
{
    return array_values(array_filter(
        raidlands_admin_section_keys(),
        static fn (string $section): bool => raidlands_admin_can_view_section($section)
    ));
}

function raidlands_admin_section_permission(string $section): string
{
    return match (raidlands_admin_clean_section($section)) {
        'feedback' => 'admin.feedback.manage',
        'store' => 'admin.store.manage',
        'kits' => 'admin.kits.manage',
        'groups' => 'admin.permissions.manage',
        'grants' => 'admin.grants.manage',
        'sync' => 'admin.sync.view',
        default => 'admin.content.manage',
    };
}

function raidlands_admin_can_view_section(string $section): bool
{
    return raidlands_admin_can(raidlands_admin_section_permission($section));
}

function raidlands_admin_can_save_section(string $section): bool
{
    $section = raidlands_admin_clean_section($section);

    if ($section === 'sync') {
        return false;
    }

    return raidlands_admin_can(raidlands_admin_section_permission($section));
}

function raidlands_admin_can(string $permission): bool
{
    if ($permission === '') {
        return true;
    }

    $user = raidlands_admin_current_user();

    if ($user !== null) {
        return in_array($permission, (array) ($user['permissions'] ?? []), true);
    }

    return !raidlands_admin_auth_tables_ready()
        && !empty($_SESSION[raidlands_admin_session_key()]);
}

function raidlands_admin_auth_tables_ready(bool $refresh = false): bool
{
    static $ready = null;

    if ($refresh) {
        $ready = null;
    }

    if ($ready !== null) {
        return $ready;
    }

    if (!raidlands_db_is_configured()) {
        $ready = false;
        return false;
    }

    $pdo = raidlands_db();

    if (!$pdo instanceof PDO) {
        $ready = false;
        return false;
    }

    try {
        $pdo->query('SELECT 1 FROM admin_users LIMIT 1');
        $ready = true;
    } catch (Throwable $error) {
        $ready = false;
    }

    return $ready;
}

function raidlands_admin_current_user(bool $refresh = false): ?array
{
    static $loaded = false;
    static $user = null;
    static $steam_id64 = '';

    if ($refresh) {
        $loaded = false;
        $user = null;
        $steam_id64 = '';
        raidlands_admin_auth_tables_ready(true);
    }

    raidlands_admin_boot();
    $player = raidlands_store_current_player();
    $current_steam_id64 = is_array($player)
        ? preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? ''))
        : '';
    $current_steam_id64 = is_string($current_steam_id64) ? $current_steam_id64 : '';

    if ($loaded && $steam_id64 === $current_steam_id64) {
        return $user;
    }

    $loaded = true;
    $user = null;
    $steam_id64 = $current_steam_id64;

    if (!raidlands_store_validate_steam_id64($steam_id64) || !raidlands_admin_auth_tables_ready()) {
        return null;
    }

    try {
        $row = raidlands_db_fetch_one(
            'SELECT id, steam_id64, display_name, notes, is_active, last_login_at, created_at, updated_at
             FROM admin_users
             WHERE steam_id64 = :steam_id64 AND is_active = 1
             LIMIT 1',
            ['steam_id64' => $steam_id64]
        );

        if ($row === null) {
            return null;
        }

        $permissions = raidlands_db_fetch_all(
            'SELECT DISTINCT ar.slug AS role_slug, ar.name AS role_name, ap.permission_key
             FROM admin_user_roles aur
             INNER JOIN admin_roles ar ON ar.id = aur.role_id
             INNER JOIN admin_role_permissions arp ON arp.role_id = ar.id
             INNER JOIN admin_permissions ap ON ap.id = arp.permission_id
             WHERE aur.admin_user_id = :admin_user_id
             ORDER BY ar.slug ASC, ap.permission_key ASC',
            ['admin_user_id' => (int) $row['id']]
        );
    } catch (Throwable $error) {
        return null;
    }

    $roles = [];
    $role_names = [];
    $permission_keys = [];

    foreach ($permissions as $permission) {
        $role_slug = trim((string) ($permission['role_slug'] ?? ''));
        $role_name = trim((string) ($permission['role_name'] ?? ''));
        $permission_key = trim((string) ($permission['permission_key'] ?? ''));

        if ($role_slug !== '') {
            $roles[$role_slug] = $role_slug;
            $role_names[$role_slug] = $role_name !== '' ? $role_name : $role_slug;
        }

        if ($permission_key !== '') {
            $permission_keys[$permission_key] = $permission_key;
        }
    }

    if (!isset($permission_keys['admin.access'])) {
        return null;
    }

    $user = array_merge($row, [
        'roles' => array_values($roles),
        'role_names' => array_values($role_names),
        'permissions' => array_values($permission_keys),
        'player' => $player,
    ]);

    return $user;
}

function raidlands_admin_auth_message(): string
{
    if (!raidlands_db_is_configured()) {
        return 'Admin Steam access needs the database connection configured first.';
    }

    if (!raidlands_admin_auth_tables_ready()) {
        return 'Run database/migrations/007_admin_auth.sql to enable Steam-approved admin access.';
    }

    return 'Use Steam sign-in with an approved SteamID64 from the admin_users table.';
}

function raidlands_admin_audit(string $action, string $subject_type = '', string $subject_id = '', array $details = []): void
{
    if (!raidlands_db_is_configured()) {
        return;
    }

    $actor = 'admin';
    $user = raidlands_admin_current_user();

    if ($user !== null && !empty($user['steam_id64'])) {
        $actor = (string) $user['steam_id64'];
    } elseif (!empty($_SESSION[raidlands_admin_session_key()])) {
        $actor = 'legacy-config-admin';
    }

    try {
        raidlands_db_execute(
            'INSERT INTO admin_audit_log (actor, action, subject_type, subject_id, details_json)
             VALUES (:actor, :action, :subject_type, :subject_id, :details_json)',
            [
                'actor' => mb_substr($actor, 0, 120),
                'action' => mb_substr($action, 0, 120),
                'subject_type' => mb_substr($subject_type, 0, 80),
                'subject_id' => mb_substr($subject_id, 0, 120),
                'details_json' => $details === [] ? null : json_encode($details, JSON_UNESCAPED_SLASHES),
            ]
        );
    } catch (Throwable $error) {
        return;
    }
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
            'provider' => raidlands_admin_clean_text($stats_input['provider'] ?? 'raidlands', 40),
            'cacheSeconds' => raidlands_admin_int($stats_input['cacheSeconds'] ?? 60, 30, 3600),
            'staleSeconds' => raidlands_admin_int($stats_input['staleSeconds'] ?? 90, 30, 3600),
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

    return !raidlands_admin_auth_tables_ready()
        && (string) ($admin_panel['passwordHash'] ?? '') === ''
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
