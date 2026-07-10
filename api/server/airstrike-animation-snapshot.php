<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/airstrike-animations.php';

$maximum_bytes = RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES + 1048576;
$content_length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

if ($content_length > $maximum_bytes) {
    raidlands_store_json_response(['ok' => false, 'error' => 'Snapshot body is too large.'], 413);
}

$body = file_get_contents('php://input', false, null, 0, $maximum_bytes + 1) ?: '';
raidlands_bridge_authorize($body);
header('Cache-Control: no-store');

try {
    if (strlen($body) > $maximum_bytes) {
        raidlands_store_json_response(['ok' => false, 'error' => 'Snapshot body is too large.'], 413);
    }

    $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('Snapshot body must be a JSON object.');
    }

    raidlands_store_json_response(raidlands_airstrike_animations_ingest_snapshot($payload), 201);
} catch (JsonException | InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
