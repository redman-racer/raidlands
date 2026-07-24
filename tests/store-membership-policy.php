<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/store.php';

function expect_store_policy(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$now = strtotime('2026-07-24 12:00:00 UTC');
$vip = [
    'product_type' => 'kit_bundle',
    'is_stackable' => 0,
    'tier_priority' => 10,
];
$diamond = [
    'product_type' => 'kit_bundle',
    'is_stackable' => 0,
    'tier_priority' => 50,
];
$week = ['access_duration_seconds' => 7 * 86400];
$lifetime = ['access_duration_seconds' => 0];

$decision = raidlands_store_rank_purchase_decision($vip, $week, [
    ['tier_priority' => 50, 'ends_at' => '2026-08-24 12:00:00'],
], $now);
expect_store_policy($decision['allowed'] === false, 'A lower rank must be blocked while a higher rank is active.');

$decision = raidlands_store_rank_purchase_decision($diamond, $week, [
    ['tier_priority' => 50, 'ends_at' => null],
], $now);
expect_store_policy($decision['allowed'] === false, 'A finite pass must not replace a lifetime rank.');

$decision = raidlands_store_rank_purchase_decision($diamond, $week, [
    ['tier_priority' => 50, 'ends_at' => '2026-08-24 12:00:00'],
], $now);
expect_store_policy($decision['allowed'] === false, 'A pass that does not extend the active rank must be blocked.');

$decision = raidlands_store_rank_purchase_decision($diamond, $week, [
    ['tier_priority' => 50, 'ends_at' => '2026-07-26 12:00:00'],
], $now);
expect_store_policy($decision['allowed'] === true, 'A same-tier pass that extends access must remain available.');

$decision = raidlands_store_rank_purchase_decision($diamond, $lifetime, [
    ['tier_priority' => 50, 'ends_at' => '2026-08-24 12:00:00'],
], $now);
expect_store_policy($decision['allowed'] === true, 'A lifetime upgrade over finite access must remain available.');

$decision = raidlands_store_rank_purchase_decision($diamond, $week, [
    ['tier_priority' => 10, 'ends_at' => null],
], $now);
expect_store_policy($decision['allowed'] === true, 'A full-price higher-tier purchase must remain available.');

$perk = [
    'product_type' => 'perk',
    'is_stackable' => 0,
    'tier_priority' => 0,
];
$decision = raidlands_store_rank_purchase_decision($perk, $week, [], $now);
expect_store_policy($decision['allowed'] === true, 'Non-rank products must not be blocked by rank policy.');

$expected_permissions = [
    'redeem-pack-sentry-small' => 'kits.sentry.small',
    'redeem-pack-sentry-large' => 'kits.sentry.large',
    'redeem-pack-portafort' => 'kits.portafort',
    'redeem-pack-vehicle' => 'kits.vehicle',
];

foreach ($expected_permissions as $slug => $permission) {
    expect_store_policy(
        raidlands_store_required_live_permission($slug) === $permission,
        "Unexpected live permission mapping for {$slug}."
    );
}

echo "Store membership and live-pack policy checks passed.\n";
