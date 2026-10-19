import { assertRecordAccess, requireUser } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const user = await requireUser(req);
    const { ref, record } = await assertRecordAccess(user, req.query.recordId);
    if (!['docente','admin'].includes(user.role) || record.ownerUid !== user.uid) throw httpError(403, 'Solo el docente responsable puede cerrar esta ficha.');
    if (record.status !== 'open') throw httpError(409, 'La ficha ya no está abierta.');
    if (record.type === 'Práctica' && (!record.talkTopic?.trim() || !record.talkDone)) throw httpError(400, 'Registra y confirma la charla de seguridad antes de cerrar.');
    await ref.update({ status: 'closed', closedAt: user.FieldValue.serverTimestamp(), closedBy: user.uid, updatedAt: user.FieldValue.serverTimestamp() });
    await audit(user.db, user.FieldValue, { actor: user, action: 'record.close', recordId: ref.id });
    return res.status(200).json({ ok: true, status: 'closed' });
  } catch (error) { return publicError(res, error); }
}
