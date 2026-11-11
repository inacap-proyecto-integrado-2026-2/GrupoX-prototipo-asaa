import { useEffect, useState } from 'react';
import { Field } from './RecordFields.jsx';
import { api } from '../services/api.js';

const sectionKey = (sectionCode, period) => `${sectionCode}|${period}`;

// Asignatura, sección y período de la ficha, elegidos desde la nómina importada.
// Si aún no hay datos importados (o el catálogo no carga), vuelve a campos de texto.
export default function NominaFields({ draft, setDraft }) {
  const [catalog, setCatalog] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api('/imports').then(result => active && setCatalog(result)).catch(() => active && setFailed(true));
    return () => { active = false; };
  }, []);

  const set = changes => setDraft(current => ({ ...current, ...changes }));
  const subjectCode = draft.subjectCode || '';
  const sectionValue = draft.sectionCode && draft.period ? sectionKey(draft.sectionCode, draft.period) : '';

  if (!catalog && !failed) return <Field label="Asignatura y sección (nómina)"><select disabled><option>Cargando asignaturas…</option></select></Field>;

  if (failed || !catalog.subjects.length) {
    return <>
      <Field label="Código de asignatura (nómina)"><input maxLength="80" value={subjectCode} onChange={e => set({ subjectCode: e.target.value.trim() })} placeholder="Ej. ELEC101"/></Field>
      <Field label="Sección (nómina)"><input maxLength="80" value={draft.sectionCode || ''} onChange={e => set({ sectionCode: e.target.value.trim() })} placeholder="Ej. 001"/></Field>
      <Field label="Período (nómina)"><input maxLength="80" value={draft.period || ''} onChange={e => set({ period: e.target.value.trim() })} placeholder="Ej. 2026-2"/></Field>
      <p className="nomina-hint">{failed ? 'No se pudo cargar la nómina; escribe los códigos manualmente.' : 'Aún no hay asignaturas importadas. Un administrador puede cargarlas en “Importar datos”.'}</p>
    </>;
  }

  const subjects = catalog.subjects;
  const subjectSections = catalog.sections.filter(s => s.subjectCode === subjectCode);
  const unknownSubject = subjectCode && !subjects.some(s => s.code === subjectCode);
  const unknownSection = sectionValue && !subjectSections.some(s => sectionKey(s.sectionCode, s.period) === sectionValue);
  const subjectName = code => subjects.find(s => s.code === code)?.name || code;
  const label = (code, section) => `${code} ${subjectName(code)} · Sección ${section.sectionCode}`;

  function chooseSubject(code) {
    const options = catalog.sections.filter(s => s.subjectCode === code);
    const only = options.length === 1 ? options[0] : null;
    const subject = subjects.find(s => s.code === code);
    set({
      subjectCode: code,
      sectionCode: only?.sectionCode || '',
      period: only?.period || '',
      ...(only ? { section: label(code, only) } : {}),
      ...(subject?.sede && !draft.sede ? { sede: subject.sede } : {}),
    });
  }

  function chooseSection(value) {
    const chosen = subjectSections.find(s => sectionKey(s.sectionCode, s.period) === value);
    if (!chosen) { set({ sectionCode: '', period: '' }); return; }
    set({ sectionCode: chosen.sectionCode, period: chosen.period, section: label(subjectCode, chosen) });
  }

  return <>
    <Field label="Asignatura (nómina)">
      <select value={subjectCode} onChange={e => chooseSubject(e.target.value)}>
        <option value="">Sin asignatura de nómina</option>
        {unknownSubject && <option value={subjectCode}>{subjectCode} (no está en la nómina actual)</option>}
        {subjects.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
      </select>
    </Field>
    <Field label="Sección y período (nómina)">
      <select value={sectionValue} disabled={!subjectCode} onChange={e => chooseSection(e.target.value)}>
        <option value="">{!subjectCode ? 'Elige primero la asignatura' : subjectSections.length ? 'Selecciona la sección' : 'Sin nómina para esta asignatura'}</option>
        {unknownSection && <option value={sectionValue}>Sección {draft.sectionCode} · {draft.period} (no está en la nómina actual)</option>}
        {subjectSections.map(s => <option key={sectionKey(s.sectionCode, s.period)} value={sectionKey(s.sectionCode, s.period)}>Sección {s.sectionCode} · {s.period} · {s.students} estudiante{s.students === 1 ? '' : 's'}</option>)}
      </select>
    </Field>
  </>;
}
