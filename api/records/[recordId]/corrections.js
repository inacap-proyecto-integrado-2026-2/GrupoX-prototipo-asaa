import { assertRecordAccess, canManageRecords, requireUser } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';
import { validateCorrectionReason } from '../../../server/validation.js';

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    const { ref, record } = await assertRecordAccess(user, req.query.recordId);
    if (req.method === 'GET') {
      if (!canManageRecords(user) && record.ownerUid !== user.uid) throw httpError(403, 'No tienes permiso para consultar correcciones.');
      const snapshot = await ref.collection('corrections').orderBy('createdAt', 'desc').get();
      return res.status(200).json({ corrections: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    }
    if (req.method === 'POST') {
      if (user.role !== 'docente' || record.ownerUid !== user.uid) throw httpError(403, 'Solo el docente responsable puede solicitar una corrección.');
      if (record.status !== 'closed') throw httpError(409, 'Solo se puede solicitar corrección para una ficha cerrada.');
      const reason = validateCorrectionReason(req.body?.reason);
      const correctionRef = ref.collection('corrections').doc();
      await correctionRef.create({ reason, status: 'pending', requestedBy: user.uid, requesterEmail: user.email, createdAt: user.FieldValue.serverTimestamp() });
      await ref.update({ status: 'correction_pending', updatedAt: user.FieldValue.serverTimestamp() });
      await audit(user.db, user.FieldValue, { actor: user, action: 'correction.request', recordId: ref.id, context: { correctionId: correctionRef.id, reason } });
      return res.status(201).json({ correction: { id: correctionRef.id, reason, status: 'pending' } });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) { return publicError(res, error); }
}
