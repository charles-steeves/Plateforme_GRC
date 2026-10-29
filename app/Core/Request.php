<?php
declare(strict_types=1);
namespace App\Core;

final class Request
{
    public static function json(): array
    {
        $contentType = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
        if ($contentType !== 'application/json') {
            throw new ApiException(400, 'INVALID_CONTENT_TYPE', 'Une requête JSON est requise.');
        }
        if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 65536) {
            throw new ApiException(422, 'BODY_TOO_LARGE', 'Requête trop volumineuse.');
        }
        $body = file_get_contents('php://input', false, null, 0, 65537);
        if ($body === false || strlen($body) > 65536) {
            throw new ApiException(422, 'BODY_TOO_LARGE', 'Requête trop volumineuse.');
        }
        try {
            $object = json_decode($body, false, 32, JSON_THROW_ON_ERROR);
            if (!$object instanceof \stdClass) {
                throw new \JsonException('Objet attendu.');
            }
            // Associative decoding otherwise turns {"0": ...} into a PHP list.
            // Keep the JSON array/object distinction for the only nested collection.
            if (property_exists($object, 'items') && !is_array($object->items)) {
                Validation::invalid('Les lignes de commande doivent former une liste JSON.');
            }
            if (isset($object->items)) {
                foreach ($object->items as $item) {
                    if (!$item instanceof \stdClass) {
                        Validation::invalid('Chaque ligne doit être un objet JSON.');
                    }
                }
            }
            return json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ApiException(400, 'INVALID_JSON', 'Le corps JSON est mal formé.');
        }
    }
}
