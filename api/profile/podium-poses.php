<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/admin.php';
require_once $site_root . '/includes/podium.php';

header('Cache-Control: no-store');

try {
    $player = raidlands_store_current_player();
    if ($player === null || empty($player['id'])) raidlands_store_json_response(['ok' => false, 'error' => 'Sign in with Steam to manage poses.'], 401);
    if (!raidlands_admin_can('admin.access')) raidlands_store_json_response(['ok' => false, 'error' => 'Admin access is required to create poses.'], 403);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') raidlands_store_json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) throw new InvalidArgumentException('Invalid JSON body.');
    if (!raidlands_store_validate_csrf((string) ($payload['csrf'] ?? ''))) raidlands_store_json_response(['ok' => false, 'error' => 'Your pose editor session expired.'], 403);
    $pose = raidlands_podium_save_pose_preset((string) ($payload['label'] ?? ''), $payload['bones'] ?? [], (string) ($player['steam_id64'] ?? ''));
    raidlands_admin_audit('podium_pose_created', 'podium_pose', (string) $pose['key'], ['label' => $pose['label']]);
    raidlands_store_json_response(['ok' => true, 'pose' => $pose]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
