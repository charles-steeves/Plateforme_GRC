# Équateur — Plateforme universitaire de GRC

Boutique **fictive** et plateforme de **gestion de la relation client (GRC)** pour un projet pédagogique au Gabon. L'application présente les relations entre vente, suivi des commandes, fidélisation, segmentation, satisfaction et service après-vente.

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
3. **Depuis la racine du projet**, initialiser une seule fois la base fictive :

   ```sh
   php database/init.php
   ```

   Cette commande crée `storage/grc.sqlite` et `storage/demo-accounts.json` avec **12 produits, 8 clients et 1 administrateur fictifs**. Les mots de passe sont générés aléatoirement et conservés uniquement dans ce fichier local privé ; ils ne figurent pas dans Git.
4. Démarrer le serveur local :

   ```sh
   php -S 127.0.0.1:8000 -t public public/router.php
   ```

5. Dans le navigateur, ouvrir **http://127.0.0.1:8000/**. Pour vérifier rapidement la réponse de l'API, ouvrir **http://127.0.0.1:8000/api/v1/products** : la réponse doit être un objet JSON avec `success: true` et une liste de produits.

**Sous Windows / PowerShell**, le fichier des comptes peut être ouvert dans VS Code sous `storage/demo-accounts.json` ou consulté localement avec :

```powershell
Get-Content .\storage\demo-accounts.json
```

Il contient les comptes `admin@example.test` et `client1@example.test` à `client8@example.test`, avec leurs mots de passe fictifs propres à votre installation. **Ne jamais publier ni envoyer ce fichier**. Pour tester simultanément le client et l'administrateur, employer deux profils de navigateur distincts, car un même profil partage les cookies de session.

Pour **arrêter le serveur**, revenir au terminal où il fonctionne et appuyer sur **Ctrl+C**. Ne pas relancer `database/init.php` sur une base existante : l'initialiseur refuse volontairement de remplacer les données sans option explicite. `--reset` détruit et recrée les données fictives ; ne l'utiliser qu'après sauvegarde, serveur arrêté et en connaissance de cause.

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
