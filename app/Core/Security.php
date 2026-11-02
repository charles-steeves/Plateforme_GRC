<?php
declare(strict_types=1);
namespace App\Core;

final class Security
{
    public static function session(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        Config::expectedOrigin();
        Config::ensureStorage();
        $path = Config::storagePath() . DIRECTORY_SEPARATOR . 'sessions';
        Config::ensureDirectory($path);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', '1800');
        session_save_path($path);
        session_name('GRCSESSID');
        session_set_cookie_params([
            'lifetime' => 0, 'path' => '/', 'secure' => Config::isHttps(),
            'httponly' => true, 'samesite' => 'Lax',
        ]);
        if (!session_start()) {
            throw new \RuntimeException('Session indisponible.');
        }
        $now = time();
        if (isset($_SESSION['created_at']) && ($now - (int)$_SESSION['created_at'] > 28800
                || $now - (int)($_SESSION['last_seen'] ?? 0) > 1800)) {
            $_SESSION = [];
            session_regenerate_id(true);
        }
        $_SESSION['created_at'] ??= $now;
        // Periodic read-only refreshes must not prolong authentication after
        // the user stops interacting with the site. This header never grants
        // authorization: every endpoint still checks the session and role.
        $route = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?? '');
        $passiveRead = ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && ($_SERVER['HTTP_X_GRC_PASSIVE'] ?? '') === '1'
            && preg_match('~^/api/v1/(?:tickets/me|tickets/[1-9][0-9]*|admin/tickets|admin/dashboard|admin/insights)$~D', $route) === 1;
        if (!$passiveRead) {
            $_SESSION['last_seen'] = $now;
        }
    }

    public static function token(): string
    {
        self::session();
        return $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
    }

    public static function mutation(): void
    {
        self::session();
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
        if ($origin !== null && (!is_string($origin) || $origin !== Config::expectedOrigin())) {
            throw new ApiException(403, 'ORIGIN_DENIED', 'Origine de la requête refusée.');
        }
        if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
            throw new ApiException(403, 'ORIGIN_DENIED', 'Origine de la requête refusée.');
        }
        $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!isset($_SESSION['csrf_token']) || !is_string($provided)
            || !hash_equals($_SESSION['csrf_token'], $provided)) {
            throw new ApiException(403, 'CSRF_INVALID', 'Jeton CSRF manquant ou invalide.');
        }
    }

    public static function login(int $id): void
    {
        self::session();
        $_SESSION = [];
        if (!session_regenerate_id(true)) {
            throw new \RuntimeException('Renouvellement de session impossible.');
        }
        $_SESSION = ['user_id' => $id, 'created_at' => time(), 'last_seen' => time(), 'csrf_token' => bin2hex(random_bytes(32))];
    }

    public static function logout(): void
    {
        self::session();
        $_SESSION = [];
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 3600, 'path' => $params['path'], 'secure' => $params['secure'],
            'httponly' => true, 'samesite' => 'Lax',
        ]);
        session_destroy();
    }
}
