import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getOfflineQueue, getOfflineConflicts, clearOfflineConflicts } from './offlineStore.js';
import { syncOfflineQueue } from './syncEngine.js';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const { profile } = useAuth();
  const userId = profile?.uid;

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refreshStatus = useCallback(async () => {
    if (!userId) {
      setPendingCount(0);
      setConflicts([]);
      return;
    }
    const [queue, conflictList] = await Promise.all([
      getOfflineQueue(userId),
      getOfflineConflicts(userId),
    ]);
    setPendingCount(queue.length);
    setConflicts(conflictList);
  }, [userId]);

  const triggerSync = useCallback(async () => {
    if (!userId || isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue(userId);
      setLastSyncResult(result);
      await refreshStatus();
    } catch (err) {
      console.warn('Error durante sincronización offline:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isSyncing, isOnline, refreshStatus]);

  // Network event listeners
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      // Auto-sync when network returns!
      triggerSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  // Initial load and periodic check
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const dismissConflicts = useCallback(() => {
    if (userId) clearOfflineConflicts(userId);
    setConflicts([]);
  }, [userId]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        conflicts,
        lastSyncResult,
        triggerSync,
        refreshStatus,
        dismissConflicts,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline debe usarse dentro de un OfflineProvider');
  }
  return context;
}
