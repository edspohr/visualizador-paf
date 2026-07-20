import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useIndicadores, useAmbitos, useValoresAnio } from '../lib/queries.js';
import { calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { matriculaVisible, formatearFechaCorte } from '../data/matricula.js';
import { cumplimientoIndicadores, indicadoresAplicables, isAplicable2026 } from '../data/scope.js';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import SostenedorVsPromedio from '../components/SostenedorVsPromedio.jsx';
import { Building2, GraduationCap, Users, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';
import PipelineStatusBanner from '../components/PipelineStatusBanner.jsx';

const ANIO_ACTUAL = 2026;
const ANIOS_DISPONIBLES = [2025, 2026];
const LS_KEY_ANIO = 'paf_anio_gestion';

function anioInicial() {
  if (typeof window === 'undefined') return ANIO_ACTUAL;
  const stored = Number(window.localStorage.getItem(LS_KEY_ANIO));
  return ANIOS_DISPONIBLES.includes(stored) ? stored : ANIO_ACTUAL;
}

export default function VistaSostenedor() {
  const { perfil } = useApp();
  const [drilldown, setDrilldown] = useState(null);
  const [openEst, setOpenEst] = useState({});
  const [tipoActivo, setTipoActivo] = useState('escolar');
  const [anioSeleccionado, setAnioSeleccionado] = useState(anioInicial);
  const anioEnCurso = anioSeleccionado === ANIO_ACTUAL;
  const mesEfectivo = anioEnCurso ? MES_ACTUAL : 12;
  const cambiarAnio = (a) => {
    setAnioSeleccionado(a);
    if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY_ANIO, String(a));
  };
  const toggleEst = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const handleTipoChange = (tipo) => { setTipoActivo(tipo); setOpenEst({}); };

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

  const valoresAnioQ = useValoresAnio(anioSeleccionado);
  // Map<estId, Map<indicadorId, { valor, estado }>>
  const valoresPorEst = useMemo(() => {
    const m = new Map();
    for (const v of (valoresAnioQ.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, { valor: v.valor, estado: v.estado ?? 'validado' });
    }
    return m;
  }, [valoresAnioQ.data]);
  const getValor = (indicadorId, estId) => valoresPorEst.get(estId)?.get(indicadorId)?.valor ?? null;

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || slepsQ.isLoading ||
                   indicadoresQ.isLoading || ambitosQ.isLoading;

  const AMBITOS = ambitosQ.data ?? [];
  const INDS = indicadoresQ.data ?? [];
  const establecimientos = programaTipo === 'escolar' ? escuelasSlep : jardinesSlep;
  const todosDelTipo = programaTipo === 'escolar' ? escuelasAll : jardinesAll;

  // Promedios/cumplimiento por centro sobre indicadores aplicables 2026.
  const conCumplimiento = useMemo(() => (
    establecimientos.map(e => {
      const aplicables = indicadoresAplicables(INDS, e, mesEfectivo);
      const cumpl = cumplimientoIndicadores(aplicables, valoresPorEst.get(e.id) ?? new Map());
      return { est: e, cumpl };
    })
  ), [establecimientos, INDS, valoresPorEst, mesEfectivo]);

  const logroGlobal = conCumplimiento.length
    ? conCumplimiento.reduce((s, c) => s + c.cumpl, 0) / conCumplimiento.length
    : 0;

  const todosSlep = [...escuelasSlep, ...jardinesSlep];
  const totalesRed = useMemo(() => {
    let ninos = 0;
    let usaSnapshot = false;
    let fechaCorte = null;
    for (const e of todosSlep) {
      const m = matriculaVisible(e, perfil.id, mesEfectivo, anioSeleccionado);
      ninos += m.valor;
      if (m.esSnapshot) {
        usaSnapshot = true;
        if (!fechaCorte && m.fechaCorte) fechaCorte = m.fechaCorte;
      }
    }
    return {
      ninos,
      matriculaSub: perfil.id === 'cap'
        ? (usaSnapshot
            ? (formatearFechaCorte(fechaCorte) ? `matrícula al ${formatearFechaCorte(fechaCorte)}` : 'matrícula del cierre')
            : 'matrícula vigente')
        : 'matrícula estimada',
      agentes: todosSlep.reduce((s, e) => s + (e.nAgentes ?? 0), 0),
      comunas: new Set(todosSlep.map(e => e.comuna)).size,
    };
  }, [todosSlep, perfil.id, mesEfectivo, anioSeleccionado]);

  const ranking = useMemo(
    () => [...conCumplimiento].sort((a, b) => b.cumpl - a.cumpl),
    [conCumplimiento]
  );

  // Ranking de indicadores: promedio de cada indicador aplicable a través de los
  // centros a los que aplica, con faltantes contando 0.
  const rankingItems = useMemo(() => (
    INDS
      .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
      .map(ind => {
        const aplican = establecimientos.filter(e => isAplicable2026(ind, e, mesEfectivo));
        if (!aplican.length) return null;
        let sumaVal = 0, nVal = 0, sumaLogro = 0;
        for (const e of aplican) {
          const v = valoresPorEst.get(e.id)?.get(ind.id)?.valor ?? null;
          const l = calcularLogro(v, ind);
          sumaLogro += l === null ? 0 : Math.min(1, l);
          if (v !== null && v !== undefined) { sumaVal += v; nVal += 1; }
        }
        // Excluir indicadores sin ningún dato reportado (no rankeamos "0%").
        if (nVal === 0) return null;
        return {
          indicador: ind,
          valor: sumaVal / nVal,
          ratio: sumaLogro / aplican.length,
        };
      })
      .filter(Boolean)
  ), [INDS, establecimientos, valoresPorEst]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando datos del sostenedor…
      </div>
    );
  }
  if (!slep) return <p>Sostenedor no encontrado.</p>;

  // Datos extra para el drilldown (promedio real del territorio).
  let drilldownExtras = {};
  if (drilldown) {
    const centroActual = todosDelTipo.find(e => e.id === drilldown.estId);
    const tipo = centroActual?.tipo;
    const pares = todosDelTipo.filter(e => e.slep === drilldown.slepId && e.tipo === tipo);
    let sum = 0, n = 0;
    const valoresTerritorio = new Map();
    for (const p of pares) {
      const v = valoresPorEst.get(p.id)?.get(drilldown.ind.id)?.valor ?? null;
      if (v !== null && v !== undefined) {
        sum += v; n += 1;
        valoresTerritorio.set(p.id, v);
      }
    }
    const entry = valoresPorEst.get(drilldown.estId)?.get(drilldown.ind.id);
    drilldownExtras = {
      valor: entry?.valor ?? null,
      estado: entry?.estado ?? 'validado',
      promedioTerritorio: n ? sum / n : null,
      valoresTerritorio,
    };
  }

  return (
    <>
      {/* Banner */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-magenta)" }}>
        <div>
          <p className="text-xs text-white/60 tracking-wider font-medium mb-1">SOSTENEDOR</p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">{slep.nombre.replace(/^SLEP\s+/, '')}</h2>
          <div className="flex items-center gap-2 text-white/70 mt-1 text-sm">
            <MapPin size={14} /> {slep.comuna}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/10 px-3 py-2 rounded-xl">
            <p className="text-xs text-white/60 leading-none">CENTROS EDUCATIVOS</p>
            <p className="font-medium mt-1">{escuelasSlep.length + jardinesSlep.length}</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl">
            <p className="text-xs text-white/60 leading-none">% CUMPLIMIENTO</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Totales de la red */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <TotalCard label="Centros educativos" value={escuelasSlep.length + jardinesSlep.length} sub={`${escuelasSlep.length} escuelas · ${jardinesSlep.length} jardines`} Icon={Building2}/>
        <TotalCard label="Niñas y niños" value={totalesRed.ninos.toLocaleString('es-CL')} sub={totalesRed.matriculaSub} Icon={GraduationCap}/>
        <TotalCard label="Equipos educativos" value={totalesRed.agentes} sub="en el programa" Icon={Users}/>
        <TotalCard label="Comunas" value={totalesRed.comunas} sub="con cobertura activa" Icon={MapPin}/>
      </div>

      {/* Selector de año */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-gray-ui font-medium uppercase tracking-wider">Año</label>
        <select
          value={anioSeleccionado}
          onChange={(e) => cambiarAnio(Number(e.target.value))}
          className="px-3 py-1.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 outline-none"
          style={{ '--tw-ring-color': 'var(--color-cyan)' }}
        >
          {ANIOS_DISPONIBLES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
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

      {/* Comparativa: este sostenedor vs los demás (mismo tipo) */}
      <SostenedorVsPromedio
        INDS={INDS}
        establecimientos={todosDelTipo}
        sostenedores={slepsQ.data ?? []}
        sostenedorActual={slep.id}
        mes={mesEfectivo}
        getValor={getValor}
      />

      {/* Lista de establecimientos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por centro educativo</p>
          <h3 className="text-lg text-gray-dark">Detalle por escuela y/o jardín infantil</h3>
          <p className="text-sm text-gray-ui mt-1">Ordenados por cumplimiento. Haz clic para ver los indicadores de cada centro educativo.</p>
        </div>

        <div className="space-y-2">
          {ranking.map(({ est, cumpl }, idx) => (
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
                      <p className="text-2xl font-medium leading-none" style={{ color: 'var(--color-cyan)' }}>{Math.round(cumpl * 100)}%</p>
                      <p className="text-xs text-gray-ui mt-1">% cumplimiento</p>
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
                    establecimiento={est}
                    mes={mesEfectivo}
                    valoresReales={valoresPorEst.get(est.id) ?? new Map()}
                    onDrilldown={(ind) => setDrilldown({ ind, estId: est.id, slepId: est.slep })}
                    programa={programaTipo}
                    anioEnCurso={anioEnCurso}
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
          mes={mesEfectivo}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
          todosEstablecimientos={todosDelTipo}
          sostenedores={slepsQ.data ?? []}
          anio={anioSeleccionado}
          anioEnCurso={anioEnCurso}
          {...drilldownExtras}
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
        <p className="text-2xl font-medium leading-none" style={{ color: 'var(--color-cyan)' }}>{value}</p>
        {sub && <p className="text-[10px] text-gray-ui mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}
