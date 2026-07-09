import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { calcularLogro } from '../data/establecimientos.js';
import { isAplicable2026 } from '../data/scope.js';

/**
 * Comparativa del sostenedor actual contra el resto de sostenedores (mismo tipo).
 *
 * Muestra una barra por sostenedor con el % de cumplimiento promedio sobre TODOS
 * los indicadores aplicables del programa (mismo cálculo que el KPI). La barra
 * del sostenedor actual queda resaltada en magenta; las demás en gris. Una línea
 * vertical marca el promedio de todos los sostenedores para referencia rápida.
 *
 * Reglas:
 *   - Universo: indicadores aplicables al centro (cohorte × semestre).
 *   - sin_meta excluidos.
 *   - Faltantes (indicador aplicable sin dato) cuentan 0.
 *
 * Props:
 *   INDS             — indicadores del programa
 *   establecimientos — todos los centros del programa del mismo tipo (escuelas o jardines)
 *   sostenedores     — lista de SLEPs del programa
 *   sostenedorActual — id del sostenedor a resaltar
 *   mes              — mes efectivo dentro de 2026
 *   getValor         — required (indicadorId, estId) => number | null
 */
export default function SostenedorVsPromedio({
  INDS,
  establecimientos,
  sostenedores = [],
  sostenedorActual,
  mes,
  getValor,
}) {
  const elegibles = useMemo(
    () => INDS.filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null),
    [INDS]
  );

  const chartData = useMemo(() => {
    if (!getValor) return { rows: [], promedio: 0 };
    // Cumplimiento por centro
    const cumplByEst = new Map();
    for (const est of establecimientos) {
      const aplicables = elegibles.filter(ind => isAplicable2026(ind, est, mes));
      if (!aplicables.length) continue;
      let suma = 0;
      for (const ind of aplicables) {
        const v = getValor(ind.id, est.id);
        if (v === null || v === undefined) continue;
        const l = calcularLogro(v, ind);
        if (l === null) continue;
        suma += Math.min(1, l);
      }
      cumplByEst.set(est.id, { est, cumpl: suma / aplicables.length });
    }
    // Promedio por sostenedor
    const bySlep = new Map();
    for (const { est, cumpl } of cumplByEst.values()) {
      if (!est.slep) continue;
      if (!bySlep.has(est.slep)) bySlep.set(est.slep, []);
      bySlep.get(est.slep).push(cumpl);
    }
    const rows = [...bySlep.entries()].map(([slepId, cumpls]) => {
      const avg = cumpls.reduce((s, v) => s + v, 0) / cumpls.length;
      const slep = sostenedores.find(s => s.id === slepId);
      return {
        id: slepId,
        nombre: slep ? slep.nombre.replace(/^SLEP\s+/, '') : slepId,
        valor: avg,
        actual: slepId === sostenedorActual,
      };
    }).sort((a, b) => b.valor - a.valor);
    const promedio = rows.length ? rows.reduce((s, r) => s + r.valor, 0) / rows.length : 0;
    return { rows, promedio };
  }, [establecimientos, elegibles, getValor, sostenedores, sostenedorActual, mes]);

  const fmtPct = (v) => `${Math.round(v * 100)}%`;
  const rows = chartData.rows;
  const promedio = chartData.promedio;

  if (rows.length <= 1) {
    // Un solo sostenedor en el conjunto — no tiene sentido comparar.
    return null;
  }

  return (
    <div className="card mb-6">
      <div className="mb-4">
        <p className="text-xs font-medium tracking-wider uppercase text-gray-ui">Comparativa</p>
        <h3 className="text-lg text-gray-dark">Este sostenedor vs el resto</h3>
        <p className="text-xs text-gray-ui mt-1">
          % de cumplimiento sobre los indicadores aplicables del programa. La línea punteada marca
          el promedio de todos los sostenedores ({fmtPct(promedio)}).
        </p>
      </div>

      <div style={{ height: Math.max(200, rows.length * 42 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
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
              formatter={(v) => [fmtPct(v), '% cumplimiento']}
              labelStyle={{ color: '#6B7280', marginBottom: 4 }}
            />
            <ReferenceLine
              x={promedio}
              stroke="var(--color-gray-ui)"
              strokeDasharray="4 3"
              label={{
                value: `promedio ${fmtPct(promedio)}`,
                position: 'top',
                fill: '#6B7280',
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="valor"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', formatter: (v) => fmtPct(v), fontSize: 11, fill: '#333333' }}
            >
              {rows.map((row, i) => (
                <Cell
                  key={row.id ?? i}
                  fill={row.actual ? 'var(--color-magenta)' : 'var(--color-gray-light)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
