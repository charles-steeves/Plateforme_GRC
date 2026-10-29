import { api } from './api.js';
import { el, date, notice, field, button, heading, empty, renderError, busy, orderCard } from './ui.js';

const CLIENT_DESTINATIONS = new Set(['/', '/index.html', '/product.html', '/cart.html', '/account.html', '/tickets.html']);
const ADMIN_DESTINATIONS = new Set(['/admin.html', '/admin-products.html', '/admin-orders.html', '/admin-customers.html', '/admin-tickets.html']);

function safeNext() {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next) return null;
    try {
        const url = new URL(next, window.location.origin);
        if (url.origin !== window.location.origin || url.username || url.password) return null;
        if (!CLIENT_DESTINATIONS.has(url.pathname) && !ADMIN_DESTINATIONS.has(url.pathname)) return null;
        return url.pathname + url.search;
    } catch {
        return null;
    }
}

function authLink(page) {
    const next = safeNext();
    return `/${page}.html${next ? `?${new URLSearchParams({ next })}` : ''}`;
}

function destination(user) {
    const fallback = user.role === 'admin' ? '/admin.html' : '/account.html';
    const next = safeNext();
    if (!next) return fallback;
    const url = new URL(next, window.location.origin);
    return CLIENT_DESTINATIONS.has(url.pathname) || (user.role === 'admin' && ADMIN_DESTINATIONS.has(url.pathname)) ? next : fallback;
}

function disableFields(controls) {
    const previous = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    return () => controls.forEach((control, index) => { control.disabled = previous[index]; });
}

function feedbackForm(order) {
    const message = el('div', { 'aria-live': 'polite', tabindex: '-1' });
    const rating = el('select', { id: `rating-${order.id}`, name: 'rating', required: true },
        el('option', { value: '' }, 'Choisir une note'),
        [5, 4, 3, 2, 1].map(value => el('option', { value: String(value) }, `${value} / 5`)));
    const comment = el('textarea', { id: `comment-${order.id}`, name: 'comment', maxLength: 1500, rows: 3 });
    const submit = button('Envoyer mon avis', { type: 'submit', className: 'button button-primary' });
    const form = el('form', { className: 'stack' },
        field('Votre satisfaction', rating),
        field('Commentaire facultatif', comment, '1 500 caractères maximum.'),
        message, submit);
    const details = el('details', { className: 'feedback-section' },
        el('summary', {}, 'Évaluer cette commande livrée'),
        el('p', { className: 'muted' }, 'Un seul avis est accepté par commande. Le serveur vérifie la livraison et la propriété de la commande.'),
        form);
    let pending = false;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending || submit.disabled) return;
        if (!form.reportValidity()) return;
        const value = Number(rating.value);
        if (!Number.isInteger(value) || value < 1 || value > 5) return;
        await busy(submit, async () => {
            pending = true;
            const restore = disableFields([rating, comment]);
            form.setAttribute('aria-busy', 'true');
            try {
                const data = await api('/feedback', { method: 'POST', body: { order_id: order.id, rating: value, comment: comment.value } });
                if (!data.feedback || data.feedback.order_id !== order.id) throw new Error('La réponse du serveur ne confirme pas cet avis. Rechargez vos commandes avant de réessayer.');
                form.replaceChildren(el('p', { role: 'status', className: 'notice notice-success' }, 'Merci, votre avis a été enregistré.'));
            } catch (error) {
                if (error.status === 409) {
                    notice(message, 'L’avis ne peut pas être ajouté. Un avis existe peut-être déjà pour cette commande. Aucun nouvel avis n’a été confirmé.', 'info');
                    message.focus();
                    return;
                }
                notice(message, error.message || 'Impossible d’enregistrer votre avis.');
                message.focus();
            } finally {
                restore();
                pending = false;
                form.setAttribute('aria-busy', 'false');
            }
        });
    });
    return details;
}

async function renderOrders(root) {
    root.replaceChildren(el('p', { role: 'status' }, 'Chargement de vos commandes…'));
    root.setAttribute('aria-busy', 'true');
    try {
        const data = await api('/orders/me');
        if (!Array.isArray(data.items)) throw new Error('Le serveur a renvoyé une liste de commandes invalide.');
        if (!root.isConnected) return;
        root.replaceChildren(el('div', { className: 'cluster' }, el('h2', {}, 'Mes commandes'), button('Actualiser les commandes', { onClick: () => renderOrders(root), className: 'button button-secondary' })));
        if (!data.items.length) {
            root.append(empty('Votre histoire commence ici', 'Aucune commande enregistrée pour le moment.'), el('a', { href: '/', className: 'button button-primary' }, 'Découvrir la boutique'));
            return;
        }
        const orders = el('div', { className: 'stack' });
        for (const order of data.items) {
            const card = orderCard(order);
            if (order.status === 'delivered') card.append(feedbackForm(order));
            orders.append(card);
        }
        root.append(orders);
    } catch (error) {
        if (root.isConnected) renderError(root, error, () => renderOrders(root));
    } finally {
        root.setAttribute('aria-busy', 'false');
    }
}

async function renderLoyalty(root) {
    root.replaceChildren(el('p', { role: 'status' }, 'Chargement de votre fidélité…'));
    root.setAttribute('aria-busy', 'true');
    try {
        const data = await api('/loyalty/me');
        if (!Number.isSafeInteger(data.balance) || !Array.isArray(data.transactions)) throw new Error('Le serveur a renvoyé des données de fidélité invalides.');
        if (!root.isConnected) return;
        root.replaceChildren(
            el('div', { className: 'cluster' }, el('h2', {}, 'Ma fidélité'), button('Actualiser les points', { className: 'button button-secondary', onClick: () => renderLoyalty(root) })),
            el('p', { className: 'eyebrow' }, 'Solde confirmé par le serveur'),
            el('p', { className: 'price' }, `${data.balance.toLocaleString('fr-FR')} points`),
            el('p', { className: 'muted' }, 'Gagnez 1 point de fidélité par tranche de 1 000 FCFA sur vos commandes livrées.'));
        if (!data.transactions.length) {
            root.append(empty('Aucun mouvement pour le moment', 'Votre historique de points apparaîtra après une commande livrée.'));
            return;
        }
        const list = el('ul', { className: 'loyalty-list stack' });
        for (const transaction of data.transactions) {
            const delta = Number.isSafeInteger(transaction.points_delta) ? `${transaction.points_delta > 0 ? '+' : ''}${transaction.points_delta}` : '—';
            list.append(el('li', {}, el('div', { className: 'cluster' },
                el('strong', {}, `${delta} points`),
                el('time', { datetime: transaction.created_at }, date(transaction.created_at))),
            el('p', { className: 'muted' }, transaction.reason === 'delivery_credit' ? `Livraison de la commande n° ${transaction.order_id}` : String(transaction.reason))));
        }
        root.append(el('h3', {}, 'Historique des mouvements'), list);
    } catch (error) {
        if (root.isConnected) renderError(root, error, () => renderLoyalty(root));
    } finally {
        root.setAttribute('aria-busy', 'false');
    }
}

async function account(root, user) {
    if (!user || user.role !== 'client') {
        root.replaceChildren(heading('Mon espace client', 'Connectez-vous avec un compte client pour consulter vos données.'), el('a', { href: '/login.html?next=%2Faccount.html', className: 'button button-primary' }, 'Se connecter'));
        return;
    }
    const orders = el('section', { id: 'mes-commandes', className: 'stack', 'aria-label': 'Mes commandes' });
    const loyalty = el('section', { id: 'ma-fidelite', className: 'panel stack', 'aria-label': 'Mes points de fidélité' });
    root.replaceChildren(
        heading('Bonjour, ' + user.name, 'Suivez vos commandes, vos points et vos demandes au même endroit.'),
        el('section', { className: 'panel stack', 'aria-label': 'Mon profil' },
            el('div', { className: 'cluster' }, el('div', {}, el('p', { className: 'eyebrow' }, 'Votre compte client'), el('h2', {}, 'Mon profil')),
                el('a', { href: '/tickets.html', className: 'button button-secondary' }, 'Contacter le SAV')),
            el('dl', { className: 'profile-grid' }, el('div', {}, el('dt', {}, 'Nom'), el('dd', {}, user.name)), el('div', {}, el('dt', {}, 'Adresse e-mail'), el('dd', {}, user.email))),
            el('p', { className: 'muted' }, 'Ces informations sont consultables ici. La modification du profil ne fait pas partie de cette version.')),
        el('div', { className: 'split account-layout' }, orders, loyalty));
    await Promise.allSettled([renderOrders(orders), renderLoyalty(loyalty)]);
}

async function auth(root, page, user) {
    const register = page === 'register';
    if (user) {
        root.replaceChildren(heading('Vous êtes déjà connecté', `Session active : ${user.name}.`), el('a', { href: destination(user), className: 'button button-primary' }, 'Continuer avec ce compte'));
        return;
    }
    const message = el('div', { 'aria-live': 'polite', tabindex: '-1' });
    const name = el('input', { id: 'auth-name', name: 'name', type: 'text', autocomplete: 'name', required: true, maxLength: 120 });
    const email = el('input', { id: 'auth-email', name: 'email', type: 'email', autocomplete: 'username', required: true, maxLength: 254, spellcheck: 'false', autocapitalize: 'none' });
    const password = el('input', { id: 'auth-password', name: 'password', type: 'password', autocomplete: register ? 'new-password' : 'current-password', required: true, ...(register ? { minLength: 12 } : {}) });
    function validatePassword() {
        const value = password.value;
        const tooShort = register && Array.from(value).length < 12;
        const tooLong = new TextEncoder().encode(value).length > 72;
        password.setCustomValidity(value && (tooShort || tooLong || value.includes('\0'))
            ? (register ? 'Utilisez au moins 12 caractères et choisissez un mot de passe moins long.' : 'Ce mot de passe est trop long ou contient un caractère non autorisé.')
            : '');
    }
    password.addEventListener('input', validatePassword);
    const reveal = button('Afficher le mot de passe', { className: 'button button-secondary', type: 'button', 'aria-pressed': 'false', onClick: () => {
        const visible = password.type === 'password';
        password.type = visible ? 'text' : 'password';
        reveal.textContent = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
        reveal.setAttribute('aria-pressed', String(visible));
    } });
    const submit = button(register ? 'Créer mon compte' : 'Se connecter', { type: 'submit', className: 'button button-primary' });
    const form = el('form', { className: 'panel stack auth-form' },
        el('h2', {}, register ? 'Bienvenue dans la boutique' : 'Retrouvons-nous'),
        register ? field('Nom complet', name) : null,
        field('Adresse e-mail', email),
        field('Mot de passe', password, register ? '12 caractères minimum.' : ''),
        reveal, message, submit);
    if (!register && new URLSearchParams(window.location.search).get('logged_out') === '1') {
        notice(message, 'Vous êtes déconnecté. Votre session a été fermée.', 'success');
    }
    root.replaceChildren(heading(register ? 'Créer un compte' : 'Connexion', register ? 'Rejoignez-nous et suivez vos commandes.' : 'Accédez à votre espace personnel.'),
        el('div', { className: 'auth-layout' }, form,
            el('aside', { className: 'panel stack' }, el('p', { className: 'eyebrow' }, 'Une relation qui compte'),
                el('h2', {}, register ? 'Bien plus qu’un panier' : 'Votre espace, vos échanges'),
                el('p', {}, 'Suivez vos commandes, retrouvez vos points de fidélité et échangez avec notre service après-vente.'),
                el('a', { href: authLink(register ? 'login' : 'register') }, register ? 'J’ai déjà un compte' : 'Créer un compte client'))));
    let pending = false;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending || submit.disabled) return;
        validatePassword();
        if (!form.reportValidity()) return;
        if (register && !name.value.trim()) {
            name.setCustomValidity('Saisissez votre nom.');
            name.reportValidity();
            name.addEventListener('input', () => name.setCustomValidity(''), { once: true });
            return;
        }
        await busy(submit, async () => {
            pending = true;
            const restore = disableFields([name, email, password, reveal]);
            form.setAttribute('aria-busy', 'true');
            try {
                const body = { email: email.value.trim(), password: password.value };
                if (register) body.name = name.value.trim();
                const data = await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body });
                if (!data.user || !Number.isSafeInteger(data.user.id) || !['client', 'admin'].includes(data.user.role) || (register && data.user.role !== 'client')) throw new Error('Le serveur n’a pas confirmé le compte attendu. Vérifiez votre session avant de réessayer.');
                password.value = '';
                if (register) {
                    form.replaceChildren(el('h2', {}, 'Votre compte est créé'),
                        el('p', { role: 'status', className: 'notice notice-success' }, 'Le serveur a confirmé la création de votre compte client. Connectez-vous pour poursuivre.'),
                        el('a', { href: authLink('login'), className: 'button button-primary' }, 'Se connecter'));
                } else {
                    window.location.assign(destination(data.user));
                }
            } catch (error) {
                notice(message, error.status === 429 ? 'Trop de tentatives de connexion. Patientez avant de réessayer.' : (error.message || 'Le service est indisponible. Aucun succès n’a été confirmé.'));
                message.focus();
            } finally {
                restore();
                pending = false;
                form.setAttribute('aria-busy', 'false');
            }
        });
    });
}

export async function mountCustomer(root, { page, user }) {
    if (page === 'account') return account(root, user);
    if (page === 'login' || page === 'register') return auth(root, page, user);
    throw new Error('Page client inconnue.');
}
