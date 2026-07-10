<?php

require dirname(__DIR__) . '/includes/monument-extraction-engine.php';

$options = getopt('', ['runs::', 'policy::', 'loadout::', 'json']);
$runs_per_policy = max(1, (int) ($options['runs'] ?? 100000));
$all_policies = ['conservative', 'balanced', 'aggressive', 'random', 'heuristic'];
$all_loadouts = ['scout', 'enforcer', 'scavenger'];
$policies = isset($options['policy'])
    ? array_values(array_intersect($all_policies, array_filter(explode(',', (string) $options['policy']))))
    : $all_policies;
$loadouts = isset($options['loadout'])
    ? array_values(array_intersect($all_loadouts, array_filter(explode(',', (string) $options['loadout']))))
    : $all_loadouts;

if ($policies === [] || $loadouts === []) {
    fwrite(STDERR, "Choose a valid policy and loadout.\n");
    exit(2);
}

$config = raidlands_monument_default_config();
$config['enabled'] = true;
$report = [
    'generatedAtUtc' => gmdate(DATE_ATOM),
    'engine' => 'includes/monument-extraction-engine.php',
    'runsPerPolicy' => $runs_per_policy,
    'targetOptimalRtp' => (float) $config['targetOptimalRtp'],
    'policies' => [],
];

foreach ($policies as $policy) {
    $policy_stats = monument_sim_stats();
    $base = intdiv($runs_per_policy, count($loadouts));
    $remainder = $runs_per_policy % count($loadouts);

    foreach ($loadouts as $loadout_index => $loadout) {
        $loadout_runs = $base + ($loadout_index < $remainder ? 1 : 0);
        $loadout_stats = monument_sim_stats();

        for ($index = 0; $index < $loadout_runs; $index += 1) {
            $seed = hash('sha256', 'raidlands-monument-simulation:' . $policy . ':' . $loadout . ':' . $index);
            $outcome = monument_sim_run($config, $policy, $loadout, $seed, $index);
            monument_sim_record($loadout_stats, $outcome);
            monument_sim_record($policy_stats, $outcome);
        }

        $policy_stats['loadouts'][$loadout] = monument_sim_finalize($loadout_stats);
    }

    $loadout_reports = $policy_stats['loadouts'];
    $policy_report = monument_sim_finalize($policy_stats);
    $policy_report['loadouts'] = $loadout_reports;
    $report['policies'][$policy] = $policy_report;
}

if (isset($options['json'])) {
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), PHP_EOL;
    exit(0);
}

echo 'Monument Extraction simulation (' . number_format($runs_per_policy) . " runs/policy)\n";
echo 'Production engine: ' . $report['engine'] . "\n\n";

foreach ($report['policies'] as $policy => $stats) {
    printf(
        "%-13s RTP %6.2f%% | failure %6.2f%% | avg turns %5.2f | avg payout %7.2f | p95 %7.0f | max %7d\n",
        ucfirst($policy),
        $stats['rtp'] * 100,
        $stats['failureRate'] * 100,
        $stats['averageTurns'],
        $stats['averagePayoutRp'],
        $stats['p95PayoutRp'],
        $stats['maxPayoutRp']
    );

    foreach ($stats['loadouts'] as $loadout => $loadout_stats) {
        printf(
            "  %-11s RTP %6.2f%% | failure %6.2f%% | main %5.1f%% sewer %5.1f%% roof %5.1f%%\n",
            ucfirst($loadout),
            $loadout_stats['rtp'] * 100,
            $loadout_stats['failureRate'] * 100,
            ($loadout_stats['extractionUsage']['main_gate'] ?? 0) * 100,
            ($loadout_stats['extractionUsage']['sewer'] ?? 0) * 100,
            ($loadout_stats['extractionUsage']['rooftop'] ?? 0) * 100
        );
    }
}

function monument_sim_stats(): array
{
    return [
        'runs' => 0,
        'wagered' => 0,
        'paid' => 0,
        'failures' => 0,
        'turns' => 0,
        'payouts' => [],
        'maxPayout' => 0,
        'extractions' => ['main_gate' => 0, 'sewer' => 0, 'rooftop' => 0, 'none' => 0],
        'statuses' => [],
        'approaches' => [],
        'rooms' => [],
        'alerts' => array_fill(0, 11, 0),
        'loadouts' => [],
    ];
}

function monument_sim_record(array &$stats, array $outcome): void
{
    $stats['runs'] += 1;
    $stats['wagered'] += (int) $outcome['wagerRp'];
    $stats['paid'] += (int) $outcome['payoutRp'];
    $stats['turns'] += (int) $outcome['turns'];
    $stats['payouts'][] = (int) $outcome['payoutRp'];
    $stats['maxPayout'] = max((int) $stats['maxPayout'], (int) $outcome['payoutRp']);
    $stats['statuses'][$outcome['status']] = (int) ($stats['statuses'][$outcome['status']] ?? 0) + 1;
    $method = (string) ($outcome['extractionMethod'] ?: 'none');
    $stats['extractions'][$method] = (int) ($stats['extractions'][$method] ?? 0) + 1;
    $stats['alerts'][max(0, min(10, (int) $outcome['alert']))] += 1;

    if ($outcome['status'] !== 'COMPLETED') {
        $stats['failures'] += 1;
    }

    foreach ($outcome['approaches'] as $key => $count) {
        $stats['approaches'][$key] = (int) ($stats['approaches'][$key] ?? 0) + (int) $count;
    }

    foreach ($outcome['rooms'] as $key => $count) {
        $stats['rooms'][$key] = (int) ($stats['rooms'][$key] ?? 0) + (int) $count;
    }
}

function monument_sim_finalize(array $stats): array
{
    $runs = max(1, (int) $stats['runs']);
    $payouts = $stats['payouts'];
    sort($payouts, SORT_NUMERIC);
    $percentile = static function (float $value) use ($payouts): int {
        if ($payouts === []) {
            return 0;
        }

        $index = (int) floor((count($payouts) - 1) * $value);
        return (int) $payouts[$index];
    };
    $usage = [];

    foreach ($stats['extractions'] as $key => $count) {
        $usage[$key] = $count / $runs;
    }

    $alert_distribution = [];

    foreach ($stats['alerts'] as $alert => $count) {
        $alert_distribution[(string) $alert] = $count / $runs;
    }

    return [
        'runs' => (int) $stats['runs'],
        'rtp' => $stats['wagered'] > 0 ? $stats['paid'] / $stats['wagered'] : 0,
        'failureRate' => $stats['failures'] / $runs,
        'averageTurns' => $stats['turns'] / $runs,
        'averagePayoutRp' => $stats['paid'] / $runs,
        'medianPayoutRp' => $percentile(.5),
        'p90PayoutRp' => $percentile(.9),
        'p95PayoutRp' => $percentile(.95),
        'p99PayoutRp' => $percentile(.99),
        'maxPayoutRp' => (int) $stats['maxPayout'],
        'extractionUsage' => $usage,
        'statusCounts' => $stats['statuses'],
        'approachSelections' => $stats['approaches'],
        'roomSelections' => $stats['rooms'],
        'alertDistribution' => $alert_distribution,
    ];
}

function monument_sim_run(array $config, string $policy, string $loadout, string $seed, int $index): array
{
    $wager = 1000;
    $state = raidlands_monument_engine_new('sim-' . $policy . '-' . $loadout . '-' . $index, $wager, $loadout, $config, $seed);
    $approaches = [];
    $rooms = [];
    $guard = 0;

    while (!raidlands_monument_terminal_status_sim((string) $state['status']) && $guard < 32) {
        $guard += 1;
        $status = (string) $state['status'];

        if (in_array($status, ['AWAITING_ROOM_SELECTION', 'AWAITING_EXTRACTION_DECISION'], true)) {
            if ((int) $state['health'] < monument_sim_heal_threshold($policy) && (int) $state['syringes'] > 0) {
                $state = raidlands_monument_engine_apply($state, ['type' => 'inventory_action', 'inventoryAction' => 'use_syringe'], $config, $seed)['state'];
                continue;
            }

            $route = monument_sim_choose_extraction($state, $config, $policy);

            if ($route !== null && ($status === 'AWAITING_EXTRACTION_DECISION' || monument_sim_should_extract($state, $policy))) {
                $state = raidlands_monument_engine_apply($state, ['type' => 'extract', 'methodKey' => $route], $config, $seed)['state'];
                continue;
            }

            $room_id = monument_sim_choose_room($state, $policy, $seed);

            if ($room_id === null) {
                if ($route !== null) {
                    $state = raidlands_monument_engine_apply($state, ['type' => 'extract', 'methodKey' => $route], $config, $seed)['state'];
                } else {
                    $state = raidlands_monument_engine_apply($state, ['type' => 'abandon'], $config, $seed)['state'];
                }
                continue;
            }

            $archetype = (string) $state['map']['rooms'][$room_id]['archetype'];
            $rooms[$archetype] = (int) ($rooms[$archetype] ?? 0) + 1;
            $state = raidlands_monument_engine_apply($state, ['type' => 'enter_room', 'roomId' => $room_id], $config, $seed)['state'];
            continue;
        }

        if ($status === 'AWAITING_ENCOUNTER_ACTION') {
            $approach = monument_sim_choose_approach($state, $config, $policy, $seed);
            $approaches[$approach] = (int) ($approaches[$approach] ?? 0) + 1;
            $state = raidlands_monument_engine_apply($state, ['type' => 'resolve_encounter', 'approachKey' => $approach], $config, $seed)['state'];
            continue;
        }

        if ($status === 'AWAITING_LOOT_DECISION') {
            $command = monument_sim_loot_command($state, $policy);
            $state = raidlands_monument_engine_apply($state, $command, $config, $seed)['state'];
            continue;
        }

        throw new RuntimeException('Simulation reached unsupported state ' . $status . '.');
    }

    if (!raidlands_monument_terminal_status_sim((string) $state['status'])) {
        $state = raidlands_monument_engine_apply($state, ['type' => 'abandon'], $config, $seed)['state'];
    }

    return [
        'status' => (string) $state['status'],
        'wagerRp' => $wager,
        'payoutRp' => (int) ($state['payoutRp'] ?? 0),
        'turns' => (int) $state['turn'],
        'extractionMethod' => (string) ($state['extractionMethod'] ?? ''),
        'alert' => (int) $state['alert'],
        'approaches' => $approaches,
        'rooms' => $rooms,
    ];
}

function raidlands_monument_terminal_status_sim(string $status): bool
{
    return in_array($status, ['COMPLETED', 'FAILED', 'ABANDONED', 'EXPIRED'], true);
}

function monument_sim_heal_threshold(string $policy): int
{
    return match ($policy) {
        'conservative' => 78,
        'balanced', 'heuristic' => 58,
        'random' => 38,
        default => 25,
    };
}

function monument_sim_should_extract(array $state, string $policy): bool
{
    $multiplier = raidlands_monument_payout_multiplier_bps($state);
    $depth = (int) raidlands_monument_current_room($state)['depth'];

    return match ($policy) {
        'conservative' => $multiplier >= 6500 || (int) $state['health'] <= 55,
        'balanced' => $multiplier >= 10500 || (int) $state['health'] <= 38 || $depth >= 4,
        'aggressive' => $depth >= 5 || (int) $state['health'] <= 20,
        'heuristic' => $multiplier >= 10500 || (int) $state['health'] <= 38 || $depth >= 4,
        'random' => $depth >= 3 && monument_sim_hash_pick($state, 'random-extract', 100) < 28,
        default => false,
    };
}

function monument_sim_choose_extraction(array $state, array $config, string $policy): ?string
{
    $available = array_values(array_filter(
        raidlands_monument_extractions($state, $config),
        static fn (array $route): bool => !empty($route['available'])
    ));

    if ($available === []) {
        return null;
    }

    if ($policy === 'aggressive') {
        foreach ($available as $route) {
            if ($route['key'] === 'rooftop') return 'rooftop';
        }
    }

    if ($policy === 'conservative') {
        usort($available, static fn (array $a, array $b): int => $b['chanceBps'] <=> $a['chanceBps']);
    } elseif ($policy === 'heuristic') {
        usort($available, static fn (array $a, array $b): int => ($b['chanceBps'] * $b['modifierBps']) <=> ($a['chanceBps'] * $a['modifierBps']));
    } elseif ($policy === 'random') {
        return (string) $available[monument_sim_hash_pick($state, 'random-route', count($available))]['key'];
    } else {
        $priority = ['sewer' => 0, 'main_gate' => 1, 'rooftop' => 2];
        usort($available, static fn (array $a, array $b): int => ($priority[$a['key']] ?? 9) <=> ($priority[$b['key']] ?? 9));
    }

    return (string) $available[0]['key'];
}

function monument_sim_choose_room(array $state, string $policy, string $seed): ?string
{
    $ids = raidlands_monument_adjacent_room_ids($state);

    if ($ids === []) {
        return null;
    }

    if ($policy === 'random') {
        return $ids[monument_sim_hash_pick($state, 'random-room:' . $seed, count($ids))];
    }

    $danger = ['Safe' => 0, 'Low' => 1, 'Medium' => 2, 'High' => 3, 'Extreme' => 4];
    $reward = ['storage' => 1, 'medical' => 1, 'security' => 2, 'generator' => 2, 'armory' => 3, 'research' => 4, 'vault' => 5, 'rooftop' => 5];
    usort($ids, static function (string $a, string $b) use ($state, $policy, $danger, $reward): int {
        $room_a = $state['map']['rooms'][$a];
        $room_b = $state['map']['rooms'][$b];
        $score = static function (array $room) use ($policy, $danger, $reward): int {
            $risk = $danger[$room['danger']] ?? 3;
            $value = $reward[$room['archetype']] ?? 2;

            return match ($policy) {
                'conservative' => ($risk * -10) + ($room['archetype'] === 'medical' ? 7 : 0),
                'aggressive' => ($value * 12) + ($risk * 4),
                'heuristic' => ($value * 5) - ($risk * 4),
                default => ($value * 5) - ($risk * 4),
            };
        };

        return $score($room_b) <=> $score($room_a);
    });

    return $ids[0];
}

function monument_sim_choose_approach(array $state, array $config, string $policy, string $seed): string
{
    $available = array_values(array_filter(
        raidlands_monument_approaches($state, $config),
        static fn (array $approach): bool => !empty($approach['available'])
    ));

    if ($available === []) {
        return 'retreat';
    }

    if ($policy === 'random') {
        return (string) $available[monument_sim_hash_pick($state, 'random-approach:' . $seed, count($available))]['key'];
    }

    $preferred = match ($policy) {
        'conservative' => ['sneak', 'controlled_assault', 'retreat', 'rush'],
        'balanced' => ['controlled_assault', 'sneak', 'rush', 'retreat'],
        'aggressive' => ['rush', 'controlled_assault', 'sneak', 'retreat'],
        'heuristic' => ['controlled_assault', 'sneak', 'rush', 'retreat'],
        default => [],
    };

    foreach ($preferred as $key) {
        foreach ($available as $approach) {
            if ($approach['key'] === $key) return $key;
        }
    }

    return 'retreat';
}

function monument_sim_loot_command(array $state, string $policy): array
{
    $pending = $state['pendingLoot'];

    if (!is_array($pending)) {
        return ['type' => 'loot_decision', 'decision' => 'leave'];
    }

    if ($policy === 'random' && monument_sim_hash_pick($state, 'random-loot', 100) < 18) {
        return ['type' => 'loot_decision', 'decision' => 'leave'];
    }

    $free = (int) $state['inventoryCapacity'] - raidlands_monument_inventory_slots($state);
    $needed = max(0, (int) $pending['slots'] - $free);
    $discard = [];

    if ($needed > 0) {
        $items = $state['inventory'];
        usort($items, static function (array $a, array $b): int {
            $score = static fn (array $item): float => (int) $item['slots'] > 0 ? (int) $item['valueBps'] / (int) $item['slots'] : PHP_INT_MAX;
            return $score($a) <=> $score($b);
        });
        $pending_score = (int) $pending['slots'] > 0 ? (int) $pending['valueBps'] / (int) $pending['slots'] : PHP_INT_MAX;
        $freed = 0;

        foreach ($items as $item) {
            $item_score = (int) $item['slots'] > 0 ? (int) $item['valueBps'] / (int) $item['slots'] : PHP_INT_MAX;
            $is_key = in_array((string) $item['key'], ['fuse', 'signal_beacon'], true);

            if ($is_key || ((string) $pending['category'] === 'PAYOUT_LOOT' && $item_score >= $pending_score)) {
                continue;
            }

            $discard[] = (string) $item['id'];
            $freed += (int) $item['slots'];

            if ($freed >= $needed) break;
        }

        if ($freed < $needed) {
            return ['type' => 'loot_decision', 'decision' => 'leave'];
        }
    }

    return ['type' => 'loot_decision', 'decision' => 'take', 'discardItemIds' => $discard];
}

function monument_sim_hash_pick(array $state, string $purpose, int $range): int
{
    if ($range <= 1) return 0;
    $hash = hash('sha256', $state['runId'] . ':' . $state['turn'] . ':' . $purpose);
    return hexdec(substr($hash, 0, 8)) % $range;
}
