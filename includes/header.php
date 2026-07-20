<?php

require_once __DIR__ . '/chat.php';
require_once __DIR__ . '/server-status.php';

$loader_payload = raidlands_loader_payload();
$linked_player = raidlands_linked_player();
$client_site_config = $site_config;
$client_site_config['wipe']['signal'] = ['key' => '', 'startedAt' => ''];

try {
    $initial_server_status = raidlands_server_status_public();
    $client_site_config['wipe']['signal'] = [
        'key' => (string) ($initial_server_status['wipeKey'] ?? ''),
        'startedAt' => (string) ($initial_server_status['wipeStartedAt'] ?? ''),
    ];
} catch (Throwable $error) {
    // The live status request below can hydrate the signal after page load.
}

$client_site_config['chat'] = raidlands_chat_client_config($linked_player, $base_path . 'api/chat/');
$config_json = json_encode($client_site_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$loader_json = json_encode($loader_payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
?>
<!doctype html>
<html lang="en" data-page="<?= e($page_id) ?>" data-base="<?= e($base_path) ?>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($seo['title']) ?></title>
    <meta name="description" content="<?= e($seo['description']) ?>">
    <meta name="theme-color" content="#0b0d0e">
    <meta name="msapplication-TileColor" content="#050607">
    <meta name="msapplication-TileImage" content="<?= e(asset_url('icons/mstile-150x150.png')) ?>">
    <meta name="msapplication-config" content="<?= e($base_path . 'browserconfig.xml') ?>">
    <meta property="og:title" content="<?= e($seo['ogTitle']) ?>">
    <meta property="og:description" content="<?= e($seo['ogDescription']) ?>">
    <meta property="og:type" content="website">
    <meta property="og:image" content="<?= e(asset_url('media/og-image.png')) ?>">
    <link rel="icon" href="<?= e(asset_url('icons/favicon.ico')) ?>" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-16x16.ico')) ?>" sizes="16x16" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-32x32.ico')) ?>" sizes="32x32" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-48x48.ico')) ?>" sizes="48x48" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-64x64.ico')) ?>" sizes="64x64" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-96x96.ico')) ?>" sizes="96x96" type="image/x-icon">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-128x128.png')) ?>" sizes="128x128" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-180x180.png')) ?>" sizes="180x180" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-192x192.png')) ?>" sizes="192x192" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-256x256.png')) ?>" sizes="256x256" type="image/png">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-512x512.png')) ?>" sizes="512x512" type="image/png">
    <link rel="apple-touch-icon" href="<?= e(asset_url('icons/apple-touch-icon.png')) ?>" sizes="180x180">
    <link rel="manifest" href="<?= e($base_path . 'site.webmanifest') ?>">
    <link rel="preload" as="image" href="<?= e(asset_url('media/loading/battlefield-background.webp')) ?>" fetchpriority="high">
    <link rel="preload" as="image" href="<?= e(asset_url('media/loading/breach-ring.webp')) ?>">
    <?php foreach ((array) ($loader_payload['explosionAssetUrls'] ?? []) as $explosion_asset_url) : ?>
      <link rel="preload" as="image" href="<?= e((string) $explosion_asset_url) ?>" media="(min-width: 701px)">
    <?php endforeach; ?>
    <?php foreach ((array) ($loader_payload['mobileExplosionAssetUrls'] ?? []) as $mobile_explosion_asset_url) : ?>
      <link rel="preload" as="image" href="<?= e((string) $mobile_explosion_asset_url) ?>" media="(max-width: 700px)">
    <?php endforeach; ?>
    <?php if ($page_id === 'home') : ?>
      <link rel="preload" as="image" href="<?= e(asset_url('media/website-hero-raid-overlook-v4.webp')) ?>" fetchpriority="high">
      <link rel="preload" as="image" href="<?= e(asset_url('media/raidlands-logo.webp')) ?>">
    <?php endif; ?>
    <link rel="preload" as="script" href="<?= e(asset_url('js/raidlands-loader.js')) ?>">
    <script>
      (function () {
        var storageKey = 'raidlands-loader-seen';
        var navigationType = 'navigate';
        var shouldShow = true;
        var sessionStorageReadable = false;
        var sessionStorageHadSeen = false;

        try {
          var entries = window.performance && window.performance.getEntriesByType
            ? window.performance.getEntriesByType('navigation')
            : [];

          if (entries && entries.length && entries[0].type) {
            navigationType = entries[0].type;
          } else if (window.performance && window.performance.navigation && window.performance.navigation.type === 1) {
            navigationType = 'reload';
          }
        } catch (error) {
          navigationType = 'navigate';
        }

        try {
          sessionStorageReadable = true;
          sessionStorageHadSeen = window.sessionStorage.getItem(storageKey) === 'true';
          shouldShow = navigationType === 'reload' || !sessionStorageHadSeen;
        } catch (error) {
          sessionStorageReadable = false;
          shouldShow = true;
        }

        window.__raidlandsLoaderSession = {
          storageKey: storageKey,
          navigationType: navigationType,
          shouldShow: shouldShow,
          sessionStorageReadable: sessionStorageReadable,
          sessionStorageHadSeen: sessionStorageHadSeen
        };

        if (!shouldShow) {
          document.documentElement.classList.add('raidlands-loader-skipped');
          return;
        }

        document.documentElement.classList.add('raidlands-loading');
        window.__raidlandsLoaderFallback = window.setTimeout(function () {
          document.documentElement.classList.remove('raidlands-loading');
        }, 9000);
      }());
    </script>
    <link rel="stylesheet" href="<?= e(asset_url('css/loader.css')) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
    <script type="application/json" id="raidlands-loader-data"><?= $loader_json ?></script>
    <script type="application/json" id="site-config"><?= $config_json ?></script>
    <script defer src="<?= e(asset_url('js/site.js')) ?>"></script>
  </head>
  <body>
    <?= render_raidlands_loader($loader_payload) ?>
    <script src="<?= e(asset_url('js/raidlands-loader.js')) ?>"></script>
    <div id="raidlands-app">
      <div class="app-shell page-<?= e($page_id) ?>">
        <header class="site-header">
          <div class="header-inner">
            <a class="brand" href="<?= e(route_url()) ?>" aria-label="Raidlands home">
              <img src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="Raidlands 1000x">
            </a>
            <nav class="nav-menu" id="site-menu" aria-label="Primary navigation">
              <?php foreach ($header_nav as $nav_item) : ?>
                <?php if ($nav_item[0] === 'link') : ?>
                  <?php
                    [, $id, $path, $label] = $nav_item;
                    $nav_active = $id === $page_id || ($id === 'store' && str_starts_with($page_id, 'store-'));
                  ?>
                  <a class="nav-link<?= $nav_active ? ' is-active' : '' ?>" href="<?= e(route_url($path)) ?>"<?= $nav_active ? ' aria-current="page"' : '' ?>><?= e($label) ?></a>
                <?php else : ?>
                  <?php
                    [, $group_id, $group_label, $group_links] = $nav_item;
                    $group_active = false;
                    foreach ($group_links as [$child_id]) {
                        $group_active = $group_active || $child_id === $page_id;
                    }
                  ?>
                  <details class="nav-dropdown<?= $group_active ? ' is-active' : '' ?>" data-nav-dropdown>
                    <summary class="nav-link" aria-label="Open <?= e($group_label) ?> menu">
                      <?= e($group_label) ?><span class="nav-chevron" aria-hidden="true"></span>
                    </summary>
                    <div class="nav-dropdown-panel">
                      <?php foreach ($group_links as [$child_id, $child_path, $child_label, $child_description]) : ?>
                        <a class="nav-dropdown-link<?= $child_id === $page_id ? ' is-active' : '' ?>" href="<?= e(route_url($child_path)) ?>"<?= $child_id === $page_id ? ' aria-current="page"' : '' ?>>
                          <strong><?= e($child_label) ?></strong>
                          <small><?= e($child_description) ?></small>
                        </a>
                      <?php endforeach; ?>
                    </div>
                  </details>
                <?php endif; ?>
              <?php endforeach; ?>
              <a class="nav-mobile-account" href="<?= e($linked_player !== null ? route_url('profile') : raidlands_account_url()) ?>">
                <?= e($linked_player !== null ? (trim((string) ($linked_player['display_name'] ?? '')) ?: 'Account') : 'Sign in with Steam') ?>
              </a>
            </nav>
            <div class="header-actions">
              <?php if ($linked_player !== null) : ?>
                <div class="account-menu">
                  <a class="account-menu-trigger" href="<?= e(route_url('profile')) ?>">
                    <?php if (trim((string) ($linked_player['steam_avatar_url'] ?? '')) !== '') : ?><img class="steam-avatar steam-avatar-sm" src="<?= e((string) $linked_player['steam_avatar_url']) ?>" alt="" referrerpolicy="no-referrer"><?php endif; ?>
                    <span><?= e(trim((string) ($linked_player['display_name'] ?? '')) ?: 'Account') ?></span>
                  </a>
                  <div class="account-menu-panel">
                    <a href="<?= e(route_url('profile')) ?>">Profile</a>
                    <a href="<?= e(route_url('discord')) ?>">Discord</a>
                    <form method="post" action="<?= e(route_url('link')) ?>"><input type="hidden" name="csrf" value="<?= e(raidlands_store_csrf_token()) ?>"><input type="hidden" name="action" value="unlink_steam"><button type="submit">Sign out</button></form>
                  </div>
                </div>
              <?php else : ?>
                <a class="btn btn-steam" href="<?= e(raidlands_account_url()) ?>">Sign in with Steam</a>
              <?php endif; ?>
              <a class="btn btn-primary" href="<?= e($site_config['steamConnectUrl']) ?>" data-track="join_server_clicked">
                Join Server
                <span class="btn-icon" aria-hidden="true"><?= action_icon('arrow') ?></span>
              </a>
            </div>
            <button class="mobile-toggle" type="button" aria-expanded="false" aria-controls="site-menu" data-menu-toggle>
              <span aria-hidden="true"></span>
              <span class="sr-only">Open menu</span>
            </button>
          </div>
        </header>
        <main id="main-content">
