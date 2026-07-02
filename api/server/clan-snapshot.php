<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/clans.php';

$body = (string) file_get_contents('php://input');
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
    }

    $server_id = (string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? raidlands_clans_server_id());
    $result = raidlands_clans_store_snapshot($payload, $server_id);

    raidlands_store_json_response([
        'ok' => true,
        'snapshot' => $result,
    ]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
