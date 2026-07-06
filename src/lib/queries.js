// React Query hooks para leer catálogo desde Firestore.
// Todos los hooks devuelven { data, isLoading, error } — patrón estándar de TanStack Query v5.
//
// Las queries están agrupadas por dominio: sostenedores, establecimientos, indicadores, ámbitos.
// Cada hook define su queryKey de forma que el cache se comparta correctamente entre vistas.

import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchColeccion(nombre) {
  const snap = await getDocs(collection(db, nombre));
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

async function fetchDoc(coleccion, id) {
  const snap = await getDoc(doc(db, coleccion, id));
  return snap.exists() ? { _docId: snap.id, ...snap.data() } : null;
}

// ─── Sostenedores (SLEPs) ─────────────────────────────────────────────────

export function useSleps() {
  return useQuery({
    queryKey: ['sostenedores'],
    queryFn: () => fetchColeccion('sostenedores'),
  });
}

export function useSlep(slepId) {
  return useQuery({
    queryKey: ['sostenedores', slepId],
    queryFn: () => fetchDoc('sostenedores', slepId),
    enabled: Boolean(slepId),
  });
}

// ─── Establecimientos ─────────────────────────────────────────────────────

// Todos los establecimientos (usado por vistas consultor/CAP/superadmin y por filtros)
export function useEstablecimientos() {
  return useQuery({
    queryKey: ['establecimientos'],
    queryFn: () => fetchColeccion('establecimientos'),
  });
}

export function useEscuelas() {
  return useQuery({
    queryKey: ['establecimientos', 'escuelas'],
    queryFn: async () => {
      const q = query(collection(db, 'establecimientos'), where('tipo', '==', 'Escuela'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
  });
}

export function useJardines() {
  return useQuery({
    queryKey: ['establecimientos', 'jardines'],
    queryFn: async () => {
      const q = query(collection(db, 'establecimientos'), where('tipo', '==', 'Jardín'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
  });
}

export function useEstablecimiento(estId) {
  return useQuery({
    queryKey: ['establecimientos', estId],
    queryFn: () => fetchDoc('establecimientos', estId),
    enabled: Boolean(estId),
  });
}

export function useEstablecimientosPorSlep(slepId) {
  return useQuery({
    queryKey: ['establecimientos', 'porSlep', slepId],
    queryFn: async () => {
      const q = query(collection(db, 'establecimientos'), where('slep', '==', slepId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
    enabled: Boolean(slepId),
  });
}

// ─── Indicadores ──────────────────────────────────────────────────────────

export function useIndicadores(programa) {
  return useQuery({
    queryKey: ['indicadores', programa],
    queryFn: async () => {
      const q = query(
        collection(db, 'indicadores'),
        where('programa', '==', programa),
        orderBy('id', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
    enabled: Boolean(programa),
  });
}

// ─── Ámbitos ──────────────────────────────────────────────────────────────

export function useAmbitos(programa) {
  return useQuery({
    queryKey: ['ambitos', programa],
    queryFn: async () => {
      const q = query(
        collection(db, 'ambitos'),
        where('programa', '==', programa),
        orderBy('id', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
    enabled: Boolean(programa),
  });
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export function useMesCerrado() {
  return useQuery({
    queryKey: ['metadata', 'mesCerrado'],
    queryFn: () => fetchDoc('metadata', 'mesCerrado'),
  });
}
