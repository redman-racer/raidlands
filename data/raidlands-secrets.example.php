<?php

$database_config = [
    'dsn' => 'mysql:host=127.0.0.1;dbname=raidlands;charset=utf8mb4',
    'username' => 'raidlands_user',
    'password' => 'change-this-password',
    'options' => [],
];

$stripe_config = [
    'publishableKey' => 'pk_test_replace_me',
    'secretKey' => 'sk_test_replace_me',
    'webhookSecret' => 'whsec_replace_me',
];

$vip_bridge_config['serverId'] = 'raidlands-main';
$vip_bridge_config['sharedSecret'] = 'replace-with-a-long-random-secret';
