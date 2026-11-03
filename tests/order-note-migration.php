<?php
declare(strict_types=1);
// Ancien schéma SQLite, en mémoire seulement ; aucune base utilisateur touchée.
require dirname(__DIR__).'/app/bootstrap.php';
use App\Core\Schema;
$db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT,total_xaf INTEGER,created_at TEXT,updated_at TEXT)');
$db->exec("INSERT INTO orders VALUES(17,2,'delivered',150000,'2026-01-01','2026-01-02')");
Schema::ensureOrderCustomerNote($db);
Schema::ensureOrderCustomerNote($db);
$cols=array_column($db->query('PRAGMA table_info(orders)')->fetchAll(PDO::FETCH_ASSOC),'name');
if(count(array_filter($cols,static fn($name)=>$name==='customer_note'))!==1)throw new RuntimeException('Migration colonne non idempotente');
$row=$db->query('SELECT * FROM orders WHERE id=17')->fetch(PDO::FETCH_ASSOC);
if($row['total_xaf']!=150000||$row['status']!=='delivered'||$row['customer_note']!=='')throw new RuntimeException('Une commande historique a changé');
$db->exec("UPDATE orders SET customer_note='Remarque conservée' WHERE id=17");
if($db->query('SELECT customer_note FROM orders WHERE id=17')->fetchColumn()!=='Remarque conservée')throw new RuntimeException('Note non persistée');
echo "OK — migration SQLite non destructive et notes de commande\n";
