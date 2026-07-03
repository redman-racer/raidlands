<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/kits.php';

$body = file_get_contents('php://input') ?: '';
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        throw new InvalidArgumentException('Snapshot body must be JSON.');
    }

    $result = raidlands_kits_import_snapshot($payload);

    raidlands_store_json_response([
        'ok' => true,
        'imported' => $result['imported'],
        'revision' => $result['revision'],
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
