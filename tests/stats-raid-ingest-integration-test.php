<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/stats.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function stats_raid_ingest_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

if (!raidlands_stats_is_ready()) {
    throw new RuntimeException('Raid stats migration is not installed. Run database/migrations/066_raid_stats.sql.');
}

$pdo = raidlands_db_required();
$suffix = bin2hex(random_bytes(5));
$server_id = 'raid-ingest-test-' . $suffix;
$steam_id64 = '76561193' . random_int(100000000, 999999999);
$wipe_key = $server_id . '-20260716T120000Z';
$wipe_id = 0;
$player_id = 0;
$test_error = null;

try {
    $payload = [
        'wipe_key' => $wipe_key,
        'wipe_started_at' => '2026-07-16T12:00:00Z',
        'generated_at' => gmdate(DATE_ATOM),
        'players' => [[
            'steam_id64' => $steam_id64,
            'display_name' => 'Raid Ingest ' . $suffix,
            'kills' => 0,
            'deaths' => 0,
            'playtime_seconds' => 0,
            'afk_seconds' => 0,
            'reward_points' => 0,
            'npc_kills' => 0,
            'deaths_by_npc' => 0,
            'raid_damage' => 900,
            'raid_damage_baseline' => 100,
            'rockets_used' => 5,
            'rockets_used_baseline' => 1,
            'c4_used' => 3,
            'c4_used_baseline' => 1,
            'satchels_used' => 2,
            'satchels_used_baseline' => 0,
            'explosive_ammo_used' => 40,
            'explosive_ammo_used_baseline' => 10,
            'tcs_destroyed' => 2,
            'tcs_destroyed_baseline' => 1,
        ]],
        'bots' => [],
    ];
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $result = raidlands_stats_ingest_snapshot($payload, $server_id, $body);
    $wipe_id = (int) ($result['wipe_id'] ?? 0);

    stats_raid_ingest_assert($wipe_id > 0, 'signed snapshot ingestion creates a wipe');
    stats_raid_ingest_assert((int) ($result['players_accepted'] ?? 0) === 1, 'signed snapshot accepts the raid profile');
    stats_raid_ingest_assert((int) ($result['raid_players_received'] ?? 0) === 1, 'signed snapshot reports one raid profile');
    stats_raid_ingest_assert((int) ($result['raid_damage_received'] ?? 0) === 900, 'signed snapshot reports raw raid damage');

    $stored = raidlands_db_fetch_one(
        'SELECT p.id AS player_id, s.raid_damage, s.rockets_used, s.c4_used, s.satchels_used,
                s.explosive_ammo_used, s.tcs_destroyed
         FROM player_wipe_stats s
         INNER JOIN players p ON p.id = s.player_id
         WHERE s.wipe_id = :wipe_id AND p.steam_id64 = :steam_id64',
        ['wipe_id' => $wipe_id, 'steam_id64' => $steam_id64]
    );
    $player_id = (int) ($stored['player_id'] ?? 0);
    stats_raid_ingest_assert((int) ($stored['raid_damage'] ?? -1) === 800, 'ingestion stores baseline-adjusted raid damage');
    stats_raid_ingest_assert((int) ($stored['rockets_used'] ?? -1) === 4, 'ingestion stores baseline-adjusted rockets');
    stats_raid_ingest_assert((int) ($stored['c4_used'] ?? -1) === 2, 'ingestion stores baseline-adjusted C4');
    stats_raid_ingest_assert((int) ($stored['satchels_used'] ?? -1) === 2, 'ingestion stores baseline-adjusted satchels');
    stats_raid_ingest_assert((int) ($stored['explosive_ammo_used'] ?? -1) === 30, 'ingestion stores baseline-adjusted explosive ammo');
    stats_raid_ingest_assert((int) ($stored['tcs_destroyed'] ?? -1) === 1, 'ingestion stores baseline-adjusted TC final blows');

    $log = raidlands_db_fetch_one(
        'SELECT raid_players_received, raid_damage_received FROM stats_ingest_log
         WHERE server_id = :server_id AND wipe_id = :wipe_id ORDER BY id DESC LIMIT 1',
        ['server_id' => $server_id, 'wipe_id' => $wipe_id]
    );
    stats_raid_ingest_assert((int) ($log['raid_players_received'] ?? 0) === 1, 'ingest diagnostics store raid profile count');
    stats_raid_ingest_assert((int) ($log['raid_damage_received'] ?? 0) === 900, 'ingest diagnostics store raw raid damage');
} catch (Throwable $error) {
    $test_error = $error;
} finally {
    if ($wipe_id > 0) {
        $owned_wipe = raidlands_db_fetch_one(
            'SELECT id FROM wipe_seasons WHERE id = :id AND server_id = :server_id AND wipe_key = :wipe_key',
            ['id' => $wipe_id, 'server_id' => $server_id, 'wipe_key' => $wipe_key]
        );
        $owned_player = $player_id > 0
            ? raidlands_db_fetch_one(
                'SELECT id FROM players WHERE id = :id AND steam_id64 = :steam_id64',
                ['id' => $player_id, 'steam_id64' => $steam_id64]
            )
            : null;

        if ($owned_wipe !== null) {
            $pdo->beginTransaction();
            try {
                $pdo->prepare('DELETE FROM stats_ingest_log WHERE wipe_id = :wipe_id AND server_id = :server_id')
                    ->execute(['wipe_id' => $wipe_id, 'server_id' => $server_id]);
                $pdo->prepare('DELETE FROM wipe_seasons WHERE id = :id AND server_id = :server_id AND wipe_key = :wipe_key')
                    ->execute(['id' => $wipe_id, 'server_id' => $server_id, 'wipe_key' => $wipe_key]);
                if ($owned_player !== null) {
                    $pdo->prepare('DELETE FROM players WHERE id = :id AND steam_id64 = :steam_id64')
                        ->execute(['id' => $player_id, 'steam_id64' => $steam_id64]);
                }
                $pdo->commit();
            } catch (Throwable $cleanup_error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $test_error ??= $cleanup_error;
            }
        }
    }
}

if ($test_error instanceof Throwable) {
    throw $test_error;
}

echo "Stats raid ingest integration tests passed.\n";
