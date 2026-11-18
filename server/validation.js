import { httpError } from './firebaseAdmin.js';

const editableFields = ['type','activity','specialty','date','sede','docente','section','place','level','equipment','ppe','environment','controls','risks','stages','executionStaff','observations','far','farList','talkTopic','talkStart','talkDuration','talkDone','loto','paper','attendance','subjectCode','sectionCode','period'];
const textFields = ['activity','specialty','date','sede','docente','section','place','level','observations','farList','talkTopic','talkStart','subjectCode','sectionCode','period'];
const arrays = ['equipment','ppe','environment','controls','risks','stages','executionStaff','attendance'];
export function sanitizeRecord(input = {}, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError(400, 'Los datos enviados no tienen un formato válido.');
  const output = {};
  for (const key of editableFields) {
    if (partial && !(key in input)) continue;
    if (!(key in input)) continue;
    const value = input[key];
    if (key === 'type') {
      if (!['Práctica','Teórica'].includes(value)) throw httpError(400, 'El tipo de actividad debe ser Práctica o Teórica.');
      output.type = value;
    } else if (textFields.includes(key)) {
      if (typeof value !== 'string' || value.length > 5000) throw httpError(400, `El campo ${key} no es válido.`);
      output[key] = value.trim();
    } else if (arrays.includes(key)) {
      if (!Array.isArray(value) || value.length > 100) throw httpError(400, `La lista ${key} no es válida.`);
      output[key] = value.slice(0, 100).map(item => {
        if (typeof item === 'string' && item.length <= 1000) return item.trim();
        if (key === 'stages' && item && typeof item === 'object' && !Array.isArray(item)) {
          if (typeof item.description !== 'string' || item.description.length > 1000 || !Array.isArray(item.risks) || !Array.isArray(item.controls) || item.risks.length > 20 || item.controls.length > 20 || [...item.risks, ...item.controls].some(value => typeof value !== 'string' || value.length > 500)) throw httpError(400, 'Una etapa del trabajo contiene datos no válidos.');
          return { description: item.description.trim(), risks: item.risks.map(value => value.trim()), controls: item.controls.map(value => value.trim()) };
        }
        if (key === 'attendance' && item && typeof item === 'object' && !Array.isArray(item)) {
          if (typeof item.name !== 'string' || item.name.length > 200 || !['Pendiente','Presente','Atraso','Ausente'].includes(item.state)) throw httpError(400, 'La asistencia contiene un valor no válido.');
          if (item.matricula !== undefined && (typeof item.matricula !== 'string' || item.matricula.length > 80)) throw httpError(400, 'La asistencia contiene una matrícula no válida.');
          if (item.reason !== undefined && (typeof item.reason !== 'string' || item.reason.length > 300)) throw httpError(400, 'El motivo de asistencia no es válido (máximo 300 caracteres).');
          if (item.individualTalk !== undefined && typeof item.individualTalk !== 'boolean') throw httpError(400, 'La charla individual no es válida.');
          const individualTalk = item.state === 'Atraso' && item.individualTalk === true;
          return {
            name: item.name.trim(), ...(item.matricula ? { matricula: item.matricula.trim() } : {}), state: item.state,
            method: ['Registro docente','QR'].includes(item.method) ? item.method : 'Registro docente',
            time: typeof item.time === 'string' && item.time.length <= 40 ? item.time : '',
            // Motivo del registro manual (p. ej. "Sin teléfono") y charla individual entregada a quien llegó atrasado.
            ...(item.reason?.trim() ? { reason: item.reason.trim() } : {}),
            ...(individualTalk ? { individualTalk: true, individualTalkAt: typeof item.individualTalkAt === 'string' && item.individualTalkAt.length <= 40 ? item.individualTalkAt : new Date().toISOString() } : {}),
          };
        }
        throw httpError(400, `La lista ${key} contiene un valor no válido.`);
      });
    } else if (typeof value === 'boolean' || (key === 'talkDuration' && (typeof value === 'string' || typeof value === 'number'))) output[key] = value;
    else throw httpError(400, `El campo ${key} no es válido.`);
  }
  if (!partial && (!output.activity || !output.date || !output.docente || !output.place || !['Práctica','Teórica'].includes(output.type))) throw httpError(400, 'Completa tipo, actividad, fecha, docente y lugar.');
  if (output.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(output.date)) throw httpError(400, 'La fecha no tiene un formato válido.');
  if (output.talkDuration !== undefined && output.talkDuration !== '' && (!Number.isFinite(Number(output.talkDuration)) || Number(output.talkDuration) < 1 || Number(output.talkDuration) > 480)) throw httpError(400, 'La duración de la charla debe estar entre 1 y 480 minutos.');
  for (const key of ['subjectCode','sectionCode','period']) if (output[key] && !/^[\p{L}\p{N}._-]{1,80}$/u.test(output[key])) throw httpError(400, 'Código de asignatura, sección o período no válido (sin espacios).');
  return output;
}
export function validateCorrectionReason(reason) { if (typeof reason !== 'string' || reason.trim().length < 8 || reason.length > 2000) throw httpError(400, 'Describe el motivo de la corrección (al menos 8 caracteres).'); return reason.trim(); }
