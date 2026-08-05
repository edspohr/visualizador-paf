import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, ChevronDown, School, Baby, Building2, ShieldCheck, Award, Repeat, Users, BarChart3, Map } from 'lucide-react';
import { useApp, PERFILES, resolverEntidad } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useEntidadDelPerfil } from '../lib/queries.js';

const ICONOS = {
  school: School,
  baby: Baby,
  building: Building2,
  shield: ShieldCheck,
  'shield-check': ShieldCheck,
  award: Award,
};

// Per-profile accent for dropdown icons
const PERFIL_ICON_STYLE = {
  escuela:    { bg: 'rgb(230,245,252)',  color: 'var(--color-cyan)'     },
  jardin:     { bg: 'rgb(255,245,210)',  color: 'rgb(180,130,0)'        },
  sostenedor: { bg: 'rgb(252,230,241)',  color: 'var(--color-magenta)'  },
  consultor:  { bg: 'rgb(240,235,252)',  color: 'var(--color-purple-1)' },
  cap:        { bg: 'rgb(252,235,231)',  color: 'var(--color-red)'      },
  superadmin: { bg: 'rgb(220,240,240)',  color: 'var(--color-teal)'     },
};

export default function Layout({ children }) {
  const { perfil, usuarioDoc, cerrarSesion, seleccionarPerfil, cambiarEntidad, cambiarPrograma } = useApp();
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [menuEntidad, setMenuEntidad] = useState(false);

  const Icon = ICONOS[perfil.icono] ?? School;
  // usuarioReal es superadmin? — usamos usuarioDoc (Firestore) porque perfil.id puede haber cambiado
  // temporalmente si el superadmin está "viendo como" otro perfil desde el dropdown.
  const esUsuarioRealSuperadmin = usuarioDoc?.perfilDefault === 'superadmin';

  // For consultor/cap/superadmin (or a real superadmin viewing-as a limited
  // profile) we load all establishments — broad Firestore rules already permit
  // this because rules key off usuarios.perfilDefault, which stays 'superadmin'
  // regardless of the assumed viewing-as perfil. For genuine limited profiles
  // we use narrow queries that pass the corresponding rule.
  const esAccesoCompletoBase = perfil.id === 'consultor' || perfil.id === 'cap' || perfil.id === 'superadmin';
  const esAccesoCompleto = esAccesoCompletoBase || esUsuarioRealSuperadmin;
  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();
  const escuelas = esAccesoCompleto ? (escuelasQ.data ?? []) : [];
  const jardines = esAccesoCompleto ? (jardinesQ.data ?? []) : [];
  const sleps = esAccesoCompleto ? (slepsQ.data ?? []) : [];

  // Real superadmin viewing-as a limited profile: pass the perfil through so
  // useEntidadDelPerfil resolves the current contexto.id against Firestore
  // (single-doc / SLEP-doc paths — permitted for superadmin by broad rules).
  // Genuine consultor/cap/superadmin (not viewing-as) skip the hook and use
  // the pre-loaded broad arrays via resolverEntidad, as before.
  const viendoComoLimitado = esUsuarioRealSuperadmin
    && (perfil.id === 'escuela' || perfil.id === 'jardin' || perfil.id === 'sostenedor');
  const entidadQ = useEntidadDelPerfil(
    esAccesoCompletoBase && !viendoComoLimitado ? null : perfil,
    escuelas, jardines, sleps
  );

  // Resolve current entity for the header label
  const entidad = esAccesoCompletoBase && !viendoComoLimitado
    ? resolverEntidad(perfil.contexto, [...escuelas, ...jardines], sleps)
    : entidadQ.establecimiento ?? entidadQ.slep;

  const esSuperadmin = perfil.id === 'superadmin';
  const permiteProgramaSwitch = perfil.id === 'consultor' || perfil.id === 'cap' || perfil.id === 'superadmin';

  let opcionesEntidad = [];
  if (viendoComoLimitado) {
    // Superadmin viewing-as: expose every candidate entity of the matching kind.
    if (perfil.id === 'escuela') opcionesEntidad = escuelas;
    else if (perfil.id === 'jardin') opcionesEntidad = jardines;
    else if (perfil.id === 'sostenedor') opcionesEntidad = sleps;
  } else if (esAccesoCompletoBase) {
    // Consultor/cap/superadmin: entity dropdown not shown in layout (they use VistaConsultor)
  } else if (perfil.id === 'escuela' || perfil.id === 'jardin') {
    opcionesEntidad = entidadQ.establecimiento ? [entidadQ.establecimiento] : [];
  } else if (perfil.id === 'sostenedor') {
    opcionesEntidad = entidadQ.slep ? [entidadQ.slep] : [];
  }

  // When a real superadmin steps into a limited-profile perfil, contexto.id
  // starts as a placeholder ('ESC-001'/'JAR-001'/'SLEP-LP') from PERFILES.
  // Auto-select the first real entity so VistaEscuela/VistaSostenedor render.
  const currentEntidadId = perfil.contexto?.id;
  const currentEsReal = opcionesEntidad.some(e => e.id === currentEntidadId);
  useEffect(() => {
    if (!viendoComoLimitado) return;
    if (!opcionesEntidad.length) return;
    if (!currentEsReal) cambiarEntidad(opcionesEntidad[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viendoComoLimitado, opcionesEntidad.length, currentEsReal]);

  // Base classes for pill controls on the white header
  const pillBase = 'flex items-center gap-2 border border-border hover:bg-bg px-3 py-2 rounded-xl text-sm font-light text-gray-dark transition';

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header — white / neutral */}
      <header className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-24 flex items-center justify-between gap-4">

          {/* Logo — directly on white header, no wrapping frame */}
          <div className="flex items-center gap-5 min-w-0">
            <img
              src="/paf-cap-logo.jpg"
              alt="Aprender en Familia · Fundación CAP"
              className="h-14 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-medium text-gray-dark leading-snug truncate tracking-tight">
                Visualizador PAF 2026
              </h1>
              <p className="text-[11px] text-gray-ui font-light truncate">Programa Aprender en Familia · Fundación CAP</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Superadmin nav links */}
            {esSuperadmin && (
              <nav className="hidden md:flex items-center gap-1 mr-2">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-sm font-medium transition ${isActive ? 'text-white' : 'text-gray-dark hover:bg-bg'}`
                  }
                  style={({ isActive }) => (isActive ? { background: 'var(--color-teal)' } : {})}
                >
                  Panel
                </NavLink>
                <NavLink
                  to="/usuarios"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive ? 'text-white' : 'text-gray-dark hover:bg-bg'}`
                  }
                  style={({ isActive }) => (isActive ? { background: 'var(--color-teal)' } : {})}
                >
                  <Users size={14} /> Usuarios
                </NavLink>
                <NavLink
                  to="/consultores"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive ? 'text-white' : 'text-gray-dark hover:bg-bg'}`
                  }
                  style={({ isActive }) => (isActive ? { background: 'var(--color-teal)' } : {})}
                >
                  <BarChart3 size={14} /> Consultores
                </NavLink>
                <NavLink
                  to="/geografia"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive ? 'text-white' : 'text-gray-dark hover:bg-bg'}`
                  }
                  style={({ isActive }) => (isActive ? { background: 'var(--color-teal)' } : {})}
                >
                  <Map size={14} /> Geografía
                </NavLink>
              </nav>
            )}

            {/* Selector de programa — consultor / superadmin */}
            {permiteProgramaSwitch && (
              <div className="hidden md:flex items-center gap-1 border border-border rounded-xl p-1 bg-white">
                <button
                  onClick={() => cambiarPrograma('escolar')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${perfil.contexto.programa === 'escolar' ? 'text-white' : 'text-gray-ui hover:bg-bg'}`}
                  style={perfil.contexto.programa === 'escolar' ? { background: 'var(--color-cyan)' } : {}}
                >Escolar</button>
                <button
                  onClick={() => cambiarPrograma('parvulario')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${perfil.contexto.programa === 'parvulario' ? 'text-white' : 'text-gray-ui hover:bg-bg'}`}
                  style={perfil.contexto.programa === 'parvulario' ? { background: 'var(--color-cyan)' } : {}}
                >Parvulario</button>
              </div>
            )}

            {/* Selector de entidad */}
            {opcionesEntidad.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMenuEntidad(!menuEntidad)}
                  className={pillBase}
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
                          {e.slep && <p className="text-xs text-gray-ui font-light truncate">{(sleps.find(s => s.id === e.slep) ?? entidadQ.slep)?.nombre.replace(/^SLEP\s+/, '')}</p>}
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
                className={pillBase}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={PERFIL_ICON_STYLE[perfil.id] ?? PERFIL_ICON_STYLE.escuela}
                >
                  <Icon size={13} />
                </div>
                <span className="hidden md:inline">{perfil.nombre}</span>
                <ChevronDown size={14} />
              </button>
              {menuPerfil && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuPerfil(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-elev border border-border w-72 overflow-hidden z-20">
                    {/* Info del usuario logueado */}
                    <div className="px-4 py-3 border-b border-border bg-bg">
                      <p className="text-sm font-medium text-gray-dark truncate">{usuarioDoc?.nombre || usuarioDoc?.email || 'Usuario'}</p>
                      {usuarioDoc?.email && usuarioDoc?.nombre && (
                        <p className="text-xs text-gray-ui font-light truncate">{usuarioDoc.email}</p>
                      )}
                    </div>

                    {/* Switcher de perfiles: solo para superadmins reales */}
                    {esUsuarioRealSuperadmin && (
                      <>
                        <div className="px-4 py-2 border-b border-border bg-bg">
                          <p className="text-[10px] text-gray-ui font-medium uppercase tracking-wider">Ver como</p>
                        </div>
                        {PERFILES.filter(p => p.id !== 'pendiente').map(p => {
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
                      </>
                    )}
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-10">
        {children}
      </main>

      <footer className="border-t border-border bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF · Fundación CAP</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}
