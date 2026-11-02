<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Database;
use App\Core\Validation;
use App\Repositories\GrcRepository;
use PDO;

final class GrcService
{
    private readonly GrcRepository $repository;

    public function __construct(private readonly PDO $pdo)
    {
        $this->repository = new GrcRepository($pdo);
    }

    public function loyalty(int $userId): array
    {
        return $this->repository->loyalty($userId);
    }

    public function feedback(int $userId, array $input): array
    {
        Validation::fields($input, ['order_id', 'rating', 'comment']);
        $orderId = Validation::integer($input, 'order_id', 1, PHP_INT_MAX);
        $rating = Validation::integer($input, 'rating', 1, 5);
        $comment = Validation::text($input, 'comment', 0, 1500, '');
        return Database::write($this->pdo, function () use ($userId, $orderId, $rating, $comment): array {
            $order = $this->repository->ownedOrder($orderId, $userId);
            if ($order === null) {
                throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
            }
            if ($order['status'] !== 'delivered') {
                throw new ApiException(409, 'ORDER_NOT_DELIVERED', 'La commande doit être livrée avant de donner un avis.');
            }
            if ($this->repository->feedbackExists($orderId)) {
                throw new ApiException(409, 'FEEDBACK_EXISTS', 'Un avis existe déjà pour cette commande.');
            }
            return $this->repository->insertFeedback($userId, $orderId, $rating, $comment, gmdate('Y-m-d\TH:i:s\Z'));
        });
    }

    public function customers(array $query): array
    {
        Validation::fields($query, ['search', 'page', 'per_page']);
        $search = Validation::text($query, 'search', 0, 254, '');
        $page = $this->pageNumber($query, 'page', 1, 1000000);
        $perPage = $this->pageNumber($query, 'per_page', 20, 100);
        return $this->repository->customers($search, $page, $perPage, $this->inactiveBefore());
    }

    public function customer(int $id): array
    {
        $customer = $this->repository->customer($id, $this->inactiveBefore());
        if ($customer === null) {
            throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
        }
        // Aggregate from historical order lines, not from the current product
        // price or an editable client score. Exclude cancelled orders.
        $metrics = $this->pdo->prepare("
            SELECT COUNT(DISTINCT o.id) AS orders_count,
                   COALESCE(SUM(oi.quantity), 0) AS items_count,
                   COUNT(DISTINCT substr(o.created_at, 1, 7)) AS active_months,
                   MIN(o.created_at) AS first_order_at,
                   MAX(o.created_at) AS last_order_at,
                   COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) AS delivered_orders_count,
                   COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.line_total_xaf ELSE 0 END), 0) AS delivered_spend_xaf
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.user_id = :user_id AND o.status <> 'cancelled'
        ");
        $metrics->execute(['user_id' => $id]);
        $row = $metrics->fetch(PDO::FETCH_ASSOC);
        $delivered = (int)($row['delivered_orders_count'] ?? 0);
        $statistics = [
            'orders_count' => (int)($row['orders_count'] ?? 0),
            'items_count' => (int)($row['items_count'] ?? 0),
            'active_months' => (int)($row['active_months'] ?? 0),
            'first_order_at' => $row['first_order_at'] ?? null,
            'last_order_at' => $row['last_order_at'] ?? null,
            'delivered_orders_count' => $delivered,
            'delivered_spend_xaf' => (int)($row['delivered_spend_xaf'] ?? 0),
            'average_delivered_basket_xaf' => $delivered > 0
                ? (int)round((int)$row['delivered_spend_xaf'] / $delivered)
                : 0,
        ];
        return [
            'customer' => $customer,
            'orders' => (new OrderService($this->pdo))->mine($id),
            'tickets' => (new TicketService($this->pdo))->mine($id),
            'loyalty_balance' => $this->loyalty($id)['balance'],
            'statistics' => $statistics,
        ];
    }

    public function dashboard(): array
    {
        return $this->repository->dashboard($this->inactiveBefore());
    }

    private function inactiveBefore(): string
    {
        return gmdate('Y-m-d\TH:i:s\Z', time() - 90 * 86400);
    }

    private function pageNumber(array $query, string $key, int $default, int $max): int
    {
        if (!array_key_exists($key, $query)) {
            return $default;
        }
        $value = $query[$key];
        if ((!is_string($value) && !is_int($value))
            || preg_match('/^[1-9][0-9]*$/D', (string) $value) !== 1
            || strlen((string) $value) > strlen((string) $max)
            || (int) $value > $max) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Pagination invalide.');
        }
        return (int) $value;
    }
}
