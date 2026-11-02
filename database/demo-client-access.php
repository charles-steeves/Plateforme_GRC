<?php
declare(strict_types=1);

/**
 * Opt-in only: assign ONE chosen passphrase to the eight fictional seed clients.
 * Never touches administrators, ordinary registered accounts or sales records.
 * Run only in a disposable LOCAL demo database.
 *
 * PowerShell:
 * Read-Host "Mot de passe des 8 clients de test" |
 *    php database/demo-client-access.php --password-stdin
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
$backup = null;
$db = null;
$transaction = false;
$installed = false;
$recoveryFailed = false;
try {
    $opts = databaseOptions($argv, ['password-stdin' => false, 'help' => false]);
    if (isset($opts['help'])) {
        echo "Usage: php database/demo-client-access.php --password-stdin\n";
        echo "Huit comptes fictifs uniquement ; conserver la base existante.\n";
        exit(0);
    }
    if (!isset($opts['password-stdin'])) throw new RuntimeException('L’option --password-stdin est obligatoire.');
    requireDatabaseRuntime();
    $input = fgets(STDIN);
    $password = is_string($input) ? rtrim($input, "\r\n") : '';
    if (preg_match('//u', $password) !== 1 || str_contains($password, "\0")
        || preg_match_all('/./us', $password) < 12 || strlen($password) > 72) {
        throw new RuntimeException('Choisissez un mot de passe de 12 à 72 caractères.');
    }
    $path = Config::storagePath() . DIRECTORY_SEPARATOR . 'demo-accounts.json';
    if (!is_file($path) || is_link($path)) throw new RuntimeException('Fichier privé de démonstration absent.');
    $original = file_get_contents($path);
    if ($original === false) throw new RuntimeException('Impossible de lire les comptes fictifs.');
    $data = json_decode($original, true, 32, JSON_THROW_ON_ERROR);
    if (!isset($data['accounts']) || !is_array($data['accounts'])) {
        throw new RuntimeException('Structure de comptes non reconnue.');
    }
    $db = Database::connect();
    $db->exec('BEGIN IMMEDIATE');
    $transaction = true;
    $list = $db->query("SELECT id,email FROM users WHERE role='client' AND email GLOB 'client[0-9]*@example.test' ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    if (count($list) !== 8) throw new RuntimeException('Cette base ne contient pas exactement huit comptes clients fictifs.');
    $byEmail = [];
    foreach ($list as $row) $byEmail[$row['email']] = (int)$row['id'];
    $updated = 0;
    foreach ($data['accounts'] as &$account) {
        if (!is_array($account) || ($account['role'] ?? null) !== 'client') continue;
        $email = $account['email'] ?? '';
        if (!isset($byEmail[$email]) || (int)($account['id'] ?? 0) !== $byEmail[$email]) continue;
        $account['password'] = $password;
        $updated++;
    }
    unset($account);
    if ($updated !== 8) throw new RuntimeException('La base et le fichier de comptes ne correspondent pas.');
    $update = $db->prepare("UPDATE users SET password_hash=? WHERE id=? AND role='client'");
    foreach ($byEmail as $id) $update->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
    $backup = tempnam(dirname($path), '.demo-clients-before-');
    $temp = tempnam(dirname($path), '.demo-clients-next-');
    if ($backup === false || $temp === false || file_put_contents($backup, $original) === false
        || file_put_contents($temp, json_encode($data, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n") === false) {
        throw new RuntimeException('Impossible de préparer la sauvegarde des comptes privés.');
    }
    @chmod($backup, 0600);
    @chmod($temp, 0600);
    installDatabaseFiles([$temp => $path], true);
    $installed = true;
    $temp = null;
    $db->exec('COMMIT');
    $transaction = false;
    echo "Mot de passe de test personnalisé enregistré pour huit clients fictifs.\n";
    echo "Connexion : Amina, Brice, Chloé, Dorian, Estelle, Fabrice, Grâce ou Hugo.\n";
    echo "Ne réutilisez pas ce mot de passe partagé dans une boutique exposée publiquement.\n";
} catch (Throwable $error) {
    if ($transaction && $db instanceof PDO) {
        try {$db->exec('ROLLBACK');}catch(Throwable){}
    }
    if ($installed && is_string($backup) && is_file($backup)) {
        try {installDatabaseFiles([$backup => $path], true); $backup=null;}
        catch(Throwable){$recoveryFailed=true; fwrite(STDERR,"Restauration du fichier privé à effectuer depuis la sauvegarde.\n");}
    }
    fwrite(STDERR, 'Comptes de test inchangés ou restaurés : '.$error->getMessage()."\n");
    exit(1);
} finally {
    if (!$recoveryFailed && is_string($backup) && is_file($backup)) @unlink($backup);
    if (is_string($temp) && is_file($temp)) @unlink($temp);
}
