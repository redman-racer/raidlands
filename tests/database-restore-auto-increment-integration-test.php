<?php

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/database.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function database_restore_id_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

$pdo = raidlands_db_required();
$suffix = strtolower(bin2hex(random_bytes(4)));
$parent_table = 'db_ai_parent_' . $suffix;
$child_table = 'db_ai_child_' . $suffix;
$unkeyed_table = 'db_ai_unkeyed_' . $suffix;
$quoted_parent = '`' . $parent_table . '`';
$quoted_child = '`' . $child_table . '`';
$quoted_unkeyed = '`' . $unkeyed_table . '`';
$test_error = null;

try {
    $pdo->exec(
        "CREATE TABLE $quoted_parent (
            id BIGINT UNSIGNED NOT NULL,
            label VARCHAR(40) NOT NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB"
    );
    $pdo->exec(
        "CREATE TABLE $quoted_child (
            id BIGINT UNSIGNED NOT NULL,
            parent_id BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_db_ai_child_$suffix
                FOREIGN KEY (parent_id) REFERENCES $quoted_parent (id) ON DELETE CASCADE
        ) ENGINE=InnoDB"
    );
    $pdo->exec(
        "CREATE TABLE $quoted_unkeyed (
            id BIGINT UNSIGNED NOT NULL,
            label VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB"
    );
    $pdo->exec("INSERT INTO $quoted_parent (id, label) VALUES (0, 'restored parent')");
    $pdo->exec("INSERT INTO $quoted_child (id, parent_id) VALUES (0, 0)");
    $pdo->exec("INSERT INTO $quoted_unkeyed (id, label) VALUES (8, 'restored row')");

    $failures = raidlands_db_repair_restored_auto_increment_ids(
        $pdo,
        [$parent_table, $child_table, $unkeyed_table]
    );
    database_restore_id_assert($failures === [], 'required restored tables repair without failures');

    foreach ([$parent_table, $child_table, $unkeyed_table] as $table_name) {
        $statement = $pdo->prepare(
            'SELECT COLUMN_KEY, EXTRA
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = "id"'
        );
        $statement->execute(['table_name' => $table_name]);
        $column = $statement->fetch(PDO::FETCH_ASSOC);
        database_restore_id_assert(strtoupper((string) ($column['COLUMN_KEY'] ?? '')) === 'PRI', $table_name . ' has a primary ID');
        database_restore_id_assert(
            stripos((string) ($column['EXTRA'] ?? ''), 'auto_increment') !== false,
            $table_name . ' has an automatic ID'
        );
    }

    database_restore_id_assert(
        (int) $pdo->query("SELECT parent_id FROM $quoted_child WHERE id = 0")->fetchColumn() === 0,
        'existing ID 0 foreign-key relationship is preserved'
    );
    $pdo->exec("INSERT INTO $quoted_parent (label) VALUES ('new parent')");
    database_restore_id_assert((int) $pdo->lastInsertId() > 0, 'new rows receive positive IDs');
} catch (Throwable $error) {
    $test_error = $error;
} finally {
    try {
        $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');
        $pdo->exec("DROP TABLE IF EXISTS $quoted_child");
        $pdo->exec("DROP TABLE IF EXISTS $quoted_parent");
        $pdo->exec("DROP TABLE IF EXISTS $quoted_unkeyed");
        $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 1');
    } catch (Throwable $cleanup_error) {
        $test_error ??= $cleanup_error;
    }
}

if ($test_error instanceof Throwable) {
    throw $test_error;
}

echo "Database restore auto-increment integration tests passed.\n";
