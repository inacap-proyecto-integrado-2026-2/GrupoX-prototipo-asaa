import { encryptPayload, decryptPayload } from './offlineCrypto.js';

const QUEUE_KEY_PREFIX = 'asaa_offline_queue_';
const CACHE_KEY_PREFIX = 'asaa_offline_cache_';
const CONFLICTS_KEY_PREFIX = 'asaa_offline_conflicts_';

function getStorageKey(prefix, userId) {
  return `${prefix}${userId || 'anon'}`;
}

/**
 * Retrieves and decrypts the pending offline mutation queue for a user.
 */
export async function getOfflineQueue(userId) {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(QUEUE_KEY_PREFIX, userId));
    if (!raw) return [];
    const envelope = JSON.parse(raw);
    const queue = await decryptPayload(envelope, userId);
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    console.error('Error al leer cola offline:', err);
    return [];
  }
}

/**
 * Appends a new mutation to the encrypted offline queue.
 */
export async function queueOfflineMutation(userId, { type, recordId, payload, baseRecord, closeAfter = false }) {
  if (!userId) throw new Error('Usuario requerido para encolar acción.');
  const queue = await getOfflineQueue(userId);

  const mutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, // 'create' | 'update' | 'close'
    recordId: recordId || `offline_${Date.now()}`,
    isTempId: !recordId || recordId.startsWith('offline_'),
    payload,
    baseRecord: baseRecord || null,
    closeAfter,
    queuedAt: new Date().toISOString(),
  };

  // If there's already an update for the same record in the queue, merge payload
  const existingIdx = queue.findIndex(m => m.recordId === mutation.recordId && m.type === mutation.type);
  if (existingIdx !== -1 && mutation.type === 'update') {
    queue[existingIdx] = {
      ...queue[existingIdx],
      payload: { ...queue[existingIdx].payload, ...mutation.payload },
      closeAfter: mutation.closeAfter || queue[existingIdx].closeAfter,
      queuedAt: new Date().toISOString(),
    };
  } else {
    queue.push(mutation);
  }

  const encrypted = await encryptPayload(queue, userId);
  window.localStorage.setItem(getStorageKey(QUEUE_KEY_PREFIX, userId), JSON.stringify(encrypted));

  // Also update local record cache immediately so UI reflects change offline
  await updateLocalCachedRecord(userId, mutation);

  return mutation;
}

/**
 * Removes a mutation from the offline queue by its id.
 */
export async function removeOfflineMutation(userId, mutationId) {
  if (!userId) return;
  const queue = await getOfflineQueue(userId);
  const filtered = queue.filter(m => m.id !== mutationId);
  const encrypted = await encryptPayload(filtered, userId);
  window.localStorage.setItem(getStorageKey(QUEUE_KEY_PREFIX, userId), JSON.stringify(encrypted));
}

/**
 * Retrieves cached records for offline reading.
 */
export async function getOfflineRecords(userId) {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(CACHE_KEY_PREFIX, userId));
    if (!raw) return [];
    const envelope = JSON.parse(raw);
    const records = await decryptPayload(envelope, userId);
    return Array.isArray(records) ? records : [];
  } catch (err) {
    console.error('Error al leer caché offline:', err);
    return [];
  }
}

/**
 * Caches server records in encrypted storage.
 */
export async function saveOfflineRecords(userId, records) {
  if (!userId || !Array.isArray(records)) return;
  try {
    const encrypted = await encryptPayload(records, userId);
    window.localStorage.setItem(getStorageKey(CACHE_KEY_PREFIX, userId), JSON.stringify(encrypted));
  } catch (err) {
    console.warn('No se pudo guardar la caché de registros:', err?.message);
  }
}

/**
 * Updates a single record in the local cache (e.g. while editing offline).
 */
export async function updateLocalCachedRecord(userId, mutation) {
  try {
    const records = await getOfflineRecords(userId);
    let target = records.find(r => r.id === mutation.recordId);

    if (mutation.type === 'create') {
      const newRec = {
        id: mutation.recordId,
        code: `ASAA-OFFLINE-${mutation.recordId.slice(-6).toUpperCase()}`,
        status: mutation.closeAfter ? 'closed' : 'open',
        ...mutation.payload,
        ownerUid: userId,
        offlinePending: true,
        offlineLastModified: mutation.queuedAt,
      };
      records.unshift(newRec);
    } else if (target) {
      Object.assign(target, mutation.payload, {
        status: mutation.closeAfter ? 'closed' : target.status,
        offlinePending: true,
        offlineLastModified: mutation.queuedAt,
      });
    }

    await saveOfflineRecords(userId, records);
  } catch (err) {
    console.warn('Error al actualizar registro local en caché:', err);
  }
}

/**
 * Conflict logs storage
 */
export async function getOfflineConflicts(userId) {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(CONFLICTS_KEY_PREFIX, userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOfflineConflict(userId, conflict) {
  try {
    const current = JSON.parse(window.localStorage.getItem(getStorageKey(CONFLICTS_KEY_PREFIX, userId)) || '[]');
    current.unshift({ id: `conf_${Date.now()}`, ...conflict, timestamp: new Date().toISOString() });
    window.localStorage.setItem(getStorageKey(CONFLICTS_KEY_PREFIX, userId), JSON.stringify(current.slice(0, 20)));
  } catch (e) {
    console.warn('Error guardando conflicto:', e);
  }
}

export function clearOfflineConflicts(userId) {
  window.localStorage.removeItem(getStorageKey(CONFLICTS_KEY_PREFIX, userId));
}
