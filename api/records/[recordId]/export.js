import { assertRecordAccess, requireUser } from '../../../server/auth.js';
import { audit } from '../../../server/audit.js';
import { methodNotAllowed, publicError, setNoStore } from '../../../server/firebaseAdmin.js';
import { generateRecordPdf } from '../../../server/pdfGenerator.js';

export default async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }
  try {
    const user = await requireUser(req);
    const { recordId } = req.query;

    // Fast-path: Download blank institutional template for field / offline activities
    if (recordId === 'plantilla' || recordId === 'template') {
      const pdfBuffer = await generateRecordPdf({ isTemplate: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="ASAA_Plantilla_En_Blanco_Terreno.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).send(pdfBuffer);
    }

    const { ref, record } = await assertRecordAccess(user, recordId);

    // Generate real server-side PDF document
    const pdfBuffer = await generateRecordPdf({ id: ref.id, ...record });

    // Update archival metadata in Firestore
    await ref.update({
      lastExportedAt: user.FieldValue.serverTimestamp(),
      exportCount: user.FieldValue.increment(1),
    }).catch(err => console.warn('No se pudo actualizar metadata de exportación', err?.message));

    // Immutable audit log entry
    await audit(user.db, user.FieldValue, {
      actor: user,
      action: 'record.export',
      recordId: ref.id,
      context: {
        code: record.code || ref.id,
        format: 'pdf',
        sizeBytes: pdfBuffer.length,
      },
    });

    const safeCode = (record.code || `ficha-${ref.id}`).replace(/[^A-Za-z0-9_.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return publicError(res, error);
  }
}
