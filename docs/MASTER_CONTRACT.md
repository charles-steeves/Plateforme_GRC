# PROJET GRC — CONTRAT MAÎTRE v3.0
Statut : RÉFÉRENCE COMMUNE, validée pour le démarrage des trois chantiers. Date : 29 octobre 2026.
Dépôt privé : Nemsis7036/GRC-Plateforme ; branche d'intégration : main.
Origine : projet universitaire de GRC, support de Mme ASSENGONE épouse EHOUMBE ; proposition antérieure « GRC_Architecture_Prompts_ChatGPT v2 ». Les adaptations v3 ci-dessous prévalent.

## 0. Pourquoi ce document existe
Toute nouvelle conversation, tout agent de développement et tout membre du groupe doit le lire **avant d'agir**. Il conserve les décisions prises malgré les changements de chat. Toute proposition contraire est une demande de changement, non une autorisation d'improviser. Une conversation ne consulte pas automatiquement les décisions des autres : relire les fichiers sur GitHub, pas des souvenirs de chat.

Documents normatifs de même version : MASTER_CONTRACT.md (vision et gouvernance) ; PROJECT_BRIEF.md (périmètre) ; ARCHITECTURE.md (frontières) ; API_CONTRACT.md (HTTP et JSON) ; DATA_MODEL.md (SQL et métier) ; SECURITY_REQUIREMENTS.md (protections et essais) ; COURSE_MAPPING.md (cours). En cas d'incohérence, STOP et signalement au coordinateur ; aucune correction tacite.

## 1. Décisions désormais figées
- Projet : une boutique fictive d'une seule entreprise gabonaise, **pas** une marketplace multi-vendeurs ; une GRC riche est au cœur de la soutenance.
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
Tous les comptes, commandes, montants et scores sont libellés « Démonstration — données fictives ».

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
