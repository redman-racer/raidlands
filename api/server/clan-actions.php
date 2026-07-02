<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/clans.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $server_id = (string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? raidlands_clans_server_id());
    $limit = (int) ($_GET['limit'] ?? 25);
    $actions = raidlands_clans_claim_actions($server_id, $limit);

    raidlands_store_json_response([
        'ok' => true,
        'actions' => $actions,
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
