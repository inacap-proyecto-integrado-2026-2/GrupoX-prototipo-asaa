import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { httpError } from './firebaseAdmin.js';

// El código QR cambia cada ventana; se aceptan la actual y las anteriores para dar tiempo a escribir la matrícula.
export const QR_WINDOW_MS = 30_000;
const ACCEPTED_PREVIOUS_WINDOWS = 2;
export const QR_SESSION_MINUTES = 20;

export const newSecret = () => randomBytes(32).toString('hex');
export const currentWindow = (now = Date.now()) => Math.floor(now / QR_WINDOW_MS);
export const tokenFor = (secret, sessionId, window) => createHmac('sha256', secret).update(`${sessionId}:${window}`).digest('hex').slice(0, 20);

export function isValidToken(secret, sessionId, token, now = Date.now()) {
  if (typeof token !== 'string' || !/^[0-9a-f]{20}$/.test(token)) return false;
  const given = Buffer.from(token);
  const window = currentWindow(now);
  for (let offset = 0; offset <= ACCEPTED_PREVIOUS_WINDOWS; offset++) {
    if (timingSafeEqual(given, Buffer.from(tokenFor(secret, sessionId, window - offset)))) return true;
  }
  return false;
}

export const validMatricula = value => typeof value === 'string' && /^[\p{L}\p{N}._-]{1,80}$/u.test(value);
// Misma clave que usa api/imports para la colección enrollments.
export const enrollmentDocId = ({ period, subjectCode, sectionCode }, matricula) => encodeURIComponent(`${period}_${subjectCode}_${sectionCode}_${matricula}`);

export function requireRosterLink(record) {
  if (!record.subjectCode || !record.sectionCode || !record.period) throw httpError(400, 'Indica código de asignatura, sección y período en la ficha para usar la asistencia QR.');
  return { subjectCode: record.subjectCode, sectionCode: record.sectionCode, period: record.period };
}

export const sessionExpired = (session, now = Date.now()) => !session.active || (session.expiresAt?.toMillis?.() ?? 0) <= now;

// Cierra la sesión QR y traspasa sus marcas a record.attendance; los pendientes de la nómina pasan a Ausente. Es idempotente.
// Primero se desactiva la sesión (las marcas se crean en una transacción que exige active=true),
// así ninguna marca puede llegar después de leer la lista.
export async function finishSession(db, FieldValue, recordRef, sessionId) {
  const sessionRef = db.collection('attendanceSessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return 0;
  if (sessionSnap.data().active) await sessionRef.update({ active: false, endedAt: FieldValue.serverTimestamp() });
  const checkins = await sessionRef.collection('checkins').get();
  return db.runTransaction(async tx => {
    const recordSnap = await tx.get(recordRef);
    if (!recordSnap.exists) return 0;
    const attendance = [...(recordSnap.data().attendance || [])];
    let merged = 0;
    for (const doc of checkins.docs) {
      const checkin = doc.data();
      const time = checkin.checkedAt?.toDate?.().toISOString() || '';
      const index = attendance.findIndex(item => item.matricula === checkin.matricula);
      if (index >= 0) {
        // Un "Ausente" puesto automáticamente al cerrar una sesión QR anterior sí se reemplaza por la nueva marca.
        const autoAbsent = attendance[index].method === 'QR' && attendance[index].state === 'Ausente';
        if (attendance[index].method === 'QR' && !autoAbsent) continue;
        // Si el docente ya marcó manualmente un estado distinto de Pendiente, se respeta su decisión.
        if (attendance[index].state !== 'Pendiente' && !autoAbsent) continue;
        attendance[index] = { ...attendance[index], state: 'Presente', method: 'QR', time };
      } else {
        attendance.push({ name: checkin.name, matricula: checkin.matricula, state: 'Presente', method: 'QR', time });
      }
      merged++;
    }
    // Quien estaba en la nómina y no marcó durante la sesión queda Ausente (el docente puede cambiarlo a Atraso u otro estado).
    let absent = 0;
    for (let i = 0; i < attendance.length; i++) {
      if (attendance[i].matricula && attendance[i].state === 'Pendiente') { attendance[i] = { ...attendance[i], state: 'Ausente', method: 'QR', time: '' }; absent++; }
    }
    const recordPatch = { updatedAt: FieldValue.serverTimestamp() };
    if (merged || absent) recordPatch.attendance = attendance.slice(0, 100);
    if (recordSnap.data().qrSessionId === sessionId) recordPatch.qrSessionId = FieldValue.delete();
    tx.update(recordRef, recordPatch);
    return merged;
  });
}
