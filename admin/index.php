<?php

$page_id = 'admin';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require $site_root . '/includes/admin.php';
require_once $site_root . '/includes/stats.php';

raidlands_admin_handle_request();

$flash = raidlands_admin_take_flash();
$authenticated = raidlands_admin_is_authenticated();
$csrf = raidlands_admin_csrf_token();
$content = raidlands_admin_current_content();
$admin_site = $content['site_config'];
$admin_page_copy = $content['page_copy'];
$admin_seo_pages = $content['seo_pages'];
$admin_weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
$admin_wipe_days = array_map('intval', $admin_site['wipe']['days'] ?? []);
$admin_sections = [
    'identity' => ['label' => 'Identity', 'kicker' => 'Core', 'title' => 'Server Identity', 'summary' => 'Names, fallback status, map, region, and the numbers used when live status is unavailable.'],
    'links' => ['label' => 'Links', 'kicker' => 'Launch', 'title' => 'Links and Integrations', 'summary' => 'Join buttons, Discord invites, BattleMetrics lookup, and future OAuth links.'],
    'wipe' => ['label' => 'Wipe', 'kicker' => 'Schedule', 'title' => 'Wipe Settings', 'summary' => 'The wipe days and time used by countdowns and schedule text.'],
    'features' => ['label' => 'Features', 'kicker' => 'Content', 'title' => 'Feature Lists', 'summary' => 'Homepage feature chips, feature cards, and roadmap cards.'],
    'pages' => ['label' => 'Pages', 'kicker' => 'Copy', 'title' => 'Hero Copy', 'summary' => 'The title and intro text shown at the top of each page.'],
    'seo' => ['label' => 'SEO', 'kicker' => 'Search', 'title' => 'SEO Metadata', 'summary' => 'Browser titles, descriptions, and social sharing copy.'],
    'store' => ['label' => 'Store', 'kicker' => 'VIP', 'title' => 'Products and Prices', 'summary' => 'VIP tiers, one-time perks, Stripe Price IDs, and managed Oxide groups.'],
    'grants' => ['label' => 'Grants', 'kicker' => 'Access', 'title' => 'Manual Entitlement Grant', 'summary' => 'Grant a product to a SteamID64 without going through Stripe.'],
    'sync' => ['label' => 'Sync', 'kicker' => 'Bridge', 'title' => 'WebsiteVipBridge State', 'summary' => 'Entitlement sync, stats ingest status, and server API endpoints.'],
];
$active_section = raidlands_admin_clean_section($_GET['section'] ?? 'identity');
$active_meta = $admin_sections[$active_section];
$admin_store_ready = false;
$admin_store_error = '';
$admin_store_rows = [];
$admin_store_catalog = ['products' => []];
$admin_sync_rows = [];
$admin_stats_summary = [
    'ready' => false,
    'active_wipe' => null,
    'latest_ingest' => null,
    'current_players' => 0,
];

try {
    $admin_store_ready = raidlands_db_is_configured() && raidlands_db() instanceof PDO;

    if ($active_section === 'store' && $admin_store_ready) {
        $admin_store_rows = raidlands_store_admin_product_rows();
    }

    if (in_array($active_section, ['grants', 'sync'], true)) {
        $admin_store_catalog = raidlands_store_catalog(false);

        if (!empty($admin_store_catalog['setupRequired'])) {
            $admin_store_ready = false;
            $admin_store_error = (string) ($admin_store_catalog['error'] ?? $admin_store_error);
        }
    }

    if ($active_section === 'sync' && $admin_store_ready) {
        $admin_sync_rows = raidlands_store_recent_sync_rows(30);
        $admin_stats_summary = raidlands_stats_admin_summary();
    }
} catch (Throwable $error) {
    $admin_store_ready = false;
    $admin_store_error = $error->getMessage();
}

function admin_page_label(string $key): string
{
    return ucwords(str_replace(['-', '_'], ' ', $key));
}

function admin_section_url(string $section): string
{
    $section = raidlands_admin_clean_section($section);

    return $section === 'identity' ? './' : './?section=' . rawurlencode($section);
}

function admin_field_head(string $label, string $help): string
{
    return '<span class="admin-label-row"><span>' . e($label) . '</span><span class="admin-tooltip" tabindex="0" aria-label="' . e($help) . '">?</span></span>'
        . '<small class="admin-help-text">' . e($help) . '</small>';
}

function admin_check_copy(string $label, string $help): string
{
    return '<span class="admin-check-copy"><span class="admin-label-row"><span>' . e($label) . '</span><span class="admin-tooltip" tabindex="0" aria-label="' . e($help) . '">?</span></span>'
        . '<small class="admin-help-text">' . e($help) . '</small></span>';
}

function admin_status_options(): array
{
    return ['Launch target', 'Planned', 'Under review', 'In development', 'After launch', 'Live'];
}
?>
<!doctype html>
<html lang="en" data-page="admin" data-base="<?= e($base_path) ?>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Raidlands Admin</title>
    <meta name="theme-color" content="#0b0d0e">
    <meta name="msapplication-TileColor" content="#050607">
    <meta name="msapplication-TileImage" content="<?= e(asset_url('icons/mstile-150x150.png')) ?>">
    <meta name="msapplication-config" content="<?= e($base_path . 'browserconfig.xml') ?>">
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
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
  </head>
  <body class="admin-body">
    <?php if (!$authenticated) : ?>
      <main class="admin-login-shell">
        <form class="admin-login-panel" method="post" action="<?= e(admin_section_url($active_section)) ?>">
          <input type="hidden" name="action" value="login">
          <input type="hidden" name="section" value="<?= e($active_section) ?>">
          <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
          <img class="admin-login-logo" src="<?= e(asset_url('media/raidlands-logo.webp')) ?>" alt="Raidlands">
          <h1>Raidlands Admin</h1>
          <?php if ($flash !== null) : ?>
            <div class="admin-alert <?= e((string) $flash['type']) ?>"><?= e((string) $flash['message']) ?></div>
          <?php endif; ?>
          <?php if (raidlands_admin_default_password_is_active()) : ?>
            <div class="admin-alert warning">Default admin password is active. Change it in <code>includes/config.php</code>.</div>
          <?php endif; ?>
          <label class="admin-field">
            <?= admin_field_head('Username', 'The admin username configured in includes/config.php.') ?>
            <input type="text" name="username" autocomplete="username" required autofocus>
          </label>
          <label class="admin-field">
            <?= admin_field_head('Password', 'The admin password or password hash configured in includes/config.php.') ?>
            <input type="password" name="password" autocomplete="current-password" required>
          </label>
          <button class="btn btn-primary admin-full-button" type="submit">Sign In</button>
        </form>
      </main>
    <?php else : ?>
      <header class="admin-topbar">
        <a class="admin-brand" href="<?= e(route_url()) ?>">
          <img
            src="<?= e(asset_url('media/horizontal-logo-xsm.webp')) ?>"
            srcset="<?= e(asset_url('media/horizontal-logo-xxsm.webp')) ?> 120w, <?= e(asset_url('media/horizontal-logo-xsm.webp')) ?> 300w, <?= e(asset_url('media/horizontal-logo-sm.webp')) ?> 550w, <?= e(asset_url('media/horizontal-logo-med.webp')) ?> 1100w"
            sizes="(max-width: 520px) 136px, 168px"
            width="300"
            height="100"
            alt="Raidlands"
            decoding="async">
          <span>Admin</span>
        </a>
        <div class="admin-topbar-actions">
          <a class="btn btn-secondary" href="<?= e(route_url()) ?>">View Site</a>
          <form method="post" action="<?= e(admin_section_url($active_section)) ?>">
            <input type="hidden" name="action" value="logout">
            <input type="hidden" name="section" value="<?= e($active_section) ?>">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <button class="btn btn-ghost" type="submit">Logout</button>
          </form>
        </div>
      </header>

      <main class="admin-shell">
        <div class="admin-container">
          <div class="admin-heading">
            <p class="section-kicker">Website Control</p>
            <h1>Raidlands Admin Panel</h1>
          </div>

          <?php if ($flash !== null) : ?>
            <div class="admin-alert <?= e((string) $flash['type']) ?>"><?= e((string) $flash['message']) ?></div>
          <?php endif; ?>

          <div class="admin-layout">
            <aside class="admin-sidebar" aria-label="Admin sections">
              <nav class="admin-side-nav">
                <?php foreach ($admin_sections as $section_key => $section) : ?>
                  <a class="admin-nav-link<?= $section_key === $active_section ? ' is-active' : '' ?>" href="<?= e(admin_section_url((string) $section_key)) ?>">
                    <span><?= e($section['label']) ?></span>
                    <small><?= e($section['summary']) ?></small>
                  </a>
                <?php endforeach; ?>
              </nav>
            </aside>

            <section class="admin-workspace" aria-labelledby="admin-section-title">
              <div class="admin-section-head admin-workspace-head">
                <div>
                  <p class="section-kicker"><?= e($active_meta['kicker']) ?></p>
                  <h2 id="admin-section-title"><?= e($active_meta['title']) ?></h2>
                </div>
                <p class="admin-section-summary"><?= e($active_meta['summary']) ?></p>
              </div>

              <form class="admin-form" method="post" action="<?= e(admin_section_url($active_section)) ?>">
                <input type="hidden" name="action" value="save">
                <input type="hidden" name="section" value="<?= e($active_section) ?>">
                <input type="hidden" name="csrf" value="<?= e($csrf) ?>">

                <?php if ($active_section === 'identity') : ?>
                  <section class="admin-section">
                    <div class="admin-grid three">
                      <label class="admin-field">
                        <?= admin_field_head('Server name', 'Used in the browser config, status API fallback, and places where the site names the server.') ?>
                        <input type="text" name="site_config[serverName]" value="<?= e((string) ($admin_site['serverName'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Tagline', 'Short brand line shown in page heroes and reusable headers.') ?>
                        <input type="text" name="site_config[tagline]" value="<?= e((string) ($admin_site['tagline'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Region', 'Shown in the server status panel so players know the server location.') ?>
                        <input type="text" name="site_config[region]" value="<?= e((string) ($admin_site['region'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Map name', 'Fallback map label shown before live BattleMetrics data loads or when it is unavailable.') ?>
                        <input type="text" name="site_config[mapName]" value="<?= e((string) ($admin_site['mapName'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Fallback players', 'Player count used only when the live server lookup cannot answer.') ?>
                        <input type="number" min="0" max="9999" name="site_config[playersOnline]" value="<?= e((string) ($admin_site['playersOnline'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Max players', 'Capacity shown in the status panel and used as the fallback max player count.') ?>
                        <input type="number" min="1" max="9999" name="site_config[maxPlayers]" value="<?= e((string) ($admin_site['maxPlayers'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Queue', 'Fallback queue count shown when live status is stale or unavailable.') ?>
                        <input type="number" min="0" max="9999" name="site_config[queue]" value="<?= e((string) ($admin_site['queue'] ?? 0)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Server FPS', 'Fallback performance label shown in the status panel before live FPS is available.') ?>
                        <input type="text" name="site_config[serverFps]" value="<?= e((string) ($admin_site['serverFps'] ?? '')) ?>">
                      </label>
                      <label class="admin-check admin-check-field">
                        <input type="checkbox" name="site_config[serverOnline]" value="1" <?= !empty($admin_site['serverOnline']) ? 'checked' : '' ?>>
                        <?= admin_check_copy('Online fallback', 'Controls the default online/offline state before live status responds.') ?>
                      </label>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'links') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <label class="admin-field">
                        <?= admin_field_head('Connect command', 'The exact Rust console command copied by the site buttons.') ?>
                        <input type="text" name="site_config[connectCommand]" value="<?= e((string) ($admin_site['connectCommand'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Steam connect URL', 'The steam:// link used by Join Server and Launch Rust buttons.') ?>
                        <input type="text" name="site_config[steamConnectUrl]" value="<?= e((string) ($admin_site['steamConnectUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Discord invite URL', 'Every Discord call-to-action points here.') ?>
                        <input type="url" name="site_config[discordInviteUrl]" value="<?= e((string) ($admin_site['discordInviteUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('BattleMetrics server ID', 'Numeric server ID used by api/server-status.php for live player and server data.') ?>
                        <input type="text" name="site_config[serverStats][battleMetricsServerId]" value="<?= e((string) ($admin_site['serverStats']['battleMetricsServerId'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Status provider', 'Currently expects battlemetrics; this leaves room for another provider later.') ?>
                        <input type="text" name="site_config[serverStats][provider]" value="<?= e((string) ($admin_site['serverStats']['provider'] ?? 'battlemetrics')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Status cache seconds', 'How long the status API can reuse a BattleMetrics response before checking again.') ?>
                        <input type="number" min="30" max="3600" name="site_config[serverStats][cacheSeconds]" value="<?= e((string) ($admin_site['serverStats']['cacheSeconds'] ?? 60)) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Steam OAuth URL', 'Legacy placeholder. Native Steam sign-in now uses Steam OpenID from /link/.') ?>
                        <input type="url" name="site_config[auth][steamUrl]" value="<?= e((string) ($admin_site['auth']['steamUrl'] ?? '')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Discord OAuth URL', 'Future account-link button destination. Leave blank until the Discord login backend exists.') ?>
                        <input type="url" name="site_config[auth][discordUrl]" value="<?= e((string) ($admin_site['auth']['discordUrl'] ?? '')) ?>">
                      </label>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'wipe') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <label class="admin-field">
                        <?= admin_field_head('Wipe time', 'The local time used by countdowns and wipe schedule labels.') ?>
                        <input type="time" name="site_config[wipe][time]" value="<?= e((string) ($admin_site['wipe']['time'] ?? '19:00')) ?>">
                      </label>
                      <label class="admin-field">
                        <?= admin_field_head('Timezone', 'Timezone label used when calculating and displaying wipe times.') ?>
                        <input type="text" name="site_config[wipe][timezone]" value="<?= e((string) ($admin_site['wipe']['timezone'] ?? 'America/Chicago')) ?>">
                      </label>
                      <div class="admin-field admin-span-all">
                        <?= admin_field_head('Wipe days', 'Selected days drive countdowns, next wipe labels, and schedule copy generated from config.') ?>
                        <div class="admin-check-row">
                          <?php foreach ($admin_weekdays as $day_index => $day_name) : ?>
                            <label class="admin-check">
                              <input type="checkbox" name="site_config[wipe][days][]" value="<?= e((string) $day_index) ?>" <?= in_array($day_index, $admin_wipe_days, true) ? 'checked' : '' ?>>
                              <span><?= e($day_name) ?></span>
                            </label>
                          <?php endforeach; ?>
                        </div>
                      </div>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'features') : ?>
                  <datalist id="admin-status-options">
                    <?php foreach (admin_status_options() as $status_option) : ?>
                      <option value="<?= e($status_option) ?>"></option>
                    <?php endforeach; ?>
                  </datalist>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Quick Feature Chips</h3>
                      <p>Small chips shown near the homepage hero. Use icon aliases like GATHER, KIT, TP, CLAN, SKIN, PACK, RAID, or STAFF.</p>
                    </div>
                    <div class="admin-repeat-list compact">
                      <?php
                        $quick_rows = array_values($content['quick_features']);
                        $quick_total = count($quick_rows) + 4;
                      ?>
                      <?php for ($index = 0; $index < $quick_total; $index += 1) : ?>
                        <?php $row = $quick_rows[$index] ?? ['', '']; ?>
                        <article class="admin-repeat-row">
                          <label class="admin-field">
                            <?= admin_field_head('Icon', 'The icon alias used by the chip. Unknown aliases render as text.') ?>
                            <input type="text" name="quick_features_rows[<?= e((string) $index) ?>][icon]" value="<?= e((string) ($row[0] ?? '')) ?>">
                          </label>
                          <label class="admin-field">
                            <?= admin_field_head('Label', 'The short chip text players see.') ?>
                            <input type="text" name="quick_features_rows[<?= e((string) $index) ?>][label]" value="<?= e((string) ($row[1] ?? '')) ?>">
                          </label>
                          <?php if (isset($quick_rows[$index])) : ?>
                            <label class="admin-check admin-delete-check">
                              <input type="checkbox" name="quick_features_rows[<?= e((string) $index) ?>][delete]" value="1">
                              <span>Remove</span>
                            </label>
                          <?php endif; ?>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Feature Cards</h3>
                      <p>Cards used on the homepage and Features page. The status controls the small badge at the bottom of each card.</p>
                    </div>
                    <div class="admin-repeat-list">
                      <?php
                        $feature_rows = array_values($content['feature_cards']);
                        $feature_total = count($feature_rows) + 3;
                      ?>
                      <?php for ($index = 0; $index < $feature_total; $index += 1) : ?>
                        <?php $row = $feature_rows[$index] ?? ['', '', '', '']; ?>
                        <article class="admin-repeat-card">
                          <div class="admin-repeat-card-head">
                            <h3><?= isset($feature_rows[$index]) ? 'Feature Card ' . e((string) ($index + 1)) : 'New Feature Card' ?></h3>
                            <?php if (isset($feature_rows[$index])) : ?>
                              <label class="admin-check admin-delete-check">
                                <input type="checkbox" name="feature_cards_rows[<?= e((string) $index) ?>][delete]" value="1">
                                <span>Remove</span>
                              </label>
                            <?php endif; ?>
                          </div>
                          <div class="admin-grid feature-card-grid">
                            <label class="admin-field">
                              <?= admin_field_head('Icon', 'Icon alias shown above the card title.') ?>
                              <input type="text" name="feature_cards_rows[<?= e((string) $index) ?>][icon]" value="<?= e((string) ($row[0] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Card heading shown to players.') ?>
                              <input type="text" name="feature_cards_rows[<?= e((string) $index) ?>][title]" value="<?= e((string) ($row[1] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Status', 'Badge text shown on the card. You can type a custom status.') ?>
                              <input type="text" list="admin-status-options" name="feature_cards_rows[<?= e((string) $index) ?>][status]" value="<?= e((string) ($row[3] ?? '')) ?>">
                            </label>
                            <label class="admin-field admin-span-all">
                              <?= admin_field_head('Copy', 'Short card description. Keep it scan-friendly.') ?>
                              <textarea name="feature_cards_rows[<?= e((string) $index) ?>][copy]" rows="3"><?= e((string) ($row[2] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Roadmap Cards</h3>
                      <p>Cards used in the Coming Soon section to explain future systems without changing public routes.</p>
                    </div>
                    <div class="admin-repeat-list">
                      <?php
                        $roadmap_rows = array_values($content['roadmap_cards']);
                        $roadmap_total = count($roadmap_rows) + 3;
                      ?>
                      <?php for ($index = 0; $index < $roadmap_total; $index += 1) : ?>
                        <?php $row = $roadmap_rows[$index] ?? ['', '', '']; ?>
                        <article class="admin-repeat-card">
                          <div class="admin-repeat-card-head">
                            <h3><?= isset($roadmap_rows[$index]) ? 'Roadmap Card ' . e((string) ($index + 1)) : 'New Roadmap Card' ?></h3>
                            <?php if (isset($roadmap_rows[$index])) : ?>
                              <label class="admin-check admin-delete-check">
                                <input type="checkbox" name="roadmap_cards_rows[<?= e((string) $index) ?>][delete]" value="1">
                                <span>Remove</span>
                              </label>
                            <?php endif; ?>
                          </div>
                          <div class="admin-grid three">
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Roadmap item heading.') ?>
                              <input type="text" name="roadmap_cards_rows[<?= e((string) $index) ?>][title]" value="<?= e((string) ($row[0] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Status', 'Badge text shown beside the roadmap item.') ?>
                              <input type="text" list="admin-status-options" name="roadmap_cards_rows[<?= e((string) $index) ?>][status]" value="<?= e((string) ($row[2] ?? '')) ?>">
                            </label>
                            <label class="admin-field admin-span-all">
                              <?= admin_field_head('Copy', 'Short description of the planned system.') ?>
                              <textarea name="roadmap_cards_rows[<?= e((string) $index) ?>][copy]" rows="3"><?= e((string) ($row[1] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </article>
                      <?php endfor; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'pages') : ?>
                  <section class="admin-section">
                    <div class="admin-details-grid">
                      <?php foreach ($admin_page_copy as $copy_key => $copy_row) : ?>
                        <details class="admin-details">
                          <summary><?= e(admin_page_label((string) $copy_key)) ?></summary>
                          <div class="admin-grid two">
                            <label class="admin-field">
                              <?= admin_field_head('Title', 'Main page title for this route hero.') ?>
                              <input type="text" name="page_copy[<?= e((string) $copy_key) ?>][title]" value="<?= e((string) ($copy_row['title'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Lede', 'Intro sentence or short paragraph shown under the page title.') ?>
                              <textarea name="page_copy[<?= e((string) $copy_key) ?>][lede]" rows="3"><?= e((string) ($copy_row['lede'] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'seo') : ?>
                  <section class="admin-section">
                    <div class="admin-details-grid">
                      <?php foreach ($admin_seo_pages as $seo_key => $seo_row) : ?>
                        <details class="admin-details">
                          <summary><?= e(admin_page_label((string) $seo_key)) ?></summary>
                          <div class="admin-grid two">
                            <label class="admin-field">
                              <?= admin_field_head('Browser title', 'Text used in the browser tab and search result title.') ?>
                              <input type="text" name="seo_pages[<?= e((string) $seo_key) ?>][title]" value="<?= e((string) ($seo_row['title'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Meta description', 'Search engines often use this as the page summary.') ?>
                              <textarea name="seo_pages[<?= e((string) $seo_key) ?>][description]" rows="3"><?= e((string) ($seo_row['description'] ?? '')) ?></textarea>
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Open Graph title', 'Title used when the page is shared on apps that read Open Graph metadata.') ?>
                              <input type="text" name="seo_pages[<?= e((string) $seo_key) ?>][ogTitle]" value="<?= e((string) ($seo_row['ogTitle'] ?? '')) ?>">
                            </label>
                            <label class="admin-field">
                              <?= admin_field_head('Open Graph description', 'Description used in social or chat previews when supported.') ?>
                              <textarea name="seo_pages[<?= e((string) $seo_key) ?>][ogDescription]" rows="3"><?= e((string) ($seo_row['ogDescription'] ?? '')) ?></textarea>
                            </label>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    </div>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'store') : ?>
                  <?php if (!$admin_store_ready) : ?>
                    <section class="admin-section">
                      <div class="admin-alert warning">MySQL is not configured or the VIP store tables are not available. Run <code>database/migrations/001_vip_store.sql</code>, then <code>database/seeds/001_store_products.sql</code>, and add credentials to <code>data/raidlands-secrets.php</code>. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    </section>
                  <?php else : ?>
                    <section class="admin-section">
                      <div class="admin-repeat-list">
                        <?php
                          $product_rows = array_values($admin_store_rows);
                          $product_total = count($product_rows) + 2;
                        ?>
                        <?php for ($index = 0; $index < $product_total; $index += 1) : ?>
                          <?php
                            $row = $product_rows[$index] ?? [
                                'id' => '',
                                'slug' => '',
                                'name' => '',
                                'product_type' => 'one_time_perk',
                                'short_description' => '',
                                'description' => '',
                                'oxide_group' => '',
                                'tier_priority' => 0,
                                'is_stackable' => 1,
                                'is_active' => 0,
                                'is_featured' => 0,
                                'sort_order' => 100,
                                'price_id' => '',
                                'stripe_price_id' => '',
                                'price_label' => '',
                                'amount_cents' => 0,
                                'currency' => 'usd',
                                'price_is_active' => 0,
                            ];
                            $amount_dollars = ((int) ($row['amount_cents'] ?? 0)) / 100;
                          ?>
                          <article class="admin-repeat-card">
                            <input type="hidden" name="store_products[<?= e((string) $index) ?>][id]" value="<?= e((string) ($row['id'] ?? '')) ?>">
                            <input type="hidden" name="store_products[<?= e((string) $index) ?>][price_id]" value="<?= e((string) ($row['price_id'] ?? '')) ?>">
                            <div class="admin-repeat-card-head">
                              <h3><?= !empty($row['id']) ? e((string) $row['name']) : 'New Store Product' ?></h3>
                              <?php if (!empty($row['id'])) : ?>
                                <label class="admin-check admin-delete-check">
                                  <input type="checkbox" name="store_products[<?= e((string) $index) ?>][delete]" value="1">
                                  <span>Deactivate</span>
                                </label>
                              <?php endif; ?>
                            </div>
                            <div class="admin-grid three">
                              <label class="admin-field">
                                <?= admin_field_head('Slug', 'Stable store identifier used by admin and support. Keep lowercase with hyphens.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][slug]" value="<?= e((string) ($row['slug'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Name', 'Product title shown to players.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][name]" value="<?= e((string) ($row['name'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Type', 'Monthly VIP creates Stripe subscription checkout. Other types create one-time checkout.') ?>
                                <select name="store_products[<?= e((string) $index) ?>][product_type]">
                                  <?php foreach (['vip_subscription' => 'Monthly VIP', 'one_time_perk' => 'One-time perk', 'one_time_kit_unlock' => 'One-time kit unlock'] as $value => $label) : ?>
                                    <option value="<?= e($value) ?>" <?= (string) ($row['product_type'] ?? '') === $value ? 'selected' : '' ?>><?= e($label) ?></option>
                                  <?php endforeach; ?>
                                </select>
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Oxide group', 'WebsiteVipBridge will add this managed group while the entitlement is active.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][oxide_group]" value="<?= e((string) ($row['oxide_group'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Tier priority', 'Higher VIP priority revokes lower active VIP tier entitlements for the same player.') ?>
                                <input type="number" min="0" max="999" name="store_products[<?= e((string) $index) ?>][tier_priority]" value="<?= e((string) ($row['tier_priority'] ?? 0)) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Sort order', 'Lower products appear first on the public store.') ?>
                                <input type="number" min="0" max="9999" name="store_products[<?= e((string) $index) ?>][sort_order]" value="<?= e((string) ($row['sort_order'] ?? 100)) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Stripe Price ID', 'Use a real Stripe Price ID such as price_123. Placeholder values disable checkout.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][stripe_price_id]" value="<?= e((string) ($row['stripe_price_id'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Price label', 'Small label near the product price, such as Monthly or One-time.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][price_label]" value="<?= e((string) ($row['price_label'] ?? '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Amount USD', 'Public display amount in dollars. Stripe still charges the configured Price ID amount.') ?>
                                <input type="number" min="0" step="0.01" name="store_products[<?= e((string) $index) ?>][amount_dollars]" value="<?= e(number_format($amount_dollars, 2, '.', '')) ?>">
                              </label>
                              <label class="admin-field">
                                <?= admin_field_head('Currency', 'Three-letter currency for display, usually usd.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][currency]" value="<?= e((string) ($row['currency'] ?? 'usd')) ?>">
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_active]" value="1" <?= !empty($row['is_active']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Product active', 'Active products can appear on the public store.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][price_is_active]" value="1" <?= !empty($row['price_is_active']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Price active', 'Checkout is available only when both product and price are active.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_featured]" value="1" <?= !empty($row['is_featured']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Featured', 'Featured products can be emphasized on future storefront layouts.') ?>
                              </label>
                              <label class="admin-check admin-check-field">
                                <input type="checkbox" name="store_products[<?= e((string) $index) ?>][is_stackable]" value="1" <?= !empty($row['is_stackable']) ? 'checked' : '' ?>>
                                <?= admin_check_copy('Stackable', 'One-time perks can stack. VIP tiers should usually be non-stackable.') ?>
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Short description', 'Brief copy shown on store cards.') ?>
                                <input type="text" name="store_products[<?= e((string) $index) ?>][short_description]" value="<?= e((string) ($row['short_description'] ?? '')) ?>">
                              </label>
                              <label class="admin-field admin-span-all">
                                <?= admin_field_head('Full description', 'Longer admin/support note for what this product should grant.') ?>
                                <textarea name="store_products[<?= e((string) $index) ?>][description]" rows="3"><?= e((string) ($row['description'] ?? '')) ?></textarea>
                              </label>
                            </div>
                          </article>
                        <?php endfor; ?>
                      </div>
                    </section>
                  <?php endif; ?>
                <?php endif; ?>

                <?php if ($active_section === 'grants') : ?>
                  <section class="admin-section">
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL must be configured before manual grants can be recorded. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php else : ?>
                      <div class="admin-grid two">
                        <label class="admin-field">
                          <?= admin_field_head('SteamID64', 'The Rust player ID that should receive this entitlement.') ?>
                          <input type="text" name="steam_id64" inputmode="numeric" placeholder="7656119XXXXXXXXXX" required>
                        </label>
                        <label class="admin-field">
                          <?= admin_field_head('Product', 'The product controls the Oxide group WebsiteVipBridge will sync.') ?>
                          <select name="product_id" required>
                            <?php foreach ($admin_store_catalog['products'] as $product) : ?>
                              <option value="<?= e((string) $product['id']) ?>"><?= e((string) $product['name']) ?> (<?= e((string) $product['oxide_group']) ?>)</option>
                            <?php endforeach; ?>
                          </select>
                        </label>
                        <label class="admin-field">
                          <?= admin_field_head('Ends at', 'Optional MySQL datetime such as 2026-07-31 23:59:59. Leave blank for no scheduled expiration.') ?>
                          <input type="text" name="ends_at" placeholder="YYYY-MM-DD HH:MM:SS">
                        </label>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <?php if ($active_section === 'sync') : ?>
                  <section class="admin-section">
                    <div class="admin-grid two">
                      <div class="metal-panel">
                        <p class="section-kicker">Managed groups</p>
                        <h3>Bridge-controlled permissions</h3>
                        <ul class="list-clean">
                          <?php foreach (raidlands_store_managed_groups() as $group) : ?>
                            <li><code><?= e($group) ?></code></li>
                          <?php endforeach; ?>
                        </ul>
                      </div>
                      <div class="metal-panel">
                        <p class="section-kicker">Bridge API</p>
                        <h3>Endpoints</h3>
                        <ul class="list-clean">
                          <li><code>/api/server/vip-player.php?steam_id64=...</code></li>
                          <li><code>/api/server/vip-changes.php?since=...</code></li>
                          <li><code>/api/server/stats-snapshot.php</code></li>
                          <li>Requests require Raidlands HMAC headers.</li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Stats ingest</h3>
                      <p>Website leaderboards and profile RP use snapshots posted by WebsiteVipBridge.</p>
                    </div>
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL is not configured yet. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif (empty($admin_stats_summary['ready'])) : ?>
                      <div class="admin-alert warning">Stats tables are not installed yet. Run <code>database/migrations/002_player_stats.sql</code>.</div>
                    <?php else : ?>
                      <?php
                        $active_wipe = $admin_stats_summary['active_wipe'];
                        $latest_ingest = $admin_stats_summary['latest_ingest'];
                      ?>
                      <div class="admin-grid three">
                        <div class="metal-panel">
                          <p class="section-kicker">Active wipe</p>
                          <h3><?= e((string) ($active_wipe['wipe_key'] ?? 'None')) ?></h3>
                          <p class="store-muted">Snapshots: <?= e((string) ($active_wipe['snapshot_count'] ?? 0)) ?></p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Tracked players</p>
                          <h3><?= e((string) $admin_stats_summary['current_players']) ?></h3>
                          <p class="store-muted">Current wipe rows</p>
                        </div>
                        <div class="metal-panel">
                          <p class="section-kicker">Last stats sync</p>
                          <h3><?= e((string) ($latest_ingest['created_at'] ?? 'Pending')) ?></h3>
                          <p class="store-muted"><?= e((string) ($latest_ingest['players_accepted'] ?? 0)) ?> accepted / <?= e((string) ($latest_ingest['players_received'] ?? 0)) ?> received</p>
                        </div>
                      </div>
                    <?php endif; ?>
                  </section>

                  <section class="admin-section">
                    <div class="admin-subsection-head">
                      <h3>Recent entitlement changes</h3>
                      <p>These rows drive the bridge change cursor and explain what should sync to Rust.</p>
                    </div>
                    <?php if (!$admin_store_ready) : ?>
                      <div class="admin-alert warning">MySQL is not configured yet. <?= $admin_store_error !== '' ? e($admin_store_error) : '' ?></div>
                    <?php elseif ($admin_sync_rows === []) : ?>
                      <div class="admin-alert warning">No entitlement changes have been recorded yet.</div>
                    <?php else : ?>
                      <div class="store-table-wrap">
                        <table class="store-table">
                          <thead>
                            <tr>
                              <th>SteamID64</th>
                              <th>Product</th>
                              <th>Group</th>
                              <th>Status</th>
                              <th>Ends</th>
                              <th>Changed</th>
                            </tr>
                          </thead>
                          <tbody>
                            <?php foreach ($admin_sync_rows as $row) : ?>
                              <tr>
                                <td><code><?= e((string) $row['steam_id64']) ?></code></td>
                                <td><?= e((string) $row['name']) ?></td>
                                <td><code><?= e((string) $row['oxide_group']) ?></code></td>
                                <td><span class="status-pill <?= e((string) $row['status']) ?>"><?= e((string) $row['status']) ?></span></td>
                                <td><?= e((string) ($row['ends_at'] ?: 'None')) ?></td>
                                <td><?= e((string) $row['changed_at']) ?></td>
                              </tr>
                            <?php endforeach; ?>
                          </tbody>
                        </table>
                      </div>
                    <?php endif; ?>
                  </section>
                <?php endif; ?>

                <div class="admin-savebar">
                  <?php if ($active_section !== 'sync') : ?>
                    <button class="btn btn-primary" type="submit">Save <?= e($active_meta['label']) ?></button>
                  <?php endif; ?>
                  <a class="btn btn-secondary" href="<?= e(route_url()) ?>">View Site</a>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    <?php endif; ?>
  </body>
</html>
