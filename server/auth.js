import { getServices, httpError } from './firebaseAdmin.js';

export async function requireUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw httpError(401, 'Inicia sesión para continuar.');
  const { auth, db, FieldValue } = getServices();
  let token;
  try { token = await auth.verifyIdToken(header.slice(7)); } catch { throw httpError(401, 'La sesión no es válida.'); }
  const ref = db.collection('users').doc(token.uid);
  let snapshot = await ref.get();
  if (!snapshot.exists && process.env.INITIAL_ADMIN_EMAIL?.toLowerCase() === token.email?.toLowerCase()) {
    const bootstrapRef = db.collection('_system').doc('bootstrap');
    await db.runTransaction(async tx => {
      const [currentUser, bootstrap] = await Promise.all([tx.get(ref), tx.get(bootstrapRef)]);
      if (!currentUser.exists && !bootstrap.exists) {
        tx.create(ref, { uid: token.uid, email: token.email, name: token.name || token.email, role: 'admin', active: true, createdAt: FieldValue.serverTimestamp(), bootstrap: true });
        tx.create(bootstrapRef, { firstAdminUid: token.uid, createdAt: FieldValue.serverTimestamp() });
      }
    });
    snapshot = await ref.get();
  }
  if (!snapshot.exists) throw httpError(403, 'La cuenta no tiene un perfil habilitado.');
  const profile = snapshot.data();
  if (!profile.active) throw httpError(403, 'La cuenta está desactivada.');
  return { uid: token.uid, email: token.email || profile.email, name: profile.name || token.name || '', role: profile.role, profile, db, auth, FieldValue };
}

export function requireRole(user, roles) { if (!roles.includes(user.role)) throw httpError(403, 'No tienes permiso para realizar esta acción.'); }
export function canReadAllRecords(user) { return ['admin', 'jefatura', 'coordinacion', 'prevencion', 'gerencia'].includes(user.role); }
export function canManageRecords(user) { return ['admin', 'jefatura', 'coordinacion'].includes(user.role); }
export function canReadRecord(user, record) { return canReadAllRecords(user) || (user.role === 'docente' && record.ownerUid === user.uid); }
// IDs de Firestore/Firebase Auth que llegan por URL o cuerpo: solo letras, números, guion y guion bajo.
// Evita el error 500 que lanza Firestore con barras, rutas o IDs demasiado largos.
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export async function assertRecordAccess(user, recordId) {
  if (!validId(recordId)) throw httpError(404, 'No se encontró la ficha.');
  const snap = await user.db.collection('records').doc(recordId).get();
  if (!snap.exists) throw httpError(404, 'No se encontró la ficha.');
  const record = snap.data();
  if (!canReadRecord(user, record)) throw httpError(403, 'No tienes acceso a esta ficha.');
  return { ref: snap.ref, record };
}
