import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, generarValorIndicador, calcularLogro, logroPorAmbito, evolucionAmbito, promedioSlepAmbito, MES_ACTUAL } from '../data/establecimientos.js';
// generarValorIndicador and calcularLogro still used in evol computation above
import { AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, PageHeader } from '../components/Shared.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import { Target, Award, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export default function VistaEscuela() {
  const { perfil } = useApp();
  const [drilldown, setDrilldown] = useState(null);
  const esJardin = perfil.id === 'jardin';
  const programa = esJardin ? 'parvulario' : 'escolar';
  const AMBITOS = esJardin ? AMBITOS_PARVULARIO : AMBITOS_ESCOLAR;
  const INDS    = esJardin ? INDICADORES_PARVULARIO : INDICADORES_ESCOLAR;
  const todos   = esJardin ? JARDINES : ESCUELAS;

  const entidad = resolverEntidad(perfil.contexto);
  if (!entidad) return <p>Establecimiento no encontrado.</p>;

  const slep = SLEPS.find(s => s.id === entidad.slep);
  const logros = logroPorAmbito(INDS, entidad.id, entidad.slep);
  const promedios = Object.fromEntries(
    AMBITOS.map(a => [a.id, promedioSlepAmbito(INDS, todos, entidad.slep, a.id)])
  );

  // Logro global
  const logroGlobal = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;

  // Best / worst ámbito for this establishment
  const ambitosSorted = AMBITOS.map(a => ({ ambito: a, logro: logros[a.id] ?? 0 }))
    .sort((a, b) => b.logro - a.logro);
  const mejorAmbito   = ambitosSorted[0];
  const criticoAmbito = ambitosSorted[ambitosSorted.length - 1];

  // Delta vs sostenedor average (global)
  const promedioSlepGlobal = Object.values(promedios).reduce((a, b) => a + b, 0) / AMBITOS.length;
  const deltaVsSostenedor = logroGlobal - promedioSlepGlobal;

  // Data para evolución (apilada por ámbito)
  const evol = (() => {
    const meses = ['Ene','Feb','Mar','Abr','May'];
    return meses.map((m, idx) => {
      const row = { mes: m };
      AMBITOS.forEach(a => {
        const indsA = INDS.filter(i => i.ambito === a.id);
        let s = 0, n = 0;
        for (const ind of indsA) {
          const { valor } = generarValorIndicador(ind, entidad.id, entidad.slep, idx + 1);
          s += Math.min(1, calcularLogro(valor, ind));
          n += 1;
        }
        row[a.codigo] = Math.round((n ? s/n : 0) * 100);
      });
      return row;
    });
  })();


  return (
    <>
      {/* Banner celeste con contexto */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-cyan)" }}>
        <div>
          <p className="text-xs text-white/80 tracking-wider font-medium mb-1">
            {entidad.tipo.toUpperCase()} · COHORTE {entidad.cohorte}
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">{entidad.nombre}</h2>
          <p className="text-white/80 mt-1 text-sm">{slep?.nombre.replace('SLEP ', '')} · Programa Aprender en Familia</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">PERÍODO</p>
            <p className="font-medium mt-1">Mayo 2026</p>
          </div>
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">LOGRO GLOBAL</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Logro global"
          value={`${Math.round(logroGlobal * 100)}%`}
          sublabel={`sobre ${INDS.length} indicadores del programa`}
          icon={Target}
        />
        <KpiCard
          label="Mejor ámbito"
          value={mejorAmbito ? `${Math.round(mejorAmbito.logro * 100)}%` : '—'}
          sublabel={mejorAmbito?.ambito.nombre ?? ''}
          icon={Award}
          color="lime"
        />
        <KpiCard
          label="Ámbito crítico"
          value={criticoAmbito ? `${Math.round(criticoAmbito.logro * 100)}%` : '—'}
          sublabel={criticoAmbito?.ambito.nombre ?? ''}
          icon={AlertTriangle}
          color="magenta"
        />
        <KpiCard
          label="Vs sostenedor"
          value={`${deltaVsSostenedor >= 0 ? '+' : ''}${Math.round(deltaVsSostenedor * 100)} pp`}
          sublabel={deltaVsSostenedor >= 0 ? 'sobre el promedio del sostenedor' : 'bajo el promedio del sostenedor'}
          icon={deltaVsSostenedor >= 0 ? TrendingUp : TrendingDown}
          color={deltaVsSostenedor >= 0 ? 'sky' : 'navy'}
        />
      </div>

      {/* Semáforos por ámbito */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro por ámbito"
        subtitle="% de cumplimiento agregado de los indicadores de cada ámbito comparado con el promedio del sostenedor."
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${AMBITOS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
        {AMBITOS.map(a => (
          <AmbitoCard
            key={a.id}
            ambito={a}
            logro={logros[a.id]}
            deltaPromedio={logros[a.id] - promedios[a.id]}
          />
        ))}
      </div>

      {/* Evolución mensual */}
      <div className="card mb-8">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-xs font-medium tracking-wider uppercase">Evolución del año</p>
            <h3 className="text-lg text-gray-dark">Logro mensual por ámbito</h3>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evol} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              {AMBITOS.map((a, i) => {
                const colors = ['rgb(0,138,201)', 'rgb(228,21,105)', 'rgb(255,220,0)', 'rgb(179,67,120)'];
                return (
                  <Line
                    key={a.id}
                    type="monotone"
                    dataKey={a.codigo}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparativa con SLEP */}
      <div className="card mb-8">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-xs font-medium tracking-wider uppercase">Comparativa territorial</p>
            <h3 className="text-lg text-gray-dark">Tu establecimiento vs promedio {slep?.nombre.replace('SLEP ', '')}</h3>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={AMBITOS.map(a => ({
              ambito: a.codigo,
              'Tu establecimiento': Math.round(logros[a.id] * 100),
              'Promedio sostenedor': Math.round(promedios[a.id] * 100),
            }))} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="ambito" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="Tu establecimiento" fill="rgb(0,138,201)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Promedio sostenedor" fill="rgb(255,220,0)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle por indicador */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle</p>
          <h3 className="text-lg text-gray-dark">Indicadores del programa</h3>
          <p className="text-sm text-gray-ui mt-1">Haz clic en un ámbito para expandir sus indicadores, y en un indicador para ver el detalle.</p>
        </div>
        <IndicatorPanel
          INDS={INDS}
          AMBITOS={AMBITOS}
          establecimientoId={entidad.id}
          slep={entidad.slep}
          mes={MES_ACTUAL}
          onDrilldown={(ind) => setDrilldown(ind)}
        />
      </div>

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown}
          establecimientoId={entidad.id}
          slep={entidad.slep}
          effectiveMonth={MES_ACTUAL}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  );
}
