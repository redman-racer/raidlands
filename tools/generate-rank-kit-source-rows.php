<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$source_export = $root . '/database/exports/7-20-26-0115/raiduonz_website (7-20-26-0115).sql';
$migration = $root . '/database/migrations/076_rank_kit_restore_split.sql';
$expected_hash = '7324e1c5af488c86c3e0a96de0a0d9c4a6a39163ef3bb79c41cf795a69f3e495';

if (!is_file($source_export) || hash_file('sha256', $source_export) !== $expected_hash) {
    throw new RuntimeException('The authoritative July 20 export is missing or its SHA-256 does not match.');
}

$pdo = new PDO(
    'mysql:host=127.0.0.1;dbname=raidlands_kit_source_20260720;charset=utf8mb4',
    'root',
    '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$rows = $pdo->query(
    "SELECT
       kits.kit_name AS tier,
       items.container_name,
       items.position AS source_position,
       items.shortname,
       items.display_name,
       items.skin,
       items.amount,
       items.condition_value,
       items.max_condition,
       items.ammo,
       items.ammo_type,
       items.frequency,
       items.blueprint_shortname,
       items.text_value,
       items.contents_json,
       items.container_json,
       items.sort_order AS source_sort_order
     FROM game_kits kits
     INNER JOIN game_kit_items items ON items.kit_id = kits.id
     WHERE kits.kit_name IN ('vip', 'vip_plus', 'mvp', 'golden', 'ultimate', 'titan')
     ORDER BY FIELD(kits.kit_name, 'vip', 'vip_plus', 'mvp', 'golden', 'ultimate', 'titan'),
              FIELD(items.container_name, 'main', 'wear', 'belt'),
              items.position,
              items.id"
)->fetchAll(PDO::FETCH_ASSOC);

if (count($rows) !== 188) {
    throw new RuntimeException('Expected 188 authoritative rank-kit item rows; found ' . count($rows) . '.');
}

$quote = static function ($value): string {
    if ($value === null || $value === '') {
        return 'NULL';
    }

    return "'" . str_replace(["\\", "'"], ["\\\\", "''"], (string) $value) . "'";
};
$numeric = static fn ($value): string => is_numeric($value) ? (string) $value : '0';
$values = [];

foreach ($rows as $row) {
    $values[] = '  (' . implode(', ', [
        $quote($row['tier']),
        $quote($row['container_name']),
        $numeric($row['source_position']),
        $quote($row['shortname']),
        $quote($row['display_name']),
        $numeric($row['skin']),
        $numeric($row['amount']),
        $numeric($row['condition_value']),
        $numeric($row['max_condition']),
        $numeric($row['ammo']),
        $quote($row['ammo_type']),
        $numeric($row['frequency']),
        $quote($row['blueprint_shortname']),
        $quote($row['text_value']),
        $quote($row['contents_json']),
        $quote($row['container_json']),
        $numeric($row['source_sort_order']),
    ]) . ')';
}

$insert = "INSERT INTO tmp_raidlands_rank_source_items\n"
    . "  (tier, container_name, source_position, shortname, display_name, skin, amount, condition_value, max_condition, ammo, ammo_type, frequency, blueprint_shortname, text_value, contents_json, container_json, source_sort_order)\n"
    . "VALUES\n"
    . implode(",\n", $values)
    . ";\n";
$sql = file_get_contents($migration);

if ($sql === false) {
    throw new RuntimeException('Could not read migration 076.');
}

$pattern = '/(-- BEGIN GENERATED JULY 20 SOURCE ROWS\\R).*?(-- END GENERATED JULY 20 SOURCE ROWS)/s';
$replacement = '$1' . str_replace('$', '\\$', $insert) . '$2';
$updated = preg_replace($pattern, $replacement, $sql, 1, $replacements);

if ($updated === null || $replacements !== 1) {
    throw new RuntimeException('Could not locate the generated source-row block in migration 076.');
}

file_put_contents($migration, $updated);
echo 'Generated ' . count($rows) . " July 20 source rows in migration 076.\n";
