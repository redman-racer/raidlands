<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/airstrike-animations.php';

$body = file_get_contents('php://input') ?: '';
raidlands_bridge_authorize($body);
header('Cache-Control: no-store');

try {
    if (strlen($body) > 262144) {
        throw new InvalidArgumentException('Sync result body is too large.');
    }

    $payload = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('Sync result body must be a JSON object.');
    }

    raidlands_store_json_response(raidlands_airstrike_animations_record_sync_result($payload));
} catch (JsonException | InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
