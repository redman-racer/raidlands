<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-agent.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
raidlands_admin_api_require($method === 'POST' || $method === 'DELETE' ? $method : 'GET');

try {
    $thread_id = (int) ($_GET['id'] ?? 0);
    if ($method === 'DELETE') {
        $payload = raidlands_admin_api_read_json();
        raidlands_admin_api_require_csrf($payload);
        raidlands_airstrike_agent_delete_thread($thread_id);
        raidlands_admin_api_response(['ok' => true]);
    }
    if ($method === 'POST') {
        $payload = raidlands_admin_api_read_json();
        raidlands_admin_api_require_csrf($payload);
        $thread_id = (int) ($payload['threadId'] ?? $thread_id);
        raidlands_admin_api_response(['ok' => true, 'thread' => raidlands_airstrike_agent_update_thread($thread_id, $payload)]);
    }
    $row = raidlands_airstrike_agent_get_thread($thread_id);
    raidlands_admin_api_response([
        'ok' => true,
        'thread' => raidlands_airstrike_agent_thread_payload($row),
        'items' => raidlands_airstrike_agent_items($thread_id),
        'proposal' => raidlands_airstrike_agent_latest_proposal($thread_id),
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
