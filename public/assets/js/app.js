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
    el('a', { className: 'brand', href: '/', 'aria-label': 'Plateforme GRC — accueil' },
      el('span', { className: 'brand-mark', 'aria-hidden': 'true' }, 'GRC'),
      el('span', {}, 'Plateforme GRC', el('small', {}, 'Vente & relation client'))), toggle, nav, actions));
}
function renderAdminNav(user) {
  const container = document.getElementById('section-navigation');
  const tabs = [
    ['admin', 'Vue d’ensemble', '◫'], ['admin-customers', 'Clients', '♙'],
    ['admin-orders', 'Commandes', '▤'], ['admin-products', 'Produits', '▦'],
    ['admin-tickets', 'Service client', '✉'],
  ];
  const nav = el('nav', { className: 'admin-nav', id: 'admin-sidebar-menu', 'aria-label': 'Administration GRC' },
    tabs.map(([key, label, symbol]) => el('a', {
      href: `/${key}.html`, title: label,
      ...(page === key ? { 'aria-current': 'page' } : {}),
    }, el('span', { className: 'admin-nav-icon', 'aria-hidden': 'true' }, symbol),
      el('span', { className: 'admin-nav-label' }, label))));
  const account = el('div', { className: 'admin-sidebar-account' },
    el('div', { className: 'admin-account-initials', 'aria-hidden': 'true' }, user.name.trim().charAt(0).toUpperCase()),
    el('div', { className: 'admin-sidebar-account-details' },
      el('strong', {}, user.name), el('span', {}, user.email)));
  const signout = button('Se déconnecter', { type: 'button', className: 'admin-sidebar-signout' });
  signout.addEventListener('click', () => busy(signout, async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      location.assign('/login.html?logged_out=1');
    } catch (error) {
      status.textContent = error.message;
      status.className = 'notice notice-error';
    }
  }));
  const sidebar = el('aside', { className: 'admin-sidebar', 'aria-label': 'Espace administration' },
    el('div', { className: 'admin-sidebar-heading' },
      el('span', { className: 'admin-sidebar-title' }, 'ESPACE GRC')),
    nav, el('div', { className: 'admin-sidebar-bottom' }, account, signout));
  const overlay = el('button', { type: 'button', className: 'admin-sidebar-overlay',
    'aria-label': 'Fermer le menu administration', hidden: true });
  const toggle = button('☰ Menu', { type: 'button', className: 'admin-sidebar-toggle button button-secondary',
    'aria-controls': 'admin-sidebar-menu', 'aria-expanded': 'true' });
  const mobile = matchMedia('(max-width: 900px)');
  function update(open) {
    document.body.classList.toggle('admin-sidebar-open', mobile.matches && open);
    document.body.classList.toggle('admin-sidebar-collapsed', !mobile.matches && !open);
    overlay.hidden = !(mobile.matches && open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '☰ Réduire' : '☰ Menu';
  }
  const savedCollapsed = (() => {
    try { return sessionStorage.getItem('grc-admin-sidebar-collapsed') === '1'; }
    catch { return false; }
  })();
  update(!mobile.matches && !savedCollapsed);
  toggle.addEventListener('click', () => {
    const currentlyOpen = mobile.matches ? document.body.classList.contains('admin-sidebar-open')
      : !document.body.classList.contains('admin-sidebar-collapsed');
    update(!currentlyOpen);
    if (!mobile.matches) {
      try { sessionStorage.setItem('grc-admin-sidebar-collapsed', currentlyOpen ? '1' : '0'); }
      catch { /* Navigation remains functional without storage. */ }
    }
  });
  overlay.addEventListener('click', () => { update(false); toggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('admin-sidebar-open')) {
      update(false); toggle.focus();
    }
  });
  mobile.addEventListener('change', () => update(!mobile.matches && !savedCollapsed));
  container.replaceChildren(sidebar, overlay);
  header.querySelector('.header-inner')?.prepend(toggle);
  document.body.classList.add('admin-workspace');
}
function accessMessage(user, error) {
  main.replaceChildren(heading(error ? 'Session indisponible' : user ? 'Accès réservé' : 'Retrouvons votre espace',
    error ? 'La session n’a pas pu être vérifiée. Aucune donnée privée n’a été chargée.'
      : user ? 'Cette page est réservée à un autre rôle.' : 'Connectez-vous pour accéder à votre espace.'));
  if (error) {
    const details = el('div');
    renderError(details, error, () => location.reload());
    main.append(details);
  } else {
    const next = `/${page}.html${location.search}`;
    main.append(el('div', { className: 'panel cluster' },
      el('a', { className: 'button button-primary', href: user ? '/' : `/login.html?next=${encodeURIComponent(next)}` }, user ? 'Retour à la boutique' : 'Se connecter'),
      !user ? el('a', { className: 'button button-secondary', href: `/register.html?next=${encodeURIComponent(next)}` }, 'Créer un compte') : null));
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
  document.body.classList.remove('admin-workspace', 'admin-sidebar-open', 'admin-sidebar-collapsed');
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
    status.textContent = 'Connexion momentanément indisponible. Certaines fonctions peuvent être limitées.';
    status.className = 'notice notice-info';
  }
  if (isPrivatePage && (sessionError || !signedInUser || signedInUser.role !== (isAdminPage ? 'admin' : 'client'))) {
    accessMessage(signedInUser, sessionError);
    return;
  }
  if (isAdminPage) renderAdminNav(signedInUser);
  if (earlyPublicPage) await publicLoad;
  else await mount(signedInUser);
}
start().catch(error => renderError(main, error, () => location.reload()));
