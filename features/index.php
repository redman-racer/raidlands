<?php

$page_id = 'features';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require $site_root . '/includes/features.php';

raidlands_features_handle_public_request();

$feature_flash = raidlands_features_flash();
$feature_old = is_array($feature_flash['old'] ?? null) ? $feature_flash['old'] : [];
$feature_csrf = raidlands_store_csrf_token();
$feature_state = raidlands_features_public_state();

require $site_root . '/includes/header.php';
require $site_root . '/pages/features.php';
require $site_root . '/includes/footer.php';
