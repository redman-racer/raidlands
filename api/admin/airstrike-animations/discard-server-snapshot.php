<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json();
raidlands_admin_api_require_csrf($payload);

try {
    raidlands_airstrike_animations_discard_snapshot((int) ($payload['snapshotId'] ?? 0));
    raidlands_admin_api_response(['ok' => true]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
