<?php
declare(strict_types=1);
namespace App\Services;

use App\Core\{ApiException, Database, Security, Validation};
use App\Repositories\UserRepository;
use PDO;

final class AuthService
{
    private readonly UserRepository $users;
    public function __construct(private readonly PDO $pdo)
    {
        $this->users = new UserRepository($pdo);
    }

    private function email(array $input): string
    {
        $email = strtolower(Validation::text($input, 'email', 3, 254));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            Validation::invalid('Adresse e-mail invalide.');
        }
        return $email;
    }

    public function register(array $input): array
    {
        Validation::fields($input, ['name', 'email', 'password']);
        $name = Validation::text($input, 'name', 1, 120);
        $email = $this->email($input);
        $password = $input['password'] ?? null;
        if (!is_string($password) || preg_match('//u', $password) !== 1 || str_contains($password, "\0")
            || preg_match_all('/./us', $password) < 12 || strlen($password) > 72) {
            Validation::invalid('Mot de passe : au moins 12 caractères et au plus 72 octets.');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        try {
            return Database::write($this->pdo, fn(): array => $this->users->create($name, $email, $hash));
        } catch (\PDOException $error) {
            if (($error->errorInfo[1] ?? null) === 19) {
                throw new ApiException(409, 'REGISTRATION_CONFLICT', 'Inscription impossible avec ces informations.');
            }
            throw $error;
        }
    }

    public function login(array $input): array
    {
        Validation::fields($input, ['email', 'password']);
        // The login form also accepts a simple alias for built-in demo users.
        // Real registrations continue using a valid e-mail address.
        $identity = strtolower(Validation::text($input, 'email', 2, 254));
        $email = str_contains($identity, '@') ? $this->email($input) : null;
        if ($email === null && preg_match('/^[\\p{L}][\\p{L}0-9_-]{1,39}$/uD', $identity) !== 1) {
            Validation::invalid('Identifiant de connexion invalide.');
        }
        $password = $input['password'] ?? null;
        if (!is_string($password) || strlen($password) > 72 || preg_match('//u', $password) !== 1 || str_contains($password, "\0")) {
            Validation::invalid('Mot de passe invalide.');
        }
        (new LoginLimiter($this->pdo))->record($identity);
        $user = $email === null ? $this->users->byDemoAlias($identity) : $this->users->byEmail($email);
        $valid = password_verify($password, $user['password_hash'] ?? $this->users->dummyHash());
        if (!$user || !$valid) {
            throw new ApiException(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects.');
        }
        Security::login((int)$user['id']);
        unset($user['password_hash']);
        return $user;
    }

    public function user(?string $role = null): array
    {
        Security::session();
        $id = $_SESSION['user_id'] ?? null;
        $user = is_int($id) ? $this->users->byId($id) : null;
        if (!$user) {
            throw new ApiException(401, 'AUTH_REQUIRED', 'Connexion requise.');
        }
        if ($role !== null && $user['role'] !== $role) {
            throw new ApiException(403, 'ACCESS_DENIED', 'Accès refusé.');
        }
        return $user;
    }
}
