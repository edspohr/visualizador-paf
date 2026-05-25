import { createContext, useContext, useState, useEffect } from 'react';
import { ESCUELAS, JARDINES, SLEPS } from '../data/establecimientos.js';

const AppCtx = createContext(null);

// Perfiles disponibles con su contexto por defecto
export const PERFILES = [
  {
    id: 'escuela',
    nombre: 'Escuela',
    descripcion: 'Directora, equipo directivo',
    icono: 'school',
    color: 'navy',
    rol: 'Acceso a tu establecimiento',
    contexto: { tipo: 'establecimiento', id: 'ESC-001', programa: 'escolar' }
  },
  {
    id: 'jardin',
    nombre: 'Jardín Infantil',
    descripcion: 'Directora, equipo educativo',
    icono: 'baby',
    color: 'lime',
    rol: 'Acceso a tu jardín',
    contexto: { tipo: 'establecimiento', id: 'JAR-001', programa: 'parvulario' }
  },
  {
    id: 'sostenedor',
    nombre: 'Sostenedor',
    descripcion: 'SLEP',
    icono: 'building',
    color: 'sky',
    rol: 'Acceso a tu red de establecimientos',
    contexto: { tipo: 'slep', id: 'SLEP-LP', programa: 'escolar' }
  },
  {
    id: 'consultor',
    nombre: 'Consultor / CAP',
    descripcion: 'Coordinación, Fundación CAP',
    icono: 'shield',
    color: 'navy',
    rol: 'Acceso completo a todos los programas',
    contexto: { tipo: 'total', programa: 'escolar' }
  },
];

export function AppProvider({ children }) {
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const guardado = localStorage.getItem('paf_perfil');
    if (guardado) {
      try { setPerfil(JSON.parse(guardado)); } catch { /* ignore */ }
    }
  }, []);

  const seleccionarPerfil = (p) => {
    setPerfil(p);
    localStorage.setItem('paf_perfil', JSON.stringify(p));
  };

  const cerrarSesion = () => {
    setPerfil(null);
    localStorage.removeItem('paf_perfil');
  };

  const cambiarEntidad = (id) => {
    if (!perfil) return;
    const nuevo = { ...perfil, contexto: { ...perfil.contexto, id } };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
  };

  const cambiarPrograma = (programa) => {
    if (!perfil) return;
    const nuevoCtx = { ...perfil.contexto, programa };
    // Si cambia programa, también resetear establecimiento por defecto si aplica
    if (perfil.id === 'escuela' && programa === 'parvulario') nuevoCtx.id = 'JAR-001';
    if (perfil.id === 'jardin' && programa === 'escolar') nuevoCtx.id = 'ESC-001';
    const nuevo = { ...perfil, contexto: nuevoCtx };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
  };

  return (
    <AppCtx.Provider value={{ perfil, seleccionarPerfil, cerrarSesion, cambiarEntidad, cambiarPrograma }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}

// Resolvedores de entidades
export function resolverEntidad(contexto) {
  if (contexto.tipo === 'establecimiento') {
    return [...ESCUELAS, ...JARDINES].find(e => e.id === contexto.id);
  }
  if (contexto.tipo === 'slep') {
    return SLEPS.find(s => s.id === contexto.id);
  }
  return null;
}
