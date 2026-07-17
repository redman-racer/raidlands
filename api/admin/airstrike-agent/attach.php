<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-agent.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json();
raidlands_admin_api_require_csrf($payload);

try {
    raidlands_admin_api_response([
        'ok' => true,
        'thread' => raidlands_airstrike_agent_attach_thread((int) ($payload['threadId'] ?? 0), (string) ($payload['profileKey'] ?? '')),
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
