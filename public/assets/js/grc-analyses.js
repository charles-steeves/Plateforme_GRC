import { api } from './api.js';
import { el, button, field, heading, renderError } from './ui.js';
import { clientValue, surveyScore } from './grc-formulas.js';
import { mountGroupCalculations } from './grc-groups.js';

const number = value => value === null || value === undefined ? '—' :
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const money = value => value === null || value === undefined ? '—' : number(value) + ' FCFA';
const tile = (name, value) => el('article', { className: 'gi-tile' },
  el('span', {}, name), el('strong', {}, value));
const link = (name, url) => el('a', { className: 'gi-action', href: url }, name);
const section = (title) => el('section', { className: 'panel gi-section' }, el('h2', {}, title));
function table(headers, rows) {
  return el('div', { className: 'gi-scroll', tabIndex: 0 },
    el('table', { className: 'gi-table' },
      el('thead', {}, el('tr', {}, headers.map(h => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, rows.map(row =>
        el('tr', {}, row.map((cell, i) => el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}, cell)))))));
}
function barChart(items, currency = false) {
  const max = Math.max(1, ...items.map(x => x.value));
  return el('div', { className: 'gi-chart' }, items.map(x =>
    el('div', { className: 'gi-chart-row' },
      el('span', {}, x.label),
      el('progress', { value: String(x.value), max: String(max), 'aria-label': x.label + ' : ' + number(x.value) }),
      el('strong', {}, currency ? money(x.value) : number(x.value)))));
}
const management = () => el('section', { className: 'panel gi-section' },
  el('h2', {}, 'Gestion de la boutique'),
  el('div', { className: 'gi-actions' },
    link('Commandes', '/admin-orders.html'),
    link('Clients et fidélité', '/admin-customers.html'),
    link('Produits et stocks', '/admin-products.html'),
    link('Service client', '/admin-tickets.html'),
    link('Tableau de bord classique', '/admin.html')));

function overview(data) {
  const content = el('div', { className: 'gi-stack' });
  content.append(el('div', { className: 'gi-kpis' },
    tile('Chiffre d’affaires annuel', money(data.revenue)),
    tile('Achats livrés', number(data.orders)),
    tile('Clients acheteurs', number(data.buyers)),
    tile('Panier moyen', money(data.average_basket)),
    tile('Rétention', data.retention === null ? '—' : number(data.retention) + ' %'),
    tile('Tickets à traiter', number(data.pending_tickets)),
    tile('Satisfaction', data.satisfaction === null ? '—' : number(data.satisfaction) + ' / 5'),
    tile('Fréquence d’achat', number(data.purchase_frequency))));
  const monthly = section('Évolution du chiffre d’affaires');
  monthly.append(barChart(data.monthly.map(x => ({ label: x.month, value: x.revenue })), true));
  const segments = section('Répartition RFM');
  segments.append(barChart(Object.entries(data.segments).map(([label, value]) => ({ label, value }))));
  content.append(el('div', { className: 'gi-columns' }, monthly, segments), management());
  return content;
}

function rfm(data) {
  const block = section('Segmentation des clients');
  block.append(table(['Client', 'Récence', 'Achats', 'CA', 'Score', 'Segment'],
    data.rfm.map(row => [
      row.name, row.days === null ? 'Aucun achat' : row.days + ' j',
      number(row.frequency), money(row.amount), row.score + '/15', row.segment
    ])));
  block.append(el('p', { className: 'gi-footnote' },
    'R = récence · F = fréquence · M = montant. Scores de 1 à 5 par critère.'));
  return el('div', { className: 'gi-stack' }, block, management());
}

function calculations(data) {
  const root = el('div', { className: 'gi-stack' });
  const block = section('Valeur client — CLV');
  const form = el('form', { className: 'gi-controls' });
  const specs = [
    ['Rétention (%)', data.retention ?? 80, 0, 99.9],
    ['Marge (%)', 30, 0, 100],
    ['Coût d’acquisition (FCFA)', 10000, 0, 1e12],
    ['Actualisation (%)', 0, 0, 100]
  ];
  const controls = specs.map(([label, value, min, max], i) => {
    const input = el('input', {
      id: 'gi-formula-' + i, type: 'number', value: String(value),
      step: 'any', min: String(min), max: String(max), required: true
    });
    form.append(field(label, input)); return input;
  });
  const results = el('div', { className: 'gi-kpis' });
  const error = el('p', { className: 'gi-error', role: 'alert' });
  const calculate = () => {
    if (!form.reportValidity()) return;
    try {
      const val = clientValue(data.annual_value, ...controls.map(x => Number(x.value)));
      results.replaceChildren(tile('CA annuel par client', money(data.annual_value)),
        tile('Durée estimée', number(val.duration) + ' ans'),
        tile('Valeur brute', money(val.gross)),
        tile('CLV nette estimée', money(val.net)));
      error.textContent = '';
    } catch (e) { error.textContent = e.message; }
  };
  form.append(button('Calculer', { type: 'submit' }));
  form.addEventListener('submit', e => { e.preventDefault(); calculate(); });
  block.append(el('p', { className: 'muted' }, 'Simulation à partir des achats enregistrés et des paramètres saisis.'),
    form, error, results);
  calculate();

  const formulas = section('Formules utilisées');
  formulas.append(table(['Indicateur', 'Formule'],
    [['Panier moyen', 'CA / nombre d’achats'],
      ['Fréquence', 'Nombre d’achats / clients acheteurs'],
      ['CA annuel / client', 'CA annuel / clients acheteurs'],
      ['Durée de vie', '1 / (1 − rétention)'],
      ['CLV nette', '(CA annuel/client × marge) / (1 + actualisation − rétention) − acquisition']]));
  root.append(block, formulas);
  return root;
}

function surveys(data) {
  const area = el('div', { className: 'gi-stack' });
  const stored = section('Avis enregistrés');
  stored.append(el('div', { className: 'gi-kpis' },
    tile('Avis de commandes', number(data.feedback_count)),
    tile('Satisfaction moyenne', data.satisfaction === null ? '—' : number(data.satisfaction) + ' / 5')));
  const block = section('Simulation d’enquêtes');
  const form = el('form', { className: 'gi-controls' });
  const rating = el('select', { id: 'gi-rating', required: true },
    [1,2,3,4,5].map(n => el('option', { value: String(n), selected: n === 4 }, n + ' / 5')));
  const recommendation = el('select', { id: 'gi-recommendation', required: true },
    Array.from({ length: 11 }, (_, n) => el('option', { value: String(n), selected: n === 8 }, n + ' / 10')));
  form.append(field('Satisfaction', rating), field('Recommandation', recommendation),
    button('Ajouter une réponse', { type: 'submit' }));
  const rows = [];
  const output = el('div', { className: 'gi-kpis' });
  const clear = button('Effacer la simulation', { className: 'button button-secondary' });
  const refresh = () => {
    const s = surveyScore(rows);
    output.replaceChildren(tile('Réponses', number(s?.count ?? 0)),
      tile('Note moyenne', s ? number(s.average) + ' / 5' : '—'),
      tile('Satisfaction', s ? number(s.satisfaction) + ' %' : '—'),
      tile('NPS', s ? number(s.nps) : '—'));
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity() || rows.length >= 200) return;
    rows.push({ rating: Number(rating.value), recommendation: Number(recommendation.value) });
    refresh();
  });
  clear.addEventListener('click', () => { rows.length = 0; refresh(); });
  refresh();
  block.append(el('p', { className: 'muted' }, 'Réponses fictives : aucun enregistrement dans la base.'),
    form, output, clear);
  area.append(stored, block, management());
  return area;
}

export async function mountGrcInsights(root) {
  const content = el('div', { className: 'gi-stack' });
  const tabs = el('nav', { className: 'gi-tabs', 'aria-label': 'Navigation des analyses' });
  const note = el('p', { className: 'gi-period muted' });
  const refresh = button('Actualiser', { className: 'button button-secondary' });
  const views = { overview, rfm, calculations, groups: mountGroupCalculations, surveys };
  const labels = [
    ['overview', 'Indicateurs'], ['rfm', 'Segmentation RFM'],
    ['calculations', 'CLV & formules'], ['groups', 'Calculs par groupe'], ['surveys', 'Enquêtes']
  ];
  let active = 'overview';
  let data = null;
  const tabButtons = new Map();
  const paint = () => {
    if (!data) return;
    for (const [key, element] of tabButtons) {
      element.setAttribute('aria-pressed', String(key === active));
      element.classList.toggle('gi-active', key === active);
    }
    content.replaceChildren(views[active](data));
  };
  for (const [key, label] of labels) {
    const control = button(label, { className: 'gi-tab', onClick: () => { active = key; paint(); } });
    tabs.append(control); tabButtons.set(key, control);
  }
  root.replaceChildren(heading('Analyses GRC', 'Indicateurs, clients et calculs de fidélisation.'),
    el('div', { className: 'gi-top' }, tabs, refresh), note, content);
  async function load(automatic = false) {
    if (refresh.disabled) return;
    refresh.disabled = true;
    try {
      const result = await api('/admin/insights', automatic ? { passive: true } : {});
      if (!Array.isArray(result.monthly) || !Array.isArray(result.rfm)) throw new Error('Indicateurs incomplets.');
      data = result;
      note.textContent = 'Du ' + result.period.from + ' au ' + result.period.to + '.';
      if (!automatic || active === 'overview' || active === 'rfm') paint();
    } catch (error) {
      if (!automatic) renderError(content, error, () => load());
    } finally { refresh.disabled = false; }
  }
  refresh.addEventListener('click', () => void load());
  await load();
  const timer = window.setInterval(() => {
    if (root.isConnected && !refresh.disabled && document.visibilityState === 'visible' &&
        navigator.onLine && (active === 'overview' || active === 'rfm')) void load(true);
  }, 5000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
