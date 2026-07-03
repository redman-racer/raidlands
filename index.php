<?php

$page_id = 'home';
$base_path = './';

require __DIR__ . '/includes/bootstrap.php';
require $site_root . '/includes/features.php';

$home_feature_state = raidlands_features_home_preview_state();

require $site_root . '/includes/header.php';
require $site_root . '/pages/home.php';
require $site_root . '/includes/footer.php';
