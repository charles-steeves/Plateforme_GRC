# Projet GRC — État d'avancement et feuille de route

**État établi le 29 octobre 2026.** Ce document est un tableau de bord de coordination, pas un contrat normatif ni une garantie de conformité. Les pourcentages sont des **estimations humaines** fondées sur les exigences et les preuves observées ; ils ne proviennent d'aucun compteur GitHub.

## 1. Avancement global estimé : 80 % (sous réserve de recette Windows)

Méthode : cinq catégories de préparation à la soutenance, pondérées, pour éviter de confondre code écrit et site réellement validé.

| Catégorie | Poids | Avancement estimé | Contribution |
| --- | ---: | ---: | ---: |
| Fonctionnalités client, commerce et GRC P0 | 40 % | 90 % | 36 |
| Backend, SQLite et protections essentielles | 20 % | 90 % | 18 |
| Tests automatisés et vérifications techniques | 15 % | 80 % | 12 |
| Ergonomie, responsive et homogénéité visuelle | 15 % | 65 % | 9,75 |
| Essais Windows 11, appareils réels et préparation de la présentation | 10 % | 40 % | 4 |
| **Total arrondi** | **100 %** | **80 %** | **79,75** |

**Interprétation :** les modules fonctionnels P0 sont largement implémentés et un scénario client/admin fonctionne dans les tests CI Linux. La qualité réelle des écrans sur les PC de l'équipe, la recette du Chat C et l'éventuel accès externe sécurisé ne sont pas encore validés. Ce 80 % ne constitue pas une assurance de fonctionnement universel : les améliorations d'interface sont encore à valider sur le navigateur de l'équipe et une erreur HTTP 500 a été signalée en local.

## 2. État Git constaté à la création de ce document

- PR [#1](https://github.com/Nemsis7036/GRC-Plateforme/pull/1) à [#5](https://github.com/Nemsis7036/GRC-Plateforme/pull/5) : **fusionnées** dans `main`.
- PR [#6](https://github.com/Nemsis7036/GRC-Plateforme/pull/6) : typographie et navigation responsive, **fusionnée**.
- PR [#7](https://github.com/Nemsis7036/GRC-Plateforme/pull/7) : recherche alignée, textes naturels et diagnostic PHP, **fusionnée**.
- PR [#8](https://github.com/Nemsis7036/GRC-Plateforme/pull/8) : bleu/cyan, barre latérale admin, KPI épurés, rafraîchissement dashboard HTTP et correspondance cours, **ouverte à la rédaction**.
- PR [#9](https://github.com/Nemsis7036/GRC-Plateforme/pull/9) : upload sécurisé de photos produits et création facultative d'admins supplémentaires par CLI, **ouverte à la rédaction**. Fusionner dans cet ordre sous réserve des tests et des conflits.
- L'identité commerciale reste **indéterminée** : « Plateforme GRC » est un libellé neutre, et non une marque ; ne pas réintroduire l'ancien nom ni inventer d'entreprise.
- Les données de soutenance et les commandes restent simulées ; aucun paiement réel ni données personnelles réelles.

**Consulter GitHub de nouveau** avant toute reprise ou fusion, car cet état est un instantané daté.

## 3. Fonctionnalités présentes dans la version intégrée

**Visiteur :** catalogue, filtres/recherche, fiche produit, panier.

**Client :** inscription et connexion, commande simulée dans SQLite, historique/statuts, points de fidélité, avis après livraison et dialogue SAV.

**Administration :** produits et stocks, suivi/transition des commandes, fiches et segments clients, suivi des tickets, satisfaction et tableau de bord GRC.

**Backend :** validation des prix et stocks côté PHP, sessions, rôles, séparation des données des clients, CSRF, mots de passe hachés, base SQLite privée et mécanismes de sauvegarde/restauration.

**Preuve :** le workflow CI de la PR #5 a réussi sur Linux (syntaxe, initialisation, tests métiers, HTTP et parcours distinct client/admin). Les suites sont conservées dans `tests/**`. Les essais manuels Windows restent à faire.

## 4. Prochaines étapes par priorité

1. **Fusion contrôlée de la PR #8, puis de la PR #9** après réussite des CI sur leurs commits les plus récents ; vérifier après la première fusion que la seconde PR n'a pas de conflit avant de l'intégrer.
2. **Recette réelle Windows 11** : les extensions SQLite et l'initialisation ont été confirmées par l'utilisateur ; exécuter le site et vérifier en situation la connexion administrateur, le nouveau menu, l'upload JPG/PNG/WebP et les sessions de plusieurs comptes admin, utiliser profils client/admin distincts, parcourir commande → livraison → points → SAV → avis → dashboard. Ne pas réinitialiser une base existante pour réparer une erreur PHP.
3. **Retouches visuelles basées sur captures** : anomalies d'alignement, police, accents, tableaux, formulaire, panier, navigation et mobile. La PR #6 corrige une partie structurelle, mais ne constitue pas une revue visuelle exhaustive.
4. **Chat C / tests indépendants** : compléter `docs/QA_REPORT.md` et `docs/INTEGRATION.md` avec PASS, FAIL et NON EXÉCUTÉ, versions et preuves ; tester permissions, réseau, sécurité et navigations longues.
5. **Soutenance** : répéter `docs/DEMO.md` (5–8 min) sur le matériel et réseau choisis, sans afficher de mots de passe.
6. **Nouvelles fonctionnalités uniquement après décision** : comptes administrateurs multiples, import de fichiers images, GRC enrichie, nom et activité commerciale, exposition distante, etc.

## 5. Limites et règles communes

- Aucune extension des fonctions P1/P2 ou modification d'API sans validation de l'utilisateur et synchronisation des contrats.
- Les PR ne sont pas fusionnées automatiquement par les agents. Chaque chat travaille sur une branche et des fichiers délimités.
- Les défauts CSS perçus par l'utilisateur ne doivent pas être déclarés résolus avant observation sur son navigateur.
- Les scripts `tests/**` utilisent des bases isolées ; ne pas supprimer `storage/grc.sqlite` ni publier `storage/demo-accounts.json`.
- Un tunnel HTTPS éventuel demande une évaluation de sécurité distincte ; le serveur `php -S` n'est pas destiné à l'exposition directe sur Internet.
