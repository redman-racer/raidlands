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
