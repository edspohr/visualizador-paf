import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './lib/context.jsx';
import Login from './views/Login.jsx';
import Layout from './components/Layout.jsx';
import VistaEscuela from './views/VistaEscuela.jsx';
import VistaSostenedor from './views/VistaSostenedor.jsx';
import VistaConsultor from './views/VistaConsultor.jsx';
import GestionUsuarios from './views/GestionUsuarios.jsx';
import DashboardConsultores from './views/DashboardConsultores.jsx';

export default function App() {
  const { perfil } = useApp();

  if (!perfil) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
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
