<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/bootstrap.php';
require __DIR__ . '/sqlite-copy.php';
require __DIR__ . '/bundle-support.php';

use App\Core\Config;

$opts = getopt('', ['from:', 'replace', 'confirm', 'help']);
if (isset($opts['help'])) {
    echo "Usage: php database/restore-bundle.php --from=storage/backups/avant-presentation --replace --confirm\n";
    echo "ATTENTION : arrêter le serveur PHP. Remplace la base, les comptes et les photos importées.\n";
    exit(0);
}
$stageDb = null;
$stageAccounts = null;
$stageImages = null;
$oldImages = null;
$imagesInstalled = false;
try {
    if (!isset($opts['from']) || !is_string($opts['from'])
        || !isset($opts['replace'], $opts['confirm'])) {
        throw new RuntimeException('Restauration refusée : fournir --from, --replace et --confirm explicitement.');
    }
    $source = bundleDirectory($opts['from'], true);
    bundleVerify($source);
    $db = Config::databasePath();
    $accounts = dirname($db) . '/demo-accounts.json';
    $images = bundleUploadsPath();
    if (is_link($db) || is_link($accounts) || is_link($images)) {
        throw new RuntimeException('Restauration interdite via des liens symboliques.');
    }
    foreach ([$db . '-wal', $db . '-shm', $db . '-journal'] as $sidecar) {
        if (file_exists($sidecar)) throw new RuntimeException('Connexions SQLite possiblement actives : arrêter PHP.');
    }
    if (!is_dir(dirname($db)) || !is_writable(dirname($db))) {
        throw new RuntimeException('Dossier de base privé non accessible.');
    }
    $suffix = bin2hex(random_bytes(8));
    $stageDb = dirname($db) . '/.grc-restore-' . $suffix . '.sqlite';
    $stageAccounts = dirname($db) . '/.grc-restore-' . $suffix . '.json';
    $stageImages = dirname($images) . '/.grc-restore-' . $suffix;
    $oldImages = dirname($images) . '/.grc-old-' . $suffix;
    if (file_exists($stageDb) || file_exists($stageAccounts) || file_exists($stageImages) || file_exists($oldImages)) {
        throw new RuntimeException('Noms de restauration déjà utilisés.');
    }
    sqliteSnapshot($source . '/grc.sqlite', $stageDb);
    if (!copy($source . '/demo-accounts.json', $stageAccounts)) {
        throw new RuntimeException('Copie des identifiants impossible.');
    }
    @chmod($stageAccounts, 0600);
    bundleValidateAccounts($stageDb, $stageAccounts);

    if (!mkdir($stageImages, 0700)) throw new RuntimeException('Impossible de préparer les images.');
    foreach (bundleImageFiles($source . '/uploads') as $name) {
        if (!copy($source . '/uploads/' . $name, $stageImages . '/' . $name)) {
            throw new RuntimeException('Copie image impossible : ' . $name);
        }
    }
    // Keep the original upload folder recoverable until DB and accounts are
    // successfully installed; on any failure, the old folder is restored.
    if (is_dir($images) && !rename($images, $oldImages)) {
        throw new RuntimeException('Impossible de préserver les images actuelles.');
    }
    if (!rename($stageImages, $images)) {
        if (is_dir($oldImages)) rename($oldImages, $images);
        throw new RuntimeException('Impossible de restaurer les images.');
    }
    $imagesInstalled = true;
    $stageImages = null;
    installDatabaseFiles([$stageDb => $db, $stageAccounts => $accounts], true);
    $stageDb = null;
    $stageAccounts = null;
    $imagesInstalled = false;
    if (is_dir($oldImages)) bundleDeleteNewDirectory($oldImages);
    $oldImages = null;
    echo "Restauration complète réussie. Base, comptes et photos ont été remplacés depuis : " . $source . PHP_EOL;
    echo "La sauvegarde source est intacte. Redémarrer PHP et se reconnecter.\n";
} catch (Throwable $error) {
    if ($imagesInstalled) {
        bundleDeleteNewDirectory($images);
        if (is_dir($oldImages) && !rename($oldImages, $images)) {
            fwrite(STDERR, 'ATTENTION : images d’origine à récupérer manuellement dans ' . $oldImages . PHP_EOL);
        }
    }
    fwrite(STDERR, 'Restauration refusée : ' . $error->getMessage() . PHP_EOL);
    exit(1);
} finally {
    if (is_string($stageDb) && is_file($stageDb)) @unlink($stageDb);
    if (is_string($stageAccounts) && is_file($stageAccounts)) @unlink($stageAccounts);
    if (is_string($stageImages)) bundleDeleteNewDirectory($stageImages);
}
