<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';
require_once $site_root . '/includes/airstrike-animation-compiler.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json(2097152);
raidlands_admin_api_require_csrf($payload);
$source = (array) ($payload['source'] ?? []);
$path = 'Profiles.' . (string) ($source['ProfileKey'] ?? 'profile');
raidlands_admin_api_response([
    'ok' => true,
    'validation' => raidlands_airstrike_animation_validate_profile(
        $source,
        $path,
        raidlands_airstrike_animations_vehicle_metadata()
    ),
]);
