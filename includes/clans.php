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
