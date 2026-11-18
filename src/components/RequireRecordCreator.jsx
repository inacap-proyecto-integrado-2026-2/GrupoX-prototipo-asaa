import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { canCreateRecords } from '../lib/permissions.js';
import { EmptyState } from './Feedback.jsx';

// Evita mostrar el formulario de nueva ficha a perfiles que la API no deja crear (p. ej. Prevención o Gerencia).
export default function RequireRecordCreator({ children }) {
  const { profile } = useAuth();
  if (canCreateRecords(profile?.role)) return children;
  return <div className="no-permission">
    <EmptyState title="No tienes permiso para crear fichas" text="Tu perfil puede consultar las fichas, pero solo docentes, jefatura, coordinación y administración pueden crearlas."/>
    <Link className="button secondary" to="/registros">Ver fichas ASAA</Link>
  </div>;
}
