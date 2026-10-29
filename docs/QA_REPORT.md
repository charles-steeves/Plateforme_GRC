# GRC — Rapport qualité de référence (29 octobre 2026)

**Ce document distingue les preuves exécutées des essais encore nécessaires.** Il ne prétend pas certifier l'application pour une mise en production. Mise à jour à chaque nouvelle livraison : noter la PR, le SHA, l'environnement et les résultats réellement constatés.

## 1. Périmètre vérifié

Projet universitaire de vente en ligne et de gestion de la relation client, API PHP 8.2+ et base SQLite, frontend HTML/CSS/JS. Le nom et l'identité commerciale restent à déterminer ; les transactions actuellement testées sont uniquement simulées. Scénario de référence : catalogue → commande fictive → traitement admin → livraison → points → SAV → avis → statistiques.

### Preuve GitHub Actions observée

Au cours de la PR [#5](https://github.com/Nemsis7036/GRC-Plateforme/pull/5), le workflow [GRC - syntaxe, SQLite et contrat images, exécution #40819760081](https://github.com/Nemsis7036/GRC-Plateforme/actions/runs/40819760081) a été observé **terminé avec conclusion `success`** sur le commit `6a7e9098cb5014442d7838a8af703d4392f1b53a`.

Les étapes suivantes ont toutes été déclarées réussies par GitHub lors de cette exécution :

- Installation de PHP CLI et de SQLite sur Linux de CI.
- Contrôle des prérequis et syntaxe des fichiers PHP.
- Création de la base fictive neuve et vérification de ses produits.
- Concordance des noms d'images acceptés/rejetés en JavaScript et en PHP.
- Sauvegarde/restauration SQLite isolée et refus de remplacement non autorisé.
- Tests métiers en mémoire : commandes, stocks, fidélité, satisfaction, SAV, rôles et GRC.
- Parcours HTTP client/admin avec serveur PHP réel et base temporaire, sessions distinctes.
- Contrôles HTTP de quelques routes publiques/privées et fichiers protégés.

**Important :** cette preuve correspond au commit indiqué. Vérifier le run du **dernier SHA** avant toute fusion ; d'autres commits purement documentaires ont pu être ajoutés depuis.

### Déclarations historiques des agents A et B

Le guide `docs/FRONTEND.md` rapporte **27 scénarios d'intégration réelle** réalisés par l'agent A sur Linux/Chromium ; le guide `docs/BACKEND.md` rapporte **593 assertions HTTP** et des tests de stockage/init. Les scripts de ces agents n'ont pas été versionnés sous `tests/**` : ils constituent des déclarations de leurs développeurs, **pas** une preuve indépendante accessible au prochain coordinateur.

## 2. Tableau de couverture actuel

| Domaine | Couverture durable dans le dépôt | Reste à vérifier |
| --- | --- | --- |
| Syntaxe PHP et initialization SQLite | Workflow CI, base créée | PHP 8.2 exact et installation Windows utilisateur |
| Catalogue, produits, stock | Tests métiers et HTTP | Gestes réels de saisie admin, affichage navigateur et responsive |
| Comptes et sessions | Parcours HTTP client/admin, quelques refus | Navigation complète, expiration et cas de concurrence sous Windows |
| Commandes fictives | Test métier et parcours HTTP | Ruptures réseau, requêtes concurrentes sous forte charge, idempotence des créations non garantie |
| Fidélisation | Crédit unique testé sur la livraison répétée | Parcours utilisateur complet avec pertes de réponse |
| SAV et propriété | Messages, clôture et refus interclient | Ergonomie, rendu des longs échanges, accessibilité |
| Satisfaction | Avis, doublon interdit, dashboard | Rendu navigateur et agrégation sur jeux complexes |
| Segmentation et dashboard | Requêtes réelles et fiche client | Lisibilité des indicateurs, pertinence des seuils pour la soutenance |
| XSS et protections | HTML construit par nœuds texte ; quelques contrôles de fichiers/CSRF | Campagne sécurité indépendante complète, preuve sur tous les formulaires |
| Interface visuelle | Un premier essai navigateur Linux déclaré par A/B | **Polices, décalages et caractères inhabituels constatés par l'utilisateur** |
| Réseau local / exposition Internet | Documentation des contraintes | Tests réels sur plusieurs appareils ; aucun accès public déclaré sécurisé |
| Sauvegardes | Test local automatisé isolé | Procédure de reprise sur Windows, sauvegarde d'une base avec activité concurrente |

## 3. Recette manuelle attendue du Chat C / du groupe

Voir `docs/INTEGRATION.md` pour la matrice M1–M14 et `docs/DEMO.md` pour la soutenance. Consigner pour chaque contrôle : PASS/FAIL/NON EXÉCUTÉ, machine, version PHP, navigateur, heure et preuve (sans identifiants ni données sensibles). Les tests automatiques sont un **socle**, pas le remplacement des essais visuels et des configurations du PC utilisateur.

**Points bloquants à lever avant une présentation sur le matériel final :**

1. PHP CLI charge `pdo_sqlite` et `sqlite3` ; `php database/init.php` produit une base fictive neuve ou refuse proprement une base existante.
2. Le site fonctionne sous Windows 11 à l'URL locale prévue, sans erreurs de police, d'encodage et de mise en page importantes.
3. Un client et un administrateur, sur sessions séparées, montrent le parcours complet depuis deux fenêtres ou profils.
4. Aucune donnée réelle et aucun mot de passe de démonstration ne sont exposés dans Git, des captures ou la projection.
5. Toute mise en ligne temporaire est testée et sécurisée, ou abandonnée au profit du LAN.

## 4. Risques connus non résolus par cette PR

- L'API n'accepte pas encore de clé d'idempotence : une perte de réponse suivie d'un nouveau POST après rechargement peut entraîner une création doublonnée. Vérifier l'historique avant de renvoyer une commande ou un ticket.
- Les captures et observations esthétiques du PC de l'utilisateur n'ont pas encore été analysées. Ne pas annoncer un design final homogène.
- La gestion multi-administrateur et l'import direct d'images sont des **propositions**, pas des fonctionnalités P0 approuvées.
- Aucune évaluation de résistance DDoS, de conformité de production, de sécurité d'un véritable tunnel HTTPS ni de charge élevée n'a été effectuée.

## 5. Conclusion limitée à l'état observé

La version soumise via la PR #5 bénéficie d'une première suite de tests **reproductibles et vérifiés par CI** sur Linux. Le parcours commercial fictif et GRC est couvert de manière automatisée à plusieurs niveaux, mais **la recette Windows et navigateur de l'équipe reste indispensable**. Le résultat de cette CI ne doit pas être interprété comme une permission de publier directement le serveur PHP intégré sur Internet.
