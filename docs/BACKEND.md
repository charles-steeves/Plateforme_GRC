# Backend PHP / SQLite — contrat v3

Démonstration — données fictives. Serveur local sans paiement, livraison, courriel ou donnée personnelle réels.

## Installation Windows et Linux

Prérequis : PHP **8.2+ 64 bits**, extensions PDO, pdo_sqlite, sqlite3, session et JSON. Aucune dépendance Composer, npm, CDN ou service distant nécessaire à l'exécution. Vérifier `php --version` et `php -m`. Sous Windows, activer PDO_SQLITE et sqlite3 dans le php.ini réellement chargé (`php --ini`), puis ajouter PHP au PATH. Sous Linux, installer les paquets PHP CLI/SQLite de la distribution. L'exécution réelle sous Windows reste à effectuer.

Depuis la racine du dépôt :

```sh
php database/init.php
php -S 127.0.0.1:8000 -t public public/router.php
```

Dans l'environnement cloud préparé, activer d'abord PHP dans chaque shell :
`export PATH="/workspace/.grc-environment/bin:$PATH"`.

L'initialisation crée `storage/grc.sqlite`, 12 produits, 8 clients et 1 administrateur, des commandes variées, tickets/messages, avis et crédits cohérents. Les cinq segments sont représentés. Les mots de passe sont générés par `random_bytes` à chaque initialisation et hachés avec `password_hash(PASSWORD_DEFAULT)`. Les identifiants de démonstration sont conservés **uniquement localement** dans `storage/demo-accounts.json` (fichier ignoré par Git, hors document root). Ouvrir ce fichier dans un éditeur local pour choisir un compte ; ne pas le publier ni réutiliser ses mots de passe.

Une seconde initialisation refuse de modifier la base ou les comptes existants. Pour reconstruire volontairement les données fictives, arrêter les serveurs, sauvegarder les données utiles, puis exécuter `php database/init.php --reset`. Cette action remplace les données et génère de nouveaux mots de passe. Aucun reset automatique au démarrage du serveur.

Le frontend intégré dans `main` est présent : `/` sert `public/index.html`, qui charge les modules JavaScript et les données SQLite par la même API. Les fichiers frontend restent la propriété du Chat A et n'ont pas été modifiés pendant cette finalisation. Le routeur refuse les sources PHP, fichiers privés et liens sortant de `public/`.

## Dépannage de l’initialisation — Windows / PowerShell

Le message signalé « php n’est pas reconnu » vient de PowerShell **avant toute exécution PHP**. Il indique une installation absente ou un dossier PHP absent du PATH du terminal ; il ne prouve pas une erreur SQL. La commande copiée comportait aussi `database/int.php` : le fichier correct est **database/init.php**.

1. Chercher une installation existante avec `Get-Command php -ErrorAction SilentlyContinue` et `where.exe php`. Ne pas écraser un php.ini existant.
2. Si PHP manque, installer une distribution **PHP 8.2+ x64** depuis [la distribution officielle Windows](https://windows.php.net/download/) (par exemple PHP 8.4 x64), et ses prérequis Microsoft Visual C++ x64 indiqués par cette distribution. Extraire PHP dans un dossier dédié, par exemple `C:\tools\php`.
3. Vérifier le binaire directement, même sans PATH :

   ```powershell
   & 'C:\tools\php\php.exe' --version
   & 'C:\tools\php\php.exe' --ini
   ```

4. Si aucun php.ini n’est chargé, copier `php.ini-development` vers `php.ini` dans ce dossier. Dans **le php.ini du PHP CLI indiqué par --ini**, définir un extension_dir correspondant à votre installation et activer :

   ```ini
   extension_dir = "C:\tools\php\ext"
   extension=pdo_sqlite
   extension=sqlite3
   ```

   Adapter le chemin si PHP est installé ailleurs. `PDO`, `session` et `json` doivent aussi figurer dans `php -m` ; ils sont normalement intégrés dans la distribution Windows. Un module activé dans le PHP d’un serveur web ne configure pas nécessairement le PHP du terminal.
5. Pour la session PowerShell courante seulement :

   ```powershell
   $env:Path = 'C:\tools\php;' + $env:Path
   php --version
   php --ini
   php -m
   php database/init.php
   ```

   Pour rendre le PATH permanent, ajouter le dossier de PHP au **Path utilisateur** dans les variables d’environnement Windows, puis fermer et rouvrir VS Code et son terminal. Le lancement direct `& 'C:\tools\php\php.exe' database/init.php` reste possible sans modifier le PATH.

Sous Debian/Ubuntu, les paquets usuels sont `php-cli` et `php-sqlite3` ; vérifier ensuite la version et les modules du PHP CLI. Sous d’autres distributions, utiliser leurs paquets équivalents.

| Symptôme | Diagnostic / action |
| --- | --- |
| `php` non reconnu | Installer PHP ou corriger le PATH ; essayer son exécutable par chemin complet. Aucun script du dépôt ne peut démarrer avant cela. |
| `Could not open input file` | Se placer à la racine et utiliser `database/init.php`, pas `database/int.php`. |
| Extension manquante / pilote PDO indisponible | Le contrôle préalable nomme les modules absents, le binaire et le php.ini utilisés ; corriger ce PHP puis relancer. Aucun stockage n’est créé avant ce contrôle. |
| Base ou comptes existants | Refus volontaire, sans modification : démarrer le serveur avec la base existante. Ne pas supprimer ces fichiers ni ajouter --reset pour contourner un problème d’installation. |
| Chemin relatif avec --db | Utiliser un chemin absolu privé. Les espaces sont acceptés si l’argument est entre guillemets. |
| Dossier non accessible en écriture / fichier verrouillé | Arrêter le serveur, vérifier les droits du dossier de stockage et les verrous Windows. Ne pas ouvrir les droits à tous les utilisateurs. |
| `grc.sqlite` ou `demo-accounts.json` est un dossier/lien | Destination invalide, refus avant remplacement ; préserver son contenu et corriger le chemin. |
| Installation des fichiers interrompue | Les anciens fichiers sont restaurés après un échec d’écriture. Si la restauration est elle-même empêchée par le système, le message indique les copies privées à récupérer manuellement ; ne pas les supprimer. |

Les options inconnues, répétées ou sans valeur sont désormais refusées ; `php database/init.php --help` reste disponible sans les extensions SQLite. `--reset` reste une action explicite, serveur arrêté. La base et les comptes générés sont préparés avant installation ; une erreur sur le second fichier ne doit plus laisser la base remplacée avec des comptes incohérents.

## Configuration locale

Les variables suivantes sont facultatives ; ne pas committer de valeurs sensibles. Le programme ne charge pas automatiquement de fichier .env.

| Variable | Comportement |
| --- | --- |
| GRC_DB_PATH | Chemin absolu privé vers SQLite, hors `public/`. Par défaut : `storage/grc.sqlite` depuis la racine calculée par PHP. Le dossier parent contient aussi sessions, comptes de démonstration, clé HMAC du limiteur et journaux. |
| GRC_ORIGIN | Origine exacte sans chemin, par exemple `http://192.168.1.20:8000` pour un LAN de confiance. Sans configuration, seuls les hôtes de boucle locale sont admis. |
| GRC_TRUSTED_PROXIES | Adresses IP exactes séparées par des virgules, vide par défaut. `X-Forwarded-Proto: https` n'est reconnu que depuis une de ces IP **et** avec GRC_ORIGIN configuré en HTTPS. Aucun en-tête forwarded n'est fiable par défaut. |

Pour isoler une autre base : `php database/init.php --db=<chemin-absolu-prive>`, puis donner le même chemin au serveur via GRC_DB_PATH. Ne jamais placer les sessions, journaux, clés, bases ou sauvegardes sous `public/`. Le démarrage ne crée pas silencieusement une base manquante.

Le serveur intégré PHP reste réservé au local/LAN de confiance. Une publication temporaire demanderait un proxy HTTPS réellement configuré et testé ainsi qu'une limitation globale en amont ; la simulation de proxy effectuée ici ne valide pas un déploiement HTTPS. Aucun accès public configuré.

## API et authentification

Tous les chemins ci-dessous sont préfixés par `/api/v1`. Les formats, noms de champs et enveloppes suivent `docs/API_CONTRACT.md`.

| Accès | Endpoints |
| --- | --- |
| Public | GET /products, GET /products/{id}, GET /auth/csrf, POST /auth/register, POST /auth/login, POST /auth/logout |
| Session | GET /auth/me |
| Client | POST /orders, GET /orders/me, GET /loyalty/me, POST /tickets, GET /tickets/me, POST /feedback |
| Propriétaire ou admin | GET /tickets/{id}, POST /tickets/{id}/messages |
| Admin | GET /admin/dashboard, GET /admin/customers, GET /admin/customers/{id}, GET /admin/orders, PATCH /admin/orders/{id}, GET /admin/tickets, PATCH /admin/tickets/{id}, GET /admin/products, POST /admin/products, PATCH /admin/products/{id} |

L'inscription crée exclusivement un client, sans connexion automatique. Le login régénère l'ID de session et le CSRF. Le frontend doit :
1. appeler GET /auth/csrf et conserver les cookies ;
2. envoyer `Content-Type: application/json` et `X-CSRF-Token` pour POST/PATCH, y compris register/login/logout ;
3. recharger /auth/csrf après login, puis conserver les mêmes cookies via `credentials: 'same-origin'` ;
4. traiter 401/403/404/409/422/429 sans simuler un succès.

Le logout détruit la session et invalide son token. Cookies HttpOnly, SameSite=Lax, Secure uniquement si HTTPS direct ou proxy explicitement fiable. ID uniquement en cookie, mode strict ; expiration après 30 minutes d'inactivité ou 8 heures absolues. Le rôle est relu en base à chaque requête protégée.

Origin est vérifié lorsqu'il est fourni ; les mutations `Sec-Fetch-Site: cross-site` sont refusées. Aucun CORS ouvert. Les méthodes non admises répondent 405 avec Allow, les routes inconnues 404. Il n'existe pas de route GET /orders/{id} dans le contrat : les clients utilisent /orders/me, qui filtre toujours par leur session.

Limites serveur : corps JSON objet de 64 Kio maximum ; 1..30 lignes distinctes, 1..20 unités par ligne ; identifiants/prix/quantités/notes JSON entiers stricts ; booléens active stricts. Les mots de passe d'inscription comportent au moins 12 caractères et au plus 72 octets (limite de bcrypt), appliquée aussi au login pour éviter la troncature. Les champs sensibles injectés sont refusés. Les prix soumis avec une commande sont ignorés conformément au contrat : seuls les prix SQLite font autorité.

Produits : prix 0..1 000 000 000 000 XAF, stock saisi par admin 0..1 000 000 000 ; images vides ou chemins statiques internes contrôlés sous /assets/images/ (noms de fichiers avec points et extensions en majuscules admis comme dans le frontend ; URL externe, encodage de chemin et traversée refusés). Pagination catalogue : 12 par défaut, maximum 24. Pagination clients : 20 par défaut, maximum 100. Recherche LIKE littérale avec paramètres liés et échappement des jokers.

## Cohérence et sécurité

- Chaque connexion active foreign_keys=ON et busy_timeout=5000. Schéma version initiale v3 dans database/schema.sql, contraintes CHECK/UNIQUE/FK et neuf index ; aucune migration automatique d'une ancienne base.
- Toutes les écritures métier utilisent BEGIN IMMEDIATE. Une commande réserve ses stocks, conserve les prix/noms de lignes et calcule ses montants entiers dans une transaction unique, avec contrôles de débordement et rollback intégral.
- Transitions de commande strictes ; répétition du même statut sans effet. L'annulation restaure le stock une fois ; la première livraison crédite `intdiv(total_xaf,1000)` points dans la même transaction avec unicité (order_id,reason).
- Le propriétaire d'un ticket/avis/ordre lié est vérifié côté serveur. Ressources d'autrui : 404 générique. Un admin ne passe pas de commande client. Messages de ticket fermé : 409. Un seul avis, après livraison, par son propriétaire.
- Segments sur commandes non annulées, inactivité UTC prioritaire après 90 jours. Dashboard : CA simulé livré uniquement, satisfaction réelle des avis, commandes et tickets calculés sur SQLite. Le frontend doit afficher « Démonstration — données fictives ».
- Requêtes préparées ; aucune colonne SQL issue librement d'une entrée. JSON UTF-8 typé, caractères HTML échappés dans le transport, nosniff et CSP restrictive. Le frontend doit encore utiliser textContent/DOM sûr : un retour JSON sécurisé ne prouve pas l'absence de XSS dans une interface.
- Login : compteur SQLite persistant sur 15 minutes, HMAC par e-mail, IP et couple ; 10 tentatives par e-mail/couple et 50 par IP. Tous les essais de connexion sont comptés, réussis ou non. Clé aléatoire locale privée ; aucune IP, adresse e-mail ou mot de passe en clair dans login_attempts. L'adresse réseau vient de REMOTE_ADDR, jamais de X-Forwarded-For. Cela ne constitue pas une protection DDoS.
- Erreurs internes : réponse JSON 500 générique ; journal privé ne conserve que classe d'erreur, nom de fichier et ligne, sans requêtes, paramètres, mots de passe ni trace détaillée.

## Sauvegarde et restauration

```sh
php database/backup.php --to=storage/backup.sqlite
php database/restore.php --from=storage/backup.sqlite
```

La sauvegarde utilise SQLite3::backup, y compris avec une source WAL ouverte, puis vérifie intégrité et clés étrangères. Une destination existante est refusée. Arrêter le serveur avant restauration ; une base existante n'est remplacée qu'avec `--replace` explicite. Les sources/destinations publiques, liens symboliques ou journaux actifs de destination sont refusés. Pour choisir une autre base, utiliser GRC_DB_PATH. Ne pas copier arbitrairement un fichier SQLite actif.

Une sauvegarde SQLite contient les hachages, pas le fichier local de comptes. Conserver les identifiants fictifs correspondant à cette sauvegarde séparément et de façon privée, notamment avant un --reset.

## Finalisation depuis main intégré — vérifications réellement exécutées

Point de départ : `main` au commit `376f9a627174e30d372c61d74a3239e6767b85bb`, puis branche `feature/backend-finalization`. Hôte Linux Debian, PHP 8.4.27 64 bits, SQLite 3.46.1, Chromium 154 ; 29 octobre 2026. Bases temporaires isolées ; base locale existante préservée.

| Vérification exécutée pendant cette finalisation | Résultat |
| --- | --- |
| Syntaxe de tous les 29 fichiers PHP | PASS |
| Régression HTTP et schéma couvrant tous les endpoints P0, deux processus PHP | 593 assertions PASS, 0 FAIL |
| Initialisation, extensions absentes, options, protections et récupération des fichiers | 21 contrôles PASS |
| Parcours réel du frontend intégré, profils client et admin séparés dans Chromium | 23 contrôles PASS |
| Création simultanée du stockage/sessions privés | 12 processus réussis sans erreur de course mkdir |
| Clone local neuf, init par défaut, refus d’écrasement et démarrage frontend/API | 7 contrôles PASS |

Le parcours navigateur utilise les formulaires existants : inscription, connexion, fiche produit/panier/commande, confirmation et livraison administratives, affichage des points, avis, ticket lié, réponse et résolution SAV, fiche client/segment, création produit, dashboard et déconnexion. Les charges HTML introduites dans le nom et le ticket restent du texte dans le DOM ; aucun gestionnaire injecté exécuté, aucune exception JavaScript non interceptée ni réponse serveur 500 observée dans ce parcours. Les en-têtes CSP et les modules frontend sont réellement utilisés.

La régression HTTP vérifie les rôles/propriétaires, CSRF/Origin, rotation et expiration des sessions, injections SQL, limites/types JSON, refus de fichiers privés, erreurs 500 génériques et limiteur SQLite persistant. Elle couvre les prix serveur, stocks, annulation répétée, livraison/crédit unique, transitions SAV, avis unique, segmentation et agrégats. Deux processus PHP commandant la dernière unité obtiennent 201 et 409, stock final zéro. L’initialisation, le reset explicite, la sauvegarde et la restauration sont également exécutés.

Corrections ciblées : contrôle préalable PHP/extensions, diagnostics d’installation et options strictes, préservation de la paire base/comptes en cas d’échec de remplacement, refus des destinations non ordinaires avant modification, création des dossiers résistante aux courses, validation des images cohérente avec le frontend. Aucun endpoint, table, colonne ou contrat commun modifié.

Les scripts/rapports de cette finalisation sont conservés hors checkout dans `/workspace/.grc-environment/backend-finalization-validation` sur l’instance cloud, pas dans la PR ni dans les chemins tests/ réservés au Chat C. Cela ne remplace pas sa campagne de recette indépendante.

**NON EXÉCUTÉS** : exécution native Windows, PHP 8.2 exact, campagne responsive/accessibilité exhaustive et vrai terminateur TLS/tunnel HTTPS. L’erreur PowerShell rapportée a été identifiée à partir du message fourni ; Windows n’a pas été simulé comme une exécution réelle. Les diagnostics d’extensions désactivées et d’échec des fichiers ont été reproduits sous Linux.

Aucune correction frontend nécessaire au parcours testé n’est restée bloquante. L’indication de la limite serveur de 72 octets dans le formulaire de mot de passe pourrait être ajoutée par le Chat A : actuellement, le serveur la refuse avec 422, mais le formulaire annonce seulement 12 caractères minimum. Aucun fichier frontend, contrat, README, test du Chat C, base active ou identifiant local n’est modifié/versionné par cette PR.
