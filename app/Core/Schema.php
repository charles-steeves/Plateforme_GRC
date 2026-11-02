<?php
declare(strict_types=1);
namespace App\Core;

use PDO;

/** Additive, idempotent schema change: never removes existing sales or accounts. */
final class Schema
{
    private const PRODUCT_REVIEWS = <<<'SQL'
CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
    created_at TEXT NOT NULL,
    UNIQUE(product_id, user_id)
)
SQL;

    public static function ensureProductReviews(PDO $pdo): void
    {
        $exists = $pdo->query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'product_reviews' LIMIT 1")->fetchColumn();
        if ($exists === false) {
            $pdo->exec(self::PRODUCT_REVIEWS);
        }
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_product_visible ON product_reviews(product_id, visible, created_at)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id)');
    }
}
