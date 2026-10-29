import { api, isUncertainMutation } from './api.js';
import {
  el, money, notice, field, button, heading, empty,
  renderError, busy, orderCard, productImage,
} from './ui.js';
import {
  getCart, setQuantity, addToCart, removeFromCart, clearCart, cartIssue,
} from './cart.js';

const PER_PAGE = 12;
const MAX_QUANTITY = 20;
// Shared across cart rerenders so another local control cannot unlock a
// pending or uncertain order request by creating a fresh checkout form.
let checkoutPending = false;
let checkoutUncertain = false;

function sameCart(left, right) {
  return left.length === right.length && left.every(item =>
    right.some(other => other.product_id === item.product_id && other.quantity === item.quantity));
}

function id(value) {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function productData(product) {
  if (!product || !integer(product.id, 1) || typeof product.name !== 'string'
    || typeof product.description !== 'string' || typeof product.category !== 'string'
    || !integer(product.price_xaf) || !integer(product.stock_quantity)
    || ![true, false, 0, 1].includes(product.active)) {
    throw new Error('Le serveur a renvoyé un produit incomplet. Réessayez après vérification du service.');
  }
  return product;
}

function isActive(product) {
  return product.active === true || product.active === 1;
}

function stockText(product) {
  if (!isActive(product)) return 'Produit indisponible';
  return product.stock_quantity > 0
    ? `${product.stock_quantity} en stock`
    : 'Rupture de stock';
}

function catalogueURL({ search = '', category = '', page = 1 }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/index.html${query ? `?${query}` : ''}`;
}

function productCard(product) {
  return el('article', { className: 'product-card' },
    el('a', { href: `/product.html?id=${product.id}`, className: 'product-image-link',
      'aria-label': `Voir ${product.name}` }, productImage(product)),
    el('div', { className: 'stack product-card-content' },
      el('p', { className: 'eyebrow' }, product.category),
      el('h2', {}, el('a', { href: `/product.html?id=${product.id}` }, product.name)),
      el('p', { className: 'price' }, money(product.price_xaf)),
      el('p', { className: 'muted' }, stockText(product)),
      el('a', { className: 'button button-secondary', href: `/product.html?id=${product.id}` },
        'Découvrir le produit')));
}

async function mountCatalogue(root) {
  const params = new URLSearchParams(window.location.search);
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const page = id(params.get('page') || '1') || 1;
  const searchInput = el('input', { id: 'catalogue-search', name: 'search', type: 'search',
    value: search, maxLength: 200, placeholder: 'Téléphone, casque, accessoire…' });
  const categoryInput = el('select', { id: 'catalogue-category', name: 'category' },
    el('option', { value: '' }, 'Toutes les catégories'));
  if (category) categoryInput.append(el('option', { value: category, selected: true }, category));
  const form = el('form', { className: 'panel catalogue-toolbar', action: '/index.html', method: 'get',
    role: 'search', 'aria-label': 'Rechercher dans le catalogue' },
  field('Rechercher un produit', searchInput),
  field('Catégorie', categoryInput),
  el('div', { className: 'catalogue-toolbar-actions' },
    button('Rechercher', { type: 'submit', className: 'button button-primary' }),
    el('a', { href: '/index.html', className: 'button button-secondary' }, 'Effacer les filtres')));
  const results = el('section', { className: 'stack', 'aria-label': 'Résultats du catalogue',
    'aria-busy': 'true' }, el('p', { role: 'status' }, 'Chargement des produits…'));
  root.replaceChildren(
    el('section', { className: 'hero' },
      el('div', { className: 'hero-copy' },
        el('p', { className: 'eyebrow' }, 'Découvrez notre catalogue'),
        el('h1', { className: 'hero-title' }, 'Votre quotidien, ', el('em', {}, 'bien équipé.')),
        el('p', { className: 'hero-description' },
          'Parcourez les produits, préparez votre panier et retrouvez notre service client au même endroit.'),
        el('div', { className: 'hero-facts' }, el('span', {}, 'Suivi des commandes'),
          el('span', {}, 'Service client'), el('span', {}, 'Programme de fidélité'))),
      el('div', { className: 'hero-art', 'aria-hidden': 'true' },
        el('img', { src: '/assets/images/product-placeholder.svg', alt: '', width: 480, height: 360 }))),
    form, results);
  // Administrator-defined categories are derived from product data, never free
  // text entered by a visitor. Keep the catalogue usable if this lookup fails.
  void api('/products/categories').then(data => {
    if (!Array.isArray(data?.items)) return;
    const rows = data.items.filter(item => typeof item?.name === 'string'
      && item.name.length > 0 && item.name.length <= 120 && Number.isSafeInteger(item.count));
    const options = [el('option', { value: '' }, 'Toutes les catégories')];
    let present = false;
    for (const item of rows) {
      if (item.name === category) present = true;
      options.push(el('option', { value: item.name }, item.name));
    }
    if (category && !present) options.push(el('option', { value: category }, category));
    categoryInput.replaceChildren(...options);
    categoryInput.value = category;
  }).catch(() => { /* Products can still load if the category list is unavailable. */ });
  try {
    const query = new URLSearchParams({ search, category, page: String(page), per_page: String(PER_PAGE) });
    const data = await api(`/products?${query}`);
    if (!data || !Array.isArray(data.items) || !integer(data.page, 1)
      || !integer(data.per_page, 1) || data.per_page > 24 || !integer(data.total)) {
      throw new Error('Le catalogue reçu est incomplet. Impossible d’afficher des résultats fiables.');
    }
    const products = data.items.map(productData);
    if (products.some(product => !isActive(product))) {
      throw new Error('Le catalogue contient un produit indisponible. Le service doit être vérifié.');
    }
    const pagination = el('nav', { className: 'pagination cluster', 'aria-label': 'Pagination du catalogue' });
    if (data.page > 1) pagination.append(el('a', {
      href: catalogueURL({ search, category, page: data.page - 1 }),
      className: 'button button-secondary', rel: 'prev',
    }, 'Page précédente'));
    pagination.append(el('span', { className: 'muted' },
      `Page ${data.page} sur ${Math.max(1, Math.ceil(data.total / data.per_page))}`));
    if (data.page * data.per_page < data.total) pagination.append(el('a', {
      href: catalogueURL({ search, category, page: data.page + 1 }),
      className: 'button button-secondary', rel: 'next',
    }, 'Page suivante'));
    results.replaceChildren(
      el('p', { role: 'status', 'aria-live': 'polite' },
        `${data.total} produit${data.total === 1 ? '' : 's'} trouvé${data.total === 1 ? '' : 's'}.`),
      products.length
        ? el('div', { className: 'product-grid grid' }, products.map(productCard))
        : empty('Aucun produit à afficher', 'Essayez un autre mot-clé ou retirez le filtre de catégorie.'),
      pagination);
  } catch (error) {
    renderError(results, error, () => mountCatalogue(root));
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

async function mountProduct(root, user) {
  const productId = id(new URLSearchParams(window.location.search).get('id'));
  const content = el('section', { className: 'stack', 'aria-busy': 'true' },
    el('p', { role: 'status' }, 'Chargement du produit…'));
  root.replaceChildren(el('a', { href: '/index.html', className: 'back-link' }, '← Retour au catalogue'), content);
  if (!productId) {
    content.replaceChildren(heading('Produit introuvable'),
      empty('Le lien du produit est invalide', 'Choisissez un produit depuis le catalogue.'));
    content.setAttribute('aria-busy', 'false');
    return;
  }
  try {
    const data = await api(`/products/${productId}`);
    const product = productData(data?.product);
    if (product.id !== productId) throw new Error('Le serveur a renvoyé un autre produit que celui demandé.');
    if (!isActive(product)) throw new Error('Ce produit n’est plus disponible dans la boutique.');
    const quantity = el('input', { id: 'product-quantity', name: 'quantity', type: 'number',
      min: 1, max: Math.min(MAX_QUANTITY, product.stock_quantity), step: 1,
      value: 1, required: true, inputMode: 'numeric', disabled: product.stock_quantity === 0 });
    const messages = el('div', { 'aria-live': 'polite' });
    const add = button('Ajouter au panier', { type: 'submit', className: 'button button-primary',
      disabled: product.stock_quantity === 0 || user?.role === 'admin' });
    const form = el('form', { className: 'stack', onSubmit: event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      try {
        const count = quantity.valueAsNumber;
        const existing = getCart().find(item => item.product_id === product.id)?.quantity || 0;
        if (!integer(count, 1) || count > MAX_QUANTITY
          || existing + count > Math.min(MAX_QUANTITY, product.stock_quantity)) {
          notice(messages, 'La quantité cumulée du panier doit respecter le stock et la limite de 20 unités par produit.');
          return;
        }
        addToCart(product.id, count);
        notice(messages, `${count} article${count === 1 ? '' : 's'} ajouté${count === 1 ? '' : 's'} au panier.`, 'success');
        if (cartIssue()) messages.append(el('p', { className: 'notice notice-info', role: 'status' }, cartIssue()));
        messages.append(el('a', { href: '/cart.html' }, 'Voir mon panier'));
      } catch (error) {
        notice(messages, error.message || 'Impossible d’enregistrer le panier dans ce navigateur.');
      }
    } }, field('Quantité', quantity, '20 unités maximum par produit. Le stock sera vérifié à la commande.'), add);
    content.replaceChildren(el('div', { className: 'split product-detail' },
      el('div', { className: 'panel product-detail-image' }, productImage(product)),
      el('div', { className: 'panel stack' },
        el('p', { className: 'eyebrow' }, product.category), heading(product.name),
        el('p', { className: 'price' }, money(product.price_xaf)),
        el('p', {}, stockText(product)),
        el('p', { className: 'product-description' }, product.description || 'Description non renseignée.'),
        user?.role === 'admin'
          ? el('p', { className: 'notice' }, 'Le panier et les commandes sont réservés aux comptes clients.')
          : form,
        messages)));
  } catch (error) {
    if (error.status === 404) content.replaceChildren(heading('Produit introuvable'),
      empty('Ce produit n’est pas disponible', 'Il a peut-être été retiré du catalogue.'));
    else renderError(content, error, () => mountProduct(root, user));
  } finally {
    content.setAttribute('aria-busy', 'false');
  }
}

function lineTotal(product, quantity) {
  const total = product.price_xaf * quantity;
  if (!integer(total)) throw new Error('Le montant indicatif dépasse les limites prises en charge.');
  return total;
}

function validOrder(order) {
  if (!order || !integer(order.id, 1) || !integer(order.total_xaf)
    || !['pending', 'confirmed', 'delivered', 'cancelled'].includes(order.status)
    || typeof order.created_at !== 'string' || !Number.isFinite(Date.parse(order.created_at))
    || !Array.isArray(order.items) || !order.items.length) return false;
  let total = 0;
  for (const item of order.items) {
    if (!integer(item.product_id, 1) || typeof item.product_name !== 'string'
      || !integer(item.quantity, 1) || !integer(item.unit_price_xaf)
      || !integer(item.line_total_xaf) || item.line_total_xaf !== item.quantity * item.unit_price_xaf) return false;
    total += item.line_total_xaf;
    if (!integer(total)) return false;
  }
  return total === order.total_xaf;
}

async function mountCart(root, user) {
  if (checkoutPending) return;
  const stage = el('section', { className: 'stack', 'aria-busy': 'true' },
    el('p', { role: 'status' }, 'Vérification des produits et du stock…'));
  root.replaceChildren(heading('Mon panier',
    'Les prix ci-dessous sont indicatifs. Le serveur vérifie les produits, recalcule les montants et réserve le stock à la commande.'), stage);
  let cart;
  try {
    cart = getCart();
    if (!cart.length) {
      stage.replaceChildren(empty('Votre panier est vide', 'Découvrez notre sélection et ajoutez vos articles favoris.'),
        el('a', { href: '/index.html', className: 'button button-primary' }, 'Découvrir la boutique'));
      if (cartIssue()) stage.prepend(el('p', { className: 'notice notice-info', role: 'status' }, cartIssue()));
      return;
    }
    const rows = await Promise.all(cart.map(async item => {
      try {
        const data = await api(`/products/${item.product_id}`);
        const product = productData(data?.product);
        if (product.id !== item.product_id) throw new Error('Le serveur a renvoyé un autre produit que celui demandé.');
        return { item, product, error: null };
      } catch (error) {
        return { item, product: null, error };
      }
    }));
    const messages = el('div', { 'aria-live': 'polite' });
    const lines = el('div', { className: 'stack' });
    const summary = el('aside', { className: 'panel summary stack', 'aria-label': 'Récapitulatif du panier' });
    let total = 0;
    let invalid = false;
    for (const { item, product, error } of rows) {
      const unavailable = !product || !isActive(product);
      const enoughStock = product && product.stock_quantity >= item.quantity;
      if (unavailable || !enoughStock) invalid = true;
      if (product && isActive(product)) {
        total += lineTotal(product, item.quantity);
        if (!integer(total)) throw new Error('Le total indicatif dépasse les limites prises en charge.');
      }
      const row = el('article', { className: 'panel cart-row stack' });
      const controls = el('div', { className: 'cluster' });
      if (product && isActive(product)) {
        const quantityId = `cart-quantity-${item.product_id}`;
        const quantity = el('input', { id: quantityId, type: 'number', min: 1,
          max: Math.max(1, Math.min(MAX_QUANTITY, product.stock_quantity)), step: 1,
          value: item.quantity, required: true, inputMode: 'numeric' });
        const update = button('Mettre à jour', { type: 'submit', className: 'button button-secondary' });
        const quantityForm = el('form', { className: 'cluster quantity-control', onSubmit: event => {
          event.preventDefault();
          if (checkoutPending) return;
          if (!quantityForm.reportValidity()) return;
          const count = quantity.valueAsNumber;
          if (!integer(count, 1) || count > Math.min(MAX_QUANTITY, product.stock_quantity)) {
            notice(messages, 'Choisissez une quantité entière disponible, entre 1 et 20.');
            return;
          }
          try {
            setQuantity(item.product_id, count);
            mountCart(root, user);
          } catch (failure) {
            notice(messages, failure.message || 'Impossible de modifier le panier.');
          }
        } }, field(`Quantité pour ${product.name}`, quantity), update);
        controls.append(quantityForm);
        row.append(el('div', { className: 'cluster' }, productImage(product),
          el('div', { className: 'stack' },
            el('h2', {}, el('a', { href: `/product.html?id=${product.id}` }, product.name)),
            el('p', { className: 'muted' }, `${money(product.price_xaf)} l’unité · ${stockText(product)}`),
            el('p', { className: 'price' }, money(lineTotal(product, item.quantity))))));
        if (!enoughStock) row.append(el('p', { className: 'notice', role: 'alert' },
          product.stock_quantity === 0
            ? 'Ce produit est en rupture de stock. Retirez-le du panier pour poursuivre.'
            : 'Le stock disponible ne permet plus cette quantité. Mettez-la à jour pour poursuivre.'));
      } else {
        row.append(el('h2', {}, `Produit n°${item.product_id}`),
          el('p', { className: 'notice', role: 'alert' }, error?.status === 404 || (product && !isActive(product))
            ? 'Ce produit n’est plus disponible. Retirez-le du panier pour poursuivre.'
            : 'Impossible de vérifier ce produit. Le panier ne peut pas être commandé actuellement.'));
      }
      controls.append(button('Retirer', { type: 'button', className: 'button button-secondary',
        'aria-label': `Retirer ${product?.name || `le produit n°${item.product_id}`} du panier`,
        onClick: () => {
          if (checkoutPending) return;
          try {
            removeFromCart(item.product_id);
            mountCart(root, user);
          } catch (failure) {
            notice(messages, failure.message || 'Impossible de retirer ce produit.');
          }
        } }));
      row.append(controls);
      lines.append(row);
    }
    summary.append(el('h2', {}, 'Récapitulatif de la commande'),
      el('p', {}, `${cart.reduce((sum, item) => sum + item.quantity, 0)} article(s) dans le panier`),
      el('p', { className: 'muted' }, invalid ? 'Sous-total des produits vérifiables' : 'Total indicatif'),
      el('p', { className: 'price' }, money(total)),
      el('p', { className: 'muted' }, 'Le total est vérifié lors de la confirmation de votre commande.'));
    if (invalid) summary.append(el('p', { className: 'notice', role: 'alert' },
      'Corrigez les lignes indisponibles ou en stock insuffisant avant de commander.'),
    button('Revérifier le panier', { type: 'button', className: 'button button-secondary',
      onClick: () => mountCart(root, user) }));
    if (!user) {
      summary.append(el('p', {}, 'Connectez-vous avec un compte client pour passer commande.'),
        el('a', { href: '/login.html?next=%2Fcart.html', className: 'button button-primary' }, 'Se connecter pour commander'));
    } else if (user.role !== 'client') {
      summary.append(el('p', { className: 'notice' }, 'La création de commandes est réservée aux comptes clients.'));
    } else if (checkoutUncertain) {
      summary.append(el('p', { className: 'notice notice-error', role: 'alert' },
        'La confirmation d’une commande précédente n’a pas pu être vérifiée. Consultez votre historique avant toute nouvelle tentative.'),
      el('a', { href: '/account.html', className: 'button button-primary' }, 'Vérifier mes commandes'));
    } else {
      const confirmation = el('input', { id: 'cart-confirmation', type: 'checkbox', required: true });
      const submit = button('Confirmer ma commande', { type: 'submit',
        className: 'button button-primary', disabled: invalid });
      let uncertain = false;
      let submitted = false;
      let submitting = false;
      const checkout = el('form', { className: 'stack', onSubmit: async event => {
        event.preventDefault();
        if (checkoutPending || checkoutUncertain || uncertain || submitted || submitting || invalid || !checkout.reportValidity()) return;
        if (!sameCart(cart, getCart())) {
          notice(messages, 'Votre panier a changé dans un autre onglet. Actualisez-le pour vérifier les quantités avant de commander.');
          messages.append(button('Actualiser le panier', { className: 'button button-secondary', onClick: () => mountCart(root, user) }));
          return;
        }
        submitting = true;
        checkoutPending = true;
        const lockedControls = Array.from(root.querySelectorAll('button,input,select,textarea'))
          .filter(control => control !== submit)
          .map(control => ({ control, disabled: control.disabled }));
        lockedControls.forEach(({ control }) => { control.disabled = true; });
        try {
          await busy(submit, async () => {
            notice(messages, 'Enregistrement de votre commande…', 'info');
            try {
              const data = await api('/orders', { method: 'POST', body: {
                items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
              } });
              const order = data?.order;
              if (!validOrder(order)) {
                const malformed = new Error('La réponse de confirmation est incomplète.');
                malformed.uncertain = true;
                throw malformed;
              }
              submitted = true;
              // The server response is authoritative. Storage failure must not turn
              // a successful order into an apparent error and invite a duplicate.
              let cartCleared = true;
              let cartChanged = false;
              try {
                cartChanged = !sameCart(cart, getCart());
                if (!cartChanged) clearCart();
              } catch { cartCleared = false; }
              root.replaceChildren(heading('Commande enregistrée',
                'Votre commande a bien été enregistrée.'),
              el('section', { className: 'order-confirmation stack', role: 'status' },
                orderCard(order),
                cartChanged ? el('p', { className: 'notice notice-info' },
                  'Le panier a changé dans un autre onglet pendant l’envoi et a été conservé. Comparez-le à la commande enregistrée avant de recommander.') : null,
                !cartCleared ? el('p', { className: 'notice' },
                  'La commande est enregistrée, mais le navigateur n’a pas pu vider votre panier. Ne le validez pas une seconde fois.') : null,
                cartIssue() ? el('p', { className: 'notice notice-info', role: 'status' },
                  `${cartIssue()} La commande est enregistrée ; ne la validez pas une seconde fois.`) : null,
                el('a', { href: '/account.html', className: 'button button-primary' }, 'Retrouver mes commandes'),
                el('a', { href: '/index.html', className: 'button button-secondary' }, 'Retour à la boutique')));
            } catch (error) {
              if (isUncertainMutation(error)) {
                uncertain = true;
                checkoutUncertain = true;
                notice(messages, 'La confirmation n’a pas pu être vérifiée. La commande a peut-être été enregistrée. Consultez votre historique avant toute nouvelle tentative ; votre panier est conservé.');
                messages.append(el('a', { href: '/account.html' }, 'Vérifier mes commandes'));
              } else {
                notice(messages, error.message || 'La commande a été refusée. Votre panier est conservé.');
                if (error.status === 409 || error.status === 422) messages.append(
                  button('Actualiser les prix et le stock', { type: 'button', className: 'button button-secondary',
                    onClick: () => mountCart(root, user) }));
              }
            }
          });
        } finally {
          lockedControls.forEach(({ control, disabled }) => { control.disabled = disabled; });
          submitting = false;
          checkoutPending = false;
          if (uncertain || submitted) submit.disabled = true;
        }
      } }, el('label', { className: 'checkbox-field', htmlFor: 'cart-confirmation' }, confirmation,
        el('span', {}, 'Je confirme les articles et les quantités de ma commande.')), submit);
      summary.append(checkout);
    }
    const storageWarning = cartIssue()
      ? el('p', { className: 'notice notice-info', role: 'status' }, cartIssue()) : null;
    stage.replaceChildren(...[storageWarning, messages, el('div', { className: 'split' }, lines, summary)].filter(Boolean));
  } catch (error) {
    renderError(stage, error, () => mountCart(root, user));
  } finally {
    stage.setAttribute('aria-busy', 'false');
  }
}

export async function mountShop(root, { page, user }) {
  if (page === 'product') return mountProduct(root, user);
  if (page === 'cart') return mountCart(root, user);
  return mountCatalogue(root);
}
