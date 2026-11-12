import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, Info, Plus, ShieldCheck, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ErrorState, LoadingScreen, PageTitle } from '../components/Feedback.jsx';
import {
  CheckGroup,
  Field,
  Toggle,
  riskOptions,
  ppeOptions,
  equipmentOptions,
  environmentOptions,
  controlOptions,
} from '../components/RecordFields.jsx';
import { api } from '../services/api.js';
import NominaFields from '../components/NominaFields.jsx';
import StagesEditor from '../components/StagesEditor.jsx';
import { useOffline } from '../lib/OfflineContext.jsx';
import { getOfflineRecords, queueOfflineMutation } from '../lib/offlineStore.js';

const today = () => new Date().toISOString().slice(0, 10);
const newRecord = profile => ({
  type: 'Práctica',
  activity: '',
  specialty: 'Electricidad y Electrónica',
  date: today(),
  sede: 'San Pedro de la Paz',
  docente: profile?.name || '',
  section: '',
  subjectCode: '',
  sectionCode: '',
  period: '',
  place: '',
  level: 'Intermedio',
  equipment: [],
  ppe: [],
  environment: [],
  controls: [],
  risks: [],
  stages: [],
  executionStaff: [],
  observations: '',
  far: false,
  farList: '',
  talkTopic: '',
  talkStart: '09:00',
  talkDuration: '5',
  talkDone: false,
  loto: false,
  paper: false,
  attendance: [],
});
const stepsPractice = ['Actividad', 'Seguridad', 'Charla y asistencia', 'Revisión'];
const stepsTheory = ['Actividad', 'Revisión'];

export default function RecordFormPage() {
  const { recordId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isOnline, refreshStatus } = useOffline();
  const [draft, setDraft] = useState(() => ({
    ...newRecord(profile),
    ...(params.get('tipo') === 'teorica' ? { type: 'Teórica' } : {}),
  }));
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(recordId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const steps = draft.type === 'Teórica' ? stepsTheory : stepsPractice;
  const currentStep = steps[step];

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError('');
    try {
      let qrActive = false;
      try {
        qrActive = Boolean((await api(`/records/${recordId}/qr`)).session);
      } catch {
        /* solo aplica al docente responsable */
      }
      const result = await api(`/records/${recordId}`);
      setRecord(result.record);
      setDraft(result.record);
      if (qrActive) {
        setNotice('Hay una asistencia QR en curso. Finalízala desde la ficha antes de guardar cambios.');
      }
    } catch (e) {
      if (e.code === 'network_offline' || !navigator.onLine) {
        const cachedList = await getOfflineRecords(profile?.uid);
        const cached = cachedList.find(r => r.id === recordId);
        if (cached) {
          setRecord(cached);
          setDraft(cached);
          setNotice('Ficha cargada desde almacenamiento local cifrado (Modo taller).');
          return;
        }
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [recordId, profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  // Precarga la nómina de la sección elegida en el paso 1 como asistencia "Pendiente".
  const rosterKey =
    draft.type === 'Práctica' && draft.subjectCode && draft.sectionCode && draft.period
      ? [draft.subjectCode, draft.sectionCode, draft.period].join('|')
      : '';
  const lastRosterKey = useRef(null);
  const [rosterNote, setRosterNote] = useState(null);

  useEffect(() => {
    if (loading) return;
    const previous = lastRosterKey.current;
    lastRosterKey.current = rosterKey;
    if (previous === rosterKey) return;

    // Al cambiar de sección se quitan los estudiantes de la nómina anterior que siguen pendientes; lo marcado o agregado a mano se conserva.
    if (previous) {
      setDraft(current => ({
        ...current,
        attendance: (current.attendance || []).filter(
          a => !(a.matricula && a.state === 'Pendiente' && a.method !== 'QR')
        ),
      }));
    }
    if (!rosterKey) {
      setRosterNote(null);
      return;
    }
    let active = true;
    const [subject, section, period] = rosterKey.split('|');
    setRosterNote({ text: 'Cargando nómina de la sección…' });

    api(
      `/imports?subject=${encodeURIComponent(subject)}&section=${encodeURIComponent(
        section
      )}&period=${encodeURIComponent(period)}`
    )
      .then(({ students }) => {
        if (!active) return;
        setDraft(current => {
          const attendance = [...(current.attendance || [])];
          const known = new Set(attendance.map(a => a.matricula).filter(Boolean));
          const fresh = students
            .filter(s => !known.has(s.matricula))
            .map(s => ({
              name: s.nombre_estudiante,
              matricula: s.matricula,
              state: 'Pendiente',
              method: 'Nómina',
              time: '',
            }));
          return { ...current, attendance: [...attendance, ...fresh] };
        });
        setRosterNote({ text: `Nómina precargada: ${students.length} estudiantes.` });
      })
      .catch(e => {
        if (!active) return;
        setRosterNote({ error: true, text: `No se pudo precargar la nómina: ${e.message}` });
      });

    return () => {
      active = false;
    };
  }, [rosterKey, loading]);

  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const toggle = (key, value) =>
    update(key, draft[key].includes(value) ? draft[key].filter(item => item !== value) : [...draft[key], value]);

  async function submit(close = false) {
    setError('');
    setNotice('');
    if (!draft.activity.trim() || !draft.docente.trim() || !draft.place.trim()) {
      setStep(0);
      setError('Completa actividad, docente responsable y lugar.');
      return;
    }
    if (draft.type === 'Práctica' && (!draft.talkTopic.trim() || !draft.talkDone) && close) {
      setStep(2);
      setError('Completa el tema y confirma que la charla fue realizada antes de cerrar.');
      return;
    }
    setBusy(true);

    // Save offline immediately if no network
    if (!navigator.onLine) {
      try {
        await queueOfflineMutation(profile?.uid, {
          type: recordId ? 'update' : 'create',
          recordId,
          payload: draft,
          baseRecord: record,
          closeAfter: close,
        });
        await refreshStatus();
        setNotice(
          'Ficha guardada localmente de forma cifrada (Modo taller). Se sincronizará automáticamente al detectar red.'
        );
        setTimeout(() => navigate('/registros'), 1300);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      let result;
      if (recordId) result = await api(`/records/${recordId}`, { method: 'PATCH', body: draft });
      else result = await api('/records', { method: 'POST', body: draft });
      const saved = result.record;
      setRecord(saved);
      if (close) await api(`/records/${saved.id}/close`, { method: 'POST', body: {} });
      navigate(`/registros/${saved.id}`);
    } catch (e) {
      if (e.code === 'network_offline') {
        try {
          await queueOfflineMutation(profile?.uid, {
            type: recordId ? 'update' : 'create',
            recordId,
            payload: draft,
            baseRecord: record,
            closeAfter: close,
          });
          await refreshStatus();
          setNotice('Red interrumpida: Ficha guardada localmente de forma cifrada. Se sincronizará al reconectar.');
          setTimeout(() => navigate('/registros'), 1300);
          return;
        } catch (queueErr) {
          setError(queueErr.message);
        }
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === 0 && (!draft.activity.trim() || !draft.docente.trim() || !draft.place.trim())) {
      setError('Completa los campos obligatorios antes de continuar.');
      return;
    }
    setError('');
    setStep(v => Math.min(v + 1, steps.length - 1));
  }

  if (loading) return <LoadingScreen />;
  if (error && !recordId && !draft.activity) return <ErrorState error={error} />;
  if (recordId && !record && error) return <ErrorState error={error} onRetry={load} />;

  return (
    <>
      <div className="flow-top">
        <Link className="back-link" to={recordId ? `/registros/${recordId}` : '/registros'}>
          <ArrowLeft size={17} /> Volver
        </Link>
        <span className="draft-label">
          <i /> {isOnline ? 'Guardado al enviar' : 'Modo taller (Cifrado local)'}
        </span>
      </div>
      <PageTitle
        eyebrow={recordId ? 'EDITAR FICHA' : 'NUEVO REGISTRO'}
        title={recordId ? 'Editar actividad' : 'Preparar actividad'}
        subtitle={
          draft.type === 'Práctica'
            ? 'Completa el análisis de seguridad y registra la charla.'
            : 'Registra la clase sin ficha ASAA ni charla.'
        }
      />
      {error && (
        <div className="form-error inline-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}
      <div className="flow-layout">
        <div className="flow-main">
          <div className="stepper">
            {steps.map((name, i) => (
              <button
                key={name}
                className={`step-item ${i === step ? 'current' : i < step ? 'done' : ''}`}
                onClick={() => i <= step && setStep(i)}
              >
                <span className="step-number">{i < step ? <Check size={14} /> : i + 1}</span>
                <span>{name}</span>
                {i < steps.length - 1 && <i className="step-line" />}
              </button>
            ))}
          </div>

          {currentStep === 'Actividad' && (
            <section className="form-card">
              <CardHeading
                icon={ShieldCheck}
                title="Datos de la actividad"
                subtitle="Identifica la clase, el lugar y al docente responsable."
              />
              <div className="type-switch">
                <button
                  type="button"
                  className={draft.type === 'Práctica' ? 'selected' : ''}
                  onClick={() => update('type', 'Práctica')}
                >
                  <ShieldCheck size={17} /> Práctica
                </button>
                <button
                  type="button"
                  className={draft.type === 'Teórica' ? 'selected' : ''}
                  onClick={() => update('type', 'Teórica')}
                >
                  <Users size={17} /> Teórica
                </button>
              </div>
              <div className="form-grid">
                <Field label="Trabajo o actividad" required>
                  <input
                    maxLength="500"
                    value={draft.activity}
                    onChange={e => update('activity', e.target.value)}
                    placeholder="Ej. Medición de circuitos de control"
                  />
                </Field>
                <Field label="Especialidad">
                  <select value={draft.specialty} onChange={e => update('specialty', e.target.value)}>
                    <option>Electricidad y Electrónica</option>
                    <option>Automatización y Robótica</option>
                    <option>Tecnologías de Información y Ciberseguridad</option>
                    <option>Otra especialidad</option>
                  </select>
                </Field>
                <Field label="Fecha" required>
                  <input type="date" value={draft.date} onChange={e => update('date', e.target.value)} />
                </Field>
                <Field label="Sede">
                  <input maxLength="150" value={draft.sede || ''} onChange={e => update('sede', e.target.value)} />
                </Field>
                <Field label="Docente responsable" required>
                  <input maxLength="200" value={draft.docente} onChange={e => update('docente', e.target.value)} />
                </Field>
                <NominaFields draft={draft} onChange={(key, val) => update(key, val)} />
                <Field label="Sala / taller / laboratorio / terreno" required>
                  <input maxLength="200" value={draft.place} onChange={e => update('place', e.target.value)} />
                </Field>
                <Field label="Nivel técnico de la actividad">
                  <select value={draft.level} onChange={e => update('level', e.target.value)}>
                    <option>Inicial</option>
                    <option>Intermedio</option>
                    <option>Avanzado</option>
                  </select>
                </Field>
                <label className="check-line paper-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.paper)}
                    onChange={e => update('paper', e.target.checked)}
                  />
                  <span>Transcrita desde papel</span>
                </label>
              </div>
            </section>
          )}

          {currentStep === 'Seguridad' && (
            <section className="form-card">
              <CardHeading
                icon={ShieldCheck}
                title="Revisión de seguridad"
                subtitle="Selecciona recursos, condiciones y riesgos que correspondan."
              />
              <CheckGroup
                title="Equipos de apoyo"
                options={equipmentOptions}
                values={draft.equipment}
                onToggle={v => toggle('equipment', v)}
              />
              <CheckGroup
                title="Equipo de protección personal (EPP)"
                options={ppeOptions}
                values={draft.ppe}
                onToggle={v => toggle('ppe', v)}
              />
              <CheckGroup
                title="Condiciones ambientales"
                options={environmentOptions}
                values={draft.environment}
                onToggle={v => toggle('environment', v)}
              />
              <CheckGroup
                title="Riesgos asociados"
                options={riskOptions}
                values={draft.risks}
                onToggle={v => toggle('risks', v)}
              />
              <CheckGroup
                title="Medidas de control propuestas"
                options={controlOptions}
                values={draft.controls}
                onToggle={v => toggle('controls', v)}
              />
              <div className="divider" />
              <div className="toggle-row">
                <div>
                  <strong>Bloqueo y etiquetado (LOTO)</strong>
                  <span>Indica si corresponde para esta actividad.</span>
                </div>
                <Toggle checked={Boolean(draft.loto)} onChange={v => update('loto', v)} />
              </div>
              <Field label="Observaciones de seguridad">
                <textarea
                  rows="3"
                  maxLength="4000"
                  value={draft.observations || ''}
                  onChange={e => update('observations', e.target.value)}
                  placeholder="Condiciones particulares del lugar o tarea"
                />
              </Field>
              <StagesEditor stages={draft.stages || []} onChange={v => update('stages', v)} />
              <div className="stage-header staff-header">
                <div>
                  <strong>Personal ejecutante</strong>
                  <span>Registra las personas que participan en la ejecución.</span>
                </div>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => update('executionStaff', [...(draft.executionStaff || []), ''])}
                >
                  <Plus size={15} /> Agregar persona
                </button>
              </div>
              {(draft.executionStaff || []).map((person, i) => (
                <div className="stage-input" key={i}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <input
                    maxLength="200"
                    value={person}
                    onChange={e =>
                      update(
                        'executionStaff',
                        draft.executionStaff.map((v, j) => (j === i ? e.target.value : v))
                      )
                    }
                    placeholder="Nombre de quien ejecuta"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => update('executionStaff', draft.executionStaff.filter((_, j) => j !== i))}
                    aria-label="Eliminar persona"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="signature-note">
                <Info size={15} /> Las firmas manuscritas y la firma digital avanzada no se capturan en esta versión.
              </div>
              <div className="toggle-row far-row">
                <div>
                  <strong>¿Hay estudiantes con dificultad para el trabajo (FAR)?</strong>
                  <span>El acceso a estos datos queda restringido por servidor.</span>
                </div>
                <Toggle checked={Boolean(draft.far)} onChange={v => update('far', v)} />
              </div>
              {draft.far && (
                <Field label="Número(s) de lista">
                  <input
                    maxLength="200"
                    value={draft.farList || ''}
                    onChange={e => update('farList', e.target.value)}
                    placeholder="Ej. 4, 12"
                  />
                </Field>
              )}
            </section>
          )}

          {currentStep === 'Charla y asistencia' && (
            <section className="form-card">
              <CardHeading
                icon={Users}
                title="Charla y toma de conocimiento"
                subtitle="Registra la charla y agrega a las personas de la nómina."
              />
              <Field label="Tema de la charla de seguridad" required>
                <input
                  maxLength="500"
                  value={draft.talkTopic || ''}
                  onChange={e => update('talkTopic', e.target.value)}
                  placeholder="Ej. Riesgos eléctricos y uso de instrumentos"
                />
              </Field>
              <div className="form-grid two-col">
                <Field label="Hora de inicio">
                  <input type="time" value={draft.talkStart || ''} onChange={e => update('talkStart', e.target.value)} />
                </Field>
                <Field label="Duración (minutos)">
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={draft.talkDuration || ''}
                    onChange={e => update('talkDuration', e.target.value)}
                  />
                </Field>
              </div>
              <div className="toggle-row talk-done">
                <div>
                  <strong>La charla fue realizada</strong>
                  <span>Confirma que se impartió la charla inicial.</span>
                </div>
                <Toggle checked={Boolean(draft.talkDone)} onChange={v => update('talkDone', v)} />
              </div>
              <div className="roster-header">
                <div>
                  <strong>Nómina de estudiantes</strong>
                  <span>Los datos se envían cifrados a la API bajo sesión autenticada.</span>
                </div>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() =>
                    update('attendance', [...(draft.attendance || []), { name: '', state: 'Pendiente', method: '', time: '' }])
                  }
                >
                  <Plus size={15} /> Agregar persona
                </button>
              </div>
              {rosterNote && (
                <div className={rosterNote.error ? 'form-error' : 'form-success'} role="status">
                  {rosterNote.text}
                </div>
              )}
              <div className="roster">
                {(draft.attendance || []).map((student, i) => (
                  <div className="student-row" key={student.matricula || `manual-${i}`}>
                    {student.matricula && <span className="student-mat">{student.matricula}</span>}
                    <input
                      className="student-name-input"
                      maxLength="200"
                      aria-label="Nombre del estudiante"
                      placeholder="Nombre del estudiante"
                      value={student.name}
                      onChange={e =>
                        update(
                          'attendance',
                          draft.attendance.map((a, j) => (j === i ? { ...a, name: e.target.value } : a))
                        )
                      }
                    />
                    <select
                      aria-label={`Estado de asistencia ${i + 1}`}
                      value={student.state}
                      onChange={e =>
                        update(
                          'attendance',
                          draft.attendance.map((a, j) =>
                            j === i
                              ? a.method === 'QR'
                                ? { ...a, state: e.target.value }
                                : { ...a, state: e.target.value, method: 'Registro docente', time: new Date().toISOString() }
                              : a
                          )
                        )
                      }
                    >
                      <option>Pendiente</option>
                      <option>Presente</option>
                      <option>Atraso</option>
                      <option>Ausente</option>
                    </select>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => update('attendance', draft.attendance.filter((_, j) => i !== j))}
                      aria-label="Quitar persona"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="late-note">
                <Clock3 size={16} />
                <span>
                  El atraso sobre 15 minutos debe registrarse y requiere charla individual bajo supervisión docente.
                </span>
              </div>
              <div className="demo-warning">
                <Info size={15} /> Para la asistencia con QR, guarda la ficha con el código de asignatura, sección y período, y usa “Tomar asistencia QR” desde el detalle de la ficha. Aquí puedes ajustar estados (por ejemplo, Atraso o Ausente).
              </div>
            </section>
          )}

          {currentStep === 'Revisión' && <Review draft={draft} />}

          <div className="flow-footer">
            <Link className="button secondary" to={recordId ? `/registros/${recordId}` : '/registros'}>
              {step === 0 ? 'Cancelar' : 'Salir'}
            </Link>
            <span>Los cambios se guardan en Firebase al enviar el formulario.</span>
            {step < steps.length - 1 ? (
              <button type="button" className="button primary" onClick={next}>
                Continuar <ArrowRight size={16} />
              </button>
            ) : (
              <div className="footer-actions">
                <button type="button" className="button secondary" disabled={busy} onClick={() => submit(false)}>
                  {busy ? 'Guardando…' : 'Guardar ficha'}
                </button>
                {(!record || record.status === 'open') && (
                  <button type="button" className="button primary" disabled={busy} onClick={() => submit(true)}>
                    <Check size={17} /> Guardar y cerrar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="flow-aside">
          <div className="aside-card">
            <div className="aside-icon">
              <ShieldCheck size={18} />
            </div>
            <strong>Preparación de la ficha</strong>
            <p>Completa cada sección y revisa antes de cerrar.</p>
            <ul>
              {steps.map((name, i) => (
                <li key={name} className={step >= i ? 'checked' : ''}>
                  <span>{step > i ? <Check size={12} /> : i + 1}</span>
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <div className="aside-card pale">
            <div className="aside-icon muted-icon">
              <Info size={18} />
            </div>
            <strong>Importante</strong>
            <p>El cierre del registro no reemplaza la autorización para iniciar un trabajo.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function CardHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="card-heading">
      <div className="quick-icon">
        <Icon size={19} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Review({ draft }) {
  return (
    <section className="form-card">
      <CardHeading
        icon={Check}
        title="Revisar y guardar"
        subtitle="Verifica los datos de actividad antes de guardar."
      />
      <div className="review-section">
        <div className="review-head">
          <strong>Actividad</strong>
          <span>{draft.type}</span>
        </div>
        <Line label="Trabajo" value={draft.activity} />
        <Line label="Fecha" value={draft.date} />
        <Line label="Sede" value={draft.sede} />
        <Line label="Responsable" value={draft.docente} />
        <Line label="Asignatura / sección" value={draft.section} />
        <Line label="Lugar" value={draft.place} />
      </div>
      {draft.type === 'Práctica' && (
        <>
          <div className="review-section">
            <div className="review-head">
              <strong>Seguridad</strong>
            </div>
            <Line label="Equipos" value={(draft.equipment || []).join(', ')} />
            <Line label="EPP" value={(draft.ppe || []).join(', ')} />
            <Line label="Condiciones" value={(draft.environment || []).join(', ')} />
            <Line label="Riesgos" value={(draft.risks || []).join(', ')} />
            <Line label="Controles" value={(draft.controls || []).join(', ')} />
            <Line
              label="Etapas y asociaciones"
              value={(draft.stages || [])
                .filter(stage => stage.description?.trim())
                .map(
                  stage =>
                    `${stage.description || 'Etapa'}: riesgos ${stage.risks?.join(', ') || '—'}; controles ${
                      stage.controls?.join(', ') || '—'
                    }`
                )
                .join(' | ')}
            />
            <Line
              label="Personal ejecutante"
              value={(draft.executionStaff || []).filter(Boolean).join(', ')}
            />
            <Line label="FAR" value={draft.far ? `Sí · Lista ${draft.farList || 'por indicar'}` : 'No'} />
          </div>
          <div className="review-section">
            <div className="review-head">
              <strong>Charla y participación</strong>
            </div>
            <Line label="Tema" value={draft.talkTopic} />
            <Line label="Charla realizada" value={draft.talkDone ? 'Sí' : 'No'} />
            <Line label="Personas registradas" value={(draft.attendance || []).length} />
          </div>
        </>
      )}
    </section>
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
