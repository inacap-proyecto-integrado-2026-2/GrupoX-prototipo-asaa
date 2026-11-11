import { requireRole, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

const required = {
  subjects: ['codigo_asignatura', 'nombre', 'sede', 'carrera'],
  roster: ['matricula', 'nombre_estudiante', 'codigo_asignatura', 'seccion', 'periodo'],
};
const clean = value => typeof value === 'string' ? value.trim() : '';
const validCode = value => /^[\p{L}\p{N}._-]{1,80}$/u.test(value);

// Catálogo para el formulario de fichas: asignaturas importadas y sus secciones/períodos según la nómina.
// No expone matrículas ni nombres de estudiantes; solo códigos y cantidad de inscritos.
async function catalog(user) {
  requireRole(user, ['admin', 'docente', 'jefatura', 'coordinacion']);
  const [subjectsSnap, enrollmentsSnap] = await Promise.all([
    user.db.collection('subjects').limit(2000).get(),
    user.db.collection('enrollments').select('codigo_asignatura', 'seccion', 'periodo').limit(20000).get(),
  ]);
  const sections = new Map();
  enrollmentsSnap.forEach(doc => {
    const { codigo_asignatura: subjectCode, seccion: sectionCode, periodo: period } = doc.data();
    const key = `${subjectCode}\u0000${sectionCode}\u0000${period}`;
    const entry = sections.get(key) || { subjectCode, sectionCode, period, students: 0 };
    entry.students += 1;
    sections.set(key, entry);
  });
  const subjects = subjectsSnap.docs
    .map(doc => { const s = doc.data(); return { code: s.codigo_asignatura, name: s.nombre, sede: s.sede, career: s.carrera }; })
    .sort((a, b) => a.code.localeCompare(b.code));
  const sectionList = [...sections.values()].sort((a, b) => b.period.localeCompare(a.period) || a.subjectCode.localeCompare(b.subjectCode) || a.sectionCode.localeCompare(b.sectionCode, undefined, { numeric: true }));
  return { subjects, sections: sectionList };
}

// Estudiantes de una asignatura/sección/período, para precargar la asistencia de la ficha.
async function roster(user, query) {
  requireRole(user, ['admin', 'docente', 'jefatura', 'coordinacion']);
  const [subject, section, period] = [query.subject, query.section, query.period].map(clean);
  if (![subject, section, period].every(validCode)) throw httpError(400, 'Indica asignatura, sección y período válidos.');
  const snapshot = await user.db.collection('enrollments')
    .where('codigo_asignatura', '==', subject).where('seccion', '==', section).where('periodo', '==', period)
    .limit(101).get();
  if (snapshot.size > 100) throw httpError(400, 'La nómina supera el máximo de 100 estudiantes por ficha.');
  const students = snapshot.docs
    .map(doc => ({ matricula: doc.data().matricula, name: doc.data().nombre_estudiante }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  await audit(user.db, user.FieldValue, { actor: user, action: 'roster.read', context: { subject, section, period, resultCount: students.length } });
  return { students };
}

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    if (req.method === 'GET') return res.status(200).json(req.query.subject ? await roster(user, req.query) : await catalog(user));
    requireRole(user, ['admin']);
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
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
