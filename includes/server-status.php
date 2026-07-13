<?php

require_once __DIR__ . '/database.php';

function raidlands_server_status_server_id(): string
{
    global $vip_bridge_config;

    $server_id = trim((string) ($vip_bridge_config['serverId'] ?? 'raidlands-main'));

    return $server_id !== '' ? $server_id : 'raidlands-main';
}

function raidlands_server_status_stale_seconds(): int
{
    global $site_config;

    return max(30, (int) ($site_config['serverStats']['staleSeconds'] ?? 90));
}

function raidlands_server_status_sample_retention_days(): int
{
    global $site_config;

    return max(7, min(30, (int) ($site_config['serverStats']['sampleRetentionDays'] ?? 30)));
}

function raidlands_server_status_hourly_retention_months(): int
{
    global $site_config;

    return max(6, min(24, (int) ($site_config['serverStats']['hourlyRetentionMonths'] ?? 24)));
}

function raidlands_server_status_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT server_id FROM server_status LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_history_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_status_samples LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_rollups_are_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT server_id FROM server_status_hourly_rollups LIMIT 1');
        raidlands_db_fetch_one('SELECT server_id FROM server_status_daily_rollups LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_map_images_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT server_id FROM server_map_images LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_map_terrain_columns_are_ready(): bool
{
    if (!raidlands_server_map_images_is_ready()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT terrain_public_url, terrain_resolution FROM server_map_images LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_map_skybox_columns_are_ready(): bool
{
    if (!raidlands_server_map_images_is_ready()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT skybox_public_url, skybox_hash FROM server_map_images LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_heatmap_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_heatmap_buckets LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_player_locations_are_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT steam_id64 FROM server_player_locations LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_player_location_history_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_player_location_history LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_map_replay_events_are_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_map_replay_events LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_environment_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT id FROM server_environment_snapshots LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_server_status_clean_text($value, int $max_length = 120): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    $text = preg_replace('/[ \t\r\n]+/', ' ', $text) ?? $text;
    $text = strip_tags($text);

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }

    return substr($text, 0, $max_length);
}

function raidlands_server_status_int($value, int $fallback = 0, int $max = 2147483647): int
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    return max(0, min($max, (int) round((float) $value)));
}

function raidlands_server_status_bool($value): ?bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value !== 0;
    }

    $normalized = strtolower(trim((string) $value));

    if (in_array($normalized, ['1', 'true', 'yes', 'online'], true)) {
        return true;
    }

    if (in_array($normalized, ['0', 'false', 'no', 'offline'], true)) {
        return false;
    }

    return null;
}

function raidlands_server_map_upload_root(): string
{
    return dirname(__DIR__) . '/assets/media/maps';
}

function raidlands_server_map_slug(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9_.-]+/', '-', $slug) ?? '';
    $slug = trim($slug, '.-_');

    return $slug !== '' ? $slug : 'server';
}

function raidlands_server_map_relative_path(string $server_id, string $extension): string
{
    return 'assets/media/maps/' . raidlands_server_map_slug($server_id) . '/current.' . $extension;
}

function raidlands_server_map_terrain_relative_path(string $server_id): string
{
    return 'assets/media/maps/' . raidlands_server_map_slug($server_id) . '/current-terrain.json';
}

function raidlands_server_map_texture_relative_path(string $server_id, string $extension): string
{
    return 'assets/media/maps/' . raidlands_server_map_slug($server_id) . '/current-texture.' . $extension;
}

function raidlands_server_map_skybox_relative_path(string $server_id, string $extension): string
{
    return 'assets/media/maps/' . raidlands_server_map_slug($server_id) . '/current-skybox.' . $extension;
}

function raidlands_server_map_public_url(string $relative_path): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost');
    $script_dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')));

    if ($script_dir === '.' || !str_starts_with($script_dir, '/')) {
        $script_dir = '';
    }

    $root = preg_replace('#/(admin|api(?:/.*)?|api-docs|bans|clans|discord|events|features|leaderboard|link|play|privacy|profile|rules|server|store|support|terms|vote)$#', '', rtrim($script_dir, '/')) ?? '';
    $root = $root === '/' ? '' : $root;

    return $scheme . '://' . $host . $root . '/' . ltrim($relative_path, '/');
}

function raidlands_server_map_texture_url(string $server_id): string
{
    if ($server_id === '') {
        return '';
    }

    foreach (['jpg', 'png'] as $extension) {
        $relative_path = raidlands_server_map_texture_relative_path($server_id, $extension);
        $path = dirname(__DIR__) . '/' . $relative_path;

        if (is_file($path)) {
            return raidlands_server_map_public_url($relative_path);
        }
    }

    return '';
}

function raidlands_server_map_validate_image(string $base64): array
{
    $image = base64_decode($base64, true);

    if ($image === false || $image === '') {
        throw new InvalidArgumentException('Map image must be valid base64.');
    }

    $max_bytes = 20 * 1024 * 1024;

    if (strlen($image) > $max_bytes) {
        throw new InvalidArgumentException('Map image is larger than the 20MB limit.');
    }

    $info = @getimagesizefromstring($image);

    if (!is_array($info)) {
        throw new InvalidArgumentException('Map image is not a readable image.');
    }

    $mime = (string) ($info['mime'] ?? '');
    $extension = match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        default => '',
    };

    if ($extension === '') {
        throw new InvalidArgumentException('Map image must be JPG or PNG.');
    }

    return [
        'bytes' => $image,
        'mime' => $mime,
        'extension' => $extension,
        'width' => (int) ($info[0] ?? 0),
        'height' => (int) ($info[1] ?? 0),
        'hash' => hash('sha256', $image),
        'size' => strlen($image),
    ];
}

function raidlands_server_map_validate_terrain($terrain): ?array
{
    if (!is_array($terrain)) {
        return null;
    }

    $resolution = raidlands_server_status_int($terrain['resolution'] ?? 0, 0, 257);
    $heights = $terrain['heights'] ?? [];

    if ($resolution < 2 || !is_array($heights)) {
        throw new InvalidArgumentException('Terrain export must include a resolution and height samples.');
    }

    $expected_count = $resolution * $resolution;

    if (count($heights) !== $expected_count) {
        throw new InvalidArgumentException('Terrain height sample count does not match the resolution.');
    }

    $normalized_heights = [];
    $min_height = null;
    $max_height = null;

    foreach ($heights as $height) {
        if (!is_numeric($height)) {
            throw new InvalidArgumentException('Terrain height samples must be numeric.');
        }

        $value = round((float) $height, 3);
        $normalized_heights[] = $value;
        $min_height = $min_height === null ? $value : min($min_height, $value);
        $max_height = $max_height === null ? $value : max($max_height, $value);
    }

    $colors = $terrain['colors'] ?? [];
    $normalized_colors = [];

    if (is_array($colors) && count($colors) === $expected_count) {
        foreach ($colors as $color) {
            $value = strtolower(trim((string) $color));
            $normalized_colors[] = preg_match('/^#[0-9a-f]{6}$/', $value) === 1 ? $value : '#5b6d49';
        }
    }

    $normalized_monuments = [];
    $world_size = raidlands_server_status_int($terrain['worldSize'] ?? $terrain['world_size'] ?? 0, 0);
    $world_half = max(100, $world_size) / 2;
    $monuments = is_array($terrain['monuments'] ?? null) ? $terrain['monuments'] : [];

    foreach (array_slice($monuments, 0, 96) as $monument) {
        if (!is_array($monument)) {
            continue;
        }

        $x = $monument['x'] ?? null;
        $y = $monument['y'] ?? null;
        $z = $monument['z'] ?? null;

        if (!is_numeric($x) || !is_numeric($y) || !is_numeric($z)) {
            continue;
        }

        $x = round((float) $x, 3);
        $y = round((float) $y, 3);
        $z = round((float) $z, 3);

        if (abs($x) > $world_half * 1.2 || abs($z) > $world_half * 1.2) {
            continue;
        }

        $normalized_monuments[] = [
            'name' => raidlands_server_status_clean_text($monument['name'] ?? 'Monument', 80),
            'prefab' => raidlands_server_status_clean_text($monument['prefab'] ?? '', 160),
            'kind' => raidlands_server_status_clean_text($monument['kind'] ?? $monument['name'] ?? 'monument', 80),
            'x' => $x,
            'y' => $y,
            'z' => $z,
            'radius' => max(18, min(280, round((float) ($monument['radius'] ?? 55), 3))),
            'rotationY' => round((float) ($monument['rotationY'] ?? $monument['rotation_y'] ?? 0), 3),
        ];
    }

    $payload = [
        'version' => 1,
        'serverId' => raidlands_server_status_clean_text($terrain['serverId'] ?? $terrain['server_id'] ?? '', 120),
        'wipeKey' => raidlands_server_status_clean_text($terrain['wipeKey'] ?? $terrain['wipe_key'] ?? '', 160),
        'mapName' => raidlands_server_status_clean_text($terrain['mapName'] ?? $terrain['map_name'] ?? '', 120),
        'resolution' => $resolution,
        'worldSize' => $world_size,
        'seed' => raidlands_server_status_int($terrain['seed'] ?? 0, 0),
        'waterLevel' => round((float) ($terrain['waterLevel'] ?? $terrain['water_level'] ?? 0), 3),
        'minHeight' => $min_height ?? 0,
        'maxHeight' => $max_height ?? 0,
        'generatedAt' => raidlands_server_status_iso($terrain['generatedAt'] ?? $terrain['generated_at'] ?? '') ?: gmdate('c'),
        'heights' => $normalized_heights,
    ];

    if ($normalized_colors !== []) {
        $payload['colors'] = $normalized_colors;
    }

    if ($normalized_monuments !== []) {
        $payload['monuments'] = $normalized_monuments;
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        throw new InvalidArgumentException('Terrain export could not be encoded.');
    }

    if (strlen($json) > 5 * 1024 * 1024) {
        throw new InvalidArgumentException('Terrain export is larger than the 5MB limit.');
    }

    return [
        'json' => $json,
        'payload' => $payload,
        'hash' => hash('sha256', $json),
        'size' => strlen($json),
        'resolution' => $resolution,
        'min_height' => (float) ($payload['minHeight'] ?? 0),
        'max_height' => (float) ($payload['maxHeight'] ?? 0),
        'water_level' => (float) ($payload['waterLevel'] ?? 0),
    ];
}

function raidlands_server_map_write_image(string $server_id, string $extension, string $image): array
{
    $root = raidlands_server_map_upload_root();
    $server_dir = $root . '/' . raidlands_server_map_slug($server_id);

    if (!is_dir($server_dir) && !mkdir($server_dir, 0775, true) && !is_dir($server_dir)) {
        throw new RuntimeException('Could not create map upload directory.');
    }

    $relative_path = raidlands_server_map_relative_path($server_id, $extension);
    $path = dirname(__DIR__) . '/' . $relative_path;
    $temp_path = $path . '.tmp';

    if (file_put_contents($temp_path, $image, LOCK_EX) === false) {
        throw new RuntimeException('Could not write map image.');
    }

    if (!rename($temp_path, $path)) {
        @unlink($temp_path);
        throw new RuntimeException('Could not publish map image.');
    }

    foreach (['jpg', 'png'] as $other_extension) {
        if ($other_extension === $extension) {
            continue;
        }

        $old_path = dirname(__DIR__) . '/' . raidlands_server_map_relative_path($server_id, $other_extension);

        if (is_file($old_path)) {
            @unlink($old_path);
        }
    }

    return [
        'path' => $path,
        'relative_path' => $relative_path,
        'public_url' => raidlands_server_map_public_url($relative_path),
    ];
}

function raidlands_server_map_write_texture(string $server_id, string $extension, string $image): array
{
    $root = raidlands_server_map_upload_root();
    $server_dir = $root . '/' . raidlands_server_map_slug($server_id);

    if (!is_dir($server_dir) && !mkdir($server_dir, 0775, true) && !is_dir($server_dir)) {
        throw new RuntimeException('Could not create map upload directory.');
    }

    $relative_path = raidlands_server_map_texture_relative_path($server_id, $extension);
    $path = dirname(__DIR__) . '/' . $relative_path;
    $temp_path = $path . '.tmp';

    if (file_put_contents($temp_path, $image, LOCK_EX) === false) {
        throw new RuntimeException('Could not write map texture image.');
    }

    if (!rename($temp_path, $path)) {
        @unlink($temp_path);
        throw new RuntimeException('Could not publish map texture image.');
    }

    foreach (['jpg', 'png'] as $other_extension) {
        if ($other_extension === $extension) {
            continue;
        }

        $old_path = dirname(__DIR__) . '/' . raidlands_server_map_texture_relative_path($server_id, $other_extension);

        if (is_file($old_path)) {
            @unlink($old_path);
        }
    }

    return [
        'path' => $path,
        'relative_path' => $relative_path,
        'public_url' => raidlands_server_map_public_url($relative_path),
    ];
}

function raidlands_server_map_write_skybox(string $server_id, string $extension, string $image): array
{
    $root = raidlands_server_map_upload_root();
    $server_dir = $root . '/' . raidlands_server_map_slug($server_id);

    if (!is_dir($server_dir) && !mkdir($server_dir, 0775, true) && !is_dir($server_dir)) {
        throw new RuntimeException('Could not create map upload directory.');
    }

    $relative_path = raidlands_server_map_skybox_relative_path($server_id, $extension);
    $path = dirname(__DIR__) . '/' . $relative_path;
    $temp_path = $path . '.tmp';

    if (file_put_contents($temp_path, $image, LOCK_EX) === false) {
        throw new RuntimeException('Could not write skybox image.');
    }

    if (!rename($temp_path, $path)) {
        @unlink($temp_path);
        throw new RuntimeException('Could not publish skybox image.');
    }

    foreach (['jpg', 'png'] as $other_extension) {
        if ($other_extension === $extension) {
            continue;
        }

        $old_path = dirname(__DIR__) . '/' . raidlands_server_map_skybox_relative_path($server_id, $other_extension);

        if (is_file($old_path)) {
            @unlink($old_path);
        }
    }

    return [
        'path' => $path,
        'relative_path' => $relative_path,
        'public_url' => raidlands_server_map_public_url($relative_path),
    ];
}

function raidlands_server_map_write_terrain(string $server_id, string $terrain_json): array
{
    $root = raidlands_server_map_upload_root();
    $server_dir = $root . '/' . raidlands_server_map_slug($server_id);

    if (!is_dir($server_dir) && !mkdir($server_dir, 0775, true) && !is_dir($server_dir)) {
        throw new RuntimeException('Could not create map upload directory.');
    }

    $relative_path = raidlands_server_map_terrain_relative_path($server_id);
    $path = dirname(__DIR__) . '/' . $relative_path;
    $temp_path = $path . '.tmp';

    if (file_put_contents($temp_path, $terrain_json, LOCK_EX) === false) {
        throw new RuntimeException('Could not write terrain export.');
    }

    if (!rename($temp_path, $path)) {
        @unlink($temp_path);
        throw new RuntimeException('Could not publish terrain export.');
    }

    return [
        'path' => $path,
        'relative_path' => $relative_path,
        'public_url' => raidlands_server_map_public_url($relative_path),
    ];
}

function raidlands_server_map_ingest_upload(array $payload, string $header_server_id): array
{
    if (!raidlands_server_map_images_is_ready()) {
        throw new RuntimeException('Server map image table is not installed. Run database/migrations/024_server_map_images.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $server_id = raidlands_server_status_clean_text($payload['server_id'] ?? $header_server_id, 120);

    if ($server_id === '') {
        throw new InvalidArgumentException('Map upload server_id is required.');
    }

    if ($header_server_id !== '' && !hash_equals($header_server_id, $server_id)) {
        throw new InvalidArgumentException('Map upload server_id does not match the authenticated server.');
    }

    $image_base64 = (string) ($payload['image_base64'] ?? $payload['image'] ?? '');
    $image = raidlands_server_map_validate_image($image_base64);
    $written = raidlands_server_map_write_image($server_id, (string) $image['extension'], (string) $image['bytes']);
    $texture_written = null;
    $texture_base64 = (string) ($payload['texture_image_base64'] ?? $payload['texture_image'] ?? '');

    if ($texture_base64 !== '') {
        $texture_image = raidlands_server_map_validate_image($texture_base64);
        $texture_written = raidlands_server_map_write_texture($server_id, (string) $texture_image['extension'], (string) $texture_image['bytes']);
    }

    $skybox = null;
    $skybox_written = null;
    $skybox_base64 = (string) ($payload['skybox_image_base64'] ?? $payload['skybox_image'] ?? '');

    if ($skybox_base64 !== '') {
        $skybox = raidlands_server_map_validate_image($skybox_base64);

        if ((int) $skybox['width'] < 512 || (int) $skybox['height'] < 256) {
            throw new InvalidArgumentException('Skybox image must be at least 512x256.');
        }

        $skybox_written = raidlands_server_map_write_skybox($server_id, (string) $skybox['extension'], (string) $skybox['bytes']);
    }

    $terrain = raidlands_server_map_validate_terrain($payload['terrain'] ?? null);
    $terrain_written = null;

    if ($terrain !== null) {
        $terrain_written = raidlands_server_map_write_terrain($server_id, (string) $terrain['json']);
    }

    $wipe_key = raidlands_server_status_clean_text($payload['wipe_key'] ?? '', 160);

    if ($wipe_key === '') {
        $wipe_key = $server_id . '-current';
    }

    $values = [
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'map_name' => raidlands_server_status_clean_text($payload['map_name'] ?? '', 120),
        'render_name' => raidlands_server_status_clean_text($payload['render_name'] ?? '', 120),
        'public_url' => (string) $written['public_url'],
        'relative_path' => (string) $written['relative_path'],
        'image_hash' => (string) $image['hash'],
        'image_mime' => (string) $image['mime'],
        'image_extension' => (string) $image['extension'],
        'image_bytes' => (int) $image['size'],
        'image_width' => (int) $image['width'],
        'image_height' => (int) $image['height'],
        'resolution' => raidlands_server_status_int($payload['resolution'] ?? 0, 0),
        'world_size' => raidlands_server_status_int($payload['world_size'] ?? 0, 0),
        'seed' => raidlands_server_status_int($payload['seed'] ?? 0, 0),
        'protocol_network' => raidlands_server_status_int($payload['protocol'] ?? $payload['protocol_network'] ?? 0, 0),
        'generated_at' => raidlands_server_status_timestamp($payload['generated_at'] ?? null),
    ];

    if ($terrain !== null && $terrain_written !== null) {
        $values = array_merge($values, [
            'terrain_public_url' => (string) $terrain_written['public_url'],
            'terrain_relative_path' => (string) $terrain_written['relative_path'],
            'terrain_hash' => (string) $terrain['hash'],
            'terrain_bytes' => (int) $terrain['size'],
            'terrain_resolution' => (int) $terrain['resolution'],
            'terrain_min_height' => (float) $terrain['min_height'],
            'terrain_max_height' => (float) $terrain['max_height'],
            'terrain_water_level' => (float) $terrain['water_level'],
        ]);
    }

    if (raidlands_server_map_terrain_columns_are_ready()) {
        raidlands_db_execute(
            'INSERT INTO server_map_images
                (server_id, wipe_key, map_name, render_name, public_url, relative_path, terrain_public_url, terrain_relative_path,
                 terrain_hash, terrain_bytes, terrain_resolution, terrain_min_height, terrain_max_height, terrain_water_level,
                 image_hash, image_mime, image_extension, image_bytes, image_width, image_height, resolution, world_size,
                 seed, protocol_network, generated_at, published_at)
             VALUES
                (:server_id, :wipe_key, :map_name, :render_name, :public_url, :relative_path, :terrain_public_url, :terrain_relative_path,
                 :terrain_hash, :terrain_bytes, :terrain_resolution, :terrain_min_height, :terrain_max_height, :terrain_water_level,
                 :image_hash, :image_mime, :image_extension, :image_bytes, :image_width, :image_height, :resolution, :world_size,
                 :seed, :protocol_network, :generated_at, NOW())
             ON DUPLICATE KEY UPDATE
                wipe_key = VALUES(wipe_key),
                map_name = VALUES(map_name),
                render_name = VALUES(render_name),
                public_url = VALUES(public_url),
                relative_path = VALUES(relative_path),
                terrain_public_url = VALUES(terrain_public_url),
                terrain_relative_path = VALUES(terrain_relative_path),
                terrain_hash = VALUES(terrain_hash),
                terrain_bytes = VALUES(terrain_bytes),
                terrain_resolution = VALUES(terrain_resolution),
                terrain_min_height = VALUES(terrain_min_height),
                terrain_max_height = VALUES(terrain_max_height),
                terrain_water_level = VALUES(terrain_water_level),
                image_hash = VALUES(image_hash),
                image_mime = VALUES(image_mime),
                image_extension = VALUES(image_extension),
                image_bytes = VALUES(image_bytes),
                image_width = VALUES(image_width),
                image_height = VALUES(image_height),
                resolution = VALUES(resolution),
                world_size = VALUES(world_size),
                seed = VALUES(seed),
                protocol_network = VALUES(protocol_network),
                generated_at = VALUES(generated_at),
                published_at = VALUES(published_at),
                updated_at = NOW()',
            array_merge([
                'terrain_public_url' => '',
                'terrain_relative_path' => '',
                'terrain_hash' => '',
                'terrain_bytes' => 0,
                'terrain_resolution' => 0,
                'terrain_min_height' => 0,
                'terrain_max_height' => 0,
                'terrain_water_level' => 0,
            ], $values)
        );
    } else {
        raidlands_db_execute(
            'INSERT INTO server_map_images
                (server_id, wipe_key, map_name, render_name, public_url, relative_path, image_hash, image_mime, image_extension,
                 image_bytes, image_width, image_height, resolution, world_size, seed, protocol_network, generated_at, published_at)
             VALUES
                (:server_id, :wipe_key, :map_name, :render_name, :public_url, :relative_path, :image_hash, :image_mime, :image_extension,
                 :image_bytes, :image_width, :image_height, :resolution, :world_size, :seed, :protocol_network, :generated_at, NOW())
             ON DUPLICATE KEY UPDATE
                wipe_key = VALUES(wipe_key),
                map_name = VALUES(map_name),
                render_name = VALUES(render_name),
                public_url = VALUES(public_url),
                relative_path = VALUES(relative_path),
                image_hash = VALUES(image_hash),
                image_mime = VALUES(image_mime),
                image_extension = VALUES(image_extension),
                image_bytes = VALUES(image_bytes),
                image_width = VALUES(image_width),
                image_height = VALUES(image_height),
                resolution = VALUES(resolution),
                world_size = VALUES(world_size),
                seed = VALUES(seed),
                protocol_network = VALUES(protocol_network),
                generated_at = VALUES(generated_at),
                published_at = VALUES(published_at),
                updated_at = NOW()',
            array_intersect_key($values, array_flip([
                'server_id',
                'wipe_key',
                'map_name',
                'render_name',
                'public_url',
                'relative_path',
                'image_hash',
                'image_mime',
                'image_extension',
                'image_bytes',
                'image_width',
                'image_height',
                'resolution',
                'world_size',
                'seed',
                'protocol_network',
                'generated_at',
            ]))
        );
    }

    if ($skybox !== null && $skybox_written !== null && raidlands_server_map_skybox_columns_are_ready()) {
        raidlands_db_execute(
            'UPDATE server_map_images
             SET skybox_public_url = :skybox_public_url,
                 skybox_relative_path = :skybox_relative_path,
                 skybox_hash = :skybox_hash,
                 skybox_mime = :skybox_mime,
                 skybox_extension = :skybox_extension,
                 skybox_bytes = :skybox_bytes,
                 skybox_width = :skybox_width,
                 skybox_height = :skybox_height,
                 updated_at = NOW()
             WHERE server_id = :server_id',
            [
                'server_id' => $server_id,
                'skybox_public_url' => (string) $skybox_written['public_url'],
                'skybox_relative_path' => (string) $skybox_written['relative_path'],
                'skybox_hash' => (string) $skybox['hash'],
                'skybox_mime' => (string) $skybox['mime'],
                'skybox_extension' => (string) $skybox['extension'],
                'skybox_bytes' => (int) $skybox['size'],
                'skybox_width' => (int) $skybox['width'],
                'skybox_height' => (int) $skybox['height'],
            ]
        );
    }

    $row = raidlands_server_map_latest($server_id, $wipe_key) ?? array_merge($values, [
        'published_at' => gmdate('Y-m-d H:i:s'),
        'updated_at' => gmdate('Y-m-d H:i:s'),
    ]);

    return raidlands_server_map_row_public($row) ?? [];
}

function raidlands_server_map_latest(?string $server_id = null, string $wipe_key = ''): ?array
{
    if (!raidlands_server_map_images_is_ready()) {
        return null;
    }

    $server_id = $server_id ?? raidlands_server_status_server_id();
    $params = ['server_id' => $server_id];
    $where = 'server_id = :server_id';

    if (trim($wipe_key) !== '') {
        $where .= ' AND wipe_key = :wipe_key';
        $params['wipe_key'] = trim($wipe_key);
    }

    return raidlands_db_fetch_one(
        'SELECT *
         FROM server_map_images
         WHERE ' . $where . '
         ORDER BY published_at DESC
         LIMIT 1',
        $params
    );
}

function raidlands_server_map_row_public(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    $public_url = (string) ($row['public_url'] ?? '');
    $relative_path = (string) ($row['relative_path'] ?? '');

    if ($public_url === '' && $relative_path !== '') {
        $public_url = raidlands_server_map_public_url($relative_path);
    }

    $terrain_public_url = (string) ($row['terrain_public_url'] ?? '');
    $terrain_relative_path = (string) ($row['terrain_relative_path'] ?? '');

    if ($terrain_public_url === '' && $terrain_relative_path !== '') {
        $terrain_public_url = raidlands_server_map_public_url($terrain_relative_path);
    }

    $skybox_public_url = (string) ($row['skybox_public_url'] ?? '');
    $skybox_relative_path = (string) ($row['skybox_relative_path'] ?? '');

    if ($skybox_public_url === '' && $skybox_relative_path !== '') {
        $skybox_public_url = raidlands_server_map_public_url($skybox_relative_path);
    }

    return [
        'url' => $public_url,
        'publicUrl' => $public_url,
        'relativePath' => $relative_path,
        'textureUrl' => raidlands_server_map_texture_url((string) ($row['server_id'] ?? '')),
        'terrainUrl' => $terrain_public_url,
        'terrainPublicUrl' => $terrain_public_url,
        'terrainRelativePath' => $terrain_relative_path,
        'terrainHash' => (string) ($row['terrain_hash'] ?? ''),
        'terrainBytes' => (int) ($row['terrain_bytes'] ?? 0),
        'terrainResolution' => (int) ($row['terrain_resolution'] ?? 0),
        'terrainMinHeight' => (float) ($row['terrain_min_height'] ?? 0),
        'terrainMaxHeight' => (float) ($row['terrain_max_height'] ?? 0),
        'terrainWaterLevel' => (float) ($row['terrain_water_level'] ?? 0),
        'skyboxUrl' => $skybox_public_url,
        'skyboxPublicUrl' => $skybox_public_url,
        'skyboxRelativePath' => $skybox_relative_path,
        'skyboxHash' => (string) ($row['skybox_hash'] ?? ''),
        'skyboxMime' => (string) ($row['skybox_mime'] ?? ''),
        'skyboxExtension' => (string) ($row['skybox_extension'] ?? ''),
        'skyboxBytes' => (int) ($row['skybox_bytes'] ?? 0),
        'skyboxWidth' => (int) ($row['skybox_width'] ?? 0),
        'skyboxHeight' => (int) ($row['skybox_height'] ?? 0),
        'serverId' => (string) ($row['server_id'] ?? ''),
        'wipeKey' => (string) ($row['wipe_key'] ?? ''),
        'mapName' => (string) ($row['map_name'] ?? ''),
        'renderName' => (string) ($row['render_name'] ?? ''),
        'hash' => (string) ($row['image_hash'] ?? ''),
        'mime' => (string) ($row['image_mime'] ?? ''),
        'extension' => (string) ($row['image_extension'] ?? ''),
        'bytes' => (int) ($row['image_bytes'] ?? 0),
        'width' => (int) ($row['image_width'] ?? 0),
        'height' => (int) ($row['image_height'] ?? 0),
        'resolution' => (int) ($row['resolution'] ?? 0),
        'worldSize' => (int) ($row['world_size'] ?? 0),
        'seed' => (int) ($row['seed'] ?? 0),
        'protocol' => (int) ($row['protocol_network'] ?? 0),
        'generatedAt' => raidlands_server_status_iso($row['generated_at'] ?? ''),
        'publishedAt' => raidlands_server_status_iso($row['published_at'] ?? ''),
        'updatedAt' => raidlands_server_status_iso($row['updated_at'] ?? ''),
    ];
}

function raidlands_server_heatmap_clean_metric($value): string
{
    $metric = strtolower(trim((string) $value));
    $metric = preg_replace('/[^a-z0-9_-]+/', '_', $metric) ?? '';
    $aliases = [
        'player_deaths' => 'deaths',
        'death' => 'deaths',
        'pvp_kills' => 'kills',
        'player_kills' => 'kills',
        'npc_deaths' => 'npc_fights',
        'deaths_by_npc' => 'npc_fights',
        'npc_kills' => 'npc_fights',
        'roambots_activity' => 'roambots',
        'online_positions' => 'loot_pvp',
        'activity' => 'loot_pvp',
        'all_activity' => 'all',
        'combined' => 'all',
        'everything' => 'all',
    ];

    if (isset($aliases[$metric])) {
        return $aliases[$metric];
    }

    $allowed = ['all', 'deaths', 'kills', 'npc_fights', 'loot_pvp', 'roambots'];

    return in_array($metric, $allowed, true) ? $metric : 'deaths';
}

function raidlands_server_heatmap_bucket_metric_values(array $bucket, array $payload): array
{
    if (array_key_exists('value', $bucket)) {
        return [
            raidlands_server_heatmap_clean_metric($bucket['metric'] ?? $payload['metric'] ?? 'deaths') => max(0, round((float) ($bucket['value'] ?? 0), 4)),
        ];
    }

    $values = [];
    $metric_fields = [
        'player_deaths',
        'pvp_kills',
        'npc_deaths',
        'deaths_by_npc',
        'roambots_activity',
        'online_positions',
        'deaths',
        'kills',
        'npc_fights',
        'loot_pvp',
        'roambots',
    ];

    foreach ($metric_fields as $field) {
        if (!array_key_exists($field, $bucket) || !is_numeric($bucket[$field])) {
            continue;
        }

        $metric = raidlands_server_heatmap_clean_metric($field);
        $values[$metric] = ($values[$metric] ?? 0) + max(0, round((float) $bucket[$field], 4));
    }

    return $values;
}

function raidlands_server_heatmap_range(string $range): array
{
    $range = strtolower(trim($range));

    return match ($range) {
        '15m', '15min', 'quarter' => ['range' => '15m', 'label' => '15 minutes', 'minutes' => 15],
        '30m', '30min', 'half' => ['range' => '30m', 'label' => '30 minutes', 'minutes' => 30],
        '1h', 'hour' => ['range' => '1h', 'label' => '1 hour', 'minutes' => 60],
        '3h' => ['range' => '3h', 'label' => '3 hours', 'minutes' => 180],
        '6h' => ['range' => '6h', 'label' => '6 hours', 'minutes' => 360],
        '12h' => ['range' => '12h', 'label' => '12 hours', 'minutes' => 720],
        'wipe', 'all' => ['range' => 'wipe', 'label' => 'Current wipe', 'minutes' => 60 * 24 * 31],
        default => ['range' => '24h', 'label' => '24 hours', 'minutes' => 1440],
    };
}

function raidlands_server_location_viewer_context(string $server_id): array
{
    $can_view_all = function_exists('raidlands_admin_can') && raidlands_admin_can('admin.sync.view');

    if (!raidlands_server_player_locations_are_ready()) {
        return ['authenticated' => false, 'steamId64' => '', 'clanTag' => '', 'canViewAll' => $can_view_all];
    }

    $player = function_exists('raidlands_store_current_player') ? raidlands_store_current_player() : null;
    $steam_id64 = is_array($player) ? preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? '')) : '';

    if (!is_array($player) || !function_exists('raidlands_store_validate_steam_id64') || !raidlands_store_validate_steam_id64((string) $steam_id64)) {
        return ['authenticated' => false, 'steamId64' => '', 'clanTag' => '', 'canViewAll' => $can_view_all];
    }

    $self_location = raidlands_db_fetch_one(
        'SELECT clan_tag
         FROM server_player_locations
         WHERE server_id = :server_id AND steam_id64 = :steam_id64 AND is_online = 1
         LIMIT 1',
        ['server_id' => $server_id, 'steam_id64' => $steam_id64]
    );
    $clan_tag = raidlands_server_status_clean_text($self_location['clan_tag'] ?? '', 32);

    if ($clan_tag === '') {
        $clan_row = raidlands_db_fetch_one(
            'SELECT clan_tag
             FROM clan_members
             WHERE server_id = :server_id AND steam_id64 = :steam_id64
             LIMIT 1',
            ['server_id' => $server_id, 'steam_id64' => $steam_id64]
        );
        $clan_tag = raidlands_server_status_clean_text($clan_row['clan_tag'] ?? '', 32);
    }

    return ['authenticated' => true, 'steamId64' => $steam_id64, 'clanTag' => $clan_tag, 'canViewAll' => $can_view_all];
}

function raidlands_server_player_location_rows_for_context(string $server_id, array $context, ?int $at_time = null, int $window_seconds = 300, bool $include_all_players = false): array
{
    $steam_id64 = (string) ($context['steamId64'] ?? '');

    if ($include_all_players && !empty($context['canViewAll'])) {
        return raidlands_server_player_location_rows_all($server_id, $steam_id64, $at_time, $window_seconds);
    }

    if (empty($context['authenticated']) || $steam_id64 === '') {
        return [];
    }

    $clan_tag = raidlands_server_status_clean_text($context['clanTag'] ?? '', 32);
    $params = ['server_id' => $server_id, 'steam_id64' => $steam_id64];
    $where = 'server_id = :server_id AND (steam_id64 = :steam_id64';

    if ($clan_tag !== '') {
        $where .= ' OR clan_tag = :clan_tag';
        $params['clan_tag'] = $clan_tag;
    }

    $where .= ')';

    if ($at_time !== null && raidlands_server_player_location_history_is_ready()) {
        $params['window_start'] = gmdate('Y-m-d H:i:s', $at_time - max(60, $window_seconds));
        $params['window_end'] = gmdate('Y-m-d H:i:s', $at_time + max(60, $window_seconds));
        $rows = raidlands_db_fetch_all(
            'SELECT steam_id64, display_name, clan_tag, x, y, z, sampled_at
             FROM server_player_location_history
             WHERE ' . $where . ' AND sampled_at BETWEEN :window_start AND :window_end
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, sampled_at, :target_time)) ASC, steam_id64 = :order_steam_id64 DESC, display_name ASC
             LIMIT 80',
            array_merge($params, ['target_time' => gmdate('Y-m-d H:i:s', $at_time), 'order_steam_id64' => $steam_id64])
        );
    } else {
        $rows = raidlands_db_fetch_all(
            'SELECT steam_id64, display_name, clan_tag, x, y, z, sampled_at
             FROM server_player_locations
             WHERE ' . $where . ' AND is_online = 1 AND sampled_at >= :stale_after
             ORDER BY steam_id64 = :order_steam_id64 DESC, display_name ASC
             LIMIT 80',
            array_merge($params, [
                'stale_after' => gmdate('Y-m-d H:i:s', time() - 120),
                'order_steam_id64' => $steam_id64,
            ])
        );
    }

    $seen = [];
    $players = [];
    foreach ($rows as $row) {
        $row_steam = (string) ($row['steam_id64'] ?? '');
        if ($row_steam === '' || isset($seen[$row_steam])) {
            continue;
        }
        $seen[$row_steam] = true;
        $players[] = [
            'steamId64' => $row_steam,
            'displayName' => raidlands_server_status_clean_text($row['display_name'] ?? '', 120),
            'clanTag' => raidlands_server_status_clean_text($row['clan_tag'] ?? '', 32),
            'x' => (float) ($row['x'] ?? 0),
            'y' => (float) ($row['y'] ?? 0),
            'z' => (float) ($row['z'] ?? 0),
            'isSelf' => hash_equals($steam_id64, $row_steam),
            'sampledAt' => raidlands_server_status_iso($row['sampled_at'] ?? ''),
        ];
    }

    return $players;
}

function raidlands_server_player_location_rows_all(string $server_id, string $self_steam_id64 = '', ?int $at_time = null, int $window_seconds = 300): array
{
    if ($at_time !== null && raidlands_server_player_location_history_is_ready()) {
        $rows = raidlands_db_fetch_all(
            'SELECT steam_id64, display_name, clan_tag, x, y, z, sampled_at
             FROM server_player_location_history
             WHERE server_id = :server_id
               AND sampled_at BETWEEN :window_start AND :window_end
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, sampled_at, :target_time)) ASC, display_name ASC
             LIMIT 200',
            [
                'server_id' => $server_id,
                'window_start' => gmdate('Y-m-d H:i:s', $at_time - max(60, $window_seconds)),
                'window_end' => gmdate('Y-m-d H:i:s', $at_time + max(60, $window_seconds)),
                'target_time' => gmdate('Y-m-d H:i:s', $at_time),
            ]
        );
    } else {
        $rows = raidlands_db_fetch_all(
            'SELECT steam_id64, display_name, clan_tag, x, y, z, sampled_at
             FROM server_player_locations
             WHERE server_id = :server_id
               AND is_online = 1
               AND sampled_at >= :stale_after
             ORDER BY display_name ASC
             LIMIT 200',
            [
                'server_id' => $server_id,
                'stale_after' => gmdate('Y-m-d H:i:s', time() - 120),
            ]
        );
    }

    $seen = [];
    $players = [];
    foreach ($rows as $row) {
        $row_steam = (string) ($row['steam_id64'] ?? '');
        if ($row_steam === '' || isset($seen[$row_steam])) {
            continue;
        }
        $seen[$row_steam] = true;
        $players[] = [
            'steamId64' => $row_steam,
            'displayName' => raidlands_server_status_clean_text($row['display_name'] ?? '', 120),
            'clanTag' => raidlands_server_status_clean_text($row['clan_tag'] ?? '', 32),
            'x' => (float) ($row['x'] ?? 0),
            'y' => (float) ($row['y'] ?? 0),
            'z' => (float) ($row['z'] ?? 0),
            'isSelf' => $self_steam_id64 !== '' && hash_equals($self_steam_id64, $row_steam),
            'sampledAt' => raidlands_server_status_iso($row['sampled_at'] ?? ''),
        ];
    }

    return $players;
}

function raidlands_server_heatmap_delay_policy(): array
{
    return [
        'public' => ['label' => 'Public', 'delay_seconds' => 6 * 60 * 60, 'groups' => []],
        'vip_1' => ['label' => 'VIP', 'delay_seconds' => 3 * 60 * 60, 'groups' => ['vip', 'bronze', 'rank_bronze']],
        'vip_2' => ['label' => 'VIP+', 'delay_seconds' => 60 * 60, 'groups' => ['silver', 'gold', 'elite', 'rank_elite']],
        'vip_3' => ['label' => 'Premium VIP', 'delay_seconds' => 30 * 60, 'groups' => ['ultimate', 'rank_ultimate_vip']],
        'vip_4' => ['label' => 'Titan VIP', 'delay_seconds' => 15 * 60, 'groups' => ['titan', 'titan_vip', 'rank_titan_vip']],
    ];
}

function raidlands_server_heatmap_viewer_delay(): array
{
    if (!function_exists('raidlands_store_current_player')) {
        return raidlands_server_heatmap_delay_policy()['public'];
    }

    $player = raidlands_store_current_player();

    if ($player === null || empty($player['steam_id64']) || !raidlands_db_is_configured()) {
        return raidlands_server_heatmap_delay_policy()['public'];
    }

    try {
        $state = raidlands_store_active_groups_for_steam((string) $player['steam_id64']);
    } catch (Throwable $error) {
        return raidlands_server_heatmap_delay_policy()['public'];
    }

    $groups = array_map('strtolower', array_map('strval', $state['groups'] ?? []));
    $best = raidlands_server_heatmap_delay_policy()['public'];

    foreach (raidlands_server_heatmap_delay_policy() as $entry) {
        foreach ($groups as $group) {
            foreach ($entry['groups'] as $needle) {
                if ($group === $needle || str_contains($group, $needle)) {
                    if ((int) $entry['delay_seconds'] < (int) $best['delay_seconds']) {
                        $best = $entry;
                    }
                }
            }
        }
    }

    return $best;
}

function raidlands_server_history_latest_sample_time(string $server_id, string $wipe_key): ?int
{
    $timestamps = [];

    try {
        $heatmap_row = raidlands_db_fetch_one(
            'SELECT MAX(window_end) AS latest_at
             FROM server_heatmap_buckets
             WHERE server_id = :server_id AND wipe_key = :wipe_key',
            ['server_id' => $server_id, 'wipe_key' => $wipe_key]
        );
        $heatmap_time = strtotime((string) ($heatmap_row['latest_at'] ?? ''));
        if ($heatmap_time !== false) {
            $timestamps[] = $heatmap_time;
        }
    } catch (Throwable $error) {
        // Optional telemetry tables can be absent during initial setup.
    }

    foreach (['server_player_locations', 'server_player_location_history'] as $table) {
        try {
            $location_row = raidlands_db_fetch_one(
                'SELECT MAX(sampled_at) AS latest_at
                 FROM ' . $table . '
                 WHERE server_id = :server_id',
                ['server_id' => $server_id]
            );
            $location_time = strtotime((string) ($location_row['latest_at'] ?? ''));
            if ($location_time !== false) {
                $timestamps[] = $location_time;
            }
        } catch (Throwable $error) {
            // Optional telemetry tables can be absent during initial setup.
        }
    }

    return $timestamps === [] ? null : max($timestamps);
}

function raidlands_server_history_window_end_time(string $server_id, string $wipe_key, int $delay_seconds, bool $use_latest_sample): int
{
    $delayed_now = time() - max(0, $delay_seconds);

    if (!$use_latest_sample) {
        return $delayed_now;
    }

    $latest_sample = raidlands_server_history_latest_sample_time($server_id, $wipe_key);

    return $latest_sample === null ? $delayed_now : $latest_sample;
}

function raidlands_server_history_frame_shape(int $duration, int $requested_frames): array
{
    $requested_frames = max(2, min(96, $requested_frames));
    $max_minute_frames = max(2, (int) floor($duration / 60));
    $frames = min($requested_frames, $max_minute_frames);
    $frame_seconds = max(60, (int) ceil($duration / $frames));

    return [$frames, $frame_seconds];
}

function raidlands_server_heatmap_timestamp($value, string $fallback = ''): string
{
    $timestamp = strtotime((string) $value);

    if ($timestamp === false && $fallback !== '') {
        $timestamp = strtotime($fallback);
    }

    if ($timestamp === false) {
        throw new InvalidArgumentException('Heat map bucket window timestamps are required.');
    }

    return gmdate('Y-m-d H:i:s', $timestamp);
}

function raidlands_server_environment_color($value, string $fallback): string
{
    $color = strtolower(trim((string) $value));

    return preg_match('/^#[0-9a-f]{6}$/', $color) === 1 ? $color : $fallback;
}

function raidlands_server_environment_float($value, float $fallback, float $min, float $max, int $precision = 4): float
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    return round(max($min, min($max, (float) $value)), $precision);
}

function raidlands_server_environment_snapshot_public(?array $row): ?array
{
    if ($row === null) {
        return null;
    }

    return [
        'serverId' => (string) ($row['server_id'] ?? ''),
        'wipeKey' => (string) ($row['wipe_key'] ?? ''),
        'sampledAt' => raidlands_server_status_iso($row['sampled_at'] ?? ''),
        'rustTime' => round((float) ($row['rust_time'] ?? 0), 3),
        'dayFraction' => round((float) ($row['day_fraction'] ?? 0), 6),
        'sunDirection' => [
            'x' => round((float) ($row['sun_x'] ?? 0), 6),
            'y' => round((float) ($row['sun_y'] ?? 1), 6),
            'z' => round((float) ($row['sun_z'] ?? 0), 6),
        ],
        'sunIntensity' => round((float) ($row['sun_intensity'] ?? 1), 4),
        'sunColor' => raidlands_server_environment_color($row['sun_color'] ?? '', '#ffc47a'),
        'ambientIntensity' => round((float) ($row['ambient_intensity'] ?? 0.38), 4),
        'ambientColor' => raidlands_server_environment_color($row['ambient_color'] ?? '', '#ffead2'),
        'cloudCoverage' => $row['cloud_coverage'] === null ? null : round((float) $row['cloud_coverage'], 4),
        'rainIntensity' => $row['rain_intensity'] === null ? null : round((float) $row['rain_intensity'], 4),
        'fogIntensity' => $row['fog_intensity'] === null ? null : round((float) $row['fog_intensity'], 4),
    ];
}

function raidlands_server_environment_ingest_snapshot(array $payload, string $header_server_id): array
{
    if (!raidlands_server_environment_is_ready()) {
        throw new RuntimeException('Server environment table is not installed. Run database/migrations/059_server_environment_snapshots.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $server_id = raidlands_server_status_clean_text($payload['server_id'] ?? $payload['serverId'] ?? $header_server_id, 120);

    if ($server_id === '' || ($header_server_id !== '' && !hash_equals($header_server_id, $server_id))) {
        throw new InvalidArgumentException('Environment server_id does not match the authenticated server.');
    }

    $wipe_key = raidlands_server_status_clean_text($payload['wipe_key'] ?? $payload['wipeKey'] ?? '', 160);
    if ($wipe_key === '') {
        $wipe_key = $server_id . '-current';
    }

    $sampled_at = raidlands_server_heatmap_timestamp($payload['sampled_at'] ?? $payload['sampledAt'] ?? '', 'now');
    $direction = is_array($payload['sun_direction'] ?? null)
        ? $payload['sun_direction']
        : (is_array($payload['sunDirection'] ?? null) ? $payload['sunDirection'] : []);
    $sun_x = raidlands_server_environment_float($direction['x'] ?? $payload['sun_x'] ?? $payload['sunX'] ?? 0, 0, -1, 1, 6);
    $sun_y = raidlands_server_environment_float($direction['y'] ?? $payload['sun_y'] ?? $payload['sunY'] ?? 1, 1, -1, 1, 6);
    $sun_z = raidlands_server_environment_float($direction['z'] ?? $payload['sun_z'] ?? $payload['sunZ'] ?? 0, 0, -1, 1, 6);
    $length = sqrt(($sun_x * $sun_x) + ($sun_y * $sun_y) + ($sun_z * $sun_z));

    if ($length > 0.0001) {
        $sun_x = round($sun_x / $length, 6);
        $sun_y = round($sun_y / $length, 6);
        $sun_z = round($sun_z / $length, 6);
    }

    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO server_environment_snapshots
            (server_id, wipe_key, sampled_at, rust_time, day_fraction, sun_x, sun_y, sun_z,
             sun_intensity, sun_color, ambient_intensity, ambient_color, cloud_coverage,
             rain_intensity, fog_intensity, payload_json)
         VALUES
            (:server_id, :wipe_key, :sampled_at, :rust_time, :day_fraction, :sun_x, :sun_y, :sun_z,
             :sun_intensity, :sun_color, :ambient_intensity, :ambient_color, :cloud_coverage,
             :rain_intensity, :fog_intensity, :payload_json)
         ON DUPLICATE KEY UPDATE
            wipe_key = VALUES(wipe_key),
            rust_time = VALUES(rust_time),
            day_fraction = VALUES(day_fraction),
            sun_x = VALUES(sun_x),
            sun_y = VALUES(sun_y),
            sun_z = VALUES(sun_z),
            sun_intensity = VALUES(sun_intensity),
            sun_color = VALUES(sun_color),
            ambient_intensity = VALUES(ambient_intensity),
            ambient_color = VALUES(ambient_color),
            cloud_coverage = VALUES(cloud_coverage),
            rain_intensity = VALUES(rain_intensity),
            fog_intensity = VALUES(fog_intensity),
            payload_json = VALUES(payload_json)'
    );

    $statement->execute([
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'sampled_at' => $sampled_at,
        'rust_time' => raidlands_server_environment_float($payload['rust_time'] ?? $payload['rustTime'] ?? 0, 0, 0, 24, 3),
        'day_fraction' => raidlands_server_environment_float($payload['day_fraction'] ?? $payload['dayFraction'] ?? 0, 0, 0, 1, 6),
        'sun_x' => $sun_x,
        'sun_y' => $sun_y,
        'sun_z' => $sun_z,
        'sun_intensity' => raidlands_server_environment_float($payload['sun_intensity'] ?? $payload['sunIntensity'] ?? 1, 1, 0, 4, 4),
        'sun_color' => raidlands_server_environment_color($payload['sun_color'] ?? $payload['sunColor'] ?? '', '#ffc47a'),
        'ambient_intensity' => raidlands_server_environment_float($payload['ambient_intensity'] ?? $payload['ambientIntensity'] ?? 0.38, 0.38, 0, 2, 4),
        'ambient_color' => raidlands_server_environment_color($payload['ambient_color'] ?? $payload['ambientColor'] ?? '', '#ffead2'),
        'cloud_coverage' => isset($payload['cloud_coverage']) || isset($payload['cloudCoverage'])
            ? raidlands_server_environment_float($payload['cloud_coverage'] ?? $payload['cloudCoverage'], 0, 0, 1, 4)
            : null,
        'rain_intensity' => isset($payload['rain_intensity']) || isset($payload['rainIntensity'])
            ? raidlands_server_environment_float($payload['rain_intensity'] ?? $payload['rainIntensity'], 0, 0, 1, 4)
            : null,
        'fog_intensity' => isset($payload['fog_intensity']) || isset($payload['fogIntensity'])
            ? raidlands_server_environment_float($payload['fog_intensity'] ?? $payload['fogIntensity'], 0, 0, 1, 4)
            : null,
        'payload_json' => json_encode($payload, JSON_UNESCAPED_SLASHES),
    ]);

    raidlands_db_execute(
        'DELETE FROM server_environment_snapshots
         WHERE server_id = :server_id AND sampled_at < :cutoff',
        ['server_id' => $server_id, 'cutoff' => gmdate('Y-m-d H:i:s', time() - (31 * 24 * 60 * 60))]
    );

    return [
        'serverId' => $server_id,
        'wipeKey' => $wipe_key,
        'sampledAt' => raidlands_server_status_iso($sampled_at),
    ];
}

function raidlands_server_environment_public(): array
{
    if (!raidlands_server_environment_is_ready()) {
        return ['ok' => false, 'error' => 'Server environment is not available yet.', 'environment' => null];
    }

    $server_id = raidlands_server_status_server_id();
    $status = raidlands_server_status_latest();
    if (is_array($status) && !empty($status['server_id'])) {
        $server_id = (string) $status['server_id'];
    }

    $row = raidlands_db_fetch_one(
        'SELECT *
         FROM server_environment_snapshots
         WHERE server_id = :server_id
         ORDER BY sampled_at DESC
         LIMIT 1',
        ['server_id' => $server_id]
    );

    return [
        'ok' => $row !== null,
        'serverId' => $server_id,
        'environment' => raidlands_server_environment_snapshot_public($row),
        'error' => $row === null ? 'Waiting for the first server environment snapshot.' : '',
    ];
}

function raidlands_server_environment_public_at(string $at): array
{
    if (!raidlands_server_environment_is_ready()) {
        return ['ok' => false, 'error' => 'Server environment is not available yet.', 'environment' => null];
    }

    $target = strtotime($at);
    if ($target === false) {
        throw new InvalidArgumentException('Environment cursor time is invalid.');
    }

    $server_id = raidlands_server_status_server_id();
    $row = raidlands_db_fetch_one(
        'SELECT *
         FROM server_environment_snapshots
         WHERE server_id = :server_id
           AND sampled_at BETWEEN :window_start AND :window_end
         ORDER BY ABS(TIMESTAMPDIFF(SECOND, sampled_at, :target_time)) ASC
         LIMIT 1',
        [
            'server_id' => $server_id,
            'window_start' => gmdate('Y-m-d H:i:s', $target - 600),
            'window_end' => gmdate('Y-m-d H:i:s', $target + 600),
            'target_time' => gmdate('Y-m-d H:i:s', $target),
        ]
    );

    return [
        'ok' => $row !== null,
        'serverId' => $server_id,
        'environment' => raidlands_server_environment_snapshot_public($row),
        'error' => $row === null ? 'No environment snapshot is near that cursor.' : '',
    ];
}

function raidlands_server_environment_history_public(string $range, int $frames = 12): array
{
    $range_info = raidlands_server_heatmap_range($range);
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $window_end_time = raidlands_server_history_window_end_time($server_id, $wipe_key, 0, true);
    $window_start_time = $range_info['range'] === 'wipe'
        ? max(0, $window_end_time - (60 * 60 * 24 * 31))
        : $window_end_time - ((int) $range_info['minutes'] * 60);
    $duration = max(1, $window_end_time - $window_start_time);
    [$frames, $frame_seconds] = raidlands_server_history_frame_shape($duration, $frames);
    $start_aligned = $window_end_time - ($frame_seconds * $frames);
    $frames_payload = [];

    for ($frame = 0; $frame < $frames; $frame += 1) {
        $frame_start = $start_aligned + ($frame * $frame_seconds);
        $frame_end = min($window_end_time, $frame_start + $frame_seconds);
        $frames_payload[] = [
            'index' => $frame,
            'label' => gmdate('M j H:i', $frame_end),
            'windowStart' => gmdate('c', $frame_start),
            'windowEnd' => gmdate('c', $frame_end),
            'environment' => null,
        ];
    }

    if (!raidlands_server_environment_is_ready()) {
        return [
            'ok' => false,
            'error' => 'Server environment is not available yet.',
            'range' => $range_info['range'],
            'rangeLabel' => $range_info['label'],
            'windowEnd' => gmdate('c', $window_end_time),
            'frameSeconds' => $frame_seconds,
            'frames' => $frames_payload,
        ];
    }

    foreach ($frames_payload as &$frame_payload) {
        $frame_time = strtotime((string) ($frame_payload['windowEnd'] ?? ''));
        if ($frame_time === false) {
            continue;
        }

        $row = raidlands_db_fetch_one(
            'SELECT *
             FROM server_environment_snapshots
             WHERE server_id = :server_id
               AND sampled_at BETWEEN :window_start AND :window_end
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, sampled_at, :target_time)) ASC
             LIMIT 1',
            [
                'server_id' => $server_id,
                'window_start' => gmdate('Y-m-d H:i:s', $frame_time - max(300, $frame_seconds)),
                'window_end' => gmdate('Y-m-d H:i:s', $frame_time + max(300, $frame_seconds)),
                'target_time' => gmdate('Y-m-d H:i:s', $frame_time),
            ]
        );
        $frame_payload['environment'] = raidlands_server_environment_snapshot_public($row);
    }
    unset($frame_payload);

    return [
        'ok' => true,
        'serverId' => $server_id,
        'range' => $range_info['range'],
        'rangeLabel' => $range_info['label'],
        'windowEnd' => gmdate('c', $window_end_time),
        'frameSeconds' => $frame_seconds,
        'frames' => $frames_payload,
    ];
}

function raidlands_server_heatmap_ingest_snapshot(array $payload, string $header_server_id): array
{
    if (!raidlands_server_heatmap_is_ready()) {
        throw new RuntimeException('Server heat map table is not installed. Run database/migrations/051_server_map_heatmap.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $server_id = raidlands_server_status_clean_text($payload['server_id'] ?? $header_server_id, 120);

    if ($server_id === '' || ($header_server_id !== '' && !hash_equals($header_server_id, $server_id))) {
        throw new InvalidArgumentException('Heat map server_id does not match the authenticated server.');
    }

    $wipe_key = raidlands_server_status_clean_text($payload['wipe_key'] ?? '', 160);
    $bucket_size = max(25, min(1000, raidlands_server_status_int($payload['bucket_size'] ?? 100, 100, 1000)));
    $buckets = $payload['buckets'] ?? [];

    if ($wipe_key === '') {
        $wipe_key = $server_id . '-current';
    }

    if (!is_array($buckets) || count($buckets) < 1 || count($buckets) > 5000) {
        throw new InvalidArgumentException('Heat map snapshot must include 1 to 5000 aggregated buckets.');
    }

    $pdo = raidlands_db_required();
    $statement = $pdo->prepare(
        'INSERT INTO server_heatmap_buckets
            (server_id, wipe_key, bucket_size, x, z, metric, value, sample_count, window_start, window_end)
         VALUES
            (:server_id, :wipe_key, :bucket_size, :x, :z, :metric, :value, :sample_count, :window_start, :window_end)
         ON DUPLICATE KEY UPDATE
            value = VALUES(value),
            sample_count = VALUES(sample_count),
            updated_at = NOW()'
    );
    $count = 0;

    foreach ($buckets as $bucket) {
        if (!is_array($bucket)) {
            continue;
        }

        foreach (['steam_id', 'steamId', 'steam_id64', 'name', 'player', 'players', 'events', 'trail', 'positions'] as $forbidden_key) {
            if (array_key_exists($forbidden_key, $bucket)) {
                throw new InvalidArgumentException('Heat map snapshots must contain aggregated buckets only.');
            }
        }

        $x = (int) round((float) ($bucket['x'] ?? $bucket['center_x'] ?? $bucket['bucket_x'] ?? 0));
        $z = (int) round((float) ($bucket['z'] ?? $bucket['center_z'] ?? $bucket['bucket_z'] ?? 0));
        $sample_count = max(0, min(1000000, (int) ($bucket['sample_count'] ?? $bucket['sampleCount'] ?? 0)));
        $window_start = raidlands_server_heatmap_timestamp($bucket['window_start'] ?? $bucket['windowStart'] ?? $payload['window_start'] ?? '', '-1 hour');
        $window_end = raidlands_server_heatmap_timestamp($bucket['window_end'] ?? $bucket['windowEnd'] ?? $payload['window_end'] ?? '', 'now');
        $metric_values = raidlands_server_heatmap_bucket_metric_values($bucket, $payload);

        foreach ($metric_values as $metric => $value) {
            if ($value <= 0) {
                continue;
            }

            $statement->execute([
                'server_id' => $server_id,
                'wipe_key' => $wipe_key,
                'bucket_size' => $bucket_size,
                'x' => $x,
                'z' => $z,
                'metric' => $metric,
                'value' => $value,
                'sample_count' => $sample_count,
                'window_start' => $window_start,
                'window_end' => $window_end,
            ]);
            $count += 1;
        }
    }

    return [
        'serverId' => $server_id,
        'wipeKey' => $wipe_key,
        'bucketSize' => $bucket_size,
        'acceptedBuckets' => $count,
    ];
}

function raidlands_server_heatmap_palette(): array
{
    return [
        'name' => 'raidlands-cloud-volume',
        'stops' => [
            ['at' => 0.0, 'color' => '#2f80ff'],
            ['at' => 0.35, 'color' => '#39d98a'],
            ['at' => 0.62, 'color' => '#ffb23f'],
            ['at' => 0.86, 'color' => '#ff3b30'],
            ['at' => 1.0, 'color' => '#fff7d6'],
        ],
    ];
}

function raidlands_server_heatmap_public(string $metric, string $range): array
{
    $metric = raidlands_server_heatmap_clean_metric($metric);
    $range_info = raidlands_server_heatmap_range($range);
    $delay = raidlands_server_heatmap_viewer_delay();
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $world_size = (int) ($status['world_size'] ?? 0);
    $max_value = 0.0;
    $buckets = [];
    $location_context = raidlands_server_location_viewer_context($server_id);
    $window_end_time = raidlands_server_history_window_end_time(
        $server_id,
        $wipe_key,
        (int) $delay['delay_seconds'],
        !empty($location_context['authenticated']) || !empty($location_context['canViewAll'])
    );
    $window_start_time = $range_info['range'] === 'wipe'
        ? 0
        : $window_end_time - ((int) $range_info['minutes'] * 60);

    if (!raidlands_server_heatmap_is_ready()) {
        return [
            'ok' => false,
            'error' => 'Heat map data is not available yet.',
            'metric' => $metric,
            'range' => $range_info['range'],
            'buckets' => [],
            'maxValue' => 0,
            'worldSize' => $world_size,
            'wipeKey' => $wipe_key,
            'palette' => raidlands_server_heatmap_palette(),
            'delay' => [
                'label' => (string) $delay['label'],
                'delaySeconds' => (int) $delay['delay_seconds'],
            ],
        ];
    }

    $params = [
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'window_end' => gmdate('Y-m-d H:i:s', $window_end_time),
    ];
    $where = 'server_id = :server_id AND wipe_key = :wipe_key AND window_end <= :window_end';

    if ($metric !== 'all') {
        $where .= ' AND metric = :metric';
        $params['metric'] = $metric;
    }

    if ($window_start_time > 0) {
        $where .= ' AND window_end >= :window_start';
        $params['window_start'] = gmdate('Y-m-d H:i:s', $window_start_time);
    }

    $rows = raidlands_db_fetch_all(
        'SELECT bucket_size, x, z, SUM(value) AS value, SUM(sample_count) AS sample_count,
                MIN(window_start) AS window_start, MAX(window_end) AS window_end
         FROM server_heatmap_buckets
         WHERE ' . $where . '
         GROUP BY bucket_size, x, z
         ORDER BY value DESC
         LIMIT 1200',
        $params
    );

    foreach ($rows as $row) {
        $value = (float) ($row['value'] ?? 0);
        $max_value = max($max_value, $value);
        $buckets[] = [
            'bucketSize' => (int) ($row['bucket_size'] ?? 100),
            'x' => (int) ($row['x'] ?? 0),
            'z' => (int) ($row['z'] ?? 0),
            'value' => round($value, 4),
            'sampleCount' => (int) ($row['sample_count'] ?? 0),
            'windowStart' => raidlands_server_status_iso($row['window_start'] ?? ''),
            'windowEnd' => raidlands_server_status_iso($row['window_end'] ?? ''),
        ];
    }

    foreach ($buckets as &$bucket) {
        $bucket['normalized'] = $max_value > 0 ? round(((float) $bucket['value']) / $max_value, 4) : 0;
    }
    unset($bucket);

    return [
        'ok' => true,
        'metric' => $metric,
        'range' => $range_info['range'],
        'rangeLabel' => $range_info['label'],
        'windowEnd' => gmdate('c', $window_end_time),
        'maxValue' => round($max_value, 4),
        'worldSize' => $world_size,
        'wipeKey' => $wipe_key,
        'palette' => raidlands_server_heatmap_palette(),
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
        'buckets' => $buckets,
    ];
}

function raidlands_server_heatmap_history_public(string $metric, string $range, int $frames = 12): array
{
    $metric = raidlands_server_heatmap_clean_metric($metric);
    $range_info = raidlands_server_heatmap_range($range);
    $delay = raidlands_server_heatmap_viewer_delay();
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $world_size = (int) ($status['world_size'] ?? 0);
    $location_context = raidlands_server_location_viewer_context($server_id);
    $window_end_time = raidlands_server_history_window_end_time(
        $server_id,
        $wipe_key,
        (int) $delay['delay_seconds'],
        !empty($location_context['authenticated']) || !empty($location_context['canViewAll'])
    );
    $window_start_time = $range_info['range'] === 'wipe'
        ? max(0, $window_end_time - (60 * 60 * 24 * 31))
        : $window_end_time - ((int) $range_info['minutes'] * 60);
    $duration = max(1, $window_end_time - $window_start_time);
    [$frames, $frame_seconds] = raidlands_server_history_frame_shape($duration, $frames);
    $start_aligned = $window_end_time - ($frame_seconds * $frames);
    $max_value = 0.0;
    $frames_payload = [];

    for ($frame = 0; $frame < $frames; $frame += 1) {
        $frame_start = $start_aligned + ($frame * $frame_seconds);
        $frame_end = min($window_end_time, $frame_start + $frame_seconds);
        $frames_payload[] = [
            'index' => $frame,
            'label' => gmdate('M j H:i', $frame_end),
            'windowStart' => gmdate('c', $frame_start),
            'windowEnd' => gmdate('c', $frame_end),
            'buckets' => [],
            'maxValue' => 0,
        ];
    }

    if (!raidlands_server_heatmap_is_ready()) {
        return [
            'ok' => false,
            'error' => 'Heat map data is not available yet.',
            'metric' => $metric,
            'range' => $range_info['range'],
            'worldSize' => $world_size,
            'wipeKey' => $wipe_key,
            'palette' => raidlands_server_heatmap_palette(),
            'delay' => [
                'label' => (string) $delay['label'],
                'delaySeconds' => (int) $delay['delay_seconds'],
            ],
            'frames' => $frames_payload,
        ];
    }

    $params = [
        'server_id' => $server_id,
        'wipe_key' => $wipe_key,
        'window_start' => gmdate('Y-m-d H:i:s', $start_aligned),
        'window_start_bucket' => gmdate('Y-m-d H:i:s', $start_aligned),
        'window_end' => gmdate('Y-m-d H:i:s', $window_end_time),
    ];
    $where = 'server_id = :server_id
           AND wipe_key = :wipe_key
           AND window_end >= :window_start
           AND window_end <= :window_end';

    if ($metric !== 'all') {
        $where .= ' AND metric = :metric';
        $params['metric'] = $metric;
    }

    $rows = raidlands_db_fetch_all(
        'SELECT bucket_size, x, z, SUM(value) AS value, SUM(sample_count) AS sample_count,
                MIN(window_start) AS window_start, MAX(window_end) AS window_end
         FROM server_heatmap_buckets
         WHERE ' . $where . '
         GROUP BY bucket_size, x, z, FLOOR((UNIX_TIMESTAMP(window_end) - UNIX_TIMESTAMP(:window_start_bucket)) / ' . $frame_seconds . ')
         ORDER BY MAX(window_end) ASC, value DESC',
        $params
    );

    $per_frame_count = array_fill(0, $frames, 0);

    foreach ($rows as $row) {
        $row_window_end_time = strtotime((string) ($row['window_end'] ?? '') . ' UTC');
        $frame_index = $row_window_end_time === false
            ? -1
            : (int) floor(($row_window_end_time - $start_aligned) / $frame_seconds);

        if ($frame_index < 0 || $frame_index >= $frames || $per_frame_count[$frame_index] >= 600) {
            continue;
        }

        $value = (float) ($row['value'] ?? 0);
        $max_value = max($max_value, $value);
        $frames_payload[$frame_index]['maxValue'] = max((float) $frames_payload[$frame_index]['maxValue'], $value);
        $frames_payload[$frame_index]['buckets'][] = [
            'bucketSize' => (int) ($row['bucket_size'] ?? 100),
            'x' => (int) ($row['x'] ?? 0),
            'z' => (int) ($row['z'] ?? 0),
            'value' => round($value, 4),
            'sampleCount' => (int) ($row['sample_count'] ?? 0),
            'windowStart' => raidlands_server_status_iso($row['window_start'] ?? ''),
            'windowEnd' => raidlands_server_status_iso($row['window_end'] ?? ''),
        ];
        $per_frame_count[$frame_index] += 1;
    }

    foreach ($frames_payload as &$frame_payload) {
        $frame_max = max(0.0001, (float) ($frame_payload['maxValue'] ?? 0));
        foreach ($frame_payload['buckets'] as &$bucket) {
            $bucket['normalized'] = round(((float) $bucket['value']) / $frame_max, 4);
        }
        unset($bucket);
        $frame_payload['maxValue'] = round((float) ($frame_payload['maxValue'] ?? 0), 4);
    }
    unset($frame_payload);

    if (!empty($location_context['authenticated'])) {
        foreach ($frames_payload as &$frame_payload) {
            $frame_time = strtotime((string) ($frame_payload['windowEnd'] ?? ''));
            $frame_payload['players'] = $frame_time === false
                ? []
                : raidlands_server_player_location_rows_for_context($server_id, $location_context, $frame_time, max(300, $frame_seconds));
        }
        unset($frame_payload);
    }

    return [
        'ok' => true,
        'metric' => $metric,
        'range' => $range_info['range'],
        'rangeLabel' => $range_info['label'],
        'windowEnd' => gmdate('c', $window_end_time),
        'frameSeconds' => $frame_seconds,
        'maxValue' => round($max_value, 4),
        'worldSize' => $world_size,
        'wipeKey' => $wipe_key,
        'palette' => raidlands_server_heatmap_palette(),
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
        'authenticated' => !empty($location_context['authenticated']),
        'clanTag' => (string) ($location_context['clanTag'] ?? ''),
        'frames' => $frames_payload,
    ];
}

function raidlands_server_player_locations_ingest_snapshot(array $payload, string $header_server_id): array
{
    if (!raidlands_server_player_locations_are_ready()) {
        throw new RuntimeException('Server player location table is not installed. Run database/migrations/053_server_player_locations.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $server_id = raidlands_server_status_clean_text($payload['server_id'] ?? $header_server_id, 120);

    if ($server_id === '' || ($header_server_id !== '' && !hash_equals($header_server_id, $server_id))) {
        throw new InvalidArgumentException('Player location server_id does not match the authenticated server.');
    }

    $players = $payload['players'] ?? [];
    $sampled_at = raidlands_server_heatmap_timestamp($payload['sampled_at'] ?? $payload['sampledAt'] ?? '', 'now');

    if (!is_array($players) || count($players) > 500) {
        throw new InvalidArgumentException('Player location snapshot must include no more than 500 players.');
    }

    $pdo = raidlands_db_required();
    $pdo->beginTransaction();

    try {
        $offline = $pdo->prepare(
            'UPDATE server_player_locations
             SET is_online = 0, updated_at = NOW()
             WHERE server_id = :server_id'
        );
        $offline->execute(['server_id' => $server_id]);

        $statement = $pdo->prepare(
            'INSERT INTO server_player_locations
                (server_id, steam_id64, display_name, clan_tag, x, y, z, is_online, sampled_at)
             VALUES
                (:server_id, :steam_id64, :display_name, :clan_tag, :x, :y, :z, 1, :sampled_at)
             ON DUPLICATE KEY UPDATE
                display_name = VALUES(display_name),
                clan_tag = VALUES(clan_tag),
                x = VALUES(x),
                y = VALUES(y),
                z = VALUES(z),
                is_online = 1,
                sampled_at = VALUES(sampled_at),
                updated_at = NOW()'
        );
        $history_statement = raidlands_server_player_location_history_is_ready()
            ? $pdo->prepare(
                'INSERT INTO server_player_location_history
                    (server_id, steam_id64, display_name, clan_tag, x, y, z, sampled_at)
                 VALUES
                    (:server_id, :steam_id64, :display_name, :clan_tag, :x, :y, :z, :sampled_at)
                 ON DUPLICATE KEY UPDATE
                    display_name = VALUES(display_name),
                    clan_tag = VALUES(clan_tag),
                    x = VALUES(x),
                    y = VALUES(y),
                    z = VALUES(z)'
            )
            : null;
        $upsert_player = $pdo->prepare(
            'INSERT INTO players (steam_id64, display_name, last_seen_at)
             VALUES (:steam_id64, :display_name, NOW())
             ON DUPLICATE KEY UPDATE
                display_name = IF(VALUES(display_name) <> "", VALUES(display_name), display_name),
                last_seen_at = NOW(),
                updated_at = NOW()'
        );
        $accepted = 0;

        foreach ($players as $player) {
            if (!is_array($player)) {
                continue;
            }

            $steam_id64 = preg_replace('/\D+/', '', (string) ($player['steam_id64'] ?? $player['steamId'] ?? $player['steam_id'] ?? '')) ?? '';

            if (!function_exists('raidlands_store_validate_steam_id64') || !raidlands_store_validate_steam_id64($steam_id64)) {
                continue;
            }

            $display_name = raidlands_server_status_clean_text($player['display_name'] ?? $player['name'] ?? '', 120);
            $clan_tag = raidlands_server_status_clean_text($player['clan_tag'] ?? $player['clanTag'] ?? '', 32);
            $statement->execute([
                'server_id' => $server_id,
                'steam_id64' => $steam_id64,
                'display_name' => $display_name,
                'clan_tag' => $clan_tag,
                'x' => round((float) ($player['x'] ?? 0), 3),
                'y' => round((float) ($player['y'] ?? 0), 3),
                'z' => round((float) ($player['z'] ?? 0), 3),
                'sampled_at' => $sampled_at,
            ]);
            if ($history_statement !== null) {
                $history_statement->execute([
                    'server_id' => $server_id,
                    'steam_id64' => $steam_id64,
                    'display_name' => $display_name,
                    'clan_tag' => $clan_tag,
                    'x' => round((float) ($player['x'] ?? 0), 3),
                    'y' => round((float) ($player['y'] ?? 0), 3),
                    'z' => round((float) ($player['z'] ?? 0), 3),
                    'sampled_at' => $sampled_at,
                ]);
            }
            $upsert_player->execute([
                'steam_id64' => $steam_id64,
                'display_name' => $display_name,
            ]);
            $accepted += 1;
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    return [
        'serverId' => $server_id,
        'acceptedPlayers' => $accepted,
        'sampledAt' => raidlands_server_status_iso($sampled_at),
    ];
}

function raidlands_server_player_locations_public(bool $include_all_players = false): array
{
    $delay = raidlands_server_heatmap_viewer_delay();
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $context = raidlands_server_location_viewer_context($server_id);

    if (empty($context['authenticated'])) {
        return [
            'ok' => true,
            'authenticated' => false,
            'players' => [],
            'delay' => [
                'label' => (string) $delay['label'],
                'delaySeconds' => (int) $delay['delay_seconds'],
            ],
        ];
    }

    if (!raidlands_server_player_locations_are_ready()) {
        return [
            'ok' => false,
            'authenticated' => true,
            'error' => 'Player locations are not available yet.',
            'players' => [],
        ];
    }

    return [
        'ok' => true,
        'authenticated' => true,
        'serverId' => $server_id,
        'clanTag' => (string) ($context['clanTag'] ?? ''),
        'allPlayers' => $include_all_players && !empty($context['canViewAll']),
        'players' => raidlands_server_player_location_rows_for_context($server_id, $context, null, 300, $include_all_players),
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
    ];
}

function raidlands_server_player_locations_history_public(string $range, int $frames = 12, bool $include_all_players = false): array
{
    $range_info = raidlands_server_heatmap_range($range);
    $delay = raidlands_server_heatmap_viewer_delay();
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $context = raidlands_server_location_viewer_context($server_id);
    $history_ready = raidlands_server_player_location_history_is_ready();
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $window_end_time = raidlands_server_history_window_end_time(
        $server_id,
        $wipe_key,
        (int) $delay['delay_seconds'],
        !empty($context['authenticated']) || !empty($context['canViewAll'])
    );
    $window_start_time = $range_info['range'] === 'wipe'
        ? max(0, $window_end_time - (60 * 60 * 24 * 31))
        : $window_end_time - ((int) $range_info['minutes'] * 60);
    $duration = max(1, $window_end_time - $window_start_time);
    [$frames, $frame_seconds] = raidlands_server_history_frame_shape($duration, $frames);
    $start_aligned = $window_end_time - ($frame_seconds * $frames);
    $frames_payload = [];

    for ($frame = 0; $frame < $frames; $frame += 1) {
        $frame_start = $start_aligned + ($frame * $frame_seconds);
        $frame_end = min($window_end_time, $frame_start + $frame_seconds);
        $players = [];

        if ($history_ready && (!empty($context['authenticated']) || ($include_all_players && !empty($context['canViewAll'])))) {
            $players = raidlands_server_player_location_rows_for_context($server_id, $context, $frame_end, max(300, $frame_seconds), $include_all_players);
        }

        $frames_payload[] = [
            'index' => $frame,
            'label' => gmdate('M j H:i', $frame_end),
            'windowStart' => gmdate('c', $frame_start),
            'windowEnd' => gmdate('c', $frame_end),
            'players' => $players,
        ];
    }

    return [
        'ok' => true,
        'authenticated' => !empty($context['authenticated']),
        'allPlayers' => $include_all_players && !empty($context['canViewAll']),
        'historyAvailable' => $history_ready,
        'serverId' => $server_id,
        'range' => $range_info['range'],
        'rangeLabel' => $range_info['label'],
        'windowEnd' => gmdate('c', $window_end_time),
        'frameSeconds' => $frame_seconds,
        'clanTag' => (string) ($context['clanTag'] ?? ''),
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
        'frames' => $frames_payload,
    ];
}

function raidlands_server_map_replay_event_type($value): string
{
    $type = strtolower(trim((string) $value));
    $type = preg_replace('/[^a-z0-9_:-]+/', '_', $type) ?? '';

    if (in_array($type, [
        'airstrike',
        'airdrop',
        'excavator_start',
        'excavator_stop',
        'quarry_start',
        'quarry_stop',
        'oilrig_call',
        'oilrig_start',
        'oilrig_stop',
        'crate_hack_start',
        'crate_hack_complete',
        'cargo_ship',
        'server_event',
    ], true)) {
        return $type;
    }

    return '';
}

function raidlands_server_map_replay_active_wipe_key(string $server_id): string
{
    $status = raidlands_server_status_latest($server_id);
    $wipe_key = trim((string) ($status['wipe_key'] ?? ''));

    if ($wipe_key !== '') {
        return $wipe_key;
    }

    $map_image = raidlands_server_map_latest($server_id);
    $wipe_key = trim((string) ($map_image['wipe_key'] ?? ''));

    return $wipe_key !== '' ? $wipe_key : ($server_id . '-current');
}

function raidlands_server_map_replay_read_wipe_keys(string $server_id, string $wipe_key): array
{
    $keys = [];
    foreach ([$wipe_key, $server_id . '-current'] as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '' && !in_array($candidate, $keys, true)) {
            $keys[] = $candidate;
        }
    }

    return $keys;
}

function raidlands_server_map_replay_event_payload(array $event): string
{
    $payload = $event['payload'] ?? $event['details'] ?? [];
    if (!is_array($payload)) {
        $payload = [];
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    return is_string($json) && strlen($json) <= 12000 ? $json : '{}';
}

function raidlands_server_map_replay_events_ingest_snapshot(array $payload, string $header_server_id): array
{
    if (!raidlands_server_map_replay_events_are_ready()) {
        throw new RuntimeException('Server map replay event table is not installed. Run database/migrations/058_server_map_replay_events.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $server_id = raidlands_server_status_clean_text($payload['server_id'] ?? $header_server_id, 120);

    if ($server_id === '' || ($header_server_id !== '' && !hash_equals($header_server_id, $server_id))) {
        throw new InvalidArgumentException('Replay event server_id does not match the authenticated server.');
    }

    $wipe_key = raidlands_server_status_clean_text($payload['wipe_key'] ?? '', 160);
    if ($wipe_key === '' || hash_equals($server_id . '-current', $wipe_key)) {
        $wipe_key = raidlands_server_map_replay_active_wipe_key($server_id);
    }

    $events = $payload['events'] ?? [];
    if (!is_array($events) || count($events) < 1 || count($events) > 250) {
        throw new InvalidArgumentException('Replay event snapshot must include 1 to 250 events.');
    }

    $statement = raidlands_db_required()->prepare(
        'INSERT INTO server_map_replay_events
            (server_id, wipe_key, event_key, event_type, occurred_at, x, y, z, profile_key, vehicle, payload_json)
         VALUES
            (:server_id, :wipe_key, :event_key, :event_type, :occurred_at, :x, :y, :z, :profile_key, :vehicle, :payload_json)
         ON DUPLICATE KEY UPDATE
            event_type = VALUES(event_type),
            occurred_at = VALUES(occurred_at),
            x = VALUES(x),
            y = VALUES(y),
            z = VALUES(z),
            profile_key = VALUES(profile_key),
            vehicle = VALUES(vehicle),
            payload_json = VALUES(payload_json),
            updated_at = NOW()'
    );
    $accepted = 0;

    foreach ($events as $index => $event) {
        if (!is_array($event)) {
            continue;
        }

        $type = raidlands_server_map_replay_event_type($event['event_type'] ?? $event['eventType'] ?? $event['type'] ?? '');
        if ($type === '') {
            continue;
        }

        $occurred_at = raidlands_server_heatmap_timestamp($event['occurred_at'] ?? $event['occurredAt'] ?? $event['sampled_at'] ?? $payload['sampled_at'] ?? '', 'now');
        $event_key = raidlands_server_status_clean_text($event['event_key'] ?? $event['eventKey'] ?? '', 160);
        if ($event_key === '') {
            $event_key = hash('sha256', $type . '|' . $occurred_at . '|' . round((float) ($event['x'] ?? 0), 1) . '|' . round((float) ($event['z'] ?? 0), 1) . '|' . $index);
        }

        $statement->execute([
            'server_id' => $server_id,
            'wipe_key' => $wipe_key,
            'event_key' => $event_key,
            'event_type' => $type,
            'occurred_at' => $occurred_at,
            'x' => round((float) ($event['x'] ?? 0), 3),
            'y' => round((float) ($event['y'] ?? 0), 3),
            'z' => round((float) ($event['z'] ?? 0), 3),
            'profile_key' => raidlands_server_status_clean_text($event['profile_key'] ?? $event['profileKey'] ?? '', 120),
            'vehicle' => raidlands_server_status_clean_text($event['vehicle'] ?? '', 40),
            'payload_json' => raidlands_server_map_replay_event_payload($event),
        ]);
        $accepted += 1;
    }

    return [
        'serverId' => $server_id,
        'wipeKey' => $wipe_key,
        'acceptedEvents' => $accepted,
    ];
}

function raidlands_server_map_replay_event_from_row(array $row): array
{
    $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);
    if (!is_array($payload)) {
        $payload = [];
    }

    return [
        'id' => (int) ($row['id'] ?? 0),
        'eventKey' => (string) ($row['event_key'] ?? ''),
        'eventType' => (string) ($row['event_type'] ?? ''),
        'occurredAt' => raidlands_server_status_iso($row['occurred_at'] ?? ''),
        'x' => (float) ($row['x'] ?? 0),
        'y' => (float) ($row['y'] ?? 0),
        'z' => (float) ($row['z'] ?? 0),
        'profileKey' => (string) ($row['profile_key'] ?? ''),
        'vehicle' => (string) ($row['vehicle'] ?? ''),
        'payload' => $payload,
    ];
}

function raidlands_server_map_replay_events_history_public(string $range, int $frames = 12): array
{
    $range_info = raidlands_server_heatmap_range($range);
    $delay = raidlands_server_heatmap_viewer_delay();
    $status = raidlands_server_status_latest();
    $server_id = (string) ($status['server_id'] ?? raidlands_server_status_server_id());
    $wipe_key = (string) ($status['wipe_key'] ?? ($server_id . '-current'));
    $location_context = raidlands_server_location_viewer_context($server_id);
    $window_end_time = raidlands_server_history_window_end_time(
        $server_id,
        $wipe_key,
        (int) $delay['delay_seconds'],
        !empty($location_context['authenticated']) || !empty($location_context['canViewAll'])
    );
    $window_start_time = $range_info['range'] === 'wipe'
        ? max(0, $window_end_time - (60 * 60 * 24 * 31))
        : $window_end_time - ((int) $range_info['minutes'] * 60);
    $duration = max(1, $window_end_time - $window_start_time);
    [$frames, $frame_seconds] = raidlands_server_history_frame_shape($duration, $frames);
    $start_aligned = $window_end_time - ($frame_seconds * $frames);
    $frames_payload = [];

    for ($frame = 0; $frame < $frames; $frame += 1) {
        $frame_start = $start_aligned + ($frame * $frame_seconds);
        $frame_end = min($window_end_time, $frame_start + $frame_seconds);
        $frames_payload[] = [
            'index' => $frame,
            'label' => gmdate('M j H:i', $frame_end),
            'windowStart' => gmdate('c', $frame_start),
            'windowEnd' => gmdate('c', $frame_end),
            'events' => [],
        ];
    }

    if (!raidlands_server_map_replay_events_are_ready()) {
        return [
            'ok' => false,
            'error' => 'Replay events are not available yet.',
            'serverId' => $server_id,
            'wipeKey' => $wipe_key,
            'range' => $range_info['range'],
            'windowEnd' => gmdate('c', $window_end_time),
            'frameSeconds' => $frame_seconds,
            'frames' => $frames_payload,
        ];
    }

    $read_wipe_keys = raidlands_server_map_replay_read_wipe_keys($server_id, $wipe_key);
    $wipe_placeholders = [];
    $params = [
        'server_id' => $server_id,
        'window_start' => gmdate('Y-m-d H:i:s', $start_aligned),
        'window_end' => gmdate('Y-m-d H:i:s', $window_end_time),
    ];
    foreach ($read_wipe_keys as $index => $read_wipe_key) {
        $key = 'wipe_key_' . $index;
        $wipe_placeholders[] = ':' . $key;
        $params[$key] = $read_wipe_key;
    }

    $rows = raidlands_db_fetch_all(
        'SELECT *
         FROM server_map_replay_events
         WHERE server_id = :server_id
           AND wipe_key IN (' . implode(', ', $wipe_placeholders) . ')
           AND occurred_at >= :window_start
           AND occurred_at <= :window_end
         ORDER BY occurred_at ASC
         LIMIT 800',
        $params
    );

    $airdrop_groups = [];
    foreach ($rows as $row) {
        $event = raidlands_server_map_replay_event_from_row($row);
        $occurred = strtotime((string) $event['occurredAt']);
        if ($occurred === false) {
            continue;
        }

        if ($event['eventType'] === 'airdrop') {
            $matched = null;
            foreach ($airdrop_groups as $group_index => $group) {
                $distance = hypot(((float) $event['x']) - ((float) $group['x']), ((float) $event['z']) - ((float) $group['z']));
                if (abs($occurred - (int) $group['occurred']) <= 120 && $distance <= 150) {
                    $matched = $group_index;
                    break;
                }
            }
            if ($matched !== null) {
                $group = $airdrop_groups[$matched];
                $count = (int) $group['count'] + 1;
                $airdrop_groups[$matched]['x'] = (((float) $group['x']) * ($count - 1) + (float) $event['x']) / $count;
                $airdrop_groups[$matched]['y'] = max((float) $group['y'], (float) $event['y']);
                $airdrop_groups[$matched]['z'] = (((float) $group['z']) * ($count - 1) + (float) $event['z']) / $count;
                $airdrop_groups[$matched]['count'] = $count;
                $airdrop_groups[$matched]['eventKeys'][] = $event['eventKey'];
                continue;
            }
            $airdrop_groups[] = [
                'event' => $event,
                'occurred' => $occurred,
                'x' => (float) $event['x'],
                'y' => (float) $event['y'],
                'z' => (float) $event['z'],
                'count' => 1,
                'eventKeys' => [$event['eventKey']],
            ];
            continue;
        }

        $frame_index = (int) floor(($occurred - $start_aligned) / $frame_seconds);
        if ($frame_index >= 0 && $frame_index < $frames) {
            $frames_payload[$frame_index]['events'][] = $event;
        }
    }

    foreach ($airdrop_groups as $group) {
        $event = $group['event'];
        $event['eventKey'] = 'airdrop-group-' . hash('sha1', implode('|', $group['eventKeys']));
        $event['x'] = round((float) $group['x'], 3);
        $event['y'] = round((float) $group['y'], 3);
        $event['z'] = round((float) $group['z'], 3);
        $event['vehicle'] = 'cargo_plane';
        $event['payload']['dropCount'] = (int) $group['count'];
        $event['payload']['groupedEventKeys'] = $group['eventKeys'];
        $frame_index = (int) floor((((int) $group['occurred']) - $start_aligned) / $frame_seconds);
        if ($frame_index >= 0 && $frame_index < $frames) {
            $frames_payload[$frame_index]['events'][] = $event;
        }
    }

    return [
        'ok' => true,
        'serverId' => $server_id,
        'wipeKey' => $wipe_key,
        'range' => $range_info['range'],
        'rangeLabel' => $range_info['label'],
        'windowEnd' => gmdate('c', $window_end_time),
        'frameSeconds' => $frame_seconds,
        'delay' => [
            'label' => (string) $delay['label'],
            'delaySeconds' => (int) $delay['delay_seconds'],
        ],
        'frames' => $frames_payload,
    ];
}

function raidlands_server_status_timestamp($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        return gmdate('Y-m-d H:i:s', (int) $value);
    }

    $timestamp = strtotime((string) $value);

    return $timestamp === false ? null : gmdate('Y-m-d H:i:s', $timestamp);
}

function raidlands_server_status_iso($value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    $timestamp = strtotime((string) $value);

    return $timestamp === false ? '' : gmdate('c', $timestamp);
}

function raidlands_server_status_stat_value($value): string
{
    if ($value === null || $value === '') {
        return '';
    }

    if (is_numeric($value)) {
        return (string) round((float) $value);
    }

    return raidlands_server_status_clean_text($value, 40);
}

function raidlands_server_status_label(?bool $online, string $status): string
{
    if ($online === true || $status === 'online') {
        return 'Online';
    }

    if ($online === false || $status === 'offline') {
        return 'Offline';
    }

    return 'Unknown';
}

function raidlands_server_status_normalize_status($value, ?bool $online): string
{
    $status = strtolower(raidlands_server_status_clean_text($value, 40));
    $status = preg_replace('/[^a-z0-9_-]+/', '-', $status) ?? '';
    $status = trim($status, '-_');

    if ($status !== '') {
        return $status;
    }

    if ($online === true) {
        return 'online';
    }

    if ($online === false) {
        return 'offline';
    }

    return 'unknown';
}

function raidlands_server_status_ingest_heartbeat(array $payload, string $header_server_id, string $body): array
{
    if (!raidlands_server_status_is_ready()) {
        throw new RuntimeException('Server status table is not installed. Run database/migrations/009_server_status.sql.');
    }

    $header_server_id = raidlands_server_status_clean_text($header_server_id !== '' ? $header_server_id : raidlands_server_status_server_id(), 120);
    $payload_server_id = raidlands_server_status_clean_text($payload['server_id'] ?? '', 120);

    if ($payload_server_id !== '' && $payload_server_id !== $header_server_id) {
        throw new InvalidArgumentException('Heartbeat server_id does not match the authenticated bridge server.');
    }

    $online = raidlands_server_status_bool($payload['online'] ?? null);
    $status = raidlands_server_status_normalize_status($payload['status'] ?? '', $online);
    $status_label = raidlands_server_status_clean_text($payload['status_label'] ?? '', 80);

    if ($status_label === '') {
        $status_label = raidlands_server_status_label($online, $status);
    }

    $details_json = null;

    if (array_key_exists('details', $payload) && is_array($payload['details'])) {
        $details_json = json_encode($payload['details'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    $generated_at = raidlands_server_status_timestamp($payload['generated_at'] ?? null) ?? gmdate('Y-m-d H:i:s');
    $received_at = gmdate('Y-m-d H:i:s');
    $wipe_started_at = raidlands_server_status_timestamp($payload['wipe_started_at'] ?? null);
    $values = [
        'server_id' => $header_server_id,
        'name' => raidlands_server_status_clean_text($payload['name'] ?? '', 180),
        'online' => $online === null ? null : ($online ? 1 : 0),
        'status' => $status,
        'status_label' => $status_label,
        'generated_at' => $generated_at,
        'received_at' => $received_at,
        'players' => raidlands_server_status_int($payload['players'] ?? 0, 0),
        'max_players' => raidlands_server_status_int($payload['max_players'] ?? 0, 0),
        'queue' => raidlands_server_status_int($payload['queue'] ?? 0, 0),
        'joining' => raidlands_server_status_int($payload['joining'] ?? 0, 0),
        'sleepers' => raidlands_server_status_int($payload['sleepers'] ?? 0, 0),
        'server_fps' => raidlands_server_status_stat_value($payload['server_fps'] ?? ''),
        'server_fps_average' => raidlands_server_status_stat_value($payload['server_fps_average'] ?? ''),
        'entity_count' => raidlands_server_status_int($payload['entity_count'] ?? 0, 0),
        'map_name' => raidlands_server_status_clean_text($payload['map_name'] ?? '', 120),
        'world_size' => raidlands_server_status_int($payload['world_size'] ?? 0, 0),
        'seed' => raidlands_server_status_int($payload['seed'] ?? 0, 0),
        'wipe_key' => raidlands_server_status_clean_text($payload['wipe_key'] ?? '', 160),
        'wipe_started_at' => $wipe_started_at,
        'payload_hash' => hash('sha256', $body),
        'details_json' => $details_json,
    ];

    $statement = raidlands_db_required()->prepare(
        'INSERT INTO server_status
            (server_id, name, online, status, status_label, generated_at, received_at,
             players, max_players, queue, joining, sleepers, server_fps, server_fps_average,
             entity_count, map_name, world_size, seed, wipe_key, wipe_started_at, payload_hash, details_json)
         VALUES
            (:server_id, :name, :online, :status, :status_label, :generated_at, :received_at,
             :players, :max_players, :queue, :joining, :sleepers, :server_fps, :server_fps_average,
             :entity_count, :map_name, :world_size, :seed, :wipe_key, :wipe_started_at, :payload_hash, :details_json)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            online = VALUES(online),
            status = VALUES(status),
            status_label = VALUES(status_label),
            generated_at = VALUES(generated_at),
            received_at = VALUES(received_at),
            players = VALUES(players),
            max_players = VALUES(max_players),
            queue = VALUES(queue),
            joining = VALUES(joining),
            sleepers = VALUES(sleepers),
            server_fps = VALUES(server_fps),
            server_fps_average = VALUES(server_fps_average),
            entity_count = VALUES(entity_count),
            map_name = VALUES(map_name),
            world_size = VALUES(world_size),
            seed = VALUES(seed),
            wipe_key = VALUES(wipe_key),
            wipe_started_at = VALUES(wipe_started_at),
            payload_hash = VALUES(payload_hash),
            details_json = VALUES(details_json),
            updated_at = NOW()'
    );

    $statement->execute($values);
    raidlands_server_status_insert_sample($values);

    return [
        'server_id' => $header_server_id,
        'generated_at' => $generated_at,
        'received_at' => gmdate('c', strtotime($received_at)),
    ];
}

function raidlands_server_status_insert_sample(array $values): void
{
    if (!raidlands_server_status_history_is_ready()) {
        return;
    }

    try {
        raidlands_db_execute(
            'INSERT IGNORE INTO server_status_samples
                (server_id, generated_at, received_at, online, status, players, max_players, queue, joining, sleepers, map_name, payload_hash)
             VALUES
                (:server_id, :generated_at, :received_at, :online, :status, :players, :max_players, :queue, :joining, :sleepers, :map_name, :payload_hash)',
            [
                'server_id' => $values['server_id'],
                'generated_at' => $values['generated_at'],
                'received_at' => $values['received_at'],
                'online' => $values['online'],
                'status' => $values['status'],
                'players' => $values['players'],
                'max_players' => $values['max_players'],
                'queue' => $values['queue'],
                'joining' => $values['joining'],
                'sleepers' => $values['sleepers'],
                'map_name' => $values['map_name'],
                'payload_hash' => $values['payload_hash'],
            ]
        );

        raidlands_db_execute(
            'DELETE FROM server_status_samples
             WHERE server_id = :server_id
               AND received_at < :cutoff',
            [
                'server_id' => $values['server_id'],
                'cutoff' => gmdate('Y-m-d H:i:s', time() - (raidlands_server_status_sample_retention_days() * 24 * 60 * 60)),
            ]
        );

        raidlands_server_status_refresh_rollups((string) $values['server_id'], (string) $values['received_at']);
    } catch (Throwable $error) {
        // History is useful, but latest status should not fail because samples lag.
    }
}

function raidlands_server_status_refresh_rollups(string $server_id, string $received_at): void
{
    if (!raidlands_server_status_rollups_are_ready()) {
        return;
    }

    $timestamp = strtotime($received_at) ?: time();
    $hour_start = gmdate('Y-m-d H:00:00', $timestamp);
    $day_start = gmdate('Y-m-d', $timestamp);

    raidlands_server_status_refresh_hourly_rollup($server_id, $hour_start);
    raidlands_server_status_refresh_daily_rollup($server_id, $day_start);
    raidlands_server_status_prune_hourly_rollups($server_id);
}

function raidlands_server_status_refresh_hourly_rollup(string $server_id, string $hour_start): void
{
    $hour_timestamp = strtotime($hour_start) ?: time();
    $start = gmdate('Y-m-d H:00:00', $hour_timestamp);
    $end = gmdate('Y-m-d H:00:00', $hour_timestamp + 3600);

    raidlands_db_execute(
        'INSERT INTO server_status_hourly_rollups
            (server_id, bucket_hour, avg_players, peak_players, avg_queue, online_sample_count, sample_count)
         SELECT
            :select_server_id,
            :bucket_hour,
            COALESCE(ROUND(AVG(players), 2), 0),
            COALESCE(MAX(players), 0),
            COALESCE(ROUND(AVG(queue), 2), 0),
            COALESCE(SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END), 0),
            COUNT(*)
         FROM server_status_samples
         WHERE server_id = :where_server_id
           AND received_at >= :start_at
           AND received_at < :end_at
         HAVING COUNT(*) > 0
         ON DUPLICATE KEY UPDATE
            avg_players = VALUES(avg_players),
            peak_players = VALUES(peak_players),
            avg_queue = VALUES(avg_queue),
            online_sample_count = VALUES(online_sample_count),
            sample_count = VALUES(sample_count),
            updated_at = NOW()',
        [
            'select_server_id' => $server_id,
            'bucket_hour' => $start,
            'where_server_id' => $server_id,
            'start_at' => $start,
            'end_at' => $end,
        ]
    );
}

function raidlands_server_status_refresh_daily_rollup(string $server_id, string $bucket_date): void
{
    $day_timestamp = strtotime($bucket_date) ?: time();
    $start = gmdate('Y-m-d 00:00:00', $day_timestamp);
    $end = gmdate('Y-m-d 00:00:00', $day_timestamp + 86400);
    $date = gmdate('Y-m-d', $day_timestamp);
    $rows = raidlands_db_fetch_all(
        'SELECT id, online, players
         FROM server_status_samples
         WHERE server_id = :server_id
           AND received_at >= :start_at
           AND received_at < :end_at
         ORDER BY received_at ASC, id ASC',
        [
            'server_id' => $server_id,
            'start_at' => $start,
            'end_at' => $end,
        ]
    );

    $sample_count = count($rows);

    if ($sample_count === 0) {
        return;
    }

    $online_sample_count = 0;
    $peak_players = 0;
    $total_players = 0;
    $downtime_count = 0;
    $was_offline = false;

    foreach ($rows as $row) {
        $players = (int) ($row['players'] ?? 0);
        $online = isset($row['online']) ? (bool) $row['online'] : null;
        $peak_players = max($peak_players, $players);
        $total_players += $players;

        if ($online === true) {
            $online_sample_count += 1;
            $was_offline = false;
            continue;
        }

        if ($online === false) {
            if (!$was_offline) {
                $downtime_count += 1;
            }

            $was_offline = true;
            continue;
        }

        $was_offline = false;
    }

    raidlands_db_execute(
        'INSERT INTO server_status_daily_rollups
            (server_id, bucket_date, daily_peak, average_players, uptime_percent,
             downtime_count, online_sample_count, sample_count)
         VALUES
            (:server_id, :bucket_date, :daily_peak, :average_players, :uptime_percent,
             :downtime_count, :online_sample_count, :sample_count)
         ON DUPLICATE KEY UPDATE
            daily_peak = VALUES(daily_peak),
            average_players = VALUES(average_players),
            uptime_percent = VALUES(uptime_percent),
            downtime_count = VALUES(downtime_count),
            online_sample_count = VALUES(online_sample_count),
            sample_count = VALUES(sample_count),
            updated_at = NOW()',
        [
            'server_id' => $server_id,
            'bucket_date' => $date,
            'daily_peak' => $peak_players,
            'average_players' => round($total_players / $sample_count, 2),
            'uptime_percent' => round(($online_sample_count / $sample_count) * 100, 2),
            'downtime_count' => $downtime_count,
            'online_sample_count' => $online_sample_count,
            'sample_count' => $sample_count,
        ]
    );
}

function raidlands_server_status_prune_hourly_rollups(string $server_id): void
{
    $cutoff = strtotime('-' . raidlands_server_status_hourly_retention_months() . ' months');

    raidlands_db_execute(
        'DELETE FROM server_status_hourly_rollups
         WHERE server_id = :server_id
           AND bucket_hour < :cutoff',
        [
            'server_id' => $server_id,
            'cutoff' => gmdate('Y-m-d H:00:00', $cutoff === false ? time() : $cutoff),
        ]
    );
}

function raidlands_server_status_latest(?string $server_id = null): ?array
{
    if (!raidlands_server_status_is_ready()) {
        return null;
    }

    return raidlands_db_fetch_one(
        'SELECT * FROM server_status WHERE server_id = :server_id LIMIT 1',
        ['server_id' => $server_id ?? raidlands_server_status_server_id()]
    );
}

function raidlands_server_status_public(): array
{
    global $site_config;

    $row = raidlands_server_status_latest();

    if ($row === null) {
        return raidlands_server_status_fallback('Server heartbeat is not available yet.');
    }

    return raidlands_server_status_row_public($row, raidlands_server_status_stale_seconds(), $site_config);
}

function raidlands_server_status_history_public(?int $minutes = null, string $range = ''): array
{
    $history_range = raidlands_server_status_history_range($range, $minutes);

    if ($history_range['granularity'] === 'hour') {
        return raidlands_server_status_history_hourly_public((int) $history_range['days'], $history_range);
    }

    if ($history_range['granularity'] === 'day') {
        return raidlands_server_status_history_daily_public((int) $history_range['months'], $history_range);
    }

    return raidlands_server_status_history_recent_public((int) $history_range['minutes'], $history_range);
}

function raidlands_server_status_history_range(string $range, ?int $minutes = null): array
{
    $range = strtolower(trim($range));

    if ($range === '' && $minutes !== null) {
        $window_minutes = max(30, min(1440, $minutes));

        return [
            'range' => 'custom',
            'label' => raidlands_server_status_history_minutes_label($window_minutes),
            'granularity' => 'sample',
            'minutes' => $window_minutes,
        ];
    }

    if (in_array($range, ['24h', '1d', 'day'], true)) {
        return [
            'range' => '24h',
            'label' => '24 hours',
            'granularity' => 'sample',
            'minutes' => 1440,
        ];
    }

    if (in_array($range, ['30d', 'month'], true)) {
        return [
            'range' => '30d',
            'label' => '30 days',
            'granularity' => 'hour',
            'days' => 30,
            'minutes' => 30 * 24 * 60,
        ];
    }

    if (in_array($range, ['12mo', '12m', '1y', 'year'], true)) {
        return [
            'range' => '12mo',
            'label' => '12 months',
            'granularity' => 'day',
            'months' => 12,
            'minutes' => 365 * 24 * 60,
        ];
    }

    return [
        'range' => '6h',
        'label' => '6 hours',
        'granularity' => 'sample',
        'minutes' => 360,
    ];
}

function raidlands_server_status_history_recent_public(int $window_minutes, array $history_range): array
{
    $window_minutes = max(30, min(1440, $window_minutes));
    $now = time();
    $window_start = $now - ($window_minutes * 60);
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);
    $limit = min(3000, max(60, ($window_minutes * 2) + 10));

    if (!raidlands_server_status_history_is_ready()) {
        return raidlands_server_status_history_empty($window_minutes, 'Server status history is not available yet.', $history_range);
    }

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT *
             FROM (
                SELECT generated_at, received_at, online, status, players, max_players, queue, joining, sleepers, map_name
                FROM server_status_samples
                WHERE server_id = :server_id
                  AND received_at >= :cutoff
                ORDER BY received_at DESC
                LIMIT ' . $limit . '
             ) recent
             ORDER BY COALESCE(generated_at, received_at) ASC, received_at ASC',
            [
                'server_id' => raidlands_server_status_server_id(),
                'cutoff' => gmdate('Y-m-d H:i:s', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty($window_minutes, 'Server status history could not be loaded.', $history_range);
    }

    $samples = [];
    $online_count = 0;
    $peak_players = 0;
    $total_players = 0;
    $total_queue = 0;
    $downtime_count = 0;
    $was_offline = false;

    foreach ($rows as $row) {
        $online = isset($row['online']) ? (bool) $row['online'] : null;
        $players = (int) ($row['players'] ?? 0);
        $queue = (int) ($row['queue'] ?? 0);
        $peak_players = max($peak_players, $players);
        $total_players += $players;
        $total_queue += $queue;

        if ($online === true) {
            $online_count += 1;
            $was_offline = false;
        } elseif ($online === false) {
            if (!$was_offline) {
                $downtime_count += 1;
            }

            $was_offline = true;
        } else {
            $was_offline = false;
        }

        $samples[] = [
            'time' => raidlands_server_status_iso($row['generated_at'] ?? $row['received_at'] ?? ''),
            'generatedAt' => raidlands_server_status_iso($row['generated_at'] ?? ''),
            'online' => $online,
            'status' => (string) ($row['status'] ?? 'unknown'),
            'players' => $players,
            'maxPlayers' => (int) ($row['max_players'] ?? 0),
            'queue' => $queue,
            'joining' => (int) ($row['joining'] ?? 0),
            'sleepers' => (int) ($row['sleepers'] ?? 0),
            'mapName' => (string) ($row['map_name'] ?? ''),
            'granularity' => 'sample',
        ];
    }

    $sample_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => $window_minutes,
        'sampleCount' => $sample_count,
        'pointCount' => $sample_count,
        'onlineSampleCount' => $online_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_players / $sample_count, 1) : null,
        'averageQueue' => $sample_count > 0 ? round($total_queue / $sample_count, 1) : null,
        'downtimeCount' => $downtime_count,
        'samples' => $samples,
        'error' => $sample_count > 0 ? '' : 'Waiting for the first stored server heartbeat sample.',
    ]);
}

function raidlands_server_status_history_hourly_public(int $days, array $history_range): array
{
    $days = max(1, min(31, $days));
    $now = time();
    $window_start = intdiv($now - ($days * 24 * 60 * 60), 3600) * 3600;
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);

    if (!raidlands_server_status_rollups_are_ready()) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups are not available yet. Run database/migrations/011_server_status_rollups.sql.', $history_range);
    }

    $server_id = raidlands_server_status_server_id();

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT bucket_hour, avg_players, peak_players, avg_queue, online_sample_count, sample_count
             FROM server_status_hourly_rollups
             WHERE server_id = :server_id
               AND bucket_hour >= :cutoff
             ORDER BY bucket_hour ASC',
            [
                'server_id' => $server_id,
                'cutoff' => gmdate('Y-m-d H:00:00', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups could not be loaded.', $history_range);
    }

    $samples = [];
    $sample_count = 0;
    $online_sample_count = 0;
    $peak_players = 0;
    $total_player_weight = 0.0;
    $total_queue_weight = 0.0;

    foreach ($rows as $row) {
        $row_sample_count = (int) ($row['sample_count'] ?? 0);
        $row_online_count = (int) ($row['online_sample_count'] ?? 0);
        $average_players = (float) ($row['avg_players'] ?? 0);
        $average_queue = (float) ($row['avg_queue'] ?? 0);
        $sample_count += $row_sample_count;
        $online_sample_count += $row_online_count;
        $peak_players = max($peak_players, (int) ($row['peak_players'] ?? 0));
        $total_player_weight += $average_players * $row_sample_count;
        $total_queue_weight += $average_queue * $row_sample_count;

        $samples[] = [
            'time' => raidlands_server_status_iso($row['bucket_hour'] ?? ''),
            'bucket' => (string) ($row['bucket_hour'] ?? ''),
            'granularity' => 'hour',
            'online' => raidlands_server_status_rollup_online_state($row_online_count, $row_sample_count),
            'players' => round($average_players, 1),
            'peakPlayers' => (int) ($row['peak_players'] ?? 0),
            'queue' => round($average_queue, 1),
            'sampleCount' => $row_sample_count,
            'onlineSampleCount' => $row_online_count,
            'uptimePercent' => $row_sample_count > 0 ? round(($row_online_count / $row_sample_count) * 100, 1) : null,
        ];
    }

    $point_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => (int) ($history_range['minutes'] ?? ($days * 24 * 60)),
        'sampleCount' => $sample_count,
        'pointCount' => $point_count,
        'onlineSampleCount' => $online_sample_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_sample_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_player_weight / $sample_count, 1) : null,
        'averageQueue' => $sample_count > 0 ? round($total_queue_weight / $sample_count, 1) : null,
        'downtimeCount' => raidlands_server_status_daily_downtime_count($server_id, $days),
        'samples' => $samples,
        'error' => $point_count > 0 ? '' : 'Waiting for hourly server status rollups.',
    ]);
}

function raidlands_server_status_history_daily_public(int $months, array $history_range): array
{
    $months = max(1, min(24, $months));
    $now = time();
    $cutoff = strtotime('-' . $months . ' months', $now);
    $cutoff = $cutoff === false ? $now : $cutoff;
    $window_start = gmmktime(0, 0, 0, (int) gmdate('n', $cutoff), (int) gmdate('j', $cutoff), (int) gmdate('Y', $cutoff));
    $history_range['windowStart'] = gmdate('c', $window_start);
    $history_range['windowEnd'] = gmdate('c', $now);

    if (!raidlands_server_status_rollups_are_ready()) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status rollups are not available yet. Run database/migrations/011_server_status_rollups.sql.', $history_range);
    }

    try {
        $rows = raidlands_db_fetch_all(
            'SELECT bucket_date, daily_peak, average_players, uptime_percent,
                    downtime_count, online_sample_count, sample_count
             FROM server_status_daily_rollups
             WHERE server_id = :server_id
               AND bucket_date >= :cutoff
             ORDER BY bucket_date ASC',
            [
                'server_id' => raidlands_server_status_server_id(),
                'cutoff' => gmdate('Y-m-d', $window_start),
            ]
        );
    } catch (Throwable $error) {
        return raidlands_server_status_history_empty((int) ($history_range['minutes'] ?? 0), 'Server status daily rollups could not be loaded.', $history_range);
    }

    $samples = [];
    $sample_count = 0;
    $online_sample_count = 0;
    $peak_players = 0;
    $total_player_weight = 0.0;
    $downtime_count = 0;

    foreach ($rows as $row) {
        $row_sample_count = (int) ($row['sample_count'] ?? 0);
        $row_online_count = (int) ($row['online_sample_count'] ?? 0);
        $average_players = (float) ($row['average_players'] ?? 0);
        $sample_count += $row_sample_count;
        $online_sample_count += $row_online_count;
        $peak_players = max($peak_players, (int) ($row['daily_peak'] ?? 0));
        $total_player_weight += $average_players * $row_sample_count;
        $downtime_count += (int) ($row['downtime_count'] ?? 0);

        $samples[] = [
            'time' => raidlands_server_status_iso(((string) ($row['bucket_date'] ?? '')) . ' 00:00:00'),
            'bucket' => (string) ($row['bucket_date'] ?? ''),
            'granularity' => 'day',
            'online' => raidlands_server_status_rollup_online_state($row_online_count, $row_sample_count),
            'players' => round($average_players, 1),
            'peakPlayers' => (int) ($row['daily_peak'] ?? 0),
            'queue' => 0,
            'sampleCount' => $row_sample_count,
            'onlineSampleCount' => $row_online_count,
            'uptimePercent' => isset($row['uptime_percent']) ? round((float) $row['uptime_percent'], 1) : null,
            'downtimeCount' => (int) ($row['downtime_count'] ?? 0),
        ];
    }

    $point_count = count($samples);

    return raidlands_server_status_history_payload($history_range, [
        'windowMinutes' => (int) ($history_range['minutes'] ?? ($months * 31 * 24 * 60)),
        'sampleCount' => $sample_count,
        'pointCount' => $point_count,
        'onlineSampleCount' => $online_sample_count,
        'uptimePercent' => $sample_count > 0 ? round(($online_sample_count / $sample_count) * 100, 1) : null,
        'peakPlayers' => $peak_players,
        'averagePlayers' => $sample_count > 0 ? round($total_player_weight / $sample_count, 1) : null,
        'averageQueue' => null,
        'downtimeCount' => $downtime_count,
        'samples' => $samples,
        'error' => $point_count > 0 ? '' : 'Waiting for daily server status rollups.',
    ]);
}

function raidlands_server_status_daily_downtime_count(string $server_id, int $days): int
{
    try {
        $row = raidlands_db_fetch_one(
            'SELECT COALESCE(SUM(downtime_count), 0) AS downtime_count
             FROM server_status_daily_rollups
             WHERE server_id = :server_id
               AND bucket_date >= :cutoff',
            [
                'server_id' => $server_id,
                'cutoff' => gmdate('Y-m-d', time() - ($days * 24 * 60 * 60)),
            ]
        );
    } catch (Throwable $error) {
        return 0;
    }

    return (int) ($row['downtime_count'] ?? 0);
}

function raidlands_server_status_rollup_online_state(int $online_sample_count, int $sample_count): ?bool
{
    if ($sample_count <= 0) {
        return null;
    }

    if ($online_sample_count >= $sample_count) {
        return true;
    }

    if ($online_sample_count === 0) {
        return false;
    }

    return null;
}

function raidlands_server_status_history_payload(array $history_range, array $payload): array
{
    return array_merge([
        'ok' => true,
        'source' => 'raidlands',
        'sourceLabel' => 'Raidlands live feed',
        'range' => (string) ($history_range['range'] ?? '6h'),
        'rangeLabel' => (string) ($history_range['label'] ?? '6 hours'),
        'granularity' => (string) ($history_range['granularity'] ?? 'sample'),
        'windowMinutes' => (int) ($history_range['minutes'] ?? 360),
        'windowStart' => (string) ($history_range['windowStart'] ?? ''),
        'windowEnd' => (string) ($history_range['windowEnd'] ?? ''),
        'sampleCount' => 0,
        'pointCount' => 0,
        'onlineSampleCount' => 0,
        'uptimePercent' => null,
        'peakPlayers' => 0,
        'averagePlayers' => null,
        'averageQueue' => null,
        'downtimeCount' => 0,
        'samples' => [],
        'error' => '',
    ], $payload);
}

function raidlands_server_status_history_minutes_label(int $minutes): string
{
    if ($minutes >= 1440) {
        return '24 hours';
    }

    if ($minutes >= 60 && $minutes % 60 === 0) {
        $hours = (int) ($minutes / 60);

        return $hours . ' hour' . ($hours === 1 ? '' : 's');
    }

    return $minutes . ' minutes';
}

function raidlands_server_status_history_empty(int $window_minutes, string $error, array $history_range = []): array
{
    $fallback_range = $history_range;

    if ($fallback_range === []) {
        $fallback_range = [
            'range' => '6h',
            'label' => raidlands_server_status_history_minutes_label($window_minutes),
            'granularity' => 'sample',
            'minutes' => $window_minutes,
        ];
    }

    return raidlands_server_status_history_payload($fallback_range, [
        'ok' => false,
        'source' => 'fallback',
        'sourceLabel' => 'site fallback',
        'windowMinutes' => $window_minutes,
        'error' => $error,
    ]);
}

function raidlands_server_status_row_public(array $row, int $stale_seconds, array $site_config): array
{
    $received_at = strtotime((string) ($row['received_at'] ?? '')) ?: 0;
    $generated_at = strtotime((string) ($row['generated_at'] ?? '')) ?: $received_at;
    $freshness_time = max($received_at, $generated_at);
    $age_seconds = $freshness_time > 0 ? max(0, time() - $freshness_time) : $stale_seconds + 1;
    $stale = $age_seconds > $stale_seconds;
    $online = isset($row['online']) ? (bool) $row['online'] : null;
    $status = (string) ($row['status'] ?? 'unknown');
    $status_label = (string) ($row['status_label'] ?? '');

    if ($stale) {
        $online = null;
        $status = 'delayed';
        $status_label = 'Status Delayed';
    } elseif ($status_label === '') {
        $status_label = raidlands_server_status_label($online, $status);
    }

    $map_image = raidlands_server_map_latest(
        (string) ($row['server_id'] ?? raidlands_server_status_server_id()),
        (string) ($row['wipe_key'] ?? '')
    );
    $map_image_public = raidlands_server_map_row_public($map_image);

    return [
        'source' => 'raidlands',
        'sourceLabel' => $stale ? 'Raidlands delayed' : 'Raidlands live',
        'online' => $online,
        'status' => $status,
        'statusLabel' => $status_label,
        'name' => (string) ($row['name'] ?: $site_config['serverName']),
        'players' => (int) ($row['players'] ?? 0),
        'maxPlayers' => (int) ($row['max_players'] ?? $site_config['maxPlayers']),
        'queue' => (int) ($row['queue'] ?? 0),
        'joining' => (int) ($row['joining'] ?? 0),
        'sleepers' => (int) ($row['sleepers'] ?? 0),
        'mapName' => (string) ($row['map_name'] ?: $site_config['mapName']),
        'mapImageUrl' => (string) ($map_image_public['url'] ?? ''),
        'mapImage' => $map_image_public,
        'serverFps' => (string) ($row['server_fps'] ?: $site_config['serverFps']),
        'serverFpsAverage' => (string) ($row['server_fps_average'] ?? ''),
        'entityCount' => (int) ($row['entity_count'] ?? 0),
        'worldSize' => (int) ($row['world_size'] ?? 0),
        'seed' => (int) ($row['seed'] ?? 0),
        'wipeStartedAt' => raidlands_server_status_iso($row['wipe_started_at'] ?? ''),
        'lastWipe' => raidlands_server_status_iso($row['wipe_started_at'] ?? ''),
        'nextWipe' => '',
        'updatedAt' => raidlands_server_status_iso($row['generated_at'] ?? $row['received_at'] ?? ''),
        'receivedAt' => raidlands_server_status_iso($row['received_at'] ?? ''),
        'fetchedAt' => gmdate('c'),
        'cached' => false,
        'stale' => $stale,
        'ageSeconds' => $age_seconds,
        'staleAfterSeconds' => $stale_seconds,
        'battleMetricsUrl' => '',
        'error' => $stale ? 'Using the last server heartbeat because the live heartbeat is delayed.' : '',
    ];
}

function raidlands_server_status_fallback(string $error): array
{
    global $site_config;

    $online = (bool) $site_config['serverOnline'];

    return [
        'source' => 'fallback',
        'sourceLabel' => 'site fallback',
        'online' => $online,
        'status' => $online ? 'online' : 'offline',
        'statusLabel' => $online ? 'Online' : 'Offline',
        'name' => (string) $site_config['serverName'],
        'players' => (int) $site_config['playersOnline'],
        'maxPlayers' => (int) $site_config['maxPlayers'],
        'queue' => (int) $site_config['queue'],
        'joining' => 0,
        'sleepers' => 0,
        'mapName' => (string) $site_config['mapName'],
        'mapImageUrl' => '',
        'mapImage' => null,
        'serverFps' => (string) $site_config['serverFps'],
        'serverFpsAverage' => '',
        'entityCount' => 0,
        'worldSize' => 0,
        'seed' => 0,
        'wipeStartedAt' => '',
        'lastWipe' => '',
        'nextWipe' => '',
        'updatedAt' => '',
        'receivedAt' => '',
        'fetchedAt' => gmdate('c'),
        'cached' => false,
        'stale' => true,
        'battleMetricsUrl' => '',
        'error' => $error,
    ];
}
