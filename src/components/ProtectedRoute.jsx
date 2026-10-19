import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

export default function ProtectedRoute() {
  const { user, profile } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile?.active) return <div className="account-blocked"><h1>Cuenta sin acceso</h1><p>Tu cuenta está desactivada o todavía no tiene un perfil habilitado. Solicita acceso a administración.</p></div>;
  if (['estudiante','panol'].includes(profile.role)) return <div className="account-blocked"><h1>Acceso en preparación</h1><p>Este perfil todavía no tiene habilitado el flujo de autoservicio. Contacta a jefatura o coordinación.</p></div>;
  return <Outlet />;
}
