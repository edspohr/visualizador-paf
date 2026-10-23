# 0008 — The comparador shows every indicator in its own unit, never as % of the meta

Status: Accepted · 2026-10-23

## Context

The comparador ("Comparación por indicador", consultor and CAP views) had two
readings. With one indicator selected it showed the mean reported value in the
indicator's unit. With "Todos los indicadores" it converted every indicator to
"% de cumplimiento vs meta": the mean of `min(1, logro)` per centre, with a
missing value counted as 0, so that counts, grades and percentages could share
one axis.

Focus found the second reading hard to explain to Fundación CAP: "N° de
personas" showing 28 %, or I.14 (coordinator attends formative modules, meta 5)
showing 58 % instead of 2,9 of 5 (tracking sheet R2-15, 25 rows; meeting
2026-10-22). Their rule: show each indicator as it is declared, a number as a
number, a percentage as a percentage, with no transformation. Simplicity of
reading wins over statistical comparability.

## Decision

- "Todos los indicadores" is a list with one row per indicator. Each row has
  its own scale (the larger of its metas and values), bars for group A and B in
  the indicator's unit, a mark at each group's meta and "n/m" centres reporting.
- A group's value is the mean of the values reported by the centres the
  indicator applies to. Centres without a value do not enter the mean (unlike
  the % de cumplimiento, where they count as 0); the row says how many reported.
- A group's meta is the mean of the metas resolved per centre
  (`resolverIndicador`: year of implementation, salas per school), so groups in
  different years or cohorts can show different metas on the same row.
- A Sí/No indicator's group mean reads as "% Sí".
- The % de cumplimiento toggle is removed from the comparador. Cumplimiento is
  still the summary metric of the school, sostenedor and national views
  (`scope.js → cumplimientoIndicadores`), which this decision does not touch.
- Indicators with a unit but no meta (Escolar I.24) are included: the
  comparison no longer needs a meta.
- "Por diferencia (A − B)" sorts by the difference relative to each row's scale.

## Consequences

- Two different years can be put side by side in raw units even when the meta
  changed between them (year-1 vs year-2 metas). The row shows both metas and
  the page note warns about it; Focus accepted this on 2026-10-22.
- The comparador mean and the cumplimiento % can disagree for the same group
  (missing values, values above the meta). The page note says so.

## Alternatives considered

- Native unit by default with a toggle back to % de cumplimiento (our proposal
  in the tracking sheet). Rejected by Focus: two readings of the same chart was
  the confusion to remove.
- One shared axis normalised to the meta. That is the old % reading under
  another name.
