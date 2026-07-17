<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-timeline.php';

function raidlands_server_timeline_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    raidlands_server_timeline_json_response(raidlands_server_timeline_public($_GET));
} catch (InvalidArgumentException $error) {
    raidlands_server_timeline_json_response(['ok' => false, 'error' => $error->getMessage(), 'streams' => []], 422);
} catch (Throwable $error) {
    raidlands_server_timeline_json_response([
        'ok' => false,
        'error' => 'Recorded server timeline could not be loaded.',
        'streams' => [],
    ], 500);
}
