<?php
declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class OrderRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function find(int $id, bool $admin = false): ?array
    {
        $sql = $admin
            ? 'SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=:id'
            : 'SELECT * FROM orders WHERE id=:id';
        $statement = $this->pdo->prepare($sql);
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $this->hydrate($row, $admin);
    }

    public function mine(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM orders WHERE user_id=:user_id ORDER BY created_at DESC, id DESC');
        $statement->execute(['user_id' => $userId]);
        return array_map(fn (array $row): array => $this->hydrate($row, false), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function adminList(): array
    {
        $statement = $this->pdo->query('SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC, o.id DESC');
        return array_map(fn (array $row): array => $this->hydrate($row, true), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    private function hydrate(array $row, bool $admin): array
    {
        $statement = $this->pdo->prepare('SELECT product_id, product_name, quantity, unit_price_xaf, line_total_xaf FROM order_items WHERE order_id=:order_id ORDER BY id');
        $statement->execute(['order_id' => $row['id']]);
        $items = $statement->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            foreach (['product_id', 'quantity', 'unit_price_xaf', 'line_total_xaf'] as $key) {
                $item[$key] = (int) $item[$key];
            }
        }
        unset($item);
        $order = [
            'id' => (int) $row['id'],
            'status' => $row['status'],
            'total_xaf' => (int) $row['total_xaf'],
            'customer_note' => (string) ($row['customer_note'] ?? ''),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'items' => $items,
        ];
        if ($admin) {
            $order['user_id'] = (int) $row['user_id'];
            $order['customer_name'] = $row['customer_name'];
            $order['customer_email'] = $row['customer_email'];
        }
        return $order;
    }
}
