import { useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import { ESCUELAS, JARDINES, generarValorIndicador, calcularLogro, promedioTerritorioIndicador } from '../data/establecimientos.js';
import { IndicatorProgress } from './Shared.jsx';

/**
 * Renders indicators split into two sections:
 *  1. Estrategia indicators — collapsible ámbito groups (same as before).
 *  2. "Indicadores de producto" — at the end, same collapsible pattern by ámbito.
 *
 * Props:
 *   INDS              — indicator list for the program
 *   AMBITOS           — ámbito list for the program
 *   establecimientoId — establishment id used for data generation
 *   slep              — sostenedor id
 *   mes               — effective month
 *   onDrilldown       — callback(ind) when a row is clicked
 */
export default function IndicatorPanel({ INDS, AMBITOS, establecimientoId, slep, mes, onDrilldown }) {
  const [openAmbitos, setOpenAmbitos] = useState({});
  // Producto groups keyed with a prefix to avoid collisions with estrategia keys
  const toggle = (key) => setOpenAmbitos(prev => ({ ...prev, [key]: !prev[key] }));

  const est = [...ESCUELAS, ...JARDINES].find(e => e.id === establecimientoId);

  const filasIndicadores = INDS.map(ind => {
    const { valor } = generarValorIndicador(ind, establecimientoId, slep, mes);
    const logro = calcularLogro(valor, ind);
    const promTerritorio = est ? promedioTerritorioIndicador(ind, est, mes) : null;
    return { ind, valor, logro, promTerritorio };
  });

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
            label={a.nombre}
            codigo={a.codigo}
            filas={filas}
            isOpen={!!openAmbitos[a.id]}
            onToggle={() => toggle(a.id)}
            onDrilldown={onDrilldown}
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
                label={a.nombre}
                codigo={a.codigo}
                filas={filas}
                isOpen={!!openAmbitos[key]}
                onToggle={() => toggle(key)}
                onDrilldown={onDrilldown}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

// Shared collapsible ámbito group used for both sections
function AmbitoGroup({ groupKey, label, codigo, filas, isOpen, onToggle, onDrilldown }) {
  const filasConLogro = filas.filter(f => f.logro !== null);
  const promedioAmbito = filasConLogro.length
    ? filasConLogro.reduce((s, f) => s + Math.min(1, f.logro), 0) / filasConLogro.length
    : null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="tag tag-navy shrink-0">{codigo}</span>
          <span className="text-sm font-medium text-gray-dark truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {promedioAmbito !== null && (
            <span className="text-sm font-medium text-gray-dark">{Math.round(promedioAmbito * 100)}%</span>
          )}
          {isOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border divide-y divide-border">
          {filas.map(({ ind, valor, promTerritorio }) => (
            <div
              key={ind.id}
              className="px-4 py-3 hover:bg-bg transition cursor-pointer"
              onClick={() => onDrilldown?.(ind)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 text-xs text-gray-ui font-mono shrink-0 pt-0.5">{ind.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-dark mb-1">{ind.nombre}</p>
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
                  promedioTerritorio={promTerritorio}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
