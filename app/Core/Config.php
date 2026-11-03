<?php
declare(strict_types=1);
namespace App\Core;

final class Config
{
    public static function root(): string
    {
        return dirname(__DIR__, 2);
    }

    public static function databasePath(): string
    {
        $path = getenv('GRC_DB_PATH');
        if ($path === false || $path === '') {
            $path = self::root() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'grc.sqlite';
        }
        if (!preg_match('~^(?:[A-Za-z]:[\\\\/]|/|\\\\\\\\)~', $path)) {
            throw new \RuntimeException('GRC_DB_PATH doit être un chemin absolu privé.');
        }
        $parent = realpath(dirname($path));
        $public = realpath(self::root() . '/public');
        if ($parent !== false && $public !== false && self::isWithin($parent, $public)) {
            throw new \RuntimeException('La base doit rester hors du dossier public.');
        }
        // Existing symlinks cannot redirect the database into the document root.
        $real = realpath($path);
        if ($real !== false && $public !== false && self::isWithin($real, $public)) {
            throw new \RuntimeException('La base doit rester privée.');
        }
        return $path;
    }

    public static function isWithin(string $path, string $directory): bool
    {
        $path = str_replace('\\', '/', $path);
        $directory = rtrim(str_replace('\\', '/', $directory), '/');
        if (PHP_OS_FAMILY === 'Windows') {
            $path = strtolower($path);
            $directory = strtolower($directory);
        }
        return $path === $directory || str_starts_with($path, $directory . '/');
    }

    public static function storagePath(): string
    {
        return dirname(self::databasePath());
    }

    public static function ensureStorage(): void
    {
        $dir = self::storagePath();
        self::ensureDirectory($dir);
        // Check again after directory creation (including previously unresolved parents).
        self::databasePath();
    }

    public static function ensureDirectory(string $directory): void
    {
        // Another PHP process may create it between is_dir() and mkdir().
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new \RuntimeException('Impossible de créer le dossier privé. Vérifier le chemin et les permissions d’écriture.');
        }
    }

    /**
     * Cloudflare Quick Tunnels use temporary HTTPS hosts; the actual PHP
     * connection must still be confined to this PC (127.0.0.1 / ::1).
     * No wildcard for other domains or machines on the LAN.
     */
    /**
     * A local developer server must not fail merely because a previous
     * GRC_ORIGIN environment variable points to a different port or tunnel.
     */
    public static function isLoopbackHostRequest(): bool
    {
        $peer = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        if (!in_array($peer, ['127.0.0.1', '::1'], true)) return false;
        if (preg_match('~^(?:localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$~D', $host, $m) !== 1) {
            return false;
        }
        return !isset($m[1]) || (int) $m[1] === (int) ($_SERVER['SERVER_PORT'] ?? 0);
    }

    public static function isQuickTunnelRequest(): bool
    {
        $peer = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        return in_array($peer, ['127.0.0.1', '::1'], true)
            && preg_match('~^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$~D', $host) === 1;
    }

    public static function isHttps(): bool
    {
        if (self::isQuickTunnelRequest()) return true;
        if (in_array(strtolower((string)($_SERVER['HTTPS'] ?? '')), ['on', '1'], true)) {
            return true;
        }
        $trusted = array_filter(array_map('trim', explode(',', (string)getenv('GRC_TRUSTED_PROXIES'))));
        return in_array($_SERVER['REMOTE_ADDR'] ?? '', $trusted, true)
            && str_starts_with((string)getenv('GRC_ORIGIN'), 'https://')
            && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    }

    public static function expectedOrigin(): string
    {
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        if (self::isQuickTunnelRequest()) {
            // Cloudflare changes its temporary hostname on every launch.
            // Local admin permissions and role checks are NOT relaxed.
            return 'https://' . $host;
        }
        if (self::isLoopbackHostRequest()) {
            // Always recognize the current local port, even if GRC_ORIGIN
            // was left set for yesterday's server. No external host is trusted.
            return (self::isHttps() ? 'https://' : 'http://') . $host;
        }
        $configured = getenv('GRC_ORIGIN');
        if ($configured !== false && $configured !== '') {
            $origin = rtrim($configured, '/');
            $parts = parse_url($origin);
            if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)
                || !isset($parts['host']) || isset($parts['user']) || isset($parts['pass'])
                || isset($parts['path']) || isset($parts['query']) || isset($parts['fragment'])) {
                throw new \RuntimeException('GRC_ORIGIN invalide.');
            }
            $expectedHost = strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
            if ($host !== $expectedHost) {
                throw new ApiException(400, 'INVALID_HOST', 'Hôte non autorisé.');
            }
            if (($parts['scheme'] === 'https') !== self::isHttps()) {
                throw new ApiException(400, 'INVALID_SCHEME', 'Configuration HTTPS incohérente.');
            }
            return $origin;
        }
        if (!preg_match('~^(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$~D', $host, $match)
            || (isset($match[2]) && (int)$match[2] !== (int)($_SERVER['SERVER_PORT'] ?? 0))) {
            throw new ApiException(400, 'INVALID_HOST', 'Hôte non autorisé ; configurer GRC_ORIGIN pour le réseau local.');
        }
        return (self::isHttps() ? 'https://' : 'http://') . $host;
    }
}
