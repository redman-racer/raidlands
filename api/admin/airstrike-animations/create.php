<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json(RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_SOURCE_BYTES);
raidlands_admin_api_require_csrf($payload);

try {
    raidlands_admin_api_response([
        'ok' => true,
        'profile' => raidlands_airstrike_animations_create((array) ($payload['source'] ?? [])),
    ], 201);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
