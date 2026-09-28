import { usePipelineMetadata } from '../lib/queries.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const aFecha = (ts) => (ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null);

/**
 * Date and time of the last completed data load for a program, written by the
 * ingest scripts to config/pipelineMetadata (L-04). Null until the first load.
 */
export function useFechaActualizacion(programa) {
  const { data } = usePipelineMetadata();
  return aFecha(data?.[programa]?.ultimaCargaAt ?? data?.ultimoSyncAt);
}

export function textoFecha(d) {
  if (!d) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${hh}:${mm} h`;
}

/** "Datos actualizados al 28 de septiembre de 2026, 02:14 h" */
export default function FechaActualizacion({ programa, className = '' }) {
  const fecha = useFechaActualizacion(programa);
  return (
    <span className={className}>
      {fecha ? `Datos actualizados al ${textoFecha(fecha)}` : 'Fecha de actualización no disponible'}
    </span>
  );
}
