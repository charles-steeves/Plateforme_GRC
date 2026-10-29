/**
 * A stable request ID survives a lost HTTP response and a page reload.
 * Replaying the same operation retrieves the previously created record.
 * No credentials or message body are stored in browser storage.
 */
const memory = new Map();

function generateId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function requestId(kind, userId, payload) {
  const key = `grc-request-v1:${kind}:${userId}`;
  const content = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', content);
  const signature = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  let previous = memory.get(key);
  try {
    const saved = localStorage.getItem(key);
    if (saved) previous = JSON.parse(saved);
  } catch { /* Ephemeral fallback when local storage is disabled. */ }
  if (previous?.signature === signature && /^[A-Za-z0-9_-]{16,80}$/.test(previous?.id)) {
    return previous.id;
  }
  const next = { signature, id: generateId() };
  memory.set(key, next);
  try { localStorage.setItem(key, JSON.stringify(next)); }
  catch { /* In-memory operation remains safe within this page. */ }
  return next.id;
}

export function completeRequest(kind, userId) {
  const key = `grc-request-v1:${kind}:${userId}`;
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* No storage available. */ }
}
