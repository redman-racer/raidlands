<?php

require_once __DIR__ . '/monument-extraction-engine.php';

function raidlands_monument_tables(): array
{
    return [
        'monument_extraction_config_versions',
        'monument_extraction_runs',
        'monument_extraction_actions',
    ];
}

function raidlands_monument_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    foreach (raidlands_monument_tables() as $table) {
        if (!raidlands_store_table_exists($table)) {
            return false;
        }
    }

    return raidlands_store_table_has_columns('rp_game_settings', ['monument_extraction_enabled'])
        && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', 'monument_wager')
        && raidlands_rewards_enum_allows('rp_point_requests', 'source_type', 'monument_payout');
}

function raidlands_monument_readiness_message(): string
{
    return raidlands_monument_is_ready()
        ? 'Monument Extraction tables are installed.'
        : 'Monument Extraction is staged. Run database/migrations/046_monument_extraction.sql.';
}

function raidlands_monument_json(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function raidlands_monument_decode_json($value, string $label = 'JSON'): array
{
    $decoded = is_string($value) ? json_decode($value, true) : null;

    if (!is_array($decoded)) {
        throw new RuntimeException('Stored Monument Extraction ' . $label . ' is invalid.');
    }

    return $decoded;
}

function raidlands_monument_seed_default_config(): void
{
    if (!raidlands_monument_is_ready()) {
        return;
    }

    $existing = raidlands_db_fetch_one('SELECT id FROM monument_extraction_config_versions ORDER BY id ASC LIMIT 1');

    if ($existing !== null) {
        return;
    }

    $config = raidlands_monument_default_config();
    $json = raidlands_monument_json($config);
    $hash = hash('sha256', $json);
    raidlands_db_execute(
        'INSERT INTO monument_extraction_config_versions
            (version_name, schema_version, config_json, config_hash, is_active, activated_at)
         VALUES
            ("mvp-v1-disabled", :schema_version, :config_json, :config_hash, 1, NOW())',
        [
            'schema_version' => (int) $config['schemaVersion'],
            'config_json' => $json,
            'config_hash' => $hash,
        ]
    );
}

function raidlands_monument_active_config_row(bool $for_update = false): array
{
    if (!raidlands_monument_is_ready()) {
        throw new RuntimeException(raidlands_monument_readiness_message());
    }

    raidlands_monument_seed_default_config();
    $row = raidlands_db_fetch_one(
        'SELECT *
         FROM monument_extraction_config_versions
         WHERE is_active = 1
         ORDER BY activated_at DESC, id DESC
         LIMIT 1' . ($for_update ? ' FOR UPDATE' : '')
    );

    if ($row === null) {
        throw new RuntimeException('No active Monument Extraction configuration is available.');
    }

    $row['config'] = raidlands_monument_decode_json($row['config_json'] ?? '', 'configuration');
    raidlands_monument_validate_config($row['config']);

    return $row;
}

function raidlands_monument_settings(): array
{
    $settings = raidlands_rewards_settings();

    return [
        'enabled' => !empty($settings['games_enabled']) && !empty($settings['monument_extraction_enabled']),
        'gameEnabled' => !empty($settings['monument_extraction_enabled']),
        'masterEnabled' => !empty($settings['games_enabled']),
    ];
}

function raidlands_monument_encryption_key(): string
{
    $secret = trim(raidlands_env('MONUMENT_EXTRACTION_SEED_KEY', ''));

    if (strlen($secret) < 32) {
        throw new RuntimeException('MONUMENT_EXTRACTION_SEED_KEY must be configured with at least 32 characters before Monument Extraction can start runs.');
    }

    return hash('sha256', $secret, true);
}

function raidlands_monument_encrypt_seed(string $server_seed): string
{
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($server_seed, 'aes-256-gcm', raidlands_monument_encryption_key(), OPENSSL_RAW_DATA, $iv, $tag);

    if (!is_string($ciphertext)) {
        throw new RuntimeException('Could not protect the Monument Extraction server seed.');
    }

    return base64_encode(raidlands_monument_json([
        'v' => 1,
        'iv' => base64_encode($iv),
        'tag' => base64_encode($tag),
        'ciphertext' => base64_encode($ciphertext),
    ]));
}

function raidlands_monument_decrypt_seed(string $encrypted): string
{
    $payload_json = base64_decode($encrypted, true);
    $payload = is_string($payload_json) ? json_decode($payload_json, true) : null;

    if (!is_array($payload)) {
        throw new RuntimeException('Stored Monument Extraction seed payload is invalid.');
    }

    $iv = base64_decode((string) ($payload['iv'] ?? ''), true);
    $tag = base64_decode((string) ($payload['tag'] ?? ''), true);
    $ciphertext = base64_decode((string) ($payload['ciphertext'] ?? ''), true);

    if (!is_string($iv) || !is_string($tag) || !is_string($ciphertext)) {
        throw new RuntimeException('Stored Monument Extraction seed payload is incomplete.');
    }

    $seed = openssl_decrypt($ciphertext, 'aes-256-gcm', raidlands_monument_encryption_key(), OPENSSL_RAW_DATA, $iv, $tag);

    if (!is_string($seed) || $seed === '') {
        throw new RuntimeException('Could not unlock the Monument Extraction server seed.');
    }

    return $seed;
}

function raidlands_monument_terminal_status(string $status): bool
{
    return in_array($status, ['COMPLETED', 'FAILED', 'ABANDONED', 'EXPIRED'], true);
}

function raidlands_monument_validate_action_id(string $value): string
{
    $value = trim($value);

    if (preg_match('/^[A-Za-z0-9_-]{12,64}$/', $value) !== 1) {
        throw new InvalidArgumentException('Every Monument Extraction change requires a valid clientActionId.');
    }

    return $value;
}

function raidlands_monument_run_row(int $run_id, int $player_id, bool $for_update = false): ?array
{
    if ($run_id <= 0 || $player_id <= 0 || !raidlands_monument_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT monument_extraction_runs.*,
                (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
         FROM monument_extraction_runs
         WHERE id = :id AND player_id = :player_id
         LIMIT 1' . ($for_update ? ' FOR UPDATE' : ''),
        ['id' => $run_id, 'player_id' => $player_id]
    );
}

function raidlands_monument_active_run_row(int $player_id, bool $for_update = false): ?array
{
    if ($player_id <= 0 || !raidlands_monument_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT monument_extraction_runs.*,
                (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
         FROM monument_extraction_runs
         WHERE active_player_key = :player_id
         LIMIT 1' . ($for_update ? ' FOR UPDATE' : ''),
        ['player_id' => $player_id]
    );
}

function raidlands_monument_expire_row(PDO $pdo, array $row, string $reason = 'RUN_EXPIRED'): array
{
    if (raidlands_monument_terminal_status((string) ($row['status'] ?? ''))) {
        return $row;
    }

    if ((string) ($row['status'] ?? '') === 'CREATING' && !empty($row['wager_request_id'])) {
        $request_statement = $pdo->prepare('SELECT * FROM rp_point_requests WHERE id = :id FOR UPDATE');
        $request_statement->execute(['id' => (int) $row['wager_request_id']]);
        $wager_request = $request_statement->fetch(PDO::FETCH_ASSOC);

        if (is_array($wager_request) && (string) $wager_request['status'] === 'confirmed') {
            $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
            $config = raidlands_monument_decode_json($row['frozen_config_json'] ?? '', 'frozen configuration');
            $ttl = max(5, min(1440, (int) ($config['activeRunTtlMinutes'] ?? 60)));
            $ready_status = (string) ($state['status'] ?? 'AWAITING_ROOM_SELECTION');
            $update = $pdo->prepare(
                'UPDATE monument_extraction_runs
                 SET status = :status,
                     expires_at = DATE_ADD(NOW(), INTERVAL ' . $ttl . ' MINUTE),
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $update->execute(['status' => $ready_status, 'id' => (int) $row['id']]);
            $row['status'] = $ready_status;
            $row['is_expired'] = 0;
            return $row;
        }

        if (is_array($wager_request) && (string) $wager_request['status'] === 'processing') {
            $pdo->prepare('UPDATE monument_extraction_runs SET expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), updated_at = NOW() WHERE id = :id')
                ->execute(['id' => (int) $row['id']]);
            $row['is_expired'] = 0;
            return $row;
        }

        if (is_array($wager_request) && (string) $wager_request['status'] === 'queued') {
            $pdo->prepare(
                'UPDATE rp_point_requests
                 SET status = "canceled", message = "Monument run expired before wager processing.", processed_at = NOW(), updated_at = NOW()
                 WHERE id = :id AND status = "queued"'
            )->execute(['id' => (int) $wager_request['id']]);
        }

        raidlands_rewards_rollback_daily_wager($pdo, (int) $row['player_id'], (int) $row['wager_rp'], (int) $row['wager_rp']);
    }

    $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
    $state['status'] = 'EXPIRED';
    $state['failureReason'] = $reason;
    raidlands_monument_add_event($state, 'expired', $reason === 'ADMIN_EXPIRED' ? 'Run expired by an authorized admin.' : 'Run expired after inactivity.');
    $update = $pdo->prepare(
        'UPDATE monument_extraction_runs
         SET status = "EXPIRED",
             active_player_key = NULL,
             state_json = :state_json,
             failure_reason = :failure_reason,
             completed_at = NOW(),
             lock_version = lock_version + 1,
             updated_at = NOW()
         WHERE id = :id'
    );
    $update->execute([
        'state_json' => raidlands_monument_json($state),
        'failure_reason' => $reason,
        'id' => (int) $row['id'],
    ]);
    raidlands_monument_insert_system_action(
        $pdo,
        $row,
        'expire',
        ['status' => 'EXPIRED', 'reason' => $reason],
        'system-expire-' . (int) $row['id'] . '-' . ((int) $row['lock_version'] + 1),
        (int) $row['lock_version'] + 1,
        (int) ($state['drawCounter'] ?? 0)
    );
    $row['status'] = 'EXPIRED';
    $row['active_player_key'] = null;
    $row['state_json'] = raidlands_monument_json($state);
    $row['failure_reason'] = $reason;

    return $row;
}

function raidlands_monument_insert_system_action(
    PDO $pdo,
    array $row,
    string $action_type,
    array $result,
    string $client_action_id,
    int $sequence,
    int $draw_counter
): void {
    $statement = $pdo->prepare(
        'INSERT INTO monument_extraction_actions
            (run_id, player_id, client_action_id, sequence_number, action_type,
             request_payload_json, result_payload_json, random_draw_start, random_draw_end)
         VALUES
            (:run_id, :player_id, :client_action_id, :sequence_number, :action_type,
             NULL, :result_payload_json, :draw_start, :draw_end)
         ON DUPLICATE KEY UPDATE id = id'
    );
    $statement->execute([
        'run_id' => (int) $row['id'],
        'player_id' => (int) $row['player_id'],
        'client_action_id' => substr($client_action_id, 0, 64),
        'sequence_number' => $sequence,
        'action_type' => $action_type,
        'result_payload_json' => raidlands_monument_json($result),
        'draw_start' => $draw_counter,
        'draw_end' => $draw_counter,
    ]);
}

function raidlands_monument_expire_active_for_player(int $player_id): void
{
    if ($player_id <= 0 || !raidlands_monument_is_ready()) {
        return;
    }

    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $row = raidlands_monument_active_run_row($player_id, true);

        if ($row !== null && !empty($row['is_expired'])) {
            raidlands_monument_expire_row($pdo, $row);
        }

        if ($owns_transaction) {
            $pdo->commit();
        }
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_monument_public_run(array $row): array
{
    $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
    $config = raidlands_monument_decode_json($row['frozen_config_json'] ?? '', 'frozen configuration');
    $status = (string) ($row['status'] ?? $state['status'] ?? 'CREATING');
    $wager_request = !empty($row['wager_request_id'])
        ? raidlands_db_fetch_one(
            'SELECT status, message FROM rp_point_requests WHERE id = :id LIMIT 1',
            ['id' => (int) $row['wager_request_id']]
        )
        : null;
    $wager_status = is_array($wager_request) ? (string) ($wager_request['status'] ?? '') : '';
    $wager_message = is_array($wager_request) ? (string) ($wager_request['message'] ?? '') : '';

    if ($status === 'CREATING') {
        return [
            'id' => (string) $row['id'],
            'status' => 'CREATING',
            'wagerRp' => (int) $row['wager_rp'],
            'loadoutKey' => (string) $row['loadout_key'],
            'seedCommitment' => (string) $row['seed_commitment'],
            'wagerStatus' => $wager_status !== '' ? $wager_status : 'queued',
            'wagerMessage' => $wager_message,
            'payoutStatus' => (string) $row['payout_status'],
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'message' => 'Waiting for the Rust server to confirm the one-time wager debit.',
            'terminal' => false,
        ];
    }

    $state['status'] = $status;
    $terminal = raidlands_monument_terminal_status($status);
    $seed = $terminal ? raidlands_monument_decrypt_seed((string) $row['server_seed_encrypted']) : '';
    $public = raidlands_monument_public_state($state, $config, $terminal, $seed);
    $public['seedCommitment'] = (string) $row['seed_commitment'];
    $public['wagerStatus'] = $wager_status;
    $public['wagerMessage'] = $wager_message;
    $public['payoutStatus'] = (string) $row['payout_status'];
    $public['failureReason'] = (string) ($row['failure_reason'] ?? $state['failureReason'] ?? '');
    $public['configVersionId'] = (int) $row['config_version_id'];
    $public['startedAt'] = (string) $row['started_at'];
    $public['createdAt'] = (string) ($row['created_at'] ?? '');
    $public['expiresAt'] = (string) ($row['expires_at'] ?? '');
    $public['completedAt'] = (string) ($row['completed_at'] ?? '');

    if ($terminal && isset($public['fairness'])) {
        $public['fairness']['commitmentMatches'] = hash_equals((string) $row['seed_commitment'], hash('sha256', $seed));
        $public['fairness']['drawsVerify'] = raidlands_monument_verify_audit((string) $row['id'], $seed, (array) ($state['draws'] ?? []));
    }

    return $public;
}

function raidlands_monument_verify_audit(string $run_id, string $server_seed, array $draws): bool
{
    foreach ($draws as $draw) {
        if (!is_array($draw) || !raidlands_monument_verify_draw($run_id, $server_seed, $draw)) {
            return false;
        }
    }

    return true;
}

function raidlands_monument_public_config(array $config): array
{
    return [
        'minWagerRp' => (int) $config['minWagerRp'],
        'maxWagerRp' => (int) $config['maxWagerRp'],
        'maxPayoutRp' => (int) $config['maxPayoutRp'],
        'activeRunTtlMinutes' => (int) $config['activeRunTtlMinutes'],
        'loadouts' => $config['loadouts'],
        'extractions' => array_map(
            static fn (array $route): array => [
                'label' => (string) $route['label'],
                'description' => (string) $route['description'],
                'modifierBps' => (int) $route['modifierBps'],
            ],
            $config['extractions']
        ),
        'uiText' => $config['uiText'],
    ];
}

function raidlands_monument_bootstrap_state(): array
{
    raidlands_store_boot();
    $player = raidlands_store_current_player();
    $ready = raidlands_monument_is_ready();
    $settings = $ready ? raidlands_monument_settings() : ['enabled' => false, 'gameEnabled' => false, 'masterEnabled' => false];
    $config = raidlands_monument_default_config();
    $active_run = null;
    $history = [];
    $balance = null;

    if ($ready) {
        $config_row = raidlands_monument_active_config_row();
        $config = $config_row['config'];
    }

    if (raidlands_rewards_player_ready($player)) {
        $player_id = (int) $player['id'];
        $balance = raidlands_store_current_rp_balance($player_id);

        if ($ready) {
            raidlands_monument_expire_active_for_player($player_id);
            $row = raidlands_monument_active_run_row($player_id);
            $active_run = $row === null ? null : raidlands_monument_public_run($row);
            $history = raidlands_monument_history($player_id, 12);
        }
    }

    return [
        'ready' => $ready,
        'message' => $ready ? '' : raidlands_monument_readiness_message(),
        'enabled' => $ready && !empty($settings['enabled']) && !empty($config['enabled']),
        'settings' => $settings,
        'player' => raidlands_rewards_player_ready($player) ? [
            'id' => (int) $player['id'],
            'steamId64' => (string) $player['steam_id64'],
            'displayName' => (string) ($player['display_name'] ?? $player['steam_display_name'] ?? 'Raidlands Player'),
        ] : null,
        'balance' => $balance,
        'config' => raidlands_monument_public_config($config),
        'activeRun' => $active_run,
        'history' => $history,
    ];
}

function raidlands_monument_available_balance(int $player_id): int
{
    $balance = raidlands_store_current_rp_balance($player_id);
    $reported = max(0, (int) ($balance['reward_points'] ?? 0));
    $pending = raidlands_db_fetch_one(
        'SELECT COALESCE(SUM(CASE WHEN debit_rp > credit_rp THEN debit_rp - credit_rp ELSE 0 END), 0) AS pending_debit
         FROM rp_point_requests
         WHERE player_id = :player_id
           AND status IN ("queued", "processing")',
        ['player_id' => $player_id]
    );

    return max(0, $reported - (int) ($pending['pending_debit'] ?? 0));
}

function raidlands_monument_start_run(int $wager_rp, string $loadout_key, string $client_action_id): array
{
    if (!raidlands_monument_is_ready()) {
        throw new RuntimeException(raidlands_monument_readiness_message());
    }

    $player = raidlands_rewards_require_player();
    $player_id = (int) $player['id'];
    $client_action_id = raidlands_monument_validate_action_id($client_action_id);
    $available_balance = raidlands_monument_available_balance($player_id);
    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $lock = $pdo->prepare('SELECT id FROM players WHERE id = :id FOR UPDATE');
        $lock->execute(['id' => $player_id]);
        $duplicate = $pdo->prepare(
            'SELECT a.run_id
             FROM monument_extraction_actions a
             WHERE a.player_id = :player_id AND a.client_action_id = :client_action_id
             LIMIT 1 FOR UPDATE'
        );
        $duplicate->execute(['player_id' => $player_id, 'client_action_id' => $client_action_id]);
        $existing_action = $duplicate->fetch(PDO::FETCH_ASSOC);

        if (is_array($existing_action)) {
            $row = raidlands_monument_run_row((int) $existing_action['run_id'], $player_id, true);

            if ($row === null) {
                throw new RuntimeException('The idempotent Monument Extraction run could not be recovered.');
            }

            if ($owns_transaction) {
                $pdo->commit();
            }

            return ['run' => raidlands_monument_public_run($row), 'duplicate' => true];
        }

        $active = raidlands_monument_active_run_row($player_id, true);

        if ($active !== null) {
            throw new RuntimeException('Finish, abandon, or expire your active Monument Extraction run first.');
        }

        $settings = raidlands_rewards_settings();
        raidlands_rewards_require_games_open($settings, 'monument_extraction');

        if (raidlands_rewards_self_excluded($player_id)) {
            throw new RuntimeException('RP games are disabled for this account.');
        }

        $config_row = raidlands_monument_active_config_row(true);
        $config = $config_row['config'];

        if (empty($config['enabled'])) {
            throw new RuntimeException('Monument Extraction is disabled in the active configuration.');
        }

        $wager_rp = (int) $wager_rp;

        if ($wager_rp < (int) $config['minWagerRp'] || $wager_rp > (int) $config['maxWagerRp']) {
            throw new RuntimeException('Wager must be between ' . raidlands_store_rp((int) $config['minWagerRp']) . ' and ' . raidlands_store_rp((int) $config['maxWagerRp']) . '.');
        }

        if ($available_balance < $wager_rp) {
            throw new RuntimeException('Your available synced RP balance is too low for that wager.');
        }

        raidlands_rewards_check_daily_limits($player, $settings, $wager_rp, $wager_rp);

        if (!isset($config['loadouts'][$loadout_key])) {
            throw new InvalidArgumentException('Choose a valid Monument Extraction loadout.');
        }

        $cooldown = max(0, min(3600, (int) ($config['cooldownSeconds'] ?? 0)));
        $recent = $pdo->prepare(
            'SELECT (last_action_at > DATE_SUB(NOW(), INTERVAL ' . $cooldown . ' SECOND)) AS cooling_down
             FROM monument_extraction_runs
             WHERE player_id = :player_id
             ORDER BY id DESC
             LIMIT 1 FOR UPDATE'
        );
        $recent->execute(['player_id' => $player_id]);
        $recent_row = $recent->fetch(PDO::FETCH_ASSOC);

        if (is_array($recent_row) && $cooldown > 0 && !empty($recent_row['cooling_down'])) {
            throw new RuntimeException('Wait a few seconds before starting another Monument Extraction run.');
        }

        $server_seed = bin2hex(random_bytes(32));
        $seed_commitment = hash('sha256', $server_seed);
        $encrypted_seed = raidlands_monument_encrypt_seed($server_seed);
        $frozen_json = raidlands_monument_json($config);
        $placeholder = raidlands_monument_json(['status' => 'CREATING']);
        $ttl = max(5, min(1440, (int) $config['activeRunTtlMinutes']));
        $insert = $pdo->prepare(
            'INSERT INTO monument_extraction_runs
                (player_id, steam_id64, active_player_key, status, wager_rp, loadout_key,
                 config_version_id, frozen_config_json, seed_commitment, server_seed_encrypted,
                 state_json, expires_at)
             VALUES
                (:player_id, :steam_id64, :active_player_key, "CREATING", :wager_rp, :loadout_key,
                 :config_version_id, :frozen_config_json, :seed_commitment, :server_seed_encrypted,
                 :state_json, DATE_ADD(NOW(), INTERVAL ' . $ttl . ' MINUTE))'
        );
        $insert->execute([
            'player_id' => $player_id,
            'steam_id64' => (string) $player['steam_id64'],
            'active_player_key' => $player_id,
            'wager_rp' => $wager_rp,
            'loadout_key' => $loadout_key,
            'config_version_id' => (int) $config_row['id'],
            'frozen_config_json' => $frozen_json,
            'seed_commitment' => $seed_commitment,
            'server_seed_encrypted' => $encrypted_seed,
            'state_json' => $placeholder,
        ]);
        $run_id = (int) $pdo->lastInsertId();
        $state = raidlands_monument_engine_new((string) $run_id, $wager_rp, $loadout_key, $config, $server_seed);
        $request = raidlands_rewards_queue_point_request(
            $pdo,
            $player_id,
            (string) $player['steam_id64'],
            'monument_wager',
            (string) $run_id,
            $wager_rp,
            0,
            'Monument Extraction wager',
            ['run_id' => $run_id, 'loadout' => $loadout_key, 'client_action_id' => $client_action_id],
            max(3600, $ttl * 60)
        );
        $update = $pdo->prepare('UPDATE monument_extraction_runs SET state_json = :state_json, wager_request_id = :request_id WHERE id = :id');
        $update->execute(['state_json' => raidlands_monument_json($state), 'request_id' => (int) $request['id'], 'id' => $run_id]);
        raidlands_rewards_record_daily_wager($pdo, $player, $wager_rp, $wager_rp);
        $action = $pdo->prepare(
            'INSERT INTO monument_extraction_actions
                (run_id, player_id, client_action_id, sequence_number, action_type, request_payload_json, result_payload_json, random_draw_start, random_draw_end)
             VALUES
                (:run_id, :player_id, :client_action_id, 0, "start", :request_payload_json, :result_payload_json, 0, :draw_end)'
        );
        $action->execute([
            'run_id' => $run_id,
            'player_id' => $player_id,
            'client_action_id' => $client_action_id,
            'request_payload_json' => raidlands_monument_json(['wagerRp' => $wager_rp, 'loadoutKey' => $loadout_key]),
            'result_payload_json' => raidlands_monument_json(['status' => 'CREATING', 'requestId' => (int) $request['id']]),
            'draw_end' => (int) $state['drawCounter'],
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }

        $row = raidlands_monument_run_row($run_id, $player_id);

        if ($row === null) {
            throw new RuntimeException('Monument Extraction run was created but could not be loaded.');
        }

        return ['run' => raidlands_monument_public_run($row), 'duplicate' => false];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_monument_apply_action(int $run_id, string $client_action_id, array $command): array
{
    if (!raidlands_monument_is_ready()) {
        throw new RuntimeException(raidlands_monument_readiness_message());
    }

    $player = raidlands_rewards_require_player();
    $player_id = (int) $player['id'];
    $client_action_id = raidlands_monument_validate_action_id($client_action_id);
    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $row = raidlands_monument_run_row($run_id, $player_id, true);

        if ($row === null) {
            throw new RuntimeException('That Monument Extraction run was not found.');
        }

        $duplicate = $pdo->prepare(
            'SELECT result_payload_json
             FROM monument_extraction_actions
             WHERE player_id = :player_id AND client_action_id = :client_action_id
             LIMIT 1 FOR UPDATE'
        );
        $duplicate->execute(['player_id' => $player_id, 'client_action_id' => $client_action_id]);
        $existing = $duplicate->fetch(PDO::FETCH_ASSOC);

        if (is_array($existing)) {
            $payload = raidlands_monument_decode_json($existing['result_payload_json'] ?? '{}', 'action result');

            if ($owns_transaction) {
                $pdo->commit();
            }

            return ['run' => $payload['run'] ?? raidlands_monument_public_run($row), 'result' => $payload['result'] ?? [], 'duplicate' => true];
        }

        if (!empty($row['is_expired'])) {
            $row = raidlands_monument_expire_row($pdo, $row);

            if (raidlands_monument_terminal_status((string) $row['status']) || (string) $row['status'] === 'CREATING') {
                if ($owns_transaction) {
                    $pdo->commit();
                }

                return [
                    'run' => raidlands_monument_public_run($row),
                    'result' => ['type' => 'expire', 'terminal' => raidlands_monument_terminal_status((string) $row['status'])],
                    'duplicate' => false,
                ];
            }
        }

        if ((string) $row['status'] === 'CREATING') {
            throw new RuntimeException('The wager debit is still waiting for Rust server confirmation.');
        }

        if (raidlands_monument_terminal_status((string) $row['status'])) {
            throw new RuntimeException('That Monument Extraction run is already over.');
        }

        $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
        $config = raidlands_monument_decode_json($row['frozen_config_json'] ?? '', 'frozen configuration');
        $state['status'] = (string) $row['status'];
        $server_seed = raidlands_monument_decrypt_seed((string) $row['server_seed_encrypted']);
        $applied = raidlands_monument_engine_apply($state, $command, $config, $server_seed);
        $next = $applied['state'];
        $next_status = (string) $next['status'];
        $payout_request_id = null;
        $payout_status = (string) $row['payout_status'];

        if ($next_status === 'COMPLETED' && (int) ($next['payoutRp'] ?? 0) > 0) {
            if (!empty($row['payout_request_id'])) {
                throw new RuntimeException('A payout has already been queued for this run.');
            }

            $request = raidlands_rewards_queue_point_request(
                $pdo,
                $player_id,
                (string) $player['steam_id64'],
                'monument_payout',
                (string) $run_id,
                0,
                (int) $next['payoutRp'],
                'Monument Extraction payout',
                [
                    'run_id' => $run_id,
                    'method' => (string) ($next['extractionMethod'] ?? ''),
                    'multiplier_bps' => (int) ($next['payoutMultiplierBps'] ?? 0),
                ]
            );
            $payout_request_id = (int) $request['id'];
            $payout_status = 'queued';
        } elseif ($next_status === 'COMPLETED') {
            $payout_status = 'no_payout';
        }

        $terminal = raidlands_monument_terminal_status($next_status);
        $update = $pdo->prepare(
            'UPDATE monument_extraction_runs
             SET status = :status,
                 active_player_key = :active_player_key,
                 state_json = :state_json,
                 payout_rp = :payout_rp,
                 payout_multiplier_bps = :payout_multiplier_bps,
                 payout_request_id = COALESCE(:payout_request_id, payout_request_id),
                 payout_status = :payout_status,
                 failure_reason = :failure_reason,
                 last_action_at = NOW(),
                 expires_at = CASE WHEN :terminal_flag = 1 THEN expires_at ELSE DATE_ADD(NOW(), INTERVAL :ttl_minutes MINUTE) END,
                 completed_at = CASE WHEN :terminal_complete = 1 THEN NOW() ELSE completed_at END,
                 lock_version = lock_version + 1,
                 updated_at = NOW()
             WHERE id = :id AND lock_version = :lock_version'
        );
        $update->execute([
            'status' => $next_status,
            'active_player_key' => $terminal ? null : $player_id,
            'state_json' => raidlands_monument_json($next),
            'payout_rp' => max(0, (int) ($next['payoutRp'] ?? 0)),
            'payout_multiplier_bps' => max(0, (int) ($next['payoutMultiplierBps'] ?? 0)),
            'payout_request_id' => $payout_request_id,
            'payout_status' => $payout_status,
            'failure_reason' => (string) ($next['failureReason'] ?? ''),
            'terminal_flag' => $terminal ? 1 : 0,
            'terminal_complete' => $terminal ? 1 : 0,
            'ttl_minutes' => max(5, min(1440, (int) $config['activeRunTtlMinutes'])),
            'id' => $run_id,
            'lock_version' => (int) $row['lock_version'],
        ]);

        if ($update->rowCount() !== 1) {
            throw new RuntimeException('The run changed before this action could be saved. Refresh and try again.');
        }

        $next_row = array_merge($row, [
            'status' => $next_status,
            'active_player_key' => $terminal ? null : $player_id,
            'state_json' => raidlands_monument_json($next),
            'payout_rp' => max(0, (int) ($next['payoutRp'] ?? 0)),
            'payout_multiplier_bps' => max(0, (int) ($next['payoutMultiplierBps'] ?? 0)),
            'payout_request_id' => $payout_request_id ?? $row['payout_request_id'],
            'payout_status' => $payout_status,
            'failure_reason' => (string) ($next['failureReason'] ?? ''),
            'completed_at' => $terminal ? gmdate('Y-m-d H:i:s') : $row['completed_at'],
        ]);
        $public = raidlands_monument_public_run($next_row);
        $result_payload = ['run' => $public, 'result' => $applied['result']];
        $sequence = (int) $row['lock_version'] + 1;
        $action = $pdo->prepare(
            'INSERT INTO monument_extraction_actions
                (run_id, player_id, client_action_id, sequence_number, action_type, request_payload_json, result_payload_json, random_draw_start, random_draw_end)
             VALUES
                (:run_id, :player_id, :client_action_id, :sequence_number, :action_type, :request_payload_json, :result_payload_json, :random_draw_start, :random_draw_end)'
        );
        $action->execute([
            'run_id' => $run_id,
            'player_id' => $player_id,
            'client_action_id' => $client_action_id,
            'sequence_number' => $sequence,
            'action_type' => (string) ($command['type'] ?? ''),
            'request_payload_json' => raidlands_monument_json($command),
            'result_payload_json' => raidlands_monument_json($result_payload),
            'random_draw_start' => (int) $applied['randomDrawStart'],
            'random_draw_end' => (int) $applied['randomDrawEnd'],
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }

        return ['run' => $public, 'result' => $applied['result'], 'duplicate' => false];
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function raidlands_monument_history(int $player_id, int $limit = 12): array
{
    if ($player_id <= 0 || !raidlands_monument_is_ready()) {
        return [];
    }

    $rows = raidlands_db_fetch_all(
        'SELECT id, status, wager_rp, payout_rp, payout_multiplier_bps, loadout_key,
                payout_status, failure_reason, seed_commitment, started_at, completed_at
         FROM monument_extraction_runs
         WHERE player_id = :player_id
         ORDER BY id DESC
         LIMIT ' . max(1, min(50, $limit)),
        ['player_id' => $player_id]
    );

    return array_map(static fn (array $row): array => [
        'id' => (string) $row['id'],
        'status' => (string) $row['status'],
        'wagerRp' => (int) $row['wager_rp'],
        'payoutRp' => (int) $row['payout_rp'],
        'payoutMultiplierBps' => (int) $row['payout_multiplier_bps'],
        'loadoutKey' => (string) $row['loadout_key'],
        'payoutStatus' => (string) $row['payout_status'],
        'failureReason' => (string) $row['failure_reason'],
        'seedCommitment' => (string) $row['seed_commitment'],
        'startedAt' => (string) $row['started_at'],
        'completedAt' => (string) ($row['completed_at'] ?? ''),
        'auditAvailable' => raidlands_monument_terminal_status((string) $row['status']),
    ], $rows);
}

function raidlands_monument_recent_activity(int $player_id = 0, int $limit = 12): array
{
    if (!raidlands_monument_is_ready()) {
        return [];
    }

    $params = [];
    $where = '';

    if ($player_id > 0) {
        $where = 'WHERE m.player_id = :player_id';
        $params['player_id'] = $player_id;
    }

    $rows = raidlands_db_fetch_all(
        'SELECT m.id, m.status AS run_status, m.wager_rp, m.payout_rp, m.loadout_key,
                m.payout_status, m.created_at,
                wager.status AS wager_request_status,
                payout.status AS payout_request_status
         FROM monument_extraction_runs m
         LEFT JOIN rp_point_requests wager ON wager.id = m.wager_request_id
         LEFT JOIN rp_point_requests payout ON payout.id = m.payout_request_id
         ' . $where . '
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ' . max(1, min(50, $limit)),
        $params
    );

    return array_map(static function (array $row): array {
        $run_status = strtoupper((string) ($row['run_status'] ?? 'CREATING'));
        $wager_status = strtolower((string) ($row['wager_request_status'] ?? 'queued'));
        $payout_status = strtolower((string) ($row['payout_request_status'] ?? $row['payout_status'] ?? ''));

        if ($run_status === 'CREATING') {
            $activity_status = $wager_status !== '' ? $wager_status : 'queued';
        } elseif (!raidlands_monument_terminal_status($run_status)) {
            $activity_status = 'active';
        } elseif ((int) ($row['payout_rp'] ?? 0) > 0) {
            $activity_status = $payout_status !== '' && $payout_status !== 'none' ? $payout_status : 'queued';
        } elseif ($run_status === 'FAILED') {
            $activity_status = 'failed';
        } elseif ($run_status === 'COMPLETED') {
            $activity_status = 'succeeded';
        } else {
            $activity_status = strtolower($run_status);
        }

        return [
            'id' => 'monument-' . (int) $row['id'],
            'activity_key' => 'monument-' . (int) $row['id'],
            'game_type' => 'monument_extraction',
            'stake_rp' => (int) $row['wager_rp'],
            'roll_result' => ucwords(str_replace('_', ' ', (string) $row['loadout_key'])) . ' / Run #' . (int) $row['id'],
            'payout_rp' => (int) $row['payout_rp'],
            'status' => $activity_status,
            'created_at' => (string) $row['created_at'],
        ];
    }, $rows);
}

function raidlands_monument_audit(int $run_id): array
{
    $player = raidlands_rewards_require_player();
    $row = raidlands_monument_run_row($run_id, (int) $player['id']);

    if ($row === null) {
        throw new RuntimeException('That Monument Extraction run was not found.');
    }

    if (!raidlands_monument_terminal_status((string) $row['status'])) {
        return [
            'runId' => (string) $row['id'],
            'status' => (string) $row['status'],
            'seedCommitment' => (string) $row['seed_commitment'],
            'revealed' => false,
        ];
    }

    $public = raidlands_monument_public_run($row);

    return [
        'runId' => (string) $row['id'],
        'status' => (string) $row['status'],
        'seedCommitment' => (string) $row['seed_commitment'],
        'revealed' => true,
        'fairness' => $public['fairness'] ?? null,
    ];
}

function raidlands_monument_sync_point_result(PDO $pdo, array $request, string $status, string $message, string $fail_code): bool
{
    $source_type = (string) ($request['source_type'] ?? '');

    if (!in_array($source_type, ['monument_wager', 'monument_payout'], true) || !raidlands_monument_is_ready()) {
        return false;
    }

    $run_id = (int) ($request['source_id'] ?? 0);
    $statement = $pdo->prepare('SELECT * FROM monument_extraction_runs WHERE id = :id FOR UPDATE');
    $statement->execute(['id' => $run_id]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);

    if (!is_array($row)) {
        return true;
    }

    if ($source_type === 'monument_payout') {
        $payout_status = $status === 'confirmed' ? 'confirmed' : (in_array($status, ['rejected', 'failed', 'expired'], true) ? 'failed' : $status);

        if ((string) $row['payout_status'] === $payout_status) {
            return true;
        }

        $update = $pdo->prepare('UPDATE monument_extraction_runs SET payout_status = :payout_status, lock_version = lock_version + 1, updated_at = NOW() WHERE id = :id');
        $update->execute(['payout_status' => $payout_status, 'id' => $run_id]);
        $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
        raidlands_monument_insert_system_action(
            $pdo,
            $row,
            'payout_' . $payout_status,
            ['payoutStatus' => $payout_status, 'message' => $message, 'failCode' => $fail_code],
            'bridge-payout-' . (int) $request['id'],
            (int) $row['lock_version'] + 1,
            (int) ($state['drawCounter'] ?? 0)
        );

        return true;
    }

    if ($status === 'confirmed' && (string) $row['status'] === 'CREATING') {
        $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
        $next_status = (string) ($state['status'] ?? 'AWAITING_ROOM_SELECTION');
        $update = $pdo->prepare(
            'UPDATE monument_extraction_runs
             SET status = :status,
                 last_action_at = NOW(),
                 lock_version = lock_version + 1,
                 updated_at = NOW()
             WHERE id = :id AND status = "CREATING"'
        );
        $update->execute(['status' => $next_status, 'id' => $run_id]);
        raidlands_monument_insert_system_action(
            $pdo,
            $row,
            'wager_confirmed',
            ['status' => $next_status, 'message' => $message],
            'bridge-wager-' . (int) $request['id'],
            (int) $row['lock_version'] + 1,
            (int) ($state['drawCounter'] ?? 0)
        );

        return true;
    }

    if (in_array($status, ['rejected', 'failed', 'expired'], true) && (string) $row['status'] === 'CREATING') {
        $state = raidlands_monument_decode_json($row['state_json'] ?? '', 'run state');
        $state['status'] = 'FAILED';
        $state['failureReason'] = 'WAGER_' . strtoupper($status);
        raidlands_monument_add_event($state, 'wager_failed', $message !== '' ? $message : 'The Rust server did not confirm the wager debit.');
        $update = $pdo->prepare(
            'UPDATE monument_extraction_runs
             SET status = "FAILED",
                 active_player_key = NULL,
                 state_json = :state_json,
                 failure_reason = :failure_reason,
                 completed_at = NOW(),
                 lock_version = lock_version + 1,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $update->execute([
            'state_json' => raidlands_monument_json($state),
            'failure_reason' => 'WAGER_' . strtoupper($status),
            'id' => $run_id,
        ]);
        raidlands_monument_insert_system_action(
            $pdo,
            $row,
            'wager_' . $status,
            ['status' => 'FAILED', 'reason' => 'WAGER_' . strtoupper($status), 'message' => $message, 'failCode' => $fail_code],
            'bridge-wager-' . (int) $request['id'],
            (int) $row['lock_version'] + 1,
            (int) ($state['drawCounter'] ?? 0)
        );
        raidlands_rewards_rollback_daily_wager($pdo, (int) $row['player_id'], (int) $row['wager_rp'], (int) $row['wager_rp']);
    }

    return true;
}

function raidlands_monument_admin_state(): array
{
    if (!raidlands_monument_is_ready()) {
        return ['ready' => false, 'message' => raidlands_monument_readiness_message(), 'config' => [], 'metrics' => [], 'runs' => []];
    }

    $row = raidlands_monument_active_config_row();
    $metrics = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS runs,
                COALESCE(SUM(wager_rp), 0) AS wagered_rp,
                COALESCE(SUM(CASE WHEN status = "COMPLETED" THEN payout_rp ELSE 0 END), 0) AS paid_rp,
                SUM(status = "COMPLETED") AS completed,
                SUM(status = "FAILED") AS failed,
                SUM(status = "ABANDONED") AS abandoned,
                SUM(status = "EXPIRED") AS expired
         FROM monument_extraction_runs'
    ) ?? [];
    $runs = raidlands_db_fetch_all(
        'SELECT id, player_id, steam_id64, status, wager_rp, payout_rp, loadout_key, payout_status, failure_reason, started_at, last_action_at
         FROM monument_extraction_runs
         ORDER BY id DESC
         LIMIT 20'
    );

    return [
        'ready' => true,
        'message' => '',
        'configRow' => $row,
        'config' => $row['config'],
        'metrics' => $metrics,
        'runs' => $runs,
    ];
}

function raidlands_monument_admin_save(array $post): string
{
    if (!raidlands_monument_is_ready()) {
        throw new RuntimeException(raidlands_monument_readiness_message());
    }

    $active = raidlands_monument_active_config_row();
    $config_json = trim((string) ($post['monument_config_json'] ?? ''));
    $config = $config_json !== '' ? json_decode($config_json, true) : $active['config'];

    if (!is_array($config)) {
        throw new InvalidArgumentException('Monument Extraction configuration must be valid JSON.');
    }

    $config['enabled'] = !empty($post['monument_extraction_enabled']);
    $config['minWagerRp'] = max(1, (int) ($post['monument_min_wager_rp'] ?? $config['minWagerRp']));
    $config['maxWagerRp'] = max((int) $config['minWagerRp'], (int) ($post['monument_max_wager_rp'] ?? $config['maxWagerRp']));
    $config['maxPayoutRp'] = max(0, (int) ($post['monument_max_payout_rp'] ?? $config['maxPayoutRp']));
    $config['activeRunTtlMinutes'] = max(5, min(1440, (int) ($post['monument_ttl_minutes'] ?? $config['activeRunTtlMinutes'])));
    raidlands_monument_validate_config($config);
    $json = raidlands_monument_json($config);
    $hash = hash('sha256', $json);
    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    try {
        $pdo->exec('UPDATE monument_extraction_config_versions SET is_active = 0 WHERE is_active = 1');
        $existing = $pdo->prepare('SELECT id FROM monument_extraction_config_versions WHERE config_hash = :config_hash LIMIT 1 FOR UPDATE');
        $existing->execute(['config_hash' => $hash]);
        $existing_row = $existing->fetch(PDO::FETCH_ASSOC);
        $admin = function_exists('raidlands_admin_current_user') ? raidlands_admin_current_user() : null;
        $admin_id = is_array($admin) && !empty($admin['id']) ? (int) $admin['id'] : null;

        if (is_array($existing_row)) {
            $update = $pdo->prepare('UPDATE monument_extraction_config_versions SET is_active = 1, activated_at = NOW() WHERE id = :id');
            $update->execute(['id' => (int) $existing_row['id']]);
        } else {
            $insert = $pdo->prepare(
                'INSERT INTO monument_extraction_config_versions
                    (version_name, schema_version, config_json, config_hash, is_active, created_by, activated_at)
                 VALUES
                    (:version_name, :schema_version, :config_json, :config_hash, 1, :created_by, NOW())'
            );
            $insert->execute([
                'version_name' => 'admin-' . gmdate('Ymd-His'),
                'schema_version' => (int) $config['schemaVersion'],
                'config_json' => $json,
                'config_hash' => $hash,
                'created_by' => $admin_id,
            ]);
        }

        $setting = $pdo->prepare('UPDATE rp_game_settings SET monument_extraction_enabled = :enabled, updated_at = NOW() WHERE id = 1');
        $setting->execute(['enabled' => !empty($config['enabled']) ? 1 : 0]);

        if (!empty($post['monument_force_expire_run_id'])) {
            $run_id = (int) $post['monument_force_expire_run_id'];
            $run = $pdo->prepare('SELECT * FROM monument_extraction_runs WHERE id = :id FOR UPDATE');
            $run->execute(['id' => $run_id]);
            $run_row = $run->fetch(PDO::FETCH_ASSOC);

            if (!is_array($run_row)) {
                throw new RuntimeException('The requested Monument Extraction run was not found.');
            }

            raidlands_monument_expire_row($pdo, $run_row, 'ADMIN_EXPIRED');
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    return 'Monument Extraction configuration version activated' . (!empty($config['enabled']) ? ' and enabled.' : ' with the feature disabled.');
}

function raidlands_monument_read_request_body(): array
{
    $content_type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

    if (str_contains($content_type, 'application/json')) {
        $raw = file_get_contents('php://input');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        if (!is_array($decoded)) {
            throw new InvalidArgumentException('Request body must be valid JSON.');
        }

        return $decoded;
    }

    return $_POST;
}

function raidlands_monument_check_rate_limits(array $player, string $action): void
{
    if (!raidlands_store_table_exists('api_rate_limits')) {
        return;
    }

    $limit = $action === 'start' ? 6 : 90;
    $window_start = gmdate('Y-m-d H:i:00');
    $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $keys = [
        'player:' . (int) $player['id'],
        'ip:' . substr(hash('sha256', $ip), 0, 32),
    ];

    foreach ($keys as $rate_key) {
        raidlands_db_execute(
            'INSERT INTO api_rate_limits (rate_key, route_key, window_start, request_count)
             VALUES (:rate_key, :route_key, :window_start, 1)
             ON DUPLICATE KEY UPDATE request_count = request_count + 1, updated_at = NOW()',
            [
                'rate_key' => $rate_key,
                'route_key' => 'monument:' . $action,
                'window_start' => $window_start,
            ]
        );
        $row = raidlands_db_fetch_one(
            'SELECT request_count
             FROM api_rate_limits
             WHERE rate_key = :rate_key AND route_key = :route_key AND window_start = :window_start',
            [
                'rate_key' => $rate_key,
                'route_key' => 'monument:' . $action,
                'window_start' => $window_start,
            ]
        );

        if ((int) ($row['request_count'] ?? 0) > $limit) {
            header('Retry-After: 60');
            throw new RuntimeException('Monument Extraction rate limit exceeded. Try again in a minute.');
        }
    }

    if (random_int(1, 100) === 1) {
        raidlands_db_execute('DELETE FROM api_rate_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');
    }
}

function raidlands_monument_handle_api_request(): void
{
    raidlands_store_boot();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    try {
        if ($method === 'GET') {
            $action = strtolower(trim((string) ($_GET['action'] ?? 'bootstrap')));

            if ($action === 'bootstrap') {
                $payload = ['ok' => true, 'state' => raidlands_monument_bootstrap_state()];
            } elseif ($action === 'run') {
                $player = raidlands_rewards_require_player();
                raidlands_monument_expire_active_for_player((int) $player['id']);
                $run_id = (int) ($_GET['runId'] ?? 0);
                $row = $run_id > 0
                    ? raidlands_monument_run_row($run_id, (int) $player['id'])
                    : raidlands_monument_active_run_row((int) $player['id']);
                $payload = ['ok' => true, 'run' => $row === null ? null : raidlands_monument_public_run($row)];
            } elseif ($action === 'history') {
                $player = raidlands_rewards_require_player();
                $payload = ['ok' => true, 'history' => raidlands_monument_history((int) $player['id'], 30)];
            } elseif ($action === 'audit') {
                $payload = ['ok' => true, 'audit' => raidlands_monument_audit((int) ($_GET['runId'] ?? 0))];
            } else {
                throw new InvalidArgumentException('Unknown Monument Extraction API action.');
            }
        } elseif ($method === 'POST') {
            $body = raidlands_monument_read_request_body();
            $csrf = trim((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $body['csrf'] ?? ''));

            if (!raidlands_store_validate_csrf($csrf)) {
                throw new RuntimeException('Your Monument Extraction session expired. Refresh and try again.');
            }

            $action = strtolower(trim((string) ($body['action'] ?? '')));
            $client_action_id = (string) ($body['clientActionId'] ?? '');
            $rate_player = raidlands_rewards_require_player();
            raidlands_monument_check_rate_limits($rate_player, $action);

            if ($action === 'start') {
                $result = raidlands_monument_start_run((int) ($body['wagerRp'] ?? 0), (string) ($body['loadoutKey'] ?? ''), $client_action_id);
            } else {
                $run_id = (int) ($body['runId'] ?? 0);
                $command = ['type' => $action];

                if ($action === 'enter_room') {
                    $command['roomId'] = (string) ($body['roomId'] ?? '');
                } elseif ($action === 'resolve_encounter') {
                    $command['approachKey'] = (string) ($body['approachKey'] ?? '');
                } elseif ($action === 'loot_decision') {
                    $command['decision'] = (string) ($body['decision'] ?? '');
                    $command['discardItemIds'] = (array) ($body['discardItemIds'] ?? []);
                } elseif ($action === 'inventory_action') {
                    $command['inventoryAction'] = (string) ($body['inventoryAction'] ?? '');
                    $command['itemId'] = (string) ($body['itemId'] ?? '');
                    $command['enabled'] = !empty($body['enabled']);
                } elseif ($action === 'extract') {
                    $command['methodKey'] = (string) ($body['methodKey'] ?? '');
                } elseif ($action !== 'abandon') {
                    throw new InvalidArgumentException('Unknown Monument Extraction API action.');
                }

                $result = raidlands_monument_apply_action($run_id, $client_action_id, $command);
            }

            $payload = ['ok' => true] + $result;
        } else {
            http_response_code(405);
            $payload = ['ok' => false, 'message' => 'Method not allowed.'];
        }
    } catch (InvalidArgumentException $error) {
        http_response_code(422);
        $payload = ['ok' => false, 'message' => $error->getMessage()];
    } catch (Throwable $error) {
        http_response_code(str_contains(strtolower($error->getMessage()), 'rate limit') ? 429 : 409);
        $payload = ['ok' => false, 'message' => $error->getMessage()];
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
