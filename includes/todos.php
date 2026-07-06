<?php

require_once __DIR__ . '/feedback.php';
require_once __DIR__ . '/features.php';
require_once __DIR__ . '/ai-triage.php';

function raidlands_todo_snapshots_is_ready(bool $refresh = false): bool
{
    static $ready = null;

    if ($refresh) {
        $ready = null;
    }

    if ($ready !== null) {
        return $ready;
    }

    if (!raidlands_db_is_configured()) {
        $ready = false;
        return false;
    }

    try {
        raidlands_db_required()->query('SELECT 1 FROM admin_todo_snapshots LIMIT 1');
        $ready = true;
    } catch (Throwable $error) {
        $ready = false;
    }

    return $ready;
}

function raidlands_todo_readiness_message(): string
{
    if (!raidlands_db_is_configured()) {
        return 'Database credentials are not configured.';
    }

    return 'AI TODO snapshots are not ready. Run database/migrations/029_admin_todo_snapshots.sql.';
}

function raidlands_todo_admin_state(int $limit = 80): array
{
    $feedback_ready = raidlands_feedback_is_ready();
    $features_ready = raidlands_features_is_ready();
    $items = raidlands_todo_live_items($limit);
    $snapshot_ready = raidlands_todo_snapshots_is_ready();
    $latest = $snapshot_ready ? raidlands_todo_latest_snapshot() : null;
    $messages = [];

    if (!$feedback_ready) {
        $messages[] = raidlands_feedback_readiness_message(true);
    }

    if (!$features_ready) {
        $messages[] = raidlands_features_readiness_message(true);
    }

    if (!$snapshot_ready) {
        $messages[] = raidlands_todo_readiness_message();
    }

    return [
        'ready' => $feedback_ready || $features_ready,
        'feedback_ready' => $feedback_ready,
        'features_ready' => $features_ready,
        'snapshot_ready' => $snapshot_ready,
        'ai_configured' => raidlands_ai_is_configured(),
        'items' => $items,
        'stats' => raidlands_todo_stats($items),
        'latest' => $latest,
        'source_hash' => raidlands_todo_source_hash($items),
        'daily_stale' => raidlands_todo_snapshot_is_stale($latest),
        'message' => implode(' ', array_values(array_unique(array_filter($messages)))),
    ];
}

function raidlands_todo_live_items(int $limit = 80): array
{
    $items = [];

    if (raidlands_feedback_is_ready()) {
        $items = array_merge($items, raidlands_todo_feedback_items(120));
    }

    if (raidlands_features_is_ready()) {
        $items = array_merge($items, raidlands_todo_feature_items(120));
        $items = array_merge($items, raidlands_todo_pending_suggestion_items(120));
    }

    usort(
        $items,
        static function (array $a, array $b): int {
            return ((int) ($b['priority_score'] ?? 0) <=> (int) ($a['priority_score'] ?? 0))
                ?: strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? ''))
                ?: strnatcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
        }
    );

    return array_slice($items, 0, max(1, min(200, $limit)));
}

function raidlands_todo_feedback_items(int $limit): array
{
    try {
        $rows = raidlands_db_fetch_all(
            "SELECT
                sf.id,
                sf.public_id,
                sf.type,
                sf.status,
                sf.summary,
                sf.details,
                sf.admin_note,
                sf.page_url,
                sf.steam_id64,
                sf.submitted_at,
                sf.updated_at,
                p.display_name AS player_display_name,
                fs.id AS linked_suggestion_id,
                fs.feature_id AS linked_feature_id,
                fi.title AS linked_feature_title
             FROM support_feedback sf
             LEFT JOIN players p ON p.id = sf.player_id
             LEFT JOIN feature_suggestions fs ON fs.support_feedback_id = sf.id
             LEFT JOIN feature_items fi ON fi.id = fs.feature_id
             WHERE sf.status IN ('open', 'reviewing', 'planned')
             ORDER BY FIELD(sf.type, 'bug', 'feature_request', 'suggestion'),
                      FIELD(sf.status, 'open', 'reviewing', 'planned'),
                      sf.submitted_at ASC,
                      sf.id ASC
             LIMIT " . max(1, min(250, $limit))
        );
    } catch (Throwable $error) {
        return [];
    }

    $items = [];

    foreach ($rows as $row) {
        $type = (string) ($row['type'] ?? 'bug');
        $status = (string) ($row['status'] ?? 'open');
        $linked_suggestion_id = (int) ($row['linked_suggestion_id'] ?? 0);
        $linked_feature_id = (int) ($row['linked_feature_id'] ?? 0);

        if ($linked_suggestion_id > 0 && $type !== 'bug') {
            continue;
        }

        if ($linked_feature_id > 0 && $type === 'bug' && $status === 'planned') {
            continue;
        }

        $score = raidlands_todo_feedback_score($row);
        $title = raidlands_todo_clean_text($row['summary'] ?? '', 180);
        $details = raidlands_todo_clean_text($row['details'] ?? '', 500);
        $linked_feature = raidlands_todo_clean_text($row['linked_feature_title'] ?? '', 180);
        $next_step = $type === 'bug'
            ? 'Reproduce, decide owner, and move the feedback status forward.'
            : 'Decide whether this should merge into a feature card or become a new candidate.';

        if ($linked_feature !== '') {
            $next_step = 'Check linked feature "' . $linked_feature . '" and confirm the remaining work.';
        }

        $items[] = raidlands_todo_normalize_item([
            'key' => 'feedback-' . (int) ($row['id'] ?? 0),
            'source_type' => 'feedback',
            'source_label' => raidlands_feedback_type_label($type),
            'source_id' => (int) ($row['id'] ?? 0),
            'kind' => $type,
            'title' => $title !== '' ? $title : 'Untitled feedback',
            'details' => $details,
            'status' => $status,
            'status_label' => raidlands_feedback_status_label($status),
            'priority_score' => $score,
            'reason' => raidlands_todo_feedback_reason($row),
            'next_step' => $next_step,
            'signal' => $type === 'bug' ? 'Bug report' : 'Player request',
            'created_at' => (string) ($row['submitted_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'admin_section' => 'feedback',
        ]);
    }

    return $items;
}

function raidlands_todo_feature_items(int $limit): array
{
    try {
        raidlands_features_seed_defaults();
        $features = raidlands_features_attach_scores(
            raidlands_features_admin_items(),
            raidlands_features_current_wipe_window()
        );
    } catch (Throwable $error) {
        return [];
    }

    $items = [];

    foreach ($features as $feature) {
        $status = (string) ($feature['public_status'] ?? 'under_review');

        if (in_array($status, ['active', 'archived'], true)) {
            continue;
        }

        $score = raidlands_todo_feature_score($feature);
        $vote_count = (int) ($feature['vote_count'] ?? 0);
        $suggestion_count = (int) ($feature['suggestion_count'] ?? 0);
        $support_score = (int) ($feature['support_score'] ?? 0);
        $signal_parts = [];

        if ($support_score > 0) {
            $signal_parts[] = $support_score . ' supporter' . ($support_score === 1 ? '' : 's');
        }

        if ($vote_count > 0) {
            $signal_parts[] = $vote_count . ' vote' . ($vote_count === 1 ? '' : 's');
        }

        if ($suggestion_count > 0) {
            $signal_parts[] = $suggestion_count . ' grouped suggestion' . ($suggestion_count === 1 ? '' : 's');
        }

        $items[] = raidlands_todo_normalize_item([
            'key' => 'feature-' . (int) ($feature['id'] ?? 0),
            'source_type' => 'feature',
            'source_label' => 'Feature card',
            'source_id' => (int) ($feature['id'] ?? 0),
            'kind' => 'feature',
            'title' => raidlands_todo_clean_text($feature['title'] ?? '', 180) ?: 'Untitled feature',
            'details' => raidlands_todo_clean_text($feature['summary'] ?? '', 500),
            'status' => $status,
            'status_label' => raidlands_features_status_label($status),
            'priority_score' => $score,
            'reason' => raidlands_todo_feature_reason($feature),
            'next_step' => raidlands_todo_feature_next_step($feature),
            'signal' => $signal_parts === [] ? 'No player signal yet' : implode(', ', $signal_parts),
            'created_at' => (string) ($feature['created_at'] ?? ''),
            'updated_at' => (string) ($feature['updated_at'] ?? ''),
            'admin_section' => 'features',
        ]);

        if (count($items) >= $limit) {
            break;
        }
    }

    return $items;
}

function raidlands_todo_pending_suggestion_items(int $limit): array
{
    $has_split_lineage = raidlands_features_split_lineage_is_ready();

    try {
        if ($has_split_lineage) {
            $rows = raidlands_db_fetch_all(
                "SELECT fs.*, parent_fs.title AS parent_suggestion_title
                 FROM feature_suggestions fs
                 LEFT JOIN feature_suggestions parent_fs ON parent_fs.id = fs.parent_suggestion_id
                 WHERE fs.status = 'pending'
                 ORDER BY fs.created_at ASC, fs.id ASC
                 LIMIT " . max(1, min(250, $limit))
            );
        } else {
            $rows = raidlands_db_fetch_all(
                "SELECT fs.*
                 FROM feature_suggestions fs
                 WHERE fs.status = 'pending'
                 ORDER BY fs.created_at ASC, fs.id ASC
                 LIMIT " . max(1, min(250, $limit))
            );
        }
    } catch (Throwable $error) {
        return [];
    }

    $items = [];

    foreach ($rows as $row) {
        $kind = raidlands_ai_source_kind('suggestion', $row);
        $source_type = (string) ($row['source_type'] ?? 'public');
        $parent = raidlands_todo_clean_text($row['parent_suggestion_title'] ?? '', 180);
        $reason = $parent !== ''
            ? 'Pending split item from "' . $parent . '".'
            : 'Pending feature-list item has not been grouped, approved, or rejected.';

        $items[] = raidlands_todo_normalize_item([
            'key' => 'suggestion-' . (int) ($row['id'] ?? 0),
            'source_type' => 'suggestion',
            'source_label' => ucwords(str_replace('_', ' ', $source_type)) . ' suggestion',
            'source_id' => (int) ($row['id'] ?? 0),
            'kind' => $kind,
            'title' => raidlands_todo_clean_text($row['title'] ?? '', 180) ?: 'Player suggestion',
            'details' => raidlands_todo_clean_text($row['details'] ?? '', 500),
            'status' => 'pending',
            'status_label' => 'Pending',
            'priority_score' => raidlands_todo_suggestion_score($row),
            'reason' => $reason,
            'next_step' => 'Group it into an existing feature, approve it as new, or reject it from Feature Lists.',
            'signal' => 'Needs staff decision',
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'admin_section' => 'features',
        ]);
    }

    return $items;
}

function raidlands_todo_feedback_score(array $row): int
{
    $type = (string) ($row['type'] ?? 'bug');
    $status = (string) ($row['status'] ?? 'open');
    $score = match ($status) {
        'open' => 86,
        'reviewing' => 78,
        'planned' => 64,
        default => 50,
    };

    if ($type === 'bug') {
        $score += 22;
    } elseif ($type === 'feature_request') {
        $score += 8;
    }

    if ((int) ($row['linked_feature_id'] ?? 0) > 0) {
        $score -= 12;
    }

    return $score + raidlands_todo_age_bonus((string) ($row['submitted_at'] ?? ''), 12);
}

function raidlands_todo_feature_score(array $feature): int
{
    $status = (string) ($feature['public_status'] ?? 'under_review');
    $score = match ($status) {
        'in_development' => 92,
        'voting' => 74,
        'under_review' => 68,
        'planned' => 62,
        default => 45,
    };

    $score += min(40, (int) ($feature['support_score'] ?? 0) * 7);
    $score += min(30, (int) ($feature['vote_count'] ?? 0) * 5);
    $score += min(24, (int) ($feature['suggestion_count'] ?? 0) * 4);

    return $score + raidlands_todo_age_bonus((string) ($feature['updated_at'] ?? ''), 8);
}

function raidlands_todo_suggestion_score(array $row): int
{
    $kind = raidlands_ai_source_kind('suggestion', $row);
    $score = match ($kind) {
        'bug' => 88,
        'feature_request' => 72,
        default => 66,
    };

    return $score + raidlands_todo_age_bonus((string) ($row['created_at'] ?? ''), 14);
}

function raidlands_todo_feedback_reason(array $row): string
{
    $type = (string) ($row['type'] ?? 'bug');
    $status = raidlands_feedback_status_label((string) ($row['status'] ?? 'open'));

    if ($type === 'bug') {
        return $status . ' bug report from the support inbox.';
    }

    return $status . ' player request from the support inbox.';
}

function raidlands_todo_feature_reason(array $feature): string
{
    $status = raidlands_features_status_label((string) ($feature['public_status'] ?? 'under_review'));
    $support = (int) ($feature['support_score'] ?? 0);
    $votes = (int) ($feature['vote_count'] ?? 0);
    $suggestions = (int) ($feature['suggestion_count'] ?? 0);

    if ($support + $votes + $suggestions <= 0) {
        return $status . ' feature card needs staff ordering or a next status.';
    }

    return $status . ' feature card with current player signal.';
}

function raidlands_todo_feature_next_step(array $feature): string
{
    return match ((string) ($feature['public_status'] ?? 'under_review')) {
        'in_development' => 'Ship or update the in-progress work, then move the feature status.',
        'voting' => 'Use current votes and comments to decide whether this becomes planned work.',
        'planned' => 'Break it into implementation tasks or move it into development.',
        default => 'Review the signal and decide whether to plan, open voting, or archive it.',
    };
}

function raidlands_todo_age_bonus(string $timestamp, int $max): int
{
    $timestamp = trim($timestamp);

    if ($timestamp === '') {
        return 0;
    }

    try {
        $created = new DateTimeImmutable($timestamp);
    } catch (Throwable $error) {
        return 0;
    }

    $age_seconds = time() - $created->getTimestamp();

    if ($age_seconds <= 0) {
        return 0;
    }

    return min($max, (int) floor(($age_seconds / 86400) / 2));
}

function raidlands_todo_normalize_item(array $item): array
{
    $score = max(0, (int) ($item['priority_score'] ?? 0));
    $item['priority_score'] = $score;
    $item['priority_label'] = raidlands_todo_priority_label($score);
    $item['priority_class'] = strtolower($item['priority_label']);

    return $item;
}

function raidlands_todo_priority_label(int $score): string
{
    if ($score >= 105) {
        return 'Critical';
    }

    if ($score >= 85) {
        return 'High';
    }

    if ($score >= 65) {
        return 'Medium';
    }

    return 'Low';
}

function raidlands_todo_stats(array $items): array
{
    $stats = [
        'total' => count($items),
        'bugs' => 0,
        'suggestions' => 0,
        'features' => 0,
        'critical' => 0,
        'high' => 0,
    ];

    foreach ($items as $item) {
        $source = (string) ($item['source_type'] ?? '');
        $priority = (string) ($item['priority_label'] ?? '');

        if ($source === 'feature') {
            $stats['features'] += 1;
        } elseif ((string) ($item['kind'] ?? '') === 'bug') {
            $stats['bugs'] += 1;
        } else {
            $stats['suggestions'] += 1;
        }

        if ($priority === 'Critical') {
            $stats['critical'] += 1;
        } elseif ($priority === 'High') {
            $stats['high'] += 1;
        }
    }

    return $stats;
}

function raidlands_todo_latest_snapshot(): ?array
{
    if (!raidlands_todo_snapshots_is_ready()) {
        return null;
    }

    try {
        $row = raidlands_db_fetch_one(
            'SELECT *
             FROM admin_todo_snapshots
             ORDER BY generated_at DESC, id DESC
             LIMIT 1'
        );
    } catch (Throwable $error) {
        return null;
    }

    if ($row === null) {
        return null;
    }

    $json = json_decode((string) ($row['generated_json'] ?? ''), true);
    $row['generated'] = is_array($json) ? $json : null;

    return $row;
}

function raidlands_todo_snapshot_is_stale(?array $snapshot): bool
{
    if ($snapshot === null || empty($snapshot['generated_at'])) {
        return true;
    }

    try {
        $generated = new DateTimeImmutable((string) $snapshot['generated_at']);
    } catch (Throwable $error) {
        return true;
    }

    return (time() - $generated->getTimestamp()) >= 20 * 60 * 60;
}

function raidlands_todo_source_hash(array $items): string
{
    $payload = [];

    foreach (array_slice($items, 0, 80) as $item) {
        $payload[] = [
            'key' => (string) ($item['key'] ?? ''),
            'score' => (int) ($item['priority_score'] ?? 0),
            'status' => (string) ($item['status'] ?? ''),
            'title' => (string) ($item['title'] ?? ''),
            'updated_at' => (string) ($item['updated_at'] ?? ''),
        ];
    }

    return hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES));
}

function raidlands_todo_admin_handle_action(array $post): array
{
    $action = (string) ($post['todo_admin_action'] ?? '');

    if ($action !== 'ai_refresh') {
        return [
            'type' => 'warning',
            'message' => 'The TODO list already reflects the current feedback and feature data.',
        ];
    }

    if (!raidlands_todo_snapshots_is_ready()) {
        return [
            'type' => 'warning',
            'message' => raidlands_todo_readiness_message(),
        ];
    }

    if (!raidlands_ai_is_configured()) {
        return [
            'type' => 'warning',
            'message' => 'OPENAI_RAIDLANDS_API_KEY is not set to a usable key yet.',
        ];
    }

    $result = raidlands_todo_generate_ai_snapshot();

    return [
        'type' => (string) ($result['type'] ?? 'success'),
        'message' => (string) ($result['message'] ?? 'TODO snapshot refreshed.'),
    ];
}

function raidlands_todo_generate_ai_snapshot(): array
{
    $state = raidlands_todo_admin_state(80);
    $items = array_values((array) ($state['items'] ?? []));

    if ($items === []) {
        return [
            'type' => 'warning',
            'message' => 'No open bugs, pending ideas, or feature cards are waiting for TODO ranking.',
        ];
    }

    $config = raidlands_ai_config();
    $source_hash = (string) ($state['source_hash'] ?? raidlands_todo_source_hash($items));
    $payload = raidlands_todo_ai_payload($items, (array) ($state['stats'] ?? []));

    try {
        $generated = raidlands_todo_request_ai_brief($payload, $config);
        raidlands_todo_record_snapshot([
            'status' => 'generated',
            'model' => (string) ($config['model'] ?? ''),
            'source_hash' => $source_hash,
            'item_count' => count($items),
            'stats' => (array) ($state['stats'] ?? []),
            'generated_json' => $generated,
            'error_text' => '',
        ]);

        return [
            'type' => 'success',
            'message' => 'AI TODO refreshed for ' . count($items) . ' current item' . (count($items) === 1 ? '' : 's') . '.',
        ];
    } catch (Throwable $error) {
        raidlands_todo_record_snapshot([
            'status' => 'failed',
            'model' => (string) ($config['model'] ?? ''),
            'source_hash' => $source_hash,
            'item_count' => count($items),
            'stats' => (array) ($state['stats'] ?? []),
            'generated_json' => null,
            'error_text' => $error->getMessage(),
        ]);

        return [
            'type' => 'warning',
            'message' => 'AI TODO refresh failed: ' . $error->getMessage(),
        ];
    }
}

function raidlands_todo_ai_payload(array $items, array $stats): array
{
    $payload_items = [];

    foreach (array_slice($items, 0, 30) as $item) {
        $payload_items[] = [
            'key' => (string) ($item['key'] ?? ''),
            'source_type' => (string) ($item['source_type'] ?? ''),
            'kind' => (string) ($item['kind'] ?? ''),
            'title' => (string) ($item['title'] ?? ''),
            'details' => (string) ($item['details'] ?? ''),
            'status' => (string) ($item['status_label'] ?? $item['status'] ?? ''),
            'priority_score' => (int) ($item['priority_score'] ?? 0),
            'reason' => (string) ($item['reason'] ?? ''),
            'next_step' => (string) ($item['next_step'] ?? ''),
            'signal' => (string) ($item['signal'] ?? ''),
        ];
    }

    return [
        'generated_at' => gmdate('c'),
        'stats' => [
            'total' => (int) ($stats['total'] ?? count($items)),
            'bugs' => (int) ($stats['bugs'] ?? 0),
            'suggestions' => (int) ($stats['suggestions'] ?? 0),
            'features' => (int) ($stats['features'] ?? 0),
            'critical' => (int) ($stats['critical'] ?? 0),
            'high' => (int) ($stats['high'] ?? 0),
        ],
        'items' => $payload_items,
    ];
}

function raidlands_todo_request_ai_brief(array $payload, array $config): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL is required for AI TODO generation.');
    }

    $body = [
        'model' => (string) $config['model'],
        'store' => false,
        'input' => [
            [
                'role' => 'developer',
                'content' => [
                    [
                        'type' => 'input_text',
                        'text' => raidlands_todo_ai_prompt(),
                    ],
                ],
            ],
            [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'input_text',
                        'text' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    ],
                ],
            ],
        ],
        'text' => [
            'format' => [
                'type' => 'json_schema',
                'name' => 'raidlands_admin_todo',
                'strict' => true,
                'schema' => raidlands_todo_ai_response_schema(),
            ],
        ],
    ];

    $handle = curl_init('https://api.openai.com/v1/responses');

    if ($handle === false) {
        throw new RuntimeException('Could not initialize AI TODO request.');
    }

    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . (string) $config['apiKey'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        CURLOPT_CONNECTTIMEOUT => (int) $config['timeoutSeconds'],
        CURLOPT_TIMEOUT => (int) $config['timeoutSeconds'],
    ]);

    $raw = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);

    if ($raw === false || $raw === '') {
        throw new RuntimeException($error !== '' ? $error : 'AI TODO request returned no response.');
    }

    $response = json_decode((string) $raw, true);

    if (!is_array($response)) {
        throw new RuntimeException('AI TODO response was not valid JSON.');
    }

    if ($status < 200 || $status >= 300) {
        $message = (string) ($response['error']['message'] ?? ('OpenAI request failed with HTTP ' . $status . '.'));
        throw new RuntimeException($message);
    }

    $generated = json_decode(raidlands_ai_response_text($response), true);

    if (!is_array($generated)) {
        throw new RuntimeException('AI TODO response did not include a valid JSON brief.');
    }

    return raidlands_todo_normalize_ai_brief($generated);
}

function raidlands_todo_ai_prompt(): string
{
    return implode("\n", [
        'You create a concise daily work queue for Raidlands staff from supplied admin data.',
        'Use only the supplied items. Do not invent bugs, player names, code details, or owners.',
        'Prioritize confirmed bugs, in-development work that needs closure, high-signal voting items, and old pending decisions.',
        'Return practical next work, not marketing copy. Keep each next_step specific enough for an admin to act on today.',
        'Use P0 only for urgent player-impacting breakage. Use P1 for next-up work, P2 for normal queue, P3 for watchlist items.',
        'Do not include private contact details.',
    ]);
}

function raidlands_todo_ai_response_schema(): array
{
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['headline', 'generated_for', 'summary', 'items', 'watchlist'],
        'properties' => [
            'headline' => ['type' => 'string'],
            'generated_for' => ['type' => 'string'],
            'summary' => ['type' => 'string'],
            'items' => [
                'type' => 'array',
                'maxItems' => 10,
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['source_key', 'priority', 'title', 'why_now', 'next_step', 'owner_hint'],
                    'properties' => [
                        'source_key' => ['type' => 'string'],
                        'priority' => [
                            'type' => 'string',
                            'enum' => ['P0', 'P1', 'P2', 'P3'],
                        ],
                        'title' => ['type' => 'string'],
                        'why_now' => ['type' => 'string'],
                        'next_step' => ['type' => 'string'],
                        'owner_hint' => ['type' => 'string'],
                    ],
                ],
            ],
            'watchlist' => [
                'type' => 'array',
                'maxItems' => 5,
                'items' => ['type' => 'string'],
            ],
        ],
    ];
}

function raidlands_todo_normalize_ai_brief(array $generated): array
{
    $items = [];

    foreach ((array) ($generated['items'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }

        $priority = (string) ($item['priority'] ?? 'P2');

        if (!in_array($priority, ['P0', 'P1', 'P2', 'P3'], true)) {
            $priority = 'P2';
        }

        $items[] = [
            'source_key' => raidlands_todo_clean_text($item['source_key'] ?? '', 80),
            'priority' => $priority,
            'title' => raidlands_todo_clean_text($item['title'] ?? '', 180),
            'why_now' => raidlands_todo_clean_text($item['why_now'] ?? '', 500),
            'next_step' => raidlands_todo_clean_text($item['next_step'] ?? '', 500),
            'owner_hint' => raidlands_todo_clean_text($item['owner_hint'] ?? '', 160),
        ];
    }

    return [
        'headline' => raidlands_todo_clean_text($generated['headline'] ?? 'Daily TODO', 180),
        'generated_for' => raidlands_todo_clean_text($generated['generated_for'] ?? gmdate('Y-m-d'), 80),
        'summary' => raidlands_todo_clean_text($generated['summary'] ?? '', 700),
        'items' => $items,
        'watchlist' => array_slice(array_map(
            static fn ($item): string => raidlands_todo_clean_text($item, 240),
            array_values((array) ($generated['watchlist'] ?? []))
        ), 0, 5),
    ];
}

function raidlands_todo_record_snapshot(array $data): void
{
    if (!raidlands_todo_snapshots_is_ready()) {
        return;
    }

    $stats = (array) ($data['stats'] ?? []);
    $status = (string) ($data['status'] ?? 'failed');
    $status = in_array($status, ['generated', 'failed'], true) ? $status : 'failed';
    $generated_json = is_array($data['generated_json'] ?? null)
        ? json_encode($data['generated_json'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        : null;

    raidlands_db_execute(
        'INSERT INTO admin_todo_snapshots
            (status, model, source_hash, item_count, open_bug_count, pending_suggestion_count, active_feature_count, generated_json, error_text, generated_at)
         VALUES
            (:status, :model, :source_hash, :item_count, :open_bug_count, :pending_suggestion_count, :active_feature_count, :generated_json, :error_text, NOW())',
        [
            'status' => $status,
            'model' => raidlands_todo_clean_text($data['model'] ?? '', 80),
            'source_hash' => raidlands_todo_clean_text($data['source_hash'] ?? '', 64),
            'item_count' => (int) ($data['item_count'] ?? 0),
            'open_bug_count' => (int) ($stats['bugs'] ?? 0),
            'pending_suggestion_count' => (int) ($stats['suggestions'] ?? 0),
            'active_feature_count' => (int) ($stats['features'] ?? 0),
            'generated_json' => $generated_json,
            'error_text' => raidlands_todo_clean_text($data['error_text'] ?? '', 1200),
        ]
    );
}

function raidlands_todo_clean_text($value, int $max_length = 500): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}
