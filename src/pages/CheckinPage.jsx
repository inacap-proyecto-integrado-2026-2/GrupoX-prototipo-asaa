import { useState } from 'react';
import { CheckCircle2, QrCode } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import './qr.css';

// Identificador estable de este navegador; el servidor permite una sola matrícula por dispositivo en cada sesión QR.
function deviceId() {
  const fresh = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
  try { let id = localStorage.getItem('asaa-device-id'); if (!id) { id = fresh(); localStorage.setItem('asaa-device-id', id); } return id; }
  catch { return (window.__asaaDeviceId ||= fresh()); }
}

// Página pública: el estudiante llega escaneando el QR y no necesita iniciar sesión.
export default function CheckinPage() {
  const { sessionId } = useParams(); const [params] = useSearchParams();
  const [matricula, setMatricula] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [done, setDone] = useState(null);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/qr/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, token: params.get('t') || '', matricula: matricula.trim(), deviceId: deviceId() }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo registrar la asistencia. Intenta nuevamente.');
      setDone(payload);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <div className="login-page"><div className="login-brand"><div className="brand-mark">A</div><div><strong>ASAA</strong><span>Seguridad académica</span></div></div>
    <main className="login-card checkin-card">
      {done ? <>
        <div className="login-emblem checkin-ok"><CheckCircle2 size={26}/></div>
        <h1>{done.already ? 'Ya estabas registrado' : `¡Listo${done.firstName ? `, ${done.firstName}` : ''}!`}</h1>
        <p>{done.late ? 'Tu asistencia quedó registrada con atraso. Acércate al docente para recibir la charla de seguridad individual.' : 'Tu asistencia quedó registrada. Ya puedes cerrar esta página.'}</p>
      </> : <>
        <div className="login-emblem"><QrCode size={23}/></div>
        <div className="eyebrow">ASISTENCIA</div>
        <h1>Marca tu asistencia</h1>
        <p>Escribe tu matrícula tal como aparece en la nómina de la asignatura.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="field"><span>Matrícula</span><input inputMode="text" autoComplete="off" autoCapitalize="characters" required maxLength="80" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ej. 20260001"/></label>
          <button className="button primary login-submit" disabled={busy || !matricula.trim()}>{busy ? 'Registrando…' : 'Registrar asistencia'}</button>
        </form>
      </>}
    </main>
    <footer>INACAP · Registro de actividad segura</footer>
  </div>;
}
