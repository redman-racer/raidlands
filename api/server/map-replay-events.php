<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    raidlands_store_json_response(
        raidlands_server_map_replay_events_history_public(
            (string) ($_GET['range'] ?? '24h'),
            (int) ($_GET['frames'] ?? 12)
        )
    );
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Replay events could not be loaded.',
        'frames' => [],
    ], 500);
}
