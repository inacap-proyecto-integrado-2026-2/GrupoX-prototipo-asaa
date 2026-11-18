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

// Atraso: quien marca después de la hora de inicio de la charla + tolerancia queda en "Atraso".
export const LATE_TOLERANCE_MINUTES = 15;
// Instante (ms) desde el que una marca cuenta como atraso, según fecha y hora de charla de la ficha en hora de Chile.
export function lateAfterMillis(record, timeZone = 'America/Santiago') {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(record.date || ''); const time = /^(\d{1,2}):(\d{2})$/.exec(record.talkStart || '');
  if (!date || !time) return null;
  const wallClock = Date.UTC(+date[1], +date[2] - 1, +date[3], +time[1], +time[2]);
  // Diferencia entre la hora de pared en Chile y UTC en ese momento (considera horario de verano).
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(wallClock)).map(p => [p.type, p.value]));
  const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - wallClock;
  return wallClock - offset + LATE_TOLERANCE_MINUTES * 60_000;
}

export const sessionExpired =(session, now = Date.now()) => !session.active || (session.expiresAt?.toMillis?.() ?? 0) <= now;

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
    const lateAfter = lateAfterMillis(recordSnap.data());
    let merged = 0;
    for (const doc of checkins.docs) {
      const checkin = doc.data();
      const time = checkin.checkedAt?.toDate?.().toISOString() || '';
      // Marca después de la hora de la charla + tolerancia: queda en Atraso, con la charla individual pendiente.
      const state = lateAfter && checkin.checkedAt?.toMillis?.() > lateAfter ? 'Atraso' : 'Presente';
      const index = attendance.findIndex(item => item.matricula === checkin.matricula);
      if (index >= 0) {
        // Un "Ausente" puesto automáticamente al cerrar una sesión QR anterior sí se reemplaza por la nueva marca.
        const autoAbsent = attendance[index].method === 'QR' && attendance[index].state === 'Ausente';
        if (attendance[index].method === 'QR' && !autoAbsent) continue;
        // Si el docente ya marcó manualmente un estado distinto de Pendiente, se respeta su decisión.
        if (attendance[index].state !== 'Pendiente' && !autoAbsent) continue;
        attendance[index] = { ...attendance[index], state, method: 'QR', time };
      } else {
        attendance.push({ name: checkin.name, matricula: checkin.matricula, state, method: 'QR', time });
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
