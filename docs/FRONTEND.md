# Frontend GRC — Équateur

Implémentation du chantier A sur `feature/frontend`, à partir des contrats v3.0.
Périmètre : `public/*.html`, `public/assets/**` et ce document uniquement.
Aucun routeur PHP, schéma SQL, contrat partagé ou fichier du chantier QA n'est modifié.

## Exécution

Les pages utilisent HTML, CSS et JavaScript ES modules, sans dépendance externe,
CDN, compilation ou installation npm. Les prix sont des entiers XAF, affichés en
FCFA ; les dates sont affichées dans le fuseau du Gabon (`Africa/Libreville`).

Après intégration du backend B et initialisation de sa base selon sa documentation,
depuis la racine du dépôt, sous Linux comme sous Windows avec PHP dans le PATH :

```sh
php -S 127.0.0.1:8000 -t public public/router.php
```

Cette commande est celle du contrat ; elle n'a pas pu être exécutée avec le backend
GRC pendant cette livraison, car `public/router.php`, `app/` et `database/` sont
absents de `main` au commit de base `0df7a0cd67ac1ac40b6d6d44e6a234a4300dfc96`.
Une dernière consultation distante pendant le développement ne montrait que main.
Un serveur statique suffit à examiner les pages et leurs erreurs d'indisponibilité,
mais ne permet pas de commander, s'authentifier ou enregistrer des données.
Ne pas ouvrir les fichiers par `file://`, ni servir la racine du dépôt.

Dans l'environnement cloud préparé précédemment, activer PHP avec :

```sh
source /workspace/.grc-environment/activate.sh
```

Aucun compte administrateur, secret, mot de passe ou jeu de données n'est créé par
le frontend. Seul le backend initialise les comptes fictifs et la base privée.

## Écrans et interactions

| Page | Comportement implémenté | Routes utilisées, sous `/api/v1` |
| --- | --- | --- |
| `/`, `index.html` | Catalogue, recherche, catégorie, pagination serveur, stock, états vides/erreur | `GET /products?search=&category=&page=&per_page=12` |
| `product.html?id=N` | Fiche, prix XAF, image locale, description, quantité et ajout au panier | `GET /products/{id}` |
| `cart.html` | Vérification actuelle de chaque ligne, quantités/retrait, total indicatif, confirmation d'achat fictif et reçu serveur | `GET /products/{id}`, `POST /orders` |
| `register.html`, `login.html` | Inscription client, connexion, visibilité du mot de passe, retour sécurisé vers la page demandée | `GET /auth/me`, `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login` |
| `account.html` | Profil en lecture seule, détail des commandes, avis sur livraison, solde et historique de fidélité | `GET /orders/me`, `POST /feedback`, `GET /loyalty/me` |
| `tickets.html` | Ouverture avec commande facultative, liste, recherche/statut locaux, conversation et réponse | `GET /orders/me`, `POST /tickets`, `GET /tickets/me`, `GET /tickets/{id}`, `POST /tickets/{id}/messages` |
| `admin.html` | Clients, commandes, CA simulé livré, SAV, satisfaction, inactivité et répartition des commandes | `GET /admin/dashboard` |
| `admin-products.html` | Liste, création, édition des seuls champs modifiés, activation/désactivation ; aucun DELETE | `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/{id}` |
| `admin-orders.html` | Client, lignes, total, filtres locaux, confirmation/livraison/annulation selon transitions autorisées | `GET /admin/orders`, `PATCH /admin/orders/{id}` |
| `admin-customers.html` | Recherche et pagination serveur, segment, historique, SAV et points du client sélectionné | `GET /admin/customers?search=&page=&per_page=20`, `GET /admin/customers/{id}` |
| `admin-tickets.html` | Demandes clients, conversation, réponse et transitions de statut | `GET /admin/tickets`, `GET /tickets/{id}`, `POST /tickets/{id}/messages`, `PATCH /admin/tickets/{id}` |

Le shell commun consulte `GET /auth/me` et permet `POST /auth/logout` avec `{}`.
Les liens d'administration suivent le rôle renvoyé par le serveur. Les pages
privées ne chargent pas leurs données avant vérification de la session et du rôle.
Ces gardes d'interface ne remplacent jamais les permissions/contrôles de propriété PHP.

## Organisation et sécurité d'affichage

- `api.js` : préfixe unique, JSON, cookies `credentials: 'same-origin'`, absence de
  cache, délai de 20 secondes, contrôle des enveloppes et erreurs HTTP/réseau.
  Chaque POST/PATCH obtient un token via `/auth/csrf` et transmet `X-CSRF-Token`.
  Le token est rechargé après login et invalidé au logout. Si sa relecture échoue
  après une connexion réussie, la mutation suivante exige une nouvelle récupération.
  Aucun POST/PATCH n'est rejoué automatiquement.
- `ui.js` : construction DOM par `createElement` et nœuds texte. Aucun contenu API
  n'est inséré avec `innerHTML`, aucune évaluation de code. Les chemins d'images
  sont limités à `/assets/images/` avec une extension de fichier image autorisée ;
  URL externe, protocole JavaScript, traversée de chemin et query string sont refusés.
- `cart.js` : uniquement identifiants produit et quantités, bornes de 20 unités par
  ligne et 30 produits distincts, validation des données locales et synchronisation
  du compteur entre onglets. Aucun prix, rôle, session ou secret n'est stocké.
  Repli vers sessionStorage si localStorage refuse l'écriture ; si les deux sont
  indisponibles, mémoire limitée à la page courante, avec avertissement explicite.
- `app.js` : navigation commune, menu clavier/mobile, rôles, déconnexion, messages
  hors connexion et retrait des données privées à l'expiration de la session.
- `shop.js`, `customer.js`, `tickets.js`, `admin.js` : parcours fonctionnels séparés.
- Chaque page déclare une CSP limitant scripts, styles, images et connexions à
  l'origine locale ; aucun gestionnaire JS inline ni chargement distant.
  Les en-têtes HTTP `nosniff`, `frame-ancestors`, etc. restent à envoyer par PHP.

Le panier envoie exclusivement `{items:[{product_id,quantity}]}`. Le serveur est
l'autorité pour prix, montants, stocks, utilisateur et rôle. Aucun paiement réel,
crédit de fidélité, avis, ticket ou changement de statut n'est simulé localement.
Le solde, la segmentation et les indicateurs sont affichés depuis l'API.

## Erreurs et accessibilité

Libellés liés aux champs, navigation au clavier, lien d'évitement, focus visible,
retours `role=alert/status`, formulaires validés et verrouillés pendant les envois,
états de chargement/vide/refus/erreur, menus et tables défilantes accessibles.
La présentation s'adapte à 320 px et aux grands écrans ; les animations respectent
`prefers-reduced-motion`. Les champs et brouillons sont conservés en cas d'échec.

Une erreur connue (409, 422, etc.) n'est jamais présentée comme une réussite.
Si la réponse à une mutation est perdue ou invalide, l'interface indique un résultat
incertain et bloque les envois concernés. Pour SAV et administration, une relecture
GET réussie est nécessaire avant une nouvelle action ; aucun nouvel envoi n'est
automatique. Pour une commande, consulter l'historique avant toute nouvelle tentative.
Le panier n'est vidé qu'après confirmation cohérente du serveur.

Le contrat ne fournit pas de clé d'idempotence de création de commande/ticket :
une fermeture, navigation ou recharge complète pendant une requête peut perdre
les gardes en mémoire. Ne pas relancer une création sans vérifier les données
serveur. Les transactions, autorisations et contraintes d'unicité restent à tester
sur le backend ; le JavaScript ne garantit pas à lui seul l'absence de doublon.

L'API n'expose ni édition du profil, ni lecture des avis déjà déposés. Le profil
reste donc consultable seulement ; le formulaire d'avis apparaît pour les commandes
livrées et explique le conflit 409 si le serveur refuse un nouvel avis. Aucun champ
ou endpoint supplémentaire n'a été inventé.

## Vérifications de cette livraison

La syntaxe des huit modules JS a été contrôlée avec `node --check` ; les fichiers
HTML ont été inspectés pour liens, ressources locales, CSP, langue et structure.
Le SVG local a été parsé comme XML. `git diff --check` est utilisé avant commit.

Des essais Chromium/Playwright ont été exécutés avec un serveur local et des
fixtures **MOCK réservées aux tests**, hors dépôt dans
`/workspace/scratch/frontend-checks/`. Il n'existe aucun mode mock, fixture ou
fallback simulé dans les fichiers applicatifs livrés. Ces essais vérifient le
frontend et le contrat des requêtes, pas l'implémentation PHP/SQLite.

Commandes du harnais temporaire dans cette machine :

```sh
node /workspace/scratch/frontend-checks/browser-check.cjs
node /workspace/scratch/frontend-checks/support-uncertainty.cjs
```

Les rapports/captures de cette session restent hors des chemins possédés par
l'agent C ; la suite durable `tests/**` est à intégrer par le chantier QA.
Résultats finaux au 29 octobre 2026 : **72 contrôles navigateur réussis**
(65 scénarios distincts du harnais principal et de sa passe ciblée, plus 7 contrôles
SAV indépendants), sans échec applicatif restant. Environnement : Node 24.19.0,
Playwright et Chromium 154.0.8037.57, Linux Debian 13.

Couverture réellement exécutée :

- Chargement des 12 pages, absence d'exception JS et rendu des champs API ;
  contrôle du débordement à 360 px sur cinq écrans et à 320 px sur les 12 pages.
- Menu mobile, navigation clavier, fermeture Échap et restitution du focus.
- Inscription, login, rotation CSRF, déconnexion et refus des redirections externes.
- Catalogue/recherche/catégorie, identifiant invalide, panier, payload de commande
  sans prix ni utilisateur, stock insuffisant et reçu confirmé.
- Refus 409, réseau coupé, 500, JSON incorrect, réponse non JSON HTTP 200 et
  confirmation incomplète : aucun faux succès, panier conservé, pas de double envoi,
  pas de réactivation par rerendu local. Contrôles bloqués pendant un POST retardé.
- Profil, commandes et fidélité, avis livré, champs préservés après conflit.
- Création/message/fermeture SAV, brouillon conservé après réponse incertaine,
  GET échoué sans déblocage puis GET réussi sans POST automatique.
- Dashboard, création/édition produit avec PATCH limité aux champs modifiés,
  confirmation/livraison de commande, recherche/fiche client/segmentation.
- Garde de rôle, expiration de session, panne API ; charges HTML/JS rendues comme
  texte et URL d'image malveillante remplacée par le visuel local.
- Serveur statique réel sans interception API : affichage explicite de
  l'indisponibilité, aucun produit ou résultat de commande inventé.

Les cinq premiers échecs de la passe checkout provenaient d'une attente du harnais
qui précédait la fin du chargement ; l'attente a été corrigée vers le DOM attendu
et les cinq scénarios ciblés ont ensuite réussi. Les rapports intermédiaires ont
été conservés, sans convertir artificiellement des échecs en réussites.
Le rapport final courant est `report-final.json` ; les 7 contrôles SAV ont leur
sortie dédiée `support-uncertainty.cjs`. Les captures ont été examinées pour corriger
le hero, le menu bureau et les tables mobiles. La passe ciblée est reproductible
avec la commande suivante (filtre des seuls scénarios ajoutés ou corrigés) :

```sh
CHECK_FILTER='^(extra |checkout (network|server500|malformed-json|non-json-200|malformed-order))' node /workspace/scratch/frontend-checks/browser-check.cjs
```

### Recette réelle après intégration B, puis C — NON EXÉCUTÉE ici

Sur une base de démonstration isolée : catalogue → compte fictif → commande →
confirmation et livraison administrateur → attribution unique des points →
SAV/message/réponse → avis après livraison → indicateurs actualisés.
Vérifier les refus interclients/admin, CSRF, stock concurrent, rate limiting,
non-exposition des fichiers privés et absence de trace PHP dans les erreurs.
Effectuer la recette Windows 11, la vérification d'un lecteur d'écran et les tests
multi-navigateurs. Aucun de ces résultats ne peut être déduit des fixtures navigateur.
