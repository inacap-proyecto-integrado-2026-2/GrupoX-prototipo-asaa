import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RecordsPage from './pages/RecordsPage.jsx';
import RecordFormPage from './pages/RecordFormPage.jsx';
import RecordDetailPage from './pages/RecordDetailPage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import { ErrorState, LoadingScreen } from './components/Feedback.jsx';

export default function App() {
  const { user, profile, loading, profileError, retryProfile, logout } = useAuth();
  if (loading) return <LoadingScreen label="Verificando sesión…" />;
  if (user && !profile && profileError) return <main className="account-blocked"><h1>No se pudo completar el acceso</h1><ErrorState error={profileError} onRetry={retryProfile}/><button className="button secondary" onClick={logout}>Volver al inicio de sesión</button></main>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/registros" element={<RecordsPage />} />
        <Route path="/registros/nuevo" element={<RecordFormPage />} />
        <Route path="/registros/:recordId/editar" element={<RecordFormPage />} />
        <Route path="/registros/:recordId" element={<RecordDetailPage />} />
        <Route path="/asistencia" element={<AttendancePage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/auditoria" element={<AuditPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
  </Routes>;
}
