import { useState } from 'react';
import { FileUp, Info } from 'lucide-react';
import { PageTitle } from '../components/Feedback.jsx';
import { api } from '../services/api.js';
import './import.css';

const specs = {
  subjects: { label: 'Asignaturas', columns: ['codigo_asignatura', 'nombre', 'sede', 'carrera'], example: 'ELEC101,Circuitos eléctricos,Santiago,Electricidad' },
  roster: { label: 'Nómina / matrículas', columns: ['matricula', 'nombre_estudiante', 'codigo_asignatura', 'seccion', 'periodo'], example: '20260001,Ana Ejemplo,ELEC101,001,2026-2' },
};

function parseCsv(text, columns) {
  const lines = [];
  let row = [], field = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted && char === '"' && input[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) lines.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('El archivo tiene comillas sin cerrar.');
  row.push(field.trim()); if (row.some(Boolean)) lines.push(row);
  if (lines.length < 2) throw new Error('El CSV debe incluir encabezados y al menos una fila.');
  const headers = lines[0].map(value => value.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Hay encabezados repetidos.');
  const missing = columns.filter(column => !headers.includes(column));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}.`);
  return lines.slice(1).map(values => Object.fromEntries(headers.map((header, i) => [header, values[i] || ''])));
}

export default function ImportPage() {
  const [type, setType] = useState('subjects'); const [rows, setRows] = useState([]); const [fileName, setFileName] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function chooseFile(event) {
    const file = event.target.files?.[0]; setRows([]); setFileName(''); setError(''); setNotice('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) { setError('Selecciona un CSV de hasta 2 MB.'); return; }
    try { const parsed = parseCsv(await file.text(), specs[type].columns); setRows(parsed); setFileName(file.name); }
    catch (e) { setError(e.message); }
  }
  async function importRows() {
    setBusy(true); setError(''); setNotice('');
    try { const result = await api('/imports', { method: 'POST', body: { type, rows } }); setNotice(`Importación completada: ${result.imported} filas guardadas en ${result.collection}.`); setRows([]); setFileName(''); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const spec = specs[type];
  return <><PageTitle eyebrow="DATOS ACADÉMICOS" title="Importar asignaturas y nóminas" subtitle="Carga un CSV validado en la base de datos de la aplicación."/>
    <div className="callout info-callout"><Info size={18}/><span>Solo administradores pueden importar. Las filas se guardan mediante la API y la operación queda registrada en auditoría. Usa información ficticia en el entorno de prueba.</span></div>
    {error && <div className="form-error inline-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    <section className="form-card"><div className="form-grid two-col"><label className="field"><span>Tipo de archivo</span><select value={type} disabled={busy} onChange={e => { setType(e.target.value); setRows([]); setFileName(''); setError(''); setNotice(''); }}><option value="subjects">Asignaturas</option><option value="roster">Nómina / matrículas</option></select></label><div className="field"><span>Columnas requeridas (CSV UTF-8)</span><code>{spec.columns.join(', ')}</code></div></div>
      <p className="muted">Ejemplo: <code>{spec.example}</code></p><label className="field import-file"><span>Archivo CSV</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile}/></label>
      {fileName && <p className="muted">{fileName} · {rows.length} filas detectadas</p>}
      {rows.length > 0 && <div className="table-card import-preview"><div className="user-table-head"><strong>Vista previa</strong><span>Primeras {Math.min(5, rows.length)} de {rows.length}</span></div><div className="import-preview-grid" style={{'--columns': spec.columns.length}}>{spec.columns.map(col => <strong key={col}>{col}</strong>)}{rows.slice(0, 5).flatMap((row, i) => spec.columns.map(col => <span key={`${i}-${col}`}>{row[col] || '—'}</span>))}</div></div>}
      <button className="button primary" disabled={!rows.length || busy} onClick={importRows}><FileUp size={16}/>{busy ? 'Importando…' : `Importar ${rows.length || ''} filas`}</button>
    </section>
  </>;
}
