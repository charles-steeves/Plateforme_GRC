<?php
declare(strict_types=1);

/** Helpers for private snapshot directories, never callable from the web. */

function bundleDirectory(string $path, bool $existing): string
{
    if ($path === '' || str_contains($path, "\0")
        || preg_match('~^[a-z][a-z0-9+.-]*://~i', $path)) {
        throw new RuntimeException('Chemin de sauvegarde invalide.');
    }
    if (!preg_match('~^(?:[A-Za-z]:[\\\\/]|/|\\\\\\\\)~', $path)) {
        $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . $path;
    }
    if (is_link($path)) throw new RuntimeException('Lien symbolique interdit pour une sauvegarde.');
    $parent = realpath(dirname($path));
    if ($parent === false) throw new RuntimeException('Le répertoire parent de la sauvegarde doit exister.');
    $public = realpath(dirname(__DIR__) . '/public');
    $resolved = $parent . DIRECTORY_SEPARATOR . basename($path);
    if ($public !== false && \App\Core\Config::isWithin($resolved, $public)) {
        throw new RuntimeException('Sauvegarde interdite sous public/.');
    }
    if ($existing && !is_dir($resolved)) throw new RuntimeException('Sauvegarde inexistante.');
    if (!$existing && file_exists($resolved)) throw new RuntimeException('Destination existante : aucune modification.');
    return $resolved;
}

function bundleUploadsPath(): string
{
    $images = realpath(dirname(__DIR__) . '/public/assets/images');
    $public = realpath(dirname(__DIR__) . '/public');
    if ($images === false || $public === false || !\App\Core\Config::isWithin($images, $public)) {
        throw new RuntimeException('Dossier des images publiques non sécurisé.');
    }
    return $images . DIRECTORY_SEPARATOR . 'uploads';
}

function bundleImageFiles(string $directory): array
{
    if (is_link($directory)) throw new RuntimeException('Dossier de photos lié symboliquement.');
    if (!is_dir($directory)) return [];
    $names = [];
    foreach (new DirectoryIterator($directory) as $item) {
        if ($item->isDot()) continue;
        if ($item->isLink() || !$item->isFile() ||
            preg_match('/^[0-9a-f]{32}\.(?:png|jpe?g|webp)$/D', $item->getFilename()) !== 1) {
            throw new RuntimeException('Fichier inattendu dans les photos : arrêter et vérifier le dossier.');
        }
        $names[] = $item->getFilename();
    }
    sort($names, SORT_STRING);
    return $names;
}

function bundleDeleteNewDirectory(string $directory): void
{
    if (!is_dir($directory) || is_link($directory)) return;
    foreach (new DirectoryIterator($directory) as $item) {
        if ($item->isDot()) continue;
        if ($item->isDir() && !$item->isLink()) bundleDeleteNewDirectory($item->getPathname());
        else @unlink($item->getPathname());
    }
    @rmdir($directory);
}

function bundleValidateAccounts(string $dbPath, string $jsonPath): void
{
    $data = json_decode((string)file_get_contents($jsonPath), true, 24, JSON_THROW_ON_ERROR);
    if (!is_array($data) || !isset($data['accounts']) || !is_array($data['accounts'])) {
        throw new RuntimeException('Fichier local des comptes invalide.');
    }
    $db = new PDO('sqlite:' . $dbPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $query = $db->prepare('SELECT email, password_hash FROM users WHERE id = ?');
    foreach ($data['accounts'] as $account) {
        if (!is_array($account) || !is_int($account['id'] ?? null) ||
            !is_string($account['email'] ?? null) || !is_string($account['password'] ?? null)) {
            throw new RuntimeException('Un compte privé est mal formé.');
        }
        $query->execute([$account['id']]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if ($row === false || strcasecmp($row['email'], $account['email']) !== 0 ||
            !password_verify($account['password'], $row['password_hash'])) {
            throw new RuntimeException('Le fichier des identifiants ne correspond pas à la base SQLite.');
        }
    }
}

function bundleVerify(string $dir): array
{
    if (is_link($dir) || !is_file($dir . '/manifest.json') || is_link($dir . '/manifest.json')) {
        throw new RuntimeException('Manifest de sauvegarde absent ou invalide.');
    }
    $m = json_decode((string)file_get_contents($dir . '/manifest.json'), true, 24, JSON_THROW_ON_ERROR);
    if (!is_array($m) || ($m['format'] ?? null) !== 'grc-bundle-v1' ||
        !is_array($m['files'] ?? null) ||
        !isset($m['files']['grc.sqlite'], $m['files']['demo-accounts.json'])) {
        throw new RuntimeException('Manifest de sauvegarde non reconnu.');
    }
    foreach ($m['files'] as $name => $hash) {
        if (!is_string($name) || !is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)
            || !in_array($name, ['grc.sqlite', 'demo-accounts.json'], true)
               && !preg_match('~^uploads/[0-9a-f]{32}\.(?:png|jpe?g|webp)$~D', $name)) {
            throw new RuntimeException('Nom de fichier ou empreinte de sauvegarde incorrect.');
        }
        $file = $dir . '/' . $name;
        if (!is_file($file) || is_link($file) || !hash_equals($hash, hash_file('sha256', $file))) {
            throw new RuntimeException('Fichier de sauvegarde absent ou modifié : ' . $name);
        }
    }
    $images = $dir . '/uploads';
    $actual = bundleImageFiles($images);
    $declared = [];
    foreach (array_keys($m['files']) as $name) if (str_starts_with($name, 'uploads/')) $declared[] = substr($name, 8);
    sort($declared, SORT_STRING);
    if ($declared !== $actual) throw new RuntimeException('Le contenu des images de sauvegarde est incomplet.');
    $sqlite = new SQLite3($dir . '/grc.sqlite', SQLITE3_OPEN_READONLY);
    $sqlite->enableExceptions(true);
    try {
        if ($sqlite->querySingle('PRAGMA integrity_check') !== 'ok') {
            throw new RuntimeException('Intégrité SQLite incorrecte.');
        }
        $fk = $sqlite->query('PRAGMA foreign_key_check');
        if ($fk->fetchArray(SQLITE3_ASSOC) !== false) throw new RuntimeException('Clés étrangères invalides.');
        $fk->finalize();
    } finally { $sqlite->close(); }
    bundleValidateAccounts($dir . '/grc.sqlite', $dir . '/demo-accounts.json');
    return $m;
}
