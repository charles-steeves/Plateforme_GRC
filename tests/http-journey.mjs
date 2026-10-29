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

  // A second admin is added to the DISPOSABLE database only; existing accounts
  // and products remain intact. No secrets are written to GitHub logs.
  const addAdmin = spawnSync('php', ['database/add-admin.php',
    '--name=Collègue GRC', '--email=admin2@example.test'], {
    cwd: root, env: { ...process.env, GRC_DB_PATH: dbPath },
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(addAdmin.status, 0, 'Local additional admin creation failed: ' + addAdmin.stderr);
  const extraAccounts = JSON.parse(readFileSync(join(folder, 'demo-accounts.json'), 'utf8')).accounts;
  const secondAdmin = extraAccounts.find(a => a.email === 'admin2@example.test');
  ok(secondAdmin?.role === 'admin' && typeof secondAdmin.password === 'string',
    'second admin appended to private local credentials');
  const addDuplicate = spawnSync('php', ['database/add-admin.php',
    '--name=Doublon', '--email=admin2@example.test'], {
    cwd: root, env: { ...process.env, GRC_DB_PATH: dbPath },
    encoding: 'utf8', timeout: 30000,
  });
  ok(addDuplicate.status !== 0, 'duplicate admin account is refused');

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

  // Every public HTML entry point and its shared CSS should remain routable.
  // Authentication and data permissions are still enforced by the API.
  for (const page of [
    '/', '/product.html', '/cart.html', '/login.html', '/register.html',
    '/account.html', '/tickets.html', '/admin.html',
    '/admin-products.html', '/admin-orders.html', '/admin-customers.html',
    '/admin-tickets.html',
  ]) {
    const response = await fetch(base + page, { signal: AbortSignal.timeout(5000) });
    ok(response.status === 200 && response.headers.get('content-type')?.includes('text/html'),
      'HTML route should be available: ' + page);
    const html = await response.text();
    ok(html.includes("Junelia's Shop") && html.includes('charset="utf-8"'),
      'Neutral identity and UTF-8 should be present: ' + page);
  }
  const cssResponse = await fetch(base + '/assets/css/site.css', { signal: AbortSignal.timeout(5000) });
  ok(cssResponse.status === 200 && cssResponse.headers.get('content-type')?.includes('text/css'),
    'Stylesheet should be served with correct MIME type');
  ok((await cssResponse.text()).includes('font-family: "Segoe UI"'),
    'Shared local typography should reach the browser');

  const visitor = new Session(base);
  const client = new Session(base);
  const admin = new Session(base);
  const outsider = new Session(base);
  const catalogue = await visitor.get('/products');
  ok(catalogue.status === 200 && catalogue.data.items.length === 12, 'public catalogue from SQLite');

  const categoriesBefore = await visitor.get('/products/categories');
  ok(categoriesBefore.status === 200 && Array.isArray(categoriesBefore.data.items)
    && categoriesBefore.data.items.length >= 4
    && categoriesBefore.data.items.every(group => typeof group.name === 'string'
      && Number.isSafeInteger(group.count) && group.count > 0),
    'public categories are generated from products without schema changes');
  ok((await client.get('/admin/categories')).status === 401,
    'unauthenticated visitor cannot read private admin category management');
 
  const clientUser = await client.login(clientAccounts[0]);
  ok(clientUser.role === 'client', 'client role from session');
  // Passive refresh must not reset the user idle timer. Test on disposable
  // PHP session files, never on the owner's real storage directory.
  const cookieId = client.cookie.slice('GRCSESSID='.length);
  ok(/^[A-Za-z0-9,-]+$/.test(cookieId), 'session cookie ID is opaque and safe to inspect');
  const sessionFile = join(folder, 'sessions', 'sess_' + cookieId);
  const beforePassive = readFileSync(sessionFile, 'utf8');
  await sleep(1200);
  const passiveRead = await fetch(base + '/api/v1/tickets/me', {
    headers: { cookie: client.cookie, 'X-GRC-Passive': '1' },
    signal: AbortSignal.timeout(5000),
  });
  ok(passiveRead.status === 200, 'passive ticket list still authenticates client');
  ok(readFileSync(sessionFile, 'utf8') === beforePassive,
    'passive ticket polling never refreshes last_seen');
  ok((await client.get('/tickets/me')).status === 200, 'regular ticket list read is authorized');
  ok(readFileSync(sessionFile, 'utf8') !== beforePassive,
    'interactive ticket navigation refreshes last_seen');
  const adminUser = await admin.login(account('admin'));
  ok(adminUser.role === 'admin', 'admin role from session');
  await outsider.login(clientAccounts[1]);
  const colleague = new Session(base);
  const colleagueUser = await colleague.login(secondAdmin);
  ok(colleagueUser.role === 'admin', 'independent colleague admin can log in');
  ok((await colleague.get('/admin/dashboard')).status === 200, 'colleague admin accesses same dashboard');
  const adminGroups = await admin.get('/admin/categories');
  ok(adminGroups.status === 200 && adminGroups.data.items.length === categoriesBefore.data.items.length,
    'administrators can see complete list of defined categories');
  ok((await client.get('/admin/categories')).status === 403,
    'clients cannot query admin category groups');

  // Real HTTP multipart image: same CSRF and RBAC as other admin mutations.
  function imageForm(bytes, type) {
    const form = new FormData();
    form.set('image', new Blob([bytes], { type }), 'image.png');
    return form;
  }
  async function uploadAs(session, form, csrf = true) {
    return fetch(base + '/api/v1/admin/product-image', {
      method: 'POST',
      headers: { ...(session.cookie ? { cookie: session.cookie } : {}),
        ...(csrf && session.csrf ? { 'x-csrf-token': session.csrf } : {}) },
      body: form, signal: AbortSignal.timeout(5000),
    });
  }
  const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS8cAAAAASUVORK5CYII=', 'base64');
  ok((await uploadAs(client, imageForm(validPng, 'image/png'))).status === 403,
    'client cannot upload product images');
  ok((await uploadAs(admin, imageForm(validPng, 'image/png'), false)).status === 403,
    'upload without CSRF is forbidden');
  ok((await uploadAs(admin, imageForm(Buffer.from('fake image'), 'image/png'))).status === 422,
    'fake image content is rejected');
  const imageReply = await uploadAs(admin, imageForm(validPng, 'image/png'));
  const imagePayload = await imageReply.json();
  ok(imageReply.status === 201 && /^\/assets\/images\/uploads\/[0-9a-f]{32}\.png$/.test(imagePayload.data?.image_url || ''),
    'real PNG upload returns random local-only path');
  const publicImage = await fetch(base + imagePayload.data.image_url);
  ok(publicImage.status === 200 && publicImage.headers.get('content-type')?.includes('image/png'),
    'uploaded product image is available as local static image');
  const imageProduct = await colleague.patch('/admin/products/1', { image_url: imagePayload.data.image_url });
  ok(imageProduct.status === 200 && imageProduct.data.product.image_url === imagePayload.data.image_url,
    'second admin can attach uploaded photo to existing product');

  const forbidden = await client.get('/admin/dashboard');
  ok(forbidden.status === 403, 'client forbidden from admin API');
  ok((await visitor.get('/admin/dashboard')).status === 401,
    'visitor cannot see dashboard metrics');
  for (const endpoint of ['/admin/products', '/admin/orders', '/admin/customers', '/admin/tickets', '/admin/categories']) {
    ok((await client.get(endpoint)).status === 403, 'client cannot read ' + endpoint);
  }
  ok((await client.post('/admin/products', { name: 'Interdit' })).status === 403,
    'client cannot create admin-only products');
  const noCsrf = await client.post('/orders', { items: [{ product_id: 1, quantity: 1 }] }, false);
  ok(noCsrf.status === 403, 'missing CSRF refused before writing');

  const stockBefore = (await visitor.get('/products/1')).data.product.stock_quantity;
  const pointsBefore = (await client.get('/loyalty/me')).data.balance;
  const firstDashboard = (await admin.get('/admin/dashboard')).data;
  const dashboardBefore = firstDashboard.ca_simule_xaf;
  ok(Array.isArray(firstDashboard.orders_last_7_days)
    && firstDashboard.orders_last_7_days.length === 7
    && firstDashboard.orders_last_7_days.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.day)
      && Number.isSafeInteger(row.count) && row.count >= 0),
    'dashboard trend is a seven-day real SQLite series');
  const trendBefore = firstDashboard.orders_last_7_days.reduce((sum, item) => sum + item.count, 0);
  const orderBody = { request_id: 'journey-order-key-001', items: [{ product_id: 1, quantity: 1 }] };
  const orderResponse = await client.post('/orders', orderBody);
  ok(orderResponse.status === 201, 'created order through real HTTP API');
  const order = orderResponse.data.order;
  ok(order.status === 'pending' && order.total_xaf === 95000, 'server computes integer order amount');
  const repeatOrder = await client.post('/orders', orderBody);
  ok(repeatOrder.status === 201 && repeatOrder.data.order.id === order.id,
    'repeated order HTTP POST replays same order instead of creating duplicate');
  ok((await client.post('/orders', { ...orderBody,
    items: [{ product_id: 1, quantity: 2 }] })).status === 409,
    'same order key with different items is refused');
  const trendAfter = (await admin.get('/admin/dashboard')).data.orders_last_7_days;
  ok(trendAfter.reduce((sum, row) => sum + row.count, 0) === trendBefore + 1,
    'admin order history graph updates when a customer orders');
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

  const ticketBody = {
    request_id: 'journey-ticket-key-001',
    order_id: order.id, subject: 'Assistance démonstration', description: 'Demande fictive', category: 'sav',
  };
  const ticketResult = await client.post('/tickets', ticketBody);
  ok(ticketResult.status === 201, 'ticket opened with own order');
  const ticketId = ticketResult.data.ticket.id;
  const repeatTicket = await client.post('/tickets', ticketBody);
  ok(repeatTicket.status === 201 && repeatTicket.data.ticket.id === ticketId,
    'repeated ticket creation returns same ticket on HTTP replay');
  ok((await client.post('/tickets', { ...ticketBody, description: 'Different complaint' })).status === 409,
    'ticket ID with a different body is refused');
  ok((await outsider.get('/tickets/' + ticketId)).status === 404, 'foreign ticket hidden');
  ok((await admin.post('/tickets/' + ticketId + '/messages', { body: 'Réponse fictive du support' })).status === 201, 'admin replied');
  const detail = await client.get('/tickets/' + ticketId);
  ok(detail.data.messages.some(m => m.body.includes('Réponse fictive')), 'client can read response');
  ok((await admin.patch('/admin/tickets/' + ticketId, { status: 'closed' })).status === 200, 'admin closed ticket');
  ok((await client.post('/tickets/' + ticketId + '/messages', { body: 'Nouveau message' })).status === 409, 'closed ticket refuses message');
  ok((await outsider.get('/admin/customers')).status === 403, 'other client refused admin listing');

  // Group labels originate from the product administrator, never visitor input.
  // This uses only the disposable test DB, not the Windows demo user's DB.
  const moved = await admin.patch('/admin/products/1', { category: 'Smartphones et tablettes' });
  ok(moved.status === 200 && moved.data.product.category === 'Smartphones et tablettes',
    'administrator defines a new group by assigning it to a product');
  const newGroups = await visitor.get('/products/categories');
  ok(newGroups.data.items.some(group => group.name === 'Smartphones et tablettes'),
    'new admin-defined group appears in public selector');
  const filteredGroup = await visitor.get('/products?category=' + encodeURIComponent('Smartphones et tablettes'));
  ok(filteredGroup.status === 200 && filteredGroup.data.total === 1
    && filteredGroup.data.items[0].id === 1,
    'visitor filters catalogue by selected group');
  ok((await visitor.get('/admin/categories')).status === 401,
    'admin group list remains private to unauthenticated visitors');

  console.log('OK — ' + passed + ' checks: real PHP HTTP + disposable SQLite, distinct admin/client sessions');
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), sleep(2500)]);
  }
  try { rmSync(folder, { recursive: true, force: true }); }
  catch (error) { console.error('Temporary test directory needs cleanup:', folder, error.message); }
}
