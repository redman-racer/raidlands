<?php

require_once $site_root . '/includes/stats.php';
require_once $site_root . '/includes/rewards.php';

$leaderboard_ready = raidlands_stats_is_ready();
$leaderboard_board = (string) ($_GET['board'] ?? 'players');
$leaderboard_board = in_array($leaderboard_board, ['players', 'raids', 'bots', 'rp-games'], true) ? $leaderboard_board : 'players';
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
$leaderboard_raid_metric = $leaderboard_board === 'raids'
    ? raidlands_stats_raid_metric($leaderboard_metric_query)
    : 'raid_damage';
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
$leaderboard_raid_result = $leaderboard_ready
    ? raidlands_stats_raid_leaderboard_result(
        $leaderboard_raid_metric,
        $leaderboard_scope,
        $leaderboard_board === 'raids' ? $leaderboard_page : 1,
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
$leaderboard_rp_result = $leaderboard_ready
    ? raidlands_rewards_leaderboard_result(
        $leaderboard_scope,
        $leaderboard_board === 'rp-games' ? $leaderboard_page : 1,
        $leaderboard_per_page,
        $leaderboard_search,
        $leaderboard_wipe_id,
        $leaderboard_wipe_key
    )
    : raidlands_stats_page_result([], 0, 1, $leaderboard_per_page);
$leaderboard_player_leaders = $leaderboard_ready
    ? raidlands_stats_leaderboard_leaders($leaderboard_player_metric, $leaderboard_scope, $leaderboard_wipe_id, $leaderboard_wipe_key)
    : [];
$leaderboard_raid_leaders = $leaderboard_ready
    ? raidlands_stats_raid_leaderboard_leaders($leaderboard_raid_metric, $leaderboard_scope, $leaderboard_wipe_id, $leaderboard_wipe_key)
    : [];
$leaderboard_bot_leaders = $leaderboard_ready
    ? raidlands_stats_bot_leaderboard_leaders($leaderboard_scope, $leaderboard_bot_metric, $leaderboard_wipe_id, $leaderboard_wipe_key)
    : [];
$leaderboard_rp_leaders = $leaderboard_ready
    ? raidlands_rewards_leaderboard_leaders($leaderboard_scope, $leaderboard_wipe_id, $leaderboard_wipe_key)
    : [];
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
$leaderboard_raid_metrics = [
    'raid_damage' => 'Damage',
    'rockets_used' => 'Rockets',
    'c4_used' => 'C4',
    'satchels_used' => 'Satchels',
    'explosive_ammo_used' => 'Explosive Ammo',
    'tcs_destroyed' => 'TCs Broken',
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
        'board' => in_array($board, ['players', 'raids', 'bots', 'rp-games'], true) ? $board : 'players',
        'scope' => $scope,
        'metric' => $board === 'rp-games'
            ? 'total-won'
            : ($board === 'bots'
                ? raidlands_stats_bot_metric($metric)
                : ($board === 'raids' ? raidlands_stats_raid_metric($metric) : raidlands_stats_metric($metric))),
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

function leaderboard_podium_value(array $row, string $board, string $metric): string
{
    if ($board === 'rp-games') {
        return number_format((int) ($row['total_rp_won'] ?? 0));
    }

    if ($metric === 'kdr') {
        return number_format((float) ($row['kdr'] ?? 0), 2);
    }

    if ($metric === 'playtime') {
        return raidlands_stats_format_duration((int) ($row['playtime_seconds'] ?? 0));
    }

    $field = match ($metric) {
        'rp' => 'reward_points',
        'npc_kills' => 'npc_kills',
        'deaths_by_npc' => 'deaths_by_npc',
        'deaths' => 'deaths',
        'raid_damage' => 'raid_damage',
        'rockets_used' => 'rockets_used',
        'c4_used' => 'c4_used',
        'satchels_used' => 'satchels_used',
        'explosive_ammo_used' => 'explosive_ammo_used',
        'tcs_destroyed' => 'tcs_destroyed',
        default => 'kills',
    };

    return number_format((int) ($row[$field] ?? 0));
}

function leaderboard_podium_markup(array $leaders, string $board, string $metric): string
{
    $leaders = raidlands_podium_decorate_leaders($leaders, $board);
    if (isset($_GET['podium-capture'])) {
        while (count($leaders) < 3) {
            $rank = count($leaders) + 1;
            $leaders[] = ['display_name' => 'Raidlands Contender ' . $rank, 'kills' => max(1, 4 - $rank)];
        }
    }
    $metric_labels = [
        'kills' => 'kills', 'kdr' => 'K/D', 'playtime' => 'played', 'rp' => 'RP',
        'npc_kills' => 'NPC kills', 'deaths_by_npc' => 'NPC deaths', 'deaths' => 'deaths',
        'raid_damage' => 'damage', 'rockets_used' => 'rockets', 'c4_used' => 'C4',
        'satchels_used' => 'satchels', 'explosive_ammo_used' => 'explosive rounds', 'tcs_destroyed' => 'TCs broken',
        'total-won' => 'RP won',
    ];
    $cards = '';

    foreach (array_slice($leaders, 0, 3) as $index => $row) {
        $rank = $index + 1;
        $is_bot = $board === 'bots';
        $name = trim((string) ($row['display_name'] ?? '')) ?: ($is_bot ? 'Raidlands Bot' : 'Raidlands Player');
        $profile_url = $is_bot ? '' : trim((string) ($row['steam_profile_url'] ?? ''));
        $avatar = $is_bot
            ? '<span class="leaderboard-bot-avatar" aria-hidden="true">AI</span>'
            : render_steam_avatar((string) ($row['steam_avatar_url'] ?? ''), $profile_url, $name, 'steam-avatar-sm');
        $name_markup = $profile_url !== ''
            ? '<a href="' . e($profile_url) . '" target="_blank" rel="noopener noreferrer">' . e($name) . '</a>'
            : '<strong>' . e($name) . '</strong>';
        $cards .= '<article class="leaderboard-podium-card" data-podium-rank="' . $rank . '">'
            . '<span class="leaderboard-podium-medal" aria-label="Rank ' . $rank . '">#' . $rank . '</span>'
            . $avatar
            . '<span class="leaderboard-podium-copy">' . $name_markup
            . '<span><b>' . e(leaderboard_podium_value($row, $board, $metric)) . '</b> ' . e($metric_labels[$metric] ?? $metric) . '</span></span>'
            . '</article>';
    }

    $empty = $cards === '' ? '<p class="leaderboard-podium-empty">The podium is waiting for contenders.</p>' : '';
    $payload = json_encode(['leaders' => array_values(array_slice($leaders, 0, 3)), 'board' => $board, 'metric' => $metric], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

    $theme = match (true) {
        $board === 'raids', in_array($metric, ['raid_damage', 'rockets_used', 'c4_used', 'satchels_used', 'explosive_ammo_used', 'tcs_destroyed'], true) => 'RAID DAMAGE',
        $board === 'rp-games', in_array($metric, ['rp', 'total-won'], true) => 'MOST RP',
        $metric === 'npc_kills' => 'NPC HUNTER',
        $metric === 'deaths_by_npc' => 'FALLEN TO NPCS',
        $metric === 'playtime' => 'MOST PLAYTIME',
        $metric === 'deaths' => 'MOST DEATHS',
        $metric === 'kdr' => 'BEST K/D',
        default => 'MOST KILLS',
    };

    return '<section class="leaderboard-podium" data-leaderboard-podium data-podium-state="poster" data-board="' . e($board) . '" data-metric="' . e($metric) . '"'
        . ' data-model-base="' . e(asset_url('media/models/leaderboard/')) . '"'
        . ' data-scene-manifest="' . e(asset_url('data/leaderboard-scene-manifest.json')) . '"'
        . ' data-scene-model-base="' . e(asset_url('media/models/leaderboard-scene/')) . '"'
        . ' data-environment-src="' . e(asset_url('media/skyboxes/leaderboard-industrial-night-v2.hdr')) . '"'
        . ' data-backdrop-src="' . e(asset_url('media/leaderboard-arena-backdrop-v1.webp')) . '"'
        . ' data-ground-albedo-src="' . e(asset_url('media/textures/leaderboard-junkyard-dirt-albedo.webp')) . '"'
        . ' data-ground-normal-src="' . e(asset_url('media/textures/leaderboard-junkyard-dirt-normal.webp')) . '"'
        . ' data-ground-arm-src="' . e(asset_url('media/textures/leaderboard-junkyard-dirt-arm.webp')) . '"'
        . ' data-ground-fallback-src="' . e(asset_url('media/textures/road-dirt.webp')) . '"'
        . ' data-sign-albedo-src="' . e(asset_url('media/textures/leaderboard-signs/weathered-steel-albedo.webp')) . '"'
        . ' data-sign-normal-src="' . e(asset_url('media/textures/leaderboard-signs/weathered-steel-normal.webp')) . '"'
        . ' data-sign-arm-src="' . e(asset_url('media/textures/leaderboard-signs/weathered-steel-arm.webp')) . '"'
        . ' data-poster-src="' . e(asset_url('media/leaderboard-podium-poster.webp')) . '"'
        . ' data-decoder-path="' . e(asset_url('media/models/draco/')) . '" aria-label="Top three podium">'
        . '<div class="leaderboard-podium-heading"><span>Current category</span><strong data-podium-category>' . e($theme) . '</strong></div>'
        . '<div class="leaderboard-podium-drag" aria-hidden="true"><span>◌</span> Drag to rotate</div>'
        . '<div class="leaderboard-podium-stage" data-podium-stage aria-hidden="true">'
        . '<img class="leaderboard-podium-poster" src="' . e(asset_url('media/leaderboard-podium-poster.webp')) . '" alt="" decoding="async" fetchpriority="high">'
        . '</div>'
        . '<div class="leaderboard-podium-cards" data-podium-cards>' . $cards . $empty . '</div>'
        . '<div class="leaderboard-podium-loader" data-podium-loader role="status" aria-live="polite">'
        . '<span class="leaderboard-podium-progress" aria-hidden="true"><i></i></span>'
        . '<span class="leaderboard-podium-status" data-podium-status>3D view will load when it is in view.</span>'
        . '</div>'
        . '<script type="application/json" data-podium-payload>' . ($payload ?: '{"leaders":[]}') . '</script>'
        . '</section>';
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
            class="<?= $leaderboard_board === 'raids' ? 'is-active' : '' ?>"
            href="<?= e(leaderboard_url('raids', $leaderboard_scope, $leaderboard_raid_metric, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>"
            role="tab"
            aria-selected="<?= $leaderboard_board === 'raids' ? 'true' : 'false' ?>"
            aria-controls="leaderboard-raids"
            data-leaderboard-tab="raids">Raid Stats</a>
          <a
            class="<?= $leaderboard_board === 'bots' ? 'is-active' : '' ?>"
            href="<?= e(leaderboard_url('bots', $leaderboard_scope, $leaderboard_bot_metric, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>"
            role="tab"
            aria-selected="<?= $leaderboard_board === 'bots' ? 'true' : 'false' ?>"
            aria-controls="leaderboard-bots"
            data-leaderboard-tab="bots">Bot Stats</a>
          <a
            class="<?= $leaderboard_board === 'rp-games' ? 'is-active' : '' ?>"
            href="<?= e(leaderboard_url('rp-games', $leaderboard_scope, 'total-won', 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>"
            role="tab"
            aria-selected="<?= $leaderboard_board === 'rp-games' ? 'true' : 'false' ?>"
            aria-controls="leaderboard-rp-games"
            data-leaderboard-tab="rp-games">RP Games</a>
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

          <?= leaderboard_podium_markup($leaderboard_player_leaders, 'players', $leaderboard_player_metric) ?>

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
          id="leaderboard-raids"
          class="<?= e(leaderboard_panel_classes('raids', $leaderboard_board)) ?>"
          role="tabpanel"
          data-leaderboard-panel
          data-board="raids"
          data-scope="<?= e($leaderboard_scope) ?>"
          data-wipe-id="<?= e($leaderboard_scope === 'wipe' ? (string) $leaderboard_selected_wipe_id : '') ?>"
          data-wipe-key="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>"
          data-metric="<?= e($leaderboard_raid_metric) ?>"
          data-page="<?= e((string) ($leaderboard_raid_result['page'] ?? 1)) ?>"
          data-per-page="<?= e((string) ($leaderboard_raid_result['per_page'] ?? $leaderboard_per_page)) ?>"
          data-total="<?= e((string) ($leaderboard_raid_result['total'] ?? 0)) ?>"
          data-pages="<?= e((string) ($leaderboard_raid_result['pages'] ?? 1)) ?>"
          data-search="<?= e($leaderboard_search) ?>"
          <?= $leaderboard_board === 'raids' ? '' : 'hidden' ?>>
          <div class="leaderboard-panel-head">
            <div>
              <p class="section-kicker">Base pressure</p>
              <h3>Raid Stats</h3>
              <p class="section-lede">Enemy base damage, raiding explosives, and tool cupboards broken—direct from the game server.</p>
            </div>
            <span class="status-pill" data-leaderboard-count><?= e(leaderboard_page_summary($leaderboard_raid_result)) ?></span>
          </div>

          <div class="leaderboard-toolbar">
            <div class="leaderboard-tabs" aria-label="Raid leaderboard scope">
              <a class="<?= $leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('raids', 'current', $leaderboard_raid_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="current">Current Wipe</a>
              <a class="<?= $leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('raids', 'all-time', $leaderboard_raid_metric, 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="all-time">All Time</a>
            </div>
            <div class="leaderboard-tabs" aria-label="Raid leaderboard metric">
              <?php foreach ($leaderboard_raid_metrics as $metric_key => $metric_label) : ?>
                <a class="<?= $leaderboard_raid_metric === $metric_key ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('raids', $leaderboard_scope, $metric_key, 1, $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-metric="<?= e($metric_key) ?>"><?= e($metric_label) ?></a>
              <?php endforeach; ?>
            </div>
          </div>

          <?= leaderboard_podium_markup($leaderboard_raid_leaders, 'raids', $leaderboard_raid_metric) ?>

          <form class="leaderboard-filterbar" method="get" action="<?= e(route_url('leaderboard')) ?>" data-leaderboard-form>
            <input type="hidden" name="board" value="raids">
            <input type="hidden" name="scope" value="<?= e($leaderboard_scope) ?>" data-leaderboard-field="scope">
            <input type="hidden" name="metric" value="<?= e($leaderboard_raid_metric) ?>" data-leaderboard-field="metric">
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

          <div class="store-table-wrap leaderboard-table-wrap" data-leaderboard-table-wrap<?= $leaderboard_raid_result['rows'] === [] ? ' hidden' : '' ?>>
            <table class="store-table leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Damage</th>
                  <th>Rockets</th>
                  <th>C4</th>
                  <th>Satchels</th>
                  <th>Explosive Ammo</th>
                  <th>TCs Broken</th>
                </tr>
              </thead>
              <tbody data-leaderboard-rows>
                <?php foreach ($leaderboard_raid_result['rows'] as $row) : ?>
                  <?php
                    $leaderboard_name = (string) ($row['display_name'] ?: ($row['steam_display_name'] ?? 'Raidlands Player'));
                    $leaderboard_profile_url = trim((string) ($row['steam_profile_url'] ?? ''));
                  ?>
                  <tr>
                    <td><span class="leaderboard-rank">#<?= e((string) $row['rank']) ?></span></td>
                    <td>
                      <div class="leaderboard-player">
                        <?= render_steam_avatar((string) ($row['steam_avatar_url'] ?? ''), $leaderboard_profile_url, $leaderboard_name, 'steam-avatar-sm') ?>
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
                    <td><strong><?= e(raidlands_stats_format_number($row['raid_damage'])) ?></strong></td>
                    <td><?= e(raidlands_stats_format_number($row['rockets_used'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['c4_used'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['satchels_used'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['explosive_ammo_used'])) ?></td>
                    <td><?= e(raidlands_stats_format_number($row['tcs_destroyed'])) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <div class="form-status warning" data-leaderboard-empty<?= $leaderboard_raid_result['rows'] === [] ? '' : ' hidden' ?>>No raid activity matches this view yet.</div>

          <nav class="leaderboard-pagination" aria-label="Raid leaderboard pages" data-leaderboard-pagination>
            <a class="<?= (int) $leaderboard_raid_result['page'] <= 1 ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('raids', $leaderboard_scope, $leaderboard_raid_metric, max(1, (int) $leaderboard_raid_result['page'] - 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="prev">Previous</a>
            <span data-leaderboard-page-summary>Page <?= e((string) $leaderboard_raid_result['page']) ?> of <?= e((string) $leaderboard_raid_result['pages']) ?></span>
            <a class="<?= (int) $leaderboard_raid_result['page'] >= (int) $leaderboard_raid_result['pages'] ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('raids', $leaderboard_scope, $leaderboard_raid_metric, min((int) $leaderboard_raid_result['pages'], (int) $leaderboard_raid_result['page'] + 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="next">Next</a>
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

          <?= leaderboard_podium_markup($leaderboard_bot_leaders, 'bots', $leaderboard_bot_metric) ?>

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

        <section
          id="leaderboard-rp-games"
          class="<?= e(leaderboard_panel_classes('rp-games', $leaderboard_board)) ?>"
          role="tabpanel"
          data-leaderboard-panel
          data-board="rp-games"
          data-scope="<?= e($leaderboard_scope) ?>"
          data-wipe-id="<?= e($leaderboard_scope === 'wipe' ? (string) $leaderboard_selected_wipe_id : '') ?>"
          data-wipe-key="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>"
          data-metric="total-won"
          data-page="<?= e((string) ($leaderboard_rp_result['page'] ?? 1)) ?>"
          data-per-page="<?= e((string) ($leaderboard_rp_result['per_page'] ?? $leaderboard_per_page)) ?>"
          data-total="<?= e((string) ($leaderboard_rp_result['total'] ?? 0)) ?>"
          data-pages="<?= e((string) ($leaderboard_rp_result['pages'] ?? 1)) ?>"
          data-search="<?= e($leaderboard_search) ?>"
          <?= $leaderboard_board === 'rp-games' ? '' : 'hidden' ?>>
          <div class="leaderboard-panel-head">
            <div>
              <p class="section-kicker">Casino champions</p>
              <h3>RP Games</h3>
              <p class="section-lede">Confirmed gross payouts across every Raidlands RP game.</p>
            </div>
            <span class="status-pill" data-leaderboard-count><?= e(leaderboard_page_summary($leaderboard_rp_result)) ?></span>
          </div>

          <div class="leaderboard-toolbar">
            <div class="leaderboard-tabs" aria-label="RP Games leaderboard scope">
              <a class="<?= $leaderboard_scope === 'current' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('rp-games', 'current', 'total-won', 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="current">Current Wipe</a>
              <a class="<?= $leaderboard_scope === 'all-time' ? 'is-active' : '' ?>" href="<?= e(leaderboard_url('rp-games', 'all-time', 'total-won', 1, $leaderboard_per_page, $leaderboard_search)) ?>" data-leaderboard-scope="all-time">All Time</a>
            </div>
          </div>

          <?= leaderboard_podium_markup($leaderboard_rp_leaders, 'rp-games', 'total-won') ?>

          <form class="leaderboard-filterbar" method="get" action="<?= e(route_url('leaderboard')) ?>" data-leaderboard-form>
            <input type="hidden" name="board" value="rp-games">
            <input type="hidden" name="scope" value="<?= e($leaderboard_scope) ?>" data-leaderboard-field="scope">
            <input type="hidden" name="metric" value="total-won" data-leaderboard-field="metric">
            <input type="hidden" name="wipe_key" value="<?= e($leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_key : '') ?>" data-leaderboard-field="wipe_key">
            <label><span>Previous Wipe</span><select name="wipe_id" data-leaderboard-wipe-select><?= leaderboard_wipe_options($leaderboard_wipes, $leaderboard_scope === 'wipe' ? $leaderboard_selected_wipe_id : 0) ?></select></label>
            <label><span>Search</span><input type="search" name="q" maxlength="80" placeholder="Player name or Steam ID" value="<?= e($leaderboard_search) ?>" data-leaderboard-search></label>
            <label><span>Rows</span><select name="per_page" data-leaderboard-page-size><?php foreach ($leaderboard_page_sizes as $page_size) : ?><option value="<?= e((string) $page_size) ?>"<?= $leaderboard_per_page === $page_size ? ' selected' : '' ?>><?= e((string) $page_size) ?></option><?php endforeach; ?></select></label>
            <button class="btn btn-secondary copy-small" type="submit">Search</button>
          </form>

          <div class="store-table-wrap leaderboard-table-wrap" data-leaderboard-table-wrap<?= $leaderboard_rp_result['rows'] === [] ? ' hidden' : '' ?>>
            <table class="store-table leaderboard-table"><thead><tr><th>Rank</th><th>Player</th><th>Total RP Won</th><th>Wins</th><th>Games</th><th>Biggest Win</th></tr></thead>
              <tbody data-leaderboard-rows>
                <?php foreach ($leaderboard_rp_result['rows'] as $row) : ?>
                  <?php $rp_name = (string) ($row['display_name'] ?: ($row['steam_display_name'] ?? 'Raidlands Player')); $rp_profile_url = trim((string) ($row['steam_profile_url'] ?? '')); ?>
                  <tr><td><span class="leaderboard-rank">#<?= e((string) $row['rank']) ?></span></td><td><div class="leaderboard-player"><?= render_steam_avatar((string) ($row['steam_avatar_url'] ?? ''), $rp_profile_url, $rp_name, 'steam-avatar-sm') ?><span class="leaderboard-player-copy"><strong><?= e($rp_name) ?></strong><?php if ($rp_profile_url !== '') : ?><a class="leaderboard-steam" href="<?= e($rp_profile_url) ?>" target="_blank" rel="noopener noreferrer"><?= e((string) $row['steam_id64']) ?></a><?php else : ?><span class="leaderboard-steam"><?= e((string) $row['steam_id64']) ?></span><?php endif; ?></span></div></td><td><strong><?= e(raidlands_store_rp((int) $row['total_rp_won'])) ?></strong></td><td><?= e(number_format((int) $row['wins'])) ?></td><td><?= e(number_format((int) $row['games_played'])) ?></td><td><?= e(raidlands_store_rp((int) $row['biggest_win'])) ?></td></tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <div class="form-status warning" data-leaderboard-empty<?= $leaderboard_rp_result['rows'] === [] ? '' : ' hidden' ?>>No confirmed RP game results match this view.</div>
          <nav class="leaderboard-pagination" aria-label="RP Games leaderboard pages" data-leaderboard-pagination><a class="<?= (int) $leaderboard_rp_result['page'] <= 1 ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('rp-games', $leaderboard_scope, 'total-won', max(1, (int) $leaderboard_rp_result['page'] - 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="prev">Previous</a><span data-leaderboard-page-summary>Page <?= e((string) $leaderboard_rp_result['page']) ?> of <?= e((string) $leaderboard_rp_result['pages']) ?></span><a class="<?= (int) $leaderboard_rp_result['page'] >= (int) $leaderboard_rp_result['pages'] ? 'is-disabled' : '' ?>" href="<?= e(leaderboard_url('rp-games', $leaderboard_scope, 'total-won', min((int) $leaderboard_rp_result['pages'], (int) $leaderboard_rp_result['page'] + 1), $leaderboard_per_page, $leaderboard_search, $leaderboard_selected_wipe_id, $leaderboard_selected_wipe_key)) ?>" data-leaderboard-page-link="next">Next</a></nav>
        </section>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($leaderboard_ready) : ?>
  <script type="module" src="<?= e(asset_url('build/airstrike-animation-editor/leaderboard-podium-loader.js')) ?>"></script>
<?php endif; ?>
