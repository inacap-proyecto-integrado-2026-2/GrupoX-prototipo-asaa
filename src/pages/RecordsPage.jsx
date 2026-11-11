import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useOffline } from '../lib/OfflineContext.jsx';
import { getOfflineRecords, saveOfflineRecords } from '../lib/offlineStore.js';
import { ErrorState, LoadingScreen, PageTitle, EmptyState } from '../components/Feedback.jsx';
import RecordRow from '../components/RecordRow.jsx';
import { api } from '../services/api.js';

export default function RecordsPage() {
  const { profile } = useAuth();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOffline();
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFromCache, setIsFromCache] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setIsFromCache(false);

    try {
      const res = await api('/records');
      setRecords(res.records || []);
      if (profile?.uid) {
        await saveOfflineRecords(profile.uid, res.records || []);
      }
    } catch (e) {
      if (e.code === 'network_offline' || !navigator.onLine) {
        const cached = await getOfflineRecords(profile?.uid);
        if (cached && cached.length) {
          setRecords(cached);
          setIsFromCache(true);
          return;
        }
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      records.filter(r =>
        `${r.code || ''} ${r.activity || ''} ${r.section || ''} ${r.place || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [records, query]
  );

  if (loading) return <LoadingScreen />;
  if (error && !records.length) return <ErrorState error={error} onRetry={load} />;

  return (
    <>
      <PageTitle
        eyebrow="REGISTROS"
        title="Fichas ASAA"
        subtitle={
          isFromCache
            ? 'Visualizando registros guardados en la memoria cifrada local (Modo taller).'
            : 'Consulta las actividades y sus registros de seguridad.'
        }
        action={
          <div className="title-actions">
            {pendingCount > 0 && isOnline && (
              <button
                className="button secondary"
                onClick={async () => {
                  await triggerSync();
                  await load();
                }}
                disabled={isSyncing}
              >
                <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
                {isSyncing ? 'Sincronizando…' : `Sincronizar (${pendingCount})`}
              </button>
            )}
            <Link className="button primary" to="/registros/nuevo">
              <Plus size={18} /> Nueva ficha
            </Link>
          </div>
        }
      />

      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar actividad, código, sección o taller"
          />
        </div>
        <button className="button secondary filter-button" onClick={() => setQuery('')}>
          <Settings2 size={16} /> Limpiar
        </button>
      </div>

      <div className="table-card">
        <div className="record-list">
          {filtered.map(record => (
            <RecordRow key={record.id} record={record} />
          ))}
          {!filtered.length && (
            <EmptyState
              title="No encontramos fichas"
              text={
                isFromCache
                  ? 'No hay fichas almacenadas en caché local para este usuario.'
                  : 'Prueba otra búsqueda o crea un nuevo registro.'
              }
            />
          )}
        </div>
      </div>
      <div className="list-foot">
        {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        {isFromCache ? ' (Modo local)' : ''}
      </div>
    </>
  );
}
