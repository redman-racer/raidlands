<?php

require dirname(__DIR__) . '/includes/config.php';
require dirname(__DIR__) . '/includes/database.php';
require dirname(__DIR__) . '/includes/discord.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

if (!raidlands_discord_tables_ready()) {
    fwrite(STDERR, "Discord migration is not installed.\n");
    exit(1);
}

$pdo = raidlands_db_required();
$pdo->beginTransaction();

try {
    raidlands_discord_admin_save([
        'discord_settings' => [
            'guild_id' => '12345678901234567',
            'verified_role_id' => '22345678901234567',
            'connection_label' => 'Connect Discord',
            'connection_guidance' => 'Smoke-test guidance.',
            'auto_join_guild' => '1',
            'assign_verified_role' => '1',
            'remove_roles_on_unlink' => '1',
            'sync_interval_minutes' => '15',
            'retry_limit' => '5',
            'failure_notification_threshold' => '3',
        ],
        'discord_mappings' => [[
            'oxide_group' => 'vip_gold',
            'discord_role_id' => '32345678901234567',
            'label' => 'VIP Gold',
            'is_enabled' => '1',
            'remove_when_inactive' => '1',
            'sort_order' => '10',
        ]],
    ], 'smoke-test');

    $settings = raidlands_discord_settings(true);
    $mappings = raidlands_discord_role_mappings(false);

    if ($settings['guild_id'] !== '12345678901234567' || count($mappings) !== 1 || $mappings[0]['oxide_group'] !== 'vip_gold') {
        throw new RuntimeException('Discord settings or role mappings did not round-trip.');
    }

    $pdo->rollBack();
    echo "Discord integration smoke passed.\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
