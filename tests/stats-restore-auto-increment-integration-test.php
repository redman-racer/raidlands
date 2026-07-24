<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/stats.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function stats_restore_auto_increment_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

$pdo = raidlands_db_required();
$suffix = strtolower(bin2hex(random_bytes(4)));
$parent_table = 'stats_ai_parent_' . $suffix;
$child_table = 'stats_ai_child_' . $suffix;
$quoted_parent = '`' . $parent_table . '`';
$quoted_child = '`' . $child_table . '`';
$original_sql_mode = (string) $pdo->query('SELECT @@SESSION.sql_mode')->fetchColumn();
$original_foreign_key_checks = (int) $pdo->query('SELECT @@SESSION.FOREIGN_KEY_CHECKS')->fetchColumn();
$test_error = null;

try {
    $pdo->exec(
        "CREATE TABLE $quoted_parent (
            id BIGINT UNSIGNED NOT NULL,
            steam_id64 VARCHAR(32) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_stats_ai_parent_steam (steam_id64)
        ) ENGINE=InnoDB"
    );
    $pdo->exec(
        "CREATE TABLE $quoted_child (
            id BIGINT UNSIGNED NOT NULL,
            player_id BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_stats_ai_child_$suffix
                FOREIGN KEY (player_id) REFERENCES $quoted_parent (id) ON DELETE CASCADE
        ) ENGINE=InnoDB"
    );
    $pdo->exec(
        "INSERT INTO $quoted_parent (id, steam_id64)
         VALUES (0, '76561190000000000'), (5, '76561190000000005')"
    );
    $pdo->exec("INSERT INTO $quoted_child (id, player_id) VALUES (0, 0)");

    raidlands_stats_restore_auto_increment_tables($pdo, [$parent_table, $child_table]);

    $columns = $pdo->query(
        "SELECT TABLE_NAME, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN (" . $pdo->quote($parent_table) . ', ' . $pdo->quote($child_table) . ")
           AND COLUMN_NAME = 'id'
         ORDER BY TABLE_NAME"
    )->fetchAll(PDO::FETCH_ASSOC);
    stats_restore_auto_increment_assert(count($columns) === 2, 'both restored ID columns are present');

    foreach ($columns as $column) {
        stats_restore_auto_increment_assert(
            stripos((string) ($column['EXTRA'] ?? ''), 'auto_increment') !== false,
            (string) $column['TABLE_NAME'] . ' regains auto-increment'
        );
    }

    $zero_parent = $pdo->query("SELECT steam_id64 FROM $quoted_parent WHERE id = 0")->fetchColumn();
    $zero_child = $pdo->query("SELECT player_id FROM $quoted_child WHERE id = 0")->fetchColumn();
    stats_restore_auto_increment_assert($zero_parent === '76561190000000000', 'existing parent ID 0 is preserved');
    stats_restore_auto_increment_assert((int) $zero_child === 0, 'existing child ID and player reference 0 are preserved');

    $pdo->exec("INSERT INTO $quoted_parent (steam_id64) VALUES ('76561190000000006')");
    $new_parent_id = (int) $pdo->lastInsertId();
    stats_restore_auto_increment_assert($new_parent_id > 5, 'new parent receives a positive automatic ID');

    $pdo->exec("INSERT INTO $quoted_child (player_id) VALUES ($new_parent_id)");
    $new_child_id = (int) $pdo->lastInsertId();
    stats_restore_auto_increment_assert($new_child_id > 0, 'new child receives a positive automatic ID');

    $orphan_count = (int) $pdo->query(
        "SELECT COUNT(*)
         FROM $quoted_child child_row
         LEFT JOIN $quoted_parent parent_row ON parent_row.id = child_row.player_id
         WHERE parent_row.id IS NULL"
    )->fetchColumn();
    stats_restore_auto_increment_assert($orphan_count === 0, 'schema repair does not orphan foreign-key rows');
} catch (Throwable $error) {
    $test_error = $error;
} finally {
    try {
        $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 1');
        $pdo->exec("DROP TABLE IF EXISTS $quoted_child");
        $pdo->exec("DROP TABLE IF EXISTS $quoted_parent");
    } catch (Throwable $cleanup_error) {
        $test_error ??= $cleanup_error;
    }

    try {
        $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = ' . ($original_foreign_key_checks === 0 ? '0' : '1'));
        $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote($original_sql_mode));
    } catch (Throwable $restore_error) {
        $test_error ??= $restore_error;
    }
}

if ($test_error instanceof Throwable) {
    throw $test_error;
}

echo "Stats restore auto-increment integration tests passed.\n";
