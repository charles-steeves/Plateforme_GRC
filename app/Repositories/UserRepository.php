<?php
declare(strict_types=1);
namespace App\Repositories;

use PDO;

final class UserRepository
{
    public function __construct(private readonly PDO $pdo) {}

    public function byEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        return $stmt->fetch() ?: null;
    }

    public function byId(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, name, email, role FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function dummyHash(): string
    {
        // A real seed hash makes unknown-account verification use the same hash algorithm.
        return $this->pdo->query('SELECT password_hash FROM users ORDER BY id LIMIT 1')->fetchColumn()
            ?: password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT);
    }

    public function create(string $name, string $email, string $passwordHash): array
    {
        $stmt = $this->pdo->prepare("INSERT INTO users(name,email,password_hash,role,created_at) VALUES(:name,:email,:password_hash,'client',:created_at)");
        $stmt->execute(['name' => $name, 'email' => $email, 'password_hash' => $passwordHash, 'created_at' => gmdate('Y-m-d\TH:i:s\Z')]);
        return $this->byId((int)$this->pdo->lastInsertId());
    }
}
