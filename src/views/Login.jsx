import { useState } from 'react';
import { School, Baby, Building2, ShieldCheck, Award, ArrowRight, Mail, Lock, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useApp, PERFILES } from '../lib/context.jsx';
import { iniciarSesionEmail, registrarEmail, iniciarConGoogle, enviarResetPassword } from '../lib/firebase.js';

const ICONOS = {
  school: School,
  baby: Baby,
  building: Building2,
  shield: ShieldCheck,
  'shield-check': ShieldCheck,
  award: Award,
};

// One distinct accent per profile id
const PERFIL_ACCENT = {
  escuela:    { border: 'var(--color-cyan)',      bg: 'var(--color-cyan)',      text: '#fff' },
  jardin:     { border: 'var(--color-yellow)',    bg: 'var(--color-yellow)',    text: 'var(--color-gray-dark)' },
  sostenedor: { border: 'var(--color-magenta)',   bg: 'var(--color-magenta)',   text: '#fff' },
  consultor:  { border: 'var(--color-purple-1)',  bg: 'var(--color-purple-1)',  text: '#fff' },
  cap:        { border: 'var(--color-red)',       bg: 'var(--color-red)',       text: '#fff' },
  superadmin: { border: 'var(--color-teal)',      bg: 'var(--color-teal)',      text: '#fff' },
};
const PERFIL_DEFAULT = { border: 'var(--color-cyan)', bg: 'var(--color-cyan)', text: '#fff' };

// Traduce el error de Firebase Auth a un mensaje leíble
function mensajeError(err) {
  const code = err?.code ?? '';
  const map = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Cerraste la ventana antes de completar el inicio de sesión.',
    'auth/network-request-failed': 'No se pudo conectar. Revisá tu conexión.',
  };
  return map[code] ?? err?.message ?? 'Ocurrió un error. Intentá de nuevo.';
}

export default function Login() {
  const { seleccionarPerfil } = useApp();
  const [tab, setTab] = useState('demo'); // 'demo' | 'ingresar' | 'registrar'

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header — logo integrado sin cuadro, banner blanco con acento cyan al pie */}
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex items-center gap-6">
            <img
              src="/paf-cap-logo.jpg"
              alt="Aprender en Familia · Fundación CAP"
              className="h-20 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-medium text-gray-dark tracking-tight leading-tight">
                Visualizador PAF 2026
              </h1>
              <p className="text-gray-ui mt-1 text-base font-light">Programa Aprender en Familia · Fundación CAP</p>
            </div>
          </div>
        </div>
        <div className="h-1" style={{ background: 'var(--color-cyan)' }}/>
      </header>

      {/* Contenido */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-10">
        {/* Tabs */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border">
          <TabButton active={tab === 'demo'} onClick={() => setTab('demo')}>
            Explorar como demo
          </TabButton>
          <TabButton active={tab === 'ingresar'} onClick={() => setTab('ingresar')}>
            Iniciar sesión
          </TabButton>
          <TabButton active={tab === 'registrar'} onClick={() => setTab('registrar')}>
            Crear cuenta
          </TabButton>
        </div>

        {tab === 'demo' && <TabDemo seleccionarPerfil={seleccionarPerfil}/>}
        {tab === 'ingresar' && <TabIngresar onSwitchToRegistrar={() => setTab('registrar')}/>}
        {tab === 'registrar' && <TabRegistrar onSwitchToIngresar={() => setTab('ingresar')}/>}
      </main>

      <footer className="border-t border-border bg-white py-4">
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF 2026 · Mock v3 — Roster real + auth Firebase</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-medium transition -mb-px border-b-2"
      style={{
        color: active ? 'var(--color-cyan)' : 'var(--color-gray-ui)',
        borderColor: active ? 'var(--color-cyan)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

// ─── Tab: Demo (grid de perfiles) ─────────────────────────────────────────

function TabDemo({ seleccionarPerfil }) {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-medium" style={{ color: 'var(--color-gray-dark)' }}>Selecciona un perfil demo</h2>
        <p className="text-gray-ui font-light mt-1 text-sm">
          Cada perfil muestra únicamente los datos correspondientes a su rol. Los datos son de demostración
          para validar look & feel y flujo de navegación.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PERFILES.map((p) => {
          const Icon = ICONOS[p.icono] ?? School;
          const accent = PERFIL_ACCENT[p.id] ?? PERFIL_DEFAULT;
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
    </>
  );
}

// ─── Tab: Iniciar sesión (email + Google) ─────────────────────────────────

function TabIngresar({ onSwitchToRegistrar }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetOk, setResetOk] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await iniciarSesionEmail(email.trim(), password);
      // El AuthProvider detecta el nuevo usuario y aplica su perfil automáticamente.
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await iniciarConGoogle();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      setError('Escribí tu correo arriba para enviarte el enlace de recuperación.');
      return;
    }
    setError('');
    try {
      await enviarResetPassword(email.trim());
      setResetOk(true);
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <AuthCard title="Iniciar sesión" subtitle="Con tu correo institucional y contraseña, o con tu cuenta de Google.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="tu@focus.cl" />
        <Field label="Contraseña" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="••••••••" />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0"/>
            <span>{error}</span>
          </div>
        )}
        {resetOk && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgb(230,245,252)', color: 'var(--color-cyan)' }}>
            Enviamos un enlace de recuperación a tu correo.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-white transition disabled:opacity-50"
          style={{ background: 'var(--color-cyan)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin"/> : <LogIn size={16}/>}
          Ingresar
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border"/>
        <span className="text-xs text-gray-ui font-light uppercase tracking-wider">o</span>
        <div className="flex-1 h-px bg-border"/>
      </div>

      <button
        onClick={google}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border font-medium text-gray-dark hover:bg-bg transition disabled:opacity-50"
      >
        {googleLoading ? <Loader2 size={16} className="animate-spin"/> : <GoogleIcon size={16}/>}
        Continuar con Google
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-ui">
        <button onClick={reset} className="hover:underline font-medium text-gray-dark">
          ¿Olvidaste tu contraseña?
        </button>
        <button onClick={onSwitchToRegistrar} className="hover:underline font-medium" style={{ color: 'var(--color-cyan)' }}>
          Crear cuenta →
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Tab: Registrar ──────────────────────────────────────────────────────

function TabRegistrar({ onSwitchToIngresar }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await registrarEmail(email.trim(), password);
      // Al registrarse, el AuthProvider detecta el usuario y aplica el perfil default.
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await iniciarConGoogle();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthCard title="Crear una cuenta" subtitle="Registrate con tu correo institucional para acceder al programa. Un superadministrador te asignará el perfil correspondiente.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="tu@focus.cl" />
        <Field label="Contraseña" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
        <Field label="Confirmar contraseña" icon={Lock} type="password" value={password2} onChange={setPassword2} placeholder="Repetir contraseña" />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0"/>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-white transition disabled:opacity-50"
          style={{ background: 'var(--color-cyan)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin"/> : <UserPlus size={16}/>}
          Crear cuenta
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border"/>
        <span className="text-xs text-gray-ui font-light uppercase tracking-wider">o</span>
        <div className="flex-1 h-px bg-border"/>
      </div>

      <button
        onClick={google}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border font-medium text-gray-dark hover:bg-bg transition disabled:opacity-50"
      >
        {googleLoading ? <Loader2 size={16} className="animate-spin"/> : <GoogleIcon size={16}/>}
        Registrarme con Google
      </button>

      <div className="mt-5 text-xs text-gray-ui text-center">
        ¿Ya tenés cuenta?{' '}
        <button onClick={onSwitchToIngresar} className="hover:underline font-medium" style={{ color: 'var(--color-cyan)' }}>
          Iniciar sesión
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Reusables ────────────────────────────────────────────────────────────

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-medium" style={{ color: 'var(--color-gray-dark)' }}>{title}</h2>
        {subtitle && <p className="text-sm text-gray-ui font-light mt-1">{subtitle}</p>}
      </div>
      <div className="card">
        {children}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-ui font-medium mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-ui pointer-events-none"/>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none transition"
        />
      </div>
    </div>
  );
}

// Google "G" icon SVG (usamos SVG inline en vez de instalar iconografía)
function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
