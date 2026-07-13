<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/airstrike-animations.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This repair must be run from the command line.\n");
    exit(1);
}

$revision = isset($argv[1]) ? (int) $argv[1] : 0;
$force = in_array('--force', $argv, true);

if ($revision <= 0) {
    fwrite(STDERR, "Usage: php database/repairs/repair_airstrike_animation_bundle_revision.php <revision> [--force]\n");
    exit(1);
}

raidlands_airstrike_animations_require_schema();
$pdo = raidlands_db_required();

$bundle = raidlands_db_fetch_one(
    'SELECT revision, bundle_json, sha256
     FROM airstrike_animation_bundles
     WHERE revision = :revision
     LIMIT 1',
    ['revision' => $revision]
);

if ($bundle === null) {
    fwrite(STDERR, "Bundle revision {$revision} does not exist.\n");
    exit(1);
}

$current_json = (string) ($bundle['bundle_json'] ?? '');
$current_sha = strtolower((string) ($bundle['sha256'] ?? ''));
$current_valid = false;

if (trim($current_json) !== '' && preg_match('/^[a-f0-9]{64}$/', $current_sha)) {
    try {
        json_decode($current_json, true, 512, JSON_THROW_ON_ERROR);
        $current_valid = hash_equals(hash('sha256', $current_json), $current_sha);
    } catch (Throwable $error) {
        $current_valid = false;
    }
}

if ($current_valid && !$force) {
    echo "Bundle revision {$revision} already has valid JSON and matching SHA. Use --force to rebuild anyway.\n";
    exit(0);
}

$rows = raidlands_db_fetch_all(
    'SELECT p.profile_key, r.source_json
     FROM airstrike_animation_profile_revisions r
     INNER JOIN airstrike_animation_profiles p ON p.id = r.profile_id
     WHERE r.bundle_revision = :revision
     ORDER BY p.profile_key ASC',
    ['revision' => $revision]
);

if ($rows === []) {
    fwrite(STDERR, "No profile revision rows exist for bundle revision {$revision}.\n");
    exit(1);
}

$sources = [];
foreach ($rows as $row) {
    $profile_key = raidlands_airstrike_animations_clean_key((string) ($row['profile_key'] ?? ''));
    $source = raidlands_airstrike_animations_decode_json((string) ($row['source_json'] ?? ''), 'Profile source');
    $sources[$profile_key] = raidlands_airstrike_animations_assert_source($source, $profile_key);
}

$compiled = raidlands_airstrike_animation_compile_bundle(
    $sources,
    $revision,
    false,
    raidlands_airstrike_animations_vehicle_metadata()
);

$canonical_json = (string) ($compiled['canonical_json'] ?? '');
$sha256 = strtolower((string) ($compiled['sha256'] ?? ''));
$bundle_payload = (array) ($compiled['bundle'] ?? []);
$compiler_version = (string) ($bundle_payload['CompilerVersion'] ?? RAIDLANDS_AIRSTRIKE_ANIMATION_COMPILER_VERSION);

if ($canonical_json === '' || strlen($canonical_json) > RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_BUNDLE_BYTES) {
    fwrite(STDERR, "Compiled bundle is empty or exceeds the configured size limit.\n");
    exit(1);
}

if (!preg_match('/^[a-f0-9]{64}$/', $sha256) || !hash_equals(hash('sha256', $canonical_json), $sha256)) {
    fwrite(STDERR, "Compiled bundle SHA verification failed.\n");
    exit(1);
}

raidlands_db_execute(
    'UPDATE airstrike_animation_bundles
     SET schema_version = 2,
         compiler_version = :compiler_version,
         bundle_json = :bundle_json,
         sha256 = :sha256,
         profile_count = :profile_count
     WHERE revision = :revision',
    [
        'compiler_version' => $compiler_version,
        'bundle_json' => $canonical_json,
        'sha256' => $sha256,
        'profile_count' => count($sources),
        'revision' => $revision,
    ]
);

echo "Rebuilt airstrike animation bundle revision {$revision} with " . count($sources) . " profile(s). SHA {$sha256}\n";
