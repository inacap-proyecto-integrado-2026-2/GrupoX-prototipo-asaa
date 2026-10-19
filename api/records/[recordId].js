import { assertRecordAccess, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';
import { sanitizeRecord } from '../../server/validation.js';

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    const recordId = req.query.recordId;
    const { ref, record } = await assertRecordAccess(user, recordId);
    if (req.method === 'GET') {
      await audit(user.db, user.FieldValue, { actor: user, action: 'record.read', recordId });
      return res.status(200).json({ record: { id: ref.id, ...record } });
    }
    if (req.method === 'PATCH') {
      if (!['docente','admin','jefatura','coordinacion'].includes(user.role) || record.ownerUid !== user.uid) throw httpError(403, 'Solo el docente responsable puede editar esta ficha.');
      if (!['open','correction_open'].includes(record.status)) throw httpError(409, 'La ficha no está habilitada para edición.');
      const correctionId = req.body?.correctionId;
      if (record.status === 'correction_open') {
        const approvedId = record.approvedCorrectionId;
        if (!approvedId || (correctionId && correctionId !== approvedId)) throw httpError(400, 'Falta asociar la corrección aprobada.');
        const correction = await ref.collection('corrections').doc(approvedId).get();
        if (!correction.exists || correction.data().status !== 'approved') throw httpError(409, 'La corrección no está aprobada.');
      }
      const patch = sanitizeRecord(req.body, { partial: true });
      if (!Object.keys(patch).length) throw httpError(400, 'No hay cambios para guardar.');
      const nextStatus = record.status === 'correction_open' ? 'closed' : record.status;
      const before = Object.fromEntries(Object.keys(patch).map(key => [key, record[key] ?? null]));
      await ref.update({ ...patch, status: nextStatus, updatedAt: user.FieldValue.serverTimestamp(), ...(record.status === 'correction_open' ? { approvedCorrectionId: user.FieldValue.delete() } : {}), ...(nextStatus === 'closed' ? { closedAt: user.FieldValue.serverTimestamp() } : {}) });
      await audit(user.db, user.FieldValue, { actor: user, action: record.status === 'correction_open' ? 'record.correct' : 'record.update', recordId, context: { before, after: patch, correctionId: record.approvedCorrectionId || null } });
      const updated = await ref.get();
      return res.status(200).json({ record: { id: ref.id, ...updated.data() } });
    }
    return methodNotAllowed(res, ['GET', 'PATCH']);
  } catch (error) { return publicError(res, error); }
}
