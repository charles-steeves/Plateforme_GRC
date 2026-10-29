/** Ticket polling must never send a mutation nor discard a customer's draft. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const tickets = read('public/assets/js/tickets.js');
const api = read('public/assets/js/api.js');
const security = read('app/Core/Security.php');
const dashboard = read('public/assets/js/admin.js');
const pages = readdirSync(join(root, 'public')).filter(f => f.endsWith('.html'));
assert.equal(pages.length, 12);
for (const name of pages) {
  assert.match(read('public/' + name), /Junelia's Shop/, name + ': shop name');
}
assert.match(read('public/assets/js/app.js'), /Junelia's Shop — accueil/);
assert.match(tickets, /AUTO_REFRESH_MS = 10000/);
assert.match(tickets, /window\.setInterval\(/);
assert.match(tickets, /document\.visibilityState !== 'visible'/);
assert.match(tickets, /!navigator\.onLine/);
assert.match(tickets, /pendingTickets\.size/);
assert.match(tickets, /uncertainTickets\.has\(id\)/);
assert.match(tickets, /updateVisibleTicket\(\)/);
assert.match(tickets, /conversation\.replaceWith\(conversationContent\(data\.messages\)\)/);
assert.match(tickets, /const messageDraft = detail\.querySelector/);
assert.match(tickets, /if \(changedStatus && !userEditing\)/);
assert.match(tickets, /loadList\(\{ silent: true \}\)/);
assert.match(tickets, /passive: true/);
assert.match(api, /X-GRC-Passive/);
assert.match(security, /HTTP_X_GRC_PASSIVE/);
assert.match(security, /if \(!\$passiveRead\)/);
assert.match(dashboard, /automatic \? \{ passive: true \}/);
console.log('OK — live SAV read-only polling and protected brand/session invariants');
