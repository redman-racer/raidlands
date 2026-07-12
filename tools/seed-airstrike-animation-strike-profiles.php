<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/airstrike-animations.php';

/**
 * Seeds strike-keyed Portable Airstrikes animation profiles.
 *
 * These profiles restore coverage for strike wrappers after ordnance/timing moved
 * into the animation profile source of truth. The seeder is conservative: by
 * default it inserts missing profiles only. Pass --overwrite-seeded to refresh a
 * profile that still carries this script's seed tag.
 */

$overwrite_seeded = in_array('--overwrite-seeded', $argv, true);
$dry_run = in_array('--dry-run', $argv, true);

function seed_airstrike_event(
    string $id,
    float $time,
    string $payload,
    int $count,
    float $spread = 0.0,
    float $launch_speed = -1.0,
    float $fuse_seconds = -1.0,
    float $splash_radius = -1.0,
    float $impact_radius = -1.0,
    float $tracking_seconds = -1.0,
    float $tracking_distance = -1.0,
    float $damage_scale = 1.0,
    float $vehicle_damage_scale = -1.0,
    float $target_x = 0.0,
    float $target_z = 0.0,
    float $carrier_x = 0.0,
    float $carrier_y = 0.0,
    float $carrier_z = 0.0
): array {
    return [
        'Id' => $id,
        'Time' => $time,
        'Payload' => $payload,
        'Count' => $count,
        'CarrierOffsetX' => $carrier_x,
        'CarrierOffsetY' => $carrier_y,
        'CarrierOffsetZ' => $carrier_z,
        'TargetOffsetX' => $target_x,
        'TargetOffsetY' => 0.0,
        'TargetOffsetZ' => $target_z,
        'SpreadRadius' => $spread,
        'LaunchSpeed' => $launch_speed,
        'FuseSeconds' => $fuse_seconds,
        'DamageScale' => $damage_scale,
        'VehicleDamageScale' => $vehicle_damage_scale,
        'SplashRadius' => $splash_radius,
        'ImpactRadius' => $impact_radius,
        'MaxTrackingSeconds' => $tracking_seconds,
        'MaxTrackingDistance' => $tracking_distance,
        'DamageScales' => [],
    ];
}

function seed_airstrike_waypoints(array $points): array
{
    $waypoints = [];
    foreach ($points as $index => $point) {
        $waypoints[] = [
            'Id' => 'wp_' . ($index + 1),
            'Time' => (float) $point[0],
            'X' => (float) $point[1],
            'Y' => (float) $point[2],
            'Z' => (float) $point[3],
            'RotationX' => 0.0,
            'RotationY' => 0.0,
            'RotationZ' => 0.0,
        ];
    }

    return $waypoints;
}

function seed_airstrike_profile(
    string $key,
    string $name,
    string $vehicle,
    float $duration,
    array $waypoints,
    array $events,
    ?float $first_payload_delay = null,
    string $notes = 'Seeded from PortableAirstrikes strike definitions.'
): array {
    $maximum_units = 0;
    foreach ($events as $event) {
        $maximum_units += (int) ($event['Count'] ?? 0);
    }

    return [
        'EditorSourceSchemaVersion' => 1,
        'ProfileKey' => $key,
        'DisplayName' => $name,
        'Vehicle' => $vehicle,
        'DurationSeconds' => $duration,
        'FirstPayloadDelaySeconds' => $first_payload_delay ?? (float) ($events[0]['Time'] ?? 0.0),
        'RotationSmoothTimeSeconds' => 0.16,
        'StopAtWaypoints' => false,
        'MinimumTerrainClearance' => $vehicle === 'drone' ? 12.0 : ($vehicle === 'a10' ? 50.0 : 42.0),
        'PositionInterpolation' => 'time_hermite',
        'RotationMode' => 'follow_path_plus_offset',
        'Waypoints' => $waypoints,
        'ReleaseSource' => [
            'Mode' => 'manual',
            'MaximumUnits' => $maximum_units,
            'FallbackIntervalSeconds' => 0.5,
            'Events' => $events,
        ],
        'EditorMetadata' => [
            'Notes' => $notes,
            'Tags' => ['seed', 'strike-package'],
            'VehiclePreviewOverrides' => [],
        ],
    ];
}

function seed_airstrike_profiles(): array
{
    $profiles = [];

    foreach ([
        ['bee_swarm_drone', 'Bee Swarm Drone', 'bee_grenade', 6, 8.0],
        ['beancan_drop', 'Beancan Drop', 'beancan', 4, 7.0],
        ['f1_cluster', 'F1 Cluster Drop', 'f1_grenade', 5, 9.0],
        ['smoke_screen', 'Smoke Screen Drop', 'smoke', 5, 12.0],
        ['flash_breach', 'Flash Breach Drop', 'flashbang', 3, 6.0],
        ['he_40mm_micro', '40mm HE Micro-Strike', 'he_40mm', 3, 5.0],
        ['molotov_drop', 'Molotov Drop', 'molotov', 3, 7.0],
    ] as [$key, $name, $payload, $count, $spread]) {
        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            'drone',
            7.0,
            seed_airstrike_waypoints([[0, -8, 35, -90], [2, 4, 28, -30], [4, 0, 24, 0], [7, 8, 35, 90]]),
            [seed_airstrike_event('release_1', 4.0, $payload, $count, $spread, $payload === 'he_40mm' ? 35.0 : -1.0)]
        );
    }

    foreach ([
        ['bee_swarm_heavy', 'Heavy Bee Swarm', 'bee_catapult_bomb', 6, 16.0],
        ['firebomb_run', 'Firebomb Run', 'firebomb', 4, 18.0],
        ['propane_bomb_drop', 'Propane Bomb Drop', 'propane_bomb', 3, 16.0],
    ] as [$key, $name, $payload, $count, $spread]) {
        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            'cargo_plane',
            11.0,
            seed_airstrike_waypoints([[0, 0, 145, -360], [4, -12, 118, -120], [6, 0, 95, 0], [8, 12, 118, 120], [11, 0, 145, 360]]),
            [seed_airstrike_event('release_1', 5.6, $payload, $count, $spread)],
            5.6
        );
    }

    foreach ([
        ['mortar_he', 'Mortar HE Mission', 'mortar_he_payload', 6, 24.0],
        ['mortar_frag', 'Mortar Frag Mission', 'mortar_frag_payload', 8, 28.0],
    ] as [$key, $name, $payload, $count, $spread]) {
        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            'cargo_plane',
            8.0,
            seed_airstrike_waypoints([[0, -240, 120, -80], [4, 0, 100, 0], [8, 240, 120, 80]]),
            [
                seed_airstrike_event('salvo_1', 2.2, $payload, intdiv($count, 2), $spread),
                seed_airstrike_event('salvo_2', 4.2, $payload, $count - intdiv($count, 2), $spread),
            ],
            2.2,
            'Off-map mortar authored as a timed strike package so ordnance remains profile-owned.'
        );
    }

    foreach ([
        ['hv_rocket_run', 'HV Rocket Run', 'hv_rocket', 4, 8.0],
        ['rocket_run', 'Rocket Run', 'rocket', 4, 10.0],
        ['incendiary_rocket_run', 'Incendiary Rocket Run', 'incendiary_rocket', 4, 12.0],
    ] as [$key, $name, $payload, $count, $spread]) {
        $events = [];
        for ($i = 0; $i < $count; $i++) {
            $left = $i % 2 === 0;
            $events[] = seed_airstrike_event(
                ($left ? 'left' : 'right') . '_' . (intdiv($i, 2) + 1),
                4.6 + ($i * 0.3),
                $payload,
                1,
                $spread,
                85.0,
                -1.0,
                -1.0,
                -1.0,
                -1.0,
                -1.0,
                1.0,
                -1.0,
                0.0,
                0.0,
                $left ? -1.8 : 1.8,
                -0.3,
                1.0
            );
        }

        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            'attack_heli',
            9.5,
            seed_airstrike_waypoints([[0, -55, 95, -300], [3, -12, 78, -100], [5, 0, 70, 0], [7, 12, 78, 100], [9.5, 55, 95, 300]]),
            $events,
            4.6
        );
    }

    $profiles[] = seed_airstrike_profile(
        'a10_strafe',
        'A-10 BRRRRT Run',
        'a10',
        8.5,
        seed_airstrike_waypoints([[0, 0, 150, -430], [2.3, -5, 115, -220], [3.8, 0, 82, -45], [5.3, 0, 82, 65], [8.5, 4, 155, 430]]),
        [seed_airstrike_event('brrrrt', 3.8, 'bradley_longbarrel_burst', 1, -1.0)],
        3.8
    );

    foreach ([
        ['homing_heli', 'Heli Homing Strike', 'attack_heli', 2, 10.0, 300.0],
        ['homing_jet', 'Jet Homing Strike', 'f15', 3, 12.0, 350.0],
    ] as [$key, $name, $vehicle, $count, $tracking_seconds, $tracking_distance]) {
        $events = [];
        for ($i = 0; $i < $count; $i++) {
            $events[] = seed_airstrike_event('missile_' . ($i + 1), 4.8 + ($i * 0.6), 'homing_missile', 1, 8.0, 120.0, 0.0, 4.0, 4.0, $tracking_seconds, $tracking_distance, 1.0, 1.25);
        }

        $duration = $vehicle === 'attack_heli' ? 10.0 : 12.0;
        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            $vehicle,
            $duration,
            seed_airstrike_waypoints([[0, -90, 95, -320], [4, -10, 85, -80], [6, 0, 80, 0], [$duration, 100, 120, 320]]),
            $events,
            4.8
        );
    }

    foreach ([
        ['mini_mlrs', 'Mini MLRS Barrage', 8, 35.0],
        ['full_mlrs', 'Full MLRS Barrage', 16, 55.0],
    ] as [$key, $name, $count, $spread]) {
        $events = [];
        for ($i = 0; $i < $count; $i++) {
            $events[] = seed_airstrike_event('rocket_' . str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT), 6.5 + (intdiv($i, 2) * 0.25), 'mlrs_rocket', 1, $spread);
        }

        $profiles[] = seed_airstrike_profile(
            $key,
            $name,
            'f15',
            13.0,
            seed_airstrike_waypoints([[0, 0, 160, -520], [4, -20, 130, -180], [6.5, 0, 105, -20], [8, 0, 105, 80], [13, 20, 160, 520]]),
            $events,
            6.5
        );
    }

    return $profiles;
}

function seed_airstrike_source_is_seeded(array $source): bool
{
    $tags = $source['EditorMetadata']['Tags'] ?? [];
    return is_array($tags) && in_array('seed', $tags, true) && in_array('strike-package', $tags, true);
}

raidlands_airstrike_animations_require_schema();

$inserted = 0;
$updated = 0;
$skipped = 0;
$validated = 0;

foreach (seed_airstrike_profiles() as $source) {
    $source = raidlands_airstrike_animations_assert_source($source);
    $key = (string) $source['ProfileKey'];
    $source_json = raidlands_airstrike_animations_source_json($source);
    $source_sha = hash('sha256', $source_json);
    $validated++;

    $existing = raidlands_db_fetch_one(
        'SELECT profile_key, draft_version, draft_source_json FROM airstrike_animation_profiles WHERE profile_key = :profile_key LIMIT 1',
        ['profile_key' => $key]
    );

    if ($existing === null) {
        if (!$dry_run) {
            raidlands_db_execute(
                'INSERT INTO airstrike_animation_profiles
                    (profile_key, display_name, vehicle, draft_source_json, draft_source_sha256, draft_version, created_by, updated_by)
                 VALUES
                    (:profile_key, :display_name, :vehicle, :source_json, :source_sha, 1, NULL, NULL)',
                [
                    'profile_key' => $key,
                    'display_name' => mb_substr((string) $source['DisplayName'], 0, 160),
                    'vehicle' => mb_substr((string) $source['Vehicle'], 0, 40),
                    'source_json' => $source_json,
                    'source_sha' => $source_sha,
                ]
            );
        }
        $inserted++;
        echo "insert {$key} {$source_sha}\n";
        continue;
    }

    $existing_source = raidlands_airstrike_animations_decode_json((string) $existing['draft_source_json'], 'Existing draft source');
    if (!$overwrite_seeded || !seed_airstrike_source_is_seeded($existing_source)) {
        $skipped++;
        echo "skip {$key} existing draft is not being overwritten\n";
        continue;
    }

    if (!$dry_run) {
        raidlands_db_execute(
            'UPDATE airstrike_animation_profiles
             SET display_name = :display_name,
                 vehicle = :vehicle,
                 draft_source_json = :source_json,
                 draft_source_sha256 = :source_sha,
                 draft_version = draft_version + 1,
                 updated_by = NULL,
                 updated_at = NOW()
             WHERE profile_key = :profile_key',
            [
                'display_name' => mb_substr((string) $source['DisplayName'], 0, 160),
                'vehicle' => mb_substr((string) $source['Vehicle'], 0, 40),
                'source_json' => $source_json,
                'source_sha' => $source_sha,
                'profile_key' => $key,
            ]
        );
    }

    $updated++;
    echo "update {$key} {$source_sha}\n";
}

echo "validated={$validated} inserted={$inserted} updated={$updated} skipped={$skipped} dryRun=" . ($dry_run ? 'yes' : 'no') . "\n";
