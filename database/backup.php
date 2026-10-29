<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/app/bootstrap.php';
require __DIR__ . '/sqlite-copy.php';

use App\Core\Config;

$options = getopt('', ['to:', 'help']);
if (isset($options['help'])) {
    echo "Usage: php database/backup.php --to=private/backups/demo.sqlite\n";
    exit(0);
}
try {
    if (!isset($options['to']) || !is_string($options['to'])) {
        throw new RuntimeException('Option --to obligatoire ; destination nouvelle, hors public/.');
    }
    sqliteSnapshot(Config::databasePath(), $options['to']);
    echo "Sauvegarde SQLite cohérente vérifiée. Aucun écrasement de fichier existant.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Sauvegarde refusée : ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
