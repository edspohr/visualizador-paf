import { useState, useMemo } from 'react';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, promedioSlepAmbito, generarValorIndicador, calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { KpiCard } from '../components/Shared.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import IndicatorAveragePicker from '../components/IndicatorAveragePicker.jsx';
import { Building2, TrendingUp, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';

export default function VistaSostenedor() {
  const { perfil } = useApp();
  const slep = resolverEntidad(perfil.contexto);
  const [drilldown, setDrilldown] = useState(null);
  const [openEst, setOpenEst] = useState({});
  const [tipoActivo, setTipoActivo] = useState('escolar');
  const toggleEst = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const handleTipoChange = (tipo) => { setTipoActivo(tipo); setOpenEst({}); };
  if (!slep) return <p>SLEP no encontrado.</p>;

  const escuelasSlep = ESCUELAS.filter(e => e.slep === slep.id);
  const jardinesSlep = JARDINES.filter(j => j.slep === slep.id);

  const tieneAmbos = escuelasSlep.length > 0 && jardinesSlep.length > 0;
  const defaultTipo = escuelasSlep.length > 0 ? 'escolar' : 'parvulario';
  const programaTipo = tieneAmbos ? tipoActivo : defaultTipo;

  const AMBITOS = programaTipo === 'escolar' ? AMBITOS_ESCOLAR : AMBITOS_PARVULARIO;
  const INDS    = programaTipo === 'escolar' ? INDICADORES_ESCOLAR : INDICADORES_PARVULARIO;
  const establecimientos = programaTipo === 'escolar' ? escuelasSlep : jardinesSlep;
  const todosDelTipo = programaTipo === 'escolar' ? ESCUELAS : JARDINES;

  const promediosSlep = Object.fromEntries(
    AMBITOS.map(a => [a.id, promedioSlepAmbito(INDS, todosDelTipo, slep.id, a.id)])
  );
  const logroGlobal = Object.values(promediosSlep).reduce((a, b) => a + b, 0) / AMBITOS.length;

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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <KpiCard
          label="Establecimientos"
          value={escuelasSlep.length + jardinesSlep.length}
          sublabel={`${ranking.filter(r => r.promedio >= 0.85).length} en meta · ${ranking.filter(r => r.promedio >= 0.6 && r.promedio < 0.85).length} en desarrollo · ${ranking.filter(r => r.promedio < 0.6).length} requieren atención`}
          icon={Building2}
        />
        <KpiCard
          label="En meta"
          value={`${ranking.filter(r => r.promedio >= 0.85).length} de ${ranking.length}`}
          sublabel={`${Math.round((ranking.filter(r => r.promedio >= 0.85).length / (ranking.length || 1)) * 100)}% de la red`}
          icon={TrendingUp}
          color="sky"
        />
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
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Glosario />

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
