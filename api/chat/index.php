<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/chat.php';
require_once $site_root . '/includes/admin.php';

raidlands_chat_handle_api_request();
