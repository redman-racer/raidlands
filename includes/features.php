<?php

require_once __DIR__ . '/store.php';

const RAIDLANDS_FEATURE_OWNER_STEAM_ID64 = '76561198274680338';

function raidlands_features_status_options(): array
{
    return [
        'active' => 'Active',
        'planned' => 'Planned',
        'in_development' => 'In Development',
        'under_review' => 'Under Review',
        'archived' => 'Archived',
    ];
}

function raidlands_features_status_label(string $status): string
{
    $options = raidlands_features_status_options();

    return $options[$status] ?? 'Under Review';
}

function raidlands_features_status_from_label(string $status): string
{
    $normalized = strtolower(trim($status));

    if (str_starts_with($normalized, 'live') || str_contains($normalized, 'active')) {
        return 'active';
    }

    if (str_contains($normalized, 'develop') || str_contains($normalized, 'progress')) {
        return 'in_development';
    }

    if (str_contains($normalized, 'plan') || str_contains($normalized, 'next') || str_contains($normalized, 'future')) {
        return 'planned';
    }

    return 'under_review';
}

function raidlands_features_is_ready(bool $refresh = false): bool
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

    try {
        raidlands_db_required()->query('SELECT 1 FROM feature_items LIMIT 1');
        $ready = true;
    } catch (Throwable $error) {
        raidlands_features_last_error($error->getMessage());
        $ready = false;
    }

    return $ready;
}

function raidlands_features_last_error(?string $message = null): string
{
    static $last_error = '';

    if ($message !== null) {
        $last_error = $message;
    }

    return $last_error;
}

function raidlands_features_readiness_message(bool $admin = false): string
{
    if (!raidlands_db_is_configured()) {
        return $admin
            ? 'Database credentials are not configured. Add them, then run database/migrations/015_feature_planning.sql after the player and feedback migrations.'
            : 'Feature planning is being set up. Current server features are shown from the site fallback for now.';
    }

    $error = raidlands_features_last_error();

    if ($admin && $error !== '' && !str_contains($error, 'feature_items') && !str_contains($error, '42S02')) {
        return 'Feature planning database check failed: ' . $error;
    }

    return $admin
        ? 'Feature planning tables are not ready. Run database/migrations/015_feature_planning.sql.'
        : 'Feature planning is being set up. Current server features are shown from the site fallback for now.';
}

function raidlands_features_flash(?string $type = null, ?string $message = null, array $old = []): ?array
{
    raidlands_store_boot();

    if ($type !== null && $message !== null) {
        $_SESSION['raidlands_features_flash'] = [
            'type' => $type,
            'message' => $message,
            'old' => $old,
        ];

        return null;
    }

    $flash = $_SESSION['raidlands_features_flash'] ?? null;
    unset($_SESSION['raidlands_features_flash']);

    return is_array($flash) ? $flash : null;
}

function raidlands_features_handle_public_request(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }

    $action = (string) ($_POST['action'] ?? '');

    if (!in_array($action, ['submit_feature_suggestion', 'vote_feature', 'unvote_feature'], true)) {
        return;
    }

    $old = [
        'title' => (string) ($_POST['title'] ?? ''),
        'details' => (string) ($_POST['details'] ?? ''),
    ];

    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your form session expired. Try again.');
        }

        if (!raidlands_features_is_ready()) {
            throw new RuntimeException(raidlands_features_readiness_message(false));
        }

        if (trim((string) ($_POST['website'] ?? '')) !== '') {
            throw new RuntimeException('The submission could not be accepted.');
        }

        if ($action === 'submit_feature_suggestion') {
            raidlands_features_create_public_suggestion($_POST);
            raidlands_features_flash('success', 'Thanks. Your suggestion is waiting for staff review.', []);
        } elseif ($action === 'vote_feature') {
            raidlands_features_vote((int) ($_POST['feature_id'] ?? 0));
            raidlands_features_flash('success', 'Vote counted for the current wipe.');
        } else {
            raidlands_features_unvote((int) ($_POST['feature_id'] ?? 0));
            raidlands_features_flash('success', 'Vote removed for the current wipe.');
        }
    } catch (Throwable $error) {
        raidlands_features_flash('error', $error->getMessage(), $old);
    }

    $target = strtok((string) ($_SERVER['REQUEST_URI'] ?? './'), '?') ?: './';
    header('Location: ' . $target . '#feature-voting', true, 303);
    exit;
}

function raidlands_features_create_public_suggestion(array $post): int
{
    $identity = raidlands_features_current_player_identity(true);
    $title = raidlands_features_clean_text($post['title'] ?? '', 180);
    $details = raidlands_features_clean_multiline($post['details'] ?? '', 3000);

    if ($title === '' || strlen($title) < 4) {
        throw new RuntimeException('Add a short feature title so staff can group it.');
    }

    if ($details === '' || strlen($details) < 12) {
        throw new RuntimeException('Add a few details about why this feature would help.');
    }

    raidlands_db_execute(
        "INSERT INTO feature_suggestions
            (player_id, steam_id64, source_type, status, title, details, created_by_steam_id64)
         VALUES
            (:player_id, :steam_id64, 'public', 'pending', :title, :details, :created_by)",
        [
            'player_id' => (int) $identity['player_id'],
            'steam_id64' => (string) $identity['steam_id64'],
            'title' => $title,
            'details' => $details,
            'created_by' => (string) $identity['steam_id64'],
        ]
    );

    return (int) raidlands_db_required()->lastInsertId();
}

function raidlands_features_vote(int $feature_id): void
{
    if ($feature_id <= 0) {
        throw new RuntimeException('Choose a feature to vote for.');
    }

    $identity = raidlands_features_current_player_identity(true);
    $feature = raidlands_features_voteable_feature($feature_id);
    $window = raidlands_features_current_wipe_window();
    $existing = raidlands_db_fetch_one(
        'SELECT id FROM feature_votes WHERE player_id = :player_id AND feature_id = :feature_id AND vote_window_start = :window_start LIMIT 1',
        [
            'player_id' => (int) $identity['player_id'],
            'feature_id' => (int) $feature['id'],
            'window_start' => $window['start_sql'],
        ]
    );

    if ($existing !== null) {
        return;
    }

    $count = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS total FROM feature_votes WHERE player_id = :player_id AND vote_window_start = :window_start',
        [
            'player_id' => (int) $identity['player_id'],
            'window_start' => $window['start_sql'],
        ]
    );

    if ((int) ($count['total'] ?? 0) >= 3) {
        throw new RuntimeException('You already used your three feature votes for this wipe. Remove one before voting again.');
    }

    raidlands_db_execute(
        'INSERT INTO feature_votes (feature_id, player_id, steam_id64, vote_window_start, vote_window_end)
         VALUES (:feature_id, :player_id, :steam_id64, :window_start, :window_end)',
        [
            'feature_id' => (int) $feature['id'],
            'player_id' => (int) $identity['player_id'],
            'steam_id64' => (string) $identity['steam_id64'],
            'window_start' => $window['start_sql'],
            'window_end' => $window['end_sql'],
        ]
    );
}

function raidlands_features_unvote(int $feature_id): void
{
    if ($feature_id <= 0) {
        throw new RuntimeException('Choose a feature to remove your vote from.');
    }

    $identity = raidlands_features_current_player_identity(true);
    $window = raidlands_features_current_wipe_window();

    raidlands_db_execute(
        'DELETE FROM feature_votes WHERE feature_id = :feature_id AND player_id = :player_id AND vote_window_start = :window_start',
        [
            'feature_id' => $feature_id,
            'player_id' => (int) $identity['player_id'],
            'window_start' => $window['start_sql'],
        ]
    );
}

function raidlands_features_voteable_feature(int $feature_id): array
{
    $feature = raidlands_db_fetch_one(
        "SELECT * FROM feature_items
         WHERE id = :id
           AND is_public = 1
           AND is_voteable = 1
           AND public_status <> 'archived'
         LIMIT 1",
        ['id' => $feature_id]
    );

    if ($feature === null) {
        throw new RuntimeException('That feature is not open for voting.');
    }

    return $feature;
}

function raidlands_features_current_player_identity(bool $required = false): ?array
{
    $player = raidlands_store_current_player();
    $steam_id64 = is_array($player)
        ? preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? ''))
        : '';
    $steam_id64 = is_string($steam_id64) ? $steam_id64 : '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        if ($required) {
            throw new RuntimeException('Link your Steam account before suggesting or voting on features.');
        }

        return null;
    }

    if (!raidlands_features_is_ready()) {
        if ($required) {
            throw new RuntimeException(raidlands_features_readiness_message(false));
        }

        return null;
    }

    $display_name = trim((string) (($player['display_name'] ?? '') ?: ($player['steam_display_name'] ?? '')));
    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO players (steam_id64, display_name, last_seen_at)
         VALUES (:steam_id64, :display_name, NOW())
         ON DUPLICATE KEY UPDATE
           id = LAST_INSERT_ID(id),
           display_name = IF(:display_name_update_check <> "", :display_name_update_value, display_name),
           last_seen_at = NOW(),
           updated_at = NOW()'
    );
    $statement->execute([
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
        'display_name_update_check' => $display_name,
        'display_name_update_value' => $display_name,
    ]);

    $player_id = (int) $pdo->lastInsertId();

    if ($player_id <= 0) {
        $row = raidlands_db_fetch_one(
            'SELECT id FROM players WHERE steam_id64 = :steam_id64 LIMIT 1',
            ['steam_id64' => $steam_id64]
        );
        $player_id = (int) ($row['id'] ?? 0);
    }

    if ($player_id <= 0) {
        throw new RuntimeException('Your linked Steam account could not be prepared for voting.');
    }

    return [
        'player_id' => $player_id,
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
    ];
}

function raidlands_features_current_wipe_window(?DateTimeImmutable $now = null): array
{
    global $site_config;

    $timezone_name = (string) ($site_config['wipe']['timezone'] ?? 'America/Chicago');

    try {
        $timezone = new DateTimeZone($timezone_name);
    } catch (Throwable $error) {
        $timezone = new DateTimeZone('UTC');
        $timezone_name = 'UTC';
    }

    $now = $now === null ? new DateTimeImmutable('now', $timezone) : $now->setTimezone($timezone);
    $days = array_values(array_unique(array_map('intval', (array) ($site_config['wipe']['days'] ?? [4]))));
    $days = array_values(array_filter($days, static fn (int $day): bool => $day >= 0 && $day <= 6));
    $days = $days === [] ? [4] : $days;
    $time = (string) ($site_config['wipe']['time'] ?? '19:00');

    if (!preg_match('/^(\d{2}):(\d{2})$/', $time, $matches)) {
        $matches = [0, '19', '00'];
    }

    $hour = max(0, min(23, (int) $matches[1]));
    $minute = max(0, min(59, (int) $matches[2]));
    $today_midnight = $now->setTime(0, 0, 0);
    $current_day = (int) $now->format('w');
    $previous = null;
    $next = null;

    foreach ($days as $day) {
        foreach ([-14, -7, 0, 7, 14] as $offset) {
            $diff = $day - $current_day + $offset;
            $candidate = $today_midnight
                ->modify(($diff >= 0 ? '+' : '') . $diff . ' days')
                ->setTime($hour, $minute, 0);

            if ($candidate <= $now && ($previous === null || $candidate > $previous)) {
                $previous = $candidate;
            }

            if ($candidate > $now && ($next === null || $candidate < $next)) {
                $next = $candidate;
            }
        }
    }

    if ($previous === null) {
        $previous = $now->modify('-7 days');
    }

    if ($next === null || $next <= $previous) {
        $next = $previous->modify('+7 days');
    }

    $previous_utc = $previous->setTimezone(new DateTimeZone('UTC'));
    $next_utc = $next->setTimezone(new DateTimeZone('UTC'));

    return [
        'start' => $previous,
        'end' => $next,
        'start_sql' => $previous_utc->format('Y-m-d H:i:s'),
        'end_sql' => $next_utc->format('Y-m-d H:i:s'),
        'label' => $previous->format('M j, g:i A') . ' - ' . $next->format('M j, g:i A T'),
        'expires_label' => $next->format('M j, g:i A T'),
        'timezone' => $timezone_name,
    ];
}

function raidlands_features_public_state(): array
{
    if (!raidlands_features_is_ready()) {
        return [
            'ready' => false,
            'message' => raidlands_features_readiness_message(false),
            'sections' => [],
            'voteable' => [],
            'user_votes' => [],
            'votes_remaining' => 0,
            'window' => raidlands_features_current_wipe_window(),
        ];
    }

    raidlands_features_seed_defaults();

    $window = raidlands_features_current_wipe_window();
    $features = raidlands_features_public_items($window);
    $identity = raidlands_features_current_player_identity(false);
    $user_votes = [];

    if ($identity !== null) {
        $rows = raidlands_db_fetch_all(
            'SELECT feature_id FROM feature_votes WHERE player_id = :player_id AND vote_window_start = :window_start',
            [
                'player_id' => (int) $identity['player_id'],
                'window_start' => $window['start_sql'],
            ]
        );

        foreach ($rows as $row) {
            $user_votes[(int) $row['feature_id']] = true;
        }
    }

    $sections = [
        'active' => [],
        'in_development' => [],
        'planned' => [],
        'under_review' => [],
    ];
    $voteable = [];

    foreach ($features as $feature) {
        $status = (string) ($feature['public_status'] ?? 'under_review');

        if (isset($sections[$status])) {
            $sections[$status][] = $feature;
        }

        if (!empty($feature['is_voteable'])) {
            $voteable[] = $feature;
        }
    }

    usort(
        $voteable,
        static fn (array $a, array $b): int => ((int) ($b['support_score'] ?? 0) <=> (int) ($a['support_score'] ?? 0))
            ?: ((int) ($b['suggestion_count'] ?? 0) <=> (int) ($a['suggestion_count'] ?? 0))
            ?: ((int) ($a['sort_order'] ?? 100) <=> (int) ($b['sort_order'] ?? 100))
            ?: strnatcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''))
    );

    return [
        'ready' => true,
        'message' => '',
        'sections' => $sections,
        'voteable' => $voteable,
        'identity' => $identity,
        'user_votes' => $user_votes,
        'votes_remaining' => max(0, 3 - count($user_votes)),
        'window' => $window,
    ];
}

function raidlands_features_public_items(array $window): array
{
    $items = raidlands_db_fetch_all(
        "SELECT *
         FROM feature_items
         WHERE is_public = 1
           AND public_status <> 'archived'
         ORDER BY FIELD(public_status, 'active', 'in_development', 'planned', 'under_review', 'archived'), sort_order ASC, title ASC"
    );

    return raidlands_features_attach_scores($items, $window);
}

function raidlands_features_attach_scores(array $items, array $window): array
{
    $ids = array_values(array_filter(array_map(static fn (array $item): int => (int) ($item['id'] ?? 0), $items)));

    if ($ids === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $vote_rows = raidlands_features_fetch_all_positional(
        "SELECT feature_id, steam_id64
         FROM feature_votes
         WHERE vote_window_start = ?
           AND feature_id IN ($placeholders)",
        array_merge([$window['start_sql']], $ids)
    );
    $suggestion_rows = raidlands_features_fetch_all_positional(
        "SELECT feature_id, steam_id64
         FROM feature_suggestions
         WHERE status = 'grouped'
           AND feature_id IN ($placeholders)",
        $ids
    );
    $scores = [];

    foreach ($ids as $id) {
        $scores[$id] = [
            'votes' => [],
            'suggesters' => [],
            'supporters' => [],
            'suggestion_count' => 0,
        ];
    }

    foreach ($vote_rows as $row) {
        $feature_id = (int) ($row['feature_id'] ?? 0);
        $steam_id64 = (string) ($row['steam_id64'] ?? '');

        if ($feature_id <= 0 || $steam_id64 === '' || !isset($scores[$feature_id])) {
            continue;
        }

        $scores[$feature_id]['votes'][$steam_id64] = true;
        $scores[$feature_id]['supporters'][$steam_id64] = true;
    }

    foreach ($suggestion_rows as $row) {
        $feature_id = (int) ($row['feature_id'] ?? 0);
        $steam_id64 = (string) ($row['steam_id64'] ?? '');

        if ($feature_id <= 0 || !isset($scores[$feature_id])) {
            continue;
        }

        $scores[$feature_id]['suggestion_count'] += 1;

        if ($steam_id64 !== '') {
            $scores[$feature_id]['suggesters'][$steam_id64] = true;
            $scores[$feature_id]['supporters'][$steam_id64] = true;
        }
    }

    foreach ($items as &$item) {
        $id = (int) ($item['id'] ?? 0);
        $score = $scores[$id] ?? ['votes' => [], 'suggesters' => [], 'supporters' => [], 'suggestion_count' => 0];
        $item['vote_count'] = count($score['votes']);
        $item['suggestion_count'] = (int) $score['suggestion_count'];
        $item['suggested_by_count'] = count($score['suggesters']);
        $item['support_score'] = count($score['supporters']);
        $item['status_label'] = raidlands_features_status_label((string) ($item['public_status'] ?? 'under_review'));
    }
    unset($item);

    return $items;
}

function raidlands_features_fetch_all_positional(string $sql, array $params = []): array
{
    $statement = raidlands_db_required()->prepare($sql);
    $statement->execute($params);

    return $statement->fetchAll();
}

function raidlands_features_seed_defaults(): int
{
    static $seeded = false;

    if ($seeded || !raidlands_features_is_ready()) {
        return 0;
    }

    $seeded = true;
    $row = raidlands_db_fetch_one('SELECT COUNT(*) AS total FROM feature_items');

    if ((int) ($row['total'] ?? 0) > 0) {
        return 0;
    }

    global $feature_cards, $roadmap_cards;

    $created = 0;
    $sort = 10;

    foreach ((array) $feature_cards as $card) {
        $title = (string) ($card[1] ?? '');

        if ($title === '') {
            continue;
        }

        raidlands_features_save_item([
            'icon_alias' => (string) ($card[0] ?? 'EVENT'),
            'title' => $title,
            'summary' => (string) ($card[2] ?? ''),
            'category' => raidlands_features_category_for_title($title),
            'public_status' => raidlands_features_status_from_label((string) ($card[3] ?? 'active')),
            'is_public' => 1,
            'is_voteable' => 0,
            'sort_order' => $sort,
        ], null);
        $created += 1;
        $sort += 10;
    }

    foreach ((array) $roadmap_cards as $card) {
        $title = (string) ($card[0] ?? '');

        if ($title === '') {
            continue;
        }

        $status = raidlands_features_status_from_label((string) ($card[2] ?? 'planned'));
        raidlands_features_save_item([
            'icon_alias' => raidlands_features_icon_for_title($title),
            'title' => $title,
            'summary' => (string) ($card[1] ?? ''),
            'category' => raidlands_features_category_for_title($title),
            'public_status' => $status,
            'is_public' => 1,
            'is_voteable' => $status !== 'active' ? 1 : 0,
            'sort_order' => $sort,
        ], null);
        $created += 1;
        $sort += 10;
    }

    return $created;
}

function raidlands_features_admin_state(): array
{
    if (!raidlands_features_is_ready()) {
        return [
            'ready' => false,
            'error' => raidlands_features_readiness_message(true),
            'features' => [],
            'pending_suggestions' => [],
            'grouped_suggestions' => [],
            'feedback_import_count' => 0,
            'window' => raidlands_features_current_wipe_window(),
        ];
    }

    raidlands_features_seed_defaults();

    $features = raidlands_features_admin_items();
    $pending = raidlands_db_fetch_all(
        "SELECT fs.*, sf.public_id AS feedback_public_id, sf.status AS feedback_status
         FROM feature_suggestions fs
         LEFT JOIN support_feedback sf ON sf.id = fs.support_feedback_id
         WHERE fs.status = 'pending'
         ORDER BY fs.created_at DESC, fs.id DESC
         LIMIT 100"
    );
    $grouped = raidlands_db_fetch_all(
        "SELECT fs.*, fi.title AS feature_title
         FROM feature_suggestions fs
         LEFT JOIN feature_items fi ON fi.id = fs.feature_id
         WHERE fs.status IN ('grouped', 'rejected')
         ORDER BY fs.updated_at DESC, fs.id DESC
         LIMIT 40"
    );

    foreach ($pending as &$suggestion) {
        $suggestion['matches'] = raidlands_features_suggest_matches($suggestion, $features);
    }
    unset($suggestion);

    return [
        'ready' => true,
        'error' => '',
        'features' => $features,
        'pending_suggestions' => $pending,
        'grouped_suggestions' => $grouped,
        'feedback_import_count' => raidlands_features_feedback_import_count(),
        'window' => raidlands_features_current_wipe_window(),
    ];
}

function raidlands_features_admin_items(): array
{
    return raidlands_db_fetch_all(
        "SELECT *
         FROM feature_items
         ORDER BY FIELD(public_status, 'active', 'in_development', 'planned', 'under_review', 'archived'), sort_order ASC, title ASC, id ASC"
    );
}

function raidlands_features_admin_save(array $post): string
{
    if (!raidlands_features_is_ready()) {
        throw new RuntimeException(raidlands_features_readiness_message(true));
    }

    $admin_action = (string) ($post['features_admin_action'] ?? '');

    if ($admin_action === 'import_feedback') {
        $imported = raidlands_features_import_feedback_requests();

        return $imported === 1
            ? 'Imported 1 feature request from feedback.'
            : 'Imported ' . $imported . ' feature requests from feedback.';
    }

    $saved = raidlands_features_admin_save_items($post['feature_items'] ?? []);
    $suggestion_message = raidlands_features_admin_handle_suggestion_action($post);

    return trim('Feature planner saved. ' . $saved . ' feature row' . ($saved === 1 ? '' : 's') . ' updated. ' . $suggestion_message);
}

function raidlands_features_admin_save_items($input): int
{
    $saved = 0;

    foreach ((array) $input as $row) {
        if (!is_array($row)) {
            continue;
        }

        $id = (int) ($row['id'] ?? 0);
        $title = raidlands_features_clean_text($row['title'] ?? '', 180);

        if ($id <= 0 && $title === '') {
            continue;
        }

        if ($id > 0 && $title === '') {
            throw new RuntimeException('Existing feature rows need a title.');
        }

        $row['title'] = $title;
        raidlands_features_save_item($row, $id > 0 ? $id : null);
        $saved += 1;
    }

    return $saved;
}

function raidlands_features_save_item(array $row, ?int $id): int
{
    $title = raidlands_features_clean_text($row['title'] ?? '', 180);

    if ($title === '') {
        throw new RuntimeException('Feature title is required.');
    }

    $status = (string) ($row['public_status'] ?? 'under_review');

    if (!isset(raidlands_features_status_options()[$status])) {
        $status = 'under_review';
    }

    if (!empty($row['archived'])) {
        $status = 'archived';
    }

    $slug = raidlands_features_unique_slug(
        raidlands_features_clean_slug((string) ($row['slug'] ?? $title)),
        $id
    );
    $data = [
        'slug' => $slug,
        'icon_alias' => strtoupper(raidlands_features_clean_text($row['icon_alias'] ?? raidlands_features_icon_for_title($title), 32)),
        'title' => $title,
        'summary' => raidlands_features_clean_text($row['summary'] ?? '', 500),
        'category' => raidlands_features_clean_text($row['category'] ?? '', 120),
        'public_status' => $status,
        'is_public' => empty($row['is_public']) ? 0 : 1,
        'is_voteable' => empty($row['is_voteable']) || $status === 'archived' ? 0 : 1,
        'sort_order' => raidlands_features_int($row['sort_order'] ?? 100, 0, 9999),
        'created_by_steam_id64' => raidlands_features_admin_actor_steam(),
    ];

    if ($id !== null) {
        $update_data = $data;
        unset($update_data['created_by_steam_id64']);

        raidlands_db_execute(
            'UPDATE feature_items
             SET slug = :slug,
                 icon_alias = :icon_alias,
                 title = :title,
                 summary = :summary,
                 category = :category,
                 public_status = :public_status,
                 is_public = :is_public,
                 is_voteable = :is_voteable,
                 sort_order = :sort_order
             WHERE id = :id',
            array_merge($update_data, ['id' => $id])
        );

        return $id;
    }

    raidlands_db_execute(
        'INSERT INTO feature_items
            (slug, icon_alias, title, summary, category, public_status, is_public, is_voteable, sort_order, created_by_steam_id64)
         VALUES
            (:slug, :icon_alias, :title, :summary, :category, :public_status, :is_public, :is_voteable, :sort_order, :created_by_steam_id64)',
        $data
    );

    return (int) raidlands_db_required()->lastInsertId();
}

function raidlands_features_admin_handle_suggestion_action(array $post): string
{
    $action = (string) ($post['feature_suggestion_action'] ?? '');

    if ($action === '' || !str_contains($action, ':')) {
        return '';
    }

    [$verb, $id_text] = explode(':', $action, 2);
    $suggestion_id = (int) $id_text;

    if ($suggestion_id <= 0) {
        return '';
    }

    $suggestion = raidlands_db_fetch_one(
        "SELECT * FROM feature_suggestions WHERE id = :id AND status = 'pending' LIMIT 1",
        ['id' => $suggestion_id]
    );

    if ($suggestion === null) {
        throw new RuntimeException('That suggestion is no longer pending.');
    }

    if ($verb === 'group') {
        $targets = is_array($post['suggestion_feature_id'] ?? null) ? $post['suggestion_feature_id'] : [];
        $feature_id = (int) ($targets[$suggestion_id] ?? 0);

        if ($feature_id <= 0) {
            throw new RuntimeException('Choose a feature to group the suggestion into.');
        }

        raidlands_db_execute(
            "UPDATE feature_suggestions
             SET feature_id = :feature_id,
                 status = 'grouped',
                 admin_note = :admin_note,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'feature_id' => $feature_id,
                'admin_note' => raidlands_features_clean_multiline($post['suggestion_admin_note'][$suggestion_id] ?? '', 1200),
                'id' => $suggestion_id,
            ]
        );

        return 'Suggestion grouped.';
    }

    if ($verb === 'approve') {
        $feature_id = raidlands_features_save_item([
            'icon_alias' => raidlands_features_icon_for_title((string) $suggestion['title']),
            'title' => (string) $suggestion['title'],
            'summary' => raidlands_features_clean_text($suggestion['details'] ?? '', 500),
            'category' => 'Player Suggestions',
            'public_status' => 'under_review',
            'is_public' => 1,
            'is_voteable' => 1,
            'sort_order' => 500,
        ], null);
        raidlands_db_execute(
            "UPDATE feature_suggestions
             SET feature_id = :feature_id,
                 status = 'grouped',
                 admin_note = :admin_note,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'feature_id' => $feature_id,
                'admin_note' => raidlands_features_clean_multiline($post['suggestion_admin_note'][$suggestion_id] ?? 'Approved as a new feature candidate.', 1200),
                'id' => $suggestion_id,
            ]
        );

        return 'Suggestion approved as a new feature.';
    }

    if ($verb === 'reject') {
        raidlands_db_execute(
            "UPDATE feature_suggestions
             SET status = 'rejected',
                 admin_note = :admin_note,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'admin_note' => raidlands_features_clean_multiline($post['suggestion_admin_note'][$suggestion_id] ?? '', 1200),
                'id' => $suggestion_id,
            ]
        );

        return 'Suggestion rejected.';
    }

    return '';
}

function raidlands_features_import_feedback_requests(int $limit = 250): int
{
    if (!raidlands_features_is_ready()) {
        throw new RuntimeException(raidlands_features_readiness_message(true));
    }

    try {
        $rows = raidlands_db_fetch_all(
            "SELECT sf.*, p.steam_id64 AS player_steam_id64
             FROM support_feedback sf
             LEFT JOIN players p ON p.id = sf.player_id
             LEFT JOIN feature_suggestions fs ON fs.support_feedback_id = sf.id
             WHERE sf.type = 'feature_request'
               AND fs.id IS NULL
             ORDER BY sf.submitted_at ASC, sf.id ASC
             LIMIT " . max(1, min(500, $limit))
        );
    } catch (Throwable $error) {
        return 0;
    }

    $imported = 0;

    foreach ($rows as $row) {
        $steam_id64 = raidlands_features_valid_steam_or_owner((string) ($row['steam_id64'] ?: ($row['player_steam_id64'] ?? '')));
        $source_type = $steam_id64 === RAIDLANDS_FEATURE_OWNER_STEAM_ID64 && empty($row['steam_id64']) && empty($row['player_steam_id64'])
            ? 'staff_import'
            : 'feedback';

        raidlands_db_execute(
            'INSERT INTO feature_suggestions
                (support_feedback_id, player_id, steam_id64, source_type, status, title, details, admin_note, created_by_steam_id64, created_at, updated_at)
             VALUES
                (:support_feedback_id, :player_id, :steam_id64, :source_type, "pending", :title, :details, :admin_note, :created_by, :created_at, :updated_at)',
            [
                'support_feedback_id' => (int) $row['id'],
                'player_id' => (int) ($row['player_id'] ?? 0) > 0 ? (int) $row['player_id'] : null,
                'steam_id64' => $steam_id64,
                'source_type' => $source_type,
                'title' => raidlands_features_clean_text($row['summary'] ?? '', 180) ?: 'Feature request',
                'details' => raidlands_features_clean_multiline($row['details'] ?? '', 3000),
                'admin_note' => 'Imported from support feedback ' . (string) ($row['public_id'] ?? $row['id']) . '.',
                'created_by' => RAIDLANDS_FEATURE_OWNER_STEAM_ID64,
                'created_at' => (string) ($row['submitted_at'] ?? date('Y-m-d H:i:s')),
                'updated_at' => (string) ($row['updated_at'] ?? date('Y-m-d H:i:s')),
            ]
        );
        $imported += 1;
    }

    return $imported;
}

function raidlands_features_feedback_import_count(): int
{
    try {
        $row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM support_feedback sf
             LEFT JOIN feature_suggestions fs ON fs.support_feedback_id = sf.id
             WHERE sf.type = 'feature_request'
               AND fs.id IS NULL"
        );

        return (int) ($row['total'] ?? 0);
    } catch (Throwable $error) {
        return 0;
    }
}

function raidlands_features_suggest_matches(array $suggestion, array $features): array
{
    $suggestion_tokens = raidlands_features_tokens(
        (string) ($suggestion['title'] ?? '') . ' ' . (string) ($suggestion['details'] ?? '')
    );
    $matches = [];

    foreach ($features as $feature) {
        if ((string) ($feature['public_status'] ?? '') === 'archived') {
            continue;
        }

        $feature_tokens = raidlands_features_tokens(
            (string) ($feature['title'] ?? '') . ' ' . (string) ($feature['summary'] ?? '') . ' ' . (string) ($feature['category'] ?? '')
        );
        $overlap = array_intersect_key($suggestion_tokens, $feature_tokens);
        $score = count($overlap);
        $suggestion_title = strtolower((string) ($suggestion['title'] ?? ''));
        $feature_title = strtolower((string) ($feature['title'] ?? ''));

        if ($suggestion_title !== '' && $feature_title !== '' && (str_contains($suggestion_title, $feature_title) || str_contains($feature_title, $suggestion_title))) {
            $score += 4;
        }

        if ($score <= 0) {
            continue;
        }

        $matches[] = [
            'feature' => $feature,
            'score' => $score,
            'tokens' => array_slice(array_keys($overlap), 0, 6),
        ];
    }

    usort($matches, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

    return array_slice($matches, 0, 3);
}

function raidlands_features_tokens(string $text): array
{
    $stop = array_flip(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'next', 'feature', 'server', 'raidlands', 'rust']);
    $parts = preg_split('/[^a-z0-9]+/', strtolower($text)) ?: [];
    $tokens = [];

    foreach ($parts as $part) {
        $part = trim($part);

        if (strlen($part) < 3 || isset($stop[$part])) {
            continue;
        }

        $tokens[$part] = true;
    }

    return $tokens;
}

function raidlands_features_clean_slug(string $value): string
{
    $slug = strtolower(strip_tags(trim($value)));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');

    return raidlands_features_limit($slug !== '' ? $slug : 'feature', 120);
}

function raidlands_features_unique_slug(string $base, ?int $ignore_id = null): string
{
    $base = raidlands_features_clean_slug($base);
    $slug = $base;
    $index = 2;

    while (true) {
        $params = ['slug' => $slug];
        $sql = 'SELECT id FROM feature_items WHERE slug = :slug';

        if ($ignore_id !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $ignore_id;
        }

        $sql .= ' LIMIT 1';

        if (raidlands_db_fetch_one($sql, $params) === null) {
            return $slug;
        }

        $suffix = '-' . $index;
        $slug = raidlands_features_limit($base, 120 - strlen($suffix)) . $suffix;
        $index += 1;
    }
}

function raidlands_features_icon_for_title(string $title): string
{
    $title = strtolower($title);

    if (str_contains($title, 'leaderboard') || str_contains($title, 'stat')) {
        return 'STAT';
    }

    if (str_contains($title, 'profile') || str_contains($title, 'account') || str_contains($title, 'link')) {
        return 'ID';
    }

    if (str_contains($title, 'kit')) {
        return 'KIT';
    }

    if (str_contains($title, 'clan')) {
        return 'CLAN';
    }

    if (str_contains($title, 'vote') || str_contains($title, 'reward')) {
        return 'PLAY';
    }

    if (str_contains($title, 'appeal') || str_contains($title, 'ban')) {
        return 'APPEAL';
    }

    if (str_contains($title, 'staff') || str_contains($title, 'support')) {
        return 'STAFF';
    }

    if (str_contains($title, 'shop') || str_contains($title, 'store')) {
        return 'SHOP';
    }

    return 'EVENT';
}

function raidlands_features_category_for_title(string $title): string
{
    $title = strtolower($title);

    if (str_contains($title, 'pvp') || str_contains($title, 'raid') || str_contains($title, 'gather')) {
        return 'Combat and Raiding';
    }

    if (str_contains($title, 'teleport') || str_contains($title, 'home') || str_contains($title, 'mini') || str_contains($title, 'backpack') || str_contains($title, 'skin') || str_contains($title, 'shop')) {
        return 'Movement and Convenience';
    }

    if (str_contains($title, 'clan') || str_contains($title, 'event')) {
        return 'Community and Clans';
    }

    if (str_contains($title, 'profile') || str_contains($title, 'leaderboard') || str_contains($title, 'account')) {
        return 'Website Systems';
    }

    return 'Trust and Performance';
}

function raidlands_features_admin_actor_steam(): string
{
    if (function_exists('raidlands_admin_current_user')) {
        $user = raidlands_admin_current_user();

        if (is_array($user) && raidlands_store_validate_steam_id64((string) ($user['steam_id64'] ?? ''))) {
            return (string) $user['steam_id64'];
        }
    }

    return RAIDLANDS_FEATURE_OWNER_STEAM_ID64;
}

function raidlands_features_valid_steam_or_owner(string $steam_id64): string
{
    $steam_id64 = preg_replace('/\D+/', '', $steam_id64) ?? '';
    $steam_id64 = is_string($steam_id64) ? $steam_id64 : '';

    return raidlands_store_validate_steam_id64($steam_id64) ? $steam_id64 : RAIDLANDS_FEATURE_OWNER_STEAM_ID64;
}

function raidlands_features_clean_text($value, int $max_length = 500): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    return raidlands_features_limit($text, $max_length);
}

function raidlands_features_clean_multiline($value, int $max_length = 2000): string
{
    $text = str_replace("\0", '', (string) $value);
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = strip_tags($text);
    $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

    return raidlands_features_limit(trim($text), $max_length);
}

function raidlands_features_limit(string $text, int $max_length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_features_int($value, int $min, int $max): int
{
    $number = is_numeric($value) ? (int) $value : $min;

    return max($min, min($max, $number));
}
