<?php

require_once __DIR__ . '/store.php';

function raidlands_podium_is_ready(): bool
{
    if (!raidlands_db_is_configured()) {
        return false;
    }

    try {
        raidlands_db_fetch_one('SELECT player_id FROM player_podium_profiles LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM player_outfit_observations LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM player_weapon_observations LIMIT 1');
        raidlands_db_fetch_one('SELECT id FROM podium_pose_presets LIMIT 1');
        raidlands_db_fetch_one('SELECT pose_key FROM player_podium_profiles LIMIT 1');
        return true;
    } catch (Throwable $error) {
        return false;
    }
}

function raidlands_podium_pose_bones(): array
{
    return [
        'pelvis', 'spine', 'spine1', 'spine2', 'neck', 'head',

        'l_clavicle', 'l_upperarm', 'l_forearm', 'l_hand',
        'r_clavicle', 'r_upperarm', 'r_forearm', 'r_hand',

        // Actual RustRelay mannequin bone names.
        'l_hip', 'l_knee', 'l_foot',
        'r_hip', 'r_knee', 'r_foot',

        // Retain legacy aliases for old presets or replacement models.
        'l_thigh', 'l_calf',
        'r_thigh', 'r_calf',
    ];
}

function raidlands_podium_normalize_pose_rotations($value): array
{
    if (!is_array($value)) return [];
    $allowed = array_fill_keys(raidlands_podium_pose_bones(), true);
    $result = [];
    foreach ($value as $bone => $rotation) {
        $bone = strtolower(trim((string) $bone));
        if (!isset($allowed[$bone]) || !is_array($rotation)) continue;
        $axes = [];
        foreach (['x', 'y', 'z'] as $axis) {
            $number = filter_var($rotation[$axis] ?? 0, FILTER_VALIDATE_FLOAT);
            $axes[$axis] = round(max(-3.141593, min(3.141593, $number === false ? 0.0 : (float) $number)), 6);
        }
        if (abs($axes['x']) + abs($axes['y']) + abs($axes['z']) > 0.00001) $result[$bone] = $axes;
    }
    ksort($result, SORT_STRING);
    return $result;
}

function raidlands_podium_default_pose(): array
{
    return [
        'key' => 'default',
        'label' => 'Leaderboard Idle (Default)',
        'bones' => raidlands_podium_normalize_pose_rotations([
            'pelvis' => ['x' => 0.0, 'y' => 0.03, 'z' => -0.02],
            'spine1' => ['x' => -0.025, 'y' => -0.025, 'z' => 0.015],
            'spine2' => ['x' => 0.02, 'y' => 0.015, 'z' => -0.01],
            'neck' => ['x' => -0.02, 'y' => 0.02, 'z' => 0.0],
            'head' => ['x' => 0.0, 'y' => -0.01, 'z' => 0.0],
            'l_clavicle' => ['x' => 0.093, 'y' => 0.345, 'z' => -0.142],
            'l_upperarm' => ['x' => 0.289, 'y' => -0.012, 'z' => -0.188],
            'l_forearm' => ['x' => 0.117, 'y' => -0.132, 'z' => -0.234],
            'r_clavicle' => ['x' => -0.083, 'y' => 0.424, 'z' => 0.113],
            'r_upperarm' => ['x' => -0.36, 'y' => -0.118, 'z' => 0.184],
            'r_forearm' => ['x' => -0.077, 'y' => -0.367, 'z' => 0.176],
        ]),
    ];
}

function raidlands_podium_poses(bool $include_inactive = false): array
{
    $poses = ['default' => raidlands_podium_default_pose()];
    if (!raidlands_podium_is_ready()) return $poses;
    $rows = raidlands_db_fetch_all(
        'SELECT pose_key, label, rotations_json, is_active FROM podium_pose_presets'
        . ($include_inactive ? '' : ' WHERE is_active = 1')
        . ' ORDER BY label ASC, id ASC'
    );
    foreach ($rows as $row) {
        $key = raidlands_podium_clean_key($row['pose_key'] ?? '', 64);
        if ($key === '' || $key === 'default') continue;
        $poses[$key] = [
            'key' => $key,
            'label' => trim((string) ($row['label'] ?? $key)),
            'bones' => raidlands_podium_normalize_pose_rotations(json_decode((string) ($row['rotations_json'] ?? '{}'), true)),
            'active' => !empty($row['is_active']),
        ];
    }
    return $poses;
}

function raidlands_podium_effective_pose_key(string $pose_key, string $fallback_pose_key = 'default'): string
{
    $pose_key = raidlands_podium_clean_key($pose_key, 64);
    if ($pose_key === '' || $pose_key === 'default') {
        $pose_key = raidlands_podium_clean_key($fallback_pose_key, 64);
    }
    return $pose_key !== '' ? $pose_key : 'default';
}

function raidlands_podium_pose_payload(string $pose_key, string $fallback_pose_key = 'default'): array
{
    $poses = raidlands_podium_poses();
    $pose_key = raidlands_podium_effective_pose_key($pose_key, $fallback_pose_key);
    return $poses[$pose_key] ?? $poses['default'];
}

function raidlands_podium_rank_pose_key(int $rank): string
{
    return match ($rank) {
        1 => 'first-place',
        2 => 'second-place',
        3 => 'third-place',
        default => 'default',
    };
}

function raidlands_podium_save_pose_preset(string $label, $rotations, string $actor_steam_id64): array
{
    if (!raidlands_podium_is_ready()) throw new RuntimeException('Run database migration 069 before saving poses.');
    $label = trim(preg_replace('/\s+/', ' ', $label) ?? '');
    if ($label === '' || mb_strlen($label) > 80) throw new InvalidArgumentException('Enter a pose name up to 80 characters.');
    $bones = raidlands_podium_normalize_pose_rotations($rotations);
    if ($bones === []) throw new InvalidArgumentException('Move at least one bone before saving the pose.');
    $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($label)), '-');
    $base = substr($base !== '' ? $base : 'pose', 0, 48);
    $key = $base;
    for ($suffix = 2; isset(raidlands_podium_poses(true)[$key]); $suffix++) $key = substr($base, 0, 54) . '-' . $suffix;
    raidlands_db_execute(
        'INSERT INTO podium_pose_presets (pose_key, label, rotations_json, created_by_steam_id64) VALUES (:pose_key, :label, :rotations_json, :actor)',
        ['pose_key' => $key, 'label' => $label, 'rotations_json' => json_encode($bones, JSON_UNESCAPED_SLASHES), 'actor' => $actor_steam_id64 ?: null]
    );
    return ['key' => $key, 'label' => $label, 'bones' => $bones];
}

function raidlands_podium_presets(): array
{
    return [
        'survivor' => ['label' => 'Vanilla Survivor', 'wearables' => ['body-head', 'body-torso', 'body-legs', 'body-hands', 'body-feet', 'hoodie', 'pants', 'boots']],
        'hazmat' => ['label' => 'Hazmat', 'wearables' => ['hazmat']],
        'arctic' => ['label' => 'Arctic Hazmat', 'wearables' => ['arctic-hazmat']],
        'ninja' => ['label' => 'Ninja Suit', 'wearables' => ['ninja-suit']],
        'heavy' => ['label' => 'Heavy Scientist', 'wearables' => ['heavy-scientist']],
    ];
}

function raidlands_podium_weapons(): array
{
    return [
        'rifle.ak' => ['label' => 'Assault Rifle', 'asset' => 'ak47'],
        'smg.thompson' => ['label' => 'Thompson', 'asset' => 'thompson'],
        'rifle.semiauto' => ['label' => 'Semi-Automatic Rifle', 'asset' => 'sar'],
        'pistol.semiauto' => ['label' => 'Semi-Automatic Pistol', 'asset' => 'sap'],
        'rocket.launcher' => ['label' => 'Rocket Launcher', 'asset' => 'rocket-launcher'],
    ];
}

function raidlands_podium_wearable_assets(): array
{
    return [
        'hoodie' => 'hoodie',
        'pants' => 'pants',
        'shoes.boots' => 'boots',
        'hazmatsuit' => 'hazmat',
        'suit.ninja' => 'ninja-suit',
        'scientistsuit_heavy' => 'heavy-scientist',
    ];
}

function raidlands_podium_clean_key($value, int $limit = 96): string
{
    $value = strtolower(trim((string) $value));
    $value = preg_replace('/[^a-z0-9._:-]+/', '', $value) ?? '';
    return substr($value, 0, $limit);
}

function raidlands_podium_skin_id($value): string
{
    $skin = preg_replace('/\D+/', '', (string) $value) ?? '';
    return $skin === '' ? '0' : substr($skin, 0, 24);
}

function raidlands_podium_normalize_wear($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $slots = [];
    foreach (array_slice($value, 0, 12) as $index => $item) {
        if (!is_array($item)) {
            continue;
        }
        $raw_shortname = strtolower(trim((string) ($item['shortname'] ?? '')));
        $raw_slot = strtolower(trim((string) ($item['slot'] ?? ('wear-' . $index))));
        if (preg_match('/^[a-z0-9._-]{1,64}$/', $raw_shortname) !== 1 || preg_match('/^[a-z0-9._-]{1,32}$/', $raw_slot) !== 1) continue;
        $shortname = $raw_shortname;
        $slot = $raw_slot;
        if ($shortname === '' || $slot === '') {
            continue;
        }
        $slots[$slot] = ['slot' => $slot, 'shortname' => $shortname, 'skin_id' => raidlands_podium_skin_id($item['skin_id'] ?? 0)];
    }
    ksort($slots, SORT_STRING);
    return array_values($slots);
}

function raidlands_podium_normalize_weapon($value): ?array
{
    if (!is_array($value)) {
        return null;
    }
    $shortname = strtolower(trim((string) ($value['shortname'] ?? '')));
    if (preg_match('/^[a-z0-9._-]{1,64}$/', $shortname) !== 1) {
        return null;
    }
    return ['shortname' => $shortname, 'skin_id' => raidlands_podium_skin_id($value['skin_id'] ?? 0)];
}

function raidlands_podium_ingest_observation(PDO $pdo, int $player_id, int $wipe_id, string $server_id, $appearance, string $observed_at): void
{
    if (!raidlands_podium_is_ready() || !is_array($appearance)) {
        return;
    }

    $wear = raidlands_podium_normalize_wear($appearance['wear'] ?? []);
    if ($wear !== []) {
        $json = json_encode($wear, JSON_UNESCAPED_SLASHES);
        $signature = hash('sha256', (string) $json);
        $statement = $pdo->prepare(
            'INSERT INTO player_outfit_observations
                (player_id, server_id, wipe_id, outfit_signature, items_json, sample_count, first_seen_at, last_seen_at)
             VALUES (:player_id, :server_id, :wipe_id, :signature, :items_json, 1, :first_seen_at, :last_seen_at)
             ON DUPLICATE KEY UPDATE sample_count = sample_count + 1, last_seen_at = VALUES(last_seen_at), items_json = VALUES(items_json), updated_at = NOW()'
        );
        $statement->execute([
            'player_id' => $player_id,
            'server_id' => $server_id,
            'wipe_id' => $wipe_id,
            'signature' => $signature,
            'items_json' => $json,
            'first_seen_at' => $observed_at,
            'last_seen_at' => $observed_at,
        ]);
    }

    $weapon = raidlands_podium_normalize_weapon($appearance['active_weapon'] ?? null);
    if ($weapon === null && is_array($appearance['belt_weapons'] ?? null)) {
        foreach ($appearance['belt_weapons'] as $candidate) {
            $weapon = raidlands_podium_normalize_weapon($candidate);
            if ($weapon !== null) break;
        }
    }
    if ($weapon !== null) {
        $statement = $pdo->prepare(
            'INSERT INTO player_weapon_observations
                (player_id, server_id, wipe_id, weapon_shortname, skin_id, sample_count, first_seen_at, last_seen_at)
             VALUES (:player_id, :server_id, :wipe_id, :shortname, :skin_id, 1, :first_seen_at, :last_seen_at)
             ON DUPLICATE KEY UPDATE sample_count = sample_count + 1, last_seen_at = VALUES(last_seen_at), updated_at = NOW()'
        );
        $statement->execute([
            'player_id' => $player_id,
            'server_id' => $server_id,
            'wipe_id' => $wipe_id,
            'shortname' => $weapon['shortname'],
            'skin_id' => $weapon['skin_id'],
            'first_seen_at' => $observed_at,
            'last_seen_at' => $observed_at,
        ]);
    }
}

function raidlands_podium_default_preset(string $identity): string
{
    $keys = array_keys(raidlands_podium_presets());
    return $keys[abs((int) crc32($identity)) % count($keys)];
}

function raidlands_podium_preset_payload(string $preset_key, string $source = 'preset'): array
{
    $presets = raidlands_podium_presets();
    $preset_key = isset($presets[$preset_key]) ? $preset_key : 'survivor';
    return [
        'preset' => $preset_key,
        'label' => $presets[$preset_key]['label'],
        'wearables' => array_map(static fn (string $key): array => ['asset' => $key, 'skin_id' => '0'], $presets[$preset_key]['wearables']),
        'source' => $source,
    ];
}

function raidlands_podium_observed_outfit_payload(array $row): ?array
{
    $items = json_decode((string) ($row['items_json'] ?? '[]'), true);
    $items = raidlands_podium_normalize_wear($items);
    $mapping = raidlands_podium_wearable_assets();
    $wearables = [];
    $coverage = ['torso' => false, 'legs' => false, 'feet' => false];
    foreach ($items as $item) {
        $shortname = (string) $item['shortname'];
        $asset = $mapping[$shortname] ?? '';
        if ($asset === '') continue;
        if (in_array($asset, ['hazmat', 'ninja-suit', 'heavy-scientist'], true)) {
            return ['preset' => 'captured', 'label' => 'Captured ' . ucwords(str_replace(['.', '_'], ' ', $shortname)), 'wearables' => [['asset' => $asset, 'skin_id' => (string) $item['skin_id']]], 'source' => 'captured'];
        }
        $wearables[] = ['asset' => $asset, 'skin_id' => (string) $item['skin_id']];
        if ($asset === 'hoodie') $coverage['torso'] = true;
        if ($asset === 'pants') $coverage['legs'] = true;
        if ($asset === 'boots') $coverage['feet'] = true;
    }
    if (in_array(false, $coverage, true)) return null;
    $body = ['body-head', 'body-torso', 'body-legs', 'body-hands', 'body-feet'];
    $body = array_map(static fn (string $asset): array => ['asset' => $asset, 'skin_id' => '0'], $body);
    return ['preset' => 'captured', 'label' => 'Captured in-game outfit', 'wearables' => array_merge($body, $wearables), 'source' => 'captured'];
}

function raidlands_podium_profile(int $player_id): array
{
    if (!raidlands_podium_is_ready() || $player_id <= 0) {
        return ['outfit_mode' => 'auto', 'outfit_key' => '', 'weapon_mode' => 'auto', 'weapon_key' => '', 'pose_key' => 'default'];
    }
    return raidlands_db_fetch_one('SELECT outfit_mode, outfit_key, weapon_mode, weapon_key, pose_key FROM player_podium_profiles WHERE player_id = :player_id', ['player_id' => $player_id])
        ?? ['outfit_mode' => 'auto', 'outfit_key' => '', 'weapon_mode' => 'auto', 'weapon_key' => '', 'pose_key' => 'default'];
}

function raidlands_podium_current_wipe_id(): int
{
    if (!raidlands_podium_is_ready()) return 0;
    $row = raidlands_db_fetch_one('SELECT id FROM wipe_seasons WHERE is_active = 1 ORDER BY started_at DESC, id DESC LIMIT 1');
    return (int) ($row['id'] ?? 0);
}

function raidlands_podium_captured_outfits(int $player_id, int $wipe_id = 0): array
{
    if (!raidlands_podium_is_ready() || $player_id <= 0) return [];
    $wipe_id = $wipe_id > 0 ? $wipe_id : raidlands_podium_current_wipe_id();
    if ($wipe_id <= 0) return [];
    return raidlands_db_fetch_all(
        'SELECT outfit_signature, items_json, sample_count, first_seen_at, last_seen_at
         FROM player_outfit_observations WHERE player_id = :player_id AND wipe_id = :wipe_id
         ORDER BY sample_count DESC, last_seen_at DESC LIMIT 20',
        ['player_id' => $player_id, 'wipe_id' => $wipe_id]
    );
}

function raidlands_podium_captured_weapons(int $player_id, int $wipe_id = 0): array
{
    if (!raidlands_podium_is_ready() || $player_id <= 0) return [];
    $wipe_id = $wipe_id > 0 ? $wipe_id : raidlands_podium_current_wipe_id();
    if ($wipe_id <= 0) return [];
    return raidlands_db_fetch_all(
        'SELECT weapon_shortname, skin_id, sample_count, first_seen_at, last_seen_at
         FROM player_weapon_observations WHERE player_id = :player_id AND wipe_id = :wipe_id
         ORDER BY sample_count DESC, last_seen_at DESC LIMIT 20',
        ['player_id' => $player_id, 'wipe_id' => $wipe_id]
    );
}

function raidlands_podium_resolve_player(int $player_id, string $identity, string $fallback_pose_key = 'default'): array
{
    $fallback = raidlands_podium_preset_payload(raidlands_podium_default_preset($identity), 'default');
    $fallback['weapon'] = raidlands_podium_default_weapon($identity);
    $fallback['pose'] = raidlands_podium_pose_payload('default', $fallback_pose_key);
    if (!raidlands_podium_is_ready() || $player_id <= 0) return $fallback;

    $profile = raidlands_podium_profile($player_id);
    $outfit = null;
    if ($profile['outfit_mode'] === 'preset') {
        $outfit = raidlands_podium_preset_payload((string) $profile['outfit_key'], 'manual');
    } elseif ($profile['outfit_mode'] === 'captured' && preg_match('/^[a-f0-9]{64}$/', (string) $profile['outfit_key'])) {
        $row = raidlands_db_fetch_one('SELECT * FROM player_outfit_observations WHERE player_id = :player_id AND outfit_signature = :signature ORDER BY last_seen_at DESC LIMIT 1', ['player_id' => $player_id, 'signature' => $profile['outfit_key']]);
        if ($row !== null) $outfit = raidlands_podium_observed_outfit_payload($row);
        if ($outfit !== null) $outfit['source'] = 'manual';
    } else {
        $rows = raidlands_podium_captured_outfits($player_id);
        $total = array_sum(array_map(static fn (array $row): int => (int) $row['sample_count'], $rows));
        if ($rows !== [] && (int) $rows[0]['sample_count'] >= 3 && (int) $rows[0]['sample_count'] >= ($total * .5)) {
            $outfit = raidlands_podium_observed_outfit_payload($rows[0]);
            if ($outfit !== null) $outfit['source'] = 'auto';
        }
    }
    $outfit = $outfit ?? $fallback;
    $outfit['weapon'] = raidlands_podium_resolve_weapon($player_id, $identity, $profile);
    $outfit['pose'] = raidlands_podium_pose_payload((string) ($profile['pose_key'] ?? 'default'), $fallback_pose_key);
    return $outfit;
}

function raidlands_podium_default_weapon(string $identity): array
{
    $keys = array_keys(raidlands_podium_weapons());
    $shortname = $keys[abs((int) crc32('weapon:' . $identity)) % count($keys)];
    $weapon = raidlands_podium_weapons()[$shortname];
    return ['shortname' => $shortname, 'skin_id' => '0', 'asset' => $weapon['asset'], 'label' => $weapon['label'], 'source' => 'default'];
}

function raidlands_podium_resolve_weapon(int $player_id, string $identity, array $profile): ?array
{
    if ($profile['weapon_mode'] === 'none') return null;
    $catalog = raidlands_podium_weapons();
    $shortname = '';
    $skin = '0';
    $source = 'auto';
    if ($profile['weapon_mode'] === 'preset' && isset($catalog[$profile['weapon_key']])) {
        $shortname = (string) $profile['weapon_key']; $source = 'manual';
    } elseif ($profile['weapon_mode'] === 'captured') {
        [$candidate, $candidate_skin] = array_pad(explode(':', (string) $profile['weapon_key'], 2), 2, '0');
        if (isset($catalog[$candidate])) { $shortname = $candidate; $skin = raidlands_podium_skin_id($candidate_skin); $source = 'manual'; }
    } else {
        foreach (raidlands_podium_captured_weapons($player_id) as $row) {
            if (isset($catalog[$row['weapon_shortname']])) { $shortname = (string) $row['weapon_shortname']; $skin = (string) $row['skin_id']; break; }
        }
    }
    if ($shortname === '') return raidlands_podium_default_weapon($identity);
    return ['shortname' => $shortname, 'skin_id' => $skin, 'asset' => $catalog[$shortname]['asset'], 'label' => $catalog[$shortname]['label'], 'source' => $source];
}

function raidlands_podium_resolve_bot(string $identity, string $fallback_pose_key = 'default'): array
{
    $payload = raidlands_podium_preset_payload(raidlands_podium_default_preset('bot:' . $identity), 'bot-preset');
    $payload['weapon'] = raidlands_podium_default_weapon('bot:' . $identity);
    $payload['pose'] = raidlands_podium_pose_payload('default', $fallback_pose_key);
    return $payload;
}

function raidlands_podium_decorate_leaders(array $leaders, string $board): array
{
    $rank = 1;
    foreach ($leaders as &$leader) {
        $identity = $board === 'bots' ? (string) ($leader['bot_key'] ?? $leader['display_name'] ?? 'bot') : (string) ($leader['steam_id64'] ?? 'player');
        $fallback_pose_key = raidlands_podium_rank_pose_key($rank);
        $leader['appearance'] = $board === 'bots'
            ? raidlands_podium_resolve_bot($identity, $fallback_pose_key)
            : raidlands_podium_resolve_player((int) ($leader['player_id'] ?? 0), $identity, $fallback_pose_key);
        $rank++;
    }
    unset($leader);
    return $leaders;
}

function raidlands_podium_profile_bundle(int $player_id, string $identity): array
{
    $profile = raidlands_podium_profile($player_id);
    $outfits = [];
    foreach (raidlands_podium_captured_outfits($player_id) as $row) {
        $payload = raidlands_podium_observed_outfit_payload($row);
        if ($payload === null) continue;
        $outfits[] = ['key' => (string) $row['outfit_signature'], 'label' => $payload['label'] . ' (' . (int) $row['sample_count'] . ' captures)', 'appearance' => $payload];
    }
    return ['profile' => $profile, 'resolved' => raidlands_podium_resolve_player($player_id, $identity), 'presets' => raidlands_podium_presets(), 'weapons' => raidlands_podium_weapons(), 'poses' => raidlands_podium_poses(), 'pose_bones' => raidlands_podium_pose_bones(), 'captured_outfits' => $outfits, 'captured_weapons' => raidlands_podium_captured_weapons($player_id)];
}

function raidlands_podium_save_profile(int $player_id, array $input): void
{
    if (!raidlands_podium_is_ready() || $player_id <= 0) throw new RuntimeException('Podium appearance tables are not installed yet.');
    $outfit_mode = raidlands_podium_clean_key($input['outfit_mode'] ?? 'auto', 16);
    $outfit_key = raidlands_podium_clean_key($input['outfit_key'] ?? '', 96);
    $weapon_mode = raidlands_podium_clean_key($input['weapon_mode'] ?? 'auto', 16);
    $weapon_key = raidlands_podium_clean_key($input['weapon_key'] ?? '', 96);
    $pose_key = raidlands_podium_clean_key($input['pose_key'] ?? 'default', 64);
    if (!in_array($outfit_mode, ['auto', 'preset', 'captured'], true)) throw new InvalidArgumentException('Choose a valid outfit mode.');
    if (!in_array($weapon_mode, ['auto', 'preset', 'captured', 'none'], true)) throw new InvalidArgumentException('Choose a valid weapon mode.');
    if ($outfit_mode === 'preset' && !isset(raidlands_podium_presets()[$outfit_key])) throw new InvalidArgumentException('That podium outfit is unavailable.');
    if ($outfit_mode === 'captured' && raidlands_db_fetch_one('SELECT id FROM player_outfit_observations WHERE player_id = :player_id AND outfit_signature = :signature', ['player_id' => $player_id, 'signature' => $outfit_key]) === null) throw new InvalidArgumentException('That captured outfit does not belong to this player.');
    if ($weapon_mode === 'preset' && !isset(raidlands_podium_weapons()[$weapon_key])) throw new InvalidArgumentException('That podium weapon is unavailable.');
    if (!isset(raidlands_podium_poses()[$pose_key])) throw new InvalidArgumentException('That podium pose is unavailable.');
    if ($weapon_mode === 'captured') {
        [$shortname, $skin] = array_pad(explode(':', $weapon_key, 2), 2, '0');
        if (raidlands_db_fetch_one('SELECT id FROM player_weapon_observations WHERE player_id = :player_id AND weapon_shortname = :shortname AND skin_id = :skin_id', ['player_id' => $player_id, 'shortname' => $shortname, 'skin_id' => raidlands_podium_skin_id($skin)]) === null) throw new InvalidArgumentException('That captured weapon does not belong to this player.');
    }
    $statement = raidlands_db_required()->prepare(
        'INSERT INTO player_podium_profiles (player_id, outfit_mode, outfit_key, weapon_mode, weapon_key, pose_key)
         VALUES (:player_id, :outfit_mode, :outfit_key, :weapon_mode, :weapon_key, :pose_key)
         ON DUPLICATE KEY UPDATE outfit_mode = VALUES(outfit_mode), outfit_key = VALUES(outfit_key), weapon_mode = VALUES(weapon_mode), weapon_key = VALUES(weapon_key), pose_key = VALUES(pose_key), updated_at = NOW()'
    );
    $statement->execute(['player_id' => $player_id, 'outfit_mode' => $outfit_mode, 'outfit_key' => $outfit_key ?: null, 'weapon_mode' => $weapon_mode, 'weapon_key' => $weapon_key ?: null, 'pose_key' => $pose_key]);
}
