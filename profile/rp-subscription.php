<?php

$page_id = 'profile';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    raidlands_store_redirect('profile');
}

try {
    if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        throw new RuntimeException('Your renewal session expired. Try again.');
    }

    raidlands_store_cancel_rp_subscription((int) ($_POST['subscription_id'] ?? 0));
    raidlands_store_flash('success', 'Auto-renew was canceled. Your current access will remain until its scheduled end.');
} catch (Throwable $error) {
    raidlands_store_flash('error', $error->getMessage());
}

raidlands_store_redirect('profile');
