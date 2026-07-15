<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/podium.php';

header('Cache-Control: no-store');

try {
    $player = raidlands_store_current_player();
    if ($player === null || empty($player['id'])) raidlands_store_json_response(['ok' => false, 'error' => 'Sign in with Steam to manage podium appearance.'], 401);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $payload = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($payload)) throw new InvalidArgumentException('Invalid JSON body.');
        if (!raidlands_store_validate_csrf((string) ($payload['csrf'] ?? ''))) raidlands_store_json_response(['ok' => false, 'error' => 'Your podium settings session expired.'], 403);
        raidlands_podium_save_profile((int) $player['id'], $payload);
    } elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        raidlands_store_json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }
    raidlands_store_json_response(['ok' => true, 'appearance' => raidlands_podium_profile_bundle((int) $player['id'], (string) $player['steam_id64'])]);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
