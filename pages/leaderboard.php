<?php

require_once $site_root . '/includes/stats.php';

$leaderboard_ready = raidlands_stats_is_ready();
$leaderboard_board = ((string) ($_GET['board'] ?? 'players')) === 'bots' ? 'bots' : 'players';
$leaderboard_scope = raidlands_stats_scope((string) ($_GET['scope'] ?? 'current'));
$leaderboard_wipe_id = raidlands_stats_wipe_id($_GET['wipe_id'] ?? 0);
$leaderboard_wipe_key = raidlands_stats_optional_wipe_key($_GET['wipe_key'] ?? '');

if ($leaderboard_wipe_id > 0 || $leaderboard_wipe_key !== '') {
    $leaderboard_scope = 'wipe';
}

$leaderboard_page = raidlands_stats_page_number($_GET['page'] ?? 1);
$leaderboard_per_page = raidlands_stats_page_size($_GET['per_page'] ?? 25);
$leaderboard_search = raidlands_stats_search((string) ($_GET['q'] ?? ''));
$leaderboard_metric_query = (string) ($_GET['metric'] ?? '');
$leaderboard_player_metric = $leaderboard_board === 'players'
    ? raidlands_stats_metric($leaderboard_metric_query)
    : 'kills';
$leaderboard_bot_metric = $leaderboard_board === 'bots'
    ? raidlands_stats_bot_metric($leaderboard_metric_query)
    : 'kdr';
$leaderboard_player_result = $leaderboard_ready
    ? raidlands_stats_leaderboard_result(
        $leaderboard_player_metric,
        $leaderboard_scope,
        $leaderboard_board === 'players' ? $leaderboard_page : 1,
        $leaderboard_per_page,
        $leaderboard_search,
        $leaderboard_wipe_id,
        $leaderboard_wipe_key
    )
    : raidlands_stats_page_result([], 0, 1, $leaderboard_per_page);
$leaderboard_bot_result = $leaderboard_ready
    ? raidlands_stats_bot_leaderboard_result(
        $leaderboard_scope,
        $leaderboard_board === 'bots' ? $leaderboard_page : 1,
        $leaderboard_per_page,
        $leaderboard_search,
        $leaderboard_bot_metric,
        $leaderboard_wipe_id,
        $leaderboard_wipe_key
    )
    : raidlands_stats_page_result([], 0, 1, $leaderboard_per_page);
$leaderboard_wipe = $leaderboard_ready ? raidlands_stats_active_wipe() : null;
$leaderboard_selected_wipe = $leaderboard_ready && $leaderboard_scope === 'wipe'
    ? raidlands_stats_wipe($leaderboard_wipe_id, $leaderboard_wipe_key)
    : null;
$leaderboard_selected_wipe_id = $leaderboard_selected_wipe !== null
    ? (int) $leaderboard_selected_wipe['id']
    : $leaderboard_wipe_id;
$leaderboard_selected_wipe_key = $leaderboard_selected_wipe !== null
    ? (string) $leaderboard_selected_wipe['wipe_key']
    : $leaderboard_wipe_key;
$leaderboard_wipes = $leaderboard_ready ? raidlands_stats_recent_wipes(30) : [];
$leaderboard_ingest = $leaderboard_ready ? raidlands_stats_latest_ingest() : null;
$leaderboard_metrics = [
    'kills' => 'Kills',
    'kdr' => 'K/D',
    'playtime' => 'Playtime',
    'rp' => 'RP',
    'npc_kills' => 'NPC Kills',
    'deaths_by_npc' => 'Killed by NPCs',
];
$leaderboard_bot_metrics = [
    'kdr' => 'K/D',
    'kills' => 'Kills',
    'deaths' => 'Deaths',
];
$leaderboard_page_sizes = [10, 25, 50, 100];
$leaderboard_api_url = $base_path . 'api/leaderboard.php';

function leaderboard_url(
    string $board = 'players',
    string $scope = 'current',
    string $metric = 'kills',
    int $page = 1,
    int $per_page = 25,
    string $search = '',
    int $wipe_id = 0,
    string $wipe_key = ''
): string {
    $scope = raidlands_stats_scope($scope);
    $query = [
        'board' => $board === 'bots' ? 'bots' : 'players',
        'scope' => $scope,
        'metric' => $board === 'bots' ? raidlands_stats_bot_metric($metric) : raidlands_stats_metric($metric),
        'page' => max(1, $page),
        'per_page' => raidlands_stats_page_size($per_page),
    ];
    $search = raidlands_stats_search($search);
    $wipe_id = raidlands_stats_wipe_id($wipe_id);
    $wipe_key = raidlands_stats_optional_wipe_key($wipe_key);

    if ($scope === 'wipe') {
        if ($wipe_id > 0) {
            $query['wipe_id'] = $wipe_id;
        } elseif ($wipe_key !== '') {
            $query['wipe_key'] = $wipe_key;
        }
    }

    if ($search !== '') {
        $query['q'] = $search;
    }

    return route_url('leaderboard') . '?' . http_build_query($query);
}

function leaderboard_page_summary(array $result): string
{
    $total = (int) ($result['total'] ?? 0);

    if ($total === 0) {
        return '0 results';
    }

    $page = (int) ($result['page'] ?? 1);
    $per_page = (int) ($result['per_page'] ?? 25);
    $start = (($page - 1) * $per_page) + 1;
    $end = min($total, $page * $per_page);

    return number_format($start) . '-' . number_format($end) . ' of ' . number_format($total);
}

function leaderboard_panel_classes(string $board, string $active_board): string
{
    return 'leaderboard-board-panel' . ($board === $active_board ? ' is-active' : '');
}

function leaderboard_wipe_options(array $wipes, int $selected_wipe_id): string
{
    $html = '<option value="">Current wipe</option>';
    $has_previous = false;

    foreach ($wipes as $wipe) {
        if (!empty($wipe['is_active'])) {
            continue;
        }

        $has_previous = true;
        $wipe_id = (int) ($wipe['id'] ?? 0);
        $label = raidlands_stats_wipe_label($wipe);
        $players = (int) ($wipe['player_count'] ?? 0);

        if ($players > 0) {
            $label .= ' - ' . number_format($players) . ' players';
        }

        $html .= '<option value="' . e((string) $wipe_id) . '"' . ($selected_wipe_id === $wipe_id ? ' selected' : '') . '>' . e($label) . '</option>';
    }

    if (!$has_previous) {
        $html .= '<option value="" disabled>No previous wipes yet</option>';
    }

    return $html;
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
      <h2>Raidlands leaderboards</h2>
      <p class="section-lede">Current-wipe and all-time standings update from the game server into the website.</p>
    </div>

    <?php if (!$leaderboard_ready) : ?>
      <div class="form-status warning">Leaderboards are waiting on stats setup before they can receive server data.</div>
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

      <div
        class="leaderboard-shell"
        data-leaderboard
        data-api-url="<?= e($leaderboard_api_url) ?>"
        data-active-board="<?= e($leaderboard_board) ?>">
        <div class="leaderboard-board-tabs" role="tablist" aria-label="Leaderboard type">
          <a
            class="<?= $leaderboard_board === 'players' ? 'is-active' : '' ?>"
            href="<?= e(leaderboard_url('players', $leaderboard_scope, $leaderboard_player_metric, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>"
            role="tab"
            aria-selected="<?= $leaderboard_board === 'players' ? 'true' : 'false' ?>"
            aria-controls="leaderboard-players"
            data-leaderboard-tab="players">Player Stats</a>
          <a
            class="<?= $leaderboard_board === 'bots' ? 'is-active' : '' ?>"
            href="<?= e(leaderboard_url('bots', $leaderboard_scope, $leaderboard_bot_metric, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>"
            role="tab"
            aria-selected="<?= $leaderboard_board === 'bots' ? 'true' : 'false' ?>"
            aria-controls="leaderboard-bots"
            data-leaderboard-tab="bots">Bot Stats</a>
        </div>

        <section
          id="leaderboard-players"
          class="<?= e(leaderboard_panel_classes('players', $leaderboard_board)) ?>"
          role="tabpanel"
          data-leaderboard-panel
          data-board="players"
          data-scope="<?= e($leaderboard_scope) ?>"
          data-wipe-id="<?= e($leaderboard_scope === 'wipe' ? (string) $leaderboard_selected_wipe_id : '') ?>"
          data-wipe-key="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>"
          data-metric="<?= e($leaderboard_player_metric) ?>"
          data-page="<?= e((string) ($leaderboard_player_result['page'] ?? 1)) ?>"
          data-per-page="<?= e((string) ($leaderboard_player_result['per_page'] ?? $leaderboard_per_page)) ?>"
          data-total="<?= e((string) ($leaderboard_player_result['total'] ?? 0)) ?>"
          data-pages="<?= e((string) ($leaderboard_player_result['pages'] ?? 1)) ?>"
          data-search="<?= e($leaderboard_search) ?>"
          <?= $leaderboard_board === 'players' ? '' : 'hidden' ?>>
          <div class="leaderboard-panel-head">
            <div>
              <p class="section-kicker">Player standings</p>
              <h3>Player Stats</h3>
              <p class="section-lede">Sort players by combat, survival time, NPC fights, and ServerRewards RP.</p>
            </div>
            <span class="status-pill" data-leaderboard-count><?= e(leaderboard_page_summary($leaderboard_player_result)) ?></span>
          </div>

          <div class="leaderboard-toolbar">
            <div class="leaderboard-tabs" aria-label="Player leaderboard scope">
              <a class="<?= $leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('players', 'current', $leaderboard_player_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="current">Current Wipe</a>
              <a class="<?= $leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('players', 'all-time', $leaderboard_player_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="all-time">All Time</a>
            </div>
            <div class="leaderboard-tabs" aria-label="Player leaderboard metric">
              <?php foreach ($leaderboard_metrics as $metric_key => $metric_label) : ?>
                <a class="<?= $leaderboard_player_metric === $metric_key ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('players', $leaderboard_scope, $metric_key, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-metric="<?= e($metric_key) ?>"><?= e($metric_label) ?></a>
              <?php endforeach; ?>
            </div>
          </div>

          <form class="leaderboard-filterbar" method="get" action="<?= e(route_url('leaderboard')) ?>" data-leaderboard-form>
            <input type="hidden" name="board" value="players">
            <input type="hidden" name="scope" value="<?= e($leaderboard_scope) ?>" data-leaderboard-field="scope">
            <input type="hidden" name="metric" value="<?= e($leaderboard_player_metric) ?>" data-leaderboard-field="metric">
            <input type="hidden" name="wipe_key" value="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>" data-leaderboard-field="wipe_key">
            <label>
              <span>Previous Wipe</span>
              <select name="wipe_id" data-leaderboard-wipe-select>
                <?= leaderboard_wipe_options($leaderboard_wipes, $leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_id : 0) ?>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input type="search" name="q" maxlength="80" placeholder="Player name or Steam ID" value="<?= e($leaderboard_search) ?>" data-leaderboard-search>
            </label>
            <label>
              <span>Rows</span>
              <select name="per_page" data-leaderboard-page-size>
                <?php foreach ($leaderboard_page_sizes as $page_size) : ?>
                  <option value="<?= e((string) $page_size) ?>"<?= $leaderboard_per_page === $page_size ? ' selected' : '' ?>><?= e((string) $page_size) ?></option>
                <?php endforeach; ?>
              </select>
            </label>
            <button class="btn btn-secondary copy-small" type="submit">Search</button>
          </form>

          <div class="store-table-wrap leaderboard-table-wrap" data-leaderboard-table-wrap<?= $leaderboard_player_result['rows'] === [] ? ' hidden' : '' ?>>
            <table class="store-table leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Kills</th>
                  <th>Deaths</th>
                  <th>NPC Kills</th>
                  <th>Killed by NPCs</th>
                  <th>K/D</th>
                  <th>Playtime</th>
                  <th>RP</th>
                </tr>
              </thead>
              <tbody data-leaderboard-rows>
                <?php foreach ($leaderboard_player_result['rows'] as $row) : ?>
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
                    <td><strong><?= e(raidlands_stats_format_number($row['kills'])) ?></strong></td>
                    <td><?= e(raidlands_stats_format_number($row['deaths'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['npc_kills'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['deaths_by_npc'])) ?></td>
                    <td><?= e(raidlands_stats_format_kdr($row['kdr'])) ?></td>
                    <td><?= e(raidlands_stats_format_duration($row['playtime_seconds'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['reward_points'])) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <div class="form-status warning" data-leaderboard-empty<?= $leaderboard_player_result['rows'] === [] ? '' : ' hidden' ?>>No player stats match this view.</div>

          <nav class="leaderboard-pagination" aria-label="Player leaderboard pages" data-leaderboard-pagination>
            <a class="<?= (int) $leaderboard_player_result['page'] <= 1 ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('players', $leaderboard_scope, $leaderboard_player_metric, max(1, (int) $leaderboard_player_result['page'] - 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="prev">Previous</a>
            <span data-leaderboard-page-summary>Page <?= e((string) $leaderboard_player_result['page']) ?> of <?= e((string) $leaderboard_player_result['pages']) ?></span>
            <a class="<?= (int) $leaderboard_player_result['page'] >= (int) $leaderboard_player_result['pages'] ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('players', $leaderboard_scope, $leaderboard_player_metric, min((int) $leaderboard_player_result['pages'], (int) $leaderboard_player_result['page'] + 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="next">Next</a>
          </nav>
        </section>

        <section
          id="leaderboard-bots"
          class="<?= e(leaderboard_panel_classes('bots', $leaderboard_board)) ?>"
          role="tabpanel"
          data-leaderboard-panel
          data-board="bots"
          data-scope="<?= e($leaderboard_scope) ?>"
          data-wipe-id="<?= e($leaderboard_scope === 'wipe' ? (string) $leaderboard_selected_wipe_id : '') ?>"
          data-wipe-key="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>"
          data-metric="<?= e($leaderboard_bot_metric) ?>"
          data-page="<?= e((string) ($leaderboard_bot_result['page'] ?? 1)) ?>"
          data-per-page="<?= e((string) ($leaderboard_bot_result['per_page'] ?? $leaderboard_per_page)) ?>"
          data-total="<?= e((string) ($leaderboard_bot_result['total'] ?? 0)) ?>"
          data-pages="<?= e((string) ($leaderboard_bot_result['pages'] ?? 1)) ?>"
          data-search="<?= e($leaderboard_search) ?>"
          <?= $leaderboard_board === 'bots' ? '' : 'hidden' ?>>
          <div class="leaderboard-panel-head">
            <div>
              <p class="section-kicker">Roaming bots</p>
              <h3>Bot Stats</h3>
              <p class="section-lede">Bot combat is tracked separately so normal player PvP K/D stays clean.</p>
            </div>
            <span class="status-pill" data-leaderboard-count><?= e(leaderboard_page_summary($leaderboard_bot_result)) ?></span>
          </div>

          <div class="leaderboard-toolbar">
            <div class="leaderboard-tabs" aria-label="Bot leaderboard scope">
              <a class="<?= $leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('bots', 'current', $leaderboard_bot_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="current">Current Wipe</a>
              <a class="<?= $leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('bots', 'all-time', $leaderboard_bot_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="all-time">All Time</a>
            </div>
            <div class="leaderboard-tabs" aria-label="Bot leaderboard metric">
              <?php foreach ($leaderboard_bot_metrics as $metric_key => $metric_label) : ?>
                <a class="<?= $leaderboard_bot_metric === $metric_key ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('bots', $leaderboard_scope, $metric_key, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-metric="<?= e($metric_key) ?>"><?= e($metric_label) ?></a>
              <?php endforeach; ?>
            </div>
          </div>

          <form class="leaderboard-filterbar" method="get" action="<?= e(route_url('leaderboard')) ?>" data-leaderboard-form>
            <input type="hidden" name="board" value="bots">
            <input type="hidden" name="scope" value="<?= e($leaderboard_scope) ?>" data-leaderboard-field="scope">
            <input type="hidden" name="metric" value="<?= e($leaderboard_bot_metric) ?>" data-leaderboard-field="metric">
            <input type="hidden" name="wipe_key" value="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>" data-leaderboard-field="wipe_key">
            <label>
              <span>Previous Wipe</span>
              <select name="wipe_id" data-leaderboard-wipe-select>
                <?= leaderboard_wipe_options($leaderboard_wipes, $leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_id : 0) ?>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input type="search" name="q" maxlength="80" placeholder="Bot, kit, or skill" value="<?= e($leaderboard_search) ?>" data-leaderboard-search>
            </label>
            <label>
              <span>Rows</span>
              <select name="per_page" data-leaderboard-page-size>
                <?php foreach ($leaderboard_page_sizes as $page_size) : ?>
                  <option value="<?= e((string) $page_size) ?>"<?= $leaderboard_per_page === $page_size ? ' selected' : '' ?>><?= e((string) $page_size) ?></option>
                <?php endforeach; ?>
              </select>
            </label>
            <button class="btn btn-secondary copy-small" type="submit">Search</button>
          </form>

          <div class="store-table-wrap leaderboard-table-wrap" data-leaderboard-table-wrap<?= $leaderboard_bot_result['rows'] === [] ? ' hidden' : '' ?>>
            <table class="store-table leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Bot</th>
                  <th>Kit</th>
                  <th>Skill</th>
                  <th>Kills</th>
                  <th>Deaths</th>
                  <th>K/D</th>
                </tr>
              </thead>
              <tbody data-leaderboard-rows>
                <?php foreach ($leaderboard_bot_result['rows'] as $row) : ?>
                  <tr>
                    <td><span class="leaderboard-rank">#<?= e((string) $row['rank']) ?></span></td>
                    <td>
                      <div class="leaderboard-player">
                        <span class="leaderboard-bot-avatar" aria-hidden="true">AI</span>
                        <span class="leaderboard-player-copy">
                          <strong><?= e((string) ($row['display_name'] ?: $row['bot_key'])) ?></strong>
                          <span class="leaderboard-steam"><?= e((string) $row['bot_key']) ?></span>
                        </span>
                      </div>
                    </td>
                    <td><?= e((string) ($row['kit_name'] ?: 'Unknown')) ?></td>
                    <td><?= e((string) ($row['skill_tier'] ?: 'Unknown')) ?></td>
                    <td><strong><?= e(raidlands_stats_format_number($row['kills'])) ?></strong></td>
                    <td><?= e(raidlands_stats_format_number($row['deaths'])) ?></td>
                    <td><?= e(raidlands_stats_format_kdr($row['kdr'])) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <div class="form-status warning" data-leaderboard-empty<?= $leaderboard_bot_result['rows'] === [] ? '' : ' hidden' ?>>No bot stats match this view.</div>

          <nav class="leaderboard-pagination" aria-label="Bot leaderboard pages" data-leaderboard-pagination>
            <a class="<?= (int) $leaderboard_bot_result['page'] <= 1 ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('bots', $leaderboard_scope, $leaderboard_bot_metric, max(1, (int) $leaderboard_bot_result['page'] - 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="prev">Previous</a>
            <span data-leaderboard-page-summary>Page <?= e((string) $leaderboard_bot_result['page']) ?> of <?= e((string) $leaderboard_bot_result['pages']) ?></span>
            <a class="<?= (int) $leaderboard_bot_result['page'] >= (int) $leaderboard_bot_result['pages'] ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('bots', $leaderboard_scope, $leaderboard_bot_metric, min((int) $leaderboard_bot_result['pages'], (int) $leaderboard_bot_result['page'] + 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="next">Next</a>
          </nav>
        </section>
      </div>
    <?php endif; ?>
  </div>
</section>
