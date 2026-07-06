<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/animation-diagnostics.php';

header('Cache-Control: no-store');

raidlands_animation_diagnostics_handle_request();
