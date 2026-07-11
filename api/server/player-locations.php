<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    raidlands_store_json_response(raidlands_server_player_locations_public());
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Player locations could not be loaded.',
        'players' => [],
    ], 500);
}
