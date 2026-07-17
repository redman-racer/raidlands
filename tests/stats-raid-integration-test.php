<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/stats.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function stats_raid_integration_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

if (!raidlands_stats_is_ready()) {
    throw new RuntimeException('Raid stats migration is not installed. Run database/migrations/066_raid_stats.sql.');
}

$pdo = raidlands_db_required();
$pdo->beginTransaction();

try {
    $suffix = bin2hex(random_bytes(5));
    $server_id = raidlands_stats_server_id();
    $wipe_key = 'raid-stats-test-' . $suffix;
    $insert_wipe = $pdo->prepare(
        'INSERT INTO wipe_seasons (server_id, wipe_key, started_at, is_active) VALUES (:server_id, :wipe_key, UTC_TIMESTAMP(), 0)'
    );
    $insert_wipe->execute(['server_id' => $server_id, 'wipe_key' => $wipe_key]);
    $wipe_id = (int) $pdo->lastInsertId();

    $insert_player = $pdo->prepare(
        'INSERT INTO players (steam_id64, display_name, last_seen_at) VALUES (:steam_id64, :display_name, NOW())'
    );
    $insert_player->execute(['steam_id64' => '76561191' . random_int(100000000, 999999999), 'display_name' => 'Raid Alpha ' . $suffix]);
    $alpha_id = (int) $pdo->lastInsertId();
    $insert_player->execute(['steam_id64' => '76561192' . random_int(100000000, 999999999), 'display_name' => 'Raid Bravo ' . $suffix]);
    $bravo_id = (int) $pdo->lastInsertId();

    $base_raw = [
        'kills' => 0,
        'deaths' => 0,
        'playtime_seconds' => 0,
        'afk_seconds' => 0,
        'reward_points' => 0,
        'npc_kills' => 0,
        'deaths_by_npc' => 0,
    ];
    raidlands_stats_upsert_player_wipe($pdo, $wipe_id, $alpha_id, 'Raid Alpha ' . $suffix, $base_raw + [
        'raid_damage' => 125000,
        'raid_damage_baseline' => 25000,
        'rockets_used' => 12,
        'rockets_used_baseline' => 2,
        'c4_used' => 7,
        'c4_used_baseline' => 1,
        'satchels_used' => 4,
        'satchels_used_baseline' => 1,
        'explosive_ammo_used' => 90,
        'explosive_ammo_used_baseline' => 10,
        'tcs_destroyed' => 3,
        'tcs_destroyed_baseline' => 1,
    ], false);
    raidlands_stats_upsert_player_wipe($pdo, $wipe_id, $bravo_id, 'Raid Bravo ' . $suffix, $base_raw + [
        'raid_damage' => 50000,
        'raid_damage_baseline' => 0,
        'rockets_used' => 4,
        'rockets_used_baseline' => 0,
        'c4_used' => 2,
        'c4_used_baseline' => 0,
        'satchels_used' => 1,
        'satchels_used_baseline' => 0,
        'explosive_ammo_used' => 20,
        'explosive_ammo_used_baseline' => 0,
        'tcs_destroyed' => 6,
        'tcs_destroyed_baseline' => 0,
    ], false);

    $alpha = raidlands_db_fetch_one(
        'SELECT raid_damage, rockets_used, c4_used, satchels_used, explosive_ammo_used, tcs_destroyed
         FROM player_wipe_stats WHERE wipe_id = :wipe_id AND player_id = :player_id',
        ['wipe_id' => $wipe_id, 'player_id' => $alpha_id]
    );
    stats_raid_integration_assert((int) ($alpha['raid_damage'] ?? -1) === 100000, 'raid damage subtracts the deployment/wipe baseline');
    stats_raid_integration_assert((int) ($alpha['rockets_used'] ?? -1) === 10, 'rocket usage subtracts its baseline');
    stats_raid_integration_assert((int) ($alpha['c4_used'] ?? -1) === 6, 'C4 usage subtracts its baseline');
    stats_raid_integration_assert((int) ($alpha['satchels_used'] ?? -1) === 3, 'satchel usage subtracts its baseline');
    stats_raid_integration_assert((int) ($alpha['explosive_ammo_used'] ?? -1) === 80, 'explosive ammo usage subtracts its baseline');
    stats_raid_integration_assert((int) ($alpha['tcs_destroyed'] ?? -1) === 2, 'TC final blows subtract their baseline');

    $damage_result = raidlands_stats_raid_leaderboard_result('raid_damage', 'wipe', 1, 25, '', $wipe_id, '', false);
    stats_raid_integration_assert((int) ($damage_result['total'] ?? 0) === 2, 'raid activity is eligible without playtime');
    stats_raid_integration_assert((int) ($damage_result['rows'][0]['player_id'] ?? 0) === $alpha_id, 'raid damage leaderboard ranks the highest damage first');

    $tc_result = raidlands_stats_raid_leaderboard_result('tcs_destroyed', 'wipe', 1, 25, 'Raid Bravo ' . $suffix, $wipe_id, '', false);
    stats_raid_integration_assert((int) ($tc_result['total'] ?? 0) === 1, 'raid leaderboard search filters by player name');
    stats_raid_integration_assert((int) ($tc_result['rows'][0]['player_id'] ?? 0) === $bravo_id, 'TC leaderboard ranks and returns the matching raider');
    stats_raid_integration_assert((int) ($tc_result['rows'][0]['tcs_destroyed'] ?? 0) === 6, 'TC final-blow totals reach the leaderboard');

    $promotion_server = 'raid-promotion-' . $suffix;
    $promotion_started = gmdate('Y-m-d H:i:s', time() - 60);
    $insert_wipe->execute([
        'server_id' => $promotion_server,
        'wipe_key' => $promotion_server . '-current',
    ]);
    $generic_wipe_id = (int) $pdo->lastInsertId();
    $pdo->prepare('UPDATE wipe_seasons SET started_at = :started_at, is_active = 1 WHERE id = :id')
        ->execute(['started_at' => $promotion_started, 'id' => $generic_wipe_id]);
    $canonical_key = $promotion_server . '-' . gmdate('Ymd\\THis\\Z', strtotime($promotion_started));
    $promoted = raidlands_stats_get_or_create_wipe($pdo, $promotion_server, $canonical_key, $promotion_started);
    stats_raid_integration_assert((int) ($promoted['id'] ?? 0) === $generic_wipe_id, 'matching generic wipes are promoted without splitting their stats');
    stats_raid_integration_assert((string) ($promoted['wipe_key'] ?? '') === $canonical_key, 'generic wipe promotion stores the canonical key');

    $pdo->rollBack();
    echo "Stats raid integration tests passed.\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    throw $error;
}
