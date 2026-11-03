import { api, isUncertainMutation } from './api.js';
import { el, button, field, notice, renderError, date } from './ui.js';

export function ratingText(average, count) {
  if (!Number.isFinite(average) || !Number.isSafeInteger(count) || count < 1) return 'Pas encore d’avis';
  return `★ ${new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1}).format(average)} / 5 · ${count} avis`;
}
export const stars = n => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));

export async function mountProductReviews(root, productId, user) {
  const section = el('section', { className: 'panel stack product-reviews' },
    el('h2', {}, 'Notes et avis sur ce produit'));
  const summary = el('p', { className: 'product-rating', 'aria-live': 'polite' }, 'Chargement des avis…');
  const list = el('div', { className: 'stack' });
  const formRegion = el('div');
  section.append(summary, formRegion, list);
  root.append(section);
  async function load() {
    try {
      const data = await api(`/products/${productId}/reviews`);
      if (!section.isConnected) return;
      if (!Array.isArray(data?.items) || !Number.isSafeInteger(data?.rating_count)) throw new Error('Avis indisponibles.');
      summary.textContent = ratingText(data.rating_average, data.rating_count);
      list.replaceChildren(...(data.items.length
        ? data.items.map(review => el('article', { className: 'product-review stack' },
          el('div', { className: 'cluster' },
            el('strong', {}, review.author),
            el('span', { className: 'stars', 'aria-label': `${review.rating} sur 5` }, stars(review.rating)),
            review.verified_purchase ? el('span', { className: 'badge' }, 'Achat vérifié') : null),
          review.comment ? el('p', {}, review.comment) : null,
          el('small', { className: 'muted' }, date(review.created_at))))
        : [el('p', { className: 'muted' }, 'Aucun avis pour le moment.')]));
    } catch (error) { if (section.isConnected) renderError(list, error, load); }
  }
  if (user?.role === 'client') {
    const starOptions = [];
    const starsInput = el('fieldset', { className: 'review-stars-picker', 'aria-describedby': 'product-rating-help' },
      el('legend', {}, 'Note du produit'),
      el('p', { id: 'product-rating-help', className: 'muted review-stars-help' },
        'Sélectionnez directement de une à cinq étoiles.'));
    const starRow = el('div', { className: 'review-stars-row' });
    for (let n = 1; n <= 5; n++) {
      const radio = el('input', { id: 'product-review-rating-' + n, name: 'rating', type: 'radio',
        value: String(n), required: n === 1, 'aria-label': n + ' étoile' + (n > 1 ? 's' : '') + ' sur 5' });
      const option = el('label', { className: 'review-star-option', 'data-selected': 'false' },
        radio, el('span', { 'aria-hidden': 'true' }, '★'));
      starOptions.push({radio, option, n});
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        for (const item of starOptions) item.option.dataset.selected = String(item.n <= n);
      });
      starRow.append(option);
    }
    starsInput.append(starRow);
    const comment = el('textarea', { id: 'product-review-comment', name: 'comment', rows: 4,
      maxLength: 1500, placeholder: 'Votre expérience avec ce produit (facultatif)' });
    const message = el('div', { 'aria-live': 'polite' });
    const submit = button('Publier mon avis', { type: 'submit', className: 'button button-primary' });
    const form = el('form', { className: 'stack' },
      starsInput, field('Commentaire', comment), message, submit);
    let uncertain = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled || uncertain || !form.reportValidity()) return;
      const value = Number(starOptions.find(item => item.radio.checked)?.radio.value || 0);
      if (!Number.isInteger(value) || value < 1 || value > 5) return;
      submit.disabled = true;
      try {
        const result = await api(`/products/${productId}/reviews`, {method: 'POST',
          body: {rating: value, comment: comment.value.trim()}});
        if (result?.review?.product_id !== productId || result.review.rating !== value) throw new Error('Enregistrement non confirmé.');
        formRegion.replaceChildren(el('p', { className: 'notice notice-success' }, 'Votre avis a été publié.'));
        await load();
      } catch (error) {
        uncertain = isUncertainMutation(error);
        notice(message, uncertain ? 'Vérifiez les avis après actualisation avant de renouveler votre envoi.'
          : error.message || 'Impossible de publier cet avis.');
      } finally { submit.disabled = uncertain; }
    });
    formRegion.replaceChildren(el('h3', {}, 'Donner mon avis'), form);
  } else if (!user) {
    formRegion.append(el('p', {}, 'Connectez-vous pour noter ce produit.'),
      el('a', { className: 'button button-secondary',
        href: `/login.html?next=${encodeURIComponent('/product.html?id=' + productId)}` }, 'Se connecter'));
  }
  await load();
}
