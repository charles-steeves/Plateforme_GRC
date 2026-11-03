<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Schema;
use App\Services\ProductService;

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE products (id INTEGER PRIMARY KEY, category TEXT NOT NULL, active INTEGER NOT NULL)');
$db->exec("INSERT INTO products(id,category,active) VALUES
    (1,'Téléphones',1),(2,'Accessoires',1),(3,'Téléphones',0)");
Schema::ensureProductCategories($db);
Schema::ensureProductCategories($db);
$service = new ProductService($db);
$before = $db->query('SELECT id, category, active FROM products ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$categories = $service->adminCategories()['items'];
if (count($categories) !== 2) {
    throw new RuntimeException('Anciennes catégories perdues.');
}
$created = $service->createCategory(['name' => ' Informatique  et   réseaux ']);
if (($created['category']['name'] ?? '') !== 'Informatique et réseaux') {
    throw new RuntimeException('Nouvelle catégorie non créée.');
}
$public = $service->categories()['items'];
$empty = array_values(array_filter($public, static fn(array $r) => $r['name'] === 'Informatique et réseaux'));
if (count($empty) !== 1 || $empty[0]['count'] !== 0) {
    throw new RuntimeException('Nouvelle catégorie non visible à vide.');
}
$thrown = false;
try {
    $service->createCategory(['name' => 'informatique et réseaux']);
} catch (\App\Core\ApiException $e) {
    $thrown = true;
}
if (!$thrown) throw new RuntimeException('Doublon accepté.');
$after = $db->query('SELECT id, category, active FROM products ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
if ($before !== $after) throw new RuntimeException('Une ancienne fiche produit a changé.');
echo "OK — migration additive des catégories, aucune fiche ancienne modifiée\n";
