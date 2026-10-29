# Audit pédagogique : cours de Gestion de la Relation Client (93 diapositives)

**Source relue :** `La_Gestion_de_la_Relation_Client_.pptx`, 93 diapositives, Mme ASSENGONE épouse EHOUMBE Preslya Carelle Nancy. La présentation pédagogique comporte trois chapitres : **I. GRC**, **II. fidélisation**, **III. SAV** (diapo. 3). Ce document décrit précisément les écarts **entre le cours et la plateforme existante**. Il ne prétend pas que toutes les pratiques théoriques ou outils professionnels sont implémentés.

## Ce que le cours enseigne, ce que le site fait vraiment

| Référence au support | Concept du cours | Présent dans GRC-Plateforme | Limites constatées / prochains choix |
| --- | --- | --- | --- |
| 6–10 | Marketing relationnel, E-CRM, identification et contact client | Comptes et commandes reliés à des échanges SAV dans une base centrale | Pas de campagne e-mail/SMS, prospection, suivi de préférences ou automatisation marketing |
| 17–28 | Cycle de vie et valeur du capital client (CLV/LTV) | Segments calculés selon achats et inactivité ; montant livré accessible | **Pas de CLV/LTV calculée** : ni coût d'acquisition ni profits futurs disponibles |
| 29–43 | Typologies de clients et manière de les accompagner | Contacts SAV et historique client, consultables par un responsable | Ne pas inférer automatiquement qu'un client est « agressif », « méfiant » ou autre ; pas de classification psychologique |
| 45–49 | Phase 1 : **connaître** ; données et historique centralisés | Profil, commandes, tickets, fidélité, satisfaction dans une base SQLite | Pas de préférences détaillées, enrichissement externe ou data warehouse |
| 50–52 | Phase 2 : **différencier** ; RFM (récence, fréquence, montant) | Segments par nombre de commandes et seuil d'inactivité ; nombre, montant livré et dernière commande disponibles | **Pas de scoring RFM formel**, pas de CLV ; les segments existants ne doivent pas être présentés comme du RFM complet |
| 53 | Phase 3 : **dialoguer** | Client et administration échangent dans les tickets SAV, avec historique persistant | Échanges actuellement asynchrones ; pas de chat en direct |
| 54 | Phase 4 : **personnaliser** | Compte personnalisé (nom, commandes, points, tickets propres à l'utilisateur) | Aucune recommandation produit personnalisée, préférence ou offre ciblée persistante |
| 55–56, 78–80 | Démarche projet, ergonomie, formation, recette et adoption | Contrats, rapports QA, parcours de démo, interface administrative | Recette multi-appareils et tests manuels Windows à compléter |
| 57–65 | **GRC analytique** : connaissance, segmentation, indicateurs, scoring | Dashboard (clients, commandes, satisfaction, SAV, CA sur livraison), fiche client, segment | Pas de datamining prédictif, analyse de navigation ou scoring ; le montant affiché ne signifie pas profit |
| 66–72 | **GRC opérationnelle** : suivi des contacts, ventes et triggers | Commandes et statuts, stocks et produits, attribution automatique de points à livraison | Pas de devis, agenda de commerciaux, triggers SMS/email ; le rafraîchissement n'est pas une automatisation marketing |
| 73–75 | **GRC interactive** : support, web self-service et direct | Consultation de ses commandes et tickets ; messages client/admin | **Asynchrone**. Pas de FAQ dédiée, chat synchrone ou centre d'appels |
| 76–77 | Outils GRC : contacts, scoring, satisfaction, historiques, tableaux de bord, tickets | Clients, satisfaction, historique, tableau de bord, tickets | Pas de scoring complet, devis ou campagnes |
| 83–89 | **Chapitre Fidélisation** | Solde et historique de points, crédit unique sur livraison | Pas d'échange de points contre une réduction, carte ou avantages commerciaux réels |
| 90–93 | **Chapitre SAV** et qualité de la prise en charge | Ticket, traitement, réponse, statut, historique | Pas de politique de garantie, retours physiques ou livraison réels |

## Le parcours à montrer au professeur

1. **Connaître le client** (45–49) : créer un compte client, passer une commande, ouvrir sa fiche dans l'administration et voir son historique.
2. **Différencier** (50–52, 61–64) : afficher la liste des segments, puis ouvrir la fiche d'un client pour constater les achats, le montant livré et la date du dernier achat. **Ne pas appeler cela un score RFM** sans le calcul R/F/M correspondant.
3. **Dialoguer** (53, 73–75, 90–93) : créer une demande SAV en client, répondre avec un compte admin, puis revenir au client. Deux profils distincts, même base SQLite.
4. **Gérer et fidéliser** (66–68, 83–89) : la commande est créée côté client, apparaît côté admin ; la livraison décidée par l'admin crédite une seule fois les points ; satisfaction ensuite.
5. **Analyser** (57–65) : les indicateurs et la satisfaction se recalculent à partir des opérations réalisées ; le tableau de bord doit montrer des valeurs *avant/après* observables.
6. **Personnaliser, encore partiel** (54) : l'espace client est individualisé, mais pas les offres. Ce point est un choix futur et doit être présenté comme une limite.

## Recommandations fonctionnelles, sans changer silencieusement les contrats

**Déjà autorisé :** rendre les trois dimensions clairement identifiables dans l'administration, épurer les micro-explications techniques, améliorer la navigation, montrer les nouvelles commandes après quelques secondes de rafraîchissement. Le suivi des commandes et la communication SAV reposent toujours sur la même base, sans paiement ni transport.

**Propositions nécessitant validation avant codage :**
- Un véritable **RFM** affichant séparément Récence, Fréquence, Montant (notions diapo. 50–51) avec règles de classement expliquées, sans le confondre avec les segments actuels.
- Une **préférence client** déclarée volontairement, puis une recommandation non automatisée ou une réponse SAV contextualisée ; éviter le profilage psychologique.
- Un **espace offre personnalisée** et des rappels visibles dans l'application (simulation sans SMS/email réel), si P1 autorisé.
- Une FAQ/centre d'aide et une meilleure mise en valeur de la satisfaction et du suivi des demandes, si le temps le permet.

**Ne pas prétendre :** calculer la CLV, prédire des achats, délivrer des SMS/e-mails, assurer un support synchrone ou réaliser des ventes/payements réels. Aucun comportement de client réel n'est déduit des seules données de test.

## Sécurité de la démonstration

Les comptes utilisateurs, historiques et sessions de plusieurs appareils partagent **une base privée sur le PC hébergeant PHP**. Un `git pull` standard ne touche pas `storage/` (ignoré par Git). Un `git push` de la base ou du fichier contenant les mots de passe n'est pas approprié. Conserver des sauvegardes privées **cohérentes de la base et du fichier des comptes** ; ne jamais réinitialiser pour mettre le code à jour.

Le rafraîchissement périodique du tableau de bord rend un achat visible sans recharger manuellement la page, mais n'est **pas un WebSocket ni un chat temps réel**. Les mises à jour par plusieurs administrateurs sont sérialisées côté SQLite ; des modifications concurrentes d'une même fiche doivent être retestées.
