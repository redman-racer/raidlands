<?php

$loader_payload = raidlands_loader_payload();
$config_json = json_encode($site_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$loader_json = json_encode($loader_payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
$linked_player = raidlands_linked_player();
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
      <link rel="preload" as="image" href="<?= e((string) $explosion_asset_url) ?>">
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
          shouldShow = navigationType === 'reload' || window.sessionStorage.getItem(storageKey) !== 'true';
        } catch (error) {
          shouldShow = true;
        }

        window.__raidlandsLoaderSession = {
          storageKey: storageKey,
          navigationType: navigationType,
          shouldShow: shouldShow
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
              <?php foreach ($primary_nav as [$id, $path, $label]) : ?>
                <?php
                  if ($id === 'profile') {
                      continue;
                  }

                  $nav_path = $path;
                  $nav_label = $label;
                  $nav_active = $id === $page_id;

                  if ($id === 'link') {
                      $nav_path = $linked_player !== null ? 'profile' : 'link';
                      $nav_label = $linked_player !== null ? 'Account' : 'Link Account';
                      $nav_active = in_array($page_id, ['link', 'profile'], true);
                  }
                ?>
                <a class="nav-link<?= $nav_active ? ' is-active' : '' ?>" href="<?= e(route_url($nav_path)) ?>"><?= e($nav_label) ?></a>
              <?php endforeach; ?>
            </nav>
            <div class="header-actions">
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
