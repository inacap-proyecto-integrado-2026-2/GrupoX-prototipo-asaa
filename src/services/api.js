import { auth } from '../lib/firebase.js';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await auth?.currentUser?.getIdToken();
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (err) {
    throw new ApiError(
      'Sin conexión con el servidor. Operación en modo taller.',
      0,
      'network_offline'
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status >= 500) {
    throw new ApiError(
      payload.error || 'El servidor no está disponible. Vuelve a intentarlo en unos momentos.',
      response.status,
      payload.code
    );
  }
  if (!response.ok) {
    throw new ApiError(payload.error || 'No se pudo completar la solicitud.', response.status, payload.code);
  }
  return payload;
}

export async function apiDownload(path, { defaultFilename = 'documento.pdf', headers = {} } = {}) {
  const token = await auth?.currentUser?.getIdToken();
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new ApiError(
      'No hay conexión con el servidor para descargar el archivo. Conéctate a internet para obtener el PDF oficial.',
      0,
      'network_offline'
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || 'No se pudo descargar el archivo oficial.', response.status, payload.code);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : defaultFilename;

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return { filename, size: blob.size };
}
