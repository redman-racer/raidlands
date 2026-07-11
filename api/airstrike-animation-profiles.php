<?php

require __DIR__ . '/../includes/bootstrap.php';
require_once $site_root . '/includes/airstrike-animations.php';

header('Cache-Control: no-store');

try {
    if (!raidlands_airstrike_animations_schema_ready()) {
        raidlands_store_json_response([
            'ok' => true,
            'revision' => 0,
            'profiles' => [],
        ]);
    }

    $bundle = raidlands_airstrike_animations_bundle_for_server(0);
    $profiles = is_array($bundle['bundle']['Profiles'] ?? null)
        ? (array) $bundle['bundle']['Profiles']
        : [];

    raidlands_store_json_response([
        'ok' => true,
        'revision' => (int) ($bundle['current_revision'] ?? 0),
        'publishedAt' => (string) ($bundle['published_at'] ?? ''),
        'profiles' => $profiles,
    ]);
} catch (Throwable $error) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Published airstrike animations are unavailable.',
    ], 500);
}
