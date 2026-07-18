<?php

declare(strict_types=1);

function raidlands_server_timeline_event_cursor_encode(array $row): string
{
    $payload = json_encode([
        'span' => (string) ($row['span_started_at'] ?? $row['occurred_at'] ?? ''),
        'occurred' => (string) ($row['occurred_at'] ?? ''),
        'id' => (int) ($row['id'] ?? 0),
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        return '';
    }
    return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
}

function raidlands_server_timeline_event_cursor_decode(string $cursor): ?array
{
    $cursor = trim($cursor);
    if ($cursor === '' || strlen($cursor) > 1024) {
        return null;
    }
    $padding = (4 - (strlen($cursor) % 4)) % 4;
    $decoded = base64_decode(strtr($cursor . str_repeat('=', $padding), '-_', '+/'), true);
    $payload = is_string($decoded) ? json_decode($decoded, true) : null;
    if (!is_array($payload)) {
        return null;
    }
    $span = strtotime(trim((string) ($payload['span'] ?? '')));
    $occurred = strtotime(trim((string) ($payload['occurred'] ?? '')));
    $id = (int) ($payload['id'] ?? 0);
    if ($span === false || $occurred === false || $id < 1) {
        return null;
    }
    return [
        'span' => gmdate('Y-m-d H:i:s', $span),
        'occurred' => gmdate('Y-m-d H:i:s', $occurred),
        'id' => $id,
    ];
}

function raidlands_server_timeline_bounds(
    ?int $requested_start,
    ?int $requested_end,
    int $server_time,
    ?int $wipe_started_at,
    int $maximum_span_seconds = 21600
): array {
    $maximum_span_seconds = max(60, $maximum_span_seconds);
    $end = min($server_time, $requested_end ?? $server_time);
    $start = $requested_start ?? ($end - min(900, $maximum_span_seconds));
    $start = max(0, $start);

    if ($wipe_started_at !== null) {
        $start = max($start, $wipe_started_at);
    }

    if ($start >= $end) {
        $start = max($wipe_started_at ?? 0, $end - 1);
    }

    if (($end - $start) > $maximum_span_seconds) {
        $start = $end - $maximum_span_seconds;
        if ($wipe_started_at !== null) {
            $start = max($start, $wipe_started_at);
        }
    }

    return [
        'start' => $start,
        'end' => $end,
        'duration' => max(1, $end - $start),
    ];
}

function raidlands_server_timeline_record_time(array $record, string $timestamp_key = 'timestamp'): ?int
{
    $timestamp = strtotime((string) ($record[$timestamp_key] ?? ''));
    return $timestamp === false ? null : $timestamp;
}

function raidlands_server_timeline_decimate(array $records, int $sample_every_seconds, string $timestamp_key = 'timestamp'): array
{
    $records = array_values(array_filter($records, static fn (array $record): bool => raidlands_server_timeline_record_time($record, $timestamp_key) !== null));
    usort($records, static function (array $left, array $right) use ($timestamp_key): int {
        return (raidlands_server_timeline_record_time($left, $timestamp_key) ?? 0)
            <=> (raidlands_server_timeline_record_time($right, $timestamp_key) ?? 0);
    });

    if ($sample_every_seconds <= 0 || count($records) <= 2) {
        return $records;
    }

    $stride = max(1, $sample_every_seconds);
    $origin = raidlands_server_timeline_record_time($records[0], $timestamp_key) ?? 0;
    $bucketed = [];

    foreach ($records as $record) {
        $timestamp = raidlands_server_timeline_record_time($record, $timestamp_key) ?? $origin;
        $bucket = (int) floor(($timestamp - $origin) / $stride);
        $bucketed[$bucket] = $record;
    }

    $selected = array_values($bucketed);
    $first = $records[0];
    $last = $records[count($records) - 1];
    if (($selected[0][$timestamp_key] ?? '') !== ($first[$timestamp_key] ?? '')) {
        array_unshift($selected, $first);
    }
    if (($selected[count($selected) - 1][$timestamp_key] ?? '') !== ($last[$timestamp_key] ?? '')) {
        $selected[] = $last;
    }

    return $selected;
}

function raidlands_server_timeline_event_span(array $payload, int $occurred_at, int $created_at): array
{
    $kind = strtolower(trim((string) ($payload['kind'] ?? '')));
    if ($kind !== 'world_vehicle') {
        return ['start' => $occurred_at, 'end' => $occurred_at];
    }

    $started = strtotime((string) ($payload['spawnedAt'] ?? $payload['spawned_at'] ?? ''));
    $ended = strtotime((string) ($payload['endedAt'] ?? $payload['ended_at'] ?? ''));
    $state = strtolower(trim((string) ($payload['state'] ?? 'active')));

    return [
        'start' => $started === false ? min($created_at, $occurred_at) : $started,
        'end' => in_array($state, ['ended', 'destroyed'], true)
            ? ($ended === false ? $occurred_at : $ended)
            : null,
    ];
}
