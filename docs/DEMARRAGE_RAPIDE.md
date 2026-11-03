# Démarrage fiable de GRC-Plateforme

## Sur chaque PC Windows avec VS Code

1. Installer PHP 8.2 ou plus, 64 bits, avec les extensions `pdo_sqlite`, `sqlite3`, `session` et `json`. Git est nécessaire uniquement pour cloner.
2. Cloner le dépôt et ouvrir **le dossier `GRC-Plateforme`**, pas son dossier parent, dans VS Code.
3. Dans le terminal de la racine du dépôt :

   ```powershell
   php -S 127.0.0.1:8000 -t public public/router.php
   ```

   Variante courte, uniquement depuis la racine : `php -S 127.0.0.1:8000 router.php`. Le fichier racine `router.php` est un relais de compatibilité vers `public/router.php` ; ce n'est pas une seconde application.

4. Ouvrir `http://127.0.0.1:8000/` : **au premier accès local**, si ni la base `storage/grc.sqlite` ni les comptes `storage/demo-accounts.json` n'existent, les fichiers fictifs sont créés automatiquement. Aucune initialisation ou réinitialisation ne s'exécute sur une base déjà présente.
5. Dans VS Code, **Terminal → Exécuter la tâche → « GRC : démarrer le site (8000) »** fait la même chose avec le bon dossier de travail.

### Administration

- Sur le PC serveur, ouvrir `http://127.0.0.1:8000/admin.html`. L'administration fonctionne aussi depuis l'autre ordinateur avec l'adresse HTTPS du tunnel suivie de `/admin.html`, après connexion par un véritable compte administrateur.
- Si non connecté, un lien renvoie vers le formulaire normal avec une destination administrateur. **Aucun lien de connexion « administrateur » n'est proposé aux clients de la boutique**.
- Sur une nouvelle installation de démonstration, identifiant simplifié : `admin` ; mot de passe généré **aléatoirement** sur ce PC, jamais commité.
- Afficher le compte et le mot de passe locaux : `powershell -NoProfile -ExecutionPolicy Bypass -File .\admin.ps1`.
- Choisir son propre mot de passe (au moins 12 caractères, sans code hexadécimal imposé) : `powershell -NoProfile -ExecutionPolicy Bypass -File .\admin.ps1 -Changer`. Aucun produit ni commande n'est effacé.

### Tunnel Cloudflare

Dans un deuxième terminal :

```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

Le site accepte automatiquement les hôtes HTTPS temporaires `*.trycloudflare.com`, sans changer manuellement `GRC_ORIGIN`. Les clients peuvent consulter les produits, créer un compte et commander. L'administrateur peut se connecter depuis un second appareil via `https://ADRESSE-DU-TUNNEL.trycloudflare.com/admin.html`. Les pages administratives sont protégées par une vraie session, les rôles, le mot de passe et un jeton CSRF : connaître l'adresse ne donne aucun droit d'administration. **Ne partagez jamais les identifiants admin.** Le tunnel doit rester actif pour que le second appareil accède au site. Cette ouverture est adaptée à une présentation temporaire, pas à un déploiement de production sans contrôle d'accès complémentaire.

### Diagnostic sans perte de données

```powershell
php -v
php -m
php database/doctor.php
```

- Si `index.php`, `router.php` ou `public` est introuvable, vérifier d'abord le dossier affiché par `pwd` (ou `Get-Location`), puis lancer le serveur depuis la **racine du dépôt**. Ne pas démarrer le serveur dans `public/` en utilisant à nouveau `-t public`.
- Si la base manque mais que les comptes auxiliaires existent, le programme refuse l'initialisation automatique : restaurer la sauvegarde.
- Si la base existe mais que le fichier auxiliaire de comptes manque, elle est préservée. Utiliser `admin.ps1 -Changer` pour définir un nouveau mot de passe si nécessaire.
- Si `php database/doctor.php` signale une extension manquante, activer `pdo_sqlite` et `sqlite3` dans le fichier `php.ini` du PHP utilisé par **ce terminal**.
- Le journal privé des erreurs du serveur est `storage/errors.log`. Il ne doit jamais être envoyé sur GitHub.

### Transfert entre ordinateurs

GitHub contient **le code**, pas les données privées. Pour retrouver les mêmes comptes, commandes et photos, transférer le dossier `storage/` ainsi que `public/assets/images/uploads/` depuis une **sauvegarde faite serveur arrêté**. Ne jamais écraser une base existante avec un clonage ou un reset.

