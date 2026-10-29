# GRC — Guide d'intégration et de recette

État de la procédure : 29 octobre 2026. Complément pratique à `README.md` et aux contrats v3. Aucune recette Windows réelle n'est présumée réussie.

## 1. Environnement minimal

- **Windows 11 ou Linux** ; Git et VS Code facultatifs à l'exécution.
- **PHP 8.2+ x64** avec PDO, `pdo_sqlite`, `sqlite3`, `json` et `session`.
- Un navigateur récent. **Node.js 18+ uniquement pour les tests JavaScript et HTTP automatisés**, pas pour exploiter la plateforme.
- Aucune base MySQL ni npm/Composer requis pour la version actuelle.

Commandes de diagnostic depuis le dossier du dépôt :

```sh
php --version
php --ini
php -m
php -r "print_r(PDO::getAvailableDrivers());"
```

La sortie du dernier appel doit contenir `sqlite`. Si `php database/init.php` signale `could not find driver`, configurer **le php.ini chargé par le CLI** et activer les extensions `pdo_sqlite` et `sqlite3`. Sous Windows, vérifier aussi `extension_dir` et redémarrer le terminal. Ne pas supprimer la base pour résoudre un pilote manquant.

## 2. Mise en route locale sans effacement

1. Cloner ou mettre à jour le dépôt. Rester sur la branche `main` fusionnée et validée.
2. Depuis la racine : `php database/init.php` **seulement si** `storage/grc.sqlite` et les comptes fictifs n'existent pas déjà.
3. Démarrer : `php -S 127.0.0.1:8000 -t public public/router.php`.
4. Ouvrir `http://127.0.0.1:8000/` et `http://127.0.0.1:8000/api/v1/products`.
5. Ouvrir localement `storage/demo-accounts.json` pour identifier **un client** et **l'administrateur**. Ce fichier ne doit jamais être envoyé à GitHub, partagé ni publié.
6. Utiliser **deux profils ou deux navigateurs distincts** afin d'éviter le partage des cookies entre sessions admin/client.
7. Arrêter le serveur avec Ctrl+C dans le terminal correspondant.

La base, les mots de passe fictifs et les sessions sont privés. L'initialisation d'une base déjà présente est bloquée par défaut ; `--reset` détruit les données fictives et ne doit jamais être utilisé simplement pour diagnostiquer un problème.

## 3. Tests automatisés isolés

Depuis la racine du dépôt :

```sh
php tests/domain-integration.php
php tests/storage-recovery.php
node tests/image-path-contract.mjs
node tests/http-journey.mjs
```

Les deux premiers tests utilisent respectivement une base SQLite **en mémoire** et un dossier **temporaire**. Le test HTTP lance son propre serveur PHP sur un port local disponible, avec une **nouvelle base temporaire** et des comptes fictifs générés pour le test. Aucun de ces tests n'utilise `storage/grc.sqlite`.

Sur GitHub, `.github/workflows/grc-smoke.yml` réalise la syntaxe PHP, une initialisation fictive, ces tests et de petits contrôles HTTP. Sa réussite sur Linux **ne prouve pas** la conformité Windows, la qualité visuelle ni une publication Internet sûre.

## 4. Parcours manuel prioritaire (à consigner)

| Test | Action | Observation attendue |
| --- | --- | --- |
| M1 | Visiteur ouvre boutique et produit | Catalogue et prix XAF réels de SQLite, aucun paiement |
| M2 | Client fictif s'inscrit puis se connecte | Un nouveau compte `client`, jamais `admin` |
| M3 | Client ajoute un produit et commande | Commande en attente en base, prix/stock côté serveur |
| M4 | Administrateur affiche/valide/livre la commande | Un seul changement d'état autorisé à la fois |
| M5 | Client actualise ses points | Crédit une seule fois, même après double demande de livraison |
| M6 | Client crée un ticket, admin répond | Historique commun des messages, propriétaire contrôlé |
| M7 | Administrateur clôt le ticket | Nouveau message refusé sur ticket fermé |
| M8 | Client note la commande livrée | Une seule note autorisée ; satisfaction calculée |
| M9 | Administrateur ouvre dashboard et fiche client | Historique, segment et indicateurs provenant de SQLite |
| M10 | Client tente un accès admin ou aux tickets d'autrui | Refus HTTP 403 ou 404, aucune donnée sensible |
| M11 | Coupure réseau simulée pendant une création | Aucune fausse confirmation, historique à contrôler avant renvoi |
| M12 | Vue mobile, grand écran et navigation clavier | Pas de débordement, police/accents cohérents, focus visible |
| M13 | Deux postes sur réseau local de confiance | Mêmes changements visibles depuis les deux appareils |
| M14 | Test de restauration après sauvegarde fictive | Base préservée si remplacement non demandé ou échoue |

**Marquer chaque test PASS, FAIL ou NON EXÉCUTÉ avec date, machine et preuve.** Les cas M12–M14 restent à effectuer sur le matériel concerné ; aucune preuve n'est extrapolée des rapports Linux des agents.

## 5. Contrôles de publication éventuelle

Une page accessible via Cloudflare ou un autre tunnel ne doit **jamais** être assimilée automatiquement à une exploitation sécurisée. Avant toute démonstration hors LAN : valider HTTPS, `GRC_ORIGIN`, la confiance du proxy, les cookies, CSRF/Origin, les restrictions d'accès, le caractère uniquement fictif des données, les limites de requêtes et l'arrêt du tunnel après l'événement.

Le serveur `php -S` reste réservé au local ou à un réseau de confiance ; ne pas l'exposer directement sur Internet.

## 6. Restitution des anomalies

Pour tout bug : préciser l'URL/écran, le rôle utilisé, l'action, le résultat attendu, le résultat observé, l'heure, le navigateur, la version PHP, le statut de réponse dans l'onglet Réseau, et une capture **sans secrets**. Pour une anomalie CSS : joindre la résolution d'écran et indiquer la police ou le composant concerné.

Corriger par PR de portée limitée ; ne pas masquer un bug par une maquette ou en réinitialisant les données. Ne pas lancer simultanément plusieurs agents sur les mêmes fichiers.
