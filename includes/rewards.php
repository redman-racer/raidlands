<?php

require_once __DIR__ . '/store.php';

function raidlands_rewards_tables(): array
{
    return [
        'vote_reward_sites',
        'vote_reward_claims',
        'rp_point_requests',
        'rp_game_settings',
        'rp_game_rounds',
        'rp_jackpot_rounds',
        'rp_jackpot_entries',
        'rp_game_daily_limits',
        'rp_game_self_exclusions',
    ];
}

function raidlands_rewards_table_exists(string $table): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    return raidlands_store_table_exists($table);
}

function raidlands_rewards_is_ready(): bool
{
    foreach (raidlands_rewards_tables() as $table) {
        if (!raidlands_rewards_table_exists($table)) {
            return false;
        }
    }

    return true;
}

function raidlands_rewards_readiness_message(bool $include_detail = false): string
{
    if (!raidlands_db_is_configured()) {
        return 'MySQL is not configured. Add database credentials to the root .env file.';
    }

    $missing = array_values(array_filter(
        raidlands_rewards_tables(),
        static fn (string $table): bool => !raidlands_rewards_table_exists($table)
    ));

    if ($missing === []) {
        return 'Rewards tables are installed.';
    }

    return $include_detail
        ? 'Rewards tables are not installed yet. Run database/migrations/034_vote_rewards_rp_games.sql. Missing: ' . implode(', ', $missing) . '.'
        : 'Rewards tables are not installed yet. Run database/migrations/034_vote_rewards_rp_games.sql.';
}

function raidlands_rewards_seed_defaults(): void
{
    if (!raidlands_rewards_is_ready()) {
        return;
    }

    raidlands_db_execute(
        "INSERT INTO rp_game_settings (
            id, games_enabled, coinflip_enabled, dice_enabled, jackpot_enabled,
            min_stake_rp, max_stake_rp, jackpot_ticket_cost_rp, jackpot_max_entries_per_player,
            daily_wager_cap_rp, daily_loss_cap_rp, terms_copy
         ) VALUES (
            1, 1, 1, 1, 1, 200, 2000, 200, 10, 10000, 5000,
            'RP games use in-game Raidlands RP only. RP has no cash value, outcomes are not final until the Rust server confirms the point change, and admins may pause games at any time.'
         )
         ON DUPLICATE KEY UPDATE id = id"
    );
}

function raidlands_rewards_clean_slug(string $value): string
{
    $slug = strtolower(strip_tags(trim($value)));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');

    return $slug !== '' ? substr($slug, 0, 120) : 'reward-site';
}

function raidlands_rewards_clean_mode(string $value): string
{
    $value = strtolower(trim($value));

    return in_array($value, ['hybrid', 'strict', 'manual'], true) ? $value : 'hybrid';
}

function raidlands_rewards_clean_status(string $value): string
{
    $value = strtolower(trim($value));

    return in_array($value, ['confirmed', 'rejected', 'failed'], true) ? $value : '';
}

function raidlands_rewards_bool($value): int
{
    return !empty($value) ? 1 : 0;
}

function raidlands_rewards_limit_int($value, int $min, int $max, int $default): int
{
    if (!is_numeric($value)) {
        return $default;
    }

    return max($min, min($max, (int) $value));
}

function raidlands_rewards_player_ready(?array $player): bool
{
    return is_array($player)
        && !empty($player['id'])
        && raidlands_store_validate_steam_id64((string) ($player['steam_id64'] ?? ''));
}

function raidlands_rewards_require_player(): array
{
    $player = raidlands_store_current_player();

    if (!raidlands_rewards_player_ready($player)) {
        throw new RuntimeException('Connect your Steam account before using rewards or RP games.');
    }

    return $player;
}

function raidlands_rewards_ensure_player_for_steam(PDO $pdo, string $steam_id64): array
{
    $steam_id64 = raidlands_store_normalize_steam_id64($steam_id64);

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Vote callback is missing a valid SteamID64.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO players (steam_id64, last_seen_at)
         VALUES (:steam_id64, NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()'
    );
    $statement->execute(['steam_id64' => $steam_id64]);

    $select = $pdo->prepare('SELECT id, steam_id64, display_name FROM players WHERE steam_id64 = :steam_id64 LIMIT 1');
    $select->execute(['steam_id64' => $steam_id64]);
    $player = $select->fetch(PDO::FETCH_ASSOC);

    if (!is_array($player)) {
        throw new RuntimeException('Could not create a player row for the vote callback.');
    }

    return $player;
}

function raidlands_rewards_settings(): array
{
    raidlands_rewards_seed_defaults();

    $row = raidlands_db_fetch_one('SELECT * FROM rp_game_settings WHERE id = 1');

    if ($row === null) {
        return [
            'id' => 1,
            'games_enabled' => 1,
            'coinflip_enabled' => 1,
            'dice_enabled' => 1,
            'jackpot_enabled' => 1,
            'min_stake_rp' => 200,
            'max_stake_rp' => 2000,
            'coinflip_payout_multiplier_basis' => 200,
            'dice_win_chance_percent' => 45,
            'dice_payout_multiplier_basis' => 200,
            'jackpot_ticket_cost_rp' => 200,
            'jackpot_max_entries_per_player' => 10,
            'jackpot_round_minutes' => 30,
            'jackpot_house_edge_percent' => 10,
            'daily_wager_cap_rp' => 10000,
            'daily_loss_cap_rp' => 5000,
            'self_exclusion_enabled' => 1,
            'terms_copy' => 'RP games use in-game Raidlands RP only. RP has no cash value, outcomes are not final until the Rust server confirms the point change, and admins may pause games at any time.',
        ];
    }

    foreach ([
        'games_enabled',
        'coinflip_enabled',
        'dice_enabled',
        'jackpot_enabled',
        'min_stake_rp',
        'max_stake_rp',
        'coinflip_payout_multiplier_basis',
        'dice_win_chance_percent',
        'dice_payout_multiplier_basis',
        'jackpot_ticket_cost_rp',
        'jackpot_max_entries_per_player',
        'jackpot_round_minutes',
        'jackpot_house_edge_percent',
        'daily_wager_cap_rp',
        'daily_loss_cap_rp',
        'self_exclusion_enabled',
    ] as $key) {
        $row[$key] = (int) ($row[$key] ?? 0);
    }

    return $row;
}

function raidlands_rewards_vote_sites(bool $active_only = false): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    $where = $active_only ? 'WHERE is_active = 1' : '';

    return raidlands_db_fetch_all(
        "SELECT *
         FROM vote_reward_sites
         {$where}
         ORDER BY is_active DESC, sort_order ASC, name ASC, id ASC"
    );
}

function raidlands_rewards_vote_site_by_id(int $site_id, bool $active_only = false): ?array
{
    if ($site_id <= 0 || !raidlands_rewards_is_ready()) {
        return null;
    }

    $sql = 'SELECT * FROM vote_reward_sites WHERE id = :id';

    if ($active_only) {
        $sql .= ' AND is_active = 1';
    }

    $sql .= ' LIMIT 1';

    return raidlands_db_fetch_one($sql, ['id' => $site_id]);
}

function raidlands_rewards_vote_site_by_slug(string $slug): ?array
{
    if (!raidlands_rewards_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM vote_reward_sites WHERE slug = :slug LIMIT 1',
        ['slug' => raidlands_rewards_clean_slug($slug)]
    );
}

function raidlands_rewards_vote_url(array $site, string $steam_id64): string
{
    $url = trim((string) ($site['vote_url_template'] ?? ''));

    if ($url === '') {
        return '';
    }

    return str_replace(
        ['{steam_id64}', '{steamid}', '{steam_id}', '{player}'],
        rawurlencode($steam_id64),
        $url
    );
}

function raidlands_rewards_blocking_vote_claim(int $player_id, int $site_id): ?array
{
    return raidlands_db_fetch_one(
        "SELECT *
         FROM vote_reward_claims
         WHERE player_id = :player_id
           AND site_id = :site_id
           AND status IN ('pending_callback', 'queued', 'processing', 'confirmed')
         ORDER BY claimed_at DESC, id DESC
         LIMIT 1",
        [
            'player_id' => $player_id,
            'site_id' => $site_id,
        ]
    );
}

function raidlands_rewards_vote_eligibility(array $site, ?array $player): array
{
    if (!raidlands_rewards_player_ready($player)) {
        return [
            'can_claim' => false,
            'label' => 'Link Steam',
            'next_available_at' => '',
            'last_claim' => null,
        ];
    }

    $cooldown_hours = max(1, (int) ($site['cooldown_hours'] ?? 24));
    $last_claim = raidlands_rewards_blocking_vote_claim((int) $player['id'], (int) $site['id']);

    if ($last_claim === null) {
        return [
            'can_claim' => true,
            'label' => 'Ready',
            'next_available_at' => '',
            'last_claim' => null,
        ];
    }

    $claimed_at = strtotime((string) ($last_claim['claimed_at'] ?? $last_claim['created_at'] ?? ''));
    $next = $claimed_at > 0 ? $claimed_at + ($cooldown_hours * 3600) : time() + ($cooldown_hours * 3600);
    $status = (string) ($last_claim['status'] ?? '');

    if ($next <= time() && !in_array($status, ['queued', 'processing'], true)) {
        return [
            'can_claim' => true,
            'label' => 'Ready',
            'next_available_at' => '',
            'last_claim' => $last_claim,
        ];
    }

    $label = in_array($status, ['pending_callback', 'queued', 'processing'], true)
        ? 'Pending confirmation'
        : 'Cooldown';

    return [
        'can_claim' => false,
        'label' => $label,
        'next_available_at' => gmdate('Y-m-d H:i:s', $next),
        'last_claim' => $last_claim,
    ];
}

function raidlands_rewards_recent_vote_claims(int $player_id = 0, int $limit = 12): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    $params = [];
    $where = '';

    if ($player_id > 0) {
        $where = 'WHERE c.player_id = :player_id';
        $params['player_id'] = $player_id;
    }

    return raidlands_db_fetch_all(
        "SELECT c.*, s.name AS site_name, s.slug AS site_slug, r.status AS request_status, r.message AS request_message
         FROM vote_reward_claims c
         INNER JOIN vote_reward_sites s ON s.id = c.site_id
         LEFT JOIN rp_point_requests r ON r.id = c.rp_point_request_id
         {$where}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT " . max(1, min(50, $limit)),
        $params
    );
}

function raidlands_rewards_public_vote_state(): array
{
    $ready = raidlands_rewards_is_ready();
    $player = raidlands_store_current_player();

    if (!$ready) {
        return [
            'ready' => false,
            'message' => raidlands_rewards_readiness_message(true),
            'player' => $player,
            'sites' => [],
            'claims' => [],
            'balance' => null,
        ];
    }

    raidlands_rewards_seed_defaults();
    $sites = raidlands_rewards_vote_sites(true);
    $player_id = raidlands_rewards_player_ready($player) ? (int) $player['id'] : 0;

    foreach ($sites as &$site) {
        $site['eligibility'] = raidlands_rewards_vote_eligibility($site, $player);
        $site['vote_url'] = raidlands_rewards_player_ready($player)
            ? raidlands_rewards_vote_url($site, (string) $player['steam_id64'])
            : '';
    }
    unset($site);

    return [
        'ready' => true,
        'message' => '',
        'player' => $player,
        'sites' => $sites,
        'claims' => $player_id > 0 ? raidlands_rewards_recent_vote_claims($player_id, 12) : [],
        'balance' => $player_id > 0 ? raidlands_store_current_rp_balance($player_id) : null,
    ];
}

function raidlands_rewards_queue_point_request(
    PDO $pdo,
    int $player_id,
    string $steam_id64,
    string $source_type,
    string $source_id,
    int $debit_rp,
    int $credit_rp,
    string $reason,
    array $metadata = [],
    int $expires_seconds = 3600
): array {
    $steam_id64 = raidlands_store_normalize_steam_id64($steam_id64);
    $source_type = strtolower(trim($source_type));
    $source_id = substr(trim($source_id), 0, 64);
    $debit_rp = max(0, $debit_rp);
    $credit_rp = max(0, $credit_rp);

    if ($player_id <= 0 || !raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('RP point request requires a linked Steam player.');
    }

    if (!in_array($source_type, ['vote_reward', 'coinflip', 'dice', 'jackpot_entry', 'jackpot_payout', 'admin_adjustment'], true)) {
        throw new InvalidArgumentException('Unsupported RP point request source.');
    }

    if ($debit_rp <= 0 && $credit_rp <= 0) {
        throw new InvalidArgumentException('RP point request must debit or credit at least 1 RP.');
    }

    $token = bin2hex(random_bytes(16));
    $expires_seconds = max(300, min(86400, $expires_seconds));
    $metadata_json = $metadata === []
        ? null
        : json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $statement = $pdo->prepare(
        'INSERT INTO rp_point_requests
            (request_token, player_id, steam_id64, source_type, source_id, debit_rp, credit_rp, reason, status, expires_at, metadata_json)
         VALUES
            (:request_token, :player_id, :steam_id64, :source_type, :source_id, :debit_rp, :credit_rp, :reason, "queued", DATE_ADD(NOW(), INTERVAL ' . $expires_seconds . ' SECOND), :metadata_json)'
    );
    $statement->execute([
        'request_token' => $token,
        'player_id' => $player_id,
        'steam_id64' => $steam_id64,
        'source_type' => $source_type,
        'source_id' => $source_id,
        'debit_rp' => $debit_rp,
        'credit_rp' => $credit_rp,
        'reason' => mb_substr(raidlands_store_clean_profile_text($reason, 160), 0, 160),
        'metadata_json' => $metadata_json,
    ]);

    return [
        'id' => (int) $pdo->lastInsertId(),
        'request_token' => $token,
    ];
}

function raidlands_rewards_claim_vote_reward(int $site_id): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $player = raidlands_rewards_require_player();
    $site = raidlands_rewards_vote_site_by_id($site_id, true);

    if ($site === null) {
        throw new RuntimeException('That vote reward site is not active.');
    }

    $eligibility = raidlands_rewards_vote_eligibility($site, $player);

    if (empty($eligibility['can_claim'])) {
        throw new RuntimeException('That vote reward is not ready yet: ' . (string) ($eligibility['label'] ?? 'pending') . '.');
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $mode = raidlands_rewards_clean_mode((string) ($site['verification_mode'] ?? 'hybrid'));
        $reward_rp = max(1, (int) ($site['reward_rp'] ?? 200));
        $status = $mode === 'strict' ? 'pending_callback' : 'queued';
        $message = $mode === 'strict'
            ? 'Waiting for the vote site callback before RP is queued.'
            : 'Queued for server RP confirmation.';

        $insert = $pdo->prepare(
            'INSERT INTO vote_reward_claims
                (site_id, player_id, steam_id64, claim_source, status, reward_rp, message)
             VALUES
                (:site_id, :player_id, :steam_id64, "manual", :status, :reward_rp, :message)'
        );
        $insert->execute([
            'site_id' => (int) $site['id'],
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'status' => $status,
            'reward_rp' => $reward_rp,
            'message' => $message,
        ]);
        $claim_id = (int) $pdo->lastInsertId();

        $request = null;

        if ($mode !== 'strict') {
            $request = raidlands_rewards_queue_point_request(
                $pdo,
                (int) $player['id'],
                (string) $player['steam_id64'],
                'vote_reward',
                (string) $claim_id,
                0,
                $reward_rp,
                'Vote reward: ' . (string) $site['name'],
                ['site_slug' => (string) $site['slug'], 'claim_source' => 'manual']
            );

            $update = $pdo->prepare(
                'UPDATE vote_reward_claims
                 SET rp_point_request_id = :request_id,
                     request_token = :request_token
                 WHERE id = :id'
            );
            $update->execute([
                'request_id' => $request['id'],
                'request_token' => $request['request_token'],
                'id' => $claim_id,
            ]);
        }

        if ($owns_transaction) {
            $pdo->commit();
        }

        return [
            'claim_id' => $claim_id,
            'request' => $request,
            'strict' => $mode === 'strict',
            'reward_rp' => $reward_rp,
            'site_name' => (string) $site['name'],
        ];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_handle_vote_request(): void
{
    raidlands_store_boot();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }

    $action = (string) ($_POST['action'] ?? '');

    if ($action !== 'claim_vote_reward') {
        return;
    }

    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your reward session expired. Try again.');
        }

        $result = raidlands_rewards_claim_vote_reward((int) ($_POST['site_id'] ?? 0));
        $message = !empty($result['strict'])
            ? (string) $result['site_name'] . ' claim recorded. RP will queue after the vote site callback arrives.'
            : (string) $result['site_name'] . ' reward queued for ' . raidlands_store_rp((int) $result['reward_rp']) . '. The Rust server will confirm it shortly.';

        raidlands_store_flash('success', $message);
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    raidlands_store_redirect('vote');
}

function raidlands_rewards_callback_payload(): array
{
    $body = (string) file_get_contents('php://input');
    $payload = [];

    if ($body !== '') {
        $decoded = json_decode($body, true);

        if (is_array($decoded)) {
            $payload = $decoded;
        }
    }

    return array_merge($_GET, $_POST, $payload);
}

function raidlands_rewards_handle_vote_callback(string $site_slug, string $token, array $payload): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $site = raidlands_rewards_vote_site_by_slug($site_slug);

    if ($site === null || empty($site['is_active'])) {
        throw new RuntimeException('Vote reward site is not active.');
    }

    $expected = trim((string) ($site['callback_token'] ?? ''));

    if ($expected === '' || !hash_equals($expected, trim($token))) {
        throw new RuntimeException('Vote callback token was not accepted.');
    }

    $steam_id64 = '';

    foreach (['steam_id64', 'steamid', 'steam_id', 'userid', 'user_id', 'player'] as $key) {
        if (!empty($payload[$key])) {
            $steam_id64 = raidlands_store_normalize_steam_id64($payload[$key]);
            break;
        }
    }

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new RuntimeException('Vote callback did not include a valid SteamID64.');
    }

    $external_vote_id = trim((string) ($payload['vote_id'] ?? $payload['id'] ?? $payload['transaction_id'] ?? ''));
    $external_vote_id = $external_vote_id === '' ? null : mb_substr($external_vote_id, 0, 120);
    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $player = raidlands_rewards_ensure_player_for_steam($pdo, $steam_id64);
        $reward_rp = max(1, (int) ($site['reward_rp'] ?? 200));

        if ($external_vote_id !== null) {
            $duplicate = raidlands_db_fetch_one(
                'SELECT id, status FROM vote_reward_claims WHERE site_id = :site_id AND external_vote_id = :external_vote_id LIMIT 1',
                [
                    'site_id' => (int) $site['id'],
                    'external_vote_id' => $external_vote_id,
                ]
            );

            if ($duplicate !== null) {
                if ($owns_transaction) {
                    $pdo->commit();
                }

                return ['ok' => true, 'duplicate' => true, 'claim_id' => (int) $duplicate['id'], 'status' => (string) $duplicate['status']];
            }
        }

        $pending = null;
        $select_pending = $pdo->prepare(
            "SELECT *
             FROM vote_reward_claims
             WHERE site_id = :site_id
               AND player_id = :player_id
               AND status = 'pending_callback'
             ORDER BY id DESC
             LIMIT 1
             FOR UPDATE"
        );
        $select_pending->execute([
            'site_id' => (int) $site['id'],
            'player_id' => (int) $player['id'],
        ]);
        $pending = $select_pending->fetch(PDO::FETCH_ASSOC);

        if (!is_array($pending)) {
            $blocking = raidlands_rewards_blocking_vote_claim((int) $player['id'], (int) $site['id']);
            $cooldown_hours = max(1, (int) ($site['cooldown_hours'] ?? 24));
            $claimed_at = is_array($blocking) ? strtotime((string) ($blocking['claimed_at'] ?? $blocking['created_at'] ?? '')) : 0;
            $next = $claimed_at > 0 ? $claimed_at + ($cooldown_hours * 3600) : 0;

            if (is_array($blocking) && $next > time()) {
                if ($owns_transaction) {
                    $pdo->commit();
                }

                return [
                    'ok' => true,
                    'cooldown' => true,
                    'claim_id' => (int) $blocking['id'],
                    'status' => (string) $blocking['status'],
                    'next_available_at' => gmdate('Y-m-d H:i:s', $next),
                ];
            }

            $insert = $pdo->prepare(
                'INSERT INTO vote_reward_claims
                    (site_id, player_id, steam_id64, external_vote_id, claim_source, status, reward_rp, callback_received, message)
                 VALUES
                    (:site_id, :player_id, :steam_id64, :external_vote_id, "callback", "queued", :reward_rp, 1, "Vote callback queued RP confirmation.")'
            );
            $insert->execute([
                'site_id' => (int) $site['id'],
                'player_id' => (int) $player['id'],
                'steam_id64' => (string) $player['steam_id64'],
                'external_vote_id' => $external_vote_id,
                'reward_rp' => $reward_rp,
            ]);
            $claim_id = (int) $pdo->lastInsertId();
        } else {
            $claim_id = (int) $pending['id'];
        }

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'vote_reward',
            (string) $claim_id,
            0,
            $reward_rp,
            'Vote reward: ' . (string) $site['name'],
            ['site_slug' => (string) $site['slug'], 'claim_source' => 'callback', 'external_vote_id' => $external_vote_id]
        );

        $update = $pdo->prepare(
            'UPDATE vote_reward_claims
             SET rp_point_request_id = :request_id,
                 request_token = :request_token,
                 external_vote_id = COALESCE(:external_vote_id, external_vote_id),
                 claim_source = "callback",
                 status = "queued",
                 callback_received = 1,
                 reward_rp = :reward_rp,
                 message = "Vote callback queued RP confirmation.",
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'request_id' => $request['id'],
            'request_token' => $request['request_token'],
            'external_vote_id' => $external_vote_id,
            'reward_rp' => $reward_rp,
            'id' => $claim_id,
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['ok' => true, 'claim_id' => $claim_id, 'request_id' => $request['request_token'], 'reward_rp' => $reward_rp];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_self_excluded(int $player_id): bool
{
    if ($player_id <= 0 || !raidlands_rewards_is_ready()) {
        return false;
    }

    return raidlands_db_fetch_one(
        'SELECT id
         FROM rp_game_self_exclusions
         WHERE player_id = :player_id
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         LIMIT 1',
        ['player_id' => $player_id]
    ) !== null;
}

function raidlands_rewards_daily_limit_row(int $player_id): array
{
    $row = raidlands_db_fetch_one(
        'SELECT *
         FROM rp_game_daily_limits
         WHERE player_id = :player_id AND limit_date = UTC_DATE()
         LIMIT 1',
        ['player_id' => $player_id]
    );

    return $row ?? ['wagered_rp' => 0, 'loss_rp' => 0, 'rounds_played' => 0];
}

function raidlands_rewards_check_daily_limits(array $player, array $settings, int $wager_rp, int $loss_rp): void
{
    $row = raidlands_rewards_daily_limit_row((int) $player['id']);
    $wager_cap = max(0, (int) ($settings['daily_wager_cap_rp'] ?? 0));
    $loss_cap = max(0, (int) ($settings['daily_loss_cap_rp'] ?? 0));

    if ($wager_cap > 0 && (int) $row['wagered_rp'] + $wager_rp > $wager_cap) {
        throw new RuntimeException('That would exceed your daily RP wager cap.');
    }

    if ($loss_cap > 0 && (int) $row['loss_rp'] + $loss_rp > $loss_cap) {
        throw new RuntimeException('That would exceed your daily RP loss cap.');
    }
}

function raidlands_rewards_record_daily_wager(PDO $pdo, array $player, int $wager_rp, int $loss_rp): void
{
    $statement = $pdo->prepare(
        'INSERT INTO rp_game_daily_limits
            (player_id, steam_id64, limit_date, wagered_rp, loss_rp, rounds_played)
         VALUES
            (:player_id, :steam_id64, UTC_DATE(), :wagered_rp, :loss_rp, 1)
         ON DUPLICATE KEY UPDATE
            wagered_rp = wagered_rp + VALUES(wagered_rp),
            loss_rp = loss_rp + VALUES(loss_rp),
            rounds_played = rounds_played + 1,
            updated_at = NOW()'
    );
    $statement->execute([
        'player_id' => (int) $player['id'],
        'steam_id64' => (string) $player['steam_id64'],
        'wagered_rp' => max(0, $wager_rp),
        'loss_rp' => max(0, $loss_rp),
    ]);
}

function raidlands_rewards_rollback_daily_wager(PDO $pdo, int $player_id, int $wager_rp, int $loss_rp): void
{
    $statement = $pdo->prepare(
        'UPDATE rp_game_daily_limits
         SET wagered_rp = GREATEST(0, wagered_rp - :wagered_rp),
             loss_rp = GREATEST(0, loss_rp - :loss_rp),
             rounds_played = GREATEST(0, rounds_played - 1),
             updated_at = NOW()
         WHERE player_id = :player_id AND limit_date = UTC_DATE()'
    );
    $statement->execute([
        'wagered_rp' => max(0, $wager_rp),
        'loss_rp' => max(0, $loss_rp),
        'player_id' => $player_id,
    ]);
}

function raidlands_rewards_normalize_stake($value, array $settings): int
{
    $stake = (int) $value;
    $min = max(1, (int) ($settings['min_stake_rp'] ?? 200));
    $max = max($min, (int) ($settings['max_stake_rp'] ?? 2000));

    if ($stake < $min || $stake > $max) {
        throw new RuntimeException('Stake must be between ' . raidlands_store_rp($min) . ' and ' . raidlands_store_rp($max) . '.');
    }

    return $stake;
}

function raidlands_rewards_require_games_open(array $settings, string $game_key): void
{
    if (empty($settings['games_enabled'])) {
        throw new RuntimeException('RP games are paused by admins.');
    }

    if (empty($settings[$game_key . '_enabled'])) {
        throw new RuntimeException(ucwords(str_replace('_', ' ', $game_key)) . ' is paused by admins.');
    }
}

function raidlands_rewards_play_coinflip(string $choice, int $stake): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, 'coinflip');
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    $choice = strtolower(trim($choice));

    if (!in_array($choice, ['heads', 'tails'], true)) {
        throw new InvalidArgumentException('Choose heads or tails.');
    }

    $stake = raidlands_rewards_normalize_stake($stake, $settings);
    $roll = random_int(0, 1) === 1 ? 'heads' : 'tails';
    $win = $roll === $choice;
    $multiplier = max(100, (int) ($settings['coinflip_payout_multiplier_basis'] ?? 200));
    $payout = $win ? (int) floor($stake * ($multiplier / 100)) : 0;
    $loss = $win ? 0 : $stake;

    raidlands_rewards_check_daily_limits($player, $settings, $stake, $loss);

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $insert = $pdo->prepare(
            'INSERT INTO rp_game_rounds
                (game_type, player_id, steam_id64, stake_rp, payout_rp, net_rp, odds_basis_points, player_choice, roll_result, status, message)
             VALUES
                ("coinflip", :player_id, :steam_id64, :stake_rp, :payout_rp, :net_rp, 5000, :player_choice, :roll_result, "queued", :message)'
        );
        $message = $win ? 'Won on ' . $roll . '. Waiting for server confirmation.' : 'Lost on ' . $roll . '. Waiting for server confirmation.';
        $insert->execute([
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'stake_rp' => $stake,
            'payout_rp' => $payout,
            'net_rp' => $payout - $stake,
            'player_choice' => $choice,
            'roll_result' => $roll,
            'message' => $message,
        ]);
        $round_id = (int) $pdo->lastInsertId();

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'coinflip',
            (string) $round_id,
            $stake,
            $payout,
            'RP coinflip',
            ['choice' => $choice, 'roll' => $roll, 'won' => $win]
        );

        $update = $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $round_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $loss);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['round_id' => $round_id, 'won' => $win, 'roll' => $roll, 'payout_rp' => $payout, 'stake_rp' => $stake];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_play_dice(int $stake): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, 'dice');
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    $stake = raidlands_rewards_normalize_stake($stake, $settings);
    $chance = max(1, min(95, (int) ($settings['dice_win_chance_percent'] ?? 45)));
    $threshold = 101 - $chance;
    $roll = random_int(1, 100);
    $win = $roll >= $threshold;
    $multiplier = max(100, (int) ($settings['dice_payout_multiplier_basis'] ?? 200));
    $payout = $win ? (int) floor($stake * ($multiplier / 100)) : 0;
    $loss = $win ? 0 : $stake;

    raidlands_rewards_check_daily_limits($player, $settings, $stake, $loss);

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $insert = $pdo->prepare(
            'INSERT INTO rp_game_rounds
                (game_type, player_id, steam_id64, stake_rp, payout_rp, net_rp, odds_basis_points, player_choice, roll_result, status, message)
             VALUES
                ("dice", :player_id, :steam_id64, :stake_rp, :payout_rp, :net_rp, :odds_basis_points, :player_choice, :roll_result, "queued", :message)'
        );
        $choice = 'roll ' . $threshold . '+';
        $message = $win ? 'Rolled ' . $roll . ' and won. Waiting for server confirmation.' : 'Rolled ' . $roll . ' and lost. Waiting for server confirmation.';
        $insert->execute([
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'stake_rp' => $stake,
            'payout_rp' => $payout,
            'net_rp' => $payout - $stake,
            'odds_basis_points' => $chance * 100,
            'player_choice' => $choice,
            'roll_result' => (string) $roll,
            'message' => $message,
        ]);
        $round_id = (int) $pdo->lastInsertId();

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'dice',
            (string) $round_id,
            $stake,
            $payout,
            'RP dice',
            ['threshold' => $threshold, 'roll' => $roll, 'won' => $win]
        );

        $update = $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $round_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $loss);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['round_id' => $round_id, 'won' => $win, 'roll' => $roll, 'threshold' => $threshold, 'payout_rp' => $payout, 'stake_rp' => $stake];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_active_jackpot_round(array $settings, bool $create = true): ?array
{
    if (!raidlands_rewards_is_ready() || empty($settings['jackpot_enabled']) || empty($settings['games_enabled'])) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        "SELECT *
         FROM rp_jackpot_rounds
         WHERE status = 'open'
         ORDER BY closes_at ASC, id ASC
         LIMIT 1"
    );

    if ($row !== null || !$create) {
        return $row;
    }

    $minutes = max(5, min(1440, (int) ($settings['jackpot_round_minutes'] ?? 30)));
    $round_key = 'jp-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    raidlands_db_execute(
        'INSERT INTO rp_jackpot_rounds
            (round_key, status, ticket_cost_rp, max_entries_per_player, house_edge_percent, opens_at, closes_at)
         VALUES
            (:round_key, "open", :ticket_cost_rp, :max_entries, :house_edge, NOW(), DATE_ADD(NOW(), INTERVAL ' . $minutes . ' MINUTE))',
        [
            'round_key' => $round_key,
            'ticket_cost_rp' => max(1, (int) ($settings['jackpot_ticket_cost_rp'] ?? 200)),
            'max_entries' => max(1, (int) ($settings['jackpot_max_entries_per_player'] ?? 10)),
            'house_edge' => max(0, min(50, (int) ($settings['jackpot_house_edge_percent'] ?? 10))),
        ]
    );

    return raidlands_db_fetch_one('SELECT * FROM rp_jackpot_rounds WHERE round_key = :round_key LIMIT 1', ['round_key' => $round_key]);
}

function raidlands_rewards_enter_jackpot(int $tickets): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, 'jackpot');
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    raidlands_rewards_run_due_jackpots();
    $round = raidlands_rewards_active_jackpot_round($settings, true);

    if ($round === null) {
        throw new RuntimeException('No jackpot round is open.');
    }

    $tickets = max(1, min(max(1, (int) ($settings['jackpot_max_entries_per_player'] ?? 10)), $tickets));
    $ticket_cost = max(1, (int) ($round['ticket_cost_rp'] ?? $settings['jackpot_ticket_cost_rp'] ?? 200));
    $cost = $tickets * $ticket_cost;
    raidlands_rewards_check_daily_limits($player, $settings, $cost, $cost);

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $round_statement = $pdo->prepare('SELECT * FROM rp_jackpot_rounds WHERE id = :id FOR UPDATE');
        $round_statement->execute(['id' => (int) $round['id']]);
        $locked_round = $round_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($locked_round) || (string) $locked_round['status'] !== 'open') {
            throw new RuntimeException('That jackpot round is no longer open.');
        }

        $closes_at = strtotime((string) ($locked_round['closes_at'] ?? ''));

        if ($closes_at > 0 && $closes_at <= time()) {
            throw new RuntimeException('That jackpot round is closing. Refresh and join the next round.');
        }

        $current_entries = raidlands_db_fetch_one(
            "SELECT COALESCE(SUM(ticket_count), 0) AS tickets
             FROM rp_jackpot_entries
             WHERE round_id = :round_id
               AND player_id = :player_id
               AND status IN ('queued', 'processing', 'confirmed')",
            [
                'round_id' => (int) $locked_round['id'],
                'player_id' => (int) $player['id'],
            ]
        );
        $already = (int) ($current_entries['tickets'] ?? 0);
        $max_entries = max(1, (int) ($locked_round['max_entries_per_player'] ?? 10));

        if ($already + $tickets > $max_entries) {
            throw new RuntimeException('That would exceed the per-player jackpot ticket limit for this round.');
        }

        $insert = $pdo->prepare(
            'INSERT INTO rp_jackpot_entries
                (round_id, player_id, steam_id64, ticket_count, cost_rp, status, message)
             VALUES
                (:round_id, :player_id, :steam_id64, :ticket_count, :cost_rp, "queued", "Queued for server RP debit confirmation.")'
        );
        $insert->execute([
            'round_id' => (int) $locked_round['id'],
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'ticket_count' => $tickets,
            'cost_rp' => $cost,
        ]);
        $entry_id = (int) $pdo->lastInsertId();

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'jackpot_entry',
            (string) $entry_id,
            $cost,
            0,
            'RP jackpot entry',
            ['round_id' => (int) $locked_round['id'], 'tickets' => $tickets]
        );

        $update = $pdo->prepare('UPDATE rp_jackpot_entries SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $entry_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $cost, $cost);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['entry_id' => $entry_id, 'round_id' => (int) $locked_round['id'], 'tickets' => $tickets, 'cost_rp' => $cost];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_run_due_jackpots(): void
{
    if (!raidlands_rewards_is_ready()) {
        return;
    }

    $settings = raidlands_rewards_settings();

    if (empty($settings['games_enabled']) || empty($settings['jackpot_enabled'])) {
        return;
    }

    $rounds = raidlands_db_fetch_all(
        "SELECT *
         FROM rp_jackpot_rounds
         WHERE status = 'open'
           AND closes_at IS NOT NULL
           AND closes_at <= NOW()
         ORDER BY closes_at ASC, id ASC
         LIMIT 5"
    );

    foreach ($rounds as $round) {
        raidlands_rewards_draw_jackpot_round((int) $round['id']);
    }
}

function raidlands_rewards_draw_jackpot_round(int $round_id): void
{
    if ($round_id <= 0) {
        return;
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $round_statement = $pdo->prepare('SELECT * FROM rp_jackpot_rounds WHERE id = :id FOR UPDATE');
        $round_statement->execute(['id' => $round_id]);
        $round = $round_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($round) || (string) $round['status'] !== 'open') {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $entries = raidlands_db_fetch_all(
            "SELECT *
             FROM rp_jackpot_entries
             WHERE round_id = :round_id
               AND status = 'confirmed'
             ORDER BY id ASC",
            ['round_id' => $round_id]
        );
        $total_tickets = array_sum(array_map(static fn (array $entry): int => (int) $entry['ticket_count'], $entries));

        if ($total_tickets <= 0) {
            $pending = raidlands_db_fetch_one(
                "SELECT COUNT(*) AS total
                 FROM rp_jackpot_entries
                 WHERE round_id = :round_id
                   AND status IN ('queued', 'processing')",
                ['round_id' => $round_id]
            );

            if ((int) ($pending['total'] ?? 0) > 0) {
                $update = $pdo->prepare('UPDATE rp_jackpot_rounds SET message = "Waiting for pending entry confirmations before drawing.", updated_at = NOW() WHERE id = :id');
                $update->execute(['id' => $round_id]);

                if ($owns_transaction) {
                    $pdo->commit();
                }
                return;
            }

            $update = $pdo->prepare('UPDATE rp_jackpot_rounds SET status = "canceled", message = "No confirmed entries were available for this round.", updated_at = NOW() WHERE id = :id');
            $update->execute(['id' => $round_id]);

            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $roll = random_int(1, $total_tickets);
        $cursor = 0;
        $winner = $entries[0];

        foreach ($entries as $entry) {
            $cursor += (int) $entry['ticket_count'];

            if ($roll <= $cursor) {
                $winner = $entry;
                break;
            }
        }

        $pot = array_sum(array_map(static fn (array $entry): int => (int) $entry['cost_rp'], $entries));
        $edge = max(0, min(50, (int) ($round['house_edge_percent'] ?? 10)));
        $payout = max(0, $pot - (int) floor($pot * ($edge / 100)));

        if ($payout <= 0) {
            $update = $pdo->prepare('UPDATE rp_jackpot_rounds SET status = "failed", message = "Jackpot payout would be zero.", updated_at = NOW() WHERE id = :id');
            $update->execute(['id' => $round_id]);

            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $winner['player_id'],
            (string) $winner['steam_id64'],
            'jackpot_payout',
            (string) $round_id,
            0,
            $payout,
            'RP jackpot payout',
            ['round_id' => $round_id, 'winner_entry_id' => (int) $winner['id'], 'draw_roll' => $roll, 'total_tickets' => $total_tickets]
        );

        $update = $pdo->prepare(
            'UPDATE rp_jackpot_rounds
             SET status = "payout_queued",
                 pot_rp = :pot_rp,
                 total_entries = :total_entries,
                 winner_player_id = :winner_player_id,
                 winner_steam_id64 = :winner_steam_id64,
                 winner_entry_id = :winner_entry_id,
                 payout_request_id = :payout_request_id,
                 payout_request_token = :payout_request_token,
                 payout_rp = :payout_rp,
                 draw_roll = :draw_roll,
                 message = "Winner selected. Payout queued for server confirmation.",
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'pot_rp' => $pot,
            'total_entries' => $total_tickets,
            'winner_player_id' => (int) $winner['player_id'],
            'winner_steam_id64' => (string) $winner['steam_id64'],
            'winner_entry_id' => (int) $winner['id'],
            'payout_request_id' => $request['id'],
            'payout_request_token' => $request['request_token'],
            'payout_rp' => $payout,
            'draw_roll' => $roll,
            'id' => $round_id,
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_recent_game_rounds(int $player_id = 0, int $limit = 12): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    $params = [];
    $where = '';

    if ($player_id > 0) {
        $where = 'WHERE g.player_id = :player_id';
        $params['player_id'] = $player_id;
    }

    return raidlands_db_fetch_all(
        "SELECT g.*, r.status AS request_status, r.message AS request_message
         FROM rp_game_rounds g
         LEFT JOIN rp_point_requests r ON r.id = g.rp_point_request_id
         {$where}
         ORDER BY g.created_at DESC, g.id DESC
         LIMIT " . max(1, min(50, $limit)),
        $params
    );
}

function raidlands_rewards_recent_jackpot_entries(int $player_id = 0, int $limit = 12): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    $params = [];
    $where = '';

    if ($player_id > 0) {
        $where = 'WHERE e.player_id = :player_id';
        $params['player_id'] = $player_id;
    }

    return raidlands_db_fetch_all(
        "SELECT e.*, j.round_key, j.status AS round_status, r.status AS request_status, r.message AS request_message
         FROM rp_jackpot_entries e
         INNER JOIN rp_jackpot_rounds j ON j.id = e.round_id
         LEFT JOIN rp_point_requests r ON r.id = e.rp_point_request_id
         {$where}
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT " . max(1, min(50, $limit)),
        $params
    );
}

function raidlands_rewards_recent_jackpot_rounds(int $limit = 8): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        'SELECT *
         FROM rp_jackpot_rounds
         ORDER BY created_at DESC, id DESC
         LIMIT ' . max(1, min(25, $limit))
    );
}

function raidlands_rewards_public_games_state(): array
{
    $ready = raidlands_rewards_is_ready();
    $player = raidlands_store_current_player();

    if (!$ready) {
        return [
            'ready' => false,
            'message' => raidlands_rewards_readiness_message(true),
            'player' => $player,
            'settings' => [],
            'balance' => null,
            'daily' => [],
            'active_jackpot' => null,
            'game_rounds' => [],
            'jackpot_entries' => [],
            'jackpot_rounds' => [],
        ];
    }

    raidlands_rewards_run_due_jackpots();
    $settings = raidlands_rewards_settings();
    $active_jackpot = raidlands_rewards_active_jackpot_round($settings, true);
    $player_id = raidlands_rewards_player_ready($player) ? (int) $player['id'] : 0;

    return [
        'ready' => true,
        'message' => '',
        'player' => $player,
        'settings' => $settings,
        'balance' => $player_id > 0 ? raidlands_store_current_rp_balance($player_id) : null,
        'daily' => $player_id > 0 ? raidlands_rewards_daily_limit_row($player_id) : [],
        'active_jackpot' => $active_jackpot,
        'game_rounds' => $player_id > 0 ? raidlands_rewards_recent_game_rounds($player_id, 10) : raidlands_rewards_recent_game_rounds(0, 6),
        'jackpot_entries' => $player_id > 0 ? raidlands_rewards_recent_jackpot_entries($player_id, 10) : [],
        'jackpot_rounds' => raidlands_rewards_recent_jackpot_rounds(6),
    ];
}

function raidlands_rewards_handle_games_request(): void
{
    raidlands_store_boot();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }

    $action = (string) ($_POST['action'] ?? '');

    if (!in_array($action, ['play_coinflip', 'play_dice', 'enter_jackpot'], true)) {
        return;
    }

    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your RP games session expired. Try again.');
        }

        if ($action === 'play_coinflip') {
            $result = raidlands_rewards_play_coinflip((string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            $message = $result['won']
                ? 'Coinflip hit ' . $result['roll'] . '. ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout queued for server confirmation.'
                : 'Coinflip hit ' . $result['roll'] . '. Loss queued for server confirmation.';
            raidlands_store_flash('success', $message);
        } elseif ($action === 'play_dice') {
            $result = raidlands_rewards_play_dice((int) ($_POST['stake_rp'] ?? 0));
            $message = $result['won']
                ? 'Dice rolled ' . $result['roll'] . '. ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout queued for server confirmation.'
                : 'Dice rolled ' . $result['roll'] . '. Loss queued for server confirmation.';
            raidlands_store_flash('success', $message);
        } else {
            $result = raidlands_rewards_enter_jackpot((int) ($_POST['tickets'] ?? 1));
            raidlands_store_flash('success', (string) $result['tickets'] . ' jackpot ticket' . ((int) $result['tickets'] === 1 ? '' : 's') . ' queued for ' . raidlands_store_rp((int) $result['cost_rp']) . '.');
        }
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    raidlands_store_redirect('rp-games');
}

function raidlands_rewards_bridge_point_requests(int $limit = 25): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    raidlands_rewards_run_due_jackpots();

    raidlands_db_execute(
        "UPDATE rp_point_requests
         SET status = 'expired', message = 'The server did not process this RP point request before it expired.', updated_at = NOW()
         WHERE status = 'queued' AND expires_at IS NOT NULL AND expires_at <= NOW()"
    );
    raidlands_db_execute(
        "UPDATE rp_point_requests
         SET status = 'queued', locked_at = NULL, updated_at = NOW()
         WHERE status = 'processing' AND locked_at IS NOT NULL AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    );

    $rows = raidlands_db_fetch_all(
        'SELECT *
         FROM rp_point_requests
         WHERE status = "queued"
         ORDER BY created_at ASC, id ASC
         LIMIT ' . max(1, min(100, $limit))
    );

    if ($rows === []) {
        return [];
    }

    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    [$placeholders, $params] = raidlands_store_sql_in_params($ids, 'request_id');
    raidlands_db_execute(
        'UPDATE rp_point_requests
         SET status = "processing",
             locked_at = NOW(),
             bridge_attempts = bridge_attempts + 1,
             updated_at = NOW()
         WHERE id IN (' . implode(', ', $placeholders) . ')',
        $params
    );

    return $rows;
}

function raidlands_rewards_record_point_result(array $payload): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $token = trim((string) ($payload['request_id'] ?? $payload['request_token'] ?? ''));
    $status = raidlands_rewards_clean_status((string) ($payload['status'] ?? $payload['result'] ?? ''));

    if ($token === '') {
        throw new InvalidArgumentException('RP point result is missing request_id.');
    }

    if ($status === '') {
        throw new InvalidArgumentException('RP point result has an invalid status.');
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $statement = $pdo->prepare('SELECT * FROM rp_point_requests WHERE request_token = :token FOR UPDATE');
        $statement->execute(['token' => $token]);
        $request = $statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($request)) {
            throw new RuntimeException('RP point request was not found.');
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

        $update = $pdo->prepare(
            'UPDATE rp_point_requests
             SET status = :status,
                 fail_code = :fail_code,
                 message = :message,
                 balance_before = :balance_before,
                 balance_after = :balance_after,
                 processed_at = NOW(),
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $status,
            'fail_code' => $fail_code,
            'message' => $message,
            'balance_before' => $balance_before,
            'balance_after' => $balance_after,
            'id' => (int) $request['id'],
        ]);

        raidlands_rewards_sync_source_from_point_result($pdo, $request, $status, $message, $fail_code);

        $rp_balance_synced = false;

        if ($status === 'confirmed' && $balance_after !== null) {
            $rp_balance_synced = raidlands_store_apply_reported_rp_balance(
                $pdo,
                (int) $request['player_id'],
                $balance_after
            );
        }

        if ($owns_transaction) {
            $pdo->commit();
        }

        return [
            'ok' => true,
            'request_id' => $token,
            'status' => $status,
            'rp_balance_synced' => $rp_balance_synced,
        ];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_sync_source_from_point_result(PDO $pdo, array $request, string $status, string $message, string $fail_code): void
{
    $source_type = (string) ($request['source_type'] ?? '');
    $source_id = (int) ($request['source_id'] ?? 0);
    $source_status = $status;

    if ($source_id <= 0) {
        return;
    }

    if ($source_type === 'vote_reward') {
        $update = $pdo->prepare(
            'UPDATE vote_reward_claims
             SET status = :status,
                 message = :message,
                 confirmed_at = CASE WHEN :confirmed_status = "confirmed" THEN NOW() ELSE confirmed_at END,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $source_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'RP reward confirmed by the Rust server.' : 'RP reward was not confirmed.'),
            'confirmed_status' => $status,
            'id' => $source_id,
        ]);
        return;
    }

    if (in_array($source_type, ['coinflip', 'dice'], true)) {
        $round = raidlands_db_fetch_one('SELECT * FROM rp_game_rounds WHERE id = :id LIMIT 1', ['id' => $source_id]);
        $update = $pdo->prepare(
            'UPDATE rp_game_rounds
             SET status = :status,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $source_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'Round confirmed by the Rust server.' : 'Round was not confirmed.'),
            'id' => $source_id,
        ]);

        if ($round !== null && in_array($status, ['rejected', 'failed'], true)) {
            raidlands_rewards_rollback_daily_wager(
                $pdo,
                (int) $round['player_id'],
                (int) $round['stake_rp'],
                max(0, -(int) $round['net_rp'])
            );
        }
        return;
    }

    if ($source_type === 'jackpot_entry') {
        $entry = raidlands_db_fetch_one('SELECT * FROM rp_jackpot_entries WHERE id = :id LIMIT 1', ['id' => $source_id]);
        $update = $pdo->prepare(
            'UPDATE rp_jackpot_entries
             SET status = :status,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $source_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'Jackpot entry confirmed by the Rust server.' : 'Jackpot entry was not confirmed.'),
            'id' => $source_id,
        ]);

        if ($entry !== null && $status === 'confirmed') {
            $round_update = $pdo->prepare(
                'UPDATE rp_jackpot_rounds
                 SET pot_rp = pot_rp + :cost_rp,
                     total_entries = total_entries + :ticket_count,
                     updated_at = NOW()
                 WHERE id = :round_id'
            );
            $round_update->execute([
                'cost_rp' => (int) $entry['cost_rp'],
                'ticket_count' => (int) $entry['ticket_count'],
                'round_id' => (int) $entry['round_id'],
            ]);
        } elseif ($entry !== null && in_array($status, ['rejected', 'failed'], true)) {
            raidlands_rewards_rollback_daily_wager(
                $pdo,
                (int) $entry['player_id'],
                (int) $entry['cost_rp'],
                (int) $entry['cost_rp']
            );
        }
        return;
    }

    if ($source_type === 'jackpot_payout') {
        $update = $pdo->prepare(
            'UPDATE rp_jackpot_rounds
             SET status = :status,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $round_status = $status === 'confirmed' ? 'paid' : 'failed';
        $update->execute([
            'status' => $round_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'Jackpot payout confirmed by the Rust server.' : 'Jackpot payout was not confirmed.'),
            'id' => $source_id,
        ]);
    }
}

function raidlands_rewards_admin_save_vote_sites(array $post): int
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $rows = is_array($post['vote_sites'] ?? null) ? $post['vote_sites'] : [];
    $saved = 0;

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $id = (int) ($row['id'] ?? 0);
        $name = mb_substr(raidlands_store_clean_profile_text($row['name'] ?? '', 160), 0, 160);
        $url = mb_substr(trim((string) ($row['vote_url_template'] ?? '')), 0, 700);
        $description = mb_substr(raidlands_store_clean_profile_text($row['description'] ?? '', 500), 0, 500);

        if ($id <= 0 && $name === '' && $url === '') {
            continue;
        }

        if ($name === '') {
            throw new InvalidArgumentException('Every saved vote site needs a name.');
        }

        if ($url === '') {
            throw new InvalidArgumentException('Every saved vote site needs a vote URL template.');
        }

        $slug = raidlands_rewards_clean_slug((string) ($row['slug'] ?? $name));
        $mode = raidlands_rewards_clean_mode((string) ($row['verification_mode'] ?? 'hybrid'));
        $token = mb_substr(trim((string) ($row['callback_token'] ?? '')), 0, 80);
        $reward = raidlands_rewards_limit_int($row['reward_rp'] ?? 200, 1, 1000000, 200);
        $cooldown = raidlands_rewards_limit_int($row['cooldown_hours'] ?? 24, 1, 8760, 24);
        $sort = raidlands_rewards_limit_int($row['sort_order'] ?? 100, -100000, 100000, 100);
        $active = raidlands_rewards_bool($row['is_active'] ?? null);

        if ($id > 0) {
            raidlands_db_execute(
                'UPDATE vote_reward_sites
                 SET slug = :slug,
                     name = :name,
                     description = :description,
                     vote_url_template = :vote_url_template,
                     verification_mode = :verification_mode,
                     callback_token = :callback_token,
                     reward_rp = :reward_rp,
                     cooldown_hours = :cooldown_hours,
                     is_active = :is_active,
                     sort_order = :sort_order,
                     updated_at = NOW()
                 WHERE id = :id',
                [
                    'slug' => $slug,
                    'name' => $name,
                    'description' => $description,
                    'vote_url_template' => $url,
                    'verification_mode' => $mode,
                    'callback_token' => $token,
                    'reward_rp' => $reward,
                    'cooldown_hours' => $cooldown,
                    'is_active' => $active,
                    'sort_order' => $sort,
                    'id' => $id,
                ]
            );
        } else {
            raidlands_db_execute(
                'INSERT INTO vote_reward_sites
                    (slug, name, description, vote_url_template, verification_mode, callback_token, reward_rp, cooldown_hours, is_active, sort_order)
                 VALUES
                    (:slug, :name, :description, :vote_url_template, :verification_mode, :callback_token, :reward_rp, :cooldown_hours, :is_active, :sort_order)',
                [
                    'slug' => $slug,
                    'name' => $name,
                    'description' => $description,
                    'vote_url_template' => $url,
                    'verification_mode' => $mode,
                    'callback_token' => $token,
                    'reward_rp' => $reward,
                    'cooldown_hours' => $cooldown,
                    'is_active' => $active,
                    'sort_order' => $sort,
                ]
            );
        }

        $saved += 1;
    }

    return $saved;
}

function raidlands_rewards_admin_save_game_settings(array $post): void
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    raidlands_rewards_seed_defaults();
    $terms = mb_substr(trim((string) ($post['terms_copy'] ?? '')), 0, 4000);
    $min_stake = raidlands_rewards_limit_int($post['min_stake_rp'] ?? 200, 1, 1000000, 200);
    $max_stake = raidlands_rewards_limit_int($post['max_stake_rp'] ?? 2000, 1, 1000000, 2000);
    $max_stake = max($min_stake, $max_stake);

    raidlands_db_execute(
        'UPDATE rp_game_settings
         SET games_enabled = :games_enabled,
             coinflip_enabled = :coinflip_enabled,
             dice_enabled = :dice_enabled,
             jackpot_enabled = :jackpot_enabled,
             min_stake_rp = :min_stake_rp,
             max_stake_rp = :max_stake_rp,
             coinflip_payout_multiplier_basis = :coinflip_payout_multiplier_basis,
             dice_win_chance_percent = :dice_win_chance_percent,
             dice_payout_multiplier_basis = :dice_payout_multiplier_basis,
             jackpot_ticket_cost_rp = :jackpot_ticket_cost_rp,
             jackpot_max_entries_per_player = :jackpot_max_entries_per_player,
             jackpot_round_minutes = :jackpot_round_minutes,
             jackpot_house_edge_percent = :jackpot_house_edge_percent,
             daily_wager_cap_rp = :daily_wager_cap_rp,
             daily_loss_cap_rp = :daily_loss_cap_rp,
             self_exclusion_enabled = :self_exclusion_enabled,
             terms_copy = :terms_copy,
             updated_at = NOW()
         WHERE id = 1',
        [
            'games_enabled' => raidlands_rewards_bool($post['games_enabled'] ?? null),
            'coinflip_enabled' => raidlands_rewards_bool($post['coinflip_enabled'] ?? null),
            'dice_enabled' => raidlands_rewards_bool($post['dice_enabled'] ?? null),
            'jackpot_enabled' => raidlands_rewards_bool($post['jackpot_enabled'] ?? null),
            'min_stake_rp' => $min_stake,
            'max_stake_rp' => $max_stake,
            'coinflip_payout_multiplier_basis' => raidlands_rewards_limit_int($post['coinflip_payout_multiplier_basis'] ?? 200, 100, 1000, 200),
            'dice_win_chance_percent' => raidlands_rewards_limit_int($post['dice_win_chance_percent'] ?? 45, 1, 95, 45),
            'dice_payout_multiplier_basis' => raidlands_rewards_limit_int($post['dice_payout_multiplier_basis'] ?? 200, 100, 1000, 200),
            'jackpot_ticket_cost_rp' => raidlands_rewards_limit_int($post['jackpot_ticket_cost_rp'] ?? 200, 1, 1000000, 200),
            'jackpot_max_entries_per_player' => raidlands_rewards_limit_int($post['jackpot_max_entries_per_player'] ?? 10, 1, 10000, 10),
            'jackpot_round_minutes' => raidlands_rewards_limit_int($post['jackpot_round_minutes'] ?? 30, 5, 1440, 30),
            'jackpot_house_edge_percent' => raidlands_rewards_limit_int($post['jackpot_house_edge_percent'] ?? 10, 0, 50, 10),
            'daily_wager_cap_rp' => raidlands_rewards_limit_int($post['daily_wager_cap_rp'] ?? 10000, 0, 100000000, 10000),
            'daily_loss_cap_rp' => raidlands_rewards_limit_int($post['daily_loss_cap_rp'] ?? 5000, 0, 100000000, 5000),
            'self_exclusion_enabled' => raidlands_rewards_bool($post['self_exclusion_enabled'] ?? null),
            'terms_copy' => $terms,
        ]
    );
}

function raidlands_rewards_admin_state(): array
{
    $ready = raidlands_rewards_is_ready();

    if (!$ready) {
        return [
            'ready' => false,
            'message' => raidlands_rewards_readiness_message(true),
            'settings' => [],
            'sites' => [],
            'recent_requests' => [],
            'recent_game_rounds' => [],
            'recent_jackpots' => [],
        ];
    }

    raidlands_rewards_seed_defaults();
    raidlands_rewards_run_due_jackpots();

    return [
        'ready' => true,
        'message' => '',
        'settings' => raidlands_rewards_settings(),
        'sites' => raidlands_rewards_vote_sites(false),
        'recent_requests' => raidlands_rewards_recent_point_requests(20),
        'recent_game_rounds' => raidlands_rewards_recent_game_rounds(0, 12),
        'recent_jackpots' => raidlands_rewards_recent_jackpot_rounds(10),
    ];
}

function raidlands_rewards_recent_point_requests(int $limit = 20): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        'SELECT *
         FROM rp_point_requests
         ORDER BY created_at DESC, id DESC
         LIMIT ' . max(1, min(100, $limit))
    );
}

function raidlands_rewards_admin_handle_save(string $section, array $post): string
{
    if ($section === 'vote-rewards') {
        $count = raidlands_rewards_admin_save_vote_sites($post);
        return 'Saved ' . $count . ' vote reward site' . ($count === 1 ? '' : 's') . '.';
    }

    if ($section === 'rp-games') {
        raidlands_rewards_admin_save_game_settings($post);
        return 'RP game settings saved.';
    }

    throw new InvalidArgumentException('Unknown rewards admin section.');
}
