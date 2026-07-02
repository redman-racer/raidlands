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

    $csrf = (string) ($payload['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if (!raidlands_store_validate_csrf($csrf)) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Invalid request token.'], 403);
    }

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['steam_id64'])) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Link your Steam account before managing a clan.'], 401);
    }

    $result = raidlands_clans_queue_action($payload, $player);

    raidlands_store_json_response([
        'ok' => true,
        'action' => $result,
    ]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
