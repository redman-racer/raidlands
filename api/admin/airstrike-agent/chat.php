<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-agent.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json(RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_SOURCE_BYTES + RAIDLANDS_AIRSTRIKE_AGENT_MAX_MESSAGE_BYTES);
raidlands_admin_api_require_csrf($payload);

$thread_id = (int) ($payload['threadId'] ?? 0);
if ($thread_id <= 0) {
    $created = raidlands_airstrike_agent_create_thread(
        (string) (($payload['editorContext']['source']['ProfileKey'] ?? '')),
        (string) ($payload['mode'] ?? 'plan')
    );
    $thread_id = (int) $created['id'];
}

header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Accel-Buffering: no');
while (ob_get_level() > 0) {
    ob_end_flush();
}
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

$emit = static function (string $event, array $data): void {
    echo 'event: ' . preg_replace('/[^a-z_]/', '', strtolower($event)) . "\n";
    echo 'data: ' . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
};

try {
    if (!raidlands_airstrike_agent_acquire_lock($thread_id)) {
        throw new UnexpectedValueException('This conversation already has an active agent run.');
    }
    $emit('thread', ['threadId' => $thread_id]);
    try {
        $result = raidlands_airstrike_agent_run(
            $thread_id,
            (string) ($payload['mode'] ?? 'plan'),
            (string) ($payload['message'] ?? ''),
            is_array($payload['editorContext'] ?? null) ? $payload['editorContext'] : [],
            $emit
        );
    } finally {
        raidlands_airstrike_agent_release_lock($thread_id);
    }
    $emit('completed', $result);
} catch (Throwable $error) {
    try {
        raidlands_airstrike_agent_add_item($thread_id, 'error', 'system', $error->getMessage());
    } catch (Throwable $ignored) {
    }
    $emit('error', ['message' => $error->getMessage()]);
}
