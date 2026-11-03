<?php
declare(strict_types=1);
namespace App\Core;

use PDO;

final class Database
{
    public static function connect(): PDO
    {
        Config::ensureStorage();
        $path = Config::databasePath();
        if (!is_file($path)) {
            throw new \RuntimeException('Initialiser la base avec database/init.php.');
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            // The file is checked above. Do not use non-existent PDO::SQLITE_*
            // constants: those trigger HTTP 500 on PHP 8.2/8.3/8.4.
            // SQLite opens this existing file in normal read/write mode.
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        Schema::ensureProductReviews($pdo);
        Schema::ensureOrderCustomerNote($pdo);
        Schema::ensureProductCategories($pdo);
        return $pdo;
    }

    public static function write(PDO $pdo, callable $work): mixed
    {
        $begun = false;
        try {
            $pdo->exec('BEGIN IMMEDIATE');
            $begun = true;
            $result = $work();
            $pdo->exec('COMMIT');
            return $result;
        } catch (\Throwable $error) {
            if ($begun) {
                $pdo->exec('ROLLBACK');
            }
            if ($error instanceof \PDOException && in_array($error->errorInfo[1] ?? null, [5, 6], true)) {
                throw new ApiException(409, 'DATABASE_BUSY', 'Une opération est en cours. Réessayez.');
            }
            throw $error;
        }
    }
}
