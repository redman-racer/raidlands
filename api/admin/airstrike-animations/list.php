<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';

raidlands_admin_api_require('GET');

try {
    $state = raidlands_airstrike_animations_list(!empty($_GET['include_archived']));
    raidlands_admin_api_response(array_merge(['ok' => true], $state));
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
