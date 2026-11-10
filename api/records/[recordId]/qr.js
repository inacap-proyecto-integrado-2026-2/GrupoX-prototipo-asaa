import { assertRecordAccess, requireUser } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';
import { QR_SESSION_MINUTES, QR_WINDOW_MS, currentWindow, finishSession, newSecret, requireRosterLink, sessionExpired, tokenFor } from '../../../server/qr.js';

const MAX_ATTENDANCE = 100;

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    const { ref, record } = await assertRecordAccess(user, req.query.recordId);
    if (!['docente', 'admin'].includes(user.role) || record.ownerUid !== user.uid) throw httpError(403, 'Solo el docente responsable puede gestionar la asistencia QR.');
    const sessions = user.db.collection('attendanceSessions');

    if (req.method === 'GET') {
      if (!record.qrSessionId) return res.status(200).json({ session: null });
      const sessionSnap = await sessions.doc(record.qrSessionId).get();
      if (!sessionSnap.exists || sessionExpired(sessionSnap.data())) {
        const merged = await finishSession(user.db, user.FieldValue, ref, record.qrSessionId);
        await audit(user.db, user.FieldValue, { actor: user, action: 'attendance.qr.expire', recordId: ref.id, context: { sessionId: record.qrSessionId, merged } });
        return res.status(200).json({ session: null, ended: true, merged });
      }
      const session = sessionSnap.data();
      const now = Date.now();
      const checkins = await sessionSnap.ref.collection('checkins').orderBy('checkedAt', 'desc').get();
      return res.status(200).json({
        session: {
          id: sessionSnap.id,
          token: tokenFor(session.secret, sessionSnap.id, currentWindow(now)),
          refreshInMs: QR_WINDOW_MS - (now % QR_WINDOW_MS),
          expiresAt: session.expiresAt.toMillis(),
          enrolledCount: session.enrolledCount,
        },
        checkins: checkins.docs.map(doc => ({ matricula: doc.data().matricula, name: doc.data().name, checkedAt: doc.data().checkedAt?.toMillis?.() || null })),
      });
    }

    if (req.method === 'POST') {
      if (record.type !== 'Práctica') throw httpError(400, 'La asistencia QR solo aplica a actividades prácticas.');
      if (record.status !== 'open') throw httpError(409, 'La ficha debe estar abierta para tomar asistencia.');
      const link = requireRosterLink(record);
      const roster = await user.db.collection('enrollments')
        .where('codigo_asignatura', '==', link.subjectCode).where('seccion', '==', link.sectionCode).where('periodo', '==', link.period)
        .limit(MAX_ATTENDANCE + 1).get();
      if (roster.empty) throw httpError(400, `No hay estudiantes en la nómina importada para ${link.subjectCode} sección ${link.sectionCode} (${link.period}).`);
      if (roster.size > MAX_ATTENDANCE) throw httpError(400, `La nómina supera el máximo de ${MAX_ATTENDANCE} estudiantes por ficha.`);
      if (record.qrSessionId) await finishSession(user.db, user.FieldValue, ref, record.qrSessionId);

      const sessionRef = sessions.doc();
      const expiresAt = new Date(Date.now() + QR_SESSION_MINUTES * 60_000);
      await sessionRef.create({ recordId: ref.id, ownerUid: user.uid, ...link, secret: newSecret(), active: true, enrolledCount: roster.size, failedAttempts: 0, createdAt: user.FieldValue.serverTimestamp(), expiresAt });

      // Precarga la nómina como "Pendiente" para que el docente vea quién falta.
      await user.db.runTransaction(async tx => {
        const fresh = (await tx.get(ref)).data();
        const attendance = [...(fresh.attendance || [])];
        const known = new Set(attendance.map(item => item.matricula).filter(Boolean));
        for (const doc of roster.docs) {
          const { matricula, nombre_estudiante: name } = doc.data();
          if (!known.has(matricula)) attendance.push({ name, matricula, state: 'Pendiente', method: 'Registro docente', time: '' });
        }
        tx.update(ref, { qrSessionId: sessionRef.id, attendance: attendance.slice(0, MAX_ATTENDANCE), updatedAt: user.FieldValue.serverTimestamp() });
      });
      await audit(user.db, user.FieldValue, { actor: user, action: 'attendance.qr.start', recordId: ref.id, context: { sessionId: sessionRef.id, enrolled: roster.size } });
      return res.status(201).json({ sessionId: sessionRef.id, expiresAt: expiresAt.getTime() });
    }

    if (req.method === 'DELETE') {
      if (!record.qrSessionId) return res.status(200).json({ ok: true, merged: 0 });
      const merged = await finishSession(user.db, user.FieldValue, ref, record.qrSessionId);
      await audit(user.db, user.FieldValue, { actor: user, action: 'attendance.qr.end', recordId: ref.id, context: { sessionId: record.qrSessionId, merged } });
      return res.status(200).json({ ok: true, merged });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (error) { return publicError(res, error); }
}
