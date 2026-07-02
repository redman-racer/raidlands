<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/clans.php';

raidlands_store_boot();

try {
    $payload = $_GET;
    $auth = raidlands_clans_authenticate_read_request($payload);
    $context = raidlands_clans_public_context_payload($auth['player']);

    raidlands_store_json_response([
        'ok' => true,
        'auth_type' => $auth['auth_type'],
        'context' => $context,
        'rate_limit' => [
            'limit' => raidlands_clans_api_rate_limit_per_minute(),
            'window_seconds' => 60,
        ],
    ]);
} catch (Throwable $error) {
    $status = str_contains($error->getMessage(), 'Rate limit exceeded') ? 429 : 401;
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], $status);
}
