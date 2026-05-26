import { useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { X } from 'lucide-react';
import { ESCUELAS, JARDINES, SLEPS, generarValorIndicador, calcularLogro, colorSemaforo } from '../data/establecimientos.js';
import { expectedToDate, formatValue } from '../data/expectedValue.js';
import { IndicatorProgress, SemaforoBadge, TipoBadge } from './Shared.jsx';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Average raw value for an indicator across all establishments of a sostenedor
function promedioSlepIndicador(indicador, slepId, mes) {
  const todos = [...ESCUELAS, ...JARDINES].filter(e => e.slep === slepId);
  if (!todos.length) return 0;
  let suma = 0;
  for (const est of todos) {
    const { valor } = generarValorIndicador(indicador, est.id, est.slep, mes);
    suma += valor;
  }
  return suma / todos.length;
}

function yAxisFormatter(unidad) {
  return (v) => {
    if (unidad === 'binario') return v === 1 ? 'Sí' : v === 0 ? 'No' : '';
    if (unidad === '%') return `${Math.round(v * 100)}%`;
    return String(Math.round(v * 10) / 10);
  };
}

function semColorHex(semaforo) {
  return { lime: 'rgb(0,138,201)', amber: 'rgb(255,180,0)', red: 'rgb(228,21,105)' }[semaforo] ?? 'rgb(0,138,201)';
}

export default function IndicatorDrilldown({ indicador, establecimientoId, slep, effectiveMonth, perfil, onClose }) {
  // Escape key closes modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Current value
  const { valor } = generarValorIndicador(indicador, establecimientoId, slep, effectiveMonth);
  const logro = calcularLogro(valor, indicador);
  const semaforo = colorSemaforo(logro);
  const lineColor = semColorHex(semaforo);

  // Evolution data: one point per month from 1 to effectiveMonth
  const evol = [];
  for (let m = 1; m <= effectiveMonth; m++) {
    const { valor: v } = generarValorIndicador(indicador, establecimientoId, slep, m);
    evol.push({
      mes: MESES[m - 1],
      Actual: indicador.unidad === '%' ? Math.round(v * 100) / 100
             : indicador.unidad === 'binario' ? (v ? 1 : 0)
             : Math.round(v * 10) / 10,
      Esperado: (() => {
        const exp = expectedToDate(indicador, m);
        if (indicador.unidad === '%') return Math.round(exp * 100) / 100;
        if (indicador.unidad === 'binario') return exp;
        return Math.round(exp * 10) / 10;
      })(),
    });
  }

  const showSostenedorTable = perfil === 'consultor' || perfil === 'cap';

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
                <span className="text-xs font-mono text-gray-ui">{indicador.id}</span>
                <span className="tag tag-navy">{indicador.ambito}</span>
                <TipoBadge tipo={indicador.tipo}/>
                <SemaforoBadge logro={logro}/>
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

        {/* Hero: enlarged IndicatorProgress */}
        <div className="px-6 py-5 border-b border-border">
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-3">Situación actual · {MESES[effectiveMonth - 1]} {new Date().getFullYear()}</p>
          <IndicatorProgress indicador={indicador} valor={valor} mes={effectiveMonth} large/>
        </div>

        {/* Evolution chart */}
        <div className="px-6 py-5 border-b border-border">
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Evolución mensual</p>
          <p className="text-sm text-gray-dark mb-4">Valor real vs esperado acumulado según frecuencia</p>
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
                    : indicador.unidad === 'binario' ? (v ? 'Sí' : 'No')
                    : v,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Line type="monotone" dataKey="Actual" stroke={lineColor} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }}/>
                <Line type="monotone" dataKey="Esperado" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 5" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sostenedor comparison — consultor / cap only */}
        {showSostenedorTable && (
          <div className="px-6 py-5">
            <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-1">Comparación entre sostenedores</p>
            <p className="text-sm text-gray-dark mb-3">Promedio de establecimientos por red</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                    <th className="py-2 pr-3 font-medium">Sostenedor</th>
                    <th className="py-2 px-3 font-medium text-right">Actual</th>
                    <th className="py-2 px-3 font-medium text-right">Esperado</th>
                    <th className="py-2 pl-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {SLEPS.map(s => {
                    const avg = promedioSlepIndicador(indicador, s.id, effectiveMonth);
                    const exp = expectedToDate(indicador, effectiveMonth);
                    const logroS = calcularLogro(avg, indicador);
                    return (
                      <tr key={s.id} className="border-b border-border hover:bg-bg transition">
                        <td className="py-2.5 pr-3 font-medium text-gray-dark">{s.nombre.replace(/^SLEP\s+/, '')}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatValue(indicador, avg)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-ui">{formatValue(indicador, exp)}</td>
                        <td className="py-2.5 pl-3"><SemaforoBadge logro={logroS}/></td>
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
