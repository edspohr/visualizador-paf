# scripts/datos/

Directorio local para depositar las planillas `.xlsx` del cliente (roster
Escolar 2026). **No se commitea** (ver `.gitignore` raíz) porque contiene PII
(nombres, teléfonos y emails de director/coordinador).

Uso:

```
node scripts/ingestRosterEscolar.mjs --inspect
node scripts/ingestRosterEscolar.mjs --dry-run
node scripts/ingestRosterEscolar.mjs
```

El script lee todos los `.xlsx` de este directorio y actualiza los campos
`nNinos` y `nAgentes` de `establecimientos_real` (escolar) por match de nombre
normalizado. Las columnas de PII se leen y descartan en memoria — nunca se
persisten ni loguean.

## Estado esperado

Hoja 1 — 13 escuelas (cohorte 2026-2028, SLEP Santa Rosa + SLEP Santa Corina).
Hoja 2 — 5 escuelas (cohorte 2025-2027, SLEP Los Parques + SLEP Del Pino).
Total: 18 filas → 18 upserts contra Firestore.
