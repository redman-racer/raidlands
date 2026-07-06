<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/rewards.php';

try {
    $site = (string) ($_GET['site'] ?? '');
    $token = (string) ($_GET['token'] ?? '');
    $payload = raidlands_rewards_callback_payload();
    $result = raidlands_rewards_handle_vote_callback($site, $token, $payload);

    raidlands_store_json_response(['ok' => true] + $result);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
}
