<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Database;
use App\Core\Validation;
use App\Repositories\ProductRepository;
use PDO;

final class ProductService
{
    public const MAX_PRICE = 1_000_000_000_000;
    public const MAX_STOCK = 1_000_000_000;
    private const FIELDS = ['name', 'description', 'category', 'price_xaf', 'stock_quantity', 'image_url', 'active'];

    private readonly ProductRepository $products;

    public function __construct(private readonly PDO $pdo)
    {
        $this->products = new ProductRepository($pdo);
    }

    public function listing(array $query): array
    {
        $page = $this->queryInteger($query, 'page', 1, PHP_INT_MAX);
        $perPage = $this->queryInteger($query, 'per_page', 12, 24);
        if ($page - 1 > intdiv(PHP_INT_MAX, $perPage)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'La page demandée est trop grande.');
        }
        $search = Validation::text($query, 'search', 0, 254, '');
        $category = Validation::text($query, 'category', 0, 120, '');
        $result = $this->products->listing($search, $category, $perPage, ($page - 1) * $perPage);
        return ['items' => $result['items'], 'page' => $page, 'per_page' => $perPage, 'total' => $result['total']];
    }

    public function categories(): array
    {
        return ['items' => $this->products->activeCategories()];
    }

    public function adminCategories(): array
    {
        return ['items' => $this->products->allCategories()];
    }

    public function detail(int $id): array
    {
        return $this->products->find($id, true) ?? throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
    }

    public function adminList(): array
    {
        return $this->products->all();
    }

    public function create(array $input): array
    {
        Validation::fields($input, self::FIELDS);
        $values = $this->validated($input, false);
        return Database::write($this->pdo, function () use ($values): array {
            $id = $this->products->insert($values);
            return $this->products->find($id);
        });
    }

    public function update(int $id, array $input): array
    {
        Validation::fields($input, self::FIELDS);
        if ($input === []) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Au moins un champ produit est requis.');
        }
        $values = $this->validated($input, true);
        return Database::write($this->pdo, function () use ($id, $values): array {
            if ($this->products->find($id) === null) {
                throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
            }
            $this->products->update($id, $values);
            return $this->products->find($id);
        });
    }

    private function validated(array $input, bool $partial): array
    {
        $values = [];
        foreach (['name' => [1, 120, null], 'description' => [0, 4000, ''], 'category' => [1, 120, null], 'image_url' => [0, 500, '']] as $key => [$min, $max, $default]) {
            if (!$partial || array_key_exists($key, $input)) {
                $values[$key] = Validation::text($input, $key, $min, $max, $default);
            }
        }
        if (array_key_exists('image_url', $values)) {
            $this->validateImage($values['image_url']);
        }
        foreach (['price_xaf' => self::MAX_PRICE, 'stock_quantity' => self::MAX_STOCK] as $key => $max) {
            if (!$partial || array_key_exists($key, $input)) {
                $values[$key] = Validation::integer($input, $key, 0, $max);
            }
        }
        if (!$partial || array_key_exists('active', $input)) {
            $active = $input['active'] ?? true;
            if (array_key_exists('active', $input) && !is_bool($input['active'])) {
                throw new ApiException(422, 'VALIDATION_ERROR', 'Le champ active doit être un booléen.');
            }
            $values['active'] = $active ? 1 : 0;
        }
        return $values;
    }

    private function validateImage(string $url): void
    {
        if ($url === '') {
            return;
        }
        // Local, static image path only. Percent escapes, traversal, query strings,
        // protocols, backslashes and hidden path components are deliberately absent.
        if (!preg_match('~\A/assets/images/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:svg|png|jpe?g|webp|gif)\z~iD', $url)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'L’image doit être un fichier statique interne sous /assets/images/.');
        }
    }

    private function queryInteger(array $query, string $key, int $default, int $max): int
    {
        if (!array_key_exists($key, $query)) {
            return $default;
        }
        $raw = $query[$key];
        if (!is_string($raw) || !preg_match('/\A[0-9]+\z/D', $raw)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Le paramètre ' . $key . ' doit être un entier positif.');
        }
        $normal = ltrim($raw, '0');
        $maximum = (string) $max;
        if ($normal === '' || strlen($normal) > strlen($maximum) || (strlen($normal) === strlen($maximum) && strcmp($normal, $maximum) > 0)) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Le paramètre ' . $key . ' est hors limites.');
        }
        return (int) $normal;
    }
}
