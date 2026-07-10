<?php

$page_id = 'home';
$base_path = './';

require __DIR__ . '/includes/bootstrap.php';
require $site_root . '/includes/features.php';
require $site_root . '/includes/server-status.php';
require $site_root . '/includes/stats.php';
require $site_root . '/includes/rewards.php';

$home_feature_state = raidlands_features_home_preview_state();
$home_leaderboard_state = raidlands_stats_home_preview_state();
$home_rp_games_state = raidlands_rewards_home_preview_state();

try {
    $home_server_status = raidlands_server_status_public();
} catch (Throwable $error) {
    $home_server_status = [
        'online' => null,
        'statusLabel' => 'Status Pending',
        'players' => (int) ($site_config['playersOnline'] ?? 0),
        'maxPlayers' => (int) ($site_config['maxPlayers'] ?? 0),
        'queue' => (int) ($site_config['queue'] ?? 0),
        'mapName' => (string) ($site_config['mapName'] ?? 'Unknown'),
        'mapImageUrl' => '',
        'mapImage' => null,
        'sourceLabel' => 'site fallback',
    ];
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/home.php';
require $site_root . '/includes/footer.php';
