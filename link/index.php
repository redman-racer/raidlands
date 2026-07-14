<?php

$page_id = 'link';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

raidlands_store_boot();

if ($_SERVER['REQUEST_METHOD'] === 'GET' && (string) ($_GET['action'] ?? '') === 'steam') {
    try {
        $return_path = strtolower(trim((string) ($_GET['return'] ?? ''), '/'));
        $allowed_returns = ['', 'link', 'discord', 'profile', 'store', 'features', 'vote', 'rp-games', 'clans', 'support'];
        $_SESSION['raidlands_steam_return'] = in_array($return_path, $allowed_returns, true) ? $return_path : 'link';
        header('Location: ' . raidlands_store_steam_openid_url());
        exit;
    } catch (Throwable $error) {
        raidlands_store_flash('error', 'Steam sign-in could not start. Try again in a moment.');
        raidlands_store_redirect('link');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && raidlands_store_steam_openid_response_present()) {
    $return_path = (string) ($_SESSION['raidlands_steam_return'] ?? 'link');
    unset($_SESSION['raidlands_steam_return']);
    try {
        raidlands_store_steam_openid_verify();
        raidlands_store_flash('success', 'Steam account connected through Steam.');
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    raidlands_store_redirect($return_path !== '' ? $return_path : 'link');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your link form expired. Try again.');
        }

        $action = (string) ($_POST['action'] ?? '');

        if ($action === 'unlink_steam') {
            raidlands_store_unlink_player();
            raidlands_store_flash('success', 'Steam account removed from this browser.');
        } else {
            throw new RuntimeException('Steam accounts must be connected through Steam sign-in.');
        }
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    raidlands_store_redirect('link');
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/link.php';
require $site_root . '/includes/footer.php';
