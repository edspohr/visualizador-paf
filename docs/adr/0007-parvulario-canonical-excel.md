# 0007 — The Parvulario catalog and planillas are read in canonical numbering, without translation

Status: Accepted · 2026-10-15

## Context

Until October 2026 the client's Parvulario Excel ("Sistema indicadores PAF
Parvulario.xlsx", 2026-07) numbered indicators differently from the canonical
order agreed on 2026-07-29, and the three central planillas skipped I.44. Two
translation layers compensated: `PARVULARIO_CANONICAL.renames` (+1 / −1, two
deletions, one addition) at catalog-parse time, and a −1 shift for planilla
I.45–I.54 in `scripts/lib/parvularioIds.mjs` at ingest time.

Focus then renumbered both sources to the canonical order (planillas by
2026-10-01, the Excel shared by Luis on 2026-10-09) without the platform knowing.
The ingest kept shifting, so from the day the planillas changed every value in
I.44–I.53 was stored under the previous indicator and I.53 was never loaded
(reported by Luis as "I.44 shows I.45", "I.52 empty", "I.49 differs";
confirmed with Caballito Feliz on 2026-10-15).

## Decision

- The canonical numbering is the only numbering. `planillaToCanonical` is the
  identity for I.1–I.53 and returns `null` outside that range; the ingest
  reports unknown columns instead of guessing.
- `scripts/parseCatalogs.mjs` reads the Excel as canonical: no renames,
  deletions or additions for Parvulario (`PARVULARIO_CANONICAL` is empty), the
  "VIGENCIA" column replaces `VIGENCIA_PROVISIONAL`, and header renames of the
  new Excel are tolerated by name lookup. The Excel in `src/data/catalogs/` is
  the copy that produced the committed `catalog.json`.
- The 2026-07 translation survives only as `PARVULARIO_LEGACY_RENAMES`, for
  `scripts/ingestExtended.mjs`, which still addresses columns by the old ids.
- Values are repaired by re-ingesting from the planillas with `--prune`, not by
  migrating Firestore in place (same rule as the 2026-07-29 incident).

## Consequences

- A future renumbering by Focus must be announced before it is applied; the
  platform cannot detect a silent shift when every column still carries a valid
  id. Mitigation to consider: compare the indicator *name* in the planilla
  header with the catalog name and warn on mismatch (TD-26).
- The Excel is now authoritative for names, metas, inicio and vigencia (D-05,
  D-06). Discrepancies between Excel and planilla names (I.51) are resolved in
  favour of the Excel.
- Escolar 2026 still needs its canonical map (I.46 deleted, I.47–I.52 → I.46–I.51)
  until Sebastián's Excel is renumbered the same way.
