# Architecture Decision Records

One file per decision that shapes how the platform is built or operated. An ADR
records the context, what was decided and what it costs, so the decision can be
revisited later without reconstructing the conversation that produced it.

Product decisions agreed with the client during retro 1 (D-01 … D-14) live in
the retro plan linked from `CLAUDE.md`; they are not repeated here.

## Index

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-slep-on-every-value.md) | Every value carries the SLEP of its establishment, enforced nightly | Accepted | 2026-09-30 |
| [0002](0002-platform-owned-registry.md) | Establishments and sostenedores are registered in the platform; platform edits win over planillas | Accepted | 2026-09-30 |
| [0003](0003-new-establishment-detection.md) | The nightly load detects new and missing establishments and publishes new ones immediately | Accepted | 2026-09-30 |
| [0004](0004-admin-writes-through-function.md) | Privileged writes go through a Cloud Function; users cannot write their own profile | Accepted | 2026-09-30 |
| [0005](0005-one-slep-per-sostenedor-user.md) | A sostenedor user has exactly one SLEP | Accepted | 2026-09-30 |
| [0006](0006-local-emulators.md) | Rules, functions and profile checks are verified on local emulators | Accepted | 2026-09-30 |

## Writing one

- Next free number, short kebab-case title: `NNNN-title.md`.
- Sections: **Context**, **Decision**, **Consequences**, and **Alternatives considered** when there were real ones.
- Status is `Proposed`, `Accepted`, or `Superseded by NNNN`. A superseded ADR is kept, not edited.
- Add the row to the index above in the same commit.
- Anything the decision leaves unresolved goes to [`../tech-debt.md`](../tech-debt.md) with a reference back.
