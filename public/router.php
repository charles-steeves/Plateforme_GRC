<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\{ApiException, Config, Response};

Response::headers();
Config::expectedOrigin();
\App\Core\FirstRun::ensure();
/*
 * A Quick Tunnel publishes the storefront, never the administrative UI or
 * private management APIs. Customers can still register, shop and use SAV.
 */
$incomingPath = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/');
if (Config::isQuickTunnelRequest()
    && (preg_match('~^/admin(?:-[a-z]+)?\.html$~D', $incomingPath) === 1
        || str_starts_with($incomingPath, '/api/v1/admin/'))) {
    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
}

$rawPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$path = is_string($rawPath) ? rawurldecode($rawPath) : '';
if ($path === '' || preg_match('/[\x00-\x20\x7F\\\\]/', $path)) {
    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
}
foreach (explode('/', $path) as $component) {
    if (str_starts_with($component, '.')) {
        throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
}
if (str_starts_with($path, '/api/v1/')) {
    require __DIR__ . '/index.php';
    return true;
}
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD');
    throw new ApiException(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
}
$target = realpath(__DIR__ . ($path === '/' ? '/index.html' : $path));
$types = [
    'html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'js' => 'text/javascript; charset=utf-8', 'svg' => 'image/svg+xml',
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
    'webp' => 'image/webp', 'gif' => 'image/gif', 'ico' => 'image/x-icon',
    'woff' => 'font/woff', 'woff2' => 'font/woff2',
];
$extension = $target === false ? '' : strtolower(pathinfo($target, PATHINFO_EXTENSION));
if ($target === false || !is_file($target) || !Config::isWithin($target, __DIR__) || !isset($types[$extension])) {
    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
}
header('Content-Type: ' . $types[$extension]);
header('Content-Length: ' . filesize($target));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
    readfile($target);
}
return true;
