<?php

$page_id = 'link';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';

raidlands_store_boot();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your link form expired. Try again.');
        }

        $action = (string) ($_POST['action'] ?? 'link_steam');

        if ($action === 'unlink_steam') {
            raidlands_store_unlink_player();
            raidlands_store_flash('success', 'Steam identity unlinked from this browser session.');
        } else {
            raidlands_store_link_player(
                (string) ($_POST['steam_id64'] ?? ''),
                (string) ($_POST['display_name'] ?? '')
            );
            raidlands_store_flash('success', 'SteamID64 linked for store checkout and profile lookup.');
        }
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    raidlands_store_redirect('link');
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/link.php';
require $site_root . '/includes/footer.php';
