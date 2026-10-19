import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingScreen, PageTitle, EmptyState } from '../components/Feedback.jsx';
import RecordRow from '../components/RecordRow.jsx';
import { api } from '../services/api.js';

export default function RecordsPage() {
  const [records, setRecords] = useState([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRecords((await api('/records')).records); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => records.filter(r => `${r.code} ${r.activity} ${r.section} ${r.place}`.toLowerCase().includes(query.toLowerCase())), [records, query]);
  if (loading) return <LoadingScreen/>; if (error) return <ErrorState error={error} onRetry={load}/>;
  return <><PageTitle eyebrow="REGISTROS" title="Fichas ASAA" subtitle="Consulta las actividades y sus registros de seguridad." action={<Link className="button primary" to="/registros/nuevo"><Plus size={18}/> Nueva ficha</Link>}/><div className="filter-bar"><div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar actividad, código, sección o taller"/></div><button className="button secondary filter-button" onClick={() => setQuery('')}><Settings2 size={16}/> Limpiar</button></div><div className="table-card"><div className="record-list">{filtered.map(record => <RecordRow key={record.id} record={record}/>)}{!filtered.length && <EmptyState title="No encontramos fichas" text="Prueba otra búsqueda o crea un nuevo registro."/>}</div></div><div className="list-foot">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</div></>;
}
