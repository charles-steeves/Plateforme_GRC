<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
require __DIR__ . '/sqlite-copy.php';
require __DIR__ . '/bundle-support.php';

use App\Core\Config;

$opts = getopt('', ['to:', 'help']);
if (isset($opts['help'])) {
    echo "Usage: php database/backup-bundle.php --to=storage/backups/avant-presentation\n";
    echo "Sauvegarder ensuite cette copie dans un dossier privé hors du dépôt. Arrêter PHP de préférence.\n";
    exit(0);
}

$target = null;
try {
    if (!isset($opts['to']) || !is_string($opts['to'])) {
        throw new RuntimeException('Option --to obligatoire.');
    }
    $target = bundleDirectory($opts['to'], false);
    $db = Config::databasePath();
    $accounts = dirname($db) . '/demo-accounts.json';
    if (!is_file($db) || !is_file($accounts) || is_link($accounts)) {
        throw new RuntimeException('Base SQLite et comptes privés requis.');
    }
    $images = bundleUploadsPath();
    $names = bundleImageFiles($images);
    if (!mkdir($target, 0700)) throw new RuntimeException('Impossible de créer le dossier privé.');
    sqliteSnapshot($db, $target . '/grc.sqlite');
    if (!copy($accounts, $target . '/demo-accounts.json')) {
        throw new RuntimeException('Impossible de sauvegarder les identifiants privés.');
    }
    @chmod($target . '/demo-accounts.json', 0600);
    bundleValidateAccounts($target . '/grc.sqlite', $target . '/demo-accounts.json');
    $manifest = [
        'format' => 'grc-bundle-v1',
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'files' => [
            'grc.sqlite' => hash_file('sha256', $target . '/grc.sqlite'),
            'demo-accounts.json' => hash_file('sha256', $target . '/demo-accounts.json'),
        ],
    ];
    if ($names !== []) {
        if (!mkdir($target . '/uploads', 0700)) throw new RuntimeException('Impossible de préparer les images.');
        foreach ($names as $name) {
            if (!copy($images . '/' . $name, $target . '/uploads/' . $name)) {
                throw new RuntimeException('Impossible de copier une image : ' . $name);
            }
            $manifest['files']['uploads/' . $name] = hash_file('sha256', $target . '/uploads/' . $name);
        }
    }
    if (file_put_contents($target . '/manifest.json',
        json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL) === false) {
        throw new RuntimeException('Impossible de créer le manifest.');
    }
    bundleVerify($target);
    echo "Sauvegarde complète vérifiée : " . $target . PHP_EOL;
    echo "SQLite, identifiants locaux et " . count($names) . " image(s) importée(s). Conservez ce dossier privé.\n";
    $target = null;
} catch (Throwable $error) {
    fwrite(STDERR, 'Sauvegarde refusée : ' . $error->getMessage() . PHP_EOL);
    if (is_string($target)) bundleDeleteNewDirectory($target);
    exit(1);
}
