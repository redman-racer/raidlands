<?php

require_once dirname(__DIR__) . '/includes/stats.php';

function stats_rp_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

stats_rp_assert(
    raidlands_stats_reward_points_baseline(1200, 1200) === 1200,
    'The first post-wipe balance must remain the opening baseline.'
);
stats_rp_assert(
    raidlands_stats_reward_points_baseline(0, 1200) === 0,
    'A delayed ServerRewards wipe reset must lower the opening baseline.'
);
stats_rp_assert(
    raidlands_stats_reward_points_baseline(250, 0) === 0,
    'RP earned after the reset must not raise the wipe baseline.'
);
stats_rp_assert(
    raidlands_stats_reward_points_baseline(900, 1200) === 900,
    'The wipe baseline must follow the lowest observed balance.'
);

echo "Stats RP wipe baseline tests passed.\n";
