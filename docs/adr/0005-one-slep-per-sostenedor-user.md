# 0005 — A sostenedor user has exactly one SLEP

Status: Accepted · 2026-09-30

## Context

The client reported not being able to assign "one or more" SLEPs to a
sostenedor user. The actual defects were that the assignment was not shown after
saving and was dropped on creation. Asked whether a user needs several networks
at once, the answer was: keep one SLEP per sostenedor for now, but it must be
possible to change it and to assign a new one when a sostenedor appears.

## Decision

`usuarios.slepId` stays a single value. It is assigned and changed from
"Gestión de usuarios", and the options come from the sostenedores catalog
(ADR-0002), so a SLEP can be assigned before it has establishments.

## Consequences

- No change to rules, queries or peer averages, which are all per SLEP.
- A person who oversees two SLEPs needs two accounts, or a full-access profile.
- If multi-SLEP is needed later: add `slepIds[]`, keep `slepId` as the active
  network, switch networks from the header selector, and authorize with
  `slep in slepIds`. Peer-average privacy (K_MIN per SLEP) must be reviewed then.
