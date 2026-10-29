<?php
declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'App\\')) {
        $file = __DIR__ . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, 4)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
date_default_timezone_set('UTC');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(static function (Throwable $error): void {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Échec : " . $error->getMessage() . PHP_EOL);
        exit(1);
    }
    App\Core\Response::failure($error);
});
