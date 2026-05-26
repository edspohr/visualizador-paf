import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, promedioSlepAmbito, MES_ACTUAL } from '../data/establecimientos.js';
import { AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, PageHeader } from '../components/Shared.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import { Building2, School, Users, Award, TrendingUp, AlertTriangle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

export default function VistaSostenedor() {
  const { perfil } = useApp();
  const slep = resolverEntidad(perfil.contexto);
  const [drilldown, setDrilldown] = useState(null); // { ind, estId, slepId }
  const [openEst, setOpenEst] = useState({});
  const toggleEst = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  if (!slep) return <p>SLEP no encontrado.</p>;

  // Determinar si este SLEP tiene escuelas o jardines
  const escuelasSlep = ESCUELAS.filter(e => e.slep === slep.id);
  const jardinesSlep = JARDINES.filter(j => j.slep === slep.id);
  const hayEscuelas = escuelasSlep.length > 0;
  const hayJardines = jardinesSlep.length > 0;

  // Por default mostramos lo que haya; si hay ambos, escolar
  const programaActivo = hayEscuelas ? 'escolar' : 'parvulario';
  const AMBITOS = programaActivo === 'escolar' ? AMBITOS_ESCOLAR : AMBITOS_PARVULARIO;
  const INDS    = programaActivo === 'escolar' ? INDICADORES_ESCOLAR : INDICADORES_PARVULARIO;
  const establecimientos = programaActivo === 'escolar' ? escuelasSlep : jardinesSlep;
  const todosDelTipo = programaActivo === 'escolar' ? ESCUELAS : JARDINES;

  // Calcular promedio del SLEP por ámbito (datos del propio sostenedor)
  const promediosSlep = Object.fromEntries(
    AMBITOS.map(a => [a.id, promedioSlepAmbito(INDS, todosDelTipo, slep.id, a.id)])
  );
  // Para comparar contra otros SLEP, promediar el resto de SLEPs del mismo tipo
  const otrosSleps = SLEPS.filter(s => s.id !== slep.id);
  const promediosOtros = Object.fromEntries(
    AMBITOS.map(a => {
      const promPorSlep = otrosSleps.map(s => promedioSlepAmbito(INDS, todosDelTipo, s.id, a.id)).filter(v => v > 0);
      const prom = promPorSlep.length ? promPorSlep.reduce((x,y)=>x+y,0) / promPorSlep.length : 0;
      return [a.id, prom];
    })
  );

  const logroGlobal = Object.values(promediosSlep).reduce((a,b)=>a+b,0) / AMBITOS.length;

  // Best / worst ámbito
  const ambitosSorted = AMBITOS.map(a => ({ ambito: a, logro: promediosSlep[a.id] ?? 0 }))
    .sort((a, b) => b.logro - a.logro);
  const mejorAmbito   = ambitosSorted[0];
  const criticoAmbito = ambitosSorted[ambitosSorted.length - 1];

  // Ranking de establecimientos
  const ranking = establecimientos.map(e => {
    const logros = logroPorAmbito(INDS, e.id, slep.id);
    const promedio = Object.values(logros).reduce((a,b)=>a+b,0) / AMBITOS.length;
    return { est: e, logros, promedio };
  }).sort((a, b) => b.promedio - a.promedio);

  return (
    <>
      {/* Banner navy con identidad sostenedor */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-magenta)" }}>
        <div>
          <p className="text-xs text-white/60 tracking-wider font-medium mb-1">SOSTENEDOR</p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">{slep.nombre}</h2>
          <div className="flex items-center gap-2 text-white/70 mt-1 text-sm">
            <MapPin size={14} /> {slep.comuna}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/10 px-3 py-2 rounded-xl">
            <p className="text-xs text-white/60 leading-none">ESTABLECIMIENTOS</p>
            <p className="font-medium mt-1">{escuelasSlep.length + jardinesSlep.length}</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl">
            <p className="text-xs text-white/60 leading-none">LOGRO PROMEDIO</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Establecimientos"
          value={escuelasSlep.length + jardinesSlep.length}
          sublabel={`${ranking.filter(r => r.promedio >= 0.85).length} en meta · ${ranking.filter(r => r.promedio >= 0.6 && r.promedio < 0.85).length} en desarrollo · ${ranking.filter(r => r.promedio < 0.6).length} requieren atención`}
          icon={Building2}
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
          label="En meta"
          value={`${ranking.filter(r => r.promedio >= 0.85).length} de ${ranking.length}`}
          sublabel={`${Math.round((ranking.filter(r => r.promedio >= 0.85).length / (ranking.length || 1)) * 100)}% de la red`}
          icon={TrendingUp}
          color="sky"
        />
      </div>

      {/* Semáforos por ámbito */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro por ámbito (red completa)"
        subtitle={`Promedio agregado de los ${establecimientos.length} establecimientos del sostenedor, comparado con el promedio de otros sostenedores.`}
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${AMBITOS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
        {AMBITOS.map(a => (
          <AmbitoCard
            key={a.id}
            ambito={a}
            logro={promediosSlep[a.id]}
            deltaPromedio={promediosSlep[a.id] - promediosOtros[a.id]}
          />
        ))}
      </div>

      {/* Comparativa radial vs otros SLEPs */}
      <div className="card mb-8">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Comparativa intersostenedores</p>
          <h3 className="text-lg text-gray-dark">Tu sostenedor vs promedio del resto</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={AMBITOS.map(a => ({
              ambito: a.codigo,
              [slep.nombre]: Math.round(promediosSlep[a.id] * 100),
              'Otros sostenedores': Math.round(promediosOtros[a.id] * 100),
            }))}>
              <PolarGrid stroke="#E5E7EB"/>
              <PolarAngleAxis dataKey="ambito" tick={{ fill: '#333333', fontSize: 12, fontWeight: 600 }}/>
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} />
              <Radar name={slep.nombre} dataKey={slep.nombre} stroke="#1A365D" fill="rgb(0,138,201)" fillOpacity={0.4}/>
              <Radar name="Otros sostenedores" dataKey="Otros sostenedores" stroke="#8CC63F" fill="rgb(255,220,0)" fillOpacity={0.25}/>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v) => `${v}%`}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking de establecimientos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle de la red</p>
          <h3 className="text-lg text-gray-dark">Establecimientos del sostenedor</h3>
          <p className="text-sm text-gray-ui mt-1">Ordenados por logro promedio. Cada barra muestra el % de logro por ámbito.</p>
        </div>

        <div className="space-y-2">
          {ranking.map(({ est, logros, promedio }, idx) => (
            <div key={est.id} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleEst(est.id)}
                className="w-full text-left p-4 hover:bg-bg transition"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-8 h-8 rounded-full font-medium text-white flex items-center justify-center text-sm shrink-0" style={{ background: "var(--color-cyan)" }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-dark truncate">{est.nombre}</h4>
                    <p className="text-xs text-gray-ui">{est.tipo} · Cohorte {est.cohorte}</p>
                  </div>
                  <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                    {AMBITOS.map(a => (
                      <div key={a.id} className="text-center">
                        <p className={`text-xs font-medium ${logros[a.id] >= 0.85 ? 'text-lime-600' : logros[a.id] >= 0.6 ? 'text-amber-700' : 'text-red-700'}`}>
                          {Math.round(logros[a.id] * 100)}%
                        </p>
                        <p className="text-[10px] text-gray-ui">{a.codigo}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-medium text-gray-dark leading-none">{Math.round(promedio * 100)}%</p>
                      <p className="text-xs text-gray-ui mt-1">logro global</p>
                    </div>
                    <SemaforoBadge logro={promedio}/>
                    {openEst[est.id] ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
                  </div>
                </div>
              </button>
              {openEst[est.id] && (
                <div className="border-t border-border px-4 py-4 bg-bg">
                  <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-3">Indicadores del programa</p>
                  <IndicatorPanel
                    INDS={INDS}
                    AMBITOS={AMBITOS}
                    establecimientoId={est.id}
                    slep={est.slep}
                    mes={MES_ACTUAL}
                    onDrilldown={(ind) => setDrilldown({ ind, estId: est.id, slepId: est.slep })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown.ind}
          establecimientoId={drilldown.estId}
          slep={drilldown.slepId}
          effectiveMonth={MES_ACTUAL}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  );
}
