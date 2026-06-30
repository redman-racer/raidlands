<?php

$page_id = 'profile';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

raidlands_store_boot();

require $site_root . '/includes/header.php';
require $site_root . '/pages/profile.php';
require $site_root . '/includes/footer.php';
