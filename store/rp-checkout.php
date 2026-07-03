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
        throw new RuntimeException('Your RP checkout session expired. Try again.');
    }

    $request = raidlands_store_create_rp_purchase_request(
        (int) ($_POST['price_id'] ?? 0),
        !empty($_POST['auto_renew'])
    );

    $message = (string) $request['product_name'] . ' was queued for '
        . raidlands_store_rp((int) $request['rp_cost'])
        . '. The game server will confirm and deduct RP before access is added.';

    if (!empty($request['auto_renew'])) {
        $message .= ' Auto-renew will stay on after the first confirmed purchase.';
    }

    raidlands_store_flash('success', $message);
    raidlands_store_redirect('profile');
} catch (Throwable $error) {
    raidlands_store_flash('error', $error->getMessage());
    raidlands_store_redirect('store');
}
