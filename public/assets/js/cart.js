const KEY = 'grc.cart.v1';
const FALLBACK = 'grc.cart.session.v1';
let mode = 'local';
let storageIssue = '';
let memory = [];
const validId = id => Number.isSafeInteger(id) && id > 0;
function normalize(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || !validId(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || seen.has(item.product_id)) return false;
    seen.add(item.product_id);
    return true;
  }).slice(0, 30).map(({ product_id, quantity }) => ({ product_id, quantity }));
}
function useSession() {
  mode = 'session';
  storageIssue = 'Le panier est conservé uniquement dans cet onglet jusqu’à sa fermeture.';
}
function useMemory() {
  mode = 'memory';
  storageIssue = 'Le stockage est indisponible. Le panier ne sera pas conservé après rechargement ou changement de page.';
}
export function getCart() {
  if (mode === 'memory') return memory.map(item => ({ ...item }));
  try {
    const temporary = sessionStorage.getItem(FALLBACK);
    if (temporary !== null) {
      useSession();
      memory = normalize(JSON.parse(temporary));
      return memory.map(item => ({ ...item }));
    }
  } catch { /* localStorage can remain usable when sessionStorage is blocked */ }
  if (mode === 'session') return memory.map(item => ({ ...item }));
  try {
    const raw = localStorage.getItem(KEY);
    memory = normalize(raw === null ? [] : JSON.parse(raw));
  } catch {
    useSession();
    try { sessionStorage.setItem(FALLBACK, JSON.stringify(memory)); }
    catch { useMemory(); }
  }
  return memory.map(item => ({ ...item }));
}
function save(items) {
  memory = normalize(items);
  if (mode === 'local') {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); }
    catch { useSession(); }
  }
  if (mode === 'session') {
    try { sessionStorage.setItem(FALLBACK, JSON.stringify(memory)); }
    catch { useMemory(); }
  }
  window.dispatchEvent(new CustomEvent('grc:cart', { detail: { count: memory.reduce((n, item) => n + item.quantity, 0) } }));
}
export function setQuantity(id, quantity) {
  if (!validId(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Choisissez une quantité entière entre 1 et 20.');
  const items = getCart();
  const item = items.find(entry => entry.product_id === id);
  if (item) item.quantity = quantity;
  else {
    if (items.length >= 30) throw new Error('Le panier est limité à 30 produits différents.');
    items.push({ product_id: id, quantity });
  }
  save(items);
}
export function addToCart(id, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Choisissez une quantité entière entre 1 et 20.');
  const previous = getCart().find(item => item.product_id === id)?.quantity || 0;
  setQuantity(id, previous + quantity);
}
export const removeFromCart = id => save(getCart().filter(item => item.product_id !== id));
export const clearCart = () => save([]);
export const cartCount = () => getCart().reduce((n, item) => n + item.quantity, 0);
export const cartIssue = () => storageIssue;
window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) window.dispatchEvent(new CustomEvent('grc:cart', { detail: { count: cartCount() } })); });
