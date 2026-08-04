# Plan de cierre — Visualizador PAF · 2026-08-04

**Executor**: Claude Sonnet, fresh session, no memory of the planning conversation.
**Repo**: `/Users/espohr/Documents/focus-data` — Firebase-hosted React app already in production at `https://visualizador-paf.web.app`.
**Handover date**: 2026-08-14. This is a **closing run**: after this work the project is invoiced. Correctness beats cleverness. No refactors beyond what each task requires. Do not add abstractions "for later".

---

## Context (why this exists)

The client (Consultora Focus + Fundación CAP) has confirmed the platform is final. Two independent modules:
- **Parvulario** (24 jardines infantiles, contact Luis Agurto). Considered closed by the client — regressions here are critical.
- **Escolar** (18 escuelas, contact Sebastián Peters). Still finalizing cobertura.

This plan closes:
- **W1**: three client-reported defects, PLUS a Firestore-rules data-scope leak surfaced during investigation. Everything limited-profile users need to actually use the platform. **W1 ships and is fully validated by the client before any later phase begins.**
- **W2**: re-mapping now that the service account has full access to all 466 Escolar spreadsheets.
- **W3**: year-over-year homologation for the Escolar comparator.
- **W4**: per-indicator missing-data audit (display-only).
- **W5**: OPTIONAL FOR HANDOVER — a superadmin-only territorial map. Ship after everything else is validated, droppable without affecting delivery.

## Hard constraints (verbatim into every phase)

1. **No student-level data in Firestore or in any aggregate** (Ley 21.719, Chile). Aggregates only. **No aggregate may allow reverse-engineering an individual establecimiento's value**, including cross-year differencing. Every ingest/harvest run is followed by `node scripts/piiAssertion.mjs --all --cache` before deploy; exit 1 blocks deploy.
2. **Never rename or reorder columns in the source Google Sheets or roster XLSX files** — the mapping breaks. Adapt on our side only.
3. **No raw hex in UI code** (JSX, CSS). Only design tokens defined in `src/index.css`. `scripts/checkColorTokens.mjs` runs in `npm run build` and fails on unknown tokens.
4. **No Firestore document is ever deleted** by us — with ONE explicit exception documented in W1: derived aggregate collections (`aggregatesTerritorio_real`) may be re-generated via write-new-then-delete-orphans, in that order, in the pipeline that owns them. See W1(d) for the rule and its rationale.
5. **Every script accepts `--dry-run` and is idempotent.** Report to `reports/`.
6. **Never renumber indicators in Firestore in-place** — re-ingest instead. `scripts/migrateCanonicalIndicadorIds.mjs` is deprecated.
7. **CLAUDE.md is updated** for any new collection, hook, script, or data contract.
8. **Deploy discipline**: `npm run build` before every deploy; `npm run deploy:rules` only when rules or indexes changed. Confirm production URL after every deploy.
9. **STOP-AND-ASK markers** are non-optional. Any step marked STOP-AND-ASK requires a message to the user before proceeding. Skipping these can ship silent bugs into a live client system.

## Environment

- Firebase project: `visualizador-paf`
- Service account: `scripts/service-account.json` (gitignored, present in the working tree)
- Commands: `npm run dev`, `npm run build`, `npm run deploy:rules`, `npm run deploy`
- User running this session: `espohr@gmail.com` — for anything requiring a STOP-AND-ASK, address them directly and wait for a reply.

## Deploy sequencing

**Deploy 1** — W1 complete, W2–W5 not started.
**Deploy 2** — W2, W3, W4 complete.
**Deploy 3 (optional)** — W5, only if time allows and it passes verification.

W1 must be fully validated by the client (real jardin, escuela, sostenedor accounts) BEFORE any code from W2–W5 is written. See W1 for the validation gate.

---

# PHASE W1 — Defects and data-scope leak (Deploy 1)

W1 is completely self-contained. An executor doing only W1 must never need to read W2–W5. Everything W1 depends on lives in this section.

W1 ships in the following order:

- **W1(c)** — auth/query mismatch: no jardin, escuela, or sostenedor user can currently use the platform. Blast radius is total.
- **W1(d)** — Firestore rules data-scope leak (sostenedor reads across SLEPs) — same rules pass as W1(c).
- **W1(peer)** — peer-average precomputed aggregate so the fix in W1(c) does not degrade functionality for limited profiles.
- **W1(a) + W1(b)** — territorial defects (comuna off-by-one, Ramón del Río hidden), rooted in Firestore data drift.
- **W1 gate** — client-account validation before Deploy 1.

## W1(c) — Auth/query mismatch (root cause)

### Established root cause (rigorously verified)

- Firestore rules at `firestore.rules:140-147` for `establecimientos_real`:
  ```
  allow read: if esUsuarioValido() && (
    (esEscuelaOJardin() && getUsuario().establecimientoId == estId) ||
    (esSostenedor() && resource.data.slep == getUsuario().slepId) ||
    esAccesoCompleto()
  );
  ```
  For a `jardin` or `escuela` profile, only the single doc matching `usuarios.establecimientoId` is readable. For `sostenedor`, only docs whose `slep` field matches `usuarios.slepId`. For consultor/cap/superadmin, all.

- Firestore evaluates rules per document with `resource` bound to each doc in a query's would-be result. If ANY doc would fail, the whole query is rejected. This is documented Firebase behavior, not a hypothesis.

- Broad queries used by the app violate this for limited profiles:
  - `useEscuelas`, `useJardines` at [src/data/realQueries.js:54-60](src/data/realQueries.js#L54-L60) — `where('programa', '==', ...)`.
  - `useSleps` at [src/data/realQueries.js:84-111](src/data/realQueries.js#L84-L111) — `collection(db, 'establecimientos_real')` unfiltered.
  - `useValoresAnio` at [src/data/realQueries.js:208](src/data/realQueries.js#L208) — `where('anio', '==', ...)`.

- Broken call sites for limited profiles:
  - **`src/components/Layout.jsx:37-39`** — Layout wraps every authenticated route. Uses `useEscuelas`, `useJardines`, `useSleps`. Fails for jardin/escuela (both); fails for sostenedor (all three).
  - **`src/views/VistaEscuela.jsx:37-39, 49`** — uses the three broad hooks plus `useValoresAnio`. Fails end-to-end for jardin/escuela.
  - **`src/views/VistaSostenedor.jsx:41-43, 59`** — same broad hooks. Fails end-to-end for sostenedor.
  - **`src/views/VistaConsultor.jsx:74-76, 80, 96, 97`** — consultor/cap/superadmin only. Works today.
  - **`src/views/GestionUsuarios.jsx:22-24`**, **`src/views/DashboardConsultores.jsx:52-53`** — superadmin only (route-guarded at [src/App.jsx:65-66](src/App.jsx#L65-L66)). Works.

- Failure mode: `useFirestore` at [src/data/realQueries.js:13-25](src/data/realQueries.js#L13-L25) catches errors and sets `{data: null, error}`. So the page renders but downstream `resolverEntidad` returns undefined → VistaEscuela shows "Centro educativo no encontrado" ([src/views/VistaEscuela.jsx:113](src/views/VistaEscuela.jsx#L113)), VistaSostenedor shows "Sostenedor no encontrado" (line 156). Layout's entity dropdown is empty.

- Why nobody noticed until c.manriquez: the three whitelisted emails auto-promote to superadmin on first login ([src/lib/firebase.js:55-57](src/lib/firebase.js#L55-L57)), passing `esAccesoCompleto()`. All prior test users were whitelisted. **No user with `perfilDefault ∈ {escuela, jardin, sostenedor}` has ever successfully used this platform**.

### STOP-AND-ASK · Diagnostic phase before writing any fix

The user requested inspection-first. Do not skip.

1. Create `scripts/diagnoseAuthResolution.mjs`:
   - Firebase Admin SDK via `scripts/service-account.json`.
   - Argument: optional `--email=<address>`.
   - Read-only. No writes anywhere.
   - Output for every `usuarios` doc: `uid, email, perfilDefault, establecimientoId, slepId, establecimientoIds (length), proveedor`.
   - For each user with `perfilDefault ∈ {escuela, jardin}` and non-null `establecimientoId`: verify `establecimientos_real/{establecimientoId}` exists and print MATCH / MISSING, plus doc.programa.
   - For each user with `perfilDefault === 'sostenedor'` and non-null `slepId`: verify at least one `establecimientos_real` doc has `slep === slepId`; print MATCH / EMPTY.
   - For each user with `perfilDefault ∈ {escuela, jardin}` and non-null `establecimientoId`: also print the resolved doc's `.slep` value — that will feed W1(peer)'s backfill.
   - Emit `reports/diagnoseAuthResolution-YYYY-MM-DD.json`.

2. Run: `node scripts/diagnoseAuthResolution.mjs`.

3. **STOP-AND-ASK the user** with the report. Expected patterns:
   - `c.manriquez@edudelpino.gob.cl` present, `perfilDefault=jardin`, `establecimientoId` set.
   - MATCH on that assignment → the rule-mismatch hypothesis is confirmed. Proceed.
   - MISSING → the establishmentId is stale/wrong; still apply the code fix below (rule mismatch remains), and additionally ask the user how to correct the specific assignment.

### Code fix — replace broad queries in limited-profile paths

**Do not loosen the rules.** The rules are correct: a jardin user should not read other jardines. Change the client to read only what rules allow.

**Files to touch — additive first, then callsite replacements.**

**A. New hooks in [src/data/realQueries.js](src/data/realQueries.js)**:

- `useSlepDoc(slepId)` — reads `establecimientos_real` with `where('slep', '==', slepId)` and reduces to the SLEP metadata one row. Passes rules for sostenedor and consultor. Returns `{ id, nombre, comuna }` shape matching `useSleps` output.
- `useEstablecimientosDeSlep(slepId)` (already exists as `useEstablecimientosPorSlep` at line 70 — reuse it).
- `useEstablecimiento(estId)` already exists at line 62 — reuse.
- Keep `useEscuelas`, `useJardines`, `useSleps`, `useValoresAnio` unchanged — they remain correct for consultor/cap/superadmin.

**B. New profile-aware wrapper in [src/data/realQueries.js](src/data/realQueries.js)**:

- `useEntidadDelPerfil(perfil)` — returns `{ establecimiento, slep, isLoading, error }` picking the correct minimal query per `perfil.id`:
  - `escuela` / `jardin`: `useEstablecimiento(perfil.contexto.id)`; then `useSlepDoc(establecimiento?.slep)` gated on `enabled: !!establecimiento`.
  - `sostenedor`: `useSlepDoc(perfil.contexto.id)`; then `useEstablecimientosDeSlep(perfil.contexto.id)`.
  - `consultor` / `cap` / `superadmin`: `useEscuelas` + `useJardines` + `useSleps` — no restriction.

  This one hook centralizes the branching so views don't repeat it.

- `useFirestore` currently has no `enabled` flag — add one so gated queries don't fire before their dependency loads.

**C. [src/components/Layout.jsx](src/components/Layout.jsx)**:

- Replace lines 37-42 to call `useEntidadDelPerfil(perfil)` and derive `opcionesEntidad` from its result:
  - For `escuela`/`jardin`: `opcionesEntidad = entidad ? [entidad] : []` (single-item dropdown).
  - For `sostenedor`: `opcionesEntidad = [slep]`.
  - For `consultor`/`cap`/`superadmin`: keep the current all-establishments arrays.

**D. [src/views/VistaEscuela.jsx](src/views/VistaEscuela.jsx)**:

- Replace lines 37-39 (`useEscuelas`, `useJardines`, `useSleps`) with `useEntidadDelPerfil(perfil)`.
- Remove line 56's `todosEstablecimientos = [...]` construction; use `entidad` directly from the hook.
- Replace `resolverEntidad(...)` at line 59 with the hook's `establecimiento` field.
- **Peer-average path (lines 122-144, `drilldownExtras`)** — replaced entirely by W1(peer). Do that section BEFORE removing the current path so the drilldown never renders without data. Delete the local mean computation only after `useTerritorioAggregate` is wired in.
- `useValoresAnio` at line 49 fails for jardin/escuela — remove it. The only remaining use of `valoresAnioQ.data` in this file is inside `drilldownExtras` for the current peer computation, which W1(peer) replaces.
- Keep `useValoresIndicador(entidadIdFromCtx, anioSeleccionado)` at line 45 — passes rules.

**E. [src/views/VistaSostenedor.jsx](src/views/VistaSostenedor.jsx)**:

- Replace lines 41-43 (`useEscuelas`, `useJardines`, `useSleps`) with `useEntidadDelPerfil(perfil)` (returns slep + its establecimientos).
- Replace line 47 `resolverEntidad` and lines 49-50 `escuelasSlep`/`jardinesSlep` filters with the hook's outputs: the hook already returns SLEP-scoped establecimientos.
- Line 59 `useValoresAnio(anioSeleccionado)` — passes rules today (due to the leak W1(d) fixes), but AFTER W1(d) sostenedor will lose the broad `resultados_real` read. The correct replacement is `useValoresSlepAnio(slepId, anio)`, a new hook that queries `where('slep', '==', slepId).and(where('anio', '==', anio))` — see W1(d) for the matching rule change. Add this new hook in `src/data/realQueries.js`.

**F. [src/views/VistaConsultor.jsx](src/views/VistaConsultor.jsx)**: no change. Consultor/cap/superadmin pass `esAccesoCompleto()`.

**G. [src/views/GestionUsuarios.jsx](src/views/GestionUsuarios.jsx)**:

- When admin assigns `perfilDefault=jardin` or `escuela` with an `establecimientoId`: also write `slepId` derived from that establecimiento's `.slep`. This unlocks the peer-average rule in W1(peer).
- When admin assigns `perfilDefault=sostenedor`: the existing flow writes `establecimientoId` (see line 61-64) — WRONG for sostenedor. Change it so sostenedor assignment writes `{ slepId: value, establecimientoId: null }`. Verify by reading `opcionesPorPerfil` at line 268-273 — sostenedor is populated from `catalogo.sleps`, so `value` is already a slepId, just wrongly stored.

**H. New pre-deploy gate: `scripts/validateUserAssignments.mjs`**:

- For each usuario:
  - `perfilDefault ∈ {jardin, escuela}`: `establecimientoId` set, doc exists, `doc.programa` matches (jardin→parvulario, escuela→escolar), `slepId === doc.slep`. Missing `slepId` → WARN (fixed by the backfill in W1(peer)).
  - `perfilDefault === 'sostenedor'`: `slepId` set, at least one establecimiento has that slep, `establecimientoId` is null.
  - `perfilDefault === 'consultor'`: `establecimientoIds` array present (may be empty; warn if empty).
- Emit `reports/validateUserAssignments-YYYY-MM-DD.json`. Exit 1 on any ERROR (warnings do not block).
- `package.json` script entry: `"validate:users": "node scripts/validateUserAssignments.mjs"`.

### Verification of W1(c) — minimal, before W1(d)/(peer)

1. `node scripts/validateUserAssignments.mjs` — the report is generated (may have warnings, no errors).
2. In `npm run dev`, log in as superadmin (whitelisted). The existing flows still work.
3. Do NOT test with limited profiles yet — W1(peer) and W1(d) must land before the end-to-end validation.

### What could break

- Any code that assumes `todosEstablecimientos` is a full array (drilldown, peer tables) will break. Grep for `todosEstablecimientos`, `escuelasQ.data`, `jardinesQ.data`, `slepsQ.data` under `src/` and adapt every call site — do not miss VistaEscuela's drilldown, VistaSostenedor's drilldown, and the header entity dropdown.
- The header dropdown for jardin/escuela becomes a single-item dropdown (still renders; no functional loss).
- If `usuarios.slepId` is missing on a jardin/escuela user, `useSlepDoc` gets `undefined` and returns null — Layout's slep name renders blank until W1(peer)'s backfill runs. Ship W1(peer) same deploy.

---

## W1(d) — Firestore rules data-scope leak (Ley 21.719)

### The leak

- `firestore.rules:151-158` for `resultados_real`:
  ```
  allow read: if esUsuarioValido() && (
    (esEscuelaOJardin() && resource.data.establecimientoId == getUsuario().establecimientoId) ||
    esSostenedor() ||
    esAccesoCompleto()
  );
  ```
  Sostenedor gets ANY `resultados_real` doc — including establecimientos in other SLEPs. This is a data-scope violation.
- Same shape at `firestore.rules:162-168` for `progresoTrimestral_real`.

### Fix

- Amend both blocks so sostenedor reads only their SLEP's data. The rule needs a slep field on `resultados_real` docs.
- Currently `resultados_real` docs carry `establecimientoId` and `anio` but not `slep`. Two options:

  - **(a) Denormalize `slep` onto every `resultados_real` and `progresoTrimestral_real` doc at ingest time.** Then the rule becomes:
    ```
    (esSostenedor() && resource.data.slep == getUsuario().slepId)
    ```
    Requires: update `scripts/ingestParvulario.mjs`, `scripts/ingestEscolar.mjs`, `scripts/ingestExtended.mjs`, `scripts/syncPlanillasCentrales.mjs` to write `slep` on every emitted doc. Plus a one-off backfill script `scripts/backfillSlepOnResultados.mjs` for existing docs.

  - **(b) `get()` from rules to join to `establecimientos_real`.** Cleaner code, but every `resultados_real` read costs an extra rule-time doc fetch. Firebase bills these. For 5,010+502 docs, over many queries, this is unnecessary cost.

  Recommend **(a)**. Denormalization is one-time cost, no runtime overhead. Ingest already writes `establecimientoId` — adding `slep` is trivial.

### Files to touch

- **`firestore.rules`** — update both `resultados_real` and `progresoTrimestral_real` blocks. Also confirm `establecimientos_real` sostenedor clause is correct as-is (it already gates by `slep == slepId`).
- **`scripts/ingestParvulario.mjs`**, **`scripts/ingestEscolar.mjs`**, **`scripts/ingestExtended.mjs`**, **`scripts/syncPlanillasCentrales.mjs`** — when emitting a `resultados_real` or `progresoTrimestral_real` doc, include `slep` in the payload. Look up from `establecimientos_real` cache in memory (all ingest scripts already load the full roster at start).
- **`scripts/backfillSlepOnResultados.mjs`** (new) — one-off, `--dry-run`. For every doc in `resultados_real` and `progresoTrimestral_real` missing `slep`, look up `establecimientos_real[establecimientoId].slep` and merge-write it. Idempotent. Report to `reports/backfillSlepOnResultados-YYYY-MM-DD.json`.
- **`scripts/validateUserAssignments.mjs`** (already in W1(c)) — extended: also check that every doc in `resultados_real` has a `slep` field. Warn if not (post-backfill this should be 0).
- **`src/data/realQueries.js`** — add `useValoresSlepAnio(slepId, anio)`:
  ```
  const q = query(collection(db, 'resultados_real'),
                  where('slep', '==', slepId),
                  where('anio', '==', anio));
  ```
  This is the replacement for VistaSostenedor's use of `useValoresAnio`. Requires a composite index on `(slep, anio)` in `firestore.indexes.json`.
- **`firestore.indexes.json`** — add composite index `resultados_real: (slep ASC, anio ASC)`. Then `npm run deploy:rules` is required for W1.

### STOP-AND-ASK before backfill

Before running the backfill against production Firestore:

1. Run `scripts/backfillSlepOnResultados.mjs --dry-run` and report to user.
2. **STOP-AND-ASK the user** with the count of docs to update, the sample diffs (first 5), and any establecimientos_real ids referenced but not found in the roster.

### Verification

1. After backfill: query a sample of 20 `resultados_real` docs and confirm all have `slep` set to a valid SLEP-XX id.
2. Deploy rules to a staging project OR at minimum run the Firestore Rules Playground (Firebase console → Firestore → Rules → Playground) with:
   - A simulated sostenedor user (`usuarios.slepId=SLEP-DP`) reading a `resultados_real` doc with `slep=SLEP-SR` — should DENY.
   - Same user reading a doc with `slep=SLEP-DP` — should ALLOW.
   - A jardin user reading a doc with `establecimientoId=X` matching their own — should ALLOW.
   - Same reading a doc with a different `establecimientoId` — should DENY.
3. `npm run deploy:rules` — only after the Playground tests pass.

### What could break

- Any existing sostenedor user (there are none today — see W1(c)) would see the visible dataset shrink after this ships. Not a regression because no such users exist yet; documented for the record.
- `useValoresAnio` remains unchanged in the code — it's still used by VistaConsultor for consultor/cap/superadmin, whose rule (`esAccesoCompleto`) still permits the broad read.
- If any `resultados_real` doc is missed by the backfill, sostenedor queries on that doc will be denied silently. The validator script in W1(c) catches this.

---

## W1(peer) — Peer-average precomputed aggregate

Without this, W1(c) removes the "Promedio del territorio" feature for jardin/escuela users. That's a functional downgrade the client never agreed to. Solve it properly with a precomputed aggregate that limited profiles are permitted to read.

### Design (frozen — do not redesign)

**Collection**: `aggregatesTerritorio_real/{docId}`

**Doc ID**: `agg_${programa}_${slep}_${tipo}_${anio}_${indicadorId}` — e.g. `agg_parvulario_SLEP-DP_Jardín_2026_I.15`. Deterministic. All doc-ID fields must also live in the doc body (rules gate on body fields, not on doc IDs).

**Doc shape** (concrete example, use as spec):
```json
{
  "aggregateKind": "slep-tipo",
  "programa": "parvulario",
  "slep": "SLEP-DP",
  "tipo": "Jardín",
  "anio": 2026,
  "indicadorId": "I.15",
  "n": 5,
  "nReporters": 5,
  "sumaValor": 12.4,
  "sumaLogroCapped": 3.8,
  "publishable": true,
  "publishableReason": "ok",
  "unidad": "%",
  "metaNum": 60,
  "computedAt": "2026-08-04T18:00:00Z"
}
```

- `aggregateKind` distinguishes the primary SLEP×tipo aggregate from the program-wide fallback (see below).
- `publishable` — bool. Rules only expose docs with `publishable === true` to limited profiles.
- `publishableReason` — one of `"ok"`, `"below_k_min"`, `"yoy_composition_leak"`, `"fallback_used"`. For diagnostics.
- `nReporters` — establecimientos in the group with a reported non-null value. Includes the caller.
- `sumaValor` — sum of raw values. `sumaValor / nReporters = mean`, matching today's drilldown behavior (raw per-indicator mean).
- `sumaLogroCapped` — sum of `min(1, calcularLogro(v_i, ind))`. Stored for possible future use (dormant `AmbitoCard.deltaPromedio`); not consumed by UI today. `calcularLogro` is imported from `src/data/establecimientos.js` and used unchanged. **Do NOT reimplement or modify `cumplimientoIndicadores` in `src/data/scope.js`.**

**Group definition — TWO tiers**:

1. **Primary**: `aggregateKind: "slep-tipo"` — one doc per `programa × slep × tipo × anio × indicadorId`. This is today's peer-set semantics (same SLEP, same tipo).
2. **Fallback**: `aggregateKind: "programa"` — one doc per `programa × tipo × anio × indicadorId` (no slep). Aggregates every jardín or every escuela across all SLEPs. Universe sizes:
   - parvulario: 24 jardines (across SLEP-SR 15, SLEP-DP 5, SLEP-SC 4).
   - escolar: 18 escuelas (across SLEP-SR 9, SLEP-LP 5, SLEP-SC 4).
   - Both universes ≥ 18 → always clear K_MIN=4 with room. Document this in the plan report (below): the fallback tier is guaranteed publishable in the current universe.

**Privacy floor — K_MIN = 4** (do not lower):

- Rationale (as agreed): with `nReporters ≥ 4`, an insider who knows their own value can derive the sum of 3 others but not any single value.
- Applies to the primary aggregate. Fallback (program-wide) always clears K_MIN by construction.

**Cross-year composition attack**:

- If a limited-profile user reads the SAME indicator's aggregate across years, and the reporter set differs by exactly 1 establecimiento AND all other conditions align, the attacker can isolate the differing establecimiento's value. See Documentation § "YoY differencing risk" below.
- Mitigation implemented in `computeTerritorioAggregates.mjs`:
  - For every primary doc, compute `G_current` and `G_previous` (reporter sets in year Y and Y-1 for the same slep×tipo×indicador).
  - `publishable = true` requires ALL of:
    1. `nReporters ≥ K_MIN`.
    2. `nReporters_prevYear >= K_MIN` OR `no prev year data exists at all` (first year of program).
    3. `|G_current ⊕ G_previous| ≤ 1` is FALSE (i.e., composition delta ≥ 2, or the previous year isn't published, or both).
       - If `|G_current ⊕ G_previous| = 1` (exactly one addition or removal), set `publishable = false, publishableReason = "yoy_composition_leak"` — even if K_MIN is met this year.
       - If both years' groups are identical, publish freely (composition delta = 0).
       - If both years have ≥ 2 differences OR one of them was already unpublishable, publish (attack surface closed).
- `aggregateKind: "programa"` is not subject to this because its group is the entire program (composition changes only when the client adds/removes an escuela from the program itself — a very slow, publicly-known event).

**UI treatment when the primary aggregate is not publishable**:

- Use the fallback (`aggregateKind: "programa"`) aggregate.
- Label distinctly in `IndicatorDrilldown`:
  - When primary is used: caption "Promedio del territorio" (existing wording — unchanged).
  - When fallback is used: caption "Promedio del programa · calculado sobre los N centros del programa"; add a tooltip: "El promedio del territorio no puede publicarse este mes para preservar la privacidad de los centros. Se muestra el promedio del programa completo."
- Never render "0%" or a blank bar. Always one of the two.

**Firestore rule** — new collection block:

```
match /aggregatesTerritorio_real/{docId} {
  allow read: if esUsuarioValido() && resource.data.publishable == true && (
    // Primary (slep-tipo): limited profiles need slep match on their user doc
    (resource.data.aggregateKind == "slep-tipo" &&
     (
       (esEscuelaOJardin() && resource.data.slep == getUsuario().slepId) ||
       (esSostenedor() && resource.data.slep == getUsuario().slepId) ||
       esAccesoCompleto()
     )
    ) ||
    // Fallback (programa): any authenticated user
    (resource.data.aggregateKind == "programa" && esUsuarioValido())
  ) ||
  // Admin/analyst roles can also read non-publishable primary aggregates
  (esAccesoCompleto() && resource.data.aggregateKind == "slep-tipo");
  allow write: if false;
}
```

- Admin roles (`consultor`, `cap`, `superadmin`) can read all primary aggregates including `publishable=false` ones — the same statistic, no double source-of-truth.
- Nothing else is widened. The rule change adds ONE new collection with narrow reads and no writes.

**Ingest hook** — `scripts/computeTerritorioAggregates.mjs`:

- Reads all `establecimientos_real` (for slep/tipo/programa/id lookups).
- Reads all `resultados_real` grouped by (est, anio, indicador). Uses only the aggregate-per-jardín docs (`resultados_real` without `nivel` field) so multi-sala doubles don't skew.
- Computes both aggregate kinds for every (anio ∈ {2025, 2026}) × indicadorId × programa × tipo. For primary: also per slep. Computes composition sets for cross-year check.
- Writes a full new set of aggregate docs to `aggregatesTerritorio_real`.
- **Orphan cleanup** (explicit exception to the no-delete rule — see Hard Constraint #4 and the "Derived-collection exception" section below): after all writes commit, list the docs in the collection, subtract the written set, and delete the orphans. NEVER before writes. This ordering ensures that at every moment during the run, the collection contains a superset of the correct data — never a subset.
- Batches: Firestore caps at 500 ops. Emit multiple batches; `Promise.all` at the end.
- Idempotent (`--dry-run` prints the diff; without dry-run, writes are the same regardless of prior state).
- Report to `reports/computeTerritorioAggregates-YYYY-MM-DD.json` listing: written count, orphan-deleted count, per-group summary, K_MIN violations, YoY-composition violations.
- Wire into `npm run ingest:parvulario` and `npm run ingest:escolar` as a follow-up step (or a separate `npm run aggregate:territorio` script; add it to `package.json` scripts).

**Derived-collection exception to Hard Constraint #4**:

- Source-of-truth collections (`establecimientos_real`, `resultados_real`, `progresoTrimestral_real`, `usuarios`) — NEVER delete.
- Derived aggregate collections (`aggregatesTerritorio_real`, and any future derived collection) — MAY delete orphans in the derivation pipeline, ONLY via write-new-then-delete-orphans ordering. Never delete before writing the replacement. Document this rule at the top of the derivation script.
- Add the same note to `CLAUDE.md` under "Colecciones Firestore".

**Backfill `usuarios.slepId` for existing users** — `scripts/backfillSlepIdOnUsuarios.mjs`:

- New assignments via `GestionUsuarios` (from W1(c) fix) will write `slepId`. Existing users won't have it.
- For every `usuarios` doc with `perfilDefault ∈ {jardin, escuela}` and non-null `establecimientoId` and no `slepId`:
  - Look up `establecimientos_real/{establecimientoId}.slep`.
  - Set `usuarios/{uid}.slepId = <resolved slep>` via merge.
- Idempotent, `--dry-run`, report to `reports/backfillSlepIdOnUsuarios-YYYY-MM-DD.json`.
- Also: for `perfilDefault === 'sostenedor'` docs that have a mis-stored `establecimientoId` instead of `slepId` (the pre-existing GestionUsuarios bug from W1(c) §G), copy the value to `slepId` and null out `establecimientoId`. Warn loudly if `establecimientoId` matches a real doc (indicates the user got confused about their assignment; do not auto-migrate — STOP-AND-ASK).
- Run this AFTER the GestionUsuarios fix ships but BEFORE the peer-aggregate rule takes effect (so no jardin user hits a page that expects slepId and doesn't have it).

**Client wiring**:

- New hook in `src/data/realQueries.js`: `useTerritorioAggregate(programa, slep, tipo, anio, indicadorId)`. Reads `aggregatesTerritorio_real/agg_...`. If not publishable, also reads `agg_programa_...`.
- `src/views/VistaEscuela.jsx` drilldownExtras — replace the local computation (lines 122-144) with a call to `useTerritorioAggregate(...)` when the drilldown opens. Pass the resulting `{ mean, source: "slep-tipo" | "programa", n, nReporters }` down.
- `src/components/IndicatorDrilldown.jsx` — extend props to accept `promedioSource` and render the appropriate caption. Do not render "Promedio del territorio" when `promedioSource === "programa"`; use "Promedio del programa" with the tooltip described above.

### Verification of W1(peer)

1. After ingest + aggregate run, in Firestore console:
   - Sample `aggregatesTerritorio_real` docs, confirm shape.
   - Confirm at least one `SLEP-SC × Jardín` doc has `publishable=false, publishableReason="below_k_min"` when only 3 or fewer jardines reported (verify against the actual state).
   - Confirm the corresponding fallback (`agg_parvulario_Jardín_2026_...`) exists with `publishable=true`.
2. In `npm run dev`, log in as a real jardin test user (created for Deploy 1 validation — see W1 gate). Open a drilldown; verify the peer line:
   - Renders "Promedio del territorio" when the primary aggregate is publishable.
   - Renders "Promedio del programa" when it's not.
   - Never renders "0%" or blank.
3. Sanity: superadmin sees primary values including `publishable=false` ones (so internal analysis isn't blocked).

### What could break

- If the ingest missed writing `slep` on a resultados doc (from W1(d)) AND compute Aggregates uses that doc, groupings can be miscounted. Ensure backfill W1(d) runs BEFORE `computeTerritorioAggregates` runs on production. Order in package.json scripts.
- YoY composition check requires both years' data present. For a program's first year, prevYear is absent — treat as "no leak possible", `publishable` based on K_MIN alone.
- If the fallback aggregate ever fails K_MIN in some future universe change, the UI must degrade to "sin promedio disponible" rather than showing a "0%" bar. Add that final tier explicitly.

---

## W1(a) & W1(b) — Territorial defects (10 vs 9 comunas, Santa Corina hides Ramón del Río)

### Root-cause hypothesis (medium-high confidence)

Both symptoms surface from [src/views/VistaConsultor.jsx](src/views/VistaConsultor.jsx):
- Line 146: `filtroSlep === 'TODOS' || e.slep === filtroSlep` — exact string compare.
- Line 203: `comunas: new Set(filtrados.map(e => e.comuna)).size` — exact string compare.
- Line 151/153: same for dropdowns.

`docs/escolar-coverage-manifest.json` (canonical projection) shows 9 unique comunas and Ramón del Río correctly under SLEP-SC / Estación Central. So the divergence is in the Firestore `establecimientos_real` state:
- (H1) A whitespace/accent variant of a comuna string in one doc → 10 vs 9. Independent of (b).
- (H2) Ramón del Río's `slep` is missing or set to a non-canonical value → hidden from Santa Corina filter AND its Estación Central becomes a "10th" comuna visible only when SLEP="TODOS". This is a plausible single-cause explanation for both symptoms.
- (H3) A stray `programa='escolar'` doc (test data, orphan) that shouldn't exist.

### STOP-AND-ASK · Diagnostic phase

1. Create `scripts/diagnoseTerritorial.mjs`. Read-only.
   - Query `establecimientos_real` with `where('programa', '==', 'escolar')` — also do `parvulario` for completeness.
   - For each doc, print `id, nombre, slep, sostenedor, comuna, cohorte, tipo, programa` with `JSON.stringify` on `slep` and `comuna` so any whitespace/quote gets exposed.
   - Compute:
     - Total count per programa (expected 18 escolar, 24 parvulario).
     - Set of distinct `slep` values with per-slep counts.
     - Set of distinct `comuna` values with per-comuna counts.
     - Any doc with `slep` null/missing (list them).
     - Any doc with `comuna` null/missing (list them).
     - Duplicate-with-variant detection: apply `String(x).trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()` to comunas and find variants whose normalized forms collide but raw forms differ.
   - Emit `reports/diagnoseTerritorial-YYYY-MM-DD.json`.
2. Run: `node scripts/diagnoseTerritorial.mjs`.
3. **STOP-AND-ASK the user** with the report. Ask specifically about Ramón del Río's `slep` value and any comuna variant found. Wait for a decision before proceeding to repair.

### Canonical source of truth (not hardcoded)

Do NOT hardcode 18 schools in the fix script. The roster XLSX files at `scripts/datos/*.xlsx` are the source of truth; extract them into a versioned JSON that all downstream scripts consume.

**A. `scripts/parseTerritorio.mjs` (new)**:

- Reads both XLSX files under `scripts/datos/`:
  - `Datos y Matriculas Cohorte 2025-2027 SLEP Los Parques.xlsx`
  - `Datos y Matriculas Cohorte 2026-2028 SLEP Santa Rosa y SLEP Santa Corina.xlsx`
- Also reads `src/data/escolarPlanillaIndex.json` (already contains the 18 escolar names + cohortes and confirms SLEP counts) for cross-checking.
- Reads `docs/Planillas PAF Escolar.xlsx` (source of the planilla index) if needed for additional metadata.
- Emits `src/data/territorio.json`:
  ```
  {
    "generatedAt": "...",
    "source": ["scripts/datos/Datos y Matriculas Cohorte 2025-2027 SLEP Los Parques.xlsx", "..."],
    "establecimientos": [
      { "id": "esc-esperanza-joven", "nombre": "Escuela Esperanza Joven", "programa": "escolar", "slep": "SLEP-SR", "comuna": "La Cisterna", "cohorte": "2026-2028", "tipo": "Escuela" },
      { "id": "jar-akun-pichiwentxu", "nombre": "Akun Pichiwentxu", "programa": "parvulario", "slep": "SLEP-DP", "comuna": "...", "cohorte": "2025-2026", "tipo": "Jardín" }
    ],
    "canonicalComunas": {
      "escolar": ["Cerrillos", "Estación Central", "La Cisterna", ...],
      "parvulario": [...]
    },
    "canonicalSleps": ["SLEP-LP", "SLEP-SR", "SLEP-SC", "SLEP-DP"]
  }
  ```
- Doc IDs must match what the ingest actually writes. Compute them the same way `scripts/ingestEscolar.mjs:109` (`schoolId`) and `scripts/ingestParvulario.mjs` (jardín slug) do — import/reuse those slug functions, don't reimplement.
- Deterministic. Committed to the repo.
- Report to `reports/parseTerritorio-YYYY-MM-DD.json`.

**B. `scripts/enrichEstablecimientos.mjs` — add `--strict` mode**:

- Load `src/data/territorio.json`.
- After the existing enrichment loop, iterate every `establecimientos_real` doc:
  - If the doc's id is in `territorio.json.establecimientos`, verify `slep`, `comuna`, `programa`, `cohorte`, `tipo` match. Any mismatch → collect as ERROR.
  - If the doc's id is NOT in territorio (extra doc in Firestore), collect as WARN.
  - Any territorio entry NOT present in Firestore, collect as WARN.
- With `--strict`: exit 1 if any ERROR. Without: print and continue (preserves historical script behavior).

**C. `scripts/repairTerritorial.mjs` (new — replaces the previously-proposed fixTerritorialData.mjs)**:

- Reads `src/data/territorio.json`.
- Reads all `establecimientos_real` docs.
- For each `territorio.json` entry:
  - If the corresponding Firestore doc exists AND fields mismatch, plan a merge-write.
  - If it does not exist in Firestore, ADD as ERROR and STOP — do not create docs.
- For each Firestore doc not in territorio, ADD as WARN — do not delete.
- `--dry-run` prints the diff.
- Without `--dry-run`, applies merge-writes only. Idempotent.
- **STOP-AND-ASK the user** with the diff before allowing non-dry-run writes.
- Report to `reports/repairTerritorial-YYYY-MM-DD.json`.

**D. UI defensive canonicalization** in [src/views/VistaConsultor.jsx](src/views/VistaConsultor.jsx):

- Add a tiny helper at the top of the file:
  ```
  const canon = (v) => (v == null ? '' : String(v).trim());
  ```
- Replace `.slep`/`.comuna` accesses in `filtrados`, `slepsDisponibles`, `comunasDisponibles`, `totales.comunas` (lines 145-153, 203) with `canon(e.slep)` / `canon(e.comuna)`.
- Do NOT normalize accents in the UI — canonical is with-accent. Accent normalization would MASK bad data; we want the validator to catch it.

### Verification

1. After enrichEstablecimientos --strict → exit 0. If not, fix per the diff before proceeding.
2. Re-run `scripts/diagnoseTerritorial.mjs` → 18 escolar docs, all with canonical slep + comuna, 9 unique comunas.
3. In `npm run dev` as superadmin viewing Escolar consultor view:
   - Total card shows "9 comunas".
   - Filter by SLEP "Santa Corina" — Escuela Ramón del Río appears (with 3 others).
   - Filter by SLEP + Cohorte — still consistent.

### What could break

- Doc IDs computed from the roster XLSX may not match what's in Firestore (e.g., name variation between the two XLSX vs the ingest-time name). The `repairTerritorial` script MUST refuse to create new docs; it may only merge into existing ones. If a mismatch surfaces, STOP-AND-ASK.
- The Ramón del Río rename script (`scripts/renameRamonDelRio.mjs`) is already applied. Do not re-run.
- Whatever caused the drift originally could recur on the next ingest. `enrichEstablecimientos --strict` (added above) is the persistent gate.

---

## W1 gate — Client-account validation before Deploy 1

Two-stage validation (as agreed):

**Stage 1: internal — executor-owned test accounts.**

1. As superadmin, in `npm run dev` locally against production Firestore:
   - Create three test users under emails owned by the executor (Sonnet):
     - `test-jardin+visualizador-paf@example.com` → perfilDefault=jardin, establecimientoId=<real jardín, e.g. Del Pino>
     - `test-escuela+visualizador-paf@example.com` → perfilDefault=escuela, establecimientoId=<real escuela, e.g. Santa Corina>
     - `test-sostenedor+visualizador-paf@example.com` → perfilDefault=sostenedor, slepId=SLEP-DP
   - After GestionUsuarios saves, verify in Firestore that slepId is set on the jardin and escuela test users (from the W1(c) fix).
2. Log in as each test user. Verify:
   - VistaEscuela / VistaSostenedor loads without "Centro educativo no encontrado".
   - Own establishment data appears.
   - Header dropdown shows only their own entity.
   - Drilldown modal opens; the peer line shows either "Promedio del territorio" or "Promedio del programa" (never blank or 0%).
3. Browser console must show no `permission-denied` errors.
4. `node scripts/validateUserAssignments.mjs` exits 0.
5. **STOP-AND-ASK the user** with screenshots of all three sessions before requesting client accounts.

**Stage 2: external — client-provided accounts.**

1. **STOP-AND-ASK the user** to obtain from the client:
   - One real jardin director account (Parvulario, any SLEP).
   - One real escuela director account (Escolar).
   - One real sostenedor account.
   - The specific expectation: what should each user see (which jardín/escuela/red).
2. Do NOT create these accounts — the client provisions them, we assign them via GestionUsuarios.
3. Repeat the Stage 1 verification for each real account.
4. **STOP-AND-ASK the user** for explicit client sign-off before Deploy 1.

**Do not deploy without both stages passing.** If the client cannot provide accounts in time, deploy after Stage 1 only WITH explicit user consent, documented in the plan report.

---

## Deploy 1 procedure

1. `git status` clean modulo the intended W1 changes.
2. `node scripts/piiAssertion.mjs --all --cache` → exit 0.
3. `node scripts/validateUserAssignments.mjs` → exit 0.
4. `node scripts/enrichEstablecimientos.mjs --strict` → exit 0.
5. `npm run build` — color-token check passes as a side effect.
6. `npm run deploy:rules` — pushes updated `firestore.rules` and `firestore.indexes.json`.
7. Wait for indexes to build (Firebase Console → Firestore → Indexes; usually 1–5 minutes for this dataset). Do NOT deploy hosting before indexes are `Enabled`.
8. `npm run deploy` — hosting.
9. Repeat all Stage 1 + Stage 2 verifications against `https://visualizador-paf.web.app`.
10. Create `docs/informe-cierre-2026-08-04.md` with a short client-facing summary of what Deploy 1 fixed (in es-CL, no jargon).
11. **STOP-AND-ASK the user** with the production verification screenshots before proceeding to W2.

---

## Documentation appendix (W1) — YoY differencing risk

This section belongs in the plan and must be transferred to `CLAUDE.md` under "Cosas que NO tocar sin coordinar / Aggregate privacy model" as part of W6.

**Attack**: An authenticated jardin/escuela user reads the same `aggregatesTerritorio_real` primary doc across `anio=2025` and `anio=2026`. They compute the delta of `sumaValor`. If the reporter sets `G_2025` and `G_2026` differ by exactly one establecimiento, the delta reveals that establecimiento's value directly.

**Concrete scenario**: SLEP-DP jardines. In 2025, 4 out of 5 reported indicator I.15. In 2026, all 5 reported. `G_2026 = G_2025 ∪ {X}`. `sumaValor(2026) - sumaValor(2025) = sum(G_2026 - G_2025 for both years) + v_2026(X)`. If the same 4 report both years, the first sum ≈ 4 individual deltas (informative but not directly identifying), plus `v_2026(X)` — from which knowledge of the 4 deltas can isolate X.

**Realism**: The UI already exposes some peer-level data to jardin users in the same SLEP (peer table in the drilldown, ranking chips). So an attacker plausibly has partial peer knowledge to leverage.

**Mitigation implemented** in `computeTerritorioAggregates.mjs`:

Primary aggregate is publishable ONLY if all of:
1. `nReporters ≥ K_MIN` this year.
2. `nReporters ≥ K_MIN` last year OR no last year data exists.
3. `|G_currentYear ⊕ G_previousYear|` is 0 OR ≥ 2.

If (3) fails (composition delta = 1), set `publishable = false, publishableReason = "yoy_composition_leak"` even when K_MIN is met.

**Fallback aggregate** (`aggregateKind: "programa"`) is not subject to this — the group is the entire program (24 jardines / 18 escuelas); composition changes are slow and publicly known.

**Rule out cross-tier attack**: If primary is unpublished but fallback IS published, the fallback carries fewer degrees of freedom (it's a much larger group). Even worst-case, an attacker with the fallback plus a large amount of external peer knowledge could only infer aggregate group behavior, not individual values.

**Ruled in**: The YoY composition attack is real. It is mitigated by the composition-delta gate above. Any change to the gate must be re-analyzed.

**Ruled out**: Same-year within-group inference at K_MIN=4 is bounded — an attacker with their own value can derive sum-of-3-others but no individual. Requires additional external knowledge to identify any single peer value; not casual.

---
---

# EVERYTHING BELOW DOES NOT SHIP UNTIL DEPLOY 1 IS COMPLETE AND VALIDATED BY THE CLIENT

# PHASE W2 — Re-run source discovery and mapping with full access

Now the service account reads all 466 Escolar spreadsheets (previously 69 were unreadable). Regenerate the coverage picture for BOTH modules so we have a snapshot comparable to 2026-07-30.

## W2.1 — Parvulario re-ingest

Structurally unchanged (3 Planillas Centrales, all readable before), but re-run for a clean 2026-08-04 timestamp.

1. `npm run ingest:parvulario -- --dry-run`. Diff against `reports/ingestParvulario-2026-07-30.json`. If nothing changed, skip write.
2. If changes: `npm run ingest:parvulario` (writes to Firestore). Report at `reports/ingestParvulario-2026-08-04.json`.
3. **Also run the follow-ups from W1**: `node scripts/backfillSlepOnResultados.mjs` (if any docs need it), `node scripts/computeTerritorioAggregates.mjs` (regenerate aggregates for updated data). These stay idempotent.
4. `node scripts/mapeoParvulario.mjs` — regenerates `docs/mapeo-parvulario-2026-08-04.md`.
5. `node scripts/piiAssertion.mjs --all` — exit 0.

## W2.2 — Escolar full re-harvest + coverage manifest

1. **Clear the harvest cache for previously-failing spreadsheets**:
   - Extract the 69 failed spreadsheet IDs from `reports/harvestEscolar-2026-07-30.json`:
     ```
     node -e "const r=require('./reports/harvestEscolar-2026-07-30.json'); console.log(Object.keys(r.errors).join(','))"
     ```
   - Prefer `--only=<ids>` to keep the existing successful cache. Alternative: `rm -rf .cache/harvest && node scripts/harvestEscolar.mjs` for a full re-run (~18 minutes) if the cache is old or you suspect drift. Note the choice in the phase report.

2. `node scripts/harvestEscolar.mjs --only=<ids>` (or full re-run per above).
   - Expected: at least 465 successful. The 1 broken KA link (Escuela Básica Sendero del Saber, KA) may still fail if Sebastián hasn't fixed the source spreadsheet — **STOP-AND-ASK the user** if this is the only remaining failure. Do NOT fix source spreadsheets ourselves.
   - Report at `reports/harvestEscolar-2026-08-04.json`.

3. Regenerate coverage manifest with Firestore state:
   ```
   node scripts/generateEscolarCoverageManifest.mjs --with-firestore
   ```
   Emits `docs/escolar-coverage-manifest.{json,md}`.

4. Delta report: create `scripts/coverageDiff.mjs`:
   - Load both manifests (2026-07-30 and 2026-08-04).
   - Emit `reports/coverageDiff-2026-08-04.md`:
     - Count of tuples that moved from `FUENTE_NO_ACCESIBLE` to any other state (the win from full access).
     - New `CON_DATO_REPORTADO` / `SIN_DATO_REPORTADO` counts.
     - Any regressions (tuples that got worse).

5. Rerun `piiAssertion --all --cache` — exit 0.

## W2.3 — Regenerate the source-coverage report

Create `docs/informe-cobertura-fuentes-2026-08-04.md` mirroring the exact section structure of `docs/informe-cobertura-fuentes-2026-07-30.md` (Parte A · Parvulario A.1–A.7, Parte B · Escolar B.1–B.8) for direct side-by-side reading.

Add a new subsection at the end of Parte B: "Cambios respecto al 30 de julio":
- Planillas ahora accesibles (of 69 previously blocked).
- Nuevos indicadores con datos.
- Fuentes recién mapeadas.
- Bloqueos que persisten.

### Verification

- `docs/informe-cobertura-fuentes-2026-08-04.md` present with all sections filled.
- `reports/coverageDiff-2026-08-04.md` shows the expected positive delta.
- `piiAssertion --all --cache` exits 0.

### STOP-AND-ASK the user

Before proceeding to W3, present the coverage diff. If unexpected regressions appear, get user direction.

---

# PHASE W3 — 2025/2026 Escolar comparator homologation

Source: `docs/homologacion-indicadores-escolar-2025-206.xlsx` (name verbatim). Reading rule (from client): where column D contains a value, that 2025 indicator maps directly to the 2026 indicator in the adjacent column; where column D is empty, no direct mapping exists.

## W3.1 — STOP-AND-ASK · Confirm the XLSX layout (NON-SKIPPABLE)

1. `scripts/inspectHomologacionXlsx.mjs` (new, read-only):
   - Reads the XLSX with `xlsx` package (already a dep).
   - Lists all sheet names.
   - Prints rows 1–10 of the relevant sheet as a table. For each row, print columns A–H values verbatim.
   - Prints total row count and the header row.
   - Do NOT interpret the columns.
2. `node scripts/inspectHomologacionXlsx.mjs > reports/homologacion-inspection-2026-08-04.txt`.
3. **STOP-AND-ASK the user** with the file contents. Ask specifically:
   - Which sheet to read (if more than one).
   - Which column is the 2026 indicator ID.
   - Which is the 2025 indicator ID / name.
   - Confirm column D is the direct-map value column.
   - How are rows for I.11, I.12 encoded (average of multiple 2025 IDs)?
   - How are I.29, I.30, I.48 encoded (lower target context)?
   - How are I.17, I.18, I.24, I.26 encoded (out of scope)?
   - How are indicators with type=new_in_2026 encoded (empty column D)?

Do NOT proceed to parsing without a reply.

## W3.2 — Parse into a data-driven mapping

1. `scripts/parseHomologacion.mjs`:
   - Reads XLSX with the confirmed semantics.
   - Emits `src/data/homologacionEscolar.json`:
     ```
     {
       "generatedAt": "2026-08-04T...",
       "source": "docs/homologacion-indicadores-escolar-2025-206.xlsx",
       "mapping": {
         "I.1":  { "type": "direct",      "from2025": "I.1" },
         "I.11": { "type": "average",     "from2025": ["I.a", "I.b"] },
         "I.29": { "type": "context",     "from2025": "I.x", "context": "Meta 2025 menor porque menos meses con el instrumento" },
         "I.17": { "type": "out_of_scope","reason": "..." },
         "I.new":{ "type": "new_in_2026", "reason": "Indicador nuevo o cambio de naturaleza (%/n)" }
       }
     }
     ```
   - Allowed `type` values: `direct`, `average`, `context`, `out_of_scope`, `new_in_2026`. Any other value → exit 1.
   - Every 2026 canonical indicator (51 in `catalog.json.indicadores.escolar2026`) must appear in the mapping — assert completeness.
   - Report to `reports/parseHomologacion-2026-08-04.json`.

## W3.3 — Wire the comparator

Files to touch:

1. **[src/views/comparador/ComparadorIndicador.jsx](src/views/comparador/ComparadorIndicador.jsx)**:
   - `import HOMOLOGACION from '../../data/homologacionEscolar.json'` at top.
   - For each Escolar indicator being compared, look up `HOMOLOGACION.mapping[indicadorId]` and branch on `type`:
     - `direct` — compare by ID identity, but MAP the 2025 lookup ID via `from2025` (don't assume 2025 uses the same ID as 2026).
     - `average` — for the 2025 side, compute the mean of the 2025 values across the `from2025` array. Skip missing peers; if less than one value present, treat as `out_of_scope` behavior.
     - `context` — same as direct + render a `<ComparadorContextNote>` beneath the bar with `context` text.
     - `out_of_scope` / `new_in_2026` — do NOT render a bar. Render a neutral, non-alarming empty state: "Comparación 2025 no disponible: {reason}". Match existing IndicatorProgress copy/style.
     - Indicator missing from mapping — same empty state with generic reason "Sin homologación con 2025".
   - Do NOT hard-code I.11, I.12, I.17, I.18, I.24, I.26, I.29, I.30, I.48 anywhere in JSX. All rules driven by the JSON.

2. `src/components/ComparadorContextNote.jsx` (new): single small paragraph, uses existing design tokens for a neutral tone. Text from the mapping.

3. Parvulario comparator path: unchanged.

## W3.4 — Docs

- Add a "Homologación 2025/2026 Escolar" subsection to `CLAUDE.md` referencing `src/data/homologacionEscolar.json` and the parse pipeline.

### Verification

1. `npm run build` succeeds.
2. `npm run dev`, log in as superadmin, open the comparador for Escolar:
   - Toggle year to 2025 for a `direct` indicator (e.g., I.1): 2025 bar renders next to 2026.
   - I.11 / I.12 (`average`): 2025 bar shows a computed mean with a small "Promedio de N indicadores 2025" caption.
   - I.29 / I.30 / I.48 (`context`): bar shown with contextual note.
   - I.17 / I.18 / I.24 / I.26 (`out_of_scope`): neutral empty state, no bar.
   - Any known `new_in_2026`: same empty state.

### What could break

- 2025 and 2026 might use different indicator ID formats. Verify via the inspection step.
- The `average` type needs proper missing-value handling: skip, don't zero. Note sample size in the caption ("Promedio de N indicadores 2025").

---

# PHASE W4 — Missing-data audit UI (display-only)

Extend existing components to surface three states per indicator: `data present`, `legitimately absent (period hasn't occurred)`, `absent because no source is mapped`. No new views. **Never touch `cumplimientoIndicadores`** — the fórmula was agreed with the client; W4 is cosmetic only.

## W4.1 — Reuse existing state

- [src/data/establecimientos.js:87](src/data/establecimientos.js#L87) — `getCoberturaLabel(coberturaEstado)` already maps the 5 manifest states.
- [src/components/Shared.jsx:177](src/components/Shared.jsx#L177) — `IndicatorProgress` already accepts `coberturaEstado` prop.
- [src/data/scope.js](src/data/scope.js) — `isAplicable2026(indicador, est, mes)` and `estadoAplicabilidad(indicador, est, mes)` decide "no aplicable aún" — reuse both.
- `docs/escolar-coverage-manifest.json` — source of coverage state per (escuela × año × indicador × curso).

## W4.2 — Make the manifest importable at runtime

1. Modify `scripts/generateEscolarCoverageManifest.mjs` to write to BOTH `docs/escolar-coverage-manifest.json` (existing) AND `src/data/escolarCoverageManifest.json` (new). Small dual-write.
2. Create `src/data/coverage.js`:
   ```
   import MANIFEST from './escolarCoverageManifest.json';
   // Build a Map<estId+'|'+anio+'|'+indicadorId, state> once, memoized.
   export function getCoberturaEscolar(estId, anio, indicadorId) { ... }
   export function getCoberturaParvulario() { return null; }  // stub
   ```
   Parvulario has 3 fully-readable Planillas Centrales; `SIN_FUENTE_MAPEADA` doesn't structurally apply. Fall back to the existing `estadoValor` in `src/data/establecimientos.js`.

## W4.3 — Extend IndicatorPanel + IndicatorProgress

1. **[src/components/IndicatorPanel.jsx](src/components/IndicatorPanel.jsx)**:
   - For each indicator card, when `programa === 'escolar'` and an `estId` is in scope: compute `coberturaEstado = getCoberturaEscolar(estId, anioSeleccionado, indicador.id)`. Pass to `IndicatorProgress`.
   - Per-ámbito summary chip: "Con dato: N · Aún no toca: M · Sin fuente: K". Use existing chip primitives or a small styled `<span>` with design tokens.

2. **[src/components/Shared.jsx](src/components/Shared.jsx) — `IndicatorProgress`**:
   - Extend the existing coberturaEstado handling (lines 187–200):
     - `NO_CORRESPONDE_AUN` → "Aún no corresponde reportar" (gray, small text, no bar).
     - `SIN_FUENTE_MAPEADA` / `FUENTE_NO_ACCESIBLE` → "Pendiente de fuente" (existing — verify treatment).
     - `SIN_DATO_REPORTADO` → new distinct pill "Sin dato reportado"; bar stays at 0% with a lighter tone; clarify contribution to ámbito average is 0.
     - `CON_DATO_REPORTADO` / `CERO_REPORTADO` → normal bar.

3. Fallback: when coberturaEstado is null (Parvulario, or Escolar without a manifest entry), use existing `estadoValor(valor, indicador)`.

## W4.4 — Sostenedor and Consultor view — same treatment

Both `VistaSostenedor` and `VistaConsultor` render `IndicatorPanel`; passing `coberturaEstado` from the panel down suffices when `estId` is available. For aggregate views (SLEP or national), per-ámbito counts are the right treatment — do not render per-establecimiento coberturaEstado there.

## W4.5 — Extend the coverage report

Extend `docs/informe-cobertura-fuentes-2026-08-04.md` (from W2) with a per-indicator matrix table for each of the 51 Escolar indicators showing counts by state.

### Verification

1. `npm run dev`, log in as an escuela user (real client account from Deploy 1 gate, if available; otherwise test account).
2. For an indicator known to lack a source (e.g., I.10 per `docs/informe-cobertura-fuentes-2026-07-30.md` §B.5): treatment shows "Pendiente de fuente", not "0%".
3. For an indicator not yet applicable per cohorte semestre: shows "Aún no corresponde reportar".
4. Ámbito percentages unchanged from before W4 — `cumplimientoIndicadores` in `scope.js` must NOT be modified.

### What could break

- Bundle size — the manifest JSON is large. If build warns, wrap `IndicatorPanel` in `React.lazy`.
- Don't change `cumplimientoIndicadores`. The three-state UI is cosmetic; underlying fórmula stays.

---

# PHASE W5 — Territorial impact map (`/geografia`) · OPTIONAL FOR HANDOVER

Superadmin-only, feature-flagged. This phase does NOT block handover. Ship only if time permits after everything else is validated.

## W5.1 — Feature flag

- Extend `src/lib/features.js`:
  ```
  export const FEATURES = {
    heatmap: import.meta.env?.VITE_FEATURE_HEATMAP === 'true',
    geografia: import.meta.env?.VITE_FEATURE_GEOGRAFIA === 'true',
  };
  ```

## W5.2 — Route

`src/App.jsx`, in the `esSuperadmin` block near lines 65-66:
```
{esSuperadmin && FEATURES.geografia && <Route path="/geografia" element={<VistaGeografia />} />}
```

Nav entry in `src/components/Layout.jsx` alongside `/usuarios` and `/consultores`, gated on the same flag.

## W5.3 — Dependencies

```
npm install leaflet react-leaflet
```

- Pin exact versions in package.json (no `^`) for handover reproducibility.
- Import `leaflet/dist/leaflet.css` INSIDE `VistaGeografia.jsx` (component-scoped). Do NOT put it in `src/index.css` — that would leak globally.
- Use `CircleMarker` (SVG) rather than `Marker` to avoid Leaflet's bundled PNG icons that break with Vite's bundler.

## W5.4 — Coordinates data

STOP-AND-ASK: how should coordinates be sourced?
- (a) Manual lat/lng per school in a JSON (client-provided CSV).
- (b) Comuna centroids with deterministic jitter per doc ID (no external API).
- (c) Geocoding API (needs a key).

Default to (b) unless user picks otherwise. Create `src/data/geoEstablecimientos.json` with 42 entries (18 escolar + 24 parvulario).

## W5.5 — Component

`src/views/VistaGeografia.jsx`:
- Uses `useEscuelas` + `useJardines` (superadmin passes `esAccesoCompleto()`; no rule issue).
- Computes per-establishment score using `cumplimientoIndicadores` from `src/data/scope.js` (reused, unchanged).
- Renders `<MapContainer center={SANTIAGO_METRO_CENTER} zoom={11}>` with OSM tiles.
- Per establishment with coordinates: `<CircleMarker>` sized by matrícula, colored by cumplimiento score using `colorSemaforo`. `<Popup>` shows aggregate info (nombre, SLEP, comuna, cumplimiento, matrícula).
- Legend explains color/radius.
- Program toggle (Escolar / Parvulario / Todos) — reuse the pattern from `VistaConsultor`.
- SLEP filter — reuse.

## W5.6 — Design token compliance

Use only tokens from `src/index.css` (`--color-cyan`, `--color-magenta`, `--color-lime`, `--color-yellow`, `--color-red`, `--color-teal`). Any raw hex fails the color-token check at build.

## W5.7 — Verification

1. Local: `VITE_FEATURE_GEOGRAFIA=true npm run dev`. Log in as superadmin. `/geografia` renders 42 markers correctly colored/sized.
2. Log in as non-superadmin — `/geografia` redirects to `/` via the wildcard route at `src/App.jsx:67`.
3. `npm run build` succeeds.
4. Bundle size — Leaflet adds ~140 KB. If concerning, wrap the route in `React.lazy`.

## W5.8 — Deploy 3 (optional)

Only if verifications pass and time permits. Turn on `VITE_FEATURE_GEOGRAFIA` in the production build env; rebuild; `npm run deploy`.

If W5 is dropped for time, no cleanup needed — the flag is off by default.

---

# PHASE W6 — Documentation and handover (final)

Not a feature; the closing tail.

1. Update `CLAUDE.md`:
   - Add the new hooks (`useSlepDoc`, `useEntidadDelPerfil`, `useValoresSlepAnio`, `useTerritorioAggregate`) to "Consultas y hooks".
   - Add `src/data/homologacionEscolar.json`, `src/data/escolarCoverageManifest.json`, `src/data/territorio.json` to "Datos" as generated files.
   - Add new scripts to "Scripts": `diagnoseAuthResolution.mjs`, `diagnoseTerritorial.mjs`, `parseTerritorio.mjs`, `repairTerritorial.mjs`, `backfillSlepOnResultados.mjs`, `backfillSlepIdOnUsuarios.mjs`, `validateUserAssignments.mjs`, `computeTerritorioAggregates.mjs`, `inspectHomologacionXlsx.mjs`, `parseHomologacion.mjs`, `coverageDiff.mjs`.
   - Add new collection `aggregatesTerritorio_real` under "Colecciones Firestore" with the doc shape example and the derived-collection deletion exception rule.
   - Add the YoY-differencing privacy analysis (from W1 documentation appendix) under "Cosas que NO tocar sin coordinar / Aggregate privacy model".
   - Add `/geografia` and its feature flag to routes (only if W5 shipped).
   - Bump the "Reescrito el" date.

2. Update `README.md`:
   - Bump state line to reflect 2026-08-04 snapshot.
   - Add `docs/informe-cobertura-fuentes-2026-08-04.md` to "Documentación vigente".

3. Extend `docs/informe-cierre-2026-08-04.md` (created in Deploy 1) with the client-facing summary covering W2–W4 (and W5 if it shipped). In es-CL, no jargon, written for Luis and Sebastián.

4. Git tag: `git tag cierre-2026-08-04`. Do NOT push without an explicit STOP-AND-ASK.

---

# Cross-cutting rules to the executor

- **Commit atomically per phase**. Conventional: `fix:`, `feat:`, `docs:`, `chore:`. Reference the phase in the body ("Phase W1(c)").
- **Do NOT push to remote** without an explicit ask.
- **Do NOT deploy** without running the phase's verification steps and getting user confirmation.
- **Do NOT delete Firestore docs from source-of-truth collections**. Aggregates collection has the documented write-new-then-delete-orphans exception (W1(peer), section on Derived-collection exception).
- **Do NOT bypass** the color-token check, PII assertion, or user-assignment validator. If they fail, fix the underlying cause. Don't add exceptions.
- **STOP-AND-ASK markers** are non-optional.

---

# Files touched — index by phase

| Phase | New files | Modified files |
|---|---|---|
| W1(c) | scripts/diagnoseAuthResolution.mjs, scripts/validateUserAssignments.mjs | src/data/realQueries.js, src/components/Layout.jsx, src/views/VistaEscuela.jsx, src/views/VistaSostenedor.jsx, src/views/GestionUsuarios.jsx, package.json |
| W1(d) | scripts/backfillSlepOnResultados.mjs | firestore.rules, firestore.indexes.json, scripts/ingestParvulario.mjs, scripts/ingestEscolar.mjs, scripts/ingestExtended.mjs, scripts/syncPlanillasCentrales.mjs, src/data/realQueries.js |
| W1(peer) | scripts/computeTerritorioAggregates.mjs, scripts/backfillSlepIdOnUsuarios.mjs | firestore.rules (aggregate collection), src/data/realQueries.js (useTerritorioAggregate), src/views/VistaEscuela.jsx (drilldown), src/components/IndicatorDrilldown.jsx (caption), CLAUDE.md (privacy analysis) |
| W1(a)(b) | scripts/diagnoseTerritorial.mjs, scripts/parseTerritorio.mjs, scripts/repairTerritorial.mjs, src/data/territorio.json | scripts/enrichEstablecimientos.mjs (strict mode), src/views/VistaConsultor.jsx (canonicalize) |
| W1 gate | (none) | docs/informe-cierre-2026-08-04.md (created) |
| W2 | scripts/coverageDiff.mjs, reports/ingestParvulario-2026-08-04.json, reports/harvestEscolar-2026-08-04.json, docs/mapeo-parvulario-2026-08-04.md, docs/informe-cobertura-fuentes-2026-08-04.md, reports/coverageDiff-2026-08-04.md | scripts/generateEscolarCoverageManifest.mjs (dual write), docs/escolar-coverage-manifest.{json,md} (regenerated) |
| W3 | scripts/inspectHomologacionXlsx.mjs, scripts/parseHomologacion.mjs, src/data/homologacionEscolar.json, src/components/ComparadorContextNote.jsx | src/views/comparador/ComparadorIndicador.jsx, CLAUDE.md |
| W4 | src/data/coverage.js, src/data/escolarCoverageManifest.json | src/components/IndicatorPanel.jsx, src/components/Shared.jsx, scripts/generateEscolarCoverageManifest.mjs (dual write), docs/informe-cobertura-fuentes-2026-08-04.md (extended) |
| W5 (optional) | src/views/VistaGeografia.jsx, src/data/geoEstablecimientos.json | src/App.jsx, src/lib/features.js, src/components/Layout.jsx, package.json (leaflet + react-leaflet) |
| W6 | (none) | CLAUDE.md, README.md, docs/informe-cierre-2026-08-04.md |
