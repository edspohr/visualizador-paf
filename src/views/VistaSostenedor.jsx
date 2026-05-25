import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, promedioSlepAmbito } from '../data/establecimientos.js';
import { AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, PageHeader } from '../components/Shared.jsx';
import { Building2, School, Users, Award, TrendingUp, MapPin } from 'lucide-react';

export default function VistaSostenedor() {
  const { perfil } = useApp();
  const slep = resolverEntidad(perfil.contexto);
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

  // Ranking de establecimientos
  const ranking = establecimientos.map(e => {
    const logros = logroPorAmbito(INDS, e.id, slep.id);
    const promedio = Object.values(logros).reduce((a,b)=>a+b,0) / AMBITOS.length;
    return { est: e, logros, promedio };
  }).sort((a, b) => b.promedio - a.promedio);

  return (
    <>
      {/* Banner navy con identidad sostenedor */}
      <div className="bg-navy text-white rounded-xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-sky-200 tracking-wider font-semibold mb-1">SOSTENEDOR · SLEP</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{slep.nombre}</h2>
          <div className="flex items-center gap-2 text-sky-100 mt-1 text-sm">
            <MapPin size={14} /> {slep.comuna}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/10 px-3 py-2 rounded-lg">
            <p className="text-xs text-sky-200 leading-none">ESTABLECIMIENTOS</p>
            <p className="font-semibold mt-1">{escuelasSlep.length + jardinesSlep.length}</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-lg">
            <p className="text-xs text-sky-200 leading-none">LOGRO PROMEDIO</p>
            <p className="font-semibold mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Establecimientos" value={escuelasSlep.length + jardinesSlep.length} sublabel={`${escuelasSlep.length} escuelas · ${jardinesSlep.length} jardines`} icon={Building2}/>
        <KpiCard label="Logro promedio" value={`${Math.round(logroGlobal * 100)}%`} sublabel="agregado de todos los ámbitos" icon={Award} color="lime"/>
        <KpiCard label="En meta" value={ranking.filter(r => r.promedio >= 0.85).length} sublabel={`de ${ranking.length} establecimientos`} icon={TrendingUp} color="sky"/>
        <KpiCard label="Indicadores" value={INDS.length} sublabel={`Programa ${programaActivo}`} icon={Users}/>
      </div>

      {/* Semáforos por ámbito */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro por ámbito (red completa)"
        subtitle={`Promedio agregado de los ${establecimientos.length} establecimientos del sostenedor, comparado con el promedio de otros SLEP.`}
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
          <p className="text-xs text-sky-600 font-semibold tracking-wider uppercase">Comparativa intersostenedores</p>
          <h3 className="text-lg text-navy">Tu SLEP vs promedio del resto</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={AMBITOS.map(a => ({
              ambito: a.codigo,
              [slep.nombre]: Math.round(promediosSlep[a.id] * 100),
              'Otros SLEP': Math.round(promediosOtros[a.id] * 100),
            }))}>
              <PolarGrid stroke="#E5E7EB"/>
              <PolarAngleAxis dataKey="ambito" tick={{ fill: '#333333', fontSize: 12, fontWeight: 600 }}/>
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} />
              <Radar name={slep.nombre} dataKey={slep.nombre} stroke="#1A365D" fill="#1A365D" fillOpacity={0.4}/>
              <Radar name="Otros SLEP" dataKey="Otros SLEP" stroke="#8CC63F" fill="#8CC63F" fillOpacity={0.25}/>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v) => `${v}%`}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking de establecimientos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs text-sky-600 font-semibold tracking-wider uppercase">Detalle de la red</p>
          <h3 className="text-lg text-navy">Establecimientos del sostenedor</h3>
          <p className="text-sm text-muted mt-1">Ordenados por logro promedio. Cada barra muestra el % de logro por ámbito.</p>
        </div>

        <div className="space-y-3">
          {ranking.map(({ est, logros, promedio }, idx) => (
            <div key={est.id} className="p-4 rounded-lg border border-border hover:shadow-card transition">
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-navy text-white font-bold flex items-center justify-center text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm text-navy truncate">{est.nombre}</h4>
                    <p className="text-xs text-muted">{est.tipo} · Cohorte {est.cohorte}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-navy leading-none">{Math.round(promedio * 100)}%</p>
                    <p className="text-xs text-muted mt-1">logro global</p>
                  </div>
                  <SemaforoBadge logro={promedio}/>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {AMBITOS.map(a => (
                  <div key={a.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted">{a.codigo}</span>
                      <span className="text-xs font-bold text-navy">{Math.round(logros[a.id] * 100)}%</span>
                    </div>
                    <ProgressBar logro={logros[a.id]}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
