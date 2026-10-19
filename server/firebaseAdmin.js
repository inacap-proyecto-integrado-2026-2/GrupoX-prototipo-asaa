import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error('Falta configurar Firebase Admin en el servidor.');
  }
  return initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }), projectId: FIREBASE_PROJECT_ID });
}

export function getServices() { const app = adminApp(); return { auth: getAuth(app), db: getFirestore(app), FieldValue }; }
export function publicError(res, error) {
  if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
  if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message, code: error.code });
  console.error('API request failed', error?.code || error?.name || 'Error');
  return res.status(500).json({ error: 'Ocurrió un error interno. Intenta nuevamente.' });
}
export function httpError(statusCode, message, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }
export function methodNotAllowed(res, allowed) { res.setHeader('Allow', allowed.join(', ')); return res.status(405).json({ error: 'Método no permitido.' }); }
export function setNoStore(res) { res.setHeader('Cache-Control', 'private, no-store, max-age=0'); }
