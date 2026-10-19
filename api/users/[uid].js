import { requireRole, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  try {
    const user = await requireUser(req); requireRole(user, ['admin']);
    const targetUid = req.query.uid;
    if (targetUid === user.uid) throw httpError(400, 'No puedes desactivar tu propia cuenta.');
    if (typeof req.body?.active !== 'boolean') throw httpError(400, 'Estado de cuenta no válido.');
    const ref = user.db.collection('users').doc(targetUid); const snap = await ref.get();
    if (!snap.exists) throw httpError(404, 'No se encontró la cuenta.');
    await ref.update({ active: req.body.active, updatedAt: user.FieldValue.serverTimestamp(), updatedBy: user.uid });
    await user.auth.updateUser(targetUid, { disabled: !req.body.active });
    await audit(user.db, user.FieldValue, { actor: user, action: req.body.active ? 'user.activate' : 'user.deactivate', context: { targetUid } });
    return res.status(200).json({ ok: true, active: req.body.active });
  } catch (error) { return publicError(res, error); }
}
