import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth, firebaseConfigured } from '../lib/firebase.js';
import { api } from '../services/api.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const requestVersion = useRef(0);
  const loadProfile = useCallback(async currentUser => {
    const version = ++requestVersion.current;
    setLoading(true);
    setUser(currentUser); setProfile(null); setProfileError('');
    if (!currentUser) { setLoading(false); return; }
    try {
      const result = await api('/auth/me');
      if (version === requestVersion.current) setProfile(result.profile);
    } catch (error) {
      if (version === requestVersion.current) setProfileError(error.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!firebaseConfigured) { setLoading(false); return undefined; }
    const unsubscribe = onAuthStateChanged(auth, loadProfile);
    return () => { unsubscribe(); requestVersion.current += 1; };
  }, [loadProfile]);
  const retryProfile = useCallback(() => loadProfile(auth?.currentUser || null), [loadProfile]);
  const login = useCallback(async (email, password) => signInWithEmailAndPassword(auth, email.trim(), password), []);
  const logout = useCallback(() => signOut(auth), []);
  const resetPassword = useCallback(email => sendPasswordResetEmail(auth, email.trim()), []);
  const value = useMemo(() => ({ user, profile, loading, profileError, retryProfile, login, logout, resetPassword, firebaseConfigured }), [user, profile, loading, profileError, retryProfile, login, logout, resetPassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth requiere AuthProvider.'); return context; }
