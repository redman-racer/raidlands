<?php

require_once __DIR__ . '/store.php';

function raidlands_animation_diagnostics_ready(): bool
{
    return raidlands_db_is_configured() && raidlands_store_table_exists('animation_diagnostics');
}

function raidlands_animation_diagnostics_client_config(?array $player, string $endpoint_url): array
{
    $steam_id64 = is_array($player)
        ? raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '')
        : '';
    $enabled = raidlands_store_validate_steam_id64($steam_id64) && raidlands_db_is_configured();

    return [
        'enabled' => $enabled,
        'endpointUrl' => $endpoint_url,
        'csrfToken' => $enabled ? raidlands_store_csrf_token() : '',
        'maxEvents' => 24,
    ];
}

function raidlands_animation_diagnostics_handle_request(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        raidlands_store_json_response(['ok' => false, 'error' => 'POST required.'], 405);
    }

    $player = raidlands_store_current_player();
    $steam_id64 = is_array($player)
        ? raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '')
        : '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Steam sign-in required.'], 401);
    }

    $body = (string) file_get_contents('php://input');

    if (strlen($body) > 32768) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Payload is too large.'], 413);
    }

    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
    }

    $csrf = (string) ($_SERVER['HTTP_X_RAIDLANDS_CSRF'] ?? ($payload['csrf'] ?? ''));

    if (!raidlands_store_validate_csrf($csrf)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Session token expired.'], 419);
    }

    if (!raidlands_animation_diagnostics_ready()) {
        raidlands_store_json_response([
            'ok' => true,
            'saved' => 0,
            'ready' => false,
            'message' => 'Run database/migrations/041_animation_diagnostics.sql to store animation diagnostics.',
        ], 202);
    }

    $events = $payload['events'] ?? [];

    if (isset($payload['eventType'])) {
        $events = [$payload];
    }

    if (!is_array($events)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Events must be an array.'], 400);
    }

    $saved = raidlands_animation_diagnostics_record_events($player, array_slice($events, 0, 24));

    raidlands_store_json_response([
        'ok' => true,
        'ready' => true,
        'saved' => $saved,
    ]);
}

function raidlands_animation_diagnostics_record_events(array $player, array $events): int
{
    $steam_id64 = raidlands_store_normalize_steam_id64($player['steam_id64'] ?? '');

    if (!raidlands_store_validate_steam_id64($steam_id64) || $events === []) {
        return 0;
    }

    $player_id = (int) ($player['id'] ?? 0);
    $session_id = session_id();
    $session_hash = $session_id !== '' ? hash('sha256', $session_id) : '';
    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO animation_diagnostics
            (player_id, steam_id64, session_hash, event_type, page_id, page_url, referrer_url,
             viewport_width, viewport_height, device_pixel_ratio, reduced_motion, mobile_performance,
             loader_should_show, user_agent, details_json)
         VALUES
            (:player_id, :steam_id64, :session_hash, :event_type, :page_id, :page_url, :referrer_url,
             :viewport_width, :viewport_height, :device_pixel_ratio, :reduced_motion, :mobile_performance,
             :loader_should_show, :user_agent, :details_json)'
    );
    $saved = 0;

    foreach ($events as $event) {
        if (!is_array($event)) {
            continue;
        }

        $row = raidlands_animation_diagnostics_normalize_event($event);

        if ($row['event_type'] === '') {
            continue;
        }

        $statement->execute([
            'player_id' => $player_id > 0 ? $player_id : null,
            'steam_id64' => $steam_id64,
            'session_hash' => $session_hash,
            'event_type' => $row['event_type'],
            'page_id' => $row['page_id'],
            'page_url' => $row['page_url'],
            'referrer_url' => $row['referrer_url'],
            'viewport_width' => $row['viewport_width'],
            'viewport_height' => $row['viewport_height'],
            'device_pixel_ratio' => $row['device_pixel_ratio'],
            'reduced_motion' => $row['reduced_motion'],
            'mobile_performance' => $row['mobile_performance'],
            'loader_should_show' => $row['loader_should_show'],
            'user_agent' => $row['user_agent'],
            'details_json' => $row['details_json'],
        ]);
        $saved += 1;
    }

    return $saved;
}

function raidlands_animation_diagnostics_normalize_event(array $event): array
{
    $details = is_array($event['details'] ?? null) ? $event['details'] : [];
    $page = is_array($event['page'] ?? null) ? $event['page'] : [];
    $viewport = is_array($event['viewport'] ?? null) ? $event['viewport'] : [];
    $capabilities = is_array($event['capabilities'] ?? null) ? $event['capabilities'] : [];
    $loader = is_array($event['loader'] ?? null) ? $event['loader'] : [];

    if ($page === [] && isset($details['page']) && is_array($details['page'])) {
        $page = $details['page'];
    }

    if ($viewport === [] && isset($details['viewport']) && is_array($details['viewport'])) {
        $viewport = $details['viewport'];
    }

    if ($capabilities === [] && isset($details['capabilities']) && is_array($details['capabilities'])) {
        $capabilities = $details['capabilities'];
    }

    if ($loader === [] && isset($details['loader']) && is_array($details['loader'])) {
        $loader = $details['loader'];
    }

    $event_type = strtolower(trim((string) ($event['eventType'] ?? $event['type'] ?? $event['name'] ?? '')));
    $event_type = preg_replace('/[^a-z0-9_.:-]+/', '_', $event_type) ?? '';
    $event_type = trim($event_type, '_');

    $details['recordedAtClient'] = raidlands_animation_diagnostics_clean_string($event['at'] ?? '', 80);

    return [
        'event_type' => mb_substr($event_type, 0, 80),
        'page_id' => raidlands_animation_diagnostics_clean_key($page['id'] ?? $event['pageId'] ?? ''),
        'page_url' => raidlands_animation_diagnostics_clean_url($page['url'] ?? $event['url'] ?? ''),
        'referrer_url' => raidlands_animation_diagnostics_clean_url($page['referrer'] ?? $event['referrer'] ?? ''),
        'viewport_width' => raidlands_animation_diagnostics_clamp_int($viewport['width'] ?? 0, 0, 10000),
        'viewport_height' => raidlands_animation_diagnostics_clamp_int($viewport['height'] ?? 0, 0, 10000),
        'device_pixel_ratio' => raidlands_animation_diagnostics_clamp_float($viewport['devicePixelRatio'] ?? 0, 0, 10),
        'reduced_motion' => raidlands_animation_diagnostics_bool_or_null($capabilities['reducedMotion'] ?? $event['reducedMotion'] ?? null),
        'mobile_performance' => raidlands_animation_diagnostics_bool_or_null($capabilities['mobilePerformance'] ?? $event['mobilePerformance'] ?? null),
        'loader_should_show' => raidlands_animation_diagnostics_bool_or_null($loader['shouldShow'] ?? $event['loaderShouldShow'] ?? null),
        'user_agent' => raidlands_animation_diagnostics_clean_string($_SERVER['HTTP_USER_AGENT'] ?? '', 500),
        'details_json' => raidlands_animation_diagnostics_encode_details($details),
    ];
}

function raidlands_animation_diagnostics_encode_details(array $details): ?string
{
    $clean = raidlands_animation_diagnostics_sanitize_value($details);

    if (!is_array($clean) || $clean === []) {
        return null;
    }

    return json_encode($clean, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function raidlands_animation_diagnostics_sanitize_value($value, int $depth = 0)
{
    if ($depth > 5) {
        return null;
    }

    if (is_array($value)) {
        $clean = [];
        $count = 0;

        foreach ($value as $key => $item) {
            if ($count >= 80) {
                break;
            }

            $clean_key = is_int($key)
                ? $key
                : raidlands_animation_diagnostics_clean_string($key, 80);

            if ($clean_key === '') {
                continue;
            }

            $clean[$clean_key] = raidlands_animation_diagnostics_sanitize_value($item, $depth + 1);
            $count += 1;
        }

        return $clean;
    }

    if (is_bool($value) || $value === null || is_int($value) || is_float($value)) {
        return $value;
    }

    return raidlands_animation_diagnostics_clean_string($value, 1000);
}

function raidlands_animation_diagnostics_clean_key($value): string
{
    $key = strtolower(trim((string) $value));
    $key = preg_replace('/[^a-z0-9_-]+/', '-', $key) ?? '';

    return mb_substr(trim($key, '-'), 0, 80);
}

function raidlands_animation_diagnostics_clean_url($value): string
{
    $url = trim(str_replace("\0", '', (string) $value));

    if ($url === '') {
        return '';
    }

    return mb_substr(strip_tags($url), 0, 700);
}

function raidlands_animation_diagnostics_clean_string($value, int $max_length): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', strip_tags($text)) ?? $text;

    return mb_substr($text, 0, $max_length);
}

function raidlands_animation_diagnostics_clamp_int($value, int $min, int $max): int
{
    return max($min, min($max, (int) $value));
}

function raidlands_animation_diagnostics_clamp_float($value, float $min, float $max): float
{
    return max($min, min($max, round((float) $value, 2)));
}

function raidlands_animation_diagnostics_bool_or_null($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    $string = strtolower(trim((string) $value));

    if (in_array($string, ['1', 'true', 'yes', 'on'], true)) {
        return 1;
    }

    if (in_array($string, ['0', 'false', 'no', 'off'], true)) {
        return 0;
    }

    return null;
}

function raidlands_animation_diagnostics_admin_state($options = []): array
{
    if (is_int($options)) {
        $options = ['event_per_page' => $options];
    }

    $filters = raidlands_animation_diagnostics_admin_filters((array) $options);

    if (!raidlands_db_is_configured()) {
        return [
            'ready' => false,
            'message' => 'MySQL is not configured yet.',
            'events' => [],
            'players' => [],
            'filters' => $filters,
            'event_types' => [],
            'events_pagination' => raidlands_animation_diagnostics_pagination(0, 1, $filters['event_per_page']),
            'players_pagination' => raidlands_animation_diagnostics_pagination(0, 1, $filters['player_per_page']),
            'summary' => raidlands_animation_diagnostics_empty_summary(),
        ];
    }

    if (!raidlands_animation_diagnostics_ready()) {
        return [
            'ready' => false,
            'message' => 'Run database/migrations/041_animation_diagnostics.sql to collect animation diagnostics.',
            'events' => [],
            'players' => [],
            'filters' => $filters,
            'event_types' => [],
            'events_pagination' => raidlands_animation_diagnostics_pagination(0, 1, $filters['event_per_page']),
            'players_pagination' => raidlands_animation_diagnostics_pagination(0, 1, $filters['player_per_page']),
            'summary' => raidlands_animation_diagnostics_empty_summary(),
        ];
    }

    $events_state = raidlands_animation_diagnostics_admin_events($filters);
    $players_state = raidlands_animation_diagnostics_admin_players($filters);

    return [
        'ready' => true,
        'message' => '',
        'events' => $events_state['rows'],
        'players' => $players_state['rows'],
        'filters' => $filters,
        'event_types' => raidlands_animation_diagnostics_admin_event_types(),
        'events_pagination' => $events_state['pagination'],
        'players_pagination' => $players_state['pagination'],
        'summary' => raidlands_animation_diagnostics_admin_summary(),
    ];
}

function raidlands_animation_diagnostics_admin_filters(array $options): array
{
    return [
        'event_search' => raidlands_animation_diagnostics_admin_clean_text($options['event_search'] ?? '', 120),
        'event_type' => raidlands_animation_diagnostics_admin_clean_text($options['event_type'] ?? '', 80),
        'event_signal' => raidlands_animation_diagnostics_admin_choice(
            $options['event_signal'] ?? '',
            ['errors', 'loader_skipped', 'loader_shown', 'loader_hidden', 'reduced_motion', 'mobile_performance']
        ),
        'event_sort' => raidlands_animation_diagnostics_admin_choice(
            $options['event_sort'] ?? 'newest',
            ['newest', 'oldest', 'steam', 'event', 'page', 'viewport'],
            'newest'
        ),
        'event_page' => raidlands_animation_diagnostics_admin_int($options['event_page'] ?? 1, 1, 9999, 1),
        'event_per_page' => raidlands_animation_diagnostics_admin_per_page($options['event_per_page'] ?? ($options['limit'] ?? 25), 25),
        'player_search' => raidlands_animation_diagnostics_admin_clean_text($options['player_search'] ?? '', 80),
        'player_signal' => raidlands_animation_diagnostics_admin_choice(
            $options['player_signal'] ?? '',
            ['errors', 'loader_skips', 'effects_started', 'no_effects', 'reduced_motion', 'mobile_performance']
        ),
        'player_sort' => raidlands_animation_diagnostics_admin_choice(
            $options['player_sort'] ?? 'last_seen',
            ['last_seen', 'oldest_seen', 'events', 'sessions', 'loader_skips', 'effects_starts', 'errors', 'steam'],
            'last_seen'
        ),
        'player_page' => raidlands_animation_diagnostics_admin_int($options['player_page'] ?? 1, 1, 9999, 1),
        'player_per_page' => raidlands_animation_diagnostics_admin_per_page($options['player_per_page'] ?? 20, 20),
    ];
}

function raidlands_animation_diagnostics_admin_events(array $filters): array
{
    [$where_sql, $params] = raidlands_animation_diagnostics_admin_event_where($filters);
    $total_row = raidlands_db_fetch_one('SELECT COUNT(*) AS total FROM animation_diagnostics' . $where_sql, $params);
    $total = (int) ($total_row['total'] ?? 0);
    $pagination = raidlands_animation_diagnostics_pagination($total, (int) $filters['event_page'], (int) $filters['event_per_page']);
    $order_sql = raidlands_animation_diagnostics_admin_event_order((string) $filters['event_sort']);
    $limit = (int) $pagination['per_page'];
    $offset = (int) $pagination['offset'];
    $events = raidlands_db_fetch_all(
        'SELECT id, player_id, steam_id64, session_hash, event_type, page_id, page_url, referrer_url,
                viewport_width, viewport_height, device_pixel_ratio, reduced_motion, mobile_performance,
                loader_should_show, user_agent, details_json, created_at
         FROM animation_diagnostics'
        . $where_sql
        . ' ORDER BY ' . $order_sql
        . ' LIMIT ' . $limit . ' OFFSET ' . $offset,
        $params
    );

    return [
        'rows' => array_map('raidlands_animation_diagnostics_admin_event', $events),
        'pagination' => $pagination,
    ];
}

function raidlands_animation_diagnostics_admin_event(array $row): array
{
    $details = json_decode((string) ($row['details_json'] ?? ''), true);
    $row['details'] = is_array($details) ? $details : [];

    return $row;
}

function raidlands_animation_diagnostics_admin_players(array $filters): array
{
    [$where_sql, $params] = raidlands_animation_diagnostics_admin_player_where($filters);
    $having_sql = raidlands_animation_diagnostics_admin_player_having((string) $filters['player_signal']);
    $aggregate_sql = 'SELECT steam_id64,
            COUNT(*) AS event_count,
            COUNT(DISTINCT session_hash) AS session_count,
            MAX(created_at) AS last_seen_at,
            SUM(event_type = "loader_skipped") AS loader_skipped_count,
            SUM(event_type = "effects_start") AS effects_start_count,
            SUM(event_type = "loader_error" OR event_type = "animation_diagnostic_error") AS error_count,
            MAX(reduced_motion = 1) AS ever_reduced_motion,
            MAX(mobile_performance = 1) AS ever_mobile_performance
        FROM animation_diagnostics'
        . $where_sql
        . ' GROUP BY steam_id64'
        . $having_sql;
    $total_row = raidlands_db_fetch_one('SELECT COUNT(*) AS total FROM (' . $aggregate_sql . ') player_rows', $params);
    $total = (int) ($total_row['total'] ?? 0);
    $pagination = raidlands_animation_diagnostics_pagination($total, (int) $filters['player_page'], (int) $filters['player_per_page']);
    $order_sql = raidlands_animation_diagnostics_admin_player_order((string) $filters['player_sort']);
    $limit = (int) $pagination['per_page'];
    $offset = (int) $pagination['offset'];
    $rows = raidlands_db_fetch_all(
        'SELECT * FROM (' . $aggregate_sql . ') player_rows ORDER BY ' . $order_sql . ' LIMIT ' . $limit . ' OFFSET ' . $offset,
        $params
    );

    return [
        'rows' => $rows,
        'pagination' => $pagination,
    ];
}

function raidlands_animation_diagnostics_admin_event_types(): array
{
    return raidlands_db_fetch_all(
        'SELECT event_type, COUNT(*) AS event_count
         FROM animation_diagnostics
         GROUP BY event_type
         ORDER BY event_type ASC'
    );
}

function raidlands_animation_diagnostics_admin_event_where(array $filters): array
{
    $where = [];
    $params = [];
    $search = (string) ($filters['event_search'] ?? '');

    if ($search !== '') {
        $search_columns = ['steam_id64', 'event_type', 'page_id', 'page_url', 'referrer_url', 'user_agent', 'details_json'];
        $search_parts = [];

        foreach ($search_columns as $index => $column) {
            $param = 'event_search_' . $index;
            $params[$param] = '%' . $search . '%';
            $search_parts[] = $column . ' LIKE :' . $param;
        }

        $where[] = '(' . implode(' OR ', $search_parts) . ')';
    }

    if ((string) ($filters['event_type'] ?? '') !== '') {
        $params['event_type'] = (string) $filters['event_type'];
        $where[] = 'event_type = :event_type';
    }

    switch ((string) ($filters['event_signal'] ?? '')) {
        case 'errors':
            $where[] = '(event_type = "loader_error" OR event_type = "animation_diagnostic_error")';
            break;
        case 'loader_skipped':
            $where[] = 'event_type = "loader_skipped"';
            break;
        case 'loader_shown':
            $where[] = 'loader_should_show = 1';
            break;
        case 'loader_hidden':
            $where[] = 'loader_should_show = 0';
            break;
        case 'reduced_motion':
            $where[] = 'reduced_motion = 1';
            break;
        case 'mobile_performance':
            $where[] = 'mobile_performance = 1';
            break;
    }

    return [$where === [] ? '' : ' WHERE ' . implode(' AND ', $where), $params];
}

function raidlands_animation_diagnostics_admin_player_where(array $filters): array
{
    $search = (string) ($filters['player_search'] ?? '');

    if ($search === '') {
        return ['', []];
    }

    return [' WHERE steam_id64 LIKE :player_search', ['player_search' => '%' . $search . '%']];
}

function raidlands_animation_diagnostics_admin_player_having(string $signal): string
{
    return match ($signal) {
        'errors' => ' HAVING error_count > 0',
        'loader_skips' => ' HAVING loader_skipped_count > 0',
        'effects_started' => ' HAVING effects_start_count > 0',
        'no_effects' => ' HAVING effects_start_count = 0',
        'reduced_motion' => ' HAVING ever_reduced_motion = 1',
        'mobile_performance' => ' HAVING ever_mobile_performance = 1',
        default => '',
    };
}

function raidlands_animation_diagnostics_admin_event_order(string $sort): string
{
    return match ($sort) {
        'oldest' => 'created_at ASC, id ASC',
        'steam' => 'steam_id64 ASC, created_at DESC, id DESC',
        'event' => 'event_type ASC, created_at DESC, id DESC',
        'page' => 'page_id ASC, created_at DESC, id DESC',
        'viewport' => 'viewport_width DESC, viewport_height DESC, created_at DESC, id DESC',
        default => 'created_at DESC, id DESC',
    };
}

function raidlands_animation_diagnostics_admin_player_order(string $sort): string
{
    return match ($sort) {
        'oldest_seen' => 'last_seen_at ASC, steam_id64 ASC',
        'events' => 'event_count DESC, last_seen_at DESC, steam_id64 ASC',
        'sessions' => 'session_count DESC, last_seen_at DESC, steam_id64 ASC',
        'loader_skips' => 'loader_skipped_count DESC, last_seen_at DESC, steam_id64 ASC',
        'effects_starts' => 'effects_start_count DESC, last_seen_at DESC, steam_id64 ASC',
        'errors' => 'error_count DESC, last_seen_at DESC, steam_id64 ASC',
        'steam' => 'steam_id64 ASC',
        default => 'last_seen_at DESC, steam_id64 ASC',
    };
}

function raidlands_animation_diagnostics_pagination(int $total, int $page, int $per_page): array
{
    $per_page = raidlands_animation_diagnostics_admin_per_page($per_page, 25);
    $pages = max(1, (int) ceil(max(0, $total) / $per_page));
    $page = max(1, min($pages, $page));

    return [
        'total' => max(0, $total),
        'page' => $page,
        'pages' => $pages,
        'per_page' => $per_page,
        'offset' => ($page - 1) * $per_page,
    ];
}

function raidlands_animation_diagnostics_admin_clean_text($value, int $max_length): string
{
    $value = trim((string) $value);
    $value = preg_replace('/\s+/', ' ', $value) ?? '';

    if ($max_length > 0 && mb_strlen($value) > $max_length) {
        return mb_substr($value, 0, $max_length);
    }

    return $value;
}

function raidlands_animation_diagnostics_admin_choice($value, array $allowed, string $default = ''): string
{
    $value = trim((string) $value);

    return in_array($value, $allowed, true) ? $value : $default;
}

function raidlands_animation_diagnostics_admin_int($value, int $min, int $max, int $default): int
{
    if (!is_numeric($value)) {
        return $default;
    }

    return max($min, min($max, (int) $value));
}

function raidlands_animation_diagnostics_admin_per_page($value, int $default): int
{
    $value = raidlands_animation_diagnostics_admin_int($value, 1, 250, $default);
    $allowed = [10, 20, 25, 50, 100, 250];

    return in_array($value, $allowed, true) ? $value : $default;
}

function raidlands_animation_diagnostics_admin_summary(): array
{
    $row = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS event_count,
                COUNT(DISTINCT steam_id64) AS player_count,
                COUNT(DISTINCT session_hash) AS session_count,
                MAX(created_at) AS last_seen_at,
                SUM(event_type = "loader_skipped") AS loader_skipped_count,
                SUM(event_type = "effects_start") AS effects_start_count,
                SUM(reduced_motion = 1) AS reduced_motion_count,
                SUM(mobile_performance = 1) AS mobile_performance_count
         FROM animation_diagnostics
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)'
    );

    return array_merge(raidlands_animation_diagnostics_empty_summary(), is_array($row) ? $row : []);
}

function raidlands_animation_diagnostics_empty_summary(): array
{
    return [
        'event_count' => 0,
        'player_count' => 0,
        'session_count' => 0,
        'last_seen_at' => null,
        'loader_skipped_count' => 0,
        'effects_start_count' => 0,
        'reduced_motion_count' => 0,
        'mobile_performance_count' => 0,
    ];
}
