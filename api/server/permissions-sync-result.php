<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/permissions.php';

$body = file_get_contents('php://input') ?: '';
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        throw new InvalidArgumentException('Permission sync result body must be JSON.');
    }

    raidlands_permissions_record_sync_result($payload);

    raidlands_store_json_response(['ok' => true]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
