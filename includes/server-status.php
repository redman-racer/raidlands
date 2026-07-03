<?php

require_once __DIR__ . '/database.php';

function raidlands_server_status_server_id(): string
{
    global $vip_bridge_config;

    $server_id = trim((string) ($vip_bridge_config['serverId'] ?? 'raidlands-main'));

    return $server_id !== '' ? $server_id : 'raidlands-main';
}

function raidlands_server_status_stale_seconds(): int
{
    global $site_config;

    return max(30, (int) ($site_config['serverStats']['staleSeconds'] ?? 90));
}

function raidlands_server_status_sample_retention_days(): int
{
    global $site_config;

    return max(7, min(30, (int) ($site_config['serverStats']['sampleRetentionDays'] ?? 30)));
}

function raidlands_server_status_hourly_retention_months(): int
{
    global $site_config;

    return max(6, min(24, (int) ($site_config['serverStats']['hourlyRetentionMonths'] ?? 24)));
}

function raidlands_server_status_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT server_id FROM server_status LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_history_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_status_samples LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_rollups_are_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT server_id FROM server_status_hourly_rollups LIMIT 1');
        raidlands_db_fetch_one('SELECT server_id FROM server_status_daily_rollups LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_clean_text($value, int $max_length = 120): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_server_status_int($value, int $fallback = 0, int $max = 2147483647): int
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    return max(0, min($max, (int) round((float) $value)));
}

function raidlands_server_status_bool($value): ?bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value !== 0;
    }

    $normalized = strtolower(trim((string) $value));

    if (in_array($normalized, ['1', 'true', 'yes', 'online'], true)) {
        return true;
    }

    if (in_array($normalized, ['0', 'false', 'no', 'offline'], true)) {
        return false;
    }

    return null;
}

function raidlands_server_status_timestamp($value): ?string
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

function raidlands_server_status_iso($value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    $timestamp = strtotime((string) $value);

    return $timestamp === false ? '' : gmdate('c', $timestamp);
}

function raidlands_server_status_stat_value($value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    if (is_numeric($value)) {
        return (string) round((float) $value);
    }

    return raidlands_server_status_clean_text($value, 40);
}

function raidlands_server_status_label(?bool $online, string $status): string
{
    if ($online === true || $status === 'online') {
        return 'Online';
    }

    if ($online === false || $status === 'offline') {
        return 'Offline';
    }

    return 'Unknown';
}

function raidlands_server_status_normalize_status($value, ?bool $online): string
{
    $status = strtolower(raidlands_server_status_clean_text($value, 40));
    $status = preg_replace('/[^a-z0-9_-]+/', '-', $status) ?? '';
    $status = trim($status, '-_');

    if ($status !== '') {
        return $status;
    }

    if ($online === true) {
        return 'online';
    }

    if ($online === false) {
        return 'offline';
    }

    return 'unknown';
}

function raidlands_server_status_ingest_heartbeat(array $payload, string $header_server_id, string $body): array
{
    if (!raidlands_server_status_is_ready()) {
        throw new RuntimeException('Server status table is not installed. Run database/migrations/009_server_status.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $payload_server_id = raidlands_server_status_clean_text($payload['server_id'] ?? '', 120);

    if ($payload_server_id !== '' && $payload_server_id !== $header_server_id) {
        throw new InvalidArgumentException('Heartbeat server_id does not match the authenticated bridge server.');
    }

    $online = raidlands_server_status_bool($payload['online'] ?? null);
    $status = raidlands_server_status_normalize_status($payload['status'] ?? '', $online);
    $status_label = raidlands_server_status_clean_text($payload['status_label'] ?? '', 80);

    if ($status_label === '') {
        $status_label = raidlands_server_status_label($online, $status);
    }

    $details_json = null;

    if (array_key_exists('details', $payload) && is_array($payload['details'])) {
        $details_json = json_encode($payload['details'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    $generated_at = raidlands_server_status_timestamp($payload['generated_at'] ?? null) ?? gmdate('Y-m-d H:i:s');
    $received_at = gmdate('Y-m-d H:i:s');
    $wipe_started_at = raidlands_server_status_timestamp($payload['wipe_started_at'] ?? null);
    $values = [
        'server_id' => $header_server_id,
        'name' => raidlands_server_status_clean_text($payload['name'] ?? '', 180),
        'online' => $online === null ? null : ($online ? 1 : 0),
        'status' => $status,
        'status_label' => $status_label,
        'generated_at' => $generated_at,
        'received_at' => $received_at,
        'players' => raidlands_server_status_int($payload['players'] ?? 0, 0),
        'max_players' => raidlands_server_status_int($payload['max_players'] ?? 0, 0),
        'queue' => raidlands_server_status_int($payload['queue'] ?? 0, 0),
        'joining' => raidlands_server_status_int($payload['joining'] ?? 0, 0),
        'sleepers' => raidlands_server_status_int($payload['sleepers'] ?? 0, 0),
        'server_fps' => raidlands_server_status_stat_value($payload['server_fps'] ?? ''),
        'server_fps_average' => raidlands_server_status_stat_value($payload['server_fps_average'] ?? ''),
        'entity_count' => raidlands_server_status_int($payload['entity_count'] ?? 0, 0),
        'map_name' => raidlands_server_status_clean_text($payload['map_name'] ?? '', 120),
        'world_size' => raidlands_server_status_int($payload['world_size'] ?? 0, 0),
        'seed' => raidlands_server_status_int($payload['seed'] ?? 0, 0),
        'wipe_key' => raidlands_server_status_clean_text($payload['wipe_key'] ?? '', 160),
        'wipe_started_at' => $wipe_started_at,
        'payload_hash' => hash('sha256', $body),
        'details_json' => $details_json,
    ];

    $statement = raidlands_db_required()->prepare(
        'INSERT INTO server_status
            (server_id, name, online, status, status_label, generated_at, received_at,
             players, max_players, queue, joining, sleepers, server_fps, server_fps_average,
             entity_count, map_name, world_size, seed, wipe_key, wipe_started_at, payload_hash, details_json)
         VALUES
            (:server_id, :name, :online, :status, :status_label, :generated_at, :received_at,
             :players, :max_players, :queue, :joining, :sleepers, :server_fps, :server_fps_average,
             :entity_count, :map_name, :world_size, :seed, :wipe_key, :wipe_started_at, :payload_hash, :details_json)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            online = VALUES(online),
            status = VALUES(status),
            status_label = VALUES(status_label),
            generated_at = VALUES(generated_at),
            received_at = VALUES(received_at),
            players = VALUES(players),
            max_players = VALUES(max_players),
            queue = VALUES(queue),
            joining = VALUES(joining),
            sleepers = VALUES(sleepers),
            server_fps = VALUES(server_fps),
            server_fps_average = VALUES(server_fps_average),
            entity_count = VALUES(entity_count),
            map_name = VALUES(map_name),
            world_size = VALUES(world_size),
            seed = VALUES(seed),
            wipe_key = VALUES(wipe_key),
            wipe_started_at = VALUES(wipe_started_at),
            payload_hash = VALUES(payload_hash),
            details_json = VALUES(details_json),
            updated_at = NOW()'
    );

    $statement->execute($values);
    raidlands_server_status_insert_sample($values);

    return [
        'server_id' => $header_server_id,
        'generated_at' => $generated_at,
        'received_at' => gmdate('c', strtotime($received_at)),
    ];
}

function raidlands_server_status_insert_sample(array $values): void
{
    if (!raidlands_server_status_history_is_ready()) {
        return;
    }

    try {
        raidlands_db_execute(
            'INSERT IGNORE INTO server_status_samples
                (server_id, generated_at, received_at, online, status, players, max_players, queue, joining, sleepers, map_name, payload_hash)
             VALUES
                (:server_id, :generated_at, :received_at, :online, :status, :players, :max_players, :queue, :joining, :sleepers, :map_name, :payload_hash)',
            [
                'server_id' => $values['server_id'],
                'generated_at' => $values['generated_at'],
                'received_at' => $values['received_at'],
                'online' => $values['online'],
                'status' => $values['status'],
                'players' => $values['players'],
                'max_players' => $values['max_players'],
                'queue' => $values['queue'],
                'joining' => $values['joining'],
                'sleepers' => $values['sleepers'],
                'map_name' => $values['map_name'],
                'payload_hash' => $values['payload_hash'],
            ]
        );

        raidlands_db_execute(
            'DELETE FROM server_status_samples
             WHERE server_id = :server_id
               AND received_at < :cutoff',
            [
                'server_id' => $values['server_id'],
                'cutoff' => gmdate('Y-m-d H:i:s', time() - (raidlands_server_status_sample_retention_days() * 24 * 60 * 60)),
            ]
        );

        raidlands_server_status_refresh_rollups((string) $values['server_id'], (string) $values['received_at']);
    } catch (Throwable $error) {
        // History is useful, but latest status should not fail because samples lag.
    }
}

function raidlands_server_status_refresh_rollups(string $server_id, string $received_at): void
{
    if (!raidlands_server_status_rollups_are_ready()) {
        return;
    }

    $timestamp = strtotime($received_at) ?: time();
    $hour_start = gmdate('Y-m-d H:00:00', $timestamp);
    $day_start = gmdate('Y-m-d', $timestamp);

    raidlands_server_status_refresh_hourly_rollup($server_id, $hour_start);
    raidlands_server_status_refresh_daily_rollup($server_id, $day_start);
    raidlands_server_status_prune_hourly_rollups($server_id);
}

function raidlands_server_status_refresh_hourly_rollup(string $server_id, string $hour_start): void
{
    $hour_timestamp = strtotime($hour_start) ?: time();
    $start = gmdate('Y-m-d H:00:00', $hour_timestamp);
    $end = gmdate('Y-m-d H:00:00', $hour_timestamp + 3600);

    raidlands_db_execute(
        'INSERT INTO server_status_hourly_rollups
            (server_id, bucket_hour, avg_players, peak_players, avg_queue, online_sample_count, sample_count)
         SELECT
            :select_server_id,
            :bucket_hour,
            COALESCE(ROUND(AVG(players), 2), 0),
            COALESCE(MAX(players), 0),
            COALESCE(ROUND(AVG(queue), 2), 0),
            COALESCE(SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END), 0),
            COUNT(*)
         FROM server_status_samples
         WHERE server_id = :where_server_id
           AND received_at >= :start_at
           AND received_at < :end_at
         HAVING COUNT(*) > 0
         ON DUPLICATE KEY UPDATE
            avg_players = VALUES(avg_players),
            peak_players = VALUES(peak_players),
            avg_queue = VALUES(avg_queue),
            online_sample_count = VALUES(online_sample_count),
            sample_count = VALUES(sample_count),
            updated_at = NOW()',
        [
            'select_server_id' => $server_id,
            'bucket_hour' => $start,
            'where_server_id' => $server_id,
            'start_at' => $start,
            'end_at' => $end,
        ]
    );
}

function raidlands_server_status_refresh_daily_rollup(string $server_id, string $bucket_date): void
{
    $day_timestamp = strtotime($bucket_date) ?: time();
    $start = gmdate('Y-m-d 00:00:00', $day_timestamp);
    $end = gmdate('Y-m-d 00:00:00', $day_timestamp + 86400);
    $date = gmdate('Y-m-d', $day_timestamp);
    $rows = raidlands_db_fetch_all(
        'SELECT id, online, players
         FROM server_status_samples
         WHERE server_id = :server_id
           AND received_at >= :start_at
           AND received_at < :end_at
         ORDER BY received_at ASC, id ASC',
        [
            'server_id' => $server_id,
            'start_at' => $start,
            'end_at' => $end,
        ]
    );

    $sample_count = count($rows);

    if ($sample_count === 0) {
        return;
    }

    $online_sample_count = 0;
    $peak_players = 0;
    $total_players = 0;
    $downtime_count = 0;
    $was_offline = false;

    foreach ($rows as $row) {
        $players = (int) ($row['players'] ?? 0);
        $online = isset($row['online']) ? (bool) $row['online'] : null;
        $peak_players = max($peak_players, $players);
        $total_players += $players;

        if ($online === true) {
            $online_sample_count += 1;
            $was_offline = false;
            continue;
        }

        if ($online === false) {
            if (!$was_offline) {
                $downtime_count += 1;
            }

            $was_offline = true;
            continue;
        }

        $was_offline = false;
    }

    raidlands_db_execute(
        'INSERT INTO server_status_daily_rollups
            (server_id, bucket_date, daily_peak, average_players, uptime_percent,
             downtime_count, online_sample_count, sample_count)
         VALUES
            (:server_id, :bucket_date, :daily_peak, :average_players, :uptime_percent,
             :downtime_count, :online_sample_count, :sample_count)
         ON DUPLICATE KEY UPDATE
            daily_peak = VALUES(daily_peak),
            average_players = VALUES(average_players),
            uptime_percent = VALUES(uptime_percent),
            downtime_count = VALUES(downtime_count),
            online_sample_count = VALUES(online_sample_count),
            sample_count = VALUES(sample_count),
            updated_at = NOW()',
        [
            'server_id' => $server_id,
            'bucket_date' => $date,
            'daily_peak' => $peak_players,
            'average_players' => round($total_players / $sample_count, 2),
            'uptime_percent' => round(($online_sample_count / $sample_count) * 100, 2),
            'downtime_count' => $downtime_count,
            'online_sample_count' => $online_sample_count,
            'sample_count' => $sample_count,
        ]
    );
}

function raidlands_server_status_prune_hourly_rollups(string $server_id): void
{
    $cutoff = strtotime('-' . raidlands_server_status_hourly_retention_months() . ' months');

    raidlands_db_execute(
        'DELETE FROM server_status_hourly_rollups
         WHERE server_id = :server_id
           AND bucket_hour < :cutoff',
        [
            'server_id' => $server_id,
            'cutoff' => gmdate('Y-m-d H:00:00', $cutoff === false ? time() : $cutoff),
        ]
    );
}

function raidlands_server_status_latest(?string $server_id = null): ?array
{
    if (!raidlands_server_status_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM server_status WHERE server_id = :server_id LIMIT 1',
        ['server_id' => $server_id ?? raidlands_server_status_server_id()]
    );
}

function raidlands_server_status_public(): array
{
    global $site_config;

    $row = raidlands_server_status_latest();

    if ($row === null) {
        return raidlands_server_status_fallback('Server heartbeat is not available yet.');
    }

    return raidlands_server_status_row_public($row, raidlands_server_status_stale_seconds(), $site_config);
}

function raidlands_server_status_history_public(?int $minutes = null, string $range = ''): array
{
    $history_range = raidlands_server_status_history_range($range, $minutes);

    if ($history_range['granularity'] === 'hour') {
        return raidlands_server_status_history_hourly_public((int) $history_range['days'], $history_range);
    }

    if ($history_range['granularity'] === 'day') {
        return raidlands_server_status_history_daily_public((int) $history_range['months'], $history_range);
    }

    return raidlands_server_status_history_recent_public((int) $history_range['minutes'], $history_range);
}

function raidlands_server_status_history_range(string $range, ?int $minutes = null): array
{
    $range = strtolower(trim($range));

    if ($range === '' && $minutes !== null) {
        $window_minutes = max(30, min(1440, $minutes));

        return [
            'range' => 'custom',
            'label' => raidlands_server_status_history_minutes_label($window_minutes),
            'granularity' => 'sample',
            'minutes' => $window_minutes,
        ];
    }

    if (in_array($range, ['24h', '1d', 'day'], true)) {
        return [
            'range' => '24h',
            'label' => '24 hours',
            'granularity' => 'sample',
            'minutes' => 1440,
        ];
    }

    if (in_array($range, ['30d', 'month'], true)) {
        return [
            'range' => '30d',
            'label' => '30 days',
            'granularity' => 'hour',
            'days' => 30,
            'minutes' => 30 * 24 * 60,
        ];
    }

    if (in_array($range, ['12mo', '12m', '1y', 'year'], true)) {
        return [
            'range' => '12mo',
            'label' => '12 months',
            'granularity' => 'day',
            'months' => 12,
            'minutes' => 365 * 24 * 60,
        ];
    }

    return [
        'range' => '6h',
        'label' => '6 hours',
        'granularity' => 'sample',
        'minutes' => 360,
    ];
}

function raidlands_server_status_history_recent_public(int $window_minutes, array $history_range): array
{
    $window_minutes = max(30, min(1440, $window_minutes));
    $now = time();
    $window_start = $now - ($window_minutes * 60);
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);
    $limit = min(3000, max(60, ($window_minutes * 2) + 10));

    if (!raidlands_server_status_history_is_ready()) {
        return raidlands_server_status_history_empty($window_minutes, 'Server status history is not available yet.', $history_range);
    }

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT *
             FROM (
                SELECT generated_at, received_at, online, status, players, max_players, queue, joining, sleepers, map_name
                FROM server_status_samples
                WHERE server_id = :server_id
                  AND received_at >= :cutoff
                ORDER BY received_at DESC
                LIMIT ' . $limit . '
             ) recent
             ORDER BY COALESCE(generated_at, received_at) ASC, received_at ASC',
            [
                'server_id' => raidlands_server_status_server_id(),
                'cutoff' => gmdate('Y-m-d H:i:s', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty($window_minutes, 'Server status history could not be loaded.', $history_range);
    }

    $samples = [];
    $online_count = 0;
    $peak_players = 0;
    $total_players = 0;
    $total_queue = 0;
    $downtime_count = 0;
    $was_offline = false;

    foreach ($rows as $row) {
        $online = isset($row['online']) ? (bool) $row['online'] : null;
        $players = (int) ($row['players'] ?? 0);
        $queue = (int) ($row['queue'] ?? 0);
        $peak_players = max($peak_players, $players);
        $total_players += $players;
        $total_queue += $queue;

        if ($online === true) {
            $online_count += 1;
            $was_offline = false;
        } elseif ($online === false) {
            if (!$was_offline) {
                $downtime_count += 1;
            }

            $was_offline = true;
        } else {
            $was_offline = false;
        }

        $samples[] = [
            'time' => raidlands_server_status_iso($row['generated_at'] ?? $row['received_at'] ?? ''),
            'generatedAt' => raidlands_server_status_iso($row['generated_at'] ?? ''),
            'online' => $online,
            'status' => (string) ($row['status'] ?? 'unknown'),
            'players' => $players,
            'maxPlayers' => (int) ($row['max_players'] ?? 0),
            'queue' => $queue,
            'joining' => (int) ($row['joining'] ?? 0),
            'sleepers' => (int) ($row['sleepers'] ?? 0),
            'mapName' => (string) ($row['map_name'] ?? ''),
            'granularity' => 'sample',
        ];
    }

    $sample_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => $window_minutes,
        'sampleCount' => $sample_count,
        'pointCount' => $sample_count,
        'onlineSampleCount' => $online_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_players / $sample_count, 1) : null,
        'averageQueue' => $sample_count > 0 ? round($total_queue / $sample_count, 1) : null,
        'downtimeCount' => $downtime_count,
        'samples' => $samples,
        'error' => $sample_count > 0 ? '' : 'Waiting for the first stored server heartbeat sample.',
    ]);
}

function raidlands_server_status_history_hourly_public(int $days, array $history_range): array
{
    $days = max(1, min(31, $days));
    $now = time();
    $window_start = intdiv($now - ($days * 24 * 60 * 60), 3600) * 3600;
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);

    if (!raidlands_server_status_rollups_are_ready()) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups are not available yet. Run database/migrations/011_server_status_rollups.sql.', $history_range);
    }

    $server_id = raidlands_server_status_server_id();

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT bucket_hour, avg_players, peak_players, avg_queue, online_sample_count, sample_count
             FROM server_status_hourly_rollups
             WHERE server_id = :server_id
               AND bucket_hour >= :cutoff
             ORDER BY bucket_hour ASC',
            [
                'server_id' => $server_id,
                'cutoff' => gmdate('Y-m-d H:00:00', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups could not be loaded.', $history_range);
    }

    $samples = [];
    $sample_count = 0;
    $online_sample_count = 0;
    $peak_players = 0;
    $total_player_weight = 0.0;
    $total_queue_weight = 0.0;

    foreach ($rows as $row) {
        $row_sample_count = (int) ($row['sample_count'] ?? 0);
        $row_online_count = (int) ($row['online_sample_count'] ?? 0);
        $average_players = (float) ($row['avg_players'] ?? 0);
        $average_queue = (float) ($row['avg_queue'] ?? 0);
        $sample_count += $row_sample_count;
        $online_sample_count += $row_online_count;
        $peak_players = max($peak_players, (int) ($row['peak_players'] ?? 0));
        $total_player_weight += $average_players * $row_sample_count;
        $total_queue_weight += $average_queue * $row_sample_count;

        $samples[] = [
            'time' => raidlands_server_status_iso($row['bucket_hour'] ?? ''),
            'bucket' => (string) ($row['bucket_hour'] ?? ''),
            'granularity' => 'hour',
            'online' => raidlands_server_status_rollup_online_state($row_online_count, $row_sample_count),
            'players' => round($average_players, 1),
            'peakPlayers' => (int) ($row['peak_players'] ?? 0),
            'queue' => round($average_queue, 1),
            'sampleCount' => $row_sample_count,
            'onlineSampleCount' => $row_online_count,
            'uptimePercent' => $row_sample_count > 0 ? round(($row_online_count / $row_sample_count) * 100, 1) : null,
        ];
    }

    $point_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => (int) ($history_range['minutes'] ?? ($days * 24 * 60)),
        'sampleCount' => $sample_count,
        'pointCount' => $point_count,
        'onlineSampleCount' => $online_sample_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_sample_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_player_weight / $sample_count, 1) : null,
        'averageQueue' => $sample_count > 0 ? round($total_queue_weight / $sample_count, 1) : null,
        'downtimeCount' => raidlands_server_status_daily_downtime_count($server_id, $days),
        'samples' => $samples,
        'error' => $point_count > 0 ? '' : 'Waiting for hourly server status rollups.',
    ]);
}

function raidlands_server_status_history_daily_public(int $months, array $history_range): array
{
    $months = max(1, min(24, $months));
    $now = time();
    $cutoff = strtotime('-' . $months . ' months', $now);
    $cutoff = $cutoff === false ? $now : $cutoff;
    $window_start = gmmktime(0, 0, 0, (int) gmdate('n', $cutoff), (int) gmdate('j', $cutoff), (int) gmdate('Y', $cutoff));
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);

    if (!raidlands_server_status_rollups_are_ready()) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups are not available yet. Run database/migrations/011_server_status_rollups.sql.', $history_range);
    }

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT bucket_date, daily_peak, average_players, uptime_percent,
                    downtime_count, online_sample_count, sample_count
             FROM server_status_daily_rollups
             WHERE server_id = :server_id
               AND bucket_date >= :cutoff
             ORDER BY bucket_date ASC',
            [
                'server_id' => raidlands_server_status_server_id(),
                'cutoff' => gmdate('Y-m-d', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status daily rollups could not be loaded.', $history_range);
    }

    $samples = [];
    $sample_count = 0;
    $online_sample_count = 0;
    $peak_players = 0;
    $total_player_weight = 0.0;
    $downtime_count = 0;

    foreach ($rows as $row) {
        $row_sample_count = (int) ($row['sample_count'] ?? 0);
        $row_online_count = (int) ($row['online_sample_count'] ?? 0);
        $average_players = (float) ($row['average_players'] ?? 0);
        $sample_count += $row_sample_count;
        $online_sample_count += $row_online_count;
        $peak_players = max($peak_players, (int) ($row['daily_peak'] ?? 0));
        $total_player_weight += $average_players * $row_sample_count;
        $downtime_count += (int) ($row['downtime_count'] ?? 0);

        $samples[] = [
            'time' => raidlands_server_status_iso(((string) ($row['bucket_date'] ?? '')) . ' 00:00:00'),
            'bucket' => (string) ($row['bucket_date'] ?? ''),
            'granularity' => 'day',
            'online' => raidlands_server_status_rollup_online_state($row_online_count, $row_sample_count),
            'players' => round($average_players, 1),
            'peakPlayers' => (int) ($row['daily_peak'] ?? 0),
            'queue' => 0,
            'sampleCount' => $row_sample_count,
            'onlineSampleCount' => $row_online_count,
            'uptimePercent' => isset($row['uptime_percent']) ? round((float) $row['uptime_percent'], 1) : null,
            'downtimeCount' => (int) ($row['downtime_count'] ?? 0),
        ];
    }

    $point_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => (int) ($history_range['minutes'] ?? ($months * 31 * 24 * 60)),
        'sampleCount' => $sample_count,
        'pointCount' => $point_count,
        'onlineSampleCount' => $online_sample_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_sample_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_player_weight / $sample_count, 1) : null,
        'averageQueue' => null,
        'downtimeCount' => $downtime_count,
        'samples' => $samples,
        'error' => $point_count > 0 ? '' : 'Waiting for daily server status rollups.',
    ]);
}

function raidlands_server_status_daily_downtime_count(string $server_id, int $days): int
{
    try {
        $row = raidlands_db_fetch_one(
            'SELECT COALESCE(SUM(downtime_count), 0) AS downtime_count
             FROM server_status_daily_rollups
             WHERE server_id = :server_id
               AND bucket_date >= :cutoff',
            [
                'server_id' => $server_id,
                'cutoff' => gmdate('Y-m-d', time() - ($days * 24 * 60 * 60)),
            ]
        );
    } catch (Throwable $error) {
        return 0;
    }

    return (int) ($row['downtime_count'] ?? 0);
}

function raidlands_server_status_rollup_online_state(int $online_sample_count, int $sample_count): ?bool
{
    if ($sample_count <= 0) {
        return null;
    }

    if ($online_sample_count >= $sample_count) {
        return true;
    }

    if ($online_sample_count === 0) {
        return false;
    }

    return null;
}

function raidlands_server_status_history_payload(array $history_range, array $payload): array
{
    return array_merge([
        'ok' => true,
        'source' => 'raidlands',
        'sourceLabel' => 'Raidlands live feed',
        'range' => (string) ($history_range['range'] ?? '6h'),
        'rangeLabel' => (string) ($history_range['label'] ?? '6 hours'),
        'granularity' => (string) ($history_range['granularity'] ?? 'sample'),
        'windowMinutes' => (int) ($history_range['minutes'] ?? 360),
        'windowStart' => (string) ($history_range['windowStart'] ?? ''),
        'windowEnd' => (string) ($history_range['windowEnd'] ?? ''),
        'sampleCount' => 0,
        'pointCount' => 0,
        'onlineSampleCount' => 0,
        'uptimePercent' => null,
        'peakPlayers' => 0,
        'averagePlayers' => null,
        'averageQueue' => null,
        'downtimeCount' => 0,
        'samples' => [],
        'error' => '',
    ], $payload);
}

function raidlands_server_status_history_minutes_label(int $minutes): string
{
    if ($minutes >= 1440) {
        return '24 hours';
    }

    if ($minutes >= 60 && $minutes % 60 === 0) {
        $hours = (int) ($minutes / 60);

        return $hours . ' hour' . ($hours === 1 ? '' : 's');
    }

    return $minutes . ' minutes';
}

function raidlands_server_status_history_empty(int $window_minutes, string $error, array $history_range = []): array
{
    $fallback_range = $history_range;

    if ($fallback_range === []) {
        $fallback_range = [
            'range' => '6h',
            'label' => raidlands_server_status_history_minutes_label($window_minutes),
            'granularity' => 'sample',
            'minutes' => $window_minutes,
        ];
    }

    return raidlands_server_status_history_payload($fallback_range, [
        'ok' => false,
        'source' => 'fallback',
        'sourceLabel' => 'site fallback',
        'windowMinutes' => $window_minutes,
        'error' => $error,
    ]);
}

function raidlands_server_status_row_public(array $row, int $stale_seconds, array $site_config): array
{
    $received_at = strtotime((string) ($row['received_at'] ?? '')) ?: 0;
    $generated_at = strtotime((string) ($row['generated_at'] ?? '')) ?: $received_at;
    $freshness_time = max($received_at, $generated_at);
    $age_seconds = $freshness_time > 0 ? max(0, time() - $freshness_time) : $stale_seconds + 1;
    $stale = $age_seconds > $stale_seconds;
    $online = isset($row['online']) ? (bool) $row['online'] : null;
    $status = (string) ($row['status'] ?? 'unknown');
    $status_label = (string) ($row['status_label'] ?? '');

    if ($stale) {
        $online = null;
        $status = 'delayed';
        $status_label = 'Status Delayed';
    } elseif ($status_label === '') {
        $status_label = raidlands_server_status_label($online, $status);
    }

    return [
        'source' => 'raidlands',
        'sourceLabel' => $stale ? 'Raidlands delayed' : 'Raidlands live',
        'online' => $online,
        'status' => $status,
        'statusLabel' => $status_label,
        'name' => (string) ($row['name'] ?: $site_config['serverName']),
        'players' => (int) ($row['players'] ?? 0),
        'maxPlayers' => (int) ($row['max_players'] ?? $site_config['maxPlayers']),
        'queue' => (int) ($row['queue'] ?? 0),
        'joining' => (int) ($row['joining'] ?? 0),
        'sleepers' => (int) ($row['sleepers'] ?? 0),
        'mapName' => (string) ($row['map_name'] ?: $site_config['mapName']),
        'serverFps' => (string) ($row['server_fps'] ?: $site_config['serverFps']),
        'serverFpsAverage' => (string) ($row['server_fps_average'] ?? ''),
        'entityCount' => (int) ($row['entity_count'] ?? 0),
        'worldSize' => (int) ($row['world_size'] ?? 0),
        'seed' => (int) ($row['seed'] ?? 0),
        'wipeStartedAt' => raidlands_server_status_iso($row['wipe_started_at'] ?? ''),
        'lastWipe' => raidlands_server_status_iso($row['wipe_started_at'] ?? ''),
        'nextWipe' => '',
        'updatedAt' => raidlands_server_status_iso($row['generated_at'] ?? $row['received_at'] ?? ''),
        'receivedAt' => raidlands_server_status_iso($row['received_at'] ?? ''),
        'fetchedAt' => gmdate('c'),
        'cached' => false,
        'stale' => $stale,
        'ageSeconds' => $age_seconds,
        'staleAfterSeconds' => $stale_seconds,
        'battleMetricsUrl' => '',
        'error' => $stale ? 'Using the last server heartbeat because the live heartbeat is delayed.' : '',
    ];
}

function raidlands_server_status_fallback(string $error): array
{
    global $site_config;

    $online = (bool) $site_config['serverOnline'];

    return [
        'source' => 'fallback',
        'sourceLabel' => 'site fallback',
        'online' => $online,
        'status' => $online ? 'online' : 'offline',
        'statusLabel' => $online ? 'Online' : 'Offline',
        'name' => (string) $site_config['serverName'],
        'players' => (int) $site_config['playersOnline'],
        'maxPlayers' => (int) $site_config['maxPlayers'],
        'queue' => (int) $site_config['queue'],
        'joining' => 0,
        'sleepers' => 0,
        'mapName' => (string) $site_config['mapName'],
        'serverFps' => (string) $site_config['serverFps'],
        'serverFpsAverage' => '',
        'entityCount' => 0,
        'worldSize' => 0,
        'seed' => 0,
        'wipeStartedAt' => '',
        'lastWipe' => '',
        'nextWipe' => '',
        'updatedAt' => '',
        'receivedAt' => '',
        'fetchedAt' => gmdate('c'),
        'cached' => false,
        'stale' => true,
        'battleMetricsUrl' => '',
        'error' => $error,
    ];
}
