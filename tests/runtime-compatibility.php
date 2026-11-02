<?php
declare(strict_types=1);

/**
 * Reproduce the original HTTP 500 regression:
 * the storefront and login both connect through App\Core\Database.
 * Exercise the real connection to the already-initialized demo database.
 */
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Database;
use App\Core\Config;

if (!is_file(Config::databasePath())) {
    fwrite(STDERR, "Initialize the disposable CI database first.\n");
    exit(1);
}
$db = Database::connect();
$count = (int)$db->query('SELECT COUNT(*) FROM products')->fetchColumn();
$admins = (int)$db->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
if ($count < 12 || $admins < 1) {
    throw new RuntimeException('Products or admin account unavailable through the real DB connector.');
}
echo "OK — real PDO SQLite connection, {$count} products, {$admins} admin(s)\n";
