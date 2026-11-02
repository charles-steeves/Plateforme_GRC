import { api, isUncertainMutation } from './api.js';
import { el, button, heading, notice, renderError, date } from './ui.js';
import { stars } from './reviews.js';

export async function mountAdminProductReviews(root) {
  const message = el('div', { 'aria-live': 'polite' });
  const list = el('div', { className: 'stack' });
  const refresh = button('Actualiser', { className: 'button button-secondary', onClick: () => load() });
  root.replaceChildren(heading('Avis sur les produits', 'Notes, commentaires et modération.'),
    el('div', { className: 'cluster' }, refresh), message, list);
  let updating = false;
  async function update(review, visible) {
    if (updating || !window.confirm(visible ? 'Afficher cet avis ?' : 'Masquer cet avis ?')) return;
    updating = true;
    try {
      const result = await api(`/admin/product-reviews/${review.id}`, {
        method: 'PATCH', body: { visible },
      });
      if (result?.review?.id !== review.id || result.review.visible !== visible) throw new Error('Résultat non confirmé.');
      await load();
      notice(message, visible ? 'Avis publié.' : 'Avis masqué.', 'success');
    } catch (error) {
      notice(message, isUncertainMutation(error)
        ? 'Résultat incertain. Actualisez les avis avant toute nouvelle action.'
        : error.message || 'Modification impossible.');
    } finally { updating = false; }
  }
  async function load() {
    refresh.disabled = true;
    try {
      const data = await api('/admin/product-reviews');
      if (!Array.isArray(data?.items)) throw new Error('Impossible de charger les avis.');
      list.replaceChildren(...(data.items.length
        ? data.items.map(item => el('article', { className: 'panel stack' },
          el('div', { className: 'cluster' },
            el('strong', {}, item.product_name),
            el('span', { className: 'stars' }, stars(item.rating)),
            el('span', { className: 'muted' }, item.visible ? 'Visible' : 'Masqué')),
          el('p', { className: 'muted' }, `${item.customer_name} · ${date(item.created_at)}`),
          el('p', {}, item.comment || 'Sans commentaire'),
          button(item.visible ? 'Masquer cet avis' : 'Afficher cet avis', {
            className: 'button button-secondary', onClick: () => update(item, !item.visible) })))
        : [el('p', { className: 'muted' }, 'Aucun avis produit pour le moment.')]));
    } catch (error) { renderError(list, error, load); }
    finally { refresh.disabled = false; }
  }
  await load();
}
