<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    $metric = (string) ($_GET['metric'] ?? 'deaths');
    $range = (string) ($_GET['range'] ?? '24h');
    $playback = !empty($_GET['playback']) && (string) $_GET['playback'] !== '0';

    raidlands_store_json_response($playback
        ? raidlands_server_heatmap_history_public($metric, $range, (int) ($_GET['frames'] ?? 12))
        : raidlands_server_heatmap_public($metric, $range));
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Heat map data could not be loaded.',
        'buckets' => [],
    ], 500);
}
