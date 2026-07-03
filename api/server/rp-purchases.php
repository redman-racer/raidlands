<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 25)));
    $rows = raidlands_store_bridge_rp_requests($limit);
    $requests = [];

    foreach ($rows as $row) {
        $requests[] = [
            'request_id' => (string) $row['request_token'],
            'steam_id64' => (string) $row['steam_id64'],
            'rp_cost' => (int) $row['rp_cost'],
            'product_id' => (int) $row['product_id'],
            'product_name' => (string) ($row['product_name'] ?? ''),
            'product_slug' => (string) ($row['product_slug'] ?? ''),
            'price_label' => (string) ($row['price_label'] ?? ''),
            'access_interval' => (string) $row['access_interval'],
            'access_duration_seconds' => (int) $row['access_duration_seconds'],
            'auto_renew' => !empty($row['auto_renew_requested']),
            'renewal' => !empty($row['rp_subscription_id']),
        ];
    }

    raidlands_store_json_response([
        'ok' => true,
        'requests' => $requests,
        'count' => count($requests),
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
