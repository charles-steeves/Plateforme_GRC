# PROJET GRC — CONTRAT MAÎTRE v3.0
Statut : RÉFÉRENCE COMMUNE, validée pour le démarrage des trois chantiers. Date : 29 octobre 2026.
Dépôt privé : Nemsis7036/GRC-Plateforme ; branche d'intégration : main.
Origine : projet universitaire de GRC, support de Mme ASSENGONE épouse EHOUMBE ; proposition antérieure « GRC_Architecture_Prompts_ChatGPT v2 ». Les adaptations v3 ci-dessous prévalent.

## 0. Pourquoi ce document existe
Toute nouvelle conversation, tout agent de développement et tout membre du groupe doit le lire **avant d'agir**. Il conserve les décisions prises malgré les changements de chat. Toute proposition contraire est une demande de changement, non une autorisation d'improviser. Une conversation ne consulte pas automatiquement les décisions des autres : relire les fichiers sur GitHub, pas des souvenirs de chat.

Documents normatifs de même version : MASTER_CONTRACT.md (vision et gouvernance) ; PROJECT_BRIEF.md (périmètre) ; ARCHITECTURE.md (frontières) ; API_CONTRACT.md (HTTP et JSON) ; DATA_MODEL.md (SQL et métier) ; SECURITY_REQUIREMENTS.md (protections et essais) ; COURSE_MAPPING.md (cours). En cas d'incohérence, STOP et signalement au coordinateur ; aucune correction tacite.

## 1. Décisions désormais figées
- Projet : une **plateforme de vente en ligne et de gestion de la relation client**, pensée comme une application unique et non une marketplace multi-vendeurs ; une GRC riche est au cœur de la soutenance. **Nom, entreprise, marque et activité commerciale définitifs non définis à ce stade.** Les données et les transactions de soutenance restent uniquement des démonstrations.
- Trois composants d'exécution : interface client et interface administrateur (deux faces du même site) ; serveur PHP ; base SQLite. Seul le serveur accède à la base.
- Technologies v1 : HTML5, CSS3, JavaScript moderne sans framework imposé ; PHP 8.2+ sans Laravel pour cette version accélérée ; PDO + SQLite via SQL. MySQL est une solution classique étudiée, non utilisée en v1.
- Windows 11 **et** Linux pris en charge. macOS hors exigence. VS Code et GitHub privé pour le travail ; pas de Claude Code/ECC requis.
- Interface en français ; tarifs **entiers en francs CFA XAF** ; données entièrement fictives ; produits de démonstration inspirés du commerce local. Aucun paiement, numéro de carte ou livraison réel. Pas de collecte de données personnelles réelles.
- Une seule installation serveur suffit à la démo. Un second PC peut servir de navigateur/projection ; un Wi-Fi local ou une publication HTTPS temporaire sécurisée peut servir à la classe, après contrôle.
- Priorité réelle : un chemin entièrement fonctionnel et sûr > une grande quantité de pages fictives. Pas de promesse de qualité « production » ni de résistance aux DDoS.
- Délai maximal de préparation : environ 96 heures calendaires à partir du cadrage, avec cours, repos et autres obligations ; ne pas confondre délai calendaire et heures de travail.
- Trois chantiers parallèles : A interface, B back-end ET SQLite, C tests et recette. Le coordinateur constitue une quatrième conversation mais n'est pas un quatrième développeur. Branches distinctes.

## 2. Définition du produit attendu
Visiteur : ouvre la boutique, parcourt les catégories, recherche, filtre, voit prix et fiches ; doit se connecter pour commander/contacter le SAV.
Client : crée un compte, se connecte, ajoute des produits au panier, passe une commande simulée, consulte commandes/statuts, points de fidélité, tickets/réponses, note une commande livrée.
Administrateur GRC : se connecte par le même système avec un rôle attribué hors inscription publique ; voit le tableau de bord, gère les produits et stocks, consulte/actualise les commandes, accède aux fiches clients et segments, répond aux tickets, suit satisfaction et fidélisation.
Serveur : valide chaque requête, applique le contrôle d'accès, calcule les montants réels, exécute les transactions SQL, renvoie les réponses normalisées, journalise sans divulguer de secrets.
Base : conserve utilisateurs, produits, commandes et leurs lignes, échanges SAV, avis de satisfaction, transactions de fidélité et données de limitation des tentatives de connexion.

## 3. Priorités et preuve de fin
P0 — à réaliser intégralement si possible : catalogue + fiche produit + recherche/filtrage ; compte et session ; panier navigateur ; commande en base avec contrôle des stocks ; espace client et historique ; gestion admin produits/commandes ; fiches clients et segments calculés ; tickets SAV avec messages ; note de satisfaction ; points de fidélité à livraison ; tableau de bord ; autorisations et protections ; tests de bout en bout ; instructions Windows/Linux.
P1 — seulement après parcours P0 stable : favoris, coupons, FAQ, historique de contacts/prospects, campagnes simulées, exports CSV, visuels supplémentaires.
P2 — interdit dans cette version : paiements réels, données clients réelles, marketing SMS/e-mail réel, vendeurs tiers, infrastructure distribuée, microservices, IA de recommandation, hébergement de production.
Une fonction n'est « terminée » que si son comportement est relié à une donnée réelle de la base et démontré ; une maquette ou un mock ne compte pas comme P0 fini.

## 4. Parcours de soutenance obligatoire
1. Ouvrir la boutique publique et un produit au prix XAF.
2. S'inscrire / se connecter avec un compte de démonstration ; créer une commande simulée.
3. Afficher la commande dans l'administration ; la confirmer puis la marquer livrée.
4. Voir l'historique actualisé et **une seule attribution** des points côté client.
5. Ouvrir un ticket SAV côté client ; y répondre et le traiter côté administrateur ; voir l'historique.
6. Noter la commande livrée ; afficher satisfaction, clients et commandes sur le tableau de bord.
7. Expliquer GRC opérationnelle, analytique, interactive, fidélisation et SAV.
Les comptes, commandes, montants et scores de soutenance demeurent des données de test, sans transaction financière ni livraison réelle. Leur nature est documentée pour l'équipe et les évaluateurs ; l'interface client n'a pas à multiplier les avertissements techniques et pédagogiques.

## 5. Structure et règles d'intégration
- main : documents contractuels et versions intégrées approuvées. Aucun agent ne pousse directement ses développements sur main.
- feature/frontend : agent A ; seulement public/*.html, public/assets/** et docs/FRONTEND.md.
- feature/backend-data : agent B ; seulement app/**, database/**, public/index.php, public/router.php et docs/BACKEND.md.
- feature/qa : agent C ; seulement tests/**, docs/QA_REPORT.md, docs/INTEGRATION.md, docs/DEMO.md.
- Coordinateur : README.md, .gitignore, docs/MASTER_CONTRACT.md, PROJECT_BRIEF.md, ARCHITECTURE.md, API_CONTRACT.md, DATA_MODEL.md, SECURITY_REQUIREMENTS.md, COURSE_MAPPING.md et toute modification intermodule.
- Interdiction d'écraser des fichiers existants, d'effacer une branche ou de forcer un push. Une PR par agent. Le coordinateur inspecte fichiers et tests avant fusion.
- Si un agent détecte un besoin de route/champ/table supplémentaire, il ouvre une demande explicite, sans altérer les contrats. Les correctifs transversaux sont validés et communiqués aux trois agents.
- Après les PR : intégration séquentielle de B, A, C ; tests complets et correction des écarts. Un agent QA peut produire des tests en amont avec une description des tests non exécutés.
- **Lancement en un seul prompt** : chaque agent doit accomplir tout son chantier autorisé dans son appel, créer ses commits/PR si les outils le permettent, signaler honnêtement les blocages ; ne jamais faire croire que du travail continuera en arrière-plan.

## 6. Limites et contrôles
- Toute commande de test est fictive ; aucun argent n'est transféré.
- Les prix, stocks, sessions, identifiants et rôles sont contrôlés par PHP, pas par JavaScript.
- Base SQLite et secrets sous un dossier privé hors public ; fichiers actifs et variables d'environnement exclus de Git ; données de démo uniquement.
- Un fichier de base en production ne se copie pas arbitrairement pendant des écritures : utiliser une sauvegarde SQLite cohérente.
- Serveur de développement PHP pour local/LAN de confiance uniquement. Tout accès public temporaire nécessite un tunnel HTTPS, protection appropriée, limitation de l'exposition, tests et un plan de retrait ; ne pas exposer directement le serveur de développement sur Internet.
- Windows/Linux : ne jamais coder de chemin absolu spécifique ; utiliser __DIR__, DIRECTORY_SEPARATOR, et les extensions PHP requises ; pas de commande shell dépendante du système sans alternative documentée.
- Les contrats des annexes fixent les noms exacts. La sécurité **n'est pas** une option à ajouter après le développement.

## 7. Critères de qualité vérifiables
Fonctionnel : 1 parcours visiteur→commande→admin→livraison→fidélité→SAV→satisfaction démontré de bout en bout.
Données : réinitialisation et reconstitution sur base neuve ; contraintes FK actives ; prix XAF entiers ; transactions atomiques ; stock non négatif ; zéro crédit fidélité doublon.
Accès : une session client ne lit jamais commandes/tickets d'autrui ; les endpoints admin refusent les non-admin ; inscription ne peut jamais créer admin.
Sécurité : CSRF, hachage des mots de passe, sessions régénérées, validations, requêtes préparées, erreurs non verbeuses, protections contre abus de connexion.
Qualité : responsive petit écran ; erreurs réseau et états vides ; README/guide de démo ; au minimum tests de sécurité/permissions/état/stock/points.
Portabilité : procédure d'installation et d'exécution sur Windows et Linux, sans secret committé.

## 8. Gestion des changements et des séances
Une nouvelle idée = classement P0/P1/P2, impact sur API et BD, risque pour délai, décision du coordinateur, révision **simultanée** de tous les contrats concernés et annonce aux agents.
État communiqué à chaque reprise : (1) branche et SHA réellement observés ; (2) PR ouvertes ; (3) fonctionnalités validées ; (4) anomalies ; (5) décision suivante. Le coordinateur ne surveille pas le dépôt automatiquement entre les messages : toute vérification doit être effectivement déclenchée.
À la fin de chaque travail : liste exacte des fichiers, hash commit ou lien PR si existants, tests réellement exécutés (ou non), erreurs et dépendances. Ne jamais inventer un résultat.

## 9. Addendum de coordination du 29 octobre 2026 — sans remplacement des décisions v3

Cet addendum **complète**, sans annuler, les sections 0–8 et les annexes normatives. Il explicite les échanges tenus lors des premières livraisons et la manière de traiter les nouvelles demandes. **Les hypothèses d'un autre chat ne valent pas validation de l'utilisateur.**

### 9.1 Exigences déjà retenues, à préserver

- La boutique et la GRC sont une **seule application réellement interactive** : les différents navigateurs et comptes consultent les mêmes données SQLite sur le PC serveur. Les comptes et opérations de soutenance utilisent des **données de démonstration**, sans paiement réel ; cela **ne définit pas l'entreprise comme fictive** et ne réduit ni le fonctionnement de l'API ni la persistance.
- L'utilisateur veut une démonstration concrète des trois dimensions de GRC, de la fidélisation et du SAV, conforme à l'enseignement. Le site doit rester **administrable depuis le navigateur** pour les produits, prix, stocks, commandes et tickets P0 ; pas de modification SQL ou du code à chaque ajout de produit.
- Le parcours de soutenance de la section 4 est prioritaire. Un administrateur se connecte par l'authentification à rôles et un client ne dispose jamais de pouvoirs admin par simple accès à une URL.
- Les données et comptes préchargés constituent un **jeu de démonstration**, pas une limitation à douze produits ni une promesse de catalogue réel. Les éléments ajoutés par les administrateurs doivent être réellement enregistrés. Une initialisation/reset ne doit jamais effacer silencieusement une base existante.
- L'affichage doit être cohérent en français (UTF-8), accessible au clavier, responsive et uniforme (polices, espacements, composants et alignements). Les défauts visuels signalés lors du premier démarrage Windows sont **à diagnostiquer sur captures/constats**, non supposés résolus par les tests fonctionnels Linux. La reprise visuelle est une phase de finition distincte : ne pas défaire un flux métier sécurisé pour la cosmétique.
- Les environnements visés sont le Windows 11 de l'équipe et Linux ; Git/VS Code et les outils nécessaires à PHP/SQLite suffisent. Aucun abonnement Codex/Claude supplémentaire, VPS, nom de domaine ni serveur MySQL n'est un prérequis pour la version initiale.
- Le code peut être élaboré et revu via plusieurs conversations ChatGPT, mais leurs états ne se synchronisent pas automatiquement. Préserver l'historique Git, coordonner les branches/PR, consigner les changements et **ne pas lancer de nouveau développement lourd pour corriger une ligne isolée**.
- Toute ouverture Internet temporaire, dont un éventuel tunnel HTTPS Cloudflare, est **conditionnelle** : il faut une revue de sécurité et un vrai essai sur l'origine, les sessions et les protections avant la démonstration. Une URL temporaire n'accorde pas à elle seule un contrôle d'accès. Le serveur PHP de développement n'est pas publiable directement.
- Les scripts de validation externes aux PR et les résultats déclarés par A/B ne remplacent pas les tests indépendants et versionnés du Chat C. Aucun statut « prêt pour la production » n'est autorisé.

### 9.2 Points évoqués, mais pas encore approuvés comme changement d'exigence

Ces sujets doivent être décidés **un par un** selon la section 8, sans être implémentés par anticipation :
- **Plusieurs administrateurs** (deux ou trois suggérés), gestion depuis le navigateur, éventuels rôles distincts ou administrateur principal. Le P0 actuel prévoit un compte admin initial et le rôle `admin` ; ne pas créer de mécanisme de promotion publique.
- **Import direct d'images** depuis le navigateur. Le P0 existant limite les images à des chemins statiques locaux contrôlés ; introduire un upload exigerait une conception de stockage, validation du contenu, limites et contrôles de sécurité.
- **Nom, identité, statut et secteur de l'entreprise** : décision explicite de l'utilisateur du 29 octobre 2026 : retirer l'ancien nom de boutique provisoire et toute présentation imposant un statut fictif à l'entreprise. Le nom, la structure commerciale et l'identité seront définis plus tard. En attendant, utiliser « Plateforme GRC » comme libellé fonctionnel neutre, non comme une nouvelle marque. Les produits électroniques préchargés sont provisoires et restent des données de démonstration.
- **Fonctions de GRC enrichie** (RFM, campagnes, prospects, coupons, suivi marketing et exports) : ne pas les ajouter par défaut si le P0, le SAV, la sécurité ou la qualité de présentation ne sont pas stabilisés.
- **Portée d'accès à la soutenance** (jury, groupe, classe ou public plus large) : à confirmer avant toute publication ; seules des données fictives sont admises dans tous les cas.
- **Réutilisation commerciale future** : n'est pas un objectif de cette v1 ; une conversion en boutique réelle exigerait un nouveau périmètre de sécurité, paiements, données, conformité et exploitation.

### 9.3 État technique et dette à transmettre au lieu d'inventer une résolution

- L'utilisateur a rapporté `php database/init.php` → `Initialisation refusée : could not find driver` sous PHP 8.4 Windows. Cela pointe vers un pilote PDO SQLite indisponible dans le PHP CLI. Les corrections de diagnostics dans le dépôt ne prouvent **pas** que son PC est désormais configuré. Ne jamais effacer `storage/` pour traiter une erreur d'extension.
- Les premiers essais ont révélé des décalages de mise en page, des polices non uniformes et des caractères atypiques. Leurs causes exactes restent à contrôler (CSS, polices de remplacement, UTF-8 ou contenu) plutôt qu'à deviner.
- Le système ne comporte pas de garantie serveur d'**idempotence** pour des créations de commandes/tickets après une perte de réponse ou une recharge intégrale. Ne pas affirmer le contraire ; vérifier l'historique avant de renvoyer, ou décider explicitement de modifier le contrat d'API.
- La validation `image_url` frontend/backend doit accepter/rejeter les mêmes chemins sûrs. Les modifications intermodules passent par une PR dédiée, avec tests de chemins valides et malveillants.
- Pour la coordination : le statut des PR/commits est **variable**. Consulter GitHub et noter le SHA courant au début de chaque nouvelle conversation ; ne pas recopier une ancienne fiche comme état actuel.

### 9.4 Règles de livraison pour les conversations classiques

Garder un coordinateur qui arbitre et des développeurs avec **périmètres de fichiers distincts**. Chaque livraison comprend : branche de départ, fichiers changés, modifications effectuées, tests **réellement exécutés**, limites, lien de PR, instructions de reprise. Favoriser les **ajouts minimaux** et les corrections ciblées ; ne pas remplacer un contrat, un service ou une interface entière sans bug démontré ou demande validée. Une PR ne doit pas être fusionnée seulement parce que GitHub indique `mergeable=true`.

Cet addendum n'est pas une liste d'autorisations pour ajouter des fonctions P1/P2, ni une extension silencieuse du contrat d'API.

### 9.5 Arbitrage commercial postérieur aux premières livraisons

**Décision confirmée :** ne plus attribuer à la plateforme un nom commercial prédéfini ni qualifier d'avance l'entreprise de fictive. Les formulations des contrats antérieurs impliquant ces choix sont remplacées uniquement sur ces deux points ; toutes les exigences techniques, de GRC, de sécurité et de simulation des paiements restent applicables. Ne pas inventer d'autre nom ou type d'entreprise avant décision. La mention « données fictives » désigne exclusivement les données d'essai ; ce n'est pas une qualification de l'entreprise.

### 9.6 Présentation réaliste de l'interface, à la demande de l'utilisateur

L'utilisateur confirme que les messages répétés « projet universitaire », « données fictives », « aucun paiement réel », « adresse e-mail fictive » et les explications d'implémentation (« 72 octets UTF-8 ») **ne doivent plus polluer les pages client/admin**. Les mêmes garanties restent nécessaires dans le code et documentées pour les développeurs et les évaluateurs. L'inscription conserve la règle de sécurité de longueur du mot de passe, mais l'interface affiche une indication concise (12 caractères minimum) et une erreur compréhensible en cas de dépassement. Le formulaire catalogue est harmonisé sur ordinateur et mobile. L'expérience doit être crédible sans prétendre exécuter un paiement ou une livraison réels. Les prix restent affichés en FCFA, mais sans slogans pédagogiques sur la devise. Aucun changement de marque ni de modèle API n'est autorisé par cette décision.
