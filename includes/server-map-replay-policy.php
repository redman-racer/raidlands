<?php

declare(strict_types=1);

function raidlands_server_map_replay_wipe_key_is_generic(string $wipe_key, string $server_id): bool
{
    $wipe_key = strtolower(trim($wipe_key));
    $server_id = strtolower(trim($server_id));

    return $wipe_key === ''
        || $wipe_key === 'current'
        || $wipe_key === $server_id
        || $wipe_key === $server_id . '-current'
        || str_ends_with($wipe_key, '-current');
}

function raidlands_server_map_replay_current_wipe_started_at(array $status, ?array $active_wipe): ?int
{
    $candidates = [
        $active_wipe['started_at'] ?? null,
        $status['wipe_started_at'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        $timestamp = strtotime((string) $candidate);
        if ($timestamp !== false && $timestamp > 0) {
            return $timestamp;
        }
    }

    return null;
}

function raidlands_server_map_replay_window_bounds(array $range_info, int $window_end_time, ?int $wipe_started_at): array
{
    $window_end_time = max(1, $window_end_time);
    $requested_seconds = max(60, (int) ($range_info['minutes'] ?? 15) * 60);
    $window_start_time = $window_end_time - $requested_seconds;

    if ($wipe_started_at !== null && $wipe_started_at > 0) {
        $window_start_time = max($window_start_time, $wipe_started_at);
    }

    return [
        'start' => min($window_start_time, $window_end_time - 1),
        'end' => $window_end_time,
        'duration' => max(1, $window_end_time - $window_start_time),
    ];
}
