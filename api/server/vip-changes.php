<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $since = (int) ($_GET['since'] ?? 0);
    $changes = raidlands_store_bridge_changes($since);

    raidlands_store_json_response([
        'ok' => true,
        'managed_groups' => raidlands_store_managed_groups(),
        'players' => $changes['players'],
        'cursor' => $changes['cursor'],
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
