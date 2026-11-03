# Lanceur Windows du projet GRC — base existante toujours préservée.
# Usage dans PowerShell : .\start.ps1 -Port 8000
param(
  [ValidateRange(1024,65535)]
  [int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host '=== Préparation du projet GRC ==='

if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
    throw 'PHP 8.2+ introuvable. Installez PHP et ajoutez php.exe au PATH.'
}
& php -r 'if (PHP_VERSION_ID < 80200 || PHP_INT_SIZE < 8 || !extension_loaded("pdo_sqlite") || !extension_loaded("sqlite3")) { fwrite(STDERR, "PHP 8.2+ 64 bits et extensions pdo_sqlite + sqlite3 requis." . PHP_EOL); exit(1); }'
if ($LASTEXITCODE -ne 0) { throw 'Environnement PHP incorrect : exécutez php --ini et php -m.' }

if ($env:GRC_ORIGIN) {
    Write-Host 'GRC_ORIGIN externe ignoré pour cette session locale (évite INVALID_HOST).'
    Remove-Item Env:GRC_ORIGIN
}

# Un chemin de base personnalisé doit être respecté, jamais remplacé silencieusement.
if ($env:GRC_DB_PATH) {
    Write-Host 'Base personnalisée GRC_DB_PATH détectée : aucune initialisation automatique.'
} else {
    $db = Join-Path $PSScriptRoot 'storage\grc.sqlite'
    $accounts = Join-Path $PSScriptRoot 'storage\demo-accounts.json'
    if (-not (Test-Path -LiteralPath $db) -and -not (Test-Path -LiteralPath $accounts)) {
        Write-Host 'Nouvelle installation détectée : création de la base et des comptes fictifs.'
        Write-Host 'Aucune base existante ne sera écrasée.'
        & php database/init.php
        if ($LASTEXITCODE -ne 0) {
            throw 'Initialisation non effectuée. Consultez les messages ci-dessus. Ne lancez pas --reset.'
        }
    } elseif (-not (Test-Path -LiteralPath $db) -or -not (Test-Path -LiteralPath $accounts)) {
        throw 'Installation incomplète : base SQLite ou fichier de comptes absent. Restaurez une sauvegarde ; aucune réinitialisation automatique.'
    }
}

& php database/doctor.php
if ($LASTEXITCODE -ne 0) {
    throw 'Le diagnostic a détecté un problème. Corrigez-le avant de démarrer ; ne réinitialisez pas les comptes.'
}

Write-Host ''
Write-Host "Boutique : http://127.0.0.1:${Port}/"
Write-Host "Inscription : http://127.0.0.1:${Port}/register.html"
Write-Host "Connexion admin : http://127.0.0.1:${Port}/login.html?next=%2Fadmin.html"
Write-Host 'Pour arrêter le serveur : Ctrl+C'
& php -S "127.0.0.1:${Port}" -t public public/router.php
if ($LASTEXITCODE -ne 0) { throw "Serveur PHP indisponible sur le port ${Port}. Choisissez un autre port : .\start.ps1 -Port 8002" }
