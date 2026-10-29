<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/app/bootstrap.php';
require __DIR__ . '/seed.php';

use App\Core\Config;

$options = getopt('', ['reset', 'db:', 'help']);
if (isset($options['help'])) {
    echo "Usage: php database/init.php [--db=private/path/grc.sqlite] [--reset]\n";
    echo "Démonstration — données fictives. Arrêter le serveur avant --reset.\n";
    exit(0);
}

$tempDb = null;
$tempAccounts = null;
$lock = null;
$exitCode = 0;
try {
    if (isset($options['db'])) {
        if (!is_string($options['db']) || $options['db'] === '') {
            throw new RuntimeException('Chemin de base invalide.');
        }
        putenv('GRC_DB_PATH=' . $options['db']);
    }
    $dbPath = Config::databasePath();
    $directory = dirname($dbPath);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Impossible de créer le répertoire privé.');
    }
    // A previously absent parent may resolve through a symlink into public/.
    $dbPath = Config::databasePath();
    $directory = dirname($dbPath);
    $lock = fopen($dbPath . '.init.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Impossible de verrouiller l’initialisation.');
    }
    $reset = array_key_exists('reset', $options);
    $accountPath = $directory . DIRECTORY_SEPARATOR . 'demo-accounts.json';
    if ((file_exists($dbPath) || file_exists($accountPath)) && !$reset) {
        throw new RuntimeException('Base ou comptes de démonstration existants : aucune modification. Utiliser --reset explicitement, serveur arrêté.');
    }
    if (is_link($dbPath) || is_link($accountPath)) {
        throw new RuntimeException('Un lien symbolique ne peut pas être remplacé.');
    }
    foreach ([$dbPath . '-wal', $dbPath . '-shm', $dbPath . '-journal'] as $sidecar) {
        if (file_exists($sidecar)) {
            throw new RuntimeException('Fichier journal actif détecté : arrêter toutes les connexions SQLite avant initialisation.');
        }
    }
    $tempDb = tempnam($directory, '.grc-init-');
    if ($tempDb === false) {
        throw new RuntimeException('Impossible de créer la base temporaire.');
    }
    $db = new PDO('sqlite:' . $tempDb, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA busy_timeout = 5000');
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('Schéma SQL introuvable.');
    }
    $db->beginTransaction();
    $db->exec($schema);
    $accounts = seedDemo($db);
    $db->commit();
    if ($db->query('PRAGMA foreign_key_check')->fetch() !== false || $db->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') {
        throw new RuntimeException('La base générée ne passe pas les contrôles d’intégrité.');
    }
    $db = null;
    $tempAccounts = tempnam($directory, '.grc-accounts-');
    if ($tempAccounts === false || file_put_contents($tempAccounts, json_encode($accounts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL) === false) {
        throw new RuntimeException('Impossible d’enregistrer les comptes fictifs locaux.');
    }
    @chmod($tempDb, 0600);
    @chmod($tempAccounts, 0600);
    // Windows does not replace a destination with rename: explicit reset is required.
    if ($reset && file_exists($dbPath) && !unlink($dbPath)) {
        throw new RuntimeException('Impossible de remplacer la base. Arrêter le serveur.');
    }
    if (!rename($tempDb, $dbPath)) {
        throw new RuntimeException('Impossible d’installer la base générée.');
    }
    $tempDb = null;
    if ($reset && file_exists($accountPath) && !unlink($accountPath)) {
        throw new RuntimeException('Impossible de remplacer les comptes locaux.');
    }
    if (!rename($tempAccounts, $accountPath)) {
        throw new RuntimeException('Base créée, mais installation des comptes locaux impossible.');
    }
    $tempAccounts = null;
    echo "Initialisation réussie — Démonstration, données fictives.\n";
    echo "Comptes aléatoires conservés uniquement dans le fichier privé demo-accounts.json, à côté de la base.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Initialisation refusée : ' . $error->getMessage() . PHP_EOL);
    $exitCode = 1;
} finally {
    foreach ([$tempDb, $tempAccounts] as $temporary) {
        if (is_string($temporary) && file_exists($temporary)) {
            @unlink($temporary);
        }
    }
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

exit($exitCode);
