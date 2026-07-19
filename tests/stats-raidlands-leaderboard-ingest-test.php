<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/stats.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function leaderboard_ingest_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

if (!raidlands_stats_is_ready()) {
    throw new RuntimeException('Leaderboard stats migration is not installed. Run database/migrations/072_raidlands_leaderboard_stats.sql.');
}

$pdo = raidlands_db_required();
$suffix = bin2hex(random_bytes(5));
$server_id = 'leaderboard-ingest-test-' . $suffix;
$steam_id64 = '76561194' . random_int(100000000, 999999999);
$wipe_key = $server_id . '-20260719T120000Z';
$wipe_id = 0;
$player_id = 0;
$test_error = null;

try {
    $player = [
        'steam_id64' => $steam_id64,
        'display_name' => 'Leaderboard Ingest ' . $suffix,
        // Lifetime compatibility counters deliberately differ from wipe truth.
        'kills' => 100,
        'deaths' => 40,
        'playtime_seconds' => 90000,
        'npc_kills' => 30,
        'leaderboard' => [
            'source' => 'raidlandsleaderboards',
            'scope' => 'wipe',
            'kills' => 7,
            'deaths' => 3,
            'total_deaths' => 5,
            'playtime_seconds' => 1200,
            'npc_kills' => 4,
            'headshots' => 3,
            'best_kill_streak' => 4,
            'player_damage' => 2345,
            'distance_travelled' => 6789,
        ],
    ];
    $payload = [
        'schema_version' => 2,
        'stats_source' => 'raidlandsleaderboards',
        'wipe_key' => $wipe_key,
        'wipe_started_at' => '2026-07-19T12:00:00Z',
        'generated_at' => gmdate(DATE_ATOM),
        'players' => [$player],
        'bots' => [],
    ];
    $result = raidlands_stats_ingest_snapshot($payload, $server_id, json_encode($payload, JSON_THROW_ON_ERROR));
    $wipe_id = (int) ($result['wipe_id'] ?? 0);

    $stored = raidlands_db_fetch_one(
        'SELECT p.id AS player_id, s.kills, s.deaths, s.playtime_seconds, s.npc_kills,
                d.total_deaths, d.headshots, d.best_kill_streak, d.player_damage, d.distance_travelled
         FROM player_wipe_stats s
         INNER JOIN players p ON p.id = s.player_id
         INNER JOIN player_leaderboard_stats d ON d.wipe_id = s.wipe_id AND d.player_id = s.player_id
         WHERE s.wipe_id = :wipe_id AND p.steam_id64 = :steam_id64',
        ['wipe_id' => $wipe_id, 'steam_id64' => $steam_id64]
    );
    $player_id = (int) ($stored['player_id'] ?? 0);

    leaderboard_ingest_assert((int) $stored['kills'] === 7, 'current wipe uses authoritative kills instead of lifetime compatibility kills');
    leaderboard_ingest_assert((int) $stored['deaths'] === 3, 'current wipe uses authoritative PvP deaths');
    leaderboard_ingest_assert((int) $stored['playtime_seconds'] === 1200, 'current wipe uses authoritative playtime');
    leaderboard_ingest_assert((int) $stored['npc_kills'] === 4, 'current wipe uses authoritative NPC kills');
    leaderboard_ingest_assert((int) $stored['headshots'] === 3, 'richer headshot data is retained');
    leaderboard_ingest_assert((int) $stored['best_kill_streak'] === 4, 'richer streak data is retained');

    $player['kills'] = 110;
    $player['leaderboard']['kills'] = 8;
    $player['leaderboard']['headshots'] = 4;
    $payload['players'] = [$player];
    $payload['generated_at'] = gmdate(DATE_ATOM);
    raidlands_stats_ingest_snapshot($payload, $server_id, json_encode($payload, JSON_THROW_ON_ERROR));

    $updated = raidlands_db_fetch_one(
        'SELECT s.kills, d.headshots FROM player_wipe_stats s
         INNER JOIN player_leaderboard_stats d ON d.wipe_id = s.wipe_id AND d.player_id = s.player_id
         WHERE s.wipe_id = :wipe_id AND s.player_id = :player_id',
        ['wipe_id' => $wipe_id, 'player_id' => $player_id]
    );
    leaderboard_ingest_assert((int) $updated['kills'] === 8, 'later snapshots remain exact rather than baseline-subtracted');
    leaderboard_ingest_assert((int) $updated['headshots'] === 4, 'later rich details update in place');

    $leader = raidlands_db_fetch_one(
        'SELECT s.kills, CASE WHEN s.kills = 0 THEN 0 ELSE ROUND(d.headshots * 100 / s.kills, 2) END AS headshot_rate
         FROM player_wipe_stats s
         INNER JOIN player_leaderboard_stats d ON d.wipe_id = s.wipe_id AND d.player_id = s.player_id
         WHERE s.wipe_id = :wipe_id AND s.player_id = :player_id',
        ['wipe_id' => $wipe_id, 'player_id' => $player_id]
    );
    leaderboard_ingest_assert((int) ($leader['kills'] ?? 0) === 8, 'leaderboard storage returns authoritative kills');
    leaderboard_ingest_assert((float) ($leader['headshot_rate'] ?? 0) === 50.0, 'leaderboard storage derives headshot rate');

    echo "PASS: RaidlandsLeaderboards authoritative ingestion and rich stats\n";
} catch (Throwable $error) {
    $test_error = $error;
} finally {
    if ($wipe_id > 0) {
        $pdo->prepare('DELETE FROM wipe_seasons WHERE id = :id')->execute(['id' => $wipe_id]);
    }
    if ($player_id > 0) {
        $pdo->prepare('DELETE FROM players WHERE id = :id')->execute(['id' => $player_id]);
    }
}

if ($test_error !== null) {
    throw $test_error;
}
