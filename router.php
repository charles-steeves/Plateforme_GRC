<?php
declare(strict_types=1);

/**
 * Compatibility entry point for the short local command:
 *   php -S 127.0.0.1:8001 router.php
 *
 * Public assets and API remain served ONLY through public/router.php,
 * which restricts all paths to public/. Never expose repository files.
 */
require __DIR__ . '/public/router.php';
