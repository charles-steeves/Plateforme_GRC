<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Services\CrmInsightService;

if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    throw new RuntimeException('PDO SQLite requis.');
}
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec("CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, role TEXT)");
$db->exec("CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT, total_xaf INTEGER, created_at TEXT)");
$db->exec("CREATE TABLE tickets(id INTEGER PRIMARY KEY, status TEXT)");
$db->exec("CREATE TABLE feedback(id INTEGER PRIMARY KEY, rating INTEGER)");
$db->exec("CREATE TABLE loyalty_transactions(id INTEGER PRIMARY KEY, user_id INTEGER, points_delta INTEGER)");
$db->exec("INSERT INTO loyalty_transactions VALUES(1,2,50),(2,2,-10)");
$db->exec("INSERT INTO users VALUES(1,'Administrateur','admin'),(2,'Client actif','client'),(3,'Client sans achat','client')");
$today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
$stamp = static fn(int $days): string => $today->modify("-$days days")->format('Y-m-d\T12:00:00\Z');
$insert = $db->prepare('INSERT INTO orders VALUES(?,?,?,?,?)');
$insert->execute([1,2,'delivered',100000,$stamp(2)]);
$insert->execute([2,2,'delivered',50000,$stamp(9)]);
$insert->execute([3,2,'delivered',30000,$stamp(400)]);
$insert->execute([4,3,'cancelled',990000,$stamp(3)]);
$db->exec("INSERT INTO tickets VALUES(1,'open'),(2,'resolved')");
$db->exec("INSERT INTO feedback VALUES(1,5)");
$before = (int)$db->query('PRAGMA data_version')->fetchColumn();
$r = (new CrmInsightService($db))->report();
if ($r['registered_customers'] !== 2 || $r['buyers'] !== 1 || $r['orders'] !== 2 ||
    $r['revenue'] !== 150000 || $r['average_basket'] != 75000 ||
    $r['purchase_frequency'] != 2 || $r['annual_value'] != 150000)
    throw new RuntimeException('Calcul annuel incorrect.');
if ($r['retention'] != 100 || $r['pending_tickets'] !== 1 || $r['feedback_count'] !== 1 ||
    $r['satisfaction'] != 5) throw new RuntimeException('Indicateurs GRC incorrects.');
if (count($r['rfm']) !== 2 || array_sum($r['segments']) !== 2
    || $r['rfm'][0]['loyalty_points'] !== 40)
    throw new RuntimeException('Segmentation RFM incomplète.');
$inactive = array_values(array_filter($r['rfm'], static fn(array $c): bool => $c['id'] === 3));
if (count($inactive) !== 1 || $inactive[0]['segment'] !== 'À réactiver' ||
    $inactive[0]['days'] !== null || $inactive[0]['score'] !== 3)
    throw new RuntimeException('Clients sans achat exclus du scoring.');
if (count($r['monthly']) !== 12 || $before !== (int)$db->query('PRAGMA data_version')->fetchColumn())
    throw new RuntimeException('Périodes ou lecture SQLite invalides.');
echo "OK — calculs GRC isolés, rétention, RFM et avis\n";
