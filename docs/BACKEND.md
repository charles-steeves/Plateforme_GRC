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

Le frontend relève du Chat A. Dans cette branche backend, `public/index.html` n'existe pas encore : `/` répond donc 404 jusqu'à l'intégration du frontend. L'API fonctionne indépendamment. Le routeur servira les ressources statiques présentes, tout en refusant les sources PHP, fichiers privés et liens sortant de `public/`.

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

Produits : prix 0..1 000 000 000 000 XAF, stock saisi par admin 0..1 000 000 000 ; images vides ou chemins statiques internes contrôlés sous /assets/images/. Pagination catalogue : 12 par défaut, maximum 24. Pagination clients : 20 par défaut, maximum 100. Recherche LIKE littérale avec paramètres liés et échappement des jokers.

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

## Vérifications réellement exécutées

Hôte Linux Debian, PHP 8.4.27, SQLite 3.46.1 ; 29 octobre 2026. Aucun frontend n'a été modifié.

| Vérification | Résultat |
| --- | --- |
| Syntaxe de tous les 27 fichiers PHP | PASS |
| Recette HTTP + schéma sur base isolée, deux processus PHP | 593 assertions PASS, 0 FAIL |
| Services commandes/SAV/GRC, agrégats et concurrence multiprocessus | 172 assertions PASS |
| Contraintes/seed/snapshot SQLite supplémentaires | 22 contrôles PASS ; contrôles CLI init/reset/backup/restore exécutés |
| Revue sécurité, mot de passe 72 octets, routage, sessions et proxy simulé | 22 contrôles PASS |

La recette HTTP parcourt tous les endpoints, inscription → login → commande → confirmation/livraison → crédit unique → SAV/messages → avis → segments/dashboard. Elle vérifie notamment l'impossibilité d'accès aux données d'autrui/admin, CSRF/Origin, injection SQL, champs/type malveillants, fixation et rotation de session, expiration, rate-limit partagé, JSON mal formé, annulation répétée, avis unique, fichier privé et erreur 500 sans fuite.

Concurrence : deux processus PHP indépendants partagent la même base et commandent la dernière unité (une réponse 201, une 409, stock final zéro). D'autres courses exécutées en CLI vérifient livraison/crédit unique, avis unique et annulation/restauration unique. Correction après revue : refus au login d'un suffixe après 72 octets ; distinction stricte entre objet JSON indexé et liste de lignes. Régressions incluses dans la recette relancée.

Les scripts de validation du Chat B sont conservés **hors checkout** dans /workspace/.grc-environment/backend-validation sur l'instance cloud ; ils ne font pas partie de la PR ni des fichiers tests/ appartenant au Chat C. Le rapport détaillé s'y trouve dans grc-backend-validation-results.json. Le coordinateur/Chat C doit versionner sa recette indépendante dans son périmètre.

**NON EXÉCUTÉS** : exécution sous Windows et sous PHP 8.2 exact ; rendu navigateur, responsive et XSS DOM du frontend absent ; vrai terminateur TLS/tunnel HTTPS. Les chemins et outils applicatifs sont du PHP portable, mais cela ne remplace pas ces vérifications.

Aucun changement de contrat, route ou colonne proposé. Aucun commit de base active, compte local, secret, frontend ou fichier réservé au coordinateur/Chat C.
