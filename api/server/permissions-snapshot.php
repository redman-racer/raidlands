<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/permissions.php';

$body = file_get_contents('php://input') ?: '';
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        throw new InvalidArgumentException('Permission snapshot body must be JSON.');
    }

    $result = raidlands_permissions_import_snapshot($payload);

    raidlands_store_json_response([
        'ok' => true,
        'revision' => $result['revision'],
        'groups' => $result['groups'],
        'permissions' => $result['permissions'],
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
