import { School, Baby, Building2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp, PERFILES } from '../lib/context.jsx';

const ICONOS = {
  school: School,
  baby: Baby,
  building: Building2,
  shield: ShieldCheck,
};

const COLORES_BORDE = {
  navy: 'border-navy hover:border-navy-700 hover:shadow-elev',
  sky:  'border-sky hover:border-sky-500 hover:shadow-elev',
  lime: 'border-lime hover:border-lime-500 hover:shadow-elev',
};

const COLORES_ICONO_BG = {
  navy: 'bg-navy text-white',
  sky:  'bg-sky text-white',
  lime: 'bg-lime text-white',
};

export default function Login() {
  const { seleccionarPerfil } = useApp();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Banner superior celeste */}
      <header className="bg-sky text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm shrink-0">
              <img src="/logo-paf.png" alt="Aprender en Familia" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-sm tracking-wider font-semibold opacity-90">FUNDACIÓN CAP</span>
              <h1 className="text-3xl md:text-4xl font-bold text-white mt-1">Visualizador PAF 2026</h1>
              <p className="text-sky-50 mt-1 text-lg">Programa Aprender en Familia</p>
            </div>
          </div>
        </div>
      </header>

      {/* Selección de perfil */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl text-navy">Selecciona tu perfil</h2>
          <p className="text-muted mt-1">Cada perfil ve únicamente los datos correspondientes a su rol en el programa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PERFILES.map((p) => {
            const Icon = ICONOS[p.icono] ?? School;
            return (
              <button
                key={p.id}
                onClick={() => seleccionarPerfil(p)}
                className={`group bg-white rounded-xl border-2 ${COLORES_BORDE[p.color]} p-6 text-left transition-all hover:-translate-y-1`}
              >
                <div className={`w-12 h-12 rounded-lg ${COLORES_ICONO_BG[p.color]} flex items-center justify-center mb-4`}>
                  <Icon size={24} strokeWidth={2.25} />
                </div>
                <h3 className="text-lg text-navy">{p.nombre}</h3>
                <p className="text-sm text-muted mt-1">{p.descripcion}</p>
                <p className="text-xs text-ink/70 mt-3">{p.rol}</p>
                <div className="flex items-center gap-1 mt-4 text-navy font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                  Ingresar <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Aviso mock */}
        <div className="mt-10 p-4 rounded-lg bg-lime-50 border border-lime-200 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-lime mt-2 shrink-0"></div>
          <div>
            <p className="text-sm text-ink">
              <strong className="text-navy">Prototipo navegable</strong> — Esta versión utiliza datos sintéticos sobre la estructura final de indicadores y establecimientos reales del programa. Permite validar look & feel, navegación y modelo de visualización antes de conectar la base de datos productiva.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>Visualizador PAF 2026 · Mock v1 — Datos sintéticos para validación</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-60" />
        </div>
      </footer>
    </div>
  );
}
