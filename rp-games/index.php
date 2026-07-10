<?php

$page_id = 'rp-games';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/rewards.php';

raidlands_rewards_handle_games_request();

$rp_games_flash = raidlands_store_flash();
$rp_games_csrf = raidlands_store_csrf_token();
$rp_games_state = raidlands_rewards_public_games_state();
$monument_state = raidlands_monument_bootstrap_state();
$monument_api_url = $base_path . 'api/monument-extraction.php';

require $site_root . '/includes/header.php';
require $site_root . '/pages/rp-games.php';
require $site_root . '/includes/footer.php';
