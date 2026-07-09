import { useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { X } from 'lucide-react';
import { formatValue } from '../data/expectedValue.js';
import { IndicatorProgress } from './Shared.jsx';
import { indicadorCodigo, ambitoCodigo } from '../lib/labels.js';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function yAxisFormatter(unidad) {
  return (v) => {
    // Binary: peer/aggregate line arrives fractional in [0,1] = % de "Sí"; own line
    // arrives 0/1. Format both as % so the axis is a single "% de Sí" scale.
    if (unidad === 'binario') return `${Math.round(v * 100)}%`;
    if (unidad === '%') return `${Math.round(v * 100)}%`;
    return String(Math.round(v * 10) / 10);
  };
}

/**
 * Ficha detallada de un indicador para un centro educativo.
 *
 * Datos:
 *  - `valor`: valor real del centro educativo (o null si no hay dato).
 *  - `estado`: 'validado' | 'provisional' — atenúa el número si aplica.
 *  - `promedioTerritorio`: número real (o null); promedio del mismo tipo/SLEP
 *     precomputado por el llamador (no se calcula aquí).
 *  - `valoresTerritorio`: opcional Map<estId, valor> con los valores de los
 *     centros pares del territorio para armar tabla de comparación.
 *  - `mes`: mes efectivo (para el label). El año siempre es 2026.
 *  - `todosEstablecimientos`: centros pares (mismo tipo/SLEP) para tabla.
 *  - `sostenedores`, `perfil`: para mostrar tabla cross-sostenedor si aplica.
 *  - `promedioPorSostenedor`: Map<slepId, promedio> para la tabla cross-red.
 */
export default function IndicatorDrilldown({
  indicador,
  establecimientoId,
  slep,
  mes,
  perfil,
  onClose,
  valor = null,
  estado = 'validado',
  promedioTerritorio = null,
  todosEstablecimientos = [],
  sostenedores = [],
  valoresTerritorio = new Map(),
  promedioPorSostenedor = new Map(),
  anioEnCurso = true,
  anio = 2026,
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const est = todosEstablecimientos.find(e => e.id === establecimientoId);
  const tipo = est?.tipo ?? 'Escuela';

  // Datos de evolución mensual solo se muestran cuando el llamador provee un
  // `series` prop. En esta vista mock (mes puntual) omitimos la línea temporal
  // y mostramos la comparación estática de este mes.
  const evol = useMemo(() => (
    valor === null && promedioTerritorio === null
      ? []
      : [{
          mes: MESES[mes - 1],
          'Este centro educativo': fmtChartVal(indicador, valor),
          'Promedio del territorio': fmtChartVal(indicador, promedioTerritorio),
        }]
  ), [indicador, valor, promedioTerritorio, mes]);

  const showSostenedorTable = perfil === 'consultor' || perfil === 'cap';
  const showEstablecimientoTable = perfil === 'sostenedor';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-0 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl my-0 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono text-gray-ui">{indicadorCodigo(indicador.id)}</span>
                <span className="tag tag-navy">{ambitoCodigo(indicador.ambito)}</span>
              </div>
              <h2 className="text-lg font-medium text-gray-dark leading-snug">{indicador.nombre}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-ui mt-1.5">
                <span>Actividad: {indicador.actividad}</span>
                <span>Frecuencia: {indicador.frecuencia}</span>
                <span>Fuente: {indicador.fuente}</span>
                <span>Meta: {indicador.meta}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-bg text-gray-ui transition"
            >
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Hero: two-bar IndicatorProgress */}
        <div className="px-6 py-5 border-b border-border">
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-3">
            Situación actual · {MESES[mes - 1]} {anio}
          </p>
          <IndicatorProgress
            indicador={indicador}
            valor={valor}
            promedioTerritorio={promedioTerritorio}
            large
            estado={estado}
            anioEnCurso={anioEnCurso}
          />
        </div>

        {/* Evolution chart: este centro vs promedio del territorio (mes actual) */}
        {evol.length === 0 && (
          <div className="px-6 py-5 border-b border-border">
            <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Comparativa del mes</p>
            <p className="text-sm text-gray-ui italic">Aún no hay valores reportados para este indicador en {anio}.</p>
          </div>
        )}
        {evol.length > 0 && (
          <div className="px-6 py-5 border-b border-border">
            <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Comparativa del mes</p>
            <p className="text-sm text-gray-dark mb-4">Este centro educativo vs promedio de {tipo === 'Jardín' ? 'jardines' : 'escuelas'} del territorio</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evol} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false}/>
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={11}/>
                  <YAxis stroke="#6B7280" fontSize={11} tickFormatter={yAxisFormatter(indicador.unidad)}/>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(v, name) => [
                      indicador.unidad === '%' ? `${Math.round(v * 100)}%`
                      : indicador.unidad === 'binario' ? `${Math.round(v * 100)}% Sí`
                      : v,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Line
                    type="monotone"
                    dataKey="Este centro educativo"
                    stroke="var(--color-cyan)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="Promedio del territorio"
                    stroke="var(--color-gray-light)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Comparación cross-sostenedor (perfiles consultor / CAP) */}
        {showSostenedorTable && (
          <div className="px-6 py-5">
            <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Comparación entre sostenedores</p>
            <p className="text-sm text-gray-dark mb-3">Promedio de {tipo === 'Jardín' ? 'jardines' : 'escuelas'} por red</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                    <th className="py-2 pr-3 font-medium">Sostenedor</th>
                    <th className="py-2 pl-3 font-medium text-right">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {sostenedores.map(s => {
                    const avg = promedioPorSostenedor.get(s.id);
                    if (avg === null || avg === undefined) return null;
                    return (
                      <tr key={s.id} className="border-b border-border hover:bg-bg transition">
                        <td className="py-2.5 pr-3 font-medium text-gray-dark">{s.nombre.replace(/^SLEP\s+/, '')}</td>
                        <td className="py-2.5 pl-3 text-right font-medium text-gray-dark">{formatValue(indicador, avg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Comparación entre centros de la red (perfil sostenedor) */}
        {showEstablecimientoTable && (
          <div className="px-6 py-5">
            <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Comparación entre centros educativos</p>
            <p className="text-sm text-gray-dark mb-3">Valor por {tipo === 'Jardín' ? 'jardín infantil' : 'escuela'} de la red</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                    <th className="py-2 pr-3 font-medium">Centro educativo</th>
                    <th className="py-2 pl-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {todosEstablecimientos
                    .filter(e => e.slep === slep && e.tipo === tipo)
                    .map(e => {
                      const v = valoresTerritorio.get(e.id);
                      if (v === null || v === undefined) return null;
                      const isCurrent = e.id === establecimientoId;
                      return (
                        <tr key={e.id} className={`border-b border-border hover:bg-bg transition ${isCurrent ? 'bg-cyan-50/40' : ''}`}>
                          <td className="py-2.5 pr-3 font-medium text-gray-dark">
                            {e.nombre}{isCurrent && <span className="ml-2 text-xs text-cyan font-normal">(este)</span>}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-medium text-gray-dark">{formatValue(indicador, v)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom close button — mobile friendly */}
        <div className="px-6 pb-6 pt-2 sm:hidden">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-border text-sm font-medium text-gray-dark hover:bg-bg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Formatea un valor para la serie del chart. Binario y % se preservan como fracción,
// el resto como número redondeado.
function fmtChartVal(indicador, v) {
  if (v === null || v === undefined) return null;
  if (indicador.unidad === '%') return Math.round(v * 100) / 100;
  if (indicador.unidad === 'binario') return v; // 0..1
  return Math.round(v * 10) / 10;
}
