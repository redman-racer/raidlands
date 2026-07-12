<?php

$page_id = 'store-kit';
$base_path = '../../';

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/kits.php';
require_once $site_root . '/includes/permissions.php';

raidlands_store_boot();

$kit_slug = trim((string) ($_GET['kit'] ?? $_GET['slug'] ?? ''));

if ($kit_slug === '' && !empty($_SERVER['PATH_INFO'])) {
    $kit_slug = trim((string) $_SERVER['PATH_INFO'], '/');
}

if ($kit_slug === '') {
    header('Location: ' . route_url('store'), true, 302);
    exit;
}

$store_kit_context = raidlands_store_kit_focus_context($kit_slug);

if ($store_kit_context === null) {
    http_response_code(404);
    $page_copy['store-kit'] = [
        'title' => 'Kit Not Found',
        'lede' => 'That Raidlands store kit could not be found.',
    ];
    $seo = [
        'title' => 'Kit Not Found | Raidlands Store',
        'description' => 'That Raidlands store kit could not be found.',
        'ogTitle' => 'Kit Not Found',
        'ogDescription' => 'That Raidlands store kit could not be found.',
    ];
} else {
    $kit = (array) $store_kit_context['kit'];
    $kit_name = (string) ($kit['kit_name'] ?? 'Raidlands kit');
    $kit_description = trim((string) ($kit['description'] ?? ''));
    $seo_description = $kit_description !== ''
        ? (function_exists('mb_substr') ? mb_substr($kit_description, 0, 155) : substr($kit_description, 0, 155))
        : $kit_name . ' contents, cooldowns, uses, and store products on Raidlands.';
    $page_copy['store-kit'] = [
        'title' => $kit_name,
        'lede' => $kit_description !== '' ? $kit_description : 'Kit contents, cooldowns, uses, and matching store offers.',
    ];
    $seo = [
        'title' => $kit_name . ' | Raidlands Store Kit',
        'description' => $seo_description,
        'ogTitle' => $kit_name . ' Kit',
        'ogDescription' => $seo_description,
    ];
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/store-kit.php';
require $site_root . '/includes/footer.php';
