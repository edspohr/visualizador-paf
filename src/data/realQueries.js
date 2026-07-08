// Firestore-backed hooks. Same signatures as syntheticQueries.js.
// Etapa 3 scaffolding: reads from `resultados_real` and `establecimientos_real`.
// These hooks only run when dataSource.js flags a track as 'firestore'.

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

// ─── Generic hook wrapper ────────────────────────────────────────────────

function useFirestore(fn, deps) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, isLoading: true, error: null });
    fn()
      .then((data) => { if (!cancelled) setState({ data, isLoading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, isLoading: false, error }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

async function fetchEstablecimientosByPrograma(programa) {
  const q = query(collection(db, 'establecimientos_real'), where('programa', '==', programa));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Sostenedores ─────────────────────────────────────────────────────────
// Cross-cutting; not track-dependent. Kept synthetic in Etapa 3 (dispatched from queries.js).

export function useSleps() {
  return { data: [], isLoading: false, error: null };
}
export function useSlep() {
  return { data: null, isLoading: false, error: null };
}

// ─── Establecimientos ─────────────────────────────────────────────────────

export function useEstablecimientos() {
  return useFirestore(async () => {
    const snap = await getDocs(collection(db, 'establecimientos_real'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, []);
}

export function useEscuelas() {
  return useFirestore(() => fetchEstablecimientosByPrograma('escolar'), []);
}

export function useJardines() {
  return useFirestore(() => fetchEstablecimientosByPrograma('parvulario'), []);
}

export function useEstablecimiento(estId) {
  return useFirestore(async () => {
    if (!estId) return null;
    const snap = await getDoc(doc(db, 'establecimientos_real', estId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }, [estId]);
}

export function useEstablecimientosPorSlep(slepId) {
  return useFirestore(async () => {
    if (!slepId) return [];
    const q = query(collection(db, 'establecimientos_real'), where('slep', '==', slepId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, [slepId]);
}

// ─── Indicadores / Ámbitos ────────────────────────────────────────────────
// The catalog stays in the committed catalog.json; not read from Firestore.
// These hooks fall back to synthetic in queries.js — see dispatcher.

export function useIndicadores() {
  return { data: [], isLoading: false, error: null };
}
export function useAmbitos() {
  return { data: [], isLoading: false, error: null };
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export function useMesCerrado() {
  return useFirestore(async () => {
    const snap = await getDoc(doc(db, 'config', 'mesCerrado'));
    return snap.exists() ? snap.data() : { cerradoPor: 'firestore', ultimoSyncExitoso: false };
  }, []);
}

export function usePipelineMetadata() {
  return useFirestore(async () => {
    const snap = await getDoc(doc(db, 'config', 'pipelineMetadata'));
    return snap.exists() ? snap.data() : null;
  }, []);
}

// ─── Progreso trimestral ──────────────────────────────────────────────────

export function useProgresoTrimestral(establecimientoId, anio) {
  return useFirestore(async () => {
    if (!establecimientoId || !anio) return [];
    const q = query(
      collection(db, 'progresoTrimestral_real'),
      where('establecimientoId', '==', establecimientoId),
      where('anio', '==', anio),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, [establecimientoId, anio]);
}

export function useProgresoAnio(anio) {
  return useFirestore(async () => {
    if (!anio) return [];
    const q = query(collection(db, 'progresoTrimestral_real'), where('anio', '==', anio));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, [anio]);
}

// ─── Valores por indicador ────────────────────────────────────────────────
//
// The returned docs are spread as-is — callers rely on `estado`
// ('validado' | 'provisional') to mark provisional values in the UI.
// Do not filter it out.

export function useValoresIndicador(establecimientoId, anio) {
  return useFirestore(async () => {
    if (!establecimientoId || !anio) return [];
    const q = query(
      collection(db, 'resultados_real'),
      where('establecimientoId', '==', establecimientoId),
      where('anio', '==', anio),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, [establecimientoId, anio]);
}

export function useValoresAnio(anio) {
  return useFirestore(async () => {
    if (!anio) return [];
    const q = query(collection(db, 'resultados_real'), where('anio', '==', anio));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, [anio]);
}
