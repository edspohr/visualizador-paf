import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calcularLogro } from '../data/establecimientos.js';

/**
 * Bar chart of the average logro (across ALL indicators) por sostenedor.
 *
 * Diseño:
 *  - Sin selector de indicador. El valor mostrado es el promedio de logro sobre
 *    todos los indicadores del programa, agregado por centro y luego por
 *    sostenedor (o por centro si el usuario elige un sostenedor específico).
 *  - Dropdown "Sostenedor": "Todos los sostenedores" (default) → agrupa por
 *    sostenedor. Elegir uno → desagrega en los centros de ese sostenedor.
 *  - Eje X: porcentaje 0–100% (logro promedio).
 *
 * Props:
 *   INDS             — lista de indicadores del programa
 *   establecimientos — todos los centros del programa (sin filtrar por sostenedor)
 *   sostenedores     — lista de SLEPs
 *   getValor         — (indicadorId, estId) => number | null
 */
export default function SostenedorAveragePicker({ INDS, establecimientos, sostenedores = [], getValor = null }) {
  const [sostenedorFocal, setSostenedorFocal] = useState('TODOS');

  // Indicadores elegibles: los que tienen meta.
  const elegibles = useMemo(
    () => INDS.filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null),
    [INDS]
  );

  // Logro promedio por centro (avg de calcularLogro sobre todos los indicadores).
  const logroByEst = useMemo(() => {
    const map = new Map(); // estId → { est, logro }
    for (const est of establecimientos) {
      let sum = 0, n = 0;
      for (const ind of elegibles) {
        const v = getValor ? getValor(ind.id, est.id) : null;
        if (v === null || v === undefined) continue;
        const l = calcularLogro(v, ind);
        if (l === null) continue;
        sum += Math.min(1, l); // cap a 1.0 para que el eje 0–100% sea coherente
        n++;
      }
      if (n > 0) map.set(est.id, { est, logro: sum / n });
    }
    return map;
  }, [establecimientos, elegibles, getValor]);

  const chartData = useMemo(() => {
    if (sostenedorFocal === 'TODOS') {
      // Agrupar por sostenedor: promedio de logro de sus centros
      const bySlep = new Map();
      for (const { est, logro } of logroByEst.values()) {
        if (!est.slep) continue;
        if (!bySlep.has(est.slep)) bySlep.set(est.slep, []);
        bySlep.get(est.slep).push(logro);
      }
      return [...bySlep.entries()].map(([slepId, logros]) => {
        const avg = logros.reduce((s, v) => s + v, 0) / logros.length;
        const slep = sostenedores.find(s => s.id === slepId);
        return {
          nombre: slep ? slep.nombre.replace(/^SLEP\s+/, '') : slepId,
          valor: avg,
          nCentros: logros.length,
        };
      }).sort((a, b) => b.valor - a.valor);
    }
    // Sostenedor específico → agrupar por centro
    return [...logroByEst.values()]
      .filter(({ est }) => est.slep === sostenedorFocal)
      .map(({ est, logro }) => ({
        nombre: est.nombre,
        valor: logro,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [sostenedorFocal, logroByEst, sostenedores]);

  const sostenedoresDisponibles = useMemo(() => {
    const ids = new Set(establecimientos.map(e => e.slep).filter(Boolean));
    return sostenedores.filter(s => ids.has(s.id));
  }, [establecimientos, sostenedores]);

  const fmtPct = (v) => `${Math.round(v * 100)}%`;
  const titulo = sostenedorFocal === 'TODOS'
    ? 'Promedio de logro por sostenedor'
    : `Centros educativos de ${sostenedores.find(s => s.id === sostenedorFocal)?.nombre.replace(/^SLEP\s+/, '') ?? ''}`;

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui">Comparativa</p>
          <h3 className="text-lg text-gray-dark">{titulo}</h3>
        </div>
        <div className="flex-1 min-w-[200px] max-w-xs">
          <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
          <select
            value={sostenedorFocal}
            onChange={e => setSostenedorFocal(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 outline-none"
            style={{ '--tw-ring-color': 'var(--color-cyan)' }}
          >
            <option value="TODOS">Todos los sostenedores</option>
            {sostenedoresDisponibles.map(s => (
              <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-ui mb-3">
        Promedio de logro sobre <span className="font-medium text-gray-dark">{elegibles.length}</span> indicadores del programa (0–100%).
      </p>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-ui text-center py-8">Sin datos para mostrar.</p>
      ) : (
        <div style={{ height: Math.max(200, chartData.length * 32 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 40, bottom: 4, left: -10 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false}/>
              <XAxis
                type="number"
                stroke="#6B7280"
                fontSize={11}
                tickFormatter={fmtPct}
                domain={[0, 1]}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                stroke="#6B7280"
                fontSize={11}
                width={140}
                tick={{ fill: '#333333' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => [fmtPct(v), 'Logro promedio']}
                labelStyle={{ color: '#6B7280', marginBottom: 4 }}
              />
              <Bar
                dataKey="valor"
                fill="var(--color-cyan)"
                radius={[0, 4, 4, 0]}
                label={{ position: 'right', formatter: (v) => fmtPct(v), fontSize: 11, fill: '#333333' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
