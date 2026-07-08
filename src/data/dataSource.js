// Data-source flag per track. Etapa 4: la fuente de verdad es Firestore `config/dataSource`.
// El cliente se suscribe al doc al bootear la app: `loadDataSource()` resuelve la primera
// vez que llega el snapshot (main.jsx bloquea el render hasta entonces). Cambios posteriores
// disparan `location.reload()` — rollback instantáneo desde consola sin redeploy.
//
// Fallback: si Firestore no responde, se mantiene `synthetic` para ambos.

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const DEFAULT = Object.freeze({ escolar: 'synthetic', parvulario: 'synthetic' });

let CACHED = { ...DEFAULT };
let FIRST_LOADED = false;
let LOAD_PROMISE = null;

function normalize(d) {
  return {
    escolar: d?.escolar === 'real' ? 'real' : 'synthetic',
    parvulario: d?.parvulario === 'real' ? 'real' : 'synthetic',
  };
}

export function loadDataSource() {
  if (LOAD_PROMISE) return LOAD_PROMISE;
  LOAD_PROMISE = new Promise((resolve) => {
    let unsub;
    try {
      unsub = onSnapshot(
        doc(db, 'config', 'dataSource'),
        (snap) => {
          const next = normalize(snap.exists() ? snap.data() : null);
          const changed =
            FIRST_LOADED &&
            (next.escolar !== CACHED.escolar || next.parvulario !== CACHED.parvulario);
          CACHED = next;
          if (!FIRST_LOADED) {
            FIRST_LOADED = true;
            resolve(CACHED);
          } else if (changed) {
            // Instant rollback: reload picks up the new flag.
            // eslint-disable-next-line no-console
            console.info('[dataSource] flag change detected → reload', CACHED);
            window.location.reload();
          }
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.warn('[dataSource] Firestore listen failed; defaulting to synthetic', err);
          if (!FIRST_LOADED) {
            FIRST_LOADED = true;
            resolve(CACHED);
          }
        },
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[dataSource] init error; defaulting to synthetic', e);
      if (!FIRST_LOADED) {
        FIRST_LOADED = true;
        resolve(CACHED);
      }
    }
    // Detach listener on window unload (nice-to-have; not critical for SPA)
    if (typeof window !== 'undefined' && unsub) {
      window.addEventListener('beforeunload', unsub, { once: true });
    }
  });
  return LOAD_PROMISE;
}

// Sync getters — consistentes entre renders porque queries.js las llama después de que
// main.jsx haya awaited loadDataSource().
export function sourceFor(track) {
  return CACHED[track] || 'synthetic';
}

export function isReal(track) {
  return sourceFor(track) === 'real';
}

// Exposed for debugging.
export const DATA_SOURCE = new Proxy({}, {
  get(_t, key) { return CACHED[key]; },
});
