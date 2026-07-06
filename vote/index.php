<?php

$page_id = 'vote';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/rewards.php';

raidlands_rewards_handle_vote_request();

$vote_flash = raidlands_store_flash();
$vote_csrf = raidlands_store_csrf_token();
$vote_state = raidlands_rewards_public_vote_state();

require $site_root . '/includes/header.php';
require $site_root . '/pages/vote.php';
require $site_root . '/includes/footer.php';
