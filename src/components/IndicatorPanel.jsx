import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import { calcularLogro, estadoValor } from '../data/establecimientos.js';
import { isAplicable2026 } from '../data/scope.js';
import { IndicatorProgress } from './Shared.jsx';
import { indicadorCodigo, ambitoCodigo, ambitoNombre } from '../lib/labels.js';

/**
 * Renders indicators grouped by ámbito colapsable. Dentro de cada ámbito:
 * primero los indicadores de estrategia y, si existen, una sub-sección
 * "Indicadores de logro asociados" con los productos de ese mismo ámbito.
 * Todos los valores vienen de `valoresReales`
 * (Map<indicadorId, { valor, estado }>) — no hay fallback sintético.
 *
 * Aplica el filtro `isAplicable2026` para excluir indicadores cuyo semestre
 * requerido aún no aplica al centro (según su cohorte).
 *
 * El porcentaje del encabezado de cada ámbito es "% cumplimiento":
 *   AVG(min(1, calcularLogro)) sobre estrategia + logro aplicables del ámbito,
 *   con faltantes contando 0.
 *
 * Props:
 *   INDS                  — indicator list for the program
 *   AMBITOS               — ámbito list for the program
 *   establecimiento       — full centro object (needed for cohorte)
 *   mes                   — effective month within 2026
 *   valoresReales         — Map(indicadorId → { valor, estado }) from Firestore
 *   onDrilldown           — callback(ind) when a row is clicked
 *   programa              — 'escolar' | 'parvulario'
 */
export default function IndicatorPanel({
  INDS,
  AMBITOS,
  establecimiento,
  mes,
  valoresReales = new Map(),
  onDrilldown,
  programa = 'escolar',
  anioEnCurso = true,
}) {
  const [openAmbitos, setOpenAmbitos] = useState({});
  const toggle = (key) => setOpenAmbitos(prev => ({ ...prev, [key]: !prev[key] }));

  const filasIndicadores = useMemo(() => {
    if (!establecimiento) return [];
    return INDS
      .filter(ind => isAplicable2026(ind, establecimiento, mes))
      .map(ind => {
        const entry = valoresReales.get(ind.id);
        const valor = entry?.valor ?? null;
        const estado = entry?.estado ?? 'validado';
        const logro = calcularLogro(valor, ind);
        return { ind, valor, logro, estado };
      });
  }, [INDS, establecimiento, mes, valoresReales]);

  const estrategiaFilas = filasIndicadores.filter(f => f.ind.clasificacion === 'estrategia');
  const productoFilas   = filasIndicadores.filter(f => f.ind.clasificacion === 'producto');

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wider uppercase text-gray-ui px-1 pb-1">
        Indicadores por ámbito
      </p>
      {AMBITOS.map(a => {
        const filasEstrategia = estrategiaFilas.filter(f => f.ind.ambito === a.id);
        const filasLogro      = productoFilas.filter(f => f.ind.ambito === a.id);
        if (!filasEstrategia.length && !filasLogro.length) return null;
        return (
          <AmbitoGroup
            key={a.id}
            groupKey={a.id}
            label={ambitoNombre(a, programa)}
            codigo={a.codigo}
            filasEstrategia={filasEstrategia}
            filasLogro={filasLogro}
            isOpen={!!openAmbitos[a.id]}
            onToggle={() => toggle(a.id)}
            onDrilldown={onDrilldown}
            anioEnCurso={anioEnCurso}
          />
        );
      })}
    </div>
  );
}

// Collapsible ámbito group. Muestra estrategia y, si existen, un divisor con
// "Indicadores de logro asociados" seguido de los productos del mismo ámbito.
// Header % = "% cumplimiento": AVG(min(1, logro)) sobre indicadores con meta
// (estrategia + logro), contando 0 los faltantes.
function AmbitoGroup({ label, codigo, filasEstrategia, filasLogro, isOpen, onToggle, onDrilldown, anioEnCurso = true }) {
  const filasTodas = [...filasEstrategia, ...filasLogro];
  const conMeta = filasTodas.filter(f => f.ind.metaNum !== null && f.ind.unidad !== 'sin_meta');
  const promedioAmbito = conMeta.length
    ? conMeta.reduce((s, f) => s + (f.logro === null ? 0 : Math.min(1, f.logro)), 0) / conMeta.length
    : null;

  // Distingue "con dato" de "sin dato" sobre indicadores que tienen meta.
  // Sin meta no cuenta (no es reportable).
  const conDato   = conMeta.filter(f => estadoValor(f.valor, f.ind) === 'con_dato').length;
  const sinDato   = conMeta.length - conDato;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="tag tag-navy shrink-0">{ambitoCodigo(codigo)}</span>
          <span className="text-sm font-medium text-gray-dark truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {conMeta.length > 0 && (
            <span className="text-xs text-gray-ui font-light">
              {conDato} con dato{sinDato > 0 ? ` · ${sinDato} sin dato` : ''}
            </span>
          )}
          {promedioAmbito !== null && (
            <span className="text-sm font-medium" style={{ color: 'var(--color-cyan)' }}>{Math.round(promedioAmbito * 100)}%</span>
          )}
          {isOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border">
          {filasEstrategia.length > 0 && (
            <div className="divide-y divide-border">
              {filasEstrategia.map(fila => (
                <IndicadorRow
                  key={fila.ind.id}
                  fila={fila}
                  onDrilldown={onDrilldown}
                  anioEnCurso={anioEnCurso}
                />
              ))}
            </div>
          )}
          {filasLogro.length > 0 && (
            <>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-bg/50 border-t border-border">
                <Package size={13} style={{ color: 'var(--color-magenta)' }} className="shrink-0"/>
                <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-magenta)' }}>
                  Indicadores de logro asociados
                </p>
                <div className="flex-1 h-px bg-border"/>
              </div>
              <div className="divide-y divide-border">
                {filasLogro.map(fila => (
                  <IndicadorRow
                    key={fila.ind.id}
                    fila={fila}
                    onDrilldown={onDrilldown}
                    anioEnCurso={anioEnCurso}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IndicadorRow({ fila, onDrilldown, anioEnCurso }) {
  const { ind, valor, estado } = fila;
  return (
    <div
      className="px-4 py-3 hover:bg-bg transition cursor-pointer"
      onClick={() => onDrilldown?.(ind)}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 text-xs text-gray-ui font-mono shrink-0 pt-0.5">{indicadorCodigo(ind.id)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-dark flex-1 mb-1">{ind.nombre}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-ui">
            <span>Actividad: {ind.actividad}</span>
            <span>Frec: {ind.frecuencia}</span>
            <span>Fuente: {ind.fuente}</span>
          </div>
        </div>
      </div>
      <div className="pl-[60px]">
        <IndicatorProgress
          indicador={ind}
          valor={valor}
          estado={estado}
          anioEnCurso={anioEnCurso}
        />
      </div>
    </div>
  );
}
