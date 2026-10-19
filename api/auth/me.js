import { requireUser } from '../../server/auth.js';
import { methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try { const user = await requireUser(req); return res.status(200).json({ profile: { uid: user.uid, email: user.email, name: user.name, role: user.role, active: true } }); }
  catch (error) { return publicError(res, error); }
}
