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
        return true;
    } catch (Throwable $error) {
        return false;
    }
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
             VALUES (:player_id, :server_id, :wipe_id, :signature, :items_json, 1, :observed_at, :observed_at)
             ON DUPLICATE KEY UPDATE sample_count = sample_count + 1, last_seen_at = VALUES(last_seen_at), items_json = VALUES(items_json), updated_at = NOW()'
        );
        $statement->execute(['player_id' => $player_id, 'server_id' => $server_id, 'wipe_id' => $wipe_id, 'signature' => $signature, 'items_json' => $json, 'observed_at' => $observed_at]);
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
             VALUES (:player_id, :server_id, :wipe_id, :shortname, :skin_id, 1, :observed_at, :observed_at)
             ON DUPLICATE KEY UPDATE sample_count = sample_count + 1, last_seen_at = VALUES(last_seen_at), updated_at = NOW()'
        );
        $statement->execute(['player_id' => $player_id, 'server_id' => $server_id, 'wipe_id' => $wipe_id, 'shortname' => $weapon['shortname'], 'skin_id' => $weapon['skin_id'], 'observed_at' => $observed_at]);
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
        return ['outfit_mode' => 'auto', 'outfit_key' => '', 'weapon_mode' => 'auto', 'weapon_key' => ''];
    }
    return raidlands_db_fetch_one('SELECT outfit_mode, outfit_key, weapon_mode, weapon_key FROM player_podium_profiles WHERE player_id = :player_id', ['player_id' => $player_id])
        ?? ['outfit_mode' => 'auto', 'outfit_key' => '', 'weapon_mode' => 'auto', 'weapon_key' => ''];
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

function raidlands_podium_resolve_player(int $player_id, string $identity): array
{
    $fallback = raidlands_podium_preset_payload(raidlands_podium_default_preset($identity), 'default');
    $fallback['weapon'] = raidlands_podium_default_weapon($identity);
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

function raidlands_podium_resolve_bot(string $identity): array
{
    $payload = raidlands_podium_preset_payload(raidlands_podium_default_preset('bot:' . $identity), 'bot-preset');
    $payload['weapon'] = raidlands_podium_default_weapon('bot:' . $identity);
    return $payload;
}

function raidlands_podium_decorate_leaders(array $leaders, string $board): array
{
    foreach ($leaders as &$leader) {
        $identity = $board === 'bots' ? (string) ($leader['bot_key'] ?? $leader['display_name'] ?? 'bot') : (string) ($leader['steam_id64'] ?? 'player');
        $leader['appearance'] = $board === 'bots'
            ? raidlands_podium_resolve_bot($identity)
            : raidlands_podium_resolve_player((int) ($leader['player_id'] ?? 0), $identity);
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
    return ['profile' => $profile, 'resolved' => raidlands_podium_resolve_player($player_id, $identity), 'presets' => raidlands_podium_presets(), 'weapons' => raidlands_podium_weapons(), 'captured_outfits' => $outfits, 'captured_weapons' => raidlands_podium_captured_weapons($player_id)];
}

function raidlands_podium_save_profile(int $player_id, array $input): void
{
    if (!raidlands_podium_is_ready() || $player_id <= 0) throw new RuntimeException('Podium appearance tables are not installed yet.');
    $outfit_mode = raidlands_podium_clean_key($input['outfit_mode'] ?? 'auto', 16);
    $outfit_key = raidlands_podium_clean_key($input['outfit_key'] ?? '', 96);
    $weapon_mode = raidlands_podium_clean_key($input['weapon_mode'] ?? 'auto', 16);
    $weapon_key = raidlands_podium_clean_key($input['weapon_key'] ?? '', 96);
    if (!in_array($outfit_mode, ['auto', 'preset', 'captured'], true)) throw new InvalidArgumentException('Choose a valid outfit mode.');
    if (!in_array($weapon_mode, ['auto', 'preset', 'captured', 'none'], true)) throw new InvalidArgumentException('Choose a valid weapon mode.');
    if ($outfit_mode === 'preset' && !isset(raidlands_podium_presets()[$outfit_key])) throw new InvalidArgumentException('That podium outfit is unavailable.');
    if ($outfit_mode === 'captured' && raidlands_db_fetch_one('SELECT id FROM player_outfit_observations WHERE player_id = :player_id AND outfit_signature = :signature', ['player_id' => $player_id, 'signature' => $outfit_key]) === null) throw new InvalidArgumentException('That captured outfit does not belong to this player.');
    if ($weapon_mode === 'preset' && !isset(raidlands_podium_weapons()[$weapon_key])) throw new InvalidArgumentException('That podium weapon is unavailable.');
    if ($weapon_mode === 'captured') {
        [$shortname, $skin] = array_pad(explode(':', $weapon_key, 2), 2, '0');
        if (raidlands_db_fetch_one('SELECT id FROM player_weapon_observations WHERE player_id = :player_id AND weapon_shortname = :shortname AND skin_id = :skin_id', ['player_id' => $player_id, 'shortname' => $shortname, 'skin_id' => raidlands_podium_skin_id($skin)]) === null) throw new InvalidArgumentException('That captured weapon does not belong to this player.');
    }
    $statement = raidlands_db_required()->prepare(
        'INSERT INTO player_podium_profiles (player_id, outfit_mode, outfit_key, weapon_mode, weapon_key)
         VALUES (:player_id, :outfit_mode, :outfit_key, :weapon_mode, :weapon_key)
         ON DUPLICATE KEY UPDATE outfit_mode = VALUES(outfit_mode), outfit_key = VALUES(outfit_key), weapon_mode = VALUES(weapon_mode), weapon_key = VALUES(weapon_key), updated_at = NOW()'
    );
    $statement->execute(['player_id' => $player_id, 'outfit_mode' => $outfit_mode, 'outfit_key' => $outfit_key ?: null, 'weapon_mode' => $weapon_mode, 'weapon_key' => $weapon_key ?: null]);
}
