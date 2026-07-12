<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';

try {
    $playback = !empty($_GET['playback']) && (string) $_GET['playback'] !== '0';
    $include_all_players = raidlands_admin_can('admin.sync.view')
        && !empty($_GET['all'])
        && (string) $_GET['all'] !== '0';

    raidlands_store_json_response($playback
        ? raidlands_server_player_locations_history_public((string) ($_GET['range'] ?? '24h'), (int) ($_GET['frames'] ?? 12), $include_all_players)
        : raidlands_server_player_locations_public($include_all_players));
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Player locations could not be loaded.',
        'players' => [],
    ], 500);
}
