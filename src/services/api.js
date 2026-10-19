import { auth } from '../lib/firebase.js';

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await auth?.currentUser?.getIdToken();
  const response = await fetch(`/api${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || 'No se pudo completar la solicitud.', response.status, payload.code);
  return payload;
}
