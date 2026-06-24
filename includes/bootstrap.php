<?php

$site_root = dirname(__DIR__);
$page_id = $page_id ?? 'home';
$base_path = $base_path ?? './';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

$seo = $seo_pages[$page_id] ?? $seo_pages['home'];
