import { assertRecordAccess, requireUser } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { const user = await requireUser(req); const { ref } = await assertRecordAccess(user, req.query.recordId); await audit(user.db, user.FieldValue, { actor: user, action: 'record.export', recordId: ref.id }); return res.status(200).json({ ok: true }); }
  catch (error) { return publicError(res, error); }
}
