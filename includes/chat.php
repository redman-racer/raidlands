<?php

require_once __DIR__ . '/store.php';

function raidlands_chat_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $config = [
        'enabled' => raidlands_env_bool('RAIDLANDS_CHAT_ENABLED', true),
        'history_limit' => max(20, min(200, raidlands_env_int('RAIDLANDS_CHAT_HISTORY_LIMIT', 100))),
        'retention_days' => max(1, min(90, raidlands_env_int('RAIDLANDS_CHAT_RETENTION_DAYS', 7))),
        'retention_rows' => max(100, min(5000, raidlands_env_int('RAIDLANDS_CHAT_RETENTION_ROWS', 500))),
        'message_max_length' => max(80, min(1000, raidlands_env_int('RAIDLANDS_CHAT_MESSAGE_MAX_LENGTH', 500))),
        'cooldown_seconds' => max(1, min(60, raidlands_env_int('RAIDLANDS_CHAT_COOLDOWN_SECONDS', 5))),
        'poll_open_ms' => max(1000, min(30000, raidlands_env_int('RAIDLANDS_CHAT_POLL_OPEN_MS', 3000))),
        'poll_closed_ms' => max(5000, min(120000, raidlands_env_int('RAIDLANDS_CHAT_POLL_CLOSED_MS', 15000))),
    ];

    return $config;
}

function raidlands_chat_enabled(): bool
{
    return !empty(raidlands_chat_config()['enabled']);
}

function raidlands_chat_ready(): bool
{
    return raidlands_db_is_configured()
        && raidlands_store_table_exists('chat_messages')
        && raidlands_store_table_exists('chat_mutes')
        && raidlands_store_table_exists('chat_moderation_actions');
}

function raidlands_chat_readiness_message(bool $admin = false): string
{
    if (!raidlands_chat_enabled()) {
        return $admin ? 'Public chat is disabled by RAIDLANDS_CHAT_ENABLED.' : 'Chat is offline right now.';
    }

    if (!raidlands_db_is_configured()) {
        return $admin
            ? 'Database credentials are not configured. Add them, then run database/migrations/042_public_lobby_chat.sql.'
            : 'Chat is being set up. Check back soon.';
    }

    return $admin
        ? 'Public chat tables are not ready. Run database/migrations/042_public_lobby_chat.sql.'
        : 'Chat is being set up. Check back soon.';
}

function raidlands_chat_client_config(?array $player, string $endpoint_url): array
{
    $config = raidlands_chat_config();
    $steam_id64 = is_array($player)
        ? raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '')
        : '';
    $signed_in = raidlands_store_validate_steam_id64($steam_id64);

    return [
        'enabled' => !empty($config['enabled']),
        'ready' => raidlands_chat_ready(),
        'message' => raidlands_chat_ready() ? '' : raidlands_chat_readiness_message(),
        'endpointUrl' => $endpoint_url,
        'csrfToken' => raidlands_store_csrf_token(),
        'historyLimit' => (int) $config['history_limit'],
        'pollOpenMs' => (int) $config['poll_open_ms'],
        'pollClosedMs' => (int) $config['poll_closed_ms'],
        'messageMaxLength' => (int) $config['message_max_length'],
        'signedIn' => $signed_in,
        'linkUrl' => route_url('link'),
        'player' => $signed_in ? [
            'displayName' => raidlands_chat_player_display_name($player),
            'steamId64' => $steam_id64,
            'avatarUrl' => (string) ($player['steam_avatar_url'] ?? ''),
            'profileUrl' => (string) ($player['steam_profile_url'] ?? ''),
            'isStaff' => raidlands_chat_current_player_is_staff(),
        ] : null,
    ];
}

function raidlands_chat_handle_api_request(): void
{
    header('Cache-Control: no-store');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        raidlands_chat_api_history();
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        raidlands_store_json_response(['ok' => false, 'error' => 'GET or POST required.'], 405);
    }

    $payload = raidlands_chat_request_payload();
    $action = strtolower(trim((string) ($payload['action'] ?? 'message')));

    if ($action === 'moderate') {
        raidlands_chat_api_moderate($payload);
    }

    raidlands_chat_api_message($payload);
}

function raidlands_chat_api_history(): void
{
    if (!raidlands_chat_enabled()) {
        raidlands_store_json_response(['ok' => true, 'ready' => false, 'messages' => [], 'message' => raidlands_chat_readiness_message()], 202);
    }

    if (!raidlands_chat_ready()) {
        raidlands_store_json_response(['ok' => true, 'ready' => false, 'messages' => [], 'message' => raidlands_chat_readiness_message()], 202);
    }

    raidlands_chat_cleanup();

    $after_id = max(0, (int) ($_GET['after_id'] ?? 0));
    $messages = raidlands_chat_public_messages($after_id);

    raidlands_store_json_response([
        'ok' => true,
        'ready' => true,
        'messages' => array_map('raidlands_chat_public_message_payload', $messages),
        'latestId' => raidlands_chat_latest_id($messages),
        'serverTime' => gmdate('c'),
    ]);
}

function raidlands_chat_api_message(array $payload): void
{
    if (!raidlands_chat_enabled()) {
        raidlands_store_json_response(['ok' => false, 'error' => raidlands_chat_readiness_message()], 503);
    }

    if (!raidlands_chat_ready()) {
        raidlands_store_json_response(['ok' => false, 'error' => raidlands_chat_readiness_message()], 503);
    }

    $csrf = (string) ($_SERVER['HTTP_X_RAIDLANDS_CSRF'] ?? ($payload['csrf'] ?? ''));

    if (!raidlands_store_validate_csrf($csrf)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Session token expired. Refresh the page and try again.'], 419);
    }

    $player = raidlands_store_current_player();
    $steam_id64 = is_array($player)
        ? raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '')
        : '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Link your Steam account before posting in chat.'], 401);
    }

    raidlands_chat_cleanup();
    raidlands_chat_reject_if_muted($steam_id64);
    raidlands_chat_reject_if_rate_limited($steam_id64);

    try {
        $message = raidlands_chat_create_message($player, (string) ($payload['message'] ?? ''));
        raidlands_store_json_response([
            'ok' => true,
            'message' => raidlands_chat_public_message_payload($message),
        ]);
    } catch (InvalidArgumentException $error) {
        raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
    } catch (Throwable $error) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Chat message could not be saved.'], 500);
    }
}

function raidlands_chat_api_moderate(array $payload): void
{
    raidlands_chat_require_admin();

    $csrf = (string) ($_SERVER['HTTP_X_RAIDLANDS_ADMIN_CSRF'] ?? $_SERVER['HTTP_X_RAIDLANDS_CSRF'] ?? ($payload['csrf'] ?? ''));

    if (!raidlands_admin_validate_csrf($csrf)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Admin session token expired.'], 419);
    }

    try {
        $message = raidlands_chat_admin_handle_action($payload);
        raidlands_store_json_response(['ok' => true, 'message' => $message]);
    } catch (Throwable $error) {
        raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
    }
}

function raidlands_chat_request_payload(): array
{
    $content_type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

    if (str_contains($content_type, 'application/json')) {
        $body = (string) file_get_contents('php://input');

        if (strlen($body) > 8192) {
            raidlands_store_json_response(['ok' => false, 'error' => 'Payload is too large.'], 413);
        }

        $payload = json_decode($body, true);

        if (!is_array($payload)) {
            raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
        }

        return $payload;
    }

    return $_POST;
}

function raidlands_chat_public_messages(int $after_id = 0, ?int $limit = null): array
{
    $config = raidlands_chat_config();
    $limit = $limit === null ? (int) $config['history_limit'] : max(1, min(250, $limit));

    if ($after_id > 0) {
        return raidlands_db_fetch_all(
            'SELECT *
             FROM chat_messages
             WHERE status = "visible" AND id > :after_id
             ORDER BY id ASC
             LIMIT ' . $limit,
            ['after_id' => $after_id]
        );
    }

    $rows = raidlands_db_fetch_all(
        'SELECT *
         FROM chat_messages
         WHERE status = "visible"
         ORDER BY id DESC
         LIMIT ' . $limit
    );

    return array_reverse($rows);
}

function raidlands_chat_latest_id(array $messages): int
{
    $latest = 0;

    foreach ($messages as $message) {
        $latest = max($latest, (int) ($message['id'] ?? 0));
    }

    return $latest;
}

function raidlands_chat_public_message_payload(array $row): array
{
    return [
        'id' => (int) ($row['id'] ?? 0),
        'displayName' => (string) ($row['display_name'] ?? 'Raidlands Player'),
        'avatarUrl' => (string) ($row['steam_avatar_url'] ?? ''),
        'profileUrl' => (string) ($row['steam_profile_url'] ?? ''),
        'isStaff' => !empty($row['is_staff']),
        'message' => (string) ($row['message'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
    ];
}

function raidlands_chat_create_message(array $player, string $message): array
{
    $clean_message = raidlands_chat_clean_message($message);

    if ($clean_message === '') {
        throw new InvalidArgumentException('Type a message before sending.');
    }

    $steam_id64 = raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '');

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Link your Steam account before posting in chat.');
    }

    $player_id = (int) ($player['id'] ?? 0);
    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO chat_messages
            (player_id, steam_id64, display_name, steam_avatar_url, steam_profile_url, is_staff, message)
         VALUES
            (:player_id, :steam_id64, :display_name, :steam_avatar_url, :steam_profile_url, :is_staff, :message)'
    );
    $statement->execute([
        'player_id' => $player_id > 0 ? $player_id : null,
        'steam_id64' => $steam_id64,
        'display_name' => raidlands_chat_player_display_name($player),
        'steam_avatar_url' => raidlands_chat_clean_url($player['steam_avatar_url'] ?? '', 500),
        'steam_profile_url' => raidlands_chat_clean_url($player['steam_profile_url'] ?? '', 500),
        'is_staff' => raidlands_chat_current_player_is_staff() ? 1 : 0,
        'message' => $clean_message,
    ]);

    return raidlands_db_fetch_one('SELECT * FROM chat_messages WHERE id = :id', ['id' => (int) $pdo->lastInsertId()]) ?? [];
}

function raidlands_chat_reject_if_muted(string $steam_id64): void
{
    $mute = raidlands_chat_active_mute($steam_id64);

    if ($mute === null) {
        return;
    }

    $suffix = trim((string) ($mute['reason'] ?? ''));
    $message = 'You are muted from public chat.';

    if ($suffix !== '') {
        $message .= ' Reason: ' . $suffix;
    }

    raidlands_store_json_response(['ok' => false, 'error' => $message], 403);
}

function raidlands_chat_active_mute(string $steam_id64): ?array
{
    if (!raidlands_store_validate_steam_id64($steam_id64) || !raidlands_chat_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT *
         FROM chat_mutes
         WHERE steam_id64 = :steam_id64
           AND is_active = 1
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC, id DESC
         LIMIT 1',
        ['steam_id64' => $steam_id64]
    );
}

function raidlands_chat_reject_if_rate_limited(string $steam_id64): void
{
    $config = raidlands_chat_config();
    $cooldown = (int) $config['cooldown_seconds'];

    if ($cooldown <= 0) {
        return;
    }

    $row = raidlands_db_fetch_one(
        'SELECT TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS seconds_since
         FROM chat_messages
         WHERE steam_id64 = :steam_id64',
        ['steam_id64' => $steam_id64]
    );
    $seconds_since = $row === null || $row['seconds_since'] === null ? $cooldown : (int) $row['seconds_since'];

    if ($seconds_since < $cooldown) {
        $remaining = max(1, $cooldown - $seconds_since);
        raidlands_store_json_response([
            'ok' => false,
            'error' => 'Slow down a moment before sending another chat message.',
            'retryAfterSeconds' => $remaining,
        ], 429);
    }
}

function raidlands_chat_admin_state(int $limit = 150): array
{
    if (!raidlands_chat_enabled()) {
        return raidlands_chat_empty_admin_state(false, raidlands_chat_readiness_message(true));
    }

    if (!raidlands_chat_ready()) {
        return raidlands_chat_empty_admin_state(false, raidlands_chat_readiness_message(true));
    }

    raidlands_chat_cleanup();
    $limit = max(20, min(250, $limit));

    return [
        'ready' => true,
        'message' => '',
        'summary' => raidlands_chat_admin_summary(),
        'messages' => raidlands_db_fetch_all(
            'SELECT *
             FROM chat_messages
             ORDER BY created_at DESC, id DESC
             LIMIT ' . $limit
        ),
        'mutes' => raidlands_db_fetch_all(
            'SELECT *
             FROM chat_mutes
             WHERE is_active = 1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC, id DESC
             LIMIT 80'
        ),
        'actions' => raidlands_db_fetch_all(
            'SELECT *
             FROM chat_moderation_actions
             ORDER BY created_at DESC, id DESC
             LIMIT 80'
        ),
    ];
}

function raidlands_chat_empty_admin_state(bool $ready, string $message): array
{
    return [
        'ready' => $ready,
        'message' => $message,
        'summary' => [
            'message_count' => 0,
            'visible_count' => 0,
            'hidden_count' => 0,
            'active_mute_count' => 0,
            'latest_message_at' => null,
        ],
        'messages' => [],
        'mutes' => [],
        'actions' => [],
    ];
}

function raidlands_chat_admin_summary(): array
{
    $summary = raidlands_db_fetch_one(
        'SELECT
            COUNT(*) AS message_count,
            SUM(status = "visible") AS visible_count,
            SUM(status = "hidden") AS hidden_count,
            MAX(created_at) AS latest_message_at
         FROM chat_messages'
    ) ?? [];
    $mute = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS active_mute_count
         FROM chat_mutes
         WHERE is_active = 1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())'
    ) ?? [];

    return array_merge([
        'message_count' => 0,
        'visible_count' => 0,
        'hidden_count' => 0,
        'active_mute_count' => 0,
        'latest_message_at' => null,
    ], $summary, $mute);
}

function raidlands_chat_admin_handle_action(array $post): string
{
    raidlands_chat_require_admin();

    if (!raidlands_chat_ready()) {
        throw new RuntimeException(raidlands_chat_readiness_message(true));
    }

    $action = trim((string) ($post['chat_admin_action'] ?? $post['moderationAction'] ?? ''));

    if ($action === '') {
        return 'No chat moderation action selected.';
    }

    if (str_starts_with($action, 'hide:')) {
        $message_id = (int) substr($action, strlen('hide:'));
        $reason = raidlands_chat_reason_for_message($post, $message_id);
        raidlands_chat_set_message_status($message_id, 'hidden', $reason);
        return 'Chat message hidden.';
    }

    if (str_starts_with($action, 'restore:')) {
        $message_id = (int) substr($action, strlen('restore:'));
        $reason = raidlands_chat_reason_for_message($post, $message_id);
        raidlands_chat_set_message_status($message_id, 'visible', $reason);
        return 'Chat message restored.';
    }

    if (str_starts_with($action, 'mute:')) {
        $steam_id64 = raidlands_store_normalize_steam_id64(substr($action, strlen('mute:')));
        $reason = raidlands_chat_reason_for_steam($post, $steam_id64);
        raidlands_chat_mute_player($steam_id64, $reason);
        return 'SteamID64 ' . $steam_id64 . ' muted from public chat.';
    }

    if (str_starts_with($action, 'unmute:')) {
        $steam_id64 = raidlands_store_normalize_steam_id64(substr($action, strlen('unmute:')));
        $reason = raidlands_chat_reason_for_steam($post, $steam_id64);
        raidlands_chat_unmute_player($steam_id64, $reason);
        return 'SteamID64 ' . $steam_id64 . ' unmuted.';
    }

    throw new InvalidArgumentException('Choose a valid chat moderation action.');
}

function raidlands_chat_set_message_status(int $message_id, string $status, string $reason = ''): void
{
    if ($message_id <= 0 || !in_array($status, ['visible', 'hidden'], true)) {
        throw new InvalidArgumentException('Choose a valid chat message.');
    }

    $message = raidlands_db_fetch_one('SELECT * FROM chat_messages WHERE id = :id', ['id' => $message_id]);

    if ($message === null) {
        throw new RuntimeException('Chat message could not be found.');
    }

    $actor = raidlands_chat_admin_actor_steam_id64();
    $reason = raidlands_store_clean_admin_note($reason, 500);

    raidlands_db_execute(
        'UPDATE chat_messages
         SET status = :status,
             hidden_by_steam_id64 = :hidden_by_steam_id64,
             hidden_reason = :hidden_reason,
             hidden_at = :hidden_at
         WHERE id = :id',
        [
            'id' => $message_id,
            'status' => $status,
            'hidden_by_steam_id64' => $status === 'hidden' ? $actor : null,
            'hidden_reason' => $status === 'hidden' ? $reason : '',
            'hidden_at' => $status === 'hidden' ? gmdate('Y-m-d H:i:s') : null,
        ]
    );
    raidlands_chat_record_moderation_action(
        $status === 'hidden' ? 'hide' : 'restore',
        $message_id,
        (string) ($message['steam_id64'] ?? ''),
        $reason,
        ['previous_status' => (string) ($message['status'] ?? '')]
    );
}

function raidlands_chat_mute_player(string $steam_id64, string $reason = ''): void
{
    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Choose a valid SteamID64 to mute.');
    }

    $actor = raidlands_chat_admin_actor_steam_id64();
    $reason = raidlands_store_clean_admin_note($reason, 500);

    raidlands_db_execute(
        'UPDATE chat_mutes
         SET is_active = 0,
             revoked_by_steam_id64 = :actor,
             revoked_at = NOW()
         WHERE steam_id64 = :steam_id64 AND is_active = 1 AND revoked_at IS NULL',
        [
            'actor' => $actor,
            'steam_id64' => $steam_id64,
        ]
    );
    raidlands_db_execute(
        'INSERT INTO chat_mutes (steam_id64, muted_by_steam_id64, reason)
         VALUES (:steam_id64, :actor, :reason)',
        [
            'steam_id64' => $steam_id64,
            'actor' => $actor,
            'reason' => $reason,
        ]
    );
    raidlands_chat_record_moderation_action('mute', null, $steam_id64, $reason);
}

function raidlands_chat_unmute_player(string $steam_id64, string $reason = ''): void
{
    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Choose a valid SteamID64 to unmute.');
    }

    $actor = raidlands_chat_admin_actor_steam_id64();
    $reason = raidlands_store_clean_admin_note($reason, 500);
    $updated = raidlands_db_execute(
        'UPDATE chat_mutes
         SET is_active = 0,
             revoked_by_steam_id64 = :actor,
             revoked_at = NOW()
         WHERE steam_id64 = :steam_id64 AND is_active = 1 AND revoked_at IS NULL',
        [
            'actor' => $actor,
            'steam_id64' => $steam_id64,
        ]
    );

    if ($updated === 0) {
        throw new RuntimeException('That SteamID64 does not have an active chat mute.');
    }

    raidlands_chat_record_moderation_action('unmute', null, $steam_id64, $reason);
}

function raidlands_chat_record_moderation_action(string $action, ?int $message_id, string $target_steam_id64, string $reason = '', array $details = []): void
{
    raidlands_db_execute(
        'INSERT INTO chat_moderation_actions
            (message_id, target_steam_id64, actor_steam_id64, action, reason, details_json)
         VALUES
            (:message_id, :target_steam_id64, :actor_steam_id64, :action, :reason, :details_json)',
        [
            'message_id' => $message_id !== null && $message_id > 0 ? $message_id : null,
            'target_steam_id64' => raidlands_store_normalize_steam_id64($target_steam_id64),
            'actor_steam_id64' => raidlands_chat_admin_actor_steam_id64(),
            'action' => $action,
            'reason' => raidlands_store_clean_admin_note($reason, 500),
            'details_json' => $details === [] ? null : json_encode($details, JSON_UNESCAPED_SLASHES),
        ]
    );
}

function raidlands_chat_reason_for_message(array $post, int $message_id): string
{
    $reasons = is_array($post['chat_message_reason'] ?? null) ? $post['chat_message_reason'] : [];

    return (string) ($post['reason'] ?? $reasons[$message_id] ?? '');
}

function raidlands_chat_reason_for_steam(array $post, string $steam_id64): string
{
    $reasons = is_array($post['chat_mute_reason'] ?? null) ? $post['chat_mute_reason'] : [];

    return (string) ($post['reason'] ?? $reasons[$steam_id64] ?? '');
}

function raidlands_chat_require_admin(): array
{
    if (!function_exists('raidlands_admin_current_user')) {
        require_once __DIR__ . '/admin.php';
    }

    if (!raidlands_admin_is_authenticated() || !raidlands_admin_can('admin.chat.manage')) {
        throw new RuntimeException('Your admin role cannot moderate public chat.');
    }

    $user = raidlands_admin_current_user();

    if ($user === null && raidlands_admin_auth_tables_ready()) {
        throw new RuntimeException('Your admin role cannot moderate public chat.');
    }

    return is_array($user) ? $user : [];
}

function raidlands_chat_admin_actor_steam_id64(): string
{
    $user = raidlands_chat_require_admin();
    $steam_id64 = raidlands_store_normalize_steam_id64($user['steam_id64'] ?? '');

    return raidlands_store_validate_steam_id64($steam_id64) ? $steam_id64 : 'legacy-config-admin';
}

function raidlands_chat_current_player_is_staff(): bool
{
    if (!function_exists('raidlands_admin_current_user') || !function_exists('raidlands_admin_can')) {
        return false;
    }

    return raidlands_admin_current_user() !== null && raidlands_admin_can('admin.chat.manage');
}

function raidlands_chat_player_display_name(?array $player): string
{
    if (!is_array($player)) {
        return 'Raidlands Player';
    }

    $name = trim((string) (($player['display_name'] ?? '') ?: ($player['steam_display_name'] ?? '')));
    $name = raidlands_chat_clean_text($name, 80);

    if ($name !== '') {
        return $name;
    }

    $steam_id64 = raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '');

    return $steam_id64 !== '' ? 'Steam ' . substr($steam_id64, -4) : 'Raidlands Player';
}

function raidlands_chat_clean_message(string $message): string
{
    $max = (int) raidlands_chat_config()['message_max_length'];
    $message = str_replace("\0", '', $message);
    $message = str_replace(["\r\n", "\r"], "\n", $message);
    $message = strip_tags($message);
    $message = preg_replace('/[ \t]+/', ' ', $message) ?? $message;
    $message = preg_replace("/\n{3,}/", "\n\n", $message) ?? $message;
    $message = trim($message);

    return raidlands_chat_limit($message, $max);
}

function raidlands_chat_clean_text($value, int $max_length = 500): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', strip_tags($text)) ?? $text;

    return raidlands_chat_limit($text, $max_length);
}

function raidlands_chat_clean_url($value, int $max_length = 500): string
{
    $url = trim(str_replace("\0", '', (string) $value));

    if ($url === '' || !preg_match('#^https?://#i', $url)) {
        return '';
    }

    return raidlands_chat_limit(strip_tags($url), $max_length);
}

function raidlands_chat_limit(string $text, int $max_length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_chat_cleanup(): void
{
    if (!raidlands_chat_ready()) {
        return;
    }

    $config = raidlands_chat_config();
    $retention_days = (int) $config['retention_days'];
    $retention_rows = (int) $config['retention_rows'];

    try {
        raidlands_db_execute(
            'UPDATE chat_mutes
             SET is_active = 0,
                 revoked_at = NOW(),
                 revoked_by_steam_id64 = "system-expired"
             WHERE is_active = 1
               AND revoked_at IS NULL
               AND expires_at IS NOT NULL
               AND expires_at <= NOW()'
        );

        raidlands_db_execute(
            'DELETE FROM chat_messages
             WHERE created_at < DATE_SUB(NOW(), INTERVAL ' . $retention_days . ' DAY)
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM chat_messages ORDER BY id DESC LIMIT ' . $retention_rows . '
                 ) AS keep_rows
               )'
        );
    } catch (Throwable $error) {
        return;
    }
}

function render_raidlands_chat_widget(?array $player = null): string
{
    $config = raidlands_chat_config();
    $linked = is_array($player) && raidlands_store_validate_steam_id64(raidlands_store_normalize_steam_id64($player['steam_id64'] ?? ''));
    $display_name = $linked ? raidlands_chat_player_display_name($player) : '';

    return '<div class="chat-widget" data-chat-widget data-chat-open="false" data-chat-has-unread="false">'
        . '<button class="chat-launcher" type="button" data-chat-toggle aria-expanded="false" aria-controls="raidlands-chat-panel">'
        . render_feature_symbol('CHAT')
        . '<span class="chat-launcher-copy"><strong>Chat</strong><small>Public Lobby</small></span>'
        . '</button>'
        . '<span class="chat-unread" data-chat-unread hidden role="status" aria-live="polite">0</span>'
        . '<section class="chat-panel" id="raidlands-chat-panel" data-chat-panel hidden aria-label="Raidlands public chat">'
        . '<header class="chat-panel-head">'
        . '<div><p class="section-kicker">Public lobby</p><h2>Raidlands Chat</h2></div>'
        . '<button class="chat-close" type="button" data-chat-close aria-label="Close chat">&times;</button>'
        . '</header>'
        . '<div class="chat-status" data-chat-status role="status" aria-live="polite">Loading chat...</div>'
        . '<div class="chat-messages" data-chat-messages role="log" aria-live="polite" aria-relevant="additions"></div>'
        . ($linked
            ? '<form class="chat-form" data-chat-form>'
                . '<label class="sr-only" for="raidlands-chat-message">Message</label>'
                . '<span class="sr-only" id="raidlands-chat-message-help">Enter sends the message. Shift plus Enter adds a new line.</span>'
                . '<textarea id="raidlands-chat-message" name="message" maxlength="' . e((string) $config['message_max_length']) . '" rows="2" placeholder="Message the lobby as ' . e($display_name) . '" aria-describedby="raidlands-chat-message-help" data-chat-input></textarea>'
                . '<button class="btn btn-primary" type="submit" data-chat-submit>Send</button>'
              . '</form>'
            : '<div class="chat-auth-callout">'
                . '<p>Anyone can read the lobby. Link Steam to send messages.</p>'
                . '<a class="btn btn-primary" href="' . e(route_url('link')) . '">Link Steam</a>'
              . '</div>')
        . '</section>'
        . '</div>';
}
