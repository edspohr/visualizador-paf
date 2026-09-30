# 0003 — The nightly load detects new and missing establishments and publishes new ones immediately

Status: Accepted · 2026-09-30

## Context

A new school is a new folder under a cohort folder in Drive; a new jardín is a
new row in a Base SCJI or a Central planilla. The load already picked them up,
but silently: the status email compared against fixed counts (24 jardines, 18
schools), so an addition was never announced and a removal offset by an addition
went unnoticed. A jardín present only in a Central produced values with no
establishment document.

## Decision

- Each ingest compares what it found with `establecimientos_real` before writing
  and reports, in its JSON report under `establecimientos`:
  `nuevos`, `desaparecidos`, `sinFuente` (created in the platform, not found yet),
  `pendientes` (missing sostenedor, comuna, enrolment, cohort, RBD, source
  workbooks or per-course planillas), `discrepancias` (platform vs source) and
  `sostenedoresDesconocidos`.
- A new establishment is written and **published immediately** (`origen: 'carga'`,
  `detectadoAt`). Every establishment seen gets `fuenteVistaAt`.
- A row that exists only in a Central creates a minimal establishment.
- The email turns 🟡 for a new establishment, and for the rest only on the night
  the situation first appears. Open items stay listed every day in a section
  "Establecimientos con pendientes" with a link to the admin screen, without
  changing the status.
- The fixed 24 / 18 are replaced by comparison with the previous run.

## Consequences

- A new establishment appears in the national views the morning after it is
  added, possibly without sostenedor; its sostenedor cannot see it until someone
  assigns one. The email says what is missing.
- "Disappeared" is reported, never acted on: data of an establishment that left
  the sources is kept.
- A partial run (`--schools=`) does not report missing schools.
- New cohorts still need a code change: folder and workbook ids are constants
  (TD-02).
