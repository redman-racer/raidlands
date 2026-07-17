<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/stats.php';
require_once $site_root . '/includes/rewards.php';

$board = (string) ($_GET['board'] ?? $_GET['type'] ?? 'players');
$board = in_array($board, ['players', 'raids', 'bots', 'rp-games'], true) ? $board : 'players';
$scope = raidlands_stats_scope((string) ($_GET['scope'] ?? 'current'));
$wipe_id = raidlands_stats_wipe_id($_GET['wipe_id'] ?? 0);
$wipe_key = raidlands_stats_optional_wipe_key($_GET['wipe_key'] ?? '');

if ($wipe_id > 0 || $wipe_key !== '') {
    $scope = 'wipe';
}

$page = raidlands_stats_page_number($_GET['page'] ?? 1);
$per_page = raidlands_stats_page_size($_GET['per_page'] ?? 25);
$search = raidlands_stats_search((string) ($_GET['q'] ?? $_GET['search'] ?? ''));
$metric = $board === 'rp-games'
    ? 'total-won'
    : ($board === 'bots'
        ? raidlands_stats_bot_metric((string) ($_GET['metric'] ?? 'kdr'))
        : ($board === 'raids'
            ? raidlands_stats_raid_metric((string) ($_GET['metric'] ?? 'raid_damage'))
            : raidlands_stats_metric((string) ($_GET['metric'] ?? 'kills'))));

header('Cache-Control: no-store');

try {
    if (!raidlands_stats_is_ready()) {
        raidlands_store_json_response([
            'ok' => true,
            'ready' => false,
            'board' => $board,
            'scope' => $scope,
            'metric' => $metric,
            'search' => $search,
            'rows' => [],
            'leaders' => [],
            'total' => 0,
            'page' => 1,
            'per_page' => $per_page,
            'pages' => 1,
        ]);
    }

    $result = match ($board) {
        'bots' => raidlands_stats_bot_leaderboard_result($scope, $page, $per_page, $search, $metric, $wipe_id, $wipe_key),
        'raids' => raidlands_stats_raid_leaderboard_result($metric, $scope, $page, $per_page, $search, $wipe_id, $wipe_key),
        'rp-games' => raidlands_rewards_leaderboard_result($scope, $page, $per_page, $search, $wipe_id, $wipe_key),
        default => raidlands_stats_leaderboard_result($metric, $scope, $page, $per_page, $search, $wipe_id, $wipe_key),
    };
    $leaders = match ($board) {
        'bots' => raidlands_stats_bot_leaderboard_leaders($scope, $metric, $wipe_id, $wipe_key),
        'raids' => raidlands_stats_raid_leaderboard_leaders($metric, $scope, $wipe_id, $wipe_key),
        'rp-games' => raidlands_rewards_leaderboard_leaders($scope, $wipe_id, $wipe_key),
        default => raidlands_stats_leaderboard_leaders($metric, $scope, $wipe_id, $wipe_key),
    };
    $leaders = raidlands_podium_decorate_leaders($leaders, $board);
    $selected_wipe = $scope === 'wipe' ? raidlands_stats_wipe($wipe_id, $wipe_key) : null;

    raidlands_store_json_response([
        'ok' => true,
        'ready' => true,
        'board' => $board,
        'scope' => $scope,
        'wipe_id' => $selected_wipe !== null ? (int) $selected_wipe['id'] : $wipe_id,
        'wipe_key' => $selected_wipe !== null ? (string) $selected_wipe['wipe_key'] : $wipe_key,
        'wipe' => $selected_wipe,
        'metric' => $metric,
        'search' => $search,
        'rows' => $result['rows'],
        'leaders' => $leaders,
        'total' => $result['total'],
        'page' => $result['page'],
        'per_page' => $result['per_page'],
        'pages' => $result['pages'],
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => $error->getMessage(),
    ], 500);
}
