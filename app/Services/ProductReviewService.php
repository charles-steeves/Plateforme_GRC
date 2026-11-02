<?php
declare(strict_types=1);
namespace App\Services;

use App\Core\{ApiException, Database, Validation};
use PDO;

/** Product ratings and comments. Delivered-order satisfaction remains separate. */
final class ProductReviewService
{
    public function __construct(private readonly PDO $pdo) {}

    private function productExists(int $id): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM products WHERE id = ? AND active = 1');
        $statement->execute([$id]);
        return $statement->fetchColumn() !== false;
    }

    public function publicReviews(int $productId): array
    {
        if (!$this->productExists($productId)) {
            throw new ApiException(404, 'NOT_FOUND', 'Produit introuvable.');
        }
        $total = $this->pdo->prepare('SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average FROM product_reviews WHERE product_id = ? AND visible = 1');
        $total->execute([$productId]);
        $summary = $total->fetch(PDO::FETCH_ASSOC);
        $stmt = $this->pdo->prepare("SELECT r.id, r.rating, r.comment, r.created_at, u.name AS author,
               EXISTS(SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id
                      WHERE o.user_id = r.user_id AND oi.product_id = r.product_id AND o.status = 'delivered') AS verified
            FROM product_reviews r JOIN users u ON u.id = r.user_id
            WHERE r.product_id = ? AND r.visible = 1 ORDER BY r.created_at DESC, r.id DESC LIMIT 50");
        $stmt->execute([$productId]);
        return [
            'rating_count' => (int)$summary['count'],
            'rating_average' => $summary['average'] === null ? null : (float)$summary['average'],
            'items' => array_map(static fn(array $row): array => [
                'id' => (int)$row['id'], 'rating' => (int)$row['rating'],
                'comment' => $row['comment'], 'author' => $row['author'],
                'created_at' => $row['created_at'], 'verified_purchase' => (bool)$row['verified'],
            ], $stmt->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    public function create(int $productId, int $userId, array $input): array
    {
        Validation::fields($input, ['rating', 'comment']);
        $rating = Validation::integer($input, 'rating', 1, 5);
        $comment = Validation::text($input, 'comment', 0, 1500, '');
        if (!$this->productExists($productId)) {
            throw new ApiException(404, 'NOT_FOUND', 'Produit introuvable.');
        }
        try {
            return Database::write($this->pdo, function () use ($productId, $userId, $rating, $comment): array {
                $stmt = $this->pdo->prepare('INSERT INTO product_reviews(product_id,user_id,rating,comment,created_at) VALUES(?,?,?,?,?)');
                $stmt->execute([$productId, $userId, $rating, $comment, gmdate('Y-m-d\TH:i:s\Z')]);
                return ['id' => (int)$this->pdo->lastInsertId(), 'product_id' => $productId, 'rating' => $rating, 'comment' => $comment];
            });
        } catch (\PDOException $error) {
            if (($error->errorInfo[1] ?? null) === 19) {
                throw new ApiException(409, 'REVIEW_EXISTS', 'Vous avez déjà donné un avis sur ce produit.');
            }
            throw $error;
        }
    }

    public function adminReviews(): array
    {
        $sql = "SELECT r.id, r.product_id, p.name AS product_name, u.name AS customer_name,
                       r.rating, r.comment, r.created_at, r.visible
                FROM product_reviews r
                JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
                ORDER BY r.created_at DESC, r.id DESC LIMIT 250";
        $rows = $this->pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        return ['items' => array_map(static fn(array $row): array => [
            'id' => (int)$row['id'], 'product_id' => (int)$row['product_id'],
            'product_name' => $row['product_name'], 'customer_name' => $row['customer_name'],
            'rating' => (int)$row['rating'], 'comment' => $row['comment'],
            'created_at' => $row['created_at'], 'visible' => (bool)$row['visible'],
        ], $rows)];
    }

    public function moderate(int $reviewId, array $input): array
    {
        Validation::fields($input, ['visible']);
        if (!array_key_exists('visible', $input) || !is_bool($input['visible'])) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Indiquez la visibilité de cet avis.');
        }
        return Database::write($this->pdo, function () use ($reviewId, $input): array {
            $stmt = $this->pdo->prepare('UPDATE product_reviews SET visible = ? WHERE id = ?');
            $stmt->execute([$input['visible'] ? 1 : 0, $reviewId]);
            if ($stmt->rowCount() !== 1) {
                // SQLite may report zero when an unchanged value was requested.
                $check = $this->pdo->prepare('SELECT 1 FROM product_reviews WHERE id = ?');
                $check->execute([$reviewId]);
                if ($check->fetchColumn() === false) throw new ApiException(404, 'NOT_FOUND', 'Avis introuvable.');
            }
            return ['id' => $reviewId, 'visible' => $input['visible']];
        });
    }
}
