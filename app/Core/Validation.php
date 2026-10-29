<?php
declare(strict_types=1);
namespace App\Core;

final class Validation
{
    public static function fields(array $data, array $allowed): void
    {
        if (array_diff(array_keys($data), $allowed) !== []) {
            self::invalid('Champ non autorisé.');
        }
    }

    public static function text(array $data, string $key, int $min, int $max, ?string $default = null): string
    {
        $value = array_key_exists($key, $data) ? $data[$key] : $default;
        if (!is_string($value) || preg_match('//u', $value) !== 1
            || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
            self::invalid('Texte invalide : ' . $key . '.');
        }
        $value = trim($value);
        $length = preg_match_all('/./us', $value);
        if ($length < $min || $length > $max) {
            self::invalid('Longueur invalide : ' . $key . '.');
        }
        return $value;
    }

    public static function integer(array $data, string $key, int $min, int $max, ?int $default = null): int
    {
        $value = array_key_exists($key, $data) ? $data[$key] : $default;
        if (!is_int($value) || $value < $min || $value > $max) {
            self::invalid('Entier invalide : ' . $key . '.');
        }
        return $value;
    }

    public static function invalid(string $message = 'Données invalides.'): never
    {
        throw new ApiException(422, 'VALIDATION_ERROR', $message);
    }
}
