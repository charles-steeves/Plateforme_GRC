<?php
declare(strict_types=1);

/**
 * Update one EXISTING administrator on this PC. No passwords in command history.
 *
 * php database/change-admin.php --email=admin@example.test --new-email=adresse@exemple.test
 * php database/change-admin.php --email=admin@example.test
 *
 * A fresh password is generated and displayed on the LOCAL terminal only.
 * Database and private account file are updated together with rollback.
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

$backup = null;
$temp = null;
$pdo = null;
$transaction = false;
$installed = false;
$recoveryFailed = false;
try {
    $options = databaseOptions($argv, ['email' => true, 'new-email' => true,
        'password-stdin' => false, 'help' => false]);
    if (isset($options['help'])) {
        echo "Usage: php database/change-admin.php --email=ancien@example.test [--new-email=nouveau@example.test]\n";
        echo "Par défaut, un mot de passe est généré. --password-stdin lit un mot de passe choisi sur l'entrée standard.\n";
        echo "Aucune base n'est réinitialisée. N'utilisez pas de mot de passe faible sur un site partagé.\n";
        exit(0);
    }
    requireDatabaseRuntime();
    $email = strtolower(trim((string)($options['email'] ?? '')));
    $newEmail = strtolower(trim((string)($options['new-email'] ?? $email)));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254
        || !filter_var($newEmail, FILTER_VALIDATE_EMAIL) || strlen($newEmail) > 254) {
        throw new RuntimeException('E-mail actuel ou nouvel e-mail invalide.');
    }
    $file = Config::storagePath() . '/demo-accounts.json';
    if (!is_file($file) || is_link($file)) {
        throw new RuntimeException('Comptes locaux absents. Ne pas réinitialiser la base existante.');
    }
    $old = file_get_contents($file);
    $accounts = json_decode((string)$old, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($accounts) || !is_array($accounts['accounts'] ?? null)) {
        throw new RuntimeException('Fichier de comptes invalide.');
    }
    $found = false;
    foreach ($accounts['accounts'] as &$account) {
        if (($account['role'] ?? '') === 'admin' && strtolower((string)($account['email'] ?? '')) === $email) {
            $found = true;
            $account['email'] = $newEmail;
            if (isset($options['password-stdin'])) {
                $line = fgets(STDIN);
                $password = is_string($line) ? rtrim($line, "\r\n") : '';
                if (preg_match('//u', $password) !== 1 || str_contains($password, "\0")
                    || preg_match_all('/./us', $password) < 12 || strlen($password) > 72) {
                    throw new RuntimeException('Choisissez un mot de passe de 12 à 72 caractères, sans caractère interdit.');
                }
            } else {
                $password = bin2hex(random_bytes(16));
            }
            $account['password'] = $password;
            break;
        }
    }
    unset($account);
    if (!$found) throw new RuntimeException('Administrateur introuvable dans les comptes locaux.');

    $pdo = Database::connect();
    $pdo->exec('BEGIN IMMEDIATE');
    $transaction = true;
    $check = $pdo->prepare("SELECT id FROM users WHERE email = ? AND role='admin'");
    $check->execute([$email]);
    if ($check->fetchColumn() === false) throw new RuntimeException('Administrateur absent de SQLite.');
    $update = $pdo->prepare("UPDATE users SET email=?, password_hash=? WHERE email=? AND role='admin'");
    $update->execute([$newEmail, password_hash($password, PASSWORD_DEFAULT), $email]);
    $backup = tempnam(dirname($file), '.admin-before-');
    $temp = tempnam(dirname($file), '.admin-next-');
    if ($backup === false || $temp === false || file_put_contents($backup, (string)$old) === false
        || file_put_contents($temp, json_encode($accounts, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n") === false) {
        throw new RuntimeException('Impossible de préparer une sauvegarde privée des comptes.');
    }
    @chmod($backup, 0600);
    @chmod($temp, 0600);
    installDatabaseFiles([$temp => $file], true);
    $temp = null;
    $installed = true;
    $pdo->exec('COMMIT');
    $transaction = false;
    echo "Compte administrateur mis à jour : " . $newEmail . PHP_EOL;
    if (!isset($options['password-stdin'])) {
        echo "Nouveau mot de passe local : " . $password . PHP_EOL;
    } else {
        echo "Mot de passe personnel enregistré dans SQLite et dans les comptes privés." . PHP_EOL;
    }
    echo "Conservez-le en privé. Ne partagez pas cette sortie ni le fichier JSON.\n";
} catch (Throwable $error) {
    if ($transaction && $pdo instanceof PDO) {
        try { $pdo->exec('ROLLBACK'); } catch (Throwable) {}
    }
    if ($installed && is_string($backup) && is_file($backup)) {
        try {
            installDatabaseFiles([$backup => $file], true);
            $backup = null;
        } catch (Throwable) {
            $recoveryFailed = true;
            fwrite(STDERR, "ATTENTION : restauration des comptes locaux incomplète. Conservez tous les fichiers privés.\n");
        }
    }
    fwrite(STDERR, 'Modification refusée : ' . $error->getMessage() . PHP_EOL);
    exit(1);
} finally {
    if (!$recoveryFailed && is_string($backup) && is_file($backup)) @unlink($backup);
    if (is_string($temp) && is_file($temp)) @unlink($temp);
}
