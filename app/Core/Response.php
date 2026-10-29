<?php
declare(strict_types=1);
namespace App\Core;

final class Response
{
    public static function headers(): void
    {
        header_remove('X-Powered-By');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
        header('X-Frame-Options: DENY');
        header('Cache-Control: no-store');
    }

    public static function send(array $body, int $status = 200): never
    {
        self::headers();
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        exit;
    }

    public static function ok(mixed $data, int $status = 200): never
    {
        self::send(['success' => true, 'data' => $data, 'message' => null], $status);
    }

    public static function failure(\Throwable $error): never
    {
        if ($error instanceof ApiException) {
            if ($error->status === 429) {
                header('Retry-After: 900');
            }
            self::send(['success' => false, 'error' => ['code' => $error->apiCode, 'message' => $error->getMessage()]], $error->status);
        }
        // Never record SQL parameters, request bodies, passwords or exception messages.
        $record = gmdate('c') . ' ' . get_class($error) . ' ' . basename($error->getFile()) . ':' . $error->getLine() . PHP_EOL;
        try {
            Config::ensureStorage();
            error_log($record, 3, Config::storagePath() . '/errors.log');
        } catch (\Throwable) {
            error_log('GRC: erreur interne ; journal privé indisponible.');
        }
        self::send(['success' => false, 'error' => ['code' => 'INTERNAL_ERROR', 'message' => 'Une erreur interne est survenue.']], 500);
    }
}
