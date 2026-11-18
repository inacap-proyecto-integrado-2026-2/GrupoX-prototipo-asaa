import { requireRole, requireUser, validId } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';

const roles = ['docente', 'estudiante', 'panol', 'prevencion', 'gerencia', 'jefatura', 'coordinacion', 'admin'];

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    requireRole(user, ['admin']);

    // PATCH /api/users/:uid
    if (req.method === 'PATCH') {
      const targetUid = req.query.uid;
      if (!targetUid) throw httpError(400, 'Identificador de usuario requerido.');
      if (!validId(targetUid)) throw httpError(404, 'No se encontró la cuenta.');
      const { active, role } = req.body || {};
      if (active === undefined && role === undefined) throw httpError(400, 'No hay cambios para guardar.');
      if (active !== undefined && typeof active !== 'boolean') throw httpError(400, 'Estado de cuenta no válido.');
      if (role !== undefined && !roles.includes(role)) throw httpError(400, 'El rol no es válido.');
      if (targetUid === user.uid && active === false) throw httpError(400, 'No puedes desactivar tu propia cuenta.');
      if (targetUid === user.uid && role && role !== 'admin') throw httpError(400, 'No puedes retirar tu propio rol de administrador.');

      const ref = user.db.collection('users').doc(targetUid);
      const snap = await ref.get();
      if (!snap.exists) throw httpError(404, 'No se encontró la cuenta.');
      const before = snap.data();
      if (before.role === 'admin' && ((role && role !== 'admin') || active === false)) {
        const adminCount = await user.db
          .collection('users')
          .where('role', '==', 'admin')
          .where('active', '==', true)
          .count()
          .get();
        if (adminCount.data().count <= 1) throw httpError(409, 'Debe existir al menos una cuenta administradora activa.');
      }
      const changes = { updatedAt: user.FieldValue.serverTimestamp(), updatedBy: user.uid };
      if (active !== undefined) changes.active = active;
      if (role !== undefined) changes.role = role;
      await ref.update(changes);
      if (active !== undefined) await user.auth.updateUser(targetUid, { disabled: !active });
      await audit(user.db, user.FieldValue, {
        actor: user,
        action: 'user.update',
        context: {
          targetUid,
          before: { active: before.active, role: before.role },
          after: { active: active ?? before.active, role: role ?? before.role },
        },
      });
      return res.status(200).json({ ok: true, active: active ?? before.active, role: role ?? before.role });
    }

    // GET /api/users
    if (req.method === 'GET') {
      const snapshot = await user.db.collection('users').orderBy('createdAt', 'desc').limit(300).get();
      await audit(user.db, user.FieldValue, { actor: user, action: 'users.list', context: { resultCount: snapshot.size } });
      return res.status(200).json({ users: snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) });
    }

    // POST /api/users
    if (req.method === 'POST') {
      const { email, name, role } = req.body || {};
      if (
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof name !== 'string' ||
        name.trim().length < 2 ||
        !roles.includes(role)
      ) {
        throw httpError(400, 'Completa nombre, correo y un rol válido.');
      }
      const authUser = await user.auth.createUser({
        email: email.trim().toLowerCase(),
        displayName: name.trim(),
        emailVerified: false,
        disabled: false,
      });
      try {
        await user.db.collection('users').doc(authUser.uid).create({
          uid: authUser.uid,
          email: authUser.email,
          name: name.trim(),
          role,
          active: true,
          createdAt: user.FieldValue.serverTimestamp(),
          createdBy: user.uid,
        });
      } catch (error) {
        await user.auth.deleteUser(authUser.uid);
        throw error;
      }
      await audit(user.db, user.FieldValue, { actor: user, action: 'user.create', context: { targetUid: authUser.uid, role } });
      return res.status(201).json({
        user: { uid: authUser.uid, email: authUser.email, name: name.trim(), role, active: true },
      });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (error) {
    return publicError(res, error);
  }
}
