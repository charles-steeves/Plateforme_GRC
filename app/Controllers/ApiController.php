<?php
declare(strict_types=1);
namespace App\Controllers;

use App\Core\{ApiException, Database, Request, Response, Security};
use App\Services\{AuthService, ProductService, OrderService, TicketService, GrcService, ImageUploadService, CrmInsightService, ProductReviewService};
use PDO;

final class ApiController
{
    private ?PDO $connection = null;

    private function db(): PDO
    {
        return $this->connection ??= Database::connect();
    }

    public function dispatch(string $path, string $method): never
    {
        // Method, exact path pattern, required role (null = public), response status, handler.
        $routes = [
            ['GET', '/auth/csrf', null, 200, fn($u, $b, $id) => ['csrf_token' => Security::token()]],
            ['POST', '/auth/register', null, 201, fn($u, $b, $id) => ['user' => (new AuthService($this->db()))->register($b)]],
            ['POST', '/auth/login', null, 200, fn($u, $b, $id) => ['user' => (new AuthService($this->db()))->login($b)]],
            ['POST', '/auth/logout', null, 200, function ($u, $b, $id) {
                \App\Core\Validation::fields($b, []);
                Security::logout();
                return ['logged_out' => true];
            }],
            ['GET', '/auth/me', 'authenticated', 200, fn($u, $b, $id) => ['user' => $u]],
            ['GET', '/products', null, 200, fn($u, $b, $id) => (new ProductService($this->db()))->listing($_GET)],
            ['GET', '/products/categories', null, 200, fn($u, $b, $id) => (new ProductService($this->db()))->categories()],
            ['GET', '/products/([0-9]+)', null, 200, fn($u, $b, $id) => ['product' => (new ProductService($this->db()))->detail($id)]],
            ['GET', '/products/([0-9]+)/reviews', null, 200, fn($u, $b, $id) => (new ProductReviewService($this->db()))->publicReviews($id)],
            ['POST', '/products/([0-9]+)/reviews', 'client', 201, fn($u, $b, $id) => ['review' => (new ProductReviewService($this->db()))->create($id, $u['id'], $b)]],
            ['POST', '/orders', 'client', 201, fn($u, $b, $id) => ['order' => (new OrderService($this->db()))->create($u, $b)]],
            ['GET', '/orders/me', 'client', 200, fn($u, $b, $id) => ['items' => (new OrderService($this->db()))->mine($u['id'])]],
            ['GET', '/loyalty/me', 'client', 200, fn($u, $b, $id) => (new GrcService($this->db()))->loyalty($u['id'])],
            ['POST', '/tickets', 'client', 201, fn($u, $b, $id) => ['ticket' => (new TicketService($this->db()))->create($u, $b)]],
            ['GET', '/tickets/me', 'client', 200, fn($u, $b, $id) => ['items' => (new TicketService($this->db()))->mine($u['id'])]],
            ['GET', '/tickets/([0-9]+)', 'authenticated', 200, fn($u, $b, $id) => (new TicketService($this->db()))->detail($id, $u)],
            ['POST', '/tickets/([0-9]+)/messages', 'authenticated', 201, fn($u, $b, $id) => ['message' => (new TicketService($this->db()))->message($id, $u, $b)]],
            ['POST', '/feedback', 'client', 201, fn($u, $b, $id) => ['feedback' => (new GrcService($this->db()))->feedback($u['id'], $b)]],
            ['GET', '/admin/dashboard', 'admin', 200, fn($u, $b, $id) => (new GrcService($this->db()))->dashboard()],
            ['GET', '/admin/insights', 'admin', 200, fn($u, $b, $id) => (new CrmInsightService($this->db()))->report()],
            ['GET', '/admin/customers', 'admin', 200, fn($u, $b, $id) => (new GrcService($this->db()))->customers($_GET)],
            ['GET', '/admin/customers/([0-9]+)', 'admin', 200, fn($u, $b, $id) => (new GrcService($this->db()))->customer($id)],
            ['GET', '/admin/orders', 'admin', 200, fn($u, $b, $id) => ['items' => (new OrderService($this->db()))->adminList()]],
            ['PATCH', '/admin/orders/([0-9]+)', 'admin', 200, fn($u, $b, $id) => ['order' => (new OrderService($this->db()))->changeStatus($id, $b)]],
            ['GET', '/admin/tickets', 'admin', 200, fn($u, $b, $id) => ['items' => (new TicketService($this->db()))->adminList()]],
            ['PATCH', '/admin/tickets/([0-9]+)', 'admin', 200, fn($u, $b, $id) => ['ticket' => (new TicketService($this->db()))->changeStatus($id, $b)]],
            ['GET', '/admin/categories', 'admin', 200, fn($u, $b, $id) => (new ProductService($this->db()))->adminCategories()],
            ['GET', '/admin/product-reviews', 'admin', 200, fn($u, $b, $id) => (new ProductReviewService($this->db()))->adminReviews()],
            ['PATCH', '/admin/product-reviews/([0-9]+)', 'admin', 200, fn($u, $b, $id) => ['review' => (new ProductReviewService($this->db()))->moderate($id, $b)]],
            ['GET', '/admin/products', 'admin', 200, fn($u, $b, $id) => ['items' => (new ProductService($this->db()))->adminList()]],
            ['POST', '/admin/product-image', 'admin', 201, fn($u, $b, $id) => (new ImageUploadService())->upload()],
            ['POST', '/admin/products', 'admin', 201, fn($u, $b, $id) => ['product' => (new ProductService($this->db()))->create($b)]],
            ['PATCH', '/admin/products/([0-9]+)', 'admin', 200, fn($u, $b, $id) => ['product' => (new ProductService($this->db()))->update($id, $b)]],
        ];
        $relative = substr($path, strlen('/api/v1'));
        $allowed = [];
        foreach ($routes as [$verb, $pattern, $role, $status, $handler]) {
            if (preg_match('~^' . $pattern . '$~D', $relative, $matches) !== 1) {
                continue;
            }
            $allowed[] = $verb;
            if ($method !== $verb) {
                continue;
            }
            $id = 0;
            if (isset($matches[1])) {
                $id = filter_var($matches[1], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if ($id === false) {
                    throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
                }
            }
            Security::session();
            $user = $role !== null
                ? (new AuthService($this->db()))->user($role === 'authenticated' ? null : $role)
                : null;
            $body = [];
            if (in_array($method, ['POST', 'PATCH'], true)) {
                Security::mutation();
                // Image upload is the sole multipart exception to the JSON API.
                // Same admin role, Origin and CSRF protections still apply.
                if (!($method === 'POST' && $relative === '/admin/product-image')) {
                    $body = Request::json();
                }
            }
            Response::ok($handler($user, $body, $id), $status);
        }
        if ($allowed !== []) {
            header('Allow: ' . implode(', ', array_unique($allowed)));
            throw new ApiException(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
        }
        throw new ApiException(404, 'NOT_FOUND', 'Ressource introuvable.');
    }
}
