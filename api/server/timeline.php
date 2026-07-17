<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/server-timeline.php';

try {
    raidlands_store_json_response(raidlands_server_timeline_public($_GET));
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage(), 'streams' => []], 422);
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Recorded server timeline could not be loaded.',
        'streams' => [],
    ], 500);
}
