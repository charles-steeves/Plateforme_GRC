<?php
declare(strict_types=1);

/** Deterministic fictional business data; passwords are generated per initialization. */
function seedDemo(PDO $db): array
{
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $at = static fn(int $days): string => $now->modify("-$days days")->format('Y-m-d\TH:i:s\Z');
    $names = ['Administration Démo', 'Amina Démo', 'Brice Démo', 'Chloé Démo', 'Dorian Démo', 'Estelle Démo', 'Fabrice Démo', 'Grâce Démo', 'Hugo Démo'];
    $accounts = [];
    $userInsert = $db->prepare('INSERT INTO users(id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($names as $index => $name) {
        $id = $index + 1;
        $email = $id === 1 ? 'admin@example.test' : 'client' . $index . '@example.test';
        $role = $id === 1 ? 'admin' : 'client';
        // Phrase aléatoire lisible plutôt qu'une longue suite hexadécimale.
        // Aucun mot de passe commun ou prédictible n'est publié dans Git.
        $words = [
            'Acacia', 'Bambou', 'Corail', 'Dune', 'Ebene', 'Flamme', 'Galet', 'Horizon',
            'Ivoire', 'Jardin', 'Kola', 'Lagune', 'Mangue', 'Nuage', 'Ocean', 'Palmier',
            'Quartz', 'Rivage', 'Soleil', 'Terre', 'Univers', 'Voile', 'Wassa', 'Zenith',
            'Atlas', 'Bateau', 'Cascade', 'Douceur', 'Etoile', 'Foret', 'Gazelle', 'Heron',
            'Jungle', 'Lumiere', 'Marigot', 'Nature', 'Oasis', 'Pirogue', 'Racine', 'Sable',
            'Tamarin', 'Vague', 'Wagon', 'Zebre', 'Aventure', 'Brise', 'Canari', 'Dauphin',
            'Eclat', 'Fleur', 'Guitare', 'Harmonie', 'Jasmin', 'Lac', 'Miel', 'Nacre',
            'Citron', 'Piano', 'Rocher', 'Savane', 'Tulipe', 'Vanille', 'Ylang', 'Argile',
        ];
        $password = $words[random_int(0, count($words) - 1)] . '-'
            . $words[random_int(0, count($words) - 1)] . '-'
            . $words[random_int(0, count($words) - 1)] . '-'
            . random_int(100000000, 999999999);
        $userInsert->execute([$id, $name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $at(180)]);
        $accounts[] = ['id' => $id, 'name' => $name, 'email' => $email, 'role' => $role, 'password' => $password];
    }
    $products = [
        ['Téléphone Kanda Démo', 'Téléphonie', 95000],
        ['Téléphone Akoma Démo', 'Téléphonie', 65000],
        ['Écouteurs Libreville Démo', 'Audio', 15000],
        ['Casque Ogooué Démo', 'Audio', 25000],
        ['Enceinte Port-Gentil Démo', 'Audio', 35000],
        ['Clavier Azobé Démo', 'Informatique', 12000],
        ['Souris Okoumé Démo', 'Informatique', 7500],
        ['Disque externe Ntem Démo', 'Informatique', 45000],
        ['Chargeur rapide Démo', 'Accessoires', 8500],
        ['Batterie externe Démo', 'Accessoires', 18000],
        ['Câble USB Démo', 'Accessoires', 3500],
        ['Support téléphone Démo', 'Accessoires', 5000],
    ];
    $insertProduct = $db->prepare('INSERT INTO products(id, name, description, category, price_xaf, stock_quantity, image_url, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 50, ?, 1, ?, ?)');
    foreach ($products as $index => [$name, $category, $price]) {
        $insertProduct->execute([$index + 1, $name, 'Démonstration — données fictives. Article sans vente ni livraison réelle.', $category, $price, '', $at(180), $at(0)]);
    }
    // user, product, quantity, status, age in days; all existing segments are represented.
    $orders = [
        [2, 1, 1, 'delivered', 30], [2, 3, 2, 'delivered', 20], [2, 6, 1, 'delivered', 10],
        [3, 2, 1, 'confirmed', 20], [3, 4, 1, 'delivered', 15],
        [4, 7, 2, 'pending', 1], [5, 8, 1, 'delivered', 120],
        [6, 9, 1, 'cancelled', 5], [7, 10, 1, 'delivered', 2], [9, 11, 2, 'confirmed', 3],
    ];
    $insertOrder = $db->prepare('INSERT INTO orders(id, user_id, status, total_xaf, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    $insertItem = $db->prepare('INSERT INTO order_items(order_id, product_id, product_name, quantity, unit_price_xaf, line_total_xaf) VALUES (?, ?, ?, ?, ?, ?)');
    $decrease = $db->prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');
    $insertPoints = $db->prepare('INSERT INTO loyalty_transactions(user_id, order_id, points_delta, reason, created_at) VALUES (?, ?, ?, ?, ?)');
    foreach ($orders as $index => [$user, $product, $quantity, $status, $age]) {
        $id = $index + 1;
        [$name, , $price] = $products[$product - 1];
        $total = $quantity * $price;
        $insertOrder->execute([$id, $user, $status, $total, $at($age), $at($age)]);
        $insertItem->execute([$id, $product, $name, $quantity, $price, $total]);
        if ($status !== 'cancelled') {
            $decrease->execute([$quantity, $product]);
        }
        if ($status === 'delivered') {
            $insertPoints->execute([$user, $id, intdiv($total, 1000), 'delivery_credit', $at($age)]);
        }
    }
    $tickets = [
        [2, 1, 'Question sur le produit fictif', 'open'],
        [3, 5, 'Suivi de démonstration', 'in_progress'],
        [5, 7, 'Assistance terminée', 'resolved'],
        [7, 9, 'Demande clôturée', 'closed'],
    ];
    $insertTicket = $db->prepare('INSERT INTO tickets(id, user_id, order_id, subject, description, category, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $insertMessage = $db->prepare('INSERT INTO ticket_messages(ticket_id, author_user_id, body, created_at) VALUES (?, ?, ?, ?)');
    foreach ($tickets as $index => [$user, $order, $subject, $status]) {
        $ticketId = $index + 1;
        $insertTicket->execute([$ticketId, $user, $order, $subject, 'Démonstration — données fictives. Aucun incident réel.', 'sav', $status, $at(1), $at(0)]);
        $insertMessage->execute([$ticketId, $user, 'Bonjour, ceci est une demande fictive.', $at(1)]);
        if ($status !== 'open') {
            $insertMessage->execute([$ticketId, 1, 'Réponse de démonstration de l’administration.', $at(0)]);
        }
    }
    $feedback = $db->prepare('INSERT INTO feedback(order_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)');
    $feedback->execute([1, 2, 5, 'Avis fictif de démonstration.', $at(25)]);
    $feedback->execute([5, 3, 4, 'Démonstration — données fictives.', $at(10)]);
    return ['notice' => 'Démonstration — données fictives. Ne jamais réutiliser ces comptes ou mots de passe ailleurs.', 'accounts' => $accounts];
}
