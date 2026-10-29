<?php
declare(strict_types=1);

/** Run before bootstrap so an unsuitable CLI PHP produces an actionable message. */
function requireDatabaseRuntime(): void
{
    $problems = [];
    if (PHP_VERSION_ID < 80200) {
        $problems[] = 'PHP 8.2 minimum requis ; version utilisée : ' . PHP_VERSION;
    }
    if (PHP_INT_SIZE < 8) {
        $problems[] = 'PHP 64 bits requis pour les montants entiers XAF';
    }
    foreach (['PDO', 'pdo_sqlite', 'sqlite3', 'session', 'json'] as $extension) {
        if (!extension_loaded($extension)) {
            $problems[] = 'extension manquante : ' . $extension;
        }
    }
    if (extension_loaded('PDO') && !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        $problems[] = 'pilote PDO sqlite indisponible';
    }
    if ($problems !== []) {
        throw new RuntimeException(implode('; ', $problems) . ".\nPHP CLI : " . PHP_BINARY
            . "\nphp.ini chargé : " . (php_ini_loaded_file() ?: '(aucun)')
            . "\nVérifier php --version, php --ini et php -m ; activer les extensions dans le PHP du terminal."
            . "\nVoir docs/BACKEND.md. Aucune base ni aucun compte n’a été modifié.");
    }
}

/** Strict long options: never silently ignore a typo or a missing --db value. */
function databaseOptions(array $arguments, array $specification): array
{
    $options = [];
    for ($index = 1; $index < count($arguments); $index++) {
        $parts = explode('=', $arguments[$index], 2);
        $name = substr($parts[0], 2);
        if (substr($parts[0], 0, 2) !== '--' || !array_key_exists($name, $specification)) {
            throw new InvalidArgumentException('Option inconnue : ' . $parts[0] . '. Consulter --help.');
        }
        if (array_key_exists($name, $options)) {
            throw new InvalidArgumentException('Option répétée : --' . $name . '.');
        }
        if ($specification[$name]) {
            $value = $parts[1] ?? ($arguments[++$index] ?? '');
            if ($value === '' || substr($value, 0, 2) === '--') {
                throw new InvalidArgumentException('Valeur obligatoire pour --' . $name . '.');
            }
            $options[$name] = $value;
        } else {
            if (isset($parts[1])) {
                throw new InvalidArgumentException('L’option --' . $name . ' ne prend pas de valeur.');
            }
            $options[$name] = true;
        }
    }
    return $options;
}
