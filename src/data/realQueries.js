// Firestore-backed hooks. Fuente única de datos para toda la UI.
// - Establecimientos, valores y metadata → Firestore (`establecimientos_real`,
//   `resultados_real`, `progresoTrimestral_real`, `config/*`).
// - Ámbitos e indicadores → catálogo local (`catalog.json`), no viven en Firestore.

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import catalog from './catalog.json';

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

function ok(data) {
  return { data, isLoading: false, error: null };
}

// Normaliza indicadorId a la forma con punto: 'I1' → 'I.1', 'I.1' → 'I.1'.
// Aplica al leer de Firestore mientras la migración escolar no está corrida.
function normalizarIndicadorId(id) {
  if (typeof id !== 'string') return id;
  const m = id.match(/^I\.?(\d+)$/);
  return m ? `I.${m[1]}` : id;
}

// ─── Establecimientos ─────────────────────────────────────────────────────

async function fetchEstablecimientosByPrograma(programa) {
  const q = query(collection(db, 'establecimientos_real'), where('programa', '==', programa));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

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

// ─── Sostenedores (derivados de establecimientos) ─────────────────────────
// Firestore no tiene una colección de sostenedores. Los agregamos leyendo
// `establecimientos_real` una vez y agrupando por `slep`. Cada sostenedor
// expone { id, nombre, comuna } al igual que el resto de la app espera.

export function useSleps() {
  return useFirestore(async () => {
    const snap = await getDocs(collection(db, 'establecimientos_real'));
    const bySlep = new Map();
    for (const d of snap.docs) {
      const est = d.data();
      const id = est.slep;
      if (!id) continue;
      if (!bySlep.has(id)) {
        bySlep.set(id, {
          id,
          // sostenedor viene como "SLEP Los Parques" o similar; conservamos
          // el string original como `nombre` para que el helper de labels
          // (que ya recorta el prefijo "SLEP ") funcione consistentemente.
          nombre: est.sostenedor || id,
          comunas: new Set(),
        });
      }
      if (est.comuna) bySlep.get(id).comunas.add(est.comuna);
    }
    // Convertir Set → string legible por UI (comunas separadas por " / ")
    return [...bySlep.values()].map(s => ({
      id: s.id,
      nombre: s.nombre,
      comuna: [...s.comunas].sort().join(' / '),
    }));
  }, []);
}

export function useSlep(slepId) {
  const all = useSleps();
  const data = useMemo(
    () => (all.data ?? []).find(s => s.id === slepId) ?? null,
    [all.data, slepId]
  );
  return { data, isLoading: all.isLoading, error: all.error };
}

// ─── Indicadores / Ámbitos (catálogo local) ───────────────────────────────
// El catálogo canónico vive en catalog.json (regenerable con
// `node scripts/parseCatalogs.mjs`). Escolar usa el framework 2026 por defecto.

export function useIndicadores(programa) {
  const data = useMemo(() => {
    if (programa === 'parvulario') return catalog.indicadores.parvulario;
    return catalog.indicadores.escolar2026;
  }, [programa]);
  return ok(data);
}

export function useAmbitos(programa) {
  const data = useMemo(() => {
    if (programa === 'parvulario') return catalog.ambitos.parvulario;
    return catalog.ambitos.escolar;
  }, [programa]);
  return ok(data);
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export function useMesCerrado() {
  return useFirestore(async () => {
    const snap = await getDoc(doc(db, 'config', 'mesCerrado'));
    return snap.exists() ? snap.data() : null;
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
// Los docs se devuelven tal cual, salvo `indicadorId` que se normaliza a
// forma con punto ('I1' → 'I.1'). Los callers dependen de `estado`
// ('validado' | 'provisional') para atenuar valores provisionales en UI —
// nunca lo filtres.

export function useValoresIndicador(establecimientoId, anio) {
  return useFirestore(async () => {
    if (!establecimientoId || !anio) return [];
    const q = query(
      collection(db, 'resultados_real'),
      where('establecimientoId', '==', establecimientoId),
      where('anio', '==', anio),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
    });
  }, [establecimientoId, anio]);
}

export function useValoresAnio(anio) {
  return useFirestore(async () => {
    if (!anio) return [];
    const q = query(collection(db, 'resultados_real'), where('anio', '==', anio));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
    });
  }, [anio]);
}
