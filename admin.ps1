# Console locale de récupération et de changement du mot de passe administrateur.
# L'accès est uniquement au terminal du PC, jamais dans l'interface boutique.
param(
    [switch]$Changer,
    [string]$Email = ''
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
    throw 'PHP est introuvable dans le terminal.'
}
if (-not $Changer) {
    & php database/admin-access.php --show-password
    if ($LASTEXITCODE -eq 0) {
        Write-Host ''
        Write-Host 'Identifiant possible pour le compte initial : admin'
        Write-Host 'Page administrateur locale : http://127.0.0.1:8000/admin.html'
        Write-Host 'Pour choisir un autre mot de passe : .\admin.ps1 -Changer'
        exit 0
    }
    Write-Warning 'Les anciens identifiants ne correspondent plus. Vous pouvez en choisir un nouveau pour le compte SQLite existant.'
}
Write-Host ''
Write-Host 'Choisissez un mot de passe personnel de 12 caractères ou plus (pas de code hexadécimal imposé).'
$password = Read-Host 'Nouveau mot de passe' -AsSecureString
$confirmation = Read-Host 'Confirmez le mot de passe' -AsSecureString
$ptr = [IntPtr]::Zero
$ptr2 = [IntPtr]::Zero
try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $ptr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $retyped = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr2)
    if ($plain -cne $retyped) { throw 'Les deux mots de passe ne correspondent pas.' }
    if ($plain.Length -lt 12) { throw 'Saisissez au moins 12 caractères.' }
    $args = @('database/admin-login.php','--set-password')
    if ($Email) { $args += "--email=$Email" }
    $plain | & php @args
    if ($LASTEXITCODE -ne 0) { throw 'La mise à jour du compte administrateur a échoué.' }
    Write-Host 'Vous pouvez maintenant utiliser le nouveau mot de passe dans le formulaire de connexion.'
} finally {
    $plain = $null
    $retyped = $null
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($ptr2 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr2) }
}
