<?php

require_once dirname(__DIR__) . '/includes/stats.php';

function stats_raid_policy_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

stats_raid_policy_assert(raidlands_stats_bigint(-1) === 0, 'Raid counters must not accept negative values.');
stats_raid_policy_assert(raidlands_stats_bigint('125000') === 125000, 'Raid damage must accept large numeric strings.');
stats_raid_policy_assert(raidlands_stats_bigint('invalid') === 0, 'Invalid raid counters must normalize to zero.');
stats_raid_policy_assert(raidlands_stats_raid_metric('tcs_destroyed') === 'tcs_destroyed', 'TC final blows must be a supported raid metric.');
stats_raid_policy_assert(raidlands_stats_raid_metric('kills') === 'raid_damage', 'Unknown raid metrics must fall back to raid damage.');
stats_raid_policy_assert(
    str_starts_with(raidlands_stats_raid_leaderboard_order('rockets_used'), 'rockets_used DESC'),
    'Raid metric ordering must put the selected counter first.'
);

echo "Stats raid policy tests passed.\n";
