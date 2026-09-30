# 0002 — Establishments and sostenedores are registered in the platform; platform edits win over planillas

Status: Accepted · 2026-09-30

## Context

Focus wants to move gradually from planillas to the platform. Until now:

- Sostenedores did not exist as data. They were inferred by grouping
  establishments by `slep`, and the name → id table lived in a script outside the
  pipeline. A SLEP without establishments could not be assigned to a user.
- A school's sostenedor, comuna, RBD and enrolment came from a local XLSX loaded
  by hand; a jardín's came from the Base SCJI and were rewritten every night.
- Nobody could correct or complete those fields without a developer.

## Decision

- **Sostenedores catalog:** collection `sostenedores_real/{slepId}`
  (`nombre`, `alias[]`). Seeded from existing data (`seedSostenedores.mjs`).
  Created and renamed from the screen "Establecimientos y sostenedores". A rename
  keeps the old name as an alias so planillas that still use it keep resolving.
  The ingests resolve sostenedor name → id through this catalog.
- **Admin screen** (superadmin): create a sostenedor, create an establishment
  ahead of its source, edit sostenedor / comuna / RBD / enrolment / cohort / name.
- **Platform wins.** A field edited in the platform is listed in
  `camposPlataforma` on the establishment. The ingests skip those fields
  (`respetarPlataforma`) and report when the source says something different.
- **Anchoring by name.** Ids are derived from the name by the same function in
  the platform and in the ingests (`src/lib/registro.js`), so an establishment
  created ahead of time is the doc the load later writes to. If the names differ,
  the load registers the source as a new establishment and the administrator
  joins both from the screen: the one with data stays and inherits what was
  filled in, the placeholder is deleted.
- **Hidden until anchored.** An establishment created in the platform that no
  load has seen (`origen: 'plataforma'`, no `fuenteVistaAt`) stays out of every
  view and of the null backfill: it would show as 0 % and drag averages down.
- A blank cell in a source no longer erases a registered value.

## Consequences

- `establecimientos_real` now has two writers (ingests and the admin function).
  `camposPlataforma` is the contract between them; any new writer must honour it
  (`ingestRosterEscolar.mjs` does not yet — TD-19).
- A platform edit is permanent until someone edits again. There is no "give the
  field back to the planilla" action yet.
- Deleting is limited to placeholders without data and to sostenedores without
  establishments or users.
- Per-course planillas of a new school still come from the XLSX index (TD-01).

## Alternatives considered

- **A Google Sheet roster read nightly.** Matches today's workflow but keeps the
  planilla as the system of record, which is the opposite of where Focus is going.
- **Last writer wins.** Every platform edit would be lost at 02:00.
