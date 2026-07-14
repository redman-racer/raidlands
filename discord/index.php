<?php

$page_id = 'discord';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/discord.php';

raidlands_store_boot();

if ($_SERVER['REQUEST_METHOD'] === 'GET' && (string) ($_GET['action'] ?? '') === 'connect') {
    try {
        header('Location: ' . raidlands_discord_oauth_url('discord'));
        exit;
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
        raidlands_store_redirect('discord');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['discord_callback'])) {
    try {
        raidlands_discord_handle_callback();
        raidlands_store_flash('success', 'Discord connected and Raidlands roles synchronized.');
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }
    raidlands_store_redirect('discord');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) throw new RuntimeException('Your form expired. Try again.');
        $player = raidlands_store_current_player();
        if ($player === null) throw new RuntimeException('Sign in with Steam first.');
        $action = (string) ($_POST['action'] ?? '');
        if ($action === 'unlink_discord') {
            raidlands_discord_unlink((int) $player['id']);
            raidlands_store_flash('success', 'Discord disconnected. Raidlands-managed roles were removed.');
        } elseif ($action === 'sync_discord') {
            raidlands_discord_reconcile_player((int) $player['id'], 'player');
            raidlands_store_flash('success', 'Discord roles synchronized.');
        } else {
            throw new RuntimeException('Unknown Discord account action.');
        }
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }
    raidlands_store_redirect('discord');
}
require $site_root . '/includes/header.php';
require $site_root . '/pages/discord.php';
require $site_root . '/includes/footer.php';
