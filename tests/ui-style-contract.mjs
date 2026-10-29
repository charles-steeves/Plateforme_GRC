/**
 * Guard the shared typography, responsive navigation and UTF-8 across
 * all customer and administration pages. No dependencies or network calls.
 * Run: node tests/ui-style-contract.mjs
 * This is a static regression, NOT a substitute for visual browser QA.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const siteCss = readFileSync(join(root, 'public/assets/css/site.css'), 'utf8');
const pages = readdirSync(join(root, 'public')).filter(name => name.endsWith('.html'));
assert.equal(pages.length, 12, 'Expected twelve customer/administration pages');

const baseFont = siteCss.match(/:root\s*\{[^}]*font-family:\s*([^;]+);/s)?.[1];
assert.ok(baseFont, 'A global font stack must be declared');
assert.match(baseFont, /Segoe UI/, 'Local Windows font should be preferred');
assert.match(baseFont, /Arial/, 'Cross-platform local fallback should be provided');
assert.doesNotMatch(siteCss, /font-family:\s*(?:Georgia|Times New Roman|Inter)[\s,;]/i, 'No unbundled or stray display-font family');
assert.match(siteCss, /button, input, select, textarea\s*\{\s*font:\s*inherit;/, 'Form controls should inherit the global font');
assert.match(siteCss, /@media\s*\(max-width:\s*800px\)/, 'Tablet navigation breakpoint required');
assert.match(siteCss, /@media\s*\(max-width:\s*540px\)/, 'Small phone breakpoint required');
assert.match(siteCss, /@media\s*\(min-width:\s*801px\)\s*and\s*\(max-width:\s*1100px\)/, 'Medium-screen navigation must wrap');
assert.match(siteCss, /\.site-nav\s*\{[^}]*order:\s*3/, 'Mobile navigation should occupy its own row');
assert.match(siteCss, /:focus-visible/, 'Keyboard focus indicators should remain available');

for (const filename of pages) {
  const source = readFileSync(join(root, 'public', filename), 'utf8');
  assert.match(source, /<meta charset="utf-8">/i, filename + ': UTF-8 required');
  assert.match(source, /<html lang="fr">/i, filename + ': French language required');
  assert.match(source, /href="\/assets\/css\/site\.css"/, filename + ': should use shared stylesheet');
  assert.match(source, /class="skip-link"/, filename + ': skip to content should remain');
  assert.match(source, /id="main-content"/, filename + ': main content landmark should remain');
  assert.doesNotMatch(source, /Démonstration — données fictives|Projet universitaire|demo-banner/i, filename + ': no repeated technical notices in the customer interface');
  assert.doesNotMatch(source, /équateur|entreprise fictive|boutique fictive/i, filename + ': business identity still undecided');
}
console.log('OK — consistent local typography, responsive rules and French UTF-8 markup on all twelve pages');
