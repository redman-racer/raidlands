<?php

require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/podium.php';

const RAIDLANDS_OUTPOST_LEADERBOARD_SCHEMA_VERSION = 1;
const RAIDLANDS_OUTPOST_LEADERBOARD_RENDER_VERSION = 5;

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

function raidlands_outpost_leaderboard_wipe_number(array $wipe): int
{
    $provided = max(0, (int) ($wipe['wipe_number'] ?? 0));
    if ($provided > 0) return $provided;

    $server_id = raidlands_stats_clean_text((string) ($wipe['server_id'] ?? ''), 80);
    if ($server_id === '' || !raidlands_stats_is_ready()) return 1;

    $row = raidlands_db_fetch_one(
        'SELECT COUNT(*) AS wipe_number FROM wipe_seasons WHERE server_id = :server_id',
        ['server_id' => $server_id]
    );

    return max(1, (int) ($row['wipe_number'] ?? 1));
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
        'number' => max(1, (int) ($wipe['wipe_number'] ?? 1)),
        'started_at' => raidlands_stats_timestamp($wipe['started_at'] ?? null),
    ];

    $revision_payload = [
        'schema_version' => RAIDLANDS_OUTPOST_LEADERBOARD_SCHEMA_VERSION,
        'render_version' => RAIDLANDS_OUTPOST_LEADERBOARD_RENDER_VERSION,
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
        'render_version' => RAIDLANDS_OUTPOST_LEADERBOARD_RENDER_VERSION,
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
    $wipe['wipe_number'] = raidlands_outpost_leaderboard_wipe_number($wipe);

    $result = raidlands_stats_leaderboard_result('kills', 'current', 1, 25, '', 0, '', false);
    return raidlands_outpost_leaderboard_build_payload((array) ($result['rows'] ?? []), $wipe);
}

function raidlands_outpost_leaderboard_image_size(string $image): array
{
    return $image === 'top25' ? [1024, 512] : [256, 128];
}

function raidlands_outpost_leaderboard_font(string $role = 'body'): string
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
        'C:/Windows/Fonts/bahnschrift.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        $bundledFont,
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) return $candidate;
    }
    return '';
}

function raidlands_outpost_leaderboard_text_width(string $text, int $size, string $role = 'body'): int
{
    $text = raidlands_outpost_leaderboard_image_text($text);
    $font = raidlands_outpost_leaderboard_font($role);
    if ($font !== '' && function_exists('imagettfbbox')) {
        $box = imagettfbbox($size, 0, $font, $text);
        if (is_array($box)) {
            return (int) abs($box[2] - $box[0]);
        }
    }
    return strlen($text) * imagefontwidth(5);
}

function raidlands_outpost_leaderboard_fit_text(string $text, int $size, int $max_width, string $role = 'body'): string
{
    $text = raidlands_outpost_leaderboard_image_text(trim(preg_replace('/\s+/', ' ', $text) ?? ''));
    if ($text === '') return 'Raidlands Player';
    if (raidlands_outpost_leaderboard_text_width($text, $size, $role) <= $max_width) return $text;

    $suffix = '...';
    while (strlen($text) > 1) {
        $text = rtrim(substr($text, 0, -1));
        if (raidlands_outpost_leaderboard_text_width($text . $suffix, $size, $role) <= $max_width) {
            return $text . $suffix;
        }
    }
    return $suffix;
}

function raidlands_outpost_leaderboard_draw_text(
    $canvas,
    string $text,
    int $size,
    int $x,
    int $y,
    int $color,
    string $align = 'left',
    string $role = 'body',
    ?int $shadow_color = null
): void {
    $text = raidlands_outpost_leaderboard_image_text($text);
    $font = raidlands_outpost_leaderboard_font($role);
    $width = raidlands_outpost_leaderboard_text_width($text, $size, $role);
    if ($align === 'right') $x -= $width;
    if ($align === 'center') $x -= (int) round($width / 2);

    if ($font !== '' && function_exists('imagettftext')) {
        if ($shadow_color !== null) imagettftext($canvas, $size, 0, $x + 2, $y + 2, $shadow_color, $font, $text);
        imagettftext($canvas, $size, 0, $x, $y, $color, $font, $text);
        return;
    }
    if ($shadow_color !== null) imagestring($canvas, 5, $x + 2, max(0, $y - 12), $text, $shadow_color);
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

function raidlands_outpost_leaderboard_image_resource(string $path)
{
    if (!is_file($path)) return null;
    $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
    if ($extension === 'png' && function_exists('imagecreatefrompng')) return @imagecreatefrompng($path) ?: null;
    if (($extension === 'jpg' || $extension === 'jpeg') && function_exists('imagecreatefromjpeg')) return @imagecreatefromjpeg($path) ?: null;
    if ($extension === 'webp' && function_exists('imagecreatefromwebp')) return @imagecreatefromwebp($path) ?: null;
    return null;
}

function raidlands_outpost_leaderboard_draw_cover($canvas, string $path, int $width, int $height): bool
{
    $source = raidlands_outpost_leaderboard_image_resource($path);
    if ($source === null) return false;

    $source_width = imagesx($source);
    $source_height = imagesy($source);
    $source_ratio = $source_width / max(1, $source_height);
    $target_ratio = $width / max(1, $height);
    if ($source_ratio > $target_ratio) {
        $crop_height = $source_height;
        $crop_width = (int) round($crop_height * $target_ratio);
        $source_x = (int) round(($source_width - $crop_width) / 2);
        $source_y = 0;
    } else {
        $crop_width = $source_width;
        $crop_height = (int) round($crop_width / $target_ratio);
        $source_x = 0;
        $source_y = (int) round(($source_height - $crop_height) / 2);
    }

    imagecopyresampled($canvas, $source, 0, 0, $source_x, $source_y, $width, $height, $crop_width, $crop_height);
    imagedestroy($source);
    return true;
}

function raidlands_outpost_leaderboard_draw_logo($canvas, int $x, int $y, int $max_width, int $max_height): bool
{
    $path = dirname(__DIR__) . '/assets/media/horizontal-logo-lrg.webp';
    $source = raidlands_outpost_leaderboard_image_resource($path);
    if ($source === null) return false;

    if (function_exists('imagecropauto')) {
        $cropped = @imagecropauto($source, IMG_CROP_TRANSPARENT);
        if ($cropped !== false) {
            imagedestroy($source);
            $source = $cropped;
        }
    }

    $source_width = imagesx($source);
    $source_height = imagesy($source);
    $scale = min($max_width / max(1, $source_width), $max_height / max(1, $source_height));
    $width = max(1, (int) round($source_width * $scale));
    $height = max(1, (int) round($source_height * $scale));
    $draw_x = $x + (int) round(($max_width - $width) / 2);
    $draw_y = $y + (int) round(($max_height - $height) / 2);
    imagecopyresampled($canvas, $source, $draw_x, $draw_y, 0, 0, $width, $height, $source_width, $source_height);
    imagedestroy($source);
    return true;
}

function raidlands_outpost_leaderboard_draw_cut_panel(
    $canvas,
    int $x1,
    int $y1,
    int $x2,
    int $y2,
    int $fill,
    int $border,
    int $cut = 10
): void {
    $points = [
        $x1 + $cut, $y1,
        $x2 - $cut, $y1,
        $x2, $y1 + $cut,
        $x2, $y2 - $cut,
        $x2 - $cut, $y2,
        $x1 + $cut, $y2,
        $x1, $y2 - $cut,
        $x1, $y1 + $cut,
    ];
    imagefilledpolygon($canvas, $points, $fill);
    imagepolygon($canvas, $points, $border);
}

function raidlands_outpost_leaderboard_rank_color(int $rank, int $gold, int $silver, int $bronze, int $default): int
{
    if ($rank === 1) return $gold;
    if ($rank === 2) return $silver;
    if ($rank === 3) return $bronze;
    return $default;
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
    $background = imagecolorallocate($canvas, 5, 6, 7);
    $panel = imagecolorallocatealpha($canvas, 16, 18, 20, 48);
    $panel_strong = imagecolorallocatealpha($canvas, 10, 12, 14, 8);
    $panel_soft = imagecolorallocatealpha($canvas, 23, 27, 30, 46);
    $row_even = imagecolorallocatealpha($canvas, 42, 50, 56, 76);
    $row_odd = imagecolorallocatealpha($canvas, 10, 12, 14, 82);
    $orange = imagecolorallocate($canvas, 255, 138, 40);
    $orange_dark = imagecolorallocate($canvas, 201, 87, 34);
    $gold = imagecolorallocate($canvas, 255, 209, 102);
    $silver = imagecolorallocate($canvas, 191, 201, 207);
    $bronze = imagecolorallocate($canvas, 205, 123, 72);
    $white = imagecolorallocate($canvas, 243, 238, 227);
    $muted = imagecolorallocate($canvas, 181, 170, 160);
    $dim = imagecolorallocate($canvas, 128, 118, 109);
    $steel = imagecolorallocate($canvas, 86, 97, 106);
    $steel_dim = imagecolorallocate($canvas, 42, 50, 56);
    $shadow = imagecolorallocatealpha($canvas, 0, 0, 0, 35);
    $dark_overlay = imagecolorallocatealpha($canvas, 5, 6, 7, 50);
    imagefilledrectangle($canvas, 0, 0, $width, $height, $background);
    raidlands_outpost_leaderboard_draw_cover(
        $canvas,
        dirname(__DIR__) . '/assets/media/header-bg-rust-v2.png',
        $width,
        $height
    );
    imagefilledrectangle($canvas, 0, 0, $width - 1, $height - 1, $dark_overlay);

    if ($image === 'top25') {
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 8, 8, 1015, 503, $panel, $steel, 13);
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 18, 16, 1005, 84, $panel_strong, $steel_dim, 10);
        imagefilledrectangle($canvas, 18, 80, 1005, 83, $orange_dark);
        imagefilledrectangle($canvas, 18, 80, 292, 83, $orange);
        raidlands_outpost_leaderboard_draw_logo($canvas, 24, 19, 292, 59);
        imageline($canvas, 324, 27, 324, 70, $steel_dim);
        raidlands_outpost_leaderboard_draw_text($canvas, 'OUTPOST LEADERBOARD', 23, 345, 47, $white, 'left', 'display', $shadow);
        raidlands_outpost_leaderboard_draw_text($canvas, 'TOP 25  /  PLAYER KILLS', 11, 347, 67, $orange, 'left', 'body');

        $wipe_number = max(1, (int) ($payload['wipe']['number'] ?? 1));
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 852, 25, 990, 72, $panel_soft, $steel_dim, 7);
        raidlands_outpost_leaderboard_draw_text($canvas, 'CURRENT WIPE', 9, 866, 43, $orange, 'left', 'body');
        raidlands_outpost_leaderboard_draw_text(
            $canvas,
            '#' . str_pad((string) $wipe_number, 2, '0', STR_PAD_LEFT),
            17,
            976,
            66,
            $white,
            'right',
            'display',
            $shadow
        );

        $standings = (array) ($payload['standings'] ?? []);
        foreach ([18, 519] as $table_x) {
            raidlands_outpost_leaderboard_draw_cut_panel($canvas, $table_x, 96, $table_x + 487, 494, $panel, $steel_dim, 8);
            imagefilledrectangle($canvas, $table_x + 1, 97, $table_x + 486, 129, $panel_strong);
            imagefilledrectangle($canvas, $table_x + 1, 128, $table_x + 486, 130, $orange_dark);
            raidlands_outpost_leaderboard_draw_text($canvas, 'RANK', 10, $table_x + 16, 119, $dim);
            raidlands_outpost_leaderboard_draw_text($canvas, 'PLAYER', 10, $table_x + 70, 119, $dim);
            raidlands_outpost_leaderboard_draw_text($canvas, 'KILLS', 10, $table_x + 463, 119, $dim, 'right');
        }

        if ($standings === []) {
            raidlands_outpost_leaderboard_draw_cut_panel($canvas, 250, 220, 774, 321, $panel_strong, $orange_dark, 12);
            raidlands_outpost_leaderboard_draw_text($canvas, 'STANDINGS OFFLINE', 28, 512, 265, $white, 'center', 'display', $shadow);
            raidlands_outpost_leaderboard_draw_text($canvas, 'WAITING FOR THE NEXT WIPE UPDATE', 11, 512, 292, $muted, 'center');
        } else {
            foreach ($standings as $index => $row) {
                $column = $index < 13 ? 0 : 1;
                $row_index = $column === 0 ? $index : $index - 13;
                $x = $column === 0 ? 18 : 519;
                $row_top = 131 + ($row_index * 28);
                $baseline = $row_top + 20;
                $rank = $index + 1;
                $rank_color = raidlands_outpost_leaderboard_rank_color($rank, $gold, $silver, $bronze, $dim);
                imagefilledrectangle($canvas, $x + 1, $row_top, $x + 486, $row_top + 27, $row_index % 2 === 0 ? $row_even : $row_odd);
                if ($rank <= 3) imagefilledrectangle($canvas, $x + 1, $row_top, $x + 5, $row_top + 27, $rank_color);
                raidlands_outpost_leaderboard_draw_text($canvas, str_pad((string) $rank, 2, '0', STR_PAD_LEFT), 13, $x + 16, $baseline, $rank_color, 'left', 'body', $shadow);
                $name = raidlands_outpost_leaderboard_fit_text((string) ($row['display_name'] ?? ''), 14, 310, 'body');
                raidlands_outpost_leaderboard_draw_text($canvas, $name, 14, $x + 70, $baseline, $white, 'left', 'body', $shadow);
                raidlands_outpost_leaderboard_draw_text($canvas, number_format((int) ($row['kills'] ?? 0)), 14, $x + 463, $baseline, $orange, 'right', 'body', $shadow);
                imageline($canvas, $x + 11, $row_top + 27, $x + 476, $row_top + 27, $steel_dim);
            }
        }
    } else {
        $rank = max(1, min(3, (int) substr($image, -1)));
        $entry = (array) (($payload['podium'][$rank - 1] ?? []));
        $rank_color = raidlands_outpost_leaderboard_rank_color($rank, $gold, $silver, $bronze, $muted);
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 5, 5, 250, 122, $panel, $rank_color, 9);
        imagefilledrectangle($canvas, 13, 35, 243, 37, $orange_dark);
        raidlands_outpost_leaderboard_draw_logo($canvas, 13, 8, 132, 25);
        raidlands_outpost_leaderboard_draw_text($canvas, 'TOP KILLS', 8, 240, 25, $dim, 'right');
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 13, 43, 68, 112, $panel_strong, $rank_color, 7);
        raidlands_outpost_leaderboard_draw_text($canvas, str_pad((string) $rank, 2, '0', STR_PAD_LEFT), 28, 40, 86, $rank_color, 'center', 'display', $shadow);
        raidlands_outpost_leaderboard_draw_cut_panel($canvas, 75, 43, 242, 112, $panel_strong, $steel_dim, 7);
        if ($entry === []) {
            raidlands_outpost_leaderboard_draw_text($canvas, 'OPEN', 18, 88, 71, $muted, 'left', 'display', $shadow);
            raidlands_outpost_leaderboard_draw_text($canvas, 'WAITING FOR A CONTENDER', 8, 88, 97, $dim);
        } else {
            $name = raidlands_outpost_leaderboard_fit_text((string) ($entry['display_name'] ?? ''), 15, 140, 'body');
            raidlands_outpost_leaderboard_draw_text($canvas, $name, 15, 88, 70, $white, 'left', 'body', $shadow);
            raidlands_outpost_leaderboard_draw_text($canvas, number_format((int) ($entry['kills'] ?? 0)) . '  KILLS', 12, 88, 98, $orange, 'left', 'body', $shadow);
        }
    }

    ob_start();
    imagepng($canvas, null, 8);
    $png = (string) ob_get_clean();
    imagedestroy($canvas);
    return $png;
}
