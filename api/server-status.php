<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/server-status.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=15');

echo json_encode(raidlands_server_status_public(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
