<?php

require_once __DIR__ . '/store.php';
require_once __DIR__ . '/monument-extraction.php';
require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/casino-games.php';

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

function raidlands_rewards_enum_allows(string $table, string $column, string $value): bool
{
    static $cache = [];

    $key = $table . '.' . $column;
    $value = trim($value);

    if ($value === '' || !raidlands_db_is_configured()) {
        return false;
    }

    if (!isset($cache[$key])) {
        try {
            $row = raidlands_db_fetch_one(
                'SELECT COLUMN_TYPE
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = :table_name
                   AND COLUMN_NAME = :column_name
                 LIMIT 1',
                [
                    'table_name' => $table,
                    'column_name' => $column,
                ]
            );
            $cache[$key] = (string) ($row['COLUMN_TYPE'] ?? '');
        } catch (Throwable $error) {
            $cache[$key] = '';
        }
    }

    return $cache[$key] !== ''
        && preg_match("/'(" . preg_quote($value, '/') . ")'/", $cache[$key]) === 1;
}

function raidlands_rewards_game_backend_ready(string $game_key): bool
{
    if (in_array($game_key, ['coinflip', 'dice', 'jackpot'], true)) {
        return true;
    }

    if ($game_key === 'monument_extraction') {
        return raidlands_monument_is_ready();
    }

    if (in_array($game_key, ['raid_duel', 'supply_run'], true)) {
        return raidlands_rewards_pool_backend_ready($game_key);
    }

    if (in_array($game_key, ['roulette', 'slots', 'blackjack'], true)) {
        return raidlands_casino_backend_ready($game_key);
    }

    if (!in_array($game_key, ['high_low', 'wheel'], true)) {
        return false;
    }

    return raidlands_rewards_enum_allows('rp_game_rounds', 'game_type', $game_key)
        && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', $game_key);
}

function raidlands_rewards_pool_games(): array
{
    return [
        'raid_duel' => [
            'label' => 'Raid Duel',
            'short_label' => 'Duel',
            'kicker' => 'PvP pool',
            'prefix' => 'duel',
            'entry_source' => 'raid_duel_entry',
            'payout_source' => 'raid_duel_payout',
            'description' => 'Back raiders or defenders before the round closes. The winning side splits the confirmed pot after house edge.',
            'options' => [
                'raiders' => ['label' => 'Raiders', 'chance' => 50],
                'defenders' => ['label' => 'Defenders', 'chance' => 50],
            ],
        ],
        'supply_run' => [
            'label' => 'Supply Run',
            'short_label' => 'Supply',
            'kicker' => 'PvE pool',
            'prefix' => 'supply',
            'entry_source' => 'supply_run_entry',
            'payout_source' => 'supply_run_payout',
            'description' => 'Pick the route the convoy survives. Riskier routes hit less often, but crowding changes the payout split.',
            'options' => [
                'river' => ['label' => 'River Route', 'chance' => 55],
                'scrapyard' => ['label' => 'Scrapyard Push', 'chance' => 30],
                'launch' => ['label' => 'Launch Run', 'chance' => 15],
            ],
        ],
    ];
}

function raidlands_rewards_pool_game(string $game_type): ?array
{
    $game_type = strtolower(trim($game_type));
    $games = raidlands_rewards_pool_games();

    return $games[$game_type] ?? null;
}

function raidlands_rewards_pool_backend_ready(string $game_type = ''): bool
{
    if (!raidlands_db_is_configured()
        || !raidlands_rewards_table_exists('rp_pool_rounds')
        || !raidlands_rewards_table_exists('rp_pool_entries')
        || !raidlands_store_table_has_columns('rp_game_settings', [
            'raid_duel_enabled',
            'supply_run_enabled',
            'pool_round_minutes',
            'pool_house_edge_percent',
        ])) {
        return false;
    }

    $games = raidlands_rewards_pool_games();

    if ($game_type !== '') {
        $game = $games[$game_type] ?? null;

        return $game !== null
            && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', (string) $game['entry_source'])
            && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', (string) $game['payout_source']);
    }

    foreach ($games as $game) {
        if (!raidlands_rewards_enum_allows('rp_point_requests', 'source_type', (string) $game['entry_source'])
            || !raidlands_rewards_enum_allows('rp_point_requests', 'source_type', (string) $game['payout_source'])) {
            return false;
        }
    }

    return true;
}

function raidlands_rewards_is_ready(): bool
{
    foreach (raidlands_rewards_tables() as $table) {
        if (!raidlands_rewards_table_exists($table)) {
            return false;
        }
    }

    return raidlands_rewards_vote_site_provider_columns_ready();
}

function raidlands_rewards_readiness_message(bool $include_detail = false): string
{
    if (!raidlands_db_is_configured()) {
        return 'Reward tools are waiting on server setup.';
    }

    $missing = array_values(array_filter(
        raidlands_rewards_tables(),
        static fn (string $table): bool => !raidlands_rewards_table_exists($table)
    ));

    if ($missing === []) {
        if (!raidlands_rewards_vote_site_provider_columns_ready()) {
            return $include_detail
                ? 'Rewards tables need the Rust-Servers vote integration update. Run database/migrations/049_rust_servers_vote_rewards.sql.'
                : 'Rewards tables need the latest vote rewards migration.';
        }

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

function raidlands_rewards_clean_provider(string $value): string
{
    $value = strtolower(trim($value));
    $value = str_replace(['-', ' '], '_', $value);

    return in_array($value, ['none', 'rust_servers'], true) ? $value : 'none';
}

function raidlands_rewards_vote_site_provider_columns_ready(): bool
{
    return raidlands_rewards_table_exists('vote_reward_sites')
        && raidlands_store_table_has_columns('vote_reward_sites', [
            'api_provider',
            'api_key',
            'api_server_id',
        ]);
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

function raidlands_rewards_settings(bool $seed_defaults = true): array
{
    if ($seed_defaults) {
        raidlands_rewards_seed_defaults();
    }

    $row = raidlands_db_fetch_one('SELECT * FROM rp_game_settings WHERE id = 1');

    if ($row === null) {
        return [
            'id' => 1,
            'games_enabled' => 1,
            'coinflip_enabled' => 1,
            'dice_enabled' => 1,
            'jackpot_enabled' => 1,
            'monument_extraction_enabled' => 0,
            'high_low_enabled' => raidlands_rewards_game_backend_ready('high_low') ? 1 : 0,
            'wheel_enabled' => raidlands_rewards_game_backend_ready('wheel') ? 1 : 0,
            'raid_duel_enabled' => raidlands_rewards_game_backend_ready('raid_duel') ? 1 : 0,
            'supply_run_enabled' => raidlands_rewards_game_backend_ready('supply_run') ? 1 : 0,
            'min_stake_rp' => 200,
            'max_stake_rp' => 2000,
            'coinflip_payout_multiplier_basis' => 200,
            'dice_win_chance_percent' => 45,
            'dice_payout_multiplier_basis' => 200,
            'jackpot_ticket_cost_rp' => 200,
            'jackpot_max_entries_per_player' => 10,
            'jackpot_round_minutes' => 30,
            'jackpot_house_edge_percent' => 10,
            'pool_round_minutes' => 20,
            'pool_house_edge_percent' => 8,
            'daily_wager_cap_rp' => 10000,
            'daily_loss_cap_rp' => 5000,
            'self_exclusion_enabled' => 1,
            'terms_copy' => 'RP games use in-game Raidlands RP only. RP has no cash value, outcomes are not final until the Rust server confirms the point change, and admins may pause games at any time.',
        ];
    }

    $defaults = [
        'high_low_enabled' => raidlands_rewards_game_backend_ready('high_low') ? 1 : 0,
        'wheel_enabled' => raidlands_rewards_game_backend_ready('wheel') ? 1 : 0,
        'raid_duel_enabled' => raidlands_rewards_game_backend_ready('raid_duel') ? 1 : 0,
        'supply_run_enabled' => raidlands_rewards_game_backend_ready('supply_run') ? 1 : 0,
        'monument_extraction_enabled' => 0,
        'pool_round_minutes' => 20,
        'pool_house_edge_percent' => 8,
    ];

    foreach ([
        'games_enabled',
        'coinflip_enabled',
        'dice_enabled',
        'jackpot_enabled',
        'high_low_enabled',
        'wheel_enabled',
        'raid_duel_enabled',
        'supply_run_enabled',
        'monument_extraction_enabled',
        'min_stake_rp',
        'max_stake_rp',
        'coinflip_payout_multiplier_basis',
        'dice_win_chance_percent',
        'dice_payout_multiplier_basis',
        'jackpot_ticket_cost_rp',
        'jackpot_max_entries_per_player',
        'jackpot_round_minutes',
        'jackpot_house_edge_percent',
        'pool_round_minutes',
        'pool_house_edge_percent',
        'daily_wager_cap_rp',
        'daily_loss_cap_rp',
        'self_exclusion_enabled',
    ] as $key) {
        if (!array_key_exists($key, $row)) {
            $row[$key] = $defaults[$key] ?? 0;
        }

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

function raidlands_rewards_rust_servers_vote_url(): string
{
    return 'https://rust-servers.net/server/178053/vote/';
}

function raidlands_rewards_rust_servers_claim_check(array $site, string $steam_id64): array
{
    $api_key = trim((string) ($site['api_key'] ?? ''));

    if ($api_key === '') {
        throw new RuntimeException('Rust-Servers.net verification needs this vote site API key.');
    }

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        throw new InvalidArgumentException('Rust-Servers.net verification needs a linked SteamID64.');
    }

    $url = 'https://rust-servers.net/api/?' . http_build_query([
        'object' => 'plugin',
        'element' => 'reward',
        'key' => $api_key,
        'steamid' => $steam_id64,
    ], '', '&', PHP_QUERY_RFC3986);

    $response = raidlands_store_http_get($url, 8);

    if ($response === null) {
        throw new RuntimeException('Rust-Servers.net did not return a vote verification response. Try again in a minute.');
    }

    $raw = trim(strip_tags($response));
    $decoded = json_decode($raw, true);

    if (is_array($decoded)) {
        $raw = trim((string) ($decoded['response'] ?? $decoded['status'] ?? $decoded['result'] ?? ''));
    }

    if (!in_array($raw, ['0', '1', '2'], true)) {
        throw new RuntimeException('Rust-Servers.net returned an unexpected vote verification response.');
    }

    if ($raw === '1') {
        return [
            'verified' => true,
            'claimed_external' => true,
            'external_vote_id' => 'rust-servers-' . $steam_id64 . '-' . gmdate('YmdH'),
            'message' => 'Rust-Servers.net verified and claimed the vote.',
        ];
    }

    return [
        'verified' => false,
        'claimed_external' => $raw === '2',
        'external_vote_id' => '',
        'message' => $raw === '2'
            ? 'Rust-Servers.net says this vote was already claimed.'
            : 'Rust-Servers.net has not seen an unclaimed vote from your Steam account in the last 24 hours.',
    ];
}

function raidlands_rewards_external_vote_check(array $site, string $steam_id64): array
{
    $provider = raidlands_rewards_clean_provider((string) ($site['api_provider'] ?? 'none'));

    if ($provider === 'rust_servers') {
        return raidlands_rewards_rust_servers_claim_check($site, $steam_id64);
    }

    return [
        'verified' => true,
        'claimed_external' => false,
        'external_vote_id' => '',
        'message' => 'Manual claim accepted.',
    ];
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
            'label' => 'Sign in with Steam',
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

    if (!in_array($source_type, [
        'vote_reward',
        'coinflip',
        'dice',
        'high_low',
        'wheel',
        'jackpot_entry',
        'jackpot_payout',
        'raid_duel_entry',
        'raid_duel_payout',
        'supply_run_entry',
        'supply_run_payout',
        'monument_wager',
        'monument_payout',
        'roulette',
        'slots',
        'blackjack_wager',
        'blackjack_double',
        'blackjack_payout',
        'admin_adjustment',
    ], true)) {
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

    $mode = raidlands_rewards_clean_mode((string) ($site['verification_mode'] ?? 'hybrid'));
    $provider = raidlands_rewards_clean_provider((string) ($site['api_provider'] ?? 'none'));
    $reward_rp = max(1, (int) ($site['reward_rp'] ?? 200));
    $external_check = [
        'verified' => true,
        'claimed_external' => false,
        'external_vote_id' => '',
        'message' => 'Manual claim accepted.',
    ];

    if ($provider !== 'none' && $mode !== 'manual') {
        $external_check = raidlands_rewards_external_vote_check($site, (string) $player['steam_id64']);

        if (empty($external_check['verified'])) {
            throw new RuntimeException((string) ($external_check['message'] ?? 'The vote site did not verify an unclaimed vote.'));
        }
    }

    $status = ($mode === 'strict' && $provider === 'none') ? 'pending_callback' : 'queued';
    $message = $status === 'pending_callback'
        ? 'Waiting for the vote site callback before RP is queued.'
        : (string) ($external_check['message'] ?? 'Queued for server RP confirmation.');
    $external_vote_id = trim((string) ($external_check['external_vote_id'] ?? ''));
    $claim_source = $provider !== 'none' && $mode !== 'manual' ? 'callback' : 'manual';

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $insert = $pdo->prepare(
            'INSERT INTO vote_reward_claims
                (site_id, player_id, steam_id64, external_vote_id, claim_source, status, reward_rp, callback_received, message)
             VALUES
                (:site_id, :player_id, :steam_id64, :external_vote_id, :claim_source, :status, :reward_rp, :callback_received, :message)'
        );
        $insert->execute([
            'site_id' => (int) $site['id'],
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'external_vote_id' => $external_vote_id !== '' ? mb_substr($external_vote_id, 0, 120) : null,
            'claim_source' => $claim_source,
            'status' => $status,
            'reward_rp' => $reward_rp,
            'callback_received' => $claim_source === 'callback' ? 1 : 0,
            'message' => $message,
        ]);
        $claim_id = (int) $pdo->lastInsertId();

        $request = null;

        if ($status !== 'pending_callback') {
            $request = raidlands_rewards_queue_point_request(
                $pdo,
                (int) $player['id'],
                (string) $player['steam_id64'],
                'vote_reward',
                (string) $claim_id,
                0,
                $reward_rp,
                'Vote reward: ' . (string) $site['name'],
                [
                    'site_slug' => (string) $site['slug'],
                    'claim_source' => $claim_source,
                    'api_provider' => $provider,
                    'external_claimed' => !empty($external_check['claimed_external']),
                ]
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
            'strict' => $status === 'pending_callback',
            'api_verified' => $provider !== 'none' && $mode !== 'manual',
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
        if (!empty($result['strict'])) {
            $message = (string) $result['site_name'] . ' claim recorded. RP will queue after the vote site callback arrives.';
        } elseif (!empty($result['api_verified'])) {
            $message = (string) $result['site_name'] . ' vote verified and queued for ' . raidlands_store_rp((int) $result['reward_rp']) . '. The Rust server will confirm it shortly.';
        } else {
            $message = (string) $result['site_name'] . ' reward queued for ' . raidlands_store_rp((int) $result['reward_rp']) . '. The Rust server will confirm it shortly.';
        }

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

function raidlands_rewards_dice_win_faces(array $settings): int
{
    $chance = max(1, min(95, (int) ($settings['dice_win_chance_percent'] ?? 45)));

    return max(1, min(5, (int) round($chance / (100 / 6))));
}

function raidlands_rewards_dice_target(array $settings): int
{
    return 7 - raidlands_rewards_dice_win_faces($settings);
}

function raidlands_rewards_dice_odds_basis_points(array $settings): int
{
    return (int) round((raidlands_rewards_dice_win_faces($settings) / 6) * 10000);
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
    $target = raidlands_rewards_dice_target($settings);
    $winning_faces = raidlands_rewards_dice_win_faces($settings);
    $odds_basis_points = raidlands_rewards_dice_odds_basis_points($settings);
    $roll = random_int(1, 6);
    $win = $roll >= $target;
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
        $choice = 'roll ' . $target . '-6';
        $message = $win ? 'Rolled a ' . $roll . ' and won. Waiting for server confirmation.' : 'Rolled a ' . $roll . ' and lost. Waiting for server confirmation.';
        $insert->execute([
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'stake_rp' => $stake,
            'payout_rp' => $payout,
            'net_rp' => $payout - $stake,
            'odds_basis_points' => $odds_basis_points,
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
            ['target' => $target, 'winning_faces' => $winning_faces, 'roll' => $roll, 'face' => $roll, 'won' => $win]
        );

        $update = $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $round_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $loss);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['round_id' => $round_id, 'won' => $win, 'roll' => $roll, 'face' => $roll, 'target' => $target, 'winning_faces' => $winning_faces, 'payout_rp' => $payout, 'stake_rp' => $stake];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_play_high_low(string $choice, int $stake): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    if (!raidlands_rewards_game_backend_ready('high_low')) {
        throw new RuntimeException('High-Low is staged until the latest RP games update is installed.');
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, 'high_low');
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    $choice = strtolower(trim($choice));

    if (!in_array($choice, ['low', 'high'], true)) {
        throw new InvalidArgumentException('Choose high or low.');
    }

    $stake = raidlands_rewards_normalize_stake($stake, $settings);
    $roll = random_int(1, 100);
    $push = $roll >= 46 && $roll <= 55;
    $win = !$push && (($choice === 'low' && $roll <= 45) || ($choice === 'high' && $roll >= 56));
    $payout = $push ? $stake : ($win ? $stake * 2 : 0);
    $loss = $win || $push ? 0 : $stake;

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
                ("high_low", :player_id, :steam_id64, :stake_rp, :payout_rp, :net_rp, 4500, :player_choice, :roll_result, "queued", :message)'
        );
        $message = $push
            ? 'Rolled ' . $roll . ' for a push. Stake return waiting for server confirmation.'
            : ($win ? 'Called ' . $choice . ' and rolled ' . $roll . '. Waiting for server confirmation.' : 'Called ' . $choice . ' and rolled ' . $roll . '. Waiting for server confirmation.');
        $insert->execute([
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'stake_rp' => $stake,
            'payout_rp' => $payout,
            'net_rp' => $payout - $stake,
            'player_choice' => $choice,
            'roll_result' => (string) $roll,
            'message' => $message,
        ]);
        $round_id = (int) $pdo->lastInsertId();

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'high_low',
            (string) $round_id,
            $stake,
            $payout,
            'RP High-Low',
            ['choice' => $choice, 'roll' => $roll, 'won' => $win, 'push' => $push]
        );

        $update = $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $round_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $loss);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['round_id' => $round_id, 'won' => $win, 'push' => $push, 'roll' => $roll, 'choice' => $choice, 'payout_rp' => $payout, 'stake_rp' => $stake];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_wheel_segments(): array
{
    return [
        'green' => ['label' => 'Green Jackpot', 'chance' => 5, 'multiplier_basis' => 1000],
        'orange' => ['label' => 'Orange Raid', 'chance' => 20, 'multiplier_basis' => 350],
        'steel' => ['label' => 'Steel Line', 'chance' => 35, 'multiplier_basis' => 220],
        'ash' => ['label' => 'Ash Cover', 'chance' => 40, 'multiplier_basis' => 180],
    ];
}

function raidlands_rewards_wheel_roll_outcome(int $roll): string
{
    if ($roll <= 5) {
        return 'green';
    }

    if ($roll <= 25) {
        return 'orange';
    }

    if ($roll <= 60) {
        return 'steel';
    }

    return 'ash';
}

function raidlands_rewards_play_wheel(string $choice, int $stake): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    if (!raidlands_rewards_game_backend_ready('wheel')) {
        throw new RuntimeException('Wheel is staged until the latest RP games update is installed.');
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, 'wheel');
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    $segments = raidlands_rewards_wheel_segments();
    $choice = strtolower(trim($choice));

    if (!isset($segments[$choice])) {
        throw new InvalidArgumentException('Choose a wheel segment.');
    }

    $stake = raidlands_rewards_normalize_stake($stake, $settings);
    $roll = random_int(1, 100);
    $outcome = raidlands_rewards_wheel_roll_outcome($roll);
    $win = $outcome === $choice;
    $payout = $win ? (int) floor($stake * ((int) $segments[$choice]['multiplier_basis'] / 100)) : 0;
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
                ("wheel", :player_id, :steam_id64, :stake_rp, :payout_rp, :net_rp, :odds_basis_points, :player_choice, :roll_result, "queued", :message)'
        );
        $message = $win
            ? 'Wheel landed on ' . $segments[$outcome]['label'] . '. Waiting for server confirmation.'
            : 'Wheel landed on ' . $segments[$outcome]['label'] . '. Waiting for server confirmation.';
        $insert->execute([
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'stake_rp' => $stake,
            'payout_rp' => $payout,
            'net_rp' => $payout - $stake,
            'odds_basis_points' => (int) $segments[$choice]['chance'] * 100,
            'player_choice' => $choice,
            'roll_result' => $segments[$outcome]['label'] . ' (' . $roll . ')',
            'message' => $message,
        ]);
        $round_id = (int) $pdo->lastInsertId();

        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            'wheel',
            (string) $round_id,
            $stake,
            $payout,
            'RP Wheel',
            ['choice' => $choice, 'outcome' => $outcome, 'roll' => $roll, 'won' => $win]
        );

        $update = $pdo->prepare('UPDATE rp_game_rounds SET rp_point_request_id = :request_id, request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $round_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $loss);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['round_id' => $round_id, 'won' => $win, 'roll' => $roll, 'choice' => $choice, 'outcome' => $outcome, 'payout_rp' => $payout, 'stake_rp' => $stake];
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
           AND (closes_at IS NULL OR closes_at > NOW())
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
        $round_statement = $pdo->prepare(
            'SELECT *
             FROM rp_jackpot_rounds
             WHERE id = :id
               AND status = "open"
               AND (closes_at IS NULL OR closes_at > NOW())
             FOR UPDATE'
        );
        $round_statement->execute(['id' => (int) $round['id']]);
        $locked_round = $round_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($locked_round)) {
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

function raidlands_rewards_pool_game_for_source(string $source_type, string $kind = ''): ?array
{
    foreach (raidlands_rewards_pool_games() as $game_type => $game) {
        if (($kind === '' || $kind === 'entry') && $source_type === (string) $game['entry_source']) {
            $game['key'] = $game_type;
            return $game;
        }

        if (($kind === '' || $kind === 'payout') && $source_type === (string) $game['payout_source']) {
            $game['key'] = $game_type;
            return $game;
        }
    }

    return null;
}

function raidlands_rewards_pool_round_options(array $round, array $game): array
{
    $options = [];
    $decoded = json_decode((string) ($round['options_json'] ?? ''), true);
    $source = is_array($decoded) && $decoded !== [] ? $decoded : (array) ($game['options'] ?? []);

    foreach ($source as $key => $option) {
        if (!is_array($option)) {
            continue;
        }

        $key = strtolower(trim((string) $key));

        if ($key === '') {
            continue;
        }

        $label = raidlands_store_clean_profile_text((string) ($option['label'] ?? ucwords(str_replace('_', ' ', $key))), 80);
        $chance = max(0, (int) ($option['chance'] ?? 0));

        $options[$key] = [
            'label' => $label !== '' ? $label : ucwords(str_replace('_', ' ', $key)),
            'chance' => $chance,
        ];
    }

    return $options !== [] ? $options : (array) ($game['options'] ?? []);
}

function raidlands_rewards_pool_option_label(array $options, string $option_key): string
{
    $option_key = strtolower(trim($option_key));

    return (string) ($options[$option_key]['label'] ?? ucwords(str_replace('_', ' ', $option_key)));
}

function raidlands_rewards_pool_round_breakdown(int $round_id, array $options): array
{
    $breakdown = [];

    foreach ($options as $option_key => $option) {
        $breakdown[$option_key] = [
            'key' => (string) $option_key,
            'label' => (string) ($option['label'] ?? ucwords(str_replace('_', ' ', (string) $option_key))),
            'chance' => (int) ($option['chance'] ?? 0),
            'stake_rp' => 0,
            'entries' => 0,
            'percent' => 0.0,
        ];
    }

    if ($round_id <= 0 || !raidlands_rewards_pool_backend_ready()) {
        return $breakdown;
    }

    $rows = raidlands_db_fetch_all(
        "SELECT option_key, COALESCE(SUM(stake_rp), 0) AS stake_rp, COUNT(*) AS entries
         FROM rp_pool_entries
         WHERE round_id = :round_id
           AND status IN ('queued', 'processing', 'confirmed', 'payout_queued', 'paid', 'lost')
         GROUP BY option_key",
        ['round_id' => $round_id]
    );
    $total = 0;

    foreach ($rows as $row) {
        $option_key = strtolower(trim((string) ($row['option_key'] ?? '')));

        if ($option_key === '') {
            continue;
        }

        if (!isset($breakdown[$option_key])) {
            $breakdown[$option_key] = [
                'key' => $option_key,
                'label' => ucwords(str_replace('_', ' ', $option_key)),
                'chance' => 0,
                'stake_rp' => 0,
                'entries' => 0,
                'percent' => 0.0,
            ];
        }

        $breakdown[$option_key]['stake_rp'] = max(0, (int) ($row['stake_rp'] ?? 0));
        $breakdown[$option_key]['entries'] = max(0, (int) ($row['entries'] ?? 0));
        $total += $breakdown[$option_key]['stake_rp'];
    }

    foreach ($breakdown as &$row) {
        $row['percent'] = $total > 0 ? round(((int) $row['stake_rp'] / $total) * 100, 1) : 0.0;
    }
    unset($row);

    return $breakdown;
}

function raidlands_rewards_pool_round_entries(int $round_id, array $options, int $limit = 8): array
{
    if ($round_id <= 0 || !raidlands_rewards_pool_backend_ready()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        "SELECT e.*, p.display_name
         FROM rp_pool_entries e
         INNER JOIN players p ON p.id = e.player_id
         WHERE e.round_id = :round_id
           AND e.status IN ('queued', 'processing', 'confirmed', 'payout_queued', 'paid', 'lost')
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT " . max(1, min(25, $limit)),
        ['round_id' => $round_id]
    );

    foreach ($rows as &$row) {
        $name = trim((string) ($row['display_name'] ?? ''));

        if ($name === '') {
            $steam = (string) ($row['steam_id64'] ?? '');
            $name = $steam !== '' ? 'Steam ' . substr($steam, -6) : 'Raidlands Player';
        }

        $row['player_label'] = raidlands_store_clean_profile_text($name, 80);
        $row['option_label'] = raidlands_rewards_pool_option_label($options, (string) ($row['option_key'] ?? ''));
    }
    unset($row);

    return $rows;
}

function raidlands_rewards_pool_round_state(?array $round, string $game_type = ''): ?array
{
    if ($round === null) {
        return null;
    }

    $game_type = (string) ($round['game_type'] ?? $game_type);
    $game = raidlands_rewards_pool_game($game_type);

    if ($game === null) {
        return null;
    }

    $options = raidlands_rewards_pool_round_options($round, $game);
    $breakdown = raidlands_rewards_pool_round_breakdown((int) ($round['id'] ?? 0), $options);
    $entries = raidlands_rewards_pool_round_entries((int) ($round['id'] ?? 0), $options, 8);
    $public_total = array_sum(array_map(static fn (array $row): int => (int) ($row['stake_rp'] ?? 0), $breakdown));
    $public_entries = array_sum(array_map(static fn (array $row): int => (int) ($row['entries'] ?? 0), $breakdown));

    return [
        'id' => (int) ($round['id'] ?? 0),
        'game_type' => $game_type,
        'round_key' => (string) ($round['round_key'] ?? ''),
        'status' => (string) ($round['status'] ?? ''),
        'options' => $options,
        'breakdown' => array_values($breakdown),
        'entries' => $entries,
        'total_stake_rp' => $public_total,
        'total_entries' => $public_entries,
        'confirmed_stake_rp' => (int) ($round['total_stake_rp'] ?? 0),
        'confirmed_entries' => (int) ($round['total_entries'] ?? 0),
        'house_edge_percent' => (int) ($round['house_edge_percent'] ?? 0),
        'outcome_key' => (string) ($round['outcome_key'] ?? ''),
        'outcome_label' => raidlands_rewards_pool_option_label($options, (string) ($round['outcome_key'] ?? '')),
        'outcome_roll' => (int) ($round['outcome_roll'] ?? 0),
        'message' => (string) ($round['message'] ?? ''),
        'opens_at' => (string) ($round['opens_at'] ?? ''),
        'closes_at' => (string) ($round['closes_at'] ?? ''),
    ];
}

function raidlands_rewards_active_pool_round(string $game_type, array $settings, bool $create = true): ?array
{
    $game = raidlands_rewards_pool_game($game_type);

    if ($game === null
        || !raidlands_rewards_pool_backend_ready($game_type)
        || empty($settings['games_enabled'])
        || empty($settings[$game_type . '_enabled'])) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        "SELECT *
         FROM rp_pool_rounds
         WHERE game_type = :game_type
           AND status = 'open'
           AND (closes_at IS NULL OR closes_at > NOW())
         ORDER BY closes_at ASC, id ASC
         LIMIT 1",
        ['game_type' => $game_type]
    );

    if ($row !== null || !$create) {
        return $row;
    }

    $minutes = max(5, min(1440, (int) ($settings['pool_round_minutes'] ?? 20)));
    $round_key = (string) $game['prefix'] . '-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    $options_json = json_encode($game['options'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    raidlands_db_execute(
        'INSERT INTO rp_pool_rounds
            (game_type, round_key, status, options_json, house_edge_percent, opens_at, closes_at)
         VALUES
            (:game_type, :round_key, "open", :options_json, :house_edge, NOW(), DATE_ADD(NOW(), INTERVAL ' . $minutes . ' MINUTE))',
        [
            'game_type' => $game_type,
            'round_key' => $round_key,
            'options_json' => $options_json,
            'house_edge' => max(0, min(50, (int) ($settings['pool_house_edge_percent'] ?? 8))),
        ]
    );

    return raidlands_db_fetch_one('SELECT * FROM rp_pool_rounds WHERE round_key = :round_key LIMIT 1', ['round_key' => $round_key]);
}

function raidlands_rewards_pool_rounds_state(array $settings): array
{
    $state = [];

    foreach (raidlands_rewards_pool_games() as $game_type => $game) {
        $ready = raidlands_rewards_pool_backend_ready($game_type);
        $round = $ready ? raidlands_rewards_active_pool_round($game_type, $settings, true) : null;
        $state[$game_type] = [
            'ready' => $ready,
            'enabled' => $ready && !empty($settings['games_enabled']) && !empty($settings[$game_type . '_enabled']),
            'game' => [
                'key' => $game_type,
                'label' => (string) $game['label'],
                'short_label' => (string) $game['short_label'],
                'kicker' => (string) $game['kicker'],
                'description' => (string) $game['description'],
                'options' => (array) $game['options'],
            ],
            'round' => raidlands_rewards_pool_round_state($round, $game_type),
        ];
    }

    return $state;
}

function raidlands_rewards_enter_pool_game(string $game_type, string $option_key, int $stake): array
{
    if (!raidlands_rewards_is_ready()) {
        throw new RuntimeException(raidlands_rewards_readiness_message(true));
    }

    $game = raidlands_rewards_pool_game($game_type);

    if ($game === null) {
        throw new InvalidArgumentException('Choose a supported multiplayer RP game.');
    }

    if (!raidlands_rewards_pool_backend_ready($game_type)) {
        throw new RuntimeException((string) $game['label'] . ' is staged until the latest multiplayer RP games update is installed.');
    }

    $settings = raidlands_rewards_settings();
    raidlands_rewards_require_games_open($settings, $game_type);
    $player = raidlands_rewards_require_player();

    if (raidlands_rewards_self_excluded((int) $player['id'])) {
        throw new RuntimeException('RP games are disabled for this account.');
    }

    $option_key = strtolower(trim($option_key));

    if (!isset($game['options'][$option_key])) {
        throw new InvalidArgumentException('Choose a valid ' . (string) $game['short_label'] . ' side.');
    }

    $stake = raidlands_rewards_normalize_stake($stake, $settings);
    raidlands_rewards_check_daily_limits($player, $settings, $stake, $stake);
    raidlands_rewards_run_due_pool_rounds();
    $round = raidlands_rewards_active_pool_round($game_type, $settings, true);

    if ($round === null) {
        throw new RuntimeException('No ' . (string) $game['label'] . ' round is open.');
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $round_statement = $pdo->prepare(
            'SELECT *
             FROM rp_pool_rounds
             WHERE id = :id
               AND game_type = :game_type
               AND status = "open"
               AND (closes_at IS NULL OR closes_at > NOW())
             FOR UPDATE'
        );
        $round_statement->execute([
            'id' => (int) $round['id'],
            'game_type' => $game_type,
        ]);
        $locked_round = $round_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($locked_round)) {
            throw new RuntimeException('That round is closing. Refresh and join the next one.');
        }

        $insert = $pdo->prepare(
            'INSERT INTO rp_pool_entries
                (round_id, player_id, steam_id64, option_key, stake_rp, net_rp, status, message)
             VALUES
                (:round_id, :player_id, :steam_id64, :option_key, :stake_rp, :net_rp, "queued", "Queued for server RP debit confirmation.")'
        );
        $insert->execute([
            'round_id' => (int) $locked_round['id'],
            'player_id' => (int) $player['id'],
            'steam_id64' => (string) $player['steam_id64'],
            'option_key' => $option_key,
            'stake_rp' => $stake,
            'net_rp' => -$stake,
        ]);
        $entry_id = (int) $pdo->lastInsertId();
        $request = raidlands_rewards_queue_point_request(
            $pdo,
            (int) $player['id'],
            (string) $player['steam_id64'],
            (string) $game['entry_source'],
            (string) $entry_id,
            $stake,
            0,
            'RP ' . (string) $game['label'] . ' entry',
            [
                'game_type' => $game_type,
                'round_id' => (int) $locked_round['id'],
                'round_key' => (string) $locked_round['round_key'],
                'option' => $option_key,
            ]
        );

        $update = $pdo->prepare('UPDATE rp_pool_entries SET entry_request_id = :request_id, entry_request_token = :request_token WHERE id = :id');
        $update->execute(['request_id' => $request['id'], 'request_token' => $request['request_token'], 'id' => $entry_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $stake, $stake);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return [
            'entry_id' => $entry_id,
            'round_id' => (int) $locked_round['id'],
            'game_type' => $game_type,
            'choice' => $option_key,
            'choice_label' => (string) $game['options'][$option_key]['label'],
            'stake_rp' => $stake,
            'round_key' => (string) $locked_round['round_key'],
            'closes_at' => (string) ($locked_round['closes_at'] ?? ''),
        ];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_rewards_weighted_pool_outcome(array $options): array
{
    $total = array_sum(array_map(static fn (array $option): int => max(0, (int) ($option['chance'] ?? 0)), $options));

    if ($total <= 0) {
        $keys = array_keys($options);
        $key = (string) ($keys[0] ?? '');

        return ['key' => $key, 'roll' => 0];
    }

    $roll = random_int(1, $total);
    $cursor = 0;

    foreach ($options as $key => $option) {
        $cursor += max(0, (int) ($option['chance'] ?? 0));

        if ($roll <= $cursor) {
            return ['key' => (string) $key, 'roll' => $roll];
        }
    }

    $keys = array_keys($options);

    return ['key' => (string) end($keys), 'roll' => $roll];
}

function raidlands_rewards_queue_pool_payout(PDO $pdo, array $entry, array $game, int $payout, string $message, array $metadata = []): void
{
    $payout = max(0, $payout);

    if ($payout <= 0) {
        return;
    }

    $entry_id = (int) ($entry['id'] ?? 0);
    $stake = max(0, (int) ($entry['stake_rp'] ?? 0));
    $request = raidlands_rewards_queue_point_request(
        $pdo,
        (int) $entry['player_id'],
        (string) $entry['steam_id64'],
        (string) $game['payout_source'],
        (string) $entry_id,
        0,
        $payout,
        'RP ' . (string) $game['label'] . ' payout',
        $metadata
    );

    $update = $pdo->prepare(
        'UPDATE rp_pool_entries
         SET payout_request_id = :request_id,
             payout_request_token = :request_token,
             payout_rp = :payout_rp,
             net_rp = :net_rp,
             status = "payout_queued",
             message = :message,
             updated_at = NOW()
         WHERE id = :id'
    );
    $update->execute([
        'request_id' => $request['id'],
        'request_token' => $request['request_token'],
        'payout_rp' => $payout,
        'net_rp' => $payout - $stake,
        'message' => $message,
        'id' => $entry_id,
    ]);
}

function raidlands_rewards_run_due_pool_rounds(): void
{
    if (!raidlands_rewards_pool_backend_ready()) {
        return;
    }

    $settings = raidlands_rewards_settings();

    if (empty($settings['games_enabled'])) {
        return;
    }

    $rounds = raidlands_db_fetch_all(
        "SELECT *
         FROM rp_pool_rounds
         WHERE status = 'open'
           AND closes_at IS NOT NULL
           AND closes_at <= NOW()
         ORDER BY closes_at ASC, id ASC
         LIMIT 10"
    );

    foreach ($rounds as $round) {
        raidlands_rewards_draw_pool_round((int) $round['id']);
    }
}

function raidlands_rewards_draw_pool_round(int $round_id): void
{
    if ($round_id <= 0 || !raidlands_rewards_pool_backend_ready()) {
        return;
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $round_statement = $pdo->prepare('SELECT * FROM rp_pool_rounds WHERE id = :id FOR UPDATE');
        $round_statement->execute(['id' => $round_id]);
        $round = $round_statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($round) || (string) $round['status'] !== 'open') {
            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $game_type = (string) ($round['game_type'] ?? '');
        $game = raidlands_rewards_pool_game($game_type);

        if ($game === null) {
            $pdo->prepare('UPDATE rp_pool_rounds SET status = "failed", message = "Unsupported pool game.", updated_at = NOW() WHERE id = :id')->execute(['id' => $round_id]);

            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $entries = raidlands_db_fetch_all(
            "SELECT *
             FROM rp_pool_entries
             WHERE round_id = :round_id
               AND status = 'confirmed'
             ORDER BY id ASC
             FOR UPDATE",
            ['round_id' => $round_id]
        );

        if ($entries === []) {
            $pdo->prepare('UPDATE rp_pool_rounds SET status = "canceled", message = "No confirmed entries joined this round.", updated_at = NOW() WHERE id = :id')->execute(['id' => $round_id]);

            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $options = raidlands_rewards_pool_round_options($round, $game);
        $option_stakes = [];
        $total_stake = 0;

        foreach ($entries as $entry) {
            $option = (string) ($entry['option_key'] ?? '');
            $stake = max(0, (int) ($entry['stake_rp'] ?? 0));
            $option_stakes[$option] = ($option_stakes[$option] ?? 0) + $stake;
            $total_stake += $stake;
        }

        $active_options = array_values(array_filter($option_stakes, static fn (int $stake): bool => $stake > 0));

        if ($game_type === 'raid_duel' && count($active_options) < 2) {
            foreach ($entries as $entry) {
                raidlands_rewards_queue_pool_payout(
                    $pdo,
                    $entry,
                    $game,
                    (int) $entry['stake_rp'],
                    'No opposing side formed; stake refund queued.',
                    ['round_id' => $round_id, 'refund' => true]
                );
            }

            $pdo->prepare(
                'UPDATE rp_pool_rounds
                 SET status = "payout_queued",
                     total_stake_rp = :total_stake,
                     total_entries = :total_entries,
                     message = "No opposing side formed; refunds queued.",
                     updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'total_stake' => $total_stake,
                'total_entries' => count($entries),
                'id' => $round_id,
            ]);

            if ($owns_transaction) {
                $pdo->commit();
            }
            return;
        }

        $outcome = raidlands_rewards_weighted_pool_outcome($options);
        $outcome_key = (string) $outcome['key'];
        $outcome_label = raidlands_rewards_pool_option_label($options, $outcome_key);
        $winner_stake = max(0, (int) ($option_stakes[$outcome_key] ?? 0));
        $edge = max(0, min(50, (int) ($round['house_edge_percent'] ?? 8)));
        $payout_pool = (int) floor($total_stake * ((100 - $edge) / 100));
        $queued_payouts = 0;

        foreach ($entries as $entry) {
            $entry_id = (int) $entry['id'];

            if ((string) ($entry['option_key'] ?? '') !== $outcome_key || $winner_stake <= 0 || $payout_pool <= 0) {
                $pdo->prepare(
                    'UPDATE rp_pool_entries
                     SET payout_rp = 0,
                         net_rp = -stake_rp,
                         status = "lost",
                         message = :message,
                         updated_at = NOW()
                     WHERE id = :id'
                )->execute([
                    'message' => (string) $game['label'] . ' hit ' . $outcome_label . '. Entry lost.',
                    'id' => $entry_id,
                ]);
                continue;
            }

            $payout = max(1, (int) floor($payout_pool * ((int) $entry['stake_rp'] / $winner_stake)));
            raidlands_rewards_queue_pool_payout(
                $pdo,
                $entry,
                $game,
                $payout,
                (string) $game['label'] . ' hit ' . $outcome_label . '. Payout queued.',
                [
                    'round_id' => $round_id,
                    'outcome' => $outcome_key,
                    'roll' => (int) $outcome['roll'],
                ]
            );
            $queued_payouts += 1;
        }

        $round_status = $queued_payouts > 0 ? 'payout_queued' : 'paid';
        $round_message = $queued_payouts > 0
            ? (string) $game['label'] . ' hit ' . $outcome_label . '; ' . $queued_payouts . ' payout' . ($queued_payouts === 1 ? '' : 's') . ' queued.'
            : (string) $game['label'] . ' hit ' . $outcome_label . '; no winning entries were confirmed.';

        $pdo->prepare(
            'UPDATE rp_pool_rounds
             SET status = :status,
                 total_stake_rp = :total_stake,
                 total_entries = :total_entries,
                 outcome_key = :outcome_key,
                 outcome_roll = :outcome_roll,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'status' => $round_status,
            'total_stake' => $total_stake,
            'total_entries' => count($entries),
            'outcome_key' => $outcome_key,
            'outcome_roll' => (int) $outcome['roll'],
            'message' => $round_message,
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

function raidlands_rewards_refresh_pool_round_status(PDO $pdo, int $round_id): void
{
    if ($round_id <= 0) {
        return;
    }

    $summary = raidlands_db_fetch_one(
        "SELECT
            SUM(CASE WHEN status = 'payout_queued' THEN 1 ELSE 0 END) AS pending_payouts,
            SUM(CASE WHEN status = 'failed' AND payout_request_id IS NOT NULL THEN 1 ELSE 0 END) AS failed_payouts
         FROM rp_pool_entries
         WHERE round_id = :round_id",
        ['round_id' => $round_id]
    );

    $pending = (int) ($summary['pending_payouts'] ?? 0);
    $failed = (int) ($summary['failed_payouts'] ?? 0);

    if ($pending > 0) {
        return;
    }

    $status = $failed > 0 ? 'failed' : 'paid';
    $message = $failed > 0 ? 'One or more pool payouts failed.' : 'All pool payouts have been processed.';
    $statement = $pdo->prepare(
        'UPDATE rp_pool_rounds
         SET status = :status,
             message = CASE WHEN message = "" THEN :message ELSE message END,
             updated_at = NOW()
         WHERE id = :id
           AND status = "payout_queued"'
    );
    $statement->execute([
        'status' => $status,
        'message' => $message,
        'id' => $round_id,
    ]);
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

function raidlands_rewards_leaderboard_events_sql(): string
{
    $events = [
        "SELECT g.player_id, g.payout_rp, 1 AS games_played,
                CASE WHEN g.payout_rp > 0 THEN 1 ELSE 0 END AS wins,
                g.created_at AS played_at
         FROM rp_game_rounds g
         INNER JOIN rp_point_requests request ON request.id = g.rp_point_request_id
         WHERE g.status = 'confirmed' AND request.status = 'confirmed'",
        "SELECT e.player_id,
                CASE WHEN j.winner_player_id = e.player_id THEN MAX(j.payout_rp) ELSE 0 END AS payout_rp,
                1 AS games_played,
                CASE WHEN j.winner_player_id = e.player_id AND MAX(j.payout_rp) > 0 THEN 1 ELSE 0 END AS wins,
                COALESCE(j.closes_at, j.updated_at) AS played_at
         FROM rp_jackpot_entries e
         INNER JOIN rp_jackpot_rounds j ON j.id = e.round_id AND j.status = 'paid'
         INNER JOIN rp_point_requests entry_request ON entry_request.id = e.rp_point_request_id AND entry_request.status = 'confirmed'
         LEFT JOIN rp_point_requests payout_request ON payout_request.id = j.payout_request_id
         WHERE e.status = 'confirmed'
           AND (j.winner_player_id <> e.player_id OR payout_request.status = 'confirmed')
         GROUP BY e.player_id, e.round_id, j.winner_player_id, j.closes_at, j.updated_at"
    ];

    if (raidlands_rewards_table_exists('rp_pool_entries') && raidlands_rewards_table_exists('rp_pool_rounds')) {
        $events[] =
            "SELECT e.player_id,
                    CASE WHEN e.status = 'paid' AND payout_request.status = 'confirmed' THEN e.payout_rp ELSE 0 END AS payout_rp,
                    1 AS games_played,
                    CASE WHEN e.status = 'paid' AND payout_request.status = 'confirmed' AND e.payout_rp > 0 THEN 1 ELSE 0 END AS wins,
                    COALESCE(r.closes_at, r.updated_at) AS played_at
             FROM rp_pool_entries e
             INNER JOIN rp_pool_rounds r ON r.id = e.round_id
             LEFT JOIN rp_point_requests payout_request ON payout_request.id = e.payout_request_id
             WHERE e.status IN ('lost', 'paid')";
    }

    if (raidlands_rewards_table_exists('monument_extraction_runs')) {
        $events[] =
            "SELECT m.player_id,
                    CASE WHEN m.payout_status = 'confirmed' AND payout_request.status = 'confirmed' THEN m.payout_rp ELSE 0 END AS payout_rp,
                    1 AS games_played,
                    CASE WHEN m.payout_status = 'confirmed' AND payout_request.status = 'confirmed' AND m.payout_rp > 0 THEN 1 ELSE 0 END AS wins,
                    COALESCE(m.completed_at, m.updated_at) AS played_at
             FROM monument_extraction_runs m
             INNER JOIN rp_point_requests wager_request ON wager_request.id = m.wager_request_id AND wager_request.status = 'confirmed'
             LEFT JOIN rp_point_requests payout_request ON payout_request.id = m.payout_request_id
             WHERE m.status IN ('COMPLETED', 'DEAD', 'ABANDONED', 'EXPIRED')";
    }

    if (raidlands_rewards_table_exists('rp_blackjack_hands')) {
        $events[] =
            "SELECT b.player_id,
                    CASE WHEN b.status IN ('paid','push') THEN b.payout_rp ELSE 0 END AS payout_rp,
                    1 AS games_played,
                    CASE WHEN b.status = 'paid' AND b.payout_rp > b.total_stake_rp THEN 1 ELSE 0 END AS wins,
                    COALESCE(b.resolved_at, b.updated_at) AS played_at
             FROM rp_blackjack_hands b
             LEFT JOIN rp_point_requests payout_request ON payout_request.id = b.payout_request_id
             WHERE b.status IN ('paid','push','lost')
               AND (b.payout_request_id IS NULL OR payout_request.status = 'confirmed')";
    }

    return implode("\nUNION ALL\n", $events);
}

function raidlands_rewards_leaderboard_result(
    string $scope = 'current',
    int $page = 1,
    int $per_page = 25,
    string $search = '',
    int $wipe_id = 0,
    string $wipe_key = '',
    bool $attach_steam_profiles = true
): array {
    if (!raidlands_rewards_is_ready() || !raidlands_stats_is_ready()) {
        return raidlands_stats_page_result([], 0, $page, $per_page);
    }

    $scope = raidlands_stats_scope($scope);
    $page = raidlands_stats_page_number($page);
    $per_page = raidlands_stats_page_size($per_page);
    $search = raidlands_stats_search($search);
    $params = [];
    $event_where = '';
    $player_where = '';

    if ($scope !== 'all-time') {
        $wipe = raidlands_stats_scope_wipe($scope, $wipe_id, $wipe_key);

        if ($wipe === null) {
            return raidlands_stats_page_result([], 0, $page, $per_page);
        }

        $started_at = trim((string) ($wipe['started_at'] ?? $wipe['created_at'] ?? ''));
        $ended_at = trim((string) ($wipe['ended_at'] ?? ''));
        $params['wipe_started_at'] = $started_at;
        $event_where = 'WHERE events.played_at >= :wipe_started_at';

        if ($ended_at !== '') {
            $params['wipe_ended_at'] = $ended_at;
            $event_where .= ' AND events.played_at < :wipe_ended_at';
        }
    }

    if ($search !== '') {
        $params['search_steam_id'] = '%' . $search . '%';
        $params['search_name'] = '%' . $search . '%';
        $player_where = "WHERE (p.steam_id64 LIKE :search_steam_id OR p.display_name LIKE :search_name)";
    }

    $events_sql = raidlands_rewards_leaderboard_events_sql();
    $aggregate_sql = "SELECT
            p.id AS player_id,
            p.steam_id64,
            COALESCE(NULLIF(p.display_name, ''), 'Raidlands Player') AS display_name,
            SUM(filtered.payout_rp) AS total_rp_won,
            SUM(filtered.wins) AS wins,
            SUM(filtered.games_played) AS games_played,
            MAX(filtered.payout_rp) AS biggest_win
        FROM (
            SELECT events.* FROM ({$events_sql}) events {$event_where}
        ) filtered
        INNER JOIN players p ON p.id = filtered.player_id
        {$player_where}
        GROUP BY p.id, p.steam_id64, p.display_name";

    $total_row = raidlands_db_fetch_one("SELECT COUNT(*) AS total FROM ({$aggregate_sql}) ranked_players", $params);
    $total = (int) ($total_row['total'] ?? 0);
    $pages = max(1, (int) ceil($total / $per_page));
    $page = min($page, $pages);
    $offset = ($page - 1) * $per_page;
    $rows = raidlands_db_fetch_all(
        "{$aggregate_sql}
         ORDER BY total_rp_won DESC, wins DESC, games_played DESC, display_name ASC, player_id ASC
         LIMIT {$per_page} OFFSET {$offset}",
        $params
    );
    $rank = $offset + 1;

    foreach ($rows as &$row) {
        $row['rank'] = $rank++;
        $row['total_rp_won'] = (int) $row['total_rp_won'];
        $row['wins'] = (int) $row['wins'];
        $row['games_played'] = (int) $row['games_played'];
        $row['biggest_win'] = (int) $row['biggest_win'];
    }
    unset($row);

    if ($attach_steam_profiles) {
        $rows = raidlands_store_attach_steam_profiles($rows);
    }

    return raidlands_stats_page_result($rows, $total, $page, $per_page);
}

function raidlands_rewards_leaderboard_leaders(
    string $scope = 'current',
    int $wipe_id = 0,
    string $wipe_key = ''
): array {
    $result = raidlands_rewards_leaderboard_result($scope, 1, 5, '', $wipe_id, $wipe_key);

    return array_slice((array) ($result['rows'] ?? []), 0, 3);
}

function raidlands_rewards_recent_game_activity(int $player_id = 0, int $limit = 12): array
{
    $rounds = raidlands_rewards_recent_game_rounds($player_id, $limit);

    foreach ($rounds as &$round) {
        $round['activity_key'] = 'round-' . (int) ($round['id'] ?? 0);
    }
    unset($round);

    $blackjack = [];
    if (raidlands_rewards_table_exists('rp_blackjack_hands')) {
        $params = []; $where = '';
        if ($player_id > 0) { $where = 'WHERE player_id = :player_id'; $params['player_id'] = $player_id; }
        $blackjack = raidlands_db_fetch_all(
            "SELECT id, 'blackjack' AS game_type, total_stake_rp AS stake_rp, payout_rp,
                    CONCAT('Player ', JSON_LENGTH(player_cards_json), ' cards / dealer ', JSON_LENGTH(dealer_cards_json), ' cards') AS roll_result,
                    status, created_at, CONCAT('blackjack-', id) AS activity_key
             FROM rp_blackjack_hands {$where} ORDER BY created_at DESC LIMIT " . max(1, min(50, $limit)),
            $params
        );
    }
    $activity = array_merge($rounds, $blackjack, raidlands_monument_recent_activity($player_id, $limit));
    usort($activity, static function (array $left, array $right): int {
        $date_compare = strcmp((string) ($right['created_at'] ?? ''), (string) ($left['created_at'] ?? ''));

        if ($date_compare !== 0) {
            return $date_compare;
        }

        return strcmp((string) ($right['activity_key'] ?? ''), (string) ($left['activity_key'] ?? ''));
    });

    return array_slice($activity, 0, max(1, min(50, $limit)));
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

function raidlands_rewards_recent_pool_rounds(int $limit = 8): array
{
    if (!raidlands_rewards_pool_backend_ready()) {
        return [];
    }

    return raidlands_db_fetch_all(
        'SELECT *
         FROM rp_pool_rounds
         ORDER BY created_at DESC, id DESC
         LIMIT ' . max(1, min(25, $limit))
    );
}

function raidlands_rewards_home_preview_state(): array
{
    $catalog = [
        'coinflip' => ['label' => 'Coinflip', 'icon' => 'RISK'],
        'dice' => ['label' => 'Dice', 'icon' => 'STAT'],
        'jackpot' => ['label' => 'Jackpot', 'icon' => 'SHOP'],
        'raid_duel' => ['label' => 'Raid Duel', 'icon' => 'RISK'],
        'supply_run' => ['label' => 'Supply Run', 'icon' => 'EVENT'],
        'high_low' => ['label' => 'High-Low', 'icon' => 'CMD'],
        'wheel' => ['label' => 'Wheel', 'icon' => 'EVENT'],
    ];
    $fallback_games = [];

    foreach ($catalog as $game_key => $game) {
        $fallback_games[$game_key] = $game + [
            'key' => $game_key,
            'ready' => false,
            'enabled' => false,
        ];
    }

    $fallback = [
        'ready' => false,
        'message' => raidlands_rewards_readiness_message(false),
        'settings' => [
            'games_enabled' => 0,
            'min_stake_rp' => 200,
            'max_stake_rp' => 2000,
        ],
        'games' => $fallback_games,
        'active_jackpot' => null,
        'pool_rounds' => [],
        'recent_rounds' => [],
    ];

    if (!raidlands_rewards_is_ready()) {
        return $fallback;
    }

    try {
        $settings = raidlands_rewards_settings(false);
        $games_open = !empty($settings['games_enabled']);
        $games = [];

        foreach ($catalog as $game_key => $game) {
            $backend_ready = raidlands_rewards_game_backend_ready($game_key);
            $games[$game_key] = $game + [
                'key' => $game_key,
                'ready' => $backend_ready,
                'enabled' => $games_open && $backend_ready && !empty($settings[$game_key . '_enabled']),
            ];
        }

        $pool_rounds = [];

        foreach (array_keys(raidlands_rewards_pool_games()) as $game_type) {
            $round = raidlands_rewards_active_pool_round($game_type, $settings, false);
            $pool_rounds[$game_type] = raidlands_rewards_pool_round_state($round, $game_type);
        }

        return [
            'ready' => true,
            'message' => $games_open ? '' : 'RP games are currently paused.',
            'settings' => $settings,
            'games' => $games,
            'active_jackpot' => raidlands_rewards_active_jackpot_round($settings, false),
            'pool_rounds' => $pool_rounds,
            'recent_rounds' => raidlands_rewards_recent_game_rounds(0, 4),
        ];
    } catch (Throwable $error) {
        return $fallback;
    }
}

function raidlands_rewards_sync_poll_seconds(): int
{
    return max(10, min(120, raidlands_env_int('RAIDLANDS_RP_GAMES_STATUS_POLL_SECONDS', 30)));
}

function raidlands_rewards_player_sync_state(int $player_id): array
{
    $poll_seconds = raidlands_rewards_sync_poll_seconds();
    $empty = [
        'pending_count' => 0,
        'has_pending' => false,
        'latest_status' => '',
        'latest_message' => '',
        'latest_created_at' => '',
        'latest_updated_at' => '',
        'poll_seconds' => $poll_seconds,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    if ($player_id <= 0 || !raidlands_rewards_is_ready()) {
        return $empty;
    }

    $game_sources = "'coinflip', 'dice', 'high_low', 'wheel', 'jackpot_entry', 'jackpot_payout',
        'raid_duel_entry', 'raid_duel_payout', 'supply_run_entry', 'supply_run_payout',
        'monument_wager', 'monument_payout', 'roulette', 'slots',
        'blackjack_wager', 'blackjack_double', 'blackjack_payout'";
    $pending = raidlands_db_fetch_one(
        "SELECT COUNT(*) AS pending_count
         FROM rp_point_requests
         WHERE player_id = :player_id
           AND source_type IN ({$game_sources})
           AND status IN ('queued', 'processing')",
        ['player_id' => $player_id]
    );
    $latest = raidlands_db_fetch_one(
        "SELECT status, message, created_at, updated_at
         FROM rp_point_requests
         WHERE player_id = :player_id
           AND source_type IN ({$game_sources})
         ORDER BY created_at DESC, id DESC
         LIMIT 1",
        ['player_id' => $player_id]
    );
    $pending_count = max(0, (int) ($pending['pending_count'] ?? 0));

    return [
        'pending_count' => $pending_count,
        'has_pending' => $pending_count > 0,
        'latest_status' => (string) ($latest['status'] ?? ''),
        'latest_message' => (string) ($latest['message'] ?? ''),
        'latest_created_at' => (string) ($latest['created_at'] ?? ''),
        'latest_updated_at' => (string) ($latest['updated_at'] ?? ''),
        'poll_seconds' => $poll_seconds,
        'checked_at' => gmdate(DATE_ATOM),
    ];
}

function raidlands_rewards_public_games_state(bool $include_leaderboards = true): array
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
            'pool_rounds' => [],
            'game_rounds' => [],
            'jackpot_entries' => [],
            'jackpot_rounds' => [],
            'leaderboard_current' => [],
            'leaderboard_all_time' => [],
            'sync' => raidlands_rewards_player_sync_state(0),
            'game_backend' => [
                'high_low' => false,
                'wheel' => false,
                'raid_duel' => false,
                'supply_run' => false,
            ],
        ];
    }

    raidlands_rewards_run_due_jackpots();
    raidlands_rewards_run_due_pool_rounds();
    raidlands_blackjack_run_timeouts();
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
        'pool_rounds' => raidlands_rewards_pool_rounds_state($settings),
        'game_rounds' => $player_id > 0 ? raidlands_rewards_recent_game_activity($player_id, 10) : raidlands_rewards_recent_game_activity(0, 6),
        'jackpot_entries' => $player_id > 0 ? raidlands_rewards_recent_jackpot_entries($player_id, 10) : [],
        'jackpot_rounds' => raidlands_rewards_recent_jackpot_rounds(6),
        'leaderboard_current' => $include_leaderboards ? raidlands_rewards_leaderboard_result('current', 1, 10)['rows'] : [],
        'leaderboard_all_time' => $include_leaderboards ? raidlands_rewards_leaderboard_result('all-time', 1, 10)['rows'] : [],
        'sync' => raidlands_rewards_player_sync_state($player_id),
        'active_blackjack' => raidlands_blackjack_active($player_id),
        'game_backend' => [
            'high_low' => raidlands_rewards_game_backend_ready('high_low'),
            'wheel' => raidlands_rewards_game_backend_ready('wheel'),
            'raid_duel' => raidlands_rewards_game_backend_ready('raid_duel'),
            'supply_run' => raidlands_rewards_game_backend_ready('supply_run'),
            'roulette' => raidlands_rewards_game_backend_ready('roulette'),
            'slots' => raidlands_rewards_game_backend_ready('slots'),
            'blackjack' => raidlands_rewards_game_backend_ready('blackjack'),
        ],
    ];
}

function raidlands_rewards_games_wants_json(): bool
{
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    $requested_with = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));

    return str_contains($accept, 'application/json')
        || in_array($requested_with, ['fetch', 'xmlhttprequest'], true)
        || (string) ($_POST['format'] ?? '') === 'json';
}

function raidlands_rewards_games_json_response(bool $ok, string $type, string $message, array $result = []): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    http_response_code($ok ? 200 : 422);
    echo json_encode([
        'ok' => $ok,
        'type' => $type,
        'message' => $message,
        'result' => $result,
        'state' => raidlands_rewards_public_games_state(false),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function raidlands_rewards_handle_games_request(): void
{
    raidlands_store_boot();

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($method === 'GET' && (string) ($_GET['action'] ?? '') === 'state' && raidlands_rewards_games_wants_json()) {
        raidlands_rewards_games_json_response(true, 'success', 'RP status checked.');
    }

    if ($method !== 'POST') {
        return;
    }

    $action = (string) ($_POST['action'] ?? '');

    if (!in_array($action, ['play_coinflip', 'play_dice', 'play_high_low', 'play_wheel', 'play_roulette', 'play_slots', 'start_blackjack', 'blackjack_hit', 'blackjack_stand', 'blackjack_double', 'enter_jackpot', 'enter_raid_duel', 'enter_supply_run'], true)) {
        return;
    }

    $wants_json = raidlands_rewards_games_wants_json();
    $result = [];
    $message = '';
    $type = 'success';

    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your RP games session expired. Try again.');
        }

        if ($action === 'play_coinflip') {
            $result = raidlands_rewards_play_coinflip((string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            $message = $result['won']
                ? 'Coinflip hit ' . $result['roll'] . '. Your game is saved; the server is now adding the ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout.'
                : 'Coinflip hit ' . $result['roll'] . '. Your game is saved; the server is now updating your RP.';
        } elseif ($action === 'play_dice') {
            $result = raidlands_rewards_play_dice((int) ($_POST['stake_rp'] ?? 0));
            $message = $result['won']
                ? 'Dice landed on ' . $result['roll'] . '. Your game is saved; the server is now adding the ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout.'
                : 'Dice landed on ' . $result['roll'] . '. Your game is saved; the server is now updating your RP.';
        } elseif ($action === 'play_high_low') {
            $result = raidlands_rewards_play_high_low((string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            if (!empty($result['push'])) {
                $message = 'High-Low rolled ' . $result['roll'] . '. Your game is saved; the server is now returning ' . raidlands_store_rp((int) $result['payout_rp']) . '.';
            } else {
                $message = $result['won']
                    ? 'High-Low rolled ' . $result['roll'] . '. Your game is saved; the server is now adding the ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout.'
                    : 'High-Low rolled ' . $result['roll'] . '. Your game is saved; the server is now updating your RP.';
            }
        } elseif ($action === 'play_wheel') {
            $result = raidlands_rewards_play_wheel((string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            $outcome = ucwords(str_replace('_', ' ', (string) ($result['outcome'] ?? 'segment')));
            $message = $result['won']
                ? 'Wheel landed on ' . $outcome . '. Your game is saved; the server is now adding the ' . raidlands_store_rp((int) $result['payout_rp']) . ' payout.'
                : 'Wheel landed on ' . $outcome . '. Your game is saved; the server is now updating your RP.';
        } elseif ($action === 'play_roulette') {
            $bets = json_decode((string) ($_POST['bets_json'] ?? '[]'), true);
            if (!is_array($bets)) throw new InvalidArgumentException('Roulette bets are invalid.');
            $result = raidlands_casino_play_roulette($bets);
            $message = 'Roulette landed on ' . $result['roll'] . '. The server is confirming ' . raidlands_store_rp((int) $result['payout_rp']) . ' in payouts.';
        } elseif ($action === 'play_slots') {
            $result = raidlands_casino_play_slots((int) ($_POST['stake_rp'] ?? 0));
            $message = 'The reels stopped with ' . count((array) ($result['winning_lines'] ?? [])) . ' winning line(s). The server is confirming the result.';
        } elseif ($action === 'start_blackjack') {
            $result = raidlands_blackjack_start((int) ($_POST['stake_rp'] ?? 0));
            $message = 'Blackjack wager queued. Cards will be dealt after the Rust server confirms it.';
        } elseif (in_array($action, ['blackjack_hit', 'blackjack_stand', 'blackjack_double'], true)) {
            $result = raidlands_blackjack_action(substr($action, 10), (int) ($_POST['hand_id'] ?? 0), (int) ($_POST['action_version'] ?? 0));
            $message = (string) ($result['hand']['message'] ?? 'Blackjack hand updated.');
        } elseif ($action === 'enter_raid_duel') {
            $result = raidlands_rewards_enter_pool_game('raid_duel', (string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            $message = 'Your Raid Duel pick on ' . (string) $result['choice_label'] . ' is saved. The server is now confirming the ' . raidlands_store_rp((int) $result['stake_rp']) . ' entry.';
        } elseif ($action === 'enter_supply_run') {
            $result = raidlands_rewards_enter_pool_game('supply_run', (string) ($_POST['choice'] ?? ''), (int) ($_POST['stake_rp'] ?? 0));
            $message = 'Your Supply Run pick on ' . (string) $result['choice_label'] . ' is saved. The server is now confirming the ' . raidlands_store_rp((int) $result['stake_rp']) . ' entry.';
        } else {
            $result = raidlands_rewards_enter_jackpot((int) ($_POST['tickets'] ?? 1));
            $ticket_count = (int) $result['tickets'];
            $message = 'Your ' . (string) $ticket_count . ' jackpot ticket' . ($ticket_count === 1 ? ' is' : 's are') . ' saved. The server is now confirming the ' . raidlands_store_rp((int) $result['cost_rp']) . ' entry.';
        }

        if ($wants_json) {
            raidlands_rewards_games_json_response(true, $type, $message, $result);
        }
    } catch (Throwable $error) {
        $type = 'error';
        $message = $error->getMessage();

        if ($wants_json) {
            raidlands_rewards_games_json_response(false, $type, $message, []);
        }
    }

    raidlands_store_flash($type, $message);
    raidlands_store_redirect('rp-games');
}

function raidlands_rewards_bridge_point_requests(int $limit = 25): array
{
    if (!raidlands_rewards_is_ready()) {
        return [];
    }

    raidlands_rewards_run_due_jackpots();
    raidlands_rewards_run_due_pool_rounds();

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

        if (in_array((string) $request['status'], ['confirmed', 'rejected', 'failed', 'expired', 'canceled'], true)) {
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

    if (raidlands_monument_sync_point_result($pdo, $request, $status, $message, $fail_code)) {
        return;
    }

    if (raidlands_blackjack_sync_point_result($pdo, $request, $status, $message)) {
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

    if (in_array($source_type, ['coinflip', 'dice', 'high_low', 'wheel', 'roulette', 'slots'], true)) {
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

    $pool_entry_game = raidlands_rewards_pool_game_for_source($source_type, 'entry');

    if ($pool_entry_game !== null && raidlands_rewards_pool_backend_ready((string) $pool_entry_game['key'])) {
        $entry = raidlands_db_fetch_one('SELECT * FROM rp_pool_entries WHERE id = :id LIMIT 1', ['id' => $source_id]);
        $update = $pdo->prepare(
            'UPDATE rp_pool_entries
             SET status = :status,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $source_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'Pool entry confirmed by the Rust server.' : 'Pool entry was not confirmed.'),
            'id' => $source_id,
        ]);

        if ($entry !== null && $status === 'confirmed') {
            $round = raidlands_db_fetch_one('SELECT * FROM rp_pool_rounds WHERE id = :id LIMIT 1', ['id' => (int) $entry['round_id']]);

            if ($round !== null && (string) ($round['status'] ?? '') === 'open') {
                $round_update = $pdo->prepare(
                    'UPDATE rp_pool_rounds
                     SET total_stake_rp = total_stake_rp + :stake_rp,
                         total_entries = total_entries + 1,
                         updated_at = NOW()
                     WHERE id = :round_id'
                );
                $round_update->execute([
                    'stake_rp' => (int) $entry['stake_rp'],
                    'round_id' => (int) $entry['round_id'],
                ]);
            } else {
                raidlands_rewards_queue_pool_payout(
                    $pdo,
                    $entry,
                    $pool_entry_game,
                    (int) $entry['stake_rp'],
                    'Round already closed; stake refund queued.',
                    ['round_id' => (int) $entry['round_id'], 'late_confirmation_refund' => true]
                );
            }
        } elseif ($entry !== null && in_array($status, ['rejected', 'failed'], true)) {
            raidlands_rewards_rollback_daily_wager(
                $pdo,
                (int) $entry['player_id'],
                (int) $entry['stake_rp'],
                (int) $entry['stake_rp']
            );
        }
        return;
    }

    $pool_payout_game = raidlands_rewards_pool_game_for_source($source_type, 'payout');

    if ($pool_payout_game !== null && raidlands_rewards_pool_backend_ready((string) $pool_payout_game['key'])) {
        $entry = raidlands_db_fetch_one('SELECT * FROM rp_pool_entries WHERE id = :id LIMIT 1', ['id' => $source_id]);
        $entry_status = $status === 'confirmed' ? 'paid' : 'failed';
        $update = $pdo->prepare(
            'UPDATE rp_pool_entries
             SET status = :status,
                 message = :message,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'status' => $entry_status,
            'message' => $message !== '' ? $message : ($status === 'confirmed' ? 'Pool payout confirmed by the Rust server.' : 'Pool payout was not confirmed.'),
            'id' => $source_id,
        ]);

        if ($entry !== null) {
            raidlands_rewards_refresh_pool_round_status($pdo, (int) $entry['round_id']);
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
        $api_provider = raidlands_rewards_clean_provider((string) ($row['api_provider'] ?? 'none'));
        $api_key = mb_substr(trim((string) ($row['api_key'] ?? '')), 0, 160);
        $api_server_id = mb_substr(raidlands_store_clean_profile_text($row['api_server_id'] ?? '', 80), 0, 80);
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
                     api_provider = :api_provider,
                     api_key = :api_key,
                     api_server_id = :api_server_id,
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
                    'api_provider' => $api_provider,
                    'api_key' => $api_key,
                    'api_server_id' => $api_server_id,
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
                    (slug, name, description, vote_url_template, verification_mode, api_provider, api_key, api_server_id, callback_token, reward_rp, cooldown_hours, is_active, sort_order)
                 VALUES
                    (:slug, :name, :description, :vote_url_template, :verification_mode, :api_provider, :api_key, :api_server_id, :callback_token, :reward_rp, :cooldown_hours, :is_active, :sort_order)',
                [
                    'slug' => $slug,
                    'name' => $name,
                    'description' => $description,
                    'vote_url_template' => $url,
                    'verification_mode' => $mode,
                    'api_provider' => $api_provider,
                    'api_key' => $api_key,
                    'api_server_id' => $api_server_id,
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

    $set = [
        'games_enabled = :games_enabled',
        'coinflip_enabled = :coinflip_enabled',
        'dice_enabled = :dice_enabled',
        'jackpot_enabled = :jackpot_enabled',
        'min_stake_rp = :min_stake_rp',
        'max_stake_rp = :max_stake_rp',
        'coinflip_payout_multiplier_basis = :coinflip_payout_multiplier_basis',
        'dice_win_chance_percent = :dice_win_chance_percent',
        'dice_payout_multiplier_basis = :dice_payout_multiplier_basis',
        'jackpot_ticket_cost_rp = :jackpot_ticket_cost_rp',
        'jackpot_max_entries_per_player = :jackpot_max_entries_per_player',
        'jackpot_round_minutes = :jackpot_round_minutes',
        'jackpot_house_edge_percent = :jackpot_house_edge_percent',
        'pool_round_minutes = :pool_round_minutes',
        'pool_house_edge_percent = :pool_house_edge_percent',
        'daily_wager_cap_rp = :daily_wager_cap_rp',
        'daily_loss_cap_rp = :daily_loss_cap_rp',
        'self_exclusion_enabled = :self_exclusion_enabled',
        'terms_copy = :terms_copy',
    ];
    $params = [
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
        'pool_round_minutes' => raidlands_rewards_limit_int($post['pool_round_minutes'] ?? 20, 5, 1440, 20),
        'pool_house_edge_percent' => raidlands_rewards_limit_int($post['pool_house_edge_percent'] ?? 8, 0, 50, 8),
        'daily_wager_cap_rp' => raidlands_rewards_limit_int($post['daily_wager_cap_rp'] ?? 10000, 0, 100000000, 10000),
        'daily_loss_cap_rp' => raidlands_rewards_limit_int($post['daily_loss_cap_rp'] ?? 5000, 0, 100000000, 5000),
        'self_exclusion_enabled' => raidlands_rewards_bool($post['self_exclusion_enabled'] ?? null),
        'terms_copy' => $terms,
    ];

    if (raidlands_store_table_has_columns('rp_game_settings', ['high_low_enabled'])) {
        $set[] = 'high_low_enabled = :high_low_enabled';
        $params['high_low_enabled'] = raidlands_rewards_bool($post['high_low_enabled'] ?? null);
    }

    if (raidlands_store_table_has_columns('rp_game_settings', ['wheel_enabled'])) {
        $set[] = 'wheel_enabled = :wheel_enabled';
        $params['wheel_enabled'] = raidlands_rewards_bool($post['wheel_enabled'] ?? null);
    }

    foreach (['roulette', 'slots', 'blackjack'] as $casino_game) {
        if (raidlands_store_table_has_columns('rp_game_settings', [$casino_game . '_enabled'])) {
            $set[] = $casino_game . '_enabled = :' . $casino_game . '_enabled';
            $params[$casino_game . '_enabled'] = raidlands_rewards_bool($post[$casino_game . '_enabled'] ?? null);
        }
    }
    if (raidlands_store_table_has_columns('rp_game_settings', ['casino_rtp_preset'])) {
        $preset = strtolower(trim((string) ($post['casino_rtp_preset'] ?? 'balanced')));
        $set[] = 'casino_rtp_preset = :casino_rtp_preset';
        $params['casino_rtp_preset'] = in_array($preset, ['safe', 'balanced', 'generous'], true) ? $preset : 'balanced';
    }

    if (raidlands_store_table_has_columns('rp_game_settings', ['raid_duel_enabled'])) {
        $set[] = 'raid_duel_enabled = :raid_duel_enabled';
        $params['raid_duel_enabled'] = raidlands_rewards_bool($post['raid_duel_enabled'] ?? null);
    }

    if (raidlands_store_table_has_columns('rp_game_settings', ['supply_run_enabled'])) {
        $set[] = 'supply_run_enabled = :supply_run_enabled';
        $params['supply_run_enabled'] = raidlands_rewards_bool($post['supply_run_enabled'] ?? null);
    }

    if (raidlands_store_table_has_columns('rp_game_settings', ['monument_extraction_enabled'])) {
        $set[] = 'monument_extraction_enabled = :monument_extraction_enabled';
        $params['monument_extraction_enabled'] = raidlands_rewards_bool($post['monument_extraction_enabled'] ?? null);
    }

    if (!raidlands_store_table_has_columns('rp_game_settings', ['pool_round_minutes'])) {
        $set = array_values(array_filter($set, static fn (string $item): bool => $item !== 'pool_round_minutes = :pool_round_minutes'));
        unset($params['pool_round_minutes']);
    }

    if (!raidlands_store_table_has_columns('rp_game_settings', ['pool_house_edge_percent'])) {
        $set = array_values(array_filter($set, static fn (string $item): bool => $item !== 'pool_house_edge_percent = :pool_house_edge_percent'));
        unset($params['pool_house_edge_percent']);
    }

    raidlands_db_execute(
        'UPDATE rp_game_settings
         SET ' . implode(",\n             ", $set) . ',
             updated_at = NOW()
         WHERE id = 1',
        $params
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
            'recent_pool_rounds' => [],
            'monument' => ['ready' => false, 'message' => raidlands_monument_readiness_message()],
        ];
    }

    raidlands_rewards_seed_defaults();
    raidlands_rewards_run_due_jackpots();
    raidlands_rewards_run_due_pool_rounds();

    return [
        'ready' => true,
        'message' => '',
        'settings' => raidlands_rewards_settings(),
        'sites' => raidlands_rewards_vote_sites(false),
        'recent_requests' => raidlands_rewards_recent_point_requests(20),
        'recent_game_rounds' => raidlands_rewards_recent_game_rounds(0, 12),
        'recent_jackpots' => raidlands_rewards_recent_jackpot_rounds(10),
        'recent_pool_rounds' => raidlands_rewards_recent_pool_rounds(10),
        'monument' => raidlands_monument_admin_state(),
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
        $monument_message = raidlands_monument_is_ready()
            ? raidlands_monument_admin_save($post)
            : raidlands_monument_readiness_message();
        return 'RP game settings saved. ' . $monument_message;
    }

    throw new InvalidArgumentException('Unknown rewards admin section.');
}
