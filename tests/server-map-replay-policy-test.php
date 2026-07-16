<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/server-map-replay-policy.php';

$tests = 0;

function replay_policy_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;

    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

replay_policy_test(
    raidlands_server_map_replay_wipe_key_is_generic('raidlands-main', 'raidlands-main'),
    'the bare server id is a generic wipe key'
);
replay_policy_test(
    raidlands_server_map_replay_wipe_key_is_generic('raidlands-main-current', 'raidlands-main'),
    'the current alias is a generic wipe key'
);
replay_policy_test(
    !raidlands_server_map_replay_wipe_key_is_generic('raidlands-main-20260716T181701Z', 'raidlands-main'),
    'a timestamped wipe key remains authoritative'
);

$wipe_start = strtotime('2026-07-16T22:17:01Z');
$window_end = strtotime('2026-07-16T22:21:01Z');
$bounds = raidlands_server_map_replay_window_bounds(['range' => '15m', 'minutes' => 15], $window_end, $wipe_start);
replay_policy_test($bounds['start'] === $wipe_start, 'a live range is clamped to the current wipe start');
replay_policy_test($bounds['duration'] === 240, 'the available wipe duration controls the live scale');

$wipe_bounds = raidlands_server_map_replay_window_bounds(['range' => 'wipe', 'minutes' => 60 * 24 * 31], $window_end, $wipe_start);
replay_policy_test($wipe_bounds['start'] === $wipe_start, 'current-wipe range never reaches into the previous wipe');

$resolved_start = raidlands_server_map_replay_current_wipe_started_at(
    ['wipe_started_at' => '2026-07-16T20:00:00Z'],
    ['started_at' => '2026-07-16T22:17:01Z']
);
replay_policy_test($resolved_start === $wipe_start, 'the active wipe signal wins over stale status metadata');

echo "server map replay policy: {$tests} assertions passed\n";
