<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$body = (string) file_get_contents('php://input');
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON payload.'], 400);
    }

    $items = isset($payload['results']) && is_array($payload['results'])
        ? $payload['results']
        : [$payload];
    $results = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $results[] = raidlands_store_record_rp_purchase_result($item);
    }

    raidlands_store_json_response([
        'ok' => true,
        'results' => $results,
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
