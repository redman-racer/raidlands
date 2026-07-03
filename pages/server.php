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

<section class="section alt">
  <div class="section-inner">
    <div class="metal-panel server-history-panel" data-server-history>
      <div class="server-history-head">
        <div>
          <p class="section-kicker">Live feed</p>
          <h2>Recent server activity</h2>
          <p class="section-lede">Population, queue, and availability from Raidlands heartbeats.</p>
        </div>
        <div class="server-history-metrics" aria-label="Recent server history summary">
          <span><small>Window</small><strong data-history-window>6 hours</strong></span>
          <span><small>Availability</small><strong data-history-uptime>Waiting</strong></span>
          <span><small>Peak players</small><strong data-history-peak>0</strong></span>
          <span><small>Avg players</small><strong data-history-average>0</strong></span>
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
        <span><small><span data-history-samples>0</span> samples</small></span>
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
