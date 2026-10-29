/**
 * Regression: frontend and backend must allow exactly the same local image paths.
 * Run from repository root: node tests/image-path-contract.mjs
 * Requires Node >= 18 and PHP >= 8.2; does not modify the database.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const js = readFileSync(new URL('../public/assets/js/ui.js', import.meta.url), 'utf8');
const { isLocalImagePath } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(js));

const samples = [
  ['', true],
  ['/assets/images/product-placeholder.svg', true],
  ['/assets/images/produit.v2.PNG', true],
  ['/assets/images/avatars/my_photo-2.webp', true],
  ['/assets/images/EARPHONES.JPEG', true],
  ['/assets/images/foo.png?name=evil', false],
  ['/assets/images/foo.svg#fragment', false],
  ['/assets/images/../secrets.png', false],
  ['/assets/images/.hidden.png', false],
  ['/assets/images/foo%2e%2e.png', false],
  ['/assets/images/fichier avec espaces.png', false],
  ['/assets/images/étui.png', false],
  ['/assets/images/foo.png/extra', false],
  ['/assets/images/foo\\bar.png', false],
  ['https://example.com/a.png', false],
  ['//example.com/a.png', false],
  ['data:image/png;base64,AAAA', false],
  ['/assets/images/a.php', false],
];

const phpCode = String.raw`
require 'app/bootstrap.php';
$service = (new ReflectionClass(App\\Services\\ProductService::class))->newInstanceWithoutConstructor();
$method = (new ReflectionClass(App\\Services\\ProductService::class))->getMethod('validateImage');
$cases = json_decode($argv[1], true, 512, JSON_THROW_ON_ERROR);
$actual = [];
foreach ($cases as $path) {
  try { $method->invoke($service, $path); $actual[] = true; }
  catch (App\\Core\\ApiException $e) { $actual[] = false; }
}
echo json_encode($actual, JSON_THROW_ON_ERROR);
`;

const php = spawnSync('php', ['-r', phpCode, JSON.stringify(samples.map(([path]) => path))], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});
assert.equal(php.status, 0, `PHP check failed: ${php.stderr || php.error}`);
const backendResults = JSON.parse(php.stdout);
let passed = 0;
for (let i = 0; i < samples.length; i++) {
  const [path, expected] = samples[i];
  const front = isLocalImagePath(path);
  const back = backendResults[i];
  assert.equal(front, expected, `Frontend mismatch: ${path}`);
  assert.equal(back, expected, `Backend mismatch: ${path}`);
  assert.equal(front, back, `Cross-language mismatch: ${path}`);
  passed++;
}
console.log(`OK — ${passed} safe/unsafe local image path cases agree in JS and PHP`);
