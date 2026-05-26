import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { generarValorIndicador, calcularLogro } from '../data/establecimientos.js';
import { SemaforoBadge, TipoBadge, IndicatorProgress } from './Shared.jsx';

/**
 * Renders all indicators grouped by ámbito.
 * Each ámbito is a collapsible row. Each indicator row is clickable (opens drilldown).
 *
 * Props:
 *   INDS            — indicator list for the program
 *   AMBITOS         — ámbito list for the program
 *   establecimientoId — establishment id used for data generation
 *   slep            — sostenedor id
 *   mes             — effective month
 *   onDrilldown     — callback(ind) when a row is clicked
 */
export default function IndicatorPanel({ INDS, AMBITOS, establecimientoId, slep, mes, onDrilldown }) {
  const [openAmbitos, setOpenAmbitos] = useState({});
  const toggle = (id) => setOpenAmbitos(prev => ({ ...prev, [id]: !prev[id] }));

  const filasIndicadores = INDS.map(ind => {
    const { valor } = generarValorIndicador(ind, establecimientoId, slep, mes);
    const logro = calcularLogro(valor, ind);
    return { ind, valor, logro };
  });

  return (
    <div className="space-y-2">
      {AMBITOS.map(a => {
        const filas = filasIndicadores.filter(f => f.ind.ambito === a.id);
        if (!filas.length) return null;
        const isOpen = !!openAmbitos[a.id];
        const promedioAmbito = filas.reduce((s, f) => s + f.logro, 0) / filas.length;
        return (
          <div key={a.id} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(a.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg transition text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="tag tag-navy shrink-0">{a.codigo}</span>
                <span className="text-sm font-medium text-gray-dark truncate">{a.nombre}</span>
                <SemaforoBadge logro={promedioAmbito}/>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium text-gray-dark">{Math.round(promedioAmbito * 100)}%</span>
                {isOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {filas.map(({ ind, valor, logro }) => (
                  <div
                    key={ind.id}
                    className="px-4 py-3 hover:bg-bg transition cursor-pointer"
                    onClick={() => onDrilldown?.(ind)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 text-xs text-gray-ui font-mono shrink-0 pt-0.5">{ind.id}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm text-gray-dark">{ind.nombre}</span>
                          <TipoBadge tipo={ind.tipo}/>
                          <SemaforoBadge logro={logro}/>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-ui">
                          <span>Actividad: {ind.actividad}</span>
                          <span>Frec: {ind.frecuencia}</span>
                          <span>Fuente: {ind.fuente}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pl-[60px]">
                      <IndicatorProgress indicador={ind} valor={valor} mes={mes}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
