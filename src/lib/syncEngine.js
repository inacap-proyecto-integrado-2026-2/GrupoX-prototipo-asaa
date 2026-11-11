import { api } from '../services/api.js';
import {
  getOfflineQueue,
  removeOfflineMutation,
  saveOfflineRecords,
  getOfflineRecords,
  saveOfflineConflict,
} from './offlineStore.js';

/**
 * Resolves 3-way conflicts between base record, remote server record, and local offline changes.
 */
function resolveRecordConflict(base, remote, local) {
  const merged = { ...remote };
  const conflictingFields = [];

  for (const key of Object.keys(local)) {
    const baseVal = base ? base[key] : undefined;
    const remoteVal = remote[key];
    const localVal = local[key];

    // Case 1: Remote did not change this field -> accept local change
    if (JSON.stringify(baseVal) === JSON.stringify(remoteVal)) {
      merged[key] = localVal;
      continue;
    }

    // Case 2: Remote and local made identical changes
    if (JSON.stringify(remoteVal) === JSON.stringify(localVal)) {
      merged[key] = localVal;
      continue;
    }

    // Case 3: Both changed concurrently (True Conflict)
    conflictingFields.push(key);

    // Smart merge for attendance array
    if (key === 'attendance' && Array.isArray(remoteVal) && Array.isArray(localVal)) {
      const attendanceMap = new Map();
      remoteVal.forEach(p => p.name && attendanceMap.set(p.name, p));
      // Local changes in workshop take precedence for student presence/times
      localVal.forEach(p => {
        if (!p.name) return;
        const existing = attendanceMap.get(p.name);
        if (!existing || p.state !== 'Pendiente') {
          attendanceMap.set(p.name, p);
        }
      });
      merged.attendance = Array.from(attendanceMap.values());
      continue;
    }

    // Smart merge for stages
    if (key === 'stages' && Array.isArray(remoteVal) && Array.isArray(localVal)) {
      merged.stages = localVal.length >= remoteVal.length ? localVal : remoteVal;
      continue;
    }

    // Default: local workshop data is retained as the authoritative frontline record
    merged[key] = localVal;
  }

  return { merged, conflictingFields };
}

/**
 * Executes a full synchronization of the encrypted offline mutation queue.
 * @param {string} userId - Current authenticated user ID
 * @returns {Promise<{ success: boolean, syncedCount: number, conflicts: Array }>}
 */
export async function syncOfflineQueue(userId) {
  if (!userId) return { success: false, syncedCount: 0, conflicts: [] };

  const queue = await getOfflineQueue(userId);
  if (!queue.length) return { success: true, syncedCount: 0, conflicts: [] };

  let syncedCount = 0;
  const conflictsDetected = [];

  for (const item of queue) {
    try {
      if (item.type === 'create') {
        // Create new record on server
        const res = await api('/records', { method: 'POST', body: item.payload });
        const newRecord = res.record;

        if (item.closeAfter && newRecord?.id) {
          await api(`/records/${newRecord.id}/close`, { method: 'POST', body: {} });
        }

        // Clean up from queue
        await removeOfflineMutation(userId, item.id);
        syncedCount++;
      } else if (item.type === 'update') {
        // Fetch current remote version to test for concurrency/conflicts
        let remote;
        try {
          const remoteRes = await api(`/records/${item.recordId}`);
          remote = remoteRes.record;
        } catch (fetchErr) {
          if (fetchErr.status === 404) {
            saveOfflineConflict(userId, {
              recordId: item.recordId,
              action: 'Ficha eliminada o inaccesible en el servidor',
              details: 'La ficha que se editó localmente ya no existe en el sistema.',
              localDraft: item.payload,
            });
            await removeOfflineMutation(userId, item.id);
            continue;
          }
          throw fetchErr; // Re-throw network or other server errors to halt sync
        }

        // Conflict check: record was closed on server while client was offline
        if (remote.status === 'closed' && (!item.baseRecord || item.baseRecord.status !== 'closed')) {
          const conflict = {
            recordId: item.recordId,
            code: remote.code || item.recordId,
            action: 'Ficha cerrada en el servidor',
            details: 'La ficha fue cerrada en el servidor mientras estabas en modo sin conexión. Tus cambios locales se respaldaron de forma segura.',
            localDraft: item.payload,
          };
          saveOfflineConflict(userId, conflict);
          conflictsDetected.push(conflict);
          await removeOfflineMutation(userId, item.id);
          continue;
        }

        // Conflict check: concurrent modification
        const { merged, conflictingFields } = resolveRecordConflict(
          item.baseRecord,
          remote,
          item.payload
        );

        if (conflictingFields.length > 0) {
          saveOfflineConflict(userId, {
            recordId: item.recordId,
            code: remote.code || item.recordId,
            action: 'Conflicto de concurrencia resuelto automáticamente',
            details: `Se detectaron cambios simultáneos en: ${conflictingFields.join(', ')}. Se integraron los datos registrados en taller.`,
            mergedFields: conflictingFields,
          });
        }

        // Send resolved updates
        await api(`/records/${item.recordId}`, { method: 'PATCH', body: merged });

        if (item.closeAfter) {
          await api(`/records/${item.recordId}/close`, { method: 'POST', body: {} });
        }

        await removeOfflineMutation(userId, item.id);
        syncedCount++;
      } else if (item.type === 'close') {
        try {
          await api(`/records/${item.recordId}/close`, { method: 'POST', body: {} });
        } catch (closeErr) {
          // If already closed, consider synced
          if (closeErr.status !== 409) throw closeErr;
        }
        await removeOfflineMutation(userId, item.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Error al sincronizar elemento ${item.id}:`, err?.message);
      // If network dropped mid-sync, exit loop to retry later
      if (err.code === 'network_offline') {
        return { success: false, syncedCount, conflicts: conflictsDetected, pausedByNetwork: true };
      }
    }
  }

  // Refresh local cache with latest server list after syncing
  try {
    const listRes = await api('/records');
    if (listRes?.records) {
      await saveOfflineRecords(userId, listRes.records);
    }
  } catch (e) {
    console.warn('No se pudo refrescar la lista luego de sincronizar:', e?.message);
  }

  return { success: true, syncedCount, conflicts: conflictsDetected };
}
