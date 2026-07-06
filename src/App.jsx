import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useApp } from './lib/context.jsx';
import Login from './views/Login.jsx';
import Layout from './components/Layout.jsx';
import VistaEscuela from './views/VistaEscuela.jsx';
import VistaSostenedor from './views/VistaSostenedor.jsx';
import VistaConsultor from './views/VistaConsultor.jsx';
import GestionUsuarios from './views/GestionUsuarios.jsx';
import DashboardConsultores from './views/DashboardConsultores.jsx';
import PendienteAsignacion from './views/PendienteAsignacion.jsx';

export default function App() {
  const { perfil, usuario, authListo, cerrarSesion } = useApp();

  // Estado de espera: Firebase Auth todavía no confirmó si hay sesión activa
  if (!authListo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando…
      </div>
    );
  }

  // Sin sesión → Login
  if (!usuario) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  // Sesión activa pero perfil = 'pendiente' → vista de espera
  if (perfil?.id === 'pendiente') {
    return <PendienteAsignacion />;
  }

  // Sesión activa pero sin perfil resuelto todavía (caso borde: doc en Firestore no llegó)
  if (!perfil) {
    return <PantallaEsperaConEscape cerrarSesion={cerrarSesion} />;
  }

  // Determinar vista por perfil
  const VistaPorPerfil = (() => {
    switch (perfil.id) {
      case 'escuela':
      case 'jardin':      return VistaEscuela;
      case 'sostenedor':  return VistaSostenedor;
      case 'consultor':
      case 'cap':
      case 'superadmin':  return VistaConsultor;
      default:            return VistaEscuela;
    }
  })();

  const esSuperadmin = perfil.id === 'superadmin';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<VistaPorPerfil />} />
        {esSuperadmin && <Route path="/usuarios" element={<GestionUsuarios />} />}
        {esSuperadmin && <Route path="/consultores" element={<DashboardConsultores />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

// Pantalla intermedia mientras se carga el perfil desde Firestore.
// Si tarda más de 6 segundos, ofrece cerrar sesión para no dejar al usuario atrapado.
function PantallaEsperaConEscape({ cerrarSesion }) {
  const [mostrarEscape, setMostrarEscape] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMostrarEscape(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center text-gray-ui text-sm mb-4">
          <Loader2 size={16} className="animate-spin mr-2"/> Aplicando permisos…
        </div>
        {mostrarEscape && (
          <>
            <p className="text-xs text-gray-ui font-light leading-relaxed mb-4">
              Está tardando más de lo esperado. Puede haber un problema temporal
              con la carga del perfil. Intenta cerrar sesión y volver a ingresar.
            </p>
            <button
              onClick={cerrarSesion}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium text-gray-dark hover:bg-white transition"
            >
              <LogOut size={14}/>
              Cerrar sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
