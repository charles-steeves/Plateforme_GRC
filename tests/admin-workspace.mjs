import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const app = read('public/assets/js/app.js');
const admin = read('public/assets/js/admin.js');
const css = read('public/assets/css/site.css');
const contract = read('docs/COURSE_IMPLEMENTATION_AUDIT.md');
assert.match(app, /function renderAdminNav\(user\)/);
assert.match(app, /className: 'admin-sidebar'/);
assert.match(app, /'aria-controls': 'admin-sidebar-menu'/);
assert.match(app, /sessionStorage\.setItem\('grc-admin-sidebar-collapsed'/);
assert.match(app, /'Se déconnecter'/);
assert.match(app, /'Escape'/);
assert.match(css, /--green: #087eae/);
assert.match(css, /\.admin-sidebar-account-details/);
assert.match(css, /\.admin-sidebar-overlay/);
assert.match(css, /@media \(max-width: 900px\)/);
assert.match(admin, /function metric\(label, value\)/);
assert.doesNotMatch(admin, /Comptes clients, administrateurs exclus\.|Commandes non annulées\.|Les indicateurs reflètent les commandes et les échanges enregistrés\./);
// The former explanatory shortcut cards duplicated real admin links.
assert.doesNotMatch(admin, /La GRC en pratique|crm-process-grid/);
for (const destination of ['admin-customers', 'admin-orders', 'admin-products', 'admin-tickets', 'admin-reviews']) {
  assert.ok(app.includes(destination), 'Missing admin destination: ' + destination);
}
assert.match(app, /view=reviews/);
assert.match(admin, /mountAdminProductReviews/);
assert.match(admin, /const timer = setInterval/);
assert.match(admin, /}, 5000\)/);
assert.match(admin, /document\.visibilityState === 'visible'/);
assert.match(admin, /'Gérer les commandes'|'Suivre les commandes'/);
assert.match(contract, /93 diapositives/);
assert.match(contract, /Pas de scoring RFM formel|Pas de scoring RFM/);
console.log('OK — admin menu and CRM dashboard user experience preserved');
