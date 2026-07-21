<?php

require_once dirname(__DIR__) . '/includes/outpost-leaderboard.php';

function outpost_leaderboard_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$rows = [];
for ($index = 0; $index < 27; $index++) {
    $rows[] = [
        'rank' => $index + 1,
        'player_id' => 100 + $index,
        'steam_id64' => '7656119800000' . str_pad((string) $index, 4, '0', STR_PAD_LEFT),
        'display_name' => $index === 0 ? "Winner <script> Ω" : 'Contender ' . ($index + 1),
        'kills' => 100 - $index,
        'deaths' => $index,
        'kdr' => 3.14159,
    ];
}

$resolver = static function (int $player_id): ?array {
    if ($player_id !== 100) return null;
    return [
        'source' => 'most_worn',
        'sample_count' => 1,
        'last_seen_at' => '2026-07-18T12:00:00Z',
        'items' => [
            ['slot' => 'wear-0', 'shortname' => 'metal.facemask', 'skin_id' => '123456789'],
        ],
    ];
};

$wipe = ['id' => 9, 'server_id' => 'raidlands-main', 'wipe_key' => 'raidlands-main-test', 'started_at' => '2026-07-18T00:00:00Z'];
$payload = raidlands_outpost_leaderboard_build_payload($rows, $wipe, $resolver, '2026-07-18T13:00:00Z');

outpost_leaderboard_assert(count($payload['standings']) === 25, 'The game endpoint must cap standings at 25 rows.');
outpost_leaderboard_assert(count($payload['podium']) === 3, 'The podium must contain at most three leaders.');
outpost_leaderboard_assert($payload['render_version'] === 4, 'The payload must identify the current branded image renderer.');
outpost_leaderboard_assert(!str_contains($payload['standings'][0]['display_name'], '<'), 'Player names must be stripped of markup.');
outpost_leaderboard_assert(mb_strlen($payload['standings'][0]['display_name']) <= 64, 'Player names must be capped at 64 characters.');
$unicode_row = raidlands_outpost_leaderboard_row(['display_name' => 'Игрок Ω']);
outpost_leaderboard_assert(str_contains($unicode_row['display_name'], 'Ω'), 'Unicode names must be preserved in the JSON contract.');
outpost_leaderboard_assert(
    preg_match('/^[\x20-\x7e]*$/', raidlands_outpost_leaderboard_image_text($unicode_row['display_name'])) === 1,
    'Unicode names must have a safe readable sign-image fallback.'
);
outpost_leaderboard_assert($payload['podium'][0]['appearance']['source'] === 'most_worn', 'The endpoint must preserve the extensible appearance source.');
outpost_leaderboard_assert($payload['podium'][0]['appearance']['items'][0]['skin_id'] === '123456789', 'Workshop skin IDs must be preserved exactly.');
outpost_leaderboard_assert($payload['podium'][1]['appearance'] === null, 'Missing appearance history must remain null for the plugin fallback.');
outpost_leaderboard_assert(strlen($payload['revision']) === 64, 'The response revision must be a stable SHA-256 value.');

$same = raidlands_outpost_leaderboard_build_payload($rows, $wipe, $resolver, '2026-07-18T14:00:00Z');
outpost_leaderboard_assert($same['revision'] === $payload['revision'], 'Generated time must not churn an unchanged data revision.');
$rows[0]['kills']++;
$changed = raidlands_outpost_leaderboard_build_payload($rows, $wipe, $resolver, '2026-07-18T14:00:00Z');
outpost_leaderboard_assert($changed['revision'] !== $payload['revision'], 'A standings change must create a new revision.');

$empty = raidlands_outpost_leaderboard_build_payload([], null, null, '2026-07-18T14:00:00Z');
outpost_leaderboard_assert($empty['ready'] === false && $empty['standings'] === [], 'A cold endpoint must return an explicit empty state.');
$two_players = raidlands_outpost_leaderboard_build_payload(array_slice($rows, 0, 2), $wipe, $resolver, '2026-07-18T14:00:00Z');
outpost_leaderboard_assert(count($two_players['podium']) === 2, 'Fewer than three standings must not invent podium winners.');

$invalid_wear = raidlands_podium_normalize_wear([
    ['slot' => 'wear-0', 'shortname' => '<invalid>', 'skin_id' => '55'],
]);
outpost_leaderboard_assert($invalid_wear === [], 'Syntactically invalid appearance items must be discarded.');
$implementation = (string) file_get_contents(dirname(__DIR__) . '/includes/outpost-leaderboard.php');
outpost_leaderboard_assert(
    str_contains($implementation, 'ORDER BY sample_count DESC, last_seen_at DESC, id DESC'),
    'Most-worn selection must break sample-count ties by recency.'
);

$top25 = raidlands_outpost_leaderboard_render_png($payload, 'top25');
$plaque = raidlands_outpost_leaderboard_render_png($payload, 'plaque-1');
$top25_info = getimagesizefromstring($top25);
$plaque_info = getimagesizefromstring($plaque);
outpost_leaderboard_assert($top25_info !== false && $top25_info[0] === 1024 && $top25_info[1] === 512, 'The physical leaderboard image must be 1024x512.');
outpost_leaderboard_assert($plaque_info !== false && $plaque_info[0] === 256 && $plaque_info[1] === 128, 'Podium plaques must be 256x128.');
outpost_leaderboard_assert(strlen($top25) < 2097152 && strlen($plaque) < 2097152, 'Branded sign images must remain under the plugin image-size ceiling.');
$fitted_name = raidlands_outpost_leaderboard_fit_text('A player name that is far too long for the sign', 14, 120);
outpost_leaderboard_assert(raidlands_outpost_leaderboard_text_width($fitted_name, 14) <= 120, 'Player names must be measured into their visual slot.');
$empty_top25_info = getimagesizefromstring(raidlands_outpost_leaderboard_render_png($empty, 'top25'));
outpost_leaderboard_assert($empty_top25_info !== false && $empty_top25_info[0] === 1024 && $empty_top25_info[1] === 512, 'The empty-state board must remain a valid 1024x512 PNG.');
outpost_leaderboard_assert(is_file(raidlands_outpost_leaderboard_font()), 'The bundled leaderboard font must materialize successfully.');
outpost_leaderboard_assert(
    str_contains($implementation, '/assets/media/horizontal-logo-lrg.webp')
        && str_contains($implementation, '/assets/media/header-bg-rust-v2.png'),
    'The physical leaderboard renderer must use the in-game logo and the shared industrial brand art.'
);

echo "Outpost leaderboard policy tests passed.\n";
