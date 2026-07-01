<?php

// Legacy fallback only. New installs should copy the root .env.example file to
// .env and configure all credentials there.

$database_config = [
    'dsn' => 'mysql:host=localhost;dbname=raiduonz_website',
    'username' => 'raiduonz_user',
    'password' => 'change-this-password',
    'options' => [],
];

$stripe_config = [
    'publishableKey' => 'pk_test_replace_me',
    'secretKey' => 'sk_test_replace_me',
    'webhookSecret' => 'whsec_replace_me',
];

$steam_api_config['apiKey'] = 'steam_web_api_key_replace_me';

$vip_bridge_config['serverId'] = 'raidlands-main';
$vip_bridge_config['sharedSecret'] = 'replace-with-a-long-random-secret';
