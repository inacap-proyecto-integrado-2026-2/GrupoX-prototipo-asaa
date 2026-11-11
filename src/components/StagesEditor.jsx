import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';

const MAX_PER_LIST = 20; // límite de la API por etapa
const emptyStage = () => ({ description: '', risks: [], controls: [] });

function ChoiceList({ title, options, values, onChange }) {
  const toggle = option => onChange(values.includes(option) ? values.filter(v => v !== option) : values.length < MAX_PER_LIST ? [...values, option] : values);
  return <div className="stage-choice">
    <div className="stage-choice-head"><strong>{title}</strong><span>{values.length ? `${values.length} seleccionado${values.length === 1 ? '' : 's'}` : 'Puedes elegir varios'}</span></div>
    <div className="check-options">{options.map(option => <label key={option} className={`check-option ${values.includes(option) ? 'chosen' : ''}`}>
      <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)}/><span className="fake-check">{values.includes(option) && <Check size={12}/>}</span>{option}
    </label>)}</div>
  </div>;
}

// Etapas del trabajo: se edita una a la vez (nombre + riesgos + medidas) y al guardarla queda como tarjeta resumida.
// setStages recibe una función (stages => nuevasStages) para no trabajar sobre un estado desactualizado.
export default function StagesEditor({ stages = [], setStages, riskOptions, controlOptions }) {
  const saved = stages.filter(stage => stage.description?.trim());
  const [editing, setEditing] = useState(() => (saved.length ? null : { index: null, ...emptyStage() }));
  const editingRef = useRef(editing); editingRef.current = editing;

  const commit = current => {
    if (!current?.description.trim()) return;
    const stage = { description: current.description.trim(), risks: current.risks, controls: current.controls };
    setStages(list => {
      const clean = list.filter(s => s.description?.trim());
      return current.index === null ? [...clean, stage] : clean.map((s, i) => (i === current.index ? stage : s));
    });
  };

  // Si se cambia de paso con una etapa a medio escribir, se guarda igual para no perderla.
  useEffect(() => () => commit(editingRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => { commit(editing); setEditing(null); };
  const remove = index => { setStages(list => list.filter(s => s.description?.trim()).filter((_, i) => i !== index)); setEditing(v => (!v || v.index === null ? v : v.index === index ? null : v.index > index ? { ...v, index: v.index - 1 } : v)); };
  const edit = index => { commit(editing); setEditing({ index, ...emptyStage(), ...saved[index] }); };

  const editor = editing && <div className="stage-editor">
      <div className="stage-editor-title">{editing.index === null ? `Nueva etapa ${String(saved.length + 1).padStart(2, '0')}` : `Editando etapa ${String(editing.index + 1).padStart(2, '0')}`}</div>
      <label className="field"><span>Nombre de la etapa</span>
        <input autoFocus maxLength="1000" value={editing.description} onChange={e => setEditing(v => ({ ...v, description: e.target.value }))} placeholder="Ej. Desenergizar el tablero"/>
      </label>
      <ChoiceList title="Riesgos de esta etapa" options={riskOptions} values={editing.risks} onChange={risks => setEditing(v => ({ ...v, risks }))}/>
      <ChoiceList title="Medidas de control de esta etapa" options={controlOptions} values={editing.controls} onChange={controls => setEditing(v => ({ ...v, controls }))}/>
      <div className="stage-editor-actions">
        {(saved.length > 0 || editing.index !== null) && <button type="button" className="button small secondary" onClick={() => setEditing(null)}>Cancelar</button>}
        <button type="button" className="button small primary" disabled={!editing.description.trim()} onClick={save}><Check size={15}/> Guardar etapa</button>
      </div>
    </div>;

  return <div className="stages">
    {saved.map((stage, i) => editing?.index === i ? <div key={i}>{editor}</div> : <div className="stage-card" key={i}>
      <span className="stage-num">{String(i + 1).padStart(2, '0')}</span>
      <div className="stage-card-body">
        <strong>{stage.description}</strong>
        <div className="stage-tags"><em>Riesgos</em>{stage.risks?.length ? stage.risks.map(r => <span className="tag risk" key={r}>{r}</span>) : <span className="tag empty">Sin riesgos</span>}</div>
        <div className="stage-tags"><em>Medidas</em>{stage.controls?.length ? stage.controls.map(c => <span className="tag control" key={c}>{c}</span>) : <span className="tag empty">Sin medidas</span>}</div>
      </div>
      <div className="stage-card-actions">
        <button type="button" className="icon-btn" onClick={() => edit(i)} aria-label={`Editar etapa ${i + 1}`} title="Editar"><Pencil size={14}/></button>
        <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Eliminar etapa ${i + 1}`} title="Eliminar"><Trash2 size={14}/></button>
      </div>
    </div>)}

    {editing?.index === null ? editor : <button type="button" className="button small secondary stage-add" onClick={() => { commit(editing); setEditing({ index: null, ...emptyStage() }); }}><Plus size={15}/> {saved.length ? 'Agregar otra etapa' : 'Agregar etapa'}</button>}
  </div>;
}
