<?php

declare(strict_types=1);

function rank_kit_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rank_kit_db(string $database, int $port = 3306): PDO
{
    if (preg_match('/^[a-z0-9_]+$/i', $database) !== 1) {
        throw new InvalidArgumentException('Unsafe validation database name.');
    }

    return new PDO(
        'mysql:host=127.0.0.1;port=' . max(1, min(65535, $port)) . ';dbname=' . $database . ';charset=utf8mb4',
        'root',
        '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
}

function rank_kit_item(array $row, int $position): array
{
    return [
        'position' => $position,
        'shortname' => (string) $row['shortname'],
        'display_name' => $row['display_name'] === null ? null : (string) $row['display_name'],
        'skin' => (int) $row['skin'],
        'amount' => (int) $row['amount'],
        'condition_value' => number_format((float) $row['condition_value'], 2, '.', ''),
        'max_condition' => number_format((float) $row['max_condition'], 2, '.', ''),
        'ammo' => (int) $row['ammo'],
        'ammo_type' => $row['ammo_type'] === null ? null : (string) $row['ammo_type'],
        'frequency' => (int) $row['frequency'],
        'blueprint_shortname' => $row['blueprint_shortname'] === null ? null : (string) $row['blueprint_shortname'],
        'text_value' => $row['text_value'] === null ? null : (string) $row['text_value'],
        'contents_json' => $row['contents_json'] === null ? null : (string) $row['contents_json'],
        'container_json' => $row['container_json'] === null ? null : (string) $row['container_json'],
    ];
}

$target_name = getenv('RAIDLANDS_RANK_TARGET_DB') ?: 'raidlands_10x_repair_validation_20260724_v2';
$baseline_name = getenv('RAIDLANDS_RANK_BASELINE_DB') ?: 'raidlands_10x_repair_validation_20260724';
$source_name = getenv('RAIDLANDS_RANK_SOURCE_DB') ?: 'raidlands_kit_source_20260720';
$target_port = (int) (getenv('RAIDLANDS_RANK_TARGET_DB_PORT') ?: 3306);
$baseline_port = (int) (getenv('RAIDLANDS_RANK_BASELINE_DB_PORT') ?: 3306);
$source_port = (int) (getenv('RAIDLANDS_RANK_SOURCE_DB_PORT') ?: 3306);
$target = rank_kit_db($target_name, $target_port);
$baseline = rank_kit_db($baseline_name, $baseline_port);
$source = rank_kit_db($source_name, $source_port);
$root = dirname(__DIR__);
$expected_hash = '7324e1c5af488c86c3e0a96de0a0d9c4a6a39163ef3bb79c41cf795a69f3e495';

rank_kit_assert(
    hash_file('sha256', $root . '/database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql') === $expected_hash,
    'authoritative July 20 export hash does not match'
);

$map = [
    'vip' => ['id' => 406, 'combat' => 'vip_combat', 'supplies' => 'vip_supplies', 'permission' => 'kits.vip', 'supplies_permission' => 'kits.vip.supplies', 'uses' => 10, 'cooldown' => 3600],
    'vip_plus' => ['id' => 408, 'combat' => 'vip_plus_combat', 'supplies' => 'vip_plus_supplies', 'permission' => 'kits.vipplus', 'supplies_permission' => 'kits.vipplus.supplies', 'uses' => 10, 'cooldown' => 3600],
    'mvp' => ['id' => 410, 'combat' => 'mvp_combat', 'supplies' => 'mvp_supplies', 'permission' => 'kits.mvp', 'supplies_permission' => 'kits.mvp.supplies', 'uses' => 10, 'cooldown' => 3600],
    'golden' => ['id' => 411, 'combat' => 'golden_combat', 'supplies' => 'golden_supplies', 'permission' => 'kits.goldenvip', 'supplies_permission' => 'kits.goldenvip.supplies', 'uses' => 2, 'cooldown' => 259200],
    'ultimate' => ['id' => 412, 'combat' => 'ultimate_combat', 'supplies' => 'ultimate_supplies', 'permission' => 'kits.ultimatevip', 'supplies_permission' => 'kits.ultimatevip.supplies', 'uses' => 2, 'cooldown' => 259200],
    'titan' => ['id' => 413, 'combat' => 'titan_combat', 'supplies' => 'titan_supplies', 'permission' => 'kits.titanvip', 'supplies_permission' => 'kits.titanvip.supplies', 'uses' => 2, 'cooldown' => 259200],
];
$supply_shortnames = [
    'ammo.rocket.sam',
    'electric.generator.small',
    'samsite',
    'autoturret',
    'supply.signal',
    'grenade.smoke',
    'metal.refined',
    'cloth',
    'scrap',
];
$boom = ['ammo.rocket.basic', 'explosive.timed', 'ammo.rifle.explosive'];
$materials = [
    'vip' => ['sulfur' => 500000, 'charcoal' => 645000, 'metal.fragments' => 70000, 'lowgradefuel' => 6000, 'metalpipe' => 200, 'cloth' => 250, 'techparts' => 100],
    'vip_plus' => ['sulfur' => 1200000, 'charcoal' => 1575000, 'metal.fragments' => 150000, 'lowgradefuel' => 15000, 'metalpipe' => 1000],
    'mvp' => ['sulfur' => 2425000, 'charcoal' => 3225000, 'metal.fragments' => 275000, 'lowgradefuel' => 45000, 'metalpipe' => 1000, 'cloth' => 2500, 'techparts' => 1000],
    'golden' => ['sulfur' => 20500000, 'charcoal' => 27750000, 'metal.fragments' => 2000000, 'lowgradefuel' => 450000, 'metalpipe' => 10000, 'cloth' => 25000, 'techparts' => 10000],
    'ultimate' => ['sulfur' => 66000000, 'charcoal' => 90000000, 'metal.fragments' => 6000000, 'lowgradefuel' => 1500000, 'metalpipe' => 40000, 'cloth' => 75000, 'techparts' => 30000],
    'titan' => ['sulfur' => 332500000, 'charcoal' => 457500000, 'metal.fragments' => 27500000, 'lowgradefuel' => 7500000, 'metalpipe' => 300000, 'cloth' => 1250000, 'techparts' => 100000],
];

$source_rows = $source->query(
    "SELECT
       kits.kit_name AS tier,
       items.*
     FROM game_kits kits
     INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name IN ('vip', 'vip_plus', 'mvp', 'golden', 'ultimate', 'titan')
     ORDER BY FIELD(kits.kit_name, 'vip', 'vip_plus', 'mvp', 'golden', 'ultimate', 'titan'),
              FIELD(items.container_name, 'main', 'wear', 'belt'),
              items.position,
              items.id"
)->fetchAll();
rank_kit_assert(count($source_rows) === 188, 'authoritative source row count changed');

$expected = [];

foreach ($source_rows as $row) {
    $tier = (string) $row['tier'];
    $shortname = (string) $row['shortname'];

    if (in_array($shortname, $boom, true) || ($tier === 'titan' && $shortname === 'cloth')) {
        continue;
    }

    $is_supply = $row['container_name'] === 'main' && in_array($shortname, $supply_shortnames, true);
    $kit_name = $map[$tier][$is_supply ? 'supplies' : 'combat'];
    $container = $is_supply ? 'main' : (string) $row['container_name'];
    $key = $kit_name . ':' . $container;
    $expected[$key] ??= [];
    $expected[$key][] = rank_kit_item($row, count($expected[$key]));
}

foreach ($materials as $tier => $rows) {
    $key = $map[$tier]['supplies'] . ':main';
    $expected[$key] ??= [];

    foreach ($rows as $shortname => $amount) {
        $expected[$key][] = rank_kit_item([
            'shortname' => $shortname,
            'display_name' => null,
            'skin' => 0,
            'amount' => $amount,
            'condition_value' => 0,
            'max_condition' => 0,
            'ammo' => 0,
            'ammo_type' => null,
            'frequency' => -1,
            'blueprint_shortname' => null,
            'text_value' => null,
            'contents_json' => null,
            'container_json' => null,
        ], count($expected[$key]));
    }
}

$target_rows = $target->query(
    "SELECT kits.kit_name, items.*
     FROM game_kits kits
     INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name IN (
       'vip_combat', 'vip_supplies',
       'vip_plus_combat', 'vip_plus_supplies',
       'mvp_combat', 'mvp_supplies',
       'golden_combat', 'golden_supplies',
       'ultimate_combat', 'ultimate_supplies',
       'titan_combat', 'titan_supplies'
     )
     ORDER BY kits.sort_order, kits.id, FIELD(items.container_name, 'main', 'wear', 'belt'), items.position"
)->fetchAll();
$actual = [];

foreach ($target_rows as $row) {
    $key = $row['kit_name'] . ':' . $row['container_name'];
    $actual[$key] ??= [];
    $actual[$key][] = rank_kit_item($row, (int) $row['position']);
}

ksort($expected);
ksort($actual);
rank_kit_assert($actual === $expected, 'split kit rows drift from the exact July 20 source plus approved material conversion');

foreach ($map as $tier => $kit) {
    $statement = $target->prepare(
        'SELECT id, kit_name, previous_kit_name, required_permission, maximum_uses, cooldown_seconds, reward_enabled, reward_product_id
         FROM game_kits WHERE kit_name IN (:combat, :supplies) ORDER BY kit_name'
    );
    $statement->execute(['combat' => $kit['combat'], 'supplies' => $kit['supplies']]);
    $rows = $statement->fetchAll();
    rank_kit_assert(count($rows) === 2, $tier . ' does not have exactly two split kits');

    foreach ($rows as $row) {
        $combat = $row['kit_name'] === $kit['combat'];
        rank_kit_assert(!$combat || (int) $row['id'] === $kit['id'], $tier . ' combat ID changed');
        rank_kit_assert(!$combat || $row['previous_kit_name'] === $tier, $tier . ' rename alias is missing');
        rank_kit_assert($row['required_permission'] === $kit[$combat ? 'permission' : 'supplies_permission'], $tier . ' permission drift');
        rank_kit_assert((int) $row['maximum_uses'] === $kit['uses'], $tier . ' use limit drift');
        rank_kit_assert((int) $row['cooldown_seconds'] === $kit['cooldown'], $tier . ' cooldown drift');
        rank_kit_assert((int) $row['reward_enabled'] === 0, $tier . ' rank reward product is enabled');
        rank_kit_assert(!$combat || (int) $row['reward_product_id'] > 0, $tier . ' reward audit metadata was lost');
    }
}

$capacity_statement = $target->query(
    "SELECT kits.kit_name, items.container_name, COUNT(*) AS total, MIN(items.position) AS min_position, MAX(items.position) AS max_position
     FROM game_kits kits
     INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name LIKE '%_combat' OR kits.kit_name LIKE '%_supplies'
     GROUP BY kits.kit_name, items.container_name"
);

foreach ($capacity_statement->fetchAll() as $row) {
    $capacity = ['main' => 24, 'wear' => 8, 'belt' => 6][$row['container_name']];
    rank_kit_assert((int) $row['total'] <= $capacity, $row['kit_name'] . ' exceeds ' . $row['container_name'] . ' capacity');
    rank_kit_assert((int) $row['min_position'] === 0, $row['kit_name'] . ' has a position gap at the start');
    rank_kit_assert((int) $row['max_position'] === (int) $row['total'] - 1, $row['kit_name'] . ' positions are not compact');
}

$boom_count = (int) $target->query(
    "SELECT COUNT(*)
     FROM game_kits kits
     INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE (kits.kit_name LIKE '%_combat' OR kits.kit_name LIKE '%_supplies')
       AND items.shortname IN ('ammo.rocket.basic', 'explosive.timed', 'ammo.rifle.explosive')"
)->fetchColumn();
rank_kit_assert($boom_count === 0, 'a removed direct-boom item remains in a split kit');

$permission_rows = $target->query(
    "SELECT rank_groups.group_name, permissions.permission_name
     FROM oxide_groups rank_groups
     INNER JOIN oxide_group_permission_grants grants ON grants.group_id = rank_groups.id
     INNER JOIN oxide_permissions permissions ON permissions.id = grants.permission_id
     WHERE permissions.permission_name LIKE 'kits.%.supplies'
     ORDER BY rank_groups.group_name, permissions.permission_name"
)->fetchAll(PDO::FETCH_NUM);
$expected_permissions = [
    ['rank_diamond_vip', 'kits.goldenvip.supplies'],
    ['rank_diamond_vip', 'kits.vip.supplies'],
    ['rank_diamond_vip', 'kits.vipplus.supplies'],
    ['rank_golden_vip', 'kits.goldenvip.supplies'],
    ['rank_mvp', 'kits.mvp.supplies'],
    ['rank_titan_vip', 'kits.titanvip.supplies'],
    ['rank_ultimate_vip', 'kits.ultimatevip.supplies'],
    ['rank_vip', 'kits.vip.supplies'],
    ['rank_vip_plus', 'kits.vipplus.supplies'],
];
rank_kit_assert($permission_rows === $expected_permissions, 'Supplies permission grants do not match the rank and Diamond design');

$combat_permission_rows = $target->query(
    "SELECT rank_groups.group_name, permissions.permission_name
     FROM oxide_groups rank_groups
     INNER JOIN oxide_group_permission_grants grants ON grants.group_id = rank_groups.id
     INNER JOIN oxide_permissions permissions ON permissions.id = grants.permission_id
     WHERE permissions.permission_name IN (
       'kits.vip',
       'kits.vipplus',
       'kits.mvp',
       'kits.goldenvip',
       'kits.ultimatevip',
       'kits.titanvip'
     )
       AND rank_groups.group_name IN (
         'rank_vip',
         'rank_vip_plus',
         'rank_mvp',
         'rank_golden_vip',
         'rank_diamond_vip',
         'rank_ultimate_vip',
         'rank_titan_vip'
       )
     ORDER BY rank_groups.group_name, permissions.permission_name"
)->fetchAll(PDO::FETCH_NUM);
$expected_combat_permissions = [
    ['rank_diamond_vip', 'kits.goldenvip'],
    ['rank_diamond_vip', 'kits.vip'],
    ['rank_diamond_vip', 'kits.vipplus'],
    ['rank_golden_vip', 'kits.goldenvip'],
    ['rank_mvp', 'kits.mvp'],
    ['rank_titan_vip', 'kits.titanvip'],
    ['rank_ultimate_vip', 'kits.ultimatevip'],
    ['rank_vip', 'kits.vip'],
    ['rank_vip_plus', 'kits.vipplus'],
];
rank_kit_assert($combat_permission_rows === $expected_combat_permissions, 'Combat permission grants do not match the rank and Diamond design');

$sync = $target->query(
    "SELECT revision, status, payload_json, payload_hash
     FROM game_kit_sync_log
     WHERE payload_json IS NOT NULL
     ORDER BY id DESC LIMIT 1"
)->fetch();
$payload = json_decode((string) $sync['payload_json'], true, 512, JSON_THROW_ON_ERROR);
rank_kit_assert($sync['status'] === 'pending', 'rank-kit payload is not pending');
rank_kit_assert(count((array) $payload['kits']) === 12, 'rank-kit payload does not contain exactly twelve kits');
rank_kit_assert((array) $payload['server_rewards_kits'] === [], 'rank RP products leaked into ServerRewards payload');
rank_kit_assert(hash('sha256', (string) $sync['payload_json']) === $sync['payload_hash'], 'stored rank-kit payload hash is invalid');

$history_tables = [
    'clan_members',
    'entitlements',
    'orders',
    'player_api_keys',
    'player_group_assignments',
    'player_leaderboard_stats',
    'player_outfit_observations',
    'player_podium_profiles',
    'player_weapon_observations',
    'player_wipe_stats',
    'players',
    'rp_purchase_requests',
    'server_player_location_history',
    'server_player_locations',
    'store_prices',
    'store_products',
];

foreach ($history_tables as $table) {
    $baseline_count = (int) $baseline->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn();
    $target_count = (int) $target->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn();
    rank_kit_assert($target_count === $baseline_count, $table . ' row count changed');
}

$foreign_key_sql = static function (string $database): string {
    return "SELECT
       rc.TABLE_NAME,
       rc.CONSTRAINT_NAME,
       rc.REFERENCED_TABLE_NAME,
       rc.UPDATE_RULE,
       rc.DELETE_RULE,
       kcu.COLUMN_NAME,
       kcu.REFERENCED_COLUMN_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS rc
     INNER JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      AND kcu.TABLE_NAME = rc.TABLE_NAME
      AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
     WHERE rc.CONSTRAINT_SCHEMA = " . rank_kit_db_quote($database) . "
     ORDER BY rc.TABLE_NAME, rc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION";
};

function rank_kit_db_quote(string $value): string
{
    return "'" . str_replace("'", "''", $value) . "'";
}

rank_kit_assert(
    $baseline->query($foreign_key_sql($baseline_name))->fetchAll(PDO::FETCH_NUM)
        === $target->query($foreign_key_sql($target_name))->fetchAll(PDO::FETCH_NUM),
    'foreign-key definitions changed'
);

echo "Rank-kit restore integration checks passed for {$target_name}.\n";

if (!in_array('--flow', $argv, true)) {
    exit(0);
}

require $root . '/includes/bootstrap.php';
$database_config = [
    'dsn' => 'mysql:host=127.0.0.1;port=' . $target_port . ';dbname=' . $target_name . ';charset=utf8mb4',
    'username' => 'root',
    'password' => '',
    'options' => [],
];
require_once $root . '/includes/kits.php';

$before_titan = $target->query(
    "SELECT SHA2(GROUP_CONCAT(CONCAT_WS('|', items.container_name, items.position, items.shortname, items.amount, items.condition_value, items.max_condition, items.ammo, COALESCE(items.ammo_type, '')) ORDER BY FIELD(items.container_name, 'main', 'wear', 'belt'), items.position SEPARATOR ';'), 256)
     FROM game_kits kits INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name = 'titan_combat'"
)->fetchColumn();
$stale_result = raidlands_kits_import_snapshot([
    'kits_data' => [
        '_kits' => [
            'titan' => [
                'Name' => 'titan',
                'RequiredPermission' => 'kits.titanvip',
                'MaximumUses' => 1,
                'Cooldown' => 1,
                'MainItems' => [
                    ['Shortname' => 'ammo.rocket.basic', 'Amount' => 1, 'Position' => 0],
                ],
            ],
        ],
    ],
    'server_rewards_kits' => [
        ['KitName' => 'titan', 'ID' => 1411, 'DisplayName' => 'Stale Titan RP Kit', 'Cost' => 1],
    ],
]);
rank_kit_assert((int) $stale_result['imported'] === 0, 'pending alias was overwritten by a stale snapshot');
$after_stale = $target->query(
    "SELECT SHA2(GROUP_CONCAT(CONCAT_WS('|', items.container_name, items.position, items.shortname, items.amount, items.condition_value, items.max_condition, items.ammo, COALESCE(items.ammo_type, '')) ORDER BY FIELD(items.container_name, 'main', 'wear', 'belt'), items.position SEPARATOR ';'), 256)
     FROM game_kits kits INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name = 'titan_combat'"
)->fetchColumn();
rank_kit_assert($after_stale === $before_titan, 'stale snapshot changed pending Titan Combat items');

$pending_sync = $target->query(
    "SELECT revision, payload_json, payload_hash FROM game_kit_sync_log
     WHERE status = 'pending' AND payload_json IS NOT NULL
     ORDER BY id DESC LIMIT 1"
)->fetch();
$pending_payload = json_decode((string) $pending_sync['payload_json'], true, 512, JSON_THROW_ON_ERROR);
raidlands_kits_record_sync_result([
    'revision' => (int) $pending_sync['revision'],
    'status' => 'applied',
    'payload_hash' => (string) $pending_sync['payload_hash'],
    'message' => 'Integration test acknowledgement.',
]);

$titan_payload = null;
foreach ((array) $pending_payload['kits'] as $kit) {
    if (($kit['Name'] ?? '') === 'titan_combat') {
        $titan_payload = $kit;
        break;
    }
}
rank_kit_assert(is_array($titan_payload), 'pending payload is missing Titan Combat');
$fresh_result = raidlands_kits_import_snapshot([
    'kits_data' => ['_kits' => ['titan_combat' => $titan_payload]],
    'server_rewards_kits' => [],
]);
rank_kit_assert((int) $fresh_result['imported'] === 1, 'acknowledged Titan Combat snapshot did not resume');
$after_round_trip = $target->query(
    "SELECT SHA2(GROUP_CONCAT(CONCAT_WS('|', items.container_name, items.position, items.shortname, items.amount, items.condition_value, items.max_condition, items.ammo, COALESCE(items.ammo_type, '')) ORDER BY FIELD(items.container_name, 'main', 'wear', 'belt'), items.position SEPARATOR ';'), 256)
     FROM game_kits kits INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name = 'titan_combat'"
)->fetchColumn();
rank_kit_assert($after_round_trip === $before_titan, 'acknowledged Titan Combat round trip drifted');
rank_kit_assert(
    (int) $target->query("SELECT reward_enabled FROM game_kits WHERE kit_name = 'titan_combat'")->fetchColumn() === 0,
    'round-trip snapshot re-enabled Titan ServerRewards product'
);

echo "Pending snapshot, acknowledgement, and round-trip flow checks passed.\n";
