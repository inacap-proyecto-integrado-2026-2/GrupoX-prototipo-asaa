import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';

// Pantalla para cuentas sin acceso a la app: siempre ofrece cerrar sesión para poder entrar con otra cuenta.
function Blocked({ title, text }) {
  const { logout } = useAuth();
  return <div className="account-blocked"><h1>{title}</h1><p>{text}</p><button type="button" className="button secondary" onClick={() => logout()}><LogOut size={16}/> Cerrar sesión</button></div>;
}

export default function ProtectedRoute() {
  const { user, profile } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile?.active) return <Blocked title="Cuenta sin acceso" text="Tu cuenta está desactivada o todavía no tiene un perfil habilitado. Solicita acceso a administración."/>;
  if (['estudiante','panol'].includes(profile.role)) return <Blocked title="Acceso en preparación" text="Este perfil todavía no tiene habilitado el flujo de autoservicio. Contacta a jefatura o coordinación."/>;
  return <Outlet />;
}
