# ARCHITECTURE — v3.0
## Diagramme logique
Visiteur/client -> pages HTML/CSS/JS (navigateur) -> HTTP JSON /api/v1 -> serveur PHP 8.2+ (routeur -> contrôleur -> service -> dépôt PDO) <-> SQLite privé.
Administrateur -> pages admin HTML/CSS/JS (même origine) -> mêmes endpoints PHP, avec autorisation admin -> même base.
Deux interfaces web, un **seul back-end** et une **seule base** ; pas trois sites distincts, ni deux serveurs actifs à synchroniser.
## Pages de référence
Public : / (accueil/catalogue), /product.html?id=N, /cart.html, /login.html, /register.html.
Client connecté : /account.html (profil, commandes, fidélité, satisfaction), /tickets.html (liste, détail et messages).
Administrateur : /admin.html (dashboard), /admin-products.html, /admin-orders.html, /admin-customers.html, /admin-tickets.html.
Les pages HTML administrateur peuvent être livrées statiquement ; TOUTES leurs données et mutations restent refusées par PHP sans rôle admin. Le navigateur masque/affiche la navigation selon GET /api/v1/auth/me, mais cela ne remplace jamais l'autorisation serveur.
## Piles retenues
Frontend sans gros framework : HTML5, CSS3, JavaScript ES modules ; fetch en JSON same-origin et session cookies. Backend PHP pur 8.2+ et PDO_SQLITE ; pas de Laravel/Filament cette fois pour limiter la configuration. SQL est le langage, SQLite le moteur retenu ; MySQL reste une migration future possible.
## Arborescence
- public/index.html, product.html, cart.html, login.html, register.html, account.html, tickets.html, admin.html, admin-products.html, admin-orders.html, admin-customers.html, admin-tickets.html
- public/assets/css/, js/, images/
- public/index.php (entrée de l'API), public/router.php (adaptateur serveur de développement)
- app/Core/, Controllers/, Services/, Repositories/ et éventuellement app/Config/
- database/schema.sql, database/init.php et outils de génération du jeu fictif
- storage/ créé localement, avec grc.sqlite et logs ; **exclu de Git**, et hors public
- tests/ ; docs/ ; README.md ; .gitignore
## Entrée HTTP
Pour développer : depuis la racine, commande transversale : php -S 127.0.0.1:8000 -t public public/router.php.
Le routeur doit : (a) retourner les ressources statiques existantes sous public ; (b) servir index.html à / ; (c) transférer /api/v1/... à index.php ; (d) renvoyer 404 aux inconnues et interdire l'exposition de fichiers non publics. Ne jamais envoyer des sources PHP comme contenu statique.
Pour LAN : une adresse réseau et un pare-feu adaptés, uniquement sur réseau de confiance. Pour Internet temporaire : reverse proxy/tunnel HTTPS sécurisé, à tester ; ne pas publier directement le serveur intégré PHP.
## Enveloppe API
Réponses JSON dans docs/API_CONTRACT.md ; formats snake_case, dates UTC ISO 8601 (« Z ») et affichage local Gabon dans le navigateur, prix en entiers XAF. Les écrans ne connaissent ni SQL ni fichiers SQLite.
## Frontières et propriété des fichiers
A frontend : public/*.html, public/assets/**, docs/FRONTEND.md.
B serveur + base : app/**, database/**, public/index.php, public/router.php, docs/BACKEND.md.
C QA : tests/**, docs/QA_REPORT.md, docs/INTEGRATION.md, docs/DEMO.md.
Coordinateur : README.md, .gitignore et tous les contrats communs. Pas de fichiers transversaux édités sans accord.
## Installation et portabilité
PHP 8.2+, PDO, PDO_SQLITE, extension sqlite3 ; vérifier extensions et configuration de sessions. Scripts CLI PHP compatibles Windows/Linux ; aucun outil Linux-only obligatoire ni chemin C:\... ; chemins calculés, encodage UTF-8, contrôle de casse des noms.
Les données de démonstration sont générées localement, pas committées. L'initialiseur doit être reproductible depuis un clone vierge. Aucune dépendance au réseau pour ouvrir le site localement après installation.
