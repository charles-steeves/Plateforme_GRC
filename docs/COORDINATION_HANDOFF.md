# GRC — Passation de coordination (29 octobre 2026)

**Statut : document opérationnel vivant, distinct du contrat maître.** Ne jamais interpréter un état Git horodaté comme l'état en temps réel : **reconsulter GitHub** au début d'une nouvelle session.

Dépôt privé : [Nemsis7036/GRC-Plateforme](https://github.com/Nemsis7036/GRC-Plateforme).

## 1. Historique Git et livraison courante

| Pull request | Objet | Statut constaté |
| --- | --- | --- |
| [#1](https://github.com/Nemsis7036/GRC-Plateforme/pull/1) | Backend PHP / SQLite initial | Fusionnée |
| [#2](https://github.com/Nemsis7036/GRC-Plateforme/pull/2) | Frontend client/admin initial | Fusionnée |
| [#3](https://github.com/Nemsis7036/GRC-Plateforme/pull/3) | Finalisation frontend / intégration réelle | Fusionnée |
| [#4](https://github.com/Nemsis7036/GRC-Plateforme/pull/4) | Finalisation backend / installation | Fusionnée |
| [#5](https://github.com/Nemsis7036/GRC-Plateforme/pull/5) | Fiabilisation intermodules, harmonisation du nom et régressions | **Fusionnée** |
| [#6](https://github.com/Nemsis7036/GRC-Plateforme/pull/6) | Typographie, navigation responsive et contrôles UI | **Fusionnée** |
| [#7](https://github.com/Nemsis7036/GRC-Plateforme/pull/7) | Textes naturels et diagnostic PHP | **Fusionnée** |
| [#8](https://github.com/Nemsis7036/GRC-Plateforme/pull/8) | Refonte limitée admin bleu/cyan, navigation, cours, polling | **Ouverte lors de cette mise à jour** |
| [#9](https://github.com/Nemsis7036/GRC-Plateforme/pull/9) | Upload photos + création d'admins CLI | **Ouverte lors de cette mise à jour** |
| [#7](https://github.com/Nemsis7036/GRC-Plateforme/pull/7) | Présentation commerciale naturelle, recherche alignée et diagnostic PHP | **Préparée sur sa branche ; à fusionner après tests** |

La PR #5 et la PR #6 sont fusionnées dans `main`. Les retouches de textes, le formulaire de recherche et le diagnostic SQLite sont sur `feature/ux-natural-language-grc-20261029` (PR #7), non intégrées à `main` avant fusion. Voir [l'état du projet](PROJECT_STATUS.md) pour les estimations et les tâches restantes.

Les anciennes fiches de passation V1/V2/V3 décrivent des **états historiques** ; leurs passages disant « PR #3/#4 ouvertes » ne sont plus actuels.

## 2. Sources normatives et décisions à respecter

Commencer par `docs/MASTER_CONTRACT.md` **sections 0–9** (la section 9 est un addendum, non une réécriture), puis `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `API_CONTRACT.md`, `DATA_MODEL.md`, `SECURITY_REQUIREMENTS.md` et `COURSE_MAPPING.md`.

**P0 approuvé :** plateforme de vente en ligne et GRC, identité et nature de l'entreprise à décider ; produits, comptes, sessions, panier, commande enregistrée, stock, historique, espace client/admin, fiches et segmentation, SAV avec messages, fidélité à livraison une seule fois, satisfaction, tableau de bord et sécurité. Une vraie base partagée, mais **ni transaction financière réelle ni données personnelles réelles**.

**Architecture figée v1 :** frontend HTML/CSS/JS ; PHP 8.2+ ; PDO/SQLite local privé. Un backend, une base ; Windows 11 et Linux. Aucun service distant/nom de domaine/abonnement de codage obligatoire.

**Modifications possibles mais non encore validées comme P0 :** plusieurs administrateurs avec gestion des rôles, upload d'images, choix futur du nom/de l'entreprise/du catalogue, GRC marketing plus poussée, ouverture Internet. Ne pas les inventer. Voir section 9.2 du contrat maître.

**Décisions du 29 octobre 2026 à appliquer partout :** retirer l'ancien nom commercial provisoire et toute affirmation qualifiant l'entreprise de fictive. En outre, éviter les avertissements répétitifs « projet universitaire / données fictives / aucun paiement réel » et les détails techniques du mot de passe dans l'interface visible ; conserver ces restrictions dans les contrats et le backend. Employer « Plateforme GRC » comme intitulé neutre en attendant un choix explicite du nom, du statut et du secteur de l'entreprise. Les données d'essai et les commandes simulées restent nécessaires à la recette.

## 3. Ce qui a été corrigé dans la PR #5

1. **Image `image_url` :** harmonisation des chemins internes sûrs entre `public/assets/js/ui.js` et `app/Services/ProductService.php`. Un nom avec point interne ou extension majuscule accepté par PHP doit être cohérent avec le JS ; les chemins dangereux restent refusés.
2. **Restauration SQLite :** `database/sqlite-copy.php` réutilise l'installateur sécurisé de `database/install-files.php` afin de préserver une destination existante en cas d'échec d'installation d'une copie.
3. **Incident Windows :** `docs/BACKEND.md` corrigé. Erreur réellement rapportée : `php database/init.php` → `could not find driver`, signe d'indisponibilité de PDO SQLite dans le PHP CLI ; ne pas prétendre que PHP n'était pas installé.
4. **Contrats :** ajout de la section 9 au contrat maître, sans suppression des sections précédentes ; distinction explicite entre contraintes confirmées, hypothèses et nouveaux besoins.
5. **Tests et documentation :** scripts dans `tests/`, workflow `.github/workflows/grc-smoke.yml`, README mis à jour. Aucun changement de schéma ou route API.

## 4. Tests et limites

Les tests ajoutés sont exécutables séparément :
- `php tests/domain-integration.php` : transactions commandes/stock, points, avis, tickets et segmentation sur SQLite **en mémoire**.
- `php tests/storage-recovery.php` : sauvegarde/restauration et refus d'écrasement dans un dossier temporaire.
- `node tests/image-path-contract.mjs` : cohérence de validation des images PHP et JS.
- `node tests/http-journey.mjs` : véritable serveur PHP et base temporaire, sessions client/admin distinctes, parcours vente → livraison → fidélité → SAV → satisfaction.
- Workflow GitHub Actions : lint PHP, init de base fictive, tests ci-dessus et garde-fous HTTP.

**Important :** le premier workflow de cette PR a réussi avant l'ajout du test de parcours HTTP complet. Vérifier son dernier run sur GitHub avant de considérer tous les tests réussis. Node 18+ n'est requis que pour les tests, pas pour l'application.

Non validés : exécution réelle sur l'ordinateur Windows 11 de l'utilisateur, CSS/polices et encodage à l'écran, accessibilité exhaustive, Chrome/Firefox/Edge à plusieurs tailles, tunnel HTTPS réel, charge multi-utilisateur complète et recette indépendante exhaustive du Chat C.

## 5. Règles opérationnelles pour les prochaines conversations

- Toujours vérifier `main`, les branches, les PR et leur état exact sur GitHub. **Ne pas travailler à partir d'un ancien SHA sans contrôle**.
- Travailler en branches séparées par périmètre, préparer une PR, puis revue avant fusion. Ne jamais forcer push, écraser des fichiers d'autres agents ni réinitialiser `storage/` sans sauvegarde et consentement.
- L'utilisateur souhaite économiser les crédits Codex : privilégier ChatGPT classique/GitHub pour la coordination et les corrections ciblées.
- **Prochaine priorité :** valider la PR #5, poursuivre les tests et la recette C sur `main` après fusion, puis recueillir les défauts visuels précis (captures ou description) pour homogénéiser CSS, typographie et UTF-8.
- Les fonctions non approuvées (gestion multi-admin, upload) doivent faire l'objet d'une décision avant ajout et d'une mise à jour **additive** des contrats concernés.
- L'utilisateur a indiqué avoir ouvert le site localement ; cela ne prouve ni le fonctionnement de SQLite sous Windows, ni la sécurisation d'une publication externe.

Aucune conversation ne surveille les autres chats en arrière-plan. Le présent fichier sert de passation ; **il ne remplace ni l'état GitHub direct ni une vérification indépendante des tests**.
