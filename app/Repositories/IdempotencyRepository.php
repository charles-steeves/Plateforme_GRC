<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Core\ApiException;
use PDO;

/**
 * At-most-once creation per authenticated user + operation + request key.
 * Called only inside Database::write() (BEGIN IMMEDIATE). Works against
 * already initialized SQLite without resetting/replacing any old tables.
 */
final class IdempotencyRepository
{
    public function __construct(private readonly PDO $pdo) {}

    public static function key(array $input): ?string
    {
        if (!array_key_exists('request_id', $input)) return null;
        $value = $input['request_id'];
        if (!is_string($value) || preg_match('/^[A-Za-z0-9_-]{16,80}$/D', $value) !== 1) {
            throw new ApiException(422, 'INVALID_REQUEST_ID', 'Identifiant de requête invalide.');
        }
        return $value;
    }

    public function ensureTable(): void
    {
        // Safe, idempotent schema extension. SQLite DDL is transactional.
        $this->pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS idempotency_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('order', 'ticket')),
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resource_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, action, request_key)
)
SQL);
    }

    public function previous(int $userId, string $action, string $key, string $hash): ?int
    {
        $stmt = $this->pdo->prepare('SELECT request_hash, resource_id FROM idempotency_requests
          WHERE user_id=:user_id AND action=:action AND request_key=:key');
        $stmt->execute(['user_id' => $userId, 'action' => $action, 'key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) return null;
        if (!hash_equals($row['request_hash'], $hash)) {
            throw new ApiException(409, 'REQUEST_KEY_REUSED', 'Cette demande a déjà été utilisée pour une autre opération.');
        }
        return (int)$row['resource_id'];
    }

    public function remember(int $userId, string $action, string $key, string $hash, int $resourceId): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO idempotency_requests
          (user_id, action, request_key, request_hash, resource_id, created_at)
          VALUES (:user_id,:action,:key,:hash,:resource_id,:now)');
        $stmt->execute([
            'user_id' => $userId, 'action' => $action, 'key' => $key,
            'hash' => $hash, 'resource_id' => $resourceId, 'now' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
    }
}
