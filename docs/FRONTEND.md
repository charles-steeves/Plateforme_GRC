# Frontend GRC — Plateforme de vente en ligne et relation client

> Mise à jour administration : palette bleu/cyan locale, barre latérale repliable et accessible au clavier, section compte/déconnexion, indicateurs épurés et chemin relation client visible. Le tableau de bord se rafraîchit toutes les 12 secondes **uniquement si l'onglet est visible et connecté**, au moyen de requêtes HTTP, sans WebSocket. Voir `docs/COURSE_IMPLEMENTATION_AUDIT.md`. Aucune donnée enregistrée n'est remise à zéro par cette modification.

> Actualisation de l'expérience utilisateur (29 octobre 2026) : formulaire catalogue organisé en grille responsive (recherche, catégorie, actions) et simplification des libellés jugés trop techniques. Les douze pages HTML et les espaces client/admin n'affichent plus de bandeaux « projet universitaire / données fictives » ; ces restrictions restent réelles et documentées côté serveur. Le formulaire d'inscription présente « Nom complet », « Adresse e-mail » et une aide courte pour le mot de passe ; la borne sécuritaire de 72 octets demeure appliquée en JavaScript et PHP. Les erreurs 500 restent masquées côté navigateur et doivent être diagnostiquées dans les journaux privés. Voir `tests/ux-copy.mjs`. Aucun paiement, email commercial ou livraison réelle n'est ajouté.

> Mise à jour ciblée UI du 29 octobre 2026 : typographie locale unifiée (sans police non livrée), suppression de la famille serif isolée sur le grand titre, en-tête neutre plus souple entre 801 et 1100 px, navigation mobile et paniers améliorés sur écran étroit. Les douze pages partagent toujours le même CSS, sans modification des appels API ni des données. Le test `node tests/ui-style-contract.mjs` protège ces règles structurelles. **Le rendu sur Windows 11, les caractères anormaux signalés et l'ensemble des résolutions restent à vérifier en situation réelle.**

Finalisation du chantier A sur `feature/frontend-finalization`, créée depuis
`main` au commit `376f9a627174e30d372c61d74a3239e6767b85bb`, après fusion des
premiers développements frontend et backend. Contrats v3.0 relus et conservés.
Le design existant est conservé : aucun HTML ni CSS n'a été refait.
Périmètre : `public/*.html`, `public/assets/**` et ce document uniquement.
Aucun routeur PHP, schéma SQL, contrat partagé ou fichier du chantier QA n'est modifié.

## Exécution

Les pages utilisent HTML, CSS et JavaScript ES modules, sans dépendance externe,
CDN, compilation ou installation npm. Les prix sont des entiers XAF, affichés en
FCFA ; les dates sont affichées dans le fuseau du Gabon (`Africa/Libreville`).

Après initialisation de la base fictive selon `docs/BACKEND.md`,
depuis la racine du dépôt, sous Linux comme sous Windows avec PHP dans le PATH :

```sh
php -S 127.0.0.1:8000 -t public public/router.php
```

Le véritable routeur PHP, les services métier et SQLite sont maintenant intégrés.
La commande de démarrage a été exécutée sur loopback pendant la recette navigateur,
avec `GRC_DB_PATH` pointant vers une nouvelle base fictive hors du dépôt. La base
locale de démonstration éventuellement présente n'a pas été réinitialisée ni modifiée.
Un serveur statique ne remplace pas cette API. Ne pas ouvrir les pages par
`file://`, ni servir la racine du dépôt.

Pour préparer une base **neuve et isolée** sous Linux :

```sh
grc_test_dir=$(mktemp -d)
php database/init.php --db="$grc_test_dir/grc.sqlite"
GRC_DB_PATH="$grc_test_dir/grc.sqlite" php -S 127.0.0.1:8000 -t public public/router.php
```

Les comptes fictifs sont générés dans `demo-accounts.json`, à côté de cette base.
Les consulter localement, sans publier ni copier leurs mots de passe dans Git.
Utiliser deux profils de navigateur distincts pour le client et l'administrateur.
Sous Windows, suivre le démarrage de README/BACKEND et fournir un chemin absolu
privé distinct via `GRC_DB_PATH` ; l'exécution Windows reste à vérifier.

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
  Aucun POST/PATCH n'est rejoué automatiquement. Une erreur de récupération CSRF
  est identifiée **avant envoi** : aucune mutation n'a été envoyée, et l'action reste
  réessayable. Après envoi, une réponse perdue ou invalide est traitée comme incertaine.
  Cette distinction est partagée par commande, produits, transitions et SAV.
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
  Le routeur PHP envoie également `nosniff`, `frame-ancestors 'none'`, etc. : ces
  en-têtes ont été conservés et les scripts externes fonctionnent avec cette CSP.

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
Le panier n'est vidé qu'après confirmation cohérente du serveur, et seulement s'il
n'a pas changé depuis l'envoi. Une modification dans un autre onglet avant le POST
impose de recharger les quantités ; une modification pendant le POST est conservée
et signalée sur le reçu. La commande créée reste celle de l'instantané envoyé.

Le contrat ne fournit pas de clé d'idempotence de création de commande/ticket :
une fermeture, navigation ou recharge complète pendant une requête peut perdre
les gardes en mémoire. Ne pas relancer une création sans vérifier les données
serveur. La recette actuelle vérifie les autorisations, les effets SQLite et
l'unicité des points/avis sur le parcours testé ; le JavaScript ne garantit pas
l'idempotence d'une création après fermeture ou rechargement complet de la page.

L'API n'expose ni édition du profil, ni lecture des avis déjà déposés. Le profil
reste donc consultable seulement ; le formulaire d'avis apparaît pour les commandes
livrées et explique le conflit 409 si le serveur refuse un nouvel avis. Aucun champ
ou endpoint supplémentaire n'a été inventé.

## Corrections de finalisation

- Mot de passe : validation d'inscription sur **12 caractères Unicode minimum** et
  **72 octets UTF-8 maximum**, conformément au PHP/bcrypt livré. Les emojis ne sont
  plus comptés seulement comme unités UTF-16 ; la longueur est vérifiée aussi avant
  envoi. La connexion n'impose pas une nouvelle règle de longueur minimale aux
  identifiants existants, mais conserve la borne PHP de 72 octets. Aucun mot de passe
  n'est tronqué silencieusement.
- Produits : prix maximal 1 000 000 000 000 XAF, stock maximal 1 000 000 000,
  description 4 000 caractères, catégorie 120, image 500. La validation locale des
  chemins image doit suivre exactement la grammaire du backend : noms sûrs avec
  lettres, chiffres, `_`, `-` et points internes, extensions avec casse variable ;
  chemins traversants, encodés et URL externes restent interdits.
- Réseau : une panne CSRF avant POST ne bloque plus à tort le formulaire comme si
  l'action avait pu réussir. Les brouillons et champs restent utilisables après
  rétablissement, sans envoi automatique. Une véritable réponse POST perdue après
  écriture SQLite continue de bloquer les renvois et dirige vers les données serveur.
- Panier multi-onglet : détection avant envoi et conservation des changements reçus
  pendant l'envoi, avec avertissement explicite et reçu serveur inchangé.
- Retour après authentification : conservation du paramètre de ticket dans le lien
  privé, sans assouplir la liste des destinations autorisées de `customer.js`.

## Vérifications de cette livraison

Hôte Linux Debian 13, PHP 8.4.27, SQLite 3.46.1, Node 24.19.0 et Chromium
154.0.8037.57 via Playwright ; 29 octobre 2026.

Les harnais sont conservés hors du checkout dans
`/workspace/scratch/frontend-finalization/`. Chaque exécution initialise une nouvelle
base dans un répertoire `run-*`, lance le **véritable routeur PHP** avec cette base,
utilise des contextes navigateur client/admin/autre client distincts, puis arrête
le serveur. Aucune base ou donnée de test, aucun compte et aucun secret ne sont livrés.
Les vérifications SQL en lecture confirment les effets de l'API sur cette base.

```sh
node /workspace/scratch/frontend-finalization/real-backend.cjs
node /workspace/scratch/frontend-finalization/edge-cases.cjs
```

**Résultats : 27 scénarios d'intégration réelle PASS, 0 FAIL**
(13 groupes de parcours complet et 14 groupes de cas limites).

| Vérification avec le véritable backend | Preuve observée |
| --- | --- |
| Catalogue/recherche/catégorie/vide et pagination après création du 13e produit | Données SQLite réelles, 12 puis 1 produit affiché, liens précédent/suivant fonctionnels |
| Inscription, connexion client/admin et déconnexion | Client créé en base, pas de login implicite, cookie HttpOnly/SameSite=Lax et session révoquée au logout |
| Panier → commande simulée | Prix et stock lus depuis PHP, 190 000 XAF pour deux articles, stock décrémenté et panier vidé après confirmation |
| Confirmation/livraison → fidélité | Une seule ligne de crédit de 190 points malgré un second PATCH delivered, solde visible côté client |
| Annulation administrative | Stock restauré une seule fois, répétition idempotente, livraison ultérieure refusée 409 |
| Avis sur commande livrée | Note conservée en SQLite, second avis refusé 409 |
| SAV client/admin | Commande liée, messages des deux rôles, résolution/fermeture, refus 409 de message sur ticket fermé |
| Produits admin | Création, PATCH des seuls champs changés, désactivation et 404 public du produit inactif |
| Connaissance client/analytique | Fiche et historique réels ; cinq segments présents ; CA, satisfaction, compte clients comparés aux requêtes SQLite |
| Permissions et expiration | Admin refusé au client 403, ticket d'autrui masqué 404, retrait du profil après vraie réponse 401 |
| Réseau/CSRF | Offline avant CSRF : zéro écriture, champs conservés, reprise explicite ; token obsolète : 403 sans mutation puis reprise réussie |
| Perte de réponse après POST réel | Commande présente une seule fois en SQLite ; résultat incertain affiché et envoi supplémentaire bloqué |
| Multi-onglet | Changement avant commande : zéro POST jusqu'à relecture ; changement pendant POST conservé après le reçu |
| Limites de saisie | Mots de passe invalides refusés localement ; inscription/login réels avec 18 emojis = 72 octets ; limites produit et chemins image alignés PHP |
| Rendu et XSS | 12 pages à 360 px sans débordement ni exception JS ; messages HTML/JS conservés comme texte côté client et admin |

Rapports de la dernière exécution :

- Parcours : `/workspace/scratch/frontend-finalization/run-K1CFDg/report.json` (13 PASS).
- Cas limites : `/workspace/scratch/frontend-finalization/run-CYkCDd/report.json` (14 PASS).
- Les rapports consignent chemin/méthode/statut des réponses API sans mot de passe,
  cookie ou valeur de token ; les comptes générés restent dans le répertoire privé.
- Avant correction, les trois tests ciblés de validation mot de passe, limite produit
  et panne CSRF échouaient réellement (`run-SOYZzF/report.json`) ; ils passent après
  correction. Les autres parcours déjà fonctionnels ont été conservés.

Les coupures réseau utilisent le mode hors connexion de Chromium. Deux essais
interceptent seulement le transport d'un **vrai POST PHP** : l'un retarde sa réponse
pour modifier le panier dans l'autre onglet, l'autre la perd après écriture SQLite.
Ils ne fabriquent aucun JSON ni succès métier.

Une régression complémentaire des JSON incorrects et cas difficiles utilise
l'ancien harnais **MOCK explicite**, distinct de la recette réelle :

```sh
CHECK_FILTER='^(checkout|customer)' node /workspace/scratch/frontend-checks/browser-check.cjs
node /workspace/scratch/frontend-checks/support-uncertainty.cjs
```

Les **24 contrôles complémentaires PASS** (17 cas commande/compte et 7 cas SAV)
restent des tests MOCK, distincts des 27 scénarios d'intégration réelle.

Ces scripts et leurs rapports ne sont pas versionnés dans la PR : la suite durable
`tests/**` appartient au chantier QA. Les commandes ci-dessus sont celles réellement
exécutées dans cette machine, pas une dépendance nécessaire au site.

### Limites et points à transmettre au coordinateur

Aucune correction backend nécessaire au parcours testé n'a été identifiée ; aucun
fichier PHP, schéma ou contrat n'a été modifié. Le profil reste en lecture seule et
les avis existants ne peuvent pas être lus individuellement avec l'API actuelle ;
le conflit 409 évite de prétendre enregistrer un second avis. Il n'est pas proposé
de modifier le contrat pour ces limites connues. La mention historique de
`docs/BACKEND.md` indiquant l'absence de `index.html` est devenue obsolète après la
fusion ; son propriétaire pourra l'actualiser, sans modification ici.

**NON EXÉCUTÉS dans cette finalisation :** Windows 11, PHP 8.2 exact, autres moteurs
de navigateur et lecteur d'écran, publication HTTPS/tunnel, tests de charge,
concurrence multiprocessus et recette complète du limiteur de connexion.
L'idempotence de création à travers une fermeture/recharge complète reste une
limite du contrat, qui ne fournit pas de clé d'idempotence. Après une réponse perdue,
consulter l'historique avant toute nouvelle création.


## Upload d'images de produits depuis la galerie

> Upload de photos demandé le 29 octobre 2026 : l'administrateur peut choisir une image de sa galerie (sélecteur natif de fichiers), cliquer sur « Importer l’image » et enfin enregistrer le produit. Le navigateur envoie un FormData avec jeton CSRF à `/admin/product-image` ; le backend renvoie un chemin local validé. Les images ne sont ni importées de l'extérieur ni poussées sur Git. Accès depuis un smartphone uniquement si le serveur est correctement accessible sur un réseau privé de confiance ; `127.0.0.1` sur le téléphone ne désigne pas le PC.
