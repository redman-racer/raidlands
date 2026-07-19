<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/airstrike-animation-compiler.php';

$tests = 0;

function airstrike_compiler_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;

    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

function airstrike_compiler_close(float $actual, float $expected, float $epsilon, string $message): void
{
    airstrike_compiler_test(
        abs($actual - $expected) <= $epsilon,
        $message . ' (expected ' . $expected . ', got ' . $actual . ')'
    );
}

function airstrike_compiler_json(string $path): array
{
    $json = file_get_contents($path);

    if (!is_string($json)) {
        throw new RuntimeException('Could not read fixture: ' . $path);
    }

    $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    if (!is_array($decoded)) {
        throw new RuntimeException('Fixture root must be an object or array: ' . $path);
    }

    return $decoded;
}

function airstrike_compiler_json_value(string $path)
{
    $json = file_get_contents($path);

    if (!is_string($json)) {
        throw new RuntimeException('Could not read fixture: ' . $path);
    }

    return json_decode($json, false, 512, JSON_THROW_ON_ERROR);
}

function airstrike_compiler_payload(array $overrides = []): array
{
    return array_replace([
        'Payload' => 'hv_rocket',
        'Count' => 1,
        'CarrierOffsetX' => 0.0,
        'CarrierOffsetY' => 0.0,
        'CarrierOffsetZ' => 0.0,
        'TargetOffsetX' => 0.0,
        'TargetOffsetY' => 0.0,
        'TargetOffsetZ' => 0.0,
        'SpreadRadius' => -1.0,
        'TargetingMode' => 'simple',
        'AccuracyPercent' => 75.0,
        'LaunchSpeed' => -1.0,
        'FuseSeconds' => -1.0,
        'DamageScale' => 1.0,
        'VehicleDamageScale' => -1.0,
        'SplashRadius' => -1.0,
        'ImpactRadius' => -1.0,
        'MaxTrackingSeconds' => -1.0,
        'MaxTrackingDistance' => -1.0,
        'DamageScales' => [],
    ], $overrides);
}

function airstrike_compiler_source(array $overrides = []): array
{
    return array_replace_recursive([
        'EditorSourceSchemaVersion' => 1,
        'ProfileKey' => 'straight_pass',
        'DisplayName' => 'Straight Pass',
        'Vehicle' => 'f15',
        'DurationSeconds' => 1.0,
        'FirstPayloadDelaySeconds' => 0.25,
        'RotationSmoothTimeSeconds' => 0.12,
        'StopAtWaypoints' => false,
        'MinimumTerrainClearance' => 55.0,
        'PositionInterpolation' => 'time_hermite',
        'RotationMode' => 'follow_path_plus_offset',
        'Waypoints' => [
            [
                'Id' => 'wp_01',
                'Time' => 0.0,
                'X' => 0.0,
                'Y' => 50.0,
                'Z' => -10.0,
                'RotationX' => 0.0,
                'RotationY' => 0.0,
                'RotationZ' => 0.0,
            ],
            [
                'Id' => 'wp_02',
                'Time' => 1.0,
                'X' => 0.0,
                'Y' => 50.0,
                'Z' => 10.0,
                'RotationX' => 0.0,
                'RotationY' => 0.0,
                'RotationZ' => 0.0,
            ],
        ],
        'ReleaseSource' => [
            'Mode' => 'manual',
            'LegacyDynamic' => true,
            'Events' => [],
            'Template' => airstrike_compiler_payload(),
        ],
    ], $overrides);
}

$catalog_path = dirname(__DIR__) . '/assets/airstrike-animation-editor/payload-catalog.json';
$catalog = airstrike_compiler_json($catalog_path);
$catalog_ids = array_column($catalog, 'id');
$php_payload_ids = raidlands_airstrike_animation_supported_payloads();
sort($catalog_ids, SORT_STRING);
sort($php_payload_ids, SORT_STRING);
airstrike_compiler_test($php_payload_ids === $catalog_ids, 'PHP validation reads every TypeScript catalog ID from the shared artifact');
airstrike_compiler_test(!in_array('shotgun_trap', $php_payload_ids, true), 'shotgun trap is absent from the shared payload catalog');

$canonical = raidlands_airstrike_animation_canonical_json([
    'z' => -0.0,
    'a' => ['y' => 1.23456789, 'x' => 2],
]);
airstrike_compiler_test($canonical === '{"a":{"x":2,"y":1.234568},"z":0}', 'canonical JSON sorts keys, quantizes, and removes negative zero');
airstrike_compiler_test(
    raidlands_airstrike_animation_canonical_json([0.000001, -0.000001]) === '[0.000001,-0.000001]',
    'canonical JSON uses JavaScript-compatible non-exponent spelling at 1e-6'
);
airstrike_compiler_test(
    raidlands_airstrike_animation_canonical_sha256(['b' => 2, 'a' => 1])
        === hash('sha256', '{"a":1,"b":2}'),
    'canonical SHA hashes exact minified bytes'
);

$invalid = airstrike_compiler_source([
    'ProfileKey' => 'Bad Key',
    'Waypoints' => [
        ['Time' => 0.0, 'X' => 0.0, 'Y' => 0.0, 'Z' => 0.0],
        ['Time' => 0.0, 'X' => 0.0, 'Y' => 0.0, 'Z' => 1.0],
    ],
]);
$validation = raidlands_airstrike_animation_validate_profile($invalid, 'Profiles.bad');
airstrike_compiler_test(!$validation['ok'], 'invalid profile is rejected');
$validation_paths = array_column($validation['errors'], 'path');
airstrike_compiler_test(in_array('Profiles.bad.ProfileKey', $validation_paths, true), 'validation includes ProfileKey path');
airstrike_compiler_test(in_array('Profiles.bad.Waypoints[1].Time', $validation_paths, true), 'validation includes duplicate waypoint time path');

$straight_source = airstrike_compiler_source();
$straight = raidlands_airstrike_animation_compile_profile($straight_source);
$straight_frames = $straight['CompiledTrack']['Frames'];
airstrike_compiler_test(count($straight_frames) === 31, '30 Hz one-second track contains zero and exact final frames');
airstrike_compiler_close((float) $straight_frames[0]['Z'], -10.0, 0.000001, 'straight track begins at first waypoint');
airstrike_compiler_close((float) $straight_frames[15]['Z'], 0.0, 0.000001, 'time-aware endpoint tangents keep straight pass linear');
airstrike_compiler_close((float) $straight_frames[30]['Z'], 10.0, 0.000001, 'straight track ends at exact duration');
airstrike_compiler_close((float) $straight_frames[15]['Qw'], 1.0, 0.000001, 'forward +Z route has identity local rotation');
airstrike_compiler_test(!array_key_exists('CompiledReleaseEvents', $straight), 'legacy dynamic manual profile omits compiled release field');
airstrike_compiler_close((float) $straight['FirstPayloadDelaySeconds'], 0.25, 0.000001, 'FirstPayloadDelaySeconds is preserved');

$legacy_targeting_source = airstrike_compiler_source();
unset(
    $legacy_targeting_source['ReleaseSource']['Template']['TargetingMode'],
    $legacy_targeting_source['ReleaseSource']['Template']['AccuracyPercent']
);
$legacy_targeting = raidlands_airstrike_animation_compile_profile($legacy_targeting_source);
airstrike_compiler_test($legacy_targeting['ReleaseTemplate']['TargetingMode'] === 'simple', 'legacy targeting mode defaults to simple');
airstrike_compiler_close((float) $legacy_targeting['ReleaseTemplate']['AccuracyPercent'], 75.0, 0.000001, 'legacy accuracy defaults to 75 percent');

$advanced_targeting_source = airstrike_compiler_source([
    'ReleaseSource' => [
        'Mode' => 'manual',
        'LegacyDynamic' => false,
        'Events' => [array_merge(airstrike_compiler_payload([
            'TargetingMode' => 'advanced',
            'AccuracyPercent' => 140.0,
            'TargetOffsetX' => 12.0,
            'SpreadRadius' => 20.0,
        ]), ['Id' => 'advanced', 'Time' => 0.25])],
    ],
]);
$advanced_targeting = raidlands_airstrike_animation_compile_profile($advanced_targeting_source);
airstrike_compiler_test($advanced_targeting['PayloadEvents'][0]['TargetingMode'] === 'advanced', 'advanced targeting mode survives compilation');
airstrike_compiler_close((float) $advanced_targeting['PayloadEvents'][0]['AccuracyPercent'], 100.0, 0.000001, 'accuracy is clamped to 100 percent');
airstrike_compiler_close((float) $advanced_targeting['PayloadEvents'][0]['TargetOffsetX'], 12.0, 0.000001, 'advanced target offset survives compilation');

$invalid_targeting_source = $advanced_targeting_source;
$invalid_targeting_source['ReleaseSource']['Events'][0]['TargetingMode'] = 'automatic';
$invalid_targeting_validation = raidlands_airstrike_animation_validate_profile($invalid_targeting_source, 'Profiles.invalid_targeting');
airstrike_compiler_test(!$invalid_targeting_validation['ok'], 'unsupported targeting mode is rejected');
airstrike_compiler_test(
    in_array('Profiles.invalid_targeting.ReleaseSource.Events[0].TargetingMode', array_column($invalid_targeting_validation['errors'], 'path'), true),
    'targeting validation reports the exact event path'
);

$manual_rotation_source = airstrike_compiler_source([
    'ProfileKey' => 'manual_reverse_pass',
    'RotationMode' => 'authored_orientation',
    'Waypoints' => [
        ['Id' => 'wp_01', 'Time' => 0.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => 10.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
        ['Id' => 'wp_02', 'Time' => 1.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => -10.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
    ],
]);
$manual_rotation_validation = raidlands_airstrike_animation_validate_profile($manual_rotation_source, 'Profiles.manual_reverse_pass');
airstrike_compiler_test($manual_rotation_validation['ok'], 'authored orientation mode is accepted');
$manual_rotation = raidlands_airstrike_animation_compile_profile($manual_rotation_source);
$manual_midpoint = $manual_rotation['CompiledTrack']['Frames'][15];
airstrike_compiler_close((float) $manual_midpoint['Qx'], 0.0, 0.000001, 'manual rotation ignores reverse path pitch');
airstrike_compiler_close((float) $manual_midpoint['Qy'], 0.0, 0.000001, 'manual rotation ignores reverse path yaw');
airstrike_compiler_close((float) $manual_midpoint['Qz'], 0.0, 0.000001, 'manual rotation ignores reverse path roll');
airstrike_compiler_close((float) $manual_midpoint['Qw'], 1.0, 0.000001, 'manual rotation preserves authored identity');

$stop_source = airstrike_compiler_source([
    'ProfileKey' => 'stop_pass',
    'StopAtWaypoints' => true,
    'Waypoints' => [
        ['Id' => 'wp_01', 'Time' => 0.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => 0.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
        ['Id' => 'wp_02', 'Time' => 1.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => 16.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
    ],
]);
$stop = raidlands_airstrike_animation_compile_profile($stop_source);
airstrike_compiler_close((float) $stop['CompiledTrack']['Frames'][7]['Z'], 2.206815, 0.000001, 'zero-tangent stop mode uses Hermite easing');

$roll_source = airstrike_compiler_source([
    'ProfileKey' => 'barrel_roll_360',
    'Waypoints' => [
        ['Id' => 'wp_01', 'Time' => 0.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => -10.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
        ['Id' => 'wp_02', 'Time' => 1.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => 10.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 360.0],
    ],
]);
$roll = raidlands_airstrike_animation_compile_profile($roll_source);
$roll_frames = $roll['CompiledTrack']['Frames'];
airstrike_compiler_close(abs((float) $roll_frames[15]['Qz']), 1.0, 0.000001, 'continuous Euler interpolation preserves half-turn roll');

for ($index = 1; $index < count($roll_frames); $index += 1) {
    $previous = $roll_frames[$index - 1];
    $current = $roll_frames[$index];
    $dot =
        ((float) $previous['Qx'] * (float) $current['Qx'])
        + ((float) $previous['Qy'] * (float) $current['Qy'])
        + ((float) $previous['Qz'] * (float) $current['Qz'])
        + ((float) $previous['Qw'] * (float) $current['Qw']);
    airstrike_compiler_test($dot >= -0.000001, 'compiled quaternion signs stay continuous at frame ' . $index);
}

$x_approach_source = airstrike_compiler_source([
    'ProfileKey' => 'x_approach',
    'Waypoints' => [
        ['Id' => 'wp_01', 'Time' => 0.0, 'X' => -10.0, 'Y' => 50.0, 'Z' => 0.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
        ['Id' => 'wp_02', 'Time' => 1.0, 'X' => 10.0, 'Y' => 50.0, 'Z' => 0.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
    ],
]);
$x_approach = raidlands_airstrike_animation_compile_profile($x_approach_source);
$x_frame = $x_approach['CompiledTrack']['Frames'][0];
airstrike_compiler_close((float) $x_frame['Qy'], 0.707107, 0.000001, 'LookRotation points vehicle forward along +X');
airstrike_compiler_close((float) $x_frame['Qw'], 0.707107, 0.000001, 'LookRotation +X quaternion is normalized');

$repeated_source = airstrike_compiler_source([
    'ProfileKey' => 'alternating_repeated',
    'FirstPayloadDelaySeconds' => 0.2,
    'Hardpoints' => [
        ['Id' => 'left', 'X' => -2.0, 'Y' => -0.5, 'Z' => 1.0],
        ['Id' => 'right', 'X' => 2.0, 'Y' => -0.5, 'Z' => 1.0],
    ],
    'ReleaseSource' => [
        'Mode' => 'repeated',
        'LegacyDynamic' => false,
        'StartTime' => 0.2,
        'IntervalSeconds' => 0.3,
        'UnitsPerRelease' => 2,
        'MaximumUnits' => 3,
        'Template' => airstrike_compiler_payload(['Count' => 2, 'CarrierOffsetX' => 0.25]),
        'HardpointSequence' => ['left', 'right'],
    ],
]);
$repeated = raidlands_airstrike_animation_compile_profile($repeated_source);
$repeated_group = $repeated['GeneratedReleaseGroups'][0];
airstrike_compiler_test(!array_key_exists('CompiledReleaseEvents', $repeated), 'v3 repeated profiles omit expanded release events');
airstrike_compiler_test($repeated_group['MaximumUnits'] === 3, 'non-even repeated totals remain compact');
airstrike_compiler_test($repeated_group['Template']['Count'] === 1, 'compact group template represents one unit');
airstrike_compiler_test($repeated_group['StartTime'] === 0.2 && $repeated_group['IntervalSeconds'] === 0.3, 'compact group preserves burst timing');
airstrike_compiler_test(array_column($repeated_group['HardpointOffsets'], 'X') === [-2.0, 2.0], 'alternating hardpoint offsets are compiler-resolved');

$trajectory_source = airstrike_compiler_source([
    'EditorSourceSchemaVersion' => 2,
    'ProfileKey' => 'vehicle_path_trajectory',
    'FirstPayloadDelaySeconds' => 0.2,
    'ReleaseSource' => [
        'Mode' => 'repeated',
        'Groups' => [[
            'Id' => 'wing_rockets',
            'Name' => 'Wing rockets',
            'StartTime' => 0.2,
            'IntervalSeconds' => 0.3,
            'UnitsPerRelease' => 1,
            'MaximumUnits' => 2,
            'FollowVehiclePath' => true,
            'Template' => airstrike_compiler_payload(['Payload' => 'hv_rocket']),
            'HardpointSequence' => [],
        ]],
    ],
]);
$trajectory_validation = raidlands_airstrike_animation_validate_profile($trajectory_source, 'Profiles.vehicle_path_trajectory');
airstrike_compiler_test($trajectory_validation['ok'], 'vehicle-path automatic groups validate');
$trajectory_runtime = raidlands_airstrike_animation_compile_profile($trajectory_source);
airstrike_compiler_test($trajectory_runtime['GeneratedReleaseGroups'][0]['Template']['TargetingMode'] === 'trajectory', 'vehicle-path groups compile to trajectory targeting');
airstrike_compiler_test($trajectory_runtime['ReleaseTemplate']['TargetingMode'] === 'trajectory', 'vehicle-path legacy template preserves trajectory targeting');
airstrike_compiler_test(!array_key_exists('FollowVehiclePath', $trajectory_runtime['GeneratedReleaseGroups'][0]), 'editor-only vehicle-path field is omitted from runtime groups');

$invalid_homing_trajectory = $trajectory_source;
$invalid_homing_trajectory['ReleaseSource']['Groups'][0]['Template']['Payload'] = 'homing_missile';
$invalid_homing_validation = raidlands_airstrike_animation_validate_profile($invalid_homing_trajectory, 'Profiles.invalid_homing_trajectory');
airstrike_compiler_test(!$invalid_homing_validation['ok'], 'homing missiles reject vehicle-path targeting');
airstrike_compiler_test(in_array('native_homing', array_column($invalid_homing_validation['errors'], 'code'), true), 'homing validation reports native_homing');

$multi_burst_source = airstrike_compiler_source([
    'ProfileKey' => 'multi_burst_strafe',
    'FirstPayloadDelaySeconds' => 0.1,
    'ReleaseSource' => [
        'Mode' => 'repeated',
        'Groups' => [
            [
                'Id' => 'automatic_001',
                'Name' => 'Automatic group 1',
                'StartTime' => 0.1,
                'IntervalSeconds' => 0.01,
                'UnitsPerRelease' => 10,
                'MaximumUnits' => 120,
                'Template' => airstrike_compiler_payload(['Payload' => 'bradley_longbarrel_burst', 'Count' => 10]),
                'HardpointSequence' => [],
            ],
            [
                'Id' => 'automatic_002',
                'Name' => 'Automatic group 2',
                'StartTime' => 0.4,
                'IntervalSeconds' => 0.01,
                'UnitsPerRelease' => 10,
                'MaximumUnits' => 120,
                'Template' => airstrike_compiler_payload(['Payload' => 'bradley_longbarrel_burst', 'Count' => 10]),
                'HardpointSequence' => [],
            ],
            [
                'Id' => 'automatic_003',
                'Name' => 'Automatic group 3',
                'StartTime' => 0.7,
                'IntervalSeconds' => 0.01,
                'UnitsPerRelease' => 10,
                'MaximumUnits' => 86,
                'Template' => airstrike_compiler_payload(['Payload' => 'bradley_longbarrel_burst', 'Count' => 10]),
                'HardpointSequence' => [],
            ],
        ],
    ],
]);
$multi_burst_validation = raidlands_airstrike_animation_validate_profile($multi_burst_source, 'Profiles.multi_burst_strafe');
airstrike_compiler_test($multi_burst_validation['ok'], 'multi-burst strafing schedules above 200 release units are valid');
$multi_burst = raidlands_airstrike_animation_compile_profile($multi_burst_source);
airstrike_compiler_test(count($multi_burst['GeneratedReleaseGroups']) === 3, 'multi-burst strafing schedule stays as three compact groups');
airstrike_compiler_test(array_sum(array_column($multi_burst['GeneratedReleaseGroups'], 'MaximumUnits')) === 326, 'compact groups retain the exact effective unit total');

$large_compact_source = airstrike_compiler_source([
    'EditorSourceSchemaVersion' => 2,
    'ProfileKey' => 'large_compact_guns',
    'DurationSeconds' => 80.0,
    'FirstPayloadDelaySeconds' => 12.0,
    'Waypoints' => [
        ['Id' => 'wp_01', 'Time' => 0.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => -100.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
        ['Id' => 'wp_02', 'Time' => 80.0, 'X' => 0.0, 'Y' => 50.0, 'Z' => 100.0, 'RotationX' => 0.0, 'RotationY' => 0.0, 'RotationZ' => 0.0],
    ],
    'ReleaseSource' => [
        'Mode' => 'mixed',
        'Events' => [],
        'Groups' => [
            ['Id' => 'bradley', 'Name' => 'Bradley Coax Gun', 'StartTime' => 12.0, 'IntervalSeconds' => 0.23, 'UnitsPerRelease' => 30, 'UnitIntervalSeconds' => 0.007, 'MaximumUnits' => 600, 'Template' => airstrike_compiler_payload(['Payload' => 'bradley_coax_gun']), 'HardpointSequence' => []],
            ['Id' => 'patrol', 'Name' => 'Patrol Heli Gun', 'StartTime' => 34.42, 'IntervalSeconds' => 0.3, 'UnitsPerRelease' => 30, 'UnitIntervalSeconds' => 0.009, 'MaximumUnits' => 600, 'Template' => airstrike_compiler_payload(['Payload' => 'patrol_heli_gun']), 'HardpointSequence' => []],
            ['Id' => 'turret', 'Name' => 'Auto Turret Gun', 'StartTime' => 54.0, 'IntervalSeconds' => 0.3, 'UnitsPerRelease' => 35, 'UnitIntervalSeconds' => 0.008, 'MaximumUnits' => 600, 'Template' => airstrike_compiler_payload(['Payload' => 'autoturret_gun']), 'HardpointSequence' => []],
        ],
    ],
]);
$large_compact_validation = raidlands_airstrike_animation_validate_profile($large_compact_source, 'Profiles.large_compact_guns');
airstrike_compiler_test($large_compact_validation['ok'], 'the reported 600 + 600 + 600 gun configuration validates');
$large_compact_runtime = raidlands_airstrike_animation_compile_profile($large_compact_source);
airstrike_compiler_test(strlen(json_encode($large_compact_source, JSON_THROW_ON_ERROR)) < 10000, 'the 1,800-unit source remains only a few kilobytes');
airstrike_compiler_test(array_sum(array_column($large_compact_runtime['GeneratedReleaseGroups'], 'MaximumUnits')) === 1800, 'the compact runtime reports exactly 1,800 effective units');
airstrike_compiler_test(!array_key_exists('CompiledReleaseEvents', $large_compact_runtime), 'the 1,800-unit runtime contains no expanded event array');

$manual_hardpoint_source = airstrike_compiler_source([
    'ProfileKey' => 'manual_hardpoint',
    'FirstPayloadDelaySeconds' => 0.2,
    'Hardpoints' => [
        ['Id' => 'left', 'X' => -2.0, 'Y' => -0.5, 'Z' => 1.0],
    ],
    'ReleaseSource' => [
        'Mode' => 'manual',
        'LegacyDynamic' => false,
        'Events' => [
            array_merge(
                airstrike_compiler_payload(['Count' => 2, 'CarrierOffsetX' => 0.25]),
                ['Id' => 'release_001', 'Time' => 0.2, 'HardpointId' => 'left']
            ),
        ],
        'Template' => airstrike_compiler_payload(),
    ],
]);
$manual_hardpoint = raidlands_airstrike_animation_compile_profile($manual_hardpoint_source);
airstrike_compiler_test(!array_key_exists('CompiledReleaseEvents', $manual_hardpoint), 'v3 manual profiles omit expanded release events');
airstrike_compiler_test(count($manual_hardpoint['PayloadEvents']) === 1 && $manual_hardpoint['PayloadEvents'][0]['Count'] === 2, 'manual release count remains compact');
airstrike_compiler_close((float) $manual_hardpoint['PayloadEvents'][0]['CarrierOffsetX'], -1.75, 0.000001, 'manual hardpoint offset is materialized into the runtime event');
airstrike_compiler_close((float) $manual_hardpoint['PayloadEvents'][0]['CarrierOffsetY'], -0.5, 0.000001, 'manual hardpoint offsets are materialized into legacy payload events');
airstrike_compiler_test(!array_key_exists('HardpointId', $manual_hardpoint['PayloadEvents'][0]), 'runtime release output omits authoring-only HardpointId');

$manual_hardpoint_shifted = airstrike_compiler_source([
    'ProfileKey' => 'manual_hardpoint',
    'FirstPayloadDelaySeconds' => 0.2,
    'Hardpoints' => [
        ['Id' => 'left', 'X' => -4.0, 'Y' => -0.5, 'Z' => 1.0],
    ],
    'ReleaseSource' => $manual_hardpoint_source['ReleaseSource'],
]);
$manual_hardpoint_shifted_runtime = raidlands_airstrike_animation_compile_profile($manual_hardpoint_shifted);
airstrike_compiler_test(
    $manual_hardpoint['CompiledTrack']['SourceHash'] !== $manual_hardpoint_shifted_runtime['CompiledTrack']['SourceHash'],
    'manual hardpoint source hash changes when resolved hardpoint offsets change'
);

$bundle_result = raidlands_airstrike_animation_compile_bundle([$straight_source, $repeated_source], 17, false);
airstrike_compiler_test($bundle_result['bundle']['SchemaVersion'] === 3, 'compiled bundle uses schema version 3');
airstrike_compiler_test($bundle_result['bundle']['PublishedRevision'] === 17, 'compiled bundle carries published revision');
airstrike_compiler_test(!array_key_exists('PublishedSha256', $bundle_result['bundle']), 'canonical bundle excludes recursive PublishedSha256 field');
airstrike_compiler_test(
    $bundle_result['sha256'] === hash('sha256', $bundle_result['canonical_json']),
    'bundle SHA is stored outside and hashes exact canonical bytes'
);
airstrike_compiler_test(
    $bundle_result['canonical_json'] === raidlands_airstrike_animation_canonical_json($bundle_result['bundle']),
    'bundle canonical JSON is byte-stable'
);

// Shared TypeScript/PHP golden corpus. The fixture generator writes one folder per
// case with source.json and expected.runtime.json. Optional expected.samples.json
// adds selected frame assertions without forcing tests to load every frame twice.
$fixture_root = __DIR__ . '/fixtures/airstrike-animations';
$vehicle_metadata_path = dirname(__DIR__) . '/assets/airstrike-animation-editor/vehicle-preview.json';
$vehicle_metadata = is_file($vehicle_metadata_path) ? airstrike_compiler_json($vehicle_metadata_path) : [];

if (is_dir($fixture_root)) {
    $source_files = glob($fixture_root . '/*/source.json') ?: [];
    sort($source_files, SORT_STRING);

    foreach ($source_files as $source_path) {
        $case_dir = dirname($source_path);
        $case_name = basename($case_dir);
        $expected_runtime_path = $case_dir . '/expected.runtime.json';
        $expected_canonical_path = $case_dir . '/expected.canonical.json';
        $manifest_path = $case_dir . '/manifest.json';
        $source_bundle = airstrike_compiler_json($source_path);
        $actual = raidlands_airstrike_animation_compile_bundle(
            (array) ($source_bundle['Profiles'] ?? []),
            1,
            !empty($source_bundle['AllowDangerousPayloadPreview']),
            $vehicle_metadata
        );

        if (is_file($expected_runtime_path)) {
            $expected_runtime = airstrike_compiler_json_value($expected_runtime_path);
            airstrike_compiler_test(
                raidlands_airstrike_animation_canonical_json($actual['bundle'])
                    === raidlands_airstrike_animation_canonical_json($expected_runtime),
                'golden runtime bundle canonical bytes match for ' . $case_name
            );
        }

        if (is_file($expected_canonical_path)) {
            $expected_canonical = file_get_contents($expected_canonical_path);
            airstrike_compiler_test(
                is_string($expected_canonical) && $actual['canonical_json'] === $expected_canonical,
                'golden canonical bytes match exactly for ' . $case_name
            );
        }

        if (is_file($manifest_path)) {
            $manifest = airstrike_compiler_json($manifest_path);
            airstrike_compiler_test(
                $actual['sha256'] === (string) ($manifest['canonicalSha256'] ?? ''),
                'golden canonical SHA-256 matches for ' . $case_name
            );
            airstrike_compiler_test(
                strlen($actual['canonical_json']) === (int) ($manifest['canonicalBytes'] ?? -1),
                'golden canonical byte length matches for ' . $case_name
            );
            airstrike_compiler_test(
                raidlands_airstrike_animation_canonical_json($actual['source_hashes'])
                    === raidlands_airstrike_animation_canonical_json($manifest['sourceHashes'] ?? []),
                'golden resolved source hashes match for ' . $case_name
            );
        }
    }
}

echo 'Airstrike animation compiler tests passed: ' . $tests . PHP_EOL;
