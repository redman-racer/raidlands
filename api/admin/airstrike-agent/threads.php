<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-agent.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
raidlands_admin_api_require($method === 'POST' ? 'POST' : 'GET');

try {
    if ($method === 'POST') {
        $payload = raidlands_admin_api_read_json();
        raidlands_admin_api_require_csrf($payload);
        raidlands_admin_api_response([
            'ok' => true,
            'thread' => raidlands_airstrike_agent_create_thread(
                (string) ($payload['profileKey'] ?? ''),
                (string) ($payload['mode'] ?? 'plan'),
                (string) ($payload['title'] ?? '')
            ),
        ], 201);
    }
    raidlands_admin_api_response([
        'ok' => true,
        'ready' => raidlands_airstrike_agent_schema_ready(),
        'configured' => raidlands_airstrike_agent_is_configured(),
        'threads' => raidlands_airstrike_agent_schema_ready()
            ? raidlands_airstrike_agent_list_threads((string) ($_GET['profile'] ?? ''), !empty($_GET['include_archived']))
            : [],
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
