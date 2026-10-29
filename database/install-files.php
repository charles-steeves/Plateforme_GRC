<?php
declare(strict_types=1);

/** Install a generated DB/account pair, restoring originals on an I/O failure. */
function installDatabaseFiles(array $files, bool $replace): void
{
    foreach ($files as $source => $target) {
        if (!is_file($source) || is_link($target) || (file_exists($target) && !is_file($target))) {
            throw new RuntimeException('Destination invalide : base et comptes doivent être des fichiers privés ordinaires.');
        }
        if (file_exists($target) && !$replace) {
            throw new RuntimeException('Destination existante : aucune modification.');
        }
        if (!is_writable(dirname($target))) {
            throw new RuntimeException('Le dossier privé n’est pas accessible en écriture.');
        }
    }
    $originals = [];
    $installed = [];
    try {
        foreach ($files as $source => $target) {
            if (file_exists($target)) {
                $backup = tempnam(dirname($target), '.grc-original-');
                if ($backup === false || !unlink($backup) || !rename($target, $backup)) {
                    throw new RuntimeException('Impossible de préserver les fichiers existants ; arrêter le serveur et vérifier les droits.');
                }
                $originals[$target] = $backup;
            }
        }
        foreach ($files as $source => $target) {
            if (!rename($source, $target)) {
                throw new RuntimeException('Impossible d’installer les fichiers générés.');
            }
            $installed[] = $target;
        }
    } catch (Throwable $error) {
        $recovery = [];
        foreach (array_reverse($installed) as $target) {
            if (!@unlink($target)) {
                $recovery[] = $target;
            }
        }
        foreach ($originals as $target => $backup) {
            if (!@rename($backup, $target)) {
                $recovery[] = $backup;
            }
        }
        if ($recovery !== []) {
            throw new RuntimeException('Installation interrompue. Copies privées à récupérer, sans les supprimer : '
                . implode(', ', $recovery), 0, $error);
        }
        throw new RuntimeException('Installation interrompue ; fichiers précédents restaurés. Vérifier les droits et arrêter le serveur.', 0, $error);
    }
    foreach ($originals as $backup) {
        if (!@unlink($backup)) {
            fwrite(STDERR, 'Ancienne copie privée conservée : ' . $backup . PHP_EOL);
        }
    }
}
