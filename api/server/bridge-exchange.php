<?php

require dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once $site_root . '/includes/store.php';
require_once $site_root . '/includes/rewards.php';
require_once $site_root . '/includes/clans.php';
require_once $site_root . '/includes/kits.php';
require_once $site_root . '/includes/permissions.php';
require_once $site_root . '/includes/server-status.php';
require_once $site_root . '/includes/stats.php';

const RAIDLANDS_BRIDGE_EXCHANGE_PROTOCOL = 1;
const RAIDLANDS_BRIDGE_EXCHANGE_MAX_BYTES = 1048576;
const RAIDLANDS_BRIDGE_EXCHANGE_RECLAIM_SECONDS = 45;

$body = (string) file_get_contents('php://input');
raidlands_bridge_authorize($body);

if (strlen($body) > RAIDLANDS_BRIDGE_EXCHANGE_MAX_BYTES) {
    raidlands_store_json_response(['ok' => false, 'error' => 'Bridge exchange body exceeds 1 MiB.'], 413);
}

$payload = json_decode($body, true);
if (!is_array($payload)) {
    raidlands_store_json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
}

$protocol = (int) ($payload['protocol'] ?? 0);
if ($protocol !== RAIDLANDS_BRIDGE_EXCHANGE_PROTOCOL) {
    raidlands_store_json_response([
        'ok' => false,
        'error' => 'Unsupported bridge exchange protocol.',
        'supported_protocol' => RAIDLANDS_BRIDGE_EXCHANGE_PROTOCOL,
    ], 422);
}

$sequence = (int) ($payload['sequence'] ?? 0);
$generated_at = trim((string) ($payload['generated_at'] ?? ''));
if ($sequence < 1 || $generated_at === '' || strtotime($generated_at) === false || !isset($payload['modules']) || !is_array($payload['modules'])) {
    raidlands_store_json_response(['ok' => false, 'error' => 'Invalid bridge exchange envelope.'], 422);
}

$header_server_id = trim((string) ($_SERVER['HTTP_X_RAIDLANDS_SERVER'] ?? ''));
$server_id = trim((string) ($payload['server_id'] ?? $header_server_id));
if ($server_id === '' || !hash_equals($header_server_id, $server_id)) {
    raidlands_store_json_response(['ok' => false, 'error' => 'Exchange server_id does not match the authenticated server.'], 422);
}

$modules = $payload['modules'];
$response_modules = [];

$section_error = static function (Throwable $error): array {
    return ['ok' => false, 'error' => $error->getMessage(), 'retryable' => !($error instanceof InvalidArgumentException)];
};

// Acknowledgements are deliberately processed before new work is claimed.
if (isset($modules['vip']) && is_array($modules['vip'])) {
    $vip = $modules['vip'];
    $vip_response = ['ok' => true, 'acknowledgements' => []];
    $results = is_array($vip['results'] ?? null) ? $vip['results'] : [];

    foreach ([
        'rp_purchases' => 'raidlands_store_record_rp_purchase_result',
        'rp_points' => 'raidlands_rewards_record_point_result',
    ] as $key => $handler) {
        $acks = [];
        try {
            foreach ((array) ($results[$key] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $handler($item);
                $request_id = trim((string) ($item['request_id'] ?? $item['request_token'] ?? ''));
                if ($request_id !== '') {
                    $acks[] = $request_id;
                }
            }
            $vip_response['acknowledgements'][$key] = ['ok' => true, 'ids' => $acks];
        } catch (Throwable $error) {
            $vip_response['acknowledgements'][$key] = $section_error($error);
        }
    }

    foreach (['kits' => 'raidlands_kits_record_sync_result', 'permissions' => 'raidlands_permissions_record_sync_result'] as $key => $handler) {
        $acks = [];
        try {
            foreach ((array) ($results[$key] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $handler($item);
                $acks[] = (int) ($item['revision'] ?? 0);
            }
            $vip_response['acknowledgements'][$key] = ['ok' => true, 'revisions' => array_values(array_filter($acks))];
        } catch (Throwable $error) {
            $vip_response['acknowledgements'][$key] = $section_error($error);
        }
    }

    if (is_array($vip['heartbeat'] ?? null)) {
        try {
            $heartbeat = $vip['heartbeat'];
            $heartbeat['wipe_key'] = raidlands_stats_canonical_wipe_key(
                $server_id,
                (string) ($heartbeat['wipe_key'] ?? ''),
                $heartbeat['wipe_started_at'] ?? null
            );
            $status = raidlands_server_status_ingest_heartbeat($heartbeat, $server_id, json_encode($heartbeat, JSON_UNESCAPED_SLASHES) ?: '{}');
            $wipe = raidlands_stats_activate_wipe_signal($server_id, (string) ($heartbeat['wipe_key'] ?? ''), $heartbeat['wipe_started_at'] ?? null);
            $map_promoted = raidlands_server_map_promote_wipe_key($server_id, (string) ($heartbeat['wipe_key'] ?? ''), $heartbeat['wipe_started_at'] ?? null);
            $vip_response['heartbeat'] = ['ok' => true, 'status' => $status, 'wipe' => $wipe, 'map_wipe_promoted' => $map_promoted];
        } catch (Throwable $error) {
            $vip_response['heartbeat'] = $section_error($error);
        }
    }

    try {
        $changes = raidlands_store_bridge_changes((int) ($vip['cursor'] ?? 0));
        $vip_response['changes'] = [
            'ok' => true,
            'managed_groups' => raidlands_store_managed_groups(),
            'players' => $changes['players'],
            'cursor' => $changes['cursor'],
        ];
    } catch (Throwable $error) {
        $vip_response['changes'] = $section_error($error);
    }

    try {
        $rows = raidlands_store_bridge_rp_requests((int) ($vip['rp_purchase_limit'] ?? 10), RAIDLANDS_BRIDGE_EXCHANGE_RECLAIM_SECONDS);
        $requests = [];
        foreach ($rows as $row) {
            $requests[] = [
                'request_id' => (string) $row['request_token'],
                'steam_id64' => (string) $row['steam_id64'],
                'rp_cost' => (int) $row['rp_cost'],
                'product_id' => (int) $row['product_id'],
                'product_name' => (string) ($row['product_name'] ?? ''),
                'product_slug' => (string) ($row['product_slug'] ?? ''),
                'price_label' => (string) ($row['price_label'] ?? ''),
                'access_interval' => (string) $row['access_interval'],
                'access_duration_seconds' => (int) $row['access_duration_seconds'],
                'auto_renew' => !empty($row['auto_renew_requested']),
                'renewal' => !empty($row['rp_subscription_id']),
            ];
        }
        $vip_response['rp_purchases'] = ['ok' => true, 'requests' => $requests, 'count' => count($requests)];
    } catch (Throwable $error) {
        $vip_response['rp_purchases'] = $section_error($error);
    }

    try {
        $rows = raidlands_rewards_bridge_point_requests((int) ($vip['rp_point_limit'] ?? 10), RAIDLANDS_BRIDGE_EXCHANGE_RECLAIM_SECONDS);
        $requests = [];
        foreach ($rows as $row) {
            $requests[] = [
                'request_id' => (string) $row['request_token'],
                'steam_id64' => (string) $row['steam_id64'],
                'source_type' => (string) $row['source_type'],
                'source_id' => (string) $row['source_id'],
                'debit_rp' => (int) $row['debit_rp'],
                'credit_rp' => (int) $row['credit_rp'],
                'reason' => (string) $row['reason'],
                'metadata' => json_decode((string) ($row['metadata_json'] ?? ''), true) ?: null,
            ];
        }
        $vip_response['rp_points'] = ['ok' => true, 'requests' => $requests, 'count' => count($requests)];
    } catch (Throwable $error) {
        $vip_response['rp_points'] = $section_error($error);
    }

    try {
        $vip_response['kits'] = array_merge(['ok' => true], raidlands_kits_pending_sync((int) ($vip['kit_revision'] ?? 0)));
    } catch (Throwable $error) {
        $vip_response['kits'] = $section_error($error);
    }
    try {
        $vip_response['permissions'] = array_merge(['ok' => true], raidlands_permissions_pending_sync((int) ($vip['permission_revision'] ?? 0)));
    } catch (Throwable $error) {
        $vip_response['permissions'] = $section_error($error);
    }
    $response_modules['vip'] = $vip_response;
}

if (isset($modules['map']) && is_array($modules['map'])) {
    $map = $modules['map'];
    $map_response = ['ok' => true];
    foreach ([
        'environment' => 'raidlands_server_environment_ingest_snapshot',
        'player_locations' => 'raidlands_server_player_locations_ingest_snapshot',
        'replay_events' => 'raidlands_server_map_replay_events_ingest_snapshot',
    ] as $key => $handler) {
        if (!is_array($map[$key] ?? null)) {
            continue;
        }
        try {
            $result = $handler($map[$key], $server_id);
            $map_response[$key] = ['ok' => true, 'result' => $result];
        } catch (Throwable $error) {
            $map_response[$key] = $section_error($error);
        }
    }
    $response_modules['map'] = $map_response;
}

if (isset($modules['clans']) && is_array($modules['clans'])) {
    $clans = $modules['clans'];
    $clan_response = ['ok' => true, 'acknowledgements' => []];
    try {
        foreach ((array) ($clans['results'] ?? []) as $result) {
            if (!is_array($result)) {
                continue;
            }
            raidlands_clans_record_action_result($server_id, $result);
            $id = (int) ($result['id'] ?? 0);
            if ($id > 0) {
                $clan_response['acknowledgements'][] = $id;
            }
        }
        $clan_response['acknowledgements'] = ['ok' => true, 'ids' => $clan_response['acknowledgements']];
    } catch (Throwable $error) {
        $clan_response['acknowledgements'] = $section_error($error);
    }
    try {
        $clan_response['actions'] = [
            'ok' => true,
            'items' => raidlands_clans_claim_actions(
                $server_id,
                (int) ($clans['action_limit'] ?? 25),
                RAIDLANDS_BRIDGE_EXCHANGE_RECLAIM_SECONDS
            ),
        ];
    } catch (Throwable $error) {
        $clan_response['actions'] = $section_error($error);
    }
    $response_modules['clans'] = $clan_response;
}

raidlands_store_json_response([
    'ok' => true,
    'protocol' => RAIDLANDS_BRIDGE_EXCHANGE_PROTOCOL,
    'sequence' => $sequence,
    'server_id' => $server_id,
    'processed_at' => gmdate('c'),
    'modules' => $response_modules,
]);
