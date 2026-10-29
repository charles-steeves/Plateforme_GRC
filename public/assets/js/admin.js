import { api, isUncertainMutation as uncertain } from './api.js';
import {
  el, money, date, badge, notice, field, button, heading, empty,
  renderError, busy, orderCard, productImage, isLocalImagePath,
} from './ui.js';

const ORDER_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', delivered: 'Livrée', cancelled: 'Annulée',
};
const ORDER_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'], confirmed: ['delivered', 'cancelled'],
  delivered: [], cancelled: [],
};
const ORDER_ACTIONS = {
  confirmed: 'Confirmer la commande', delivered: 'Marquer comme livrée', cancelled: 'Annuler la commande',
};
const SEGMENTS = {
  no_purchase: 'Sans achat', new: 'Nouveau client', occasional: 'Client occasionnel',
  regular: 'Client régulier', inactive: 'Client inactif',
};

function records(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('La liste reçue du serveur est invalide.');
  return data.items;
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Un indicateur reçu du serveur est invalide.');
  return new Intl.NumberFormat('fr-FR').format(value);
}

function loading(root, message) {
  root.replaceChildren(el('p', { role: 'status', className: 'muted' }, message));
  root.setAttribute('aria-busy', 'true');
}

function confirmedMutation(data, key, expectedId) {
  const value = data?.[key];
  if (!value || !validId(value.id) || (expectedId !== undefined && value.id !== expectedId)) {
    const error = new Error('Le serveur n’a pas confirmé la modification. Actualisez les données avant de recommencer.');
    error.uncertain = true;
    throw error;
  }
  return value;
}

function mutationMessage(error) {
  return uncertain(error)
    ? 'La confirmation du serveur n’a pas été reçue. La modification a peut-être été enregistrée : vérifiez les données avant de recommencer.'
    : error.message;
}

function metric(label, value) {
  return el('article', { className: 'panel metric-card' },
    el('p', { className: 'muted' }, label),
    el('p', { className: 'metric-value' }, value));
}

function statusChart(counts) {
  const entries = Object.entries(ORDER_LABELS).map(([key, label]) => ({
    key, label, value: counts[key],
  }));
  if (entries.some(row => !Number.isSafeInteger(row.value) || row.value < 0)) {
    throw new Error('Les données de commandes reçues sont invalides.');
  }
  const total = entries.reduce((sum, row) => sum + row.value, 0);
  const circumference = 2 * Math.PI * 46;
  let offset = 0;
  const rings = entries.map(row => {
    const portion = total > 0 ? row.value / total * circumference : 0;
    const element = el('circle', {
      cx: '65', cy: '65', r: '46', fill: 'none', 'stroke-width': '17',
      className: `chart-ring chart-ring-${row.key}`,
      'stroke-dasharray': `${portion} ${circumference - portion}`,
      'stroke-dashoffset': String(-offset),
    });
    offset += portion;
    return element;
  });
  const legend = el('ul', { className: 'chart-legend' }, entries.map(row =>
    el('li', {},
      el('span', { className: `chart-key chart-key-${row.key}`, 'aria-hidden': 'true' }),
      el('span', {}, row.label),
      el('strong', {}, count(row.value)))));
  return el('section', { className: 'panel chart-panel' },
    el('h2', {}, 'État des commandes'),
    el('div', { className: 'chart-donut-layout' },
      el('div', { className: 'chart-donut' },
        el('svg', { viewBox: '0 0 130 130', role: 'img',
          'aria-label': `${total} commandes réparties par statut` },
          el('circle', { cx: '65', cy: '65', r: '46', fill: 'none',
            stroke: '#e7edf4', 'stroke-width': '17' }),
          el('g', { transform: 'rotate(-90 65 65)' }, rings)),
        el('div', { className: 'chart-donut-center', 'aria-hidden': 'true' },
          el('strong', {}, count(total)), el('span', {}, 'total'))),
      legend));
}

function trendChart(rows) {
  if (!Array.isArray(rows) || rows.length !== 7 ||
    rows.some(row => typeof row?.day !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
      !Number.isSafeInteger(row.count) || row.count < 0)) {
    throw new Error('L’évolution des commandes reçue est invalide.');
  }
  const max = Math.max(1, ...rows.map(row => row.count));
  const bars = rows.map(row => {
    const label = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${row.day}T12:00:00Z`));
    return el('div', { className: 'chart-trend-row' },
      el('span', {}, label),
      el('progress', { value: String(row.count), max: String(max),
        'aria-label': `${label} : ${row.count} commande(s)` }),
      el('strong', {}, count(row.count)));
  });
  return el('section', { className: 'panel chart-panel' },
    el('h2', {}, 'Commandes sur 7 jours'),
    el('div', { className: 'chart-trend-list' }, bars));
}

async function dashboard(root) {
  const content = el('div', { className: 'stack' });
  const refresh = button('Actualiser les indicateurs', { className: 'button button-secondary', onClick: () => load() });
  root.replaceChildren(heading('Tableau de bord GRC', 'Clients, commandes et qualité de service.'),
    el('div', { className: 'cluster' }, refresh, el('span', { className: 'muted', role: 'status', id: 'dashboard-updated' }, '')), content);
  let generation = 0;
  let lastPending = null;
  async function load(automatic = false) {
    const request = ++generation;
    refresh.disabled = true;
    if (!automatic) loading(content, 'Chargement des indicateurs…');
    try {
      const data = await api('/admin/dashboard');
      if (request !== generation) return;
      const satisfaction = data.satisfaction_avg;
      if (satisfaction !== null && (typeof satisfaction !== 'number' || !Number.isFinite(satisfaction) || satisfaction < 1 || satisfaction > 5)) {
        throw new Error('La moyenne de satisfaction reçue est invalide.');
      }
      const values = el('div', { className: 'metrics' },
        metric('Clients', count(data.customers_count)),
        metric('Commandes', count(data.orders_count)),
        metric('Chiffre d’affaires', money(data.ca_simule_xaf)),
        metric('Tickets à traiter', count(data.tickets_open_count)),
        metric('Satisfaction', satisfaction === null ? 'Aucun avis' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(satisfaction)} / 5`),
        metric('Clients inactifs', count(data.customers_inactive_count)));
      const charts = el('div', { className: 'dashboard-charts' },
        statusChart(data.order_status_counts ?? {}), trendChart(data.orders_last_7_days));
      const pending = data.order_status_counts?.pending ?? 0;
      const activity = el('section', { className: 'panel stack admin-activity' },
        el('div', { className: 'section-heading' }, el('h2', {}, 'À traiter'),
          el('span', { className: 'badge badge-pending' }, `${count(pending)} commande${pending > 1 ? 's' : ''} en attente`)),
        el('div', { className: 'cluster' },
          el('a', { href: '/admin-orders.html', className: 'button button-primary' }, 'Suivre les commandes'),
          el('a', { href: '/admin-tickets.html', className: 'button button-secondary' }, 'Répondre aux clients'),
          el('a', { href: '/admin-customers.html', className: 'button button-secondary' }, 'Connaître mes clients')));
      const process = el('section', { className: 'panel stack crm-process' },
        el('h2', {}, 'La GRC en pratique'),
        el('div', { className: 'crm-process-grid' },
          el('a', { href: '/admin-customers.html' }, el('strong', {}, 'GRC analytique'), el('span', {}, 'Clients et segmentation')),
          el('a', { href: '/admin-orders.html' }, el('strong', {}, 'GRC opérationnelle'), el('span', {}, 'Commandes et suivi')),
          el('a', { href: '/admin-tickets.html' }, el('strong', {}, 'GRC interactive'), el('span', {}, 'Échanges et SAV')),
          el('a', { href: '/admin-orders.html' }, el('strong', {}, 'Fidélisation'), el('span', {}, 'Points et satisfaction'))));
      content.replaceChildren(values, activity, charts, process);
      document.getElementById('dashboard-updated').textContent = 'Actualisé à ' + new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: 'Africa/Libreville' }).format(new Date());
      if (automatic && lastPending !== null && pending > lastPending) {
        const message = el('p', { className: 'notice notice-info', role: 'status' },
          `${pending - lastPending} nouvelle${pending - lastPending > 1 ? 's' : ''} commande${pending - lastPending > 1 ? 's' : ''} en attente`);
        content.prepend(message);
      }
      lastPending = pending;
    } catch (error) {
      if (request === generation && !automatic) renderError(content, error, load);
    } finally {
      if (request === generation) {
        content.removeAttribute('aria-busy');
        refresh.disabled = false;
      }
    }
  }
  await load();
  // Refresh discreetly while the administrator is on this screen. No WebSocket
  // and no polling while offline/in the background; source of truth remains SQLite.
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && !refresh.disabled && root.isConnected) void load(true);
  }, 12000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}

function integerControl(name, value, label) {
  const max = name === 'price_xaf' ? 1_000_000_000_000 : 1_000_000_000;
  const input = el('input', {
    id: `product-${name}`, name, type: 'number', required: true, min: '0',
    max: String(max), step: '1', inputMode: 'numeric', value: String(value),
  });
  return { input, field: field(label, input, `Maximum : ${new Intl.NumberFormat('fr-FR').format(max)}.`) };
}

function readInteger(control, label) {
  const text = control.value.trim();
  const value = Number(text);
  if (!/^(0|[1-9]\d*)$/.test(text) || !Number.isSafeInteger(value) || value > Number(control.max)) {
    control.focus();
    throw new Error(`${label} doit être un entier positif ou nul, sans décimales, inférieur ou égal à ${control.max}.`);
  }
  return value;
}

async function products(root) {
  const feedback = el('div', { 'aria-live': 'polite' });
  const list = el('section', { className: 'stack', 'aria-label': 'Produits enregistrés' });
  const editor = el('section', { className: 'panel stack', 'aria-label': 'Édition du produit' });
  const refresh = button('Actualiser les produits', { className: 'button button-secondary', onClick: () => load() });
  const newProduct = button('Nouveau produit', {
    className: 'button button-primary', onClick: () => { if (mutationPending || needsRefresh) return; edit(); editor.querySelector('input')?.focus(); },
  });
  root.replaceChildren(heading('Produits et stocks', 'Créez, modifiez ou désactivez les produits du catalogue.'),
    el('div', { className: 'cluster' }, refresh, newProduct), feedback, el('div', { className: 'split' }, list, editor));
  let generation = 0;
  let editing = null;
  let mutationPending = false;
  let needsRefresh = false;

  function edit(product = null) {
    editing = product;
    const original = product ? { ...product, active: Boolean(product.active) } : null;
    const name = el('input', { id: 'product-name', name: 'name', type: 'text', required: true, maxLength: 120, value: product?.name ?? '' });
    const description = el('textarea', { id: 'product-description', name: 'description', rows: 4, maxLength: 4000 }, product?.description ?? '');
    const category = el('input', { id: 'product-category', name: 'category', type: 'text',
      list: 'product-category-options', required: true, maxLength: 120, value: product?.category ?? '' });
    const categoryOptions = el('datalist', { id: 'product-category-options' });
    void api('/admin/categories').then(data => {
      if (!Array.isArray(data?.items) || !categoryOptions.isConnected) return;
      categoryOptions.replaceChildren(...data.items.filter(item => typeof item?.name === 'string')
        .map(item => el('option', { value: item.name })));
    }).catch(() => { /* A new group can still be entered without suggestions. */ });
    const price = integerControl('price_xaf', product?.price_xaf ?? 0, 'Prix (FCFA)');
    const stock = integerControl('stock_quantity', product?.stock_quantity ?? 0, 'Quantité disponible');
    const image = el('input', { id: 'product-image', name: 'image_url', type: 'text', maxLength: 500, value: product?.image_url ?? '/assets/images/product-placeholder.svg', placeholder: '/assets/images/product-placeholder.svg' });
    const imageFile = el('input', { id: 'product-image-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const uploadMessage = el('div', { 'aria-live': 'polite', role: 'status' });
    const preview = el('img', { className: 'product-upload-preview',
      src: isLocalImagePath(image.value) && image.value ? image.value : '/assets/images/product-placeholder.svg',
      alt: 'Aperçu du produit' });
    let uploadedSelection = false;
    const upload = button('Importer l’image', { className: 'button button-secondary', type: 'button' });
    imageFile.addEventListener('change', () => { uploadedSelection = false; uploadMessage.replaceChildren(); });
    upload.addEventListener('click', async () => {
      const selected = imageFile.files?.[0];
      if (!selected) { notice(uploadMessage, 'Choisissez une photo dans votre appareil.'); return; }
      if (selected.size > 1_900_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
        notice(uploadMessage, 'Formats acceptés : JPG, PNG ou WebP, 1,9 Mo maximum.'); return;
      }
      const data = new FormData();
      data.append('image', selected, selected.name);
      imageFile.disabled = true;
      try {
        await busy(upload, async () => {
          const result = await api('/admin/product-image', { method: 'POST', body: data });
          if (!result || typeof result.image_url !== 'string' || !isLocalImagePath(result.image_url)) {
            throw new Error('Le fichier n’a pas pu être validé. Réessayez.');
          }
          image.value = result.image_url;
          preview.src = result.image_url;
          uploadedSelection = true;
          notice(uploadMessage, 'Image importée. Enregistrez le produit pour l’associer.', 'success');
        });
      } catch (error) { notice(uploadMessage, error.message || 'Impossible d’importer cette image.'); }
      finally { imageFile.disabled = false; }
    });
    const active = el('input', { id: 'product-active', name: 'active', type: 'checkbox', checked: product ? Boolean(product.active) : true });
    const message = el('div', { 'aria-live': 'polite' });
    const save = button(product ? 'Enregistrer les modifications' : 'Créer le produit', { type: 'submit', className: 'button button-primary' });
    const form = el('form', { className: 'stack' },
      field('Nom du produit', name), field('Description', description),
      field('Groupe de produits', category, 'Choisissez un groupe existant ou saisissez un nouveau nom.'), categoryOptions,
      price.field, stock.field,
      el('div', { className: 'product-upload-panel stack' },
        field('Photo du produit', imageFile, 'Sélectionnez une image depuis votre appareil (JPG, PNG, WebP ; 1,9 Mo maximum).'),
        el('div', { className: 'cluster' }, upload, preview), uploadMessage),
      el('details', { className: 'product-image-advanced' },
        el('summary', {}, 'Utiliser une image déjà disponible'), field('Chemin de l’image', image)),
      el('label', { htmlFor: 'product-active', className: 'cluster' }, active, 'Visible dans la boutique'),
      el('p', { className: 'muted' }, 'Le stock est une quantité absolue. Un produit désactivé reste dans les commandes passées.'),
      message, save);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (save.disabled || mutationPending || needsRefresh || !form.reportValidity()) return;
      message.replaceChildren();
      let payload;
      try {
        payload = {
          name: name.value.trim(), description: description.value.trim(), category: category.value.trim(),
          price_xaf: readInteger(price.input, 'Le prix'), stock_quantity: readInteger(stock.input, 'Le stock'),
          image_url: image.value.trim(), active: active.checked,
        };
        if (imageFile.files?.length && !uploadedSelection) throw new Error('Importez la photo sélectionnée avant d’enregistrer le produit.');
        if (!payload.name || !payload.category) throw new Error('Le nom et la catégorie ne peuvent pas être vides.');
        if (!isLocalImagePath(payload.image_url)) {
          image.focus();
          throw new Error('Utilisez un chemin d’image interne sous /assets/images/, sans URL externe.');
        }
        if (original) {
          payload = Object.fromEntries(Object.entries(payload).filter(([key, value]) => value !== original[key]));
          if (Object.keys(payload).length === 0) { notice(message, 'Aucune modification à enregistrer.', 'info'); return; }
        }
      } catch (error) { notice(message, error.message); return; }
      let saved;
      mutationPending = true;
      // A GET initiated before this write must not unlock the editor later.
      generation += 1;
      refresh.disabled = true;
      newProduct.disabled = true;
      form.querySelectorAll('input,textarea').forEach((control) => { control.disabled = true; });
      list.querySelectorAll('button').forEach((control) => { control.disabled = true; });
      try {
        await busy(save, async () => {
          const data = await api(original ? `/admin/products/${original.id}` : '/admin/products', {
            method: original ? 'PATCH' : 'POST', body: payload,
          });
          saved = confirmedMutation(data, 'product', original?.id);
        });
      } catch (error) {
        notice(message, mutationMessage(error));
        if (uncertain(error)) {
          needsRefresh = true;
          notice(feedback, mutationMessage(error));
          save.disabled = true;
          message.append(button('Vérifier les produits avant de recommencer', {
            className: 'button button-secondary', onClick: () => load(),
          }));
        }
        return;
      } finally {
        mutationPending = false;
        refresh.disabled = false;
        newProduct.disabled = needsRefresh;
        form.querySelectorAll('input,textarea').forEach((control) => { control.disabled = false; });
        list.querySelectorAll('button').forEach((control) => { control.disabled = needsRefresh; });
      }
      // Only a confirmed server response allows a success message. A failure
      // of the subsequent GET does not turn the saved mutation into a retry.
      notice(feedback, original ? 'Les modifications ont été enregistrées par le serveur.' : 'Le produit a été créé par le serveur.', 'success');
      if (editing === product) edit(original ? saved : null);
      await load();
    });
    editor.replaceChildren(el('h2', {}, product ? `Modifier le produit n° ${product.id}` : 'Nouveau produit'), form);
  }

  async function load() {
    if (mutationPending) return;
    const request = ++generation;
    refresh.disabled = true;
    loading(list, 'Chargement des produits…');
    try {
      const data = await api('/admin/products');
      if (request !== generation) return;
      const items = records(data);
      if (items.some((product) => !validId(product.id))) throw new Error('Un identifiant de produit reçu est invalide.');
      const wasUncertain = needsRefresh;
      const body = el('tbody');
      for (const product of items) {
        body.append(el('tr', {},
          el('td', {}, el('div', { className: 'admin-product-row' }, productImage(product),
            el('div', {}, el('strong', {}, product.name), el('p', { className: 'muted' }, product.category)))),
          el('td', {}, money(product.price_xaf)),
          el('td', {}, count(product.stock_quantity)),
          el('td', {}, el('span', { className: 'badge' }, product.active ? 'Actif' : 'Inactif')),
          el('td', {}, button('Modifier', { className: 'button button-secondary', disabled: mutationPending || needsRefresh, 'aria-label': `Modifier ${product.name}`, onClick: () => {
            if (mutationPending || needsRefresh) return;
            edit(product); editor.querySelector('input')?.focus();
          } }))));
      }
      list.replaceChildren(el('h2', {}, 'Catalogue administrateur'),
        items.length ? el('div', { className: 'table-wrap', tabIndex: 0, 'aria-label': 'Tableau des produits, défilement horizontal possible' },
          el('table', {}, el('caption', {}, `${items.length} produit${items.length > 1 ? 's' : ''}`),
            el('thead', {}, el('tr', {}, ...['Produit', 'Prix', 'Stock', 'Visibilité', 'Action'].map((label) => el('th', { scope: 'col' }, label)))), body))
          : empty('Aucun produit enregistré', 'Créez un premier produit avec le formulaire.'));
      // Do not unlock after a response that cannot be rendered coherently.
      needsRefresh = false;
      newProduct.disabled = false;
      list.querySelectorAll('button').forEach((control) => { control.disabled = false; });
      if (wasUncertain) notice(feedback, 'Les produits ont été relus sur le serveur. Vérifiez la liste : ouvrez le produit existant pour le modifier, ou choisissez « Nouveau produit » pour une création distincte.', 'info');
    } catch (error) {
      if (request === generation) renderError(list, error, load);
    } finally {
      if (request === generation) { list.removeAttribute('aria-busy'); refresh.disabled = false; }
    }
  }
  edit();
  await load();
}

async function orders(root) {
  const message = el('div', { 'aria-live': 'polite' });
  const list = el('div', { className: 'stack' });
  const filter = el('select', { id: 'order-filter', name: 'status' },
    el('option', { value: '' }, 'Tous les statuts'),
    ...Object.entries(ORDER_LABELS).map(([value, label]) => el('option', { value }, label)));
  const search = el('input', { id: 'order-search', type: 'search', placeholder: 'Nom, e-mail ou numéro' });
  const refresh = button('Actualiser les commandes', { className: 'button button-secondary', onClick: () => load() });
  root.replaceChildren(heading('Commandes', 'Suivre les achats fictifs et appliquer les transitions autorisées.'),
    el('div', { className: 'cluster' }, field('Filtrer par statut', filter), field('Rechercher dans les commandes chargées', search), refresh), message, list);
  let items = [];
  let generation = 0;
  let mutationPending = false;
  let needsRefresh = false;
  let loadingOrders = false;
  filter.addEventListener('change', render);
  search.addEventListener('input', render);

  function render() {
    const query = search.value.trim().toLocaleLowerCase('fr');
    const selected = items.filter((order) => (!filter.value || order.status === filter.value)
      && (!query || `${order.id} ${order.customer_name} ${order.customer_email}`.toLocaleLowerCase('fr').includes(query)));
    list.replaceChildren();
    if (!selected.length) {
      list.append(empty('Aucune commande à afficher', items.length ? 'Modifiez les filtres pour retrouver une commande.' : 'Les commandes enregistrées apparaîtront ici.'));
      return;
    }
    list.append(el('p', { role: 'status', className: 'muted' }, `${selected.length} commande${selected.length > 1 ? 's' : ''} affichée${selected.length > 1 ? 's' : ''}.`));
    for (const order of selected) {
      const card = orderCard(order);
      const localMessage = el('div', { 'aria-live': 'polite' });
      const actions = el('div', { className: 'cluster order-actions' });
      card.prepend(el('p', {}, el('strong', {}, order.customer_name), ' · ', order.customer_email));
      for (const nextStatus of ORDER_TRANSITIONS[order.status] ?? []) {
        const action = button(ORDER_ACTIONS[nextStatus], {
          className: nextStatus === 'cancelled' ? 'button button-secondary' : 'button button-primary',
          disabled: mutationPending || needsRefresh || loadingOrders,
          onClick: async () => {
            if (mutationPending || needsRefresh || loadingOrders) return;
            const text = nextStatus === 'delivered'
              ? `Marquer la commande n° ${order.id} comme livrée ? Le serveur attribuera les points de fidélité une seule fois.`
              : nextStatus === 'cancelled'
                ? `Annuler la commande n° ${order.id} ? Cette décision est définitive et le serveur restaurera le stock.`
                : `Confirmer la commande n° ${order.id} ?`;
            if (!window.confirm(text)) return;
            mutationPending = true;
            refresh.disabled = true;
            list.querySelectorAll('button').forEach((control) => { control.disabled = true; });
            let failed;
            try {
              const data = await api(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status: nextStatus } });
              const saved = confirmedMutation(data, 'order', order.id);
              if (!Object.hasOwn(ORDER_LABELS, saved.status)) throw new Error('Le statut retourné par le serveur est invalide. Actualisez les commandes.');
              items = items.map((item) => item.id === saved.id ? saved : item);
              notice(message, `Le serveur a enregistré la commande n° ${saved.id} : ${ORDER_LABELS[saved.status].toLocaleLowerCase('fr')}.`, 'success');
            } catch (error) { failed = error; }
            finally { mutationPending = false; refresh.disabled = false; }
            if (failed) {
              if (uncertain(failed)) needsRefresh = true;
              notice(message, mutationMessage(failed));
              notice(localMessage, mutationMessage(failed));
              // Refresh must precede another attempt after an ambiguous result.
              // Order transitions themselves remain enforced by the backend.
              if (!uncertain(failed)) list.querySelectorAll('button').forEach((control) => { control.disabled = false; });
              localMessage.append(button('Vérifier l’état des commandes', { className: 'button button-secondary', onClick: () => load() }));
            } else render();
          },
        });
        actions.append(action);
      }
      if (!(ORDER_TRANSITIONS[order.status] ?? []).length) actions.append(el('p', { className: 'muted' }, 'Statut définitif : aucune transition disponible.'));
      card.append(actions, localMessage);
      list.append(card);
    }
  }

  async function load() {
    if (mutationPending) return;
    const request = ++generation;
    loadingOrders = true;
    refresh.disabled = true;
    loading(list, 'Chargement des commandes…');
    try {
      const data = await api('/admin/orders');
      if (request !== generation) return;
      items = records(data);
      if (items.some((order) => !validId(order.id) || !Object.hasOwn(ORDER_LABELS, order.status))) throw new Error('Une commande reçue du serveur est invalide.');
      const wasUncertain = needsRefresh;
      render();
      needsRefresh = false;
      loadingOrders = false;
      list.querySelectorAll('button').forEach((control) => { control.disabled = false; });
      if (wasUncertain) notice(message, 'Les commandes ont été relues sur le serveur. Vérifiez leur statut avant toute nouvelle action.', 'info');
    } catch (error) {
      if (request === generation) renderError(list, error, load);
    } finally {
      if (request === generation) { loadingOrders = false; list.removeAttribute('aria-busy'); refresh.disabled = false; }
    }
  }
  await load();
}

function customerSummary(customer) {
  return el('dl', { className: 'summary' },
    ...[
      ['E-mail', customer.email], ['Segment', SEGMENTS[customer.segment] ?? 'Segment non reconnu'],
      ['Compte créé le', date(customer.created_at)], ['Commandes non annulées', count(customer.orders_count)],
      ['Montant livré', money(customer.total_delivered_xaf)],
      ['Dernier achat', customer.last_order_at ? date(customer.last_order_at) : 'Aucun achat'],
    ].map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value))));
}

async function customers(root) {
  const params = new URLSearchParams(location.search);
  const initialPage = Number(params.get('page') ?? 1);
  let page = Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1;
  let searchTerm = params.get('search') ?? '';
  let selectedId = Number(params.get('id'));
  if (!validId(selectedId)) selectedId = null;
  let listRequest = 0;
  let detailRequest = 0;
  let listController;
  let detailController;
  const list = el('section', { className: 'stack', 'aria-label': 'Liste des clients' });
  const detail = el('section', { className: 'panel stack customer-detail', 'aria-label': 'Fiche du client' });
  const search = el('input', { id: 'customer-search', name: 'search', type: 'search', value: searchTerm, maxLength: 254, placeholder: 'Nom ou e-mail fictif' });
  const submit = button('Rechercher', { type: 'submit', className: 'button button-primary' });
  const form = el('form', { className: 'cluster' }, field('Rechercher un client', search), submit);
  form.addEventListener('submit', (event) => { event.preventDefault(); searchTerm = search.value.trim(); page = 1; loadList(); });
  root.replaceChildren(heading('Clients et segmentation', 'Consulter les données, l’historique et la fidélité de chaque client fictif.'), form,
    el('p', { className: 'muted' }, 'Les segments sont calculés par le serveur sur les commandes non annulées. « Inactif » ne signifie pas « perdu ». Aucun message commercial n’est envoyé.'),
    el('div', { className: 'split' }, list, detail));

  function updateUrl() {
    const next = new URLSearchParams();
    if (searchTerm) next.set('search', searchTerm);
    if (page > 1) next.set('page', String(page));
    if (selectedId) next.set('id', String(selectedId));
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`);
  }

  async function loadDetail(id, focus = false) {
    if (!validId(id)) return;
    selectedId = id;
    updateUrl();
    detailController?.abort();
    detailController = new AbortController();
    const request = ++detailRequest;
    loading(detail, 'Chargement de la fiche client…');
    try {
      const data = await api(`/admin/customers/${id}`, { signal: detailController.signal });
      if (request !== detailRequest) return;
      if (data.customer?.id !== id || !Array.isArray(data.orders) || !Array.isArray(data.tickets)) throw new Error('La fiche client reçue est invalide.');
      const title = el('h2', { tabIndex: -1 }, data.customer.name);
      const orderList = el('div', { className: 'stack' }, el('h3', {}, 'Historique des commandes'));
      orderList.append(...(data.orders.length ? data.orders.map((order) => orderCard(order)) : [el('p', { className: 'muted' }, 'Aucune commande enregistrée.') ]));
      const ticketList = el('div', { className: 'stack' }, el('h3', {}, 'Tickets SAV'));
      ticketList.append(...(data.tickets.length ? data.tickets.map((ticket) => {
        if (!validId(ticket.id)) throw new Error('Un identifiant de ticket reçu est invalide.');
        return el('article', { className: 'panel' },
          el('a', { href: `/admin-tickets.html?id=${ticket.id}` }, `Ticket n° ${ticket.id} : ${ticket.subject}`),
          el('div', { className: 'cluster' }, badge(ticket.status), el('span', { className: 'muted' }, date(ticket.created_at))));
      }) : [el('p', { className: 'muted' }, 'Aucun ticket SAV.') ]));
      detail.replaceChildren(title, customerSummary(data.customer),
        el('p', { className: 'metric-value' }, `${count(data.loyalty_balance)} points de fidélité`), orderList, ticketList);
      if (focus) title.focus();
    } catch (error) {
      if (request === detailRequest && error.name !== 'AbortError') renderError(detail, error, () => loadDetail(id));
    } finally {
      if (request === detailRequest) detail.removeAttribute('aria-busy');
    }
  }

  async function loadList() {
    listController?.abort();
    listController = new AbortController();
    const request = ++listRequest;
    submit.disabled = true;
    loading(list, 'Chargement des clients…');
    updateUrl();
    try {
      const query = new URLSearchParams({ search: searchTerm, page: String(page), per_page: '20' });
      const data = await api(`/admin/customers?${query}`, { signal: listController.signal });
      if (request !== listRequest) return;
      const items = records(data);
      if (!Number.isSafeInteger(data.page) || data.page < 1 || !Number.isSafeInteger(data.per_page) || data.per_page < 1
        || !Number.isSafeInteger(data.total) || data.total < 0 || items.some((customer) => !validId(customer.id))) {
        throw new Error('La pagination reçue du serveur est invalide.');
      }
      page = data.page;
      updateUrl();
      const pages = Math.max(1, Math.ceil(data.total / data.per_page));
      const tableBody = el('tbody');
      for (const customer of items) {
        tableBody.append(el('tr', {},
          el('th', { scope: 'row' }, button(customer.name, {
            className: 'button button-secondary', 'aria-label': `Ouvrir la fiche de ${customer.name}`, onClick: () => loadDetail(customer.id, true),
          }), el('p', { className: 'muted' }, customer.email)),
          el('td', {}, SEGMENTS[customer.segment] ?? 'Segment non reconnu'),
          el('td', {}, count(customer.orders_count)), el('td', {}, money(customer.total_delivered_xaf))));
      }
      list.replaceChildren(items.length ? el('div', { className: 'table-wrap', tabIndex: 0, 'aria-label': 'Tableau des clients, défilement horizontal possible' },
        el('table', {}, el('caption', {}, `${data.total} client${data.total > 1 ? 's' : ''}`),
          el('thead', {}, el('tr', {}, ...['Client', 'Segment', 'Commandes', 'Montant livré'].map((label) => el('th', { scope: 'col' }, label)))), tableBody))
        : empty('Aucun client trouvé', 'Essayez une autre recherche.'),
      el('nav', { className: 'cluster pagination', 'aria-label': 'Pagination des clients' },
        button('Page précédente', { className: 'button button-secondary', disabled: page <= 1, onClick: () => { page -= 1; loadList(); } }),
        el('span', { role: 'status' }, `Page ${page} sur ${pages}`),
        button('Page suivante', { className: 'button button-secondary', disabled: page >= pages, onClick: () => { page += 1; loadList(); } })));
    } catch (error) {
      if (request === listRequest && error.name !== 'AbortError') renderError(list, error, loadList);
    } finally {
      if (request === listRequest) { list.removeAttribute('aria-busy'); submit.disabled = false; }
    }
  }
  if (!selectedId) detail.append(empty('Une vue complète de la relation client', 'Choisissez un client pour afficher son historique, ses tickets et ses points.'));
  await Promise.all([loadList(), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
}

export async function mountAdmin(root, { page, user }) {
  if (user?.role !== 'admin') {
    root.replaceChildren(heading('Accès administrateur requis', 'Connectez-vous avec votre compte administrateur pour consulter cette page.'),
      el('a', { href: '/login.html', className: 'button button-primary' }, 'Se connecter'));
    return;
  }
  const mount = {
    admin: dashboard, 'admin-products': products, 'admin-orders': orders, 'admin-customers': customers,
  }[page];
  if (!mount) throw new Error('Cette page d’administration est inconnue.');
  await mount(root);
}
