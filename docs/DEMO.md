# GRC — Scénario de soutenance (5–8 minutes)

Version : parcours pédagogique avec **données exclusivement fictives**. Il est fondé sur le contrat maître v3 et le support de Gestion de la Relation Client. Ne présenter aucune démonstration comme une vente ou un paiement réel.

## Préparation avant de présenter

- Démarrer localement `php -S 127.0.0.1:8000 -t public public/router.php` avec une base de démonstration **déjà initialisée**, après vérification des extensions PHP/SQLite.
- Ouvrir `http://127.0.0.1:8000/` dans **un profil client** et `/admin.html` dans **un second profil administrateur**. Vérifier les connexions avec les comptes fictifs locaux du fichier privé `storage/demo-accounts.json`.
- Tester au préalable un parcours complet, noter les produits de démonstration disponibles et éviter de sélectionner un produit en rupture de stock.
- Préparer une projection lisible (zoom cohérent, navigateur plein écran), une connexion locale stable et un plan de secours en cas de panne de Wi-Fi.
- Ne jamais afficher les mots de passe ni le contenu du fichier des comptes sur l'écran projeté.

## Déroulé à deux présentateurs

| Durée indicative | Démonstration concrète | Notion du cours à expliquer |
| --- | --- | --- |
| 0:00–0:45 | Présenter la plateforme de vente en ligne et l'espace GRC, sans nom commercial ni entreprise prédéfinie. Montrer le catalogue de démonstration et les prix en FCFA. | L'e-commerce produit des interactions et données utiles à la relation client |
| 0:45–1:40 | Se connecter en client, ouvrir une fiche produit, ajouter au panier et confirmer une **commande simulée**. | GRC **opérationnelle** : centralisation et suivi des commandes |
| 1:40–2:30 | Passer au profil administrateur, retrouver la commande, la confirmer puis la marquer livrée. | Coordination des opérations commerciales et des données de stock |
| 2:30–3:10 | Revenir au client et afficher historique des commandes et solde de fidélité actualisé. | **Fidélisation** : attribution des points à la livraison, sans double crédit |
| 3:10–4:20 | Ouvrir un ticket de SAV lié à la commande ; répondre depuis l'administration ; montrer les messages dans l'espace client. | GRC **interactive** et **service après-vente** : échange bidirectionnel, traçabilité, traitement |
| 4:20–5:05 | Noter la commande livrée côté client ; montrer la note puis l'indicateur de satisfaction. | Satisfaction : recueil des avis et prise en compte dans les indicateurs |
| 5:05–6:20 | Afficher les fiches clients, segments et tableau de bord admin. | GRC **analytique** : segmentation, historique, clients réguliers/inactifs, CA **simulé** |
| 6:20–7:00 | Expliquer les rôles, le stockage commun SQLite et la séparation des droits. Conclure. | Protection des données, cohérence métier et articulation des trois formes de GRC |

**Durée cible :** 7 minutes environ, modulable de 5 à 8 minutes selon les consignes de l'enseignante.

## Script de présentation possible

> « Notre plateforme illustre comment la vente en ligne peut alimenter un système de gestion de la relation client. Elle accueille des visiteurs et des clients ; le nom et l'identité de l'entreprise seront définis ultérieurement. Pour cette démonstration, seuls des produits et utilisateurs de test sont utilisés.
>
> Lorsqu'un client passe commande, son historique est enregistré sur notre serveur PHP dans une base SQLite commune. Le responsable peut suivre cette commande, la confirmer, gérer le stock et signaler une livraison simulée. Cette livraison déclenche une attribution unique de points : c'est un mécanisme concret de fidélisation.
>
> Si le client rencontre une difficulté, il ouvre un ticket auprès du service après-vente ; l'administrateur répond depuis son propre espace et l'historique des échanges reste accessible. Le client peut également noter une commande livrée.
>
> Enfin, le tableau de bord exploite ces données pour observer le nombre de commandes, les segments de clientèle, les interactions SAV, le chiffre d'affaires simulé et la satisfaction. Nous illustrons ainsi la GRC opérationnelle, interactive et analytique. »

## Messages importants au jury

- **Plateforme fonctionnelle avec données de démonstration** : les commandes, tickets, points et avis sont réellement enregistrés dans une base de test ; aucun argent n'est encaissé.
- **GRC opérationnelle** : gérer commandes, clients et produits.
- **GRC interactive** : permettre l'échange entre client et entreprise par le SAV.
- **GRC analytique** : exploiter historiques, segments et indicateurs pour mieux comprendre la clientèle.
- **Fidélisation** : encourager une relation durable par un système de points.
- **Satisfaction** : collecter des notes et en analyser la moyenne.
- **Sécurité et limites** : sessions, autorisations serveur et données fictives ; le site n'est pas une boutique commerciale en production.

## Questions probables et réponses prudentes

**Pourquoi SQLite plutôt que MySQL ?** La version de soutenance fonctionne sur un PC avec peu d'installation ; SQLite convient à ce périmètre de démonstration. Une exploitation à plus grande échelle demanderait une analyse supplémentaire.

**En quoi la GRC va-t-elle au-delà de la boutique ?** Le même système sert à connaître les clients, traiter leurs demandes, mesurer leur satisfaction, suivre la fidélité et produire des indicateurs à partir de leur historique.

**Le chiffre d'affaires affiché est-il réel ?** Non. Il est calculé à partir des commandes fictives marquées livrées.

**Peut-on payer en ligne ou livrer les produits ?** Non. Ces activités sont volontairement exclues de cette version universitaire.

**Les données persistent-elles après l'arrêt du navigateur ?** Oui, tant que la base locale est conservée et que le serveur n'est pas réinitialisé. Elles ne sont pas seulement simulées en JavaScript.

**Que se passe-t-il si le client tente de consulter les commandes d'autrui ou l'administration ?** Le serveur vérifie l'identité, le rôle et la propriété des ressources. Les données privées ne sont pas autorisées par un simple affichage du bouton.

## Après la présentation

Arrêter le serveur et tout tunnel temporaire. Ne pas diffuser les identifiants fictifs hors du groupe ; conserver une sauvegarde cohérente de la base si nécessaire. Consigner les anomalies constatées avant toute prochaine modification.
