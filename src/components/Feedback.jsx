import { AlertCircle, LoaderCircle } from 'lucide-react';

export function LoadingScreen({ label = 'Cargando…' }) { return <div className="loading-screen"><LoaderCircle className="spin" size={24}/><span>{label}</span></div>; }
export function ErrorState({ error, onRetry }) { return <div className="empty-state error-state"><div><AlertCircle size={21}/></div><strong>No se pudo cargar</strong><span>{error || 'Intenta nuevamente en unos momentos.'}</span>{onRetry && <button className="button secondary" onClick={onRetry}>Reintentar</button>}</div>; }
export function EmptyState({ title = 'Aún no hay registros', text = 'Crea una ficha para que aparezca aquí.' }) { return <div className="empty-state"><div><AlertCircle size={20}/></div><strong>{title}</strong><span>{text}</span></div>; }
export function PageTitle({ eyebrow, title, subtitle, action }) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
