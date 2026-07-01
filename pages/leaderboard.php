<?php

require_once $site_root . '/includes/stats.php';

$leaderboard_ready = raidlands_stats_is_ready();
$leaderboard_scope = raidlands_stats_scope((string) ($_GET['scope'] ?? 'current'));
$leaderboard_metric = raidlands_stats_metric((string) ($_GET['metric'] ?? 'kills'));
$leaderboard_rows = $leaderboard_ready
    ? raidlands_stats_leaderboard($leaderboard_metric, $leaderboard_scope, 25)
    : [];
$leaderboard_wipe = $leaderboard_ready ? raidlands_stats_active_wipe() : null;
$leaderboard_ingest = $leaderboard_ready ? raidlands_stats_latest_ingest() : null;
$leaderboard_metrics = [
    'kills' => 'Kills',
    'kdr' => 'K/D',
    'playtime' => 'Playtime',
    'rp' => 'RP',
];

function leaderboard_url(string $scope, string $metric): string
{
    return route_url('leaderboard') . '?scope=' . rawurlencode($scope) . '&metric=' . rawurlencode($metric);
}

function leaderboard_metric_value(array $row, string $metric): string
{
    return match ($metric) {
        'kdr' => raidlands_stats_format_kdr($row['kdr'] ?? 0),
        'playtime' => raidlands_stats_format_duration($row['playtime_seconds'] ?? 0),
        'rp' => raidlands_stats_format_number($row['reward_points'] ?? 0),
        default => raidlands_stats_format_number($row['kills'] ?? 0),
    };
}
?>
<?= render_page_hero('leaderboard',
    '<a class="btn btn-primary" href="' . e(route_url('play')) . '">Join Server</a>'
    . '<a class="btn btn-secondary" href="' . e(route_url('profile')) . '">View Profile</a>'
) ?>

<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <p class="section-kicker">Rankings</p>
      <h2>Player standings</h2>
      <p class="section-lede">Stats update from the game server into the website. Current wipe rankings start with this wipe; all-time totals combine tracked seasons.</p>
    </div>

    <div class="leaderboard-toolbar">
      <div class="leaderboard-tabs" aria-label="Leaderboard scope">
        <a class="<?= $leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('current', $leaderboard_metric)) ?>">Current Wipe</a>
        <a class="<?= $leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('all-time', $leaderboard_metric)) ?>">All Time</a>
      </div>
      <div class="leaderboard-tabs" aria-label="Leaderboard metric">
        <?php foreach ($leaderboard_metrics as $metric_key => $metric_label) : ?>
          <a class="<?= $leaderboard_metric === $metric_key ? 'is-active' : '' ?>" href="<?= e(leaderboard_url($leaderboard_scope, $metric_key)) ?>"><?= e($metric_label) ?></a>
        <?php endforeach; ?>
      </div>
    </div>

    <?php if (!$leaderboard_ready) : ?>
      <div class="form-status warning">Leaderboards are waiting on stats setup before they can receive server data.</div>
    <?php elseif ($leaderboard_rows === []) : ?>
      <div class="metal-panel">
        <p class="section-kicker">No stats yet</p>
        <h2>Waiting for the first server update</h2>
        <p class="section-lede">Once the server sends stats, this page will fill with current-wipe and all-time standings.</p>
      </div>
    <?php else : ?>
      <div class="split-panel leaderboard-summary">
        <div class="metal-panel">
          <p class="section-kicker">Active wipe</p>
          <h3><?= e((string) ($leaderboard_wipe['wipe_key'] ?? 'Unknown')) ?></h3>
          <p class="store-muted">Started <?= e((string) ($leaderboard_wipe['started_at'] ?? 'Not recorded')) ?></p>
        </div>
        <div class="metal-panel">
          <p class="section-kicker">Last update</p>
          <h3><?= e((string) ($leaderboard_ingest['created_at'] ?? 'Pending')) ?></h3>
          <p class="store-muted"><?= e((string) ($leaderboard_ingest['players_accepted'] ?? 0)) ?> players accepted</p>
        </div>
      </div>

      <div class="store-table-wrap leaderboard-table-wrap">
        <table class="store-table leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th><?= e($leaderboard_metrics[$leaderboard_metric]) ?></th>
              <th>Kills</th>
              <th>Deaths</th>
              <th>K/D</th>
              <th>Playtime</th>
              <th>RP</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($leaderboard_rows as $row) : ?>
              <?php
                $leaderboard_name = (string) ($row['display_name'] ?: ($row['steam_display_name'] ?? 'Raidlands Player'));
                $leaderboard_avatar = render_steam_avatar(
                    (string) ($row['steam_avatar_url'] ?? ''),
                    (string) ($row['steam_profile_url'] ?? ''),
                    $leaderboard_name,
                    'steam-avatar-sm'
                );
                $leaderboard_profile_url = trim((string) ($row['steam_profile_url'] ?? ''));
              ?>
              <tr>
                <td><span class="leaderboard-rank">#<?= e((string) $row['rank']) ?></span></td>
                <td>
                  <div class="leaderboard-player">
                    <?= $leaderboard_avatar ?>
                    <span class="leaderboard-player-copy">
                      <strong><?= e($leaderboard_name) ?></strong>
                      <?php if ($leaderboard_profile_url !== '') : ?>
                        <a class="leaderboard-steam" href="<?= e($leaderboard_profile_url) ?>" target="_blank" rel="noopener noreferrer"><?= e((string) $row['steam_id64']) ?></a>
                      <?php else : ?>
                        <span class="leaderboard-steam"><?= e((string) $row['steam_id64']) ?></span>
                      <?php endif; ?>
                    </span>
                  </div>
                </td>
                <td><strong><?= e(leaderboard_metric_value($row, $leaderboard_metric)) ?></strong></td>
                <td><?= e(raidlands_stats_format_number($row['kills'])) ?></td>
                <td><?= e(raidlands_stats_format_number($row['deaths'])) ?></td>
                <td><?= e(raidlands_stats_format_kdr($row['kdr'])) ?></td>
                <td><?= e(raidlands_stats_format_duration($row['playtime_seconds'])) ?></td>
                <td><?= e(raidlands_stats_format_number($row['reward_points'])) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </div>
</section>
