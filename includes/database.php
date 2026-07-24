<?php

function raidlands_db_is_configured(): bool
{
    global $database_config;

    return trim((string) ($database_config['dsn'] ?? '')) !== '';
}

function raidlands_db(): ?PDO
{
    static $pdo = null;
    static $attempted = false;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if ($attempted || !raidlands_db_is_configured()) {
        return null;
    }

    $attempted = true;

    try {
        global $database_config;

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        foreach ((array) ($database_config['options'] ?? []) as $key => $value) {
            $options[$key] = $value;
        }

        $pdo = new PDO(
            (string) $database_config['dsn'],
            (string) ($database_config['username'] ?? ''),
            (string) ($database_config['password'] ?? ''),
            $options
        );

        return $pdo;
    } catch (Throwable $error) {
        raidlands_db_last_error($error->getMessage());
        return null;
    }
}

function raidlands_db_required(): PDO
{
    $pdo = raidlands_db();

    if (!$pdo instanceof PDO) {
        $message = raidlands_db_last_error();

        if ($message === '') {
            $message = 'Database credentials are not configured.';
        }

        throw new RuntimeException($message);
    }

    return $pdo;
}

function raidlands_db_last_error(?string $message = null): string
{
    static $last_error = '';

    if ($message !== null) {
        $last_error = $message;
    }

    return $last_error;
}

function raidlands_db_repair_restored_auto_increment_ids(PDO $pdo, array $priority_tables = []): array
{
    static $verified = false;

    if ($verified) {
        return [];
    }

    $priority_tables = array_values(array_unique(array_filter(
        array_map('strval', $priority_tables),
        static fn(string $table_name): bool => preg_match('/^[a-zA-Z0-9_]+$/', $table_name) === 1
    )));
    $ignored_tables = ['rp_game_settings' => true];
    $load_schema = static function () use ($pdo, $ignored_tables): array {
        $columns = [];
        $column_statement = $pdo->query(
            'SELECT TABLE_NAME, COLUMN_TYPE, IS_NULLABLE, EXTRA
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND COLUMN_NAME = "id"
               AND DATA_TYPE IN ("tinyint", "smallint", "mediumint", "int", "bigint")'
        );

        foreach ($column_statement->fetchAll(PDO::FETCH_ASSOC) as $column) {
            $table_name = (string) $column['TABLE_NAME'];
            if (!isset($ignored_tables[$table_name])) {
                $columns[$table_name] = $column;
            }
        }

        $primary_indexes = [];
        $index_statement = $pdo->query(
            'SELECT TABLE_NAME, SEQ_IN_INDEX, COLUMN_NAME
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND INDEX_NAME = "PRIMARY"
             ORDER BY TABLE_NAME, SEQ_IN_INDEX'
        );

        foreach ($index_statement->fetchAll(PDO::FETCH_ASSOC) as $index) {
            $primary_indexes[(string) $index['TABLE_NAME']][] = (string) $index['COLUMN_NAME'];
        }

        return [$columns, $primary_indexes];
    };
    $find_repairs = static function (array $columns, array $primary_indexes): array {
        $repairs = [];

        foreach ($columns as $table_name => $column) {
            $primary_columns = $primary_indexes[$table_name] ?? [];
            if (
                stripos((string) ($column['EXTRA'] ?? ''), 'auto_increment') === false
                || $primary_columns !== ['id']
            ) {
                $repairs[] = $table_name;
            }
        }

        return $repairs;
    };

    [$columns, $primary_indexes] = $load_schema();
    $repair_tables = $find_repairs($columns, $primary_indexes);
    if ($repair_tables === []) {
        $verified = true;
        return [];
    }

    $priority_rank = array_flip($priority_tables);
    usort($repair_tables, static function (string $left, string $right) use ($priority_rank): int {
        $left_rank = $priority_rank[$left] ?? PHP_INT_MAX;
        $right_rank = $priority_rank[$right] ?? PHP_INT_MAX;

        return $left_rank === $right_rank ? strcmp($left, $right) : $left_rank <=> $right_rank;
    });

    $lock_name = 'raidlands_restore_all_auto_increment_ids';
    $lock_statement = $pdo->prepare('SELECT GET_LOCK(:lock_name, 20)');
    $lock_statement->execute(['lock_name' => $lock_name]);

    if ((int) $lock_statement->fetchColumn() !== 1) {
        throw new RuntimeException('Timed out while waiting to repair restored database IDs.');
    }

    $failures = [];

    try {
        [$columns, $primary_indexes] = $load_schema();
        $repair_tables = $find_repairs($columns, $primary_indexes);
        usort($repair_tables, static function (string $left, string $right) use ($priority_rank): int {
            $left_rank = $priority_rank[$left] ?? PHP_INT_MAX;
            $right_rank = $priority_rank[$right] ?? PHP_INT_MAX;

            return $left_rank === $right_rank ? strcmp($left, $right) : $left_rank <=> $right_rank;
        });

        $original_sql_mode = (string) $pdo->query('SELECT @@SESSION.sql_mode')->fetchColumn();
        $original_foreign_key_checks = (int) $pdo->query('SELECT @@SESSION.FOREIGN_KEY_CHECKS')->fetchColumn();
        $sql_modes = array_values(array_filter(array_map('trim', explode(',', $original_sql_mode))));

        if (!in_array('NO_AUTO_VALUE_ON_ZERO', array_map('strtoupper', $sql_modes), true)) {
            $sql_modes[] = 'NO_AUTO_VALUE_ON_ZERO';
        }

        try {
            $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote(implode(',', $sql_modes)));
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');

            foreach ($repair_tables as $table_name) {
                $column = $columns[$table_name] ?? null;
                $column_type = strtolower(trim((string) ($column['COLUMN_TYPE'] ?? '')));
                $primary_columns = $primary_indexes[$table_name] ?? [];

                if (
                    !is_array($column)
                    || strtoupper((string) ($column['IS_NULLABLE'] ?? '')) !== 'NO'
                    || preg_match('/^(?:tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?(?: unsigned)?$/', $column_type) !== 1
                    || ($primary_columns !== [] && $primary_columns !== ['id'])
                ) {
                    $failures[$table_name] = 'unexpected ID or primary-key definition';
                    continue;
                }

                $alterations = [];
                if ($primary_columns === []) {
                    $alterations[] = 'ADD PRIMARY KEY (`id`)';
                }
                if (stripos((string) ($column['EXTRA'] ?? ''), 'auto_increment') === false) {
                    $alterations[] = 'MODIFY COLUMN `id` ' . $column_type . ' NOT NULL AUTO_INCREMENT';
                }

                try {
                    $pdo->exec(
                        'ALTER TABLE `' . str_replace('`', '``', $table_name) . '` '
                        . implode(', ', $alterations)
                    );
                } catch (Throwable $error) {
                    $failures[$table_name] = $error->getMessage();
                }
            }
        } finally {
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = ' . ($original_foreign_key_checks === 0 ? '0' : '1'));
            $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote($original_sql_mode));
        }

        $required_failures = array_intersect_key($failures, array_fill_keys($priority_tables, true));
        if ($required_failures !== []) {
            $table_name = (string) array_key_first($required_failures);
            throw new RuntimeException(
                'The website could not repair restored IDs for ' . $table_name . ': ' . $required_failures[$table_name]
            );
        }

        if ($failures === []) {
            $verified = true;
        }
    } finally {
        $release_statement = $pdo->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $release_statement->execute(['lock_name' => $lock_name]);
    }

    return $failures;
}

function raidlands_db_fetch_all(string $sql, array $params = []): array
{
    $statement = raidlands_db_required()->prepare($sql);
    $statement->execute($params);

    return $statement->fetchAll();
}

function raidlands_db_fetch_one(string $sql, array $params = []): ?array
{
    $statement = raidlands_db_required()->prepare($sql);
    $statement->execute($params);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function raidlands_db_execute(string $sql, array $params = []): int
{
    $statement = raidlands_db_required()->prepare($sql);
    $statement->execute($params);

    return $statement->rowCount();
}
