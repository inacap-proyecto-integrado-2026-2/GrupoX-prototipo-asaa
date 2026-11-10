import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { ErrorState, LoadingScreen, PageTitle, EmptyState } from '../components/Feedback.jsx';
import { api } from '../services/api.js';

export default function AuditPage() {
  const [events, setEvents] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setEvents((await api('/audit')).events); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingScreen/>; if (error) return <ErrorState error={error} onRetry={load}/>;
  return <><PageTitle eyebrow="TRAZABILIDAD" title="Auditoría" subtitle="Consultas, exportaciones y cambios recientes registrados por la API."/><div className="callout info-callout"><History size={17}/><span>Se muestran los últimos 200 eventos. Los registros de auditoría se escriben desde el servidor y no se pueden editar desde esta app.</span></div><div className="table-card audit-table">{events.map(event => <div className="audit-row" key={event.id}><div className="audit-marker"><History size={14}/></div><div className="audit-event"><strong>{event.action}</strong><span>{event.actorEmail || (event.actorRole === 'estudiante-qr' ? `Estudiante (QR) ${event.context?.matricula || ''}` : 'Sistema')} · {event.actorRole}{event.recordId ? ` · Ficha ${event.recordId}` : ''}</span><small>{event.createdAt?._seconds ? new Date(event.createdAt._seconds * 1000).toLocaleString('es-CL') : 'Fecha registrada por el servidor'}</small></div><div className="audit-context">{event.context?.resultCount !== undefined ? `${event.context.resultCount} resultados` : event.context?.reason || ''}</div></div>)}{!events.length && <EmptyState title="Sin eventos de auditoría" text="Las acciones aparecerán aquí a medida que se utilice el sistema."/>}</div></>;
}
