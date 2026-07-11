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
    <title>Portable Airstrikes Animation Editor &middot; Raidlands</title>
    <meta name="theme-color" content="#0b0d0e">
    <link rel="icon" href="<?= e(asset_url('icons/favicon-32x32.ico')) ?>" sizes="32x32">
    <link rel="stylesheet" href="<?= e(asset_url('css/styles.css')) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('css/airstrike-animation-editor.css')) ?>">
  </head>
  <body class="airstrike-editor-body">
    <main class="airstrike-editor" data-airstrike-editor>
      <header class="airstrike-editor-toolbar">
        <nav class="airstrike-editor-menubar" aria-label="Editor menus">
          <details class="airstrike-editor-menu">
            <summary>File</summary>
            <div class="airstrike-editor-menu-list">
              <a class="airstrike-editor-menu-link" href="./?section=airstrike-animations">Open Profile Browser</a>
              <button type="button" data-editor-new>New Profile</button>
              <button type="button" data-editor-save>Save Draft</button>
              <button type="button" data-editor-compile>Compile Preview</button>
              <button type="button" data-editor-publish="publish">Publish</button>
              <button type="button" data-editor-publish="sync">Publish &amp; Sync</button>
            </div>
          </details>
          <details class="airstrike-editor-menu">
            <summary>Edit</summary>
            <div class="airstrike-editor-menu-list">
              <button type="button" data-editor-focus-palette="identity">Profile Identity</button>
              <button type="button" data-editor-focus-palette="waypoint">Selected Waypoint</button>
              <button type="button" data-editor-focus-palette="route-timing">Route Timing</button>
              <button type="button" data-editor-focus-palette="ordnance">Ordnance</button>
              <button type="button" data-editor-validate>Validate</button>
            </div>
          </details>
          <details class="airstrike-editor-menu">
            <summary>View</summary>
            <div class="airstrike-editor-menu-list">
              <button type="button" data-editor-frame-route>Frame Route</button>
              <button type="button" data-editor-frame-vehicle>Frame Vehicle</button>
              <button type="button" data-editor-frame-target>Frame Target</button>
            </div>
          </details>
          <details class="airstrike-editor-menu">
            <summary>Window</summary>
            <div class="airstrike-editor-menu-list">
              <button type="button" data-editor-toggle-panel="left">Profiles</button>
              <button type="button" data-editor-toggle-panel="right">Inspector</button>
              <button type="button" data-editor-toggle-panel="bottom">Timeline</button>
            </div>
          </details>
        </nav>
        <div class="airstrike-editor-commandbar">
          <div class="airstrike-editor-brand">
            <a href="./?section=airstrike-animations" aria-label="Back to animation profiles">&larr;</a>
            <div>
              <p class="section-kicker">Portable Airstrikes</p>
              <h1>Animation editor</h1>
              <p class="airstrike-editor-current-profile"><span data-editor-title>New profile</span> <span class="status-pill" data-editor-dirty>Clean</span></p>
            </div>
          </div>
          <div class="airstrike-editor-toolbar-actions">
            <span class="airstrike-editor-state" data-editor-state>Loading profiles...</span>
          </div>
        </div>
      </header>

      <aside class="airstrike-editor-left">
        <div class="airstrike-editor-dock-head">
          <div>
            <p class="section-kicker">Files</p>
            <strong>Profiles</strong>
          </div>
          <div class="airstrike-editor-panel-actions">
            <button class="btn btn-secondary btn-small" type="button" data-editor-new>New</button>
            <button class="airstrike-editor-panel-collapse" type="button" data-editor-toggle-panel="left" aria-label="Minimize profiles">Min</button>
          </div>
        </div>
        <input type="search" placeholder="Search profiles" data-editor-search aria-label="Search profiles">
        <div class="airstrike-editor-profile-list" data-editor-profile-list></div>
      </aside>

      <section class="airstrike-editor-center">
        <div class="airstrike-editor-viewport-shell">
          <div class="airstrike-editor-viewport" data-editor-viewport aria-label="Airstrike waypoint viewport"></div>
          <div class="airstrike-editor-panel-restore" aria-label="Hidden editor panels">
            <button class="airstrike-editor-restore-button airstrike-editor-restore-left" type="button" data-editor-toggle-panel="left" aria-label="Show profiles" title="Show profiles"></button>
            <button class="airstrike-editor-restore-button airstrike-editor-restore-right" type="button" data-editor-toggle-panel="right" aria-label="Show inspector" title="Show inspector"></button>
            <button class="airstrike-editor-restore-button airstrike-editor-restore-bottom" type="button" data-editor-toggle-panel="bottom" aria-label="Show timeline" title="Show timeline"></button>
          </div>
          <div class="airstrike-editor-viewport-meta">
            <span data-editor-vehicle-meta>Proxy preview</span>
            <span>Target-relative Unity source, Three.js render conversion</span>
          </div>
        </div>
      </section>

      <aside class="airstrike-editor-right">
        <div class="airstrike-editor-dock-head">
          <div>
            <p class="section-kicker">Inspector</p>
            <strong>Palettes</strong>
          </div>
          <button class="airstrike-editor-panel-collapse" type="button" data-editor-toggle-panel="right" aria-label="Minimize inspector">Min</button>
        </div>
        <div class="airstrike-editor-palette-groups">
          <section class="airstrike-editor-palette-group" aria-label="Edit palettes">
            <div class="airstrike-editor-palette-group-head">
              <span>Edit</span>
              <small>Authoring</small>
            </div>
            <div class="airstrike-editor-palette-zone" data-editor-palette-zone="edit">
              <details class="airstrike-editor-palette" data-editor-palette="identity" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Profile</small><strong>Identity</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize profile identity">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <p class="airstrike-editor-muted">Draft ID and preview vehicle.</p>
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
                </div>
              </details>

              <details class="airstrike-editor-palette" data-editor-palette="waypoint" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Route</small><strong data-editor-waypoint-title>No waypoint selected</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize waypoint">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <div class="airstrike-editor-inline-actions">
                    <button class="btn btn-secondary btn-small" type="button" data-editor-waypoint-add>Add At Time</button>
                    <button class="btn btn-secondary btn-small" type="button" data-editor-waypoint-duplicate>Duplicate</button>
                    <button class="btn btn-secondary btn-small" type="button" data-editor-waypoint-delete>Delete</button>
                  </div>
                  <div class="airstrike-waypoint-inspector">
                    <label><span>Time</span><input type="number" step="0.01" data-editor-waypoint-field="Time"></label>
                    <p>Position</p>
                    <label><span>X</span><input type="number" step="0.1" data-editor-waypoint-field="X"></label>
                    <label><span>Y</span><input type="number" step="0.1" data-editor-waypoint-field="Y"></label>
                    <label><span>Z</span><input type="number" step="0.1" data-editor-waypoint-field="Z"></label>
                    <p>Rotation offset</p>
                    <label><span>Rot X</span><input type="number" step="0.1" data-editor-waypoint-field="RotationX"></label>
                    <label><span>Rot Y</span><input type="number" step="0.1" data-editor-waypoint-field="RotationY"></label>
                    <label><span>Rot Z</span><input type="number" step="0.1" data-editor-waypoint-field="RotationZ"></label>
                  </div>
                  <label class="admin-field">
                    <span>Target speed (m/s)</span>
                    <input type="number" min="0.1" max="500" step="0.1" data-editor-waypoint-speed>
                  </label>
                  <p class="airstrike-editor-muted" data-editor-waypoint-speed-mph></p>
                </div>
              </details>

              <details class="airstrike-editor-palette" data-editor-palette="route-timing" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Route</small><strong>Timing</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize route timing">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <label class="admin-field">
                    <span>Global target speed (m/s)</span>
                    <input type="number" min="0.1" max="500" step="0.1" data-editor-global-speed>
                  </label>
                  <p class="airstrike-editor-muted" data-editor-global-speed-mph></p>
                  <div class="airstrike-editor-inline-actions">
                    <button class="btn btn-secondary btn-small" type="button" data-editor-normalize-times>Normalize Times</button>
                    <button class="btn btn-secondary btn-small" type="button" data-editor-infer-speeds>Infer From Current Times</button>
                  </div>
                </div>
              </details>

              <details class="airstrike-editor-palette" data-editor-palette="ordnance" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Payload</small><strong>Ordnance</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize ordnance">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <label class="admin-field">
                    <span>Release source</span>
                    <select data-editor-release-mode>
                      <option value="manual">Manual events</option>
                      <option value="repeated">Repeated sequence</option>
                    </select>
                  </label>
                  <div class="airstrike-editor-inline-actions">
                    <button class="btn btn-secondary btn-small" type="button" data-editor-release-add>Add</button>
                    <button class="btn btn-secondary btn-small" type="button" data-editor-release-duplicate>Duplicate</button>
                    <button class="btn btn-secondary btn-small" type="button" data-editor-release-delete>Delete</button>
                  </div>
                  <div class="airstrike-release-list" data-editor-manual-releases></div>
                  <div class="airstrike-release-editor" data-editor-manual-editor></div>
                  <div class="airstrike-release-editor" data-editor-repeated-editor></div>
                </div>
              </details>
            </div>
          </section>

          <section class="airstrike-editor-palette-group" aria-label="Reference palettes">
            <div class="airstrike-editor-palette-group-head">
              <span>Reference</span>
              <small>Lists</small>
            </div>
            <div class="airstrike-editor-palette-zone" data-editor-palette-zone="reference">
              <details class="airstrike-editor-palette" data-editor-palette="route-waypoints" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Route</small><strong>Waypoints</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize route waypoints">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <div class="airstrike-waypoint-list" data-editor-waypoints></div>
                </div>
              </details>

              <details class="airstrike-editor-palette" data-editor-palette="validation" open>
                <summary class="airstrike-editor-palette-summary">
                  <span class="airstrike-editor-palette-grip" data-editor-palette-drag title="Move panel">||</span>
                  <span class="airstrike-editor-palette-title"><small>Output</small><strong>Validation</strong></span>
                  <button class="airstrike-editor-palette-collapse" type="button" data-editor-palette-collapse aria-label="Minimize validation">Min</button>
                </summary>
                <div class="airstrike-editor-palette-body">
                  <div class="airstrike-editor-validation" data-editor-feedback>
                    Load or create a profile, then validate before publishing.
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>
      </aside>

      <section class="airstrike-editor-bottom">
        <div class="airstrike-editor-bottom-head">
          <div>
            <p class="section-kicker">Timeline</p>
            <strong>Playback</strong>
          </div>
          <button class="airstrike-editor-panel-collapse" type="button" data-editor-toggle-panel="bottom" aria-label="Minimize timeline">Min</button>
        </div>
        <div class="airstrike-editor-bottom-grid">
          <div class="airstrike-editor-drawer-main">
            <div class="airstrike-editor-timeline">
              <label for="airstrike-editor-time">Time</label>
              <input id="airstrike-editor-time" type="range" min="0" max="8" step="0.01" data-editor-time-range>
              <input type="number" min="0" max="8" step="0.01" data-editor-time-number aria-label="Current preview time">
              <strong data-editor-time-readout>0.00s / 0.00s</strong>
            </div>
            <div class="airstrike-editor-playback">
              <button class="btn btn-secondary btn-small" type="button" data-editor-play>Play</button>
              <button class="btn btn-secondary btn-small" type="button" data-editor-step-back aria-label="Step backward">-0.1s</button>
              <button class="btn btn-secondary btn-small" type="button" data-editor-step-forward aria-label="Step forward">+0.1s</button>
              <label class="airstrike-editor-checkbox"><input type="checkbox" data-editor-loop> Loop</label>
              <label class="admin-field">
                <span>Ordnance rays</span>
                <select data-editor-release-visibility>
                  <option value="near">Near playhead</option>
                  <option value="current">Current release</option>
                  <option value="all">Always on</option>
                  <option value="selected">Selected only</option>
                </select>
              </label>
            </div>
            <div class="airstrike-release-timeline" data-editor-release-timeline></div>
            <details class="airstrike-editor-source-fallback" data-editor-source-details>
              <summary>JSON recovery/debug source</summary>
              <textarea
                class="airstrike-editor-source"
                data-editor-source
                spellcheck="false"
                aria-label="Animation source JSON"
              ></textarea>
            </details>
          </div>
          <div class="airstrike-editor-output-panel">
            <p class="section-kicker">Compiled preview</p>
            <strong data-editor-compile-summary>No compiled track yet</strong>
            <pre data-editor-output aria-live="polite"></pre>
          </div>
        </div>
      </section>
    </main>
    <script type="application/json" id="airstrike-animation-editor-config"><?= json_encode($editor_config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) ?></script>
    <script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/airstrike-animation-editor.js')) ?>"></script>
  </body>
</html>
