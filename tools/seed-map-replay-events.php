<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/server-status.php';

$pdo = raidlands_db_required();
$migration = $site_root . '/database/migrations/058_server_map_replay_events.sql';

if (!raidlands_server_map_replay_events_are_ready()) {
    $sql = (string) file_get_contents($migration);
    if ($sql === '') {
        throw new RuntimeException('Could not read replay event migration.');
    }
    $pdo->exec($sql);
}

$server_id = raidlands_server_status_server_id();
$wipe_key = raidlands_server_map_replay_active_wipe_key($server_id);
$now = time();
$terrain_path = 'assets/media/maps/raidlands-main/current-terrain.json';
$texture_path = 'assets/media/maps/raidlands-main/current.jpg';
$terrain_json = is_file($site_root . '/' . $terrain_path) ? (string) file_get_contents($site_root . '/' . $terrain_path) : '';
$terrain = $terrain_json !== '' ? json_decode($terrain_json, true) : [];
$terrain_resolution = is_array($terrain) ? (int) ($terrain['resolution'] ?? 0) : 0;
$world_size = is_array($terrain) ? (int) ($terrain['worldSize'] ?? $terrain['world_size'] ?? 0) : 0;
$heights = is_array($terrain['heights'] ?? null) ? array_map('floatval', $terrain['heights']) : [];
$terrain_min = $heights !== [] ? min($heights) : 0.0;
$terrain_max = $heights !== [] ? max($heights) : 0.0;

$pdo->prepare(
    'INSERT INTO server_map_images
        (server_id, wipe_key, map_name, render_name, public_url, relative_path, terrain_public_url, terrain_relative_path,
         terrain_hash, terrain_bytes, terrain_resolution, terrain_min_height, terrain_max_height, terrain_water_level,
         skybox_public_url, skybox_relative_path, skybox_hash, skybox_mime, skybox_extension, skybox_bytes,
         image_hash, image_mime, image_extension, image_bytes, image_width, image_height, resolution, world_size, seed,
         protocol_network, generated_at, published_at)
     VALUES
        (:server_id, :wipe_key, :map_name, :render_name, :public_url, :relative_path, :terrain_public_url, :terrain_relative_path,
         :terrain_hash, :terrain_bytes, :terrain_resolution, :terrain_min_height, :terrain_max_height, :terrain_water_level,
         :skybox_public_url, :skybox_relative_path, :skybox_hash, :skybox_mime, :skybox_extension, :skybox_bytes,
         :image_hash, :image_mime, :image_extension, :image_bytes, :image_width, :image_height, :resolution, :world_size, :seed,
         :protocol_network, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
        wipe_key = VALUES(wipe_key),
        public_url = VALUES(public_url),
        relative_path = VALUES(relative_path),
        terrain_public_url = VALUES(terrain_public_url),
        terrain_relative_path = VALUES(terrain_relative_path),
        terrain_hash = VALUES(terrain_hash),
        terrain_bytes = VALUES(terrain_bytes),
        terrain_resolution = VALUES(terrain_resolution),
        terrain_min_height = VALUES(terrain_min_height),
        terrain_max_height = VALUES(terrain_max_height),
        skybox_public_url = VALUES(skybox_public_url),
        skybox_relative_path = VALUES(skybox_relative_path),
        skybox_hash = VALUES(skybox_hash),
        skybox_mime = VALUES(skybox_mime),
        skybox_extension = VALUES(skybox_extension),
        skybox_bytes = VALUES(skybox_bytes),
        world_size = VALUES(world_size),
        published_at = NOW()'
)->execute([
    'server_id' => $server_id,
    'wipe_key' => $wipe_key,
    'map_name' => 'Local replay smoke map',
    'render_name' => 'Local',
    'public_url' => '',
    'relative_path' => $texture_path,
    'terrain_public_url' => '',
    'terrain_relative_path' => $terrain_path,
    'terrain_hash' => $terrain_json !== '' ? hash('sha256', $terrain_json) : '',
    'terrain_bytes' => $terrain_json !== '' ? strlen($terrain_json) : 0,
    'terrain_resolution' => $terrain_resolution,
    'terrain_min_height' => $terrain_min,
    'terrain_max_height' => $terrain_max,
    'terrain_water_level' => (float) ($terrain['waterLevel'] ?? $terrain['water_level'] ?? 0),
    'skybox_public_url' => '',
    'skybox_relative_path' => 'assets/media/skyboxes/raidlands-current-skybox.png',
    'skybox_hash' => is_file($site_root . '/assets/media/skyboxes/raidlands-current-skybox.png') ? hash_file('sha256', $site_root . '/assets/media/skyboxes/raidlands-current-skybox.png') : '',
    'skybox_mime' => 'image/png',
    'skybox_extension' => 'png',
    'skybox_bytes' => is_file($site_root . '/assets/media/skyboxes/raidlands-current-skybox.png') ? filesize($site_root . '/assets/media/skyboxes/raidlands-current-skybox.png') : 0,
    'image_hash' => is_file($site_root . '/' . $texture_path) ? hash_file('sha256', $site_root . '/' . $texture_path) : '',
    'image_mime' => 'image/jpeg',
    'image_extension' => 'jpg',
    'image_bytes' => is_file($site_root . '/' . $texture_path) ? filesize($site_root . '/' . $texture_path) : 0,
    'image_width' => 0,
    'image_height' => 0,
    'resolution' => $terrain_resolution,
    'world_size' => $world_size,
    'seed' => (int) ($terrain['seed'] ?? 0),
    'protocol_network' => 0,
]);

$events = [
    ['key' => 'local-airdrop-group-a-1', 'age' => 8 * 3600, 'x' => 420.0, 'y' => 80.0, 'z' => -760.0],
    ['key' => 'local-airdrop-group-a-2', 'age' => 8 * 3600 - 35, 'x' => 470.0, 'y' => 84.0, 'z' => -720.0],
    ['key' => 'local-airdrop-group-a-3', 'age' => 8 * 3600 - 70, 'x' => 515.0, 'y' => 83.0, 'z' => -700.0],
    ['key' => 'local-airdrop-group-a-4', 'age' => 8 * 3600 - 95, 'x' => 555.0, 'y' => 82.0, 'z' => -675.0],
    ['key' => 'local-airdrop-group-b-1', 'age' => 7 * 3600, 'x' => -1180.0, 'y' => 92.0, 'z' => 860.0],
    ['key' => 'local-airdrop-group-b-2', 'age' => 7 * 3600 - 40, 'x' => -1125.0, 'y' => 94.0, 'z' => 895.0],
    ['key' => 'local-airdrop-group-b-3', 'age' => 7 * 3600 - 65, 'x' => -1080.0, 'y' => 91.0, 'z' => 920.0],
    ['key' => 'local-airdrop-group-b-4', 'age' => 7 * 3600 - 85, 'x' => -1030.0, 'y' => 92.0, 'z' => 940.0],
    ['key' => 'local-airdrop-group-b-5', 'age' => 7 * 3600 - 105, 'x' => -990.0, 'y' => 95.0, 'z' => 965.0],
    ['key' => 'local-airdrop-group-b-6', 'age' => 7 * 3600 - 118, 'x' => -950.0, 'y' => 94.0, 'z' => 990.0],
    ['key' => 'local-airdrop-group-b-7', 'age' => 7 * 3600 - 119, 'x' => -930.0, 'y' => 96.0, 'z' => 1005.0],
];

$payload = [
    'server_id' => $server_id,
    'wipe_key' => $wipe_key,
    'events' => array_map(static function (array $event) use ($now): array {
        return [
            'event_key' => $event['key'],
            'event_type' => 'airdrop',
            'occurred_at' => gmdate('c', $now - (int) $event['age']),
            'x' => $event['x'],
            'y' => $event['y'],
            'z' => $event['z'],
            'vehicle' => 'cargo_plane',
            'payload' => [
                'source' => 'local-seed',
                'prefab' => 'assets/prefabs/misc/supply drop/supply_drop.prefab',
            ],
        ];
    }, $events),
];

$result = raidlands_server_map_replay_events_ingest_snapshot($payload, $server_id);
$history = raidlands_server_map_replay_events_history_public('12h', 12);
$grouped = [];

foreach (($history['frames'] ?? []) as $frame) {
    foreach (($frame['events'] ?? []) as $event) {
        if (($event['eventType'] ?? '') === 'airdrop') {
            $grouped[] = [
                'eventKey' => $event['eventKey'] ?? '',
                'dropCount' => $event['payload']['dropCount'] ?? 1,
                'x' => $event['x'] ?? null,
                'z' => $event['z'] ?? null,
            ];
        }
    }
}

echo json_encode([
    'ok' => true,
    'database' => (string) $pdo->query('SELECT DATABASE()')->fetchColumn(),
    'ingest' => $result,
    'visibleAirdropGroups' => $grouped,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
