/**
 * Static regression for natural storefront copy and aligned catalogue controls.
 * Run: node tests/ux-copy.mjs
 * It does not replace real browser rendering or server tests.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const screens = readdirSync(join(root, 'public')).filter(name => name.endsWith('.html'));
assert.equal(screens.length, 12);
for (const file of screens) {
  const html = read('public/' + file);
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /Akoma Boutique/);
  assert.doesNotMatch(html, /Projet universitaire|Démonstration — données fictives|Utilisez exclusivement des identités|Prix en FCFA \(XAF\)/i, file);
}
const shop = read('public/assets/js/shop.js');
const css = read('public/assets/css/site.css');
const customer = read('public/assets/js/customer.js');
const app = read('public/assets/js/app.js');
const api = read('public/assets/js/api.js');
assert.match(shop, /className: 'catalogue-toolbar-actions'/);
assert.match(shop, /field\('Rechercher un produit', searchInput\)/);
assert.match(shop, /field\('Catégorie', categoryInput\)/);
assert.match(css, /\.catalogue-toolbar \{ display: grid;/);
assert.match(css, /\.catalogue-toolbar-actions \{ display: flex;/);
assert.match(css, /@media \(max-width: 540px\)/);
assert.match(customer, /field\(register \? 'Adresse e-mail' : 'Identifiant ou adresse e-mail', email\)/);
assert.match(customer, /12 caractères minimum\./);
assert.doesNotMatch(customer, /72 octets UTF-8 maximum|Adresse e-mail fictive|projet universitaire/i);
assert.doesNotMatch(shop, /démonstration|données fictives|Prix en FCFA · XAF/i);
assert.doesNotMatch(app, /Les données affichées ne remplacent pas une connexion au serveur/i);
assert.doesNotMatch(api, /Aucune réussite ne peut être confirmée/i);
console.log('OK — 12 pages, catalog search layout, natural labels and simplified service errors');
