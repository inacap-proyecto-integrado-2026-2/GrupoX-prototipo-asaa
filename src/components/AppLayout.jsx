import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, ClipboardCheck, Home, LogOut, Menu, Users, X, History, UserCog, Upload } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

export default function AppLayout() {
  const { profile, logout } = useAuth(); const [menuOpen, setMenuOpen] = useState(false); const navigate = useNavigate();
  const items = [{ to: '/', label: 'Resumen', icon: Home, end: true }, { to: '/registros', label: 'Fichas ASAA', icon: ClipboardCheck }, { to: '/asistencia', label: 'Asistencia', icon: Users }, ...(['admin','jefatura','coordinacion','gerencia'].includes(profile?.role) ? [{ to: '/auditoria', label: 'Auditoría', icon: History }] : []), ...(profile?.role === 'admin' ? [{ to: '/importacion', label: 'Importar datos', icon: Upload }, { to: '/usuarios', label: 'Usuarios', icon: UserCog }] : [])];
  async function handleLogout() { await logout(); navigate('/login', { replace: true }); }
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">A</div><div><strong>ASAA</strong><span>Seguridad académica</span></div><button className="icon-btn side-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="nav-caption">ESPACIO DE TRABAJO</div><nav>{items.map(item => <NavLink key={item.to} end={item.end} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}><item.icon size={19}/><span>{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Activity size={18}/></div><strong>Registro de actividad segura</strong><p>Documenta la actividad, los riesgos y la charla en una ficha trazable.</p></div><div className="profile"><div className="avatar">{(profile?.name || profile?.email || 'U').slice(0, 2).toUpperCase()}</div><div className="profile-name"><strong>{profile?.name || profile?.email}</strong><span>{profile?.roleLabel || profile?.role}</span></div><button className="icon-btn" title="Cerrar sesión" onClick={handleLogout}><LogOut size={16}/></button></div></div>
    </aside>
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"/>}
    <main className="main-area"><header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="crumb">INACAP <span>/</span> Seguridad en talleres</div><div className="top-actions"><span className="local-indicator online-indicator"><i/> Conectado</span><div className="avatar small">{(profile?.name || profile?.email || 'U').slice(0, 2).toUpperCase()}</div></div></header><div className="content"><Outlet/></div><footer className="prototype-note"><Activity size={15}/><span>ASAA · Registro de actividad segura</span></footer></main>
  </div>;
}
