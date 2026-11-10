import { useCallback, useEffect, useState } from 'react';
import { Clock3, Info, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingScreen, PageTitle, EmptyState } from '../components/Feedback.jsx';
import { api } from '../services/api.js';

export default function AttendancePage() {
  const [records, setRecords] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRecords((await api('/records')).records.filter(r => r.type === 'Práctica')); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <LoadingScreen/>; if (error) return <ErrorState error={error} onRetry={load}/>;
  return <><PageTitle eyebrow="PARTICIPACIÓN" title="Asistencia y charla" subtitle="Consulta la participación vinculada a cada actividad práctica."/><div className="callout info-callout"><Info size={18}/><span>Los estudiantes pueden marcar asistencia con QR desde cada ficha práctica abierta. Atrasos y ausencias los ajusta el docente.</span></div><div className="attendance-cards">{records.map(record => { const people = record.attendance || []; const present = people.filter(p => p.state === 'Presente').length; const late = people.filter(p => p.state === 'Atraso').length; return <Link className="attendance-card" key={record.id} to={`/registros/${record.id}`}><div className="attendance-top"><div className="record-type-icon"><Users size={18}/></div><span className={`badge ${record.status === 'closed' ? 'success' : 'warning'}`}><i/>{record.status === 'closed' ? 'Cerrada' : 'En curso'}</span></div><strong>{record.activity}</strong><span className="attendance-sub">{record.section || 'Sin sección'} · {record.date}</span><div className="attendance-progress"><span style={{ width: `${people.length ? present / people.length * 100 : 0}%` }}/></div><div className="attendance-summary"><span><b>{present}</b> presentes</span><span><b>{late}</b> atrasos</span><span><b>{people.filter(p => p.state === 'Pendiente').length}</b> pendientes</span></div><div className="attendance-sub"><Clock3 size={13}/> Tema charla: {record.talkTopic || '—'}</div></Link>; })}{!records.length && <EmptyState title="Sin asistencias registradas" text="Las actividades prácticas aparecerán aquí."/>}</div></>;
}
