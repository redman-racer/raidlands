<?php

require_once __DIR__ . '/animation-diagnostics.php';
require_once __DIR__ . '/chat.php';

$loader_payload = raidlands_loader_payload();
$linked_player = raidlands_linked_player();
$client_site_config = $site_config;
$client_site_config['animationDiagnostics'] = raidlands_animation_diagnostics_client_config($linked_player, $base_path . 'api/animation-diagnostics.php');
$client_site_config['chat'] = raidlands_chat_client_config($linked_player, $base_path . 'api/chat/');
$config_json = json_encode($client_site_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$loader_json = json_encode($loader_payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
$animation_diagnostics_json = json_encode($client_site_config['animationDiagnostics'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
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
      window.__raidlandsAnimationDiagnostics = <?= $animation_diagnostics_json ?: '{}' ?>;
      (function () {
        var diagnostics = window.__raidlandsAnimationDiagnostics || {};
        diagnostics.queue = diagnostics.queue || [];
        window.__raidlandsAnimationDiagnostics = diagnostics;
        var diagnosticFlushTimer = 0;
        var diagnosticInFlight = false;

        function flushDiagnostics(useBeacon) {
          if (!diagnostics.enabled || !diagnostics.endpointUrl || !diagnostics.queue.length || diagnosticInFlight) {
            return;
          }

          var maxEvents = Math.max(1, Number(diagnostics.maxEvents) || 24);
          var events = diagnostics.queue.splice(0, maxEvents);
          var body = JSON.stringify({
            csrf: diagnostics.csrfToken || '',
            events: events
          });

          if (useBeacon && navigator.sendBeacon) {
            var blob = new Blob([body], { type: 'application/json' });

            if (navigator.sendBeacon(diagnostics.endpointUrl, blob)) {
              return;
            }
          }

          if (!window.fetch) {
            diagnostics.queue.unshift.apply(diagnostics.queue, events);
            return;
          }

          diagnosticInFlight = true;
          window.fetch(diagnostics.endpointUrl, {
            method: 'POST',
            credentials: 'same-origin',
            keepalive: Boolean(useBeacon),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-Requested-With': 'fetch',
              'X-Raidlands-CSRF': diagnostics.csrfToken || ''
            },
            body: body
          }).then(function (response) {
            if (!response.ok) {
              throw new Error('Animation diagnostics failed with HTTP ' + response.status);
            }
          }).catch(function () {
            diagnostics.queue.unshift.apply(diagnostics.queue, events);

            if (diagnostics.queue.length > maxEvents) {
              diagnostics.queue.splice(maxEvents);
            }
          }).finally(function () {
            diagnosticInFlight = false;
          });
        }

        diagnostics.flush = flushDiagnostics;

        window.__raidlandsRecordAnimationDiagnostic = function (eventType, details) {
          if (!diagnostics.enabled) {
            return;
          }

          var root = document.documentElement;
          var viewport = {
            width: window.innerWidth || 0,
            height: window.innerHeight || 0,
            devicePixelRatio: window.devicePixelRatio || 1,
            screenWidth: window.screen ? window.screen.width : 0,
            screenHeight: window.screen ? window.screen.height : 0
          };
          var capabilities = {
            matchMedia: typeof window.matchMedia === 'function',
            reducedMotion: false,
            mobilePerformance: false,
            localStorage: false,
            sessionStorage: false
          };

          try {
            capabilities.reducedMotion = capabilities.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            capabilities.mobilePerformance = capabilities.matchMedia && window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
          } catch (error) {
            capabilities.matchMedia = false;
          }

          try {
            window.localStorage.setItem('raidlands-diagnostic-test', '1');
            window.localStorage.removeItem('raidlands-diagnostic-test');
            capabilities.localStorage = true;
          } catch (error) {
            capabilities.localStorage = false;
          }

          try {
            window.sessionStorage.setItem('raidlands-diagnostic-test', '1');
            window.sessionStorage.removeItem('raidlands-diagnostic-test');
            capabilities.sessionStorage = true;
          } catch (error) {
            capabilities.sessionStorage = false;
          }

          diagnostics.queue.push({
            eventType: String(eventType || ''),
            at: new Date().toISOString(),
            page: {
              id: root.dataset.page || '',
              url: window.location.href,
              referrer: document.referrer || ''
            },
            viewport: viewport,
            capabilities: capabilities,
            loader: window.__raidlandsLoaderSession || {},
            details: details || {}
          });

          if (diagnostics.queue.length > (diagnostics.maxEvents || 24)) {
            diagnostics.queue.splice(0, diagnostics.queue.length - (diagnostics.maxEvents || 24));
          }

          window.clearTimeout(diagnosticFlushTimer);
          diagnosticFlushTimer = window.setTimeout(function () {
            flushDiagnostics(false);
          }, 450);
        };

        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') {
            flushDiagnostics(true);
          }
        });
      }());

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

        if (window.__raidlandsRecordAnimationDiagnostic) {
          window.__raidlandsRecordAnimationDiagnostic('loader_decision', {
            storageKey: storageKey,
            navigationType: navigationType,
            shouldShow: shouldShow,
            sessionStorageReadable: sessionStorageReadable,
            sessionStorageHadSeen: sessionStorageHadSeen,
            rootClassName: document.documentElement.className
          });
        }

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
