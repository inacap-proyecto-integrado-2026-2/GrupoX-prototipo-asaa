import { requireRole, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

const required = {
  subjects: ['codigo_asignatura', 'nombre', 'sede', 'carrera'],
  roster: ['matricula', 'nombre_estudiante', 'codigo_asignatura', 'seccion', 'periodo'],
};
const clean = value => typeof value === 'string' ? value.trim() : '';
const validCode = value => /^[\p{L}\p{N}._-]{1,80}$/u.test(value);

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    requireRole(user, ['admin']);
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const { type, rows } = req.body || {};
    if (!required[type] || !Array.isArray(rows) || rows.length < 1 || rows.length > 1000) {
      throw httpError(400, 'Selecciona una importación válida (entre 1 y 1.000 filas).');
    }
    const fields = required[type];
    const normalized = rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw httpError(400, `La fila ${index + 2} no tiene un formato válido.`);
      const item = Object.fromEntries(fields.map(field => [field, clean(row[field])]));
      if (Object.values(item).some(value => !value || value.length > 200)) throw httpError(400, `La fila ${index + 2} tiene campos vacíos o demasiado largos.`);
      if (type === 'subjects' && !validCode(item.codigo_asignatura)) throw httpError(400, `Código de asignatura no válido en fila ${index + 2}.`);
      if (type === 'roster' && (!validCode(item.matricula) || !validCode(item.codigo_asignatura))) throw httpError(400, `Matrícula o código no válido en fila ${index + 2}.`);
      return item;
    });
    const keys = normalized.map(item => type === 'subjects'
      ? item.codigo_asignatura
      : `${item.periodo}_${item.codigo_asignatura}_${item.seccion}_${item.matricula}`);
    if (new Set(keys).size !== keys.length) throw httpError(400, 'El archivo contiene filas duplicadas para el mismo código o matrícula/asignatura/sección/período.');

    const collection = type === 'subjects' ? 'subjects' : 'enrollments';
    if (type === 'roster') {
      const subjectCodes = [...new Set(normalized.map(item => item.codigo_asignatura))];
      const subjectRefs = subjectCodes.map(code => user.db.collection('subjects').doc(encodeURIComponent(code)));
      const subjectSnapshots = await user.db.getAll(...subjectRefs);
      const missingSubjects = subjectCodes.filter((_, index) => !subjectSnapshots[index].exists);
      if (missingSubjects.length) throw httpError(400, `Importa primero estas asignaturas: ${missingSubjects.join(', ')}.`);
    }
    for (let start = 0; start < normalized.length; start += 400) {
      const batch = user.db.batch();
      normalized.slice(start, start + 400).forEach((item, offset) => {
        const id = keys[start + offset];
        const ref = user.db.collection(collection).doc(encodeURIComponent(id));
        batch.set(ref, { ...item, importedAt: user.FieldValue.serverTimestamp(), importedBy: user.uid }, { merge: true });
      });
      await batch.commit();
    }
    await audit(user.db, user.FieldValue, { actor: user, action: `import.${type}`, context: { collection, count: normalized.length } });
    return res.status(200).json({ imported: normalized.length, collection });
  } catch (error) { return publicError(res, error); }
}
