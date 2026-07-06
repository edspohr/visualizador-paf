import { useState } from 'react';
import { LogOut, ChevronDown, School, Baby, Building2, ShieldCheck, Award, Repeat, Info, X } from 'lucide-react';
import { useApp, PERFILES, resolverEntidad } from '../lib/context.jsx';
import { ESCUELAS, JARDINES, SLEPS } from '../data/establecimientos.js';

const ICONOS = { school: School, baby: Baby, building: Building2, shield: ShieldCheck, award: Award };

// Per-profile accent for dropdown icons
const PERFIL_ICON_STYLE = {
  escuela:    { bg: 'rgb(230,245,252)',  color: 'var(--color-cyan)'     },
  jardin:     { bg: 'rgb(255,245,210)',  color: 'rgb(180,130,0)'        },
  sostenedor: { bg: 'rgb(252,230,241)',  color: 'var(--color-magenta)'  },
  consultor:  { bg: 'rgb(240,235,252)',  color: 'var(--color-purple-1)' },
  cap:        { bg: 'rgb(252,235,231)',  color: 'var(--color-red)'      },
};

export default function Layout({ children }) {
  const { perfil, cerrarSesion, seleccionarPerfil, cambiarEntidad, cambiarPrograma } = useApp();
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [menuEntidad, setMenuEntidad] = useState(false);
  const [demoBanner, setDemoBanner] = useState(true);

  const Icon = ICONOS[perfil.icono] ?? School;
  const entidad = resolverEntidad(perfil.contexto);

  let opcionesEntidad = [];
  if (perfil.id === 'escuela') opcionesEntidad = ESCUELAS;
  else if (perfil.id === 'jardin') opcionesEntidad = JARDINES;
  else if (perfil.id === 'sostenedor') opcionesEntidad = SLEPS;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header — CAP cyan */}
      <header className="text-white shadow-elev" style={{ background: 'var(--color-cyan)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-24 flex items-center justify-between gap-4">

          {/* Logo — 3-unit clearance buffer per Area Autónoma */}
          <div className="flex items-center gap-6 min-w-0">
            <div className="shrink-0 rounded-xl bg-white flex items-center justify-center p-2 shadow-sm">
              <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-14 w-auto object-contain" />
            </div>
            <h1 className="text-base md:text-lg font-medium text-white leading-snug truncate tracking-tight">
              Visualizador PAF 2026
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de programa — consultor only */}
            {perfil.id === 'consultor' && (
              <div className="hidden md:flex items-center gap-1 bg-white/15 rounded-xl p-1">
                <button
                  onClick={() => cambiarPrograma('escolar')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${perfil.contexto.programa === 'escolar' ? 'bg-white' : 'text-white hover:bg-white/15'}`}
                  style={perfil.contexto.programa === 'escolar' ? { color: 'var(--color-cyan)' } : {}}
                >Escolar</button>
                <button
                  onClick={() => cambiarPrograma('parvulario')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${perfil.contexto.programa === 'parvulario' ? 'bg-white' : 'text-white hover:bg-white/15'}`}
                  style={perfil.contexto.programa === 'parvulario' ? { color: 'var(--color-cyan)' } : {}}
                >Parvulario</button>
              </div>
            )}

            {/* Selector de entidad */}
            {opcionesEntidad.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMenuEntidad(!menuEntidad)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl text-sm font-light transition"
                >
                  <span className="max-w-[160px] md:max-w-[240px] truncate">{entidad?.nombre || 'Seleccionar'}</span>
                  <ChevronDown size={14} />
                </button>
                {menuEntidad && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuEntidad(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-elev border border-border w-72 max-h-96 overflow-y-auto z-20">
                      {opcionesEntidad.map(e => (
                        <button
                          key={e.id}
                          onClick={() => { cambiarEntidad(e.id); setMenuEntidad(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-bg text-sm border-b border-border last:border-0 transition ${entidad?.id === e.id ? 'bg-cyan-50 font-medium' : 'text-gray-dark'}`}
                          style={entidad?.id === e.id ? { color: 'var(--color-cyan)' } : {}}
                        >
                          <p className="truncate">{e.nombre}</p>
                          {e.slep && <p className="text-xs text-gray-ui font-light truncate">{SLEPS.find(s => s.id === e.slep)?.nombre.replace(/^SLEP\s+/, '')}</p>}
                          {e.comuna && !e.slep && <p className="text-xs text-gray-ui font-light truncate">{e.comuna}</p>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Perfil menu */}
            <div className="relative">
              <button
                onClick={() => setMenuPerfil(!menuPerfil)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl text-sm font-light transition"
              >
                <Icon size={16} />
                <span className="hidden md:inline">{perfil.nombre}</span>
                <ChevronDown size={14} />
              </button>
              {menuPerfil && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuPerfil(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-elev border border-border w-72 overflow-hidden z-20">
                    <div className="px-4 py-2.5 border-b border-border bg-bg">
                      <p className="text-xs text-gray-ui font-light">Cambiar a otro perfil (demo)</p>
                    </div>
                    {PERFILES.map(p => {
                      const PIcon = ICONOS[p.icono] ?? School;
                      const isActive = perfil.id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { seleccionarPerfil(p); setMenuPerfil(false); }}
                          className={`w-full text-left px-4 py-3 hover:bg-bg flex items-center gap-3 border-b border-border last:border-0 transition ${isActive ? 'bg-bg' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={PERFIL_ICON_STYLE[p.id] ?? PERFIL_ICON_STYLE.escuela}>
                            <PIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-dark truncate">{p.nombre}</p>
                            <p className="text-xs text-gray-ui font-light truncate">{p.descripcion}</p>
                          </div>
                          {isActive && <Repeat size={14} className="text-gray-ui ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                    <button
                      onClick={cerrarSesion}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 border-t border-border transition"
                      style={{ color: 'var(--color-red)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgb(252,235,231)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <LogOut size={16} />
                      <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {demoBanner && (
        <div className="border-b" style={{ background: 'rgb(255,249,225)', borderColor: 'rgb(240,220,140)' }}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-start gap-3 text-xs" style={{ color: 'rgb(120,90,10)' }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            <p className="flex-1 leading-relaxed">
              <span className="font-medium">Datos de demostración.</span> Los establecimientos, cohortes y comunas son reales.
              Los valores por indicador (matrícula, agentes educativos y desempeño) son estimaciones sintéticas
              y serán reemplazadas por datos en vivo desde Supabase.
            </p>
            <button
              onClick={() => setDemoBanner(false)}
              className="shrink-0 rounded-lg hover:bg-black/5 p-1 transition"
              aria-label="Cerrar aviso"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-10">
        {children}
      </main>

      <footer className="border-t border-border bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF · Mock v2 — Roster real · Valores por indicador de demostración</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}
