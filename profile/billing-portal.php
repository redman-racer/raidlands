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
        throw new RuntimeException('Your billing session expired. Try again.');
    }

    $portal_url = raidlands_store_create_billing_portal_session();
    header('Location: ' . $portal_url, true, 303);
    exit;
} catch (Throwable $error) {
    raidlands_store_flash('error', $error->getMessage());
    raidlands_store_redirect('profile');
}
