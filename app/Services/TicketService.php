<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Database;
use App\Core\Validation;
use App\Repositories\TicketRepository;
use App\Repositories\IdempotencyRepository;
use PDO;

final class TicketService
{
    private readonly TicketRepository $tickets;

    public function __construct(private readonly PDO $pdo)
    {
        $this->tickets = new TicketRepository($pdo);
    }

    public function create(array $user, array $input): array
    {
        if (($user['role'] ?? null) !== 'client') {
            throw new ApiException(403, 'FORBIDDEN', 'Accès réservé aux clients.');
        }
        Validation::fields($input, ['order_id', 'subject', 'description', 'category', 'request_id']);
        $requestKey = IdempotencyRepository::key($input);
        $subject = Validation::text($input, 'subject', 1, 160);
        $description = Validation::text($input, 'description', 1, 4000);
        $category = Validation::text($input, 'category', 1, 80, 'sav');
        $orderId = ($input['order_id'] ?? null) === null ? null : Validation::integer($input, 'order_id', 1, PHP_INT_MAX);
        $fingerprint = hash('sha256', json_encode([$orderId, $subject, $description, $category], JSON_THROW_ON_ERROR));
        return Database::write($this->pdo, function () use ($user, $subject, $description, $category, $orderId, $requestKey, $fingerprint): array {
            $requestLog = null;
            if ($requestKey !== null) {
                $requestLog = new IdempotencyRepository($this->pdo);
                $requestLog->ensureTable();
                $oldId = $requestLog->previous((int)$user['id'], 'ticket', $requestKey, $fingerprint);
                if ($oldId !== null) {
                    $previous = $this->tickets->find($oldId);
                    if ($previous === null) throw new \RuntimeException('Ticket précédent introuvable.');
                    return $previous;
                }
            }
            if ($orderId !== null) {
                $statement = $this->pdo->prepare('SELECT id FROM orders WHERE id=:id AND user_id=:user_id');
                $statement->execute(['id' => $orderId, 'user_id' => $user['id']]);
                if ($statement->fetchColumn() === false) {
                    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
                }
            }
            $now = gmdate('Y-m-d\TH:i:s\Z');
            $statement = $this->pdo->prepare("INSERT INTO tickets(user_id, order_id, subject, description, category, status, created_at, updated_at) VALUES (:user_id, :order_id, :subject, :description, :category, 'open', :created, :updated)");
            $statement->execute(['user_id' => $user['id'], 'order_id' => $orderId, 'subject' => $subject, 'description' => $description, 'category' => $category, 'created' => $now, 'updated' => $now]);
            $ticketId = (int)$this->pdo->lastInsertId();
            if ($requestLog !== null) {
                $requestLog->remember((int)$user['id'], 'ticket', $requestKey, $fingerprint, $ticketId);
            }
            return $this->tickets->find($ticketId);
        });
    }

    public function mine(int $userId): array
    {
        return $this->tickets->mine($userId);
    }

    public function detail(int $id, array $user): array
    {
        return ['ticket' => $this->owned($id, $user), 'messages' => $this->tickets->messages($id)];
    }

    public function message(int $id, array $user, array $input): array
    {
        Validation::fields($input, ['body']);
        $body = Validation::text($input, 'body', 1, 4000);
        return Database::write($this->pdo, function () use ($id, $user, $body): array {
            $ticket = $this->owned($id, $user);
            if ($ticket['status'] === 'closed') {
                throw new ApiException(409, 'TICKET_CLOSED', 'Ce ticket est fermé.');
            }
            $now = gmdate('Y-m-d\TH:i:s\Z');
            $statement = $this->pdo->prepare('INSERT INTO ticket_messages(ticket_id, author_user_id, body, created_at) VALUES (:ticket_id, :author, :body, :created)');
            $statement->execute(['ticket_id' => $id, 'author' => $user['id'], 'body' => $body, 'created' => $now]);
            $messageId = (int) $this->pdo->lastInsertId();
            $update = $this->pdo->prepare('UPDATE tickets SET updated_at=:updated WHERE id=:id');
            $update->execute(['updated' => $now, 'id' => $id]);
            return ['id' => $messageId, 'ticket_id' => $id, 'author_user_id' => (int) $user['id'], 'body' => $body, 'created_at' => $now];
        });
    }

    public function adminList(): array
    {
        return $this->tickets->adminList();
    }

    public function changeStatus(int $id, array $input): array
    {
        Validation::fields($input, ['status']);
        $next = Validation::text($input, 'status', 1, 20);
        if (!in_array($next, ['open', 'in_progress', 'resolved', 'closed'], true)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Statut de ticket invalide.');
        }
        return Database::write($this->pdo, function () use ($id, $next): array {
            $ticket = $this->tickets->find($id, true);
            if ($ticket === null) {
                throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
            }
            if ($ticket['status'] === $next) {
                return $ticket;
            }
            $allowed = ['open' => ['in_progress', 'resolved', 'closed'], 'in_progress' => ['resolved', 'closed'], 'resolved' => ['closed', 'in_progress'], 'closed' => []];
            if (!in_array($next, $allowed[$ticket['status']], true)) {
                throw new ApiException(409, 'INVALID_TRANSITION', 'Transition de ticket interdite.');
            }
            $update = $this->pdo->prepare('UPDATE tickets SET status=:status, updated_at=:updated WHERE id=:id');
            $update->execute(['status' => $next, 'updated' => gmdate('Y-m-d\TH:i:s\Z'), 'id' => $id]);
            return $this->tickets->find($id, true);
        });
    }

    private function owned(int $id, array $user): array
    {
        $ticket = $this->tickets->find($id);
        if ($ticket === null || (($user['role'] ?? null) !== 'admin' && $ticket['user_id'] !== (int) ($user['id'] ?? 0))) {
            throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
        }
        return $ticket;
    }
}
