<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/kits.php';

$body = '';
raidlands_bridge_authorize($body);

try {
    $since = (int) ($_GET['since'] ?? 0);
    $sync = raidlands_kits_pending_sync($since);

    raidlands_store_json_response(array_merge(['ok' => true], $sync));
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
