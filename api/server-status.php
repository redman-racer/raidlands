<?php

require_once dirname(__DIR__) . '/includes/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=30');

$stats_config = $site_config['serverStats'] ?? [];
$server_id = preg_replace('/\D+/', '', (string) ($stats_config['battleMetricsServerId'] ?? ''));
$cache_seconds = max(30, (int) ($stats_config['cacheSeconds'] ?? 60));

if ($server_id === '') {
    respond_json(build_fallback_status($site_config, 'BattleMetrics server id is not configured.'));
}

$cache_path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'raidlands-server-status-' . $server_id . '.json';
$cached = read_cached_status($cache_path);

if ($cached !== null && isset($cached['_cacheTime']) && (time() - (int) $cached['_cacheTime']) < $cache_seconds) {
    $cached['cached'] = true;
    unset($cached['_cacheTime']);
    respond_json($cached);
}

$payload = fetch_json('https://api.battlemetrics.com/servers/' . rawurlencode($server_id));

if ($payload === null) {
    if ($cached !== null) {
        $cached['cached'] = true;
        $cached['stale'] = true;
        $cached['error'] = 'Using cached status because BattleMetrics could not be reached.';
        unset($cached['_cacheTime']);
        respond_json($cached);
    }

    respond_json(build_fallback_status($site_config, 'BattleMetrics could not be reached.'));
}

$status = normalize_battlemetrics_status($payload, $site_config, $server_id);
$cache_payload = $status;
$cache_payload['_cacheTime'] = time();
@file_put_contents($cache_path, json_encode($cache_payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

respond_json($status);

function fetch_json(string $url): ?array
{
    $body = null;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_USERAGENT => 'RaidlandsStatus/1.0',
        ]);

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if ($body === false || $status < 200 || $status >= 300) {
            $body = null;
        }
    }

    if ($body === null) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "Accept: application/json\r\nUser-Agent: RaidlandsStatus/1.0\r\n",
                'timeout' => 6,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);

        if ($body === false) {
            return null;
        }
    }

    $decoded = json_decode($body, true);

    return is_array($decoded) ? $decoded : null;
}

function read_cached_status(string $cache_path): ?array
{
    if (!is_file($cache_path)) {
        return null;
    }

    $decoded = json_decode((string) @file_get_contents($cache_path), true);

    return is_array($decoded) ? $decoded : null;
}

function normalize_battlemetrics_status(array $payload, array $site_config, string $server_id): array
{
    $attributes = $payload['data']['attributes'] ?? [];
    $details = is_array($attributes['details'] ?? null) ? $attributes['details'] : [];
    $status = strtolower((string) ($attributes['status'] ?? 'unknown'));
    $online = $status === 'online';
    $fps = $details['rust_fps'] ?? $site_config['serverFps'];

    return [
        'source' => 'battlemetrics',
        'online' => $online,
        'status' => $status,
        'statusLabel' => $online ? 'Online' : ucfirst($status ?: 'Unknown'),
        'name' => (string) ($attributes['name'] ?? $site_config['serverName']),
        'players' => to_int($attributes['players'] ?? null, (int) $site_config['playersOnline']),
        'maxPlayers' => to_int($attributes['maxPlayers'] ?? null, (int) $site_config['maxPlayers']),
        'queue' => to_int($details['rust_queued_players'] ?? null, (int) $site_config['queue']),
        'mapName' => (string) ($details['map'] ?? $site_config['mapName']),
        'serverFps' => format_stat_value($fps),
        'serverFpsAverage' => format_stat_value($details['rust_fps_avg'] ?? null),
        'lastWipe' => (string) ($details['rust_last_wipe'] ?? ''),
        'nextWipe' => (string) ($details['rust_next_wipe'] ?? ''),
        'updatedAt' => (string) ($attributes['updatedAt'] ?? gmdate('c')),
        'fetchedAt' => gmdate('c'),
        'battleMetricsUrl' => 'https://www.battlemetrics.com/servers/rust/' . $server_id,
        'cached' => false,
        'stale' => false,
    ];
}

function build_fallback_status(array $site_config, string $error): array
{
    $online = (bool) $site_config['serverOnline'];

    return [
        'source' => 'fallback',
        'online' => $online,
        'status' => $online ? 'online' : 'offline',
        'statusLabel' => $online ? 'Online' : 'Offline',
        'name' => (string) $site_config['serverName'],
        'players' => (int) $site_config['playersOnline'],
        'maxPlayers' => (int) $site_config['maxPlayers'],
        'queue' => (int) $site_config['queue'],
        'mapName' => (string) $site_config['mapName'],
        'serverFps' => (string) $site_config['serverFps'],
        'serverFpsAverage' => '',
        'lastWipe' => '',
        'nextWipe' => '',
        'updatedAt' => '',
        'fetchedAt' => gmdate('c'),
        'battleMetricsUrl' => '',
        'cached' => false,
        'stale' => true,
        'error' => $error,
    ];
}

function to_int($value, int $fallback): int
{
    return is_numeric($value) ? (int) $value : $fallback;
}

function format_stat_value($value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    if (is_numeric($value)) {
        return (string) round((float) $value);
    }

    return (string) $value;
}

function respond_json(array $payload): void
{
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}
