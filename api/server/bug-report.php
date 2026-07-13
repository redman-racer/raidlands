<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/feedback.php';

$body = (string) file_get_contents('php://input');
raidlands_bridge_authorize($body);

try {
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
    }

    $public_id = raidlands_feedback_create_from_server_bug_report(
        $payload,
        (string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? '')
    );

    raidlands_store_json_response([
        'ok' => true,
        'feedback' => [
            'public_id' => $public_id,
            'status' => 'open',
            'type' => 'bug',
        ],
    ]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
