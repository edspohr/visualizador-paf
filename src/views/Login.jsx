import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { iniciarConGoogle } from '../lib/firebase.js';

// Traduce el error de Firebase Auth a un mensaje corto.
function mensajeError(err) {
  const code = err?.code ?? '';
  const map = {
    'auth/popup-closed-by-user': 'Se cerró la ventana antes de completar el inicio de sesión.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para este sitio.',
    'auth/cancelled-popup-request': 'Se canceló el inicio de sesión.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión a internet.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión.',
  };
  return map[code] ?? err?.message ?? 'Ocurrió un error. Intenta de nuevo.';
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const google = async () => {
    setError('');
    setLoading(true);
    try {
      await iniciarConGoogle();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Encabezado */}
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

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-md w-full">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-medium" style={{ color: 'var(--color-gray-dark)' }}>Iniciar sesión</h2>
            <p className="text-sm text-gray-ui font-light mt-2 leading-relaxed">
              Ingresa con tu cuenta de Google para acceder a la plataforma.
              Si es tu primera vez, se creará automáticamente tu cuenta y un administrador
              te asignará el perfil correspondiente.
            </p>
          </div>

          <div className="card">
            <button
              onClick={google}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border font-medium text-gray-dark hover:bg-bg transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin"/> : <GoogleIcon size={18}/>}
              Continuar con Google
            </button>

            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                <span>{error}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-ui font-light text-center mt-6">
            El acceso al Visualizador PAF está reservado para el equipo del programa.
            Si tienes dudas, comunícate con Consultora Focus.
          </p>
        </div>
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
