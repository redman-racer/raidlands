<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json();
raidlands_admin_api_require_csrf($payload);

try {
    $result = raidlands_airstrike_animations_publish((string) ($payload['notes'] ?? ''));
    $result['syncRequested'] = !empty($payload['sync']);
    raidlands_admin_api_response(['ok' => true, 'publication' => $result], 201);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
