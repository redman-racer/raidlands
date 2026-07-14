<?php

require_once dirname(__DIR__) . '/includes/config.php';
require_once dirname(__DIR__) . '/includes/database.php';
require_once dirname(__DIR__) . '/includes/store.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$admin = raidlands_db_fetch_one(
    'SELECT DISTINCT au.steam_id64, au.display_name
     FROM admin_users au
     INNER JOIN admin_user_roles aur ON aur.admin_user_id = au.id
     INNER JOIN admin_roles ar ON ar.id = aur.role_id
     WHERE au.is_active = 1 AND ar.slug IN ("owner", "administrator")
     LIMIT 1'
);

if ($admin === null) {
    fwrite(STDERR, "No active owner or administrator is available for the render smoke.\n");
    exit(1);
}

raidlands_store_boot();
$_SESSION['raidlands_player'] = array_merge($admin, raidlands_store_verified_session_fields());
$_GET = ['section' => 'discord'];
$_POST = [];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/raidlands/admin/?section=discord';

ob_start();
require dirname(__DIR__) . '/admin/index.php';
$html = (string) ob_get_clean();

foreach (['Discord Connection', 'Connection settings', 'Website access', 'Linked identity directory', 'Secrets remain environment-only'] as $needle) {
    if (!str_contains($html, $needle)) {
        fwrite(STDERR, 'Missing admin workbench marker: ' . $needle . "\n");
        exit(1);
    }
}

echo "Authenticated Discord admin render smoke passed.\n";
