<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/app/bootstrap.php';
require __DIR__ . '/sqlite-copy.php';

use App\Core\Config;

$options = getopt('', ['from:', 'replace', 'help']);
if (isset($options['help'])) {
    echo "Usage: php database/restore.php --from=private/backups/demo.sqlite [--replace]\nArrêter le serveur et toutes les connexions avant restauration.\n";
    exit(0);
}
try {
    if (!isset($options['from']) || !is_string($options['from'])) {
        throw new RuntimeException('Option --from obligatoire.');
    }
    sqliteSnapshot($options['from'], Config::databasePath(), array_key_exists('replace', $options));
    echo "Restauration SQLite vérifiée. Les comptes locaux doivent correspondre à la sauvegarde.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Restauration refusée : ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
