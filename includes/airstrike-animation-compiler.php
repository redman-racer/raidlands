<?php

declare(strict_types=1);

/**
 * Deterministic Portable Airstrikes animation compiler.
 *
 * This module is deliberately free of database, session, and admin dependencies so
 * the publishing service and executable fixture tests can use the exact same code.
 */

function raidlands_airstrike_animation_compiler_version(): string
{
    return 'raidlands-airanim-1';
}

function raidlands_airstrike_animation_compiler_limits(): array
{
    return [
        'max_profiles' => 500,
        'max_waypoints_per_profile' => 256,
        'max_manual_events_per_profile' => 80,
        'max_repeated_groups_per_profile' => 40,
        'max_release_events_per_profile' => 2000,
        'max_duration_seconds' => 120.0,
        'max_compiled_frames_per_profile' => 6000,
        'max_bundle_bytes' => 20 * 1024 * 1024,
        'max_coordinate_abs' => 10000.0,
        'max_rotation_abs' => 100000.0,
        'sample_rate_hz' => 30,
    ];
}

function raidlands_airstrike_animation_supported_vehicles(): array
{
    return ['drone', 'cargo_plane', 'f15', 'a10', 'attack_heli'];
}

function raidlands_airstrike_animation_supported_payloads(): array
{
    static $payloads = null;
    if (is_array($payloads)) {
        return $payloads;
    }

    $path = dirname(__DIR__) . '/assets/airstrike-animation-editor/payload-catalog.json';
    $json = is_file($path) ? file_get_contents($path) : false;
    $catalog = is_string($json) ? json_decode($json, true) : null;
    if (!is_array($catalog)) {
        throw new RuntimeException('Airstrike payload catalog could not be loaded.');
    }

    $payloads = [];
    foreach ($catalog as $entry) {
        $id = is_array($entry) ? strtolower(trim((string) ($entry['id'] ?? ''))) : '';
        if ($id !== '' && preg_match('/^[a-z0-9][a-z0-9._-]{0,99}$/', $id)) {
            $payloads[] = $id;
        }
    }

    if ($payloads === []) {
        throw new RuntimeException('Airstrike payload catalog is empty.');
    }

    return $payloads;
}

function raidlands_airstrike_animation_quantize(float $value): float
{
    if (!is_finite($value)) {
        throw new InvalidArgumentException('Canonical JSON cannot contain NaN or Infinity.');
    }

    // Match JavaScript Math.round((value + Number.EPSILON) * 1e6) / 1e6,
    // including its
    // ties-toward-positive-infinity behavior for negative values.
    $quantized = floor((($value + PHP_FLOAT_EPSILON) * 1000000.0) + 0.5) / 1000000.0;

    return $quantized == 0.0 ? 0.0 : $quantized;
}

function raidlands_airstrike_animation_canonical_value($value)
{
    if (is_float($value)) {
        return raidlands_airstrike_animation_quantize($value);
    }

    if (is_int($value) || is_string($value) || is_bool($value) || $value === null) {
        return $value;
    }

    if ($value instanceof JsonSerializable) {
        return raidlands_airstrike_animation_canonical_value($value->jsonSerialize());
    }

    if (is_object($value)) {
        $properties = get_object_vars($value);

        if ($properties === []) {
            return new stdClass();
        }

        return raidlands_airstrike_animation_canonical_value($properties);
    }

    if (!is_array($value)) {
        throw new InvalidArgumentException('Canonical JSON received an unsupported value type.');
    }

    if (array_is_list($value)) {
        return array_map('raidlands_airstrike_animation_canonical_value', $value);
    }

    $normalized = [];
    $keys = array_map('strval', array_keys($value));
    usort($keys, static fn (string $left, string $right): int => strcmp($left, $right));

    foreach ($keys as $key) {
        $normalized[$key] = raidlands_airstrike_animation_canonical_value($value[$key]);
    }

    return $normalized;
}

function raidlands_airstrike_animation_canonical_json($value): string
{
    return raidlands_airstrike_animation_encode_canonical_value(
        raidlands_airstrike_animation_canonical_value($value)
    );
}

function raidlands_airstrike_animation_encode_canonical_string(string $value): string
{
    $flags = JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

    if (defined('JSON_UNESCAPED_LINE_TERMINATORS')) {
        $flags |= JSON_UNESCAPED_LINE_TERMINATORS;
    }

    return json_encode($value, $flags);
}

function raidlands_airstrike_animation_encode_canonical_number(float $value): string
{
    if (!is_finite($value)) {
        throw new InvalidArgumentException('Canonical JSON cannot contain NaN or Infinity.');
    }

    if ($value == 0.0) {
        return '0';
    }

    // All canonical values are quantized to 1e-6 first. Fixed formatting and
    // trimming therefore matches JSON.stringify's minimal spelling while
    // avoiding PHP json_encode's incompatible `1.0e-6` spelling.
    $encoded = rtrim(rtrim(sprintf('%.6F', $value), '0'), '.');

    return $encoded === '-0' || $encoded === '' ? '0' : $encoded;
}

function raidlands_airstrike_animation_encode_canonical_value($value): string
{
    if ($value === null) {
        return 'null';
    }

    if ($value === true) {
        return 'true';
    }

    if ($value === false) {
        return 'false';
    }

    if (is_int($value)) {
        return (string) $value;
    }

    if (is_float($value)) {
        return raidlands_airstrike_animation_encode_canonical_number($value);
    }

    if (is_string($value)) {
        return raidlands_airstrike_animation_encode_canonical_string($value);
    }

    if (is_object($value)) {
        $properties = get_object_vars($value);

        if ($properties === []) {
            return '{}';
        }

        return raidlands_airstrike_animation_encode_canonical_value($properties);
    }

    if (!is_array($value)) {
        throw new InvalidArgumentException('Canonical JSON received an unsupported normalized value type.');
    }

    if (array_is_list($value)) {
        return '[' . implode(',', array_map('raidlands_airstrike_animation_encode_canonical_value', $value)) . ']';
    }

    $members = [];

    foreach ($value as $key => $entry) {
        $members[] = raidlands_airstrike_animation_encode_canonical_string((string) $key)
            . ':'
            . raidlands_airstrike_animation_encode_canonical_value($entry);
    }

    return '{' . implode(',', $members) . '}';
}

function raidlands_airstrike_animation_canonical_sha256($value): string
{
    return hash('sha256', raidlands_airstrike_animation_canonical_json($value));
}

function raidlands_airstrike_animation_number($value, float $default = 0.0): float
{
    return is_int($value) || is_float($value) ? (float) $value : $default;
}

function raidlands_airstrike_animation_int($value, int $default = 0): int
{
    return is_int($value) || is_float($value) ? (int) $value : $default;
}

function raidlands_airstrike_animation_profile_key(array $source): string
{
    return strtolower(trim((string) ($source['ProfileKey'] ?? $source['profile_key'] ?? '')));
}

function raidlands_airstrike_animation_repeated_group(array $group, int $index = 0): array
{
    return [
        'id' => trim((string) ($group['Id'] ?? ('automatic_' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)))),
        'name' => trim((string) ($group['Name'] ?? ('Automatic group ' . ($index + 1)))),
        'start_time' => raidlands_airstrike_animation_number($group['StartTime'] ?? 0.0),
        'interval_seconds' => raidlands_airstrike_animation_number($group['IntervalSeconds'] ?? 0.5, 0.5),
        'unit_interval_seconds' => raidlands_airstrike_animation_number($group['UnitIntervalSeconds'] ?? 0.0),
        'units_per_release' => raidlands_airstrike_animation_int(
            $group['UnitsPerRelease'] ?? ($group['Template']['Count'] ?? null) ?? 1,
            1
        ),
        'maximum_units' => raidlands_airstrike_animation_int($group['MaximumUnits'] ?? 0),
        'template' => isset($group['Template']) && is_array($group['Template']) ? $group['Template'] : [],
        'hardpoint_sequence' => isset($group['HardpointSequence']) && is_array($group['HardpointSequence'])
            ? array_values(array_map('strval', $group['HardpointSequence']))
            : [],
    ];
}

function raidlands_airstrike_animation_release_source(array $source): array
{
    $release = isset($source['ReleaseSource']) && is_array($source['ReleaseSource'])
        ? $source['ReleaseSource']
        : [];
    $mode = strtolower(trim((string) ($release['Mode'] ?? $source['PayloadReleaseMode'] ?? 'manual')));

    if ($mode === 'mixed') {
        $mode = 'mixed';
    } elseif ($mode === 'generated' || $mode === 'repeated') {
        $mode = 'repeated';
    } else {
        $mode = 'manual';
    }

    $events = $release['Events'] ?? $source['PayloadEvents'] ?? [];
    $groups_present = array_key_exists('Groups', $release);
    $groups = [];

    if ($groups_present && is_array($release['Groups'] ?? null) && array_is_list($release['Groups'])) {
        foreach ($release['Groups'] as $index => $group) {
            if (is_array($group)) {
                $groups[] = raidlands_airstrike_animation_repeated_group($group, (int) $index);
            }
        }
    }

    return [
        'mode' => $mode,
        'events' => is_array($events) && array_is_list($events) ? $events : [],
        'groups_present' => $groups_present,
        'groups' => $groups,
        'start_time' => raidlands_airstrike_animation_number(
            $release['StartTime'] ?? $source['FirstPayloadDelaySeconds'] ?? 0.0
        ),
        'interval_seconds' => raidlands_airstrike_animation_number(
            $release['IntervalSeconds']
                ?? $release['FallbackIntervalSeconds']
                ?? $source['PayloadReleaseIntervalSeconds']
                ?? 0.5,
            0.5
        ),
        'fallback_interval_seconds' => raidlands_airstrike_animation_number(
            $release['FallbackIntervalSeconds']
                ?? $release['IntervalSeconds']
                ?? $source['PayloadReleaseIntervalSeconds']
                ?? 0.5,
            0.5
        ),
        'units_per_release' => raidlands_airstrike_animation_int(
            $release['UnitsPerRelease'] ?? ($release['Template']['Count'] ?? null) ?? 1,
            1
        ),
        'maximum_units' => raidlands_airstrike_animation_int(
            $release['MaximumUnits'] ?? $source['MaxPayloadCount'] ?? 0
        ),
        'maximum_units_present' => array_key_exists('MaximumUnits', $release)
            || array_key_exists('MaxPayloadCount', $source),
        'template' => isset($release['Template']) && is_array($release['Template'])
            ? $release['Template']
            : (isset($source['ReleaseTemplate']) && is_array($source['ReleaseTemplate']) ? $source['ReleaseTemplate'] : []),
        'template_present' => array_key_exists('Template', $release)
            || array_key_exists('ReleaseTemplate', $source),
        'fallback_interval_present' => array_key_exists('FallbackIntervalSeconds', $release)
            || array_key_exists('PayloadReleaseIntervalSeconds', $source),
        'hardpoint_sequence' => isset($release['HardpointSequence']) && is_array($release['HardpointSequence'])
            ? array_values(array_map('strval', $release['HardpointSequence']))
            : [],
        'legacy_dynamic' => !empty($release['LegacyDynamic']),
    ];
}

function raidlands_airstrike_animation_repeated_groups(array $release): array
{
    if (!empty($release['groups_present'])) {
        return $release['groups'];
    }

    return [[
        'id' => 'automatic_001',
        'name' => 'Automatic group 1',
        'start_time' => $release['start_time'],
        'interval_seconds' => $release['interval_seconds'],
        'unit_interval_seconds' => 0.0,
        'units_per_release' => $release['units_per_release'],
        'maximum_units' => $release['maximum_units'],
        'template' => $release['template'],
        'hardpoint_sequence' => $release['hardpoint_sequence'],
    ]];
}

function raidlands_airstrike_animation_validation_error(array &$errors, string $path, string $code, string $message): void
{
    $errors[] = [
        'path' => $path,
        'code' => $code,
        'message' => $message,
    ];
}

function raidlands_airstrike_animation_validate_number(
    array &$errors,
    $value,
    string $path,
    ?float $minimum = null,
    ?float $maximum = null
): void {
    if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value)) {
        raidlands_airstrike_animation_validation_error($errors, $path, 'finite_number', 'Must be a finite number.');
        return;
    }

    $number = (float) $value;

    if ($minimum !== null && $number < $minimum) {
        raidlands_airstrike_animation_validation_error($errors, $path, 'minimum', 'Must be at least ' . $minimum . '.');
    }

    if ($maximum !== null && $number > $maximum) {
        raidlands_airstrike_animation_validation_error($errors, $path, 'maximum', 'Must be at most ' . $maximum . '.');
    }
}

function raidlands_airstrike_animation_validate_event(
    array $event,
    string $path,
    float $duration,
    array &$errors,
    bool $allow_empty_payload = false
): void {
    raidlands_airstrike_animation_validate_number($errors, $event['Time'] ?? null, $path . '.Time', 0.0, $duration);
    $payload = strtolower(trim((string) ($event['Payload'] ?? '')));

    if ((!$allow_empty_payload || $payload !== '')
        && !in_array($payload, raidlands_airstrike_animation_supported_payloads(), true)) {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.Payload',
            'unsupported_payload',
            'Payload is not supported by the current PortableAirstrikes runtime.'
        );
    }

    $count = $event['Count'] ?? 1;

    if ((!is_int($count) && !is_float($count))
        || !is_finite((float) $count)
        || floor((float) $count) !== (float) $count
        || (int) $count < 1
        || (int) $count > 200) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.Count', 'count', 'Count must be an integer between 1 and 200.');
    }

    foreach ([
        'CarrierOffsetX' => [-250.0, 250.0],
        'CarrierOffsetY' => [-250.0, 250.0],
        'CarrierOffsetZ' => [-250.0, 250.0],
        'TargetOffsetX' => [-500.0, 500.0],
        'TargetOffsetY' => [-500.0, 500.0],
        'TargetOffsetZ' => [-500.0, 500.0],
        'SpreadRadius' => [-1.0, 250.0],
        'LaunchSpeed' => [-1.0, 350.0],
        'FuseSeconds' => [-1.0, 120.0],
        'DamageScale' => [0.0, 10.0],
        'VehicleDamageScale' => [-1.0, 10.0],
        'SplashRadius' => [-1.0, 100.0],
        'ImpactRadius' => [-1.0, 100.0],
        'MaxTrackingSeconds' => [-1.0, 120.0],
        'MaxTrackingDistance' => [-1.0, 2500.0],
    ] as $field => $bounds) {
        raidlands_airstrike_animation_validate_number(
            $errors,
            $event[$field] ?? null,
            $path . '.' . $field,
            $bounds[0],
            $bounds[1]
        );
    }

    $damage_scales = $event['DamageScales'] ?? [];

    if ($damage_scales !== null && !is_array($damage_scales)) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.DamageScales', 'object', 'DamageScales must be an object.');
    } elseif (is_array($damage_scales)) {
        foreach ($damage_scales as $key => $value) {
            $key = (string) $key;
            $key_path = $path . '.DamageScales.' . $key;

            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/', $key)) {
                raidlands_airstrike_animation_validation_error($errors, $key_path, 'safe_key', 'Damage scale key is not safe.');
            }

            raidlands_airstrike_animation_validate_number($errors, $value, $key_path, 0.0, 10.0);
        }
    }
}

function raidlands_airstrike_animation_validate_profile(
    array $source,
    string $path = 'Profile',
    array $vehicle_metadata = []
): array
{
    $limits = raidlands_airstrike_animation_compiler_limits();
    $max_release_units = (int) $limits['max_release_events_per_profile'];
    $errors = [];
    $warnings = [];
    $profile_key = raidlands_airstrike_animation_profile_key($source);

    if (($source['EditorSourceSchemaVersion'] ?? null) !== 1 && ($source['EditorSourceSchemaVersion'] ?? null) !== 2) {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.EditorSourceSchemaVersion',
            'schema_version',
            'Must be editor source schema version 1 or 2.'
        );
    }

    if (!preg_match('/^[a-z0-9][a-z0-9._-]{0,99}$/', $profile_key)) {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.ProfileKey',
            'profile_key',
            'ProfileKey must match ^[a-z0-9][a-z0-9._-]{0,99}$.'
        );
    }

    $display_name = $source['DisplayName'] ?? null;

    if (!is_string($display_name) || trim($display_name) === '' || mb_strlen($display_name) > 160) {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.DisplayName',
            'display_name',
            'Must be a non-empty string of at most 160 characters.'
        );
    }

    $vehicle = strtolower(trim((string) ($source['Vehicle'] ?? '')));

    if (!in_array($vehicle, raidlands_airstrike_animation_supported_vehicles(), true)) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.Vehicle', 'unsupported_vehicle', 'Vehicle is not supported.');
    }

    $duration = $source['DurationSeconds'] ?? null;
    raidlands_airstrike_animation_validate_number(
        $errors,
        $duration,
        $path . '.DurationSeconds',
        0.5,
        (float) $limits['max_duration_seconds']
    );
    $duration_number = is_int($duration) || is_float($duration) ? (float) $duration : 0.0;
    raidlands_airstrike_animation_validate_number(
        $errors,
        $source['FirstPayloadDelaySeconds'] ?? null,
        $path . '.FirstPayloadDelaySeconds',
        0.0,
        $duration_number
    );
    raidlands_airstrike_animation_validate_number(
        $errors,
        $source['RotationSmoothTimeSeconds'] ?? null,
        $path . '.RotationSmoothTimeSeconds',
        0.02,
        2.0
    );
    raidlands_airstrike_animation_validate_number(
        $errors,
        $source['MinimumTerrainClearance'] ?? null,
        $path . '.MinimumTerrainClearance',
        0.0,
        250.0
    );

    if (!array_key_exists('StopAtWaypoints', $source) || !is_bool($source['StopAtWaypoints'])) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.StopAtWaypoints', 'boolean', 'Must be boolean.');
    }

    if (($source['PositionInterpolation'] ?? null) !== 'time_hermite') {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.PositionInterpolation',
            'interpolation',
            'Only time_hermite is currently supported.'
        );
    }

    if (!in_array(($source['RotationMode'] ?? null), ['follow_path_plus_offset', 'authored_orientation'], true)) {
        raidlands_airstrike_animation_validation_error(
            $errors,
            $path . '.RotationMode',
            'rotation_mode',
            'Must be follow_path_plus_offset or authored_orientation.'
        );
    }
    $waypoints = $source['Waypoints'] ?? null;

    if (!is_array($waypoints) || !array_is_list($waypoints)) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.Waypoints', 'array', 'Waypoints must be an array.');
        $waypoints = [];
    }

    if (count($waypoints) < 2) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.Waypoints', 'minimum_items', 'At least two waypoints are required.');
    }

    if (count($waypoints) > (int) $limits['max_waypoints_per_profile']) {
        raidlands_airstrike_animation_validation_error($errors, $path . '.Waypoints', 'maximum_items', 'Too many waypoints.');
    }

    $previous_time = null;
    $waypoint_ids = [];

    foreach ($waypoints as $index => $waypoint) {
        $waypoint_path = $path . '.Waypoints[' . $index . ']';

        if (!is_array($waypoint)) {
            raidlands_airstrike_animation_validation_error($errors, $waypoint_path, 'object', 'Waypoint must be an object.');
            continue;
        }

        $waypoint_id = (string) ($waypoint['Id'] ?? '');

        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $waypoint_id)) {
            raidlands_airstrike_animation_validation_error($errors, $waypoint_path . '.Id', 'stable_id', 'Must be a safe stable waypoint ID.');
        } elseif (isset($waypoint_ids[$waypoint_id])) {
            raidlands_airstrike_animation_validation_error($errors, $waypoint_path . '.Id', 'duplicate_id', 'Waypoint ID must be unique.');
        } else {
            $waypoint_ids[$waypoint_id] = true;
        }

        $time = $waypoint['Time'] ?? null;
        raidlands_airstrike_animation_validate_number($errors, $time, $waypoint_path . '.Time', 0.0, $duration_number);

        if (is_int($time) || is_float($time)) {
            $time_number = (float) $time;

            if ($index === 0 && abs($time_number) > 0.0000001) {
                raidlands_airstrike_animation_validation_error($errors, $waypoint_path . '.Time', 'first_time', 'First waypoint time must be zero.');
            }

            if ($previous_time !== null && $time_number <= $previous_time + 0.000001) {
                raidlands_airstrike_animation_validation_error($errors, $waypoint_path . '.Time', 'sorted_unique', 'Waypoint times must be strictly increasing.');
            }

            $previous_time = $time_number;
        }

        foreach ([
            'X' => [-2000.0, 2000.0],
            'Y' => [-100.0, 1000.0],
            'Z' => [-3000.0, 3000.0],
        ] as $field => $bounds) {
            raidlands_airstrike_animation_validate_number(
                $errors,
                $waypoint[$field] ?? null,
                $waypoint_path . '.' . $field,
                $bounds[0],
                $bounds[1]
            );
        }

        foreach (['RotationX', 'RotationY', 'RotationZ'] as $field) {
            raidlands_airstrike_animation_validate_number(
                $errors,
                $waypoint[$field] ?? 0.0,
                $waypoint_path . '.' . $field,
                -(float) $limits['max_rotation_abs'],
                (float) $limits['max_rotation_abs']
            );
        }

        if (array_key_exists('TargetSpeedMetersPerSecond', $waypoint)) {
            raidlands_airstrike_animation_validate_number(
                $errors,
                $waypoint['TargetSpeedMetersPerSecond'],
                $waypoint_path . '.TargetSpeedMetersPerSecond',
                0.1,
                500.0
            );
        }
    }

    $release = raidlands_airstrike_animation_release_source($source);

    if ($release['mode'] === 'mixed') {
        $mixed_units = 0;
        if (count($release['events']) > (int) $limits['max_manual_events_per_profile']) {
            raidlands_airstrike_animation_validation_error($errors, $path . '.ReleaseSource.Events', 'maximum_items', 'Too many release events.');
        }
        foreach ($release['events'] as $index => $event) {
            if (!is_array($event)) {
                raidlands_airstrike_animation_validation_error($errors, $path . '.ReleaseSource.Events[' . $index . ']', 'object', 'Release event must be an object.');
                continue;
            }
            raidlands_airstrike_animation_validate_event($event, $path . '.ReleaseSource.Events[' . $index . ']', $duration_number, $errors);
            $mixed_units += max(1, raidlands_airstrike_animation_int($event['Count'] ?? 1, 1));
        }
        foreach ($release['groups'] as $group) {
            $mixed_units += max(0, (int) ($group['maximum_units'] ?? 0));
        }
        if ($mixed_units > $max_release_units) {
            raidlands_airstrike_animation_validation_error($errors, $path . '.ReleaseSource', 'compiled_unit_count', 'Mixed releases must not exceed ' . $max_release_units . ' total units.');
        }
    }

    if ($release['mode'] === 'manual') {
        if (count($release['events']) > (int) $limits['max_manual_events_per_profile']) {
            raidlands_airstrike_animation_validation_error($errors, $path . '.ReleaseSource.Events', 'maximum_items', 'Too many release events.');
        }

        if ($release['events'] === [] && !$release['legacy_dynamic']) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.ReleaseSource.Events',
                'empty_manual_schedule',
                'An empty manual schedule must be marked LegacyDynamic.'
            );
        }

        $release_ids = [];
        $release_units = 0;
        $previous_release_time = null;
        $available_hardpoints = raidlands_airstrike_animation_hardpoints($source, $vehicle_metadata);
        foreach ($release['events'] as $index => $event) {
            if (!is_array($event)) {
                raidlands_airstrike_animation_validation_error(
                    $errors,
                    $path . '.ReleaseSource.Events[' . $index . ']',
                    'object',
                    'Release event must be an object.'
                );
                continue;
            }

            $event_path = $path . '.ReleaseSource.Events[' . $index . ']';
            $event_id = (string) ($event['Id'] ?? '');

            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $event_id)) {
                raidlands_airstrike_animation_validation_error($errors, $event_path . '.Id', 'stable_id', 'Must be a safe stable release-event ID.');
            } elseif (isset($release_ids[$event_id])) {
                raidlands_airstrike_animation_validation_error($errors, $event_path . '.Id', 'duplicate_id', 'Release-event ID must be unique.');
            } else {
                $release_ids[$event_id] = true;
            }

            $event_time = $event['Time'] ?? null;

            if (is_int($event_time) || is_float($event_time)) {
                if ($previous_release_time !== null && (float) $event_time < $previous_release_time) {
                    raidlands_airstrike_animation_validation_error($errors, $event_path . '.Time', 'sorted_time', 'Manual release events must be sorted by time.');
                }

                $previous_release_time = (float) $event_time;
            }

            if (is_int($event['Count'] ?? null) || is_float($event['Count'] ?? null)) {
                $release_units += (int) $event['Count'];
            }

            if (array_key_exists('HardpointId', $event) || array_key_exists('Hardpoint', $event)) {
                $hardpoint_id = trim((string) ($event['HardpointId'] ?? $event['Hardpoint'] ?? ''));

                if ($hardpoint_id !== '' && !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $hardpoint_id)) {
                    raidlands_airstrike_animation_validation_error(
                        $errors,
                        $event_path . '.HardpointId',
                        'stable_id',
                        'Must be a safe hardpoint ID.'
                    );
                } elseif ($hardpoint_id !== '' && !isset($available_hardpoints[$hardpoint_id])) {
                    raidlands_airstrike_animation_validation_error(
                        $errors,
                        $event_path . '.HardpointId',
                        'unknown_hardpoint',
                        "Unknown hardpoint '" . $hardpoint_id . "'."
                    );
                }
            }

            raidlands_airstrike_animation_validate_event(
                $event,
                $event_path,
                $duration_number,
                $errors
            );
        }

        if ($release_units > $max_release_units) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.ReleaseSource.Events',
                'compiled_unit_count',
                'Materialized releases must not exceed ' . $max_release_units . ' units.'
            );
        }

        if ($release['events'] !== []) {
            $first_event = $release['events'][0];
            $first_event_time = is_array($first_event)
                ? raidlands_airstrike_animation_number($first_event['Time'] ?? -1.0, -1.0)
                : -1.0;
            $first_delay = raidlands_airstrike_animation_number($source['FirstPayloadDelaySeconds'] ?? -2.0, -2.0);

            if ($first_event_time >= 0.0 && abs($first_delay - $first_event_time) > 0.000001) {
                raidlands_airstrike_animation_validation_error(
                    $errors,
                    $path . '.FirstPayloadDelaySeconds',
                    'first_release_sync',
                    'Must equal the earliest manual release event time.'
                );
            }
        }

        if ($release['maximum_units'] < 0 || $release['maximum_units'] > $max_release_units) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.ReleaseSource.MaximumUnits',
                'count',
                'MaximumUnits must be between 0 and ' . $max_release_units . '.'
            );
        }

        if (isset($source['ReleaseSource']['FallbackIntervalSeconds'])) {
            raidlands_airstrike_animation_validate_number(
                $errors,
                $release['fallback_interval_seconds'],
                $path . '.ReleaseSource.FallbackIntervalSeconds',
                0.01,
                30.0
            );
        }

        if (isset($source['ReleaseSource']['Template'])) {
            $template = $release['template'];
            $template['Time'] = $first_delay ?? 0.0;
            raidlands_airstrike_animation_validate_event(
                $template,
                $path . '.ReleaseSource.Template',
                $duration_number,
                $errors,
                true
            );
        }
    } else {
        if ($release['groups_present']) {
            $raw_groups = $source['ReleaseSource']['Groups'] ?? null;

            if (!is_array($raw_groups) || !array_is_list($raw_groups) || $raw_groups === []) {
                raidlands_airstrike_animation_validation_error(
                    $errors,
                    $path . '.ReleaseSource.Groups',
                    'array',
                    'Must contain at least one automatic release group.'
                );
            } else {
                if (count($raw_groups) > (int) $limits['max_repeated_groups_per_profile']) {
                    raidlands_airstrike_animation_validation_error(
                        $errors,
                        $path . '.ReleaseSource.Groups',
                        'group_count',
                        'Too many automatic release groups.'
                    );
                }

                $group_ids = [];
                $total_units = 0;
                $earliest_start = INF;
                $available_hardpoints = raidlands_airstrike_animation_hardpoints($source, $vehicle_metadata);

                foreach ($raw_groups as $index => $raw_group) {
                    $group_path = $path . '.ReleaseSource.Groups[' . $index . ']';

                    if (!is_array($raw_group)) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path, 'object', 'Automatic release group must be an object.');
                        continue;
                    }

                    $group = raidlands_airstrike_animation_repeated_group($raw_group, (int) $index);
                    $group_id = is_string($raw_group['Id'] ?? null) ? trim($raw_group['Id']) : '';

                    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $group_id)) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.Id', 'stable_id', 'Must be a safe stable automatic-group ID.');
                    } elseif (isset($group_ids[$group_id])) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.Id', 'duplicate_id', 'Automatic-group ID must be unique.');
                    } else {
                        $group_ids[$group_id] = true;
                    }

                    $group_name = is_string($raw_group['Name'] ?? null) ? trim($raw_group['Name']) : '';

                    if ($group_name === '' || strlen($group_name) > 100) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.Name', 'name', 'Must be a name between 1 and 100 characters.');
                    }

                    $raw_start = $raw_group['StartTime'] ?? null;
                    $raw_interval = $raw_group['IntervalSeconds'] ?? null;
                    $raw_units = $raw_group['UnitsPerRelease'] ?? null;
                    $raw_maximum = $raw_group['MaximumUnits'] ?? null;
                    raidlands_airstrike_animation_validate_number($errors, $raw_start, $group_path . '.StartTime', 0.0, $duration_number);
                    raidlands_airstrike_animation_validate_number($errors, $raw_interval, $group_path . '.IntervalSeconds', 0.001, 30.0);
                    $raw_unit_interval = $raw_group['UnitIntervalSeconds'] ?? 0.0;
                    raidlands_airstrike_animation_validate_number($errors, $raw_unit_interval, $group_path . '.UnitIntervalSeconds', 0.0, 30.0);

                    if (is_int($raw_start) || is_float($raw_start)) {
                        $earliest_start = min($earliest_start, (float) $raw_start);
                    }

                    raidlands_airstrike_animation_validate_number($errors, $raw_units, $group_path . '.UnitsPerRelease', 1.0, 200.0);

                    if ((is_int($raw_units) || is_float($raw_units))
                        && (is_int($raw_interval) || is_float($raw_interval))
                        && (is_int($raw_unit_interval) || is_float($raw_unit_interval))
                        && ((float) $raw_units * (float) $raw_unit_interval) > (float) $raw_interval + 0.000000001) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.UnitIntervalSeconds', 'burst_overlap', 'All units in a burst must fit before the next burst starts.');
                    }

                    if ((is_int($raw_units) || is_float($raw_units)) && floor((float) $raw_units) !== (float) $raw_units) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.UnitsPerRelease', 'integer', 'Must be an integer.');
                    }

                    raidlands_airstrike_animation_validate_number($errors, $raw_maximum, $group_path . '.MaximumUnits', 1.0, (float) $max_release_units);

                    if ((is_int($raw_maximum) || is_float($raw_maximum)) && floor((float) $raw_maximum) !== (float) $raw_maximum) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.MaximumUnits', 'integer', 'Must be an integer.');
                    }

                    if (is_int($raw_maximum) || is_float($raw_maximum)) {
                        $total_units += max(0, (int) $raw_maximum);
                    }
                    if ((is_int($raw_start) || is_float($raw_start))
                        && (is_int($raw_interval) || is_float($raw_interval))
                        && (is_int($raw_unit_interval) || is_float($raw_unit_interval))
                        && (is_int($raw_units) || is_float($raw_units)) && (float) $raw_units >= 1.0
                        && floor((float) $raw_units) === (float) $raw_units
                        && (is_int($raw_maximum) || is_float($raw_maximum)) && (float) $raw_maximum >= 1.0
                        && floor((float) $raw_maximum) === (float) $raw_maximum) {
                        $final_unit = (int) $raw_maximum - 1;
                        $final_time = (float) $raw_start
                            + intdiv($final_unit, (int) $raw_units) * (float) $raw_interval
                            + ($final_unit % (int) $raw_units) * (float) $raw_unit_interval;
                        if ($final_time > $duration_number + 0.000000001) {
                            raidlands_airstrike_animation_validation_error($errors, $group_path . '.MaximumUnits', 'release_after_duration', 'All generated units must occur within the profile duration.');
                        }
                    }
                    $template = $group['template'];
                    $template['Time'] = $group['start_time'];
                    $template['Count'] = max(1, $group['units_per_release']);
                    raidlands_airstrike_animation_validate_event($template, $group_path . '.Template', $duration_number, $errors);

                    $raw_hardpoints = $raw_group['HardpointSequence'] ?? null;

                    if (!is_array($raw_hardpoints) || !array_is_list($raw_hardpoints)) {
                        raidlands_airstrike_animation_validation_error($errors, $group_path . '.HardpointSequence', 'array', 'Must be an array.');
                    } else {
                        foreach ($raw_hardpoints as $hardpoint_index => $hardpoint_value) {
                            $hardpoint_id = is_string($hardpoint_value) ? $hardpoint_value : '';

                            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $hardpoint_id)) {
                                raidlands_airstrike_animation_validation_error($errors, $group_path . '.HardpointSequence[' . $hardpoint_index . ']', 'stable_id', 'Must be a safe hardpoint ID.');
                            } elseif (!isset($available_hardpoints[$hardpoint_id])) {
                                raidlands_airstrike_animation_validation_error($errors, $group_path . '.HardpointSequence[' . $hardpoint_index . ']', 'unknown_hardpoint', "Unknown hardpoint '" . $hardpoint_id . "'.");
                            }
                        }
                    }
                }

                if ($total_units > $max_release_units) {
                    raidlands_airstrike_animation_validation_error(
                        $errors,
                        $path . '.ReleaseSource.Groups',
                        'compiled_unit_count',
                        'Automatic groups must not exceed ' . $max_release_units . ' total units.'
                    );
                }

                $first_delay = raidlands_airstrike_animation_number($source['FirstPayloadDelaySeconds'] ?? -1.0, -1.0);

                if ($release['mode'] === 'repeated' && is_finite($earliest_start) && abs($first_delay - $earliest_start) > 0.000001) {
                    raidlands_airstrike_animation_validation_error($errors, $path . '.FirstPayloadDelaySeconds', 'first_release_sync', 'Must equal the earliest automatic group start time.');
                }
            }
        } else {
        raidlands_airstrike_animation_validate_number(
            $errors,
            $release['start_time'],
            $path . '.ReleaseSource.StartTime',
            0.0,
            $duration_number
        );
        raidlands_airstrike_animation_validate_number(
            $errors,
            $release['interval_seconds'],
            $path . '.ReleaseSource.IntervalSeconds',
            0.01,
            30.0
        );

        if ($release['units_per_release'] < 1 || $release['units_per_release'] > 200) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.ReleaseSource.UnitsPerRelease',
                'count',
                'UnitsPerRelease must be between 1 and 200.'
            );
        }

        $minimum_units = $release['legacy_dynamic'] ? 0 : 1;

        if ($release['maximum_units'] < $minimum_units || $release['maximum_units'] > $max_release_units) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.ReleaseSource.MaximumUnits',
                'count',
                'MaximumUnits must be between ' . $minimum_units . ' and ' . $max_release_units . '.'
            );
        }
        if ($release['units_per_release'] > 0 && $release['maximum_units'] > 0) {
            $final_time = $release['start_time']
                + intdiv($release['maximum_units'] - 1, $release['units_per_release']) * $release['interval_seconds'];
            if ($final_time > $duration_number + 0.000000001) {
                raidlands_airstrike_animation_validation_error($errors, $path . '.ReleaseSource.MaximumUnits', 'release_after_duration', 'All generated units must occur within the profile duration.');
            }
        }

        $template = $release['template'];
        $template['Time'] = $release['start_time'];
        $template['Count'] = max(1, $release['units_per_release']);
        raidlands_airstrike_animation_validate_event($template, $path . '.ReleaseSource.Template', $duration_number, $errors);

        $first_delay = raidlands_airstrike_animation_number($source['FirstPayloadDelaySeconds'] ?? -1.0, -1.0);

        if (abs($first_delay - $release['start_time']) > 0.000001) {
            raidlands_airstrike_animation_validation_error(
                $errors,
                $path . '.FirstPayloadDelaySeconds',
                'first_release_sync',
                'Must equal repeated StartTime.'
            );
        }

        $available_hardpoints = raidlands_airstrike_animation_hardpoints($source, $vehicle_metadata);

        foreach ($release['hardpoint_sequence'] as $index => $hardpoint_id) {
            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $hardpoint_id)) {
                raidlands_airstrike_animation_validation_error(
                    $errors,
                    $path . '.ReleaseSource.HardpointSequence[' . $index . ']',
                    'stable_id',
                    'Must be a safe hardpoint ID.'
                );
            } elseif (!isset($available_hardpoints[$hardpoint_id])) {
                raidlands_airstrike_animation_validation_error(
                    $errors,
                    $path . '.ReleaseSource.HardpointSequence[' . $index . ']',
                    'unknown_hardpoint',
                    "Unknown hardpoint '" . $hardpoint_id . "'."
                );
            }
        }
        }
    }

    $editor_metadata = is_array($source['EditorMetadata'] ?? null) ? $source['EditorMetadata'] : [];

    if (array_key_exists('GlobalTargetSpeedMetersPerSecond', $editor_metadata)) {
        raidlands_airstrike_animation_validate_number(
            $errors,
            $editor_metadata['GlobalTargetSpeedMetersPerSecond'],
            $path . '.EditorMetadata.GlobalTargetSpeedMetersPerSecond',
            0.1,
            500.0
        );
    }

    return [
        'ok' => $errors === [],
        'errors' => $errors,
        'warnings' => $warnings,
    ];
}

function raidlands_airstrike_animation_assert_valid_profile(array $source, array $vehicle_metadata = []): void
{
    $key = raidlands_airstrike_animation_profile_key($source);
    $path = $key === '' ? 'Profile' : 'Profiles.' . $key;
    $validation = raidlands_airstrike_animation_validate_profile($source, $path, $vehicle_metadata);

    if (!empty($validation['ok'])) {
        return;
    }

    $first = $validation['errors'][0] ?? ['path' => $path, 'message' => 'Profile validation failed.'];
    throw new InvalidArgumentException((string) $first['path'] . ': ' . (string) $first['message']);
}

function raidlands_airstrike_animation_vector(float $x, float $y, float $z): array
{
    return [$x, $y, $z];
}

function raidlands_airstrike_animation_vector_subtract(array $left, array $right): array
{
    return [$left[0] - $right[0], $left[1] - $right[1], $left[2] - $right[2]];
}

function raidlands_airstrike_animation_vector_scale(array $value, float $scale): array
{
    return [$value[0] * $scale, $value[1] * $scale, $value[2] * $scale];
}

function raidlands_airstrike_animation_vector_dot(array $left, array $right): float
{
    return ($left[0] * $right[0]) + ($left[1] * $right[1]) + ($left[2] * $right[2]);
}

function raidlands_airstrike_animation_vector_cross(array $left, array $right): array
{
    return [
        ($left[1] * $right[2]) - ($left[2] * $right[1]),
        ($left[2] * $right[0]) - ($left[0] * $right[2]),
        ($left[0] * $right[1]) - ($left[1] * $right[0]),
    ];
}

function raidlands_airstrike_animation_vector_length(array $value): float
{
    return sqrt(raidlands_airstrike_animation_vector_dot($value, $value));
}

function raidlands_airstrike_animation_vector_normalize(array $value, array $fallback = [0.0, 0.0, 1.0]): array
{
    $length_squared = raidlands_airstrike_animation_vector_dot($value, $value);

    return $length_squared <= 0.000000001
        ? $fallback
        : raidlands_airstrike_animation_vector_scale($value, 1.0 / sqrt($length_squared));
}

function raidlands_airstrike_animation_quaternion_normalize(array $value): array
{
    $length_squared =
        ($value[0] * $value[0])
        + ($value[1] * $value[1])
        + ($value[2] * $value[2])
        + ($value[3] * $value[3]);

    if ($length_squared <= 0.000000001) {
        return [0.0, 0.0, 0.0, 1.0];
    }

    $length = sqrt($length_squared);

    return [
        $value[0] / $length,
        $value[1] / $length,
        $value[2] / $length,
        $value[3] / $length,
    ];
}

function raidlands_airstrike_animation_quaternion_multiply(array $left, array $right): array
{
    [$lx, $ly, $lz, $lw] = $left;
    [$rx, $ry, $rz, $rw] = $right;

    return [
        ($lw * $rx) + ($lx * $rw) + ($ly * $rz) - ($lz * $ry),
        ($lw * $ry) - ($lx * $rz) + ($ly * $rw) + ($lz * $rx),
        ($lw * $rz) + ($lx * $ry) - ($ly * $rx) + ($lz * $rw),
        ($lw * $rw) - ($lx * $rx) - ($ly * $ry) - ($lz * $rz),
    ];
}

function raidlands_airstrike_animation_unity_euler_quaternion(float $x, float $y, float $z): array
{
    $half_x = deg2rad($x) * 0.5;
    $half_y = deg2rad($y) * 0.5;
    $half_z = deg2rad($z) * 0.5;
    $qx = [sin($half_x), 0.0, 0.0, cos($half_x)];
    $qy = [0.0, sin($half_y), 0.0, cos($half_y)];
    $qz = [0.0, 0.0, sin($half_z), cos($half_z)];

    // Unity Quaternion.Euler applies Z, then X, then Y.
    return raidlands_airstrike_animation_quaternion_normalize(
        raidlands_airstrike_animation_quaternion_multiply(
            $qy,
            raidlands_airstrike_animation_quaternion_multiply($qx, $qz)
        )
    );
}

function raidlands_airstrike_animation_matrix_quaternion(array $matrix): array
{
    $m00 = $matrix[0][0];
    $m01 = $matrix[0][1];
    $m02 = $matrix[0][2];
    $m10 = $matrix[1][0];
    $m11 = $matrix[1][1];
    $m12 = $matrix[1][2];
    $m20 = $matrix[2][0];
    $m21 = $matrix[2][1];
    $m22 = $matrix[2][2];
    $trace = $m00 + $m11 + $m22;

    if ($trace > 0.0) {
        $s = sqrt($trace + 1.0) * 2.0;
        $quaternion = [
            ($m21 - $m12) / $s,
            ($m02 - $m20) / $s,
            ($m10 - $m01) / $s,
            0.25 * $s,
        ];
    } elseif ($m00 > $m11 && $m00 > $m22) {
        $s = sqrt(1.0 + $m00 - $m11 - $m22) * 2.0;
        $quaternion = [
            0.25 * $s,
            ($m01 + $m10) / $s,
            ($m02 + $m20) / $s,
            ($m21 - $m12) / $s,
        ];
    } elseif ($m11 > $m22) {
        $s = sqrt(1.0 + $m11 - $m00 - $m22) * 2.0;
        $quaternion = [
            ($m01 + $m10) / $s,
            0.25 * $s,
            ($m12 + $m21) / $s,
            ($m02 - $m20) / $s,
        ];
    } else {
        $s = sqrt(1.0 + $m22 - $m00 - $m11) * 2.0;
        $quaternion = [
            ($m02 + $m20) / $s,
            ($m12 + $m21) / $s,
            0.25 * $s,
            ($m10 - $m01) / $s,
        ];
    }

    return raidlands_airstrike_animation_quaternion_normalize($quaternion);
}

function raidlands_airstrike_animation_look_rotation(array $forward): array
{
    $forward = raidlands_airstrike_animation_vector_normalize($forward);
    $up = [0.0, 1.0, 0.0];

    if (abs($forward[1]) > 0.999) {
        $up = [0.0, 0.0, 1.0];
    }

    $right = raidlands_airstrike_animation_vector_normalize(
        raidlands_airstrike_animation_vector_cross($up, $forward),
        [1.0, 0.0, 0.0]
    );
    $corrected_up = raidlands_airstrike_animation_vector_cross($forward, $right);

    return raidlands_airstrike_animation_matrix_quaternion([
        [$right[0], $corrected_up[0], $forward[0]],
        [$right[1], $corrected_up[1], $forward[1]],
        [$right[2], $corrected_up[2], $forward[2]],
    ]);
}

function raidlands_airstrike_animation_normalize_waypoints(array $source): array
{
    $normalized = [];

    foreach ((array) ($source['Waypoints'] ?? []) as $waypoint) {
        $normalized[] = [
            'Time' => (float) $waypoint['Time'],
            'X' => (float) $waypoint['X'],
            'Y' => (float) $waypoint['Y'],
            'Z' => (float) $waypoint['Z'],
            'RotationX' => raidlands_airstrike_animation_number($waypoint['RotationX'] ?? 0.0),
            'RotationY' => raidlands_airstrike_animation_number($waypoint['RotationY'] ?? 0.0),
            'RotationZ' => raidlands_airstrike_animation_number($waypoint['RotationZ'] ?? 0.0),
        ];
    }

    return $normalized;
}

function raidlands_airstrike_animation_waypoint_position(array $waypoint): array
{
    return [(float) $waypoint['X'], (float) $waypoint['Y'], (float) $waypoint['Z']];
}

function raidlands_airstrike_animation_waypoint_tangent(array $waypoints, int $index): array
{
    $last = count($waypoints) - 1;

    if ($index <= 0) {
        $duration = (float) $waypoints[1]['Time'] - (float) $waypoints[0]['Time'];
        return raidlands_airstrike_animation_vector_scale(
            raidlands_airstrike_animation_vector_subtract(
                raidlands_airstrike_animation_waypoint_position($waypoints[1]),
                raidlands_airstrike_animation_waypoint_position($waypoints[0])
            ),
            1.0 / $duration
        );
    }

    if ($index >= $last) {
        $duration = (float) $waypoints[$last]['Time'] - (float) $waypoints[$last - 1]['Time'];
        return raidlands_airstrike_animation_vector_scale(
            raidlands_airstrike_animation_vector_subtract(
                raidlands_airstrike_animation_waypoint_position($waypoints[$last]),
                raidlands_airstrike_animation_waypoint_position($waypoints[$last - 1])
            ),
            1.0 / $duration
        );
    }

    $duration = (float) $waypoints[$index + 1]['Time'] - (float) $waypoints[$index - 1]['Time'];

    return raidlands_airstrike_animation_vector_scale(
        raidlands_airstrike_animation_vector_subtract(
            raidlands_airstrike_animation_waypoint_position($waypoints[$index + 1]),
            raidlands_airstrike_animation_waypoint_position($waypoints[$index - 1])
        ),
        1.0 / $duration
    );
}

function raidlands_airstrike_animation_evaluate_route(
    array $waypoints,
    bool $stop_at_waypoints,
    float $time,
    string $rotation_mode = 'follow_path_plus_offset'
): array
{
    $last = count($waypoints) - 1;
    $time = max((float) $waypoints[0]['Time'], min((float) $waypoints[$last]['Time'], $time));
    $segment = 0;

    while ($segment < $last - 1 && $time > (float) $waypoints[$segment + 1]['Time']) {
        $segment += 1;
    }

    $left = $waypoints[$segment];
    $right = $waypoints[$segment + 1];
    $segment_duration = (float) $right['Time'] - (float) $left['Time'];
    $u = $segment_duration <= 0.0 ? 0.0 : ($time - (float) $left['Time']) / $segment_duration;
    $u = max(0.0, min(1.0, $u));
    $u2 = $u * $u;
    $u3 = $u2 * $u;
    $p0 = raidlands_airstrike_animation_waypoint_position($left);
    $p1 = raidlands_airstrike_animation_waypoint_position($right);
    $m0 = $stop_at_waypoints ? [0.0, 0.0, 0.0] : raidlands_airstrike_animation_waypoint_tangent($waypoints, $segment);
    $m1 = $stop_at_waypoints ? [0.0, 0.0, 0.0] : raidlands_airstrike_animation_waypoint_tangent($waypoints, $segment + 1);
    $h00 = (2.0 * $u3) - (3.0 * $u2) + 1.0;
    $h10 = $u3 - (2.0 * $u2) + $u;
    $h01 = (-2.0 * $u3) + (3.0 * $u2);
    $h11 = $u3 - $u2;
    $position = [];

    for ($axis = 0; $axis < 3; $axis += 1) {
        if ($stop_at_waypoints) {
            $smooth = ($u * $u) * (3.0 - (2.0 * $u));
            $position[$axis] = $p0[$axis] + (($p1[$axis] - $p0[$axis]) * $smooth);
        } else {
            $position[$axis] =
                (($h00 * $p0[$axis]) + ($m0[$axis] * ($h10 * $segment_duration)))
                + (($h01 * $p1[$axis]) + ($m1[$axis] * ($h11 * $segment_duration)));
        }
    }

    $dh00 = (6.0 * $u2) - (6.0 * $u);
    $dh10 = (3.0 * $u2) - (4.0 * $u) + 1.0;
    $dh01 = (-6.0 * $u2) + (6.0 * $u);
    $dh11 = (3.0 * $u2) - (2.0 * $u);
    $tangent = [];

    for ($axis = 0; $axis < 3; $axis += 1) {
        if ($stop_at_waypoints) {
            $derivative_scale = (6.0 * $u * (1.0 - $u)) / $segment_duration;
            $tangent[$axis] = ($p1[$axis] - $p0[$axis]) * $derivative_scale;
        } else {
            $tangent[$axis] =
                (($p0[$axis] * ($dh00 / $segment_duration)) + ($m0[$axis] * $dh10))
                + (($p1[$axis] * ($dh01 / $segment_duration)) + ($m1[$axis] * $dh11));
        }
    }

    if (raidlands_airstrike_animation_vector_dot($tangent, $tangent) <= 0.000000001) {
        $waypoint_index = $segment + ($u >= 1.0 ? 1 : 0);

        if ($waypoint_index > 0 && $waypoint_index < $last) {
            $tangent = raidlands_airstrike_animation_vector_subtract(
                raidlands_airstrike_animation_waypoint_position($waypoints[$waypoint_index + 1]),
                raidlands_airstrike_animation_waypoint_position($waypoints[$waypoint_index - 1])
            );
        }
    }

    if (raidlands_airstrike_animation_vector_dot($tangent, $tangent) <= 0.000000001) {
        $tangent = raidlands_airstrike_animation_vector_subtract($p1, $p0);
    }

    $rotation_progress = $stop_at_waypoints ? (($u * $u) * (3.0 - (2.0 * $u))) : $u;
    $rotation_x = (float) $left['RotationX'] + (((float) $right['RotationX'] - (float) $left['RotationX']) * $rotation_progress);
    $rotation_y = (float) $left['RotationY'] + (((float) $right['RotationY'] - (float) $left['RotationY']) * $rotation_progress);
    $rotation_z = (float) $left['RotationZ'] + (((float) $right['RotationZ'] - (float) $left['RotationZ']) * $rotation_progress);
    $authored = raidlands_airstrike_animation_unity_euler_quaternion($rotation_x, $rotation_y, $rotation_z);
    $quaternion = $rotation_mode === 'authored_orientation'
        ? $authored
        : raidlands_airstrike_animation_quaternion_normalize(
            raidlands_airstrike_animation_quaternion_multiply(
                raidlands_airstrike_animation_look_rotation($tangent),
                $authored
            )
        );

    return [
        'position' => $position,
        'quaternion' => $quaternion,
    ];
}

function raidlands_airstrike_animation_compile_track(array $source, array $waypoints, string $source_hash): array
{
    $limits = raidlands_airstrike_animation_compiler_limits();
    $sample_rate = (int) $limits['sample_rate_hz'];
    $duration = (float) $source['DurationSeconds'];
    $stop_at_waypoints = !empty($source['StopAtWaypoints']);
    $rotation_mode = (string) ($source['RotationMode'] ?? 'follow_path_plus_offset');
    $frames = [];
    $previous_quaternion = null;

    for ($index = 0; ; $index += 1) {
        $time = $index / $sample_rate;

        if ($time >= $duration) {
            break;
        }

        $evaluation = raidlands_airstrike_animation_evaluate_route($waypoints, $stop_at_waypoints, $time, $rotation_mode);
        $quaternion = $evaluation['quaternion'];

        if ($previous_quaternion !== null) {
            $dot =
                ($previous_quaternion[0] * $quaternion[0])
                + ($previous_quaternion[1] * $quaternion[1])
                + ($previous_quaternion[2] * $quaternion[2])
                + ($previous_quaternion[3] * $quaternion[3]);

            if ($dot < 0.0) {
                $quaternion = array_map(static fn (float $value): float => -$value, $quaternion);
            }
        }

        $frames[] = raidlands_airstrike_animation_frame($time, $evaluation['position'], $quaternion);
        $previous_quaternion = $quaternion;
    }

    $evaluation = raidlands_airstrike_animation_evaluate_route($waypoints, $stop_at_waypoints, $duration, $rotation_mode);
    $quaternion = $evaluation['quaternion'];

    if ($previous_quaternion !== null) {
        $dot =
            ($previous_quaternion[0] * $quaternion[0])
            + ($previous_quaternion[1] * $quaternion[1])
            + ($previous_quaternion[2] * $quaternion[2])
            + ($previous_quaternion[3] * $quaternion[3]);

        if ($dot < 0.0) {
            $quaternion = array_map(static fn (float $value): float => -$value, $quaternion);
        }
    }

    $frames[] = raidlands_airstrike_animation_frame($duration, $evaluation['position'], $quaternion);

    if (count($frames) > (int) $limits['max_compiled_frames_per_profile']) {
        throw new InvalidArgumentException('CompiledTrack.Frames exceeds the configured frame limit.');
    }

    return [
        'CompilerVersion' => raidlands_airstrike_animation_compiler_version(),
        'SourceHash' => $source_hash,
        'CoordinateSystem' => 'unity-target-relative-local-v1',
        'SampleRateHz' => $sample_rate,
        'SampleIntervalSeconds' => raidlands_airstrike_animation_quantize(1.0 / $sample_rate),
        'DurationSeconds' => raidlands_airstrike_animation_quantize($duration),
        'Frames' => $frames,
    ];
}

function raidlands_airstrike_animation_frame(float $time, array $position, array $quaternion): array
{
    return [
        'Time' => raidlands_airstrike_animation_quantize($time),
        'X' => raidlands_airstrike_animation_quantize($position[0]),
        'Y' => raidlands_airstrike_animation_quantize($position[1]),
        'Z' => raidlands_airstrike_animation_quantize($position[2]),
        'Qx' => raidlands_airstrike_animation_quantize($quaternion[0]),
        'Qy' => raidlands_airstrike_animation_quantize($quaternion[1]),
        'Qz' => raidlands_airstrike_animation_quantize($quaternion[2]),
        'Qw' => raidlands_airstrike_animation_quantize($quaternion[3]),
    ];
}

function raidlands_airstrike_animation_hardpoints(array $source, array $vehicle_metadata = []): array
{
    $hardpoints = [];
    $vehicle = strtolower(trim((string) ($source['Vehicle'] ?? '')));
    $vehicle_entry = $vehicle_metadata[$vehicle]
        ?? ($vehicle_metadata['Vehicles'][$vehicle] ?? null)
        ?? ($vehicle_metadata['vehicles'][$vehicle] ?? null)
        ?? [];
    $base = is_array($vehicle_entry)
        ? ($vehicle_entry['hardpoints'] ?? $vehicle_entry['Hardpoints'] ?? [])
        : [];

    if (is_array($base)) {
        foreach ($base as $key => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $id = trim((string) ($entry['id'] ?? $entry['Id'] ?? (is_string($key) ? $key : '')));

            if ($id === '') {
                continue;
            }

            $hardpoints[$id] = [
                'X' => raidlands_airstrike_animation_number($entry['x'] ?? $entry['X'] ?? 0.0),
                'Y' => raidlands_airstrike_animation_number($entry['y'] ?? $entry['Y'] ?? 0.0),
                'Z' => raidlands_airstrike_animation_number($entry['z'] ?? $entry['Z'] ?? 0.0),
            ];
        }
    }

    $raw = $source['EditorMetadata']['VehiclePreviewOverrides']['Hardpoints']
        ?? ($source['VehiclePreviewOverrides']['Hardpoints'] ?? null)
        ?? ($source['Hardpoints'] ?? []);

    if (!is_array($raw)) {
        return $hardpoints;
    }

    foreach ($raw as $key => $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $id = trim((string) ($entry['Id'] ?? (is_string($key) ? $key : '')));

        if ($id === '') {
            continue;
        }

        $hardpoints[$id] = [
            'X' => raidlands_airstrike_animation_number($entry['CarrierOffsetX'] ?? $entry['X'] ?? 0.0),
            'Y' => raidlands_airstrike_animation_number($entry['CarrierOffsetY'] ?? $entry['Y'] ?? 0.0),
            'Z' => raidlands_airstrike_animation_number($entry['CarrierOffsetZ'] ?? $entry['Z'] ?? 0.0),
        ];
    }

    return $hardpoints;
}

function raidlands_airstrike_animation_runtime_event(array $event, float $time, int $index, int $count = 1): array
{
    $damage_scales = isset($event['DamageScales']) && is_array($event['DamageScales'])
        ? $event['DamageScales']
        : [];

    return [
        'Time' => raidlands_airstrike_animation_quantize($time),
        'Payload' => strtolower(trim((string) ($event['Payload'] ?? ''))),
        'Index' => $index,
        'Count' => $count,
        'CarrierOffsetX' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['CarrierOffsetX'] ?? 0.0)),
        'CarrierOffsetY' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['CarrierOffsetY'] ?? 0.0)),
        'CarrierOffsetZ' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['CarrierOffsetZ'] ?? 0.0)),
        'TargetOffsetX' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['TargetOffsetX'] ?? 0.0)),
        'TargetOffsetY' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['TargetOffsetY'] ?? 0.0)),
        'TargetOffsetZ' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['TargetOffsetZ'] ?? 0.0)),
        'SpreadRadius' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['SpreadRadius'] ?? -1.0, -1.0)),
        'LaunchSpeed' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['LaunchSpeed'] ?? -1.0, -1.0)),
        'FuseSeconds' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['FuseSeconds'] ?? -1.0, -1.0)),
        'DamageScale' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['DamageScale'] ?? 1.0, 1.0)),
        'VehicleDamageScale' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['VehicleDamageScale'] ?? -1.0, -1.0)),
        'SplashRadius' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['SplashRadius'] ?? -1.0, -1.0)),
        'ImpactRadius' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['ImpactRadius'] ?? -1.0, -1.0)),
        'MaxTrackingSeconds' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['MaxTrackingSeconds'] ?? -1.0, -1.0)),
        'MaxTrackingDistance' => raidlands_airstrike_animation_quantize(raidlands_airstrike_animation_number($event['MaxTrackingDistance'] ?? -1.0, -1.0)),
        'DamageScales' => $damage_scales === []
            ? new stdClass()
            : raidlands_airstrike_animation_canonical_value($damage_scales),
    ];
}

function raidlands_airstrike_animation_payload_object_shape(array $fields): array
{
    if (array_key_exists('DamageScales', $fields)
        && is_array($fields['DamageScales'])
        && $fields['DamageScales'] === []) {
        $fields['DamageScales'] = new stdClass();
    }

    return $fields;
}

function raidlands_airstrike_animation_apply_hardpoint(array $event, string $hardpoint_id, array $hardpoints): array
{
    if ($hardpoint_id === '' || !isset($hardpoints[$hardpoint_id])) {
        return $event;
    }

    $hardpoint = $hardpoints[$hardpoint_id];
    $event['CarrierOffsetX'] = raidlands_airstrike_animation_number($event['CarrierOffsetX'] ?? 0.0) + $hardpoint['X'];
    $event['CarrierOffsetY'] = raidlands_airstrike_animation_number($event['CarrierOffsetY'] ?? 0.0) + $hardpoint['Y'];
    $event['CarrierOffsetZ'] = raidlands_airstrike_animation_number($event['CarrierOffsetZ'] ?? 0.0) + $hardpoint['Z'];

    return $event;
}

function raidlands_airstrike_animation_source_hash_projection(
    array $source,
    array $resolved_hardpoint_offsets = []
): array {
    $release = raidlands_airstrike_animation_release_source($source);
    $waypoints = [];

    foreach ((array) ($source['Waypoints'] ?? []) as $waypoint) {
        if (!is_array($waypoint)) {
            continue;
        }

        unset($waypoint['Id']);
        $waypoints[] = $waypoint;
    }

    if ($release['mode'] === 'manual') {
        $events = [];

        foreach ($release['events'] as $event) {
            if (!is_array($event)) {
                continue;
            }

            unset($event['Id']);
            $events[] = raidlands_airstrike_animation_payload_object_shape($event);
        }

        $release_projection = [
            'Mode' => 'manual',
            'LegacyDynamic' => $release['legacy_dynamic'],
            'MaximumUnits' => $release['maximum_units_present'] ? $release['maximum_units'] : null,
            'FallbackIntervalSeconds' => $release['fallback_interval_present']
                ? $release['fallback_interval_seconds']
                : null,
            'Template' => $release['template_present']
                ? raidlands_airstrike_animation_payload_object_shape($release['template'])
                : null,
            'Events' => $events,
        ];

        if ($resolved_hardpoint_offsets !== []) {
            $release_projection['ResolvedHardpointOffsets'] = $resolved_hardpoint_offsets;
        }
    } else {
        if ($release['groups_present']) {
            $groups = [];

            foreach ($release['groups'] as $group) {
                $groups[] = [
                    'StartTime' => $group['start_time'],
                    'IntervalSeconds' => $group['interval_seconds'],
                    'UnitsPerRelease' => $group['units_per_release'],
                    'MaximumUnits' => $group['maximum_units'],
                    'Template' => raidlands_airstrike_animation_payload_object_shape($group['template']),
                    'HardpointSequence' => $group['hardpoint_sequence'],
                ];
            }

            $release_projection = [
                'Mode' => $release['mode'] === 'mixed' ? 'mixed' : 'repeated',
                'LegacyDynamic' => false,
                'Groups' => $groups,
                'ResolvedHardpointOffsets' => $resolved_hardpoint_offsets === []
                    ? new stdClass()
                    : $resolved_hardpoint_offsets,
            ];
            if ($release['mode'] === 'mixed') {
                $release_projection['Events'] = array_map(static function (array $event): array {
                    unset($event['Id']);
                    return raidlands_airstrike_animation_payload_object_shape($event);
                }, array_values(array_filter($release['events'], 'is_array')));
            }
        } else {
            $release_projection = [
                'Mode' => 'repeated',
                'LegacyDynamic' => $release['legacy_dynamic'],
                'StartTime' => $release['start_time'],
                'IntervalSeconds' => $release['interval_seconds'],
                'UnitsPerRelease' => $release['units_per_release'],
                'MaximumUnits' => $release['maximum_units'],
                'Template' => raidlands_airstrike_animation_payload_object_shape($release['template']),
                'HardpointSequence' => $release['hardpoint_sequence'],
                'ResolvedHardpointOffsets' => $resolved_hardpoint_offsets === []
                    ? new stdClass()
                    : $resolved_hardpoint_offsets,
            ];
        }
    }

    $projection = [
        'ProfileKey' => raidlands_airstrike_animation_profile_key($source),
        'Vehicle' => (string) ($source['Vehicle'] ?? ''),
        'DurationSeconds' => raidlands_airstrike_animation_number($source['DurationSeconds'] ?? 0.0),
        'FirstPayloadDelaySeconds' => raidlands_airstrike_animation_number($source['FirstPayloadDelaySeconds'] ?? 0.0),
        'RotationSmoothTimeSeconds' => raidlands_airstrike_animation_number($source['RotationSmoothTimeSeconds'] ?? 0.0),
        'StopAtWaypoints' => !empty($source['StopAtWaypoints']),
        'MinimumTerrainClearance' => raidlands_airstrike_animation_number($source['MinimumTerrainClearance'] ?? 0.0),
        'PositionInterpolation' => (string) ($source['PositionInterpolation'] ?? ''),
        'RotationMode' => (string) ($source['RotationMode'] ?? ''),
        'Waypoints' => $waypoints,
        'ReleaseSource' => $release_projection,
    ];

    $editor_metadata = is_array($source['EditorMetadata'] ?? null) ? $source['EditorMetadata'] : [];

    if (array_key_exists('GlobalTargetSpeedMetersPerSecond', $editor_metadata)) {
        $projection['GlobalTargetSpeedMetersPerSecond'] = raidlands_airstrike_animation_number(
            $editor_metadata['GlobalTargetSpeedMetersPerSecond'] ?? 0.0
        );
    }

    return $projection;
}

function raidlands_airstrike_animation_ordered_manual_events(array $events): array
{
    $ordered = [];

    foreach ($events as $source_index => $event) {
        if (is_array($event)) {
            $ordered[] = ['event' => $event, 'source_index' => (int) $source_index];
        }
    }

    usort($ordered, static function (array $left, array $right): int {
        $time_compare = raidlands_airstrike_animation_number($left['event']['Time'] ?? 0.0)
            <=> raidlands_airstrike_animation_number($right['event']['Time'] ?? 0.0);

        return $time_compare !== 0
            ? $time_compare
            : $left['source_index'] <=> $right['source_index'];
    });

    return $ordered;
}

function raidlands_airstrike_animation_compile_release_schedule(
    array $source,
    array $vehicle_metadata = []
): array {
    $release = raidlands_airstrike_animation_release_source($source);
    $hardpoints = raidlands_airstrike_animation_hardpoints($source, $vehicle_metadata);
    $resolved_hardpoint_offsets = [];
    $legacy_events = [];
    $manual_units = 0;
    if ($release['mode'] === 'manual' || $release['mode'] === 'mixed') {
        foreach (raidlands_airstrike_animation_ordered_manual_events($release['events']) as $index => $entry) {
            $event = $entry['event'];
            $hardpoint_id = trim((string) ($event['HardpointId'] ?? $event['Hardpoint'] ?? ''));
            if ($hardpoint_id !== '' && isset($hardpoints[$hardpoint_id])) {
                $resolved_hardpoint_offsets[$hardpoint_id] = $hardpoints[$hardpoint_id];
            }
            $count = max(1, raidlands_airstrike_animation_int($event['Count'] ?? 1, 1));
            $manual_units += $count;
            $legacy_events[] = raidlands_airstrike_animation_runtime_event(
                raidlands_airstrike_animation_apply_hardpoint($event, $hardpoint_id, $hardpoints),
                raidlands_airstrike_animation_number($event['Time'] ?? 0.0),
                $index + 1,
                $count
            );
        }
    }

    $legacy_template = raidlands_airstrike_animation_runtime_event($release['template'], 0.0, 0, 1);
    if ($release['mode'] === 'manual') {
        return [
            'legacy_mode' => 'manual',
            'legacy_maximum_units' => $release['maximum_units_present'] ? $release['maximum_units'] : $manual_units,
            'legacy_interval_seconds' => $release['fallback_interval_present'] ? $release['fallback_interval_seconds'] : 0.5,
            'legacy_template' => $legacy_template,
            'legacy_events' => $legacy_events,
            'generated_groups' => [],
            'resolved_hardpoint_offsets' => $resolved_hardpoint_offsets,
        ];
    }

    $groups = raidlands_airstrike_animation_repeated_groups($release);
    $primary_group = $groups[0];

    foreach ($groups as $candidate) {
        if ($candidate['start_time'] < $primary_group['start_time']
            || ($candidate['start_time'] === $primary_group['start_time'] && strcmp($candidate['id'], $primary_group['id']) < 0)) {
            $primary_group = $candidate;
        }
    }
    $generated_groups = [];
    foreach ($groups as $automatic_group) {
        $offsets = [];
        foreach ($automatic_group['hardpoint_sequence'] as $hardpoint_id) {
            if (isset($hardpoints[$hardpoint_id])) {
                $resolved_hardpoint_offsets[$hardpoint_id] = $hardpoints[$hardpoint_id];
                $offsets[] = $hardpoints[$hardpoint_id];
            }
        }
        $template = $automatic_group['template'];
        $template['Count'] = 1;
        $generated_groups[] = [
            'StartTime' => raidlands_airstrike_animation_quantize($automatic_group['start_time']),
            'IntervalSeconds' => raidlands_airstrike_animation_quantize($automatic_group['interval_seconds']),
            'UnitIntervalSeconds' => raidlands_airstrike_animation_quantize($automatic_group['unit_interval_seconds']),
            'UnitsPerRelease' => $automatic_group['units_per_release'],
            'MaximumUnits' => $automatic_group['maximum_units'],
            'Template' => raidlands_airstrike_animation_runtime_event($template, $automatic_group['start_time'], 0, 1),
            'HardpointOffsets' => $offsets,
        ];
    }
    $result = [
        'legacy_mode' => $release['mode'] === 'mixed' ? 'mixed' : 'generated',
        'legacy_maximum_units' => $manual_units + array_sum(array_column($groups, 'maximum_units')),
        'legacy_interval_seconds' => $primary_group['interval_seconds'],
        'legacy_template' => raidlands_airstrike_animation_runtime_event(
            array_merge($primary_group['template'], ['Count' => $primary_group['units_per_release']]),
            $primary_group['start_time'],
            0,
            $primary_group['units_per_release']
        ),
        'legacy_events' => $legacy_events,
        'generated_groups' => $generated_groups,
        'resolved_hardpoint_offsets' => $resolved_hardpoint_offsets,
    ];

    if (!$release['groups_present'] && $release['legacy_dynamic'] && $primary_group['maximum_units'] === 0) {
        $result['generated_groups'] = [];
        return $result;
    }
    return $result;
}

function raidlands_airstrike_animation_compile_release_events(
    array $source,
    array $release,
    array $vehicle_metadata = []
): ?array
{
    $hardpoints = raidlands_airstrike_animation_hardpoints($source, $vehicle_metadata);
    $compiled = [];
    $sequence_index = 1;
    $hardpoint_index = 0;

    if ($release['mode'] === 'manual') {
        if ($release['events'] === [] && $release['legacy_dynamic']) {
            // Preserve legacy dynamic behavior for profiles that intentionally have
            // no explicit events. Presence of an empty schema-2 array would disable
            // the runtime's legacy release path.
            return null;
        }

        $events = $release['events'];
        usort($events, static function (array $left, array $right): int {
            $time_compare = raidlands_airstrike_animation_number($left['Time'] ?? 0.0)
                <=> raidlands_airstrike_animation_number($right['Time'] ?? 0.0);

            return $time_compare !== 0
                ? $time_compare
                : raidlands_airstrike_animation_int($left['Index'] ?? 0) <=> raidlands_airstrike_animation_int($right['Index'] ?? 0);
        });

        foreach ($events as $event) {
            $count = max(1, raidlands_airstrike_animation_int($event['Count'] ?? 1, 1));

            for ($unit = 0; $unit < $count; $unit += 1) {
                $hardpoint_id = trim((string) ($event['HardpointId'] ?? $event['Hardpoint'] ?? ''));

                if ($release['hardpoint_sequence'] !== []) {
                    $hardpoint_id = (string) $release['hardpoint_sequence'][$hardpoint_index % count($release['hardpoint_sequence'])];
                    $hardpoint_index += 1;
                }

                $materialized = raidlands_airstrike_animation_apply_hardpoint($event, $hardpoint_id, $hardpoints);
                $compiled[] = raidlands_airstrike_animation_runtime_event(
                    $materialized,
                    (float) $event['Time'],
                    $sequence_index,
                    1
                );
                $sequence_index += 1;
            }
        }

        return $compiled;
    }

    $remaining = $release['maximum_units'];
    $time = $release['start_time'];

    while ($remaining > 0 && $time <= (float) $source['DurationSeconds'] + 0.000000001) {
        $group_count = min($release['units_per_release'], $remaining);

        for ($unit = 0; $unit < $group_count; $unit += 1) {
            $event = $release['template'];
            $hardpoint_id = trim((string) ($event['HardpointId'] ?? $event['Hardpoint'] ?? ''));

            if ($release['hardpoint_sequence'] !== []) {
                $hardpoint_id = (string) $release['hardpoint_sequence'][$hardpoint_index % count($release['hardpoint_sequence'])];
                $hardpoint_index += 1;
            }

            $event = raidlands_airstrike_animation_apply_hardpoint($event, $hardpoint_id, $hardpoints);
            $compiled[] = raidlands_airstrike_animation_runtime_event($event, $time, $sequence_index, 1);
            $sequence_index += 1;
        }

        $remaining -= $group_count;
        $time += $release['interval_seconds'];
    }

    return $compiled;
}

function raidlands_airstrike_animation_legacy_event(array $event, int $fallback_index): array
{
    return raidlands_airstrike_animation_runtime_event(
        $event,
        raidlands_airstrike_animation_number($event['Time'] ?? 0.0),
        raidlands_airstrike_animation_int($event['Index'] ?? $fallback_index, $fallback_index),
        max(1, raidlands_airstrike_animation_int($event['Count'] ?? 1, 1))
    );
}

function raidlands_airstrike_animation_compile_profile(array $source, array $vehicle_metadata = []): array
{
    raidlands_airstrike_animation_assert_valid_profile($source, $vehicle_metadata);
    $waypoints = raidlands_airstrike_animation_normalize_waypoints($source);
    $release = raidlands_airstrike_animation_release_source($source);
    $schedule = raidlands_airstrike_animation_compile_release_schedule($source, $vehicle_metadata);
    $source_projection = raidlands_airstrike_animation_source_hash_projection(
        $source,
        $schedule['resolved_hardpoint_offsets']
    );
    $source_hash = raidlands_airstrike_animation_canonical_sha256($source_projection);
    $first_payload_delay = raidlands_airstrike_animation_number($source['FirstPayloadDelaySeconds'] ?? 0.0);

    if ($release['mode'] === 'manual' && $release['events'] !== []) {
        $first_payload_delay = min(array_map(
            static fn (array $event): float => raidlands_airstrike_animation_number($event['Time'] ?? 0.0),
            $release['events']
        ));
    } elseif ($release['mode'] === 'repeated') {
        $first_payload_delay = min(array_map(
            static fn (array $group): float => (float) $group['start_time'],
            raidlands_airstrike_animation_repeated_groups($release)
        ));
    } elseif ($release['mode'] === 'mixed') {
        $times = array_map(
            static fn (array $event): float => raidlands_airstrike_animation_number($event['Time'] ?? 0.0),
            $release['events']
        );
        foreach (raidlands_airstrike_animation_repeated_groups($release) as $group) {
            $times[] = (float) $group['start_time'];
        }
        if ($times !== []) {
            $first_payload_delay = min($times);
        }
    }

    $runtime = [
        'Vehicle' => (string) $source['Vehicle'],
        'DurationSeconds' => raidlands_airstrike_animation_quantize((float) $source['DurationSeconds']),
        'FirstPayloadDelaySeconds' => raidlands_airstrike_animation_quantize($first_payload_delay),
        'PayloadReleaseMode' => $schedule['legacy_mode'],
        'MaxPayloadCount' => $schedule['legacy_maximum_units'],
        'PayloadReleaseIntervalSeconds' => raidlands_airstrike_animation_quantize($schedule['legacy_interval_seconds']),
        'ReleaseTemplate' => $schedule['legacy_template'],
        'RotationSmoothTimeSeconds' => raidlands_airstrike_animation_quantize(
            raidlands_airstrike_animation_number($source['RotationSmoothTimeSeconds'] ?? 0.12, 0.12)
        ),
        'StopAtWaypoints' => !empty($source['StopAtWaypoints']),
        'MinimumTerrainClearance' => raidlands_airstrike_animation_quantize(
            raidlands_airstrike_animation_number($source['MinimumTerrainClearance'] ?? 55.0, 55.0)
        ),
        'Waypoints' => array_map(
            static fn (array $waypoint): array => raidlands_airstrike_animation_canonical_value($waypoint),
            $waypoints
        ),
        'PayloadEvents' => $schedule['legacy_events'],
        'CompiledTrack' => raidlands_airstrike_animation_compile_track($source, $waypoints, $source_hash),
    ];

    if (!empty($schedule['generated_groups'])) {
        $runtime['GeneratedReleaseGroups'] = $schedule['generated_groups'];
    }

    return raidlands_airstrike_animation_canonical_value($runtime);
}

function raidlands_airstrike_animation_profile_map(array $profiles): array
{
    $map = [];

    foreach ($profiles as $key => $source) {
        if (!is_array($source)) {
            throw new InvalidArgumentException('Profiles must contain source profile objects.');
        }

        $profile_key = raidlands_airstrike_animation_profile_key($source);

        if ($profile_key === '' && is_string($key)) {
            $profile_key = strtolower(trim($key));
            $source['ProfileKey'] = $profile_key;
        }

        if (isset($map[$profile_key])) {
            throw new InvalidArgumentException('Duplicate ProfileKey: ' . $profile_key . '.');
        }

        $map[$profile_key] = $source;
    }

    uksort($map, static fn (string $left, string $right): int => strcmp($left, $right));

    return $map;
}

function raidlands_airstrike_animation_compile_bundle(
    array $profiles,
    int $published_revision,
    bool $allow_dangerous_payload_preview = false,
    array $vehicle_metadata = []
): array {
    $limits = raidlands_airstrike_animation_compiler_limits();
    $profile_map = raidlands_airstrike_animation_profile_map($profiles);

    if (count($profile_map) > (int) $limits['max_profiles']) {
        throw new InvalidArgumentException('Profiles exceeds the configured profile limit.');
    }

    if ($published_revision < 1) {
        throw new InvalidArgumentException('publishedRevision must be a positive integer.');
    }

    $runtime_profiles = [];
    $source_hashes = [];

    foreach ($profile_map as $profile_key => $source) {
        $runtime_profiles[$profile_key] = raidlands_airstrike_animation_compile_profile($source, $vehicle_metadata);
        $source_hashes[$profile_key] = (string) $runtime_profiles[$profile_key]['CompiledTrack']['SourceHash'];
    }

    $bundle = [
        'SchemaVersion' => 3,
        'CompilerVersion' => raidlands_airstrike_animation_compiler_version(),
        'PublishedRevision' => $published_revision,
        'AllowDangerousPayloadPreview' => $allow_dangerous_payload_preview,
        'Profiles' => $runtime_profiles === [] ? new stdClass() : $runtime_profiles,
    ];
    $canonical_json = raidlands_airstrike_animation_canonical_json($bundle);

    if (strlen($canonical_json) > (int) $limits['max_bundle_bytes']) {
        throw new InvalidArgumentException('Canonical animation bundle exceeds the configured byte limit.');
    }

    return [
        'bundle' => raidlands_airstrike_animation_canonical_value($bundle),
        'canonical_json' => $canonical_json,
        'sha256' => hash('sha256', $canonical_json),
        'source_hashes' => $source_hashes,
    ];
}
