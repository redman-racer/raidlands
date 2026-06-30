<?php

$page_id = 'store';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

raidlands_store_boot();

require $site_root . '/includes/header.php';
require $site_root . '/pages/store.php';
require $site_root . '/includes/footer.php';
