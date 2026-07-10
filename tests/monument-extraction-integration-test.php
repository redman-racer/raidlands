<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/rewards.php';

$tests = 0;

function monument_integration_test(bool $condition, string $message): void
{
    global $tests;
    $tests += 1;

    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

function monument_integration_throws(callable $callback, string $contains, string $message): void
{
    try {
        $callback();
    } catch (Throwable $error) {
        monument_integration_test($contains === '' || str_contains($error->getMessage(), $contains), $message);
        return;
    }

    monument_integration_test(false, $message);
}

if (!raidlands_monument_is_ready()) {
    throw new RuntimeException(raidlands_monument_readiness_message());
}

putenv('MONUMENT_EXTRACTION_SEED_KEY=integration-test-only-seed-key-please-never-use-live');
raidlands_store_boot();
$pdo = raidlands_db_required();
$pdo->beginTransaction();

try {
    $steam_id64 = '76561190000000001';
    $pdo->prepare('INSERT INTO players (steam_id64, display_name, last_seen_at) VALUES (:steam_id64, "Monument Test", NOW())')
        ->execute(['steam_id64' => $steam_id64]);
    $player_id = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO wipe_seasons (server_id, wipe_key, started_at, is_active, last_snapshot_at) VALUES ("monument-test", :wipe_key, NOW(), 1, NOW())')
        ->execute(['wipe_key' => 'integration-' . bin2hex(random_bytes(4))]);
    $wipe_id = (int) $pdo->lastInsertId();
    $pdo->prepare(
        'INSERT INTO player_wipe_stats
            (wipe_id, player_id, display_name, raw_reward_points, reward_points, last_seen_at)
         VALUES
            (:wipe_id, :player_id, "Monument Test", 50000, 50000, NOW())'
    )->execute(['wipe_id' => $wipe_id, 'player_id' => $player_id]);

    $_SESSION['raidlands_player'] = [
        'id' => $player_id,
        'steam_id64' => $steam_id64,
        'display_name' => 'Monument Test',
        'steam_openid_verified' => true,
        'steam_auth_provider' => 'steam_openid',
        'steam_verified_at' => gmdate(DATE_ATOM),
    ];

    $config_row = raidlands_monument_active_config_row(true);
    $config = $config_row['config'];
    $config['enabled'] = true;
    $config['cooldownSeconds'] = 0;
    $config['minWagerRp'] = 100;
    $config['maxWagerRp'] = 100000;
    $config['dailyWagerLimitRp'] = 1000000;
    raidlands_monument_validate_config($config);
    $pdo->prepare('UPDATE monument_extraction_config_versions SET config_json = :config_json WHERE id = :id')
        ->execute(['config_json' => raidlands_monument_json($config), 'id' => (int) $config_row['id']]);
    $pdo->exec(
        'UPDATE rp_game_settings
         SET games_enabled = 1,
             monument_extraction_enabled = 1,
             daily_wager_cap_rp = 1000000,
             daily_loss_cap_rp = 1000000
         WHERE id = 1'
    );

    monument_integration_throws(
        static fn () => raidlands_monument_start_run(60000, 'scout', 'integration-insufficient-0001'),
        'balance is too low',
        'insufficient balance rejects start'
    );
    $count = (int) $pdo->query('SELECT COUNT(*) FROM monument_extraction_runs')->fetchColumn();
    monument_integration_test($count === 0, 'insufficient balance creates no run');
    $requests = (int) $pdo->query("SELECT COUNT(*) FROM rp_point_requests WHERE source_type = 'monument_wager'")->fetchColumn();
    monument_integration_test($requests === 0, 'insufficient balance creates no wager request');

    $start_id = 'integration-start-00000001';
    $started = raidlands_monument_start_run(1000, 'scout', $start_id);
    $run_id = (int) $started['run']['id'];
    monument_integration_test($started['run']['status'] === 'CREATING', 'new run waits for Rust wager confirmation');
    monument_integration_test(!empty($started['run']['seedCommitment']), 'new run publishes seed commitment');
    $wager_count = (int) $pdo->query("SELECT COUNT(*) FROM rp_point_requests WHERE source_type = 'monument_wager' AND source_id = '{$run_id}'")->fetchColumn();
    monument_integration_test($wager_count === 1, 'start creates exactly one wager debit request');

    $duplicate_start = raidlands_monument_start_run(1000, 'scout', $start_id);
    monument_integration_test(!empty($duplicate_start['duplicate']) && (int) $duplicate_start['run']['id'] === $run_id, 'duplicate start returns original run');
    $wager_count = (int) $pdo->query("SELECT COUNT(*) FROM rp_point_requests WHERE source_type = 'monument_wager' AND source_id = '{$run_id}'")->fetchColumn();
    monument_integration_test($wager_count === 1, 'duplicate start does not create a second debit');

    monument_integration_throws(
        static fn () => raidlands_monument_start_run(1000, 'enforcer', 'integration-second-active-01'),
        'active Monument Extraction run',
        'one active run per player is enforced'
    );

    $wager_request = raidlands_db_fetch_one(
        'SELECT * FROM rp_point_requests WHERE source_type = "monument_wager" AND source_id = :source_id LIMIT 1',
        ['source_id' => (string) $run_id]
    );
    raidlands_monument_sync_point_result($pdo, $wager_request, 'confirmed', 'confirmed in integration test', '');
    $ready_row = raidlands_monument_run_row($run_id, $player_id, true);
    monument_integration_test($ready_row['status'] === 'AWAITING_ROOM_SELECTION', 'confirmed wager opens the run');

    $public = raidlands_monument_public_run($ready_row);
    $public_json = json_encode($public, JSON_THROW_ON_ERROR);
    monument_integration_test(!str_contains($public_json, 'server_seed_encrypted'), 'active API state hides encrypted seed storage');
    monument_integration_test(!str_contains($public_json, 'frozen_config_json'), 'active API state hides frozen authoritative config');
    monument_integration_test(!str_contains($public_json, 'encounterKey'), 'active API state hides future encounter keys');
    monument_integration_test((int) raidlands_monument_active_run_row($player_id)['id'] === $run_id, 'refresh recovery returns the same active run');

    $room_id = (string) $public['adjacentRoomIds'][0];
    $enter_id = 'integration-enter-room-0001';
    $entered = raidlands_monument_apply_action($run_id, $enter_id, ['type' => 'enter_room', 'roomId' => $room_id]);
    monument_integration_test($entered['run']['status'] === 'AWAITING_ENCOUNTER_ACTION', 'legal room entry persists encounter state');
    $duplicate_enter = raidlands_monument_apply_action($run_id, $enter_id, ['type' => 'enter_room', 'roomId' => $room_id]);
    monument_integration_test(!empty($duplicate_enter['duplicate']), 'duplicate action returns the original result');
    $enter_actions = (int) raidlands_db_fetch_one(
        'SELECT COUNT(*) AS count FROM monument_extraction_actions WHERE run_id = :run_id AND client_action_id = :client_action_id',
        ['run_id' => $run_id, 'client_action_id' => $enter_id]
    )['count'];
    monument_integration_test($enter_actions === 1, 'duplicate room action is stored once');

    monument_integration_throws(
        static fn () => raidlands_monument_apply_action($run_id, 'integration-illegal-room-01', ['type' => 'enter_room', 'roomId' => 'd5-r0']),
        'room only when route selection',
        'illegal state transition is rejected by the service'
    );

    $row = raidlands_monument_run_row($run_id, $player_id, true);
    $forced_state = raidlands_monument_decode_json($row['state_json'], 'run state');
    $forced_config = raidlands_monument_decode_json($row['frozen_config_json'], 'frozen config');
    $forced_config['maxChanceBps'] = 10000;
    $forced_config['extractions']['main_gate']['chanceBps'] = 10000;
    $forced_state['status'] = 'AWAITING_ROOM_SELECTION';
    $forced_state['currentRoomId'] = 'd3-r0';
    $forced_state['health'] = 100;
    $forced_state['alert'] = 0;
    $forced_state['inventory'] = [raidlands_monument_build_item($forced_state, $forced_config, 'elite_crate')];
    $forced_state['pendingLoot'] = null;
    $pdo->prepare(
        'UPDATE monument_extraction_runs
         SET status = "AWAITING_ROOM_SELECTION", state_json = :state_json, frozen_config_json = :config_json
         WHERE id = :id'
    )->execute([
        'state_json' => raidlands_monument_json($forced_state),
        'config_json' => raidlands_monument_json($forced_config),
        'id' => $run_id,
    ]);

    $extract_id = 'integration-extract-000001';
    $extracted = raidlands_monument_apply_action($run_id, $extract_id, ['type' => 'extract', 'methodKey' => 'main_gate']);
    monument_integration_test($extracted['run']['status'] === 'COMPLETED', 'successful extraction becomes terminal');
    monument_integration_test((int) $extracted['run']['payoutRp'] > 0, 'successful extraction calculates payout server-side');
    $payout_count = (int) raidlands_db_fetch_one(
        'SELECT COUNT(*) AS count FROM rp_point_requests WHERE source_type = "monument_payout" AND source_id = :source_id',
        ['source_id' => (string) $run_id]
    )['count'];
    monument_integration_test($payout_count === 1, 'successful extraction queues exactly one payout');
    $duplicate_extract = raidlands_monument_apply_action($run_id, $extract_id, ['type' => 'extract', 'methodKey' => 'main_gate']);
    monument_integration_test(!empty($duplicate_extract['duplicate']), 'duplicate extraction returns the original terminal response');
    $payout_count = (int) raidlands_db_fetch_one(
        'SELECT COUNT(*) AS count FROM rp_point_requests WHERE source_type = "monument_payout" AND source_id = :source_id',
        ['source_id' => (string) $run_id]
    )['count'];
    monument_integration_test($payout_count === 1, 'duplicate extraction cannot double-pay');

    $terminal_row = raidlands_monument_run_row($run_id, $player_id, true);
    $terminal_public = raidlands_monument_public_run($terminal_row);
    monument_integration_test(!empty($terminal_public['fairness']['commitmentMatches']), 'terminal audit matches seed commitment');
    monument_integration_test(!empty($terminal_public['fairness']['drawsVerify']), 'terminal audit reproduces every draw');

    $payout_request = raidlands_db_fetch_one(
        'SELECT * FROM rp_point_requests WHERE source_type = "monument_payout" AND source_id = :source_id LIMIT 1',
        ['source_id' => (string) $run_id]
    );
    raidlands_monument_sync_point_result($pdo, $payout_request, 'confirmed', 'confirmed in integration test', '');
    monument_integration_test(raidlands_monument_run_row($run_id, $player_id)['payout_status'] === 'confirmed', 'Rust result callback confirms payout status');

    $second = raidlands_monument_start_run(500, 'enforcer', 'integration-expiry-start-01');
    $second_id = (int) $second['run']['id'];
    $second_request = raidlands_db_fetch_one(
        'SELECT * FROM rp_point_requests WHERE source_type = "monument_wager" AND source_id = :source_id LIMIT 1',
        ['source_id' => (string) $second_id]
    );
    raidlands_monument_sync_point_result($pdo, $second_request, 'confirmed', '', '');
    $pdo->prepare('UPDATE monument_extraction_runs SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = :id')->execute(['id' => $second_id]);
    $expired_action = raidlands_monument_apply_action($second_id, 'integration-stale-action-01', ['type' => 'inventory_action', 'inventoryAction' => 'use_syringe']);
    $expired = raidlands_monument_run_row($second_id, $player_id);
    monument_integration_test($expired_action['run']['status'] === 'EXPIRED', 'stale action returns the persisted expiry state');
    monument_integration_test($expired['status'] === 'EXPIRED', 'stale active run expires idempotently');
    monument_integration_test((int) $expired['payout_rp'] === 0 && empty($expired['payout_request_id']), 'expiry produces no unsecured payout');
    raidlands_monument_expire_active_for_player($player_id);
    monument_integration_test(raidlands_monument_run_row($second_id, $player_id)['status'] === 'EXPIRED', 'repeated expiry does not change terminal run');

    $third = raidlands_monument_start_run(500, 'scavenger', 'integration-reject-start-01');
    $third_id = (int) $third['run']['id'];
    $third_request = raidlands_db_fetch_one(
        'SELECT * FROM rp_point_requests WHERE source_type = "monument_wager" AND source_id = :source_id LIMIT 1',
        ['source_id' => (string) $third_id]
    );
    raidlands_monument_sync_point_result($pdo, $third_request, 'rejected', 'insufficient live server balance', 'insufficient_balance');
    $rejected = raidlands_monument_run_row($third_id, $player_id);
    monument_integration_test($rejected['status'] === 'FAILED' && $rejected['active_player_key'] === null, 'rejected wager terminates and releases active slot');
    monument_integration_test((int) $rejected['payout_rp'] === 0, 'rejected wager produces no payout');

    $fourth = raidlands_monument_start_run(500, 'scout', 'integration-creating-expire-01');
    $fourth_id = (int) $fourth['run']['id'];
    $pdo->prepare('UPDATE monument_extraction_runs SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = :id')->execute(['id' => $fourth_id]);
    raidlands_monument_expire_active_for_player($player_id);
    $creating_expired = raidlands_monument_run_row($fourth_id, $player_id);
    $creating_request = raidlands_db_fetch_one(
        'SELECT * FROM rp_point_requests WHERE source_type = "monument_wager" AND source_id = :source_id LIMIT 1',
        ['source_id' => (string) $fourth_id]
    );
    monument_integration_test($creating_expired['status'] === 'EXPIRED', 'unconfirmed stale run expires');
    monument_integration_test($creating_request['status'] === 'canceled', 'queued wager is canceled before an unconfirmed run expires');
    monument_integration_test((int) $creating_expired['payout_rp'] === 0, 'unconfirmed run expiry produces no payout');

    echo 'Monument Extraction integration tests passed: ' . $tests . PHP_EOL;
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    unset($_SESSION['raidlands_player']);
}
