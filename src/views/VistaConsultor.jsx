import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useIndicadores, useAmbitos, useValoresAnio } from '../lib/queries.js';
import { calcularLogro, currentMonth, capClosedPeriod } from '../data/establecimientos.js';
import { cumplimientoIndicadores, indicadoresAplicables, isAplicable2026 } from '../data/scope.js';
import { matriculaVisible, formatearFechaCorte } from '../data/matricula.js';
import HeatmapEstablecimientosIndicadores from '../components/HeatmapEstablecimientosIndicadores.jsx';
import { FEATURES } from '../lib/features.js';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import SostenedorAveragePicker from '../components/SostenedorAveragePicker.jsx';
import { Filter, Building2, Users, GraduationCap, MapPin, ChevronDown, ChevronUp, GitCompareArrows, Grid3x3 } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';
import PipelineStatusBanner from '../components/PipelineStatusBanner.jsx';
import ComparadorIndicador from './comparador/ComparadorIndicador.jsx';

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Sublabel del TotalCard "Niñas y niños" — refleja si el número corresponde a
// un snapshot congelado (perfil CAP) o al dato vivo.
function buildMatriculaSub(perfilId, usaSnapshot, fechaCorte) {
  if (perfilId !== 'cap') return 'matrícula estimada';
  if (!usaSnapshot) return 'matrícula vigente';
  const fechaFmt = formatearFechaCorte(fechaCorte);
  return fechaFmt ? `matrícula al ${fechaFmt}` : 'matrícula del cierre';
}

// Año actualmente navegable + año inmediato anterior como comparación de referencia.
const ANIO_ACTUAL = 2026;
const ANIOS_DISPONIBLES = [2025, 2026];
const LS_KEY_ANIO = 'paf_anio_gestion';

function anioInicial() {
  if (typeof window === 'undefined') return ANIO_ACTUAL;
  const stored = Number(window.localStorage.getItem(LS_KEY_ANIO));
  return ANIOS_DISPONIBLES.includes(stored) ? stored : ANIO_ACTUAL;
}

function fechaFormateada(mes, anio) {
  const hoy = new Date();
  if (mes === currentMonth() && anio === ANIO_ACTUAL) {
    return `${hoy.getDate()} de ${NOMBRES_MES[hoy.getMonth()]} de ${anio}`;
  }
  const lastDay = new Date(anio, mes, 0).getDate();
  return `${lastDay} de ${NOMBRES_MES[mes - 1]} de ${anio}`;
}

// Formatea "30 de mayo de 2026" a partir de { mes, anio }.
function labelMesCerrado({ mes, anio }) {
  const lastDay = new Date(anio, mes, 0).getDate();
  return `${lastDay} de ${NOMBRES_MES[mes - 1]} de ${anio}`;
}

export default function VistaConsultor() {
  const { perfil } = useApp();
  const isCAP = perfil.id === 'cap';

  const [anioSeleccionado, setAnioSeleccionado] = useState(anioInicial);
  const anioEnCurso = anioSeleccionado === ANIO_ACTUAL;
  const cambiarAnio = (a) => {
    setAnioSeleccionado(a);
    if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY_ANIO, String(a));
  };

  // Mes efectivo: en el año en curso respeta el calendario (CAP mira mes cerrado);
  // en años previos el "mes efectivo" es diciembre (año ya cerrado).
  const capCierre = capClosedPeriod();
  const effectiveMonth = !anioEnCurso ? 12 : (isCAP ? capCierre.mes : currentMonth());

  const programa = perfil.contexto.programa || 'escolar';

  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();
  const indicadoresQ = useIndicadores(programa);
  const ambitosQ = useAmbitos(programa);

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

  // Valores 2025 para el comparador — solo se descargan cuando el usuario abre el panel.
  const valores2025Q = useValoresAnio(2025);
  const valoresPorEst2025 = useMemo(() => {
    const m = new Map();
    for (const v of (valores2025Q.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, v.valor);
    }
    return m;
  }, [valores2025Q.data]);

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || slepsQ.isLoading ||
                   indicadoresQ.isLoading || ambitosQ.isLoading;

  const AMBITOS = ambitosQ.data ?? [];
  const INDS    = indicadoresQ.data ?? [];
  const todos   = (programa === 'escolar' ? escuelasQ.data : jardinesQ.data) ?? [];
  const SLEPS_DATA = slepsQ.data ?? [];

  const [filtroSlep, setFiltroSlep] = useState('TODOS');
  const [filtroCohorte, setFiltroCohorte] = useState('TODAS');
  const [filtroComuna, setFiltroComuna] = useState('TODAS');
  const [drilldown, setDrilldown] = useState(null);
  const [comparadorOpen, setComparadorOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const heatmapVisible = FEATURES.heatmap && perfil.id === 'superadmin';

  const filtrados = useMemo(() => todos.filter(e =>
    (filtroSlep === 'TODOS' || e.slep === filtroSlep) &&
    (filtroCohorte === 'TODAS' || e.cohorte === filtroCohorte) &&
    (filtroComuna === 'TODAS' || e.comuna === filtroComuna)
  ), [todos, filtroSlep, filtroCohorte, filtroComuna]);

  const slepsDisponibles = [...new Set(todos.map(e => e.slep))].map(id => SLEPS_DATA.find(s => s.id === id)).filter(Boolean);
  const cohortesDisponibles = [...new Set(todos.map(e => e.cohorte))];
  const comunasDisponibles = [...new Set(todos.map(e => e.comuna))].sort();

  const conCumplimiento = useMemo(() => filtrados.map(e => {
    const aplicables = indicadoresAplicables(INDS, e, effectiveMonth);
    const cumpl = cumplimientoIndicadores(aplicables, valoresPorEst.get(e.id) ?? new Map());
    return { est: e, cumpl };
  }), [filtrados, INDS, valoresPorEst, effectiveMonth]);

  // Ranking de indicadores del conjunto filtrado, faltantes cuentan 0.
  const rankingItems = useMemo(() => (
    INDS
      .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
      .map(ind => {
        const aplican = filtrados.filter(e => isAplicable2026(ind, e, effectiveMonth));
        if (!aplican.length) return null;
        let sumaLogro = 0, sumaVal = 0, nVal = 0;
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
  ), [INDS, filtrados, valoresPorEst, effectiveMonth]);

  const totales = useMemo(() => {
    let ninos = 0;
    let usaSnapshot = false;
    let fechaCorte = null;
    for (const e of filtrados) {
      const m = matriculaVisible(e, perfil.id, effectiveMonth, anioSeleccionado);
      ninos += m.valor;
      if (m.esSnapshot) {
        usaSnapshot = true;
        if (!fechaCorte && m.fechaCorte) fechaCorte = m.fechaCorte;
      }
    }
    return {
      establecimientos: filtrados.length,
      ninos,
      matriculaSub: buildMatriculaSub(perfil.id, usaSnapshot, fechaCorte),
      agentes: filtrados.reduce((s, e) => s + (e.nAgentes ?? 0), 0),
      comunas: new Set(filtrados.map(e => e.comuna)).size,
    };
  }, [filtrados, perfil.id, effectiveMonth, anioSeleccionado]);

  const selectCls = "w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none";

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando datos del programa…
      </div>
    );
  }

  // Datos para el drilldown (calculados solo cuando hay algo abierto).
  let drilldownExtras = {};
  if (drilldown) {
    const centroActual = todos.find(e => e.id === drilldown.estId);
    const tipo = centroActual?.tipo;
    const pares = todos.filter(e => e.slep === drilldown.slepId && e.tipo === tipo);
    let sum = 0, n = 0;
    const valoresTerritorio = new Map();
    for (const p of pares) {
      const v = valoresPorEst.get(p.id)?.get(drilldown.ind.id)?.valor ?? null;
      if (v !== null && v !== undefined) { sum += v; n += 1; valoresTerritorio.set(p.id, v); }
    }
    // Promedios cross-sostenedor para la tabla del drilldown
    const promedioPorSostenedor = new Map();
    for (const s of SLEPS_DATA) {
      const centrosDelSlep = todos.filter(e => e.slep === s.id && e.tipo === tipo);
      let ss = 0, nn = 0;
      for (const e of centrosDelSlep) {
        const v = valoresPorEst.get(e.id)?.get(drilldown.ind.id)?.valor ?? null;
        if (v !== null && v !== undefined) { ss += v; nn += 1; }
      }
      if (nn) promedioPorSostenedor.set(s.id, ss / nn);
    }
    const entry = valoresPorEst.get(drilldown.estId)?.get(drilldown.ind.id);
    drilldownExtras = {
      valor: entry?.valor ?? null,
      estado: entry?.estado ?? 'validado',
      promedioTerritorio: n ? sum / n : null,
      valoresTerritorio,
      promedioPorSostenedor,
    };
  }

  return (
    <>
      {/* Banner */}
      {isCAP ? (
        <div className="text-white rounded-2xl px-6 py-7 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-magenta)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">FUNDACIÓN CAP · INFORME DE CIERRE</p>
            <h2 className="text-3xl md:text-4xl font-medium text-white leading-tight">Vista de cierre · Fundación CAP</h2>
            <p className="text-white/80 mt-2 text-sm">
              Datos <span className="text-lime-300 font-semibold">validados</span> al {labelMesCerrado(capCierre)} · Próxima actualización el 15 del mes siguiente
            </p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">CENTROS EDUCATIVOS</p>
            <p className="font-medium mt-1 text-lg leading-none">{filtrados.length}</p>
          </div>
        </div>
      ) : (
        <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-purple-1)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">VISTA COMPLETA · CONSULTORÍA</p>
            <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">Programa {programa === 'escolar' ? 'Aprender en Familia · Educación Básica' : 'Aprender en Familia · Educación Parvularia'}</h2>
            <p className="text-white/70 mt-1 text-sm">Datos actualizados al {fechaFormateada(effectiveMonth, anioSeleccionado)} · Vista agregada con acceso a todos los cruces.</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">CENTROS EDUCATIVOS</p>
            <p className="font-medium mt-1 text-lg leading-none">{filtrados.length}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2 font-medium text-sm pt-6">
            <Filter size={16}/> Filtros
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Año</label>
              <select value={anioSeleccionado} onChange={(e) => cambiarAnio(Number(e.target.value))} className={selectCls}>
                {ANIOS_DISPONIBLES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
              <select value={filtroSlep} onChange={(e) => setFiltroSlep(e.target.value)} className={selectCls}>
                <option value="TODOS">Todos</option>
                {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Cohorte</label>
              <select value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)} className={selectCls}>
                <option value="TODAS">Todas</option>
                {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Comuna</label>
              <select value={filtroComuna} onChange={(e) => setFiltroComuna(e.target.value)} className={selectCls}>
                <option value="TODAS">Todas</option>
                {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Totals strip — reacts to active filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <TotalCard label="Centros educativos" value={totales.establecimientos} sub={programa === 'escolar' ? 'escuelas del programa' : 'jardines infantiles'} Icon={Building2}/>
        <TotalCard label="Niñas y niños" value={totales.ninos.toLocaleString('es-CL')} sub={totales.matriculaSub} Icon={GraduationCap}/>
        <TotalCard label="Equipos educativos" value={totales.agentes} sub="en el programa" Icon={Users}/>
        <TotalCard label="Comunas" value={totales.comunas} sub="con cobertura activa" Icon={MapPin}/>
      </div>

      {/* Comparador por indicador — herramienta más usada, sube al top */}
      <div className="card mb-6">
        <button
          onClick={() => setComparadorOpen(o => !o)}
          className="w-full flex items-start justify-between text-left gap-3"
        >
          <div className="flex items-start gap-2 min-w-0">
            <GitCompareArrows size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-cyan)' }}/>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wider uppercase text-gray-ui">Comparador</p>
              <h3 className="text-lg text-gray-dark leading-tight">Comparación por indicador</h3>
              <p className="text-sm text-gray-ui mt-1">Contrasta dos grupos (años, sostenedores, cohortes, niveles) sobre el mismo indicador o el conjunto completo.</p>
            </div>
          </div>
          {comparadorOpen ? <ChevronUp size={18} className="text-gray-ui shrink-0 mt-1"/> : <ChevronDown size={18} className="text-gray-ui shrink-0 mt-1"/>}
        </button>
        {comparadorOpen && (
          <ComparadorIndicador
            INDS={INDS}
            AMBITOS={AMBITOS}
            todos={todos}
            slepsDisponibles={slepsDisponibles}
            cohortesDisponibles={cohortesDisponibles}
            comunasDisponibles={comunasDisponibles}
            defaultMes={effectiveMonth}
            sostenedores={SLEPS_DATA}
            valoresPorEst2026={valoresPorEst}
            valoresPorEst2025={valoresPorEst2025}
          />
        )}
      </div>

      {/* Top-3 / Bottom-3 por indicador (promedio del conjunto filtrado) */}
      <IndicatorRanking items={rankingItems} title="Indicadores del programa"/>

      {/* Promedio de cumplimiento por sostenedor (o por centro al elegir un sostenedor) */}
      <SostenedorAveragePicker
        INDS={INDS}
        establecimientos={filtrados}
        sostenedores={SLEPS_DATA}
        mes={effectiveMonth}
        getValor={getValor}
      />

      {/* Mapa de calor (superadmin + feature flag) */}
      {heatmapVisible && (
        <div className="card mb-6">
          <button
            onClick={() => setHeatmapOpen(o => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Grid3x3 size={16} style={{ color: 'var(--color-cyan)' }}/>
              <span className="text-sm font-medium text-gray-dark">Mapa de calor · Establecimientos × Indicadores</span>
              <span className="tag tag-navy text-[10px]">experimento</span>
            </div>
            {heatmapOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
          </button>
          {heatmapOpen && (
            <div className="mt-4">
              <HeatmapEstablecimientosIndicadores
                establecimientos={filtrados}
                INDS={INDS}
                valoresPorEst={valoresPorEst}
                mes={effectiveMonth}
                onCellClick={(ind, estId) => setDrilldown({ ind, estId, slepId: filtrados.find(e => e.id === estId)?.slep })}
              />
            </div>
          )}
        </div>
      )}

      {/* Lista de centros educativos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por centro educativo</p>
          <h3 className="text-lg text-gray-dark">Todos los centros educativos filtrados</h3>
          <p className="text-sm text-gray-ui mt-1">Haz clic en un centro educativo para ver sus indicadores.</p>
        </div>
        <EstablecimientoList
          conCumplimiento={conCumplimiento}
          AMBITOS={AMBITOS}
          INDS={INDS}
          effectiveMonth={effectiveMonth}
          onDrilldown={(ind, estId, slepId) => setDrilldown({ ind, estId, slepId })}
          valoresPorEst={valoresPorEst}
          sostenedores={SLEPS_DATA}
          programa={programa}
          anioEnCurso={anioEnCurso}
        />
      </div>

      <PipelineStatusBanner />

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown.ind}
          establecimientoId={drilldown.estId}
          slep={drilldown.slepId}
          mes={effectiveMonth}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
          todosEstablecimientos={todos}
          sostenedores={SLEPS_DATA}
          anio={anioSeleccionado}
          anioEnCurso={anioEnCurso}
          {...drilldownExtras}
        />
      )}
    </>
  );
}

// ─── TotalCard ───────────────────────────────────────────────────────────────

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

// ─── (Comparador por indicador extraído a ./comparador/ComparadorIndicador.jsx) ─

function EstRowItem({ c, idx, openEst, toggle, INDS, AMBITOS, effectiveMonth, onDrilldown, valoresPorEst, sostenedores, programa, anioEnCurso = true }) {
  return (
    <div key={c.est.id} className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => toggle(c.est.id)}
        className="w-full text-left px-4 py-3 hover:bg-bg transition"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded-full font-medium text-white flex items-center justify-center text-xs shrink-0" style={{ background: "var(--color-cyan)" }}>
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-dark truncate">{c.est.nombre}</p>
            <p className="text-xs text-gray-ui">{sostenedores.find(s => s.id === c.est.slep)?.nombre.replace(/^SLEP\s+/, '')} · Cohorte {c.est.cohorte} · {c.est.comuna}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-medium leading-none" style={{ color: 'var(--color-cyan)' }}>{Math.round(c.cumpl * 100)}%</p>
              <p className="text-[10px] text-gray-ui mt-0.5">cumplimiento</p>
            </div>
            {openEst[c.est.id] ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
          </div>
        </div>
      </button>
      {openEst[c.est.id] && (
        <div className="border-t border-border px-4 py-4 bg-bg">
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-3">Indicadores del programa</p>
          <IndicatorPanel
            INDS={INDS}
            AMBITOS={AMBITOS}
            establecimiento={c.est}
            mes={effectiveMonth}
            valoresReales={valoresPorEst.get(c.est.id) ?? new Map()}
            onDrilldown={(ind) => onDrilldown(ind, c.est.id, c.est.slep)}
            programa={programa}
            anioEnCurso={anioEnCurso}
          />
        </div>
      )}
    </div>
  );
}

function EstablecimientoList({ conCumplimiento, AMBITOS, INDS, effectiveMonth, onDrilldown, valoresPorEst, sostenedores, programa, anioEnCurso = true }) {
  const [openEst, setOpenEst] = useState({});
  const toggle = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const sorted = [...conCumplimiento].sort((a, b) => b.cumpl - a.cumpl);
  return (
    <div className="space-y-2">
      {sorted.map((c, idx) => (
        <EstRowItem key={c.est.id} c={c} idx={idx} openEst={openEst} toggle={toggle}
          INDS={INDS} AMBITOS={AMBITOS} effectiveMonth={effectiveMonth} onDrilldown={onDrilldown}
          valoresPorEst={valoresPorEst} sostenedores={sostenedores} programa={programa}
          anioEnCurso={anioEnCurso}/>
      ))}
    </div>
  );
}
