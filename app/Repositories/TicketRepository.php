<?php
declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class TicketRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function find(int $id, bool $admin = false): ?array
    {
        $sql = $admin
            ? 'SELECT t.*, u.name AS customer_name FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=:id'
            : 'SELECT * FROM tickets WHERE id=:id';
        $statement = $this->pdo->prepare($sql);
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $this->hydrate($row, $admin);
    }

    public function mine(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM tickets WHERE user_id=:user_id ORDER BY created_at DESC, id DESC');
        $statement->execute(['user_id' => $userId]);
        return array_map(fn (array $row): array => $this->hydrate($row), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function adminList(): array
    {
        $statement = $this->pdo->query('SELECT t.*, u.name AS customer_name FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC, t.id DESC');
        return array_map(fn (array $row): array => $this->hydrate($row, true), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function messages(int $ticketId): array
    {
        $statement = $this->pdo->prepare('SELECT id, ticket_id, author_user_id, body, created_at FROM ticket_messages WHERE ticket_id=:ticket_id ORDER BY created_at, id');
        $statement->execute(['ticket_id' => $ticketId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            foreach (['id', 'ticket_id', 'author_user_id'] as $key) {
                $row[$key] = (int) $row[$key];
            }
        }
        unset($row);
        return $rows;
    }

    private function hydrate(array $row, bool $admin = false): array
    {
        $ticket = [
            'id' => (int) $row['id'],
            'user_id' => (int) $row['user_id'],
            'order_id' => $row['order_id'] === null ? null : (int) $row['order_id'],
            'subject' => $row['subject'],
            'description' => $row['description'],
            'category' => $row['category'],
            'status' => $row['status'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
        if ($admin) {
            $ticket['customer_name'] = $row['customer_name'];
        }
        return $ticket;
    }
}
