<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use RuntimeException;
use Throwable;

/**
 * First-run setup for the built-in PHP server on this PC.
 *
 * Never resets, overwrites or repairs an existing database or credentials.
 * Both files must be absent. An external tunnel cannot trigger setup.
 * The existing database/init.php remains available for explicit CLI setup.
 */
final class FirstRun
{
    public static function ensure(): void
    {
        if (PHP_SAPI !== 'cli-server') return;
        if ((string) getenv('GRC_DB_PATH') !== '') return;
        if (!self::isLocalVisit()) return;

        $database = Config::databasePath();
        $accounts = dirname($database) . DIRECTORY_SEPARATOR . 'demo-accounts.json';
        if (file_exists($database) || file_exists($accounts)) return;

        if (PHP_VERSION_ID < 80200 || PHP_INT_SIZE < 8
            || !extension_loaded('pdo_sqlite') || !extension_loaded('sqlite3')) {
            throw new RuntimeException('PHP 8.2+ (64 bits) et les extensions pdo_sqlite/sqlite3 sont nécessaires.');
        }
        Config::ensureStorage();
        $lockFile = $database . '.init.lock';
        $lock = @fopen($lockFile, 'c');
        if ($lock === false) throw new RuntimeException('Impossible de verrouiller la première installation.');
        $tempDb = null;
        $tempAccounts = null;
        try {
            if (!flock($lock, LOCK_EX)) throw new RuntimeException('Verrouillage impossible.');
            // Another process may have installed the database while waiting.
            if (file_exists($database) || file_exists($accounts)) return;
            $directory = dirname($database);
            $tempDb = tempnam($directory, '.grc-first-run-');
            if ($tempDb === false) throw new RuntimeException('Dossier SQLite inaccessible en écriture.');
            $pdo = new PDO('sqlite:' . $tempDb, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $pdo->exec('PRAGMA foreign_keys=ON');
            $schema = file_get_contents(Config::root() . '/database/schema.sql');
            if (!is_string($schema) || $schema === '') throw new RuntimeException('Schéma SQL absent.');
            require_once Config::root() . '/database/seed.php';
            $pdo->beginTransaction();
            try {
                $pdo->exec($schema);
                $generated = \seedDemo($pdo);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            if ($pdo->query('PRAGMA integrity_check')->fetchColumn() !== 'ok'
                || $pdo->query('PRAGMA foreign_key_check')->fetch() !== false) {
                throw new RuntimeException('Base initiale invalide.');
            }
            $pdo = null;
            $tempAccounts = tempnam($directory, '.grc-first-accounts-');
            if ($tempAccounts === false
                || file_put_contents(
                    $tempAccounts,
                    json_encode($generated, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL
                ) === false) {
                throw new RuntimeException('Impossible d’écrire les comptes initiaux.');
            }
            @chmod($tempDb, 0600);
            @chmod($tempAccounts, 0600);
            require_once Config::root() . '/database/install-files.php';
            \installDatabaseFiles([$tempDb => $database, $tempAccounts => $accounts], false);
            $tempDb = null;
            $tempAccounts = null;
            error_log('GRC: nouvelle installation locale prête (base et comptes privés créés).');
        } finally {
            foreach ([$tempDb, $tempAccounts] as $file) {
                if (is_string($file) && is_file($file)) @unlink($file);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private static function isLocalVisit(): bool
    {
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $peer = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        return in_array($peer, ['127.0.0.1', '::1'], true)
            && preg_match('~^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$~D', $host) === 1;
    }
}
