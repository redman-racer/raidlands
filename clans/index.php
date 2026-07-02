<?php

$page_id = 'clans';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/clans.php';

raidlands_store_boot();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!raidlands_store_validate_csrf((string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Your clan form expired. Try again.');
        }

        $player = raidlands_store_current_player();

        if ($player === null || empty($player['steam_id64'])) {
            throw new RuntimeException('Connect Steam before managing clans.');
        }

        $form_action = (string) ($_POST['form_action'] ?? '');

        if ($form_action === 'create_api_key') {
            $created = raidlands_clans_create_api_key($player, (string) ($_POST['label'] ?? ''));
            $_SESSION['raidlands_new_clan_api_key'] = $created;
            raidlands_store_flash('success', 'Clan API key created. Copy it now; it will not be shown again.');
        } elseif ($form_action === 'revoke_api_key') {
            raidlands_clans_revoke_api_key($player, (int) ($_POST['key_id'] ?? 0));
            raidlands_store_flash('success', 'Clan API key revoked.');
        } elseif ($form_action === 'queue_clan_action') {
            $result = raidlands_clans_queue_action($_POST, $player);
            raidlands_store_flash('success', 'Clan action queued: ' . (string) $result['action'] . '.');
        } else {
            throw new RuntimeException('Unsupported clan form action.');
        }
    } catch (Throwable $error) {
        raidlands_store_flash('error', $error->getMessage());
    }

    header('Location: ' . route_url('clans'), true, 303);
    exit;
}

require $site_root . '/includes/header.php';
require $site_root . '/pages/clans.php';
require $site_root . '/includes/footer.php';
