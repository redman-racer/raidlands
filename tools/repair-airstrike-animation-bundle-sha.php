<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/airstrike-animations.php';

$dry_run = in_array('--dry-run', $argv, true);
$revision = null;

foreach ($argv as $arg) {
    if (preg_match('/^--revision=(\d+)$/', $arg, $matches)) {
        $revision = (int) $matches[1];
    }
}

raidlands_airstrike_animations_require_schema();
$row = raidlands_airstrike_animations_latest_bundle_row($revision);

if ($row === null) {
    fwrite(STDERR, "No published airstrike animation bundle was found.\n");
    exit(1);
}

$bundle_json = (string) $row['bundle_json'];
if ($bundle_json === '') {
    fwrite(STDERR, "Bundle revision {$row['revision']} has empty bundle_json; republish instead of repairing the hash.\n");
    exit(1);
}

raidlands_airstrike_animations_decode_json($bundle_json, 'Published bundle');

$stored_sha = strtolower((string) $row['sha256']);
$actual_sha = hash('sha256', $bundle_json);
$bundle_revision = (int) $row['revision'];

if (hash_equals($stored_sha, $actual_sha)) {
    echo "revision={$bundle_revision} ok sha256={$stored_sha}\n";
    exit(0);
}

if (!$dry_run) {
    raidlands_db_execute(
        'UPDATE airstrike_animation_bundles SET sha256 = :sha256 WHERE revision = :revision',
        [
            'sha256' => $actual_sha,
            'revision' => $bundle_revision,
        ]
    );
}

echo "revision={$bundle_revision} repaired=" . ($dry_run ? 'no' : 'yes')
    . " old={$stored_sha} new={$actual_sha}\n";
