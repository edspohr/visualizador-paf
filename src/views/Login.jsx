import { School, Baby, Building2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp, PERFILES } from '../lib/context.jsx';

const ICONOS = { school: School, baby: Baby, building: Building2, shield: ShieldCheck };

// Per-profile accent colors mapped to CAP palette
const PERFIL_ACCENT = {
  navy: { border: 'var(--color-cyan)',    bg: 'var(--color-cyan)',    text: '#fff' },
  sky:  { border: 'var(--color-magenta)', bg: 'var(--color-magenta)', text: '#fff' },
  lime: { border: 'var(--color-yellow)',  bg: 'var(--color-yellow)',  text: 'var(--color-gray-dark)' },
};
const PERFIL_DEFAULT = { border: 'var(--color-purple-1)', bg: 'var(--color-purple-1)', text: '#fff' };

export default function Login() {
  const { seleccionarPerfil } = useApp();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Banner — CAP cyan, 3-unit padding buffer */}
      <header className="text-white" style={{ background: 'var(--color-cyan)' }}>
        <div className="max-w-6xl mx-auto px-8 py-10">
          <div className="flex items-center gap-8">
            <div className="rounded-2xl bg-white flex items-center justify-center p-2 shadow-sm shrink-0">
              <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-24 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-medium text-white tracking-tight leading-tight">
                Visualizador PAF 2026
              </h1>
              <p className="text-white/80 mt-1 text-lg font-light">Programa Aprender en Familia</p>
            </div>
          </div>
        </div>
      </header>

      {/* Selección de perfil */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-12">
        <div className="mb-10">
          <h2 className="text-2xl font-medium" style={{ color: 'var(--color-gray-dark)' }}>Selecciona tu perfil</h2>
          <p className="text-gray-ui font-light mt-1">Cada perfil ve únicamente los datos correspondientes a su rol en el programa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PERFILES.map((p) => {
            const Icon = ICONOS[p.icono] ?? School;
            const accent = PERFIL_ACCENT[p.color] ?? PERFIL_DEFAULT;
            return (
              <button
                key={p.id}
                onClick={() => seleccionarPerfil(p)}
                className="group bg-white rounded-2xl border-2 p-6 text-left transition-all hover:-translate-y-1 shadow-card hover:shadow-elev"
                style={{ borderColor: accent.border }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: accent.bg, color: accent.text }}
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-medium" style={{ color: 'var(--color-gray-dark)' }}>{p.nombre}</h3>
                <p className="text-sm text-gray-ui font-light mt-1">{p.descripcion}</p>
                <p className="text-xs text-gray-ui font-light mt-3">{p.rol}</p>
                <div
                  className="flex items-center gap-1 mt-5 text-sm font-medium opacity-0 group-hover:opacity-100 transition"
                  style={{ color: accent.border }}
                >
                  Ingresar <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Aviso mock */}
        <div className="mt-12 p-4 rounded-2xl border flex items-start gap-3" style={{ background: 'rgb(230,245,252)', borderColor: 'rgb(179,223,243)' }}>
          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--color-cyan)' }}></div>
          <p className="text-sm font-light" style={{ color: 'var(--color-gray-dark)' }}>
            <span className="font-medium" style={{ color: 'var(--color-cyan)' }}>Prototipo navegable</span>
            {' '}— Esta versión utiliza datos sintéticos sobre la estructura final de indicadores y establecimientos reales del programa. Permite validar look & feel, navegación y modelo de visualización antes de conectar la base de datos productiva.
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-4">
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF 2026 · Mock v1 — Datos sintéticos para validación</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}
