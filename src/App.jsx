import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
  const { perfil, usuario, authListo } = useApp();

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Aplicando permisos…
      </div>
    );
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
