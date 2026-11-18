import { audit } from '../../server/audit.js';
import { getServices, httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';
import { enrollmentDocId, isValidToken, sessionExpired, validMatricula } from '../../server/qr.js';

// Endpoint público: el estudiante no tiene cuenta. La protección es el código QR rotativo
// (exige estar frente a la pantalla), la sesión corta, la validación contra la nómina importada
// y el límite de una matrícula por dispositivo en cada sesión.
const MAX_FAILED_ATTEMPTS = 60;
const expiredMessage = 'Este código QR ya no está activo. Pide al docente que lo muestre nuevamente.';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { sessionId, token, matricula: rawMatricula, deviceId } = req.body || {};
    const matricula = typeof rawMatricula === 'string' ? rawMatricula.trim() : '';
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(sessionId)) throw httpError(400, 'El enlace del código QR no es válido. Vuelve a escanearlo.');
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(deviceId)) throw httpError(400, 'Actualiza la página del código QR e intenta nuevamente.');
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

    // Cada navegador genera un identificador de dispositivo: un mismo teléfono solo puede marcar una matrícula por sesión.
    const checkinRef = sessionRef.collection('checkins').doc(encodeURIComponent(matricula));
    const deviceRef = sessionRef.collection('devices').doc(deviceId);
    const result = await db.runTransaction(async tx => {
      const [current, existing, device] = await Promise.all([tx.get(sessionRef), tx.get(checkinRef), tx.get(deviceRef)]);
      if (!current.exists || sessionExpired(current.data())) throw httpError(410, expiredMessage);
      if (existing.exists) return { status: 'duplicate', sameDevice: existing.data().deviceId === deviceId };
      if (device.exists) return { status: 'device_reused', firstMatricula: device.data().matricula };
      tx.create(checkinRef, { matricula, name, deviceId, checkedAt: FieldValue.serverTimestamp() });
      tx.create(deviceRef, { matricula, checkedAt: FieldValue.serverTimestamp() });
      return { status: 'ok' };
    });
    const actor = { uid: null, email: null, role: 'estudiante-qr' };
    if (result.status === 'device_reused') {
      await audit(db, FieldValue, { actor, action: 'attendance.qr.device_reused', recordId: session.recordId, context: { sessionId, matricula, firstMatricula: result.firstMatricula } });
      throw httpError(409, 'Este dispositivo ya registró una asistencia en esta sesión. Si necesitas marcar a otra persona, pide al docente que la registre manualmente.');
    }
    const already = result.status === 'duplicate';
    await audit(db, FieldValue, { actor, action: already ? 'attendance.qr.duplicate' : 'attendance.qr.checkin', recordId: session.recordId, context: { sessionId, matricula, ...(already ? { sameDevice: result.sameDevice } : {}) } });
    // Solo se devuelve el primer nombre para no exponer datos de la nómina.
    const late = !already && Boolean(session.lateAfter) && Date.now() > session.lateAfter;
    return res.status(200).json({ ok: true, already, late, firstName: String(name || '').split(' ')[0] });
  } catch (error) { return publicError(res, error); }
}
