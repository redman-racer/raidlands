<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('GET');

try {
    raidlands_admin_api_response([
        'ok' => true,
        'revisions' => raidlands_airstrike_animations_revisions((string) ($_GET['profile'] ?? '')),
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
