<?php

$config_json = json_encode($site_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?>
<!doctype html>
<html lang="en" data-page="<?= e($page_id) ?>" data-base="<?= e($base_path) ?>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($seo['title']) ?></title>
    <meta name="description" content="<?= e($seo['description']) ?>">
    <meta name="theme-color" content="#0b0d0e">
    <meta property="og:title" content="<?= e($seo['ogTitle']) ?>">
    <meta property="og:description" content="<?= e($seo['ogDescription']) ?>">
    <meta property="og:type" content="website">
    <meta property="og:image" content="<?= e(asset_url('media/og-image.png')) ?>">
    <link rel="icon" href="<?= e(asset_url('icons/favicon.ico')) ?>">
    <link rel="apple-touch-icon" href="<?= e(asset_url('icons/apple-touch-icon.png')) ?>">
    <link rel="manifest" href="<?= e($base_path . 'site.webmanifest') ?>">
    <?php if ($page_id === 'home') : ?>
      <link rel="preload" as="image" href="<?= e(asset_url('media/website-hero-raid-overlook-v4.webp')) ?>" fetchpriority="high">
      <link rel="preload" as="image" href="<?= e(asset_url('media/raidlands-logo.webp')) ?>">
    <?php endif; ?>
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
    <script type="application/json" id="site-config"><?= $config_json ?></script>
    <script defer src="<?= e(asset_url('js/site.js')) ?>"></script>
  </head>
  <body>
    <div id="raidlands-app">
      <div class="app-shell page-<?= e($page_id) ?>">
        <header class="site-header">
          <div class="header-inner">
            <a class="brand" href="<?= e(route_url()) ?>" aria-label="Raidlands home">
              <img src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="Raidlands 1000x">
            </a>
            <nav class="nav-menu" id="site-menu" aria-label="Primary navigation">
              <?php foreach ($primary_nav as [$id, $path, $label]) : ?>
                <a class="nav-link<?= $id === $page_id ? ' is-active' : '' ?>" href="<?= e(route_url($path)) ?>"><?= e($label) ?></a>
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
