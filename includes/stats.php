<?php

require_once __DIR__ . '/store.php';

function raidlands_stats_server_id(): string
{
    global $vip_bridge_config;

    $server_id = trim((string) ($vip_bridge_config['serverId'] ?? 'raidlands-main'));

    return $server_id !== '' ? $server_id : 'raidlands-main';
}

function raidlands_stats_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM wipe_seasons LIMIT 1');
        raidlands_db_fetch_one('SELECT baseline_reward_points FROM player_wipe_stats LIMIT 1');
        raidlands_db_fetch_one('SELECT baseline_npc_kills FROM player_wipe_stats LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM bot_wipe_stats LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_stats_clean_text($value, int $max_length = 120): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_stats_int($value): int
{
    if (!is_numeric($value)) {
        return 0;
    }

    return max(0, min(2147483647, (int) round((float) $value)));
}

function raidlands_stats_timestamp($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        return gmdate('Y-m-d H:i:s', (int) $value);
    }

    $timestamp = strtotime((string) $value);

    return $timestamp === false ? null : gmdate('Y-m-d H:i:s', $timestamp);
}

function raidlands_stats_wipe_key(string $wipe_key): string
{
    $wipe_key = trim($wipe_key);
    $wipe_key = preg_replace('/[^a-zA-Z0-9_.:-]+/', '-', $wipe_key) ?? '';
    $wipe_key = trim($wipe_key, '-_.:');

    if ($wipe_key === '') {
        throw new InvalidArgumentException('Stats snapshot is missing a wipe key.');
    }

    return substr($wipe_key, 0, 160);
}

function raidlands_stats_bot_key($value): string
{
    $bot_key = trim((string) $value);
    $bot_key = preg_replace('/[^a-zA-Z0-9_.:-]+/', '-', $bot_key) ?? '';
    $bot_key = trim($bot_key, '-_.:');

    return substr($bot_key, 0, 120);
}

function raidlands_stats_snapshot_limit(string $config_key, int $default): int
{
    global $vip_bridge_config;

    $value = $vip_bridge_config[$config_key] ?? $default;

    return is_numeric($value) ? max(0, (int) $value) : $default;
}

function raidlands_stats_first_present(array $row, array $keys, $default = '')
{
    foreach ($keys as $key) {
        if (!array_key_exists($key, $row)) {
            continue;
        }

        $value = $row[$key];

        if (is_scalar($value) && trim((string) $value) !== '') {
            return $value;
        }
    }

    return $default;
}

function raidlands_stats_bot_activity_score(array $bot): int
{
    return raidlands_stats_int($bot['kills'] ?? 0)
        + raidlands_stats_int($bot['deaths'] ?? 0)
        + raidlands_stats_int($bot['spawns'] ?? 0);
}

function raidlands_stats_normalize_bot_payload(array $bots, int &$errors): array
{
    $normalized = [];

    foreach ($bots as $payload_key => $bot) {
        if (!is_array($bot)) {
            $errors++;
            continue;
        }

        $fallback_key = is_int($payload_key) ? '' : (string) $payload_key;
        $bot_key = raidlands_stats_bot_key(raidlands_stats_first_present($bot, ['bot_key', 'bot_id', 'id', 'key'], $fallback_key));

        if ($bot_key === '') {
            $errors++;
            continue;
        }

        $bot['bot_key'] = $bot_key;
        $existing = $normalized[$bot_key] ?? null;

        if ($existing === null || raidlands_stats_bot_activity_score($bot) >= raidlands_stats_bot_activity_score($existing)) {
            $normalized[$bot_key] = $bot;
        }
    }

    return array_values($normalized);
}

function raidlands_stats_ingest_snapshot(array $payload, string $server_id, string $body): array
{
    if (!raidlands_stats_is_ready()) {
        throw new RuntimeException('Player stats tables are not installed. Run database/migrations/002_player_stats.sql, database/migrations/016_player_stats_wipe_rp_baseline.sql, then database/migrations/022_bot_stats.sql.');
    }

    $server_id = raidlands_stats_clean_text($server_id !== '' ? $server_id : raidlands_stats_server_id(), 120);
    $wipe_key = raidlands_stats_wipe_key((string) ($payload['wipe_key'] ?? ''));
    $wipe_started_at = raidlands_stats_timestamp($payload['wipe_started_at'] ?? null);
    $generated_at = raidlands_stats_timestamp($payload['generated_at'] ?? null) ?? gmdate('Y-m-d H:i:s');
    $players = $payload['players'] ?? [];
    $bots = $payload['bots'] ?? [];
    $preprocess_errors = 0;
    $players_received = is_array($players) ? count($players) : 0;
    $bots_received = is_array($bots) ? count($bots) : 0;

    if (!is_array($players)) {
        throw new InvalidArgumentException('Stats snapshot players must be an array.');
    }

    if (!is_array($bots)) {
        throw new InvalidArgumentException('Stats snapshot bots must be an array.');
    }

    $players_limit = raidlands_stats_snapshot_limit('statsMaxPlayers', 5000);
    $bots_limit = raidlands_stats_snapshot_limit('statsMaxBots', 0);
    $bots = raidlands_stats_normalize_bot_payload($bots, $preprocess_errors);

    if ($players_limit > 0 && count($players) > $players_limit) {
        throw new InvalidArgumentException('Stats snapshot has too many players.');
    }

    if ($bots_limit > 0 && count($bots) > $bots_limit) {
        throw new InvalidArgumentException('Stats snapshot has too many bots.');
    }

    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    $accepted = 0;
    $bots_accepted = 0;
    $errors = $preprocess_errors;

    try {
        $season = raidlands_stats_get_or_create_wipe($pdo, $server_id, $wipe_key, $wipe_started_at);
        $wipe_id = (int) $season['id'];
        $is_first_season = !empty($season['is_first_season']);

        foreach ($players as $payload_key => $player) {
            if (!is_array($player)) {
                $errors++;
                continue;
            }

            $steam_id64 = preg_replace('/\D+/', '', (string) raidlands_stats_first_present($player, ['steam_id64', 'steam_id', 'id'], $payload_key)) ?? '';

            if (!raidlands_store_validate_steam_id64($steam_id64)) {
                $errors++;
                continue;
            }

            $display_name = raidlands_stats_clean_text($player['display_name'] ?? '', 120);
            $player_id = raidlands_stats_upsert_player($pdo, $steam_id64, $display_name);
            $raw = [
                'kills' => raidlands_stats_int($player['kills'] ?? 0),
                'deaths' => raidlands_stats_int($player['deaths'] ?? 0),
                'playtime_seconds' => raidlands_stats_int($player['playtime_seconds'] ?? 0),
                'afk_seconds' => raidlands_stats_int($player['afk_seconds'] ?? 0),
                'reward_points' => raidlands_stats_int($player['reward_points'] ?? 0),
                'npc_kills' => raidlands_stats_int($player['npc_kills'] ?? 0),
                'deaths_by_npc' => raidlands_stats_int($player['deaths_by_npc'] ?? 0),
            ];

            raidlands_stats_upsert_player_wipe($pdo, $wipe_id, $player_id, $display_name, $raw, $is_first_season);
            $accepted++;
        }

        foreach ($bots as $bot) {
            if (!is_array($bot)) {
                $errors++;
                continue;
            }

            $bot_key = raidlands_stats_bot_key($bot['bot_key'] ?? '');

            if ($bot_key === '') {
                $errors++;
                continue;
            }

            raidlands_stats_upsert_bot_wipe($pdo, $wipe_id, $bot_key, $bot, $is_first_season);
            $bots_accepted++;
        }

        $update = $pdo->prepare(
            'UPDATE wipe_seasons
             SET last_snapshot_at = :generated_at,
                 snapshot_count = snapshot_count + 1,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'generated_at' => $generated_at,
            'id' => $wipe_id,
        ]);

        $log = $pdo->prepare(
            'INSERT INTO stats_ingest_log
                (server_id, wipe_id, wipe_key, generated_at, players_received, players_accepted, error_count, payload_hash)
             VALUES
                (:server_id, :wipe_id, :wipe_key, :generated_at, :players_received, :players_accepted, :error_count, :payload_hash)'
        );
        $log->execute([
            'server_id' => $server_id,
            'wipe_id' => $wipe_id,
            'wipe_key' => $wipe_key,
            'generated_at' => $generated_at,
            'players_received' => $players_received,
            'players_accepted' => $accepted,
            'error_count' => $errors,
            'payload_hash' => hash('sha256', $body),
        ]);

        $pdo->commit();

        return [
            'wipe_id' => $wipe_id,
            'wipe_key' => $wipe_key,
            'players_received' => $players_received,
            'players_accepted' => $accepted,
            'bots_received' => $bots_received,
            'bots_accepted' => $bots_accepted,
            'error_count' => $errors,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_stats_get_or_create_wipe(PDO $pdo, string $server_id, string $wipe_key, ?string $started_at): array
{
    $existing = raidlands_db_fetch_one(
        'SELECT * FROM wipe_seasons WHERE server_id = :server_id AND wipe_key = :wipe_key',
        ['server_id' => $server_id, 'wipe_key' => $wipe_key]
    );

    if ($existing !== null) {
        $pdo->prepare('UPDATE wipe_seasons SET is_active = 0 WHERE server_id = :server_id AND id <> :id')
            ->execute(['server_id' => $server_id, 'id' => (int) $existing['id']]);
        $pdo->prepare('UPDATE wipe_seasons SET is_active = 1, updated_at = NOW() WHERE id = :id')
            ->execute(['id' => (int) $existing['id']]);

        $existing['is_first_season'] = false;
        return $existing;
    }

    $count = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS total FROM wipe_seasons WHERE server_id = :server_id',
        ['server_id' => $server_id]
    );
    $is_first_season = ((int) ($count['total'] ?? 0)) === 0;

    $pdo->prepare('UPDATE wipe_seasons SET is_active = 0, ended_at = COALESCE(ended_at, NOW()) WHERE server_id = :server_id AND is_active = 1')
        ->execute(['server_id' => $server_id]);

    $insert = $pdo->prepare(
        'INSERT INTO wipe_seasons (server_id, wipe_key, started_at, is_active)
         VALUES (:server_id, :wipe_key, :started_at, 1)'
    );
    $insert->execute([
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'started_at' => $started_at,
    ]);

    return [
        'id' => (int) $pdo->lastInsertId(),
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'started_at' => $started_at,
        'is_first_season' => $is_first_season,
    ];
}

function raidlands_stats_upsert_player(PDO $pdo, string $steam_id64, string $display_name): int
{
    $statement = $pdo->prepare(
        'INSERT INTO players (steam_id64, display_name, last_seen_at)
         VALUES (:steam_id64, :display_name, NOW())
         ON DUPLICATE KEY UPDATE
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            last_seen_at = NOW(),
            updated_at = NOW()'
    );
    $statement->execute([
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
    ]);

    $row = raidlands_db_fetch_one(
        'SELECT id FROM players WHERE steam_id64 = :steam_id64',
        ['steam_id64' => $steam_id64]
    );

    if ($row === null) {
        throw new RuntimeException('Player could not be loaded after stat upsert.');
    }

    return (int) $row['id'];
}

function raidlands_stats_upsert_player_wipe(PDO $pdo, int $wipe_id, int $player_id, string $display_name, array $raw, bool $is_first_season): void
{
    $existing = raidlands_db_fetch_one(
        'SELECT * FROM player_wipe_stats WHERE wipe_id = :wipe_id AND player_id = :player_id',
        ['wipe_id' => $wipe_id, 'player_id' => $player_id]
    );
    $baseline = [
        'kills' => 0,
        'deaths' => 0,
        'playtime_seconds' => 0,
        'afk_seconds' => 0,
        'reward_points' => 0,
        'npc_kills' => 0,
        'deaths_by_npc' => 0,
    ];

    if ($existing !== null) {
        $baseline = [
            'kills' => (int) $existing['baseline_kills'],
            'deaths' => (int) $existing['baseline_deaths'],
            'playtime_seconds' => (int) $existing['baseline_playtime_seconds'],
            'afk_seconds' => (int) $existing['baseline_afk_seconds'],
            'reward_points' => (int) $existing['baseline_reward_points'],
            'npc_kills' => (int) $existing['baseline_npc_kills'],
            'deaths_by_npc' => (int) $existing['baseline_deaths_by_npc'],
        ];
    } elseif (!$is_first_season) {
        $baseline = [
            'kills' => $raw['kills'],
            'deaths' => $raw['deaths'],
            'playtime_seconds' => $raw['playtime_seconds'],
            'afk_seconds' => $raw['afk_seconds'],
            'reward_points' => $raw['reward_points'],
            'npc_kills' => $raw['npc_kills'],
            'deaths_by_npc' => $raw['deaths_by_npc'],
        ];
    }

    $kills = max(0, $raw['kills'] - $baseline['kills']);
    $deaths = max(0, $raw['deaths'] - $baseline['deaths']);
    $playtime = max(0, $raw['playtime_seconds'] - $baseline['playtime_seconds']);
    $afk = max(0, $raw['afk_seconds'] - $baseline['afk_seconds']);
    $reward_points = max(0, $raw['reward_points'] - $baseline['reward_points']);
    $npc_kills = max(0, $raw['npc_kills'] - $baseline['npc_kills']);
    $deaths_by_npc = max(0, $raw['deaths_by_npc'] - $baseline['deaths_by_npc']);
    $kdr = $deaths === 0 ? (float) $kills : round($kills / $deaths, 3);

    $statement = $pdo->prepare(
        'INSERT INTO player_wipe_stats
            (wipe_id, player_id, display_name, raw_kills, raw_deaths, raw_playtime_seconds, raw_afk_seconds, raw_reward_points,
             raw_npc_kills, raw_deaths_by_npc,
             baseline_kills, baseline_deaths, baseline_playtime_seconds, baseline_afk_seconds, baseline_reward_points,
             baseline_npc_kills, baseline_deaths_by_npc,
             kills, deaths, npc_kills, deaths_by_npc, playtime_seconds, afk_seconds, reward_points, kdr, last_seen_at)
         VALUES
            (:wipe_id, :player_id, :display_name, :raw_kills, :raw_deaths, :raw_playtime_seconds, :raw_afk_seconds, :raw_reward_points,
             :raw_npc_kills, :raw_deaths_by_npc,
             :baseline_kills, :baseline_deaths, :baseline_playtime_seconds, :baseline_afk_seconds, :baseline_reward_points,
             :baseline_npc_kills, :baseline_deaths_by_npc,
             :kills, :deaths, :npc_kills, :deaths_by_npc, :playtime_seconds, :afk_seconds, :reward_points, :kdr, NOW())
         ON DUPLICATE KEY UPDATE
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            raw_kills = VALUES(raw_kills),
            raw_deaths = VALUES(raw_deaths),
            raw_playtime_seconds = VALUES(raw_playtime_seconds),
            raw_afk_seconds = VALUES(raw_afk_seconds),
            raw_reward_points = VALUES(raw_reward_points),
            raw_npc_kills = VALUES(raw_npc_kills),
            raw_deaths_by_npc = VALUES(raw_deaths_by_npc),
            kills = VALUES(kills),
            deaths = VALUES(deaths),
            npc_kills = VALUES(npc_kills),
            deaths_by_npc = VALUES(deaths_by_npc),
            playtime_seconds = VALUES(playtime_seconds),
            afk_seconds = VALUES(afk_seconds),
            reward_points = VALUES(reward_points),
            kdr = VALUES(kdr),
            last_seen_at = NOW(),
            updated_at = NOW()'
    );
    $statement->execute([
        'wipe_id' => $wipe_id,
        'player_id' => $player_id,
        'display_name' => $display_name,
        'raw_kills' => $raw['kills'],
        'raw_deaths' => $raw['deaths'],
        'raw_playtime_seconds' => $raw['playtime_seconds'],
        'raw_afk_seconds' => $raw['afk_seconds'],
        'raw_reward_points' => $raw['reward_points'],
        'raw_npc_kills' => $raw['npc_kills'],
        'raw_deaths_by_npc' => $raw['deaths_by_npc'],
        'baseline_kills' => $baseline['kills'],
        'baseline_deaths' => $baseline['deaths'],
        'baseline_playtime_seconds' => $baseline['playtime_seconds'],
        'baseline_afk_seconds' => $baseline['afk_seconds'],
        'baseline_reward_points' => $baseline['reward_points'],
        'baseline_npc_kills' => $baseline['npc_kills'],
        'baseline_deaths_by_npc' => $baseline['deaths_by_npc'],
        'kills' => $kills,
        'deaths' => $deaths,
        'npc_kills' => $npc_kills,
        'deaths_by_npc' => $deaths_by_npc,
        'playtime_seconds' => $playtime,
        'afk_seconds' => $afk,
        'reward_points' => $reward_points,
        'kdr' => $kdr,
    ]);
}

function raidlands_stats_upsert_bot_wipe(PDO $pdo, int $wipe_id, string $bot_key, array $bot, bool $is_first_season): void
{
    $existing = raidlands_db_fetch_one(
        'SELECT * FROM bot_wipe_stats WHERE wipe_id = :wipe_id AND bot_key = :bot_key',
        ['wipe_id' => $wipe_id, 'bot_key' => $bot_key]
    );
    $raw = [
        'kills' => raidlands_stats_int($bot['kills'] ?? 0),
        'deaths' => raidlands_stats_int($bot['deaths'] ?? 0),
    ];
    $baseline = [
        'kills' => 0,
        'deaths' => 0,
    ];

    if ($existing !== null) {
        $baseline = [
            'kills' => (int) $existing['baseline_kills'],
            'deaths' => (int) $existing['baseline_deaths'],
        ];
    } elseif (!$is_first_season) {
        $baseline = [
            'kills' => $raw['kills'],
            'deaths' => $raw['deaths'],
        ];
    }

    $kills = max(0, $raw['kills'] - $baseline['kills']);
    $deaths = max(0, $raw['deaths'] - $baseline['deaths']);
    $kdr = $deaths === 0 ? (float) $kills : round($kills / $deaths, 3);
    $display_name = raidlands_stats_clean_text(raidlands_stats_first_present($bot, ['display_name', 'bot_name', 'name'], $bot_key), 120);
    $kit_name = raidlands_stats_clean_text(raidlands_stats_first_present($bot, ['kit_name', 'kit', 'kit_type', 'loadout'], ''), 80);
    $skill_tier = raidlands_stats_clean_text(raidlands_stats_first_present($bot, ['skill_tier', 'skill', 'tier', 'difficulty'], ''), 40);

    $statement = $pdo->prepare(
        'INSERT INTO bot_wipe_stats
            (wipe_id, bot_key, display_name, kit_name, skill_tier, raw_kills, raw_deaths,
             baseline_kills, baseline_deaths, kills, deaths, kdr, last_seen_at)
         VALUES
            (:wipe_id, :bot_key, :display_name, :kit_name, :skill_tier, :raw_kills, :raw_deaths,
             :baseline_kills, :baseline_deaths, :kills, :deaths, :kdr, NOW())
         ON DUPLICATE KEY UPDATE
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            kit_name = IF(VALUES(kit_name) <> "", VALUES(kit_name), kit_name),
            skill_tier = IF(VALUES(skill_tier) <> "", VALUES(skill_tier), skill_tier),
            raw_kills = VALUES(raw_kills),
            raw_deaths = VALUES(raw_deaths),
            kills = VALUES(kills),
            deaths = VALUES(deaths),
            kdr = VALUES(kdr),
            last_seen_at = NOW(),
            updated_at = NOW()'
    );
    $statement->execute([
        'wipe_id' => $wipe_id,
        'bot_key' => $bot_key,
        'display_name' => $display_name,
        'kit_name' => $kit_name,
        'skill_tier' => $skill_tier,
        'raw_kills' => $raw['kills'],
        'raw_deaths' => $raw['deaths'],
        'baseline_kills' => $baseline['kills'],
        'baseline_deaths' => $baseline['deaths'],
        'kills' => $kills,
        'deaths' => $deaths,
        'kdr' => $kdr,
    ]);
}

function raidlands_stats_active_wipe(): ?array
{
    if (!raidlands_stats_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM wipe_seasons WHERE server_id = :server_id AND is_active = 1 ORDER BY started_at DESC, id DESC LIMIT 1',
        ['server_id' => raidlands_stats_server_id()]
    );
}

function raidlands_stats_latest_ingest(): ?array
{
    if (!raidlands_stats_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT l.*, w.started_at, w.last_snapshot_at, w.snapshot_count
         FROM stats_ingest_log l
         LEFT JOIN wipe_seasons w ON w.id = l.wipe_id
         WHERE l.server_id = :server_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 1',
        ['server_id' => raidlands_stats_server_id()]
    );
}

function raidlands_stats_metric(string $metric): string
{
    return in_array($metric, ['kills', 'kdr', 'playtime', 'rp', 'npc_kills', 'deaths_by_npc'], true) ? $metric : 'kills';
}

function raidlands_stats_bot_metric(string $metric): string
{
    return in_array($metric, ['kdr', 'kills', 'deaths'], true) ? $metric : 'kdr';
}

function raidlands_stats_scope(string $scope): string
{
    return $scope === 'all-time' ? 'all-time' : 'current';
}

function raidlands_stats_page_size($value, int $default = 25): int
{
    $size = is_numeric($value) ? (int) $value : $default;

    return max(5, min(100, $size));
}

function raidlands_stats_page_number($value): int
{
    $page = is_numeric($value) ? (int) $value : 1;

    return max(1, $page);
}

function raidlands_stats_search(string $search): string
{
    return raidlands_stats_clean_text($search, 80);
}

function raidlands_stats_page_result(array $rows, int $total, int $page, int $per_page): array
{
    $total = max(0, $total);
    $per_page = raidlands_stats_page_size($per_page);
    $pages = max(1, (int) ceil($total / $per_page));

    return [
        'rows' => $rows,
        'total' => $total,
        'page' => min(max(1, $page), $pages),
        'per_page' => $per_page,
        'pages' => $pages,
    ];
}

function raidlands_stats_leaderboard_order(string $metric): string
{
    return match (raidlands_stats_metric($metric)) {
        'kdr' => 'kdr DESC, kills DESC, deaths ASC',
        'playtime' => 'playtime_seconds DESC, kills DESC',
        'rp' => 'reward_points DESC, kills DESC',
        'npc_kills' => 'npc_kills DESC, deaths_by_npc ASC, kills DESC',
        'deaths_by_npc' => 'deaths_by_npc DESC, npc_kills DESC, kills DESC',
        default => 'kills DESC, deaths ASC, kdr DESC',
    };
}

function raidlands_stats_bot_leaderboard_order(string $metric): string
{
    return match (raidlands_stats_bot_metric($metric)) {
        'kills' => 'kills DESC, kdr DESC, deaths ASC, display_name ASC',
        'deaths' => 'deaths DESC, kills DESC, kdr DESC, display_name ASC',
        default => 'kdr DESC, kills DESC, deaths ASC, display_name ASC',
    };
}

function raidlands_stats_leaderboard_result(
    string $metric = 'kills',
    string $scope = 'current',
    int $page = 1,
    int $per_page = 25,
    string $search = ''
): array
{
    if (!raidlands_stats_is_ready()) {
        return raidlands_stats_page_result([], 0, $page, $per_page);
    }

    $metric = raidlands_stats_metric($metric);
    $scope = raidlands_stats_scope($scope);
    $page = raidlands_stats_page_number($page);
    $per_page = raidlands_stats_page_size($per_page);
    $search = raidlands_stats_search($search);
    $params = [];
    $search_sql = '';

    if ($search !== '') {
        $like = '%' . $search . '%';
        $params['search_steam_id'] = $like;
        $params['search_player_name'] = $like;
        $params['search_stats_name'] = $like;
        $search_sql = ' AND (p.steam_id64 LIKE :search_steam_id OR p.display_name LIKE :search_player_name OR s.display_name LIKE :search_stats_name)';
    }

    $order = raidlands_stats_leaderboard_order($metric);

    if ($scope === 'current') {
        $wipe = raidlands_stats_active_wipe();

        if ($wipe === null) {
            return raidlands_stats_page_result([], 0, $page, $per_page);
        }

        $params['wipe_id'] = (int) $wipe['id'];
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             WHERE s.wipe_id = :wipe_id
               AND s.playtime_seconds > 0
               $search_sql",
            $params
        );
        $total = (int) ($total_row['total'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page = min($page, $pages);
        $offset = ($page - 1) * $per_page;

        $rows = raidlands_db_fetch_all(
            "SELECT
                p.id AS player_id,
                p.steam_id64,
                COALESCE(NULLIF(s.display_name, ''), NULLIF(p.display_name, ''), 'Raidlands Player') AS display_name,
                s.kills,
                s.deaths,
                s.npc_kills,
                s.deaths_by_npc,
                s.kdr,
                s.playtime_seconds,
                s.reward_points,
                s.last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             WHERE s.wipe_id = :wipe_id
               AND s.playtime_seconds > 0
               $search_sql
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    } else {
        $where_sql = $search !== '' ? 'WHERE (p.steam_id64 LIKE :search_steam_id OR p.display_name LIKE :search_player_name OR s.display_name LIKE :search_stats_name)' : '';
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM (
                SELECT p.id
                FROM player_wipe_stats s
                INNER JOIN players p ON p.id = s.player_id
                $where_sql
                GROUP BY p.id
             ) counted",
            $params
        );
        $total = (int) ($total_row['total'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page = min($page, $pages);
        $offset = ($page - 1) * $per_page;

        $rows = raidlands_db_fetch_all(
            "SELECT
                p.id AS player_id,
                p.steam_id64,
                COALESCE(NULLIF(MAX(NULLIF(s.display_name, '')), ''), NULLIF(p.display_name, ''), 'Raidlands Player') AS display_name,
                SUM(s.kills) AS kills,
                SUM(s.deaths) AS deaths,
                SUM(s.npc_kills) AS npc_kills,
                SUM(s.deaths_by_npc) AS deaths_by_npc,
                CASE WHEN SUM(s.deaths) = 0 THEN SUM(s.kills) ELSE ROUND(SUM(s.kills) / SUM(s.deaths), 3) END AS kdr,
                SUM(s.playtime_seconds) AS playtime_seconds,
                SUM(s.reward_points) AS reward_points,
                MAX(s.last_seen_at) AS last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             $where_sql
             GROUP BY p.id, p.steam_id64, p.display_name
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    }

    $rank = (($page - 1) * $per_page) + 1;

    foreach ($rows as &$row) {
        $row['rank'] = $rank++;
        $row['kills'] = (int) $row['kills'];
        $row['deaths'] = (int) $row['deaths'];
        $row['npc_kills'] = (int) $row['npc_kills'];
        $row['deaths_by_npc'] = (int) $row['deaths_by_npc'];
        $row['kdr'] = (float) $row['kdr'];
        $row['playtime_seconds'] = (int) $row['playtime_seconds'];
        $row['reward_points'] = (int) $row['reward_points'];
    }
    unset($row);

    $rows = raidlands_store_attach_steam_profiles($rows);

    return raidlands_stats_page_result($rows, $total, $page, $per_page);
}

function raidlands_stats_leaderboard(string $metric = 'kills', string $scope = 'current', int $limit = 25): array
{
    return raidlands_stats_leaderboard_result($metric, $scope, 1, $limit)['rows'];
}

function raidlands_stats_bot_leaderboard_result(
    string $scope = 'current',
    int $page = 1,
    int $per_page = 25,
    string $search = '',
    string $metric = 'kdr'
): array
{
    if (!raidlands_stats_is_ready()) {
        return raidlands_stats_page_result([], 0, $page, $per_page);
    }

    $scope = raidlands_stats_scope($scope);
    $page = raidlands_stats_page_number($page);
    $per_page = raidlands_stats_page_size($per_page);
    $search = raidlands_stats_search($search);
    $metric = raidlands_stats_bot_metric($metric);
    $params = [];
    $search_sql = '';

    if ($search !== '') {
        $like = '%' . $search . '%';
        $params['search_bot_key'] = $like;
        $params['search_bot_name'] = $like;
        $params['search_bot_kit'] = $like;
        $params['search_bot_skill'] = $like;
        $search_sql = ' AND (bot_key LIKE :search_bot_key OR display_name LIKE :search_bot_name OR kit_name LIKE :search_bot_kit OR skill_tier LIKE :search_bot_skill)';
    }

    $order = raidlands_stats_bot_leaderboard_order($metric);

    if ($scope === 'current') {
        $wipe = raidlands_stats_active_wipe();

        if ($wipe === null) {
            return raidlands_stats_page_result([], 0, $page, $per_page);
        }

        $params['wipe_id'] = (int) $wipe['id'];
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM bot_wipe_stats
             WHERE wipe_id = :wipe_id
               AND (kills > 0 OR deaths > 0)
               $search_sql",
            $params
        );
        $total = (int) ($total_row['total'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page = min($page, $pages);
        $offset = ($page - 1) * $per_page;

        $rows = raidlands_db_fetch_all(
            "SELECT
                bot_key,
                display_name,
                kit_name,
                skill_tier,
                kills,
                deaths,
                kdr,
                last_seen_at
             FROM bot_wipe_stats
             WHERE wipe_id = :wipe_id
               AND (kills > 0 OR deaths > 0)
               $search_sql
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    } else {
        $where_sql = $search !== '' ? 'WHERE (bot_key LIKE :search_bot_key OR display_name LIKE :search_bot_name OR kit_name LIKE :search_bot_kit OR skill_tier LIKE :search_bot_skill)' : '';
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM (
                SELECT bot_key
                FROM bot_wipe_stats
                $where_sql
                GROUP BY bot_key
                HAVING SUM(kills) > 0 OR SUM(deaths) > 0
             ) counted",
            $params
        );
        $total = (int) ($total_row['total'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page = min($page, $pages);
        $offset = ($page - 1) * $per_page;

        $rows = raidlands_db_fetch_all(
            "SELECT
                bot_key,
                COALESCE(NULLIF(MAX(NULLIF(display_name, '')), ''), bot_key) AS display_name,
                COALESCE(NULLIF(MAX(NULLIF(kit_name, '')), ''), '') AS kit_name,
                COALESCE(NULLIF(MAX(NULLIF(skill_tier, '')), ''), '') AS skill_tier,
                SUM(kills) AS kills,
                SUM(deaths) AS deaths,
                CASE WHEN SUM(deaths) = 0 THEN SUM(kills) ELSE ROUND(SUM(kills) / SUM(deaths), 3) END AS kdr,
                MAX(last_seen_at) AS last_seen_at
             FROM bot_wipe_stats
             $where_sql
             GROUP BY bot_key
             HAVING SUM(kills) > 0 OR SUM(deaths) > 0
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    }

    $rank = (($page - 1) * $per_page) + 1;

    foreach ($rows as &$row) {
        $row['rank'] = $rank++;
        $row['kills'] = (int) $row['kills'];
        $row['deaths'] = (int) $row['deaths'];
        $row['kdr'] = (float) $row['kdr'];
    }
    unset($row);

    return raidlands_stats_page_result($rows, $total, $page, $per_page);
}

function raidlands_stats_bot_leaderboard(string $scope = 'current', int $limit = 25, string $metric = 'kdr'): array
{
    return raidlands_stats_bot_leaderboard_result($scope, 1, $limit, '', $metric)['rows'];
}

function raidlands_stats_player_summary(int $player_id): array
{
    if ($player_id <= 0 || !raidlands_stats_is_ready()) {
        return ['current' => null, 'all_time' => null];
    }

    raidlands_store_refresh_reported_rp_balance($player_id);

    $wipe = raidlands_stats_active_wipe();
    $current = null;

    if ($wipe !== null) {
        $current = raidlands_db_fetch_one(
            'SELECT * FROM player_wipe_stats WHERE wipe_id = :wipe_id AND player_id = :player_id',
            ['wipe_id' => (int) $wipe['id'], 'player_id' => $player_id]
        );
    }

    $all_time = raidlands_db_fetch_one(
        'SELECT
            SUM(kills) AS kills,
            SUM(deaths) AS deaths,
            SUM(npc_kills) AS npc_kills,
            SUM(deaths_by_npc) AS deaths_by_npc,
            CASE WHEN SUM(deaths) = 0 THEN SUM(kills) ELSE ROUND(SUM(kills) / SUM(deaths), 3) END AS kdr,
            SUM(playtime_seconds) AS playtime_seconds,
            SUM(reward_points) AS reward_points,
            MAX(last_seen_at) AS last_seen_at
         FROM player_wipe_stats
         WHERE player_id = :player_id',
        ['player_id' => $player_id]
    );

    return [
        'current' => raidlands_stats_normalize_summary($current),
        'all_time' => raidlands_stats_normalize_summary($all_time),
        'wipe' => $wipe,
    ];
}

function raidlands_stats_normalize_summary(?array $row): ?array
{
    if ($row === null || $row === [] || $row['kills'] === null) {
        return null;
    }

    return [
        'kills' => (int) $row['kills'],
        'deaths' => (int) $row['deaths'],
        'npc_kills' => (int) ($row['npc_kills'] ?? 0),
        'deaths_by_npc' => (int) ($row['deaths_by_npc'] ?? 0),
        'kdr' => (float) $row['kdr'],
        'playtime_seconds' => (int) $row['playtime_seconds'],
        'reward_points' => (int) $row['reward_points'],
        'last_seen_at' => $row['last_seen_at'] ?? null,
    ];
}

function raidlands_stats_admin_summary(): array
{
    if (!raidlands_stats_is_ready()) {
        return [
            'ready' => false,
            'active_wipe' => null,
            'latest_ingest' => null,
            'current_players' => 0,
        ];
    }

    $wipe = raidlands_stats_active_wipe();
    $current_players = 0;

    if ($wipe !== null) {
        $count = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total FROM player_wipe_stats WHERE wipe_id = :wipe_id',
            ['wipe_id' => (int) $wipe['id']]
        );
        $current_players = (int) ($count['total'] ?? 0);
    }

    return [
        'ready' => true,
        'active_wipe' => $wipe,
        'latest_ingest' => raidlands_stats_latest_ingest(),
        'current_players' => $current_players,
    ];
}

function raidlands_stats_format_number($value): string
{
    return number_format((int) $value);
}

function raidlands_stats_format_kdr($value): string
{
    return number_format((float) $value, 2);
}

function raidlands_stats_format_duration($seconds): string
{
    $seconds = max(0, (int) $seconds);
    $hours = intdiv($seconds, 3600);
    $minutes = intdiv($seconds % 3600, 60);

    if ($hours > 0) {
        return $hours . 'h ' . str_pad((string) $minutes, 2, '0', STR_PAD_LEFT) . 'm';
    }

    return $minutes . 'm';
}
