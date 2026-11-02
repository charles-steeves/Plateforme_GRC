<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\Database;
use App\Services\GrcService;

$db = Database::connect();
$clientId = (int)$db->query("SELECT id FROM users WHERE role='client' ORDER BY id LIMIT 1")->fetchColumn();
$detail = (new GrcService($db))->customer($clientId);
$metrics = $detail['statistics'] ?? null;
if (!is_array($metrics) || $metrics['orders_count'] < 1 || $metrics['items_count'] < $metrics['orders_count']
    || $metrics['active_months'] < 1 || $metrics['delivered_spend_xaf'] < 0) {
    throw new RuntimeException('Per-client transaction statistics unavailable.');
}
$manual = $db->prepare("SELECT COUNT(DISTINCT o.id) AS purchases, COALESCE(SUM(oi.quantity),0) AS units
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE o.user_id=? AND o.status<>'cancelled'");
$manual->execute([$clientId]);
$row = $manual->fetch(PDO::FETCH_ASSOC);
if ($metrics['orders_count'] !== (int)$row['purchases'] || $metrics['items_count'] !== (int)$row['units']) {
    throw new RuntimeException('Client statistics differ from SQLite transactions.');
}
echo "OK — individual customer statistics agree with stored orders\n";
