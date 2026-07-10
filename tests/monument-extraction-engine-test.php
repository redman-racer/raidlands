<?php

require dirname(__DIR__) . '/includes/monument-extraction-engine.php';

$tests = 0;

function monument_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;

    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

function monument_throws(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (Throwable $error) {
        monument_test(true, $message);
        return;
    }

    monument_test(false, $message);
}

function monument_reachable(array $state): array
{
    $seen = ['d0-r0' => true];
    $queue = ['d0-r0'];

    while ($queue !== []) {
        $from = array_shift($queue);

        foreach ($state['map']['edges'] as $edge) {
            if ($edge['from'] !== $from || isset($seen[$edge['to']])) {
                continue;
            }

            $seen[$edge['to']] = true;
            $queue[] = $edge['to'];
        }
    }

    return array_keys($seen);
}

function monument_extraction_state(array $base, array $config, string $method): array
{
    $state = $base;
    $state['status'] = 'AWAITING_ROOM_SELECTION';
    $state['inventory'] = [[
        'id' => 'loot-test',
        'key' => 'elite_crate',
        'label' => 'Elite Crate',
        'category' => 'PAYOUT_LOOT',
        'rarity' => 'epic',
        'slots' => 3,
        'valueBps' => 19000,
    ]];

    if ($method === 'main_gate') {
        $state['currentRoomId'] = 'd3-r0';
    } elseif ($method === 'sewer') {
        $state['currentRoomId'] = 'd3-r0';
        $state['inventory'][] = raidlands_monument_build_item($state, $config, 'fuse');
    } else {
        $state['currentRoomId'] = 'd5-r0';
        $state['inventory'][] = raidlands_monument_build_item($state, $config, 'signal_beacon');
    }

    return $state;
}

$config = raidlands_monument_default_config();
$seed = hash('sha256', 'raidlands-monument-test-seed');
$state = raidlands_monument_engine_new('engine-test', 1000, 'scout', $config, $seed);

monument_test(count($config['loadouts']) >= 3, 'three loadouts are configured');
monument_test(count($config['roomArchetypes']) >= 8, 'eight room archetypes are configured');
monument_test(count($config['encounters']) >= 12, 'twelve encounter templates are configured');
monument_test(count($config['extractions']) >= 3, 'three extraction methods are configured');
monument_test(count($state['map']['rooms']) === 12, 'six-layer map contains expected room count');
monument_test(count(monument_reachable($state)) === count($state['map']['rooms']), 'every generated room is reachable');
monument_test($state['map']['rooms']['d1-r0']['archetype'] === 'storage', 'map guarantees an early low-risk storage room');
monument_test($state['map']['rooms']['d2-r0']['archetype'] === 'medical', 'map guarantees a recovery opportunity');
monument_test($state['map']['rooms']['d5-r0']['archetype'] === 'rooftop', 'deep objective is a rooftop');

$same = raidlands_monument_engine_new('engine-test', 1000, 'scout', $config, $seed);
monument_test($state['map'] === $same['map'], 'map generation is deterministic for run, seed, and config');
monument_test($state['draws'] === $same['draws'], 'map random audit is deterministic');
monument_test(hash('sha256', $seed) === hash('sha256', $seed), 'seed commitment is reproducible');

foreach ($state['draws'] as $draw) {
    monument_test(raidlands_monument_verify_draw('engine-test', $seed, $draw), 'recorded random draw verifies');
}

$public = raidlands_monument_public_state($state, $config);
$public_json = json_encode($public, JSON_THROW_ON_ERROR);
monument_test(!str_contains($public_json, 'encounterKey'), 'active public state hides encounter keys');
monument_test(!str_contains($public_json, $seed), 'active public state hides server seed');
monument_test(!str_contains($public_json, 'baseChanceBps'), 'active public state hides base calculation inputs');

$adjacent = raidlands_monument_adjacent_room_ids($state);
monument_test(count($adjacent) >= 1, 'entrance has a legal adjacent room');
$entered = raidlands_monument_engine_apply($state, ['type' => 'enter_room', 'roomId' => $adjacent[0]], $config, $seed);
monument_test($entered['state']['status'] === 'AWAITING_ENCOUNTER_ACTION', 'enter room advances explicit state machine');
monument_test(isset($entered['state']['visited'][$adjacent[0]]), 'entered room becomes visited');
monument_throws(
    static fn () => raidlands_monument_engine_apply($state, ['type' => 'enter_room', 'roomId' => 'd5-r0'], $config, $seed),
    'non-adjacent room movement is rejected'
);
monument_throws(
    static fn () => raidlands_monument_engine_apply($state, ['type' => 'resolve_encounter', 'approachKey' => 'sneak'], $config, $seed),
    'illegal encounter transition is rejected'
);

$encounter_state = $entered['state'];
$resolved_a = raidlands_monument_engine_apply($encounter_state, ['type' => 'resolve_encounter', 'approachKey' => 'sneak'], $config, $seed);
$resolved_b = raidlands_monument_engine_apply($encounter_state, ['type' => 'resolve_encounter', 'approachKey' => 'sneak'], $config, $seed);
monument_test($resolved_a['result'] === $resolved_b['result'], 'encounter resolution is deterministic');
monument_test($resolved_a['state'] === $resolved_b['state'], 'deterministic encounter produces identical state');

$low_chance_state = $encounter_state;
$low_chance_state['alert'] = 9;
$low_chance_state['health'] = 20;
$chance = raidlands_monument_chance($low_chance_state, $config, 'sneak');
monument_test($chance >= $config['minChanceBps'] && $chance <= $config['maxChanceBps'], 'chance calculation respects configured caps');
monument_test($chance < raidlands_monument_chance($encounter_state, $config, 'sneak'), 'alert and low health reduce encounter chance');

$enforcer = raidlands_monument_engine_new('enforcer-test', 1000, 'enforcer', $config, $seed);
$enforcer = raidlands_monument_engine_apply($enforcer, ['type' => 'enter_room', 'roomId' => raidlands_monument_adjacent_room_ids($enforcer)[0]], $config, $seed)['state'];
$scout = raidlands_monument_engine_new('scout-test', 1000, 'scout', $config, $seed);
$scout = raidlands_monument_engine_apply($scout, ['type' => 'enter_room', 'roomId' => raidlands_monument_adjacent_room_ids($scout)[0]], $config, $seed)['state'];
monument_test(
    raidlands_monument_chance($enforcer, $config, 'controlled_assault') === raidlands_monument_chance($scout, $config, 'controlled_assault') + 500,
    'Enforcer receives exactly five percentage points on Controlled Assault'
);

$damage_state = $state;
$damage_state['armor'] = 1;
$damage_state['health'] = 100;
[$damage, $armor_used] = raidlands_monument_apply_damage($damage_state, 30, $config);
monument_test($armor_used && $damage === 12 && $damage_state['health'] === 88, 'automatic armor reduces the next damage event and is consumed');

$heal_state = $state;
$heal_state['health'] = 50;
$heal_state['syringes'] = 1;
$healed = raidlands_monument_engine_apply($heal_state, ['type' => 'inventory_action', 'inventoryAction' => 'use_syringe'], $config, $seed);
monument_test($healed['state']['health'] === 85 && $healed['state']['syringes'] === 0, 'explicit syringe action heals and consumes one syringe');

$inventory_state = $state;
$inventory_state['status'] = 'AWAITING_LOOT_DECISION';
$inventory_state['inventoryCapacity'] = 1;
$inventory_state['inventory'] = [raidlands_monument_build_item($inventory_state, $config, 'scrap_bundle')];
$inventory_state['pendingLoot'] = raidlands_monument_build_item($inventory_state, $config, 'components_crate');
monument_throws(
    static fn () => raidlands_monument_engine_apply($inventory_state, ['type' => 'loot_decision', 'decision' => 'take'], $config, $seed),
    'over-capacity loot take is rejected'
);
$replaced = raidlands_monument_engine_apply($inventory_state, [
    'type' => 'loot_decision',
    'decision' => 'take',
    'discardItemIds' => [$inventory_state['inventory'][0]['id']],
], $config, $seed);
monument_test(count($replaced['state']['inventory']) === 1, 'inventory replacement keeps capacity valid');
monument_test($replaced['state']['inventory'][0]['key'] === 'components_crate', 'inventory replacement takes pending loot');

$forced_config = $config;
$forced_config['maxChanceBps'] = 10000;

foreach (['main_gate', 'sewer', 'rooftop'] as $method) {
    $forced_config['extractions'][$method]['chanceBps'] = 10000;
    $extract_state = monument_extraction_state($state, $forced_config, $method);
    $extracted = raidlands_monument_engine_apply($extract_state, ['type' => 'extract', 'methodKey' => $method], $forced_config, $seed);
    monument_test($extracted['state']['status'] === 'COMPLETED', $method . ' extraction completes');
    monument_test($extracted['result']['payoutRp'] > 0, $method . ' extraction calculates a wager-relative payout');
}

$locked_sewer = monument_extraction_state($state, $forced_config, 'main_gate');
$locked_sewer['currentRoomId'] = 'd3-r0';
monument_throws(
    static fn () => raidlands_monument_engine_apply($locked_sewer, ['type' => 'extract', 'methodKey' => 'sewer'], $forced_config, $seed),
    'sewer extraction without prerequisite is rejected'
);

$abandoned = raidlands_monument_engine_apply($state, ['type' => 'abandon'], $config, $seed);
monument_test($abandoned['state']['status'] === 'ABANDONED' && $abandoned['state']['payoutRp'] === 0, 'abandonment is terminal with no payout');
monument_throws(
    static fn () => raidlands_monument_engine_apply($abandoned['state'], ['type' => 'inventory_action', 'inventoryAction' => 'use_syringe'], $config, $seed),
    'no action is accepted after a terminal state'
);

$terminal_public = raidlands_monument_public_state($abandoned['state'], $config, true, $seed);
monument_test(($terminal_public['fairness']['serverSeed'] ?? '') === $seed, 'terminal state reveals the server seed');
monument_test(count($terminal_public['fairness']['draws'] ?? []) === count($abandoned['state']['draws']), 'terminal state reveals ordered draw audit');

echo 'Monument Extraction engine tests passed: ' . $tests . PHP_EOL;
