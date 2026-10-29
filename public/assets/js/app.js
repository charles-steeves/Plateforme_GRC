import { api, currentUser } from './api.js';
import { cartCount } from './cart.js';
import { el, button, heading, renderError, busy } from './ui.js';
import { mountShop } from './shop.js';
import { mountCustomer } from './customer.js';
import { mountTickets } from './tickets.js';
import { mountAdmin } from './admin.js';

const page = document.body.dataset.page;
const main = document.getElementById('main-content');
const header = document.getElementById('site-header');
const status = document.getElementById('connection-status');
const isAdminPage = page === 'admin' || page.startsWith('admin-');
const isPrivatePage = isAdminPage || ['account', 'tickets'].includes(page);
let signedInUser = null;
let sessionExpired = false;

function navLink(text, href, current) {
  return el('a', { className: `nav-link${current ? ' nav-current' : ''}`, href, ...(current ? { 'aria-current': 'page' } : {}) }, text);
}
function renderHeader(user, pending = false) {
  const nav = el('nav', { className: 'site-nav', id: 'primary-navigation', 'aria-label': 'Navigation principale' },
    navLink('La boutique', '/', ['index', 'product'].includes(page)),
    user?.role === 'client' ? navLink('Mon espace', '/account.html', page === 'account') : null,
    user?.role === 'client' ? navLink('Mon SAV', '/tickets.html', page === 'tickets') : null,
    user?.role === 'admin' ? navLink('Administration', '/admin.html', isAdminPage) : null);
  const toggle = button('Menu', { className: 'menu-toggle button button-secondary', 'aria-expanded': 'false', 'aria-controls': nav.id });
  const media = matchMedia('(max-width: 800px)');
  function toggleNav(open) {
    toggle.hidden = !media.matches;
    toggle.setAttribute('aria-expanded', String(open));
    nav.hidden = media.matches && !open;
  }
  toggle.addEventListener('click', () => toggleNav(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('keydown', event => {
    if (event.key === 'Escape' && media.matches) { toggleNav(false); toggle.focus(); }
  });
  media.addEventListener('change', () => toggleNav(false));
  toggleNav(false);
  const count = el('span', { className: 'cart-count', 'data-cart-count': '', 'aria-label': `${cartCount()} articles` }, cartCount());
  const actions = el('div', { className: 'header-actions' },
    el('a', { className: 'button button-secondary cart-link', href: '/cart.html', ...(page === 'cart' ? { 'aria-current': 'page' } : {}) }, 'Panier ', count));
  if (user) {
    const logout = button('Se déconnecter', { className: 'button button-quiet' });
    logout.addEventListener('click', () => busy(logout, async () => {
      try {
        await api('/auth/logout', { method: 'POST', body: {} });
        // Deliberately clear the private page through a navigation, rather than
        // leave previously fetched customer information visible after logout.
        location.assign('/login.html?logged_out=1');
      } catch (error) { status.textContent = error.message; status.className = 'notice notice-error'; }
    }));
    actions.append(logout);
  } else if (!pending) actions.append(el('a', { className: 'button button-primary', href: '/login.html' }, 'Se connecter'));
  else actions.append(el('span', { className: 'muted status-line' }, 'Session…'));
  header.replaceChildren(el('div', { className: 'header-inner' },
    el('a', { className: 'brand', href: '/', 'aria-label': 'Équateur — accueil de la boutique de démonstration' },
      el('span', { className: 'brand-mark', 'aria-hidden': 'true' }, 'é'),
      el('span', {}, 'équateur', el('small', {}, 'Boutique & relation client'))), toggle, nav, actions));
}
function renderAdminNav() {
  const tabs = [
    ['admin', 'Vue d’ensemble'], ['admin-products', 'Produits'], ['admin-orders', 'Commandes'],
    ['admin-customers', 'Clients'], ['admin-tickets', 'Service après-vente'],
  ];
  document.getElementById('section-navigation').replaceChildren(el('nav', { className: 'admin-nav', 'aria-label': 'Administration GRC' },
    tabs.map(([key, label]) => navLink(label, `/${key}.html`, page === key))));
}
function accessMessage(user, error) {
  main.replaceChildren(heading(error ? 'Session indisponible' : user ? 'Accès réservé' : 'Retrouvons votre espace',
    error ? 'La session n’a pas pu être vérifiée. Aucune donnée privée n’a été chargée.'
      : user ? 'Cette page est réservée à un autre rôle.' : 'Connectez-vous avec un compte de démonstration pour continuer.'));
  if (error) {
    const details = el('div');
    renderError(details, error, () => location.reload());
    main.append(details);
  } else {
    const next = `/${page}.html${location.search}`;
    main.append(el('div', { className: 'panel cluster' },
      el('a', { className: 'button button-primary', href: user ? '/' : `/login.html?next=${encodeURIComponent(next)}` }, user ? 'Retour à la boutique' : 'Se connecter'),
      !user ? el('a', { className: 'button button-secondary', href: `/register.html?next=${encodeURIComponent(next)}` }, 'Créer un compte fictif') : null));
  }
}
async function mount(user) {
  main.replaceChildren(el('p', { className: 'loading', role: 'status' }, 'Chargement…'));
  try {
    if (['index', 'product', 'cart'].includes(page)) await mountShop(main, { page, user });
    else if (['login', 'register', 'account'].includes(page)) await mountCustomer(main, { page, user });
    else if (['tickets', 'admin-tickets'].includes(page)) await mountTickets(main, { user, admin: page === 'admin-tickets' });
    else if (isAdminPage) await mountAdmin(main, { page, user });
    else main.replaceChildren(heading('Page introuvable'));
  } catch (error) { if (!sessionExpired) renderError(main, error, () => mount(user)); }
}
window.addEventListener('grc:cart', event => {
  const count = event.detail?.count ?? cartCount();
  document.querySelectorAll('[data-cart-count]').forEach(node => {
    node.textContent = count;
    node.setAttribute('aria-label', `${count} articles`);
  });
});
window.addEventListener('grc:unauthorized', () => {
  sessionExpired = true;
  signedInUser = null;
  renderHeader(null);
  document.getElementById('section-navigation').replaceChildren();
  if (isPrivatePage || page === 'cart') accessMessage(null);
  status.textContent = 'Votre session a expiré. Reconnectez-vous pour continuer.';
  status.className = 'notice notice-info';
});
window.addEventListener('offline', () => {
  status.textContent = 'Vous êtes hors connexion. Les actions ne peuvent pas être confirmées.';
  status.className = 'notice notice-error';
});
window.addEventListener('online', () => {
  status.textContent = 'Connexion réseau rétablie. Actualisez les données avant de poursuivre.';
  status.className = 'notice notice-info';
});
async function start() {
  renderHeader(null, true);
  const earlyPublicPage = page === 'index';
  const session = currentUser();
  const publicLoad = earlyPublicPage ? mount(null) : null;
  let sessionError = null;
  try { signedInUser = await session; }
  catch (error) { sessionError = error; }
  renderHeader(signedInUser);
  if (sessionError && !isPrivatePage) {
    status.textContent = 'Service de session indisponible. Les données affichées ne remplacent pas une connexion au serveur.';
    status.className = 'notice notice-info';
  }
  if (isPrivatePage && (sessionError || !signedInUser || signedInUser.role !== (isAdminPage ? 'admin' : 'client'))) {
    accessMessage(signedInUser, sessionError);
    return;
  }
  if (isAdminPage) renderAdminNav();
  if (earlyPublicPage) await publicLoad;
  else await mount(signedInUser);
}
start().catch(error => renderError(main, error, () => location.reload()));
