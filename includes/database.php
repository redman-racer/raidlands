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
            $message = 'MySQL is not configured. Add database credentials to data/raidlands-secrets.php.';
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
