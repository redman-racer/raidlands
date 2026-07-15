<?php

$page_id = 'profile';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/podium.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    raidlands_store_redirect('profile');
}

try {
    if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
        throw new RuntimeException('Your podium settings session expired. Try again.');
    }
    $player = raidlands_store_current_player();
    if ($player === null || empty($player['id'])) throw new RuntimeException('Sign in with Steam to edit your podium appearance.');
    raidlands_podium_save_profile((int) $player['id'], $_POST);
    raidlands_store_flash('success', 'Your podium appearance is ready for the next leaderboard scene.');
} catch (Throwable $error) {
    raidlands_store_flash('error', $error->getMessage());
}

raidlands_store_redirect('profile');
