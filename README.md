# Akoma Boutique — boutique et relation client

> Nom commercial **provisoire**, choisi pour l'interface, sans modification du nom technique du dépôt ni de la structure GRC.

Plateforme universitaire de **vente en ligne et de gestion de la relation client (GRC)**, développée au Gabon. L'application présente les relations entre vente, suivi des commandes, fidélisation, segmentation, satisfaction et service après-vente. **Akoma Boutique est le nom de présentation de cette version.** Le catalogue actuellement fourni sert uniquement de jeu d'essai.

> **Démonstration — données fictives.** Aucun paiement, aucune livraison et aucune donnée personnelle réels. Ne pas utiliser comme site de production.

## Fonctionnement et technologies

- **Interface** : HTML5, CSS3 et JavaScript (ES modules), sans installation npm.
- **Serveur** : PHP 8.2+ sans framework, API JSON sous `/api/v1`.
- **Base** : SQLite avec PDO, créée dans `storage/grc.sqlite` **hors du dossier public**.
- **Accès** : boutique visiteur, espace client, administration GRC avec contrôles de rôle côté serveur.

Le navigateur et l'administration utilisent la même API et la même base SQLite. Tous les prix sont affichés en francs CFA (XAF).

## Démarrage rapide — Windows 11 et Linux

**Prérequis :** Git (ou un téléchargement du dépôt), **PHP 8.2 ou supérieur en version 64 bits**, avec les extensions `PDO`, `pdo_sqlite`, `sqlite3`, `session` et `json`. Un navigateur récent suffit ; aucun compte ou service cloud n'est nécessaire pour lancer le site localement.

1. Dans **VS Code**, ouvrir le dossier du dépôt `GRC-Plateforme` et son terminal intégré (**Terminal > Nouveau terminal**). Si le dépôt n'est pas encore sur l'ordinateur, le cloner depuis GitHub. Si le dépôt a déjà été cloné, récupérer les dernières modifications de `main` avec `git pull` après vérification des éventuelles modifications locales.
2. Vérifier PHP dans le terminal :

   ```sh
   php --version
   php -m
   ```

   Dans la liste des modules, vérifier notamment `PDO`, `pdo_sqlite` et `sqlite3`. Si `php` est introuvable ou si les extensions manquent, effectuer la configuration indiquée dans [docs/BACKEND.md](docs/BACKEND.md) avant de poursuivre.
3. **Depuis la racine du projet**, initialiser une seule fois la base de démonstration :

   ```sh
   php database/init.php
   ```

   Cette commande crée `storage/grc.sqlite` et `storage/demo-accounts.json` avec **12 produits, 8 clients et 1 administrateur fictifs**. Les mots de passe sont générés aléatoirement et conservés uniquement dans ce fichier local privé ; ils ne figurent pas dans Git.
4. Démarrer le serveur local :

   ```sh
   php -S 127.0.0.1:8000 -t public public/router.php
   ```

5. Dans le navigateur, ouvrir **http://127.0.0.1:8000/**. Pour vérifier rapidement la réponse de l'API, ouvrir **http://127.0.0.1:8000/api/v1/products** : la réponse doit être un objet JSON avec `success: true` et une liste de produits.

**Actualisation automatique :** le tableau de bord administratif et les échanges SAV se mettent à jour toutes les **5 secondes** lorsque l'onglet est visible et connecté, sans recharger la page ni effacer les brouillons. Pour tester simultanément le dépôt de votre collègue sur le même ordinateur, lancez celui-ci sur `http://localhost:8001/` ; conserver `127.0.0.1` ici et `localhost` là-bas isole aussi les cookies de session.

**Sous Windows / PowerShell**, le fichier des comptes peut être ouvert dans VS Code sous `storage/demo-accounts.json` ou consulté localement avec :

```powershell
Get-Content .\storage\demo-accounts.json
```

Il contient les comptes `admin@example.test` et `client1@example.test` à `client8@example.test`, avec leurs mots de passe de connexion propres à votre installation. **Ne jamais publier ni envoyer ce fichier**. Pour tester simultanément le client et l'administrateur, employer deux profils de navigateur distincts, car un même profil partage les cookies de session.

Pour **arrêter le serveur**, revenir au terminal où il fonctionne et appuyer sur **Ctrl+C**. Ne pas relancer `database/init.php` sur une base existante : l'initialiseur refuse volontairement de remplacer les données sans option explicite. `--reset` détruit et recrée les données fictives ; ne l'utiliser qu'après sauvegarde, serveur arrêté et en connaissance de cause.

## Images de produits et plusieurs administrateurs

Les utilisateurs administrateurs peuvent sélectionner une photo depuis leur PC ou leur galerie de smartphone dans **Administration → Produits → Nouveau produit / Modifier → Photo du produit**, cliquer sur **Importer l'image**, vérifier l'aperçu puis **Enregistrer**. JPG, PNG et WebP uniquement, jusqu'à 1,9 Mo. Les fichiers sont enregistrés sur le PC serveur sous `public/assets/images/uploads/` et **ignorés par Git**. Sauvegarder aussi ce dossier si les photos doivent être conservées avec le catalogue ; une sauvegarde SQLite seule ne contient pas les images.

Pour créer **un deuxième puis un troisième administrateur**, sans modifier les comptes ou commandes existants :

```powershell
php database/add-admin.php --name="Collègue 2" --email="admin2@example.test"
php database/add-admin.php --name="Collègue 3" --email="admin3@example.test"
```

Choisir vos propres noms/adresses distincts. Les nouveaux mots de passe générés sont ajoutés dans `storage/demo-accounts.json` **sur l'ordinateur hébergeant SQLite**, sans être poussés sur Git. Conserver le fichier privé et ne pas le projeter devant la classe. Les sessions de chaque navigateur sont indépendantes, mais deux personnes modifiant simultanément la **même fiche produit** doivent vérifier le résultat après sauvegarde.

**Depuis un smartphone :** ouvrir une URL réseau pointant vers l'adresse LAN du PC serveur, et non `127.0.0.1` sur le téléphone. Le serveur doit être configuré pour le réseau privé de confiance, avec `GRC_ORIGIN` réglé sur l'origine exacte et le pare-feu autorisant uniquement ce réseau. Ne pas exposer directement `php -S` sur Internet. Voir `docs/BACKEND.md`.

## Connexion administrateur et installation sans perte

Le serveur utilise **une seule base SQLite** pour le catalogue, les commandes, les clients et les analyses GRC. Une copie du code GitHub ne contient **pas** les produits ou comptes saisis localement.

Pour une installation neuve, exécuter **une seule fois** `php database/init.php`, puis démarrer sur le port choisi :

```powershell
php -S 127.0.0.1:8001 router.php
```

La commande officielle `php -S 127.0.0.1:8000 -t public public/router.php` reste également valable. Utiliser le même hôte et le même port dans le navigateur ; par exemple `http://127.0.0.1:8001/`. Ne pas démarrer simultanément deux serveurs sur le même port.

Pour retrouver un administrateur **sur le PC qui héberge la base**, sans réinitialiser les produits :

```powershell
php database/doctor.php
php database/admin-access.php
php database/admin-access.php --show-password
```

La dernière commande affiche volontairement les identifiants fictifs **dans le terminal local uniquement**. Ne pas les montrer pendant la soutenance ni copier ce résultat dans la conversation. Aucun mot de passe n'est intégré aux pages web ou au dépôt. L'interface publique permet aux visiteurs de créer des comptes **clients**, jamais des comptes admin.

Pour changer l'e-mail et renouveler le mot de passe de l'administrateur **sans réinitialiser la base** :

```powershell
php database/change-admin.php --email=admin@example.test --new-email=mon-admin@example.test
```

Un mot de passe aléatoire est alors généré et affiché dans le terminal **local**. Ne modifiez pas `storage/demo-accounts.json` à la main : l'e-mail et le mot de passe doivent aussi être actualisés dans SQLite. La page `/login.html` accueille les clients et les administrateurs et les redirige selon leur rôle.

Pour conserver et transférer le catalogue d'un PC à un autre, il faut sauvegarder la base SQLite et le dossier `public/assets/images/uploads/` (ainsi que les comptes locaux si les comptes de test doivent suivre). Utiliser les outils de sauvegarde documentés dans `docs/BACKEND.md` ; **ne pas copier un fichier SQLite pendant des écritures**. Préférer une restauration cohérente à une simple copie de la base active. Le code seul ne contient pas les données.

## Accès à l'administration GRC

Après démarrage du serveur, ouvrez `http://127.0.0.1:8000/login.html`. Connectez-vous avec l'adresse et le mot de passe **administrateur** indiqués dans `storage/demo-accounts.json` sur votre machine. Vous serez dirigé vers `http://127.0.0.1:8000/admin.html`, où se trouvent le tableau de bord, les clients, les produits, les commandes et le SAV. Utilisez un autre profil de navigateur pour la session client.

Si les produits ou la connexion affichent une erreur de serveur (HTTP 500), vérifiez d'abord les prérequis et la base **sans suppression ni réinitialisation** :

```sh
php database/doctor.php
```

Cette commande lit uniquement la configuration PHP et le fichier SQLite local ; elle n'affiche pas les mots de passe. Si elle signale `pdo_sqlite` absent, activez l'extension dans le `php.ini` chargé par le terminal. Si le diagnostic est bon, consulter localement `storage/errors.log` et le terminal PHP pour identifier la cause. Ne partagez jamais `storage/demo-accounts.json`.

## Parcours de démonstration GRC

1. **Boutique** : rechercher un produit, ouvrir sa fiche, l'ajouter au panier.
2. **Client** : se connecter avec un compte fictif, valider une **commande simulée** et consulter son historique.
3. **Administration** : avec le compte admin dans un autre profil de navigateur, retrouver la commande, la confirmer puis la déclarer livrée.
4. **Fidélisation** : revenir au client et constater l'attribution des points, une seule fois à la livraison.
5. **GRC interactive / SAV** : ouvrir un ticket côté client ; y répondre et le traiter côté administrateur.
6. **Satisfaction / analytique** : noter la commande livrée ; consulter le tableau de bord, les fiches clients et leurs segments.

Le client ne doit jamais pouvoir consulter les données d'un autre client ni effectuer une opération réservée à l'administration.

## Structure et références

| Emplacement | Rôle |
| --- | --- |
| `public/` | Pages de la boutique, espace client, administration et routeur PHP |
| `app/` | API, validations, services métier et accès à SQLite |
| `database/` | Schéma, initialisation, données fictives et outils de sauvegarde |
| `storage/` | Base, sessions et secrets **locaux**, ignorés par Git |
| `tests/` | Tests automatisés et de recette, lorsqu'ils sont intégrés |
| `docs/` | Contrats d'architecture, API, sécurité et cours de GRC |

Documents de référence : [contrat maître](docs/MASTER_CONTRACT.md), [architecture](docs/ARCHITECTURE.md), [contrat API](docs/API_CONTRACT.md), [modèle de données](docs/DATA_MODEL.md), [exigences de sécurité](docs/SECURITY_REQUIREMENTS.md), [correspondance avec le cours](docs/COURSE_MAPPING.md), [guide backend](docs/BACKEND.md), [guide frontend](docs/FRONTEND.md).

Guides de validation et de reprise : [recette d'intégration](docs/INTEGRATION.md), [scénario de soutenance](docs/DEMO.md), [état des tests](docs/QA_REPORT.md), [passation de coordination](docs/COORDINATION_HANDOFF.md).

**État actuel du projet et tâches restantes :** [avancement estimé et feuille de route](docs/PROJECT_STATUS.md).

## Vérifications rapides avant la soutenance

Après avoir installé PHP et ses extensions, on peut effectuer des contrôles sans modifier la base locale active :

```sh
php tests/storage-recovery.php
php tests/domain-integration.php
```

Pour comparer les validations d'images et rejouer un parcours complet avec des comptes et une base **temporaires et isolés**, **Node.js 18+ est requis uniquement pour ces tests**, pas pour utiliser le site :

```sh
node tests/image-path-contract.mjs
node tests/http-journey.mjs
```

La vérification automatisée GitHub Actions (`.github/workflows/grc-smoke.yml`) exécute sur un environnement Linux isolé des contrôles de syntaxe, d'initialisation SQLite, d'images, de sauvegarde/restauration et quelques requêtes HTTP publiques/privées. **Elle ne remplace pas les tests interactifs complets du Chat C ni un essai Windows 11 réel**.

## Sécurité et limites de la démonstration

- La base et les comptes de démonstration restent **hors de `public/`** et ne doivent pas être ajoutés à Git.
- Les montants, rôles, stocks et droits d'accès sont vérifiés **par le serveur**, jamais uniquement par JavaScript.
- Le serveur intégré `php -S` est réservé au **développement local ou à un réseau de confiance**. **Ne pas l'exposer directement à Internet.**
- Une éventuelle présentation distante nécessite une configuration HTTPS sécurisée, des tests complémentaires et le retrait de l'accès ensuite.
- Les contrôles réalisés séparément par les développeurs ne remplacent pas une **recette de bout en bout** avec le frontend et le backend réunis, notamment sous Windows.

En cas d'erreur, commencer par vérifier le terminal PHP, les extensions, l'existence de `storage/grc.sqlite`, puis les erreurs réseau du navigateur. Les réponses HTTP ne doivent jamais afficher de secrets ni de traces PHP internes.

## Sauvegarde complète de l'état de démonstration

Pour garder l'état des essais (base SQLite, identifiants privés et photos de produits importées), **arrêter PHP**, puis utiliser un dossier encore inexistant :

```powershell
php database/backup-bundle.php --to=storage/avant-presentation
```

Le dossier privé est ignoré par Git. Le copier dans un autre emplacement privé, sans publier les mots de passe. **Aucun reset n'est nécessaire pour mettre à jour le code.** Une éventuelle restauration ne s'effectue que volontairement :

```powershell
php database/restore-bundle.php --from=storage/avant-presentation --replace --confirm
```

Ne lancer cette commande que serveur arrêté et après vérification de la source ; elle remplace la base, les comptes et les photos. Le guide complet est dans [docs/BACKEND.md](docs/BACKEND.md).

