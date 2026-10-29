<?php
declare(strict_types=1);
namespace App\Services;

use App\Core\{ApiException, Config, Database};
use PDO;

final class LoginLimiter
{
    public function __construct(private readonly PDO $pdo) {}

    private function key(): string
    {
        $file = Config::storagePath() . '/rate-limit.key';
        // Lock a separate file so concurrent initial requests cannot read a partial key.
        $handle = fopen(Config::storagePath() . '/rate-limit.lock', 'c');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new \RuntimeException('Limiteur indisponible.');
        }
        try {
            if (!is_file($file)) {
                $key = random_bytes(32);
                if (file_put_contents($file, $key, LOCK_EX) !== 32) {
                    throw new \RuntimeException('Clé du limiteur indisponible.');
                }
                chmod($file, 0600);
            }
            $key = file_get_contents($file);
            if ($key === false || strlen($key) !== 32) {
                throw new \RuntimeException('Clé du limiteur invalide.');
            }
            return $key;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function record(string $email): void
    {
        $key = $this->key();
        $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'local');
        // Forwarded addresses are deliberately ignored: they are client-controlled by default.
        $subjects = [
            hash_hmac('sha256', 'email:' . $email, $key) => 10,
            hash_hmac('sha256', 'ip:' . $ip, $key) => 50,
            hash_hmac('sha256', 'pair:' . $email . '\0' . $ip, $key) => 10,
        ];
        Database::write($this->pdo, function () use ($subjects): void {
            $cutoff = gmdate('Y-m-d\TH:i:s\Z', time() - 900);
            $purge = $this->pdo->prepare('DELETE FROM login_attempts WHERE attempted_at <= :cutoff');
            $purge->execute(['cutoff' => $cutoff]);
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE subject_hash = :subject');
            foreach ($subjects as $subject => $limit) {
                $count->execute(['subject' => $subject]);
                if ((int)$count->fetchColumn() >= $limit) {
                    throw new ApiException(429, 'LOGIN_RATE_LIMIT', 'Trop de tentatives. Réessayez plus tard.');
                }
            }
            $insert = $this->pdo->prepare('INSERT INTO login_attempts(subject_hash,attempted_at) VALUES(:subject,:at)');
            foreach ($subjects as $subject => $limit) {
                $insert->execute(['subject' => $subject, 'at' => gmdate('Y-m-d\TH:i:s\Z')]);
            }
        });
    }
}
