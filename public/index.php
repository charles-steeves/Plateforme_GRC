<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\{ApiException, Config, Response};
use App\Controllers\ApiController;

Response::headers();
Config::expectedOrigin();
$rawPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$path = is_string($rawPath) ? rawurldecode($rawPath) : '';
if (!str_starts_with($path, '/api/v1/') || preg_match('/[\x00-\x20\x7F\\\\]/', $path)) {
    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
}
(new ApiController())->dispatch($path, (string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
