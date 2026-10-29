/**
 * Guard the user's decision to postpone branding and the nature of the business.
 * Run: node tests/branding-neutral.mjs
 * This does not alter the application, the database or the repository.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const files = readdirSync(publicDir).filter(p => p.endsWith('.html'));
assert.equal(files.length, 12, 'All 12 storefront/admin screens should be present');

for (const name of files) {
  const html = readFileSync(join(publicDir, name), 'utf8');
  assert.match(html, /<meta charset="utf-8">/i, name + ' should remain UTF-8');
  assert.match(html, /<title>[^<]*Plateforme GRC/i, name + ' needs a neutral title');
  assert.match(html, /<div class="demo-banner">Démonstration — données fictives/, name + ' must preserve simulation disclaimer');
  assert.doesNotMatch(html, /équateur|entreprise fictive|boutique fictive/i, name + ' contains undecided branding');
}
const app = readFileSync(join(publicDir, 'assets', 'js', 'app.js'), 'utf8');
assert.match(app, /Plateforme GRC — accueil/, 'Accessible brand needs neutral label');
assert.doesNotMatch(app, /équateur|entreprise fictive|boutique fictive/i);
for (const doc of ['README.md', 'docs/PROJECT_BRIEF.md', 'docs/DEMO.md']) {
  const markdown = readFileSync(join(root, doc), 'utf8');
  assert.doesNotMatch(markdown, /équateur|entreprise fictive|boutique fictive/i, doc + ' retains a deprecated assumption');
}
console.log('OK — neutral company identity on 12 pages, app header and major docs; demo safety banners retained');
