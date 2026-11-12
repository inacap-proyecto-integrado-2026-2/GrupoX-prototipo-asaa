import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  HardHat,
  History,
  Info,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ErrorState, LoadingScreen, PageTitle } from '../components/Feedback.jsx';
import { api, apiDownload } from '../services/api.js';
import { getOfflineRecords } from '../lib/offlineStore.js';

const formatDate = value =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';
const canApprove = role => ['admin', 'jefatura', 'coordinacion'].includes(role);

export default function RecordDetailPage() {
  const { recordId } = useParams();
  const { profile } = useAuth();
  const [record, setRecord] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api(`/records/${recordId}`);
      setRecord(result.record);
      if (canApprove(profile?.role) || result.record.ownerUid === profile?.uid) {
        const c = await api(`/records/${recordId}/corrections`);
        setCorrections(c.corrections);
      }
    } catch (e) {
      if (e.code === 'network_offline' || !navigator.onLine) {
        const cached = (await getOfflineRecords(profile?.uid)).find(r => r.id === recordId);
        if (cached) {
          setRecord(cached);
          setMessage('Visualizando ficha desde el almacenamiento local cifrado (Modo sin conexión).');
          return;
        }
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [recordId, profile?.role, profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function requestCorrection() {
    setBusy(true);
    setError('');
    try {
      await api(`/records/${recordId}/corrections`, { method: 'POST', body: { reason } });
      setReason('');
      setMessage('Solicitud enviada a jefatura o coordinación.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(correctionId, decision) {
    setBusy(true);
    setError('');
    try {
      await api(`/records/${recordId}/corrections/${correctionId}`, { method: 'PATCH', body: { decision } });
      setMessage(
        decision === 'approved'
          ? 'Corrección aprobada. El docente puede editar la misma ficha.'
          : 'Solicitud rechazada.'
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTalk() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/records/${recordId}`, { method: 'PATCH', body: { talkDone: true } });
      setRecord(current => ({ ...current, ...result.record }));
      setMessage('Charla registrada como realizada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeRecord() {
    setError('');
    setMessage('');
    if (record.type === 'Práctica' && !record.talkTopic?.trim()) {
      setError('Falta el tema de la charla. Agrégalo en "Editar ficha" antes de cerrar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (record.type === 'Práctica' && !record.talkDone) {
      setError('Primero confirma que la charla fue realizada con el botón "Se realizó la charla".');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (
      !window.confirm(
        `¿Cerrar la ficha?${
          record.qrSessionId ? ' La asistencia QR en curso se finalizará.' : ''
        } Después solo se podrá modificar mediante una solicitud de corrección.`
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/records/${recordId}/close`, { method: 'POST', body: {} });
      await load();
      setMessage('Ficha cerrada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const { filename } = await apiDownload(`/records/${recordId}/export`, {
        defaultFilename: `ASAA-${record?.code || recordId}.pdf`,
      });
      setMessage(`Ficha descargada exitosamente en formato PDF oficial (${filename}) y registrada en auditoría.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (error && !record) return <ErrorState error={error} onRetry={load} />;

  const editable = record.ownerUid === profile?.uid && ['open', 'correction_open'].includes(record.status);
  const label =
    {
      open: 'En curso',
      closed: 'Cerrada',
      correction_pending: 'Corrección pendiente',
      correction_open: 'Corrección aprobada',
    }[record.status] || record.status;

  return (
    <>
      <div className="flow-top">
        <Link className="back-link" to="/registros">
          <ArrowLeft size={17} /> Volver al historial
        </Link>
        <span className={`badge ${record.status === 'closed' ? 'success' : 'warning'}`}>
          <i />
          {label}
        </span>
      </div>
      {error && <div className="form-error inline-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      <PageTitle
        eyebrow={record.code || record.id}
        title={record.activity}
        subtitle={`${record.section || 'Sin sección'} · ${record.place || 'Sin lugar'} · ${formatDate(record.date)}`}
        action={
          <div className="title-actions">
            <button className="button secondary" disabled={busy} onClick={exportPdf}>
              <Download size={16} /> {busy ? 'Generando PDF…' : 'Descargar PDF oficial'}
            </button>
            {editable && record.status === 'open' && record.type === 'Práctica' && !record.talkDone && (
              <button className="button secondary" disabled={busy} onClick={confirmTalk}>
                <Check size={16} /> {busy ? 'Guardando…' : 'Se realizó la charla'}
              </button>
            )}
            {editable && (
              <Link className="button primary" to={`/registros/${record.id}/editar`}>
                Editar ficha
              </Link>
            )}
            {record.status === 'open' &&
              record.ownerUid === profile?.uid &&
              ['docente', 'admin'].includes(profile?.role) && (
                <button className="button primary" disabled={busy} onClick={closeRecord}>
                  <LockKeyhole size={16} /> Cerrar ficha
                </button>
              )}
          </div>
        }
      />
      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-card-head">
              <div>
                <h2>Resumen de actividad</h2>
                <span>Responsable: {record.docente}</span>
              </div>
              <span className={`type-pill ${record.type === 'Teórica' ? 'theory' : ''}`}>
                {record.type === 'Teórica' ? <BookOpen size={13} /> : <HardHat size={13} />} {record.type}
              </span>
            </div>
            <div className="detail-fields">
              <Line label="Especialidad" value={record.specialty} />
              <Line label="Fecha" value={formatDate(record.date)} />
              <Line label="Sede" value={record.sede} />
              <Line label="Lugar" value={record.place} />
              <Line label="Nivel técnico" value={record.level} />
              <Line
                label="Nómina (asignatura · sección · período)"
                value={
                  record.subjectCode
                    ? `${record.subjectCode} · ${record.sectionCode || '—'} · ${record.period || '—'}`
                    : ''
                }
              />
              <Line label="Origen" value={record.paper ? 'Transcrita desde papel' : 'Digital'} />
            </div>
          </div>
          {record.type === 'Práctica' && (
            <>
              <div className="detail-card">
                <div className="detail-card-head">
                  <div>
                    <h2>Análisis de seguridad</h2>
                    <span>Riesgos, controles y recursos seleccionados</span>
                  </div>
                  <div className="mini-icon">
                    <ShieldCheck size={18} />
                  </div>
                </div>
                <Tags label="Riesgos asociados" items={record.risks} />
                <Tags label="Medidas de control" items={record.controls} />
                <Tags label="EPP" items={record.ppe} />
                <Tags label="Equipos de apoyo" items={record.equipment} />
                <Tags label="Condiciones ambientales" items={record.environment} />
                <div className="detail-fields">
                  <Line
                    label="Etapas y riesgos/controles"
                    value={(record.stages || [])
                      .map(
                        s =>
                          `${s.description}: riesgos ${(s.risks || []).join(', ')}; controles ${(s.controls || []).join(', ')}`
                      )
                      .join(' | ')}
                  />
                  <Line label="Personal ejecutante" value={(record.executionStaff || []).join(', ')} />
                  <Line label="LOTO" value={record.loto ? 'Sí' : 'No'} />
                  <Line
                    label="FAR / dificultad"
                    value={record.far ? `Sí · Lista ${record.farList || 'por especificar'}` : 'No'}
                  />
                  <Line label="Observaciones" value={record.observations} />
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-card-head">
                  <div>
                    <h2>Charla y toma de conocimiento</h2>
                    <span>{record.talkTopic || 'Sin tema registrado'}</span>
                  </div>
                  <div className="mini-icon">
                    <Users size={18} />
                  </div>
                </div>
                <div className="detail-fields">
                  <Line label="Hora" value={record.talkStart} />
                  <Line label="Duración" value={`${record.talkDuration || '—'} min`} />
                  <Line label="Realizada" value={record.talkDone ? 'Sí' : 'No'} />
                </div>
                <div className="attendee-list">
                  {(record.attendance || []).map((person, i) => (
                    <div className="attendee-row" key={`${person.name}-${i}`}>
                      <div className="avatar student-avatar">
                        {(person.name || '?')
                          .split(' ')
                          .map(v => v[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <strong>
                        {person.name || 'Sin nombre'}
                        {person.matricula && <small> · {person.matricula}</small>}
                      </strong>
                      <span
                        className={`attendance-state ${
                          person.state === 'Presente'
                            ? 'present'
                            : person.state === 'Atraso'
                            ? 'late'
                            : person.state === 'Ausente'
                            ? 'absent'
                            : ''
                        }`}
                      >
                        {person.state}
                      </span>
                      <small>
                        {person.method || 'Registro docente'} {person.time && `· ${String(person.time).slice(0, 16)}`}
                      </small>
                    </div>
                  ))}
                </div>
                {!record.attendance?.length && <div className="no-attendance">No se registraron participantes.</div>}
              </div>
            </>
          )}
        </div>
        <aside className="detail-side">
          <div className="aside-card">
            <div className="aside-icon">
              <LockKeyhole size={18} />
            </div>
            <strong>{label}</strong>
            <p>
              {record.status === 'closed'
                ? 'La edición ordinaria está bloqueada. Si hay un error, solicita una corrección.'
                : 'El estado y las acciones se validan en el servidor.'}
            </p>
            {record.status === 'closed' && record.ownerUid === profile?.uid && (
              <div className="correction-box">
                <label>
                  Motivo de la corrección
                  <textarea
                    rows="3"
                    maxLength="2000"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Describe qué dato se debe corregir"
                  />
                </label>
                <button
                  className="button secondary full"
                  disabled={busy || reason.trim().length < 8}
                  onClick={requestCorrection}
                >
                  Solicitar corrección
                </button>
              </div>
            )}
          </div>
          {record.type === 'Práctica' && record.status === 'open' && record.ownerUid === profile?.uid && (
            <div className="aside-card">
              <div className="aside-icon">
                <QrCode size={18} />
              </div>
              <strong>Asistencia con QR</strong>
              <p>
                {record.qrSessionId
                  ? 'Hay una sesión QR en curso.'
                  : 'Proyecta un código QR para que los estudiantes marquen su asistencia con su matrícula.'}
              </p>
              <Link className="button secondary full" to={`/registros/${record.id}/qr`}>
                <QrCode size={15} /> {record.qrSessionId ? 'Ver sesión QR' : 'Tomar asistencia QR'}
              </Link>
            </div>
          )}
          {corrections.length > 0 && (
            <div className="aside-card">
              <div className="aside-icon muted-icon">
                <History size={18} />
              </div>
              <strong>Solicitudes de corrección</strong>
              <ul className="history-list">
                {corrections.map(c => (
                  <li key={c.id}>
                    <b>{c.status === 'pending' ? 'Pendiente' : c.status === 'approved' ? 'Aprobada' : 'Rechazada'}</b>
                    <span>{c.reason}</span>
                    {canApprove(profile?.role) && c.status === 'pending' && (
                      <div className="decision-buttons">
                        <button disabled={busy} className="button small primary" onClick={() => decide(c.id, 'approved')}>
                          <Check size={13} /> Aprobar
                        </button>
                        <button disabled={busy} className="button small secondary" onClick={() => decide(c.id, 'rejected')}>
                          Rechazar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="aside-card pale">
            <div className="aside-icon muted-icon">
              <Info size={18} />
            </div>
            <strong>Conservación</strong>
            <p>Las fichas no tienen una acción de borrado. Cada consulta, exportación, cambio y etapa queda registrada.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Line({ label, value }) {
  return (
    <div className="review-line">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function Tags({ label, items = [] }) {
  return (
    <div className="tag-group">
      <span>{label}</span>
      <div>
        {items.length ? (
          items.map(item => <i key={item}>{item}</i>)
        ) : (
          <small>Sin selección</small>
        )}
      </div>
    </div>
  );
}
