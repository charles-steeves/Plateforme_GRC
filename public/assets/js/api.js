const BASE = '/api/v1';
let csrfToken = null;
let csrfPending = null;

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isUncertainMutation(error) {
  return !error.beforeMutation && (error.uncertain || !error.status
    || error.status < 400 || error.status >= 500 || error.code === 'INVALID_RESPONSE');
}

async function request(path, { method = 'GET', body, signal, token, passive = false } = {}) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new ApiError('Adresse de requête non autorisée.', 0, 'INVALID_PATH');
  }
  const url = new URL(BASE + path, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE}/`)) {
    throw new ApiError('Adresse de requête non autorisée.', 0, 'INVALID_PATH');
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    const headers = { Accept: 'application/json' };
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    if (token) headers['X-CSRF-Token'] = token;
    if (passive && method === 'GET') headers['X-GRC-Passive'] = '1';
    response = await fetch(url, {
      method, headers, credentials: 'same-origin', redirect: 'error',
      cache: 'no-store', signal: controller.signal,
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const jsonType = response.headers.get('content-type') || '';
    if (!jsonType.toLowerCase().includes('application/json')) {
      throw new ApiError('Le service a renvoyé une réponse inattendue. Vérifiez que le serveur API est démarré.', response.status, 'INVALID_RESPONSE');
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError('La réponse du service est illisible.', response.status, 'INVALID_RESPONSE'); }
    if (!response.ok || payload?.success !== true) {
      const fallback = {
        401: 'Votre session a expiré. Reconnectez-vous.',
        403: 'Cette action est refusée. Vérifiez vos droits ou actualisez la page.',
        409: 'Cette action est en conflit avec l’état actuel. Actualisez les données.',
        422: 'Vérifiez les informations saisies.',
        429: 'Trop de tentatives. Patientez avant de réessayer.',
      };
      const message = response.status >= 500
        ? 'Le service est temporairement indisponible.'
        : (typeof payload?.error?.message === 'string' ? payload.error.message : fallback[response.status] || 'La requête a échoué.');
      if (response.status === 401 && path !== '/auth/me' && path !== '/auth/login') {
        csrfToken = null;
        window.dispatchEvent(new CustomEvent('grc:unauthorized'));
      }
      if (response.status === 403) csrfToken = null;
      throw new ApiError(message, response.status, payload?.error?.code || 'API_ERROR');
    }
    if (!Object.hasOwn(payload, 'data')) throw new ApiError('La réponse du service est incomplète.', response.status, 'INVALID_RESPONSE');
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted
      ? 'Le serveur ne répond pas. Vérifiez votre connexion.'
      : 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function refreshCsrf() {
  if (!csrfPending) {
    csrfPending = request('/auth/csrf').then(data => {
      if (typeof data?.csrf_token !== 'string' || !data.csrf_token) throw new ApiError('Protection de session indisponible.', 0, 'INVALID_RESPONSE');
      csrfToken = data.csrf_token;
      return csrfToken;
    }).finally(() => { csrfPending = null; });
  }
  return csrfPending;
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw new ApiError('Méthode non autorisée.');
  let token = null;
  if (method !== 'GET') {
    try { token = csrfToken || await refreshCsrf(); }
    catch (error) {
      // No business request has been made yet. A CSRF/network failure here
      // must remain retryable rather than claim an order may already exist.
      const failure = new ApiError('Impossible de préparer la session. Aucune action n’a été envoyée. Réessayez après rétablissement du service.', error.status, error.code);
      failure.beforeMutation = true;
      throw failure;
    }
  }
  let data;
  try {
    data = await request(path, { ...options, method, token });
  } catch (error) {
    // A stale CSRF token is rejected before the server executes any mutation.
    // Refresh exactly once: do not replay requests after network/5xx errors.
    if (method !== 'GET' && error.code === 'CSRF_INVALID' && error.status === 403) {
      csrfToken = null;
      const freshToken = await refreshCsrf();
      data = await request(path, { ...options, method, token: freshToken });
    } else throw error;
  }
  if (path === '/auth/login' && method === 'POST') {
    csrfToken = null;
    // The login already succeeded. A transient token refresh failure must not
    // present it as a rejected login; the next mutation retries token retrieval.
    try { await refreshCsrf(); } catch { csrfToken = null; }
  }
  if (path === '/auth/logout' && method === 'POST') csrfToken = null;
  return data;
}

export async function currentUser() {
  try {
    const data = await api('/auth/me');
    if (!data?.user || !['client', 'admin'].includes(data.user.role)) throw new ApiError('Réponse de session invalide.', 0, 'INVALID_RESPONSE');
    return data.user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}
