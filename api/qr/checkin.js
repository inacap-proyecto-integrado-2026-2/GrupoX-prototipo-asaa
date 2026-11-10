import { audit } from '../../server/audit.js';
import { getServices, httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';
import { enrollmentDocId, isValidToken, sessionExpired, validMatricula } from '../../server/qr.js';

// Endpoint público: el estudiante no tiene cuenta. La protección es el código QR rotativo
// (exige estar frente a la pantalla), la sesión corta y la validación contra la nómina importada.
const MAX_FAILED_ATTEMPTS = 60;
const expiredMessage = 'Este código QR ya no está activo. Pide al docente que lo muestre nuevamente.';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { sessionId, token, matricula: rawMatricula } = req.body || {};
    const matricula = typeof rawMatricula === 'string' ? rawMatricula.trim() : '';
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(sessionId)) throw httpError(400, 'El enlace del código QR no es válido. Vuelve a escanearlo.');
    if (!validMatricula(matricula)) throw httpError(400, 'Escribe tu matrícula sin espacios.');

    const { db, FieldValue } = getServices();
    const sessionRef = db.collection('attendanceSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists || sessionExpired(sessionSnap.data())) throw httpError(410, expiredMessage);
    const session = sessionSnap.data();
    if (session.failedAttempts >= MAX_FAILED_ATTEMPTS) throw httpError(429, 'Demasiados intentos fallidos en esta sesión. Pide al docente que genere un nuevo código QR.');
    if (!isValidToken(session.secret, sessionId, token)) throw httpError(400, 'El código QR ya cambió. Escanea el código que se muestra ahora en pantalla.');

    const enrollment = await db.collection('enrollments').doc(enrollmentDocId(session, matricula)).get();
    if (!enrollment.exists) {
      await sessionRef.update({ failedAttempts: FieldValue.increment(1) });
      throw httpError(404, 'Tu matrícula no figura en la nómina de esta sección. Revisa que esté bien escrita o avisa al docente.');
    }
    const name = enrollment.data().nombre_estudiante;

    const checkinRef = sessionRef.collection('checkins').doc(encodeURIComponent(matricula));
    const already = await db.runTransaction(async tx => {
      const [current, existing] = await Promise.all([tx.get(sessionRef), tx.get(checkinRef)]);
      if (!current.exists || sessionExpired(current.data())) throw httpError(410, expiredMessage);
      if (existing.exists) return true;
      tx.create(checkinRef, { matricula, name, checkedAt: FieldValue.serverTimestamp() });
      return false;
    });
    if (!already) await audit(db, FieldValue, { actor: { uid: null, email: null, role: 'estudiante-qr' }, action: 'attendance.qr.checkin', recordId: session.recordId, context: { sessionId, matricula } });
    // Solo se devuelve el primer nombre para no exponer datos de la nómina.
    return res.status(200).json({ ok: true, already, firstName: String(name || '').split(' ')[0] });
  } catch (error) { return publicError(res, error); }
}
