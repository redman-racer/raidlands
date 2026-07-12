<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/airstrike-animations.php';

$body = '';
raidlands_bridge_authorize($body);
header('Cache-Control: no-store');

try {
    $since_raw = (string) ($_GET['since'] ?? '0');
    $revision_raw = trim((string) ($_GET['revision'] ?? ''));
    $local_hash = strtolower(trim((string) ($_GET['local_hash'] ?? '')));

    if (!ctype_digit($since_raw)) {
        throw new InvalidArgumentException('since must be zero or a positive integer.');
    }
    if ($revision_raw !== '' && (!ctype_digit($revision_raw) || (int) $revision_raw <= 0)) {
        throw new InvalidArgumentException('revision must be a positive integer.');
    }
    if ($local_hash !== '' && !preg_match('/^[a-f0-9]{64}$/', $local_hash)) {
        throw new InvalidArgumentException('local_hash must be an SHA-256 hex value.');
    }

    $result = raidlands_airstrike_animations_bundle_for_server(
        (int) $since_raw,
        $revision_raw === '' ? null : (int) $revision_raw
    );

    if (!empty($result['sha256'])) {
        header('ETag: "' . (string) $result['sha256'] . '"');
    }

    raidlands_store_json_response($result);
} catch (InvalidArgumentException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (OutOfBoundsException $error) {
    raidlands_store_json_response(['ok' => false, 'error' => $error->getMessage()], 404);
} catch (Throwable $error) {
    $message = $error->getMessage();
    if (str_contains($message, 'SQLSTATE[01004]') || str_contains($message, 'right truncated')) {
        $message .= ' Run database/migrations/057_repair_airstrike_animation_column_widths.sql on the website database. Storage: '
            . raidlands_airstrike_animations_storage_summary();
    }

    raidlands_store_json_response(['ok' => false, 'error' => $message], 500);
}
