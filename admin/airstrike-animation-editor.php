<?php

$page_id = 'admin';
$base_path = '../';

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin.php';
require_once $site_root . '/includes/airstrike-agent.php';

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
    'agentApiBase' => $base_path . 'api/admin/airstrike-agent',
    'assetBase' => $base_path . 'assets/',
    'serverStatusUrl' => $base_path . 'api/server-status.php',
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
        'airstrikeAgent' => raidlands_airstrike_agent_config()['enabled'],
        'airstrikeAgentConfigured' => raidlands_airstrike_agent_is_configured(),
        'airstrikeAgentStorageReady' => raidlands_airstrike_agent_schema_ready(),
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
              <button type="button" data-editor-duplicate>Duplicate Profile</button>
              <button type="button" data-editor-save>Save Draft</button>
              <button type="button" data-editor-compile>Compile Preview</button>
              <button type="button" data-editor-publish="publish">Publish</button>
              <button type="button" data-editor-publish="sync">Publish &amp; Sync</button>
            </div>
          </details>
          <details class="airstrike-editor-menu">
            <summary>Edit</summary>
            <div class="airstrike-editor-menu-list">
              <button type="button" data-editor-validate>Validate</button>
            </div>
          </details>
          <details class="airstrike-editor-menu">
            <summary>View</summary>
            <div class="airstrike-editor-menu-list">
              <button type="button" data-editor-tool-open="profile">Open Profile Setup</button>
              <button type="button" data-editor-tool-open="flight-path">Open Flight Path</button>
              <button type="button" data-editor-tool-open="ordnance">Open Ordnance</button>
              <button type="button" data-editor-tool-open="view-validation">Open View &amp; Validation</button>
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
            <div class="airstrike-editor-title-block">
              <div class="airstrike-editor-title-row">
                <p class="section-kicker">Portable Airstrikes</p>
                <h1>Animation editor</h1>
              </div>
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
            <button class="airstrike-editor-action-button airstrike-editor-action-button-compact" type="button" data-editor-new>New</button>
            <button class="airstrike-editor-action-button airstrike-editor-action-button-compact" type="button" data-editor-duplicate>Duplicate</button>
            <button class="airstrike-editor-panel-collapse airstrike-editor-panel-collapse-left" type="button" data-editor-toggle-panel="left" aria-label="Minimize profiles" title="Minimize profiles"></button>
          </div>
        </div>
        <div class="airstrike-editor-profile-tools">
          <input type="search" placeholder="Search profiles" data-editor-search aria-label="Search profiles">
          <div class="airstrike-editor-profile-options">
            <label>
              <span>Status</span>
              <select data-editor-profile-filter aria-label="Filter profiles by status">
                <option value="all">All profiles</option>
                <option value="valid">Valid</option>
                <option value="invalid">Needs attention</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select data-editor-profile-sort aria-label="Sort profiles">
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="updated-desc">Recently modified</option>
                <option value="draft-desc">Highest draft</option>
              </select>
            </label>
          </div>
          <div class="airstrike-editor-profile-tabs" data-editor-profile-tabs role="tablist" aria-label="Vehicle type"></div>
          <p class="airstrike-editor-profile-count" data-editor-profile-count aria-live="polite"></p>
        </div>
        <div class="airstrike-editor-profile-list" data-editor-profile-list></div>
      </aside>

      <section class="airstrike-editor-center">
          <div class="airstrike-editor-viewport-shell">
            <div class="airstrike-editor-viewport" data-editor-viewport aria-label="Airstrike waypoint viewport"></div>
          <div class="airstrike-editor-orientation" aria-label="View orientation">
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-top" type="button" data-editor-orientation="top" aria-label="Top view" title="Top view">Top</button>
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-left" type="button" data-editor-orientation="left" aria-label="Left view" title="Left view">Left</button>
            <button class="airstrike-editor-orientation-cube" type="button" data-editor-orientation="iso" aria-label="Home view" title="Home view">
              <span class="airstrike-editor-orientation-cube-stage" aria-hidden="true">
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-front">F</span>
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-back">B</span>
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-right">R</span>
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-left">L</span>
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-top">T</span>
                <span class="airstrike-editor-orientation-cube-face airstrike-editor-orientation-cube-face-bottom">D</span>
              </span>
            </button>
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-right" type="button" data-editor-orientation="right" aria-label="Right view" title="Right view">Right</button>
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-front" type="button" data-editor-orientation="front" aria-label="Front view" title="Front view">Front</button>
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-bottom" type="button" data-editor-orientation="bottom" aria-label="Bottom view" title="Bottom view">Bottom</button>
            <button class="airstrike-editor-orientation-face airstrike-editor-orientation-face-back" type="button" data-editor-orientation="back" aria-label="Back view" title="Back view">Back</button>
          </div>
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
          <div class="airstrike-editor-right-tabs" role="tablist" aria-label="Right panel">
            <button class="is-active" type="button" role="tab" aria-selected="true" data-editor-right-tab="inspector">Inspector</button>
            <button type="button" role="tab" aria-selected="false" data-editor-right-tab="agent">Agent</button>
          </div>
          <button class="airstrike-editor-panel-collapse airstrike-editor-panel-collapse-right" type="button" data-editor-toggle-panel="right" aria-label="Minimize inspector" title="Minimize inspector"></button>
        </div>
        <div class="airstrike-editor-toolbox" data-editor-inspector-panel>
          <div class="airstrike-editor-feedback-strip" data-editor-feedback-summary>Ready for profile edits.</div>
          <article class="airstrike-editor-tool-card" data-editor-tool-card="profile">
            <header><span>Profile Setup</span><small>Identity</small></header>
            <strong data-editor-summary-profile>New profile</strong>
            <p data-editor-summary-profile-detail>Choose a vehicle and identify this draft.</p>
            <div><button type="button" data-editor-tool-open="profile">Edit manually</button><button type="button" data-editor-tool-ai="profile">Ask AI</button></div>
          </article>
          <article class="airstrike-editor-tool-card" data-editor-tool-card="flight-path">
            <header><span>Flight Path</span><small>Route</small></header>
            <strong data-editor-summary-flight>0 waypoints</strong>
            <p data-editor-summary-flight-detail>No waypoint selected.</p>
            <nav aria-label="Selected waypoint"><button type="button" data-editor-step-selection="waypoint:-1" aria-label="Previous waypoint">&larr;</button><button type="button" data-editor-step-selection="waypoint:1" aria-label="Next waypoint">&rarr;</button></nav>
            <div><button type="button" data-editor-tool-open="flight-path">Edit manually</button><button type="button" data-editor-tool-ai="flight-path">Ask AI</button></div>
          </article>
          <article class="airstrike-editor-tool-card" data-editor-tool-card="ordnance">
            <header><span>Ordnance</span><small>Payload</small></header>
            <strong data-editor-summary-ordnance>No releases</strong>
            <p data-editor-summary-ordnance-detail>Manual release mode.</p>
            <nav aria-label="Selected ordnance"><button type="button" data-editor-step-selection="ordnance:-1" aria-label="Previous ordnance item">&larr;</button><button type="button" data-editor-step-selection="ordnance:1" aria-label="Next ordnance item">&rarr;</button></nav>
            <div><button type="button" data-editor-tool-open="ordnance">Edit manually</button><button type="button" data-editor-tool-ai="ordnance">Ask AI</button></div>
          </article>
          <article class="airstrike-editor-tool-card" data-editor-tool-card="view-validation">
            <header><span>View &amp; Validation</span><small>Review</small></header>
            <strong data-editor-summary-validation>Not validated</strong>
            <p data-editor-summary-validation-detail>3 of 3 reference layers visible.</p>
            <div><button type="button" data-editor-tool-open="view-validation">Open review tools</button></div>
          </article>
        </div>
        <section class="airstrike-agent-panel" data-editor-agent-panel hidden aria-label="Airstrike AI agent">
          <div class="airstrike-agent-threadbar">
            <select data-agent-thread aria-label="Agent conversation"><option value="">New conversation</option></select>
            <button type="button" data-agent-new title="New conversation">+</button>
            <button type="button" data-agent-delete title="Delete conversation">×</button>
          </div>
          <div class="airstrike-agent-mode" role="group" aria-label="Agent mode">
            <button class="is-active" type="button" data-agent-mode="plan">Plan</button>
            <button type="button" data-agent-mode="regular">Regular</button>
            <span data-agent-context-note>Current draft context</span>
          </div>
          <div class="airstrike-agent-unavailable" data-agent-unavailable hidden></div>
          <div class="airstrike-agent-messages" data-agent-messages aria-live="polite"></div>
          <article class="airstrike-agent-proposal" data-agent-proposal hidden>
            <header><strong>Proposed profile change</strong><span data-agent-proposal-status></span></header>
            <div data-agent-proposal-summary></div>
            <div class="airstrike-agent-proposal-actions">
              <button type="button" class="airstrike-editor-action-button" data-agent-apply>Apply to draft</button>
              <button type="button" class="airstrike-editor-action-button" data-agent-discard>Discard</button>
              <button type="button" class="airstrike-editor-action-button" data-agent-undo hidden>Undo agent edit</button>
              <button type="button" class="airstrike-editor-action-button" data-agent-rerun hidden>Rerun on current draft</button>
            </div>
          </article>
          <form class="airstrike-agent-composer" data-agent-form>
            <textarea rows="3" maxlength="12000" data-agent-input placeholder="Describe the route or ordnance change…"></textarea>
            <div>
              <button type="button" class="airstrike-editor-action-button" data-agent-use-plan hidden>Use this plan</button>
              <span data-agent-run-status></span>
              <button type="submit" class="airstrike-editor-action-button" data-agent-send>Send</button>
            </div>
          </form>
        </section>
      </aside>

      <dialog class="airstrike-tool-dialog airstrike-tool-dialog-profile" data-editor-tool-dialog="profile" aria-labelledby="airstrike-tool-profile-title">
        <div class="airstrike-tool-shell">
          <header class="airstrike-tool-head"><div><p class="section-kicker">Profile</p><h2 id="airstrike-tool-profile-title">Profile Setup</h2></div><div class="airstrike-tool-window-actions"><button type="button" data-editor-tool-minimize aria-label="Minimize profile setup" title="Minimize">&minus;</button><button type="button" data-editor-tool-close aria-label="Close profile setup" title="Close">&times;</button></div></header>
          <div class="airstrike-tool-layout">
            <section class="airstrike-tool-content airstrike-tool-column" data-editor-tool-column="profile-details" data-editor-tool-column-label="Profile details">
              <p class="airstrike-editor-muted">Set the stable draft identity, preview vehicle, and notes shared with the AI helper.</p>
              <label class="admin-field"><span>Profile key</span><input type="text" maxlength="100" data-editor-key pattern="[a-z0-9][a-z0-9._-]{0,99}"></label>
              <label class="admin-field"><span>Display name</span><input type="text" maxlength="160" data-editor-name></label>
              <label class="admin-field"><span>Vehicle</span><select data-editor-vehicle><option value="drone">Drone</option><option value="cargo_plane">Cargo plane</option><option value="f15">F-15</option><option value="a10">A-10</option><option value="attack_heli">Attack helicopter</option></select></label>
              <label class="admin-field"><span>Profile notes</span><textarea rows="6" maxlength="5000" data-editor-notes placeholder="Intent, constraints, or reminders for this profile"></textarea></label>
            </section>
            <aside class="airstrike-context-agent airstrike-tool-column" data-editor-tool-column="profile-ai" data-editor-tool-column-label="Profile AI" data-agent-context-rail data-agent-scope="profile"></aside>
          </div>
          <footer class="airstrike-tool-footer"><span data-editor-tool-session-status>No unapplied changes</span><button type="button" data-editor-tool-cancel>Cancel</button><button type="button" data-editor-tool-apply>Apply</button></footer>
        </div>
      </dialog>

      <dialog class="airstrike-tool-dialog airstrike-tool-dialog-wide" data-editor-tool-dialog="flight-path" aria-labelledby="airstrike-tool-flight-title">
        <div class="airstrike-tool-shell">
          <header class="airstrike-tool-head"><div><p class="section-kicker">Route</p><h2 id="airstrike-tool-flight-title">Flight Path</h2></div><div class="airstrike-tool-window-actions"><button type="button" data-editor-tool-minimize aria-label="Minimize flight path" title="Minimize">&minus;</button><button type="button" data-editor-tool-close aria-label="Close flight path" title="Close">&times;</button></div></header>
          <div class="airstrike-tool-layout">
            <section class="airstrike-tool-content airstrike-flight-workspace">
              <aside class="airstrike-workspace-collection airstrike-tool-column" data-editor-tool-column="flight-waypoints" data-editor-tool-column-label="Waypoints"><header><div><button type="button" data-editor-waypoint-add>Add</button><button type="button" data-editor-waypoint-duplicate>Duplicate</button><button type="button" data-editor-waypoint-delete>Delete</button></div></header><div class="airstrike-waypoint-list" data-editor-waypoints></div></aside>
              <div class="airstrike-workspace-editor">
                <section class="airstrike-workspace-section airstrike-tool-column" data-editor-tool-column="flight-waypoint-settings" data-editor-tool-column-label="Waypoint settings"><h3 data-editor-waypoint-title>No waypoint selected</h3><div class="airstrike-waypoint-inspector"><label><span>Time</span><input type="number" step="0.01" data-editor-waypoint-field="Time"></label><p>Position</p><label><span>X</span><input type="number" step="0.1" data-editor-waypoint-field="X"></label><label><span>Y</span><input type="number" step="0.1" data-editor-waypoint-field="Y"></label><label><span>Z</span><input type="number" step="0.1" data-editor-waypoint-field="Z"></label><p>Rotation offset</p><label><span>Rot X</span><input type="number" step="0.1" data-editor-waypoint-field="RotationX"></label><label><span>Rot Y</span><input type="number" step="0.1" data-editor-waypoint-field="RotationY"></label><label><span>Rot Z</span><input type="number" step="0.1" data-editor-waypoint-field="RotationZ"></label></div><label class="admin-field"><span>Target speed (m/s)</span><input type="number" min="0.1" max="500" step="0.1" data-editor-waypoint-speed></label><p class="airstrike-editor-muted" data-editor-waypoint-speed-mph></p></section>
                <section class="airstrike-workspace-section airstrike-tool-column" data-editor-tool-column="flight-route-behavior" data-editor-tool-column-label="Route behavior"><h3>Global route behavior</h3><label class="admin-field"><span>Vehicle orientation</span><select data-editor-rotation-mode><option value="follow_path_plus_offset">Follow path + rotation offset</option><option value="authored_orientation">Full manual rotation</option></select></label><p class="airstrike-editor-muted">Full manual rotation keeps Rot X/Y/Z entirely under your control.</p><label class="admin-field"><span>Global target speed (m/s)</span><input type="number" min="0.1" max="500" step="0.1" data-editor-global-speed></label><p class="airstrike-editor-muted" data-editor-global-speed-mph></p><div class="airstrike-editor-inline-actions"><button class="airstrike-editor-action-button" type="button" data-editor-normalize-times>Normalize Times</button><button class="airstrike-editor-action-button" type="button" data-editor-infer-speeds>Infer From Current Times</button></div></section>
              </div>
            </section>
            <aside class="airstrike-context-agent airstrike-tool-column" data-editor-tool-column="flight-ai" data-editor-tool-column-label="Flight Path AI" data-agent-context-rail data-agent-scope="flight-path"></aside>
          </div>
          <footer class="airstrike-tool-footer"><span data-editor-tool-session-status>No unapplied changes</span><button type="button" data-editor-tool-cancel>Cancel</button><button type="button" data-editor-tool-apply>Apply</button></footer>
        </div>
      </dialog>

      <dialog class="airstrike-tool-dialog airstrike-tool-dialog-wide" data-editor-tool-dialog="ordnance" aria-labelledby="airstrike-tool-ordnance-title">
        <div class="airstrike-tool-shell">
          <header class="airstrike-tool-head"><div><p class="section-kicker">Payload</p><h2 id="airstrike-tool-ordnance-title">Ordnance Editor</h2></div><div class="airstrike-tool-window-actions"><button type="button" data-editor-tool-minimize aria-label="Minimize ordnance editor" title="Minimize">&minus;</button><button type="button" data-editor-tool-close aria-label="Close ordnance editor" title="Close">&times;</button></div></header>
          <div class="airstrike-tool-layout">
            <section class="airstrike-tool-content airstrike-ordnance-workspace">
              <div class="airstrike-ordnance-schedule-column airstrike-tool-column" data-editor-tool-column="ordnance-schedule" data-editor-tool-column-label="Schedule &amp; events">
                <div class="airstrike-ordnance-overview"><label class="admin-field"><span>Release source</span><select data-editor-release-mode><option value="manual">Manual events</option><option value="repeated">Automatic groups</option><option value="mixed">Mixed events + groups</option></select></label><strong data-editor-ordnance-schedule-summary>No scheduled payloads</strong></div>
                <div class="airstrike-release-timeline" data-editor-workspace-release-timeline></div>
                <aside class="airstrike-workspace-collection airstrike-ordnance-collections">
                  <section data-editor-manual-collection><header><strong>Manual events</strong><button type="button" data-editor-add-manual-release>Add event</button></header><div class="airstrike-release-list" data-editor-manual-releases></div></section>
                  <section data-editor-repeated-collection><header><strong>Automatic groups</strong><button type="button" data-editor-add-repeated-group>Add group</button></header><div class="airstrike-release-list" data-editor-repeated-releases></div></section>
                </aside>
              </div>
              <div class="airstrike-workspace-editor airstrike-ordnance-editor-column airstrike-tool-column" data-editor-tool-column="ordnance-editor" data-editor-tool-column-label="Payload editor">
                <div class="airstrike-ordnance-editor-actions"><button type="button" data-editor-release-add hidden>Add selected kind</button><button type="button" data-editor-release-duplicate>Duplicate selected</button><button type="button" data-editor-release-delete>Delete selected</button></div>
                <nav class="airstrike-ordnance-tabs" role="tablist" aria-label="Ordnance fields"><button class="is-active" type="button" data-editor-ordnance-tab="basic">Basic</button><button type="button" data-editor-ordnance-tab="targeting">Targeting</button><button type="button" data-editor-ordnance-tab="advanced">Advanced</button><button type="button" data-editor-ordnance-tab="audio">Audio</button></nav>
                <div class="airstrike-release-editor" data-editor-manual-editor></div><div class="airstrike-release-editor" data-editor-repeated-editor></div><div class="airstrike-release-editor" data-editor-audio-editor data-ordnance-section="audio"></div>
              </div>
            </section>
            <aside class="airstrike-context-agent airstrike-tool-column" data-editor-tool-column="ordnance-ai" data-editor-tool-column-label="Ordnance AI" data-agent-context-rail data-agent-scope="ordnance"></aside>
          </div>
          <footer class="airstrike-tool-footer"><span data-editor-tool-session-status>No unapplied changes</span><button type="button" data-editor-tool-cancel>Cancel</button><button type="button" data-editor-tool-apply>Apply</button></footer>
        </div>
      </dialog>

      <dialog class="airstrike-tool-dialog" data-editor-tool-dialog="view-validation" aria-labelledby="airstrike-tool-view-title">
        <div class="airstrike-tool-shell">
          <header class="airstrike-tool-head"><div><p class="section-kicker">Review</p><h2 id="airstrike-tool-view-title">View &amp; Validation</h2></div><div class="airstrike-tool-window-actions"><button type="button" data-editor-tool-minimize aria-label="Minimize review tools" title="Minimize">&minus;</button><button type="button" data-editor-tool-close aria-label="Close review tools" title="Close">&times;</button></div></header>
          <div class="airstrike-tool-layout">
            <section class="airstrike-tool-content airstrike-tool-column" data-editor-tool-column="view-review" data-editor-tool-column-label="Review tools"><div class="airstrike-editor-reference-toggles"><label class="airstrike-editor-checkbox"><input type="checkbox" data-editor-terrain-reference checked><span><strong>Map heightmap</strong><small>Rust terrain surface</small></span></label><label class="airstrike-editor-checkbox"><input type="checkbox" data-editor-ground-grid checked><span><strong>Meter grid</strong><small>Flat scale grid</small></span></label><label class="airstrike-editor-checkbox"><input type="checkbox" data-editor-scene-extras checked><span><strong>Scene extras</strong><small>Players, crates, and scale props</small></span></label></div><div class="airstrike-editor-inline-actions"><button class="airstrike-editor-action-button" type="button" data-editor-validate>Validate profile</button><button class="airstrike-editor-action-button" type="button" data-editor-compile>Compile preview</button></div><div class="airstrike-editor-validation" data-editor-feedback>Load or create a profile, then validate before publishing.</div><article class="airstrike-review-compile"><strong data-editor-compile-summary-review>No compiled track yet</strong><pre data-editor-output-review></pre></article></section>
            <aside class="airstrike-context-agent airstrike-tool-column" data-editor-tool-column="view-ai" data-editor-tool-column-label="Review AI" data-agent-context-rail data-agent-scope="view-validation"></aside>
          </div>
          <footer class="airstrike-tool-footer"><span>View controls apply immediately.</span><button type="button" data-editor-tool-close>Close</button></footer>
        </div>
      </dialog>

      <section class="airstrike-editor-bottom">
        <div class="airstrike-editor-bottom-head">
          <div>
            <p class="section-kicker">Timeline</p>
            <strong>Playback</strong>
          </div>
          <button class="airstrike-editor-panel-collapse airstrike-editor-panel-collapse-bottom" type="button" data-editor-toggle-panel="bottom" aria-label="Minimize timeline" title="Minimize timeline"></button>
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
              <button class="airstrike-editor-icon-button" type="button" data-editor-play data-icon="▶" aria-label="Play" title="Play">Play</button>
              <button class="airstrike-editor-icon-button" type="button" data-editor-step-back data-icon="↶" aria-label="Step backward 0.1 seconds" title="Step backward 0.1s">-0.1s</button>
              <button class="airstrike-editor-icon-button" type="button" data-editor-step-forward data-icon="↷" aria-label="Step forward 0.1 seconds" title="Step forward 0.1s">+0.1s</button>
              <label class="airstrike-editor-checkbox" title="Loop playback"><input type="checkbox" data-editor-loop> <span>Loop</span></label>
              <label class="airstrike-editor-checkbox" title="Follow vehicle"><input type="checkbox" data-editor-follow-vehicle> <span>Follow</span></label>
              <label class="airstrike-editor-checkbox" title="Ride vehicle camera"><input type="checkbox" data-editor-ride-vehicle> <span>Ride</span></label>
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
