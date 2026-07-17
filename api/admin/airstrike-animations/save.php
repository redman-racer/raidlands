<?php

require dirname(__DIR__, 3) . '/includes/bootstrap.php';
require_once $site_root . '/includes/admin-api.php';
require_once $site_root . '/includes/airstrike-animations.php';
require_once $site_root . '/includes/airstrike-agent.php';

raidlands_admin_api_require('POST');
$payload = raidlands_admin_api_read_json(RAIDLANDS_AIRSTRIKE_ANIMATION_MAX_SOURCE_BYTES);
raidlands_admin_api_require_csrf($payload);

try {
    $source = (array) ($payload['source'] ?? []);
    $agent_proposal = raidlands_airstrike_agent_proposal_for_save((int) ($payload['agentProposalId'] ?? 0), $source);
    $profile = raidlands_airstrike_animations_save(
        (string) ($payload['profileKey'] ?? ''),
        $source,
        (int) ($payload['baseVersion'] ?? 0)
    );
    if ($agent_proposal !== null) {
        raidlands_airstrike_agent_update_proposal((int) $agent_proposal['id'], 'saved');
        raidlands_admin_audit('airstrike_animation_save_agent_attribution', 'airstrike_animation_profile', (string) ($payload['profileKey'] ?? ''), [
            'agent_proposal_id' => (int) $agent_proposal['id'],
            'agent_thread_id' => (int) $agent_proposal['thread_id'],
        ]);
    }
    raidlands_admin_api_response([
        'ok' => true,
        'profile' => $profile,
        'agentProposalId' => $agent_proposal === null ? null : (int) $agent_proposal['id'],
    ]);
} catch (Throwable $error) {
    raidlands_admin_api_error($error);
}
