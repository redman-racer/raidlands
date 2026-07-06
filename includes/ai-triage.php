<?php

require_once __DIR__ . '/store.php';

function raidlands_ai_config(): array
{
    global $openai_config;

    $config = is_array($openai_config ?? null) ? $openai_config : [];

    return [
        'enabled' => !empty($config['enabled']),
        'apiKey' => trim((string) ($config['apiKey'] ?? '')),
        'model' => trim((string) ($config['model'] ?? '')) ?: 'gpt-5.4-mini',
        'timeoutSeconds' => max(1, min(30, (int) ($config['timeoutSeconds'] ?? 4))),
    ];
}

function raidlands_ai_is_configured(): bool
{
    $config = raidlands_ai_config();

    return !empty($config['enabled']) && raidlands_ai_api_key_is_usable((string) $config['apiKey']);
}

function raidlands_ai_api_key_is_usable(string $api_key): bool
{
    $key = trim($api_key);

    if ($key === '') {
        return false;
    }

    $normalized = strtolower(trim($key, "\"' \t\n\r\0\x0B"));
    $placeholders = [
        'insert_key_here',
        'your_openai_api_key',
        'your_openai_key',
        'change-me',
        'changeme',
        'sk-...',
    ];

    if (in_array($normalized, $placeholders, true)) {
        return false;
    }

    return !str_contains($normalized, 'insert_key_here');
}

function raidlands_ai_reviews_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_required()->query('SELECT 1 FROM ai_feedback_reviews LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_ai_readiness_message(): string
{
    if (!raidlands_db_is_configured()) {
        return 'Database credentials are not configured.';
    }

    return 'AI triage history is not ready. Run database/migrations/027_ai_feedback_triage.sql and database/migrations/028_ai_feedback_split_suggestions.sql.';
}

function raidlands_ai_success_statuses(): array
{
    return ['reviewed', 'applied'];
}

function raidlands_ai_review_summary(string $source_type): array
{
    $summary = [
        'ready' => raidlands_ai_reviews_is_ready(),
        'configured' => raidlands_ai_is_configured(),
        'unchecked' => 0,
        'latest' => null,
        'message' => '',
    ];

    if (!$summary['ready']) {
        $summary['message'] = raidlands_ai_readiness_message();
        return $summary;
    }

    $summary['unchecked'] = raidlands_ai_unchecked_count($source_type);
    $summary['latest'] = raidlands_ai_latest_review($source_type);

    if (!$summary['configured']) {
        $summary['message'] = 'OPENAI_RAIDLANDS_API_KEY is not configured in this environment.';
    }

    return $summary;
}

function raidlands_ai_unchecked_count(string $source_type): int
{
    if (!raidlands_ai_reviews_is_ready()) {
        return 0;
    }

    try {
        if ($source_type === 'feedback') {
            $row = raidlands_db_fetch_one(
                "SELECT COUNT(*) AS total
                 FROM support_feedback sf
                 LEFT JOIN ai_feedback_reviews air
                   ON air.source_type = 'feedback'
                  AND air.source_id = sf.id
                  AND air.status IN ('reviewed', 'applied')
                 WHERE sf.status IN ('open', 'reviewing')
                   AND air.id IS NULL"
            );

            return (int) ($row['total'] ?? 0);
        }

        if ($source_type === 'suggestion') {
            $row = raidlands_db_fetch_one(
                "SELECT COUNT(*) AS total
                 FROM feature_suggestions fs
                 LEFT JOIN ai_feedback_reviews air
                   ON air.source_type = 'suggestion'
                  AND air.source_id = fs.id
                  AND air.status IN ('reviewed', 'applied')
                 WHERE fs.status = 'pending'
                   AND air.id IS NULL"
            );

            return (int) ($row['total'] ?? 0);
        }
    } catch (Throwable $error) {
        return 0;
    }

    return 0;
}

function raidlands_ai_latest_review(string $source_type): ?array
{
    if (!raidlands_ai_reviews_is_ready()) {
        return null;
    }

    try {
        return raidlands_db_fetch_one(
            "SELECT air.*, fi.title AS target_feature_title, fs.title AS target_suggestion_title
             FROM ai_feedback_reviews air
             LEFT JOIN feature_items fi ON fi.id = air.target_feature_id
             LEFT JOIN feature_suggestions fs ON fs.id = air.target_suggestion_id
             WHERE air.source_type = :source_type
             ORDER BY air.updated_at DESC, air.id DESC
             LIMIT 1",
            ['source_type' => $source_type]
        );
    } catch (Throwable $error) {
        return null;
    }
}

function raidlands_ai_reviews_for_sources(string $source_type, array $source_ids): array
{
    $ids = array_values(array_filter(array_map('intval', $source_ids), static fn (int $id): bool => $id > 0));

    if ($ids === [] || !raidlands_ai_reviews_is_ready()) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($ids), '?'));

    try {
        $rows = raidlands_db_fetch_all(
            "SELECT air.*, fi.title AS target_feature_title, fs.title AS target_suggestion_title
             FROM ai_feedback_reviews air
             LEFT JOIN feature_items fi ON fi.id = air.target_feature_id
             LEFT JOIN feature_suggestions fs ON fs.id = air.target_suggestion_id
             WHERE air.source_type = ?
               AND air.source_id IN ($placeholders)",
            array_merge([$source_type], $ids)
        );
    } catch (Throwable $error) {
        return [];
    }

    $result = [];

    foreach ($rows as $row) {
        $result[(int) ($row['source_id'] ?? 0)] = $row;
    }

    return $result;
}

function raidlands_ai_process_feedback_inline(int $feedback_id): array
{
    return raidlands_ai_process_source('feedback', $feedback_id, ['inline' => true]);
}

function raidlands_ai_process_suggestion_inline(int $suggestion_id): array
{
    return raidlands_ai_process_source('suggestion', $suggestion_id, ['inline' => true]);
}

function raidlands_ai_process_feedback_batch(int $limit = 50): array
{
    if (!raidlands_ai_reviews_is_ready()) {
        return [
            'total' => 0,
            'applied' => 0,
            'reviewed' => 0,
            'skipped' => 1,
            'failed' => 0,
            'message' => raidlands_ai_readiness_message(),
        ];
    }

    $ids = raidlands_ai_unchecked_feedback_ids($limit);

    return raidlands_ai_process_batch('feedback', $ids);
}

function raidlands_ai_process_suggestion_batch(int $limit = 50): array
{
    if (!raidlands_ai_reviews_is_ready()) {
        return [
            'total' => 0,
            'applied' => 0,
            'reviewed' => 0,
            'skipped' => 1,
            'failed' => 0,
            'message' => raidlands_ai_readiness_message(),
        ];
    }

    $ids = raidlands_ai_unchecked_suggestion_ids($limit);

    return raidlands_ai_process_batch('suggestion', $ids);
}

function raidlands_ai_process_batch(string $source_type, array $ids): array
{
    $summary = [
        'total' => count($ids),
        'applied' => 0,
        'reviewed' => 0,
        'skipped' => 0,
        'failed' => 0,
    ];

    foreach ($ids as $id) {
        $result = raidlands_ai_process_source($source_type, (int) $id, ['inline' => false]);
        $status = (string) ($result['status'] ?? 'failed');

        if (isset($summary[$status])) {
            $summary[$status] += 1;
        } else {
            $summary['failed'] += 1;
        }
    }

    return $summary;
}

function raidlands_ai_batch_message(string $label, array $summary): string
{
    if (isset($summary['message']) && trim((string) $summary['message']) !== '') {
        return (string) $summary['message'];
    }

    $total = (int) ($summary['total'] ?? 0);

    if ($total <= 0) {
        return 'No unchecked ' . $label . ' were waiting for AI triage.';
    }

    return 'AI processed ' . $total . ' ' . $label . ': '
        . (int) ($summary['applied'] ?? 0) . ' applied, '
        . (int) ($summary['reviewed'] ?? 0) . ' marked for review, '
        . (int) ($summary['skipped'] ?? 0) . ' skipped, '
        . (int) ($summary['failed'] ?? 0) . ' failed.';
}

function raidlands_ai_unchecked_feedback_ids(int $limit = 50): array
{
    if (!raidlands_ai_reviews_is_ready()) {
        return [];
    }

    try {
        $rows = raidlands_db_fetch_all(
            "SELECT sf.id
             FROM support_feedback sf
             LEFT JOIN ai_feedback_reviews air
               ON air.source_type = 'feedback'
              AND air.source_id = sf.id
              AND air.status IN ('reviewed', 'applied')
             WHERE sf.status IN ('open', 'reviewing')
               AND air.id IS NULL
             ORDER BY sf.submitted_at ASC, sf.id ASC
             LIMIT " . max(1, min(100, $limit))
        );
    } catch (Throwable $error) {
        return [];
    }

    return array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
}

function raidlands_ai_unchecked_suggestion_ids(int $limit = 50): array
{
    if (!raidlands_ai_reviews_is_ready()) {
        return [];
    }

    try {
        $rows = raidlands_db_fetch_all(
            "SELECT fs.id
             FROM feature_suggestions fs
             LEFT JOIN ai_feedback_reviews air
               ON air.source_type = 'suggestion'
              AND air.source_id = fs.id
              AND air.status IN ('reviewed', 'applied')
             WHERE fs.status = 'pending'
               AND air.id IS NULL
             ORDER BY fs.created_at ASC, fs.id ASC
             LIMIT " . max(1, min(100, $limit))
        );
    } catch (Throwable $error) {
        return [];
    }

    return array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
}

function raidlands_ai_process_source(string $source_type, int $source_id, array $options = []): array
{
    if ($source_id <= 0 || !in_array($source_type, ['feedback', 'suggestion'], true)) {
        return ['status' => 'failed', 'message' => 'Invalid AI source.'];
    }

    if (!raidlands_ai_reviews_is_ready()) {
        return ['status' => 'skipped', 'message' => raidlands_ai_readiness_message()];
    }

    $config = raidlands_ai_config();

    if (empty($config['enabled'])) {
        raidlands_ai_record_review($source_type, $source_id, [
            'status' => 'skipped',
            'model' => (string) $config['model'],
            'action' => 'none',
            'error_text' => 'AI triage is disabled.',
        ]);

        return ['status' => 'skipped', 'message' => 'AI triage is disabled.'];
    }

    if (trim((string) $config['apiKey']) === '') {
        raidlands_ai_record_review($source_type, $source_id, [
            'status' => 'skipped',
            'model' => (string) $config['model'],
            'action' => 'none',
            'error_text' => 'OPENAI_RAIDLANDS_API_KEY is not configured.',
        ]);

        return ['status' => 'skipped', 'message' => 'OPENAI_RAIDLANDS_API_KEY is not configured.'];
    }

    try {
        $source = raidlands_ai_source_row($source_type, $source_id);

        if ($source === null) {
            throw new RuntimeException('AI source item could not be found.');
        }

        $allow_split = array_key_exists('allow_split', $options) ? !empty($options['allow_split']) : true;
        $payload = raidlands_ai_build_payload($source_type, $source, $allow_split);
        $decision = raidlands_ai_request_decision($payload, $config);
        $normalized = raidlands_ai_normalize_decision($source_type, $source, $decision, ['allow_split' => $allow_split]);
        $applied = raidlands_ai_apply_decision($source_type, $source, $normalized, (string) $config['model']);

        return $applied;
    } catch (Throwable $error) {
        raidlands_ai_record_review($source_type, $source_id, [
            'status' => 'failed',
            'model' => (string) ($config['model'] ?? ''),
            'action' => 'none',
            'error_text' => $error->getMessage(),
        ]);

        return ['status' => 'failed', 'message' => $error->getMessage()];
    }
}

function raidlands_ai_source_row(string $source_type, int $source_id): ?array
{
    if ($source_type === 'feedback') {
        raidlands_ai_require_features();

        return raidlands_features_feedback_source_row($source_id);
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM feature_suggestions WHERE id = :id LIMIT 1',
        ['id' => $source_id]
    );
}

function raidlands_ai_build_payload(string $source_type, array $source, bool $allow_split = true): array
{
    raidlands_ai_require_features();

    if (!raidlands_features_is_ready()) {
        throw new RuntimeException(raidlands_features_readiness_message(true));
    }

    raidlands_features_seed_defaults();

    $features = array_values(array_filter(
        raidlands_features_admin_items(),
        static fn (array $feature): bool => (string) ($feature['public_status'] ?? '') !== 'archived'
    ));

    $feature_payload = [];

    foreach (array_slice($features, 0, 80) as $feature) {
        $feature_payload[] = [
            'id' => (int) ($feature['id'] ?? 0),
            'title' => (string) ($feature['title'] ?? ''),
            'summary' => (string) ($feature['summary'] ?? ''),
            'category' => (string) ($feature['category'] ?? ''),
            'public_status' => (string) ($feature['public_status'] ?? 'under_review'),
            'is_voteable' => !empty($feature['is_voteable']),
        ];
    }

    if ($source_type === 'feedback') {
        $source_payload = [
            'source_type' => 'feedback',
            'feedback_type' => raidlands_ai_source_kind($source_type, $source),
            'title' => (string) ($source['summary'] ?? ''),
            'details' => (string) ($source['details'] ?? ''),
            'page_url' => (string) ($source['page_url'] ?? ''),
            'allow_split' => $allow_split,
        ];
    } else {
        $source_payload = [
            'source_type' => 'suggestion',
            'feedback_type' => raidlands_ai_source_kind($source_type, $source),
            'title' => (string) ($source['title'] ?? ''),
            'details' => (string) ($source['details'] ?? ''),
            'page_url' => '',
            'allow_split' => $allow_split,
        ];
    }

    return [
        'source' => $source_payload,
        'existing_features' => $feature_payload,
    ];
}

function raidlands_ai_request_decision(array $payload, array $config): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL is required for AI triage.');
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
                        'text' => raidlands_ai_prompt(),
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
                'name' => 'raidlands_feedback_triage',
                'strict' => true,
                'schema' => raidlands_ai_response_schema(),
            ],
        ],
    ];

    $handle = curl_init('https://api.openai.com/v1/responses');

    if ($handle === false) {
        throw new RuntimeException('Could not initialize AI triage request.');
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
        throw new RuntimeException($error !== '' ? $error : 'AI triage request returned no response.');
    }

    $response = json_decode((string) $raw, true);

    if (!is_array($response)) {
        throw new RuntimeException('AI triage response was not valid JSON.');
    }

    if ($status < 200 || $status >= 300) {
        $message = (string) ($response['error']['message'] ?? ('OpenAI request failed with HTTP ' . $status . '.'));
        throw new RuntimeException($message);
    }

    $text = raidlands_ai_response_text($response);
    $decision = json_decode($text, true);

    if (!is_array($decision)) {
        throw new RuntimeException('AI triage did not return a valid decision object.');
    }

    return $decision;
}

function raidlands_ai_prompt(): string
{
    return implode("\n", [
        'You triage Raidlands Rust server website submissions into the public feature planning system.',
        'Only use the supplied content. Do not infer identity from missing metadata.',
        'Use split_submission first when one submission contains two or more materially different actionable ideas. Return one split item per distinct idea, written as a standalone player submission.',
        'Do not split one idea into steps, examples, or implementation details. Split only unrelated or independently actionable requests, bugs, tuning changes, events, shop items, commands, map changes, and balance asks.',
        'When source.allow_split is false, do not return split_submission; choose the best grouping, public-card, invalid, or review action for that standalone item.',
        'Use group_existing only when the submission is clearly the same request or bug as a non-archived existing feature.',
        'Use create_public_card for valid new suggestions and valid new bugs. Suggestions and feature requests should become public voting cards. Bugs should become public under_review, non-voteable fix cards.',
        'Use close_invalid only for high-confidence spam, empty, abusive, impossible, or unusable submissions.',
        'Use needs_review when uncertain, when the target feature is only loosely related, or when staff judgment is needed.',
        'Never include private contact data in notes. Keep admin_note concise and staff-facing.',
    ]);
}

function raidlands_ai_response_schema(): array
{
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['action', 'valid', 'confidence', 'reason', 'target_feature_id', 'public_card', 'split_items', 'admin_note'],
        'properties' => [
            'action' => [
                'type' => 'string',
                'enum' => ['group_existing', 'create_public_card', 'close_invalid', 'needs_review', 'split_submission'],
            ],
            'valid' => ['type' => 'boolean'],
            'confidence' => ['type' => 'number'],
            'reason' => ['type' => 'string'],
            'target_feature_id' => ['type' => 'integer'],
            'public_card' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['title', 'summary', 'category', 'public_status', 'is_voteable', 'icon_alias'],
                'properties' => [
                    'title' => ['type' => 'string'],
                    'summary' => ['type' => 'string'],
                    'category' => ['type' => 'string'],
                    'public_status' => [
                        'type' => 'string',
                        'enum' => ['active', 'voting', 'planned', 'in_development', 'under_review'],
                    ],
                    'is_voteable' => ['type' => 'boolean'],
                    'icon_alias' => ['type' => 'string'],
                ],
            ],
            'split_items' => [
                'type' => 'array',
                'maxItems' => 12,
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['title', 'details', 'kind'],
                    'properties' => [
                        'title' => ['type' => 'string'],
                        'details' => ['type' => 'string'],
                        'kind' => [
                            'type' => 'string',
                            'enum' => ['bug', 'suggestion', 'feature_request'],
                        ],
                    ],
                ],
            ],
            'admin_note' => ['type' => 'string'],
        ],
    ];
}

function raidlands_ai_response_text(array $response): string
{
    if (isset($response['output_text']) && is_string($response['output_text'])) {
        return trim($response['output_text']);
    }

    foreach ((array) ($response['output'] ?? []) as $item) {
        foreach ((array) ($item['content'] ?? []) as $content) {
            if (isset($content['text']) && is_string($content['text'])) {
                return trim($content['text']);
            }
        }
    }

    throw new RuntimeException('AI triage response did not include output text.');
}

function raidlands_ai_normalize_decision(string $source_type, array $source, array $decision, array $options = []): array
{
    raidlands_ai_require_features();

    $action = (string) ($decision['action'] ?? 'needs_review');
    $allowed = ['group_existing', 'create_public_card', 'close_invalid', 'needs_review', 'split_submission'];

    if (!in_array($action, $allowed, true)) {
        $action = 'needs_review';
    }

    $confidence = max(0.0, min(1.0, (float) ($decision['confidence'] ?? 0)));
    $source_kind = raidlands_ai_source_kind($source_type, $source);
    $reason = raidlands_ai_clean_text($decision['reason'] ?? '', 700);
    $admin_note = raidlands_ai_clean_text($decision['admin_note'] ?? '', 900);
    $split_items = raidlands_ai_normalize_split_items((array) ($decision['split_items'] ?? []));

    if ($admin_note === '') {
        $admin_note = $reason !== '' ? 'AI triage: ' . $reason : 'AI triage completed.';
    } elseif (!str_starts_with(strtolower($admin_note), 'ai')) {
        $admin_note = 'AI triage: ' . $admin_note;
    }

    if ($action === 'split_submission') {
        if (empty($options['allow_split'])) {
            $action = 'needs_review';
            $split_items = [];
            $admin_note = raidlands_ai_append_note($admin_note, 'Split was requested for a child item, so staff review is required.');
        } elseif ($confidence < 0.6 || count($split_items) < 2) {
            $action = 'needs_review';
            $split_items = [];
            $admin_note = raidlands_ai_append_note($admin_note, 'Confidence was too low or too few distinct items were found to split automatically.');
        }
    }

    if ($action === 'group_existing') {
        $target_feature_id = (int) ($decision['target_feature_id'] ?? 0);

        if ($confidence < 0.82 || $target_feature_id <= 0 || !raidlands_ai_feature_can_receive($target_feature_id)) {
            $action = 'needs_review';
            $target_feature_id = 0;
            $admin_note = raidlands_ai_append_note($admin_note, 'Confidence was too low for automatic grouping.');
        }
    } else {
        $target_feature_id = 0;
    }

    if ($action === 'close_invalid' && $confidence < 0.9) {
        $action = 'needs_review';
        $admin_note = raidlands_ai_append_note($admin_note, 'Confidence was too low to close automatically.');
    }

    if ($action === 'create_public_card' && $confidence < 0.55) {
        $action = 'needs_review';
        $admin_note = raidlands_ai_append_note($admin_note, 'Confidence was too low to create a public card.');
    }

    $card = is_array($decision['public_card'] ?? null) ? $decision['public_card'] : [];
    $title = raidlands_ai_clean_text($card['title'] ?? ($source['summary'] ?? ($source['title'] ?? 'Feature request')), 180);
    $summary = raidlands_ai_clean_text($card['summary'] ?? ($source['details'] ?? ''), 500);
    $category = raidlands_ai_clean_text($card['category'] ?? '', 120);

    if ($title === '') {
        $title = $source_kind === 'bug' ? 'Bug fix request' : 'Player suggestion';
    }

    if ($summary === '') {
        $summary = raidlands_ai_clean_text($source['details'] ?? '', 500);
    }

    if ($source_kind === 'bug') {
        $public_status = 'under_review';
        $is_voteable = 0;
        $icon_alias = 'BUG';
        $category = $category !== '' ? $category : 'Bugs and Fixes';
    } else {
        $public_status = 'voting';
        $is_voteable = 1;
        $icon_alias = strtoupper(raidlands_ai_clean_text($card['icon_alias'] ?? raidlands_features_icon_for_title($title), 32));
        $category = $category !== '' ? $category : raidlands_features_category_for_title($title);
    }

    return [
        'action' => $action,
        'valid' => !empty($decision['valid']),
        'confidence' => $confidence,
        'reason' => $reason,
        'target_feature_id' => $target_feature_id,
        'admin_note' => $admin_note,
        'public_card' => [
            'title' => $title,
            'summary' => $summary,
            'category' => $category,
            'public_status' => $public_status,
            'is_public' => 1,
            'is_voteable' => $is_voteable,
            'icon_alias' => $icon_alias !== '' ? $icon_alias : 'EVENT',
            'sort_order' => 500,
        ],
        'split_items' => $split_items,
    ];
}

function raidlands_ai_apply_decision(string $source_type, array $source, array $decision, string $model): array
{
    raidlands_ai_require_features();

    $source_id = (int) ($source['id'] ?? 0);
    $pdo = raidlands_db_required();
    $owns_transaction = !$pdo->inTransaction();
    $status = 'reviewed';
    $target_feature_id = 0;
    $target_suggestion_id = 0;
    $split_child_suggestion_ids = [];
    $child_results = [];

    if ($owns_transaction) {
        $pdo->beginTransaction();
    }

    try {
        $action = (string) ($decision['action'] ?? 'needs_review');
        $note = (string) ($decision['admin_note'] ?? 'AI triage completed.');

        if ($action === 'group_existing') {
            $target_feature_id = (int) ($decision['target_feature_id'] ?? 0);
            $target_suggestion_id = raidlands_ai_group_source($source_type, $source, $target_feature_id, $note);
            $status = 'applied';
        } elseif ($action === 'create_public_card') {
            $target_feature_id = raidlands_features_save_item((array) ($decision['public_card'] ?? []), null);
            $target_suggestion_id = raidlands_ai_group_source($source_type, $source, $target_feature_id, $note);
            $status = 'applied';
        } elseif ($action === 'close_invalid') {
            raidlands_ai_close_source($source_type, $source, $note);
            $status = 'applied';
        } elseif ($action === 'split_submission') {
            $split_result = raidlands_ai_split_source($source_type, $source, $decision, $note);
            $target_suggestion_id = (int) ($split_result['parent_suggestion_id'] ?? 0);
            $split_child_suggestion_ids = array_values(array_filter(
                array_map('intval', (array) ($split_result['child_suggestion_ids'] ?? [])),
                static fn (int $id): bool => $id > 0
            ));
            $decision['parent_suggestion_id'] = $target_suggestion_id;
            $decision['child_suggestion_ids'] = $split_child_suggestion_ids;
            $status = 'applied';
        }

        raidlands_ai_record_review($source_type, $source_id, [
            'status' => $status,
            'model' => $model,
            'action' => $action,
            'confidence' => (float) ($decision['confidence'] ?? 0),
            'target_feature_id' => $target_feature_id > 0 ? $target_feature_id : null,
            'target_suggestion_id' => $target_suggestion_id > 0 ? $target_suggestion_id : null,
            'admin_note' => $note,
            'result_json' => $decision,
            'error_text' => '',
        ]);

        if ($owns_transaction) {
            $pdo->commit();
        }

        if ($split_child_suggestion_ids !== [] && !$pdo->inTransaction()) {
            foreach ($split_child_suggestion_ids as $child_suggestion_id) {
                $child_results[$child_suggestion_id] = raidlands_ai_process_source('suggestion', $child_suggestion_id, [
                    'inline' => true,
                    'allow_split' => false,
                ]);
            }
        }
    } catch (Throwable $error) {
        if ($owns_transaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    return [
        'status' => $status,
        'message' => $action,
        'target_feature_id' => $target_feature_id,
        'target_suggestion_id' => $target_suggestion_id,
        'child_suggestion_ids' => $split_child_suggestion_ids,
        'child_results' => $child_results,
    ];
}

function raidlands_ai_group_source(string $source_type, array $source, int $feature_id, string $admin_note): int
{
    if ($feature_id <= 0) {
        throw new RuntimeException('AI triage target feature is missing.');
    }

    if ($source_type === 'feedback') {
        $suggestion_id = raidlands_features_upsert_feedback_suggestion($source, $feature_id, $admin_note);
        raidlands_features_mark_feedback_planned((int) ($source['id'] ?? 0), $admin_note);

        return $suggestion_id;
    }

    $suggestion_id = (int) ($source['id'] ?? 0);
    $existing_note = (string) ($source['admin_note'] ?? '');

    raidlands_db_execute(
        "UPDATE feature_suggestions
         SET feature_id = :feature_id,
             status = 'grouped',
             admin_note = :admin_note,
             updated_at = NOW()
         WHERE id = :id",
        [
            'feature_id' => $feature_id,
            'admin_note' => raidlands_features_append_admin_note($existing_note, $admin_note),
            'id' => $suggestion_id,
        ]
    );

    return $suggestion_id;
}

function raidlands_ai_split_source(string $source_type, array $source, array $decision, string $admin_note): array
{
    raidlands_ai_require_features();

    $source_id = (int) ($source['id'] ?? 0);
    $split_items = array_values((array) ($decision['split_items'] ?? []));

    if ($source_id <= 0 || count($split_items) < 2) {
        throw new RuntimeException('AI split requires at least two standalone items.');
    }

    $split_group_key = $source_type . '-' . $source_id;
    $parent_suggestion_id = $source_type === 'feedback'
        ? raidlands_ai_ensure_feedback_split_parent($source, $admin_note, $split_group_key)
        : raidlands_ai_mark_suggestion_split_parent($source, $admin_note, $split_group_key);

    $child_suggestion_ids = [];
    $index = 1;

    foreach ($split_items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $child_id = raidlands_ai_upsert_split_child(
            $source_type,
            $source,
            $parent_suggestion_id,
            $split_group_key,
            $index,
            $item
        );

        if ($child_id > 0) {
            $child_suggestion_ids[] = $child_id;
            $index += 1;
        }
    }

    if (count($child_suggestion_ids) < 2) {
        throw new RuntimeException('AI split did not produce enough child suggestions.');
    }

    if ($source_type === 'feedback') {
        raidlands_ai_mark_feedback_split((int) ($source['id'] ?? 0), raidlands_ai_append_note($admin_note, 'Split into ' . count($child_suggestion_ids) . ' standalone suggestions.'));
    }

    return [
        'parent_suggestion_id' => $parent_suggestion_id,
        'child_suggestion_ids' => $child_suggestion_ids,
    ];
}

function raidlands_ai_ensure_feedback_split_parent(array $feedback, string $admin_note, string $split_group_key): int
{
    $feedback_id = (int) ($feedback['id'] ?? 0);

    if ($feedback_id <= 0) {
        throw new RuntimeException('Feedback record is required for AI splitting.');
    }

    $identity = raidlands_ai_suggestion_identity_from_feedback($feedback);
    $title = raidlands_features_clean_text($feedback['summary'] ?? '', 180) ?: 'Split feedback submission';
    $details = raidlands_features_clean_multiline($feedback['details'] ?? '', 3000);
    $ai_kind = raidlands_ai_source_kind('feedback', $feedback);
    $existing = raidlands_db_fetch_one(
        'SELECT id, admin_note FROM feature_suggestions WHERE support_feedback_id = :support_feedback_id LIMIT 1',
        ['support_feedback_id' => $feedback_id]
    );

    if ($existing !== null) {
        $suggestion_id = (int) ($existing['id'] ?? 0);
        raidlands_db_execute(
            "UPDATE feature_suggestions
             SET feature_id = NULL,
                 parent_suggestion_id = NULL,
                 split_group_key = :split_group_key,
                 split_index = 0,
                 player_id = :player_id,
                 steam_id64 = :steam_id64,
                 source_type = :source_type,
                 ai_kind = :ai_kind,
                 status = 'split',
                 title = :title,
                 details = :details,
                 admin_note = :admin_note,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'split_group_key' => $split_group_key,
                'player_id' => $identity['player_id'],
                'steam_id64' => $identity['steam_id64'],
                'source_type' => $identity['source_type'],
                'ai_kind' => $ai_kind,
                'title' => $title,
                'details' => $details,
                'admin_note' => raidlands_features_append_admin_note((string) ($existing['admin_note'] ?? ''), $admin_note),
                'id' => $suggestion_id,
            ]
        );

        return $suggestion_id;
    }

    raidlands_db_execute(
        'INSERT INTO feature_suggestions
            (feature_id, support_feedback_id, parent_suggestion_id, split_group_key, split_index, player_id, steam_id64, source_type, ai_kind, status, title, details, admin_note, created_by_steam_id64, created_at, updated_at)
         VALUES
            (NULL, :support_feedback_id, NULL, :split_group_key, 0, :player_id, :steam_id64, :source_type, :ai_kind, "split", :title, :details, :admin_note, :created_by, :created_at, :updated_at)',
        [
            'support_feedback_id' => $feedback_id,
            'split_group_key' => $split_group_key,
            'player_id' => $identity['player_id'],
            'steam_id64' => $identity['steam_id64'],
            'source_type' => $identity['source_type'],
            'ai_kind' => $ai_kind,
            'title' => $title,
            'details' => $details,
            'admin_note' => $admin_note,
            'created_by' => raidlands_features_admin_actor_steam(),
            'created_at' => (string) ($feedback['submitted_at'] ?? date('Y-m-d H:i:s')),
            'updated_at' => date('Y-m-d H:i:s'),
        ]
    );

    return (int) raidlands_db_required()->lastInsertId();
}

function raidlands_ai_mark_suggestion_split_parent(array $suggestion, string $admin_note, string $split_group_key): int
{
    $suggestion_id = (int) ($suggestion['id'] ?? 0);

    if ($suggestion_id <= 0) {
        throw new RuntimeException('Suggestion record is required for AI splitting.');
    }

    raidlands_db_execute(
        "UPDATE feature_suggestions
         SET feature_id = NULL,
             parent_suggestion_id = NULL,
             split_group_key = :split_group_key,
             split_index = 0,
             status = 'split',
             admin_note = :admin_note,
             updated_at = NOW()
         WHERE id = :id",
        [
            'split_group_key' => $split_group_key,
            'admin_note' => raidlands_features_append_admin_note((string) ($suggestion['admin_note'] ?? ''), $admin_note),
            'id' => $suggestion_id,
        ]
    );

    return $suggestion_id;
}

function raidlands_ai_upsert_split_child(string $source_type, array $source, int $parent_suggestion_id, string $split_group_key, int $split_index, array $item): int
{
    if ($parent_suggestion_id <= 0 || $split_index <= 0) {
        return 0;
    }

    $title = raidlands_features_clean_text($item['title'] ?? '', 180);
    $details = raidlands_features_clean_multiline($item['details'] ?? '', 3000);
    $ai_kind = raidlands_ai_split_kind($item['kind'] ?? raidlands_ai_source_kind($source_type, $source));

    if ($title === '') {
        $title = $ai_kind === 'bug' ? 'Bug fix request' : 'Player suggestion';
    }

    if ($details === '') {
        $details = $title;
    }

    $identity = $source_type === 'feedback'
        ? raidlands_ai_suggestion_identity_from_feedback($source)
        : raidlands_ai_suggestion_identity_from_suggestion($source);
    $admin_note = 'AI split from ' . ($source_type === 'feedback' ? 'support feedback' : 'suggestion') . ' #' . (int) ($source['id'] ?? 0) . '.';

    raidlands_db_execute(
        'INSERT INTO feature_suggestions
            (feature_id, support_feedback_id, parent_suggestion_id, split_group_key, split_index, player_id, steam_id64, source_type, ai_kind, status, title, details, admin_note, created_by_steam_id64, created_at, updated_at)
         VALUES
            (NULL, NULL, :parent_suggestion_id, :split_group_key, :split_index, :player_id, :steam_id64, :source_type, :ai_kind, "pending", :title, :details, :admin_note, :created_by, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
            parent_suggestion_id = VALUES(parent_suggestion_id),
            player_id = VALUES(player_id),
            steam_id64 = VALUES(steam_id64),
            source_type = VALUES(source_type),
            ai_kind = VALUES(ai_kind),
            title = VALUES(title),
            details = VALUES(details),
            admin_note = IF(admin_note IS NULL OR admin_note = \'\', VALUES(admin_note), admin_note),
            updated_at = NOW()',
        [
            'parent_suggestion_id' => $parent_suggestion_id,
            'split_group_key' => $split_group_key,
            'split_index' => $split_index,
            'player_id' => $identity['player_id'],
            'steam_id64' => $identity['steam_id64'],
            'source_type' => $identity['source_type'],
            'ai_kind' => $ai_kind,
            'title' => $title,
            'details' => $details,
            'admin_note' => $admin_note,
            'created_by' => $identity['created_by'],
        ]
    );

    $row = raidlands_db_fetch_one(
        'SELECT id FROM feature_suggestions WHERE split_group_key = :split_group_key AND split_index = :split_index LIMIT 1',
        [
            'split_group_key' => $split_group_key,
            'split_index' => $split_index,
        ]
    );

    return (int) ($row['id'] ?? 0);
}

function raidlands_ai_mark_feedback_split(int $feedback_id, string $admin_note): void
{
    if ($feedback_id <= 0) {
        return;
    }

    $feedback = raidlands_db_fetch_one(
        'SELECT admin_note FROM support_feedback WHERE id = :id LIMIT 1',
        ['id' => $feedback_id]
    );

    if ($feedback === null) {
        return;
    }

    raidlands_db_execute(
        "UPDATE support_feedback
         SET status = 'reviewing',
             admin_note = :admin_note,
             updated_at = NOW()
         WHERE id = :id",
        [
            'admin_note' => raidlands_features_append_admin_note((string) ($feedback['admin_note'] ?? ''), $admin_note),
            'id' => $feedback_id,
        ]
    );
}

function raidlands_ai_close_source(string $source_type, array $source, string $admin_note): void
{
    raidlands_ai_require_features();

    if ($source_type === 'feedback') {
        $existing_note = (string) ($source['admin_note'] ?? '');

        raidlands_db_execute(
            "UPDATE support_feedback
             SET status = 'closed',
                 admin_note = :admin_note,
                 updated_at = NOW()
             WHERE id = :id",
            [
                'admin_note' => raidlands_features_append_admin_note($existing_note, $admin_note),
                'id' => (int) ($source['id'] ?? 0),
            ]
        );

        return;
    }

    raidlands_db_execute(
        "UPDATE feature_suggestions
         SET status = 'rejected',
             admin_note = :admin_note,
             updated_at = NOW()
         WHERE id = :id",
        [
            'admin_note' => raidlands_features_append_admin_note((string) ($source['admin_note'] ?? ''), $admin_note),
            'id' => (int) ($source['id'] ?? 0),
        ]
    );
}

function raidlands_ai_record_review(string $source_type, int $source_id, array $data): void
{
    if (!raidlands_ai_reviews_is_ready()) {
        return;
    }

    $status = (string) ($data['status'] ?? 'skipped');
    $action = (string) ($data['action'] ?? 'none');
    $model = raidlands_ai_clean_text($data['model'] ?? '', 80);
    $confidence = max(0.0, min(1.0, (float) ($data['confidence'] ?? 0)));
    $result_json = isset($data['result_json'])
        ? json_encode($data['result_json'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        : null;

    raidlands_db_execute(
        'INSERT INTO ai_feedback_reviews
            (source_type, source_id, status, model, action, confidence, target_feature_id, target_suggestion_id, admin_note, result_json, error_text, reviewed_at)
         VALUES
            (:source_type, :source_id, :status, :model, :action, :confidence, :target_feature_id, :target_suggestion_id, :admin_note, :result_json, :error_text, NOW())
         ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            model = VALUES(model),
            action = VALUES(action),
            confidence = VALUES(confidence),
            target_feature_id = VALUES(target_feature_id),
            target_suggestion_id = VALUES(target_suggestion_id),
            admin_note = VALUES(admin_note),
            result_json = VALUES(result_json),
            error_text = VALUES(error_text),
            reviewed_at = VALUES(reviewed_at),
            updated_at = NOW()',
        [
            'source_type' => $source_type,
            'source_id' => $source_id,
            'status' => in_array($status, ['skipped', 'failed', 'reviewed', 'applied'], true) ? $status : 'failed',
            'model' => $model,
            'action' => in_array($action, ['group_existing', 'create_public_card', 'close_invalid', 'needs_review', 'split_submission', 'none'], true) ? $action : 'none',
            'confidence' => $confidence,
            'target_feature_id' => (int) ($data['target_feature_id'] ?? 0) > 0 ? (int) $data['target_feature_id'] : null,
            'target_suggestion_id' => (int) ($data['target_suggestion_id'] ?? 0) > 0 ? (int) $data['target_suggestion_id'] : null,
            'admin_note' => raidlands_ai_clean_text($data['admin_note'] ?? '', 1200),
            'result_json' => $result_json,
            'error_text' => raidlands_ai_clean_text($data['error_text'] ?? '', 1200),
        ]
    );
}

function raidlands_ai_feature_can_receive(int $feature_id): bool
{
    $feature = raidlands_db_fetch_one(
        "SELECT id FROM feature_items WHERE id = :id AND public_status <> 'archived' LIMIT 1",
        ['id' => $feature_id]
    );

    return $feature !== null;
}

function raidlands_ai_review_label(?array $review): string
{
    if ($review === null) {
        return 'Unchecked';
    }

    $status = ucwords(str_replace('_', ' ', (string) ($review['status'] ?? 'skipped')));
    $action = ucwords(str_replace('_', ' ', (string) ($review['action'] ?? 'none')));

    return trim($status . ($action !== '' && $action !== 'None' ? ' / ' . $action : ''));
}

function raidlands_ai_review_target_label(?array $review): string
{
    if ($review === null) {
        return '';
    }

    $feature = trim((string) ($review['target_feature_title'] ?? ''));

    if ($feature !== '') {
        return $feature;
    }

    $suggestion = trim((string) ($review['target_suggestion_title'] ?? ''));

    return $suggestion;
}

function raidlands_ai_source_kind(string $source_type, array $source): string
{
    if ($source_type === 'feedback') {
        return raidlands_ai_split_kind($source['type'] ?? 'bug');
    }

    return raidlands_ai_split_kind($source['ai_kind'] ?? 'feature_request');
}

function raidlands_ai_normalize_split_items(array $items): array
{
    $normalized = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $title = raidlands_ai_clean_text($item['title'] ?? '', 180);
        $details = raidlands_ai_clean_text($item['details'] ?? '', 3000);
        $kind = raidlands_ai_split_kind($item['kind'] ?? 'feature_request');

        if ($title === '' && $details === '') {
            continue;
        }

        if ($title === '') {
            $title = $kind === 'bug' ? 'Bug fix request' : 'Player suggestion';
        }

        if ($details === '') {
            $details = $title;
        }

        $normalized[] = [
            'title' => $title,
            'details' => $details,
            'kind' => $kind,
        ];

        if (count($normalized) >= 12) {
            break;
        }
    }

    return $normalized;
}

function raidlands_ai_split_kind($value): string
{
    $kind = strtolower(trim((string) $value));

    if ($kind === 'bug') {
        return 'bug';
    }

    if ($kind === 'suggestion') {
        return 'suggestion';
    }

    return 'feature_request';
}

function raidlands_ai_suggestion_identity_from_feedback(array $feedback): array
{
    $steam_id64 = raidlands_features_valid_steam_or_owner((string) (($feedback['steam_id64'] ?? '') ?: ($feedback['player_steam_id64'] ?? '')));
    $source_type = $steam_id64 === RAIDLANDS_FEATURE_OWNER_STEAM_ID64 && empty($feedback['steam_id64']) && empty($feedback['player_steam_id64'])
        ? 'staff_import'
        : 'feedback';

    return [
        'player_id' => (int) ($feedback['player_id'] ?? 0) > 0 ? (int) $feedback['player_id'] : null,
        'steam_id64' => $steam_id64,
        'source_type' => $source_type,
        'created_by' => raidlands_features_admin_actor_steam(),
    ];
}

function raidlands_ai_suggestion_identity_from_suggestion(array $suggestion): array
{
    $steam_id64 = raidlands_features_valid_steam_or_owner((string) ($suggestion['steam_id64'] ?? ''));
    $source_type = (string) ($suggestion['source_type'] ?? 'public');

    if (!in_array($source_type, ['public', 'feedback', 'staff', 'staff_import'], true)) {
        $source_type = 'public';
    }

    return [
        'player_id' => (int) ($suggestion['player_id'] ?? 0) > 0 ? (int) $suggestion['player_id'] : null,
        'steam_id64' => $steam_id64,
        'source_type' => $source_type,
        'created_by' => raidlands_features_valid_steam_or_owner((string) ($suggestion['created_by_steam_id64'] ?? $steam_id64)),
    ];
}

function raidlands_ai_clean_text($value, int $max_length): string
{
    $text = trim(preg_replace('/\s+/', ' ', (string) $value) ?? '');

    if ($text === '') {
        return '';
    }

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_ai_append_note(string $existing, string $addition): string
{
    $existing = trim($existing);
    $addition = trim($addition);

    if ($addition === '') {
        return $existing;
    }

    if ($existing === '') {
        return $addition;
    }

    return raidlands_ai_clean_text($existing . ' ' . $addition, 1200);
}

function raidlands_ai_require_features(): void
{
    if (!function_exists('raidlands_features_is_ready')) {
        require_once __DIR__ . '/features.php';
    }
}
