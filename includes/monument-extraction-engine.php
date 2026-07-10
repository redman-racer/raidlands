<?php

/**
 * Pure Monument Extraction domain engine.
 *
 * No session, HTTP, database, or wallet calls belong in this file. Production
 * services and the simulator both invoke these functions.
 */

function raidlands_monument_default_config_path(): string
{
    return dirname(__DIR__) . '/data/monument-extraction-default.json';
}

function raidlands_monument_default_config(): array
{
    static $config = null;

    if (is_array($config)) {
        return $config;
    }

    $json = file_get_contents(raidlands_monument_default_config_path());
    $decoded = is_string($json) ? json_decode($json, true) : null;

    if (!is_array($decoded)) {
        throw new RuntimeException('Monument Extraction default configuration is invalid JSON.');
    }

    raidlands_monument_validate_config($decoded);
    $config = $decoded;

    return $config;
}

function raidlands_monument_validate_config(array $config): void
{
    $required_scalars = [
        'schemaVersion', 'minWagerRp', 'maxWagerRp', 'maxPayoutRp',
        'activeRunTtlMinutes', 'minChanceBps', 'maxChanceBps',
        'armorReduction', 'syringeHealing', 'ammoBoxAmmo',
    ];

    foreach ($required_scalars as $key) {
        if (!isset($config[$key]) || !is_numeric($config[$key])) {
            throw new InvalidArgumentException('Monument configuration is missing numeric field ' . $key . '.');
        }
    }

    foreach (['loadouts', 'approaches', 'roomArchetypes', 'encounters', 'items', 'extractions', 'mapGeneration'] as $key) {
        if (!isset($config[$key]) || !is_array($config[$key])) {
            throw new InvalidArgumentException('Monument configuration is missing object ' . $key . '.');
        }
    }

    if (count($config['loadouts']) < 3) {
        throw new InvalidArgumentException('Monument configuration requires at least three loadouts.');
    }

    foreach (['scout', 'enforcer', 'scavenger'] as $key) {
        if (!isset($config['loadouts'][$key])) {
            throw new InvalidArgumentException('Monument configuration requires loadout ' . $key . '.');
        }
    }

    foreach (['sneak', 'controlled_assault', 'rush', 'retreat'] as $key) {
        if (!isset($config['approaches'][$key])) {
            throw new InvalidArgumentException('Monument configuration requires approach ' . $key . '.');
        }
    }

    if (count($config['roomArchetypes']) < 8 || count($config['encounters']) < 12) {
        throw new InvalidArgumentException('Monument configuration requires eight room archetypes and twelve encounters.');
    }

    foreach (['main_gate', 'sewer', 'rooftop'] as $key) {
        if (!isset($config['extractions'][$key])) {
            throw new InvalidArgumentException('Monument configuration requires extraction ' . $key . '.');
        }
    }

    $min_wager = (int) $config['minWagerRp'];
    $max_wager = (int) $config['maxWagerRp'];
    $min_chance = (int) $config['minChanceBps'];
    $max_chance = (int) $config['maxChanceBps'];

    if ($min_wager < 1 || $max_wager < $min_wager || $min_chance < 0 || $max_chance > 10000 || $max_chance < $min_chance) {
        throw new InvalidArgumentException('Monument configuration limits are inconsistent.');
    }

    $layer_counts = $config['mapGeneration']['layerCounts'] ?? null;

    if (!is_array($layer_counts) || count($layer_counts) !== 6 || (int) ($layer_counts[0] ?? 0) !== 1) {
        throw new InvalidArgumentException('Monument mapGeneration.layerCounts must define six layers beginning with one entrance.');
    }

    foreach ($config['roomArchetypes'] as $archetype_key => $archetype) {
        if (!is_array($archetype) || empty($archetype['label']) || empty($archetype['encounters']) || !is_array($archetype['encounters'])) {
            throw new InvalidArgumentException('Monument room archetype ' . $archetype_key . ' is invalid.');
        }

        foreach ($archetype['encounters'] as $encounter_key) {
            if (!isset($config['encounters'][$encounter_key])) {
                throw new InvalidArgumentException('Monument archetype ' . $archetype_key . ' references unknown encounter ' . $encounter_key . '.');
            }
        }
    }

    foreach ($config['encounters'] as $encounter_key => $encounter) {
        if (!is_array($encounter) || !isset($encounter['baseChanceBps'], $encounter['damage'], $encounter['loot'])) {
            throw new InvalidArgumentException('Monument encounter ' . $encounter_key . ' is invalid.');
        }

        foreach ((array) $encounter['loot'] as $item_key) {
            if (!isset($config['items'][$item_key])) {
                throw new InvalidArgumentException('Monument encounter ' . $encounter_key . ' references unknown item ' . $item_key . '.');
            }
        }
    }
}

function raidlands_monument_rng_draw(array &$state, string $server_seed, string $purpose, int $min, int $max): int
{
    if ($max < $min) {
        throw new InvalidArgumentException('Random draw maximum must be greater than or equal to its minimum.');
    }

    $counter = (int) ($state['drawCounter'] ?? 0);
    $range = ($max - $min) + 1;
    $limit = intdiv(4294967296, $range) * $range;
    $attempt = 0;
    $value = null;

    while ($value === null) {
        $message = (string) $state['runId'] . ':' . $counter . ':' . $purpose . ':' . $attempt;
        $bytes = hash_hmac('sha256', $message, $server_seed, true);

        for ($offset = 0; $offset <= 28; $offset += 4) {
            $candidate = unpack('Nvalue', substr($bytes, $offset, 4));
            $unsigned = (int) ($candidate['value'] ?? 0);

            if ($unsigned < $limit) {
                $value = $min + ($unsigned % $range);
                break;
            }
        }

        $attempt += 1;

        if ($attempt > 32) {
            throw new RuntimeException('Could not derive an unbiased Monument Extraction random draw.');
        }
    }

    $state['drawCounter'] = $counter + 1;
    $state['draws'][] = [
        'counter' => $counter,
        'purpose' => $purpose,
        'min' => $min,
        'max' => $max,
        'value' => $value,
    ];

    return $value;
}

function raidlands_monument_verify_draw(string $run_id, string $server_seed, array $draw): bool
{
    $state = ['runId' => $run_id, 'drawCounter' => (int) ($draw['counter'] ?? 0), 'draws' => []];
    $value = raidlands_monument_rng_draw(
        $state,
        $server_seed,
        (string) ($draw['purpose'] ?? ''),
        (int) ($draw['min'] ?? 0),
        (int) ($draw['max'] ?? 0)
    );

    return $value === (int) ($draw['value'] ?? PHP_INT_MIN);
}

function raidlands_monument_engine_new(string $run_id, int $wager_rp, string $loadout_key, array $config, string $server_seed): array
{
    raidlands_monument_validate_config($config);

    if (!isset($config['loadouts'][$loadout_key])) {
        throw new InvalidArgumentException('Choose a valid Monument Extraction loadout.');
    }

    $loadout = $config['loadouts'][$loadout_key];
    $state = [
        'runId' => $run_id,
        'status' => 'AWAITING_ROOM_SELECTION',
        'turn' => 0,
        'drawCounter' => 0,
        'draws' => [],
        'wagerRp' => $wager_rp,
        'payoutRp' => 0,
        'payoutMultiplierBps' => 0,
        'loadoutKey' => $loadout_key,
        'health' => (int) $loadout['health'],
        'ammo' => (int) $loadout['ammo'],
        'syringes' => (int) $loadout['syringes'],
        'armor' => (int) $loadout['armor'],
        'alert' => 0,
        'inventoryCapacity' => (int) $loadout['slots'],
        'intel' => 0,
        'autoUseArmor' => true,
        'inventory' => [],
        'pendingLoot' => null,
        'currentRoomId' => 'd0-r0',
        'previousRoomId' => null,
        'visited' => ['d0-r0' => true],
        'flags' => ['powerRestored' => false],
        'eventLog' => [[
            'turn' => 0,
            'type' => 'run_started',
            'message' => 'Entered the monument as ' . (string) $loadout['label'] . '.',
        ]],
    ];

    $state['map'] = raidlands_monument_generate_map($state, $config, $server_seed);

    return $state;
}

function raidlands_monument_generate_map(array &$state, array $config, string $server_seed): array
{
    $counts = array_map('intval', (array) $config['mapGeneration']['layerCounts']);
    $rooms = [];
    $edges = [];
    $archetype_keys = array_values(array_filter(
        array_keys($config['roomArchetypes']),
        static fn (string $key): bool => $key !== 'rooftop'
    ));

    for ($depth = 0; $depth < count($counts); $depth += 1) {
        for ($index = 0; $index < $counts[$depth]; $index += 1) {
            $room_id = 'd' . $depth . '-r' . $index;

            if ($depth === 0) {
                $rooms[$room_id] = [
                    'id' => $room_id,
                    'depth' => 0,
                    'archetype' => 'entrance',
                    'label' => 'Entrance',
                    'danger' => 'Safe',
                    'rewardHint' => 'Route planning',
                    'encounterKey' => '',
                    'revealed' => true,
                    'resolved' => true,
                    'blocked' => false,
                ];
                continue;
            }

            if ($depth === 5) {
                $archetype_key = 'rooftop';
            } elseif ($depth === 1 && $index === 0) {
                $archetype_key = 'storage';
            } elseif ($depth === 2 && $index === 0) {
                $archetype_key = 'medical';
            } else {
                $choice = raidlands_monument_rng_draw(
                    $state,
                    $server_seed,
                    'map:archetype:' . $room_id,
                    0,
                    count($archetype_keys) - 1
                );
                $archetype_key = $archetype_keys[$choice];
            }

            $archetype = $config['roomArchetypes'][$archetype_key];
            $encounters = array_values((array) $archetype['encounters']);
            $encounter_index = raidlands_monument_rng_draw(
                $state,
                $server_seed,
                'map:encounter:' . $room_id,
                0,
                count($encounters) - 1
            );

            $rooms[$room_id] = [
                'id' => $room_id,
                'depth' => $depth,
                'archetype' => $archetype_key,
                'label' => (string) $archetype['label'],
                'danger' => (string) $archetype['danger'],
                'rewardHint' => (string) $archetype['rewardHint'],
                'encounterKey' => (string) $encounters[$encounter_index],
                'revealed' => false,
                'resolved' => false,
                'blocked' => false,
            ];
        }
    }

    for ($depth = 0; $depth < count($counts) - 1; $depth += 1) {
        $from_count = $counts[$depth];
        $to_count = $counts[$depth + 1];

        for ($to = 0; $to < $to_count; $to += 1) {
            $from = $to % $from_count;
            $edges[] = ['from' => 'd' . $depth . '-r' . $from, 'to' => 'd' . ($depth + 1) . '-r' . $to];
        }

        for ($from = 0; $from < $from_count; $from += 1) {
            $has_edge = false;

            foreach ($edges as $edge) {
                if ($edge['from'] === 'd' . $depth . '-r' . $from) {
                    $has_edge = true;
                    break;
                }
            }

            if (!$has_edge) {
                $to = raidlands_monument_rng_draw($state, $server_seed, 'map:edge:' . $depth . ':' . $from, 0, $to_count - 1);
                $edges[] = ['from' => 'd' . $depth . '-r' . $from, 'to' => 'd' . ($depth + 1) . '-r' . $to];
            }

            if ($to_count > 1) {
                $extra = raidlands_monument_rng_draw($state, $server_seed, 'map:extra-edge:' . $depth . ':' . $from, 0, 99);

                if ($extra < 58) {
                    $to = raidlands_monument_rng_draw($state, $server_seed, 'map:extra-target:' . $depth . ':' . $from, 0, $to_count - 1);
                    $candidate = ['from' => 'd' . $depth . '-r' . $from, 'to' => 'd' . ($depth + 1) . '-r' . $to];

                    if (!in_array($candidate, $edges, true)) {
                        $edges[] = $candidate;
                    }
                }
            }
        }
    }

    return ['rooms' => $rooms, 'edges' => $edges];
}

function raidlands_monument_adjacent_room_ids(array $state): array
{
    $current = (string) ($state['currentRoomId'] ?? '');
    $ids = [];

    foreach ((array) ($state['map']['edges'] ?? []) as $edge) {
        if ((string) ($edge['from'] ?? '') !== $current) {
            continue;
        }

        $room_id = (string) ($edge['to'] ?? '');
        $room = $state['map']['rooms'][$room_id] ?? null;

        if (is_array($room) && empty($room['resolved']) && empty($room['blocked'])) {
            $ids[] = $room_id;
        }
    }

    return array_values(array_unique($ids));
}

function raidlands_monument_inventory_slots(array $state): int
{
    return array_sum(array_map(
        static fn (array $item): int => max(0, (int) ($item['slots'] ?? 0)),
        (array) ($state['inventory'] ?? [])
    ));
}

function raidlands_monument_has_item(array $state, string $item_key): bool
{
    foreach ((array) ($state['inventory'] ?? []) as $item) {
        if ((string) ($item['key'] ?? '') === $item_key) {
            return true;
        }
    }

    return false;
}

function raidlands_monument_current_room(array $state): array
{
    $room_id = (string) ($state['currentRoomId'] ?? '');
    $room = $state['map']['rooms'][$room_id] ?? null;

    if (!is_array($room)) {
        throw new RuntimeException('The Monument Extraction run has no current room.');
    }

    return $room;
}

function raidlands_monument_chance(array $state, array $config, string $approach_key): int
{
    $room = raidlands_monument_current_room($state);
    $encounter = $config['encounters'][(string) ($room['encounterKey'] ?? '')] ?? null;
    $approach = $config['approaches'][$approach_key] ?? null;

    if (!is_array($encounter) || !is_array($approach)) {
        throw new InvalidArgumentException('That encounter approach is unavailable.');
    }

    if ($approach_key === 'retreat') {
        return max((int) $config['minChanceBps'], min((int) $config['maxChanceBps'], (int) $approach['chanceBps']));
    }

    $chance = (int) $encounter['baseChanceBps'] + (int) $approach['chanceBps'];

    if ((string) ($state['loadoutKey'] ?? '') === 'enforcer' && $approach_key === 'controlled_assault') {
        $chance += 500;
    }

    if (raidlands_monument_has_item($state, 'blue_keycard') && in_array((string) ($room['archetype'] ?? ''), ['security', 'armory', 'vault'], true)) {
        $chance += 500;
    }

    if (!empty($state['flags']['powerRestored']) && (string) ($room['archetype'] ?? '') === 'vault') {
        $chance += 400;
    }

    $chance -= max(0, (int) ($state['alert'] ?? 0) - 2) * 200;

    if ((int) ($state['alert'] ?? 0) >= 7 && $approach_key === 'sneak') {
        $chance -= 600;
    }

    if ((int) ($state['health'] ?? 0) < (int) $config['lowHealthThreshold']) {
        $chance -= (int) $config['lowHealthPenaltyBps'];
    }

    return max((int) $config['minChanceBps'], min((int) $config['maxChanceBps'], $chance));
}

function raidlands_monument_approaches(array $state, array $config): array
{
    if ((string) ($state['status'] ?? '') !== 'AWAITING_ENCOUNTER_ACTION') {
        return [];
    }

    $choices = [];

    foreach ($config['approaches'] as $key => $approach) {
        $ammo_cost = max(0, (int) ($approach['ammoCost'] ?? 0));
        $choices[] = [
            'key' => (string) $key,
            'label' => (string) ($approach['label'] ?? $key),
            'chanceBps' => raidlands_monument_chance($state, $config, (string) $key),
            'ammoCost' => $ammo_cost,
            'successAlert' => (int) ($approach['successAlert'] ?? 0),
            'failureAlert' => (int) ($approach['failureAlert'] ?? 0),
            'available' => (int) ($state['ammo'] ?? 0) >= $ammo_cost,
        ];
    }

    return $choices;
}

function raidlands_monument_extractions(array $state, array $config): array
{
    $room = raidlands_monument_current_room($state);
    $depth = (int) ($room['depth'] ?? 0);
    $alert_penalty = max(0, (int) ($state['alert'] ?? 0) - 2) * 200;
    $low_health_penalty = (int) ($state['health'] ?? 0) < (int) $config['lowHealthThreshold']
        ? (int) $config['lowHealthPenaltyBps']
        : 0;
    $routes = [];

    foreach ($config['extractions'] as $key => $route) {
        $available = $depth >= (int) ($route['minDepth'] ?? 0);
        $reason = '';

        if ($key === 'sewer' && !raidlands_monument_has_item($state, 'fuse') && empty($state['flags']['powerRestored'])) {
            $available = false;
            $reason = 'Find a fuse or restore generator power.';
        }

        if ($key === 'rooftop' && ((string) ($room['archetype'] ?? '') !== 'rooftop' || !raidlands_monument_has_item($state, 'signal_beacon'))) {
            $available = false;
            $reason = 'Reach the rooftop with a signal beacon.';
        }

        if ($depth < (int) ($route['minDepth'] ?? 0)) {
            $reason = 'Push deeper before this route opens.';
        }

        $penalty = $key === 'sewer' ? intdiv($alert_penalty, 2) : $alert_penalty;

        if ($key === 'rooftop' && (int) ($state['alert'] ?? 0) >= 8) {
            $penalty += 1000;
        }

        $chance = max(
            (int) $config['minChanceBps'],
            min((int) $config['maxChanceBps'], (int) $route['chanceBps'] - $penalty - $low_health_penalty)
        );
        $routes[] = [
            'key' => (string) $key,
            'label' => (string) $route['label'],
            'description' => (string) $route['description'],
            'chanceBps' => $chance,
            'modifierBps' => (int) $route['modifierBps'],
            'available' => $available,
            'reason' => $reason,
        ];
    }

    return $routes;
}

function raidlands_monument_payout_multiplier_bps(array $state): int
{
    $total = 0;

    foreach ((array) ($state['inventory'] ?? []) as $item) {
        if ((string) ($item['category'] ?? '') === 'PAYOUT_LOOT') {
            $total += max(0, (int) ($item['valueBps'] ?? 0));
        }
    }

    return $total;
}

function raidlands_monument_public_state(array $state, array $config, bool $terminal = false, string $server_seed = ''): array
{
    $adjacent = raidlands_monument_adjacent_room_ids($state);
    $rooms = [];

    foreach ((array) ($state['map']['rooms'] ?? []) as $room_id => $room) {
        $visited = !empty($state['visited'][$room_id]);
        $is_adjacent = in_array($room_id, $adjacent, true);
        $scout_intel = (string) ($state['loadoutKey'] ?? '') === 'scout' && (string) $room_id === 'd' . (int) ($room['depth'] ?? 0) . '-r0';
        $known = $visited || $is_adjacent || $scout_intel || (int) ($room['depth'] ?? 0) === 0;
        $rooms[] = [
            'id' => (string) $room_id,
            'depth' => (int) ($room['depth'] ?? 0),
            'label' => $known ? (string) ($room['label'] ?? 'Unknown Sector') : 'Unknown Sector',
            'archetype' => $known ? (string) ($room['archetype'] ?? 'unknown') : 'unknown',
            'danger' => $known ? (string) ($room['danger'] ?? 'Unknown') : 'Unknown',
            'rewardHint' => $known ? (string) ($room['rewardHint'] ?? 'Unknown') : 'Unknown',
            'current' => (string) ($state['currentRoomId'] ?? '') === (string) $room_id,
            'adjacent' => $is_adjacent,
            'visited' => $visited,
            'resolved' => !empty($room['resolved']),
            'blocked' => !empty($room['blocked']),
        ];
    }

    $current = raidlands_monument_current_room($state);
    $encounter = null;

    if ((string) ($state['status'] ?? '') === 'AWAITING_ENCOUNTER_ACTION') {
        $definition = $config['encounters'][(string) ($current['encounterKey'] ?? '')] ?? [];
        $encounter = [
            'name' => (string) ($definition['name'] ?? 'Unknown threat'),
            'description' => (string) ($definition['description'] ?? ''),
            'danger' => (string) ($current['danger'] ?? 'Unknown'),
            'approaches' => raidlands_monument_approaches($state, $config),
        ];
    }

    $inventory = array_values(array_map(
        static fn (array $item): array => [
            'id' => (string) ($item['id'] ?? ''),
            'key' => (string) ($item['key'] ?? ''),
            'label' => (string) ($item['label'] ?? ''),
            'category' => (string) ($item['category'] ?? ''),
            'rarity' => (string) ($item['rarity'] ?? ''),
            'slots' => (int) ($item['slots'] ?? 0),
            'valueBps' => (int) ($item['valueBps'] ?? 0),
        ],
        (array) ($state['inventory'] ?? [])
    ));
    $public = [
        'id' => (string) $state['runId'],
        'status' => (string) $state['status'],
        'turn' => (int) $state['turn'],
        'wagerRp' => (int) $state['wagerRp'],
        'payoutRp' => (int) ($state['payoutRp'] ?? 0),
        'payoutMultiplierBps' => (int) ($state['payoutMultiplierBps'] ?? raidlands_monument_payout_multiplier_bps($state)),
        'carriedMultiplierBps' => raidlands_monument_payout_multiplier_bps($state),
        'loadoutKey' => (string) $state['loadoutKey'],
        'loadout' => $config['loadouts'][(string) $state['loadoutKey']],
        'resources' => [
            'health' => (int) $state['health'],
            'ammo' => (int) $state['ammo'],
            'syringes' => (int) $state['syringes'],
            'armor' => (int) $state['armor'],
            'alert' => (int) $state['alert'],
            'intel' => (int) $state['intel'],
            'autoUseArmor' => !empty($state['autoUseArmor']),
        ],
        'inventory' => $inventory,
        'inventorySlotsUsed' => raidlands_monument_inventory_slots($state),
        'inventoryCapacity' => (int) $state['inventoryCapacity'],
        'pendingLoot' => is_array($state['pendingLoot'] ?? null) ? $state['pendingLoot'] : null,
        'currentRoom' => [
            'id' => (string) $current['id'],
            'depth' => (int) $current['depth'],
            'label' => (string) $current['label'],
            'archetype' => (string) $current['archetype'],
            'danger' => (string) $current['danger'],
        ],
        'map' => ['rooms' => $rooms, 'edges' => array_values((array) ($state['map']['edges'] ?? []))],
        'adjacentRoomIds' => $adjacent,
        'encounter' => $encounter,
        'extractions' => raidlands_monument_extractions($state, $config),
        'eventLog' => array_values(array_slice((array) ($state['eventLog'] ?? []), -20)),
        'terminal' => $terminal,
    ];

    if ($terminal && $server_seed !== '') {
        $public['fairness'] = [
            'serverSeed' => $server_seed,
            'draws' => array_values((array) ($state['draws'] ?? [])),
            'verified' => hash('sha256', $server_seed),
        ];
    }

    return $public;
}

function raidlands_monument_engine_apply(array $state, array $command, array $config, string $server_seed): array
{
    $type = strtolower(trim((string) ($command['type'] ?? '')));
    $terminal = ['COMPLETED', 'FAILED', 'ABANDONED', 'EXPIRED'];

    if (in_array((string) ($state['status'] ?? ''), $terminal, true)) {
        throw new RuntimeException('That Monument Extraction run is already over.');
    }

    $state['turn'] = (int) ($state['turn'] ?? 0) + 1;
    $draw_start = (int) ($state['drawCounter'] ?? 0);
    $result = ['type' => $type];

    if ($type === 'enter_room') {
        $result = raidlands_monument_engine_enter_room($state, $command, $config);
    } elseif ($type === 'resolve_encounter') {
        $result = raidlands_monument_engine_resolve_encounter($state, $command, $config, $server_seed);
    } elseif ($type === 'loot_decision') {
        $result = raidlands_monument_engine_loot_decision($state, $command);
    } elseif ($type === 'inventory_action') {
        $result = raidlands_monument_engine_inventory_action($state, $command, $config);
    } elseif ($type === 'extract') {
        $result = raidlands_monument_engine_extract($state, $command, $config, $server_seed);
    } elseif ($type === 'abandon') {
        $state['status'] = 'ABANDONED';
        $state['failureReason'] = 'PLAYER_ABANDONED';
        raidlands_monument_add_event($state, 'abandoned', 'Run abandoned. Unsecured loot was forfeited.');
        $result = ['type' => 'abandon', 'terminal' => true, 'won' => false];
    } else {
        throw new InvalidArgumentException('Unknown Monument Extraction action.');
    }

    return [
        'state' => $state,
        'result' => $result,
        'randomDrawStart' => $draw_start,
        'randomDrawEnd' => (int) ($state['drawCounter'] ?? 0),
    ];
}

function raidlands_monument_engine_enter_room(array &$state, array $command, array $config): array
{
    if ((string) $state['status'] !== 'AWAITING_ROOM_SELECTION') {
        throw new RuntimeException('Choose a room only when route selection is active.');
    }

    $room_id = trim((string) ($command['roomId'] ?? ''));

    if (!in_array($room_id, raidlands_monument_adjacent_room_ids($state), true)) {
        throw new RuntimeException('That room is not a legal adjacent route.');
    }

    $state['previousRoomId'] = (string) $state['currentRoomId'];
    $state['currentRoomId'] = $room_id;
    $state['visited'][$room_id] = true;
    $state['map']['rooms'][$room_id]['revealed'] = true;
    $state['status'] = 'AWAITING_ENCOUNTER_ACTION';
    $room = $state['map']['rooms'][$room_id];
    $encounter = $config['encounters'][(string) $room['encounterKey']];
    raidlands_monument_add_event($state, 'room_entered', 'Entered ' . (string) $room['label'] . ': ' . (string) $encounter['name'] . '.');

    return ['type' => 'enter_room', 'roomId' => $room_id, 'roomLabel' => (string) $room['label']];
}

function raidlands_monument_engine_resolve_encounter(array &$state, array $command, array $config, string $server_seed): array
{
    if ((string) $state['status'] !== 'AWAITING_ENCOUNTER_ACTION') {
        throw new RuntimeException('There is no encounter waiting for a tactic.');
    }

    $approach_key = strtolower(trim((string) ($command['approachKey'] ?? '')));
    $approach = $config['approaches'][$approach_key] ?? null;

    if (!is_array($approach)) {
        throw new InvalidArgumentException('Choose a valid encounter approach.');
    }

    $ammo_cost = max(0, (int) ($approach['ammoCost'] ?? 0));

    if ((int) $state['ammo'] < $ammo_cost) {
        throw new RuntimeException('You do not have enough ammo for that approach.');
    }

    $room = raidlands_monument_current_room($state);
    $encounter = $config['encounters'][(string) $room['encounterKey']];
    $chance = raidlands_monument_chance($state, $config, $approach_key);
    $roll = raidlands_monument_rng_draw($state, $server_seed, 'encounter:' . (string) $room['id'] . ':' . $approach_key, 0, 9999);
    $success = $roll < $chance;
    $state['ammo'] = max(0, (int) $state['ammo'] - $ammo_cost);
    $damage = 0;
    $raw_damage = 0;
    $armor_used = false;

    if ($approach_key === 'retreat') {
        if (!$success) {
            $damage_range = (array) $encounter['damage'];
            $raw_damage = raidlands_monument_rng_draw($state, $server_seed, 'retreat-damage:' . (string) $room['id'], 1, max(1, (int) ceil((int) $damage_range[1] * 0.4)));
            [$damage, $armor_used] = raidlands_monument_apply_damage($state, $raw_damage, $config);
        }

        $state['map']['rooms'][(string) $room['id']]['resolved'] = true;
        $state['map']['rooms'][(string) $room['id']]['blocked'] = true;
        $state['currentRoomId'] = (string) ($state['previousRoomId'] ?? 'd0-r0');
        $state['status'] = (int) $state['health'] <= 0 ? 'FAILED' : 'AWAITING_ROOM_SELECTION';

        if ((int) $state['health'] <= 0) {
            $state['failureReason'] = 'ENCOUNTER_DEATH';
        }

        raidlands_monument_add_event($state, $success ? 'retreat_success' : 'retreat_failure', $success ? 'Retreated safely; that route is now blocked.' : 'Retreated under fire and took ' . $damage . ' damage.');

        return [
            'type' => 'resolve_encounter',
            'approachKey' => $approach_key,
            'success' => $success,
            'won' => false,
            'chanceBps' => $chance,
            'roll' => $roll,
            'rawDamage' => $raw_damage,
            'damage' => $damage,
            'armorUsed' => $armor_used,
        ];
    }

    $state['alert'] = min((int) $config['maxAlert'], max(0, (int) $state['alert'] + (int) $approach[$success ? 'successAlert' : 'failureAlert']));

    if (!$success) {
        $damage_range = array_map('intval', (array) $encounter['damage']);
        $raw_damage = raidlands_monument_rng_draw($state, $server_seed, 'encounter-damage:' . (string) $room['id'], $damage_range[0], $damage_range[1]);
        $raw_damage = max(1, (int) floor($raw_damage * ((int) $approach['damageScaleBps'] / 10000)));
        [$damage, $armor_used] = raidlands_monument_apply_damage($state, $raw_damage, $config);
    }

    $state['map']['rooms'][(string) $room['id']]['resolved'] = true;

    if ((int) $state['health'] <= 0) {
        $state['status'] = 'FAILED';
        $state['failureReason'] = 'ENCOUNTER_DEATH';
        raidlands_monument_add_event($state, 'encounter_death', 'The ' . (string) $encounter['name'] . ' ended the run.');
    } elseif ($success) {
        if ((string) $room['archetype'] === 'generator') {
            $state['flags']['powerRestored'] = true;
        }

        $loot_keys = array_values((array) $encounter['loot']);
        $loot_index = raidlands_monument_rng_draw($state, $server_seed, 'encounter-loot:' . (string) $room['id'], 0, count($loot_keys) - 1);

        if ((int) $state['alert'] >= 5 && $approach_key === 'rush') {
            $loot_index = min(count($loot_keys) - 1, $loot_index + 1);
        }

        $item_key = (string) $loot_keys[$loot_index];
        $item = raidlands_monument_build_item($state, $config, $item_key, (int) $approach['lootValueBps']);

        if ((string) $item['category'] === 'INTEL') {
            $state['intel'] = min(3, (int) $state['intel'] + 1);
            $state['status'] = (int) $state['alert'] >= (int) $config['maxAlert'] ? 'AWAITING_EXTRACTION_DECISION' : 'AWAITING_ROOM_SELECTION';
            raidlands_monument_add_event($state, 'intel_acquired', 'Secured an Intel Fragment.');
        } else {
            $state['pendingLoot'] = $item;
            $state['status'] = 'AWAITING_LOOT_DECISION';
            raidlands_monument_add_event($state, 'encounter_success', 'Cleared ' . (string) $encounter['name'] . ' and found ' . (string) $item['label'] . '.');
        }
    } else {
        $state['status'] = (int) $state['alert'] >= (int) $config['maxAlert'] ? 'AWAITING_EXTRACTION_DECISION' : 'AWAITING_ROOM_SELECTION';
        raidlands_monument_add_event($state, 'encounter_failure', 'Failed ' . (string) $encounter['name'] . ' and took ' . $damage . ' damage.');
    }

    return [
        'type' => 'resolve_encounter',
        'approachKey' => $approach_key,
        'success' => $success,
        'won' => false,
        'chanceBps' => $chance,
        'roll' => $roll,
        'rawDamage' => $raw_damage,
        'damage' => $damage,
        'armorUsed' => $armor_used,
        'terminal' => (string) $state['status'] === 'FAILED',
        'loot' => is_array($state['pendingLoot']) ? $state['pendingLoot'] : null,
    ];
}

function raidlands_monument_apply_damage(array &$state, int $raw_damage, array $config): array
{
    $damage = max(0, $raw_damage);
    $armor_used = false;

    if ($damage > 0 && !empty($state['autoUseArmor']) && (int) ($state['armor'] ?? 0) > 0) {
        $damage = max(0, $damage - (int) $config['armorReduction']);
        $state['armor'] = max(0, (int) $state['armor'] - 1);
        $armor_used = true;
    }

    $state['health'] = max(0, min((int) $config['maxHealth'], (int) $state['health'] - $damage));

    return [$damage, $armor_used];
}

function raidlands_monument_build_item(array $state, array $config, string $item_key, int $loot_value_modifier_bps = 10000): array
{
    $definition = $config['items'][$item_key] ?? null;

    if (!is_array($definition)) {
        throw new RuntimeException('Encounter generated an unknown Monument Extraction item.');
    }

    $value = max(0, (int) ($definition['valueBps'] ?? 0));

    if ((string) ($definition['category'] ?? '') === 'PAYOUT_LOOT') {
        $value = (int) floor($value * ($loot_value_modifier_bps / 10000));

        if ((string) ($state['loadoutKey'] ?? '') === 'scavenger' && in_array((string) ($definition['rarity'] ?? ''), ['common', 'uncommon'], true)) {
            $value = (int) floor($value * 1.1);
        }
    }

    return [
        'id' => 'item-' . (int) ($state['turn'] ?? 0) . '-' . (int) ($state['drawCounter'] ?? 0),
        'key' => $item_key,
        'label' => (string) $definition['label'],
        'category' => (string) $definition['category'],
        'rarity' => (string) $definition['rarity'],
        'slots' => max(0, (int) $definition['slots']),
        'valueBps' => $value,
    ];
}

function raidlands_monument_engine_loot_decision(array &$state, array $command): array
{
    if ((string) $state['status'] !== 'AWAITING_LOOT_DECISION' || !is_array($state['pendingLoot'] ?? null)) {
        throw new RuntimeException('There is no pending loot decision.');
    }

    $decision = strtolower(trim((string) ($command['decision'] ?? '')));
    $pending = $state['pendingLoot'];

    if (!in_array($decision, ['take', 'leave'], true)) {
        throw new InvalidArgumentException('Choose to take or leave the pending item.');
    }

    $discard_ids = array_values(array_unique(array_map('strval', (array) ($command['discardItemIds'] ?? []))));

    if ($decision === 'take') {
        $kept = [];

        foreach ((array) $state['inventory'] as $item) {
            if (!in_array((string) ($item['id'] ?? ''), $discard_ids, true)) {
                $kept[] = $item;
            }
        }

        $used = array_sum(array_map(static fn (array $item): int => (int) ($item['slots'] ?? 0), $kept));

        if ($used + (int) $pending['slots'] > (int) $state['inventoryCapacity']) {
            throw new RuntimeException('That item does not fit. Select enough carried items to replace.');
        }

        $kept[] = $pending;
        $state['inventory'] = $kept;
        raidlands_monument_add_event($state, 'loot_taken', 'Packed ' . (string) $pending['label'] . '.');
    } else {
        raidlands_monument_add_event($state, 'loot_left', 'Left ' . (string) $pending['label'] . ' behind.');
    }

    $state['pendingLoot'] = null;
    $state['status'] = (int) $state['alert'] >= 10 ? 'AWAITING_EXTRACTION_DECISION' : 'AWAITING_ROOM_SELECTION';

    return ['type' => 'loot_decision', 'decision' => $decision, 'item' => $pending];
}

function raidlands_monument_engine_inventory_action(array &$state, array $command, array $config): array
{
    if (!in_array((string) $state['status'], ['AWAITING_ROOM_SELECTION', 'AWAITING_EXTRACTION_DECISION'], true)) {
        throw new RuntimeException('Inventory actions are allowed only between encounters.');
    }

    $action = strtolower(trim((string) ($command['inventoryAction'] ?? '')));

    if ($action === 'use_syringe') {
        if ((int) $state['syringes'] <= 0) {
            throw new RuntimeException('You have no medical syringes.');
        }

        if ((int) $state['health'] >= (int) $config['maxHealth']) {
            throw new RuntimeException('Health is already full.');
        }

        $before = (int) $state['health'];
        $state['syringes'] -= 1;
        $state['health'] = min((int) $config['maxHealth'], $before + (int) $config['syringeHealing']);
        raidlands_monument_add_event($state, 'healed', 'Used a syringe and restored ' . ((int) $state['health'] - $before) . ' health.');

        return ['type' => 'inventory_action', 'inventoryAction' => $action, 'healed' => (int) $state['health'] - $before];
    }

    if ($action === 'toggle_auto_armor') {
        $state['autoUseArmor'] = !empty($command['enabled']);
        raidlands_monument_add_event($state, 'armor_setting', 'Automatic armor use ' . ($state['autoUseArmor'] ? 'enabled.' : 'disabled.'));

        return ['type' => 'inventory_action', 'inventoryAction' => $action, 'enabled' => $state['autoUseArmor']];
    }

    $item_id = trim((string) ($command['itemId'] ?? ''));
    $found = null;
    $kept = [];

    foreach ((array) $state['inventory'] as $item) {
        if ((string) ($item['id'] ?? '') === $item_id && $found === null) {
            $found = $item;
        } else {
            $kept[] = $item;
        }
    }

    if (!is_array($found)) {
        throw new RuntimeException('That carried item was not found.');
    }

    if ($action === 'discard') {
        $state['inventory'] = $kept;
        raidlands_monument_add_event($state, 'item_discarded', 'Discarded ' . (string) $found['label'] . '.');

        return ['type' => 'inventory_action', 'inventoryAction' => $action, 'item' => $found];
    }

    if ($action !== 'use_item') {
        throw new InvalidArgumentException('Choose a valid inventory action.');
    }

    if ((string) $found['key'] === 'ammo_box') {
        $state['ammo'] = min((int) $config['maxAmmo'], (int) $state['ammo'] + (int) $config['ammoBoxAmmo']);
    } elseif ((string) $found['key'] === 'medical_syringe') {
        $state['health'] = min((int) $config['maxHealth'], (int) $state['health'] + (int) $config['syringeHealing']);
    } elseif ((string) $found['key'] === 'armor_plate') {
        $state['armor'] = min(3, (int) $state['armor'] + 1);
    } else {
        throw new RuntimeException('That item is not consumable.');
    }

    $state['inventory'] = $kept;
    raidlands_monument_add_event($state, 'item_used', 'Used ' . (string) $found['label'] . '.');

    return ['type' => 'inventory_action', 'inventoryAction' => $action, 'item' => $found];
}

function raidlands_monument_engine_extract(array &$state, array $command, array $config, string $server_seed): array
{
    if (!in_array((string) $state['status'], ['AWAITING_ROOM_SELECTION', 'AWAITING_EXTRACTION_DECISION'], true)) {
        throw new RuntimeException('Resolve the current decision before extracting.');
    }

    $method_key = strtolower(trim((string) ($command['methodKey'] ?? '')));
    $route = null;

    foreach (raidlands_monument_extractions($state, $config) as $candidate) {
        if ((string) $candidate['key'] === $method_key) {
            $route = $candidate;
            break;
        }
    }

    if (!is_array($route) || empty($route['available'])) {
        throw new RuntimeException(is_array($route) && $route['reason'] !== '' ? (string) $route['reason'] : 'That extraction route is unavailable.');
    }

    $state['status'] = 'AWAITING_EXTRACTION_DECISION';
    $roll = raidlands_monument_rng_draw($state, $server_seed, 'extraction:' . $method_key, 0, 9999);
    $success = $roll < (int) $route['chanceBps'];

    if (!$success) {
        $state['health'] = 0;
        $state['status'] = 'FAILED';
        $state['failureReason'] = 'EXTRACTION_DEATH';
        raidlands_monument_add_event($state, 'extraction_failed', (string) $route['label'] . ' failed. The unsecured haul was lost.');

        return [
            'type' => 'extract',
            'methodKey' => $method_key,
            'methodLabel' => (string) $route['label'],
            'success' => false,
            'won' => false,
            'terminal' => true,
            'chanceBps' => (int) $route['chanceBps'],
            'roll' => $roll,
            'payoutRp' => 0,
            'stakeRp' => (int) $state['wagerRp'],
        ];
    }

    $base_multiplier = raidlands_monument_payout_multiplier_bps($state);
    $final_multiplier = (int) floor($base_multiplier * ((int) $route['modifierBps'] / 10000));
    $payout = (int) floor((int) $state['wagerRp'] * ($final_multiplier / 10000));
    $payout = max(0, min((int) $config['maxPayoutRp'], $payout));
    $state['payoutMultiplierBps'] = $final_multiplier;
    $state['payoutRp'] = $payout;
    $state['extractionMethod'] = $method_key;
    $state['status'] = 'COMPLETED';
    raidlands_monument_add_event($state, 'extracted', 'Extracted through ' . (string) $route['label'] . ' with ' . $payout . ' RP secured.');

    return [
        'type' => 'extract',
        'methodKey' => $method_key,
        'methodLabel' => (string) $route['label'],
        'success' => true,
        'won' => true,
        'terminal' => true,
        'chanceBps' => (int) $route['chanceBps'],
        'roll' => $roll,
        'payoutRp' => $payout,
        'payoutMultiplierBps' => $final_multiplier,
        'stakeRp' => (int) $state['wagerRp'],
    ];
}

function raidlands_monument_add_event(array &$state, string $type, string $message): void
{
    $state['eventLog'][] = [
        'turn' => (int) ($state['turn'] ?? 0),
        'type' => $type,
        'message' => $message,
    ];

    if (count($state['eventLog']) > 60) {
        $state['eventLog'] = array_slice($state['eventLog'], -60);
    }
}
