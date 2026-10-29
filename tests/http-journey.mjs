/**
 * End-to-end HTTP smoke test using the real PHP router and a disposable SQLite DB.
 * Node 18+, PHP 8.2+ with pdo_sqlite/sqlite3. No external dependencies.
 * It NEVER uses storage/grc.sqlite or any existing passwords.
 * Run from the repository root: node tests/http-journey.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'grc-http-'));
const dbPath = join(folder, 'grc.sqlite');
let server = null;
let passed = 0;
const ok = (value, label) => { assert.ok(value, label); passed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function reservePort() {
  return new Promise((resolvePort, reject) => {
    const net = createServer();
    net.once('error', reject);
    net.listen(0, '127.0.0.1', () => {
      const p = net.address().port;
      net.close(() => resolvePort(p));
    });
  });
}

class Session {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = null; }
  async call(method, path, body = undefined, includeCsrf = true) {
    const headers = { accept: 'application/json' };
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (includeCsrf && this.csrf && method !== 'GET') headers['x-csrf-token'] = this.csrf;
    const response = await fetch(this.base + '/api/v1' + path, {
      method, headers, redirect: 'manual', ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const setCookie = response.headers.get('set-cookie') || '';
    const matches = [...setCookie.matchAll(/GRCSESSID=[^;,]*/g)];
    if (matches.length) this.cookie = matches[matches.length - 1][0];
    const payload = await response.json();
    return { status: response.status, payload, data: payload.data };
  }
  async get(path) { return this.call('GET', path); }
  async post(path, body, includeCsrf = true) { return this.call('POST', path, body, includeCsrf); }
  async patch(path, body) { return this.call('PATCH', path, body); }
  async token() {
    const reply = await this.get('/auth/csrf');
    assert.equal(reply.status, 200);
    this.csrf = reply.data.csrf_token;
  }
  async login(account) {
    await this.token();
    const reply = await this.post('/auth/login', { email: account.email, password: account.password });
    assert.equal(reply.status, 200, 'Login should succeed');
    await this.token(); // The login rotates session ID and CSRF token.
    return reply.data.user;
  }
}
try {
  const phpInit = spawnSync('php', ['database/init.php', '--db=' + dbPath], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(phpInit.status, 0, 'Disposable DB init failed: ' + phpInit.stderr);
  const accounts = JSON.parse(readFileSync(join(folder, 'demo-accounts.json'), 'utf8')).accounts;
  const account = role => accounts.find(a => a.role === role);
  const clientAccounts = accounts.filter(a => a.role === 'client');

  const port = await reservePort();
  const base = 'http://127.0.0.1:' + port;
  server = spawn('php', ['-S', '127.0.0.1:' + port, '-t', 'public', 'public/router.php'], {
    cwd: root, env: { ...process.env, GRC_DB_PATH: dbPath },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let phpErrors = '';
  server.stderr.on('data', bytes => { phpErrors += String(bytes).slice(0, 500); });

  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(base + '/api/v1/products', { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch {}
    await sleep(100);
  }
  assert.ok(ready, 'PHP server did not start: ' + phpErrors.slice(0, 1000));

  const visitor = new Session(base);
  const client = new Session(base);
  const admin = new Session(base);
  const outsider = new Session(base);
  const catalogue = await visitor.get('/products');
  ok(catalogue.status === 200 && catalogue.data.items.length === 12, 'public catalogue from SQLite');

  const clientUser = await client.login(clientAccounts[0]);
  ok(clientUser.role === 'client', 'client role from session');
  const adminUser = await admin.login(account('admin'));
  ok(adminUser.role === 'admin', 'admin role from session');
  await outsider.login(clientAccounts[1]);

  const forbidden = await client.get('/admin/dashboard');
  ok(forbidden.status === 403, 'client forbidden from admin API');
  const noCsrf = await client.post('/orders', { items: [{ product_id: 1, quantity: 1 }] }, false);
  ok(noCsrf.status === 403, 'missing CSRF refused before writing');

  const stockBefore = (await visitor.get('/products/1')).data.product.stock_quantity;
  const pointsBefore = (await client.get('/loyalty/me')).data.balance;
  const dashboardBefore = (await admin.get('/admin/dashboard')).data.ca_simule_xaf;
  const orderResponse = await client.post('/orders', { items: [{ product_id: 1, quantity: 1 }] });
  ok(orderResponse.status === 201, 'created order through real HTTP API');
  const order = orderResponse.data.order;
  ok(order.status === 'pending' && order.total_xaf === 95000, 'server computes integer order amount');
  ok((await visitor.get('/products/1')).data.product.stock_quantity === stockBefore - 1, 'stock decreased');

  const seenOrders = await admin.get('/admin/orders');
  ok(seenOrders.data.items.some(v => v.id === order.id), 'order appears in admin');
  ok((await admin.patch('/admin/orders/' + order.id, { status: 'confirmed' })).status === 200, 'admin confirms');
  ok((await admin.patch('/admin/orders/' + order.id, { status: 'delivered' })).status === 200, 'admin delivers');
  ok((await admin.patch('/admin/orders/' + order.id, { status: 'delivered' })).status === 200, 'repeated delivery is harmless');
  ok((await client.get('/loyalty/me')).data.balance === pointsBefore + 95, 'exactly one delivery loyalty credit');
  ok((await admin.get('/admin/dashboard')).data.ca_simule_xaf === dashboardBefore + 95000, 'real GRC revenue updated');

  const comment = await client.post('/feedback', { order_id: order.id, rating: 5, comment: 'Avis fictif' });
  ok(comment.status === 201, 'feedback after delivered');
  ok((await client.post('/feedback', { order_id: order.id, rating: 5 })).status === 409, 'duplicate review refused');

  const ticketResult = await client.post('/tickets', {
    order_id: order.id, subject: 'Assistance démonstration', description: 'Demande fictive', category: 'sav',
  });
  ok(ticketResult.status === 201, 'ticket opened with own order');
  const ticketId = ticketResult.data.ticket.id;
  ok((await outsider.get('/tickets/' + ticketId)).status === 404, 'foreign ticket hidden');
  ok((await admin.post('/tickets/' + ticketId + '/messages', { body: 'Réponse fictive du support' })).status === 201, 'admin replied');
  const detail = await client.get('/tickets/' + ticketId);
  ok(detail.data.messages.some(m => m.body.includes('Réponse fictive')), 'client can read response');
  ok((await admin.patch('/admin/tickets/' + ticketId, { status: 'closed' })).status === 200, 'admin closed ticket');
  ok((await client.post('/tickets/' + ticketId + '/messages', { body: 'Nouveau message' })).status === 409, 'closed ticket refuses message');
  ok((await outsider.get('/admin/customers')).status === 403, 'other client refused admin listing');

  console.log('OK — ' + passed + ' checks: real PHP HTTP + disposable SQLite, distinct admin/client sessions');
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), sleep(2500)]);
  }
  try { rmSync(folder, { recursive: true, force: true }); }
  catch (error) { console.error('Temporary test directory needs cleanup:', folder, error.message); }
}
