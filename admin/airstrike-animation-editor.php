<?php

$page_id = 'admin';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin.php';

raidlands_admin_boot();

if (!raidlands_admin_is_authenticated()) {
    header('Location: ./?section=airstrike-animations', true, 303);
    exit;
}

if (!raidlands_admin_can('admin.airstrike_animations.manage')) {
    http_response_code(403);
    echo 'Your admin role cannot access the Portable Airstrikes animation editor.';
    exit;
}

$profile_key = strtolower(trim((string) ($_GET['profile'] ?? '')));
if ($profile_key !== '' && !preg_match('/^[a-z0-9][a-z0-9._-]{0,99}$/', $profile_key)) {
    $profile_key = '';
}

$admin_user = raidlands_admin_current_user();
$editor_config = [
    'profileKey' => $profile_key,
    'csrf' => raidlands_admin_csrf_token(),
    'apiBase' => $base_path . 'api/admin/airstrike-animations',
    'assetBase' => $base_path . 'assets/',
    'managementUrl' => './?section=airstrike-animations',
    'admin' => [
        'id' => is_array($admin_user) ? (int) ($admin_user['id'] ?? 0) : 0,
        'steamId64' => is_array($admin_user) ? (string) ($admin_user['steam_id64'] ?? '') : 'legacy-config-admin',
        'displayName' => is_array($admin_user) ? (string) ($admin_user['display_name'] ?? 'Admin') : 'Setup Admin',
    ],
    'limits' => [
        'maximumSourceBytes' => 2097152,
        'maximumBundleBytes' => 20971520,
    ],
    'featureFlags' => [
        'sourceWorkbench' => false,
        'threeViewport' => true,
        'rconPublishNotification' => false,
    ],
];
?>
<!doctype html>
<html lang="en" data-page="airstrike-animation-editor" data-base="<?= e($base_path) ?>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Portable Airstrikes Animation Editor · Raidlands</title>
    <meta name="theme-color" content="#0b0d0e">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-32x32.ico')) ?>" sizes="32x32">
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('css/airstrike-animation-editor.css')) ?>">
  </head>
  <body class="airstrike-editor-body">
    <main class="airstrike-editor" data-airstrike-editor>
      <header class="airstrike-editor-toolbar">
        <div class="airstrike-editor-brand">
          <a href="./?section=airstrike-animations" aria-label="Back to animation profiles">←</a>
          <div>
            <p class="section-kicker">Portable Airstrikes</p>
            <h1>Animation editor</h1>
          </div>
        </div>
        <div class="airstrike-editor-toolbar-actions">
          <span class="airstrike-editor-state" data-editor-state>Loading profiles…</span>
          <button class="btn btn-secondary" type="button" data-editor-validate>Validate</button>
          <button class="btn btn-secondary" type="button" data-editor-compile>Compile Preview</button>
          <button class="btn btn-primary" type="button" data-editor-save>Save Draft</button>
          <button class="btn btn-secondary" type="button" data-editor-publish="publish">Publish</button>
          <button class="btn btn-primary" type="button" data-editor-publish="sync">Publish &amp; Sync</button>
        </div>
      </header>

      <aside class="airstrike-editor-left">
        <div class="airstrike-editor-panel-head">
          <p class="section-kicker">Profiles</p>
          <button class="btn btn-secondary btn-small" type="button" data-editor-new>New</button>
        </div>
        <input type="search" placeholder="Search profiles" data-editor-search aria-label="Search profiles">
        <div class="airstrike-editor-profile-list" data-editor-profile-list></div>
      </aside>

      <section class="airstrike-editor-center">
        <div class="airstrike-editor-stage-head">
          <div>
            <p class="section-kicker">3D waypoint editor</p>
            <h2 data-editor-title>New profile</h2>
          </div>
          <span class="status-pill" data-editor-dirty>Clean</span>
        </div>
        <div class="airstrike-editor-viewport-shell">
          <div class="airstrike-editor-viewport" data-editor-viewport aria-label="Airstrike waypoint viewport"></div>
          <div class="airstrike-editor-viewport-meta">
            <span data-editor-vehicle-meta>Proxy preview</span>
            <span>Target-relative Unity source, Three.js render conversion</span>
          </div>
        </div>
        <div class="airstrike-editor-timeline">
          <label for="airstrike-editor-time">Time</label>
          <input id="airstrike-editor-time" type="range" min="0" max="8" step="0.01" data-editor-time-range>
          <input type="number" min="0" max="8" step="0.01" data-editor-time-number aria-label="Current preview time">
          <strong data-editor-time-readout>0.00s / 0.00s</strong>
        </div>
        <details class="airstrike-editor-source-fallback" data-editor-source-details>
          <summary>JSON recovery/debug source</summary>
          <textarea
            class="airstrike-editor-source"
            data-editor-source
            spellcheck="false"
            aria-label="Animation source JSON"
          ></textarea>
        </details>
      </section>

      <aside class="airstrike-editor-right">
        <section class="airstrike-editor-side-section">
          <p class="section-kicker">Profile identity</p>
          <label class="admin-field">
            <span>Profile key</span>
            <input type="text" maxlength="100" data-editor-key pattern="[a-z0-9][a-z0-9._-]{0,99}">
          </label>
          <label class="admin-field">
            <span>Display name</span>
            <input type="text" maxlength="160" data-editor-name>
          </label>
          <label class="admin-field">
            <span>Vehicle</span>
            <select data-editor-vehicle>
              <option value="drone">Drone</option>
              <option value="cargo_plane">Cargo plane</option>
              <option value="f15">F-15</option>
              <option value="a10">A-10</option>
              <option value="attack_heli">Attack helicopter</option>
            </select>
          </label>
        </section>
        <section class="airstrike-editor-side-section">
          <p class="section-kicker">Waypoint</p>
          <h3 data-editor-waypoint-title>No waypoint selected</h3>
          <div class="airstrike-waypoint-inspector">
            <label><span>Time</span><input type="number" step="0.01" data-editor-waypoint-field="Time"></label>
            <label><span>X</span><input type="number" step="0.1" data-editor-waypoint-field="X"></label>
            <label><span>Y</span><input type="number" step="0.1" data-editor-waypoint-field="Y"></label>
            <label><span>Z</span><input type="number" step="0.1" data-editor-waypoint-field="Z"></label>
            <label><span>Rot X</span><input type="number" step="0.1" data-editor-waypoint-field="RotationX"></label>
            <label><span>Rot Y</span><input type="number" step="0.1" data-editor-waypoint-field="RotationY"></label>
            <label><span>Rot Z</span><input type="number" step="0.1" data-editor-waypoint-field="RotationZ"></label>
          </div>
        </section>
        <section class="airstrike-editor-side-section">
          <p class="section-kicker">Route waypoints</p>
          <div class="airstrike-waypoint-list" data-editor-waypoints></div>
        </section>
        <div class="airstrike-editor-validation" data-editor-feedback>
          Load or create a profile, then validate before publishing.
        </div>
      </aside>

      <section class="airstrike-editor-bottom">
        <div>
          <p class="section-kicker">Compiled preview</p>
          <strong data-editor-compile-summary>No compiled track yet</strong>
        </div>
        <pre data-editor-output aria-live="polite"></pre>
      </section>
    </main>
    <script type="application/json" id="airstrike-animation-editor-config"><?= json_encode($editor_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) ?></script>
    <script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/airstrike-animation-editor.js')) ?>"></script>
  </body>
</html>
