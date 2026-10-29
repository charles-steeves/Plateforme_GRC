<?php
declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class GrcRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function loyalty(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, order_id, points_delta, reason, created_at FROM loyalty_transactions '
            . 'WHERE user_id = :user_id ORDER BY created_at DESC, id DESC'
        );
        $statement->execute(['user_id' => $userId]);
        $transactions = $statement->fetchAll(PDO::FETCH_ASSOC);
        $balance = 0;
        foreach ($transactions as &$row) {
            $row['id'] = (int) $row['id'];
            $row['order_id'] = $row['order_id'] === null ? null : (int) $row['order_id'];
            $row['points_delta'] = (int) $row['points_delta'];
            $balance += $row['points_delta'];
        }
        unset($row);
        return ['balance' => $balance, 'transactions' => $transactions];
    }

    public function ownedOrder(int $id, int $userId): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, status FROM orders WHERE id = :id AND user_id = :user_id');
        $statement->execute(['id' => $id, 'user_id' => $userId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    public function feedbackExists(int $orderId): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM feedback WHERE order_id = :order_id');
        $statement->execute(['order_id' => $orderId]);
        return $statement->fetchColumn() !== false;
    }

    public function insertFeedback(int $userId, int $orderId, int $rating, string $comment, string $createdAt): array
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO feedback (order_id, user_id, rating, comment, created_at) '
            . 'VALUES (:order_id, :user_id, :rating, :comment, :created_at)'
        );
        $statement->execute([
            'order_id' => $orderId,
            'user_id' => $userId,
            'rating' => $rating,
            'comment' => $comment,
            'created_at' => $createdAt,
        ]);
        return [
            'id' => (int) $this->pdo->lastInsertId(),
            'order_id' => $orderId,
            'rating' => $rating,
            'comment' => $comment,
            'created_at' => $createdAt,
        ];
    }

    public function customers(string $search, int $page, int $perPage, string $inactiveBefore): array
    {
        // LIKE wildcards are user text, never extra search syntax.
        $pattern = '%' . strtr($search, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
        $where = <<<'SQL'
u.role = 'client' AND (u.name LIKE :name ESCAPE '\' OR u.email LIKE :email ESCAPE '\')
SQL;
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM users u WHERE ' . $where);
        $statement->execute(['name' => $pattern, 'email' => $pattern]);
        $total = (int) $statement->fetchColumn();

        $statement = $this->pdo->prepare($this->customerSelect() . ' WHERE ' . $where
            . ' GROUP BY u.id ORDER BY u.id DESC LIMIT :limit OFFSET :offset');
        $statement->bindValue(':name', $pattern);
        $statement->bindValue(':email', $pattern);
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();
        $items = array_map(fn (array $row): array => $this->customerShape($row, $inactiveBefore),
            $statement->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total];
    }

    public function customer(int $id, string $inactiveBefore): ?array
    {
        $statement = $this->pdo->prepare($this->customerSelect() . " WHERE u.role = 'client' AND u.id = :id GROUP BY u.id");
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $this->customerShape($row, $inactiveBefore);
    }

    public function dashboard(string $inactiveBefore): array
    {
        // All indicators use one SQLite statement and therefore one read snapshot.
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT
 (SELECT COUNT(*) FROM users WHERE role = 'client') AS customers_count,
 (SELECT COUNT(*) FROM orders WHERE status <> 'cancelled') AS orders_count,
 (SELECT COALESCE(SUM(total_xaf), 0) FROM orders WHERE status = 'delivered') AS ca_simule_xaf,
 (SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'in_progress')) AS tickets_open_count,
 (SELECT AVG(rating) FROM feedback) AS satisfaction_avg,
 (SELECT COUNT(*) FROM (
    SELECT u.id FROM users u JOIN orders o ON o.user_id = u.id AND o.status <> 'cancelled'
    WHERE u.role = 'client' GROUP BY u.id HAVING MAX(o.created_at) < :inactive_before
 )) AS customers_inactive_count,
 (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending,
 (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') AS confirmed,
 (SELECT COUNT(*) FROM orders WHERE status = 'delivered') AS delivered,
 (SELECT COUNT(*) FROM orders WHERE status = 'cancelled') AS cancelled
SQL);
        $statement->execute(['inactive_before' => $inactiveBefore]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        $result = [];
        foreach (['customers_count', 'orders_count', 'ca_simule_xaf', 'tickets_open_count', 'customers_inactive_count'] as $field) {
            $result[$field] = (int) $row[$field];
        }
        $result['satisfaction_avg'] = $row['satisfaction_avg'] === null ? null : (float) $row['satisfaction_avg'];
        $result['order_status_counts'] = [];
        foreach (['pending', 'confirmed', 'delivered', 'cancelled'] as $status) {
            $result['order_status_counts'][$status] = (int) $row[$status];
        }
        // Aggregate recent orders by UTC calendar day; include days with zero
        // orders so the dashboard never invents an interpolated series.
        $firstDay = (new \DateTimeImmutable('today', new \DateTimeZone('UTC')))->modify('-6 days');
        $statement = $this->pdo->prepare(
            "SELECT substr(created_at, 1, 10) AS order_day, COUNT(*) AS total
             FROM orders WHERE created_at >= :start
             GROUP BY substr(created_at, 1, 10)"
        );
        $statement->execute(['start' => $firstDay->format('Y-m-d\T00:00:00\Z')]);
        $counts = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $item) {
            $counts[$item['order_day']] = (int)$item['total'];
        }
        $result['orders_last_7_days'] = [];
        for ($offset = 0; $offset < 7; $offset++) {
            $day = $firstDay->modify('+' . $offset . ' days')->format('Y-m-d');
            $result['orders_last_7_days'][] = ['day' => $day, 'count' => $counts[$day] ?? 0];
        }
        return $result;
    }

    private function customerSelect(): string
    {
        return <<<'SQL'
SELECT u.id, u.name, u.email, u.created_at,
 COUNT(o.id) AS orders_count,
 COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_xaf ELSE 0 END), 0) AS total_delivered_xaf,
 MAX(o.created_at) AS last_order_at
FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status <> 'cancelled'
SQL;
    }

    private function customerShape(array $row, string $inactiveBefore): array
    {
        $count = (int) $row['orders_count'];
        $lastOrder = $row['last_order_at'];
        $segment = match (true) {
            $lastOrder !== null && $lastOrder < $inactiveBefore => 'inactive',
            $count >= 3 => 'regular',
            $count === 2 => 'occasional',
            $count === 1 => 'new',
            default => 'no_purchase',
        };
        return [
            'id' => (int) $row['id'], 'name' => $row['name'], 'email' => $row['email'],
            'created_at' => $row['created_at'], 'segment' => $segment,
            'orders_count' => $count, 'total_delivered_xaf' => (int) $row['total_delivered_xaf'],
            'last_order_at' => $lastOrder,
        ];
    }
}
