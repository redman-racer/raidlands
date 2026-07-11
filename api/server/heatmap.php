<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    raidlands_store_json_response(raidlands_server_heatmap_public(
        (string) ($_GET['metric'] ?? 'deaths'),
        (string) ($_GET['range'] ?? '24h')
    ));
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Heat map data could not be loaded.',
        'buckets' => [],
    ], 500);
}
