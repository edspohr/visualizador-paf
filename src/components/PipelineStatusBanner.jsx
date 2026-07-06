import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { usePipelineMetadata } from '../lib/queries.js';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatearFecha(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Pequeño banner que muestra el estado de la última sincronización con las
 * Planillas Centrales de Focus. Se renderiza al pie de las vistas agregadas.
 */
export default function PipelineStatusBanner() {
  const { data } = usePipelineMetadata();
  if (!data) return null;

  const fecha = formatearFecha(data.ultimoSyncAt);
  const exitoso = data.ultimoSyncExitoso !== false;
  const docs = data.docsEscritos ?? 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-white px-4 py-3 flex items-center gap-3 text-xs">
      {exitoso ? (
        <CheckCircle2 size={14} style={{ color: 'var(--color-teal)' }} className="shrink-0"/>
      ) : (
        <AlertCircle size={14} style={{ color: 'var(--color-red)' }} className="shrink-0"/>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-gray-dark font-medium">
          Sincronización con Planillas Centrales
        </p>
        <p className="text-gray-ui font-light">
          {fecha ? `Último sync: ${fecha} · ${docs} progresos actualizados` : 'Pendiente de primera sincronización'}
        </p>
      </div>
      <div className="flex items-center gap-1 text-gray-ui">
        <Clock size={11}/>
        <span>Automático nocturno (planificado)</span>
      </div>
    </div>
  );
}
