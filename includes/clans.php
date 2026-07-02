<?php

require_once __DIR__ . '/store.php';

function raidlands_clans_server_id(): string
{
    global $vip_bridge_config;

    $server_id = trim((string) ($vip_bridge_config['serverId'] ?? 'raidlands-main'));

    return $server_id !== '' ? $server_id : 'raidlands-main';
}

function raidlands_clans_allowed_actions(): array
{
    return ['invite', 'withdraw_invite', 'kick', 'promote', 'demote', 'disband'];
}

function raidlands_clans_normalize_action(string $action): string
{
    $action = strtolower(str_replace('-', '_', trim($action)));

    return $action === 'withdraw' ? 'withdraw_invite' : $action;
}

function raidlands_clans_normalize_steam_id(string $steam_id64): string
{
    return preg_replace('/\D+/', '', $steam_id64) ?? '';
}

function raidlands_clans_encode_json($value): string
{
    $json = json_encode($value, JSON_UNESCAPED_SLASHES);

    if (!is_string($json)) {
        return '[]';
    }

    return $json;
}

function raidlands_clans_decode_json(?string $json): array
{
    if ($json === null || trim($json) === '') {
        return [];
    }

    $decoded = json_decode($json, true);

    return is_array($decoded) ? $decoded : [];
}

function raidlands_clans_role_can_manage(string $role, string $action): bool
{
    $role = strtolower($role);

    if (in_array($action, ['promote', 'demote', 'disband'], true)) {
        return $role === 'owner';
    }

    return in_array($role, ['owner', 'moderator'], true);
}

function raidlands_clans_role_for_player(string $steam_id64, ?string $server_id = null): ?array
{
    $steam_id64 = raidlands_clans_normalize_steam_id($steam_id64);

    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        'SELECT cm.server_id, cm.clan_tag, cm.steam_id64, cm.display_name, cm.role, cs.updated_at AS snapshot_updated_at
         FROM clan_members cm
         LEFT JOIN clan_snapshots cs ON cs.server_id = cm.server_id AND cs.clan_tag = cm.clan_tag
         WHERE cm.server_id = :server_id AND cm.steam_id64 = :steam_id64',
        [
            'server_id' => $server_id ?? raidlands_clans_server_id(),
            'steam_id64' => $steam_id64,
        ]
    );

    return is_array($row) ? $row : null;
}

function raidlands_clans_stale_seconds(): int
{
    return 600;
}

function raidlands_clans_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM clan_snapshots LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM player_api_keys LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM api_rate_limits LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_clans_readiness_message(): string
{
    if (!raidlands_db_is_configured()) {
        return 'MySQL is not configured. Add database credentials before clan data can sync.';
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM clan_snapshots LIMIT 1');
    } catch (Throwable $error) {
        return 'Clan management tables are not installed yet. Run database/migrations/004_clan_management.sql.';
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM player_api_keys LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM api_rate_limits LIMIT 1');
        return '';
    } catch (Throwable $error) {
        return 'Clan API key tables are not installed yet. Run database/migrations/005_clan_api_keys.sql.';
    }
}

function raidlands_clans_snapshot_age_seconds(?string $updated_at): ?int
{
    $timestamp = $updated_at !== null ? strtotime($updated_at) : false;

    if ($timestamp === false) {
        return null;
    }

    return max(0, time() - $timestamp);
}

function raidlands_clans_snapshot_is_stale(?string $updated_at): bool
{
    $age = raidlands_clans_snapshot_age_seconds($updated_at);

    return $age === null || $age > raidlands_clans_stale_seconds();
}

function raidlands_clans_snapshot_for_tag(string $server_id, string $clan_tag): ?array
{
    $row = raidlands_db_fetch_one(
        'SELECT *, TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS snapshot_age_seconds
         FROM clan_snapshots
         WHERE server_id = :server_id AND clan_tag = :clan_tag',
        [
            'server_id' => $server_id,
            'clan_tag' => $clan_tag,
        ]
    );

    if ($row === null) {
        return null;
    }

    $members = raidlands_clans_decode_json((string) ($row['members_json'] ?? ''));
    $invites = raidlands_clans_decode_json((string) ($row['member_invites_json'] ?? ''));

    $row['members'] = raidlands_clans_sort_members($members);
    $row['member_invites'] = raidlands_clans_sort_invites($invites);
    $row['allies'] = raidlands_clans_decode_json((string) ($row['allies_json'] ?? ''));
    $row['invited_allies'] = raidlands_clans_decode_json((string) ($row['invited_allies_json'] ?? ''));
    $row['age_seconds'] = isset($row['snapshot_age_seconds']) && is_numeric($row['snapshot_age_seconds'])
        ? max(0, (int) $row['snapshot_age_seconds'])
        : raidlands_clans_snapshot_age_seconds((string) ($row['updated_at'] ?? ''));
    $row['is_stale'] = $row['age_seconds'] === null || (int) $row['age_seconds'] > raidlands_clans_stale_seconds();

    return $row;
}

function raidlands_clans_sort_members(array $members): array
{
    usort($members, static function (array $a, array $b): int {
        $roles = ['owner' => 0, 'moderator' => 1, 'member' => 2];
        $role_a = $roles[strtolower((string) ($a['role'] ?? 'member'))] ?? 3;
        $role_b = $roles[strtolower((string) ($b['role'] ?? 'member'))] ?? 3;

        if ($role_a !== $role_b) {
            return $role_a <=> $role_b;
        }

        return strcasecmp((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
    });

    return $members;
}

function raidlands_clans_sort_invites(array $invites): array
{
    usort($invites, static function (array $a, array $b): int {
        return strcasecmp((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? ''));
    });

    return $invites;
}

function raidlands_clans_member_by_steam_id(array $snapshot, string $steam_id64): ?array
{
    $steam_id64 = raidlands_clans_normalize_steam_id($steam_id64);

    foreach ((array) ($snapshot['members'] ?? []) as $member) {
        if (!is_array($member)) {
            continue;
        }

        if (raidlands_clans_normalize_steam_id((string) ($member['steam_id64'] ?? '')) === $steam_id64) {
            return $member;
        }
    }

    return null;
}

function raidlands_clans_invite_by_steam_id(array $snapshot, string $steam_id64): ?array
{
    $steam_id64 = raidlands_clans_normalize_steam_id($steam_id64);

    foreach ((array) ($snapshot['member_invites'] ?? []) as $invite) {
        if (!is_array($invite)) {
            continue;
        }

        if (raidlands_clans_normalize_steam_id((string) ($invite['steam_id64'] ?? '')) === $steam_id64) {
            return $invite;
        }
    }

    return null;
}

function raidlands_clans_context_for_player(?array $player): array
{
    $context = [
        'ready' => raidlands_clans_is_ready(),
        'readiness_message' => raidlands_clans_readiness_message(),
        'player' => $player,
        'role' => null,
        'snapshot' => null,
        'recent_actions' => [],
        'can_manage' => false,
        'can_owner_manage' => false,
        'is_stale' => false,
    ];

    if (!$context['ready'] || $player === null || empty($player['steam_id64'])) {
        return $context;
    }

    try {
        $role = raidlands_clans_role_for_player((string) $player['steam_id64']);

        if ($role === null) {
            $context['recent_actions'] = raidlands_clans_recent_actions_for_actor((string) $player['steam_id64']);
            return $context;
        }

        $snapshot = raidlands_clans_snapshot_for_tag((string) $role['server_id'], (string) $role['clan_tag']);
        $context['role'] = $role;
        $context['snapshot'] = $snapshot;
        $context['is_stale'] = $snapshot === null || !empty($snapshot['is_stale']);
        $context['recent_actions'] = raidlands_clans_recent_actions_for_actor((string) $player['steam_id64']);
        $context['can_manage'] = in_array((string) $role['role'], ['owner', 'moderator'], true);
        $context['can_owner_manage'] = (string) $role['role'] === 'owner';
    } catch (Throwable $error) {
        $context['ready'] = false;
        $context['readiness_message'] = 'Clan data could not be loaded: ' . $error->getMessage();
    }

    return $context;
}

function raidlands_clans_validate_snapshot_action(array $snapshot, string $actor_role, string $actor_steam_id64, string $action, string $target_steam_id64): void
{
    if (!empty($snapshot['is_stale'])) {
        throw new RuntimeException('Clan data is stale. Wait for the game server to sync before making changes.');
    }

    if ($action === 'disband') {
        return;
    }

    $target_member = raidlands_clans_member_by_steam_id($snapshot, $target_steam_id64);
    $target_invite = raidlands_clans_invite_by_steam_id($snapshot, $target_steam_id64);

    if ($action === 'invite') {
        if ($target_member !== null) {
            throw new RuntimeException('That player is already in this clan.');
        }

        if ($target_invite !== null) {
            throw new RuntimeException('That player already has a pending clan invite.');
        }

        return;
    }

    if ($action === 'withdraw_invite') {
        if ($target_invite === null) {
            throw new RuntimeException('That player does not have a pending invite.');
        }

        return;
    }

    if ($target_member === null) {
        throw new RuntimeException('That player is not in your synced clan roster.');
    }

    $target_role = strtolower((string) ($target_member['role'] ?? 'member'));

    if ($actor_steam_id64 === raidlands_clans_normalize_steam_id((string) ($target_member['steam_id64'] ?? ''))) {
        throw new RuntimeException('You cannot target your own clan role from the website.');
    }

    if ($target_role === 'owner') {
        throw new RuntimeException('The clan owner cannot be targeted by that action.');
    }

    if ($action === 'kick' && $target_role === 'moderator' && $actor_role !== 'owner') {
        throw new RuntimeException('Only the clan owner can kick a moderator.');
    }

    if ($action === 'promote' && $target_role !== 'member') {
        throw new RuntimeException('Only regular members can be promoted.');
    }

    if ($action === 'demote' && $target_role !== 'moderator') {
        throw new RuntimeException('Only moderators can be demoted.');
    }
}

function raidlands_clans_queue_action(array $input, array $actor): array
{
    $server_id = trim((string) ($input['server_id'] ?? raidlands_clans_server_id()));
    $action = raidlands_clans_normalize_action((string) ($input['action'] ?? $input['action_type'] ?? ''));
    $actor_steam_id64 = raidlands_clans_normalize_steam_id((string) ($actor['steam_id64'] ?? ''));
    $target_steam_id64 = raidlands_clans_normalize_steam_id((string) ($input['target_steam_id64'] ?? $input['target_id'] ?? ''));
    $target_display_name = trim((string) ($input['target_display_name'] ?? $input['target_name'] ?? ''));

    if (!in_array($action, raidlands_clans_allowed_actions(), true)) {
        throw new InvalidArgumentException('Unsupported clan action.');
    }

    if (!raidlands_store_validate_steam_id64($actor_steam_id64)) {
        throw new InvalidArgumentException('A linked Steam account is required.');
    }

    if ($action !== 'disband' && !raidlands_store_validate_steam_id64($target_steam_id64)) {
        throw new InvalidArgumentException('A valid target SteamID64 is required.');
    }

    $role = raidlands_clans_role_for_player($actor_steam_id64, $server_id);

    if ($role === null) {
        throw new RuntimeException('Your in-game clan role has not synced to the website yet.');
    }

    if (!raidlands_clans_role_can_manage((string) $role['role'], $action)) {
        throw new RuntimeException('Your in-game clan role cannot perform that action.');
    }

    $clan_tag = trim((string) ($input['clan_tag'] ?? $role['clan_tag']));

    if ($clan_tag === '' || strcasecmp($clan_tag, (string) $role['clan_tag']) !== 0) {
        throw new RuntimeException('That clan does not match your in-game clan.');
    }

    if ($action === 'disband') {
        $confirm_clan_tag = trim((string) ($input['confirm_clan_tag'] ?? ''));

        if ($confirm_clan_tag === '' || strcasecmp($confirm_clan_tag, $clan_tag) !== 0) {
            throw new RuntimeException('Type the clan tag to confirm disbanding.');
        }
    }

    $snapshot = raidlands_clans_snapshot_for_tag($server_id, $clan_tag);

    if ($snapshot === null) {
        throw new RuntimeException('Your clan snapshot has not synced to the website yet.');
    }

    raidlands_clans_validate_snapshot_action(
        $snapshot,
        strtolower((string) $role['role']),
        $actor_steam_id64,
        $action,
        $target_steam_id64
    );

    $actor_display_name = trim((string) ($actor['display_name'] ?? $actor['steam_display_name'] ?? ''));

    if ($actor_display_name === '') {
        $actor_display_name = $actor_steam_id64;
    }

    $payload = [
        'queued_by' => 'website',
        'server_id' => $server_id,
        'action' => $action,
        'clan_tag' => $clan_tag,
        'actor_steam_id64' => $actor_steam_id64,
        'target_steam_id64' => $target_steam_id64,
        'target_display_name' => $target_display_name,
    ];

    raidlands_db_execute(
        'INSERT INTO clan_action_queue
            (server_id, action_type, clan_tag, actor_steam_id64, actor_display_name, target_steam_id64, target_display_name, payload_json)
         VALUES
            (:server_id, :action_type, :clan_tag, :actor_steam_id64, :actor_display_name, :target_steam_id64, :target_display_name, :payload_json)',
        [
            'server_id' => $server_id,
            'action_type' => $action,
            'clan_tag' => $clan_tag,
            'actor_steam_id64' => $actor_steam_id64,
            'actor_display_name' => $actor_display_name,
            'target_steam_id64' => $target_steam_id64,
            'target_display_name' => $target_display_name,
            'payload_json' => raidlands_clans_encode_json($payload),
        ]
    );

    $id = (int) raidlands_db_required()->lastInsertId();

    return [
        'id' => $id,
        'status' => 'queued',
        'action' => $action,
        'clan_tag' => $clan_tag,
    ];
}

function raidlands_clans_upsert_player(PDO $pdo, string $steam_id64, string $display_name): void
{
    if (!raidlands_store_validate_steam_id64($steam_id64)) {
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO players (steam_id64, display_name, last_seen_at)
         VALUES (:steam_id64, :display_name, NOW())
         ON DUPLICATE KEY UPDATE
            display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
            last_seen_at = NOW(),
            updated_at = NOW()'
    );
    $statement->execute([
        'steam_id64' => $steam_id64,
        'display_name' => $display_name,
    ]);
}

function raidlands_clans_store_snapshot(array $payload, string $server_id): array
{
    $server_id = trim($server_id) !== '' ? trim($server_id) : raidlands_clans_server_id();
    $clans = $payload['clans'] ?? null;

    if (!is_array($clans)) {
        throw new InvalidArgumentException('Clan snapshot payload must include a clans array.');
    }

    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    try {
        $seen_tags = [];
        $total_members = 0;
        $delete_members = $pdo->prepare('DELETE FROM clan_members WHERE server_id = :server_id');
        $delete_members->execute(['server_id' => $server_id]);

        $snapshot_statement = $pdo->prepare(
            'INSERT INTO clan_snapshots
                (server_id, clan_tag, description, owner_steam_id64, tag_color, moderators_json, members_json, member_invites_json, allies_json, invited_allies_json, member_count)
             VALUES
                (:server_id, :clan_tag, :description, :owner_steam_id64, :tag_color, :moderators_json, :members_json, :member_invites_json, :allies_json, :invited_allies_json, :member_count)
             ON DUPLICATE KEY UPDATE
                description = VALUES(description),
                owner_steam_id64 = VALUES(owner_steam_id64),
                tag_color = VALUES(tag_color),
                moderators_json = VALUES(moderators_json),
                members_json = VALUES(members_json),
                member_invites_json = VALUES(member_invites_json),
                allies_json = VALUES(allies_json),
                invited_allies_json = VALUES(invited_allies_json),
                member_count = VALUES(member_count),
                updated_at = NOW()'
        );

        $member_statement = $pdo->prepare(
            'INSERT INTO clan_members
                (server_id, clan_tag, steam_id64, display_name, role, is_online)
             VALUES
                (:server_id, :clan_tag, :steam_id64, :display_name, :role, :is_online)
             ON DUPLICATE KEY UPDATE
                clan_tag = VALUES(clan_tag),
                display_name = VALUES(display_name),
                role = VALUES(role),
                is_online = VALUES(is_online),
                updated_at = NOW()'
        );

        foreach ($clans as $clan) {
            if (!is_array($clan)) {
                continue;
            }

            $tag = trim((string) ($clan['tag'] ?? ''));

            if ($tag === '') {
                continue;
            }

            $members = is_array($clan['members'] ?? null) ? $clan['members'] : [];
            $member_rows = [];
            $moderators = [];
            $owner = raidlands_clans_normalize_steam_id((string) ($clan['owner'] ?? ''));

            foreach ($members as $member) {
                if (!is_array($member)) {
                    continue;
                }

                $steam_id64 = raidlands_clans_normalize_steam_id((string) ($member['steam_id64'] ?? ''));

                if (!raidlands_store_validate_steam_id64($steam_id64)) {
                    continue;
                }

                $role = strtolower((string) ($member['role'] ?? 'member'));

                if (!in_array($role, ['owner', 'moderator', 'member'], true)) {
                    $role = 'member';
                }

                if ($role === 'owner') {
                    $owner = $steam_id64;
                }

                if ($role === 'moderator') {
                    $moderators[] = $steam_id64;
                }

                $display_name = trim((string) ($member['display_name'] ?? ''));
                $is_online = !empty($member['is_online']) ? 1 : 0;

                raidlands_clans_upsert_player($pdo, $steam_id64, $display_name);

                $member_statement->execute([
                    'server_id' => $server_id,
                    'clan_tag' => $tag,
                    'steam_id64' => $steam_id64,
                    'display_name' => $display_name,
                    'role' => $role,
                    'is_online' => $is_online,
                ]);

                $member_rows[] = [
                    'steam_id64' => $steam_id64,
                    'display_name' => $display_name,
                    'role' => $role,
                    'is_online' => (bool) $is_online,
                ];
            }

            $seen_tags[] = $tag;
            $total_members += count($member_rows);

            $snapshot_statement->execute([
                'server_id' => $server_id,
                'clan_tag' => $tag,
                'description' => (string) ($clan['description'] ?? ''),
                'owner_steam_id64' => $owner,
                'tag_color' => (string) ($clan['tag_color'] ?? ''),
                'moderators_json' => raidlands_clans_encode_json(array_values(array_unique($moderators))),
                'members_json' => raidlands_clans_encode_json($member_rows),
                'member_invites_json' => raidlands_clans_encode_json(is_array($clan['member_invites'] ?? null) ? $clan['member_invites'] : []),
                'allies_json' => raidlands_clans_encode_json(is_array($clan['allies'] ?? null) ? $clan['allies'] : []),
                'invited_allies_json' => raidlands_clans_encode_json(is_array($clan['invited_allies'] ?? null) ? $clan['invited_allies'] : []),
                'member_count' => count($member_rows),
            ]);
        }

        if ($seen_tags === []) {
            $delete_snapshots = $pdo->prepare('DELETE FROM clan_snapshots WHERE server_id = :server_id');
            $delete_snapshots->execute(['server_id' => $server_id]);
        } else {
            $placeholders = [];
            $params = ['server_id' => $server_id];

            foreach (array_values(array_unique($seen_tags)) as $index => $tag) {
                $key = 'tag_' . $index;
                $placeholders[] = ':' . $key;
                $params[$key] = $tag;
            }

            $delete_snapshots = $pdo->prepare(
                'DELETE FROM clan_snapshots WHERE server_id = :server_id AND clan_tag NOT IN (' . implode(', ', $placeholders) . ')'
            );
            $delete_snapshots->execute($params);
        }

        $pdo->commit();

        return [
            'server_id' => $server_id,
            'clans' => count(array_unique($seen_tags)),
            'members' => $total_members,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_clans_claim_actions(string $server_id, int $limit = 25): array
{
    $server_id = trim($server_id) !== '' ? trim($server_id) : raidlands_clans_server_id();
    $limit = max(1, min(50, $limit));
    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    try {
        $statement = $pdo->prepare(
            "SELECT *
             FROM clan_action_queue
             WHERE server_id = :server_id
                AND (
                    status = 'queued'
                    OR (status = 'processing' AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)))
                )
             ORDER BY id ASC
             LIMIT {$limit}
             FOR UPDATE"
        );
        $statement->execute(['server_id' => $server_id]);
        $rows = $statement->fetchAll();

        if ($rows === []) {
            $pdo->commit();
            return [];
        }

        $ids = array_map(static fn(array $row): int => (int) $row['id'], $rows);
        $placeholders = [];
        $params = [];

        foreach ($ids as $index => $id) {
            $key = 'id_' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $id;
        }

        $update = $pdo->prepare(
            "UPDATE clan_action_queue
             SET status = 'processing', attempts = attempts + 1, claimed_at = NOW(), updated_at = NOW()
             WHERE id IN (" . implode(', ', $placeholders) . ')'
        );
        $update->execute($params);
        $pdo->commit();

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'action' => (string) $row['action_type'],
                'clan_tag' => (string) $row['clan_tag'],
                'actor_steam_id64' => (string) $row['actor_steam_id64'],
                'actor_display_name' => (string) $row['actor_display_name'],
                'target_steam_id64' => (string) $row['target_steam_id64'],
                'target_display_name' => (string) $row['target_display_name'],
                'attempts' => (int) $row['attempts'] + 1,
                'payload' => raidlands_clans_decode_json((string) ($row['payload_json'] ?? '')),
            ];
        }, $rows);
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function raidlands_clans_record_action_result(string $server_id, array $result): void
{
    $server_id = trim($server_id) !== '' ? trim($server_id) : raidlands_clans_server_id();
    $id = (int) ($result['id'] ?? 0);

    if ($id <= 0) {
        throw new InvalidArgumentException('Action result is missing an id.');
    }

    $ok = !empty($result['ok']);
    $error = trim((string) ($result['error'] ?? ''));

    raidlands_db_execute(
        "UPDATE clan_action_queue
         SET status = :status,
             error_message = :error_message,
             result_json = :result_json,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = :id AND server_id = :server_id",
        [
            'status' => $ok ? 'succeeded' : 'failed',
            'error_message' => $ok ? null : $error,
            'result_json' => raidlands_clans_encode_json($result),
            'id' => $id,
            'server_id' => $server_id,
        ]
    );
}

function raidlands_clans_recent_actions_for_actor(string $steam_id64, int $limit = 8): array
{
    $steam_id64 = raidlands_clans_normalize_steam_id($steam_id64);

    if (!raidlands_store_validate_steam_id64($steam_id64) || !raidlands_db_is_configured()) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT id, action_type, clan_tag, target_steam_id64, target_display_name, status, error_message, attempts, created_at, completed_at
             FROM clan_action_queue
             WHERE server_id = :server_id AND actor_steam_id64 = :actor_steam_id64
             ORDER BY created_at DESC, id DESC
             LIMIT ' . max(1, min(25, $limit)),
            [
                'server_id' => raidlands_clans_server_id(),
                'actor_steam_id64' => $steam_id64,
            ]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_clans_recent_actions(int $limit = 20): array
{
    if (!raidlands_db_is_configured()) {
        return [];
    }

    try {
        return raidlands_db_fetch_all(
            'SELECT id, action_type, clan_tag, actor_steam_id64, target_steam_id64, target_display_name, status, error_message, attempts, created_at, completed_at
             FROM clan_action_queue
             WHERE server_id = :server_id
             ORDER BY created_at DESC, id DESC
             LIMIT ' . max(1, min(100, $limit)),
            ['server_id' => raidlands_clans_server_id()]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_clans_admin_summary(): array
{
    $summary = [
        'ready' => raidlands_clans_is_ready(),
        'message' => raidlands_clans_readiness_message(),
        'clan_count' => 0,
        'member_count' => 0,
        'active_api_keys' => 0,
        'latest_snapshot' => null,
        'latest_action' => null,
        'recent_actions' => [],
    ];

    if (!$summary['ready']) {
        return $summary;
    }

    try {
        $server_id = raidlands_clans_server_id();
        $clans = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total, MAX(updated_at) AS latest_snapshot FROM clan_snapshots WHERE server_id = :server_id',
            ['server_id' => $server_id]
        );
        $members = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total FROM clan_members WHERE server_id = :server_id',
            ['server_id' => $server_id]
        );
        $keys = raidlands_db_fetch_one(
            'SELECT COUNT(*) AS total FROM player_api_keys WHERE revoked_at IS NULL'
        );
        $latest_action = raidlands_db_fetch_one(
            'SELECT * FROM clan_action_queue WHERE server_id = :server_id ORDER BY created_at DESC, id DESC LIMIT 1',
            ['server_id' => $server_id]
        );

        $summary['clan_count'] = (int) ($clans['total'] ?? 0);
        $summary['member_count'] = (int) ($members['total'] ?? 0);
        $summary['active_api_keys'] = (int) ($keys['total'] ?? 0);
        $summary['latest_snapshot'] = $clans['latest_snapshot'] ?? null;
        $summary['latest_action'] = $latest_action;
        $summary['recent_actions'] = raidlands_clans_recent_actions(12);
    } catch (Throwable $error) {
        $summary['ready'] = false;
        $summary['message'] = $error->getMessage();
    }

    return $summary;
}

function raidlands_clans_allowed_actions_for_role(string $role): array
{
    $actions = [];

    foreach (raidlands_clans_allowed_actions() as $action) {
        if (raidlands_clans_role_can_manage($role, $action)) {
            $actions[] = $action;
        }
    }

    return $actions;
}

function raidlands_clans_public_context_payload(array $player): array
{
    $context = raidlands_clans_context_for_player($player);
    $role = $context['role'];
    $snapshot = $context['snapshot'];

    $payload = [
        'ready' => (bool) $context['ready'],
        'message' => (string) $context['readiness_message'],
        'player' => [
            'steam_id64' => (string) ($player['steam_id64'] ?? ''),
            'display_name' => (string) (($player['display_name'] ?? '') ?: ($player['steam_display_name'] ?? '')),
        ],
        'role' => $role !== null ? (string) ($role['role'] ?? 'member') : null,
        'allowed_actions' => $role !== null ? raidlands_clans_allowed_actions_for_role((string) ($role['role'] ?? 'member')) : [],
        'clan' => null,
    ];

    if (is_array($snapshot)) {
        $payload['clan'] = [
            'server_id' => (string) ($snapshot['server_id'] ?? ''),
            'tag' => (string) ($snapshot['clan_tag'] ?? ''),
            'description' => (string) ($snapshot['description'] ?? ''),
            'owner_steam_id64' => (string) ($snapshot['owner_steam_id64'] ?? ''),
            'tag_color' => (string) ($snapshot['tag_color'] ?? ''),
            'member_count' => (int) ($snapshot['member_count'] ?? 0),
            'updated_at' => (string) ($snapshot['updated_at'] ?? ''),
            'is_stale' => !empty($snapshot['is_stale']),
            'members' => array_values((array) ($snapshot['members'] ?? [])),
            'member_invites' => array_values((array) ($snapshot['member_invites'] ?? [])),
            'allies' => array_values((array) ($snapshot['allies'] ?? [])),
            'invited_allies' => array_values((array) ($snapshot['invited_allies'] ?? [])),
        ];
    }

    return $payload;
}

function raidlands_clans_api_rate_limit_per_minute(): int
{
    global $clan_api_config;

    return max(10, (int) ($clan_api_config['rateLimitPerMinute'] ?? 60));
}

function raidlands_clans_api_key_limit_per_player(): int
{
    global $clan_api_config;

    return max(1, min(20, (int) ($clan_api_config['keyLimitPerPlayer'] ?? 5)));
}

function raidlands_clans_api_key_secret(): string
{
    return 'rcl_' . bin2hex(random_bytes(24));
}

function raidlands_clans_api_key_hash(string $secret): string
{
    return hash('sha256', trim($secret));
}

function raidlands_clans_api_keys_for_player(int $player_id, bool $include_revoked = false): array
{
    if ($player_id <= 0 || !raidlands_db_is_configured()) {
        return [];
    }

    try {
        $where = $include_revoked ? '' : ' AND revoked_at IS NULL';

        return raidlands_db_fetch_all(
            'SELECT id, key_prefix, label, scopes_json, last_used_at, revoked_at, created_at, updated_at
             FROM player_api_keys
             WHERE player_id = :player_id' . $where . '
             ORDER BY revoked_at IS NULL DESC, created_at DESC, id DESC',
            ['player_id' => $player_id]
        );
    } catch (Throwable $error) {
        return [];
    }
}

function raidlands_clans_create_api_key(array $player, string $label): array
{
    $player_id = (int) ($player['id'] ?? 0);
    $steam_id64 = raidlands_clans_normalize_steam_id((string) ($player['steam_id64'] ?? ''));

    if ($player_id <= 0 || !raidlands_store_validate_steam_id64($steam_id64)) {
        throw new RuntimeException('A database-backed linked Steam account is required before creating API keys.');
    }

    if (!raidlands_clans_is_ready()) {
        throw new RuntimeException(raidlands_clans_readiness_message());
    }

    $active_count = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS total FROM player_api_keys WHERE player_id = :player_id AND revoked_at IS NULL',
        ['player_id' => $player_id]
    );

    if ((int) ($active_count['total'] ?? 0) >= raidlands_clans_api_key_limit_per_player()) {
        throw new RuntimeException('You already have the maximum number of active clan API keys.');
    }

    $secret = raidlands_clans_api_key_secret();
    $label = trim(strip_tags($label));

    if ($label === '') {
        $label = 'Clan API key';
    }

    raidlands_db_execute(
        'INSERT INTO player_api_keys
            (player_id, steam_id64, key_prefix, key_hash, label, scopes_json)
         VALUES
            (:player_id, :steam_id64, :key_prefix, :key_hash, :label, :scopes_json)',
        [
            'player_id' => $player_id,
            'steam_id64' => $steam_id64,
            'key_prefix' => substr($secret, 0, 16),
            'key_hash' => raidlands_clans_api_key_hash($secret),
            'label' => substr($label, 0, 120),
            'scopes_json' => raidlands_clans_encode_json(['clans:read', 'clans:write']),
        ]
    );

    return [
        'id' => (int) raidlands_db_required()->lastInsertId(),
        'secret' => $secret,
        'key_prefix' => substr($secret, 0, 16),
        'label' => $label,
    ];
}

function raidlands_clans_revoke_api_key(array $player, int $key_id): void
{
    $player_id = (int) ($player['id'] ?? 0);

    if ($player_id <= 0 || $key_id <= 0) {
        throw new RuntimeException('A linked Steam account is required before revoking API keys.');
    }

    raidlands_db_execute(
        'UPDATE player_api_keys
         SET revoked_at = NOW(), updated_at = NOW()
         WHERE id = :id AND player_id = :player_id AND revoked_at IS NULL',
        [
            'id' => $key_id,
            'player_id' => $player_id,
        ]
    );
}

function raidlands_clans_extract_api_key(array $payload = []): string
{
    $authorization = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));

    if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        return trim((string) $matches[1]);
    }

    foreach (['HTTP_X_RAIDLANDS_API_KEY', 'HTTP_X_API_KEY'] as $server_key) {
        $value = trim((string) ($_SERVER[$server_key] ?? ''));

        if ($value !== '') {
            return $value;
        }
    }

    $payload_key = trim((string) ($payload['api_key'] ?? $_GET['api_key'] ?? ''));

    return $payload_key;
}

function raidlands_clans_authenticate_api_key(array $payload, string $route_key): array
{
    $secret = raidlands_clans_extract_api_key($payload);

    if ($secret === '') {
        throw new RuntimeException('Missing clan API key.');
    }

    if (!raidlands_clans_is_ready()) {
        throw new RuntimeException(raidlands_clans_readiness_message());
    }

    $row = raidlands_db_fetch_one(
        'SELECT
            k.id AS key_id,
            k.player_id,
            k.steam_id64,
            k.key_prefix,
            k.label,
            k.scopes_json,
            p.display_name,
            p.created_at,
            p.updated_at,
            p.last_seen_at
         FROM player_api_keys k
         INNER JOIN players p ON p.id = k.player_id
         WHERE k.key_hash = :key_hash AND k.revoked_at IS NULL
         LIMIT 1',
        ['key_hash' => raidlands_clans_api_key_hash($secret)]
    );

    if ($row === null) {
        throw new RuntimeException('Invalid or revoked clan API key.');
    }

    $requested_steam_id = raidlands_clans_normalize_steam_id((string) ($payload['steam_id64'] ?? $_GET['steam_id64'] ?? ''));

    if ($requested_steam_id !== '' && $requested_steam_id !== (string) $row['steam_id64']) {
        throw new RuntimeException('The requested SteamID64 does not match this API key.');
    }

    raidlands_clans_check_rate_limit('key:' . (string) $row['key_id'], $route_key, raidlands_clans_api_rate_limit_per_minute());
    raidlands_db_execute(
        'UPDATE player_api_keys SET last_used_at = NOW(), updated_at = NOW() WHERE id = :id',
        ['id' => (int) $row['key_id']]
    );

    $player = [
        'id' => (int) $row['player_id'],
        'steam_id64' => (string) $row['steam_id64'],
        'display_name' => (string) ($row['display_name'] ?? ''),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'last_seen_at' => (string) ($row['last_seen_at'] ?? ''),
    ];

    $player = raidlands_store_attach_steam_profiles([$player])[0] ?? $player;

    return [
        'auth_type' => 'api_key',
        'player' => $player,
        'api_key' => $row,
    ];
}

function raidlands_clans_check_rate_limit(string $rate_key, string $route_key, int $limit, int $window_seconds = 60): void
{
    $limit = max(1, $limit);
    $window_seconds = max(60, $window_seconds);
    $window_start = gmdate('Y-m-d H:i:s', (int) (floor(time() / $window_seconds) * $window_seconds));

    raidlands_db_execute(
        'INSERT INTO api_rate_limits (rate_key, route_key, window_start, request_count)
         VALUES (:rate_key, :route_key, :window_start, 1)
         ON DUPLICATE KEY UPDATE request_count = request_count + 1, updated_at = NOW()',
        [
            'rate_key' => $rate_key,
            'route_key' => $route_key,
            'window_start' => $window_start,
        ]
    );

    $row = raidlands_db_fetch_one(
        'SELECT request_count FROM api_rate_limits WHERE rate_key = :rate_key AND route_key = :route_key AND window_start = :window_start',
        [
            'rate_key' => $rate_key,
            'route_key' => $route_key,
            'window_start' => $window_start,
        ]
    );

    raidlands_db_execute(
        'DELETE FROM api_rate_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'
    );

    if ((int) ($row['request_count'] ?? 0) > $limit) {
        header('Retry-After: 60');
        throw new RuntimeException('Rate limit exceeded. Try again in a minute.');
    }
}

function raidlands_clans_authenticate_action_request(array $payload): array
{
    if (raidlands_clans_extract_api_key($payload) !== '') {
        return raidlands_clans_authenticate_api_key($payload, 'clans:write');
    }

    $csrf = (string) ($payload['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if (!raidlands_store_validate_csrf($csrf)) {
        throw new InvalidArgumentException('Invalid request token.');
    }

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['steam_id64'])) {
        throw new RuntimeException('Link your Steam account before managing a clan.');
    }

    return [
        'auth_type' => 'session',
        'player' => $player,
        'api_key' => null,
    ];
}

function raidlands_clans_authenticate_read_request(array $payload = []): array
{
    if (raidlands_clans_extract_api_key($payload) !== '') {
        return raidlands_clans_authenticate_api_key($payload, 'clans:read');
    }

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['steam_id64'])) {
        throw new RuntimeException('Link your Steam account or provide a clan API key.');
    }

    return [
        'auth_type' => 'session',
        'player' => $player,
        'api_key' => null,
    ];
}
