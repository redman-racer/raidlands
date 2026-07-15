<?php

$page_id = 'store-item';
$base_path = '../../../';

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/kits.php';
require_once $site_root . '/includes/permissions.php';

raidlands_store_boot();

$item_slug = trim((string) ($_GET['item'] ?? $_GET['slug'] ?? ''));

if ($item_slug === '' && !empty($_SERVER['PATH_INFO'])) {
    $item_slug = trim((string) $_SERVER['PATH_INFO'], '/');
}

if ($item_slug === '') {
    header('Location: ' . route_url('store'), true, 302);
    exit;
}

$store_item_context = raidlands_store_product_focus_context($item_slug);

if ($store_item_context === null) {
    http_response_code(404);
    $page_copy['store-item'] = [
        'title' => 'Store Item Not Found',
        'lede' => 'That Raidlands store item could not be found.',
    ];
    $seo = [
        'title' => 'Store Item Not Found | Raidlands Store',
        'description' => 'That Raidlands store item could not be found.',
        'ogTitle' => 'Store Item Not Found',
        'ogDescription' => 'That Raidlands store item could not be found.',
    ];
} else {
    $product = (array) $store_item_context['product'];
    $product_name = (string) ($product['name'] ?? 'Raidlands store item');
    $description = trim((string) ($product['description'] ?: $product['short_description'] ?? ''));
    $seo_description = $description !== ''
        ? (function_exists('mb_substr') ? mb_substr($description, 0, 155) : substr($description, 0, 155))
        : $product_name . ' details, included kits, perks, and purchase options on Raidlands.';
    $page_copy['store-item'] = [
        'title' => $product_name,
        'lede' => $description !== '' ? $description : 'Store item details, included access, and purchase options.',
    ];
    $seo = [
        'title' => $product_name . ' | Raidlands Store',
        'description' => $seo_description,
        'ogTitle' => $product_name,
        'ogDescription' => $seo_description,
    ];
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/store-item.php';
require $site_root . '/includes/footer.php';
