import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  Home,
  LogOut,
  Menu,
  Users,
  X,
  History,
  UserCog,
  Upload,
  RefreshCw,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useOffline } from '../lib/OfflineContext.jsx';

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, conflicts, triggerSync, dismissConflicts } = useOffline();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const items = [
    { to: '/', label: 'Resumen', icon: Home, end: true },
    { to: '/registros', label: 'Fichas ASAA', icon: ClipboardCheck },
    { to: '/asistencia', label: 'Asistencia', icon: Users },
    ...(['admin', 'jefatura', 'coordinacion', 'gerencia'].includes(profile?.role)
      ? [{ to: '/auditoria', label: 'Auditoría', icon: History }]
      : []),
    ...(profile?.role === 'admin'
      ? [
          { to: '/importacion', label: 'Importar datos', icon: Upload },
          { to: '/usuarios', label: 'Usuarios', icon: UserCog },
        ]
      : []),
  ];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>ASAA</strong>
            <span>Seguridad académica</span>
          </div>
          <button className="icon-btn side-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <div className="nav-caption">ESPACIO DE TRABAJO</div>
        <nav>
          {items.map(item => (
            <NavLink
              key={item.to}
              end={item.end}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <Activity size={18} />
            </div>
            <strong>Registro de actividad segura</strong>
            <p>Documenta la actividad, los riesgos y la charla en una ficha trazable.</p>
          </div>
          <div className="profile">
            <div className="avatar">
              {(profile?.name || profile?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="profile-name">
              <strong>{profile?.name || profile?.email}</strong>
              <span>{profile?.roleLabel || profile?.role}</span>
            </div>
            <button className="icon-btn" title="Cerrar sesión" onClick={handleLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="crumb">
            INACAP <span>/</span> Seguridad en talleres
          </div>
          <div className="top-actions">
            {isSyncing ? (
              <span className="syncing-indicator">
                <RefreshCw size={12} className="spinning" /> Sincronizando…
              </span>
            ) : !isOnline ? (
              <span className="offline-indicator" title="Sin conexión de red en taller">
                <i /> Modo taller (Offline){pendingCount > 0 ? ` · ${pendingCount} pend.` : ''}
              </span>
            ) : pendingCount > 0 ? (
              <button
                className="sync-badge-btn"
                onClick={triggerSync}
                title="Sincronizar cambios pendientes guardados en taller"
              >
                <RefreshCw size={12} /> Sincronizar ({pendingCount})
              </button>
            ) : (
              <span className="local-indicator online-indicator">
                <i /> Conectado
              </span>
            )}
            <div className="avatar small">
              {(profile?.name || profile?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="offline-top-banner">
            <WifiOff size={15} />
            <span>
              <strong>Modo taller sin conexión:</strong> Puedes crear o editar fichas y asistencia. La información se guarda cifrada con AES-256 en este dispositivo y se sincronizará automáticamente al detectar red.
            </span>
          </div>
        )}

        <div className="content">
          {conflicts && conflicts.length > 0 && (
            <div className="conflicts-banner">
              <AlertTriangle size={18} />
              <div className="conflicts-banner-content">
                <strong>Avisos de sincronización y resolución de concurrencia:</strong>
                <ul>
                  {conflicts.map(c => (
                    <li key={c.id || c.recordId}>
                      <b>{c.code || c.recordId}:</b> {c.action} — {c.details}
                    </li>
                  ))}
                </ul>
              </div>
              <button className="button small secondary" onClick={dismissConflicts}>
                Entendido
              </button>
            </div>
          )}
          <Outlet />
        </div>
        <footer className="prototype-note">
          <Activity size={15} />
          <span>ASAA · Registro de actividad segura</span>
        </footer>
      </main>
    </div>
  );
}
