import { api, isUncertainMutation as uncertainMutation } from './api.js';
import { el, date, badge, notice, field, button, heading, empty, renderError, busy } from './ui.js';

const TRANSITIONS = Object.freeze({
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
});
const AUTO_REFRESH_MS = 10000;
const STATUS_LABELS = Object.freeze({
  open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé',
});

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mutationError(error) {
  const suffix = uncertainMutation(error)
    ? ' Le résultat de la demande est incertain. Vérifiez les données enregistrées avant tout nouvel envoi.'
    : '';
  return `${error.message || 'La demande n’a pas pu être enregistrée.'}${suffix}`;
}

function items(data) {
  if (!Array.isArray(data?.items) || data.items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('La réponse du service SAV est invalide.');
  }
  return data.items;
}

/** Render the contracted support workflow. No local ticket or message is simulated. */
export async function mountTickets(root, { user, admin = false }) {
  if (!user || user.role !== (admin ? 'admin' : 'client')) {
    root.replaceChildren(empty('Accès réservé', 'Connectez-vous avec un compte autorisé pour consulter le SAV.'));
    return;
  }

  const summaryNotice = el('div', { 'aria-live': 'polite' });
  const list = el('div', { className: 'stack', 'aria-live': 'polite' });
  const detail = el('section', { className: 'panel stack', 'aria-label': 'Détail du ticket', tabIndex: -1 });
  const createRegion = el('div', { className: 'stack' });
  const refresh = button('Actualiser les tickets', { className: 'button button-secondary', onClick: () => loadList() });
  const statusFilter = el('select', { id: 'ticket-status-filter', onChange: () => renderList() },
    el('option', { value: '' }, 'Tous les statuts'),
    Object.entries(STATUS_LABELS).map(([value, label]) => el('option', { value }, label)));
  const search = el('input', { type: 'search', id: 'ticket-search', maxLength: 160, placeholder: 'Rechercher un sujet', onInput: () => renderList() });
  const listSection = el('section', { className: 'panel stack', 'aria-labelledby': 'ticket-list-title' },
    el('div', { className: 'cluster' }, el('h2', { id: 'ticket-list-title' }, admin ? 'Demandes clients' : 'Mes demandes'), refresh),
    el('div', { className: 'grid' }, field('Rechercher dans les tickets chargés', search), field('Statut', statusFilter)), list);
  root.replaceChildren(
    heading(admin ? 'Service après-vente' : 'Mes échanges avec le SAV', admin
      ? 'Traitez les demandes, répondez aux clients et suivez leur résolution.'
      : 'Une question sur votre commande ? Retrouvez ici vos demandes et les réponses du service client.'),
    summaryNotice, createRegion, el('div', { className: 'split' }, listSection, detail));

  let tickets = [];
  let listReady = false;
  let listGeneration = 0;
  let detailGeneration = 0;
  let selectedId = null;
  let displayedListStamp = null;
  let displayedDetailStamp = null;
  let displayedTicketStatus = null;
  let polling = false;
  const drafts = new Map();
  const pendingTickets = new Set();
  const uncertainTickets = new Set();
  const initialId = new URLSearchParams(window.location.search).get('id');

  function renderList() {
    const query = search.value.trim().toLocaleLowerCase('fr');
    const visible = tickets.filter(ticket =>
      (!statusFilter.value || ticket.status === statusFilter.value)
      && (!query || `${ticket.subject} ${admin ? ticket.customer_name || '' : ''}`.toLocaleLowerCase('fr').includes(query)));
    const count = el('p', { className: 'muted' }, `${visible.length} ticket${visible.length > 1 ? 's' : ''} affiché${visible.length > 1 ? 's' : ''}`);
    if (!visible.length) {
      list.replaceChildren(count, empty(tickets.length ? 'Aucun résultat' : 'Aucun ticket pour le moment',
        tickets.length ? 'Essayez un autre sujet ou un autre statut.' : admin
          ? 'Les demandes de vos clients apparaîtront ici.' : 'Vous pouvez ouvrir votre première demande ci-dessus.'));
      return;
    }
    list.replaceChildren(count, ...visible.map(ticket => {
      const id = validId(ticket.id);
      if (!id) return el('p', { className: 'notice' }, 'Un ticket invalide ne peut pas être affiché.');
      const target = new URL(window.location.href);
      target.search = '';
      target.searchParams.set('id', String(id));
      const link = el('a', {
        href: `${target.pathname}${target.search}`,
        'aria-current': selectedId === id ? 'true' : undefined,
        onClick: event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          selectTicket(id, { updateUrl: true, focus: true });
        },
      }, `#${id} · ${ticket.subject}`);
      return el('article', { className: 'ticket-preview stack' },
        el('div', { className: 'cluster' }, link, badge(ticket.status)),
        admin ? el('p', { className: 'muted' }, ticket.customer_name || `Client #${ticket.user_id}`) : null,
        el('p', { className: 'muted' }, `Mis à jour : ${date(ticket.updated_at)}`));
    }));
  }

  async function loadList({ silent = false } = {}) {
    const generation = ++listGeneration;
    if (!silent) {
      refresh.disabled = true;
      list.setAttribute('aria-busy', 'true');
      if (!listReady) list.replaceChildren(el('p', { className: 'muted' }, 'Chargement des tickets…'));
    }
    try {
      const result = items(await api(admin ? '/admin/tickets' : '/tickets/me'));
      if (generation !== listGeneration) return;
      tickets = result;
      listReady = true;
      const stamp = JSON.stringify(result.map(ticket =>
        [ticket.id, ticket.status, ticket.updated_at, ticket.subject, ticket.customer_name]));
      // No list replacement on every timer tick: preserves keyboard focus and
      // avoids visual flicker while the customer is reading the ticket list.
      if (!silent || stamp !== displayedListStamp) {
        if (!silent || !list.contains(document.activeElement)) {
          renderList();
          displayedListStamp = stamp;
        }
      }
      return true;
    } catch (error) {
      if (generation !== listGeneration) return;
      if (!silent) renderError(list, error, loadList);
      return false;
    } finally {
      if (generation === listGeneration && !silent) {
        refresh.disabled = false;
        list.removeAttribute('aria-busy');
      }
    }
  }

  async function selectTicket(id, { updateUrl = false, focus = false, reconcile = false } = {}) {
    if (!validId(id)) return;
    const reconciliationRequested = reconcile && uncertainTickets.has(id) && !pendingTickets.has(id);
    selectedId = id;
    displayedDetailStamp = null;
    displayedTicketStatus = null;
    const generation = ++detailGeneration;
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', String(id));
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (listReady) renderList();
    detail.replaceChildren(el('p', { className: 'muted' }, 'Chargement de la conversation…'));
    detail.setAttribute('aria-busy', 'true');
    if (focus) detail.focus();
    try {
      const data = await api(`/tickets/${id}`);
      if (generation !== detailGeneration) return;
      if (!data?.ticket || validId(data.ticket.id) !== id || !Array.isArray(data.messages)
        || data.messages.some(message => !message || typeof message !== 'object' || typeof message.body !== 'string')) {
        throw new Error('La réponse du ticket est invalide.');
      }
      if (reconciliationRequested && !pendingTickets.has(id)) uncertainTickets.delete(id);
      renderDetail(data.ticket, data.messages);
      displayedDetailStamp = ticketStamp(data.ticket, data.messages);
      displayedTicketStatus = data.ticket.status;
      return true;
    } catch (error) {
      if (generation !== detailGeneration) return;
      renderError(detail, error, () => selectTicket(id, { reconcile }));
      return false;
    } finally {
      if (generation === detailGeneration) detail.removeAttribute('aria-busy');
    }
  }

  function ticketStamp(ticket, messages) {
    return JSON.stringify([ticket.id, ticket.status, ticket.updated_at,
      messages.map(message => [message.id, message.author_user_id, message.created_at, message.body])]);
  }

  function conversationContent(messages) {
    return el('div', { className: 'stack', 'data-ticket-conversation': '' },
      el('h3', {}, 'Conversation'), messages.length ? messages.map(message =>
        el('article', { className: 'message stack' },
          el('div', { className: 'cluster' },
            el('strong', {}, message.author_user_id === user.id ? 'Vous' : 'Votre interlocuteur'),
            el('time', { dateTime: message.created_at, className: 'muted' }, date(message.created_at))),
          el('p', { className: 'text-block' }, message.body)))
        : el('p', { className: 'muted' }, 'Aucun message supplémentaire. La demande initiale est affichée ci-dessus.'));
  }

  async function updateVisibleTicket() {
    const id = selectedId;
    const generation = detailGeneration;
    if (!id || pendingTickets.size || uncertainTickets.has(id) || detail.dataset.ticketId !== String(id)) return;
    const data = await api(`/tickets/${id}`);
    if (generation !== detailGeneration || id !== selectedId || !detail.isConnected
      || pendingTickets.has(id) || uncertainTickets.has(id)) return;
    if (!data?.ticket || validId(data.ticket.id) !== id || !Array.isArray(data.messages)
      || data.messages.some(message => !message || typeof message !== 'object'
        || typeof message.body !== 'string')) {
      throw new Error('La conversation reçue est invalide.');
    }
    const stamp = ticketStamp(data.ticket, data.messages);
    if (stamp === displayedDetailStamp) return;
    const changedStatus = data.ticket.status !== displayedTicketStatus;
    const messageDraft = detail.querySelector('textarea[name="body"]');
    const statusChoice = detail.querySelector('select[name="status"]');
    const userEditing = (messageDraft && (messageDraft.value.trim() || document.activeElement === messageDraft))
      || (statusChoice && (statusChoice.value || document.activeElement === statusChoice));
    if (changedStatus && !userEditing) {
      renderDetail(data.ticket, data.messages);
    } else {
      // Update only the message list and status badge, never replace the editor.
      // A reply typed on a phone is retained even when a colleague responds.
      const conversation = detail.querySelector('[data-ticket-conversation]');
      if (!conversation) return;
      conversation.replaceWith(conversationContent(data.messages));
      const statusBadge = detail.querySelector('[data-ticket-status]');
      if (statusBadge) statusBadge.replaceChildren(badge(data.ticket.status));
      const updatedAt = detail.querySelector('[data-ticket-updated]');
      if (updatedAt) updatedAt.textContent = `Ouvert le ${date(data.ticket.created_at)} · Mis à jour le ${date(data.ticket.updated_at)}`;
      if (changedStatus) {
        // The old status transition form is now stale: never submit it.
        detail.querySelectorAll('select[name="status"], button[type="submit"]').forEach(control => {
          control.disabled = true;
        });
        const alert = detail.querySelector('[data-ticket-change-notice]');
        if (alert) {
          alert.textContent = data.ticket.status === 'closed'
            ? 'Cette demande est fermée. Actualisez-la pour consulter les dernières informations.'
            : 'Le statut de cette demande a changé. Actualisez-la avant une nouvelle action.';
          alert.hidden = false;
        }
      }
    }
    displayedDetailStamp = stamp;
    displayedTicketStatus = data.ticket.status;
  }

  function syncTicketLock(id) {
    if (selectedId !== id || detail.dataset.ticketId !== String(id)) return;
    const locked = pendingTickets.has(id) || uncertainTickets.has(id);
    detail.querySelectorAll('button[type="submit"]').forEach(control => { control.disabled = locked; });
    detail.querySelectorAll('textarea[name="body"], select[name="status"]').forEach(control => {
      control.disabled = pendingTickets.has(id);
    });
    const verification = detail.querySelector('[data-ticket-verification]');
    if (verification) verification.hidden = !uncertainTickets.has(id);
  }

  function renderDetail(ticket, messages) {
    const id = validId(ticket.id);
    detail.dataset.ticketId = String(id);
    const messageNotice = el('div', { 'aria-live': 'polite' });
    const verification = el('div', {
      className: 'notice stack', 'data-ticket-verification': '', hidden: !uncertainTickets.has(id),
    }, el('p', {}, 'Le résultat de la dernière action est incertain. Les envois sont suspendus jusqu’à la vérification de cette conversation.'),
    button('Vérifier la conversation avant un nouvel envoi', {
      className: 'button button-secondary', onClick: async event => {
        await busy(event.currentTarget, () => selectTicket(id, { reconcile: true }));
      },
    }));
    const conversation = conversationContent(messages);
    detail.replaceChildren(
      el('div', { className: 'cluster', 'data-ticket-status': '' }, el('h2', {}, `Ticket #${id}`), badge(ticket.status)),
      el('h3', {}, ticket.subject),
      el('p', { className: 'muted', 'data-ticket-updated': '' }, `Ouvert le ${date(ticket.created_at)} · Mis à jour le ${date(ticket.updated_at)}`),
      el('p', { className: 'muted' }, ticket.order_id ? `Commande liée : #${ticket.order_id}` : 'Sans commande liée'),
      el('p', { className: 'text-block' }, ticket.description),
      admin ? statusForm(ticket) : null,
      conversation, el('p', { className: 'notice notice-info', 'data-ticket-change-notice': '', hidden: true }),
      verification, messageNotice);

    const reload = button('Actualiser la conversation', {
      className: 'button button-secondary', onClick: () => selectTicket(id, { reconcile: true }),
    });
    if (ticket.status === 'closed') {
      detail.append(el('p', { className: 'notice' }, 'Ce ticket est fermé. Aucun nouveau message ne peut être envoyé.'), reload);
      return;
    }
    if (!Object.hasOwn(TRANSITIONS, ticket.status)) {
      detail.append(el('p', { className: 'notice' }, 'Statut non reconnu : actualisez le ticket avant de répondre.'), reload);
      return;
    }
    const text = el('textarea', {
      id: `ticket-message-${id}`, name: 'body', required: true, maxLength: 4000, rows: 5,
      value: drafts.get(id) || '', onInput: event => drafts.set(id, event.currentTarget.value),
    });
    const send = button('Envoyer le message', { type: 'submit', className: 'button button-primary' });
    text.disabled = pendingTickets.has(id);
    send.disabled = pendingTickets.has(id) || uncertainTickets.has(id);
    const form = el('form', { className: 'stack', onSubmit: event => {
      event.preventDefault();
      if (!form.reportValidity() || send.disabled || pendingTickets.has(id) || uncertainTickets.has(id)) return;
      const body = text.value.trim();
      if (!body) {
        notice(messageNotice, 'Saisissez un message avant de l’envoyer.', 'error');
        text.focus();
        return;
      }
      busy(send, async () => {
        pendingTickets.add(id);
        syncTicketLock(id);
        text.disabled = true;
        let recorded = false;
        try {
          const data = await api(`/tickets/${id}/messages`, { method: 'POST', body: { body } });
          if (!data?.message || validId(data.message.ticket_id) !== id) {
            throw new Error('La confirmation du message est invalide. Actualisez la conversation avant de réessayer.');
          }
          drafts.delete(id);
          recorded = true;
          if (selectedId === id) text.value = '';
          notice(summaryNotice, `Votre message a été enregistré dans le ticket #${id}.`, 'success');
          await loadList();
        } catch (error) {
          if (uncertainMutation(error)) uncertainTickets.add(id);
          notice(summaryNotice, `Ticket #${id} : ${mutationError(error)}`, 'error');
          if (selectedId === id && messageNotice.isConnected) notice(messageNotice, mutationError(error), 'error');
        } finally {
          pendingTickets.delete(id);
          text.disabled = false;
          if (selectedId === id && (recorded || !text.isConnected)) await selectTicket(id);
        }
      }).finally(() => syncTicketLock(id));
    } }, field('Votre message', text, '4 000 caractères maximum.'), send);
    detail.append(form, reload);
    syncTicketLock(id);
  }

  function statusForm(ticket) {
    const transitions = TRANSITIONS[ticket.status] || [];
    if (!transitions.length) return null;
    const id = validId(ticket.id);
    const status = el('select', { id: `ticket-status-${id}`, name: 'status', required: true },
      el('option', { value: '' }, 'Choisir un nouveau statut'),
      transitions.map(value => el('option', { value }, STATUS_LABELS[value])));
    const statusNotice = el('div', { 'aria-live': 'polite' });
    const save = button('Mettre à jour le statut', { type: 'submit', className: 'button button-secondary' });
    save.disabled = pendingTickets.has(id) || uncertainTickets.has(id);
    const form = el('form', { className: 'stack', onSubmit: event => {
      event.preventDefault();
      if (!form.reportValidity() || save.disabled || pendingTickets.has(id) || uncertainTickets.has(id)
        || !transitions.includes(status.value)) return;
      const chosenStatus = status.value;
      if (chosenStatus === 'closed' && !window.confirm('Fermer définitivement ce ticket ? Aucun nouveau message ne pourra être ajouté.')) return;
      busy(save, async () => {
        pendingTickets.add(id);
        syncTicketLock(id);
        status.disabled = true;
        try {
          const data = await api(`/admin/tickets/${id}`, { method: 'PATCH', body: { status: chosenStatus } });
          if (!data?.ticket || validId(data.ticket.id) !== id || data.ticket.status !== chosenStatus) {
            throw new Error('La confirmation du statut est invalide. Actualisez le ticket avant de réessayer.');
          }
          if (selectedId === id) await selectTicket(id);
          notice(summaryNotice, `Le ticket #${id} est maintenant « ${STATUS_LABELS[chosenStatus]} ».`, 'success');
          await loadList();
        } catch (error) {
          if (uncertainMutation(error)) uncertainTickets.add(id);
          if (selectedId === id) notice(statusNotice, mutationError(error), 'error');
          else notice(summaryNotice, `Ticket #${id} : ${mutationError(error)}`, 'error');
        } finally {
          pendingTickets.delete(id);
          status.disabled = false;
        }
      }).finally(() => syncTicketLock(id));
    } }, el('h3', {}, 'Traitement administratif'), statusNotice, field('Nouveau statut', status), save);
    return form;
  }

  function mountCreateForm() {
    let creating = false;
    let createUncertain = false;
    let ordersLoading = false;
    const formNotice = el('div', { 'aria-live': 'polite' });
    const subject = el('input', { type: 'text', id: 'ticket-subject', name: 'subject', required: true, maxLength: 160 });
    const description = el('textarea', { id: 'ticket-description', name: 'description', required: true, maxLength: 4000, rows: 5 });
    const orderSelect = el('select', { id: 'ticket-order', name: 'order_id' }, el('option', { value: '' }, 'Sans commande liée'));
    const orderNotice = el('div', { 'aria-live': 'polite' });
    const save = button('Ouvrir le ticket', { type: 'submit', className: 'button button-primary' });
    const verifyCreation = button('Vérifier la liste avant un nouvel envoi', {
      className: 'button button-secondary', hidden: true, onClick: async event => {
        await busy(event.currentTarget, async () => {
          if (await loadList()) {
            createUncertain = false;
            verifyCreation.hidden = true;
            save.disabled = creating;
            notice(formNotice, 'Liste actualisée. Vérifiez qu’un ticket correspondant à votre demande n’existe pas déjà avant de renouveler l’envoi.', 'info');
          }
        });
      },
    });
    const form = el('form', { className: 'stack', onSubmit: event => {
      event.preventDefault();
      if (!form.reportValidity() || save.disabled || creating || createUncertain) return;
      const orderId = orderSelect.value ? validId(orderSelect.value) : null;
      if (!subject.value.trim() || !description.value.trim() || (orderSelect.value && !orderId)) {
        notice(formNotice, 'Renseignez un sujet et une description valides.', 'error');
        return;
      }
      busy(save, async () => {
        creating = true;
        subject.disabled = true;
        description.disabled = true;
        orderSelect.disabled = true;
        try {
          const data = await api('/tickets', { method: 'POST', body: {
            order_id: orderId, subject: subject.value.trim(), description: description.value.trim(), category: 'sav',
          } });
          const id = validId(data?.ticket?.id);
          if (!id) throw new Error('La confirmation du ticket est invalide. Actualisez la liste avant de réessayer.');
          form.reset();
          notice(formNotice, `Votre ticket #${id} a été enregistré.`, 'success');
          await loadList();
          await selectTicket(id, { updateUrl: true, focus: true });
        } catch (error) {
          if (uncertainMutation(error)) {
            createUncertain = true;
            verifyCreation.hidden = false;
          }
          notice(formNotice, mutationError(error), 'error');
        } finally {
          creating = false;
          subject.disabled = false;
          description.disabled = false;
          orderSelect.disabled = ordersLoading;
        }
      }).finally(() => { save.disabled = creating || createUncertain; });
    } }, formNotice, verifyCreation, field('Sujet', subject, '160 caractères maximum.'),
    field('Commande concernée (facultatif)', orderSelect), orderNotice,
    field('Décrivez votre demande', description, '4 000 caractères maximum.'), save);
    const disclosure = el('details', { className: 'panel', open: false }, el('summary', {}, 'Ouvrir une nouvelle demande SAV'), form);
    createRegion.replaceChildren(disclosure);
    let orderGeneration = 0;
    async function loadOrders() {
      const generation = ++orderGeneration;
      ordersLoading = true;
      orderSelect.disabled = true;
      try {
        const orders = items(await api('/orders/me'));
        if (generation !== orderGeneration) return;
        const previous = orderSelect.value;
        orderSelect.replaceChildren(el('option', { value: '' }, 'Sans commande liée'),
          ...orders.filter(order => validId(order.id)).map(order =>
            el('option', { value: String(order.id) }, `Commande #${order.id} · ${date(order.created_at)}`)));
        orderSelect.value = previous;
        if (orderSelect.selectedIndex < 0) orderSelect.value = '';
        orderNotice.replaceChildren();
      } catch (error) {
        if (generation !== orderGeneration) return;
        orderSelect.replaceChildren(el('option', { value: '' }, 'Sans commande liée'));
        orderNotice.replaceChildren(el('p', { className: 'muted' }, 'Les commandes ne peuvent pas être chargées. Vous pouvez ouvrir un ticket sans commande liée.'),
          button('Recharger mes commandes', { className: 'button button-secondary', onClick: () => loadOrders() }));
      } finally {
        if (generation === orderGeneration) {
          ordersLoading = false;
          orderSelect.disabled = creating;
        }
      }
    }
    loadOrders();
  }

  if (!admin) mountCreateForm();
  detail.replaceChildren(empty('Sélectionnez un ticket', 'Choisissez une demande pour lire la conversation et y répondre.'));
  if (initialId !== null) {
    const id = validId(initialId);
    if (id && /^\d+$/.test(initialId)) selectTicket(id);
    else notice(summaryNotice, 'Le numéro de ticket dans l’adresse est invalide.', 'error');
  }
  await loadList();

  // HTTP polling only when this page is visible and on-line. It never posts,
  // never retries uncertain mutations and keeps the user's text/status draft.
  async function refreshAutomatically() {
    if (polling || document.visibilityState !== 'visible' || !navigator.onLine
      || !root.isConnected || !user) return;
    polling = true;
    try {
      await loadList({ silent: true });
      await updateVisibleTicket();
    } catch {
      // Retain the last valid conversation when network/read errors occur.
      // Manual "Actualiser" is always available to show a readable error.
    } finally {
      polling = false;
    }
  }
  const timer = window.setInterval(() => { void refreshAutomatically(); }, AUTO_REFRESH_MS);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshAutomatically();
  });
}
