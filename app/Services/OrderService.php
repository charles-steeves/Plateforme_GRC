<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Database;
use App\Core\Validation;
use App\Repositories\OrderRepository;
use App\Repositories\IdempotencyRepository;
use PDO;

final class OrderService
{
    private readonly OrderRepository $orders;

    public function __construct(private readonly PDO $pdo)
    {
        $this->orders = new OrderRepository($pdo);
    }

    public function create(array $user, array $input): array
    {
        if (($user['role'] ?? null) !== 'client') {
            throw new ApiException(403, 'FORBIDDEN', 'Accès réservé aux clients.');
        }
        // Submitted prices are deliberately ignored; authority fields are rejected.
        Validation::fields($input, ['items', 'request_id', 'price', 'price_xaf', 'unit_price_xaf']);
        $requestKey = IdempotencyRepository::key($input);
        $items = $input['items'] ?? null;
        if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 30) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Une commande contient entre 1 et 30 lignes.');
        }
        $lines = [];
        $seen = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                throw new ApiException(422, 'VALIDATION_ERROR', 'Ligne de commande invalide.');
            }
            Validation::fields($item, ['product_id', 'quantity', 'price', 'price_xaf', 'unit_price_xaf', 'line_total_xaf']);
            $productId = Validation::integer($item, 'product_id', 1, PHP_INT_MAX);
            $quantity = Validation::integer($item, 'quantity', 1, 20);
            if (isset($seen[$productId])) {
                throw new ApiException(422, 'DUPLICATE_PRODUCT', 'Un produit ne peut apparaître qu’une fois dans une commande.');
            }
            $seen[$productId] = true;
            $lines[] = ['product_id' => $productId, 'quantity' => $quantity];
        }
        usort($lines, static fn(array $left, array $right): int => $left['product_id'] <=> $right['product_id']);
        $fingerprint = hash('sha256', json_encode($lines, JSON_THROW_ON_ERROR));
        return Database::write($this->pdo, function () use ($user, $lines, $requestKey, $fingerprint): array {
            $requestLog = null;
            if ($requestKey !== null) {
                $requestLog = new IdempotencyRepository($this->pdo);
                $requestLog->ensureTable();
                $oldId = $requestLog->previous((int)$user['id'], 'order', $requestKey, $fingerprint);
                if ($oldId !== null) {
                    $previous = $this->orders->find($oldId);
                    if ($previous === null) throw new \RuntimeException('Commande précédente introuvable.');
                    return $previous;
                }
            }
            $find = $this->pdo->prepare('SELECT id, name, price_xaf, stock_quantity FROM products WHERE id=:id AND active=1');
            $total = 0;
            foreach ($lines as &$line) {
                $find->execute(['id' => $line['product_id']]);
                $product = $find->fetch(PDO::FETCH_ASSOC);
                if ($product === false) {
                    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
                }
                if ((int) $product['stock_quantity'] < $line['quantity']) {
                    throw new ApiException(409, 'OUT_OF_STOCK', 'Stock insuffisant pour cette commande.');
                }
                $price = (int) $product['price_xaf'];
                if ($price < 0 || ($price > 0 && $line['quantity'] > intdiv(PHP_INT_MAX, $price))) {
                    throw new ApiException(422, 'AMOUNT_OVERFLOW', 'Le montant dépasse la limite autorisée.');
                }
                $subtotal = $price * $line['quantity'];
                if ($total > PHP_INT_MAX - $subtotal) {
                    throw new ApiException(422, 'AMOUNT_OVERFLOW', 'Le montant dépasse la limite autorisée.');
                }
                $total += $subtotal;
                $line['product_name'] = $product['name'];
                $line['unit_price_xaf'] = $price;
                $line['line_total_xaf'] = $subtotal;
            }
            unset($line);
            $now = gmdate('Y-m-d\TH:i:s\Z');
            $insert = $this->pdo->prepare("INSERT INTO orders(user_id, status, total_xaf, created_at, updated_at) VALUES (:user_id, 'pending', :total, :created, :updated)");
            $insert->execute(['user_id' => $user['id'], 'total' => $total, 'created' => $now, 'updated' => $now]);
            $orderId = (int) $this->pdo->lastInsertId();
            $reserve = $this->pdo->prepare('UPDATE products SET stock_quantity=stock_quantity-:quantity, updated_at=:updated WHERE id=:id AND active=1 AND stock_quantity>=:quantity');
            $insertLine = $this->pdo->prepare('INSERT INTO order_items(order_id, product_id, product_name, quantity, unit_price_xaf, line_total_xaf) VALUES (:order_id, :product_id, :name, :quantity, :price, :total)');
            foreach ($lines as $line) {
                $reserve->execute(['quantity' => $line['quantity'], 'updated' => $now, 'id' => $line['product_id']]);
                if ($reserve->rowCount() !== 1) {
                    throw new ApiException(409, 'OUT_OF_STOCK', 'Stock insuffisant pour cette commande.');
                }
                $insertLine->execute(['order_id' => $orderId, 'product_id' => $line['product_id'], 'name' => $line['product_name'], 'quantity' => $line['quantity'], 'price' => $line['unit_price_xaf'], 'total' => $line['line_total_xaf']]);
            }
            if ($requestLog !== null) {
                $requestLog->remember((int)$user['id'], 'order', $requestKey, $fingerprint, $orderId);
            }
            return $this->orders->find($orderId);
        });
    }

    public function mine(int $userId): array
    {
        return $this->orders->mine($userId);
    }

    public function adminList(): array
    {
        return $this->orders->adminList();
    }

    public function changeStatus(int $id, array $input): array
    {
        Validation::fields($input, ['status']);
        $next = Validation::text($input, 'status', 1, 20);
        if (!in_array($next, ['pending', 'confirmed', 'delivered', 'cancelled'], true)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Statut de commande invalide.');
        }
        return Database::write($this->pdo, function () use ($id, $next): array {
            $order = $this->orders->find($id, true);
            if ($order === null) {
                throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
            }
            $current = $order['status'];
            if ($current === $next) {
                return $order;
            }
            $allowed = ['pending' => ['confirmed', 'cancelled'], 'confirmed' => ['delivered', 'cancelled'], 'delivered' => [], 'cancelled' => []];
            if (!in_array($next, $allowed[$current], true)) {
                throw new ApiException(409, 'INVALID_TRANSITION', 'Transition de commande interdite.');
            }
            $now = gmdate('Y-m-d\TH:i:s\Z');
            if ($next === 'cancelled') {
                $findProduct = $this->pdo->prepare('SELECT stock_quantity FROM products WHERE id=:id');
                $restore = $this->pdo->prepare('UPDATE products SET stock_quantity=stock_quantity+:quantity, updated_at=:updated WHERE id=:id');
                foreach ($order['items'] as $item) {
                    $findProduct->execute(['id' => $item['product_id']]);
                    $stock = $findProduct->fetchColumn();
                    if ($stock === false || (int) $stock > PHP_INT_MAX - $item['quantity']) {
                        throw new ApiException(409, 'STOCK_OVERFLOW', 'Impossible de restaurer le stock.');
                    }
                    $restore->execute(['quantity' => $item['quantity'], 'updated' => $now, 'id' => $item['product_id']]);
                }
            }
            if ($next === 'delivered') {
                // The transition and unique credit are part of the same write transaction.
                $credit = $this->pdo->prepare("INSERT INTO loyalty_transactions(user_id, order_id, points_delta, reason, created_at) VALUES (:user_id, :order_id, :points, 'delivery_credit', :created)");
                $credit->execute(['user_id' => $order['user_id'], 'order_id' => $id, 'points' => intdiv($order['total_xaf'], 1000), 'created' => $now]);
            }
            $update = $this->pdo->prepare('UPDATE orders SET status=:status, updated_at=:updated WHERE id=:id');
            $update->execute(['status' => $next, 'updated' => $now, 'id' => $id]);
            return $this->orders->find($id, true);
        });
    }
}
