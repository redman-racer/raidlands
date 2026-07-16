<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/rewards.php';

$tests = 0;

function rp_self_exclusion_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;

    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

function rp_self_exclusion_throws(callable $callback, string $contains, string $message): void
{
    try {
        $callback();
    } catch (Throwable $error) {
        rp_self_exclusion_test(str_contains($error->getMessage(), $contains), $message);
        return;
    }

    rp_self_exclusion_test(false, $message);
}

$periods = raidlands_rewards_self_exclusion_periods();
rp_self_exclusion_test((int) $periods['24_hours']['seconds'] === 86400, '24-hour period is exact');
rp_self_exclusion_test((int) $periods['90_days']['seconds'] === 7776000, '90-day period is exact');
rp_self_exclusion_test($periods['permanent']['seconds'] === null, 'permanent period has no end time');
$permanent = raidlands_rewards_public_self_exclusion(['starts_at' => '2026-01-01 00:00:00', 'ends_at' => null]);
rp_self_exclusion_test(!empty($permanent['is_permanent']) && $permanent['end_label'] === 'Permanent', 'permanent public state is explicit');

if (!raidlands_rewards_is_ready()) {
    throw new RuntimeException(raidlands_rewards_readiness_message(true));
}

raidlands_rewards_settings();
raidlands_store_boot();
$pdo = raidlands_db_required();
$pdo->beginTransaction();

try {
    $steam_id64 = '7656119' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
    $insert = $pdo->prepare('INSERT INTO players (steam_id64, display_name, last_seen_at) VALUES (:steam_id64, "Self Exclusion Test", NOW())');
    $insert->execute(['steam_id64' => $steam_id64]);
    $player_id = (int) $pdo->lastInsertId();

    $_SESSION['raidlands_player'] = [
        'id' => $player_id,
        'steam_id64' => $steam_id64,
        'display_name' => 'Self Exclusion Test',
        'steam_openid_verified' => true,
        'steam_auth_provider' => 'steam_openid',
        'steam_verified_at' => gmdate(DATE_ATOM),
    ];

    $pdo->exec('UPDATE rp_game_settings SET self_exclusion_enabled = 1 WHERE id = 1');
    $started_at = time();
    $result = raidlands_rewards_start_self_exclusion('24_hours');
    $exclusion = $result['exclusion'];
    $ends_at = strtotime((string) $exclusion['ends_at'] . ' UTC');

    rp_self_exclusion_test(empty($exclusion['is_permanent']), 'timed exclusion is not permanent');
    rp_self_exclusion_test($ends_at !== false && abs($ends_at - ($started_at + 86400)) <= 5, 'timed exclusion ends after 24 hours');
    rp_self_exclusion_test(raidlands_rewards_self_excluded($player_id), 'new exclusion is enforced immediately');
    rp_self_exclusion_test((int) $pdo->query('SELECT COUNT(*) FROM rp_game_self_exclusions WHERE player_id = ' . $player_id)->fetchColumn() === 1, 'one exclusion row is created');

    rp_self_exclusion_throws(
        static fn () => raidlands_rewards_start_self_exclusion('7_days'),
        'already active',
        'a second active exclusion is rejected'
    );

    $pdo->exec('UPDATE rp_game_settings SET self_exclusion_enabled = 0 WHERE id = 1');
    $disabled_settings = raidlands_rewards_settings(false);
    rp_self_exclusion_test(!raidlands_rewards_self_excluded($player_id, $disabled_settings), 'admin switch disables enforcement');

    $pdo->exec('UPDATE rp_game_settings SET self_exclusion_enabled = 1 WHERE id = 1');
    $enabled_settings = raidlands_rewards_settings(false);
    rp_self_exclusion_test(raidlands_rewards_self_excluded($player_id, $enabled_settings), 'admin switch restores enforcement');

    $pdo->rollBack();
    unset($_SESSION['raidlands_player']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    unset($_SESSION['raidlands_player']);
    throw $error;
}

echo "RP self-exclusion integration tests passed ({$tests}).\n";
