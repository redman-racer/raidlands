<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/server-status.php';

$minutes = isset($_GET['minutes']) ? (int) $_GET['minutes'] : null;
$range = isset($_GET['range']) ? (string) $_GET['range'] : '';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=30');

echo json_encode(raidlands_server_status_history_public($minutes, $range), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
