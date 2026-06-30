<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $steam_id64 = preg_replace('/\D+/', '', (string) ($_GET['steam_id64'] ?? '')) ?? '';

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid SteamID64.'], 422);
    }

    $state = raidlands_store_active_groups_for_steam($steam_id64);

    raidlands_store_json_response([
        'ok' => true,
        'steam_id64' => $steam_id64,
        'managed_groups' => raidlands_store_managed_groups(),
        'groups' => $state['groups'],
        'entitlements' => $state['entitlements'],
        'cursor' => $state['cursor'],
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
