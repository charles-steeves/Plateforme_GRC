<?php
declare(strict_types=1);

namespace App\Repositories;

use PDO;

final class ProductRepository
{
    private const COLUMNS = 'p.id, p.name, p.description, p.category, p.price_xaf, p.stock_quantity, p.image_url, p.active,
             (SELECT ROUND(AVG(r.rating), 1) FROM product_reviews r WHERE r.product_id = p.id AND r.visible = 1) AS rating_average,
             (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.visible = 1) AS rating_count';
    private const WRITABLE = ['name', 'description', 'category', 'price_xaf', 'stock_quantity', 'image_url', 'active'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array{items: array, total: int} */
    public function listing(string $search, string $category, int $limit, int $offset, string $sort = ''): array
    {
        $conditions = ['p.active = 1'];
        $parameters = [];
        if ($search !== '') {
            // Treat SQL LIKE metacharacters as literal search text.
            $conditions[] = "(p.name LIKE :search ESCAPE '\\' OR p.description LIKE :search ESCAPE '\\')";
            $parameters['search'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
        }
        if ($category !== '') {
            $conditions[] = 'p.category = :category';
            $parameters['category'] = $category;
        }
        $where = implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM products p WHERE ' . $where);
        $count->execute($parameters);
        $sorts = [
            '' => 'p.id ASC',
            'price_asc' => 'p.price_xaf ASC, p.id ASC',
            'price_desc' => 'p.price_xaf DESC, p.id ASC',
            'name' => 'p.name COLLATE NOCASE ASC, p.id ASC',
            'newest' => 'p.created_at DESC, p.id DESC',
            'rating' => 'rating_average DESC NULLS LAST, p.id ASC',
        ];
        $orderBy = $sorts[$sort] ?? $sorts[''];
        $statement = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM products p WHERE ' . $where . ' ORDER BY ' . $orderBy . ' LIMIT :limit OFFSET :offset');
        foreach ($parameters as $name => $value) {
            $statement->bindValue(':' . $name, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();
        return ['items' => array_map(self::serialize(...), $statement->fetchAll(PDO::FETCH_ASSOC)), 'total' => (int) $count->fetchColumn()];
    }

    /** Both independent categories and legacy product categories remain visible. */
    private function categoriesWithCounts(bool $activeOnly): array
    {
        $filter = $activeOnly ? ' WHERE active = 1' : '';
        $rows = $this->pdo->query(
            "SELECT g.name AS name, COALESCE(t.total, 0) AS total
             FROM (SELECT name FROM product_categories
                   UNION SELECT category AS name FROM products) g
             LEFT JOIN (
                SELECT category, COUNT(*) AS total
                FROM products" . $filter . "
                GROUP BY category
             ) t ON t.category = g.name COLLATE NOCASE
             ORDER BY g.name COLLATE NOCASE"
        )->fetchAll(PDO::FETCH_ASSOC);
        return array_map(static fn(array $row): array => [
            'name' => (string)$row['name'], 'count' => (int)$row['total'],
        ], $rows);
    }

    public function activeCategories(): array
    {
        return $this->categoriesWithCounts(true);
    }

    public function allCategories(): array
    {
        return $this->categoriesWithCounts(false);
    }

    /** No existing product row is altered when a new empty category is created. */
    public function insertCategory(string $name): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO product_categories(name, created_at) VALUES(:name, :created_at)'
        );
        $stmt->execute(['name' => $name, 'created_at' => gmdate('Y-m-d\\TH:i:s\\Z')]);
    }

    public function find(int $id, bool $publicOnly = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT ' . self::COLUMNS . ' FROM products p WHERE p.id = :id' . ($publicOnly ? ' AND p.active = 1' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : self::serialize($row);
    }

    public function all(): array
    {
        return array_map(self::serialize(...), $this->pdo->query('SELECT ' . self::COLUMNS . ' FROM products p ORDER BY p.id')->fetchAll(PDO::FETCH_ASSOC));
    }

    public function insert(array $values): int
    {
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $statement = $this->pdo->prepare('INSERT INTO products(name, description, category, price_xaf, stock_quantity, image_url, active, created_at, updated_at) VALUES (:name, :description, :category, :price_xaf, :stock_quantity, :image_url, :active, :created_at, :updated_at)');
        $statement->execute($values + ['created_at' => $now, 'updated_at' => $now]);
        return (int) $this->pdo->lastInsertId();
    }

    public function update(int $id, array $values): void
    {
        $assignments = [];
        $parameters = ['id' => $id, 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        // Column names come exclusively from this fixed allowlist, never from input.
        foreach (self::WRITABLE as $column) {
            if (array_key_exists($column, $values)) {
                $assignments[] = $column . ' = :' . $column;
                $parameters[$column] = $values[$column];
            }
        }
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare('UPDATE products SET ' . implode(', ', $assignments) . ' WHERE id = :id');
        $statement->execute($parameters);
    }

    private static function serialize(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'category' => $row['category'],
            'price_xaf' => (int) $row['price_xaf'],
            'stock_quantity' => (int) $row['stock_quantity'],
            'image_url' => $row['image_url'],
            'active' => (bool) $row['active'],
            'rating_average' => $row['rating_average'] === null ? null : (float)$row['rating_average'],
            'rating_count' => (int)$row['rating_count'],
        ];
    }
}
