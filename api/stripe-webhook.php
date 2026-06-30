<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

$payload = (string) file_get_contents('php://input');
$signature = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');

try {
    $result = raidlands_store_handle_stripe_webhook($payload, $signature);
    raidlands_store_json_response($result);
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => $error->getMessage(),
    ], 400);
}
