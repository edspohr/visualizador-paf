// Mark resultados_real docs that a fresh ingest no longer produces as
// "sin dato" (X-04). Without this, a merge-upsert ingest leaves the previous
// value in place whenever a planilla cell becomes empty or unreadable (old
// ZERO_FALLBACK zeros, values a school later erased, docs from an earlier id
// format).
//
// Docs are not deleted — resultados_real is not a regenerable collection (see
// CLAUDE.md). The doc keeps its id and gets:
//   valor: null, estado: 'sin_dato_reportado', valorAnterior, rawAnterior,
//   prunedAt, prunedReason
// The UI already ignores null values, so the indicator shows as "Sin datos".

import { FieldValue } from 'firebase-admin/firestore';

/**
 * @param db        Firestore instance
 * @param opts.programa  'parvulario' | 'escolar'
 * @param opts.keepIds   Set of doc ids written by this run
 * @param opts.inScope   (doc) => boolean — only docs this run was responsible for
 *                       (e.g. same periods / same schools)
 * @param opts.dryRun    when true, nothing is written
 * @returns list of { id, establecimientoId, indicadorId, periodo, valorAnterior }
 */
export async function pruneStale(db, { programa, keepIds, inScope, dryRun }) {
  const snap = await db.collection('resultados_real').where('programa', '==', programa).get();
  const stale = [];
  for (const d of snap.docs) {
    if (keepIds.has(d.id)) continue;
    const data = d.data();
    if (!inScope(data, d.id)) continue;
    if (data.valor === null && data.estado === 'sin_dato_reportado') continue; // already pruned / backfill slot
    stale.push({ ref: d.ref, id: d.id, data });
  }
  if (!dryRun) {
    let batch = db.batch(); let count = 0;
    for (const s of stale) {
      batch.set(s.ref, {
        valor: null,
        estado: 'sin_dato_reportado',
        valorAnterior: s.data.valor ?? null,
        rawAnterior: s.data.raw ?? null,
        prunedReason: 'no viene en la última carga',
        prunedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count) await batch.commit();
  }
  return stale.map(s => ({
    id: s.id,
    establecimientoId: s.data.establecimientoId ?? null,
    indicadorId: s.data.indicadorId ?? null,
    periodo: s.data.periodo ?? null,
    nivel: s.data.nivel ?? null,
    valorAnterior: s.data.valor ?? null,
  }));
}
