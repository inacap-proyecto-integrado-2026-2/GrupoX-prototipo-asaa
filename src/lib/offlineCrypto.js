/**
 * Native Web Crypto API implementation for AES-GCM 256-bit client-side encryption.
 * Encrypts drafts, cached records and offline sync queues at rest.
 */

const SALT_STORAGE_KEY = 'asaa_offline_salt';

function getOrGenerateSalt() {
  if (typeof window === 'undefined') return new Uint8Array(16);
  let stored = window.localStorage.getItem(SALT_STORAGE_KEY);
  if (!stored) {
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    stored = uint8ToBase64(saltBytes);
    window.localStorage.setItem(SALT_STORAGE_KEY, stored);
    return saltBytes;
  }
  return base64ToUint8(stored);
}

function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Memory cache for derived CryptoKey per user
const keyCache = new Map();

async function getDerivedKey(userId) {
  if (!userId) throw new Error('Se requiere un identificador de usuario para cifrar.');
  if (keyCache.has(userId)) return keyCache.get(userId);

  const subtle = window?.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API no está disponible en este entorno.');

  const salt = getOrGenerateSalt();
  const enc = new TextEncoder();
  const rawKey = enc.encode(`asaa-workshop-v1-${userId}`);

  const baseKey = await subtle.importKey('raw', rawKey, { name: 'PBKDF2' }, false, ['deriveKey']);
  const derivedKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(userId, derivedKey);
  return derivedKey;
}

/**
 * Encrypts an arbitrary JS object/data using AES-GCM 256.
 * Returns an envelope { v: 1, iv: '...', ct: '...' }
 */
export async function encryptPayload(data, userId) {
  try {
    const key = await getDerivedKey(userId);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    return {
      v: 1,
      iv: uint8ToBase64(iv),
      ct: uint8ToBase64(new Uint8Array(ciphertext)),
      encryptedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error al cifrar datos locales:', err);
    throw new Error('No se pudo cifrar los datos de almacenamiento local.');
  }
}

/**
 * Decrypts an encrypted envelope using AES-GCM 256.
 */
export async function decryptPayload(envelope, userId) {
  if (!envelope || !envelope.iv || !envelope.ct) return null;
  try {
    const key = await getDerivedKey(userId);
    const iv = base64ToUint8(envelope.iv);
    const ciphertext = base64ToUint8(envelope.ct);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const jsonStr = new TextDecoder().decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Error al descifrar datos locales:', err);
    throw new Error('No se pudo descifrar la información guardada localmente.');
  }
}
