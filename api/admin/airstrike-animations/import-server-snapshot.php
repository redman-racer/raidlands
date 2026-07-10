<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json();
raidlands_admin_api_require_csrf($payload);

try {
    raidlands_admin_api_response([
        'ok' => true,
        'result' => raidlands_airstrike_animations_import_snapshot(
            (int) ($payload['snapshotId'] ?? 0),
            (array) ($payload['profileKeys'] ?? [])
        ),
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
