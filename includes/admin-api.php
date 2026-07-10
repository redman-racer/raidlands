<?php

require_once __DIR__ . '/admin.php';

/**
 * Shared guardrails for Raidlands admin-only JSON endpoints.
 */
function raidlands_admin_api_require(
    string $method,
    string $permission = 'admin.airstrike_animations.manage'
): array {
    raidlands_admin_boot();
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');

    $actual_method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $expected_method = strtoupper(trim($method));

    if ($expected_method !== '' && $actual_method !== $expected_method) {
        header('Allow: ' . $expected_method);
        raidlands_admin_api_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

    if (!raidlands_admin_is_authenticated()) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Admin authentication is required.'], 401);
    }

    if ($permission !== '' && !raidlands_admin_can($permission)) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Your admin role cannot perform this action.'], 403);
    }

    return raidlands_admin_current_user() ?? [
        'id' => null,
        'steam_id64' => 'legacy-config-admin',
        'display_name' => 'Setup Admin',
        'permissions' => [$permission],
    ];
}

function raidlands_admin_api_read_json(int $maximum_bytes = 2097152): array
{
    $maximum_bytes = max(1024, min(20971520, $maximum_bytes));
    $content_length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($content_length > $maximum_bytes) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Request body is too large.'], 413);
    }

    $body = file_get_contents('php://input', false, null, 0, $maximum_bytes + 1);

    if (!is_string($body)) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Request body could not be read.'], 400);
    }

    if (strlen($body) > $maximum_bytes) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Request body is too large.'], 413);
    }

    if (trim($body) === '') {
        return [];
    }

    try {
        $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Request body must be valid JSON.'], 400);
    }

    if (!is_array($payload)) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Request body must be a JSON object.'], 400);
    }

    return $payload;
}

function raidlands_admin_api_require_csrf(array $payload = []): void
{
    $token = trim((string) (
        $_SERVER['HTTP_X_RAIDLANDS_ADMIN_CSRF']
        ?? $_SERVER['HTTP_X_CSRF_TOKEN']
        ?? ($payload['csrf'] ?? '')
    ));

    if (!raidlands_admin_validate_csrf($token)) {
        raidlands_admin_api_response(['ok' => false, 'error' => 'Your admin session token expired.'], 419);
    }
}

function raidlands_admin_api_response(array $payload, int $status = 200): void
{
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    raidlands_store_json_response($payload, $status);
}

function raidlands_admin_api_error(Throwable $error): void
{
    $status = 500;

    if ($error instanceof InvalidArgumentException || $error instanceof DomainException) {
        $status = 422;
    } elseif ($error instanceof OutOfBoundsException) {
        $status = 404;
    } elseif ($error instanceof UnexpectedValueException) {
        $status = 409;
    }

    raidlands_admin_api_response([
        'ok' => false,
        'error' => $error->getMessage(),
    ], $status);
}
