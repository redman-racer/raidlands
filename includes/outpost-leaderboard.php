<?php

require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/podium.php';

const RAIDLANDS_OUTPOST_LEADERBOARD_SCHEMA_VERSION = 1;

function raidlands_outpost_leaderboard_row(array $row): array
{
    return [
        'rank' => max(1, (int) ($row['rank'] ?? 1)),
        'player_id' => max(0, (int) ($row['player_id'] ?? 0)),
        'steam_id64' => substr(preg_replace('/\D+/', '', (string) ($row['steam_id64'] ?? '')) ?? '', 0, 20),
        'display_name' => raidlands_stats_clean_text((string) ($row['display_name'] ?? 'Raidlands Player'), 64),
        'kills' => max(0, (int) ($row['kills'] ?? 0)),
        'deaths' => max(0, (int) ($row['deaths'] ?? 0)),
        'kdr' => round(max(0, (float) ($row['kdr'] ?? 0)), 3),
    ];
}

function raidlands_outpost_leaderboard_most_worn(int $player_id, int $wipe_id): ?array
{
    if ($player_id <= 0 || $wipe_id <= 0 || !raidlands_podium_is_ready()) {
        return null;
    }

    $row = raidlands_db_fetch_one(
        'SELECT items_json, sample_count, last_seen_at
         FROM player_outfit_observations
         WHERE player_id = :player_id AND wipe_id = :wipe_id
         ORDER BY sample_count DESC, last_seen_at DESC, id DESC
         LIMIT 1',
        ['player_id' => $player_id, 'wipe_id' => $wipe_id]
    );

    if ($row === null) {
        return null;
    }

    $items = raidlands_podium_normalize_wear(json_decode((string) ($row['items_json'] ?? '[]'), true));
    if ($items === []) {
        return null;
    }

    return [
        'source' => 'most_worn',
        'sample_count' => max(1, (int) ($row['sample_count'] ?? 1)),
        'last_seen_at' => raidlands_stats_timestamp($row['last_seen_at'] ?? null),
        'items' => $items,
    ];
}

function raidlands_outpost_leaderboard_build_payload(
    array $standings,
    ?array $wipe,
    ?callable $appearance_resolver = null,
    ?string $generated_at = null
): array {
    $normalized = [];
    foreach (array_slice($standings, 0, 25) as $index => $row) {
        if (!is_array($row)) continue;
        $normalized_row = raidlands_outpost_leaderboard_row($row);
        $normalized_row['rank'] = $index + 1;
        $normalized[] = $normalized_row;
    }

    $wipe_id = max(0, (int) ($wipe['id'] ?? 0));
    $podium = [];
    foreach (array_slice($normalized, 0, 3) as $row) {
        $entry = $row;
        $appearance = $appearance_resolver !== null
            ? $appearance_resolver((int) $row['player_id'], $wipe_id, $row)
            : raidlands_outpost_leaderboard_most_worn((int) $row['player_id'], $wipe_id);
        $entry['appearance'] = is_array($appearance) ? $appearance : null;
        $podium[] = $entry;
    }

    $wipe_payload = $wipe === null ? null : [
        'id' => $wipe_id,
        'server_id' => raidlands_stats_clean_text((string) ($wipe['server_id'] ?? ''), 80),
        'wipe_key' => raidlands_stats_wipe_key((string) ($wipe['wipe_key'] ?? 'current')),
        'started_at' => raidlands_stats_timestamp($wipe['started_at'] ?? null),
    ];

    $revision_payload = [
        'schema_version' => RAIDLANDS_OUTPOST_LEADERBOARD_SCHEMA_VERSION,
        'wipe' => $wipe_payload,
        'standings' => $normalized,
        'podium' => $podium,
    ];
    $revision = hash('sha256', (string) json_encode($revision_payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $image_base = '/api/outpost-leaderboard.php?revision=' . rawurlencode($revision) . '&image=';

    return [
        'ok' => true,
        'ready' => $wipe_payload !== null,
        'schema_version' => RAIDLANDS_OUTPOST_LEADERBOARD_SCHEMA_VERSION,
        'revision' => $revision,
        'generated_at' => $generated_at ?? gmdate('c'),
        'board' => 'players',
        'scope' => 'current',
        'metric' => 'kills',
        'wipe' => $wipe_payload,
        'standings' => $normalized,
        'podium' => $podium,
        'images' => [
            'top25' => $image_base . 'top25',
            'plaques' => [
                $image_base . 'plaque-1',
                $image_base . 'plaque-2',
                $image_base . 'plaque-3',
            ],
        ],
    ];
}

function raidlands_outpost_leaderboard_payload(): array
{
    if (!raidlands_stats_is_ready()) {
        return raidlands_outpost_leaderboard_build_payload([], null);
    }

    $wipe = raidlands_stats_active_wipe();
    if ($wipe === null) {
        return raidlands_outpost_leaderboard_build_payload([], null);
    }

    $result = raidlands_stats_leaderboard_result('kills', 'current', 1, 25, '', 0, '', false);
    return raidlands_outpost_leaderboard_build_payload((array) ($result['rows'] ?? []), $wipe);
}

function raidlands_outpost_leaderboard_image_size(string $image): array
{
    return $image === 'top25' ? [1024, 512] : [256, 128];
}

function raidlands_outpost_leaderboard_font(): string
{
    $bundledSource = dirname(__DIR__) . '/assets/fonts/kenpixel.ttf.base64';
    $bundledFont = dirname(__DIR__) . '/data/cache/outpost-leaderboard/kenpixel.ttf';
    if (!is_file($bundledFont) && is_file($bundledSource)) {
        $encoded = file_get_contents($bundledSource);
        $decoded = is_string($encoded) ? base64_decode(trim($encoded), true) : false;
        if (is_string($decoded) && strlen($decoded) > 1024) {
            $directory = dirname($bundledFont);
            if ((is_dir($directory) || @mkdir($directory, 0775, true)) && @file_put_contents($bundledFont . '.tmp', $decoded, LOCK_EX) !== false) {
                @rename($bundledFont . '.tmp', $bundledFont);
            }
        }
    }

    $candidates = [
        $bundledFont,
        'C:/Windows/Fonts/bahnschrift.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) return $candidate;
    }
    return '';
}

function raidlands_outpost_leaderboard_draw_text($canvas, string $text, int $size, int $x, int $y, int $color): void
{
    $text = raidlands_outpost_leaderboard_image_text($text);
    $font = raidlands_outpost_leaderboard_font();
    if ($font !== '' && function_exists('imagettftext')) {
        imagettftext($canvas, $size, 0, $x, $y, $color, $font, $text);
        return;
    }
    imagestring($canvas, 5, $x, max(0, $y - 14), $text, $color);
}

function raidlands_outpost_leaderboard_image_text(string $text): string
{
    if (function_exists('iconv')) {
        $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if (is_string($transliterated) && $transliterated !== '') $text = $transliterated;
    }
    return preg_replace('/[^\x20-\x7e]/', '?', $text) ?? '';
}

function raidlands_outpost_leaderboard_fit_name(string $name, int $limit): string
{
    $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
    if ($name === '') return 'Raidlands Player';
    return mb_strlen($name) > $limit ? mb_substr($name, 0, max(1, $limit - 3)) . '...' : $name;
}

function raidlands_outpost_leaderboard_render_png(array $payload, string $image): string
{
    if (!function_exists('imagecreatetruecolor')) {
        throw new RuntimeException('The GD extension is required to render the Outpost leaderboard.');
    }

    if (!in_array($image, ['top25', 'plaque-1', 'plaque-2', 'plaque-3'], true)) {
        $image = 'top25';
    }

    [$width, $height] = raidlands_outpost_leaderboard_image_size($image);
    $canvas = imagecreatetruecolor($width, $height);
    imagealphablending($canvas, true);
    imagesavealpha($canvas, true);
    $background = imagecolorallocate($canvas, 13, 17, 20);
    $panel = imagecolorallocate($canvas, 24, 31, 36);
    $gold = imagecolorallocate($canvas, 240, 178, 58);
    $silver = imagecolorallocate($canvas, 184, 198, 207);
    $bronze = imagecolorallocate($canvas, 188, 113, 61);
    $white = imagecolorallocate($canvas, 241, 245, 247);
    $muted = imagecolorallocate($canvas, 151, 164, 172);
    $line = imagecolorallocate($canvas, 58, 70, 77);
    imagefilledrectangle($canvas, 0, 0, $width, $height, $background);
    imagefilledrectangle($canvas, 8, 8, $width - 9, $height - 9, $panel);
    imagerectangle($canvas, 8, 8, $width - 9, $height - 9, $gold);

    if ($image === 'top25') {
        raidlands_outpost_leaderboard_draw_text($canvas, 'RAIDLANDS', 24, 28, 39, $gold);
        raidlands_outpost_leaderboard_draw_text($canvas, 'CURRENT WIPE  -  TOP 25 KILLS', 19, 28, 70, $white);
        $wipe_key = (string) ($payload['wipe']['wipe_key'] ?? 'Standings unavailable');
        raidlands_outpost_leaderboard_draw_text($canvas, raidlands_outpost_leaderboard_fit_name($wipe_key, 64), 11, 700, 42, $muted);
        imageline($canvas, 28, 84, 996, 84, $line);
        imageline($canvas, 512, 96, 512, 488, $line);

        $standings = (array) ($payload['standings'] ?? []);
        if ($standings === []) {
            raidlands_outpost_leaderboard_draw_text($canvas, 'STANDINGS UNAVAILABLE', 28, 315, 260, $muted);
        } else {
            foreach ($standings as $index => $row) {
                $column = $index < 13 ? 0 : 1;
                $row_index = $column === 0 ? $index : $index - 13;
                $x = $column === 0 ? 28 : 532;
                $y = 116 + ($row_index * 29);
                $rank = $index + 1;
                $rank_color = $rank === 1 ? $gold : ($rank === 2 ? $silver : ($rank === 3 ? $bronze : $muted));
                raidlands_outpost_leaderboard_draw_text($canvas, '#' . $rank, 14, $x, $y, $rank_color);
                raidlands_outpost_leaderboard_draw_text($canvas, raidlands_outpost_leaderboard_fit_name((string) ($row['display_name'] ?? ''), 25), 14, $x + 58, $y, $white);
                raidlands_outpost_leaderboard_draw_text($canvas, number_format((int) ($row['kills'] ?? 0)), 14, $x + 410, $y, $gold);
            }
        }
    } else {
        $rank = max(1, min(3, (int) substr($image, -1)));
        $entry = (array) (($payload['podium'][$rank - 1] ?? []));
        $rank_color = $rank === 1 ? $gold : ($rank === 2 ? $silver : $bronze);
        raidlands_outpost_leaderboard_draw_text($canvas, '#' . $rank, 32, 16, 52, $rank_color);
        if ($entry === []) {
            raidlands_outpost_leaderboard_draw_text($canvas, 'OPEN', 20, 82, 52, $muted);
            raidlands_outpost_leaderboard_draw_text($canvas, 'Waiting for a contender', 11, 18, 98, $muted);
        } else {
            raidlands_outpost_leaderboard_draw_text($canvas, raidlands_outpost_leaderboard_fit_name((string) ($entry['display_name'] ?? ''), 16), 16, 82, 48, $white);
            raidlands_outpost_leaderboard_draw_text($canvas, number_format((int) ($entry['kills'] ?? 0)) . ' KILLS', 14, 82, 84, $gold);
        }
    }

    ob_start();
    imagepng($canvas, null, 7);
    $png = (string) ob_get_clean();
    imagedestroy($canvas);
    return $png;
}
