import { assertRecordAccess, canManageRecords, requireUser } from '../../../../server/auth.js';
import { audit } from '../../../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  try {
    const user = await requireUser(req);
    if (!canManageRecords(user)) throw httpError(403, 'Solo jefatura, coordinación o administración puede decidir una corrección.');
    const { ref, record } = await assertRecordAccess(user, req.query.recordId);
    if (record.status !== 'correction_pending') throw httpError(409, 'La ficha no tiene una solicitud pendiente.');
    const correctionRef = ref.collection('corrections').doc(req.query.correctionId);
    const correctionSnap = await correctionRef.get();
    if (!correctionSnap.exists || correctionSnap.data().status !== 'pending') throw httpError(404, 'No se encontró una solicitud pendiente.');
    const decision = req.body?.decision;
    if (!['approved','rejected'].includes(decision)) throw httpError(400, 'Decisión no válida.');
    await correctionRef.update({ status: decision, decidedBy: user.uid, decidedAt: user.FieldValue.serverTimestamp(), decisionNote: String(req.body?.note || '').slice(0, 1000) });
    await ref.update({ status: decision === 'approved' ? 'correction_open' : 'closed', ...(decision === 'approved' ? { approvedCorrectionId: correctionRef.id } : {}), updatedAt: user.FieldValue.serverTimestamp() });
    await audit(user.db, user.FieldValue, { actor: user, action: `correction.${decision}`, recordId: ref.id, context: { correctionId: correctionRef.id, note: String(req.body?.note || '').slice(0, 1000) } });
    return res.status(200).json({ ok: true, status: decision });
  } catch (error) { return publicError(res, error); }
}
