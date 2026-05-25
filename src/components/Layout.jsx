import { useState } from 'react';
import { LogOut, ChevronDown, School, Baby, Building2, ShieldCheck, Repeat } from 'lucide-react';
import { useApp, PERFILES, resolverEntidad } from '../lib/context.jsx';
import { ESCUELAS, JARDINES, SLEPS } from '../data/establecimientos.js';

const ICONOS = { school: School, baby: Baby, building: Building2, shield: ShieldCheck };

export default function Layout({ children }) {
  const { perfil, cerrarSesion, seleccionarPerfil, cambiarEntidad, cambiarPrograma } = useApp();
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [menuEntidad, setMenuEntidad] = useState(false);

  const Icon = ICONOS[perfil.icono] ?? School;
  const entidad = resolverEntidad(perfil.contexto);

  // Opciones de entidad según perfil
  let opcionesEntidad = [];
  if (perfil.id === 'escuela') opcionesEntidad = ESCUELAS;
  else if (perfil.id === 'jardin') opcionesEntidad = JARDINES;
  else if (perfil.id === 'sostenedor') opcionesEntidad = SLEPS;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header navy */}
      <header className="bg-navy text-white shadow-elev">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-24 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-20 h-20 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm">
              <img src="/logo-paf.png" alt="Programa Aprender en Familia · Fundación CAP" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-sky-100 tracking-wider font-semibold leading-none">FUNDACIÓN CAP</p>
              <h1 className="text-base md:text-lg font-bold text-white leading-snug truncate">Visualizador PAF 2026</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de programa (solo para consultor/CAP) */}
            {perfil.id === 'consultor' && (
              <div className="hidden md:flex items-center gap-1 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => cambiarPrograma('escolar')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${perfil.contexto.programa === 'escolar' ? 'bg-white text-navy' : 'text-white hover:bg-white/10'}`}
                >Escolar</button>
                <button
                  onClick={() => cambiarPrograma('parvulario')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${perfil.contexto.programa === 'parvulario' ? 'bg-white text-navy' : 'text-white hover:bg-white/10'}`}
                >Parvulario</button>
              </div>
            )}

            {/* Selector de entidad */}
            {opcionesEntidad.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMenuEntidad(!menuEntidad)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-2 rounded-lg text-sm transition"
                >
                  <span className="max-w-[160px] md:max-w-[240px] truncate">{entidad?.nombre || 'Seleccionar'}</span>
                  <ChevronDown size={14} />
                </button>
                {menuEntidad && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuEntidad(false)}></div>
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-elev border border-border w-72 max-h-96 overflow-y-auto z-20">
                      {opcionesEntidad.map(e => (
                        <button
                          key={e.id}
                          onClick={() => { cambiarEntidad(e.id); setMenuEntidad(false); }}
                          className={`w-full text-left px-3 py-2 hover:bg-bg text-sm border-b border-border last:border-0 ${entidad?.id === e.id ? 'bg-sky-50 text-navy font-semibold' : 'text-ink'}`}
                        >
                          <p className="truncate">{e.nombre}</p>
                          {e.slep && (
                            <p className="text-xs text-muted truncate">{SLEPS.find(s => s.id === e.slep)?.nombre}</p>
                          )}
                          {e.comuna && !e.slep && (
                            <p className="text-xs text-muted truncate">{e.comuna}</p>
                          )}
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
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-2 rounded-lg text-sm transition"
              >
                <Icon size={16} />
                <span className="hidden md:inline">{perfil.nombre}</span>
                <ChevronDown size={14} />
              </button>
              {menuPerfil && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuPerfil(false)}></div>
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-elev border border-border w-72 overflow-hidden z-20">
                    <div className="px-3 py-2 border-b border-border bg-bg">
                      <p className="text-xs text-muted">Cambiar a otro perfil (demo)</p>
                    </div>
                    {PERFILES.map(p => {
                      const PIcon = ICONOS[p.icono] ?? School;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { seleccionarPerfil(p); setMenuPerfil(false); }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-bg flex items-center gap-3 border-b border-border last:border-0 ${perfil.id === p.id ? 'bg-sky-50' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-md bg-navy-50 text-navy flex items-center justify-center shrink-0">
                            <PIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy truncate">{p.nombre}</p>
                            <p className="text-xs text-muted truncate">{p.descripcion}</p>
                          </div>
                          {perfil.id === p.id && <Repeat size={14} className="text-muted ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                    <button
                      onClick={cerrarSesion}
                      className="w-full text-left px-3 py-2.5 hover:bg-red-50 flex items-center gap-3 text-red-700 border-t border-border"
                    >
                      <LogOut size={16} />
                      <span className="text-sm font-semibold">Cerrar sesión</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-white py-3 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>Visualizador PAF · Mock v1 — Datos sintéticos para validación</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-60" />
        </div>
      </footer>
    </div>
  );
}
