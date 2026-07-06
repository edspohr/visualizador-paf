import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useIndicadores, useAmbitos } from '../lib/queries.js';
import { logroPorAmbito, promedioSlepAmbito, generarValorIndicador, calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import IndicatorAveragePicker from '../components/IndicatorAveragePicker.jsx';
import { Building2, GraduationCap, Users, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';
import PipelineStatusBanner from '../components/PipelineStatusBanner.jsx';

export default function VistaSostenedor() {
  const { perfil } = useApp();
  const [drilldown, setDrilldown] = useState(null);
  const [openEst, setOpenEst] = useState({});
  const [tipoActivo, setTipoActivo] = useState('escolar');
  const toggleEst = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const handleTipoChange = (tipo) => { setTipoActivo(tipo); setOpenEst({}); };

  // Queries Firestore
  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();

  const escuelasAll = escuelasQ.data ?? [];
  const jardinesAll = jardinesQ.data ?? [];
  const slep = resolverEntidad(perfil.contexto, [...escuelasAll, ...jardinesAll], slepsQ.data ?? []);

  const escuelasSlep = slep ? escuelasAll.filter(e => e.slep === slep.id) : [];
  const jardinesSlep = slep ? jardinesAll.filter(j => j.slep === slep.id) : [];

  const tieneAmbos = escuelasSlep.length > 0 && jardinesSlep.length > 0;
  const defaultTipo = escuelasSlep.length > 0 ? 'escolar' : 'parvulario';
  const programaTipo = tieneAmbos ? tipoActivo : defaultTipo;

  const indicadoresQ = useIndicadores(programaTipo);
  const ambitosQ = useAmbitos(programaTipo);

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || slepsQ.isLoading ||
                   indicadoresQ.isLoading || ambitosQ.isLoading;

  const AMBITOS = ambitosQ.data ?? [];
  const INDS = indicadoresQ.data ?? [];
  const establecimientos = programaTipo === 'escolar' ? escuelasSlep : jardinesSlep;
  const todosDelTipo = programaTipo === 'escolar' ? escuelasAll : jardinesAll;

  const promediosSlep = Object.fromEntries(
    AMBITOS.map(a => [a.id, promedioSlepAmbito(INDS, todosDelTipo, slep.id, a.id)])
  );
  const logroGlobal = Object.values(promediosSlep).reduce((a, b) => a + b, 0) / AMBITOS.length;

  const todosSlep = [...escuelasSlep, ...jardinesSlep];
  const totalesRed = {
    ninos: todosSlep.reduce((s, e) => s + (e.nNinos ?? 0), 0),
    agentes: todosSlep.reduce((s, e) => s + (e.nAgentes ?? 0), 0),
    comunas: new Set(todosSlep.map(e => e.comuna)).size,
  };

  const ranking = establecimientos.map(e => {
    const logros = logroPorAmbito(INDS, e.id, slep.id);
    const promedio = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;
    return { est: e, logros, promedio };
  }).sort((a, b) => b.promedio - a.promedio);

  // Ranking items: average each indicator across all establishments in the SLEP
  const rankingItems = useMemo(() => INDS
    .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
    .map(ind => {
      const vals = establecimientos.map(e => {
        const { valor } = generarValorIndicador(ind, e.id, e.slep, MES_ACTUAL);
        return { valor, logro: calcularLogro(valor, ind) ?? 0 };
      });
      const valor = vals.reduce((s, v) => s + v.valor, 0) / (vals.length || 1);
      const ratio = vals.reduce((s, v) => s + v.logro, 0) / (vals.length || 1);
      return { indicador: ind, valor, ratio };
    }), [INDS, establecimientos]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando datos del sostenedor…
      </div>
    );
  }
  if (!slep) return <p>SLEP no encontrado.</p>;

  return (
    <>
      {/* Banner */}
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

      {/* Totales de la red */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <TotalCard label="Establecimientos" value={escuelasSlep.length + jardinesSlep.length} sub={`${escuelasSlep.length} escuelas · ${jardinesSlep.length} jardines`} Icon={Building2}/>
        <TotalCard label="Niños y niñas" value={totalesRed.ninos.toLocaleString('es-CL')} sub="matrícula estimada" Icon={GraduationCap}/>
        <TotalCard label="Agentes educativos" value={totalesRed.agentes} sub="en el programa" Icon={Users}/>
        <TotalCard label="Comunas" value={totalesRed.comunas} sub="con cobertura activa" Icon={MapPin}/>
      </div>

      {/* Toggle Escuela / Jardín (solo cuando el SLEP tiene ambos tipos) */}
      {tieneAmbos && (
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => handleTipoChange('escolar')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${programaTipo === 'escolar' ? 'text-white' : 'bg-white border border-border text-gray-ui hover:bg-bg'}`}
            style={programaTipo === 'escolar' ? { background: 'var(--color-cyan)', color: '#fff' } : {}}
          >
            Escuelas ({escuelasSlep.length})
          </button>
          <button
            onClick={() => handleTipoChange('parvulario')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${programaTipo === 'parvulario' ? 'text-white' : 'bg-white border border-border text-gray-ui hover:bg-bg'}`}
            style={programaTipo === 'parvulario' ? { background: 'var(--color-cyan)', color: '#fff' } : {}}
          >
            Jardines infantiles ({jardinesSlep.length})
          </button>
        </div>
      )}

      {/* Top-3 / Bottom-3 por indicador (promedio de la red) */}
      <IndicatorRanking items={rankingItems} title="Indicadores de la red"/>

      {/* Selector de indicador + gráfico de promedios por establecimiento */}
      <IndicatorAveragePicker
        INDS={INDS}
        establecimientos={establecimientos}
        mes={MES_ACTUAL}
        breakdownBy="establecimiento"
        sostenedores={slepsQ.data ?? []}
      />

      {/* Lista de establecimientos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por establecimiento</p>
          <h3 className="text-lg text-gray-dark">Detalle por escuela y/o jardín infantil</h3>
          <p className="text-sm text-gray-ui mt-1">Ordenados por logro promedio. Haz clic para ver los indicadores de cada establecimiento.</p>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-medium text-gray-dark leading-none">{Math.round(promedio * 100)}%</p>
                      <p className="text-xs text-gray-ui mt-1">logro global</p>
                    </div>
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
                    todosEstablecimientos={todosDelTipo}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <PipelineStatusBanner />

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown.ind}
          establecimientoId={drilldown.estId}
          slep={drilldown.slepId}
          effectiveMonth={MES_ACTUAL}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
          todosEstablecimientos={todosDelTipo}
          sostenedores={slepsQ.data ?? []}
        />
      )}
    </>
  );
}

function TotalCard({ label, value, sub, Icon }) {
  return (
    <div className="card py-4 px-4 flex items-start gap-3 mb-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-cyan-50">
        <Icon size={16} style={{ color: 'var(--color-cyan)' }}/>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-ui leading-none mb-1">{label}</p>
        <p className="text-2xl font-medium text-gray-dark leading-none">{value}</p>
        {sub && <p className="text-[10px] text-gray-ui mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}
