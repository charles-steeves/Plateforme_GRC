<?php
declare(strict_types=1);

/**
 * Diagnose or repair an EXISTING administrator account, without resetting the
 * database, requiring demo-accounts.json, or disclosing a password in argv.
 *
 * PowerShell:
 *   Read-Host "Mot de passe actuel" | php database/admin-login.php --check
 *   Read-Host "Nouveau mot de passe" | php database/admin-login.php --set-password
 *
 * --email=... selects the administrator when multiple accounts exist.
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

$db = null;
$inTransaction = false;
$previousAccounts = null;
$accountsFile = null;
$backup = null;
$temp = null;
$installed = false;
$restoreFailed = false;

try {
    $options = databaseOptions($argv, [
        'check' => false, 'set-password' => false,
        'email' => true, 'help' => false,
    ]);
    if (isset($options['help'])) {
        echo "Usage : php database/admin-login.php (--check | --set-password) [--email=adresse]\n";
        echo "Lit le mot de passe depuis l'entrée standard, sans l'afficher.\n";
        echo "Ne crée aucun compte et ne réinitialise jamais les produits ni les commandes.\n";
        exit(0);
    }
    if (isset($options['check']) === isset($options['set-password'])) {
        throw new RuntimeException('Choisir --check ou --set-password.');
    }
    requireDatabaseRuntime();
    $db = Database::connect();
    $rows = $db->query("SELECT id, email, password_hash FROM users WHERE role='admin' ORDER BY id")
        ->fetchAll(PDO::FETCH_ASSOC);
    if ($rows === []) throw new RuntimeException('Aucun administrateur dans cette base ; ne pas initialiser à nouveau.');
    $email = isset($options['email']) ? strtolower(trim((string)$options['email'])) : null;
    if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new RuntimeException('Adresse e-mail invalide.');
    }
    if ($email !== null) {
        $matches = array_values(array_filter($rows, static fn(array $row): bool =>
            strtolower($row['email']) === $email));
        if (count($matches) !== 1) throw new RuntimeException('Compte administrateur introuvable.');
        $target = $matches[0];
    } else {
        $preferred = array_values(array_filter($rows, static fn(array $row): bool => (int)$row['id'] === 1));
        if (count($preferred) === 1) $target = $preferred[0];
        elseif (count($rows) === 1) $target = $rows[0];
        else throw new RuntimeException('Plusieurs administrateurs : ajouter --email=adresse pour choisir le compte.');
    }

    $value = fgets(STDIN);
    $password = is_string($value) ? rtrim($value, "\r\n") : '';
    if ($password === '') throw new RuntimeException('Aucun mot de passe reçu.');
    if (isset($options['check'])) {
        if (!password_verify($password, $target['password_hash'])) {
            throw new RuntimeException('Le mot de passe ne correspond pas à cet administrateur dans SQLite.');
        }
        echo "OK — mot de passe et rôle administrateur vérifiés directement dans SQLite.\n";
        echo "Compte : " . $target['email'] . "\n";
        exit(0);
    }
    if (preg_match('//u', $password) !== 1 || str_contains($password, "\0")
        || preg_match_all('/./us', $password) < 12 || strlen($password) > 72) {
        throw new RuntimeException('Choisir un mot de passe de 12 caractères minimum et 72 octets maximum.');
    }

    // Synchronize the private demo credentials if the matching entry exists,
    // but do not depend on this auxiliary file to recover the real SQLite login.
    $accountsFile = Config::storagePath() . '/demo-accounts.json';
    if (is_file($accountsFile) && !is_link($accountsFile)) {
        $previousAccounts = file_get_contents($accountsFile);
        if ($previousAccounts !== false) {
            try {
                $parsed = json_decode($previousAccounts, true, 32, JSON_THROW_ON_ERROR);
                if (is_array($parsed) && is_array($parsed['accounts'] ?? null)) {
                    foreach ($parsed['accounts'] as &$account) {
                        if (is_array($account) && ($account['role'] ?? null) === 'admin'
                            && (int)($account['id'] ?? 0) === (int)$target['id']
                            && strtolower((string)($account['email'] ?? '')) === strtolower($target['email'])) {
                            $account['password'] = $password;
                            $encoded = json_encode($parsed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";
                            break;
                        }
                    }
                    unset($account);
                }
            } catch (JsonException) {
                // The SQLite account remains recoverable without a demo file.
            }
        }
    }

    $db->exec('BEGIN IMMEDIATE');
    $inTransaction = true;
    $update = $db->prepare("UPDATE users SET password_hash=? WHERE id=? AND role='admin'");
    $update->execute([password_hash($password, PASSWORD_DEFAULT), (int)$target['id']]);
    if ($update->rowCount() !== 1) throw new RuntimeException('Compte administrateur non mis à jour.');

    if (isset($encoded)) {
        $backup = tempnam(dirname($accountsFile), '.admin-login-old-');
        $temp = tempnam(dirname($accountsFile), '.admin-login-new-');
        if ($backup === false || $temp === false
            || file_put_contents($backup, $previousAccounts) === false
            || file_put_contents($temp, $encoded) === false) {
            throw new RuntimeException('Impossible de préparer les comptes locaux.');
        }
        @chmod($backup, 0600);
        @chmod($temp, 0600);
        installDatabaseFiles([$temp => $accountsFile], true);
        $temp = null;
        $installed = true;
    }

    $db->exec('COMMIT');
    $inTransaction = false;
    echo "Mot de passe mis à jour pour l'administrateur existant : " . $target['email'] . "\n";
    echo "Aucune commande ni aucun produit n'a été réinitialisé.\n";
    if (!isset($encoded)) {
        echo "Attention : fichier demo-accounts.json absent ou non concordant ; le mot de passe SQLite est valide.\n";
    }
} catch (Throwable $e) {
    if ($inTransaction && $db instanceof PDO) {
        try { $db->exec('ROLLBACK'); } catch (Throwable) {}
    }
    if ($installed && is_string($backup) && is_file($backup) && is_string($accountsFile)) {
        try {
            installDatabaseFiles([$backup => $accountsFile], true);
            $backup = null;
        } catch (Throwable) {
            $restoreFailed = true;
            fwrite(STDERR, "Attention : une sauvegarde du fichier de comptes doit être restaurée manuellement.\n");
        }
    }
    fwrite(STDERR, 'Connexion admin : ' . $e->getMessage() . "\n");
    exit(1);
} finally {
    if (!$restoreFailed && is_string($backup) && is_file($backup)) @unlink($backup);
    if (is_string($temp) && is_file($temp)) @unlink($temp);
}
