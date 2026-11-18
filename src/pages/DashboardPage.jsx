import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, FileClock, HardHat, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { canCreateRecords, roleLabel } from '../lib/permissions.js';
import { ErrorState, LoadingScreen, PageTitle, EmptyState } from '../components/Feedback.jsx';
import RecordRow from '../components/RecordRow.jsx';
import { api } from '../services/api.js';

export default function DashboardPage() {
  const { profile } = useAuth(); const [records, setRecords] = useState([]); const [stats, setStats] = useState({}); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await api('/records'); setRecords(result.records); setStats(result.stats || {}); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingScreen/>;
  if (error) return <ErrorState error={error} onRetry={load}/>;
  const greeting = profile?.name ? `Hola, ${profile.name.split(' ')[0]}` : 'Resumen';
  return <><PageTitle eyebrow={`PANEL ${roleLabel(profile?.role).toUpperCase()}`.trim()} title={greeting} subtitle="Estado de las fichas de actividad segura." action={canCreateRecords(profile?.role) ? <Link className="button primary" to="/registros/nuevo"><Plus size={18}/> Nueva ficha ASAA</Link> : null}/><div className="welcome-banner"><div className="welcome-icon"><Activity size={23}/></div><div><strong>Una actividad segura comienza con una buena preparación.</strong><span>Registra la actividad, revisa los riesgos y deja constancia de la charla.</span></div>{canCreateRecords(profile?.role) ? <Link to="/registros/nuevo">Preparar actividad <ArrowRight size={16}/></Link> : <Link to="/registros">Ver fichas <ArrowRight size={16}/></Link>}</div><div className="stats-grid"><Stat icon={ClipboardCheck} label="Fichas registradas" value={stats.total ?? records.length} tone="red"/><Stat icon={HardHat} label="Actividades prácticas" value={stats.practice ?? 0} tone="blue"/><Stat icon={FileClock} label="En curso" value={stats.open ?? 0} tone="amber"/><Stat icon={CheckCircle2} label="Cerradas" value={stats.closed ?? 0} tone="green"/></div><div className="section-heading"><div><h2>Accesos rápidos</h2><p>Continúa con una tarea frecuente.</p></div></div><div className="quick-grid">{canCreateRecords(profile?.role) && <><Quick icon={HardHat} title="Actividad práctica" text="Completa la ficha ASAA y registra la charla." to="/registros/nuevo"/><Quick icon={Activity} title="Actividad teórica" text="Registra la clase sin ficha ASAA ni charla." to="/registros/nuevo?tipo=teorica"/></>}<Quick icon={ClipboardCheck} title="Historial" text="Consulta tus registros y fichas anteriores." to="/registros"/></div><div className="section-heading recent-heading"><div><h2>Registros recientes</h2><p>Últimas actividades guardadas.</p></div><Link className="text-button" to="/registros">Ver historial <ArrowRight size={15}/></Link></div><div className="table-card"><div className="record-list">{records.slice(0, 5).map(r => <RecordRow record={r} key={r.id}/>)}{!records.length && <EmptyState title="Aún no hay registros"/>}</div></div></>;
}
function Stat({ icon: Icon, label, value, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>; }
function Quick({ icon: Icon, title, text, to }) { return <Link className="quick-card" to={to}><div className="quick-icon"><Icon size={20}/></div><div><strong>{title}</strong><span>{text}</span></div><ArrowRight className="quick-arrow" size={18}/></Link>; }
