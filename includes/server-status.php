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

    $statement->execute([
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
    ]);

    return [
        'server_id' => $header_server_id,
        'generated_at' => $generated_at,
        'received_at' => gmdate('c', strtotime($received_at)),
    ];
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
        'wipeKey' => (string) ($row['wipe_key'] ?? ''),
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
        'wipeKey' => '',
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
