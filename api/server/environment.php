<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    $playback = !empty($_GET['playback']) && (string) $_GET['playback'] !== '0';
    $at = (string) ($_GET['at'] ?? '');

    if ($at !== '') {
        raidlands_store_json_response(raidlands_server_environment_public_at($at));
    }

    raidlands_store_json_response($playback
        ? raidlands_server_environment_history_public((string) ($_GET['range'] ?? '24h'), (int) ($_GET['frames'] ?? 12))
        : raidlands_server_environment_public());
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Server environment could not be loaded.',
        'environment' => null,
    ], 500);
}
