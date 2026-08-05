// Firestore-backed hooks. Fuente única de datos para toda la UI.
// - Establecimientos, valores y metadata → Firestore (`establecimientos_real`,
//   `resultados_real`, `progresoTrimestral_real`, `config/*`).
// - Ámbitos e indicadores → catálogo local (`catalog.json`), no viven en Firestore.

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import catalog from './catalog.json';

// ─── Generic hook wrapper ────────────────────────────────────────────────

function useFirestore(fn, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null });
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, isLoading: true, error: null });
    fn()
      .then((data) => { if (!cancelled) setState({ data, isLoading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, isLoading: false, error }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
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

// Reads only the SLEP row for a given slepId by querying establecimientos_real
// filtered to that SLEP — passes Firestore rules for sostenedor profile.
export function useSlepDoc(slepId) {
  return useFirestore(async () => {
    if (!slepId) return null;
    const q = query(collection(db, 'establecimientos_real'), where('slep', '==', slepId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    // Derive SLEP metadata from the first matching establishment
    const est = snap.docs[0].data();
    const comunas = new Set(snap.docs.map(d => d.data().comuna).filter(Boolean));
    return {
      id: slepId,
      nombre: est.sostenedor || slepId,
      comuna: [...comunas].sort().join(' / '),
    };
  }, [slepId]);
}

// Profile-aware hook: returns the minimal set of establishment data that
// Firestore rules permit for the current user profile.
// Returns: { establecimiento, slep, establecimientos, isLoading, error }
//   - escuela/jardin: establecimiento = single est doc, slep = SLEP doc, establecimientos = [establecimiento]
//   - sostenedor: establecimiento = null, slep = SLEP doc, establecimientos = all ests in that SLEP
//   - consultor/cap/superadmin: uses broad hooks (same as before)
//
// A real superadmin "viendo como" a limited profile takes the same query shape as
// the limited profile — the broad rules already allow the read for superadmin, and
// single-doc lookups tolerate a stale placeholder id by returning null (Layout
// auto-selects a real id in that case).
export function useEntidadDelPerfil(perfil, allEscuelas, allJardines, allSleps) {
  const perfilId = perfil?.id;
  const contextoId = perfil?.contexto?.id;
  const esLimitado = perfilId === 'escuela' || perfilId === 'jardin' || perfilId === 'sostenedor';

  // Limited-profile single-est path
  const singleEstQ = useEstablecimiento(
    (perfilId === 'escuela' || perfilId === 'jardin') ? contextoId : null
  );
  const singleEst = singleEstQ.data;

  // Derive slepId from the resolved est (for escuela/jardin)
  const derivedSlepId = perfilId === 'sostenedor'
    ? contextoId
    : singleEst?.slep ?? null;

  const slepDocQ = useSlepDoc(
    esLimitado ? derivedSlepId : null
  );

  const slepEstsQ = useEstablecimientosPorSlep(
    perfilId === 'sostenedor' ? contextoId : null
  );

  if (perfilId === 'escuela' || perfilId === 'jardin') {
    const isLoading = singleEstQ.isLoading || slepDocQ.isLoading;
    const error = singleEstQ.error || slepDocQ.error;
    return {
      establecimiento: singleEst,
      slep: slepDocQ.data,
      establecimientos: singleEst ? [singleEst] : [],
      isLoading,
      error,
    };
  }

  if (perfilId === 'sostenedor') {
    const isLoading = slepDocQ.isLoading || slepEstsQ.isLoading;
    const error = slepDocQ.error || slepEstsQ.error;
    return {
      establecimiento: null,
      slep: slepDocQ.data,
      establecimientos: slepEstsQ.data ?? [],
      isLoading,
      error,
    };
  }

  // consultor / cap / superadmin — use the pre-loaded broad arrays passed in
  const escuelas = allEscuelas ?? [];
  const jardines = allJardines ?? [];
  const sleps = allSleps ?? [];
  return {
    establecimiento: null,
    slep: null,
    establecimientos: [...escuelas, ...jardines],
    isLoading: false,
    error: null,
    // expose full arrays for consultor views
    _escuelas: escuelas,
    _jardines: jardines,
    _sleps: sleps,
  };
}

// W1(peer): read the precomputed peer average for a given (programa × slep × tipo
// × anio × indicadorId). Tries the primary aggregate first; if not present or not
// publishable to the caller, falls back to the program-wide aggregate. Returns:
//   { mean: number|null, source: 'slep-tipo'|'programa'|null, nReporters: number|null,
//     isLoading, error }
// mean === null means neither tier is available (rare — only if no reporter data
// exists for that indicator × year at all).
export function useTerritorioAggregate(programa, slep, tipo, anio, indicadorId) {
  return useFirestore(async () => {
    if (!programa || !tipo || !anio || !indicadorId) {
      return { mean: null, source: null, nReporters: null };
    }
    const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const asMean = (data, source) => ({
      mean: data.nReporters > 0 ? data.sumaValor / data.nReporters : null,
      source,
      nReporters: data.nReporters ?? 0,
    });

    if (slep) {
      const primaryId = ['agg', programa, slep, tipo, anio, indicadorId].map(sanitize).join('_');
      try {
        const snap = await getDoc(doc(db, 'aggregatesTerritorio_real', primaryId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.publishable === true) return asMean(data, 'slep-tipo');
        }
      } catch {
        // Fall through to fallback tier — rules may deny publishable=false to this profile.
      }
    }

    const fallbackId = ['agg', programa, tipo, anio, indicadorId].map(sanitize).join('_');
    try {
      const snap = await getDoc(doc(db, 'aggregatesTerritorio_real', fallbackId));
      if (snap.exists()) return asMean(snap.data(), 'programa');
    } catch { /* no-op */ }

    return { mean: null, source: null, nReporters: null };
  }, [programa, slep, tipo, anio, indicadorId]);
}

// Scoped resultados query for sostenedor: only reads docs belonging to their SLEP.
// Requires the `slep` field to be present on resultados_real docs (backfilled by
// scripts/backfillSlepOnResultados.mjs) and a composite index on (slep, anio).
export function useValoresSlepAnio(slepId, anio) {
  return useFirestore(async () => {
    if (!slepId || !anio) return [];
    const q = query(
      collection(db, 'resultados_real'),
      where('slep', '==', slepId),
      where('anio', '==', anio),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
      })
      .filter((d) => !d.nivel);
  }, [slepId, anio]);
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

// Devuelve los agregados por jardín (docs SIN campo `nivel`). Los docs por
// sala (con `nivel`) se excluyen para no contarlos dos veces al agregar.
// `enabled: false` evita disparar la query (útil cuando otro hook ya trae ese año).
export function useValoresAnio(anio, enabled = true) {
  return useFirestore(async () => {
    if (!anio || !enabled) return [];
    const q = query(collection(db, 'resultados_real'), where('anio', '==', anio));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
      })
      // Excluir docs con `nivel` para evitar doble conteo. El comparador
      // usa `useValoresAnioNivel` cuando necesita el desglose por sala.
      .filter((d) => !d.nivel);
  }, [anio, enabled]);
}

// Devuelve los valores por sala filtrados por nivel bucket
// ('sala_cuna_menor', 'sala_cuna_mayor', 'nivel_medio_menor',
// 'nivel_medio_mayor', 'transicion_1', 'transicion_2').
// Cuando `nivel === null` o `'TODOS'`, retorna [] (usar useValoresAnio en su lugar).
export function useValoresAnioNivel(anio, nivel) {
  return useFirestore(async () => {
    if (!anio || !nivel || nivel === 'TODOS') return [];
    const q = query(
      collection(db, 'resultados_real'),
      where('anio', '==', anio),
      where('nivel', '==', nivel),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
    });
  }, [anio, nivel]);
}

// Devuelve los valores por sala de TODOS los niveles operativos del año.
// Se usa cuando el desglose "Por nivel" está activo y queremos partir los datos
// por cada nivel simultáneamente (una única query con `in`, 6 valores — bajo el
// límite de 30 de Firestore). Cuando `enabled === false` retorna [] para no
// disparar la lectura.
const NIVELES_OPERATIVOS = [
  'sala_cuna_menor',
  'sala_cuna_mayor',
  'nivel_medio_menor',
  'nivel_medio_mayor',
  'transicion_1',
  'transicion_2',
];

export function useValoresAnioNiveles(anio, enabled = true) {
  return useFirestore(async () => {
    if (!anio || !enabled) return [];
    const q = query(
      collection(db, 'resultados_real'),
      where('anio', '==', anio),
      where('nivel', 'in', NIVELES_OPERATIVOS),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, indicadorId: normalizarIndicadorId(data.indicadorId) };
    });
  }, [anio, enabled]);
}
