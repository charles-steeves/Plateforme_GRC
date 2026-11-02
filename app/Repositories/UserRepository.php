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

    /** Allow a short nickname only for the explicitly seeded demo accounts.
     * Registered real clients continue using their own e-mail addresses.
     * The lookup must be unique; it cannot grant access without the password.
     */
    public function byDemoAlias(string $alias): ?array
    {
        $alias = strtolower(trim($alias));
        $admin = null;
        if ($alias === 'admin') {
            // Original demo admin keeps id=1 even if its e-mail was changed.
            $stmt = $this->pdo->query("SELECT id,name,email,role,password_hash FROM users WHERE id=1 AND role='admin'");
            $admin = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if ($admin !== null) return $admin;
        $statement = $this->pdo->query("SELECT id,name,email,role,password_hash
            FROM users WHERE email GLOB 'client[0-9]*@example.test' AND role='client'");
        $found = null;
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $user) {
            $first = explode(' ', $user['name'], 2)[0];
            if (strtolower($first) === $alias) {
                if ($found !== null) return null;
                $found = $user;
            }
        }
        return $found;
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
