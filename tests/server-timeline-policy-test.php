<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/server-timeline-policy.php';

$tests = 0;

function timeline_policy_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

$server_time = strtotime('2026-07-17T12:00:00Z');
$wipe_start = strtotime('2026-07-17T08:00:00Z');
$bounds = raidlands_server_timeline_bounds(
    strtotime('2026-07-17T06:00:00Z'),
    strtotime('2026-07-17T13:00:00Z'),
    $server_time,
    $wipe_start
);
timeline_policy_test($bounds['start'] === $wipe_start, 'timeline start is clamped to the active wipe');
timeline_policy_test($bounds['end'] === $server_time, 'timeline end is clamped to server time');

$long_bounds = raidlands_server_timeline_bounds(strtotime('2026-07-16T00:00:00Z'), $server_time, $server_time, null);
timeline_policy_test($long_bounds['duration'] === 21600, 'timeline batches are capped at six hours');

$records = [
    ['timestamp' => '2026-07-17T10:00:00Z', 'value' => 1],
    ['timestamp' => '2026-07-17T10:00:05Z', 'value' => 2],
    ['timestamp' => '2026-07-17T10:00:17Z', 'value' => 3],
    ['timestamp' => '2026-07-17T10:00:29Z', 'value' => 4],
];
$selected = raidlands_server_timeline_decimate($records, 15);
timeline_policy_test(array_column($selected, 'value') === [1, 2, 4], 'decimation keeps real boundary and latest bucket samples');
timeline_policy_test(raidlands_server_timeline_decimate($records, 0) === $records, 'zero stride keeps every recorded sample');

$active_span = raidlands_server_timeline_event_span([
    'kind' => 'world_vehicle',
    'state' => 'active',
    'spawnedAt' => '2026-07-17T10:00:00Z',
], strtotime('2026-07-17T10:05:00Z'), strtotime('2026-07-17T10:00:01Z'));
timeline_policy_test($active_span['start'] === strtotime('2026-07-17T10:00:00Z') && $active_span['end'] === null, 'active vehicle spans remain open');

$ended_span = raidlands_server_timeline_event_span([
    'kind' => 'world_vehicle',
    'state' => 'ended',
    'spawnedAt' => '2026-07-17T10:00:00Z',
    'endedAt' => '2026-07-17T10:08:00Z',
], strtotime('2026-07-17T10:08:00Z'), strtotime('2026-07-17T10:00:01Z'));
timeline_policy_test($ended_span['end'] === strtotime('2026-07-17T10:08:00Z'), 'ended vehicle spans close at the recorded end');

$cursor = raidlands_server_timeline_event_cursor_encode([
    'id' => 42,
    'span_started_at' => '2026-07-17 10:00:00',
    'occurred_at' => '2026-07-17 10:05:00',
]);
$decoded_cursor = raidlands_server_timeline_event_cursor_decode($cursor);
timeline_policy_test($cursor !== '' && $decoded_cursor === [
    'span' => '2026-07-17 10:00:00',
    'occurred' => '2026-07-17 10:05:00',
    'id' => 42,
], 'event pagination cursor preserves deterministic ordering fields');
timeline_policy_test(raidlands_server_timeline_event_cursor_decode('not-a-cursor') === null, 'invalid event cursors are rejected');

echo "server timeline policy: {$tests} assertions passed\n";
