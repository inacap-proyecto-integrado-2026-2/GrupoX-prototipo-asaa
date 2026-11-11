import { ArrowRight, BookOpen, HardHat, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

const formatDate = value => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function RecordRow({ record }) {
  const theory = record.type === 'Teórica';
  return (
    <Link className="record-row" to={`/registros/${record.id}`}>
      <div className={`record-type-icon ${theory ? 'theory' : ''}`}>
        {theory ? <BookOpen size={18} /> : <HardHat size={18} />}
      </div>
      <div className="record-main">
        <strong>{record.activity}</strong>
        <span>{record.code || record.id} <i>·</i> {record.section || 'Sin sección'} <i>·</i> {formatDate(record.date)}</span>
      </div>
      {record.offlinePending ? (
        <span className="badge offline" title="Modificado sin conexión en taller">
          <i /> Pendiente de sincronizar
        </span>
      ) : (
        <span className={`badge ${record.status === 'closed' ? 'success' : 'warning'}`}>
          <i />
          {record.status === 'closed' ? 'Cerrada' : 'En curso'}
        </span>
      )}
      <ArrowRight className="row-arrow" size={17} />
    </Link>
  );
}
