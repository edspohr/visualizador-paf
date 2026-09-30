# 0001 — Every value carries the SLEP of its establishment, enforced nightly

Status: Accepted · 2026-09-30

## Context

The sostenedor profile reads `resultados_real` with `where('slep', '==', slepId)`
and the Firestore rules authorize that read by the same field. The field was
introduced by a one-shot backfill (2026-08-04); the ingests never wrote it. Every
value created after that date had no `slep`.

On 2026-09-30, 297 of 856 Escolar 2026 aggregate values and 78 Parvulario
aggregates lacked it. Those values were invisible to the sostenedor and counted
as 0 in its percentage (a missing applicable value counts 0). Rehearsed on a copy
of production: SLEP Los Parques showed 30 % before the fix and 48 % after.
Nothing failed loudly.

## Decision

1. The ingests and `backfillEscolarNullDocs` write `slep` on every value, taken
   from `establecimientos_real`.
2. A pipeline step, `syncSlepDenormalizado.mjs`, runs after the ingests and sets
   `slep` on `resultados_real` / `progresoTrimestral_real` and `slepId` on
   jardin/escuela users wherever it differs from the establishment. It reports
   how many it corrected, and the status email warns when that number is not 0.
3. When an administrator changes the sostenedor of an establishment, the admin
   function propagates it in the same operation (ADR-0004).

## Consequences

- The denormalized copy can no longer drift silently: the worst case is one night.
- One more full read of `resultados_real` per night (≈6 000 docs today).
- `backfillSlepOnResultados.mjs` and `backfillSlepIdOnUsuarios.mjs` are superseded.
- `aggregatesTerritorio_real` is recomputed at night, so a sostenedor change made
  during the day reaches peer averages the next morning (TD-21).

## Alternatives considered

- **Authorize by establishment lookup in the rules** (`get()` on the
  establishment for each value). Rules cannot do that for list queries without
  one read per document, and the query itself still needs a field to filter on.
- **Only fix the ingests.** Leaves no defence against the next writer that forgets the field.
