import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, QrCode, Square, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ErrorState, LoadingScreen, PageTitle } from '../components/Feedback.jsx';
import { api } from '../services/api.js';
import './qr.css';

const POLL_MS = 4000;
const formatClock = ms => { const total = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };

export default function QrSessionPage() {
  const { recordId } = useParams();
  const [record, setRecord] = useState(null); const [session, setSession] = useState(null); const [checkins, setCheckins] = useState([]);
  const [qrImage, setQrImage] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [now, setNow] = useState(Date.now());
  const lastToken = useRef('');

  const poll = useCallback(async () => {
    try {
      const result = await api(`/records/${recordId}/qr`);
      setSession(result.session ? { ...result.session, changeAt: Date.now() + result.session.refreshInMs } : null); setCheckins(result.checkins || []);
      if (result.ended) setNotice(`La sesión QR terminó. Se incorporaron ${result.merged} asistencias a la ficha; quienes no marcaron quedaron como Ausente.`);
      setError('');
    } catch (e) { setError(e.message); }
  }, [recordId]);

  useEffect(() => { (async () => { try { setRecord((await api(`/records/${recordId}`)).record); await poll(); } catch (e) { setError(e.message); } finally { setLoading(false); } })(); }, [recordId, poll]);
  useEffect(() => { if (!session) return undefined; const id = setInterval(poll, POLL_MS); return () => clearInterval(id); }, [session?.id, poll]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!session?.token || session.token === lastToken.current) return;
    lastToken.current = session.token;
    const url = `${window.location.origin}/qr/${session.id}?t=${session.token}`;
    QRCode.toDataURL(url, { width: 420, margin: 1, errorCorrectionLevel: 'M' }).then(setQrImage).catch(() => setError('No se pudo dibujar el código QR.'));
  }, [session]);

  async function start() {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/records/${recordId}/qr`, { method: 'POST', body: {} }); await poll(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true); setError('');
    try { const result = await api(`/records/${recordId}/qr`, { method: 'DELETE' }); setSession(null); setQrImage(''); lastToken.current = ''; setNotice(`Asistencia QR finalizada. Se incorporaron ${result.merged} asistencias a la ficha; quienes no marcaron quedaron como Ausente.`); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (loading) return <LoadingScreen/>;
  if (!record) return <ErrorState error={error}/>;
  const linked = record.subjectCode && record.sectionCode && record.period;
  return <>
    <div className="flow-top"><Link className="back-link" to={`/registros/${recordId}`}><ArrowLeft size={17}/> Volver a la ficha</Link></div>
    <PageTitle eyebrow="ASISTENCIA QR" title={record.activity} subtitle={linked ? `${record.subjectCode} · Sección ${record.sectionCode} · ${record.period}` : 'Ficha sin nómina asociada'}/>
    {error && <div className="form-error inline-error" role="alert">{error}</div>}
    {notice && <div className="form-success" role="status">{notice}</div>}
    {!session && <section className="form-card qr-start">
      <div className="quick-icon"><QrCode size={22}/></div>
      <h2>Tomar asistencia con código QR</h2>
      {linked
        ? <p>Se cargará la nómina importada de esta sección. Los estudiantes escanean el código y escriben su matrícula. El código cambia cada 30 segundos y la sesión dura 20 minutos.</p>
        : <p>Para usar el QR, edita la ficha e indica el código de asignatura, la sección y el período tal como aparecen en la nómina importada.</p>}
      {linked ? <button className="button primary" disabled={busy || record.status !== 'open'} onClick={start}><QrCode size={17}/>{busy ? 'Iniciando…' : 'Iniciar asistencia QR'}</button>
        : <Link className="button primary" to={`/registros/${recordId}/editar`}>Editar ficha</Link>}
      {record.status !== 'open' && <p className="muted">La ficha está cerrada; ya no se puede tomar asistencia.</p>}
    </section>}
    {session && <div className="qr-layout">
      <section className="form-card qr-panel">
        {qrImage ? <img className="qr-image" src={qrImage} alt="Código QR de asistencia"/> : <div className="qr-image qr-placeholder"/>}
        <div className="qr-meta"><span><Clock3 size={15}/> Cambia en {formatClock(session.changeAt - now)}</span><span>Termina en {formatClock(session.expiresAt - now)}</span></div>
        <p className="muted">Escanea con la cámara del celular y escribe tu matrícula.</p>
        <button className="button secondary" disabled={busy} onClick={finish}><Square size={15}/>{busy ? 'Finalizando…' : 'Finalizar asistencia'}</button>
      </section>
      <aside className="aside-card qr-checkins">
        <div className="aside-icon"><Users size={18}/></div>
        <strong>{checkins.length} de {session.enrolledCount} presentes</strong>
        <div className="attendance-progress"><span style={{ width: `${session.enrolledCount ? checkins.length / session.enrolledCount * 100 : 0}%` }}/></div>
        <ul className="qr-checkin-list">{checkins.map(c => <li key={c.matricula}><CheckCircle2 size={14}/><span>{c.name}</span><small>{c.checkedAt ? new Date(c.checkedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}</small></li>)}</ul>
        {!checkins.length && <p className="muted">Aún nadie ha marcado asistencia.</p>}
        <p className="muted">Al finalizar, los presentes se guardan en la ficha. Atrasos y ausencias los marcas tú desde “Editar ficha”.</p>
      </aside>
    </div>}
  </>;
}
