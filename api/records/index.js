import { canReadAllRecords, requireUser } from '../../server/auth.js';
import { audit } from '../../server/audit.js';
import { httpError, methodNotAllowed, publicError, setNoStore } from '../../server/firebaseAdmin.js';
import { sanitizeRecord } from '../../server/validation.js';

export default async function handler(req, res) {
  setNoStore(res);
  try {
    const user = await requireUser(req);
    if (req.method === 'GET') {
      if (!canReadAllRecords(user) && user.role !== 'docente') throw httpError(403, 'No tienes permiso para consultar fichas.');
      const base = user.db.collection('records');
      const scope = canReadAllRecords(user) ? base : base.where('ownerUid', '==', user.uid);
      const query = scope.orderBy('createdAt', 'desc').limit(100);
      const [snapshot, totalCount, practiceCount, openCount, closedCount] = await Promise.all([
        query.get(), scope.count().get(), scope.where('type', '==', 'Práctica').count().get(), scope.where('status', '==', 'open').count().get(), scope.where('status', '==', 'closed').count().get(),
      ]);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.createdAt?.toMillis?.() || '').localeCompare(String(a.createdAt?.toMillis?.() || '')));
      await audit(user.db, user.FieldValue, { actor: user, action: 'records.list', context: { resultCount: records.length } });
      return res.status(200).json({ records, stats: { total: totalCount.data().count, practice: practiceCount.data().count, open: openCount.data().count, closed: closedCount.data().count } });
    }
    if (req.method === 'POST') {
      if (!['admin', 'docente', 'jefatura', 'coordinacion'].includes(user.role)) throw httpError(403, 'No tienes permiso para crear fichas.');
      const data = sanitizeRecord(req.body);
      const ref = user.db.collection('records').doc();
      const compact = value => String(value || 'NA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'NA';
      const code = `ASAA-${compact(data.sede)}-${compact(data.place)}-${compact(data.docente)}-${String(data.date).replaceAll('-', '')}-${ref.id.toUpperCase()}`;
      const record = { ...data, code, ownerUid: user.uid, ownerName: user.name, createdBy: user.uid, createdAt: user.FieldValue.serverTimestamp(), updatedAt: user.FieldValue.serverTimestamp(), status: 'open' };
      await ref.create(record);
      await audit(user.db, user.FieldValue, { actor: user, action: 'record.create', recordId: ref.id, context: { code, type: data.type } });
      return res.status(201).json({ record: { ...record, id: ref.id, createdAt: null, updatedAt: null } });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) { return publicError(res, error); }
}
