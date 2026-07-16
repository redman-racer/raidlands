<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-status.php';
require_once $site_root . '/includes/stats.php';

$body = (string) file_get_contents('php://input');
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
    }

    $result = raidlands_server_status_ingest_heartbeat(
        $payload,
        (string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? raidlands_server_status_server_id()),
        $body
    );
    $wipe = raidlands_stats_activate_wipe_signal(
        (string) ($result['server_id'] ?? $_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? raidlands_server_status_server_id()),
        (string) ($payload['wipe_key'] ?? ''),
        $payload['wipe_started_at'] ?? null
    );

    raidlands_store_json_response([
        'ok' => true,
        'status' => $result,
        'wipe' => $wipe,
    ]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
