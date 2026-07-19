<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/outpost-leaderboard.php';

try {
    $payload = raidlands_outpost_leaderboard_payload();
    $cache_directory = $site_root . '/data/cache/outpost-leaderboard';
    if (!is_dir($cache_directory) && !mkdir($cache_directory, 0775, true) && !is_dir($cache_directory)) {
        throw new RuntimeException('Could not create the Outpost leaderboard cache.');
    }

    $current_revision = (string) ($payload['revision'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $current_revision)) {
        throw new RuntimeException('The Outpost leaderboard revision is invalid.');
    }
    $payload_cache_file = $cache_directory . '/' . $current_revision . '.json';
    if (!is_file($payload_cache_file)) {
        $encoded_payload = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $temporary_payload = $payload_cache_file . '.' . getmypid() . '.tmp';
        if (!is_string($encoded_payload) || file_put_contents($temporary_payload, $encoded_payload, LOCK_EX) === false) {
            @unlink($temporary_payload);
            throw new RuntimeException('Could not cache the Outpost leaderboard payload.');
        }
        if (!@rename($temporary_payload, $payload_cache_file) && !is_file($payload_cache_file)) {
            @unlink($temporary_payload);
            throw new RuntimeException('Could not commit the Outpost leaderboard payload cache.');
        }
        @unlink($temporary_payload);
    }

    $image = strtolower(trim((string) ($_GET['image'] ?? '')));

    if ($image === '') {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!in_array($image, ['top25', 'plaque-1', 'plaque-2', 'plaque-3'], true)) {
        http_response_code(404);
        exit;
    }

    $requested_revision = strtolower(trim((string) ($_GET['revision'] ?? '')));
    if ($requested_revision !== '' && !preg_match('/^[a-f0-9]{64}$/', $requested_revision)) {
        http_response_code(404);
        exit;
    }
    $revision = preg_match('/^[a-f0-9]{64}$/', $requested_revision) ? $requested_revision : $current_revision;
    if ($revision !== $current_revision) {
        $requested_payload_file = $cache_directory . '/' . $revision . '.json';
        $cached_payload = is_file($requested_payload_file)
            ? json_decode((string) file_get_contents($requested_payload_file), true)
            : null;
        if (!is_array($cached_payload) || !hash_equals($revision, (string) ($cached_payload['revision'] ?? ''))) {
            http_response_code(404);
            exit;
        }
        $payload = $cached_payload;
    }

    $etag = '"' . $revision . '-' . $image . '"';
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }

    $cache_file = $cache_directory . '/' . $revision . '-' . $image . '.png';
    if (!is_file($cache_file)) {
        $png = raidlands_outpost_leaderboard_render_png($payload, $image);
        $temporary = $cache_file . '.' . getmypid() . '.tmp';
        if (file_put_contents($temporary, $png, LOCK_EX) === false) {
            @unlink($temporary);
            throw new RuntimeException('Could not write the Outpost leaderboard image cache.');
        }
        if (!@rename($temporary, $cache_file) && !is_file($cache_file)) {
            @unlink($temporary);
            throw new RuntimeException('Could not commit the Outpost leaderboard image cache.');
        }
        @unlink($temporary);
    }

    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=300, immutable');
    header('ETag: ' . $etag);
    header('Content-Length: ' . filesize($cache_file));
    readfile($cache_file);
} catch (Throwable $error) {
    if ((string) ($_GET['image'] ?? '') !== '') {
        http_response_code(503);
        exit;
    }
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
