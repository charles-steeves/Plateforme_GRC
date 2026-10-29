<?php
declare(strict_types=1);

/**
 * Create one additional administrator in the EXISTING local SQLite database.
 * Does not reset products, customers, orders or other existing accounts.
 * Usage: php database/add-admin.php --name="Collègue A" --email=collegue@example.test
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/runtime.php';
require __DIR__ . '/install-files.php';
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Config;
use App\Core\Database;

$temp = null;
$lock = null;
$pdo = null;
$transaction = false;
try {
    $options = databaseOptions($argv, ['name' => true, 'email' => true, 'help' => false]);
    if (isset($options['help'])) {
        echo "Usage: php database/add-admin.php --name=\"Nom du collègue\" --email=collegue@example.test\n";
        echo "Crée un compte admin supplémentaire dans la base existante, sans réinitialisation.\n";
        exit(0);
    }
    requireDatabaseRuntime();
    $name = trim((string)($options['name'] ?? ''));
    $email = trim((string)($options['email'] ?? ''));
    if ($name === '' || strlen($name) > 120 || preg_match('//u', $name) !== 1) {
        throw new InvalidArgumentException('Nom obligatoire (120 octets maximum).');
    }
    if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new InvalidArgumentException('Adresse e-mail invalide.');
    }
    $dbPath = Config::databasePath();
    $accountsPath = dirname($dbPath) . '/demo-accounts.json';
    if (!is_file($dbPath) || !is_file($accountsPath) || is_link($accountsPath)) {
        throw new RuntimeException('Initialisation existante requise. Ne pas utiliser --reset.');
    }
    $lock = fopen($dbPath . '.admin.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Impossible de verrouiller la création du compte administrateur.');
    }
    $pdo = Database::connect();
    $pdo->exec('BEGIN IMMEDIATE');
    $transaction = true;
    $existing = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $existing->execute([$email]);
    if ($existing->fetchColumn() !== false) {
        throw new RuntimeException('Un compte utilise déjà cette adresse e-mail.');
    }
    $accounts = json_decode((string)file_get_contents($accountsPath), true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($accounts) || !isset($accounts['accounts']) || !is_array($accounts['accounts'])) {
        throw new RuntimeException('Le fichier de comptes locaux a un format inattendu ; aucune modification.');
    }
    $password = bin2hex(random_bytes(16));
    $stmt = $pdo->prepare(
        "INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?, ?, ?, 'admin', ?)"
    );
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), gmdate('Y-m-d\TH:i:s\Z')]);
    $id = (int)$pdo->lastInsertId();
    $accounts['accounts'][] = ['id' => $id, 'name' => $name, 'email' => $email, 'role' => 'admin', 'password' => $password];
    $temp = tempnam(dirname($accountsPath), '.admin-credentials-');
    if ($temp === false) {
        throw new RuntimeException('Impossible de préparer le fichier privé de comptes.');
    }
    if (file_put_contents($temp, json_encode($accounts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL) === false) {
        throw new RuntimeException('Impossible d’enregistrer les identifiants administrateur.');
    }
    @chmod($temp, 0600);
    // Keep the old credentials recoverable if file installation fails.
    installDatabaseFiles([$temp => $accountsPath], true);
    $temp = null;
    $pdo->exec('COMMIT');
    $transaction = false;
    echo "Compte administrateur supplémentaire créé : " . $email . PHP_EOL;
    echo "Son mot de passe est conservé dans le fichier privé storage/demo-accounts.json.\n";
    echo "Aucun autre utilisateur, produit ou commande n’a été modifié.\n";
} catch (Throwable $error) {
    if ($transaction && $pdo instanceof PDO) {
        try { $pdo->exec('ROLLBACK'); } catch (Throwable) { /* preserve original error */ }
    }
    fwrite(STDERR, 'Création refusée : ' . $error->getMessage() . PHP_EOL);
    exit(1);
} finally {
    if (is_string($temp) && is_file($temp)) @unlink($temp);
    if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
}
