import { requireRole, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

const roles = ['docente','estudiante','panol','prevencion','gerencia','jefatura','coordinacion','admin'];
export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req); requireRole(user, ['admin']);
    if (req.method === 'GET') {
      const snapshot = await user.db.collection('users').orderBy('createdAt', 'desc').limit(300).get();
      return res.status(200).json({ users: snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) });
    }
    if (req.method === 'POST') {
      const { email, name, role } = req.body || {};
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof name !== 'string' || name.trim().length < 2 || !roles.includes(role)) throw httpError(400, 'Completa nombre, correo y un rol válido.');
      const authUser = await user.auth.createUser({ email: email.trim().toLowerCase(), displayName: name.trim(), emailVerified: false, disabled: false });
      try { await user.db.collection('users').doc(authUser.uid).create({ uid: authUser.uid, email: authUser.email, name: name.trim(), role, active: true, createdAt: user.FieldValue.serverTimestamp(), createdBy: user.uid }); }
      catch (error) { await user.auth.deleteUser(authUser.uid); throw error; }
      await audit(user.db, user.FieldValue, { actor: user, action: 'user.create', context: { targetUid: authUser.uid, role } });
      return res.status(201).json({ user: { uid: authUser.uid, email: authUser.email, name: name.trim(), role, active: true } });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) { return publicError(res, error); }
}
