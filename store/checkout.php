<?php

$page_id = 'store';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    raidlands_store_redirect('store');
}

try {
    if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        throw new RuntimeException('Your checkout session expired. Try again.');
    }

    $checkout_url = raidlands_store_checkout_for_price((int) ($_POST['price_id'] ?? 0));
    header('Location: ' . $checkout_url, true, 303);
    exit;
} catch (Throwable $error) {
    raidlands_store_flash('error', $error->getMessage());
    raidlands_store_redirect('store');
}
