export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (/^on[A-Z]/.test(name) && typeof value === 'function') node.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name === 'className' || name === 'class') node.className = value;
    else if (name === 'htmlFor') node.setAttribute('for', value);
    else if (name === 'textContent') node.textContent = value;
    else if (['value', 'checked', 'disabled', 'selected', 'required', 'hidden', 'readOnly', 'multiple'].includes(name)) node[name] = value;
    else if (['innerHTML', 'outerHTML', 'style', 'srcdoc'].includes(name) || /^on/i.test(name)) throw new Error('Attribut HTML non autorisé.');
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  const append = child => {
    if (Array.isArray(child)) child.forEach(append);
    else if (child instanceof Node) node.append(child);
    else if (child !== null && child !== undefined && child !== false) node.append(document.createTextNode(String(child)));
  };
  children.forEach(append);
  return node;
}
export function clear(node) { node.replaceChildren(); return node; }
export const money = value => Number.isSafeInteger(value) && value >= 0
  ? `${new Intl.NumberFormat('fr-GA', { maximumFractionDigits: 0 }).format(value)} FCFA`
  : 'Montant indisponible';
export function date(value) {
  if (!value) return 'Non renseigné';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date indisponible'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Libreville' }).format(parsed);
}
const labels = {
  pending: 'En attente', confirmed: 'Confirmée', delivered: 'Livrée', cancelled: 'Annulée',
  open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé',
  regular: 'Régulier', occasional: 'Occasionnel', new: 'Nouveau', inactive: 'Inactif', no_purchase: 'Sans achat',
  client: 'Client', admin: 'Administrateur',
};
export const badge = status => el('span', { className: `badge badge-${Object.hasOwn(labels, status) ? status : 'unknown'}` }, labels[status] || 'État inconnu');
export function notice(container, message, type = 'error') {
  const kind = ['error', 'success', 'info'].includes(type) ? type : 'info';
  container.replaceChildren(el('div', { className: `notice notice-${kind}`, role: kind === 'error' ? 'alert' : 'status', tabIndex: -1 }, message));
  if (kind === 'error') container.firstElementChild.focus({ preventScroll: true });
}
let fieldIndex = 0;
export function field(label, control, hint = '') {
  if (!control.id) control.id = `field-${++fieldIndex}`;
  const hintId = `${control.id}-hint`;
  if (hint) control.setAttribute('aria-describedby', hintId);
  return el('div', { className: 'field' }, el('label', { htmlFor: control.id, for: control.id }, label), control,
    hint ? el('small', { id: hintId, className: 'muted' }, hint) : null);
}
export const button = (label, attrs = {}) => el('button', { type: 'button', className: 'button button-primary', ...attrs }, label);
export const heading = (title, description = '') => el('div', { className: 'page-heading' }, el('h1', {}, title), description ? el('p', { className: 'muted' }, description) : null);
export const empty = (title, description = '') => el('div', { className: 'empty-state panel' }, el('h2', {}, title), description ? el('p', { className: 'muted' }, description) : null);
export function renderError(root, error, retry) {
  const box = el('div', { className: 'notice notice-error', role: 'alert' }, el('p', {}, error?.message || 'Impossible de charger ces données.'));
  if (retry) box.append(button('Réessayer', { className: 'button button-secondary', onClick: () => busy(box.querySelector('button'), retry).catch(next => renderError(root, next, retry)) }));
  root.replaceChildren(box);
}
export async function busy(control, task) {
  if (control.disabled) return;
  const previous = control.getAttribute('aria-busy');
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  try { return await task(); }
  finally {
    control.disabled = false;
    if (previous === null) control.removeAttribute('aria-busy'); else control.setAttribute('aria-busy', previous);
  }
}
export function isLocalImagePath(path) {
  return typeof path === 'string' && (path === '' || /^\/assets\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:svg|png|jpe?g|webp|gif)$/.test(path));
}
export function productImage(product) {
  const fallback = '/assets/images/product-placeholder.svg';
  const image = el('img', {
    className: 'product-image', src: isLocalImagePath(product.image_url) && product.image_url ? product.image_url : fallback,
    alt: product.name ? `Illustration : ${product.name}` : 'Illustration de produit', loading: 'lazy', width: '480', height: '360',
  });
  image.addEventListener('error', () => { if (image.getAttribute('src') !== fallback) image.src = fallback; }, { once: true });
  return image;
}
export function orderCard(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return el('article', { className: 'order-card panel' },
    el('div', { className: 'cluster section-heading' }, el('h3', {}, `Commande n° ${order.id}`), badge(order.status)),
    el('p', { className: 'muted' }, date(order.created_at)),
    el('ul', { className: 'order-items' }, items.map(item => el('li', { className: 'order-item' },
      el('span', {}, `${item.product_name} × ${item.quantity}`), el('span', {}, money(item.line_total_xaf))))),
    el('p', { className: 'price' }, `Total : ${money(order.total_xaf)}`));
}
