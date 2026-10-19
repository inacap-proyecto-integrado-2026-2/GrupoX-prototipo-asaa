export async function audit(db, FieldValue, { actor, action, recordId = null, context = {} }) {
  const item = { actorUid: actor.uid, actorEmail: actor.email, actorRole: actor.role, action, recordId, context, createdAt: FieldValue.serverTimestamp() };
  await db.collection('auditEvents').add(item);
  if (recordId) await db.collection('records').doc(recordId).collection('audit').add(item);
}
