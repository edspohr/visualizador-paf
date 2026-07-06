import { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { iniciarSesionEmail, registrarEmail, iniciarConGoogle, enviarResetPassword } from '../lib/firebase.js';

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
  const [tab, setTab] = useState('ingresar'); // 'ingresar' | 'registrar'

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-10">
        {/* Tabs */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border max-w-md mx-auto">
          <TabButton active={tab === 'ingresar'} onClick={() => setTab('ingresar')}>
            Iniciar sesión
          </TabButton>
          <TabButton active={tab === 'registrar'} onClick={() => setTab('registrar')}>
            Crear cuenta
          </TabButton>
        </div>

        {tab === 'ingresar' && <TabIngresar onSwitchToRegistrar={() => setTab('registrar')}/>}
        {tab === 'registrar' && <TabRegistrar onSwitchToIngresar={() => setTab('ingresar')}/>}
      </main>

      <footer className="border-t border-border bg-white py-4">
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF · Consultora Focus · Fundación CAP</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}

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

// ─── Tab Ingresar ─────────────────────────────────────────────────────────

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
      {/* Google button prominente arriba */}
      <button
        onClick={google}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border font-medium text-gray-dark hover:bg-bg transition disabled:opacity-50 mb-5"
      >
        {googleLoading ? <Loader2 size={16} className="animate-spin"/> : <GoogleIcon size={16}/>}
        Continuar con Google
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border"/>
        <span className="text-xs text-gray-ui font-light uppercase tracking-wider">o con correo</span>
        <div className="flex-1 h-px bg-border"/>
      </div>

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

// ─── Tab Registrar ─────────────────────────────────────────────────────

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
    <AuthCard title="Crear una cuenta" subtitle="Registrate con tu correo institucional. Un superadministrador te asignará el perfil correspondiente después.">
      {/* Google button prominente arriba */}
      <button
        onClick={google}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border font-medium text-gray-dark hover:bg-bg transition disabled:opacity-50 mb-5"
      >
        {googleLoading ? <Loader2 size={16} className="animate-spin"/> : <GoogleIcon size={16}/>}
        Registrarme con Google
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border"/>
        <span className="text-xs text-gray-ui font-light uppercase tracking-wider">o con correo</span>
        <div className="flex-1 h-px bg-border"/>
      </div>

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
