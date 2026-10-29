<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Config;

/**
 * Admin-only product image upload (authorization and CSRF at route boundary).
 * Never trusts the client filename or declared MIME type.
 */
final class ImageUploadService
{
    private const MAX_BYTES = 1_900_000;
    private const MAX_DIMENSION = 4096;
    private const MAX_PIXELS = 12_000_000;

    public function upload(): array
    {
        $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
        if (!preg_match('~^multipart/form-data\s*;~i', $type)) {
            throw new ApiException(400, 'INVALID_CONTENT_TYPE', 'Sélectionnez une image à envoyer.');
        }
        if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > self::MAX_BYTES + 65536) {
            throw new ApiException(422, 'IMAGE_TOO_LARGE', 'Cette image est trop volumineuse (1,9 Mo maximum).');
        }
        if (array_keys($_POST) !== [] || count($_FILES) !== 1 || !isset($_FILES['image'])
            || !is_array($_FILES['image'])) {
            throw new ApiException(422, 'INVALID_UPLOAD', 'Sélectionnez une seule image.');
        }
        $file = $_FILES['image'];
        if (!isset($file['error']) || !is_int($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            throw new ApiException(422, 'UPLOAD_FAILED', 'L’image n’a pas pu être envoyée. Choisissez un fichier de moins de 1,9 Mo.');
        }
        if (!isset($file['size'], $file['tmp_name']) || !is_int($file['size'])
            || $file['size'] < 1 || $file['size'] > self::MAX_BYTES
            || !is_string($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new ApiException(422, 'INVALID_UPLOAD', 'Image invalide ou trop volumineuse.');
        }
        // getimagesize inspects file bytes, not the browser supplied extension/MIME.
        $info = @getimagesize($file['tmp_name']);
        if (!is_array($info) || count($info) < 3 || $info[0] < 1 || $info[1] < 1
            || $info[0] > self::MAX_DIMENSION || $info[1] > self::MAX_DIMENSION
            || $info[0] * $info[1] > self::MAX_PIXELS) {
            throw new ApiException(422, 'INVALID_IMAGE', 'Le fichier doit être une image valide de dimensions raisonnables.');
        }
        $extension = match ($info[2]) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
        if ($extension === null) {
            throw new ApiException(422, 'INVALID_IMAGE_TYPE', 'Utilisez une image JPG, PNG ou WebP.');
        }
        $images = Config::root() . '/public/assets/images';
        $imagesReal = realpath($images);
        if ($imagesReal === false || !is_dir($imagesReal)) {
            throw new \RuntimeException('Dossier des images publiques introuvable.');
        }
        $directory = $images . '/uploads';
        if (is_link($directory) || (file_exists($directory) && !is_dir($directory))) {
            throw new \RuntimeException('Dossier des images téléchargées invalide.');
        }
        if (!is_dir($directory) && !@mkdir($directory, 0755) && !is_dir($directory)) {
            throw new \RuntimeException('Impossible de préparer le dossier des images.');
        }
        $real = realpath($directory);
        if ($real === false || !Config::isWithin($real, $imagesReal)) {
            throw new \RuntimeException('Dossier des images hors de la zone autorisée.');
        }
        $name = bin2hex(random_bytes(16)) . '.' . $extension;
        $destination = $real . DIRECTORY_SEPARATOR . $name;
        if (file_exists($destination) || !move_uploaded_file($file['tmp_name'], $destination)) {
            throw new \RuntimeException('Impossible d’enregistrer l’image.');
        }
        @chmod($destination, 0644);
        return ['image_url' => '/assets/images/uploads/' . $name];
    }
}
