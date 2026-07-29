import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, ListChecks, Package } from 'lucide-react';
import { calcularLogro, estadoValor } from '../data/establecimientos.js';
import { estadoAplicabilidad, descripcionNoAplicable } from '../data/scope.js';
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

  // Nota: NO filtramos por isAplicable2026 acá. Los indicadores no-aplicables-aun
  // se anotan como tales y se renderizan al pie del bloque de logro/estrategia
  // con un mensaje explicativo, sin entrar en los agregados. Ver bloque I del
  // plan implementación 2026-07-29.
  const filasIndicadores = useMemo(() => {
    if (!establecimiento) return [];
    return INDS.map(ind => {
      const entry = valoresReales.get(ind.id);
      const valor = entry?.valor ?? null;
      const estado = entry?.estado ?? 'validado';
      const logro = calcularLogro(valor, ind);
      const aplicabilidad = estadoAplicabilidad(ind, establecimiento, mes).estado;
      return { ind, valor, logro, estado, aplicabilidad };
    });
  }, [INDS, establecimiento, mes, valoresReales]);

  const estrategiaFilas = filasIndicadores.filter(f => f.ind.clasificacion === 'estrategia');
  const productoFilas   = filasIndicadores.filter(f => f.ind.clasificacion === 'producto');

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-semibold tracking-wider uppercase px-1 pb-2 mb-1 border-b border-border"
        style={{ color: 'var(--color-cyan)' }}
      >
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
  // Partición: aplicables (entran en agregados y se muestran normalmente) vs
  // no-aplicables-aun (se muestran compactos con nota, no entran en agregados).
  const estrategiaAplic = filasEstrategia.filter(f => f.aplicabilidad === 'aplicable');
  const estrategiaAun   = filasEstrategia.filter(f => f.aplicabilidad !== 'aplicable');
  const logroAplic      = filasLogro.filter(f => f.aplicabilidad === 'aplicable');
  const logroAun        = filasLogro.filter(f => f.aplicabilidad !== 'aplicable');

  // El % de cumplimiento y los contadores solo consideran indicadores
  // aplicables con meta — mantiene la fórmula que se defiende con el cliente.
  const filasAgregado = [...estrategiaAplic, ...logroAplic];
  const conMeta = filasAgregado.filter(f => f.ind.metaNum !== null && f.ind.unidad !== 'sin_meta');
  const promedioAmbito = conMeta.length
    ? conMeta.reduce((s, f) => s + (f.logro === null ? 0 : Math.min(1, f.logro)), 0) / conMeta.length
    : null;
  const conDato = conMeta.filter(f => estadoValor(f.valor, f.ind) === 'con_dato').length;
  const sinDato = conMeta.length - conDato;

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
            <>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-bg/50">
                <ListChecks size={13} style={{ color: 'var(--color-cyan)' }} className="shrink-0"/>
                <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-cyan)' }}>
                  Indicadores del ámbito
                </p>
                <div className="flex-1 h-px bg-border"/>
              </div>
              {estrategiaAplic.length > 0 && (
                <div className="divide-y divide-border">
                  {estrategiaAplic.map(fila => (
                    <IndicadorRow
                      key={fila.ind.id}
                      fila={fila}
                      onDrilldown={onDrilldown}
                      anioEnCurso={anioEnCurso}
                    />
                  ))}
                </div>
              )}
              {estrategiaAun.length > 0 && (
                <NoAplicableAun filas={estrategiaAun} />
              )}
            </>
          )}
          {filasLogro.length > 0 && (
            <>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-bg/50 border-t border-border">
                <Package size={13} style={{ color: 'var(--color-magenta)' }} className="shrink-0"/>
                <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-magenta)' }}>
                  Indicadores de logro
                </p>
                <div className="flex-1 h-px bg-border"/>
              </div>
              {logroAplic.length > 0 && (
                <div className="divide-y divide-border">
                  {logroAplic.map(fila => (
                    <IndicadorRow
                      key={fila.ind.id}
                      fila={fila}
                      onDrilldown={onDrilldown}
                      anioEnCurso={anioEnCurso}
                    />
                  ))}
                </div>
              )}
              {logroAun.length > 0 && (
                <NoAplicableAun filas={logroAun} />
              )}
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

// Muestra los indicadores que aún no aplican al centro (por semestre de inicio
// posterior al que el centro ha alcanzado). No entran en el % del ámbito ni en
// ranking, pero se muestran para que el usuario sepa que existen y por qué
// están silenciados. Distinto de "Sin datos" (aplicable pero sin valor).
function NoAplicableAun({ filas }) {
  return (
    <div className="border-t border-border bg-bg/30 px-4 py-3">
      <p className="flex items-start gap-2 text-xs text-gray-ui leading-snug mb-2">
        <Clock size={12} className="shrink-0 mt-0.5" />
        <span>
          Estos indicadores están definidos para este ámbito, pero no aplican
          todavía a este centro educativo según el año de implementación en
          el que se encuentra. No entran en el porcentaje del ámbito.
        </span>
      </p>
      <ul className="space-y-1">
        {filas.map(({ ind }) => (
          <li key={ind.id} className="flex items-start gap-3 text-xs text-gray-ui">
            <span className="font-mono shrink-0 w-12">{indicadorCodigo(ind.id)}</span>
            <span className="flex-1">{ind.nombre}</span>
            <span className="shrink-0 italic">{descripcionNoAplicable(ind)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
