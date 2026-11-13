import { useState } from 'react';
import { ArrowRight, BookOpen, Download, HardHat, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiDownload } from '../services/api.js';

const formatDate = value => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function RecordRow({ record }) {
  const [downloading, setDownloading] = useState(false);
  const theory = record.type === 'Teórica';

  const handleQuickDownload = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await apiDownload(`/records/${record.id}/export`, {
        defaultFilename: `ASAA-${record.code || record.id}.pdf`,
      });
    } catch (err) {
      if (!navigator.onLine) {
        alert('Estás sin conexión. Entra a la ficha para usar el modo de impresión / guardado local en PDF.');
      } else {
        alert(err.message || 'Error al descargar el PDF.');
      }
    } finally {
      setDownloading(false);
    }
  };

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
      <button
        type="button"
        className="icon-btn"
        title="Descargar PDF de esta ficha"
        onClick={handleQuickDownload}
        disabled={downloading}
        style={{ marginLeft: '4px', flexShrink: 0 }}
      >
        <Download size={16} style={{ opacity: downloading ? 0.3 : 0.8 }} />
      </button>
      <ArrowRight className="row-arrow" size={17} />
    </Link>
  );
}
