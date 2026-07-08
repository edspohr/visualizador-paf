import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generarValorIndicador } from '../data/establecimientos.js';
import { formatValue } from '../data/expectedValue.js';
import { indicadorCodigo } from '../lib/labels.js';

/**
 * Indicator selector + bar chart of average values broken down by entity.
 *
 * Props:
 *   INDS             — full indicator list for this program
 *   establecimientos — the relevant establishment objects (already filtered)
 *   mes              — effective month (number)
 *   breakdownBy      — 'establecimiento' | 'sostenedor'
 *   sostenedores     — list of SLEPs (needed for 'sostenedor' breakdown labels)
 */
export default function IndicatorAveragePicker({ INDS, establecimientos, mes, breakdownBy = 'establecimiento', sostenedores = [] }) {
  const elegibles = INDS.filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null);
  const [indId, setIndId] = useState(elegibles[0]?.id ?? '');

  const indicador = elegibles.find(i => i.id === indId) ?? elegibles[0];

  const chartData = useMemo(() => {
    if (!indicador) return [];

    if (breakdownBy === 'sostenedor') {
      // Group establishments by SLEP, average within each group
      const bySostened = {};
      for (const est of establecimientos) {
        if (!bySostened[est.slep]) bySostened[est.slep] = [];
        const { valor } = generarValorIndicador(indicador, est.id, est.slep, mes);
        if (valor !== null) bySostened[est.slep].push(valor);
      }
      return Object.entries(bySostened).map(([slepId, vals]) => {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const slep = sostenedores.find(s => s.id === slepId);
        return {
          nombre: slep ? slep.nombre.replace(/^SLEP\s+/, '') : slepId,
          valor: avg,
          label: formatValue(indicador, avg),
        };
      }).sort((a, b) => b.valor - a.valor);
    }

    // breakdownBy === 'establecimiento'
    return establecimientos.map(est => {
      const { valor } = generarValorIndicador(indicador, est.id, est.slep, mes);
      return {
        nombre: est.nombre,
        valor: valor ?? 0,
        label: formatValue(indicador, valor ?? 0),
      };
    }).sort((a, b) => b.valor - a.valor);
  }, [indicador, establecimientos, mes, breakdownBy, sostenedores]);

  if (!indicador) return null;

  // Y-axis formatter
  const yFmt = (v) => {
    if (indicador.unidad === '%') return `${Math.round(v * 100)}%`;
    if (indicador.unidad === 'binario') return v === 1 ? 'Sí' : 'No';
    return String(Math.round(v * 10) / 10);
  };

  const metaLine = indicador.metaNum;

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui">Comparativa por indicador</p>
          <h3 className="text-lg text-gray-dark">Promedio por {breakdownBy === 'sostenedor' ? 'sostenedor' : 'centro educativo'}</h3>
        </div>
        <div className="flex-1 min-w-[200px] max-w-xs">
          <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Indicador</label>
          <select
            value={indId}
            onChange={e => setIndId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 outline-none"
            style={{ '--tw-ring-color': 'var(--color-cyan)' }}
          >
            {elegibles.map(i => (
              <option key={i.id} value={i.id}>[{indicadorCodigo(i.id)}] {i.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Meta reference line label */}
      <p className="text-xs text-gray-ui mb-3">
        Meta anual: <span className="font-medium text-gray-dark">{formatValue(indicador, metaLine)}</span>
        <span className="ml-3">Actualización: <span className="font-medium text-gray-dark">{indicador.frecuencia}</span></span>
      </p>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 16, bottom: 40, left: -10 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false}/>
            <XAxis
              type="number"
              stroke="#6B7280"
              fontSize={11}
              tickFormatter={yFmt}
              domain={[0, indicador.unidad === '%' ? 1 : indicador.unidad === 'binario' ? 1 : 'auto']}
            />
            <YAxis
              type="category"
              dataKey="nombre"
              stroke="#6B7280"
              fontSize={11}
              width={120}
              tick={{ fill: '#333333' }}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              formatter={(v) => [formatValue(indicador, v), indicador.nombre]}
              labelStyle={{ color: '#6B7280', marginBottom: 4 }}
            />
            <Bar
              dataKey="valor"
              fill="var(--color-cyan)"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', formatter: (v) => formatValue(indicador, v), fontSize: 11, fill: '#333333' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
