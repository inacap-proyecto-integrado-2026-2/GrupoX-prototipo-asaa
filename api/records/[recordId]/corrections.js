import { assertRecordAccess, canManageRecords, requireUser, validId } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';
import { validateCorrectionReason } from '../../../server/validation.js';

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    const { ref, record } = await assertRecordAccess(user, req.query.recordId);

    // PATCH /api/records/:recordId/corrections/:correctionId
    if (req.method === 'PATCH') {
      const correctionId = req.query.correctionId;
      if (!correctionId) throw httpError(400, 'Identificador de corrección requerido.');
      if (!validId(correctionId)) throw httpError(404, 'No se encontró una solicitud pendiente.');
      if (!canManageRecords(user)) throw httpError(403, 'Solo jefatura, coordinación o administración puede decidir una corrección.');
      if (record.status !== 'correction_pending') throw httpError(409, 'La ficha no tiene una solicitud pendiente.');
      const correctionRef = ref.collection('corrections').doc(correctionId);
      const correctionSnap = await correctionRef.get();
      if (!correctionSnap.exists || correctionSnap.data().status !== 'pending') throw httpError(404, 'No se encontró una solicitud pendiente.');
      const decision = req.body?.decision;
      if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'Decisión no válida.');
      await correctionRef.update({
        status: decision,
        decidedBy: user.uid,
        decidedAt: user.FieldValue.serverTimestamp(),
        decisionNote: String(req.body?.note || '').slice(0, 1000),
      });
      await ref.update({
        status: decision === 'approved' ? 'correction_open' : 'closed',
        ...(decision === 'approved' ? { approvedCorrectionId: correctionRef.id } : {}),
        updatedAt: user.FieldValue.serverTimestamp(),
      });
      await audit(user.db, user.FieldValue, {
        actor: user,
        action: `correction.${decision}`,
        recordId: ref.id,
        context: { correctionId: correctionRef.id, note: String(req.body?.note || '').slice(0, 1000) },
      });
      return res.status(200).json({ ok: true, status: decision });
    }

    // GET /api/records/:recordId/corrections
    if (req.method === 'GET') {
      if (!canManageRecords(user) && record.ownerUid !== user.uid) throw httpError(403, 'No tienes permiso para consultar correcciones.');
      const snapshot = await ref.collection('corrections').orderBy('createdAt', 'desc').get();
      await audit(user.db, user.FieldValue, { actor: user, action: 'correction.list', recordId: ref.id, context: { resultCount: snapshot.size } });
      return res.status(200).json({ corrections: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    }

    // POST /api/records/:recordId/corrections
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

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (error) {
    return publicError(res, error);
  }
}
