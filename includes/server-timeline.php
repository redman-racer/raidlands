<?php

declare(strict_types=1);

require_once __DIR__ . '/server-status.php';

function raidlands_server_timeline_timestamp($value): ?int
{
    $timestamp = strtotime(trim((string) $value));
    return $timestamp === false ? null : $timestamp;
}

function raidlands_server_timeline_includes($value): array
{
    $allowed = ['environment', 'players', 'heatmap', 'events'];
    $requested = array_filter(array_map(
        static fn (string $entry): string => strtolower(trim($entry)),
        explode(',', (string) $value)
    ));
    if ($requested === []) {
        return $allowed;
    }

    return array_values(array_intersect($allowed, array_unique($requested)));
}

function raidlands_server_timeline_iso(?int $timestamp): string
{
    return $timestamp === null ? '' : gmdate('c', $timestamp);
}

function raidlands_server_timeline_player_where(string $server_id, array $context, bool $include_all, string $prefix = ''): array
{
    $params = [$prefix . 'server_id' => $server_id];
    $where = 'server_id = :' . $prefix . 'server_id';
    $steam_id64 = (string) ($context['steamId64'] ?? '');

    if (!$include_all || empty($context['canViewAll'])) {
        if (empty($context['authenticated']) || $steam_id64 === '') {
            return ['where' => $where . ' AND 1 = 0', 'params' => $params];
        }

        $where .= ' AND (steam_id64 = :' . $prefix . 'steam_id64';
        $params[$prefix . 'steam_id64'] = $steam_id64;
        $clan_tag = raidlands_server_status_clean_text($context['clanTag'] ?? '', 32);
        if ($clan_tag !== '') {
            $where .= ' OR clan_tag = :' . $prefix . 'clan_tag';
            $params[$prefix . 'clan_tag'] = $clan_tag;
        }
        $where .= ')';
    }

    return ['where' => $where, 'params' => $params];
}

function raidlands_server_timeline_latest_value(string $sql, array $params): string
{
    try {
        $row = raidlands_db_fetch_one($sql, $params);
        return raidlands_server_status_iso($row['latest_at'] ?? '');
    } catch (Throwable $error) {
        return '';
    }
}

function raidlands_server_timeline_environment_stream(
    string $server_id,
    string $wipe_key,
    array $bounds,
    int $sample_every,
    bool $head_only
): array
{
    $available = raidlands_server_environment_is_ready()
        ? raidlands_server_timeline_latest_value(
            'SELECT MAX(sampled_at) AS latest_at FROM server_environment_snapshots
             WHERE server_id = :server_id AND wipe_key = :wipe_key AND sampled_at <= :window_end',
            [
                'server_id' => $server_id,
                'wipe_key' => $wipe_key,
                'window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
            ]
        )
        : '';
    $stream = [
        'cadenceSeconds' => 30,
        'availableThrough' => $available,
        'ready' => raidlands_server_environment_is_ready(),
        'access' => ['allowed' => true, 'scope' => 'public'],
        'delay' => ['label' => 'Live', 'delaySeconds' => 0],
        'items' => [],
    ];
    if ($head_only || !$stream['ready']) {
        return $stream;
    }

    $rows = raidlands_db_fetch_all(
        'SELECT * FROM server_environment_snapshots
         WHERE server_id = :server_id AND wipe_key = :wipe_key
           AND sampled_at BETWEEN :window_start AND :window_end
         ORDER BY sampled_at ASC',
        [
            'server_id' => $server_id,
            'wipe_key' => $wipe_key,
            'window_start' => gmdate('Y-m-d H:i:s', $bounds['start']),
            'window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
        ]
    );
    $items = array_map(static function (array $row): array {
        $environment = raidlands_server_environment_snapshot_public($row);
        return [
            'timestamp' => (string) ($environment['sampledAt'] ?? ''),
            'environment' => $environment,
        ];
    }, $rows);
    $stream['items'] = raidlands_server_timeline_decimate($items, $sample_every);
    return $stream;
}

function raidlands_server_timeline_player_stream(
    string $server_id,
    array $context,
    array $bounds,
    int $sample_every,
    bool $include_all,
    bool $head_only
): array {
    $history_ready = raidlands_server_player_location_history_is_ready();
    $include_all = $include_all && !empty($context['canViewAll']);
    $filter = raidlands_server_timeline_player_where($server_id, $context, $include_all, 'player_');
    $available = $history_ready
        ? raidlands_server_timeline_latest_value(
            'SELECT MAX(sampled_at) AS latest_at FROM server_player_location_history WHERE ' . $filter['where'] . ' AND sampled_at <= :player_window_end',
            array_merge($filter['params'], ['player_window_end' => gmdate('Y-m-d H:i:s', $bounds['end'])])
        )
        : '';
    $stream = [
        'cadenceSeconds' => 15,
        'availableThrough' => $available,
        'ready' => $history_ready,
        'access' => [
            'allowed' => !empty($context['authenticated']),
            'scope' => $include_all ? 'all' : ((string) ($context['clanTag'] ?? '') !== '' ? 'clan' : 'self'),
        ],
        'delay' => ['label' => 'Live', 'delaySeconds' => 0],
        'authenticated' => !empty($context['authenticated']),
        'allPlayers' => $include_all,
        'clanTag' => (string) ($context['clanTag'] ?? ''),
        'items' => [],
    ];
    if ($head_only || !$history_ready || (empty($context['authenticated']) && !$include_all)) {
        return $stream;
    }

    $rows = raidlands_db_fetch_all(
        'SELECT steam_id64, display_name, clan_tag, x, y, z, sampled_at
         FROM server_player_location_history
         WHERE ' . $filter['where'] . ' AND sampled_at BETWEEN :player_window_start AND :player_window_end
         ORDER BY sampled_at ASC, display_name ASC',
        array_merge($filter['params'], [
            'player_window_start' => gmdate('Y-m-d H:i:s', $bounds['start']),
            'player_window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
        ])
    );
    $frames = [];
    $self_steam_id64 = (string) ($context['steamId64'] ?? '');
    foreach ($rows as $row) {
        $timestamp = raidlands_server_status_iso($row['sampled_at'] ?? '');
        if ($timestamp === '') {
            continue;
        }
        if (!isset($frames[$timestamp])) {
            $frames[$timestamp] = ['timestamp' => $timestamp, 'players' => []];
        }
        $steam_id64 = (string) ($row['steam_id64'] ?? '');
        $frames[$timestamp]['players'][] = [
            'steamId64' => $steam_id64,
            'displayName' => raidlands_server_status_clean_text($row['display_name'] ?? '', 120),
            'clanTag' => raidlands_server_status_clean_text($row['clan_tag'] ?? '', 32),
            'x' => (float) ($row['x'] ?? 0),
            'y' => (float) ($row['y'] ?? 0),
            'z' => (float) ($row['z'] ?? 0),
            'isSelf' => $self_steam_id64 !== '' && hash_equals($self_steam_id64, $steam_id64),
            'sampledAt' => $timestamp,
        ];
    }
    $stream['items'] = raidlands_server_timeline_decimate(array_values($frames), $sample_every);
    return $stream;
}

function raidlands_server_timeline_heatmap_stream(
    string $server_id,
    string $wipe_key,
    string $metric,
    array $bounds,
    int $sample_every,
    bool $head_only
): array {
    $delay = raidlands_server_heatmap_viewer_delay();
    $available_end = min($bounds['end'], time() - max(0, (int) $delay['delay_seconds']));
    $params = [
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'window_end' => gmdate('Y-m-d H:i:s', $available_end),
    ];
    $metric_where = '';
    if ($metric !== 'all') {
        $metric_where = ' AND metric = :metric';
        $params['metric'] = $metric;
    }
    $ready = raidlands_server_heatmap_is_ready();
    $available = $ready
        ? raidlands_server_timeline_latest_value(
            'SELECT MAX(window_end) AS latest_at FROM server_heatmap_buckets
             WHERE server_id = :server_id AND wipe_key = :wipe_key AND window_end <= :window_end' . $metric_where,
            $params
        )
        : '';
    $stream = [
        'cadenceSeconds' => 300,
        'availableThrough' => $available,
        'ready' => $ready,
        'access' => ['allowed' => true, 'scope' => 'viewer-policy'],
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
        'metric' => $metric,
        'palette' => raidlands_server_heatmap_palette(),
        'items' => [],
    ];
    if ($head_only || !$ready || $available_end < $bounds['start']) {
        return $stream;
    }

    $query_params = array_merge($params, ['window_start' => gmdate('Y-m-d H:i:s', $bounds['start'])]);
    $rows = raidlands_db_fetch_all(
        'SELECT bucket_size, x, z, metric, value, sample_count, window_start, window_end
         FROM server_heatmap_buckets
         WHERE server_id = :server_id AND wipe_key = :wipe_key
           AND window_end >= :window_start AND window_end <= :window_end' . $metric_where . '
         ORDER BY window_end ASC, value DESC',
        $query_params
    );
    $frames = [];
    foreach ($rows as $row) {
        $window_start = raidlands_server_status_iso($row['window_start'] ?? '');
        $window_end = raidlands_server_status_iso($row['window_end'] ?? '');
        if ($window_end === '') {
            continue;
        }
        $frame_key = $window_start . '|' . $window_end;
        if (!isset($frames[$frame_key])) {
            $frames[$frame_key] = [
                'timestamp' => $window_end,
                'windowStart' => $window_start,
                'windowEnd' => $window_end,
                'maxValue' => 0.0,
                'bucketsByKey' => [],
            ];
        }
        $bucket_key = (string) ($row['bucket_size'] ?? 100) . '|' . (string) ($row['x'] ?? 0) . '|' . (string) ($row['z'] ?? 0);
        if (!isset($frames[$frame_key]['bucketsByKey'][$bucket_key])) {
            $frames[$frame_key]['bucketsByKey'][$bucket_key] = [
                'bucketSize' => (int) ($row['bucket_size'] ?? 100),
                'x' => (int) ($row['x'] ?? 0),
                'z' => (int) ($row['z'] ?? 0),
                'value' => 0.0,
                'sampleCount' => 0,
                'windowStart' => $window_start,
                'windowEnd' => $window_end,
            ];
        }
        $frames[$frame_key]['bucketsByKey'][$bucket_key]['value'] += (float) ($row['value'] ?? 0);
        $frames[$frame_key]['bucketsByKey'][$bucket_key]['sampleCount'] += (int) ($row['sample_count'] ?? 0);
    }
    $items = [];
    foreach ($frames as $frame) {
        $buckets = array_values($frame['bucketsByKey']);
        $frame_max = 0.0;
        foreach ($buckets as $bucket) {
            $frame_max = max($frame_max, (float) $bucket['value']);
        }
        $normalizer = max(0.0001, $frame_max);
        foreach ($buckets as &$bucket) {
            $bucket['value'] = round((float) $bucket['value'], 4);
            $bucket['normalized'] = round(((float) $bucket['value']) / $normalizer, 4);
        }
        unset($bucket);
        $items[] = [
            'timestamp' => $frame['timestamp'],
            'windowStart' => $frame['windowStart'],
            'windowEnd' => $frame['windowEnd'],
            'maxValue' => round($frame_max, 4),
            'buckets' => $buckets,
        ];
    }
    $stream['items'] = raidlands_server_timeline_decimate($items, $sample_every);
    return $stream;
}

function raidlands_server_timeline_event_stream(
    string $server_id,
    string $wipe_key,
    array $bounds,
    bool $head_only,
    string $cursor = '',
    int $limit = 800
): array
{
    $ready = raidlands_server_map_replay_events_are_ready();
    $available = $ready
        ? raidlands_server_timeline_latest_value(
            'SELECT MAX(occurred_at) AS latest_at FROM server_map_replay_events
             WHERE server_id = :server_id AND wipe_key = :wipe_key AND occurred_at <= :window_end',
            [
                'server_id' => $server_id,
                'wipe_key' => $wipe_key,
                'window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
            ]
        )
        : '';
    $stream = [
        'cadenceSeconds' => 5,
        'availableThrough' => $available,
        'ready' => $ready,
        'access' => ['allowed' => true, 'scope' => 'public'],
        'delay' => ['label' => 'Live', 'delaySeconds' => 0],
        'complete' => true,
        'nextCursor' => null,
        'items' => [],
    ];
    if ($head_only || !$ready) {
        return $stream;
    }

    $limit = max(1, min(800, $limit));
    $query_limit = $limit + 1;
    $decoded_cursor = raidlands_server_timeline_event_cursor_decode($cursor);
    if ($cursor !== '' && $decoded_cursor === null) {
        throw new InvalidArgumentException('Recorded event cursor is invalid.');
    }

    if (raidlands_server_map_replay_span_columns_are_ready()) {
        $cursor_where = '';
        $params = [
            'server_id' => $server_id,
            'wipe_key' => $wipe_key,
            'window_start' => gmdate('Y-m-d H:i:s', $bounds['start']),
            'window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
            'open_window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
        ];
        if ($decoded_cursor !== null) {
            $cursor_where = ' AND (
              COALESCE(span_started_at, occurred_at) > :cursor_span_after
              OR (COALESCE(span_started_at, occurred_at) = :cursor_span_occurred AND occurred_at > :cursor_occurred_after)
              OR (COALESCE(span_started_at, occurred_at) = :cursor_span_id AND occurred_at = :cursor_occurred_id AND id > :cursor_id)
            )';
            $params['cursor_span_after'] = $decoded_cursor['span'];
            $params['cursor_span_occurred'] = $decoded_cursor['span'];
            $params['cursor_span_id'] = $decoded_cursor['span'];
            $params['cursor_occurred_after'] = $decoded_cursor['occurred'];
            $params['cursor_occurred_id'] = $decoded_cursor['occurred'];
            $params['cursor_id'] = $decoded_cursor['id'];
        }
        $rows = raidlands_db_fetch_all(
            'SELECT * FROM server_map_replay_events
             WHERE server_id = :server_id
               AND wipe_key = :wipe_key
               AND span_started_at <= :window_end
               AND COALESCE(span_ended_at, :open_window_end) >= :window_start
             ' . $cursor_where . '
             ORDER BY COALESCE(span_started_at, occurred_at) ASC, occurred_at ASC, id ASC
             LIMIT ' . $query_limit,
            $params
        );
    } else {
        $cursor_where = '';
        $params = [
            'server_id' => $server_id,
            'wipe_key' => $wipe_key,
            'window_start' => gmdate('Y-m-d H:i:s', $bounds['start']),
            'window_end' => gmdate('Y-m-d H:i:s', $bounds['end']),
        ];
        if ($decoded_cursor !== null) {
            $cursor_where = ' AND (
              occurred_at > :cursor_occurred_after
              OR (occurred_at = :cursor_occurred_id AND id > :cursor_id)
            )';
            $params['cursor_occurred_after'] = $decoded_cursor['occurred'];
            $params['cursor_occurred_id'] = $decoded_cursor['occurred'];
            $params['cursor_id'] = $decoded_cursor['id'];
        }
        $rows = raidlands_db_fetch_all(
            'SELECT * FROM server_map_replay_events
             WHERE server_id = :server_id AND wipe_key = :wipe_key
               AND occurred_at BETWEEN :window_start AND :window_end
               ' . $cursor_where . '
             ORDER BY occurred_at ASC, id ASC LIMIT ' . $query_limit,
            $params
        );
    }
    $stream['complete'] = count($rows) <= $limit;
    if (!$stream['complete']) {
        $rows = array_slice($rows, 0, $limit);
        $last_row = $rows[count($rows) - 1] ?? null;
        $stream['nextCursor'] = is_array($last_row) ? raidlands_server_timeline_event_cursor_encode($last_row) : null;
    }
    $stream['items'] = array_map('raidlands_server_map_replay_event_from_row', $rows);
    return $stream;
}

function raidlands_server_timeline_public(array $query): array
{
    $server_time = time();
    $requested_start = raidlands_server_timeline_timestamp($query['from'] ?? '');
    $requested_end = raidlands_server_timeline_timestamp($query['to'] ?? '');
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $active_wipe = raidlands_server_status_active_wipe_signal($server_id);
    $wipe_started_at = raidlands_server_map_replay_current_wipe_started_at(is_array($status) ? $status : [], $active_wipe);
    $bounds = raidlands_server_timeline_bounds(
        $requested_start,
        $requested_end,
        $server_time,
        $wipe_started_at
    );
    $include = raidlands_server_timeline_includes($query['include'] ?? '');
    $head_only = !empty($query['head']) && (string) $query['head'] !== '0';
    $sample_every = max(0, min(3600, (int) ceil((float) ($query['sampleEvery'] ?? 0))));
    $metric = raidlands_server_heatmap_clean_metric($query['metric'] ?? 'all');
    $context = raidlands_server_location_viewer_context($server_id);
    $include_all = !empty($query['all']) && (string) $query['all'] !== '0';
    $event_cursor = trim((string) ($query['eventCursor'] ?? ''));
    $event_limit = array_key_exists('eventLimit', $query)
        ? max(1, min(200, (int) $query['eventLimit']))
        : 800;
    $streams = [];

    if (in_array('environment', $include, true)) {
        $streams['environment'] = raidlands_server_timeline_environment_stream($server_id, $wipe_key, $bounds, $sample_every, $head_only);
    }
    if (in_array('players', $include, true)) {
        $streams['players'] = raidlands_server_timeline_player_stream($server_id, $context, $bounds, $sample_every, $include_all, $head_only);
    }
    if (in_array('heatmap', $include, true)) {
        $streams['heatmap'] = raidlands_server_timeline_heatmap_stream($server_id, $wipe_key, $metric, $bounds, $sample_every, $head_only);
    }
    if (in_array('events', $include, true)) {
        $streams['events'] = raidlands_server_timeline_event_stream($server_id, $wipe_key, $bounds, $head_only, $event_cursor, $event_limit);
    }

    return [
        'ok' => true,
        'serverId' => $server_id,
        'wipeKey' => $wipe_key,
        'wipeStartedAt' => raidlands_server_timeline_iso($wipe_started_at),
        'serverTime' => raidlands_server_timeline_iso($server_time),
        'requestedFrom' => raidlands_server_timeline_iso($requested_start),
        'requestedTo' => raidlands_server_timeline_iso($requested_end),
        'windowStart' => raidlands_server_timeline_iso($bounds['start']),
        'windowEnd' => raidlands_server_timeline_iso($bounds['end']),
        'sampleEverySeconds' => $sample_every,
        'streams' => $streams,
    ];
}
