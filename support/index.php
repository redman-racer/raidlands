<?php

$page_id = 'support';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require $site_root . '/includes/feedback.php';

raidlands_feedback_handle_public_request();

$feedback_flash = raidlands_feedback_flash();
$feedback_csrf = raidlands_store_csrf_token();
$feedback_old = is_array($feedback_flash['old'] ?? null) ? $feedback_flash['old'] : [];
$feedback_ready = raidlands_feedback_is_ready();
$feedback_readiness_message = $feedback_ready ? '' : raidlands_feedback_readiness_message(false);

require $site_root . '/includes/header.php';
require $site_root . '/pages/support.php';
require $site_root . '/includes/footer.php';
