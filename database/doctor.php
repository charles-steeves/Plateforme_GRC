<?php
declare(strict_types=1);

/**
 * Diagnostic read-only for local Windows/Linux installation.
 * Usage: php database/doctor.php
 * Never initializes, changes, resets or deletes the SQLite database.
 * Never displays user records, credentials, tokens or log content.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Config;

$problems = [];
echo "Diagnostic GRC — lecture seule\n";
echo "PHP : " . PHP_VERSION . ' (' . PHP_OS_FAMILY . ', ' . (PHP_INT_SIZE * 8) . " bits)\n";
echo "Exécutable : " . PHP_BINARY . "\n";
echo "php.ini : " . (php_ini_loaded_file() ?: '(aucun chargé)') . "\n";

if (PHP_VERSION_ID < 80200) {
    $problems[] = 'PHP 8.2 minimum requis.';
}
if (PHP_INT_SIZE < 8) {
    $problems[] = 'PHP 64 bits requis.';
}
foreach (['PDO', 'pdo_sqlite', 'sqlite3', 'session', 'json'] as $ext) {
    $present = extension_loaded($ext);
    echo 'Extension ' . $ext . ' : ' . ($present ? 'OK' : 'MANQUANTE') . "\n";
    if (!$present) {
        $problems[] = 'Activer l’extension ' . $ext . ' dans le php.ini affiché ci-dessus.';
    }
}
$drivers = extension_loaded('PDO') ? PDO::getAvailableDrivers() : [];
$hasSqlite = in_array('sqlite', $drivers, true);
echo "Pilote PDO SQLite : " . ($hasSqlite ? 'OK' : 'MANQUANT') . "\n";
if (!$hasSqlite) {
    $problems[] = 'Le pilote SQLite est nécessaire pour l’API et l’initialisation.';
}

try {
    $dbPath = Config::databasePath();
    $accounts = dirname($dbPath) . DIRECTORY_SEPARATOR . 'demo-accounts.json';
    echo 'Base SQLite : ' . (is_file($dbPath) ? 'PRÉSENTE' : 'ABSENTE') . "\n";
    echo 'Comptes locaux : ' . (is_file($accounts) ? 'PRÉSENTS' : 'ABSENTS') . "\n";
    if (!is_file($dbPath)) {
        $problems[] = 'La base est absente. Une fois les pilotes activés, exécuter php database/init.php (sans --reset).';
    } elseif ($hasSqlite) {
        // SQLite3 provides a genuine read-only open on PHP 8.2+ without
        // relying on undefined PDO SQLite open-flag constants.
        $db = new SQLite3($dbPath, SQLITE3_OPEN_READONLY);
        $check = $db->querySingle('PRAGMA quick_check');
        echo 'Intégrité SQLite : ' . ($check === 'ok' ? 'OK' : 'À VÉRIFIER') . "\n";
        if ($check !== 'ok') {
            $problems[] = 'La base ne passe pas le contrôle d’intégrité ; ne pas réinitialiser avant sauvegarde.';
        }
        $db = null;
    }
    if (!is_file($accounts)) {
        if (is_file($dbPath)) {
            echo "Avertissement : demo-accounts.json est absent. Les comptes de connexion restent enregistrés dans SQLite.\n";
            echo "En cas de perte du mot de passe administrateur, consulter php database/admin-login.php --help. Ne pas réinitialiser la base.\n";
        } else {
            $problems[] = 'Le fichier de comptes et la base sont absents : initialiser une seule fois avec php database/init.php.';
        }
    }
} catch (Throwable $error) {
    // No file paths, records or exception details in the public browser.
    $problems[] = 'Impossible de lire la configuration ou la base en lecture seule : ' . $error->getMessage();
}

if ($problems === []) {
    echo "\nRESULTAT : aucun problème de prérequis ou de base détecté.\n";
    echo "Si l’API échoue encore, consulter le journal privé storage/errors.log et le terminal du serveur PHP.\n";
    exit(0);
}
echo "\nPROBLEMES À CORRIGER :\n";
foreach ($problems as $issue) {
    echo ' - ' . $issue . "\n";
}
echo "Guide : docs/BACKEND.md. Ce diagnostic n’a modifié aucun fichier.\n";
exit(1);
