<?php
declare(strict_types=1);

require_once __DIR__ . '/install-files.php';

/** CLI-only helpers for SQLite snapshot copies. Never copy an open DB with file copy(). */
function privateSqlitePath(string $path, bool $mustExist): string
{
    if ($path === '' || str_contains($path, "\0") || preg_match('~^[a-z][a-z0-9+.-]*://~i', $path)) {
        throw new RuntimeException('Chemin SQLite invalide.');
    }
    if (is_link($path)) {
        throw new RuntimeException('Un lien symbolique ne peut pas être utilisé.');
    }
    $directory = dirname($path);
    if (!is_dir($directory) && !$mustExist && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Impossible de créer le répertoire privé.');
    }
    $realDirectory = realpath($directory);
    if ($realDirectory === false) {
        throw new RuntimeException('Répertoire inexistant.');
    }
    $resolved = $realDirectory . DIRECTORY_SEPARATOR . basename($path);
    $public = realpath(dirname(__DIR__) . '/public');
    $comparison = static fn(string $value): string => PHP_OS_FAMILY === 'Windows' ? strtolower($value) : $value;
    if ($public !== false && ($comparison($realDirectory) === $comparison($public) || str_starts_with($comparison($realDirectory), $comparison($public . DIRECTORY_SEPARATOR)))) {
        throw new RuntimeException('Les bases et sauvegardes doivent rester hors public/.');
    }
    if ($mustExist && !is_file($resolved)) {
        throw new RuntimeException('Fichier source inexistant.');
    }
    return $resolved;
}

function sqliteSnapshot(string $source, string $destination, bool $replace = false): void
{
    if (!extension_loaded('sqlite3')) {
        throw new RuntimeException('L’extension sqlite3 est obligatoire.');
    }
    $source = privateSqlitePath($source, true);
    $destination = privateSqlitePath($destination, false);
    $same = PHP_OS_FAMILY === 'Windows' ? strcasecmp($source, $destination) === 0 : $source === $destination;
    if ($same || (file_exists($destination) && !$replace)) {
        throw new RuntimeException('Destination existante ou identique : aucune modification.');
    }
    foreach (['-wal', '-shm', '-journal'] as $suffix) {
        if (file_exists($destination . $suffix)) {
            throw new RuntimeException('Destination active : arrêter ses connexions SQLite avant restauration.');
        }
    }
    $temporary = tempnam(dirname($destination), '.grc-snapshot-');
    if ($temporary === false) {
        throw new RuntimeException('Impossible de créer la copie temporaire.');
    }
    $input = null;
    $output = null;
    try {
        $input = new SQLite3($source, SQLITE3_OPEN_READONLY);
        $input->enableExceptions(true);
        $input->busyTimeout(5000);
        $output = new SQLite3($temporary, SQLITE3_OPEN_READWRITE);
        $output->enableExceptions(true);
        $output->busyTimeout(5000);
        if (!$input->backup($output)) {
            throw new RuntimeException('La sauvegarde SQLite a échoué.');
        }
        $output->exec('PRAGMA foreign_keys=ON');
        if ($output->querySingle('PRAGMA integrity_check') !== 'ok') {
            throw new RuntimeException('Échec du contrôle d’intégrité de la copie.');
        }
        $foreign = $output->query('PRAGMA foreign_key_check');
        if ($foreign->fetchArray(SQLITE3_ASSOC) !== false) {
            throw new RuntimeException('La copie contient des clés étrangères invalides.');
        }
        $foreign->finalize();
        $input->close();
        $input = null;
        $output->close();
        $output = null;
        @chmod($temporary, 0600);
        // Never delete the existing destination before the new snapshot is installed.
        // The shared installer preserves the original and restores it if rename fails.
        installDatabaseFiles([$temporary => $destination], $replace);
        $temporary = null;
    } finally {
        if ($input instanceof SQLite3) {
            $input->close();
        }
        if ($output instanceof SQLite3) {
            $output->close();
        }
        if (is_string($temporary) && file_exists($temporary)) {
            @unlink($temporary);
        }
    }
}
