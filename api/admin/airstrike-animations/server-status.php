<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('GET');

try {
    $bundle = raidlands_airstrike_animations_latest_bundle_row();
    raidlands_admin_api_response([
        'ok' => true,
        'published' => $bundle === null ? null : [
            'revision' => (int) $bundle['revision'],
            'sha256' => (string) $bundle['sha256'],
            'publishedAt' => $bundle['published_at'],
        ],
        'server' => raidlands_airstrike_animations_server_status(),
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
