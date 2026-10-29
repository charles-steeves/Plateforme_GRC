# SECURITY_REQUIREMENTS — CRITÈRES OBLIGATOIRES v3.0
Ce document ne constitue pas une certification. Il est applicable à chaque module dès le départ. Références : recommandations OWASP et documentation PHP ; adapter les contrôles à la démonstration, sans sur-promettre une sécurité de production.
## Identité et accès
S1 : Mot de passe haché avec password_hash(PASSWORD_DEFAULT) et vérifié password_verify ; aucune conservation en clair ou sortie dans JSON.
S2 : Inscription crée exclusivement role=client ; pas de promotion de rôle depuis le navigateur. Toutes routes admin exigent role=admin dans PHP.
S3 : Contrôle horizontal de propriété orders/tickets/feedback sur **chaque** requête ; identifiants d'objets manipulés ne prouvent jamais l'autorisation. Ressources d'autrui : 404 générique.
S4 : Session PHP régénérée à login, cookie HttpOnly, SameSite=Lax, Secure quand accès HTTPS, absence d'identifiant en URL ; déconnexion détruit session. Paramétrer durée/inactivité ; vérifier que HTTPS est reconnu correctement derrière le tunnel de confiance, sans se fier à des en-têtes forgés.
S5 : Jeton CSRF unique à session obtenu GET /auth/csrf, vérifié sur POST/PATCH, rotation à login ; même origine, pas de CORS ouvert ; vérifier aussi Origin quand fourni et pertinent.
## Entrées / sorties
S6 : PDO prepared statements + valeurs liées, foreign_keys=ON, aucune concaténation de données utilisateur dans SQL.
S7 : Toutes validations métier côté PHP : prix et stock issus de la base, types et longueurs contrôlés, transitions strictes, montants entiers et transactions atomiques.
S8 : Frontend utilise textContent ou createElement pour le contenu client, jamais innerHTML sans échappement; PHP échappe toute sortie HTML dynamique. En-têtes X-Content-Type-Options:nosniff, Referrer-Policy, Content-Security-Policy restreinte compatible assets internes, frame-ancestors 'none' via CSP.
S9 : Le périmètre initial interdisait les uploads arbitraires. **Exception demandée et approuvée le 29 octobre 2026 :** photos de produits JPG/PNG/WebP envoyées depuis l'administration exclusivement, avec vérification de rôle/CSRF/origine, type réel (getimagesize), dimensions, taille, nom aléatoire, dossier public interne vérifié, aucune exécution PHP et aucun SVG. Les URLs externes restent refusées et le dossier `/public/assets/images/uploads/` doit être exclu de Git. Les autres uploads demeurent interdits.
S10 : Page admin peut être visible comme HTML mais toute API privée reste inaccessible sans session autorisée.
## Résilience et exploitation
S11 : Limiter login via compteur persistant avec fenêtre de 15 min et plafonds raisonnables par identifiant pseudonymisé et IP, réponse 429 ; éviter de rendre visible si une adresse existe. Environnement PHP dev mono-thread ; limite de débit globale/tunnel à ajouter avant ouverture Internet. Ne pas prétendre protéger contre un DDoS.
S12 : journalisation des erreurs côté serveur sans secrets, pas de stack traces côté client ni mot de passe dans logs ; message JSON 500 générique.
S13 : Config et DB dans storage/ hors public ; .gitignore exclut .env, storage/*.sqlite*, fichiers de journal, secrets, caches; aucun fichier .git exposé par document root public/.
S14 : sauvegardes SQLite cohérentes et capacité de restauration depuis données fictives ; init.php refuse d'écraser une base sans --reset explicite et contrôlé.
S15 : attaques de requêtes forcées et accès direct aux API protégées doivent être testés ; un bouton caché n'est jamais une protection.
S16 : deployment local/LAN de confiance par défaut. Aucun accès public sans HTTPS tunnel/proxy, restrictions, contrôle des secrets, limites de requêtes et procédure de coupure. Pas de serveur de développement PHP directement exposé aux réseaux publics.
## Cas de tests minimum
T1 client A tente /orders de B => refus ; T2 client A lit/répond ticket B => refus ; T3 client appelle endpoints admin => 403.
T4 inscription avec role=admin injecté => compte reste client/rejet ; T5 CSRF absent ou incorrect => 403 sans mutation ; T6 SQL injection dans recherche/login ne modifie pas BDD.
T7 saisie de HTML/JS dans ticket ne s'exécute pas lors affichage ; T8 prix négatif/string et quantité >stock refusés ; T9 deux commandes simultanées du dernier produit ne rendent pas stock négatif.
T10 deux PATCH delivered ne créditent les points qu'une fois ; T11 tentative de re-livrer cancelled échoue ; T12 après logout endpoints privés => 401.
T13 trop de tentatives login => 429 ; T14 SQLite/.env/erreurs serveur inaccessibles depuis HTTP ; T15 HTTP local sans tunnel ne devient pas prétendument HTTPS.
S'il est impossible de réaliser un test faute d'environnement, marquer « NON EXÉCUTÉ » et expliquer ; jamais « conforme » sans preuve.


SAV et rafraîchissement passif (29 octobre 2026) : les lectures GET d'auto-actualisation autorisées utilisent le header `X-GRC-Passive: 1` ; **uniquement** pour les routes de lecture SAV et dashboard connues, cette information empêche le renouvellement de `last_seen` dans la session. Aucun bypass de rôle, propriété, CSRF sur les mutations, et aucun re-POST automatique après erreur réseau. Conserver la limite absolue de 8 h et le délai d'inactivité de 30 min indépendamment des timers front-end.
