<?php
declare(strict_types=1);

// Real services against an entirely in-memory SQLite DB; no HTTP server, no storage reset.
// Run: php tests/domain-integration.php
require dirname(__DIR__) . '/app/bootstrap.php';
require dirname(__DIR__) . '/database/seed.php';

use App\Core\ApiException;
use App\Services\{AuthService, ProductService, OrderService, TicketService, GrcService};

$checks = 0;
$check = static function (bool $ok, string $message) use (&$checks): void {
    if (!$ok) {
        throw new RuntimeException('Échec du test métier : ' . $message);
    }
    $checks++;
};
$reject = static function (callable $action, int $expectedStatus, string $message) use ($check): void {
    try {
        $action();
    } catch (ApiException $error) {
        $check($error->status === $expectedStatus, $message . ' (statut HTTP)');
        return;
    }
    throw new RuntimeException('Une action interdite a réussi : ' . $message);
};

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_STRINGIFY_FETCHES => false,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec(file_get_contents(dirname(__DIR__) . '/database/schema.sql'));
seedDemo($pdo); // Creates fictional data in memory only, with random passwords.

$products = new ProductService($pdo);
$orders = new OrderService($pdo);
$tickets = new TicketService($pdo);
$grc = new GrcService($pdo);
$auth = new AuthService($pdo);
$client = ['id' => 2, 'role' => 'client'];
$otherClient = ['id' => 3, 'role' => 'client'];
$admin = ['id' => 1, 'role' => 'admin'];

$check(count($products->listing([])['items']) === 12, '12 articles de démonstration');
$check($pdo->query('PRAGMA foreign_keys')->fetchColumn() == 1, 'clés étrangères actives');
$check(count($grc->customers([])['items']) === 8, '8 clients fictifs');

$registered = $auth->register([
    'name' => 'Client Test',
    'email' => 'smoke@example.test',
    'password' => 'a-valid-password-123',
]);
$check($registered['role'] === 'client', 'une inscription crée exclusivement un client');
$reject(fn() => $auth->register([
    'name' => 'Admin injecté',
    'email' => 'admin-inject@example.test',
    'password' => 'a-valid-password-123',
    'role' => 'admin',
]), 422, 'impossible de choisir admin par inscription');

$stockBefore = (int) $pdo->query('SELECT stock_quantity FROM products WHERE id=1')->fetchColumn();
$creditBefore = $grc->loyalty(2)['balance'];
$revenueBefore = $grc->dashboard()['ca_simule_xaf'];

$order = $orders->create($client, ['items' => [['product_id' => 1, 'quantity' => 2]]]);
$check($order['status'] === 'pending', 'commande créée dans le bon état');
$check($order['total_xaf'] === 190000, 'prix calculé par SQLite et non par navigateur');
$check(
    (int) $pdo->query('SELECT stock_quantity FROM products WHERE id=1')->fetchColumn() === $stockBefore - 2,
    'stock réservé par commande'
);
$reject(fn() => $orders->create($admin, [
    'items' => [['product_id' => 1, 'quantity' => 1]],
]), 403, 'un admin ne passe pas de commande client');
$reject(fn() => $orders->create($client, [
    'items' => [['product_id' => 1, 'quantity' => 100]],
]), 422, 'quantité invalide refusée');
$reject(fn() => $orders->create($client, [
    'items' => [['product_id' => 1, 'quantity' => 20], ['product_id' => 1, 'quantity' => 20]],
]), 422, 'produit dupliqué refusé');

$orders->changeStatus($order['id'], ['status' => 'confirmed']);
$orders->changeStatus($order['id'], ['status' => 'delivered']);
$orders->changeStatus($order['id'], ['status' => 'delivered']);
$check($grc->loyalty(2)['balance'] === $creditBefore + 190, 'points livrés une seule fois');
$check($grc->dashboard()['ca_simule_xaf'] === $revenueBefore + 190000, 'CA simulé livré');
$check(
    (int) $pdo->query("SELECT COUNT(*) FROM loyalty_transactions WHERE order_id={$order['id']} AND reason='delivery_credit'")->fetchColumn() === 1,
    'unicité du crédit en base'
);
$reject(fn() => $orders->changeStatus($order['id'], ['status' => 'cancelled']), 409, 'livraison définitive');

$review = $grc->feedback(2, ['order_id' => $order['id'], 'rating' => 5, 'comment' => 'Avis fictif']);
$check($review['rating'] === 5, 'avis après livraison');
$reject(fn() => $grc->feedback(2, ['order_id' => $order['id'], 'rating' => 4]), 409, 'second avis interdit');
$reject(fn() => $grc->feedback(3, ['order_id' => $order['id'], 'rating' => 4]), 404, 'avis sur commande d’autrui');

$ticket = $tickets->create($client, [
    'order_id' => $order['id'], 'subject' => 'Demande fictive',
    'description' => 'Le produit de démo nécessite une réponse.', 'category' => 'sav',
]);
$check($ticket['user_id'] === 2 && $ticket['order_id'] === $order['id'], 'ticket lié au propriétaire');
$reject(fn() => $tickets->detail($ticket['id'], $otherClient), 404, 'ticket d’autrui masqué');
$reject(fn() => $tickets->create($otherClient, [
    'order_id' => $order['id'], 'subject' => 'Intrusion', 'description' => 'Accès', 'category' => 'sav',
]), 404, 'commande d’autrui interdite dans ticket');
$tickets->message($ticket['id'], $client, ['body' => 'Bonjour']);
$tickets->message($ticket['id'], $admin, ['body' => 'Réponse de démonstration']);
$check(count($tickets->detail($ticket['id'], $client)['messages']) === 2, 'conversation SAV bilatérale');
$tickets->changeStatus($ticket['id'], ['status' => 'closed']);
$reject(fn() => $tickets->message($ticket['id'], $client, ['body' => 'Encore']), 409, 'ticket fermé non modifiable');

$stockTwoBefore = (int) $pdo->query('SELECT stock_quantity FROM products WHERE id=2')->fetchColumn();
$cancelled = $orders->create($client, ['items' => [['product_id' => 2, 'quantity' => 1]]]);
$orders->changeStatus($cancelled['id'], ['status' => 'cancelled']);
$orders->changeStatus($cancelled['id'], ['status' => 'cancelled']);
$check(
    (int) $pdo->query('SELECT stock_quantity FROM products WHERE id=2')->fetchColumn() === $stockTwoBefore,
    'annulation restaurée exactement une fois'
);
$reject(fn() => $orders->changeStatus($cancelled['id'], ['status' => 'delivered']), 409, 'livraison après annulation interdite');

$product = $products->create([
    'name' => 'Article ajouté par administration', 'category' => 'Démo',
    'description' => '', 'price_xaf' => 12900, 'stock_quantity' => 5,
    'image_url' => '/assets/images/produit.v2.PNG', 'active' => true,
]);
$check($product['id'] > 12 && $product['price_xaf'] === 12900, 'création produit via le service');
$reject(fn() => $products->create([
    'name' => 'Image externe', 'category' => 'Démo', 'description' => '',
    'price_xaf' => 1, 'stock_quantity' => 1,
    'image_url' => 'https://evil.example/a.png',
]), 422, 'URL image externe rejetée');

$customer = $grc->customer(2);
$check($customer['customer']['id'] === 2 && count($customer['orders']) > 0, 'fiche GRC avec historique');
$check($grc->dashboard()['customers_count'] === 9, 'dashboard recalculé depuis les vrais comptes');

echo "OK — {$checks} assertions métier SQLite isolées ; aucun fichier de démonstration touché\n";
