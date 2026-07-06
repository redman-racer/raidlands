<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/rewards.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 25)));
    $rows = raidlands_rewards_bridge_point_requests($limit);
    $requests = [];

    foreach ($rows as $row) {
        $requests[] = [
            'request_id' => (string) $row['request_token'],
            'steam_id64' => (string) $row['steam_id64'],
            'source_type' => (string) $row['source_type'],
            'source_id' => (string) $row['source_id'],
            'debit_rp' => (int) $row['debit_rp'],
            'credit_rp' => (int) $row['credit_rp'],
            'reason' => (string) $row['reason'],
            'metadata' => json_decode((string) ($row['metadata_json'] ?? ''), true) ?: null,
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
