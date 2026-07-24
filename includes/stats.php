<?php

require_once __DIR__ . '/store.php';
require_once __DIR__ . '/podium.php';

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
        raidlands_db_fetch_one('SELECT baseline_raid_damage FROM player_wipe_stats LIMIT 1');
        raidlands_db_fetch_one('SELECT headshots FROM player_leaderboard_stats LIMIT 1');
        raidlands_db_fetch_one('SELECT raid_players_received FROM stats_ingest_log LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM bot_wipe_stats LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_stats_restore_auto_increment_tables(PDO $pdo, ?array $table_names = null): void
{
    static $default_tables_verified = false;

    $using_default_tables = $table_names === null;
    if ($using_default_tables && $default_tables_verified) {
        return;
    }

    $table_names ??= [
        'players',
        'wipe_seasons',
        'player_wipe_stats',
        'player_leaderboard_stats',
        'bot_wipe_stats',
        'stats_ingest_log',
        'player_outfit_observations',
        'player_weapon_observations',
    ];
    $table_names = array_values(array_unique(array_filter(
        array_map('strval', $table_names),
        static fn(string $table_name): bool => preg_match('/^[a-zA-Z0-9_]+$/', $table_name) === 1
    )));

    if ($table_names === []) {
        if ($using_default_tables) {
            $default_tables_verified = true;
        }
        return;
    }

    $required_unique_indexes = [
        'players' => [
            'uq_players_steam_id64' => ['steam_id64'],
        ],
        'wipe_seasons' => [
            'uq_wipe_seasons_server_key' => ['server_id', 'wipe_key'],
        ],
        'player_wipe_stats' => [
            'uq_player_wipe_stats_player' => ['wipe_id', 'player_id'],
        ],
        'player_leaderboard_stats' => [
            'uq_player_leaderboard_stats_player' => ['wipe_id', 'player_id'],
        ],
        'bot_wipe_stats' => [
            'uq_bot_wipe_stats_bot' => ['wipe_id', 'bot_key'],
        ],
        'player_outfit_observations' => [
            'uq_player_outfit_wipe_signature' => ['player_id', 'server_id', 'wipe_id', 'outfit_signature'],
        ],
        'player_weapon_observations' => [
            'uq_player_weapon_wipe_item' => ['player_id', 'server_id', 'wipe_id', 'weapon_shortname', 'skin_id'],
        ],
    ];
    $build_table_filter = static function () use ($table_names): array {
        $params = [];
        $placeholders = [];

        foreach ($table_names as $index => $table_name) {
            $parameter = 'table_' . $index;
            $placeholders[] = ':' . $parameter;
            $params[$parameter] = $table_name;
        }

        return [$params, $placeholders];
    };
    $load_schema = static function () use ($pdo, $build_table_filter): array {
        [$params, $placeholders] = $build_table_filter();
        $statement = $pdo->prepare(
            'SELECT TABLE_NAME, COLUMN_TYPE, COLUMN_KEY, IS_NULLABLE, EXTRA
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND COLUMN_NAME = "id"
               AND TABLE_NAME IN (' . implode(', ', $placeholders) . ')'
        );
        $statement->execute($params);
        $columns = [];

        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $column) {
            $columns[(string) $column['TABLE_NAME']] = $column;
        }

        $index_statement = $pdo->prepare(
            'SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME IN (' . implode(', ', $placeholders) . ')
             ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX'
        );
        $index_statement->execute($params);
        $indexes = [];

        foreach ($index_statement->fetchAll(PDO::FETCH_ASSOC) as $index) {
            $table_name = (string) $index['TABLE_NAME'];
            $index_name = (string) $index['INDEX_NAME'];
            $indexes[$table_name][$index_name]['non_unique'] = (int) $index['NON_UNIQUE'];
            $indexes[$table_name][$index_name]['columns'][] = (string) $index['COLUMN_NAME'];
        }

        return [$columns, $indexes];
    };
    $tables_needing_repair = static function (array $columns, array $indexes) use (
        $table_names,
        $required_unique_indexes
    ): array {
        $repair = [];

        foreach ($table_names as $table_name) {
            if (!isset($columns[$table_name])) {
                continue;
            }

            $primary = $indexes[$table_name]['PRIMARY'] ?? null;
            if (
                stripos((string) ($columns[$table_name]['EXTRA'] ?? ''), 'auto_increment') === false
                || !is_array($primary)
                || (array) ($primary['columns'] ?? []) !== ['id']
            ) {
                $repair[$table_name] = true;
            }

            foreach ($required_unique_indexes[$table_name] ?? [] as $index_name => $index_columns) {
                $index = $indexes[$table_name][$index_name] ?? null;
                if (
                    !is_array($index)
                    || (int) ($index['non_unique'] ?? 1) !== 0
                    || (array) ($index['columns'] ?? []) !== $index_columns
                ) {
                    $repair[$table_name] = true;
                }
            }
        }

        return array_keys($repair);
    };

    [$columns, $indexes] = $load_schema();
    if ($tables_needing_repair($columns, $indexes) === []) {
        if ($using_default_tables) {
            $default_tables_verified = true;
        }
        return;
    }

    $lock_name = 'raidlands_stats_restore_auto_increment';
    $lock_statement = $pdo->prepare('SELECT GET_LOCK(:lock_name, 20)');
    $lock_statement->execute(['lock_name' => $lock_name]);

    if ((int) $lock_statement->fetchColumn() !== 1) {
        throw new RuntimeException('Timed out while waiting to repair restored stats table identities.');
    }

    try {
        [$columns, $indexes] = $load_schema();
        $repair_tables = $tables_needing_repair($columns, $indexes);
        if ($repair_tables === []) {
            if ($using_default_tables) {
                $default_tables_verified = true;
            }
            return;
        }

        foreach ($repair_tables as $table_name) {
            $column = $columns[$table_name];
            $column_type = strtolower(trim((string) ($column['COLUMN_TYPE'] ?? '')));
            $primary = $indexes[$table_name]['PRIMARY'] ?? null;

            if (
                strtoupper((string) ($column['IS_NULLABLE'] ?? '')) !== 'NO'
                || preg_match('/^(?:tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?(?: unsigned)?$/', $column_type) !== 1
            ) {
                throw new RuntimeException(
                    'Restored table ' . $table_name . ' has an invalid ID column definition.'
                );
            }

            if (is_array($primary) && (array) ($primary['columns'] ?? []) !== ['id']) {
                throw new RuntimeException('Restored table ' . $table_name . ' has an unexpected primary key.');
            }

            foreach ($required_unique_indexes[$table_name] ?? [] as $index_name => $index_columns) {
                $index = $indexes[$table_name][$index_name] ?? null;
                if (
                    is_array($index)
                    && (
                        (int) ($index['non_unique'] ?? 1) !== 0
                        || (array) ($index['columns'] ?? []) !== $index_columns
                    )
                ) {
                    throw new RuntimeException(
                        'Restored table ' . $table_name . ' has an invalid ' . $index_name . ' index.'
                    );
                }
            }
        }

        $original_sql_mode = (string) $pdo->query('SELECT @@SESSION.sql_mode')->fetchColumn();
        $original_foreign_key_checks = (int) $pdo->query('SELECT @@SESSION.FOREIGN_KEY_CHECKS')->fetchColumn();
        $sql_modes = array_values(array_filter(array_map('trim', explode(',', $original_sql_mode))));

        if (!in_array('NO_AUTO_VALUE_ON_ZERO', array_map('strtoupper', $sql_modes), true)) {
            $sql_modes[] = 'NO_AUTO_VALUE_ON_ZERO';
        }

        try {
            // Preserve any ID 0 rows created after the partial restore. Foreign
            // key checks are paused only so MySQL can rebuild referenced IDs.
            $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote(implode(',', $sql_modes)));
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');

            foreach ($repair_tables as $table_name) {
                $column = $columns[$table_name];
                $column_type = strtolower(trim((string) $column['COLUMN_TYPE']));
                $alterations = [];
                $primary = $indexes[$table_name]['PRIMARY'] ?? null;

                if (!is_array($primary)) {
                    $alterations[] = 'ADD PRIMARY KEY (`id`)';
                }

                foreach ($required_unique_indexes[$table_name] ?? [] as $index_name => $index_columns) {
                    if (!isset($indexes[$table_name][$index_name])) {
                        $quoted_columns = array_map(
                            static fn(string $column_name): string => '`' . str_replace('`', '``', $column_name) . '`',
                            $index_columns
                        );
                        $alterations[] = 'ADD UNIQUE KEY `' . str_replace('`', '``', $index_name) . '` ('
                            . implode(', ', $quoted_columns) . ')';
                    }
                }

                if (stripos((string) ($column['EXTRA'] ?? ''), 'auto_increment') === false) {
                    $alterations[] = 'MODIFY COLUMN `id` ' . $column_type . ' NOT NULL AUTO_INCREMENT';
                }

                if ($alterations !== []) {
                    $pdo->exec(
                        'ALTER TABLE `' . str_replace('`', '``', $table_name) . '` '
                        . implode(', ', $alterations)
                    );
                }
            }
        } finally {
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = ' . ($original_foreign_key_checks === 0 ? '0' : '1'));
            $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote($original_sql_mode));
        }

        if ($using_default_tables) {
            $default_tables_verified = true;
        }
    } catch (Throwable $error) {
        throw new RuntimeException(
            'The website could not repair auto-increment IDs after the database restore: ' . $error->getMessage(),
            0,
            $error
        );
    } finally {
        $release_statement = $pdo->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $release_statement->execute(['lock_name' => $lock_name]);
    }
}

function raidlands_stats_wipes_are_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM wipe_seasons LIMIT 1');
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

function raidlands_stats_bigint($value): int
{
    if (!is_numeric($value)) {
        return 0;
    }

    return max(0, min(PHP_INT_MAX, (int) round((float) $value)));
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

function raidlands_stats_wipe_key_is_generic(string $wipe_key, string $server_id = ''): bool
{
    $normalized_key = strtolower(trim($wipe_key));
    $normalized_server = strtolower(trim($server_id !== '' ? $server_id : raidlands_stats_server_id()));

    return $normalized_key === 'current'
        || $normalized_key === $normalized_server
        || $normalized_key === $normalized_server . '-current'
        || str_ends_with($normalized_key, '-current');
}

function raidlands_stats_canonical_wipe_key(string $server_id, string $wipe_key, $started_at): string
{
    $server_id = raidlands_stats_clean_text($server_id !== '' ? $server_id : raidlands_stats_server_id(), 120);
    $wipe_key = raidlands_stats_wipe_key($wipe_key);
    $started_at = raidlands_stats_timestamp($started_at);

    if ($started_at === null || !raidlands_stats_wipe_key_is_generic($wipe_key, $server_id)) {
        return $wipe_key;
    }

    $server_key = raidlands_stats_wipe_key($server_id);
    $timestamp = strtotime($started_at);

    if ($timestamp === false) {
        return $wipe_key;
    }

    return substr($server_key . '-' . gmdate('Ymd\\THis\\Z', $timestamp), 0, 160);
}

function raidlands_stats_activate_wipe_signal(string $server_id, string $wipe_key, $started_at): ?array
{
    if (!raidlands_stats_wipes_are_ready()) {
        return null;
    }

    $server_id = raidlands_stats_clean_text($server_id !== '' ? $server_id : raidlands_stats_server_id(), 120);
    $started_at = raidlands_stats_timestamp($started_at);

    if ($started_at === null) {
        return null;
    }

    $wipe_key = raidlands_stats_canonical_wipe_key($server_id, $wipe_key, $started_at);

    $pdo = raidlands_db_required();
    raidlands_stats_restore_auto_increment_tables($pdo);
    $pdo->beginTransaction();

    try {
        $active = raidlands_db_fetch_one(
            'SELECT * FROM wipe_seasons WHERE server_id = :server_id AND is_active = 1 ORDER BY started_at DESC, id DESC LIMIT 1 FOR UPDATE',
            ['server_id' => $server_id]
        );

        if (
            $active !== null
            && (string) ($active['wipe_key'] ?? '') !== $wipe_key
            && !empty($active['started_at'])
            && strtotime($started_at) < strtotime((string) $active['started_at'])
        ) {
            $pdo->commit();
            $active['activated'] = false;
            $active['ignored_older_signal'] = true;
            return $active;
        }

        $season = raidlands_stats_get_or_create_wipe($pdo, $server_id, $wipe_key, $started_at);

        if (empty($season['started_at'])) {
            $pdo->prepare('UPDATE wipe_seasons SET started_at = :started_at, updated_at = NOW() WHERE id = :id')
                ->execute(['started_at' => $started_at, 'id' => (int) $season['id']]);
            $season['started_at'] = $started_at;
        }

        $pdo->commit();
        $season['activated'] = true;
        $season['ignored_older_signal'] = false;
        return $season;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }
}

function raidlands_stats_promote_matching_active_wipe(
    PDO $pdo,
    string $server_id,
    string $wipe_key,
    ?string $started_at
): ?array {
    if ($started_at === null || raidlands_stats_wipe_key_is_generic($wipe_key, $server_id)) {
        return null;
    }

    $active = raidlands_db_fetch_one(
        'SELECT * FROM wipe_seasons
         WHERE server_id = :server_id AND is_active = 1
         ORDER BY started_at DESC, id DESC
         LIMIT 1 FOR UPDATE',
        ['server_id' => $server_id]
    );

    if (
        $active === null
        || !raidlands_stats_wipe_key_is_generic((string) ($active['wipe_key'] ?? ''), $server_id)
        || empty($active['started_at'])
        || strtotime((string) $active['started_at']) !== strtotime($started_at)
    ) {
        return null;
    }

    $canonical = raidlands_db_fetch_one(
        'SELECT id FROM wipe_seasons WHERE server_id = :server_id AND wipe_key = :wipe_key LIMIT 1 FOR UPDATE',
        ['server_id' => $server_id, 'wipe_key' => $wipe_key]
    );

    if ($canonical !== null && (int) $canonical['id'] !== (int) $active['id']) {
        throw new RuntimeException('A canonical wipe already exists for the active generic season; manual review is required before stats ingest can continue.');
    }

    $update = $pdo->prepare(
        'UPDATE wipe_seasons SET wipe_key = :wipe_key, updated_at = NOW() WHERE id = :id'
    );
    $update->execute(['wipe_key' => $wipe_key, 'id' => (int) $active['id']]);
    $active['wipe_key'] = $wipe_key;
    $active['is_first_season'] = false;
    $active['promoted_generic_key'] = true;

    return $active;
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
        throw new RuntimeException('Player stats tables are not installed. Run the stats migrations through database/migrations/066_raid_stats.sql.');
    }

    $server_id = raidlands_stats_clean_text($server_id !== '' ? $server_id : raidlands_stats_server_id(), 120);
    $wipe_started_at = raidlands_stats_timestamp($payload['wipe_started_at'] ?? null);
    $wipe_key = raidlands_stats_canonical_wipe_key($server_id, (string) ($payload['wipe_key'] ?? ''), $wipe_started_at);
    $generated_at = raidlands_stats_timestamp($payload['generated_at'] ?? null) ?? gmdate('Y-m-d H:i:s');
    $players = $payload['players'] ?? [];
    $bots = $payload['bots'] ?? [];
    $bots_authoritative = !empty($payload['bots_authoritative']);
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
    raidlands_stats_restore_auto_increment_tables($pdo);
    $pdo->beginTransaction();

    $accepted = 0;
    $bots_accepted = 0;
    $bots_deleted = 0;
    $errors = $preprocess_errors;
    $raid_players_received = 0;
    $raid_damage_received = 0;

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
            $has_raid_payload = false;

            foreach (['raid_damage', 'rockets_used', 'c4_used', 'satchels_used', 'explosive_ammo_used', 'tcs_destroyed'] as $raid_field) {
                if (array_key_exists($raid_field, $player) || array_key_exists($raid_field . '_baseline', $player)) {
                    $has_raid_payload = true;
                    break;
                }
            }

            if ($has_raid_payload) {
                $raid_players_received++;
                $raid_damage_received = min(
                    PHP_INT_MAX,
                    $raid_damage_received + raidlands_stats_bigint($player['raid_damage'] ?? 0)
                );
            }

            $raw = [
                'kills' => raidlands_stats_int($player['kills'] ?? 0),
                'deaths' => raidlands_stats_int($player['deaths'] ?? 0),
                'playtime_seconds' => raidlands_stats_int($player['playtime_seconds'] ?? 0),
                'afk_seconds' => raidlands_stats_int($player['afk_seconds'] ?? 0),
                'reward_points' => raidlands_stats_int($player['reward_points'] ?? 0),
                'npc_kills' => raidlands_stats_int($player['npc_kills'] ?? 0),
                'deaths_by_npc' => raidlands_stats_int($player['deaths_by_npc'] ?? 0),
                'raid_damage' => raidlands_stats_bigint($player['raid_damage'] ?? 0),
                'raid_damage_baseline' => raidlands_stats_bigint($player['raid_damage_baseline'] ?? 0),
                'rockets_used' => raidlands_stats_bigint($player['rockets_used'] ?? 0),
                'rockets_used_baseline' => raidlands_stats_bigint($player['rockets_used_baseline'] ?? 0),
                'c4_used' => raidlands_stats_bigint($player['c4_used'] ?? 0),
                'c4_used_baseline' => raidlands_stats_bigint($player['c4_used_baseline'] ?? 0),
                'satchels_used' => raidlands_stats_bigint($player['satchels_used'] ?? 0),
                'satchels_used_baseline' => raidlands_stats_bigint($player['satchels_used_baseline'] ?? 0),
                'explosive_ammo_used' => raidlands_stats_bigint($player['explosive_ammo_used'] ?? 0),
                'explosive_ammo_used_baseline' => raidlands_stats_bigint($player['explosive_ammo_used_baseline'] ?? 0),
                'tcs_destroyed' => raidlands_stats_bigint($player['tcs_destroyed'] ?? 0),
                'tcs_destroyed_baseline' => raidlands_stats_bigint($player['tcs_destroyed_baseline'] ?? 0),
            ];

            $leaderboard = raidlands_stats_authoritative_leaderboard($player['leaderboard'] ?? null);

            raidlands_stats_upsert_player_wipe($pdo, $wipe_id, $player_id, $display_name, $raw, $is_first_season, $leaderboard);
            if ($leaderboard !== null) {
                raidlands_stats_upsert_leaderboard_details($pdo, $wipe_id, $player_id, $leaderboard);
            }
            raidlands_podium_ingest_observation(
                $pdo,
                $player_id,
                $wipe_id,
                $server_id,
                $player['appearance'] ?? null,
                raidlands_stats_timestamp($player['appearance']['observed_at'] ?? null) ?? $generated_at
            );
            $accepted++;
        }

        $authoritative_bot_keys = [];
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
            $authoritative_bot_keys[$bot_key] = true;
            $bots_accepted++;
        }

        if ($bots_authoritative && $preprocess_errors === 0 && $authoritative_bot_keys !== []) {
            $delete_params = ['wipe_id' => $wipe_id];
            $placeholders = [];

            foreach (array_keys($authoritative_bot_keys) as $index => $bot_key) {
                $parameter = 'bot_key_' . $index;
                $placeholders[] = ':' . $parameter;
                $delete_params[$parameter] = $bot_key;
            }

            $delete = $pdo->prepare(
                'DELETE FROM bot_wipe_stats
                 WHERE wipe_id = :wipe_id
                   AND bot_key NOT IN (' . implode(', ', $placeholders) . ')'
            );
            $delete->execute($delete_params);
            $bots_deleted = $delete->rowCount();
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
                (server_id, wipe_id, wipe_key, generated_at, players_received, players_accepted,
                 raid_players_received, raid_damage_received, error_count, payload_hash)
             VALUES
                (:server_id, :wipe_id, :wipe_key, :generated_at, :players_received, :players_accepted,
                 :raid_players_received, :raid_damage_received, :error_count, :payload_hash)'
        );
        $log->execute([
            'server_id' => $server_id,
            'wipe_id' => $wipe_id,
            'wipe_key' => $wipe_key,
            'generated_at' => $generated_at,
            'players_received' => $players_received,
            'players_accepted' => $accepted,
            'raid_players_received' => $raid_players_received,
            'raid_damage_received' => $raid_damage_received,
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
            'bots_deleted' => $bots_deleted,
            'raid_players_received' => $raid_players_received,
            'raid_damage_received' => $raid_damage_received,
            'error_count' => $errors,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_stats_get_or_create_wipe(PDO $pdo, string $server_id, string $wipe_key, ?string $started_at): array
{
    $promoted = raidlands_stats_promote_matching_active_wipe($pdo, $server_id, $wipe_key, $started_at);

    if ($promoted !== null) {
        return $promoted;
    }

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

    $select = $pdo->prepare('SELECT id FROM players WHERE steam_id64 = :steam_id64');
    $select->execute(['steam_id64' => $steam_id64]);
    $row = $select->fetch(PDO::FETCH_ASSOC);

    if (!is_array($row)) {
        throw new RuntimeException('Player could not be loaded after stat upsert.');
    }

    return (int) $row['id'];
}

function raidlands_stats_reward_points_baseline(int $raw_reward_points, int $baseline_reward_points): int
{
    // ServerRewards can clear balances just after the bridge sends the first
    // snapshot for a new wipe. Keep the lowest observed balance as the baseline
    // so that a pre-reset snapshot cannot hide RP earned later in the wipe.
    return min(max(0, $raw_reward_points), max(0, $baseline_reward_points));
}

function raidlands_stats_authoritative_leaderboard($value): ?array
{
    if (!is_array($value)
        || strtolower(trim((string) ($value['source'] ?? ''))) !== 'raidlandsleaderboards'
        || strtolower(trim((string) ($value['scope'] ?? ''))) !== 'wipe') {
        return null;
    }

    $fields = [
        'kills', 'deaths', 'total_deaths', 'playtime_seconds', 'connections', 'npc_kills', 'animal_kills',
        'suicides', 'headshots', 'melee_kills', 'ranged_kills', 'explosive_kills', 'player_damage',
        'npc_damage', 'items_crafted', 'structures_built', 'entities_destroyed', 'explosives_thrown',
        'shots_fired', 'rockets_fired', 'healing_used', 'distance_travelled', 'longest_kill_metres',
        'current_kill_streak', 'best_kill_streak',
    ];
    $normalized = [];

    foreach ($fields as $field) {
        $normalized[$field] = raidlands_stats_bigint($value[$field] ?? 0);
    }

    return $normalized;
}

function raidlands_stats_upsert_leaderboard_details(PDO $pdo, int $wipe_id, int $player_id, array $stats): void
{
    $fields = [
        'total_deaths', 'connections', 'animal_kills', 'suicides', 'headshots', 'melee_kills',
        'ranged_kills', 'explosive_kills', 'player_damage', 'npc_damage', 'items_crafted',
        'structures_built', 'entities_destroyed', 'explosives_thrown', 'shots_fired', 'rockets_fired',
        'healing_used', 'distance_travelled', 'longest_kill_metres', 'current_kill_streak', 'best_kill_streak',
    ];
    $columns = implode(', ', $fields);
    $values = implode(', ', array_map(static fn(string $field): string => ':' . $field, $fields));
    $updates = implode(', ', array_map(static fn(string $field): string => $field . ' = VALUES(' . $field . ')', $fields));
    $statement = $pdo->prepare(
        "INSERT INTO player_leaderboard_stats (wipe_id, player_id, $columns)
         VALUES (:wipe_id, :player_id, $values)
         ON DUPLICATE KEY UPDATE $updates, updated_at = NOW()"
    );
    $params = ['wipe_id' => $wipe_id, 'player_id' => $player_id];

    foreach ($fields as $field) {
        $params[$field] = raidlands_stats_bigint($stats[$field] ?? 0);
    }

    $statement->execute($params);
}

function raidlands_stats_upsert_player_wipe(PDO $pdo, int $wipe_id, int $player_id, string $display_name, array $raw, bool $is_first_season, ?array $authoritative = null): void
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

    $baseline['reward_points'] = raidlands_stats_reward_points_baseline(
        $raw['reward_points'],
        $baseline['reward_points']
    );

    $raid_fields = ['raid_damage', 'rockets_used', 'c4_used', 'satchels_used', 'explosive_ammo_used', 'tcs_destroyed'];
    $raid_baseline = [];
    $raid_values = [];

    foreach ($raid_fields as $raid_field) {
        $raid_baseline[$raid_field] = min(
            raidlands_stats_bigint($raw[$raid_field] ?? 0),
            raidlands_stats_bigint($raw[$raid_field . '_baseline'] ?? 0)
        );
        $raid_values[$raid_field] = max(
            0,
            raidlands_stats_bigint($raw[$raid_field] ?? 0) - $raid_baseline[$raid_field]
        );
    }

    $kills = max(0, $raw['kills'] - $baseline['kills']);
    $deaths = max(0, $raw['deaths'] - $baseline['deaths']);
    $playtime = max(0, $raw['playtime_seconds'] - $baseline['playtime_seconds']);
    $afk = max(0, $raw['afk_seconds'] - $baseline['afk_seconds']);
    $reward_points = max(0, $raw['reward_points'] - $baseline['reward_points']);
    $npc_kills = max(0, $raw['npc_kills'] - $baseline['npc_kills']);
    $deaths_by_npc = max(0, $raw['deaths_by_npc'] - $baseline['deaths_by_npc']);

    if ($authoritative !== null) {
        $kills = raidlands_stats_int($authoritative['kills'] ?? 0);
        $deaths = raidlands_stats_int($authoritative['deaths'] ?? 0);
        $playtime = raidlands_stats_int($authoritative['playtime_seconds'] ?? 0);
        $npc_kills = raidlands_stats_int($authoritative['npc_kills'] ?? 0);
    }

    $kdr = $deaths === 0 ? (float) $kills : round($kills / $deaths, 3);

    $statement = $pdo->prepare(
        'INSERT INTO player_wipe_stats
            (wipe_id, player_id, display_name, raw_kills, raw_deaths, raw_playtime_seconds, raw_afk_seconds, raw_reward_points,
             raw_npc_kills, raw_deaths_by_npc,
             raw_raid_damage, raw_rockets_used, raw_c4_used, raw_satchels_used, raw_explosive_ammo_used, raw_tcs_destroyed,
             baseline_kills, baseline_deaths, baseline_playtime_seconds, baseline_afk_seconds, baseline_reward_points,
             baseline_npc_kills, baseline_deaths_by_npc,
             baseline_raid_damage, baseline_rockets_used, baseline_c4_used, baseline_satchels_used, baseline_explosive_ammo_used, baseline_tcs_destroyed,
             kills, deaths, npc_kills, deaths_by_npc, playtime_seconds, afk_seconds, reward_points, kdr,
             raid_damage, rockets_used, c4_used, satchels_used, explosive_ammo_used, tcs_destroyed, last_seen_at)
         VALUES
            (:wipe_id, :player_id, :display_name, :raw_kills, :raw_deaths, :raw_playtime_seconds, :raw_afk_seconds, :raw_reward_points,
             :raw_npc_kills, :raw_deaths_by_npc,
             :raw_raid_damage, :raw_rockets_used, :raw_c4_used, :raw_satchels_used, :raw_explosive_ammo_used, :raw_tcs_destroyed,
             :baseline_kills, :baseline_deaths, :baseline_playtime_seconds, :baseline_afk_seconds, :baseline_reward_points,
             :baseline_npc_kills, :baseline_deaths_by_npc,
             :baseline_raid_damage, :baseline_rockets_used, :baseline_c4_used, :baseline_satchels_used, :baseline_explosive_ammo_used, :baseline_tcs_destroyed,
             :kills, :deaths, :npc_kills, :deaths_by_npc, :playtime_seconds, :afk_seconds, :reward_points, :kdr,
             :raid_damage, :rockets_used, :c4_used, :satchels_used, :explosive_ammo_used, :tcs_destroyed, NOW())
         ON DUPLICATE KEY UPDATE
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            raw_kills = VALUES(raw_kills),
            raw_deaths = VALUES(raw_deaths),
            raw_playtime_seconds = VALUES(raw_playtime_seconds),
            raw_afk_seconds = VALUES(raw_afk_seconds),
            raw_reward_points = VALUES(raw_reward_points),
            baseline_reward_points = VALUES(baseline_reward_points),
            raw_npc_kills = VALUES(raw_npc_kills),
            raw_deaths_by_npc = VALUES(raw_deaths_by_npc),
            raw_raid_damage = VALUES(raw_raid_damage),
            raw_rockets_used = VALUES(raw_rockets_used),
            raw_c4_used = VALUES(raw_c4_used),
            raw_satchels_used = VALUES(raw_satchels_used),
            raw_explosive_ammo_used = VALUES(raw_explosive_ammo_used),
            raw_tcs_destroyed = VALUES(raw_tcs_destroyed),
            baseline_raid_damage = VALUES(baseline_raid_damage),
            baseline_rockets_used = VALUES(baseline_rockets_used),
            baseline_c4_used = VALUES(baseline_c4_used),
            baseline_satchels_used = VALUES(baseline_satchels_used),
            baseline_explosive_ammo_used = VALUES(baseline_explosive_ammo_used),
            baseline_tcs_destroyed = VALUES(baseline_tcs_destroyed),
            kills = VALUES(kills),
            deaths = VALUES(deaths),
            npc_kills = VALUES(npc_kills),
            deaths_by_npc = VALUES(deaths_by_npc),
            playtime_seconds = VALUES(playtime_seconds),
            afk_seconds = VALUES(afk_seconds),
            reward_points = VALUES(reward_points),
            kdr = VALUES(kdr),
            raid_damage = VALUES(raid_damage),
            rockets_used = VALUES(rockets_used),
            c4_used = VALUES(c4_used),
            satchels_used = VALUES(satchels_used),
            explosive_ammo_used = VALUES(explosive_ammo_used),
            tcs_destroyed = VALUES(tcs_destroyed),
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
        'raw_raid_damage' => $raw['raid_damage'],
        'raw_rockets_used' => $raw['rockets_used'],
        'raw_c4_used' => $raw['c4_used'],
        'raw_satchels_used' => $raw['satchels_used'],
        'raw_explosive_ammo_used' => $raw['explosive_ammo_used'],
        'raw_tcs_destroyed' => $raw['tcs_destroyed'],
        'baseline_kills' => $baseline['kills'],
        'baseline_deaths' => $baseline['deaths'],
        'baseline_playtime_seconds' => $baseline['playtime_seconds'],
        'baseline_afk_seconds' => $baseline['afk_seconds'],
        'baseline_reward_points' => $baseline['reward_points'],
        'baseline_npc_kills' => $baseline['npc_kills'],
        'baseline_deaths_by_npc' => $baseline['deaths_by_npc'],
        'baseline_raid_damage' => $raid_baseline['raid_damage'],
        'baseline_rockets_used' => $raid_baseline['rockets_used'],
        'baseline_c4_used' => $raid_baseline['c4_used'],
        'baseline_satchels_used' => $raid_baseline['satchels_used'],
        'baseline_explosive_ammo_used' => $raid_baseline['explosive_ammo_used'],
        'baseline_tcs_destroyed' => $raid_baseline['tcs_destroyed'],
        'kills' => $kills,
        'deaths' => $deaths,
        'npc_kills' => $npc_kills,
        'deaths_by_npc' => $deaths_by_npc,
        'playtime_seconds' => $playtime,
        'afk_seconds' => $afk,
        'reward_points' => $reward_points,
        'kdr' => $kdr,
        'raid_damage' => $raid_values['raid_damage'],
        'rockets_used' => $raid_values['rockets_used'],
        'c4_used' => $raid_values['c4_used'],
        'satchels_used' => $raid_values['satchels_used'],
        'explosive_ammo_used' => $raid_values['explosive_ammo_used'],
        'tcs_destroyed' => $raid_values['tcs_destroyed'],
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

function raidlands_stats_wipe_id($value): int
{
    if (!is_numeric($value)) {
        return 0;
    }

    return max(0, (int) $value);
}

function raidlands_stats_optional_wipe_key($value): string
{
    $wipe_key = trim((string) $value);
    $wipe_key = preg_replace('/[^a-zA-Z0-9_.:-]+/', '-', $wipe_key) ?? '';
    $wipe_key = trim($wipe_key, '-_.:');

    return substr($wipe_key, 0, 160);
}

function raidlands_stats_wipe(int $wipe_id = 0, string $wipe_key = ''): ?array
{
    if (!raidlands_stats_is_ready()) {
        return null;
    }

    $server_id = raidlands_stats_server_id();
    $wipe_id = raidlands_stats_wipe_id($wipe_id);

    if ($wipe_id > 0) {
        return raidlands_db_fetch_one(
            'SELECT * FROM wipe_seasons WHERE server_id = :server_id AND id = :id LIMIT 1',
            ['server_id' => $server_id, 'id' => $wipe_id]
        );
    }

    $wipe_key = raidlands_stats_optional_wipe_key($wipe_key);

    if ($wipe_key === '') {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM wipe_seasons WHERE server_id = :server_id AND wipe_key = :wipe_key LIMIT 1',
        ['server_id' => $server_id, 'wipe_key' => $wipe_key]
    );
}

function raidlands_stats_scope_wipe(string $scope, int $wipe_id = 0, string $wipe_key = ''): ?array
{
    return $scope === 'wipe'
        ? raidlands_stats_wipe($wipe_id, $wipe_key)
        : raidlands_stats_active_wipe();
}

function raidlands_stats_recent_wipes(int $limit = 12): array
{
    if (!raidlands_stats_is_ready()) {
        return [];
    }

    $limit = max(1, min(50, $limit));

    return raidlands_db_fetch_all(
        "SELECT
            w.*,
            (
                SELECT COUNT(*)
                FROM player_wipe_stats s
                WHERE s.wipe_id = w.id
                  AND s.playtime_seconds > 0
            ) AS player_count,
            (
                SELECT COUNT(*)
                FROM bot_wipe_stats b
                WHERE b.wipe_id = w.id
                  AND (b.kills > 0 OR b.deaths > 0)
            ) AS bot_count
         FROM wipe_seasons w
         WHERE w.server_id = :server_id
         ORDER BY w.is_active DESC, COALESCE(w.started_at, w.created_at) DESC, w.id DESC
         LIMIT $limit",
        ['server_id' => raidlands_stats_server_id()]
    );
}

function raidlands_stats_wipe_label(array $wipe): string
{
    $started = trim((string) ($wipe['started_at'] ?? ''));

    if ($started === '') {
        $started = trim((string) ($wipe['created_at'] ?? ''));
    }

    if ($started !== '') {
        $timestamp = strtotime($started);

        if ($timestamp !== false) {
            return gmdate('M j, Y', $timestamp);
        }
    }

    $wipe_key = trim((string) ($wipe['wipe_key'] ?? ''));

    return $wipe_key !== '' ? $wipe_key : 'Wipe #' . (string) ($wipe['id'] ?? '');
}

function raidlands_stats_generic_wipe_key_warning(?array $latest_ingest = null, ?array $active_wipe = null): string
{
    $server_id = raidlands_stats_server_id();
    $wipe_key = trim((string) ($latest_ingest['wipe_key'] ?? $active_wipe['wipe_key'] ?? ''));

    if ($wipe_key === '') {
        return '';
    }

    if (raidlands_stats_wipe_key_is_generic($wipe_key, $server_id)) {
        return 'Latest stats snapshot is using a generic wipe key. Update the server stats sync settings so each wipe gets a unique key.';
    }

    return '';
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

function raidlands_stats_ingest_warning(?array $latest_ingest = null): string
{
    global $vip_bridge_config;

    if ($latest_ingest === null || empty($latest_ingest['created_at'])) {
        return 'No game-server stats snapshot has been received yet.';
    }

    $created_at = strtotime((string) $latest_ingest['created_at']);
    $stale_seconds = max(60, (int) ($vip_bridge_config['statsStaleSeconds'] ?? 900));

    if ($created_at !== false && (time() - $created_at) > $stale_seconds) {
        return 'Game-server stats are stale. Run websitevip.stats.status and websitevip.stats.sync on the Rust server.';
    }

    return '';
}

function raidlands_stats_metric(string $metric): string
{
    return in_array($metric, ['kills', 'kdr', 'playtime', 'rp', 'npc_kills', 'deaths_by_npc', 'headshots', 'streak', 'damage', 'distance'], true) ? $metric : 'kills';
}

function raidlands_stats_raid_metric(string $metric): string
{
    return in_array($metric, ['raid_damage', 'rockets_used', 'c4_used', 'satchels_used', 'explosive_ammo_used', 'tcs_destroyed'], true)
        ? $metric
        : 'raid_damage';
}

function raidlands_stats_bot_metric(string $metric): string
{
    return in_array($metric, ['kdr', 'kills', 'deaths'], true) ? $metric : 'kdr';
}

function raidlands_stats_scope(string $scope): string
{
    return in_array($scope, ['current', 'all-time', 'wipe'], true) ? $scope : 'current';
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
        'headshots' => 'headshot_rate DESC, headshots DESC, kills DESC',
        'streak' => 'best_kill_streak DESC, kills DESC, deaths ASC',
        'damage' => 'player_damage DESC, kills DESC, deaths ASC',
        'distance' => 'distance_travelled DESC, playtime_seconds DESC, kills DESC',
        default => 'kills DESC, deaths ASC, kdr DESC',
    };
}

function raidlands_stats_raid_leaderboard_order(string $metric): string
{
    return match (raidlands_stats_raid_metric($metric)) {
        'rockets_used' => 'rockets_used DESC, raid_damage DESC, tcs_destroyed DESC, display_name ASC',
        'c4_used' => 'c4_used DESC, raid_damage DESC, tcs_destroyed DESC, display_name ASC',
        'satchels_used' => 'satchels_used DESC, raid_damage DESC, tcs_destroyed DESC, display_name ASC',
        'explosive_ammo_used' => 'explosive_ammo_used DESC, raid_damage DESC, tcs_destroyed DESC, display_name ASC',
        'tcs_destroyed' => 'tcs_destroyed DESC, raid_damage DESC, rockets_used DESC, display_name ASC',
        default => 'raid_damage DESC, tcs_destroyed DESC, rockets_used DESC, display_name ASC',
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
    string $search = '',
    int $wipe_id = 0,
    string $wipe_key = '',
    bool $attach_steam_profiles = true
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

    if ($scope !== 'all-time') {
        $wipe = raidlands_stats_scope_wipe($scope, $wipe_id, $wipe_key);

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
                COALESCE(d.headshots, 0) AS headshots,
                CASE WHEN s.kills = 0 THEN 0 ELSE ROUND(COALESCE(d.headshots, 0) * 100 / s.kills, 2) END AS headshot_rate,
                COALESCE(d.best_kill_streak, 0) AS best_kill_streak,
                COALESCE(d.player_damage, 0) AS player_damage,
                COALESCE(d.distance_travelled, 0) AS distance_travelled,
                COALESCE(d.longest_kill_metres, 0) AS longest_kill_metres,
                COALESCE(d.suicides, 0) AS suicides,
                COALESCE(d.animal_kills, 0) AS animal_kills,
                s.last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             LEFT JOIN player_leaderboard_stats d ON d.wipe_id = s.wipe_id AND d.player_id = s.player_id
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
                SUM(COALESCE(d.headshots, 0)) AS headshots,
                CASE WHEN SUM(s.kills) = 0 THEN 0 ELSE ROUND(SUM(COALESCE(d.headshots, 0)) * 100 / SUM(s.kills), 2) END AS headshot_rate,
                MAX(COALESCE(d.best_kill_streak, 0)) AS best_kill_streak,
                SUM(COALESCE(d.player_damage, 0)) AS player_damage,
                SUM(COALESCE(d.distance_travelled, 0)) AS distance_travelled,
                MAX(COALESCE(d.longest_kill_metres, 0)) AS longest_kill_metres,
                SUM(COALESCE(d.suicides, 0)) AS suicides,
                SUM(COALESCE(d.animal_kills, 0)) AS animal_kills,
                MAX(s.last_seen_at) AS last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             LEFT JOIN player_leaderboard_stats d ON d.wipe_id = s.wipe_id AND d.player_id = s.player_id
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
        $row['headshots'] = (int) $row['headshots'];
        $row['headshot_rate'] = (float) $row['headshot_rate'];
        $row['best_kill_streak'] = (int) $row['best_kill_streak'];
        $row['player_damage'] = (int) $row['player_damage'];
        $row['distance_travelled'] = (int) $row['distance_travelled'];
        $row['longest_kill_metres'] = (int) $row['longest_kill_metres'];
        $row['suicides'] = (int) $row['suicides'];
        $row['animal_kills'] = (int) $row['animal_kills'];
    }
    unset($row);

    if ($attach_steam_profiles) {
        $rows = raidlands_store_attach_steam_profiles($rows);
    }

    return raidlands_stats_page_result($rows, $total, $page, $per_page);
}

function raidlands_stats_leaderboard(string $metric = 'kills', string $scope = 'current', int $limit = 25): array
{
    return raidlands_stats_leaderboard_result($metric, $scope, 1, $limit)['rows'];
}

function raidlands_stats_leaderboard_leaders(
    string $metric = 'kills',
    string $scope = 'current',
    int $wipe_id = 0,
    string $wipe_key = ''
): array {
    $result = raidlands_stats_leaderboard_result($metric, $scope, 1, 5, '', $wipe_id, $wipe_key);

    return array_slice((array) ($result['rows'] ?? []), 0, 3);
}

function raidlands_stats_raid_leaderboard_result(
    string $metric = 'raid_damage',
    string $scope = 'current',
    int $page = 1,
    int $per_page = 25,
    string $search = '',
    int $wipe_id = 0,
    string $wipe_key = '',
    bool $attach_steam_profiles = true
): array {
    if (!raidlands_stats_is_ready()) {
        return raidlands_stats_page_result([], 0, $page, $per_page);
    }

    $metric = raidlands_stats_raid_metric($metric);
    $scope = raidlands_stats_scope($scope);
    $page = raidlands_stats_page_number($page);
    $per_page = raidlands_stats_page_size($per_page);
    $search = raidlands_stats_search($search);
    $params = [];
    $search_sql = '';
    $activity_sql = '(s.raid_damage > 0 OR s.rockets_used > 0 OR s.c4_used > 0 OR s.satchels_used > 0 OR s.explosive_ammo_used > 0 OR s.tcs_destroyed > 0)';

    if ($search !== '') {
        $like = '%' . $search . '%';
        $params['search_steam_id'] = $like;
        $params['search_player_name'] = $like;
        $params['search_stats_name'] = $like;
        $search_sql = ' AND (p.steam_id64 LIKE :search_steam_id OR p.display_name LIKE :search_player_name OR s.display_name LIKE :search_stats_name)';
    }

    $order = raidlands_stats_raid_leaderboard_order($metric);

    if ($scope !== 'all-time') {
        $wipe = raidlands_stats_scope_wipe($scope, $wipe_id, $wipe_key);

        if ($wipe === null) {
            return raidlands_stats_page_result([], 0, $page, $per_page);
        }

        $params['wipe_id'] = (int) $wipe['id'];
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             WHERE s.wipe_id = :wipe_id
               AND $activity_sql
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
                s.raid_damage,
                s.rockets_used,
                s.c4_used,
                s.satchels_used,
                s.explosive_ammo_used,
                s.tcs_destroyed,
                s.last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             WHERE s.wipe_id = :wipe_id
               AND $activity_sql
               $search_sql
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    } else {
        $where_sql = $search !== ''
            ? 'WHERE (p.steam_id64 LIKE :search_steam_id OR p.display_name LIKE :search_player_name OR s.display_name LIKE :search_stats_name)'
            : '';
        $total_row = raidlands_db_fetch_one(
            "SELECT COUNT(*) AS total
             FROM (
                SELECT p.id
                FROM player_wipe_stats s
                INNER JOIN players p ON p.id = s.player_id
                $where_sql
                GROUP BY p.id
                HAVING SUM(s.raid_damage) > 0
                    OR SUM(s.rockets_used) > 0
                    OR SUM(s.c4_used) > 0
                    OR SUM(s.satchels_used) > 0
                    OR SUM(s.explosive_ammo_used) > 0
                    OR SUM(s.tcs_destroyed) > 0
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
                SUM(s.raid_damage) AS raid_damage,
                SUM(s.rockets_used) AS rockets_used,
                SUM(s.c4_used) AS c4_used,
                SUM(s.satchels_used) AS satchels_used,
                SUM(s.explosive_ammo_used) AS explosive_ammo_used,
                SUM(s.tcs_destroyed) AS tcs_destroyed,
                MAX(s.last_seen_at) AS last_seen_at
             FROM player_wipe_stats s
             INNER JOIN players p ON p.id = s.player_id
             $where_sql
             GROUP BY p.id, p.steam_id64, p.display_name
             HAVING SUM(s.raid_damage) > 0
                 OR SUM(s.rockets_used) > 0
                 OR SUM(s.c4_used) > 0
                 OR SUM(s.satchels_used) > 0
                 OR SUM(s.explosive_ammo_used) > 0
                 OR SUM(s.tcs_destroyed) > 0
             ORDER BY $order
             LIMIT $per_page OFFSET $offset",
            $params
        );
    }

    $rank = (($page - 1) * $per_page) + 1;
    foreach ($rows as &$row) {
        $row['rank'] = $rank++;
        foreach (['raid_damage', 'rockets_used', 'c4_used', 'satchels_used', 'explosive_ammo_used', 'tcs_destroyed'] as $field) {
            $row[$field] = (int) ($row[$field] ?? 0);
        }
    }
    unset($row);

    if ($attach_steam_profiles) {
        $rows = raidlands_store_attach_steam_profiles($rows);
    }

    return raidlands_stats_page_result($rows, $total, $page, $per_page);
}

function raidlands_stats_raid_leaderboard_leaders(
    string $metric = 'raid_damage',
    string $scope = 'current',
    int $wipe_id = 0,
    string $wipe_key = ''
): array {
    $result = raidlands_stats_raid_leaderboard_result($metric, $scope, 1, 5, '', $wipe_id, $wipe_key);

    return array_slice((array) ($result['rows'] ?? []), 0, 3);
}

function raidlands_stats_bot_leaderboard_result(
    string $scope = 'current',
    int $page = 1,
    int $per_page = 25,
    string $search = '',
    string $metric = 'kdr',
    int $wipe_id = 0,
    string $wipe_key = ''
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

    if ($scope !== 'all-time') {
        $wipe = raidlands_stats_scope_wipe($scope, $wipe_id, $wipe_key);

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

function raidlands_stats_bot_leaderboard_leaders(
    string $scope = 'current',
    string $metric = 'kdr',
    int $wipe_id = 0,
    string $wipe_key = ''
): array {
    $result = raidlands_stats_bot_leaderboard_result($scope, 1, 5, '', $metric, $wipe_id, $wipe_key);

    return array_slice((array) ($result['rows'] ?? []), 0, 3);
}

function raidlands_stats_home_preview_state(): array
{
    $fallback = [
        'ready' => false,
        'active_wipe' => null,
        'leaders' => [],
        'bot_threat' => null,
    ];

    if (!raidlands_stats_is_ready()) {
        return $fallback;
    }

    try {
        $leaders = [];

        foreach (['kills', 'kdr', 'rp', 'npc_kills'] as $metric) {
            $result = raidlands_stats_leaderboard_result($metric, 'current', 1, 5, '', 0, '', false);
            $rows = is_array($result['rows'] ?? null) ? $result['rows'] : [];

            if (isset($rows[0]) && is_array($rows[0])) {
                $leaders[$metric] = $rows[0];
            }
        }

        if ($leaders !== []) {
            $profiled = raidlands_store_attach_steam_profiles(array_values($leaders));

            foreach (array_keys($leaders) as $index => $metric) {
                if (isset($profiled[$index]) && is_array($profiled[$index])) {
                    $leaders[$metric] = $profiled[$index];
                }
            }
        }

        $bot_result = raidlands_stats_bot_leaderboard_result('current', 1, 5, '', 'kills');
        $bot_rows = is_array($bot_result['rows'] ?? null) ? $bot_result['rows'] : [];

        return [
            'ready' => true,
            'active_wipe' => raidlands_stats_active_wipe(),
            'leaders' => $leaders,
            'bot_threat' => isset($bot_rows[0]) && is_array($bot_rows[0]) ? $bot_rows[0] : null,
        ];
    } catch (Throwable $error) {
        return $fallback;
    }
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
            SUM(raid_damage) AS raid_damage,
            SUM(rockets_used) AS rockets_used,
            SUM(c4_used) AS c4_used,
            SUM(satchels_used) AS satchels_used,
            SUM(explosive_ammo_used) AS explosive_ammo_used,
            SUM(tcs_destroyed) AS tcs_destroyed,
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
        'raid_damage' => (int) ($row['raid_damage'] ?? 0),
        'rockets_used' => (int) ($row['rockets_used'] ?? 0),
        'c4_used' => (int) ($row['c4_used'] ?? 0),
        'satchels_used' => (int) ($row['satchels_used'] ?? 0),
        'explosive_ammo_used' => (int) ($row['explosive_ammo_used'] ?? 0),
        'tcs_destroyed' => (int) ($row['tcs_destroyed'] ?? 0),
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
            'recent_wipes' => [],
            'wipe_key_warning' => '',
            'ingest_warning' => '',
        ];
    }

    $wipe = raidlands_stats_active_wipe();
    $latest_ingest = raidlands_stats_latest_ingest();
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
        'latest_ingest' => $latest_ingest,
        'current_players' => $current_players,
        'recent_wipes' => raidlands_stats_recent_wipes(8),
        'wipe_key_warning' => raidlands_stats_generic_wipe_key_warning($latest_ingest, $wipe),
        'ingest_warning' => raidlands_stats_ingest_warning($latest_ingest),
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
