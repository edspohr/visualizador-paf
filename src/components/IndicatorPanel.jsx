import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import { calcularLogro, estadoValor } from '../data/establecimientos.js';
import { isAplicable2026 } from '../data/scope.js';
import { IndicatorProgress } from './Shared.jsx';
import { indicadorCodigo, ambitoCodigo, ambitoNombre } from '../lib/labels.js';

/**
 * Renders indicators split into two sections (estrategia + producto), agrupadas
 * por ámbito colapsable. Todos los valores vienen de `valoresReales`
 * (Map<indicadorId, { valor, estado }>) — no hay fallback sintético.
 *
 * Aplica el filtro `isAplicable2026` para excluir indicadores cuyo semestre
 * requerido aún no aplica al centro (según su cohorte).
 *
 * El porcentaje del encabezado de cada ámbito es "% cumplimiento":
 *   AVG(min(1, calcularLogro)) sobre los indicadores aplicables del ámbito,
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
      {/* ── Sección 1: indicadores de estrategia agrupados por ámbito ── */}
      {AMBITOS.map(a => {
        const filas = estrategiaFilas.filter(f => f.ind.ambito === a.id);
        if (!filas.length) return null;
        return (
          <AmbitoGroup
            key={a.id}
            groupKey={a.id}
            label={ambitoNombre(a, programa)}
            codigo={a.codigo}
            filas={filas}
            isOpen={!!openAmbitos[a.id]}
            onToggle={() => toggle(a.id)}
            onDrilldown={onDrilldown}
            anioEnCurso={anioEnCurso}
          />
        );
      })}

      {/* ── Sección 2: indicadores de producto ── */}
      {productoFilas.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-4 pb-1 px-1">
            <Package size={15} style={{ color: 'var(--color-magenta)' }} className="shrink-0"/>
            <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-magenta)' }}>
              Indicadores de producto
            </p>
            <div className="flex-1 h-px bg-border"/>
          </div>

          {AMBITOS.map(a => {
            const filas = productoFilas.filter(f => f.ind.ambito === a.id);
            if (!filas.length) return null;
            const key = `prod-${a.id}`;
            return (
              <AmbitoGroup
                key={key}
                groupKey={key}
                label={ambitoNombre(a, programa)}
                codigo={a.codigo}
                filas={filas}
                isOpen={!!openAmbitos[key]}
                onToggle={() => toggle(key)}
                onDrilldown={onDrilldown}
                anioEnCurso={anioEnCurso}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

// Shared collapsible ámbito group used for both sections.
// Header % = "% cumplimiento": AVG(min(1, logro)) sobre indicadores del ámbito
// con meta, contando 0 los faltantes.
function AmbitoGroup({ label, codigo, filas, isOpen, onToggle, onDrilldown, anioEnCurso = true }) {
  const conMeta = filas.filter(f => f.ind.metaNum !== null && f.ind.unidad !== 'sin_meta');
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
            <span className="text-sm font-medium text-gray-dark">{Math.round(promedioAmbito * 100)}%</span>
          )}
          {isOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border divide-y divide-border">
          {filas.map(({ ind, valor, estado }) => (
            <div
              key={ind.id}
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
          ))}
        </div>
      )}
    </div>
  );
}
