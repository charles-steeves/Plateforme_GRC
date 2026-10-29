<?php
declare(strict_types=1);

// A self-contained regression that never uses storage/grc.sqlite.
// Run from the repository root: php tests/storage-recovery.php
if (PHP_SAPI !== 'cli' || !extension_loaded('sqlite3')) {
    fwrite(STDERR, "PHP CLI with SQLite3 extension required.\n");
    exit(1);
}
require dirname(__DIR__) . '/database/sqlite-copy.php';

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'grc-storage-test-' . bin2hex(random_bytes(8));
if (!mkdir($directory, 0700)) {
    throw new RuntimeException('Unable to create isolated test directory.');
}
$source = $directory . DIRECTORY_SEPARATOR . 'source.sqlite';
$snapshot = $directory . DIRECTORY_SEPARATOR . 'snapshot.sqlite';
$destination = $directory . DIRECTORY_SEPARATOR . 'destination.sqlite';
$check = static function (bool $condition, string $label): void {
    if (!$condition) {
        throw new RuntimeException('FAILED: ' . $label);
    }
};
$rows = static function (string $path): int {
    $db = new SQLite3($path, SQLITE3_OPEN_READONLY);
    try {
        return (int) $db->querySingle('SELECT COUNT(*) FROM fixture');
    } finally {
        $db->close();
    }
};
try {
    $db = new SQLite3($source);
    $db->exec('CREATE TABLE fixture (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    $db->exec("INSERT INTO fixture (label) VALUES ('original')");
    $db->close();
    sqliteSnapshot($source, $snapshot);
    $check($rows($snapshot) === 1, 'snapshot is readable');

    $db = new SQLite3($destination);
    $db->exec('CREATE TABLE fixture (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    $db->exec("INSERT INTO fixture (label) VALUES ('old1'), ('old2')");
    $db->close();

    // A non-forced restore must reject an existing database without modifying it.
    try {
        sqliteSnapshot($snapshot, $destination);
        throw new RuntimeException('FAILED: existing destination was overwritten');
    } catch (RuntimeException $error) {
        if (str_starts_with($error->getMessage(), 'FAILED:')) {
            throw $error;
        }
    }
    $check($rows($destination) === 2, 'existing database preserved');

    // With an explicit replace, a fully validated snapshot replaces old data.
    sqliteSnapshot($snapshot, $destination, true);
    $check($rows($destination) === 1, 'explicit restore installed verified snapshot');

    // A missing source for the installer must never touch existing destination.
    try {
        installDatabaseFiles([$directory . '/missing.sqlite' => $destination], true);
        throw new RuntimeException('FAILED: missing source was accepted');
    } catch (RuntimeException $error) {
        if (str_starts_with($error->getMessage(), 'FAILED:')) {
            throw $error;
        }
    }
    $check($rows($destination) === 1, 'installer refused invalid source without data loss');
    echo "OK — isolated snapshot, no-overwrite, explicit restore, invalid source checks\n";
} finally {
    foreach (scandir($directory) ?: [] as $name) {
        if ($name !== '.' && $name !== '..') {
            $path = $directory . DIRECTORY_SEPARATOR . $name;
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }
    @rmdir($directory);
}
