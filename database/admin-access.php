<?php
declare(strict_types=1);

/**
 * Local demonstration only:
 *   php database/admin-access.php
 *   php database/admin-access.php --show-password
 *
 * Reads the existing private credentials and verifies that their passwords
 * still match an administrator in SQLite. Never accepts HTTP requests.
 * Does not change or reset any account or product.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/runtime.php';
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Config;
use App\Core\Database;

try {
    $options = databaseOptions($argv, ['show-password' => false, 'help' => false]);
    if (isset($options['help'])) {
        echo "Usage: php database/admin-access.php [--show-password]\n";
        echo "Les identifiants restent sur le PC, jamais dans Git ni sur le site.\n";
        exit(0);
    }
    requireDatabaseRuntime();
    $path = Config::storagePath() . DIRECTORY_SEPARATOR . 'demo-accounts.json';
    if (!is_file($path) || is_link($path)) {
        throw new RuntimeException('Fichier de comptes absent : conserver la base ; ne pas la réinitialiser.');
    }
    $data = json_decode((string)file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data) || !is_array($data['accounts'] ?? null)) {
        throw new RuntimeException('Format de comptes inconnu.');
    }
    $db = Database::connect();
    $find = $db->prepare("SELECT password_hash FROM users WHERE role = 'admin' AND email = ?");
    $count = 0;
    foreach ($data['accounts'] as $account) {
        if (!is_array($account) || ($account['role'] ?? null) !== 'admin') continue;
        $email = $account['email'] ?? null;
        $password = $account['password'] ?? null;
        if (!is_string($email) || !is_string($password)) continue;
        $find->execute([$email]);
        $hash = $find->fetchColumn();
        if (!is_string($hash) || !password_verify($password, $hash)) continue;
        echo "Administrateur : " . $email . PHP_EOL;
        if (isset($options['show-password'])) {
            echo "Mot de passe local : " . $password . PHP_EOL;
        }
        $count++;
    }
    if ($count === 0) {
        throw new RuntimeException('Aucun identifiant admin local ne correspond à la base actuelle. Conserver la base et vérifier les sauvegardes.');
    }
    if (!isset($options['show-password'])) {
        echo "Pour afficher le mot de passe uniquement sur ce PC : php database/admin-access.php --show-password\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Accès admin : ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
