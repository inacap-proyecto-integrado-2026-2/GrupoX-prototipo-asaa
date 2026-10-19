import { requireRole, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const user = await requireUser(req); requireRole(user, ['admin','jefatura','coordinacion','gerencia']);
    const snapshot = await user.db.collection('auditEvents').orderBy('createdAt', 'desc').limit(200).get();
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await audit(user.db, user.FieldValue, { actor: user, action: 'audit.list', context: { resultCount: events.length } });
    return res.status(200).json({ events });
  } catch (error) { return publicError(res, error); }
}
