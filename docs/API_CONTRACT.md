# API_CONTRACT — CONTRAT HTTP/JSON v3.0
Origine unique : même domaine/port pour interfaces et API. Préfixe /api/v1 ; UTF-8 ; requêtes POST/PATCH JSON. Dates en ISO 8601 UTC (2026-10-29T10:00:00Z). Prix en INTEGER XAF. Routes inconnues 404. Jamais SQL ni trace PHP dans les réponses.
## Enveloppes standard
Succès : {"success":true,"data":<valeur>,"message":null}. data vaut objet ou liste selon endpoint.
Erreur : {"success":false,"error":{"code":"CODE","message":"Texte français clair"}}.
HTTP : 200 lecture/mutation, 201 création, 400 JSON malformé, 401 non connecté, 403 non autorisé/CSRF invalide, 404 ressource inexistante ou cachée, 405 méthode, 409 conflit métier, 422 validation, 429 limitation, 500 serveur (générique).
Tous les endpoints /auth/me et endpoints non publics nécessitent la session PHP; un compte a {id,name,email,role}; rôle admin exclusivement créé en seed ou par action privilégiée hors API publique.
## CSRF et session
GET /api/v1/auth/csrf [tous] : data {"csrf_token":"<aléatoire>"} ; établit une session et émet cookie de session HttpOnly/SameSite=Lax. Les opérations POST et PATCH, y compris register/login/logout, exigent le header X-CSRF-Token égal au token de la session ; les fetch same-origin incluent credentials:'same-origin'. Le token se renouvelle à chaque connexion, le frontend doit recharger /auth/csrf après login. Lors du logout le token est invalidé. Pas de CORS wildcard.
## Endpoints publics
GET /products?search=&category=&page=1&per_page=12 : data {"items":[Product],"page":1,"per_page":12,"total":0}; bornes page>=1, per_page 1..24 ; filtres par nom/description et catégorie, produits actifs uniquement.
GET /products/{id} : data {"product":Product}; Product={id,name,description,category,price_xaf,stock_quantity,image_url,active} ; public seulement si active.
POST /auth/register body {"name":"Aminata","email":"fictif@example.test","password":"<secret>"} -> 201 data {"user":User} ; crée rôle client exclusivement, ne renvoie jamais password_hash.
POST /auth/login body {"email":"...","password":"..."} -> 200 data {"user":User}; régénération ID session et CSRF.
POST /auth/logout body {} -> 200 data {"logged_out":true}.
GET /auth/me [session] -> data {"user":User}.
## Endpoints client (session role client; admin ne crée pas de commande client fictive sous un autre ID)
POST /orders body {"items":[{"product_id":1,"quantity":2}]} -> 201 data {"order":Order}. Order={id,status,total_xaf,created_at,updated_at,items:[OrderItem]} ; OrderItem={product_id,product_name,quantity,unit_price_xaf,line_total_xaf}. Les prix sont ignorés si ajoutés dans la requête ; vérifier stocks/transactions.
GET /orders/me -> data {"items":[Order]} triés par date descendante.
GET /loyalty/me -> data {"balance":12,"transactions":[{"id":3,"order_id":1,"points_delta":12,"reason":"delivery_credit","created_at":"..."}]}.
POST /tickets body {"order_id":1,"subject":"Livraison","description":"Problème de démonstration","category":"sav"} ; order_id nullable -> 201 data {"ticket":Ticket}.
GET /tickets/me -> data {"items":[Ticket]}.
GET /tickets/{id} [propriétaire ou admin] -> data {"ticket":Ticket,"messages":[TicketMessage]}; Ticket={id,user_id,order_id,subject,description,category,status,created_at,updated_at} ; TicketMessage={id,ticket_id,author_user_id,body,created_at}.
POST /tickets/{id}/messages body {"body":"Merci pour votre retour"} -> 201 data {"message":TicketMessage} ; auteur dérivé de la session.
POST /feedback body {"order_id":1,"rating":5,"comment":"Très bien"} -> 201 data {"feedback":{"id":1,"order_id":1,"rating":5,"comment":"Très bien","created_at":"..."}} ; commande delivered appartenant à l'utilisateur, UNIQUE order_id.
## Endpoints admin (session role admin)
GET /admin/dashboard -> data {"customers_count":0,"orders_count":0,"ca_simule_xaf":0,"tickets_open_count":0,"satisfaction_avg":null,"customers_inactive_count":0,"order_status_counts":{"pending":0,"confirmed":0,"delivered":0,"cancelled":0}}.
GET /admin/customers?search=&page=1&per_page=20 -> data {"items":[Customer],"page":1,"per_page":20,"total":0}; Customer={id,name,email,created_at,segment,orders_count,total_delivered_xaf,last_order_at}; pas de hash.
GET /admin/customers/{id} -> data {"customer":Customer,"orders":[Order],"tickets":[Ticket],"loyalty_balance":0}; clients role=client seulement.
GET /admin/orders -> data {"items":[OrderAdmin]} ; OrderAdmin = Order + user_id,customer_name,customer_email.
PATCH /admin/orders/{id} body {"status":"confirmed"} -> data {"order":OrderAdmin} ; respecter transitions et atomicité.
GET /admin/tickets -> data {"items":[TicketAdmin]} ; TicketAdmin=Ticket + customer_name.
PATCH /admin/tickets/{id} body {"status":"in_progress"} -> data {"ticket":TicketAdmin}.
GET /admin/products -> data {"items":[Product]} ; inclut inactifs.
POST /admin/products body {"name":"Produit","description":"...","category":"Téléphonie","price_xaf":12500,"stock_quantity":10,"image_url":"/assets/images/p1.svg","active":true} -> 201 data {"product":Product}.
PATCH /admin/products/{id} body champ(s) parmi {name,description,category,price_xaf,stock_quantity,image_url,active} -> data {"product":Product}. Changement stock par admin = quantité absolue validée ; éviter course avec commande par transaction. Suppression physique hors P0, désactiver par active=false.
## Extension validée par l'utilisateur : upload photo administrateur (2026-10-29)

**Exception unique au corps JSON :** `POST /api/v1/admin/product-image`, rôle `admin`, `multipart/form-data` avec un champ fichier nommé `image`, jeton `X-CSRF-Token` et même cookie de session que les autres mutations. Réponse `201` sous l'enveloppe commune avec `data: {"image_url":"/assets/images/uploads/<nom-aléatoire>.jpg|png|webp"}`. Formats JPG/PNG/WebP validés d'après le contenu, fichier de moins de 1,9 Mo, dimensions au plus 4096 × 4096 et 12 M pixels ; nom de fichier aléatoire et chemin strictement sous les images publiques. Fichiers exécutables/SVG/URL externes refusés. Cet endpoint ne crée **pas** un produit : le client l'associe par l'API normale `POST/PATCH /admin/products`, qui conserve toutes ses validations. Aucun upload client et aucun upload arbitraire.

**Création de plusieurs administrateurs :** uniquement par la commande locale privilégiée `php database/add-admin.php --name="..." --email=...`, qui ajoute un compte sans changer les rôles des clients ni les autres données. Aucun endpoint HTTP de promotion de rôle.

## Validation commune
Entiers stricts (pas string numérique ni float pour prix/quantité), limites de taille (name 1..120, subject 1..160, commentaire 0..1500, description ticket 1..4000, message 1..4000, email <=254, mot de passe >=12 caractères en démo). Refuser champs sensibles inconnus role, user_id, total_xaf fournis par client pour déterminer l'autorité. Contrôler bornes serveur, filtrer paramètres page/per_page, ne pas utiliser de SQL concaténé.
## Contrat frontend et tests
Le frontend se base exclusivement sur ces formats ; les faux objets de développement suivent exactement les mêmes schémas et restent marqués MOCK. Les tests d'intégration vérifient structure et codes. Les nouveautés de routes/champs nécessitent demande explicite au coordinateur puis synchronisation des agents.
