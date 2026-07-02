<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/clans.php';

raidlands_store_boot();

try {
    $body = (string) file_get_contents('php://input');
    $payload = json_decode($body, true);

    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $auth = raidlands_clans_authenticate_action_request($payload);
    $player = $auth['player'];

    $result = raidlands_clans_queue_action($payload, $player);

    raidlands_store_json_response([
        'ok' => true,
        'action' => $result,
        'auth_type' => $auth['auth_type'],
    ]);
} catch (InvalidArgumentException $error) {
    $status = str_contains($error->getMessage(), 'request token') ? 403 : 422;
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], $status);
} catch (Throwable $error) {
    $message = $error->getMessage();
    $status = 422;

    if (str_contains($message, 'Rate limit exceeded')) {
        $status = 429;
    } elseif (str_contains($message, 'API key') || str_contains($message, 'Link your Steam') || str_contains($message, 'linked Steam')) {
        $status = 401;
    }

    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], $status);
}
