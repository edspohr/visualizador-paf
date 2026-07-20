import { useMemo, useState } from 'react';
import { calcularLogro, colorSemaforo } from '../data/establecimientos.js';
import { formatValue } from '../data/expectedValue.js';
import { isAplicable2026 } from '../data/scope.js';
import { indicadorCodigo, ambitoCodigo } from '../lib/labels.js';

// Escala ternaria consistente con el resto de la app. El proyecto usa
// verde→cyan, amber→yellow, red→crimson/red.
const CELL_COLOR = {
  red:   'var(--color-red)',
  amber: 'var(--color-yellow)',
  lime:  'var(--color-cyan)',
  gray:  'rgb(229, 231, 235)', // tailwind gray-200 — mismo que border sutil
};

// Mapa de calor Establecimientos × Indicadores.
// - Filas: cada `establecimiento`.
// - Columnas: cada indicador de `INDS` (excluye sin_meta y sin metaNum).
// - Celda: `calcularLogro` clampeado a [0, 1.2] → `colorSemaforo` → color continuo por bandas.
// - Click celda → `onCellClick(indicador, estId)`.
export default function HeatmapEstablecimientosIndicadores({
  establecimientos,
  INDS,
  valoresPorEst,
  mes,
  onCellClick,
}) {
  const [ambitoFiltro, setAmbitoFiltro] = useState('TODOS');

  const indsElegibles = useMemo(
    () => INDS.filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null && (ambitoFiltro === 'TODOS' || i.ambito === ambitoFiltro)),
    [INDS, ambitoFiltro]
  );

  const ambitos = useMemo(() => {
    const s = new Set(INDS.map(i => i.ambito));
    return [...s].sort();
  }, [INDS]);

  if (!establecimientos.length) {
    return <p className="text-sm text-gray-ui italic py-6 text-center">Sin establecimientos con los filtros actuales.</p>;
  }
  if (!indsElegibles.length) {
    return <p className="text-sm text-gray-ui italic py-6 text-center">Sin indicadores para el ámbito seleccionado.</p>;
  }

  const templateCols = `minmax(200px, 260px) repeat(${indsElegibles.length}, minmax(22px, 1fr))`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-gray-ui font-medium uppercase tracking-wider">Ámbito</label>
        <select
          value={ambitoFiltro}
          onChange={e => setAmbitoFiltro(e.target.value)}
          className="px-2 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark outline-none"
        >
          <option value="TODOS">Todos</option>
          {ambitos.map(a => <option key={a} value={a}>{ambitoCodigo(a)}</option>)}
        </select>
        <div className="flex items-center gap-3 text-[11px] text-gray-ui ml-auto">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CELL_COLOR.red }}/> &lt; 60%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CELL_COLOR.amber }}/> 60–85%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CELL_COLOR.lime }}/> ≥ 85%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CELL_COLOR.gray }}/> sin dato</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <div className="min-w-max">
          {/* Header row */}
          <div className="grid sticky top-0 bg-white z-10 border-b border-border" style={{ gridTemplateColumns: templateCols }}>
            <div className="px-3 py-2 text-[10px] font-medium text-gray-ui uppercase tracking-wider border-r border-border">
              Establecimiento
            </div>
            {indsElegibles.map(ind => (
              <div
                key={ind.id}
                className="px-1 py-2 text-[9px] font-mono text-gray-ui text-center border-r border-border truncate"
                title={`${indicadorCodigo(ind.id)} · ${ind.nombre}`}
              >
                {indicadorCodigo(ind.id)}
              </div>
            ))}
          </div>
          {/* Rows */}
          {establecimientos.map(est => (
            <div key={est.id} className="grid border-b border-border hover:bg-bg/60" style={{ gridTemplateColumns: templateCols }}>
              <div className="px-3 py-1.5 text-xs text-gray-dark truncate border-r border-border" title={est.nombre}>
                {est.nombre}
              </div>
              {indsElegibles.map(ind => {
                const applies = isAplicable2026(ind, est, mes);
                const raw = valoresPorEst.get(est.id)?.get(ind.id);
                const valor = applies ? (raw?.valor ?? raw ?? null) : null;
                const logro = valor === null ? null : calcularLogro(valor, ind);
                const cName = colorSemaforo(logro);
                const bg = CELL_COLOR[cName] ?? CELL_COLOR.gray;
                const tooltip = `${est.nombre}\n${ind.nombre}\n${valor === null ? 'Sin dato' : `${formatValue(ind, valor)} / meta ${formatValue(ind, ind.metaNum)}`}`;
                return (
                  <button
                    key={ind.id}
                    onClick={() => onCellClick?.(ind, est.id)}
                    className="h-6 border-r border-border transition hover:opacity-80"
                    style={{ background: bg }}
                    title={tooltip}
                    aria-label={tooltip}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-ui">
        Haz clic en una celda para abrir el detalle del indicador para ese establecimiento.
      </p>
    </div>
  );
}
