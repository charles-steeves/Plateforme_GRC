<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';
use App\Services\CrmInsightService;

// Tests sur une base éphémère ; aucun compte ni commande réelle modifiés.
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, role TEXT)');
$db->exec('CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT, total_xaf INTEGER, created_at TEXT)');
$db->exec('CREATE TABLE tickets(id INTEGER PRIMARY KEY, status TEXT)');
$db->exec('CREATE TABLE feedback(id INTEGER PRIMARY KEY, rating INTEGER)');
$db->exec('CREATE TABLE loyalty_transactions(id INTEGER PRIMARY KEY, user_id INTEGER, points_delta INTEGER)');
$db->exec("INSERT INTO users VALUES
(1,'Admin','admin'),
(2,'Sans achat','client'),
(3,'Très bon','client'),
(4,'Bon','client'),
(5,'Occasionnel','client'),
(6,'Nouveau','client'),
(7,'Récence intermédiaire','client')");
$today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
$insert = $db->prepare('INSERT INTO orders(user_id,status,total_xaf,created_at) VALUES(?,?,?,?)');
$add = static function(int $id, int $count, int $amount, int $days) use ($today, $insert): void {
    $date = $today->modify("-$days days")->format('Y-m-d\T12:00:00\Z');
    for ($i=0; $i<$count; $i++) $insert->execute([$id,'delivered',$amount,$date]);
};
$add(3, 6, 900000, 10); // R5 + F5 + M5 = 15
$add(4, 3, 800000, 10); // R5 + F3 + M3 = 11
$add(5, 1, 80000, 10); // R5 + F1 + M1 = 7
$add(6, 1, 80000, 250); // R1 + F1 + M1 = 3
$add(7, 1, 80000, 95); // R3 + F1 + M1 = 5

$report = (new CrmInsightService($db))->report();
$byId = [];
foreach ($report['rfm'] as $client) $byId[$client['id']] = $client;
foreach ([
    2 => ['Sans achat',0,0],
    3 => ['Très bon client',15,5],
    4 => ['Bon client',11,5],
    5 => ['Client occasionnel',7,5],
    6 => ['Nouveau client',3,1],
    7 => ['Client occasionnel',5,3]
] as $id => [$segment, $score, $recency]) {
    if (!isset($byId[$id]) || $byId[$id]['segment'] !== $segment
        || $byId[$id]['score'] !== $score || $byId[$id]['r'] !== $recency) {
        throw new RuntimeException('Segment ou score RFM incorrect pour le client ' . $id);
    }
}
if ($byId[2]['months'] !== null || $byId[2]['days'] !== null) {
    throw new RuntimeException('Un client sans achat ne doit pas avoir de récence.');
}
if (!is_float($byId[6]['months']) || $byId[6]['months'] <= 7 || $byId[6]['months'] >= 9) {
    throw new RuntimeException('Récence non exprimée en mois.');
}
if ($byId[7]['months'] <= 2 || $byId[7]['months'] >= 7) {
    throw new RuntimeException('Récence intermédiaire hors limites mensuelles.');
}
if (array_sum($report['segments']) !== 6) throw new RuntimeException('Les segments ne couvrent pas les six clients.');
echo "OK — récence en mois, barème RFM et quatre classements, sans achat 0/15\n";
