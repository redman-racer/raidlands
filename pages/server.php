<?php

require_once $site_root . '/includes/server-status.php';

$server_status = raidlands_server_status_public();
$server_online = $server_status['online'] ?? null;
$server_status_class = $server_online === true ? 'active' : ($server_online === false ? 'failed' : 'pending');
$server_updated_at = (string) ($server_status['updatedAt'] ?: $server_status['receivedAt'] ?: '');
$server_updated_label = $server_updated_at !== ''
    ? date('M j, g:i A', strtotime($server_updated_at))
    : 'Pending';
$server_source_label = (string) ($server_status['sourceLabel'] ?? 'site fallback');
$server_age = isset($server_status['ageSeconds']) ? max(0, (int) $server_status['ageSeconds']) : null;
$server_age_label = $server_age === null
    ? 'Waiting on first heartbeat'
    : ($server_age < 60 ? $server_age . 's old' : floor($server_age / 60) . 'm ' . str_pad((string) ($server_age % 60), 2, '0', STR_PAD_LEFT) . 's old');
$server_health_label = raidlands_server_page_health_label($server_status);
$server_map_image = is_array($server_status['mapImage'] ?? null) ? $server_status['mapImage'] : null;
$server_map_url = (string) ($server_status['mapImageUrl'] ?? ($server_map_image['url'] ?? ''));
$server_terrain_url = (string) ($server_map_image['terrainUrl'] ?? '');
$server_texture_url = (string) ($server_map_image['textureUrl'] ?? $server_map_url);
$server_skybox_url = trim((string) ($server_map_image['skyboxUrl'] ?? ''));
if ($server_skybox_url === '') {
    $server_skybox_url = asset_url('media/skyboxes/raidlands-current-skybox.png');
}

function raidlands_server_page_value($value, string $fallback = 'Pending'): string
{
    if ($value === null || $value === '') {
        return $fallback;
    }

    return (string) $value;
}

function raidlands_server_page_number($value, string $fallback = '0'): string
{
    if ($value === null || $value === '') {
        return $fallback;
    }

    return number_format((int) $value);
}

function raidlands_server_page_health_label(array $status): string
{
    if (!empty($status['stale'])) {
        return 'Delayed';
    }

    if (($status['source'] ?? '') === 'fallback') {
        return 'Fallback';
    }

    if (($status['online'] ?? null) === true) {
        return 'Ready';
    }

    if (($status['online'] ?? null) === false) {
        return 'Offline';
    }

    return (string) ($status['statusLabel'] ?? 'Pending');
}

function raidlands_server_page_date($value, string $fallback = 'Pending'): string
{
    if ($value === null || $value === '') {
        return $fallback;
    }

    $timestamp = strtotime((string) $value);

    return $timestamp === false ? $fallback : date('M j, g:i A', $timestamp);
}
?>

<?= render_page_hero('server',
    '<a class="btn btn-primary" href="' . e($site_config['steamConnectUrl']) . '" data-track="join_server_clicked">Launch Rust</a>'
    . '<button class="btn btn-secondary" type="button" data-copy-command>Copy Connect</button>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="server-health-band">
      <div>
        <p class="section-kicker">Live status</p>
        <h2><?= e((string) ($server_status['statusLabel'] ?? 'Status Pending')) ?></h2>
        <p class="section-lede"><?= e($server_source_label) ?><?= !empty($server_status['stale']) ? ' with last known server numbers.' : ' from the game server.' ?></p>
      </div>
      <span class="status-pill <?= e($server_status_class) ?>"><?= e((string) ($server_status['statusLabel'] ?? 'Pending')) ?></span>
    </div>

    <div class="grid three server-health-grid">
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Population</p>
        <h3><?= e(raidlands_server_page_number($server_status['players'] ?? 0)) ?> / <?= e(raidlands_server_page_number($server_status['maxPlayers'] ?? $site_config['maxPlayers'])) ?></h3>
        <p class="store-muted">Players online</p>
      </article>
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Queue</p>
        <h3><?= e(raidlands_server_page_number($server_status['queue'] ?? 0)) ?></h3>
        <p class="store-muted"><?= e(raidlands_server_page_number($server_status['joining'] ?? 0)) ?> joining / <?= e(raidlands_server_page_number($server_status['sleepers'] ?? 0)) ?> sleepers</p>
      </article>
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Health</p>
        <h3><?= e($server_health_label) ?></h3>
        <p class="store-muted">Heartbeat <?= e($server_age_label) ?></p>
      </article>
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Map</p>
        <h3><?= e(raidlands_server_page_value($server_status['mapName'] ?? $site_config['mapName'])) ?></h3>
        <p class="store-muted">World <?= e(raidlands_server_page_number($server_status['worldSize'] ?? 0, 'Pending')) ?> / seed <?= e(raidlands_server_page_number($server_status['seed'] ?? 0, 'Pending')) ?></p>
      </article>
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Wipe</p>
        <h3 data-next-wipe>Loading</h3>
        <p class="store-muted">Started <?= e(raidlands_server_page_date($server_status['wipeStartedAt'] ?? '', 'pending')) ?></p>
      </article>
      <article class="metal-panel server-stat-panel">
        <p class="section-kicker">Updated</p>
        <h3><?= e($server_updated_label) ?></h3>
        <p class="store-muted"><?= e($server_age_label) ?></p>
      </article>
    </div>
  </div>
</section>

<?php if ($server_map_url !== ''): ?>
<section class="section alt">
  <div class="section-inner">
    <div class="metal-panel server-map-panel">
      <div class="server-map-copy">
        <p class="section-kicker">Current map</p>
        <h2>Latest wipe map</h2>
        <p class="section-lede">Generated from the live Raidlands game server.</p>
        <dl class="server-map-meta">
          <div><dt>Render</dt><dd><?= e(raidlands_server_page_value($server_map_image['renderName'] ?? '', 'Map')) ?></dd></div>
          <div><dt>Seed</dt><dd><?= e(raidlands_server_page_number($server_map_image['seed'] ?? ($server_status['seed'] ?? 0), 'Pending')) ?></dd></div>
          <div><dt>Published</dt><dd><?= e(raidlands_server_page_date($server_map_image['publishedAt'] ?? '', 'Pending')) ?></dd></div>
        </dl>
      </div>
      <a class="server-map-frame" href="<?= e($server_map_url) ?>" target="_blank" rel="noopener">
        <img src="<?= e($server_map_url) ?>" alt="Current Raidlands wipe map" loading="lazy">
      </a>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($server_terrain_url !== ''): ?>
<section class="section alt">
  <div class="section-inner">
    <div class="metal-panel server-terrain-panel">
      <div class="server-terrain-head">
        <div>
          <p class="section-kicker">Current wipe terrain</p>
          <h2>3D map viewer</h2>
          <p class="section-lede">Height, water, and surface color sampled from the live Raidlands map publish.</p>
        </div>
        <div class="server-terrain-controls" data-map-viewer-controls>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-grid>
            <span>Grid coordinates</span>
          </label>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-tour>
            <span>Camera flyover</span>
          </label>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-heatmap>
            <span>Heat map</span>
          </label>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-heatmap-playback>
            <span>Playback</span>
          </label>
          <button type="button" data-map-viewer-heatmap-play aria-pressed="false">Play</button>
          <div class="server-terrain-speed-controls" aria-label="Playback speed">
            <button type="button" data-map-viewer-heatmap-speed-down aria-label="Slow playback" title="Slow playback">-</button>
            <output data-map-viewer-heatmap-speed-label>1x</output>
            <button type="button" data-map-viewer-heatmap-speed-up aria-label="Speed up playback" title="Speed up playback">+</button>
          </div>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-heatmap-loop>
            <span>Loop</span>
          </label>
          <label class="server-terrain-field server-terrain-playback-field">
            <span>Timeline <output data-map-viewer-heatmap-frame-label>Latest</output></span>
            <input type="range" min="0" max="15" value="15" data-map-viewer-heatmap-frame>
          </label>
          <label class="server-terrain-field server-terrain-frame-field">
            <span>Frames <output data-map-viewer-heatmap-frame-count-label>24</output></span>
            <input type="range" min="8" max="72" step="4" value="24" data-map-viewer-heatmap-frame-count>
          </label>
          <label class="server-terrain-toggle">
            <input type="checkbox" checked data-map-viewer-players>
            <span>Clan locations</span>
          </label>
          <button type="button" data-map-viewer-my-location disabled>My location</button>
          <label class="server-terrain-field">
            <span>Metric</span>
            <select data-map-viewer-heatmap-metric>
              <option value="all">All activity</option>
              <option value="deaths">Deaths</option>
              <option value="kills">Kills</option>
              <option value="npc_fights">NPC fights</option>
              <option value="loot_pvp">Loot/PvP activity</option>
              <option value="roambots">RoamBots</option>
            </select>
          </label>
          <label class="server-terrain-field">
            <span>Range</span>
            <select data-map-viewer-heatmap-range>
              <option value="15m">15M</option>
              <option value="30m">30M</option>
              <option value="1h">1H</option>
              <option value="3h">3H</option>
              <option value="6h" selected>6H</option>
              <option value="12h">12H</option>
              <option value="24h">24H</option>
              <option value="wipe">Wipe</option>
            </select>
          </label>
        </div>
      </div>
      <div
        class="server-terrain-viewer"
        data-server-map-viewer
        data-terrain-url="<?= e($server_terrain_url) ?>"
        data-texture-url="<?= e($server_texture_url) ?>"
        data-skybox-url="<?= e($server_skybox_url) ?>"
        data-status-url="<?= e(route_url('api/server-status.php')) ?>"
        data-terrain-hash="<?= e((string) ($server_map_image['terrainHash'] ?? '')) ?>"
        data-skybox-hash="<?= e((string) ($server_map_image['skyboxHash'] ?? '')) ?>"
        data-map-published-at="<?= e((string) ($server_map_image['publishedAt'] ?? '')) ?>"
        data-heatmap-url="<?= e(route_url('api/server/heatmap.php')) ?>"
        data-player-locations-url="<?= e(route_url('api/server/player-locations.php')) ?>"
        data-camera-tour="true"
        data-camera-locked="false"
        data-grid-overlay="true"
        data-world-size="<?= e((string) ($server_map_image['worldSize'] ?? $server_status['worldSize'] ?? 0)) ?>"
        data-min-height="<?= e((string) ($server_map_image['terrainMinHeight'] ?? 0)) ?>"
        data-max-height="<?= e((string) ($server_map_image['terrainMaxHeight'] ?? 0)) ?>"
        aria-label="Current Raidlands wipe 3D terrain viewer">
        <p class="server-terrain-status" data-map-viewer-status>Loading terrain.</p>
      </div>
    </div>
  </div>
</section>
<script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/server-map-viewer.js')) ?>"></script>
<?php endif; ?>

<section class="section alt">
  <div class="section-inner">
    <div class="metal-panel server-history-panel" data-server-history>
      <div class="server-history-head">
        <div>
          <p class="section-kicker">Live feed</p>
          <h2>Recent server activity</h2>
          <p class="section-lede">Population, queue, and availability from Raidlands heartbeats.</p>
        </div>
        <div class="server-history-controls" role="group" aria-label="Server history range">
          <button type="button" data-server-history-range="6h" aria-pressed="true">6H</button>
          <button type="button" data-server-history-range="24h" aria-pressed="false">24H</button>
          <button type="button" data-server-history-range="30d" aria-pressed="false">30D</button>
          <button type="button" data-server-history-range="12mo" aria-pressed="false">12M</button>
        </div>
        <div class="server-history-metrics" aria-label="Recent server history summary">
          <span><small>Window</small><strong data-history-window>6 hours</strong></span>
          <span><small>Availability</small><strong data-history-uptime>Waiting</strong></span>
          <span><small>Peak players</small><strong data-history-peak>0</strong></span>
          <span><small>Avg players</small><strong data-history-average>0</strong></span>
          <span><small>Downtime</small><strong data-history-downtime>0</strong></span>
        </div>
      </div>
      <div class="server-history-chart-wrap">
        <canvas data-server-history-chart width="960" height="300" aria-label="Recent Raidlands population, queue, and availability"></canvas>
        <p class="server-history-empty" data-server-history-empty>Waiting for live heartbeat samples.</p>
      </div>
      <div class="server-history-legend" aria-label="Chart legend">
        <span><i class="legend-population" aria-hidden="true"></i> Players</span>
        <span><i class="legend-queue" aria-hidden="true"></i> Queue</span>
        <span><i class="legend-online" aria-hidden="true"></i> Online</span>
        <span><i class="legend-offline" aria-hidden="true"></i> Offline</span>
        <span><small><span data-history-samples>0</span> <span data-history-sample-label>samples</span></small></span>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-inner split-panel">
    <div class="metal-panel server-detail-panel">
      <p class="section-kicker">Server details</p>
      <h2>Current battlefield snapshot</h2>
      <dl class="server-detail-list">
        <div><dt>Name</dt><dd><?= e(raidlands_server_page_value($server_status['name'] ?? $site_config['serverName'])) ?></dd></div>
        <div><dt>Region</dt><dd><?= e($site_config['region']) ?></dd></div>
        <div><dt>Map</dt><dd><?= e(raidlands_server_page_value($server_status['mapName'] ?? $site_config['mapName'])) ?></dd></div>
        <div><dt>World size</dt><dd><?= e(raidlands_server_page_number($server_status['worldSize'] ?? 0, 'Pending')) ?></dd></div>
        <div><dt>Seed</dt><dd><?= e(raidlands_server_page_number($server_status['seed'] ?? 0, 'Pending')) ?></dd></div>
        <div><dt>Feed</dt><dd><?= e($server_source_label) ?></dd></div>
        <div><dt>Last update</dt><dd><?= e($server_updated_label) ?></dd></div>
      </dl>
    </div>
    <div class="metal-panel server-connect-panel">
      <p class="section-kicker">Connect</p>
      <h2>Jump straight in</h2>
      <p class="section-lede">Use the direct Steam launch, or copy the console command and paste it in Rust with F1.</p>
      <?= render_command_box() ?>
      <div class="button-row">
        <a class="btn btn-primary" href="<?= e($site_config['steamConnectUrl']) ?>" data-track="join_server_clicked">Launch Rust</a>
        <button class="btn btn-secondary" type="button" data-copy-command>Copy Command</button>
      </div>
    </div>
  </div>
</section>
